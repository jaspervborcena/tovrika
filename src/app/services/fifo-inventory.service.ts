import { Injectable, inject } from '@angular/core';
import { Firestore, collection, query, where, orderBy, getDocs, doc, updateDoc, runTransaction, writeBatch, getDoc } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { ProductService } from './product.service';
import { ProductSummaryService } from './product-summary.service';
import { ProductInventoryEntry, BatchDeduction } from '../interfaces/product-inventory-entry.interface';
import { FIFODeductionPlan, StockValidation, BatchDeductionDetail } from '../interfaces/order-details.interface';

@Injectable({
  providedIn: 'root'
})
export class FIFOInventoryService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private productService = inject(ProductService);
  private productSummaryService = inject(ProductSummaryService);

  /**
   * Validates if requested quantity can be fulfilled using FIFO logic
   */
  async validateStock(productId: string, requestedQuantity: number): Promise<StockValidation> {
    try {
      const availableBatches = await this.getAvailableBatchesFIFO(productId);
      const totalAvailable = availableBatches.reduce((sum, batch) => sum + batch.quantity, 0);
      
      const validation: StockValidation = {
        isValid: totalAvailable >= requestedQuantity,
        availableStock: totalAvailable,
        requestedQuantity,
        availableBatches: availableBatches.map(batch => ({
          batchId: batch.batchId,
          quantity: batch.quantity,
          createdAt: batch.receivedAt,
          unitPrice: batch.unitPrice
        }))
      };

      if (!validation.isValid) {
        validation.errors = [`Insufficient stock. Available: ${totalAvailable}, Requested: ${requestedQuantity}`];
      }

      if (totalAvailable < requestedQuantity * 1.1) { // Warning if stock is getting low
        validation.warnings = ['Stock level is getting low'];
      }

      return validation;
    } catch (error) {
      console.error('Error validating stock:', error);
      return {
        isValid: false,
        availableStock: 0,
        requestedQuantity,
        availableBatches: [],
        errors: ['Failed to validate stock availability']
      };
    }
  }

  /**
   * Creates a FIFO deduction plan without actually deducting (for planning purposes)
   */
  async createFIFODeductionPlan(productId: string, quantityNeeded: number): Promise<FIFODeductionPlan> {
    const availableBatches = await this.getAvailableBatchesFIFO(productId);
    let remainingNeeded = quantityNeeded;
    const batchAllocations: FIFODeductionPlan['batchAllocations'] = [];
    let batchOrder = 1;

    for (const batch of availableBatches) {
      if (remainingNeeded <= 0) break;

      const allocatedQuantity = Math.min(batch.quantity, remainingNeeded);
      
      batchAllocations.push({
        batchId: batch.batchId,
        allocatedQuantity,
        remainingInBatch: batch.quantity - allocatedQuantity,
        batchOrder
      });

      remainingNeeded -= allocatedQuantity;
      batchOrder++;
    }

    return {
      productId,
      totalQuantityNeeded: quantityNeeded,
      batchAllocations,
      canFulfill: remainingNeeded <= 0,
      shortfall: remainingNeeded > 0 ? remainingNeeded : undefined
    };
  }

  /**
   * Executes FIFO deduction with full transaction consistency (ONLINE MODE ONLY)
   * ALL-OR-NOTHING: All batch deductions and product summary update happen atomically
   */
  async executeFIFODeduction(
    productId: string, 
    quantityToDeduct: number, 
    orderId: string,
    orderDetailId: string,
    isOffline: boolean = false
  ): Promise<BatchDeductionDetail[]> {
    if (isOffline) {
      throw new Error('Cannot execute inventory deduction in offline mode');
    }

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    // Get current company permission
    const permission = this.authService.getCurrentPermission();
    if (!permission) {
      throw new Error('No company permission found');
    }

    // First validate we have enough stock
    const validation = await this.validateStock(productId, quantityToDeduct);
    if (!validation.isValid) {
      throw new Error(`Insufficient stock for product ${productId}. Available: ${validation.availableStock}, Requested: ${quantityToDeduct}`);
    }

    // Get FIFO plan
    const plan = await this.createFIFODeductionPlan(productId, quantityToDeduct);
    if (!plan.canFulfill) {
      throw new Error(`Cannot fulfill FIFO deduction plan. Shortfall: ${plan.shortfall}`);
    }

    // Execute using batch writes for offline support
    const batch = writeBatch(this.firestore);
    console.log('📦 Starting FIFO deduction batch write...');
    const deductions: BatchDeductionDetail[] = [];
    const updatedBatches: ProductInventoryEntry[] = [];
    
    for (const allocation of plan.batchAllocations) {
      const batchRef = doc(this.firestore, 'productInventory', allocation.batchId);
      const batchDoc = await getDoc(batchRef);
      
      if (!batchDoc.exists()) {
        throw new Error(`Batch ${allocation.batchId} not found`);
      }

      const batchData = batchDoc.data() as ProductInventoryEntry;
      
      // Validate batch still has enough quantity
      if (batchData.quantity < allocation.allocatedQuantity) {
        throw new Error(`Insufficient quantity in batch ${allocation.batchId}. Available: ${batchData.quantity}, Needed: ${allocation.allocatedQuantity}`);
      }

      // Calculate new quantities
      const newQuantity = batchData.quantity - allocation.allocatedQuantity;
      const newTotalDeducted = (batchData.totalDeducted || 0) + allocation.allocatedQuantity;

      // Create deduction record in a dedicated collection
      const deductionRecord: BatchDeduction & { productId: string; batchId: string } = {
        orderId,
        orderDetailId,
        quantity: allocation.allocatedQuantity,
        deductedAt: new Date(),
        deductedBy: currentUser.uid,
        isOffline: false,
        syncStatus: 'SYNCED',
        productId,
        batchId: allocation.batchId
      };

      // Update batch with new status logic
      const newStatus = newQuantity === 0 ? 'removed' : batchData.status;

      batch.update(batchRef, {
        quantity: newQuantity,
        totalDeducted: newTotalDeducted,
        updatedAt: new Date(),
        updatedBy: currentUser.uid,
        status: newStatus
      });

      // Persist the deduction record to the `inventoryDeductions` collection
      const deductionRef = doc(collection(this.firestore, 'inventoryDeductions'));
      batch.set(deductionRef, deductionRecord);

      console.log(`📦 Batch ${allocation.batchId}: ${batchData.quantity} -> ${newQuantity} (status: ${newStatus})`);

      // Add to deduction details
      deductions.push({
        batchId: allocation.batchId,
        batchNumber: batchData.batchNumber?.toString(),
        quantity: allocation.allocatedQuantity,
        batchUnitPrice: batchData.unitPrice,
        deductedAt: new Date(),
        isOffline: false,
        synced: true
      });

      // Prepare updated batch snapshot for summary recompute
      const updatedBatch: ProductInventoryEntry = {
        ...batchData,
        quantity: newQuantity,
        totalDeducted: newTotalDeducted,
        status: newStatus
      } as ProductInventoryEntry;

      updatedBatches.push(updatedBatch);
    }

    // Commit batch writes
    await batch.commit();
    console.log('✅ FIFO deduction batch write completed');
    
    // Update product summary separately
    console.log('📊 Updating product summary after deduction...');
    await this.productSummaryService.recomputeProductSummary(productId);

    console.log(`🎉 FIFO deduction completed! Product ${productId} deducted ${quantityToDeduct} units across ${deductions.length} batches`);
    return deductions;
  }

  /**
   * Plans FIFO deduction for offline mode (no actual deduction)
   */
  async planOfflineFIFODeduction(productId: string, quantityNeeded: number): Promise<BatchDeductionDetail[]> {
    const plan = await this.createFIFODeductionPlan(productId, quantityNeeded);
    
    if (!plan.canFulfill) {
      throw new Error(`Cannot fulfill offline deduction plan. Shortfall: ${plan.shortfall}`);
    }

    return plan.batchAllocations.map(allocation => ({
      batchId: allocation.batchId,
      quantity: allocation.allocatedQuantity,
      isOffline: true,
      synced: false
    }));
  }

  /**
   * Gets available inventory batches sorted by FIFO (oldest first)
   * Uses fallback query to avoid index requirements
   */
  async getAvailableBatchesFIFO(productId: string): Promise<ProductInventoryEntry[]> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    // Get current company permission
    const permission = this.authService.getCurrentPermission();
    if (!permission) {
      throw new Error('No company permission found');
    }

    const inventoryRef = collection(this.firestore, 'productInventory');
    
    try {
      // Try the optimized query first (if index exists)
      const q = query(
        inventoryRef,
        where('productId', '==', productId),
        where('companyId', '==', permission.companyId),
        where('status', '==', 'active'),
        orderBy('receivedAt', 'asc') // FIFO: oldest first
      );

      const snapshot = await getDocs(q);
      const batches = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ProductInventoryEntry));

      // Filter out zero quantities in memory
      return batches.filter(batch => (batch.quantity || 0) > 0);

    } catch (indexError: any) {
      console.warn('⚠️ Firestore index not ready for getAvailableBatchesFIFO, using fallback:', indexError.message);
      
      // Fallback: Simple query and filter in memory
      const simpleQuery = query(
        inventoryRef,
        where('productId', '==', productId),
        where('companyId', '==', permission.companyId)
      );

      const snapshot = await getDocs(simpleQuery);
      const allBatches = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ProductInventoryEntry));

      // Filter and sort in memory
      return allBatches
        .filter(batch => batch.status === 'active' && (batch.quantity || 0) > 0)
        .sort((a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime());
    }
  }

  /**
   * Reverses a FIFO deduction with full transaction consistency (for returns or adjustments)
   * ALL-OR-NOTHING: All batch reversals and product summary update happen atomically
   */
  async reverseFIFODeduction(deductions: BatchDeductionDetail[], orderId: string, productId: string): Promise<void> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const batch = writeBatch(this.firestore);
    console.log('📦 Starting FIFO reversal batch write...');

    for (const deduction of deductions) {
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
        productId,
        quantity: deduction.quantity,
        reversedAt: new Date(),
        reversedBy: currentUser.uid
      };
      const reversalRef = doc(collection(this.firestore, 'inventoryDeductionReversals'));
      batch.set(reversalRef, reversalRecord);

      console.log(`📦 Batch ${deduction.batchId}: restored ${deduction.quantity} units (now ${newQuantity})`);
    }

    // Commit batch writes
    await batch.commit();
    console.log('✅ FIFO reversal batch write completed');
    
    // Update product summary separately
    console.log('📊 Updating product summary after reversal...');
    await this.productSummaryService.recomputeProductSummary(productId);

    console.log(`🎉 FIFO reversal completed! Order ${orderId} reversed successfully`);
  }

  /**
   * Gets deduction history for a specific product or batch
   */
  /**
   * Gets deduction history for a specific product or batch from the
   * `inventoryDeductions` collection. This replaces the old pattern of
   * reading a `deductionHistory` array on the batch document.
   */
  async getDeductionHistory(productId?: string, batchId?: string): Promise<BatchDeduction[]> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    // Get current company permission
    const permission = this.authService.getCurrentPermission();
    if (!permission) {
      throw new Error('No company permission found');
    }

    // Query the new `inventoryDeductions` collection
    const deductionsRef = collection(this.firestore, 'inventoryDeductions');
    let q;

    if (batchId) {
      q = query(deductionsRef, where('batchId', '==', batchId));
    } else if (productId) {
      q = query(deductionsRef, where('productId', '==', productId));
    } else {
      throw new Error('Either productId or batchId must be provided');
    }

    const snapshot = await getDocs(q);
    const allDeductions: BatchDeduction[] = snapshot.docs.map(d => d.data() as BatchDeduction);

    return allDeductions.sort((a, b) => 
      new Date(b.deductedAt).getTime() - new Date(a.deductedAt).getTime()
    );
  }
}