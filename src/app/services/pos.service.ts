import { Injectable, signal, computed, inject, Injector } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  doc,
  getDoc,
  runTransaction
} from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { CompanyService } from './company.service';
import { ProductService } from './product.service';
import { InvoiceService } from './invoice.service';
import { StoreService } from './store.service';
import { DeviceService } from './device.service';
import { IndexedDBService } from '../core/services/indexeddb.service';
import { FirestoreSecurityService } from '../core/services/firestore-security.service';
import { OfflineDocumentService } from '../core/services/offline-document.service';
import { Order, OrderDetail, OrderItem, CartItem, ReceiptData, OrderDiscount, CartSummary, ReceiptValidityNotice } from '../interfaces/pos.interface';
import { Product } from '../interfaces/product.interface';
import { Store } from '../interfaces/store.interface';
import { Device } from '../interfaces/device.interface';
import { OrdersSellingTrackingService } from './orders-selling-tracking.service';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PosService {
  private readonly cartItemsSignal = signal<CartItem[]>([]);
  private readonly selectedStoreIdSignal = signal<string>('');
  private readonly isProcessingSignal = signal<boolean>(false);
  private readonly orderDiscountSignal = signal<OrderDiscount | null>(null);
  private readonly offlineDocService = inject(OfflineDocumentService);
  private readonly injector = inject(Injector);

  // Computed values
  readonly cartItems = computed(() => this.cartItemsSignal());
  readonly selectedStoreId = computed(() => this.selectedStoreIdSignal());
  readonly isProcessing = computed(() => this.isProcessingSignal());
  readonly orderDiscount = computed(() => this.orderDiscountSignal());

  readonly cartSummary = computed((): CartSummary => {
    const items = this.cartItems();
    const orderDiscount = this.orderDiscount();
    
    // Calculate base amounts
    const grossAmount = items.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0);
    const productDiscountAmount = items.reduce((sum, item) => sum + item.discountAmount, 0);
    const subtotalAfterProductDiscounts = grossAmount - productDiscountAmount;
    
    // Calculate VAT amounts
    const vatableItems = items.filter(item => item.isVatApplicable && !item.isVatExempt);
    const vatExemptItems = items.filter(item => item.isVatExempt || !item.isVatApplicable);
    
    const vatableSales = vatableItems.reduce((sum, item) => 
      sum + ((item.sellingPrice * item.quantity) - item.discountAmount), 0);
    const vatExemptSales = vatExemptItems.reduce((sum, item) => 
      sum + ((item.sellingPrice * item.quantity) - item.discountAmount), 0);
    const zeroRatedSales = 0; // Can be added later for specific business needs
    
    const vatAmount = vatableItems.reduce((sum, item) => sum + item.vatAmount, 0);
    
    // Calculate order-level discount
    let orderDiscountAmount = 0;
    if (orderDiscount) {
      if (orderDiscount.percentage) {
        orderDiscountAmount = (subtotalAfterProductDiscounts * orderDiscount.percentage) / 100;
      } else if (orderDiscount.fixedAmount) {
        orderDiscountAmount = orderDiscount.fixedAmount;
      }
    }
    
    const netAmount = subtotalAfterProductDiscounts - orderDiscountAmount;

    return {
      itemCount: items.length,
      totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
      vatableSales,
      vatAmount,
      zeroRatedSales,
      vatExemptSales,
      productDiscountAmount,
      orderDiscountAmount,
      grossAmount,
      netAmount
    };
  });

  private invoiceService = inject(InvoiceService);
  private storeService = inject(StoreService);
  private deviceService = inject(DeviceService);

  constructor(
    private firestore: Firestore,
    private authService: AuthService,
    private companyService: CompanyService,
    private productService: ProductService,
    private indexedDBService: IndexedDBService,
    private securityService: FirestoreSecurityService,
    private ordersSellingTrackingService: OrdersSellingTrackingService
  ) {
    // Load persisted store selection on service initialization
    this.loadPersistedStoreSelection();
  }

  // Cart Management
  addToCart(product: Product, quantity: number = 1): void {
    const existingItemIndex = this.cartItems().findIndex(item => item.productId === product.id);
    
    if (existingItemIndex >= 0) {
      // Update existing item
      this.updateCartItemQuantity(product.id!, this.cartItems()[existingItemIndex].quantity + quantity);
    } else {
      // Add new item
      const cartItem: CartItem = this.createCartItem(product, quantity);
      this.cartItemsSignal.update(items => [...items, cartItem]);
    }
  }

  removeFromCart(productId: string): void {
    this.cartItemsSignal.update(items => items.filter(item => item.productId !== productId));
  }

  updateCartItemQuantity(productId: string, quantity: number): void {
    if (quantity <= 0) {
      this.removeFromCart(productId);
      return;
    }

    this.cartItemsSignal.update(items => 
      items.map(item => {
        if (item.productId === productId) {
          const updatedItem = { ...item, quantity };
          return this.recalculateCartItem(updatedItem);
        }
        return item;
      })
    );
  }

  toggleVatExemption(productId: string): void {
    this.cartItemsSignal.update(items =>
      items.map(item => {
        if (item.productId === productId) {
          const updatedItem = { ...item, isVatExempt: !item.isVatExempt };
          return this.recalculateCartItem(updatedItem);
        }
        return item;
      })
    );
  }

  clearCart(): void {
    this.cartItemsSignal.set([]);
    this.orderDiscountSignal.set(null); // Clear order discount when clearing cart
  }

  // Reset all POS state (called on logout)
  resetAll(): void {
    console.log('🔍 [POSService] Resetting all POS data');
    this.clearCart();
    this.selectedStoreIdSignal.set('');
    this.isProcessingSignal.set(false);
  }

  // Order Discount Management
  setOrderDiscount(discount: OrderDiscount): void {
    this.orderDiscountSignal.set(discount);
  }

  removeOrderDiscount(): void {
    this.orderDiscountSignal.set(null);
  }

  // Store Management
  async setSelectedStore(storeId: string, options?: { preserveCart?: boolean }): Promise<void> {
    this.selectedStoreIdSignal.set(storeId);
    
    // Save to IndexedDB for persistence
    try {
      const currentUser = this.authService.getCurrentUser();
      if (currentUser?.uid) {
        // Get existing user data and update currentStoreId
        const existingUserData = await this.indexedDBService.getUserData(currentUser.uid);
        if (existingUserData) {
          existingUserData.currentStoreId = storeId;
          await this.indexedDBService.saveUserData(existingUserData);
          console.log('💾 Store selection saved to IndexedDB:', storeId);
        }
      }
    } catch (error) {
      console.error('⚠️ Failed to save store selection to IndexedDB:', error);
    }
    
    // Only clear cart if explicitly requested or if cart is empty
    if (!options?.preserveCart && this.cartItems().length === 0) {
      this.clearCart();
    } else if (!options?.preserveCart) {
      console.log('🛒 Cart preserved during store selection - cart has items');
    }
  }

  // Load selected store from IndexedDB on service initialization
  private async loadPersistedStoreSelection(): Promise<void> {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (currentUser?.uid) {
        const offlineUserData = await this.indexedDBService.getUserData(currentUser.uid);
        if (offlineUserData?.currentStoreId) {
          this.selectedStoreIdSignal.set(offlineUserData.currentStoreId);
          console.log('💾 Restored store selection from IndexedDB:', offlineUserData.currentStoreId);
        }
      }
    } catch (error) {
      console.error('⚠️ Failed to load store selection from IndexedDB:', error);
    }
  }

  // Order Processing with Invoice Number Transaction
  async processOrder(customerInfo?: any): Promise<string | null> {
    try {
      this.isProcessingSignal.set(true);
      console.log('🧾 Starting order processing with invoice transaction...');
      
      const user = this.authService.getCurrentUser();
      const company = await this.companyService.getActiveCompany();
      
      if (!user || !company) {
        throw new Error('User or company not found');
      }

      const storeId = this.selectedStoreId();
      if (!storeId) {
        throw new Error('No store selected');
      }

      // Load store data
      const store = this.storeService.getStore(storeId);
      if (!store) {
        throw new Error('Store not found');
      }

      const cartItems = this.cartItems();
      if (cartItems.length === 0) {
        throw new Error('Cart is empty');
      }

      const summary = this.cartSummary();

      // Prepare order items for storage
      const orderItems: OrderItem[] = cartItems.map(item => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        price: item.sellingPrice,
        total: item.total,
        vat: item.vatAmount,
        discount: item.discountAmount,
        isVatExempt: item.isVatExempt
      }));
      // Prepare complete order data (without invoice number - will be assigned by transaction)
      const orderData = {
        companyId: company.id!,
        storeId: storeId,
        assignedCashierId: user.uid,
        assignedCashierEmail: user.email || 'Unknown Cashier',
        assignedCashierName: user.displayName || user.email || 'Unknown Cashier',
        status: 'paid',
        
        // Customer Information
        cashSale: true,
        soldTo: customerInfo?.soldTo || 'Walk-in Customer',
        tin: customerInfo?.tin || '',
        businessAddress: customerInfo?.businessAddress || '',
        
        // Invoice Information (invoiceNumber will be set by transaction)
        date: customerInfo?.date || new Date(),
        logoUrl: company.logoUrl || '',
        
        // Company Information (using STORE data)
        companyName: company.name || '',
        companyAddress: store.address || '',
        companyPhone: store.phoneNumber || '',
        companyTaxId: store.tinNumber || '',
        companyEmail: company.email || '',
        
        // Financial Calculations
        vatableSales: summary.vatableSales,
        vatAmount: summary.vatAmount,
        zeroRatedSales: summary.zeroRatedSales,
        vatExemptAmount: summary.vatExemptSales,
        discountAmount: summary.productDiscountAmount + summary.orderDiscountAmount,
        grossAmount: summary.grossAmount,
        netAmount: summary.netAmount,
        totalAmount: summary.netAmount,
        
        // Order Items
        items: orderItems,
        
        // BIR Required Fields - from store BIR details
        atpOrOcn: store.birDetails?.atpOrOcn || 'OCN-2025-001234',
        birPermitNo: store.birDetails?.birPermitNo || 'BIR-PERMIT-2025-56789',
        inclusiveSerialNumber: store.birDetails?.inclusiveSerialNumber || '000001-000999',
        
        // System Fields
        message: 'Thank you! See you again!',
        
        // Store reference for BIR device lookup
        isBirAccredited: store.isBirAccredited
      };

      // 🧾 Execute invoice transaction (stores + orders atomically)
      const invoiceResult = await this.invoiceService.processInvoiceTransaction({
        storeId,
        orderData,
        customerInfo
      });

      if (!invoiceResult.success) {
        throw new Error(`Invoice transaction failed: ${invoiceResult.error}`);
      }

      console.log('✅ Invoice transaction completed:', {
        invoiceNumber: invoiceResult.invoiceNumber,
        orderId: invoiceResult.orderId
      });

      // Sync local product summaries with server values so UI reflects Firestore state
      try {
        await this.syncProductsFromOrder(orderItems);
        console.log('🔄 Local product summaries synced from server after invoice');
      } catch (syncErr) {
        console.warn('⚠️ Failed to sync local product summaries after invoice:', syncErr);
      }

      // Update product inventory (this happens after successful order creation)
      try {
        await this.updateProductInventory(cartItems, { orderId: invoiceResult.orderId!, invoiceNumber: invoiceResult.invoiceNumber! });
        console.log('✅ Product inventory updated successfully');
      } catch (inventoryError) {
        console.error('⚠️ Warning: Order created but inventory update failed:', inventoryError);
        // Don't throw error here as the order was already created successfully
      }

      return invoiceResult.orderId;

    } catch (error) {
      console.error('❌ Error processing order:', error);
      throw error;
    } finally {
      this.isProcessingSignal.set(false);
    }
  }

  /**
   * NEW: Process order with new customerInfo and payments structure
   */
  async processOrderWithInvoiceAndPayment(
    customerInfo: { fullName: string; address: string; tin: string; customerId: string }, 
    payments: { amountTendered: number; changeAmount: number; paymentDescription: string }
  ): Promise<{ orderId: string; invoiceNumber: string } | null> {
    try {
      this.isProcessingSignal.set(true);
      console.log('🧾 Starting NEW order processing with customerInfo and payments...');
      
      const user = this.authService.getCurrentUser();
      const company = await this.companyService.getActiveCompany();
      
      if (!user || !company) {
        throw new Error('User or company not found');
      }

      const storeId = this.selectedStoreId();
      if (!storeId) {
        throw new Error('No store selected');
      }

      // Load store data
      const store = this.storeService.getStore(storeId);
      if (!store) {
        throw new Error('Store not found');
      }

      const cartItems = this.cartItems();
      if (cartItems.length === 0) {
        throw new Error('Cart is empty');
      }

      console.log('Processing NEW order structure for store:', storeId);
      console.log('📝 Customer info:', customerInfo);
      console.log('💳 Payment info:', payments);

      const cartSummary = this.cartSummary();

      // Prepare order items for storage
      const orderItems: OrderItem[] = cartItems.map(item => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        price: item.sellingPrice,
        total: item.total,
        vat: item.vatAmount,
        discount: item.discountAmount,
        isVatExempt: item.isVatExempt
      }));

      console.log('📦 Order items prepared:', orderItems.length, 'items');

      // Prepare NEW order data structure (without customerInfo at root level)
      const orderData: any = {
        companyId: company.id || '',
        storeId: storeId,
        assignedCashierId: user.uid,
        assignedCashierEmail: user.email || 'Unknown Cashier',
        assignedCashierName: user.displayName || user.email || 'Unknown Cashier',
        
        // Payment type determination
        cashSale: payments.paymentDescription.toLowerCase().includes('cash') || !payments.paymentDescription,
        
        // Invoice Information (invoiceNumber will be set by transaction)
        invoiceNumber: '',  // Will be filled by transaction
        date: new Date(),
        
        // Company Information (using STORE data)
        companyName: company.name || '',
        companyAddress: store.address || '',
        companyPhone: store.phoneNumber || '',
        companyTaxId: store.tinNumber || '',
        companyEmail: company.email || '',
        
        // Financial Information
        grossAmount: cartSummary.grossAmount,
        discountAmount: cartSummary.productDiscountAmount + cartSummary.orderDiscountAmount,
        vatAmount: cartSummary.vatAmount,
        vatExemptAmount: cartSummary.vatExemptSales,
        totalAmount: cartSummary.netAmount,
        netAmount: cartSummary.netAmount,
        
        vatableSales: cartSummary.vatableSales,
        zeroRatedSales: cartSummary.zeroRatedSales,
        
        status: 'completed',
        
        // BIR Required Fields
        atpOrOcn: 'ATP-001',
        birPermitNo: 'BIR-001', 
        inclusiveSerialNumber: '001-100000',
        message: 'Thank you for your purchase!',
        
        // Order Items (FIXED: now includes cart items)
        items: orderItems,
        
        createdAt: new Date()
      };

      console.log('📦 Complete orderData being sent to invoice service:', JSON.stringify(orderData, null, 2));
      
      // 🧾 Execute invoice transaction with NEW structure
      const invoiceResult = await this.invoiceService.processInvoiceTransaction({
        storeId: storeId,
        orderData: orderData,
        customerInfo: customerInfo, // Pass as separate parameter
        paymentsData: payments      // Pass as separate parameter
      });

      // Check transaction result
      if (!invoiceResult.success) {
        throw new Error(`Invoice transaction failed: ${invoiceResult.error}`);
      }

      console.log('✅ NEW Invoice transaction completed:', {
        invoiceNumber: invoiceResult.invoiceNumber,
        orderId: invoiceResult.orderId
      });

      // Update product inventory
      try {
        await this.updateProductInventory(cartItems, { orderId: invoiceResult.orderId!, invoiceNumber: invoiceResult.invoiceNumber! });
        console.log('✅ Product inventory updated successfully');
      } catch (inventoryError) {
        console.error('⚠️ Warning: Order created but inventory update failed:', inventoryError);
      }

      return {
        orderId: invoiceResult.orderId!,
        invoiceNumber: invoiceResult.invoiceNumber!
      };

    } catch (error) {
      console.error('❌ Error processing NEW order with invoice:', error);
      throw error;
    } finally {
      this.isProcessingSignal.set(false);
    }
  }

  /**
   * Process order and return both order ID and invoice number
   * Used for print receipt functionality (LEGACY - keeping for backward compatibility)
   */
  async processOrderWithInvoice(customerInfo?: any): Promise<{ orderId: string; invoiceNumber: string } | null> {
    try {
      this.isProcessingSignal.set(true);
      console.log('🧾 Starting order processing with invoice transaction (returning invoice number)...');
      
      const user = this.authService.getCurrentUser();
      const company = await this.companyService.getActiveCompany();
      
      if (!user || !company) {
        throw new Error('User or company not found');
      }

      const storeId = this.selectedStoreId();
      if (!storeId) {
        throw new Error('No store selected');
      }

      // Load store data
      const store = this.storeService.getStore(storeId);
      if (!store) {
        throw new Error('Store not found');
      }

      const cartItems = this.cartItems();
      if (cartItems.length === 0) {
        throw new Error('Cart is empty');
      }

      console.log('Processing order for store:', storeId);

      const cartSummary = this.cartSummary();

      // Prepare complete order data (without invoice number - will be assigned by transaction)
      const orderData = {
        companyId: company.id || '',
        storeId: storeId,
        assignedCashierId: user.uid,
        assignedCashierEmail: user.email || 'Unknown Cashier',
        assignedCashierName: user.displayName || user.email || 'Unknown Cashier',
        
        // Customer Information
        cashSale: !customerInfo?.soldTo,
        soldTo: customerInfo?.soldTo || '',
        tin: customerInfo?.tin || '',
        businessAddress: customerInfo?.businessAddress || '',
        
        // Invoice Information (invoiceNumber will be set by transaction)
        invoiceNumber: '',  // Will be filled by transaction
        date: new Date(),
        
        // Company Information (using STORE data)
        companyName: company.name || '',
        companyAddress: store.address || '',
        companyPhone: store.phoneNumber || '',
        companyTaxId: store.tinNumber || '',
        companyEmail: company.email || '',
        
        // Financial Information
        grossAmount: cartSummary.grossAmount,
        discountAmount: cartSummary.productDiscountAmount + cartSummary.orderDiscountAmount,
        vatAmount: cartSummary.vatAmount,
        vatExemptAmount: cartSummary.vatExemptSales,
        totalAmount: cartSummary.netAmount,
        netAmount: cartSummary.netAmount,
        
        vatableSales: cartSummary.vatableSales,
        zeroRatedSales: cartSummary.zeroRatedSales,
        
        status: 'paid',
        
        // BIR Required Fields (can be configured per company)
        atpOrOcn: 'ATP-001',
        birPermitNo: 'BIR-001', 
        inclusiveSerialNumber: '001-100000',
        message: 'Thank you for your purchase!',
        
        createdAt: new Date()
      };

      // 🧾 Execute invoice transaction (stores + orders atomically)
      const invoiceResult = await this.invoiceService.processInvoiceTransaction({
        storeId: storeId,
        orderData: orderData
      });

      // Check transaction result
      if (!invoiceResult.success) {
        throw new Error(`Invoice transaction failed: ${invoiceResult.error}`);
      }

      console.log('✅ Invoice transaction completed:', {
        invoiceNumber: invoiceResult.invoiceNumber,
        orderId: invoiceResult.orderId
      });

      // Update product inventory (this happens after successful order creation)
      try {
        await this.updateProductInventory(cartItems, { orderId: invoiceResult.orderId!, invoiceNumber: invoiceResult.invoiceNumber! });
        console.log('✅ Product inventory updated successfully');
      } catch (inventoryError) {
        console.error('⚠️ Warning: Order created but inventory update failed:', inventoryError);
        // Don't throw error here as the order was already created successfully
      }

      return {
        orderId: invoiceResult.orderId!,
        invoiceNumber: invoiceResult.invoiceNumber!
      };

    } catch (error) {
      console.error('❌ Error processing order with invoice:', error);
      throw error;
    } finally {
      this.isProcessingSignal.set(false);
    }
  }

  // Receipt Generation
  async generateReceiptData(orderId?: string): Promise<ReceiptData> {
    const user = this.authService.getCurrentUser();
    const company = await this.companyService.getActiveCompany();
    // Note: stores are now managed separately from company
    // For now, use selectedStoreId directly
    const storeId = this.selectedStoreId();

    if (!user || !company || !storeId) {
      throw new Error('Required data not found');
    }

    // Load store data
    const store = this.storeService.getStore(storeId);
    if (!store) {
      throw new Error('Store not found');
    }

    const summary = this.cartSummary();

    // Determine validity notice based on BIR accreditation status
    const validityNotice = store.isBirAccredited 
      ? ReceiptValidityNotice.BIR_ACCREDITED 
      : ReceiptValidityNotice.NON_ACCREDITED;

    return {
      companyName: company.name,
      storeName: store.storeName || '',
      storeAddress: store.address || '',
      companyPhone: store.phoneNumber || '',
      companyEmail: company.email || '',
      date: new Date(),
      orderId: orderId || 'TEMP',
      items: this.cartItems(),
      vatAmount: summary.vatAmount,
      vatExemptAmount: summary.vatExemptSales,
      discountAmount: summary.productDiscountAmount + summary.orderDiscountAmount,
      grossAmount: summary.grossAmount,
      netAmount: summary.netAmount,
      message: 'Thank you! See you again!',
      validityNotice: validityNotice
    };
  }

  // Helper Methods
  private createCartItem(product: Product, quantity: number): CartItem {
    const baseTotal = product.sellingPrice * quantity;
    let discountAmount = 0;
    
    if (product.hasDiscount) {
      if (product.discountType === 'percentage') {
        discountAmount = (baseTotal * product.discountValue) / 100;
      } else {
        discountAmount = product.discountValue * quantity;
      }
    }

    const discountedTotal = baseTotal - discountAmount;
    let vatAmount = 0;
    const vatRate = Number(product.vatRate ?? 0);
    
    if (product.isVatApplicable) {
      vatAmount = (discountedTotal * vatRate) / 100;
    }

    return {
      productId: product.id!,
      productName: product.productName,
      skuId: product.skuId,
      unitType: product.unitType,
      quantity,
      sellingPrice: product.sellingPrice,
      total: discountedTotal + vatAmount,
      isVatApplicable: product.isVatApplicable,
  vatRate: vatRate,
      vatAmount,
      hasDiscount: product.hasDiscount,
      discountType: product.discountType,
      discountValue: product.discountValue,
      discountAmount,
      isVatExempt: false,
      imageUrl: product.imageUrl
    };
  }

  private recalculateCartItem(item: CartItem): CartItem {
    const baseTotal = item.sellingPrice * item.quantity;
    let discountAmount = 0;
    
    if (item.hasDiscount) {
      if (item.discountType === 'percentage') {
        discountAmount = (baseTotal * item.discountValue) / 100;
      } else {
        discountAmount = item.discountValue * item.quantity;
      }
    }

    const discountedTotal = baseTotal - discountAmount;
    let vatAmount = 0;
    
    if (item.isVatApplicable && !item.isVatExempt) {
      vatAmount = (discountedTotal * item.vatRate) / 100;
    }

    return {
      ...item,
      total: discountedTotal + vatAmount,
      vatAmount,
      discountAmount
    };
  }

  private async updateProductInventory(
    cartItems: CartItem[],
    context?: { orderId?: string; invoiceNumber?: string }
  ): Promise<void> {
    const mode = environment.inventory?.reconciliationMode || 'legacy';
    if (mode === 'recon') {
      console.log('� Tracking sale for reconciliation mode (no client-side FIFO). Items:', cartItems.length);
      const user = this.authService.getCurrentUser();
      const company = await this.companyService.getActiveCompany();
      const storeId = this.selectedStoreId();

      if (!user || !company || !storeId) {
        throw new Error('Missing user/company/store for tracking');
      }

      const items = cartItems.map(ci => ({
        productId: ci.productId,
        productName: ci.productName,
        quantity: ci.quantity,
        unitPrice: ci.sellingPrice,
        lineTotal: ci.total
      }));

      const res = await this.ordersSellingTrackingService.logSaleAndAdjustStock({
        companyId: company.id!,
        storeId,
        orderId: context?.orderId || 'unknown-order',
        invoiceNumber: context?.invoiceNumber,
        cashierId: user.uid,
        cashierEmail: user.email || undefined,
        cashierName: user.displayName || user.email || 'Unknown Cashier'
      }, items);

      if (!res.success) {
        console.warn('⚠️ Some items failed to track/adjust:', res.errors);
      }
      return;
    }

    // Legacy: client-side FIFO deduction
    console.log('🔄 Starting FIFO inventory deduction for cart items:', cartItems.length);
    const { InventoryDataService } = await import('./inventory-data.service');
    const inventoryService = this.injector.get(InventoryDataService);
    for (const cartItem of cartItems) {
      try {
        await this.deductInventoryFifo(cartItem.productId, cartItem.quantity, inventoryService);
        console.log(`✅ Inventory deducted for ${cartItem.productName}: ${cartItem.quantity} units`);
      } catch (error) {
        console.error(`❌ Failed to deduct inventory for ${cartItem.productName}:`, error);
      }
    }
    console.log('✅ FIFO inventory deduction completed for all items');
  }

  /**
   * Sync local product summaries for products present in order items by reading the
   * authoritative product documents from Firestore and applying local patches.
   * This prevents the UI from showing stale totals when the server-side transaction
   * already updated product.totalStock.
   */
  private async syncProductsFromOrder(orderItems: OrderItem[] | CartItem[]): Promise<void> {
    if (!Array.isArray(orderItems) || orderItems.length === 0) return;

    const uniqueIds = Array.from(new Set(orderItems.map(i => i.productId).filter(Boolean)));
    for (const productId of uniqueIds) {
      try {
        const prodRef = doc(this.firestore, 'products', productId);
        const snap = await getDoc(prodRef as any);
        if (!snap.exists()) continue;
        const data: any = snap.data();
        const serverTotal = typeof data.totalStock === 'number' ? data.totalStock : Number(data.totalStock || 0);
        // Apply local patch to keep UI in sync without issuing another write
        this.productService.applyLocalPatch(productId, { totalStock: serverTotal, lastUpdated: new Date() } as any);
      } catch (err) {
        console.warn(`Failed to sync product ${productId} from server:`, err);
      }
    }
  }

  /**
   * Deduct inventory using FIFO (First In, First Out) method
   * Oldest batches are depleted first
   */
  private async deductInventoryFifo(productId: string, quantityToDeduct: number, inventoryService: any): Promise<void> {
    if (quantityToDeduct <= 0) return;

    console.log(`🔄 FIFO deduction for product ${productId}: ${quantityToDeduct} units`);

    // Build FIFO plan based on current batches
    const batches = await inventoryService.listBatches(productId);
    const activeBatches = batches
      .filter((batch: any) => batch.status === 'active' && batch.quantity > 0)
      .sort((a: any, b: any) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime()); // Oldest first

    if (activeBatches.length === 0) {
      throw new Error(`No active inventory batches found for product ${productId}`);
    }

    let remainingToDeduct = quantityToDeduct;
    const plan: Array<{ batchId: string; docId: string; deduct: number }> = [];

    for (const batch of activeBatches) {
      if (remainingToDeduct <= 0) break;
      const take = Math.min(remainingToDeduct, batch.quantity);
      plan.push({ batchId: batch.batchId, docId: batch.id, deduct: take });
      remainingToDeduct -= take;
      console.log(`📦 Plan: Batch ${batch.batchId} will deduct ${take} (remaining needed ${remainingToDeduct})`);
    }

    if (remainingToDeduct > 0) {
      throw new Error(`Insufficient inventory for product ${productId}. Need ${quantityToDeduct}, but only ${quantityToDeduct - remainingToDeduct} available.`);
    }

    // Execute all updates inside a Firestore transaction to keep batches and product.totalStock consistent
  const currentUser = this.authService.getCurrentUser();
  await runTransaction(this.firestore, async (transaction) => {
      // Validate and apply batch updates
      for (const p of plan) {
        const batchRef = doc(this.firestore, 'productInventoryEntries', p.docId);
        const batchSnap = await transaction.get(batchRef as any);
        if (!batchSnap.exists()) {
          throw new Error(`Batch ${p.batchId} not found during transaction`);
        }

        const batchData: any = batchSnap.data();
        const currentQty = Number(batchData.quantity || 0);
        if (currentQty < p.deduct) {
          throw new Error(`Insufficient quantity in batch ${p.batchId}. Available: ${currentQty}, Needed: ${p.deduct}`);
        }

        const newQty = currentQty - p.deduct;
        const updatedDeductionHistory = [...(batchData.deductionHistory || []), {
          quantity: p.deduct,
          deductedAt: new Date(),
          note: 'POS FIFO deduction'
        }];

        const updateData: any = {
          quantity: newQty,
          totalDeducted: (batchData.totalDeducted || 0) + p.deduct,
          deductionHistory: updatedDeductionHistory,
          updatedAt: new Date(),
          status: newQty === 0 ? 'inactive' : batchData.status
        };

        transaction.update(batchRef as any, updateData);
        console.log(`✅ Transaction: will update batch ${p.batchId} ${currentQty} -> ${newQty}`);
      }

      // Update product totalStock
      const productRef = doc(this.firestore, 'products', productId);
      const productSnap = await transaction.get(productRef as any);
      if (!productSnap.exists()) {
        throw new Error(`Product ${productId} not found while deducting stock`);
      }

      const prodData: any = productSnap.data();
      const currentTotal = Number(prodData.totalStock || 0);
      if (currentTotal < quantityToDeduct) {
        throw new Error(`Insufficient product totalStock for product ${productId}. Available: ${currentTotal}, Needed: ${quantityToDeduct}`);
      }

      const newTotal = Math.max(0, currentTotal - quantityToDeduct);
      // Update product summary (only totalStock and lastUpdated)
      transaction.update(productRef as any, {
        totalStock: newTotal,
        lastUpdated: new Date(),
        updatedBy: currentUser?.uid || 'system'
      });

      console.log(`🔻 Transaction: product ${productId} totalStock ${currentTotal} -> ${newTotal}`);
    });

    console.log(`✅ FIFO deduction completed for product ${productId}`);
  }

  // Invoice Methods
  async getNextInvoiceNumberPreview(): Promise<string> {
    const storeId = this.selectedStoreId();
    if (!storeId) {
      return 'No store selected';
    }
    
    try {
      return await this.invoiceService.getNextInvoiceNumberPreview(storeId);
    } catch (error) {
      console.error('Error getting next invoice preview:', error);
      return 'Error loading preview';
    }
  }

  async debugInvoiceStatus(): Promise<any> {
    const storeId = this.selectedStoreId();
    if (!storeId) {
      return { error: 'No store selected' };
    }
    
    return await this.invoiceService.debugInvoiceStatus(storeId);
  }

  // Analytics Methods
  async getBestSellerProducts(limit: number = 10): Promise<Product[]> {
    try {
      const user = this.authService.getCurrentUser();
      const currentPermission = this.authService.getCurrentPermission();
      if (!currentPermission?.companyId) return [];

      // This would typically aggregate order data to find best sellers
      // For now, return products sorted by some criteria
      const products = this.productService.getProducts();
      return products.slice(0, limit);
    } catch (error) {
      console.error('Error getting best sellers:', error);
      return [];
    }
  }
}
