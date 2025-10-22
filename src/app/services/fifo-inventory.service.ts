import { Injectable, inject } from '@angular/core';
import { Firestore, collection, query, where, orderBy, getDocs, doc, updateDoc, runTransaction, writeBatch } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { ProductInventoryEntry, BatchDeduction } from '../interfaces/product-inventory-entry.interface';
import { FIFODeductionPlan, StockValidation, BatchDeductionDetail } from '../interfaces/order-details.interface';

@Injectable({
  providedIn: 'root'
})
export class FIFOInventoryService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);

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
   * Executes FIFO deduction (ONLINE MODE ONLY)
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

    // Execute deduction in Firestore transaction
    const deductionDetails = await runTransaction(this.firestore, async (transaction) => {
      const deductions: BatchDeductionDetail[] = [];
      
      for (const allocation of plan.batchAllocations) {
        const batchRef = doc(this.firestore, 'productInventoryEntries', allocation.batchId);
        const batchDoc = await transaction.get(batchRef);
        
        if (!batchDoc.exists()) {
          throw new Error(`Batch ${allocation.batchId} not found`);
        }

        const batch = batchDoc.data() as ProductInventoryEntry;
        
        // Validate batch still has enough quantity
        if (batch.quantity < allocation.allocatedQuantity) {
          throw new Error(`Insufficient quantity in batch ${allocation.batchId}. Available: ${batch.quantity}, Needed: ${allocation.allocatedQuantity}`);
        }

        // Calculate new quantities
        const newQuantity = batch.quantity - allocation.allocatedQuantity;
        const newTotalDeducted = (batch.totalDeducted || 0) + allocation.allocatedQuantity;

        // Create deduction record
        const deductionRecord: BatchDeduction = {
          orderId,
          orderDetailId,
          quantity: allocation.allocatedQuantity,
          deductedAt: new Date(),
          deductedBy: currentUser.uid,
          isOffline: false,
          syncStatus: 'SYNCED'
        };

        // Update batch
        const updatedDeductionHistory = [...(batch.deductionHistory || []), deductionRecord];
        
        transaction.update(batchRef, {
          quantity: newQuantity,
          totalDeducted: newTotalDeducted,
          deductionHistory: updatedDeductionHistory,
          updatedAt: new Date(),
          updatedBy: currentUser.uid,
          status: newQuantity === 0 ? 'inactive' : batch.status
        });

        // Add to deduction details
        deductions.push({
          batchId: allocation.batchId,
          batchNumber: batch.batchNumber?.toString(),
          quantity: allocation.allocatedQuantity,
          batchUnitPrice: batch.unitPrice,
          deductedAt: new Date(),
          isOffline: false,
          synced: true
        });
      }

      return deductions;
    });

    console.log(`Successfully executed FIFO deduction for product ${productId}:`, deductionDetails);
    return deductionDetails;
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

    const inventoryRef = collection(this.firestore, 'productInventoryEntries');
    const q = query(
      inventoryRef,
      where('productId', '==', productId),
      where('companyId', '==', permission.companyId),
      where('status', '==', 'active'),
      where('quantity', '>', 0),
      orderBy('receivedAt', 'asc') // FIFO: oldest first
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as ProductInventoryEntry));
  }

  /**
   * Reverses a FIFO deduction (for returns or adjustments)
   */
  async reverseFIFODeduction(deductions: BatchDeductionDetail[], orderId: string): Promise<void> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    await runTransaction(this.firestore, async (transaction) => {
      for (const deduction of deductions) {
        const batchRef = doc(this.firestore, 'productInventoryEntries', deduction.batchId);
        const batchDoc = await transaction.get(batchRef);
        
        if (!batchDoc.exists()) {
          console.warn(`Batch ${deduction.batchId} not found during reversal`);
          continue;
        }

        const batch = batchDoc.data() as ProductInventoryEntry;
        
        // Add quantity back
        const newQuantity = batch.quantity + deduction.quantity;
        const newTotalDeducted = Math.max(0, (batch.totalDeducted || 0) - deduction.quantity);
        
        // Remove from deduction history
        const updatedDeductionHistory = (batch.deductionHistory || []).filter(
          d => d.orderId !== orderId
        );

        transaction.update(batchRef, {
          quantity: newQuantity,
          totalDeducted: newTotalDeducted,
          deductionHistory: updatedDeductionHistory,
          updatedAt: new Date(),
          updatedBy: currentUser.uid,
          status: 'active' // Reactivate if was inactive due to zero quantity
        });
      }
    });

    console.log(`Successfully reversed FIFO deduction for order ${orderId}`);
  }

  /**
   * Gets deduction history for a specific product or batch
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

    const inventoryRef = collection(this.firestore, 'productInventoryEntries');
    let q;

    if (batchId) {
      q = query(inventoryRef, where('batchId', '==', batchId));
    } else if (productId) {
      q = query(
        inventoryRef,
        where('productId', '==', productId),
        where('companyId', '==', permission.companyId)
      );
    } else {
      throw new Error('Either productId or batchId must be provided');
    }

    const snapshot = await getDocs(q);
    const allDeductions: BatchDeduction[] = [];

    snapshot.docs.forEach(doc => {
      const batch = doc.data() as ProductInventoryEntry;
      if (batch.deductionHistory) {
        allDeductions.push(...batch.deductionHistory);
      }
    });

    return allDeductions.sort((a, b) => 
      new Date(b.deductedAt).getTime() - new Date(a.deductedAt).getTime()
    );
  }
}