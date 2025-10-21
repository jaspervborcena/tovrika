import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, doc, updateDoc, query, where, getDocs, deleteDoc } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { FIFOInventoryService } from './fifo-inventory.service';
import { OrderDetails, OrderDetailItem, OfflineOrderQueue, BatchDeductionDetail } from '../interfaces/order-details.interface';
import { CartItem } from '../interfaces/cart.interface';

@Injectable({
  providedIn: 'root'
})
export class OfflineOrderService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private fifoService = inject(FIFOInventoryService);

  private readonly OFFLINE_QUEUE_KEY = 'tovrika_offline_orders';
  private readonly MAX_OFFLINE_ORDERS = 100;

  /**
   * Creates an order in offline mode (no inventory deduction)
   */
  async createOfflineOrder(cartItems: CartItem[], orderData: any): Promise<OrderDetails> {
    const currentUser = this.authService.getCurrentUser();
    const permission = this.authService.getCurrentPermission();
    
    if (!currentUser || !permission) {
      throw new Error('User not authenticated or no permission');
    }

    // Generate offline order ID
    const offlineOrderId = this.generateOfflineOrderId();
    const batchNumber = this.generateBatchNumber();
    
    // Plan FIFO deductions (without executing them)
    const orderItems: OrderDetailItem[] = [];
    
    for (const cartItem of cartItems) {
      try {
        // Plan deduction using FIFO logic
        const plannedDeductions = await this.fifoService.planOfflineFIFODeduction(
          cartItem.productId, 
          cartItem.quantity
        );

        const orderItem: OrderDetailItem = {
          productId: cartItem.productId,
          productName: cartItem.name,
          productSku: cartItem.productId, // Assuming productId as SKU for now
          quantity: cartItem.quantity,
          price: cartItem.price, // Use current selling price, not batch cost
          total: cartItem.subtotal,
          discount: cartItem.discount || 0,
          isVatExempt: cartItem.isVatExempt || false,
          vat: cartItem.vatAmount || 0,
          vatRate: 12, // Default VAT rate - should come from settings
          batchDeductions: plannedDeductions,
          syncStatus: 'PENDING'
        };

        orderItems.push(orderItem);
      } catch (error) {
        console.error(`Failed to plan deduction for product ${cartItem.productId}:`, error);
        // Create order item without batch deductions (will need manual adjustment)
        const orderItem: OrderDetailItem = {
          productId: cartItem.productId,
          productName: cartItem.name,
          productSku: cartItem.productId,
          quantity: cartItem.quantity,
          price: cartItem.price,
          total: cartItem.subtotal,
          discount: cartItem.discount || 0,
          isVatExempt: cartItem.isVatExempt || false,
          vat: cartItem.vatAmount || 0,
          batchDeductions: [],
          syncStatus: 'PENDING',
          adjustmentRequired: true
        };

        orderItems.push(orderItem);
      }
    }

    // Calculate totals
    const subtotal = orderItems.reduce((sum, item) => sum + item.total, 0);
    const taxAmount = orderItems.reduce((sum, item) => sum + item.vat, 0);
    const discountAmount = orderItems.reduce((sum, item) => sum + item.discount, 0);
    const totalAmount = subtotal + taxAmount - discountAmount;

    // Create offline order details
    const orderDetails: OrderDetails = {
      id: offlineOrderId,
      orderId: offlineOrderId,
      storeId: permission.storeId || '',
      companyId: permission.companyId,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: currentUser.uid,
      updatedBy: currentUser.uid,
      isOffline: true,
      syncStatus: 'PENDING',
      batchNumber,
      items: orderItems,
      subtotal,
      taxAmount,
      discountAmount,
      totalAmount,
      offlineTimestamp: new Date(),
      syncAttempts: 0,
      syncErrors: []
    };

    // Store in local storage for offline access
    await this.storeOfflineOrder(orderDetails);

    // Also try to store in Firestore if possible (with isOffline flag)
    try {
      await this.storeOrderInFirestore(orderDetails);
    } catch (error) {
      console.log('Could not store in Firestore immediately, queued for sync:', error);
    }

    console.log('Created offline order:', offlineOrderId);
    return orderDetails;
  }

  /**
   * Creates an order in online mode (with inventory deduction)
   */
  async createOnlineOrder(cartItems: CartItem[], orderData: any): Promise<OrderDetails> {
    const currentUser = this.authService.getCurrentUser();
    const permission = this.authService.getCurrentPermission();
    
    if (!currentUser || !permission) {
      throw new Error('User not authenticated or no permission');
    }

    // Generate online order ID
    const orderId = this.generateOrderId();
    const batchNumber = this.generateBatchNumber();
    
    // Execute FIFO deductions
    const orderItems: OrderDetailItem[] = [];
    
    for (const cartItem of cartItems) {
      try {
        // Execute actual FIFO deduction
        const actualDeductions = await this.fifoService.executeFIFODeduction(
          cartItem.productId,
          cartItem.quantity,
          orderId,
          orderId, // Using orderId as orderDetailId for now
          false // isOffline = false
        );

        const orderItem: OrderDetailItem = {
          productId: cartItem.productId,
          productName: cartItem.name,
          productSku: cartItem.productId,
          quantity: cartItem.quantity,
          price: cartItem.price,
          total: cartItem.subtotal,
          discount: cartItem.discount || 0,
          isVatExempt: cartItem.isVatExempt || false,
          vat: cartItem.vatAmount || 0,
          batchDeductions: actualDeductions,
          syncStatus: 'SYNCED' // Already synced since it's online
        };

        orderItems.push(orderItem);
      } catch (error) {
        console.error(`Failed to execute deduction for product ${cartItem.productId}:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Cannot process order: ${errorMessage}`);
      }
    }

    // Calculate totals
    const subtotal = orderItems.reduce((sum, item) => sum + item.total, 0);
    const taxAmount = orderItems.reduce((sum, item) => sum + item.vat, 0);
    const discountAmount = orderItems.reduce((sum, item) => sum + item.discount, 0);
    const totalAmount = subtotal + taxAmount - discountAmount;

    // Create online order details
    const orderDetails: OrderDetails = {
      id: orderId,
      orderId: orderId,
      storeId: permission.storeId || '',
      companyId: permission.companyId,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: currentUser.uid,
      updatedBy: currentUser.uid,
      isOffline: false,
      syncStatus: 'SYNCED',
      batchNumber,
      items: orderItems,
      subtotal,
      taxAmount,
      discountAmount,
      totalAmount,
      onlineProcessedAt: new Date(),
      syncAttempts: 0
    };

    // Store in Firestore immediately
    await this.storeOrderInFirestore(orderDetails);

    console.log('Created online order:', orderId);
    return orderDetails;
  }

  /**
   * Stores order details in Firestore
   */
  private async storeOrderInFirestore(orderDetails: OrderDetails): Promise<void> {
    try {
      const orderDetailsRef = collection(this.firestore, 'orderDetails');
      await addDoc(orderDetailsRef, {
        ...orderDetails,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Failed to store order in Firestore:', error);
      throw error;
    }
  }

  /**
   * Stores order in local storage for offline access
   */
  private async storeOfflineOrder(orderDetails: OrderDetails): Promise<void> {
    try {
      const existingOrders = this.getOfflineOrders();
      existingOrders.push(orderDetails);

      // Keep only the most recent orders
      if (existingOrders.length > this.MAX_OFFLINE_ORDERS) {
        existingOrders.splice(0, existingOrders.length - this.MAX_OFFLINE_ORDERS);
      }

      localStorage.setItem(this.OFFLINE_QUEUE_KEY, JSON.stringify(existingOrders));
    } catch (error) {
      console.error('Failed to store offline order:', error);
      throw error;
    }
  }

  /**
   * Gets all offline orders from local storage
   */
  getOfflineOrders(): OrderDetails[] {
    try {
      const stored = localStorage.getItem(this.OFFLINE_QUEUE_KEY);
      if (!stored) return [];

      const orders = JSON.parse(stored);
      // Convert date strings back to Date objects
      return orders.map((order: any) => ({
        ...order,
        createdAt: new Date(order.createdAt),
        updatedAt: new Date(order.updatedAt),
        offlineTimestamp: order.offlineTimestamp ? new Date(order.offlineTimestamp) : undefined,
        onlineProcessedAt: order.onlineProcessedAt ? new Date(order.onlineProcessedAt) : undefined
      }));
    } catch (error) {
      console.error('Failed to get offline orders:', error);
      return [];
    }
  }

  /**
   * Gets pending offline orders that need syncing
   */
  getPendingOfflineOrders(): OrderDetails[] {
    return this.getOfflineOrders().filter(order => 
      order.isOffline && order.syncStatus === 'PENDING'
    );
  }

  /**
   * Removes an offline order from local storage
   */
  async removeOfflineOrder(orderId: string): Promise<void> {
    try {
      const orders = this.getOfflineOrders();
      const filteredOrders = orders.filter(order => order.orderId !== orderId);
      localStorage.setItem(this.OFFLINE_QUEUE_KEY, JSON.stringify(filteredOrders));
    } catch (error) {
      console.error('Failed to remove offline order:', error);
      throw error;
    }
  }

  /**
   * Updates the sync status of an offline order
   */
  async updateOfflineOrderSyncStatus(orderId: string, syncStatus: OrderDetails['syncStatus'], adjustmentRequired?: boolean): Promise<void> {
    try {
      const orders = this.getOfflineOrders();
      const orderIndex = orders.findIndex(order => order.orderId === orderId);
      
      if (orderIndex !== -1) {
        orders[orderIndex].syncStatus = syncStatus;
        orders[orderIndex].updatedAt = new Date();
        orders[orderIndex].syncAttempts = (orders[orderIndex].syncAttempts || 0) + 1;
        
        if (adjustmentRequired !== undefined) {
          orders[orderIndex].adjustmentRequired = adjustmentRequired;
        }
        
        localStorage.setItem(this.OFFLINE_QUEUE_KEY, JSON.stringify(orders));
      }
    } catch (error) {
      console.error('Failed to update offline order sync status:', error);
      throw error;
    }
  }

  /**
   * Clears all offline orders (use with caution)
   */
  async clearOfflineOrders(): Promise<void> {
    localStorage.removeItem(this.OFFLINE_QUEUE_KEY);
  }

  /**
   * Generates unique offline order ID
   */
  private generateOfflineOrderId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `OFF_${timestamp}_${random}`;
  }

  /**
   * Generates unique online order ID
   */
  private generateOrderId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `ORD_${timestamp}_${random}`;
  }

  /**
   * Generates sequential batch number
   */
  private generateBatchNumber(): number {
    const lastBatch = localStorage.getItem('last_batch_number');
    const nextBatch = lastBatch ? parseInt(lastBatch) + 1 : 1;
    localStorage.setItem('last_batch_number', nextBatch.toString());
    return nextBatch;
  }

  /**
   * Gets offline order statistics
   */
  getOfflineOrderStats(): {
    totalOfflineOrders: number;
    pendingOrders: number;
    syncedOrders: number;
    conflictOrders: number;
    adjustmentRequiredOrders: number;
  } {
    const orders = this.getOfflineOrders();
    
    return {
      totalOfflineOrders: orders.filter(o => o.isOffline).length,
      pendingOrders: orders.filter(o => o.syncStatus === 'PENDING').length,
      syncedOrders: orders.filter(o => o.syncStatus === 'SYNCED').length,
      conflictOrders: orders.filter(o => o.syncStatus === 'CONFLICT').length,
      adjustmentRequiredOrders: orders.filter(o => o.adjustmentRequired).length
    };
  }
}