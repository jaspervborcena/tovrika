import { Injectable, signal, computed, inject, Injector } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  doc,
  getDoc,
  runTransaction,
  writeBatch,
  increment
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
import { LedgerService } from './ledger.service';
import { TagsService } from './tags.service';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PosService {
  private readonly cartItemsSignal = signal<CartItem[]>([]);
  private readonly selectedStoreIdSignal = signal<string>('');
  private readonly isProcessingSignal = signal<boolean>(false);
  private readonly orderDiscountSignal = signal<OrderDiscount | null>(null);
  private readonly isOrderActiveSignal = signal<boolean>(false); // Shared order state
  private readonly isOrderCompletedSignal = signal<boolean>(false); // Shared completion state
  private readonly offlineDocService = inject(OfflineDocumentService);
  private readonly injector = inject(Injector);

  // Computed values
  readonly cartItems = computed(() => this.cartItemsSignal());
  readonly selectedStoreId = computed(() => this.selectedStoreIdSignal());
  readonly isProcessing = computed(() => this.isProcessingSignal());
  readonly orderDiscount = computed(() => this.orderDiscountSignal());
  readonly isOrderActive = computed(() => this.isOrderActiveSignal());
  readonly isOrderCompleted = computed(() => this.isOrderCompletedSignal());

  readonly cartSummary = computed((): CartSummary => {
    const items = this.cartItems();
    const orderDiscount = this.orderDiscount();
    
    // Calculate base amounts
    const grossAmount = items.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0);
    const productDiscountAmount = items.reduce((sum, item) => sum + item.discountAmount, 0);
    const subtotalAfterProductDiscounts = grossAmount - productDiscountAmount;
    
    // Calculate VAT amounts
    const vatableItems = items.filter(item => item.isVatApplicable && !item.isVatExempt);
    const vatExemptItems = items.filter(item => item.vatRate === 0 || item.isVatExempt || !item.isVatApplicable);

    // Vatable sales should represent the base amount BEFORE VAT (i.e., original price after product-level discounts)
    // Use originalPrice * quantity minus the item's total discountAmount to avoid including VAT in the vatableSales sum.
    const vatableSales = vatableItems.reduce((sum, item) => {
      const baseTotal = (Number(item.originalPrice || 0) * Number(item.quantity || 0)) - Number(item.discountAmount || 0);
      return sum + Math.max(0, baseTotal);
    }, 0);

    const vatExemptSales = vatExemptItems.reduce((sum, item) => {
      const baseTotal = (Number(item.originalPrice || 0) * Number(item.quantity || 0)) - Number(item.discountAmount || 0);
      return sum + Math.max(0, baseTotal);
    }, 0);
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

  // Shared payment type signals so different POS components/dialogs can stay in sync
  private readonly salesTypeCashSignal = signal<boolean>(true);
  private readonly salesTypeChargeSignal = signal<boolean>(false);
  readonly isCashSale = computed(() => this.salesTypeCashSignal());
  readonly isChargeSale = computed(() => this.salesTypeChargeSignal());

  /**
   * Set payment method. Use 'cash' or 'charge' to make exclusive selection,
   * or 'both' to allow both to be true.
   */
  setPaymentMethod(method: 'cash' | 'charge' | 'both'): void {
    if (method === 'cash') {
      this.salesTypeCashSignal.set(true);
      this.salesTypeChargeSignal.set(false);
    } else if (method === 'charge') {
      this.salesTypeCashSignal.set(false);
      this.salesTypeChargeSignal.set(true);
    } else {
      this.salesTypeCashSignal.set(true);
      this.salesTypeChargeSignal.set(true);
    }
  }

  toggleCashSale(): void {
    // Toggle cash independently: do not force the other payment type.
    this.salesTypeCashSignal.update(current => !current);
  }

  toggleChargeSale(): void {
    // Toggle charge independently: do not force the other payment type.
    this.salesTypeChargeSignal.update(current => !current);
  }

  private invoiceService = inject(InvoiceService);
  private storeService = inject(StoreService);
  private deviceService = inject(DeviceService);
  private ledgerService = inject(LedgerService);
  
  // Cache for product tags
  private productTagsCache = signal<Map<string, string>>(new Map());

  constructor(
    private firestore: Firestore,
    private authService: AuthService,
    private companyService: CompanyService,
    private productService: ProductService,
    private indexedDBService: IndexedDBService,
    private securityService: FirestoreSecurityService,
    private ordersSellingTrackingService: OrdersSellingTrackingService,
    private tagsService: TagsService
  ) {
    // Load persisted store selection on service initialization
    this.loadPersistedStoreSelection();
  }

  /**
   * Helper method to get user and company data, with offline fallback to IndexedDB
   */
  private async getUserAndCompanyData(): Promise<{ user: any; company: any } | null> {
    let user = this.authService.getCurrentUser();
    let company = await this.companyService.getActiveCompany();
    
    // If offline or data not available, try IndexedDB
    if (!user || !company) {
      console.log('📱 POS: User or company not in memory, checking IndexedDB...');
      
      // Try to get user from IndexedDB
      if (!user) {
        // Get logged in user from userData store
        const allUsers = await this.getAllUsersFromIndexedDB();
        const loggedInUser = allUsers.find((u: any) => u.isLoggedIn === true);
        if (loggedInUser) {
          user = loggedInUser;
          console.log('📱 POS: Loaded user from IndexedDB:', user?.email);
        }
      }
      
      // Try to get company from IndexedDB using currentCompanyId
      if (!company && user) {
        const companyId = user.currentCompanyId || user.permissions?.[0]?.companyId;
        if (companyId) {
          const companies = await this.indexedDBService.getAllCompanies();
          const foundCompany = companies.find((c: any) => c.id === companyId);
          if (foundCompany) {
            company = foundCompany as any;
            console.log('📱 POS: Loaded company from IndexedDB:', (company as any)?.companyName || (company as any)?.name);
          }
        }
      }
    }
    
    if (!user || !company) {
      console.error('❌ POS: User or company not found in memory or IndexedDB');
      return null;
    }
    
    return { user, company };
  }

  /**
   * Helper to get all users from IndexedDB userData store
   */
  private async getAllUsersFromIndexedDB(): Promise<any[]> {
    try {
      const db = (this.indexedDBService as any).db;
      if (!db) {
        await this.indexedDBService.initDB();
      }
      
      return new Promise((resolve) => {
        const transaction = (this.indexedDBService as any).db.transaction(['userData'], 'readonly');
        const store = transaction.objectStore('userData');
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
      });
    } catch (error) {
      console.error('Error getting users from IndexedDB:', error);
      return [];
    }
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

  updateCartItem(updatedItem: CartItem): void {
    this.cartItemsSignal.update(items =>
      items.map(item => {
        if (item.productId === updatedItem.productId) {
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
    // Note: We don't reset order state here - that should be done explicitly via resetOrderState()
    console.log('🗑️ Cart cleared');
  }

  // Shared order state management
  setOrderActive(active: boolean): void {
    this.isOrderActiveSignal.set(active);
    console.log('📝 Order active state set to:', active);
  }

  setOrderCompleted(completed: boolean): void {
    this.isOrderCompletedSignal.set(completed);
    console.log('✅ Order completed state set to:', completed);
  }

  resetOrderState(): void {
    this.isOrderActiveSignal.set(false);
    this.isOrderCompletedSignal.set(false);
    console.log('🔄 Order state reset');
  }

  // Reset all POS state (called on logout)
  resetAll(): void {
    console.log('🔍 [POSService] Resetting all POS data');
    this.clearCart();
    this.resetOrderState();
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
    
    // Load product tags for the selected store
    await this.loadProductTags(storeId);
    
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
      
      const userData = await this.getUserAndCompanyData();
      if (!userData) {
        throw new Error('User or company not found');
      }
      
      const { user, company } = userData;

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
        vat: Number(((item.vatAmount || 0)).toFixed(2)),
        discount: item.discountAmount,
        isVatExempt: item.isVatExempt,
        // Per-item customer info (optional)
        customerName: (item as any).customerName || null,
        pwdId: (item as any).pwdId || null,
        customerDiscountType: (item as any).customerDiscountType || null
      } as any));
      // Prepare complete order data (without invoice number - will be assigned by transaction)
      const orderData = {
        companyId: company.id!,
        storeId: storeId,
        assignedCashierId: user.uid,
        assignedCashierEmail: user.email || 'Unknown Cashier',
        assignedCashierName: user.displayName || user.email || 'Unknown Cashier',
        status: 'paid',
        
        // Customer Information
        cashSale: this.salesTypeCashSignal(),
        chargeSale: this.salesTypeChargeSignal(),
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
        vatAmount: Number(((summary.vatAmount || 0)).toFixed(2)),
        zeroRatedSales: summary.zeroRatedSales,
        vatExemptAmount: summary.vatExemptSales,
        discountAmount: summary.productDiscountAmount + summary.orderDiscountAmount,
        grossAmount: summary.grossAmount,
        netAmount: summary.netAmount,
        totalAmount: summary.netAmount,
        
        // Order Items
        items: orderItems,
        
        // BIR Required Fields - from store BIR details
        atpOrOcn: store.birDetails?.atpOrOcn || '',
        birPermitNo: store.birDetails?.birPermitNo || '',
        inclusiveSerialNumber: store.birDetails?.inclusiveSerialNumber || '',
        
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

      // Record accounting ledger entry for the created order (non-blocking)
      try {
        // Skip ledger recording if offline - it will be handled when synced
        if (navigator.onLine) {
          // Use the locally computed `summary` from above (not an undefined `cartSummary`)
          const ledgerRes: any = await this.ledgerService.recordEvent(
            company.id || '',
            storeId,
            invoiceResult.orderId!,
            'completed',
            Number(summary.netAmount || 0),
            Number(summary.totalQuantity || 0),
            user.uid
          );
          console.log('LedgerService: order ledger entry created for', invoiceResult.orderId, 'docId=', ledgerRes?.id, 'runningBalance=', ledgerRes?.runningBalanceAmount, ledgerRes?.runningBalanceQty);
        } else {
          console.log('📱 Offline: Skipping ledger entry - will sync when online');
        }
      } catch (ledgerErr) {
        console.warn('LedgerService: failed to create ledger entry (non-blocking):', ledgerErr);
      }

      // Sync local product summaries with server values so UI reflects Firestore state
      try {
        if (navigator.onLine) {
          await this.syncProductsFromOrder(orderItems);
          console.log('🔄 Local product summaries synced from server after invoice');
        } else {
          console.log('📱 Offline: Skipping product sync - will sync when online');
        }
      } catch (syncErr) {
        console.warn('⚠️ Failed to sync local product summaries after invoice (non-blocking):', syncErr);
      }

      // Update product inventory (this happens after successful order creation)
      try {
        await this.updateProductInventory(cartItems, { orderId: invoiceResult.orderId!, invoiceNumber: invoiceResult.invoiceNumber! });
        console.log('✅ Product inventory updated successfully');
        
        // Mark tracking docs as completed for this order (if any were created as pending)
        try {
          // Skip tracking update if offline - Firestore will handle sync
          if (navigator.onLine) {
            const markRes = await this.ordersSellingTrackingService.markOrderTrackingCompleted(invoiceResult.orderId!, user.uid);
            if (markRes.errors && markRes.errors.length) {
              console.warn('⚠️ Some tracking docs failed to be marked completed:', markRes.errors);
            } else {
              console.log(`✅ Marked ${markRes.updated} tracking docs completed for order ${invoiceResult.orderId}`);
            }
          } else {
            console.log('📱 Offline: Skipping tracking update - will sync when online');
          }
        } catch (markErr) {
          console.warn('⚠️ Failed to mark ordersSellingTracking docs completed (non-blocking):', markErr);
        }
      } catch (inventoryError) {
        console.error('⚠️ Warning: Order created but inventory update failed (non-blocking):', inventoryError);
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
    payments: { amountTendered: number; changeAmount: number; paymentDescription: string; paymentType: string }
  ): Promise<{ orderId: string; invoiceNumber: string } | null> {
    try {
      this.isProcessingSignal.set(true);
      console.log('🧾 Starting NEW order processing with customerInfo and payments...');
      
      const userData = await this.getUserAndCompanyData();
      if (!userData) {
        throw new Error('User or company not found');
      }
      
      const { user, company } = userData;

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
        vat: Number(((item.vatAmount || 0)).toFixed(2)),
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
        
        // Payment type determination - use actual checkbox states from service
        cashSale: this.isCashSale(),
        chargeSale: this.isChargeSale(),
        
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
        vatAmount: Number(((cartSummary.vatAmount || 0)).toFixed(2)),
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
      // Only apply timeout when online - offline mode should work without timeout
      let invoiceResult;
      try {
        const invoicePromise = this.invoiceService.processInvoiceTransaction({
          storeId: storeId,
          orderData: orderData,
          customerInfo: customerInfo, // Pass as separate parameter
          paymentsData: payments      // Pass as separate parameter
        });
        
        // Apply very short timeout to quickly detect offline mode
        if (navigator.onLine) {
          console.log('🌐 Online mode: applying 2-second timeout for invoice transaction');
          const timeoutPromise = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Invoice transaction timeout - switching to offline mode')), 2000)
          );
          
          invoiceResult = await Promise.race([invoicePromise, timeoutPromise]);
        } else {
          console.log('📴 Offline mode: processing invoice without timeout (Firestore persistence active)');
          invoiceResult = await invoicePromise;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // If timeout or network error, the invoice service should have already switched to offline mode
        if (errorMessage.includes('timeout') || errorMessage.includes('network') || !navigator.onLine) {
          console.log('⚠️ Network timeout detected, invoice service should handle offline mode automatically');
        }
        
        throw error; // Let the invoice service handle offline processing
      }

      // Check transaction result
      if (!invoiceResult.success) {
        throw new Error(`Invoice transaction failed: ${invoiceResult.error}`);
      }

      console.log('✅ NEW Invoice transaction completed:', {
        invoiceNumber: invoiceResult.invoiceNumber,
        orderId: invoiceResult.orderId
      });

      // Record accounting ledger entry for the created order (non-blocking)
      try {
        // Always record ledger - Firestore offline persistence will handle sync
        const ledgerPromise = this.ledgerService.recordEvent(
          company.id!,
          storeId,
          invoiceResult.orderId!,
          'completed',
          Number(cartSummary.netAmount || 0),
          Number(cartSummary.totalQuantity || 0),
          user.uid
        );
        
        if (navigator.onLine) {
          // Add short timeout (1s) only when online to prevent hanging on slow connections
          const ledgerRes: any = await Promise.race([
            ledgerPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Ledger recording timeout')), 1000))
          ]);
          
          console.log('LedgerService: order ledger entry created for', invoiceResult.orderId, 'docId=', ledgerRes?.id, 'runningBalance=', ledgerRes?.runningBalanceAmount, ledgerRes?.runningBalanceQty);
        } else {
          // Offline: Let it complete without timeout - Firestore persistence will queue it
          console.log('📱 Offline: Recording ledger entry (will auto-sync when online)');
          await ledgerPromise;
        }
      } catch (ledgerErr) {
        console.warn('LedgerService: failed to create ledger entry (non-blocking):', ledgerErr);
      }

      // Update product inventory
      try {
        await this.updateProductInventory(cartItems, { orderId: invoiceResult.orderId!, invoiceNumber: invoiceResult.invoiceNumber! });
        console.log('✅ Product inventory updated successfully');
        
        // Mark tracking docs as completed for this order (if any were created as pending)
        try {
          // Always mark tracking - Firestore offline persistence will handle sync
          const trackingPromise = this.ordersSellingTrackingService.markOrderTrackingCompleted(invoiceResult.orderId!, user.uid);
          
          if (navigator.onLine) {
            // Add short timeout (1s) only when online to prevent hanging on slow connections
            const markRes = await Promise.race([
              trackingPromise,
              new Promise((_, reject) => setTimeout(() => reject(new Error('Tracking update timeout')), 1000))
            ]) as any;
            
            if (markRes?.errors && markRes.errors.length) {
              console.warn('⚠️ Some tracking docs failed to be marked completed:', markRes.errors);
            } else {
              console.log(`✅ Marked ${markRes?.updated || 0} tracking docs completed for order ${invoiceResult.orderId}`);
            }
          } else {
            // Offline: Let it complete without timeout - Firestore persistence will queue it
            console.log('📱 Offline: Marking tracking completed (will auto-sync when online)');
            await trackingPromise;
          }
        } catch (markErr) {
          console.warn('⚠️ Failed to mark ordersSellingTracking docs completed (non-blocking):', markErr);
        }
      } catch (inventoryError) {
        console.error('⚠️ Warning: Order created but inventory update failed (non-blocking):', inventoryError);
        // Don't throw - allow order to complete even if inventory update fails
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
      
      const userData = await this.getUserAndCompanyData();
      if (!userData) {
        throw new Error('User or company not found');
      }
      
      const { user, company } = userData;

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
        chargeSale: this.salesTypeChargeSignal(),
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
        vatAmount: Number(((cartSummary.vatAmount || 0)).toFixed(2)),
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
        // Mark tracking docs as completed for this order (if any were created as pending)
        try {
          const markRes = await this.ordersSellingTrackingService.markOrderTrackingCompleted(invoiceResult.orderId!, user.uid);
          if (markRes.errors && markRes.errors.length) {
            console.warn('⚠️ Some tracking docs failed to be marked completed:', markRes.errors);
          } else {
            console.log(`✅ Marked ${markRes.updated} tracking docs completed for order ${invoiceResult.orderId}`);
          }
        } catch (markErr) {
          console.warn('⚠️ Failed to mark ordersSellingTracking docs completed:', markErr);
        }
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
    // Use sellingPrice (which already includes VAT) as the base price
    // Only apply additional discounts if configured
    const sellingPrice = product.sellingPrice ?? 0;
    const originalPrice = (product as any).originalPrice ?? sellingPrice;
    const vatRate = Number(product.vatRate ?? 0);

    console.log('🛒 Creating cart item for:', product.productName, {
      productId: product.id,
      sellingPrice: sellingPrice,
      originalPrice: originalPrice,
      hasDiscount: product.hasDiscount,
      discountType: product.discountType,
      discountValue: product.discountValue,
      isVatApplicable: product.isVatApplicable,
      vatRate: vatRate
    });

    if (sellingPrice === 0) {
      console.error('⚠️ WARNING: Product has zero selling price!', {
        productName: product.productName,
        productId: product.id,
        sellingPrice: sellingPrice,
        originalPrice: originalPrice
      });
    }

    // Apply discount to selling price if configured
    let discountPerUnit = 0;
    if (product.hasDiscount) {
      if (product.discountType === 'percentage') {
        discountPerUnit = (sellingPrice * (product.discountValue || 0)) / 100;
      } else {
        discountPerUnit = product.discountValue || 0;
      }
    }

    const finalPricePerUnit = Math.max(0, sellingPrice - discountPerUnit);
    const finalPricePerUnitRounded = Number(finalPricePerUnit.toFixed(2));

    // Calculate VAT amount based on final price (VAT is already included in selling price)
    // We calculate it for display purposes by reverse-calculating from the VAT-inclusive price
    let vatAmountPerUnit = 0;
    if (product.isVatApplicable && vatRate > 0) {
      // Reverse calculate: vatAmount = price - (price / (1 + vatRate/100))
      vatAmountPerUnit = finalPricePerUnit - (finalPricePerUnit / (1 + vatRate / 100));
    }
    const vatAmountPerUnitRounded = Number(vatAmountPerUnit.toFixed(2));

    const discountAmount = Number((discountPerUnit * quantity).toFixed(2));
    const vatAmount = Number((vatAmountPerUnitRounded * quantity).toFixed(2));
    const total = Number((finalPricePerUnitRounded * quantity).toFixed(2));

    // Use denormalized tag labels from product for instant display
    const tagLabels = product.tagLabels || [];

    return {
      productId: product.id!,
      productName: product.productName,
      skuId: product.skuId,
      unitType: product.unitType,
      quantity,
      // Store final selling price after discounts
      sellingPrice: finalPricePerUnitRounded,
      originalPrice: originalPrice,
      total,
      isVatApplicable: product.isVatApplicable,
      vatRate: vatRate,
      vatAmount,
      hasDiscount: product.hasDiscount,
      discountType: product.discountType,
      discountValue: product.discountValue,
      discountAmount,
      isVatExempt: false,
      imageUrl: product.imageUrl,
      tags: product.tags,
      tagLabels: tagLabels
    };
  }

  private getTagLabels(tagIds: string[]): string[] {
    if (!tagIds || tagIds.length === 0) return [];
    const tagsMap = this.productTagsCache();
    return tagIds
      .map(tagId => tagsMap.get(tagId) || tagId)
      .filter((label): label is string => label !== null && label !== undefined);
  }

  /**
   * Get all active tags for a store from Firestore
   */
  async getTagsForStore(storeId: string): Promise<any[]> {
    try {
      const tags = await this.tagsService.getTagsByStore(storeId, false);
      return tags;
    } catch (error) {
      console.error('❌ Failed to get tags for store:', error);
      return [];
    }
  }

  async loadProductTags(storeId: string): Promise<void> {
    try {
      console.log('🏷️ Loading product tags for store:', storeId);
      const tags = await this.tagsService.getTagsByStore(storeId, false);
      console.log('🏷️ Loaded tags:', tags.length);
      const tagsMap = new Map<string, string>();
      tags.forEach(tag => {
        tagsMap.set(tag.tagId, tag.label);
        console.log('🏷️ Tag mapping:', tag.tagId, '->', tag.label);
      });
      this.productTagsCache.set(tagsMap);
      console.log('🏷️ Tags cache updated. Total tags:', tagsMap.size);
    } catch (error) {
      console.error('❌ Error loading product tags:', error);
    }
  }

  private recalculateCartItem(item: CartItem): CartItem {
    // Recalculate sellingPrice, discountAmount, vatAmount and total based on originalPrice
    const original = (item.originalPrice ?? item.sellingPrice) as number;
    const vatRate = Number(item.vatRate ?? 0);

    // Per-unit discount
    let discountPerUnit = 0;
    if (item.hasDiscount) {
      if (item.discountType === 'percentage') {
        discountPerUnit = (original * (item.discountValue || 0)) / 100;
      } else {
        discountPerUnit = item.discountValue || 0;
      }
    }

    const netBasePerUnit = Math.max(0, original - discountPerUnit);
    const vatAmountPerUnit = (item.isVatApplicable && !item.isVatExempt) ? (netBasePerUnit * vatRate) / 100 : 0;
    // Round per-unit VAT and selling price to 2 decimals for consistent totals
    const vatAmountPerUnitRounded = Number(vatAmountPerUnit.toFixed(2));
    const sellingPricePerUnitRounded = Number((netBasePerUnit + vatAmountPerUnitRounded).toFixed(2));

    const discountAmount = Number((discountPerUnit * item.quantity).toFixed(2));
    const vatAmount = Number((vatAmountPerUnitRounded * item.quantity).toFixed(2));
    const total = Number((sellingPricePerUnitRounded * item.quantity).toFixed(2));

    return {
      ...item,
      sellingPrice: sellingPricePerUnitRounded,
      total,
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
      // In offline mode, proceed without FIFO validation - Firestore will validate when synced
      if (!navigator.onLine) {
        console.log('📱 Offline mode: No batch data available, proceeding with stock deduction only');
        // Just update the product stock without batch-level tracking
        const currentUser = this.authService.getCurrentUser();
        const batch = writeBatch(this.firestore);
        const productRef = doc(this.firestore, 'products', productId);
        
        batch.update(productRef as any, {
          totalStock: increment(-quantityToDeduct),
          lastUpdated: new Date(),
          updatedBy: currentUser?.uid || 'system'
        });
        
        try {
          await Promise.race([
            batch.commit(),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Batch commit timeout')), 5000)
            )
          ]);
          console.log('📱 Offline stock deduction queued for product', productId);
        } catch (commitError) {
          console.log('📱 Stock deduction queued by Firestore offline persistence');
        }
        
        return;
      }
      
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

    // Execute all updates using batch writes for offline support
  const currentUser = this.authService.getCurrentUser();
  const batch = writeBatch(this.firestore);
  
  // Pre-read product to validate stock (client-side check)
  const productRef = doc(this.firestore, 'products', productId);
  let productSnap;
  let currentTotal = 0;
  
  try {
    // Add timeout to prevent hanging
    productSnap = await Promise.race([
      getDoc(productRef as any),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Product read timeout')), 3000)
      )
    ]);
    
    if (!productSnap.exists()) {
      throw new Error(`Product ${productId} not found while deducting stock`);
    }
    
    const prodData: any = productSnap.data();
    currentTotal = Number(prodData.totalStock || 0);
    
    if (currentTotal < quantityToDeduct) {
      console.warn(`⚠️ Product ${productId} may have insufficient stock. Available: ${currentTotal}, Needed: ${quantityToDeduct}`);
      // In offline mode, allow deduction - Firestore will sync and validate when online
      if (!navigator.onLine) {
        console.log('📱 Offline mode: proceeding with deduction, will validate when synced');
      } else {
        throw new Error(`Insufficient product totalStock for product ${productId}. Available: ${currentTotal}, Needed: ${quantityToDeduct}`);
      }
    }
  } catch (readError) {
    console.warn('⚠️ Failed to read product for validation:', readError);
    // In offline mode, proceed with deduction - validation will happen when synced
    if (!navigator.onLine) {
      console.log('📱 Offline mode: proceeding without pre-validation');
      currentTotal = quantityToDeduct; // Assume sufficient stock
    } else {
      throw readError;
    }
  }
  
  // Apply batch updates
  for (const p of plan) {
    const batchRef = doc(this.firestore, 'productInventory', p.docId);
    
    // Client-side validation from cached/offline data
    let batchData: any = null;
    let currentQty = p.deduct; // Default assumption
    
    try {
      // Add timeout to prevent hanging
      const batchSnap = await Promise.race([
        getDoc(batchRef as any),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Batch read timeout')), 2000)
        )
      ]);
      
      if (batchSnap.exists()) {
        batchData = batchSnap.data();
        currentQty = Number(batchData.quantity || 0);
      }
    } catch (batchReadError) {
      console.warn(`⚠️ Failed to read batch ${p.batchId} for validation:`, batchReadError);
      // In offline mode, proceed without pre-validation
      if (!navigator.onLine) {
        console.log(`📱 Offline mode: proceeding with batch ${p.batchId} update`);
      } else {
        // Online but read failed - skip this batch update
        console.warn(`⚠️ Skipping batch ${p.batchId} update due to read failure`);
        continue;
      }
    }
    
    const newQty = Math.max(0, currentQty - p.deduct);
    
    batch.update(batchRef as any, {
      quantity: newQty,
      totalDeducted: (batchData?.totalDeducted || 0) + p.deduct,
      updatedAt: new Date(),
      status: newQty === 0 ? 'inactive' : (batchData?.status || 'active')
    });
    
    console.log(`✅ Batch: will update batch ${p.batchId} ${currentQty} -> ${newQty}`);
    
    // Persist a deduction record for audit/querying
    const dedRecord = {
      productId,
      batchId: p.batchId,
      quantity: p.deduct,
      deductedAt: new Date(),
      note: 'POS FIFO deduction',
      deductedBy: currentUser?.uid || null
    };
    const dedRef = doc(collection(this.firestore, 'inventoryDeductions'));
    batch.set(dedRef, dedRecord);
  }
  
  // Update product totalStock
  const newTotal = Math.max(0, currentTotal - quantityToDeduct);
  batch.update(productRef as any, {
    totalStock: newTotal,
    lastUpdated: new Date(),
    updatedBy: currentUser?.uid || 'system'
  });
  
  console.log(`🔻 Batch: product ${productId} totalStock ${currentTotal} -> ${newTotal}`);
  
  // Commit batch (queues offline, syncs when online)
  try {
    await Promise.race([
      batch.commit(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Batch commit timeout')), 10000)
      )
    ]);
    console.log(`✅ FIFO deduction batch committed for product ${productId}`);
  } catch (commitError) {
    console.warn('⚠️ Batch commit timeout or error:', commitError);
    // In offline mode, the batch is queued by Firestore offline persistence
    if (!navigator.onLine) {
      console.log('📱 Offline mode: batch queued for sync when online');
    } else {
      throw commitError;
    }
  }

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
