import { Injectable, inject } from '@angular/core';
import { 
  Firestore, 
  collection, 
  doc, 
  runTransaction,
  writeBatch,
  getDoc,
  getDocs,
  query,
  where,
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

    console.log('🚀 Starting batch write: Add Inventory Batch');

    const batch = writeBatch(this.firestore);
    
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

    batch.set(batchRef, {
      ...batchEntry,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // 2. Get product info and calculate summary
    const productRef = doc(this.firestore, 'products', productId);
    const productSnap = await getDoc(productRef);
    if (!productSnap.exists()) {
      throw new Error(`Product ${productId} not found`);
    }

    // Query all active batches to compute summary
    const batchesQuery = query(
      collection(this.firestore, 'productInventory'),
      where('productId', '==', productId),
      where('status', '==', 'active')
    );
    const batchesSnap = await getDocs(batchesQuery);
    
    let totalStock = batchData.quantity; // Start with new batch
    let sellingPrice = Number(batchData.sellingPrice || batchData.unitPrice || 0);
    let originalPrice = Number(batchData.unitPrice || 0);
    
    // Add existing batches
    batchesSnap.forEach((docSnapshot) => {
      const batch = docSnapshot.data() as ProductInventoryEntry;
      totalStock += Number(batch.quantity || 0);
    });
    
    // Update product with new summary
    batch.update(productRef, {
      totalStock,
      sellingPrice,
      originalPrice,
      lastUpdated: new Date(),
      updatedBy: currentUser.uid
    });
    
    try {
      await batch.commit();
      console.log(`🎉 Batch write committed: Batch ${batchRef.id} added successfully!`);
      return {
        batchId: batchRef.id,
        productSummary: { totalStock, sellingPrice }
      };
    } catch (error) {
      console.error('❌ Batch write failed:', error);
      throw new Error(`Failed to add inventory batch: ${error instanceof Error ? error.message : String(error)}`);
    }
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

    // Pre-validate all stock before starting transaction
    for (const item of cartItems) {
      const validation = await this.fifoService.validateStock(item.productId, item.quantity);
      if (!validation.isValid) {
        throw new Error(`Insufficient stock for ${item.name}: Available=${validation.availableStock}, Requested=${item.quantity}`);
      }
    }

    const batch = writeBatch(this.firestore);
    const batchDeductions: { productId: string; deductions: BatchDeductionDetail[] }[] = [];
    const productSummaries: { productId: string; totalStock: number; sellingPrice: number }[] = [];

    console.log('📦 Processing deductions for all cart items...');

    // Process each cart item
    for (const item of cartItems) {
      // Get FIFO plan for this item
      const plan = await this.fifoService.createFIFODeductionPlan(item.productId, item.quantity);
      if (!plan.canFulfill) {
        throw new Error(`Cannot fulfill FIFO plan for ${item.name}. Shortfall: ${plan.shortfall}`);
      }

      const itemDeductions: BatchDeductionDetail[] = [];
      const updatedBatchesForProduct: ProductInventoryEntry[] = [];

      // Process each batch allocation
      for (const allocation of plan.batchAllocations) {
        const batchRef = doc(this.firestore, 'productInventory', allocation.batchId);
        const batchDoc = await getDoc(batchRef);
        
        if (!batchDoc.exists()) {
          throw new Error(`Batch ${allocation.batchId} not found for product ${item.name}`);
        }

        const batchData = batchDoc.data() as ProductInventoryEntry;
        
        // Validate batch still has enough quantity
        if (batchData.quantity < allocation.allocatedQuantity) {
          throw new Error(`Insufficient quantity in batch ${allocation.batchId} for ${item.name}. Available: ${batchData.quantity}, Needed: ${allocation.allocatedQuantity}`);
        }

        // Calculate new quantities
        const newQuantity = batchData.quantity - allocation.allocatedQuantity;
        const newTotalDeducted = (batchData.totalDeducted || 0) + allocation.allocatedQuantity;

        // Create deduction record and persist it to `inventoryDeductions`
        const deductionRecord = {
          orderId,
          orderDetailId: `${orderId}_${item.productId}`,
          quantity: allocation.allocatedQuantity,
          deductedAt: new Date(),
          deductedBy: currentUser.uid,
          isOffline: false,
          syncStatus: 'SYNCED' as const,
          productId: item.productId,
          batchId: allocation.batchId
        };

        // Update batch
        const newStatus = newQuantity === 0 ? 'removed' : batchData.status;
        batch.update(batchRef, {
          quantity: newQuantity,
          totalDeducted: newTotalDeducted,
          updatedAt: new Date(),
          updatedBy: currentUser.uid,
          status: newStatus
        });

        // Persist the deduction record for auditing
        const dedRef = doc(collection(this.firestore, 'inventoryDeductions'));
        batch.set(dedRef, deductionRecord);

        // Track deduction
        itemDeductions.push({
          batchId: allocation.batchId,
          batchNumber: batchData.batchNumber?.toString(),
          quantity: allocation.allocatedQuantity,
          batchUnitPrice: batchData.unitPrice,
          deductedAt: new Date(),
          isOffline: false,
          synced: true
        });

        // Capture the updated batch state
        updatedBatchesForProduct.push({
          ...batchData,
          quantity: newQuantity,
          totalDeducted: newTotalDeducted,
          status: newStatus
        } as ProductInventoryEntry);
      }

      batchDeductions.push({
        productId: item.productId,
        deductions: itemDeductions
      });
    }
    
    // Commit batch writes
    await batch.commit();
    console.log('✅ Sale processing batch write completed');
    
    // Update product summaries separately
    for (const item of cartItems) {
      const summary = await this.productSummaryService.recomputeProductSummary(item.productId);
      productSummaries.push({
        productId: item.productId,
        totalStock: summary.totalStock,
        sellingPrice: summary.sellingPrice
      });
    }

    console.log(`🎉 Sale processing completed: Order ${orderId} processed successfully!`);
    
    return {
      success: true,
      batchDeductions,
      productSummaries
    };
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

    console.log('🚀 Starting batch write: Reverse Sale');

    const batch = writeBatch(this.firestore);
    console.log('📦 Reversing deductions for all products...');

    for (const productBatch of batchDeductions) {
      const updatedBatchesForProduct: ProductInventoryEntry[] = [];

      for (const deduction of productBatch.deductions) {
        const batchRef = doc(this.firestore, 'productInventory', deduction.batchId);
        const batchDoc = await getDoc(batchRef);
        
        if (!batchDoc.exists()) {
          console.warn(`Batch ${deduction.batchId} not found during reversal`);
          continue;
        }

        const batchData = batchDoc.data() as ProductInventoryEntry;
        
        // Add quantity back
        const newQuantity = batchData.quantity + deduction.quantity;
        const newTotalDeducted = Math.max(0, (batchData.totalDeducted || 0) - deduction.quantity);
        
        // Update batch quantities
        batch.update(batchRef, {
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
        batch.set(reversalRef, reversalRecord);

        // Capture updated batch state
        updatedBatchesForProduct.push({
          ...batchData,
          quantity: newQuantity,
          totalDeducted: newTotalDeducted,
          status: 'active'
        } as ProductInventoryEntry);
      }
    }
    
    // Commit batch writes
    await batch.commit();
    console.log('✅ Sale reversal batch write completed');
    
    // Update product summaries separately
    for (const productBatch of batchDeductions) {
      await this.productSummaryService.recomputeProductSummary(productBatch.productId);
    }

    console.log(`🎉 Sale reversal completed: Order ${orderId} reversed successfully!`);
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