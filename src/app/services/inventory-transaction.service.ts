import { Injectable, inject } from '@angular/core';
import { 
  Firestore, 
  collection, 
  doc, 
  runTransaction,
  DocumentReference 
} from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { ProductSummaryService } from './product-summary.service';
import { FIFOInventoryService } from './fifo-inventory.service';
import { ProductInventoryEntry } from '../interfaces/product-inventory-entry.interface';
import { OrderDetails, OrderDetailItem, BatchDeductionDetail } from '../interfaces/order-details.interface';
import { CartItem } from '../interfaces/cart.interface';

export interface AddBatchRequest {
  productId: string;
  batchData: Omit<ProductInventoryEntry, 'id' | 'uid' | 'createdAt' | 'updatedAt' | 'productId' | 'companyId' | 'storeId' | 'status' | 'syncStatus' | 'isOffline' | 'createdBy' | 'updatedBy' | 'initialQuantity' | 'totalDeducted'>;
}

export interface ProcessSaleRequest {
  cartItems: CartItem[];
  orderId: string;
  orderDetails?: Partial<OrderDetails>;
}

export interface AddBatchResult {
  batchId: string;
  productSummary: {
    totalStock: number;
    sellingPrice: number;
  };
}

export interface ProcessSaleResult {
  success: boolean;
  batchDeductions: {
    productId: string;
    deductions: BatchDeductionDetail[];
  }[];
  productSummaries: {
    productId: string;
    totalStock: number;
    sellingPrice: number;
  }[];
}

@Injectable({
  providedIn: 'root'
})
export class InventoryTransactionService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private productSummaryService = inject(ProductSummaryService);
  private fifoService = inject(FIFOInventoryService);

  /**
   * MASTER TRANSACTION: Add a new inventory batch
   * FIFO stock calculation + LIFO price calculation + automatic product summary update
   * ALL-OR-NOTHING: Either everything succeeds or everything fails
   */
  async addInventoryBatch(request: AddBatchRequest): Promise<AddBatchResult> {
    const { productId, batchData } = request;
    
    const currentUser = this.authService.getCurrentUser();
    const permission = this.authService.getCurrentPermission();
    
    if (!currentUser?.uid || !permission) {
      throw new Error('User not authenticated or no company permission found');
    }

    console.log('🚀 Starting MASTER TRANSACTION: Add Inventory Batch');
    console.log(`📦 Product: ${productId}, Quantity: ${batchData.quantity}, Price: ${batchData.unitPrice}`);

    return runTransaction(this.firestore, async (transaction) => {
      // 1. Create new batch document
      const batchRef = doc(collection(this.firestore, 'productInventory'));
      const batchEntry: Omit<ProductInventoryEntry, 'id'> = {
        ...batchData,
        productId,
        uid: currentUser.uid,
        companyId: permission.companyId,
        storeId: permission.storeId || '',
        status: 'active',
        createdBy: currentUser.uid,
        updatedBy: currentUser.uid,
        receivedAt: batchData.receivedAt instanceof Date ? batchData.receivedAt : new Date(batchData.receivedAt),
        expiryDate: batchData.expiryDate ? (batchData.expiryDate instanceof Date ? batchData.expiryDate : new Date(batchData.expiryDate)) : undefined,
        // VAT metadata: prefer batch-level value, fallback to unspecified (0/false)
        isVatApplicable: !!batchData.isVatApplicable,
        vatRate: Number(batchData.vatRate ?? 0),
        // Discount metadata for the batch
        hasDiscount: !!batchData.hasDiscount,
        discountType: batchData.discountType ?? 'percentage',
        discountValue: Number(batchData.discountValue ?? 0),
        syncStatus: 'SYNCED',
        isOffline: false,
        initialQuantity: batchData.quantity,
        totalDeducted: 0
      };

      transaction.set(batchRef, {
        ...batchEntry,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      console.log(`📝 Batch creation queued: ${batchRef.id}`);

      // 2. Recompute product summary (FIFO stock + LIFO price)
      const summary = await this.productSummaryService.recomputeProductSummaryInTransaction(
        transaction,
        productId
      );

      console.log(`📊 Product summary recomputed: totalStock=${summary.totalStock}, sellingPrice=${summary.sellingPrice}`);

      console.log('✅ MASTER TRANSACTION prepared successfully');

      return {
        batchId: batchRef.id,
        productSummary: summary
      };
    }).then((result) => {
      console.log(`🎉 MASTER TRANSACTION COMMITTED: Batch ${result.batchId} added successfully!`);
      return result;
    }).catch((error) => {
      console.error('❌ MASTER TRANSACTION FAILED: No changes made:', error);
      throw new Error(`Failed to add inventory batch: ${error.message}`);
    });
  }

  /**
   * MASTER TRANSACTION: Process a complete sale
   * FIFO deduction across multiple products + automatic product summary updates
   * ALL-OR-NOTHING: Either all products are deducted or nothing happens
   */
  async processSale(request: ProcessSaleRequest): Promise<ProcessSaleResult> {
    const { cartItems, orderId } = request;
    
    const currentUser = this.authService.getCurrentUser();
    const permission = this.authService.getCurrentPermission();
    
    if (!currentUser?.uid || !permission) {
      throw new Error('User not authenticated or no company permission found');
    }

    console.log('🚀 Starting MASTER TRANSACTION: Process Sale');
    console.log(`🛒 Order: ${orderId}, Items: ${cartItems.length}`);

    // Pre-validate all stock before starting transaction
    for (const item of cartItems) {
      const validation = await this.fifoService.validateStock(item.productId, item.quantity);
      if (!validation.isValid) {
        throw new Error(`Insufficient stock for ${item.name}: Available=${validation.availableStock}, Requested=${item.quantity}`);
      }
    }

    return runTransaction(this.firestore, async (transaction) => {
      const batchDeductions: { productId: string; deductions: BatchDeductionDetail[] }[] = [];
      const productSummaries: { productId: string; totalStock: number; sellingPrice: number }[] = [];

      console.log('🔄 Processing deductions for all cart items...');

      // Process each cart item
      for (const item of cartItems) {
        console.log(`📦 Processing: ${item.name} (${item.quantity} units)`);

        // Get FIFO plan for this item
        const plan = await this.fifoService.createFIFODeductionPlan(item.productId, item.quantity);
        if (!plan.canFulfill) {
          throw new Error(`Cannot fulfill FIFO plan for ${item.name}. Shortfall: ${plan.shortfall}`);
        }

        const itemDeductions: BatchDeductionDetail[] = [];

        // Process each batch allocation
        for (const allocation of plan.batchAllocations) {
          const batchRef = doc(this.firestore, 'productInventory', allocation.batchId);
          const batchDoc = await transaction.get(batchRef);
          
          if (!batchDoc.exists()) {
            throw new Error(`Batch ${allocation.batchId} not found for product ${item.name}`);
          }

          const batch = batchDoc.data() as ProductInventoryEntry;
          
          // Validate batch still has enough quantity
          if (batch.quantity < allocation.allocatedQuantity) {
            throw new Error(`Insufficient quantity in batch ${allocation.batchId} for ${item.name}. Available: ${batch.quantity}, Needed: ${allocation.allocatedQuantity}`);
          }

          // Calculate new quantities
          const newQuantity = batch.quantity - allocation.allocatedQuantity;
          const newTotalDeducted = (batch.totalDeducted || 0) + allocation.allocatedQuantity;

          // Create deduction record and persist it to `inventoryDeductions`
          const deductionRecord = {
            orderId,
            orderDetailId: `${orderId}_${item.productId}`, // Generate orderDetailId
            quantity: allocation.allocatedQuantity,
            deductedAt: new Date(),
            deductedBy: currentUser.uid,
            isOffline: false,
            syncStatus: 'SYNCED' as const,
            productId: item.productId,
            batchId: allocation.batchId
          };

          // Update batch WITHOUT writing a deductionHistory array
          const newStatus = newQuantity === 0 ? 'removed' : batch.status; // Use 'removed' when depleted
          transaction.update(batchRef, {
            quantity: newQuantity,
            totalDeducted: newTotalDeducted,
            updatedAt: new Date(),
            updatedBy: currentUser.uid,
            status: newStatus
          });

          // Persist the deduction record for auditing/querying
          const dedRef = doc(collection(this.firestore, 'inventoryDeductions'));
          transaction.set(dedRef, deductionRecord);

          console.log(`   📦 Batch ${allocation.batchId}: ${batch.quantity} -> ${newQuantity} (${newStatus})`);

          // Track deduction
          itemDeductions.push({
            batchId: allocation.batchId,
            batchNumber: batch.batchNumber?.toString(),
            quantity: allocation.allocatedQuantity,
            batchUnitPrice: batch.unitPrice,
            deductedAt: new Date(),
            isOffline: false,
            synced: true
          });
        }

        batchDeductions.push({
          productId: item.productId,
          deductions: itemDeductions
        });

        // Recompute product summary
        const summary = await this.productSummaryService.recomputeProductSummaryInTransaction(
          transaction,
          item.productId
        );

        productSummaries.push({
          productId: item.productId,
          totalStock: summary.totalStock,
          sellingPrice: summary.sellingPrice
        });

        console.log(`   📊 ${item.name}: totalStock=${summary.totalStock}, sellingPrice=${summary.sellingPrice}`);
      }

      console.log('✅ MASTER SALE TRANSACTION prepared successfully');

      return {
        success: true,
        batchDeductions,
        productSummaries
      };
    }).then((result) => {
      console.log(`🎉 MASTER SALE TRANSACTION COMMITTED: Order ${orderId} processed successfully!`);
      console.log(`   📦 Products affected: ${result.batchDeductions.length}`);
      console.log(`   🔢 Total deductions: ${result.batchDeductions.reduce((sum, p) => sum + p.deductions.length, 0)}`);
      return result;
    }).catch((error) => {
      console.error('❌ MASTER SALE TRANSACTION FAILED: No inventory changes made:', error);
      throw new Error(`Failed to process sale: ${error.message}`);
    });
  }

  /**
   * MASTER TRANSACTION: Reverse a complete sale
   * Reverse all FIFO deductions + automatic product summary updates
   * ALL-OR-NOTHING: Either all products are restored or nothing happens
   */
  async reverseSale(
    orderId: string, 
    batchDeductions: { productId: string; deductions: BatchDeductionDetail[] }[]
  ): Promise<void> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    console.log('🚀 Starting MASTER TRANSACTION: Reverse Sale');
    console.log(`🔄 Order: ${orderId}, Products: ${batchDeductions.length}`);

    await runTransaction(this.firestore, async (transaction) => {
      console.log('🔄 Reversing deductions for all products...');

      for (const productBatch of batchDeductions) {
        console.log(`📦 Reversing: ${productBatch.productId} (${productBatch.deductions.length} batches)`);

        for (const deduction of productBatch.deductions) {
          const batchRef = doc(this.firestore, 'productInventory', deduction.batchId);
          const batchDoc = await transaction.get(batchRef);
          
          if (!batchDoc.exists()) {
            console.warn(`Batch ${deduction.batchId} not found during reversal`);
            continue;
          }

          const batch = batchDoc.data() as ProductInventoryEntry;
          
          // Add quantity back
          const newQuantity = batch.quantity + deduction.quantity;
          const newTotalDeducted = Math.max(0, (batch.totalDeducted || 0) - deduction.quantity);
          
          // Update batch quantities without a per-batch deduction array
          transaction.update(batchRef, {
            quantity: newQuantity,
            totalDeducted: newTotalDeducted,
            updatedAt: new Date(),
            updatedBy: currentUser.uid,
            status: 'active' // Reactivate batch
          });

          // Log a reversal record for audit purposes
          const reversalRecord = {
            orderId,
            batchId: deduction.batchId,
            productId: productBatch.productId,
            quantity: deduction.quantity,
            reversedAt: new Date(),
            reversedBy: currentUser.uid
          };
          const reversalRef = doc(collection(this.firestore, 'inventoryDeductionReversals'));
          transaction.set(reversalRef, reversalRecord);

          console.log(`   📦 Batch ${deduction.batchId}: restored ${deduction.quantity} units (now ${newQuantity})`);
        }

        // Recompute product summary
        await this.productSummaryService.recomputeProductSummaryInTransaction(
          transaction,
          productBatch.productId
        );

        console.log(`   📊 Product ${productBatch.productId} summary recomputed`);
      }

      console.log('✅ MASTER REVERSAL TRANSACTION prepared successfully');
    }).then(() => {
      console.log(`🎉 MASTER REVERSAL TRANSACTION COMMITTED: Order ${orderId} reversed successfully!`);
    }).catch((error) => {
      console.error('❌ MASTER REVERSAL TRANSACTION FAILED: No changes made:', error);
      throw new Error(`Failed to reverse sale: ${error.message}`);
    });
  }

  /**
   * MASTER TRANSACTION: Add multiple batches for multiple products
   * Useful for bulk inventory updates
   */
  async addMultipleBatches(requests: AddBatchRequest[]): Promise<AddBatchResult[]> {
    const currentUser = this.authService.getCurrentUser();
    const permission = this.authService.getCurrentPermission();
    
    if (!currentUser?.uid || !permission) {
      throw new Error('User not authenticated or no company permission found');
    }

    console.log('🚀 Starting MASTER TRANSACTION: Add Multiple Batches');
    console.log(`📦 Batches: ${requests.length}`);

    return runTransaction(this.firestore, async (transaction) => {
      const results: AddBatchResult[] = [];
      const processedProductIds = new Set<string>();

      for (const request of requests) {
        const { productId, batchData } = request;

        // Create batch document
        const batchRef = doc(collection(this.firestore, 'productInventory'));
        const batchEntry: Omit<ProductInventoryEntry, 'id'> = {
          ...batchData,
          productId,
          uid: currentUser.uid,
          companyId: permission.companyId,
          storeId: permission.storeId || '',
          status: 'active',
          createdBy: currentUser.uid,
          updatedBy: currentUser.uid,
          receivedAt: batchData.receivedAt instanceof Date ? batchData.receivedAt : new Date(batchData.receivedAt),
          expiryDate: batchData.expiryDate ? (batchData.expiryDate instanceof Date ? batchData.expiryDate : new Date(batchData.expiryDate)) : undefined,
          // VAT / Discount metadata
          isVatApplicable: !!batchData.isVatApplicable,
          vatRate: Number(batchData.vatRate ?? 0),
          hasDiscount: !!batchData.hasDiscount,
          discountType: batchData.discountType ?? 'percentage',
          discountValue: Number(batchData.discountValue ?? 0),
          syncStatus: 'SYNCED',
          isOffline: false,
          initialQuantity: batchData.quantity,
          totalDeducted: 0
        };

        transaction.set(batchRef, {
          ...batchEntry,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        console.log(`📝 Batch queued for product ${productId}: ${batchRef.id}`);
        
        results.push({
          batchId: batchRef.id,
          productSummary: { totalStock: 0, sellingPrice: 0 } // Will be computed below
        });

        processedProductIds.add(productId);
      }

      // Recompute summaries for all affected products
      let resultIndex = 0;
      for (const request of requests) {
        if (processedProductIds.has(request.productId)) {
          const summary = await this.productSummaryService.recomputeProductSummaryInTransaction(
            transaction,
            request.productId
          );
          
          results[resultIndex].productSummary = summary;
          processedProductIds.delete(request.productId); // Only compute once per product
          
          console.log(`📊 Product ${request.productId}: totalStock=${summary.totalStock}, sellingPrice=${summary.sellingPrice}`);
        }
        resultIndex++;
      }

      console.log('✅ MASTER MULTIPLE BATCHES TRANSACTION prepared successfully');
      return results;
    }).then((results) => {
      console.log(`🎉 MASTER MULTIPLE BATCHES TRANSACTION COMMITTED: ${results.length} batches added!`);
      return results;
    }).catch((error) => {
      console.error('❌ MASTER MULTIPLE BATCHES TRANSACTION FAILED: No changes made:', error);
      throw new Error(`Failed to add multiple batches: ${error.message}`);
    });
  }
}