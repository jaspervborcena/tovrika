import { Injectable, inject } from '@angular/core';
import { NetworkService } from './network.service';
import { OfflineOrderService } from './offline-order.service';
import { SyncAdjustmentService } from './sync-adjustment.service';
import { FIFOInventoryService } from './fifo-inventory.service';
import { AuthService } from './auth.service';
import { CartItem } from '../interfaces/cart.interface';
import { OrderDetails } from '../interfaces/order-details.interface';

export interface ProcessOrderOptions {
  paymentMethod: 'cash' | 'card' | 'digital_wallet' | 'bank_transfer';
  cashReceived?: number;
  customerInfo?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  tableNumber?: string;
  notes?: string;
  forceOffline?: boolean; // Force offline mode for testing
}

export interface ProcessOrderResult {
  success: boolean;
  orderId: string;
  orderDetails: OrderDetails;
  processedOffline: boolean;
  message: string;
  receiptData?: any;
  warnings?: string[];
  syncRequired?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class EnhancedPOSService {
  private networkService = inject(NetworkService);
  private offlineOrderService = inject(OfflineOrderService);
  private syncService = inject(SyncAdjustmentService);
  private fifoService = inject(FIFOInventoryService);
  private authService = inject(AuthService);

  constructor() {
    // Auto-trigger sync when network is restored
    this.networkService.onNetworkChange((isOnline) => {
      if (isOnline) {
        this.handleNetworkRestoration();
      }
    });
  }

  /**
   * Main order processing method - handles both online and offline modes
   */
  async processOrder(cartItems: CartItem[], options: ProcessOrderOptions): Promise<ProcessOrderResult> {
    console.log('🛒 Processing order with', cartItems.length, 'items');

    // Validate cart items
    const validation = await this.validateCartItems(cartItems);
    if (!validation.isValid) {
      throw new Error(`Cart validation failed: ${validation.errors?.join(', ')}`);
    }

    // Determine processing mode
    const shouldUseOfflineMode = options.forceOffline || this.shouldProcessOffline();
    
    console.log(`📡 Processing mode: ${shouldUseOfflineMode ? 'OFFLINE' : 'ONLINE'}`);

    try {
      if (shouldUseOfflineMode) {
        return await this.processOrderOffline(cartItems, options);
      } else {
        return await this.processOrderOnline(cartItems, options);
      }
    } catch (error) {
      console.error('Order processing failed:', error);
      
      // If online processing fails, try offline as fallback
      if (!shouldUseOfflineMode) {
        console.log('🔄 Falling back to offline mode...');
        return await this.processOrderOffline(cartItems, options);
      }
      
      throw error;
    }
  }

  /**
   * Process order in online mode (with immediate inventory deduction)
   */
  private async processOrderOnline(cartItems: CartItem[], options: ProcessOrderOptions): Promise<ProcessOrderResult> {
    console.log('🌐 Processing order ONLINE');

    // First, trigger any pending sync to ensure inventory is up to date
    await this.syncService.triggerAutoSync();

    // Validate inventory availability for all items
    for (const item of cartItems) {
      const stockValidation = await this.fifoService.validateStock(item.productId, item.quantity);
      if (!stockValidation.isValid) {
        throw new Error(`Insufficient stock for ${item.name}. Available: ${stockValidation.availableStock}, Requested: ${item.quantity}`);
      }
    }

    // Create order with immediate inventory deduction
    const orderDetails = await this.offlineOrderService.createOnlineOrder(cartItems, options);

    // Generate receipt data
    const receiptData = this.generateReceiptData(orderDetails, options);

    return {
      success: true,
      orderId: orderDetails.orderId,
      orderDetails,
      processedOffline: false,
      message: 'Order processed successfully online',
      receiptData,
      syncRequired: false
    };
  }

  /**
   * Process order in offline mode (no inventory deduction)
   */
  private async processOrderOffline(cartItems: CartItem[], options: ProcessOrderOptions): Promise<ProcessOrderResult> {
    console.log('📱 Processing order OFFLINE');

    // Validate against local stock estimates (warning only)
    const warnings: string[] = [];
    for (const item of cartItems) {
      try {
        const stockValidation = await this.fifoService.validateStock(item.productId, item.quantity);
        if (!stockValidation.isValid) {
          warnings.push(`${item.name}: Low stock (${stockValidation.availableStock} available)`);
        }
      } catch (error) {
        warnings.push(`${item.name}: Could not verify stock availability`);
      }
    }

    // Create offline order (no inventory deduction)
    const orderDetails = await this.offlineOrderService.createOfflineOrder(cartItems, options);

    // Generate receipt data
    const receiptData = this.generateReceiptData(orderDetails, options);

    return {
      success: true,
      orderId: orderDetails.orderId,
      orderDetails,
      processedOffline: true,
      message: 'Order processed offline - will sync when online',
      receiptData,
      warnings: warnings.length > 0 ? warnings : undefined,
      syncRequired: true
    };
  }

  /**
   * Determine if order should be processed offline
   */
  private shouldProcessOffline(): boolean {
    // Use offline mode if:
    // 1. Network is offline
    // 2. Network quality is poor
    // 3. Recent network instability
    
    if (!this.networkService.isOnline()) {
      return true;
    }

    if (this.networkService.shouldUseOfflineMode()) {
      return true;
    }

    // Check if there are pending sync operations that might affect inventory
    const pendingOrders = this.offlineOrderService.getPendingOfflineOrders();
    if (pendingOrders.length > 0) {
      console.log(`⚠️ ${pendingOrders.length} pending orders might affect inventory accuracy`);
      // Could optionally force offline mode here to maintain consistency
    }

    return false;
  }

  /**
   * Validate cart items before processing
   */
  private async validateCartItems(cartItems: CartItem[]): Promise<{
    isValid: boolean;
    errors?: string[];
    warnings?: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (cartItems.length === 0) {
      errors.push('Cart is empty');
    }

    for (const item of cartItems) {
      if (item.quantity <= 0) {
        errors.push(`Invalid quantity for ${item.name}`);
      }
      
      if (item.price <= 0) {
        errors.push(`Invalid price for ${item.name}`);
      }

      if (!item.productId) {
        errors.push(`Missing product ID for ${item.name}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Generate receipt data from order details
   */
  private generateReceiptData(orderDetails: OrderDetails, options: ProcessOrderOptions): any {
    const currentUser = this.authService.getCurrentUser();
    const permission = this.authService.getCurrentPermission();

    return {
      orderId: orderDetails.orderId,
      orderNumber: orderDetails.batchNumber,
      items: orderDetails.items.map(item => ({
        name: item.productName,
        quantity: item.quantity,
        price: item.price,
        total: item.total,
        discount: item.discount,
        vat: item.vat
      })),
      subtotal: orderDetails.subtotal,
      taxAmount: orderDetails.taxAmount,
      discountAmount: orderDetails.discountAmount,
      totalAmount: orderDetails.totalAmount,
      paymentMethod: options.paymentMethod,
      cashReceived: options.cashReceived,
      changeAmount: options.cashReceived ? options.cashReceived - orderDetails.totalAmount : 0,
      cashier: currentUser?.displayName || currentUser?.email,
      storeId: permission?.storeId,
      companyId: permission?.companyId,
      timestamp: orderDetails.createdAt,
      isOffline: orderDetails.isOffline,
      syncRequired: orderDetails.syncStatus === 'PENDING',
      customerInfo: options.customerInfo,
      tableNumber: options.tableNumber,
      notes: options.notes
    };
  }

  /**
   * Handle network restoration
   */
  private async handleNetworkRestoration(): Promise<void> {
    console.log('🌐 Network restored - triggering sync...');
    
    try {
      const syncResults = await this.syncService.triggerAutoSync();
      
      if (syncResults.length > 0) {
        const successful = syncResults.filter(r => r.success).length;
        const needsAdjustment = syncResults.filter(r => r.adjustmentRequired).length;
        
        console.log(`✅ Sync completed: ${successful} successful, ${needsAdjustment} need adjustment`);
        
        // Notify UI about sync results
        window.dispatchEvent(new CustomEvent('pos-sync-completed', {
          detail: { successful, needsAdjustment, results: syncResults }
        }));
      }
    } catch (error) {
      console.error('Auto-sync failed:', error);
      // Notify UI about sync failure
      window.dispatchEvent(new CustomEvent('pos-sync-failed', {
        detail: { error: error instanceof Error ? error.message : String(error) }
      }));
    }
  }

  /**
   * Manually trigger sync
   */
  async manualSync(): Promise<{
    success: boolean;
    results: any[];
    message: string;
  }> {
    if (!this.networkService.isOnline()) {
      throw new Error('Cannot sync while offline');
    }

    try {
      const results = await this.syncService.triggerAutoSync();
      const successful = results.filter(r => r.success).length;
      const failed = results.length - successful;

      return {
        success: failed === 0,
        results,
        message: failed === 0 
          ? `Successfully synced ${successful} orders`
          : `Synced ${successful} orders, ${failed} require manual adjustment`
      };
    } catch (error) {
      throw new Error(`Sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get offline order status
   */
  getOfflineStatus(): {
    isOffline: boolean;
    pendingOrders: number;
    lastSyncAt: Date | null;
    offlineDuration: string;
    syncRequired: boolean;
  } {
    const stats = this.offlineOrderService.getOfflineOrderStats();
    
    return {
      isOffline: !this.networkService.isOnline(),
      pendingOrders: stats.pendingOrders,
      lastSyncAt: this.networkService.lastOnlineAt(),
      offlineDuration: this.networkService.getOfflineDurationString(),
      syncRequired: stats.pendingOrders > 0
    };
  }

  /**
   * Get orders requiring manual adjustment
   */
  getAdjustmentQueue(): OrderDetails[] {
    return this.syncService.getOrdersRequiringAdjustment();
  }

  /**
   * Manually resolve order adjustment
   */
  async resolveOrderAdjustment(orderId: string, resolutions: any[]): Promise<any> {
    return await this.syncService.manuallyResolveOrder(orderId, resolutions);
  }

  /**
   * Listen for POS events
   */
  onPOSEvent(eventType: 'sync-completed' | 'sync-failed' | 'offline-order-created', 
             callback: (detail: any) => void): () => void {
    const handler = (event: CustomEvent) => callback(event.detail);
    
    window.addEventListener(`pos-${eventType}`, handler as EventListener);
    
    return () => {
      window.removeEventListener(`pos-${eventType}`, handler as EventListener);
    };
  }
}