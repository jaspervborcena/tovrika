import { Injectable, inject } from '@angular/core';
import { Firestore, collection, query, where, getDocs, doc, updateDoc, runTransaction, addDoc } from '@angular/fire/firestore';
import { OfflineDocumentService } from '../core/services/offline-document.service';
import { AuthService } from './auth.service';
import { NetworkService } from './network.service';
import { OfflineOrderService } from './offline-order.service';
import { FIFOInventoryService } from './fifo-inventory.service';
import { OrderDetails, OrderDetailItem, SyncResult, ItemDiscrepancy } from '../interfaces/order-details.interface';
import { ProductInventoryEntry } from '../interfaces/product-inventory-entry.interface';

@Injectable({
  providedIn: 'root'
})
export class SyncAdjustmentService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private networkService = inject(NetworkService);
  private offlineOrderService = inject(OfflineOrderService);
  private fifoService = inject(FIFOInventoryService);
  private offlineDocService = inject(OfflineDocumentService);

  constructor() {
    // Listen for network restoration to trigger auto-sync
    this.networkService.onNetworkChange((isOnline) => {
      if (isOnline) {
        this.triggerAutoSync();
      }
    });
  }

  /**
   * Automatically sync pending offline orders when coming online
   */
  async triggerAutoSync(): Promise<SyncResult[]> {
    console.log('🔄 Triggering auto-sync of offline orders...');
    
    if (!this.networkService.isOnline()) {
      console.log('❌ Cannot sync: Still offline');
      return [];
    }

    const pendingOrders = this.offlineOrderService.getPendingOfflineOrders();
    if (pendingOrders.length === 0) {
      console.log('✅ No pending orders to sync');
      return [];
    }

    console.log(`📦 Found ${pendingOrders.length} pending orders to sync`);
    const syncResults: SyncResult[] = [];

    for (const order of pendingOrders) {
      try {
        const result = await this.syncSingleOrder(order);
        syncResults.push(result);
      } catch (error) {
        console.error(`Failed to sync order ${order.orderId}:`, error);
        syncResults.push({
          orderId: order.orderId,
          success: false,
          syncStatus: 'PENDING',
          adjustmentRequired: true,
          errorDetails: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Notify user of sync results
    this.notifySyncResults(syncResults);
    return syncResults;
  }

  /**
   * Sync a single offline order
   */
  async syncSingleOrder(order: OrderDetails): Promise<SyncResult> {
    console.log(`🔄 Syncing order ${order.orderId}...`);

    try {
      // Validate current inventory state against planned deductions
      const validation = await this.validateOrderAgainstCurrentInventory(order);
      
      if (validation.canAutoSync) {
        // Execute the planned deductions
        return await this.executeOrderSync(order);
      } else {
        // Mark for manual adjustment
        await this.markOrderForAdjustment(order, validation.discrepancies);
        return {
          orderId: order.orderId,
          success: false,
          syncStatus: 'PENDING_ADJUSTMENT',
          adjustmentRequired: true,
          discrepancies: validation.discrepancies,
          message: 'Order requires manual adjustment due to inventory discrepancies'
        };
      }
    } catch (error) {
      console.error(`Error syncing order ${order.orderId}:`, error);
      return {
        orderId: order.orderId,
        success: false,
        syncStatus: 'PENDING',
        adjustmentRequired: true,
        errorDetails: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Validate order against current inventory state
   */
  private async validateOrderAgainstCurrentInventory(order: OrderDetails): Promise<{
    canAutoSync: boolean;
    discrepancies: ItemDiscrepancy[];
    totalDiscrepancy: number;
  }> {
    const discrepancies: ItemDiscrepancy[] = [];
    let totalDiscrepancy = 0;

    for (const item of order.items) {
      try {
        // Get current available stock
        const availableBatches = await this.fifoService.getAvailableBatchesFIFO(item.productId);
        const currentStock = availableBatches.reduce((sum, batch) => sum + batch.quantity, 0);
        
        // Check if we still have enough stock
        if (currentStock < item.quantity) {
          const shortfall = item.quantity - currentStock;
          totalDiscrepancy += shortfall;
          
          discrepancies.push({
            productId: item.productId,
            productName: item.productName,
            expectedQuantity: item.quantity,
            actualQuantity: currentStock,
            missingQuantity: shortfall,
            affectedBatches: availableBatches.map(b => b.batchId),
            recommendedAction: shortfall > item.quantity * 0.5 ? 'CANCEL_ORDER' : 'MANUAL_ADJUSTMENT'
          });
        }

        // Validate planned batch deductions are still available
        for (const plannedDeduction of item.batchDeductions) {
          const batch = availableBatches.find(b => b.batchId === plannedDeduction.batchId);
          if (!batch) {
            discrepancies.push({
              productId: item.productId,
              productName: item.productName,
              expectedQuantity: plannedDeduction.quantity,
              actualQuantity: 0,
              missingQuantity: plannedDeduction.quantity,
              affectedBatches: [plannedDeduction.batchId],
              recommendedAction: 'MANUAL_ADJUSTMENT'
            });
          } else if (batch.quantity < plannedDeduction.quantity) {
            const shortfall = plannedDeduction.quantity - batch.quantity;
            discrepancies.push({
              productId: item.productId,
              productName: item.productName,
              expectedQuantity: plannedDeduction.quantity,
              actualQuantity: batch.quantity,
              missingQuantity: shortfall,
              affectedBatches: [plannedDeduction.batchId],
              recommendedAction: 'MANUAL_ADJUSTMENT'
            });
          }
        }

      } catch (error) {
        console.error(`Error validating item ${item.productId}:`, error);
        discrepancies.push({
          productId: item.productId,
          productName: item.productName,
          expectedQuantity: item.quantity,
          actualQuantity: 0,
          missingQuantity: item.quantity,
          affectedBatches: [],
          recommendedAction: 'INVENTORY_RECOUNT'
        });
      }
    }

    // Can auto-sync if no discrepancies or only minor ones
    const canAutoSync = discrepancies.length === 0 || 
                       (totalDiscrepancy === 0 && discrepancies.every(d => d.recommendedAction !== 'CANCEL_ORDER'));

    return {
      canAutoSync,
      discrepancies,
      totalDiscrepancy
    };
  }

  /**
   * Execute order sync by applying FIFO deductions
   */
  private async executeOrderSync(order: OrderDetails): Promise<SyncResult> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    try {
      // Execute FIFO deductions for each item
      for (const item of order.items) {
        const actualDeductions = await this.fifoService.executeFIFODeduction(
          item.productId,
          item.quantity,
          order.orderId,
          order.id || order.orderId,
          false // isOffline = false (we're now online)
        );

        // Update item with actual deductions
        item.batchDeductions = actualDeductions;
        item.syncStatus = 'SYNCED';
      }

      // Update order status
      order.syncStatus = 'SYNCED';
      order.onlineProcessedAt = new Date();
      order.updatedAt = new Date();
      order.updatedBy = currentUser.uid;

      // Store synced order in Firestore
      await this.storeOrderInFirestore(order);

      // Update offline order status
      await this.offlineOrderService.updateOfflineOrderSyncStatus(order.orderId, 'SYNCED', false);

      console.log(`✅ Successfully synced order ${order.orderId}`);
      return {
        orderId: order.orderId,
        success: true,
        syncStatus: 'SYNCED',
        adjustmentRequired: false,
        message: 'Order successfully synced with inventory deductions applied'
      };

    } catch (error) {
      console.error(`Failed to execute sync for order ${order.orderId}:`, error);
      throw error;
    }
  }

  /**
   * Mark order for manual adjustment
   */
  private async markOrderForAdjustment(order: OrderDetails, discrepancies: ItemDiscrepancy[]): Promise<void> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    // Update order with adjustment requirements
    order.syncStatus = 'PENDING_ADJUSTMENT';
    order.adjustmentRequired = true;
    order.adjustmentNotes = `Inventory discrepancies found: ${discrepancies.length} items need adjustment`;
    order.updatedAt = new Date();
    order.updatedBy = currentUser.uid;

    // Mark items that need adjustment
    for (const item of order.items) {
      const itemDiscrepancy = discrepancies.find(d => d.productId === item.productId);
      if (itemDiscrepancy) {
        item.syncStatus = 'PENDING_ADJUSTMENT';
        item.adjustmentRequired = true;
        item.discrepancy = {
          type: 'QUANTITY_MISMATCH',
          expectedQuantity: itemDiscrepancy.expectedQuantity,
          actualQuantity: itemDiscrepancy.actualQuantity,
          notes: `Missing ${itemDiscrepancy.missingQuantity} units`
        };
      }
    }

    // Update offline order status
    await this.offlineOrderService.updateOfflineOrderSyncStatus(order.orderId, 'PENDING_ADJUSTMENT', true);

    console.log(`⚠️ Order ${order.orderId} marked for manual adjustment`);
  }

  /**
   * Manually resolve order adjustments
   */
  async manuallyResolveOrder(orderId: string, resolutions: {
    itemId: string;
    action: 'APPROVE' | 'PARTIAL_APPROVE' | 'CANCEL';
    adjustedQuantity?: number;
    notes?: string;
  }[]): Promise<SyncResult> {
    const orders = this.offlineOrderService.getOfflineOrders();
    const order = orders.find(o => o.orderId === orderId);
    
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    if (order.syncStatus !== 'PENDING_ADJUSTMENT') {
      throw new Error(`Order ${orderId} is not pending adjustment`);
    }

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    try {
      // Apply resolutions
      for (const resolution of resolutions) {
        const item = order.items.find(i => i.productId === resolution.itemId);
        if (!item) continue;

        switch (resolution.action) {
          case 'APPROVE':
            // Execute FIFO deduction with original quantity
            const deductions = await this.fifoService.executeFIFODeduction(
              item.productId,
              item.quantity,
              order.orderId,
              order.id || order.orderId,
              false
            );
            item.batchDeductions = deductions;
            item.syncStatus = 'SYNCED';
            item.adjustmentRequired = false;
            break;

          case 'PARTIAL_APPROVE':
            if (resolution.adjustedQuantity && resolution.adjustedQuantity > 0) {
              // Execute FIFO deduction with adjusted quantity
              const partialDeductions = await this.fifoService.executeFIFODeduction(
                item.productId,
                resolution.adjustedQuantity,
                order.orderId,
                order.id || order.orderId,
                false
              );
              item.batchDeductions = partialDeductions;
              item.quantity = resolution.adjustedQuantity;
              item.total = item.price * resolution.adjustedQuantity;
              item.syncStatus = 'SYNCED';
              item.adjustmentRequired = false;
            }
            break;

          case 'CANCEL':
            // Remove item from order
            item.quantity = 0;
            item.total = 0;
            item.batchDeductions = [];
            item.syncStatus = 'SYNCED';
            item.adjustmentRequired = false;
            break;
        }
      }

      // Recalculate order totals
      order.subtotal = order.items.reduce((sum, item) => sum + item.total, 0);
      order.totalAmount = order.subtotal + order.taxAmount - order.discountAmount;

      // Update order status
      order.syncStatus = 'SYNCED';
      order.adjustmentRequired = false;
      order.adjustmentNotes = `Manually resolved by ${currentUser.displayName || currentUser.email}`;
      order.onlineProcessedAt = new Date();
      order.updatedAt = new Date();
      order.updatedBy = currentUser.uid;

      // Store in Firestore
      await this.storeOrderInFirestore(order);

      // Update offline order status
      await this.offlineOrderService.updateOfflineOrderSyncStatus(orderId, 'SYNCED', false);

      return {
        orderId,
        success: true,
        syncStatus: 'SYNCED',
        adjustmentRequired: false,
        message: 'Order manually resolved and synced'
      };

    } catch (error) {
      console.error(`Failed to manually resolve order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Store order in Firestore
   */
  private async storeOrderInFirestore(order: OrderDetails): Promise<void> {
    try {
      const orderDetailsRef = collection(this.firestore, 'orderDetails');
      const orderId = (order as any).id || (order as any).orderId;
      const orderDoc = doc(orderDetailsRef, orderId);
      
      await this.offlineDocService.updateDocument('orderDetails', orderId, {
        ...order,
        updatedAt: new Date()
      });
    } catch (error) {
      // If document doesn't exist, create it
      const orderDetailsRef = collection(this.firestore, 'orderDetails');
      await addDoc(orderDetailsRef, {
        ...order,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  }

  /**
   * Get all orders requiring manual adjustment
   */
  getOrdersRequiringAdjustment(): OrderDetails[] {
    return this.offlineOrderService.getOfflineOrders().filter(order => 
      order.adjustmentRequired && order.syncStatus === 'PENDING_ADJUSTMENT'
    );
  }

  /**
   * Get sync statistics
   */
  getSyncStatistics(): {
    totalOrders: number;
    syncedOrders: number;
    pendingOrders: number;
    adjustmentRequiredOrders: number;
    conflictOrders: number;
  } {
    const stats = this.offlineOrderService.getOfflineOrderStats();
    return {
      totalOrders: stats.totalOfflineOrders,
      syncedOrders: stats.syncedOrders,
      pendingOrders: stats.pendingOrders,
      adjustmentRequiredOrders: stats.adjustmentRequiredOrders,
      conflictOrders: stats.conflictOrders
    };
  }

  /**
   * Notify user of sync results
   */
  private notifySyncResults(results: SyncResult[]): void {
    const successful = results.filter(r => r.success).length;
    const needsAdjustment = results.filter(r => r.adjustmentRequired).length;
    
    if (needsAdjustment > 0) {
      console.log(`⚠️ Sync completed: ${successful} successful, ${needsAdjustment} require manual adjustment`);
      // You can integrate with a notification service here
    } else {
      console.log(`✅ Sync completed: All ${successful} orders synced successfully`);
    }
  }
}