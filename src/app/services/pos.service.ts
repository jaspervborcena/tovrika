import { Injectable, signal, computed, inject, Injector } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  runTransaction,
  writeBatch,
  increment,
  setDoc
} from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { CompanyService } from './company.service';
import { ProductService } from './product.service';
import { InvoiceService } from './invoice.service';
import { StoreService } from './store.service';
import { DeviceService } from './device.service';
import { SqliteStorageService } from '../core/services/sqlite-storage.service';
import { FirestoreSecurityService } from '../core/services/firestore-security.service';
import { OfflineDocumentService } from '../core/services/offline-document.service';
import { NetworkService } from '../core/services/network.service';
import { Order, OrderDetail, OrderItem, CartItem, ReceiptData, OrderDiscount, ReceiptValidityNotice } from '../interfaces/pos.interface';
import { Product } from '../interfaces/product.interface';
import { Store } from '../interfaces/store.interface';
import { Device } from '../interfaces/device.interface';
import { OrdersSellingTrackingService } from './orders-selling-tracking.service';
import { TagsService } from './tags.service';
import { ItemCodeService } from './item-code.service';
import { calculateCartSummary } from './pos-checkout.utils';
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
  private readonly inventoryProcessingTimeoutMs = 15_000;
  private readonly offlineDocService = inject(OfflineDocumentService);
  private readonly itemCodeService = inject(ItemCodeService);
  private readonly injector = inject(Injector);

  // Computed values
  readonly cartItems = computed(() => this.cartItemsSignal());
  readonly selectedStoreId = computed(() => this.selectedStoreIdSignal());
  readonly isProcessing = computed(() => this.isProcessingSignal());
  readonly orderDiscount = computed(() => this.orderDiscountSignal());
  readonly isOrderActive = computed(() => this.isOrderActiveSignal());
  readonly isOrderCompleted = computed(() => this.isOrderCompletedSignal());

  readonly cartSummary = computed(() =>
    calculateCartSummary(
      this.cartItems(),
      this.orderDiscount(),
      productId => this.productService.getProduct(productId)
    )
  );

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
  private networkService = inject(NetworkService);
  
  // Cache for product tags
  private productTagsCache = signal<Map<string, string>>(new Map());

  constructor(
    private firestore: Firestore,
    private authService: AuthService,
    private companyService: CompanyService,
    private productService: ProductService,
    private sqliteService: SqliteStorageService,
    private securityService: FirestoreSecurityService,
    private ordersSellingTrackingService: OrdersSellingTrackingService,
    private tagsService: TagsService
  ) {
    // Load persisted store selection on service initialization
    this.loadPersistedStoreSelection();
  }

  /**
   * Helper method to get user and company data, with offline fallback to SQLite
   */
  private async getUserAndCompanyData(): Promise<{ user: any; company: any } | null> {
    let user = this.authService.getCurrentUser();
    let company = await this.companyService.getActiveCompany();
    
    // If offline or data not available, try SQLite
    if (!user || !company) {
      console.log('📱 POS: User or company not in memory, checking SQLite...');
      
      // Try to get user from SQLite
      if (!user) {
        const allUsers = await this.getAllUsersFromSQLite();
        const loggedInUser = allUsers.find((u: any) => u.isLoggedIn === true);
        if (loggedInUser) {
          user = loggedInUser;
          console.log('📱 POS: Loaded user from SQLite:', user?.email);
        }
      }
      
      // Try to get company from SQLite using currentCompanyId
      if (!company && user) {
        const companyId = user.currentCompanyId || user.permissions?.[0]?.companyId;
        if (companyId) {
          const companies = await this.sqliteService.getAllCompanies();
          const foundCompany = companies.find((c: any) => c.id === companyId);
          if (foundCompany) {
            company = foundCompany as any;
            console.log('📱 POS: Loaded company from SQLite:', (company as any)?.companyName || (company as any)?.name);
          }
        }
      }
    }
    
    if (!user || !company) {
      console.error('❌ POS: User or company not found in memory or SQLite');
      return null;
    }
    
    return { user, company };
  }

  /**
   * Get cached users for offline POS recovery.
   */
  private async getAllUsersFromSQLite(): Promise<any[]> {
    try {
      return await this.sqliteService.getAllUsers();
    } catch (error) {
      console.error('Error getting cached users from SQLite:', error);
      return [];
    }
  }

  static normalizeCartItemForStorage(item: Partial<CartItem>, quantityOverride?: number): any {
    const quantity = Number(quantityOverride ?? item.quantity ?? 0);
    const sellingPrice = Number((item.sellingPrice ?? 0).toFixed(2));
    const discountAmount = Number((item.discountAmount ?? 0).toFixed(2));
    const vatAmount = Number((item.vatAmount ?? 0).toFixed(2));
    const total = Number((item.total ?? (sellingPrice * quantity)).toFixed(2));
    const normalizedDiscount = Number((item.hasDiscount ? discountAmount : 0).toFixed(2));

    return {
      ...item,
      quantity,
      sellingPrice,
      price: sellingPrice,
      total,
      discountAmount: normalizedDiscount,
      discount: normalizedDiscount,
      vatAmount,
      vat: vatAmount,
      isVatApplicable: !!item.isVatApplicable,
      isVatExempt: !!item.isVatExempt,
      hasDiscount: !!item.hasDiscount && Number(item.discountValue ?? 0) > 0,
      discountType: item.discountType === 'fixed' ? 'fixed' : 'percentage',
      discountValue: Number(item.discountValue ?? 0),
      productName: item.productName || '',
      skuId: item.skuId || ''
    };
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
    
    // Save to SQLite for persistence
    try {
      const currentUser = this.authService.getCurrentUser();
      if (currentUser?.uid) {
        // Get existing user data and update currentStoreId
        const existingUserData = await this.sqliteService.getUserData(currentUser.uid);
        if (existingUserData) {
          existingUserData.currentStoreId = storeId;
          await this.sqliteService.saveUserData(existingUserData);
        }
      }
    } catch (error) {
      console.error('⚠️ Failed to save store selection to SQLite:', error);
    }
    
    // Only clear cart if explicitly requested or if cart is empty
    if (!options?.preserveCart && this.cartItems().length === 0) {
      this.clearCart();
    } else if (!options?.preserveCart) {
      console.log('🛒 Cart preserved during store selection - cart has items');
    }
  }

  // Load selected store from SQLite on service initialization
  private async loadPersistedStoreSelection(): Promise<void> {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (currentUser?.uid) {
        const offlineUserData = await this.sqliteService.getUserData(currentUser.uid);
        if (offlineUserData?.currentStoreId) {
          this.selectedStoreIdSignal.set(offlineUserData.currentStoreId);
        }
      }
    } catch (error) {
      console.error('⚠️ Failed to load store selection from SQLite:', error);
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

      const cartItems = this.cartItems().map(item => {
        const normalized = PosService.normalizeCartItemForStorage(item);
        return {
          ...normalized,
          itemCode: normalized.itemCode || this.itemCodeService.generateItemCode()
        };
      });
      if (cartItems.length === 0) {
        throw new Error('Cart is empty');
      }

      const summary = this.cartSummary();

      // Prepare order items for storage from the normalized cart state so they match the receipt and checkout values
      const orderItems: OrderItem[] = cartItems.map(item => ({
        productId: item.productId,
        itemCode: item.itemCode,
        productName: item.productName,
        quantity: item.quantity,
        price: Number((item.sellingPrice ?? 0).toFixed(2)),
        costPrice: item.costPrice ?? 0,
        total: Number((item.total ?? 0).toFixed(2)),
        vat: Number(((item.vatAmount ?? 0)).toFixed(2)),
        discount: Number(((item.discountAmount ?? 0)).toFixed(2)),
        isVatExempt: !!item.isVatExempt,
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
        status: 'completed',

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
        branchName: store.branchName || '',

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

      // Update product inventory (this happens after successful order creation)
      try {
        await this.updateProductInventory(cartItems, { orderId: invoiceResult.orderId!, invoiceNumber: invoiceResult.invoiceNumber!, customerId: customerInfo?.customerId, status: orderData.status });
        console.log('✅ Product inventory updated successfully');

        // Sync local product summaries after the deduction has been applied so the POS UI shows the updated totalStock.
        try {
          if (this.networkService.isOnline()) {
            await this.syncProductsFromOrder(orderItems);
            console.log('🔄 Local product summaries synced from server after inventory deduction');
          } else {
            console.log('📱 Offline: Skipping product sync - will sync when online');
          }
        } catch (syncErr) {
          console.warn('⚠️ Failed to sync local product summaries after inventory deduction (non-blocking):', syncErr);
        }
        
        // Mark tracking docs as completed for this paid order.
        try {
          const markRes = await this.ordersSellingTrackingService.markOrderTrackingCompleted(invoiceResult.orderId!, user.uid);
          if (markRes.errors && markRes.errors.length) {
            console.warn('⚠️ Some tracking docs failed to be marked completed:', markRes.errors);
          } else {
            console.log(`✅ Marked ${markRes.updated} tracking docs completed for order ${invoiceResult.orderId}`);
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
    customerInfo: { uid?: string; fullName: string; address: string; tin: string; customerId: string }, 
    payments: { amountTendered: number; changeAmount: number; paymentDescription: string; paymentType: string },
    saveAsOpen: boolean = false,
    tableNumber: string = ''
  ): Promise<{
    orderId: string;
    invoiceNumber: string;
    inventoryPending?: boolean;
    inventoryPendingReason?: 'offline' | 'timeout' | 'failed';
    inventoryPendingMessage?: string;
  } | null> {
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

      const cartItems = this.cartItems().map(item => {
        const normalized = PosService.normalizeCartItemForStorage(item);
        return {
          ...normalized,
          itemCode: normalized.itemCode || this.itemCodeService.generateItemCode(),
        };
      });
      if (cartItems.length === 0) {
        throw new Error('Cart is empty');
      }

      console.log('Processing NEW order structure for store:', storeId);
      console.log('📝 Customer info:', customerInfo);
      console.log('💳 Payment info:', payments);

      const cartSummary = this.cartSummary();

      // Prepare order items for storage from the normalized cart state so they match the receipt and checkout values
      const orderItems: OrderItem[] = cartItems.map(item => ({
        productId: item.productId,
        itemCode: item.itemCode,
        productName: item.productName,
        quantity: item.quantity,
        price: Number((item.sellingPrice ?? 0).toFixed(2)),
        total: Number((item.total ?? 0).toFixed(2)),
        vat: Number(((item.vatAmount ?? 0)).toFixed(2)),
        discount: Number(((item.discountAmount ?? 0)).toFixed(2)),
        isVatExempt: !!item.isVatExempt
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

         branchName: store.branchName || '',
        
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

      console.log('📦 Processing order with invoice service...');
      
      if (saveAsOpen) {
        console.log('💼 OPEN order mode: Will skip background operations (no tracking/inventory/ledger)');
      }
      
      // 🧾 Execute invoice transaction with NEW structure
      const invoiceResult = await this.invoiceService.processInvoiceTransaction({
        storeId: storeId,
        orderData: orderData,
        customerInfo: customerInfo, // Pass as separate parameter
        paymentsData: payments,     // Pass as separate parameter
        saveAsOpen: saveAsOpen,     // Pass OPEN flag
        tableNumber: tableNumber    // Pass table number separately
      });

      // Check transaction result
      if (!invoiceResult.success) {
        throw new Error(`Invoice transaction failed: ${invoiceResult.error}`);
      }

      console.log('✅ NEW Invoice transaction completed:', {
        invoiceNumber: invoiceResult.invoiceNumber,
        orderId: invoiceResult.orderId
      });

      // Return order info immediately so receipt can be shown
      const orderResult: {
        orderId: string;
        invoiceNumber: string;
        inventoryPending?: boolean;
        inventoryPendingReason?: 'offline' | 'timeout' | 'failed';
        inventoryPendingMessage?: string;
      } = {
        orderId: invoiceResult.orderId!,
        invoiceNumber: invoiceResult.invoiceNumber!
      };

      // Wait up to 15 seconds for FIFO; keep payment final and expose a separate inventory retry on timeout.
      // Skip background operations for OPEN orders (no tracking/inventory/ledger)
      if (!saveAsOpen) {
        const backgroundOperations = this.executeBackgroundOrderOperations(
          company.id!,
          storeId,
          invoiceResult.orderId!,
          invoiceResult.invoiceNumber!,
          cartSummary,
          cartItems,
          user.uid,
           orderData.status || 'completed'
        );
        if (!this.networkService.isOnline()) {
          const result = await backgroundOperations;
          if (result.pending) {
            orderResult.inventoryPending = true;
            orderResult.inventoryPendingReason = result.reason || 'offline';
            orderResult.inventoryPendingMessage = result.message;
          }
        } else {
          let timeoutId: ReturnType<typeof setTimeout> | undefined;
          try {
            const result = await Promise.race([
              backgroundOperations,
              new Promise<never>((_, reject) => {
                timeoutId = setTimeout(
                  () => reject(new Error('Inventory processing timed out after 15 seconds.')),
                  this.inventoryProcessingTimeoutMs
                );
              })
            ]);
            if (result.pending) {
              orderResult.inventoryPending = true;
              orderResult.inventoryPendingReason = result.reason || 'failed';
              orderResult.inventoryPendingMessage = result.message;
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            orderResult.inventoryPending = true;
            orderResult.inventoryPendingReason = message.includes('timed out') ? 'timeout' : 'failed';
            orderResult.inventoryPendingMessage = message;
            void backgroundOperations.catch(backgroundError => {
              console.error('Inventory processing continued after the checkout wait ended:', backgroundError);
            });
          } finally {
            if (timeoutId) clearTimeout(timeoutId);
          }
        }
      } else {
        console.log('💼 OPEN order: Skipping background operations (tracking/inventory/ledger)');
      }

      return orderResult;

    } catch (error) {
      console.error('❌ Error processing NEW order with invoice:', error);
      throw error;
    } finally {
      this.isProcessingSignal.set(false);
    }
  }

  /**
   * Execute background operations after order is created
   * These operations run asynchronously and don't block receipt display
   */
  /**
   * Execute background operations for an existing order (public method for Pay Now on OPEN orders)
   * This includes: orderSellingTracking, inventory updates, inventory deduction, and ledger entries
   */
  async executeBackgroundOperationsForExistingOrder(
    orderId: string,
    invoiceNumber: string
  ): Promise<void> {
    try {
      console.log('🔄 Executing background operations for existing order:', orderId);
      
      // Get necessary data
      const userData = await this.getUserAndCompanyData();
      if (!userData) {
        throw new Error('User or company not found');
      }
      
      const { user, company } = userData;
      const storeId = this.selectedStoreId();
      if (!storeId) {
        throw new Error('No store selected');
      }

      // Fetch order details to get items
      const orderDetailsQuery = query(
        collection(this.firestore, 'orderDetails'),
        where('orderId', '==', orderId)
      );
      const orderDetailsSnapshot = await getDocs(orderDetailsQuery);
      
      if (orderDetailsSnapshot.empty) {
        throw new Error('No order details found for this order');
      }

      // Collect all items from orderDetails
      let allItems: any[] = [];
      orderDetailsSnapshot.forEach(doc => {
        const data = doc.data();
        if (data['items'] && Array.isArray(data['items'])) {
          allItems = allItems.concat(data['items']);
        }
      });

      // Fetch the order document to get totals
      const orderRef = doc(this.firestore, 'orders', orderId);
      const orderDoc = await getDoc(orderRef);
      
      if (!orderDoc.exists()) {
        throw new Error('Order not found');
      }
      
      const orderData = orderDoc.data();
      
      // Create cart summary from order data
      const cartSummary = {
        netAmount: orderData['totalAmount'] || orderData['netAmount'] || 0,
        totalQuantity: allItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
      };

      // Execute background operations
      await this.executeBackgroundOrderOperations(
        company.id!,
        storeId,
        orderId,
        invoiceNumber,
        cartSummary,
        allItems,
        user.uid,
        orderData['status'] || 'completed',
        orderData['customerInfo']?.customerId || ''
      );

      console.log('✅ Background operations completed for existing order:', orderId);
    } catch (error) {
      console.error('❌ Error executing background operations for existing order:', error);
      throw error;
    }
  }

  private async executeBackgroundOrderOperations(
    companyId: string,
    storeId: string,
    orderId: string,
    invoiceNumber: string,
    cartSummary: any,
    cartItems: CartItem[],
    userId: string,
    status: string,
    customerId?: string
  ): Promise<{ pending: boolean; reason?: 'offline' | 'failed'; message?: string }> {
    console.log('🔄 Starting background operations for order:', orderId);

    let inventoryPendingOffline = false;
    try {
      inventoryPendingOffline = await this.updateProductInventory(cartItems, { orderId, invoiceNumber, customerId, status });
    } catch (err) {
      const inventoryError = err instanceof Error ? err.message : String(err);
      if (!this.networkService.isOnline()) {
        console.error('Offline inventory sale-line queueing failed:', inventoryError);
        return {
          pending: true,
          reason: 'failed',
          message: `Inventory could not be queued while offline: ${inventoryError}`
        };
      }
      try {
        const orderRef = doc(this.firestore, 'orders', orderId);
        const orderSnapshot = await getDoc(orderRef as any);
        const inventoryAlreadyApplied = orderSnapshot.exists() &&
          (orderSnapshot.data() as any).inventoryStatus === 'applied';
        await setDoc(orderRef as any, {
          ...(inventoryAlreadyApplied ? {} : { inventoryStatus: 'pending' }),
          inventoryLastError: inventoryError,
          inventoryLastAttemptAt: new Date()
        } as any, { merge: true } as any);
      } catch (statusError) {
        console.warn('⚠️ Could not persist pending inventory status:', statusError);
      }
      console.warn('⚠️ Inventory update failed; order requires inventory reconciliation:', inventoryError);
      return { pending: true, reason: 'failed', message: inventoryError };
    }

    if (!this.networkService.isOnline()) {
      console.info('📱 Offline sale lines queued; skipping tracking-completion Firestore queries.');
      return {
        pending: inventoryPendingOffline,
        reason: 'offline',
        message: inventoryPendingOffline
          ? 'Sale saved. Stock-tracked inventory will be processed when the device reconnects.'
          : 'Sale saved offline. This order has no stock-tracked inventory to process.'
      };
    }

    console.log('✅ Sale-line inventory processing finished for order:', orderId);
    return { pending: false };
  }

  async retryInventoryForOrder(orderId: string): Promise<{ success: boolean; errors: string[] }> {
    if (!this.networkService.isOnline()) {
      return { success: false, errors: ['Reconnect to the internet before retrying inventory.'] };
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        this.ordersSellingTrackingService.processPendingInventoryForOrder(orderId),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new Error('Inventory retry timed out after 15 seconds.')),
            this.inventoryProcessingTimeoutMs
          );
        })
      ]);
      return {
        success: result.errors.length === 0,
        errors: result.errors.map(entry => entry.error)
      };
    } catch (error) {
      return { success: false, errors: [error instanceof Error ? error.message : String(error)] };
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }


  /**
   * Mark order tracking as completed
   */
  private async markTrackingCompleted(orderId: string, userId: string): Promise<void> {
    try {
      const trackingPromise = this.ordersSellingTrackingService.markOrderTrackingCompleted(orderId, userId);
      
      if (this.networkService.isOnline()) {
        // Add timeout only when online to prevent indefinite hangs
        const markRes = await Promise.race([
          trackingPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Tracking update timeout')), 10000))
        ]) as any;
        
        if (markRes?.errors?.length) {
          console.warn('⚠️ Some tracking docs failed:', markRes.errors);
        } else {
          console.log(`✅ Marked ${markRes?.updated || 0} tracking docs completed`);
        }
      } else {
        console.log('📱 Offline: Marking tracking (will sync when online)');
        await trackingPromise;
      }
    } catch (error) {
      console.warn('⚠️ Tracking update failed:', error);
      throw error;
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

      const cartItems = this.cartItems().map(item => ({
        ...PosService.normalizeCartItemForStorage(item),
        itemCode: item.itemCode || this.itemCodeService.generateItemCode()
      }));
      if (cartItems.length === 0) {
        throw new Error('Cart is empty');
      }

      console.log('Processing order for store:', storeId);

      const cartSummary = this.cartSummary();
      const orderItems: OrderItem[] = cartItems.map(item => ({
        productId: item.productId,
        itemCode: item.itemCode,
        productName: item.productName,
        quantity: item.quantity,
        price: Number((item.sellingPrice ?? 0).toFixed(2)),
        costPrice: item.costPrice ?? 0,
        total: Number((item.total ?? 0).toFixed(2)),
        vat: Number((item.vatAmount ?? 0).toFixed(2)),
        discount: Number((item.discountAmount ?? 0).toFixed(2)),
        isVatExempt: !!item.isVatExempt
      }));

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
        
        status: 'completed',

        items: orderItems,
        
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
        await this.updateProductInventory(cartItems, { orderId: invoiceResult.orderId!, invoiceNumber: invoiceResult.invoiceNumber!, customerId: customerInfo?.customerId, status: orderData.status });
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
      itemCode: this.itemCodeService.generateItemCode(),
      productCode: product.productCode,
      productName: product.productName,
      skuId: product.skuId,
      unitType: product.unitType,
      quantity,
      // Store final selling price after discounts
      sellingPrice: finalPricePerUnitRounded,
      originalPrice: originalPrice,
      costPrice: product.costPrice ?? 0,
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
      const tags = await this.tagsService.getTagsByStore(storeId, false);
      const tagsMap = new Map<string, string>();
      tags.forEach(tag => {
        tagsMap.set(tag.tagId, tag.label);
      });
      this.productTagsCache.set(tagsMap);
    } catch (error) {
      console.error('❌ Error loading product tags:', error);
    }
  }

  private recalculateCartItem(item: CartItem): CartItem {
    // Recalculate sellingPrice, discountAmount, vatAmount and total based on originalPrice
    const sellingPrice = (item.sellingPrice) as number;
    const vatRate = Number(item.vatRate ?? 0);

    // Per-unit discount
    let discountPerUnit = 0;
    if (item.hasDiscount) {
      if (item.discountType === 'percentage') {
        discountPerUnit = (sellingPrice * (item.discountValue || 0)) / 100;
      } else {
        discountPerUnit = item.discountValue || 0;
      }
    }

    const netBasePerUnit = Math.max(0, sellingPrice - discountPerUnit);
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
    context?: { orderId?: string; invoiceNumber?: string; customerId?: string; status?: string }
  ): Promise<boolean> {
    const mode = environment.inventory?.reconciliationMode || 'legacy';

    if (mode === 'recon' || mode === 'legacy') {
      // Online completed sales deduct FIFO batches now; offline sales stay pending for reconciliation.
      console.log('📊 Tracking sale for inventory processing. Total items:', cartItems.length);
      const user = this.authService.getCurrentUser();
      const company = await this.companyService.getActiveCompany();
      const storeId = this.selectedStoreId();

      if (!user || !company || !storeId) {
        throw new Error('Missing user/company/store for tracking');
      }

      // Resolve isStockTracked for every item in one pass
      const items = await Promise.all(cartItems.map(async ci => {
        let isStockTracked: boolean;
        try {
          isStockTracked = await this.productService.resolveStockTracking(ci.productId);
        } catch (error) {
          throw new Error(`Could not determine stock tracking for ${ci.productName}: ${error instanceof Error ? error.message : String(error)}`);
        }
        if (!isStockTracked) {
          console.log(`⏭️ ${ci.productName} is explicitly untracked; recording the sale without inventory deduction`);
        }
        return {
          productId: ci.productId,
          itemCode: ci.itemCode,
          productName: ci.productName,
          skuId: ci.skuId,
          quantity: ci.quantity,
          unitPrice: ci.sellingPrice,
          lineTotal: ci.total,
          costPrice: ci.costPrice ?? 0,
          discount: ci.discountAmount,
          discountType: ci.discountType,
          vat: ci.vatAmount,
          isVatExempt: ci.isVatExempt,
          tags: ci.tags,
          tagLabels: ci.tagLabels,
          isStockTracked
        };
      }));

      const res = await this.ordersSellingTrackingService.logSaleAndAdjustStock({
        companyId: company.id!,
        storeId,
        orderId: context?.orderId || 'unknown-order',
        status: context?.status || 'completed',
        invoiceNumber: context?.invoiceNumber,
        customerId: context?.customerId,
        cashierId: user.uid,
        cashierEmail: user.email || undefined,
        cashierName: user.displayName || user.email || 'Unknown Cashier'
      }, items);

      if (!res.success) {
        const details = res.errors.map(error => `${error.productId}: ${error.error instanceof Error ? error.error.message : String(error.error)}`).join('; ');
        throw new Error(`Inventory transaction failed: ${details}`);
      }
      return items.some(item => item.isStockTracked);
    }

    // Legacy: client-side FIFO deduction — only process tracked items
    const trackingResults = await Promise.all(cartItems.map(async item => ({
      item,
      isStockTracked: await this.productService.resolveStockTracking(item.productId)
    })));
    const trackedItems = trackingResults
      .filter(result => result.isStockTracked)
      .map(result => result.item);

    if (trackedItems.length === 0) {
      console.log('⏭️ No tracked items to process inventory for');
      if (context?.orderId && context.orderId !== 'unknown-order') {
        await setDoc(doc(this.firestore, 'orders', context.orderId), {
          inventoryStatus: 'applied',
          inventoryProcessedAt: new Date(),
          inventoryLastError: null
        } as any, { merge: true } as any);
      }
      return false;
    }

    // Legacy: client-side FIFO deduction
    console.log('🔄 Starting FIFO inventory deduction for cart items:', trackedItems.length);
    const { InventoryDataService } = await import('./inventory-data.service');
    const inventoryService = this.injector.get(InventoryDataService);
    const inventoryErrors: string[] = [];
    for (const cartItem of trackedItems) {
      try {
        await this.deductInventoryFifo(cartItem.productId, cartItem.quantity, inventoryService, cartItem.itemCode);
        console.log(`✅ Inventory deducted for ${cartItem.productName}: ${cartItem.quantity} units`);
      } catch (error) {
        console.error(`❌ Failed to deduct inventory for ${cartItem.productName}:`, error);
        inventoryErrors.push(`${cartItem.productName}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (inventoryErrors.length > 0) {
      throw new Error(inventoryErrors.join('; '));
    }
    if (context?.orderId && context.orderId !== 'unknown-order') {
      await setDoc(doc(this.firestore, 'orders', context.orderId), {
        inventoryStatus: 'applied',
        inventoryProcessedAt: new Date(),
        inventoryLastError: null
      } as any, { merge: true } as any);
    }
    console.log('✅ FIFO inventory deduction completed for all items');
    return true;
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
  private async deductInventoryFifo(
    productId: string,
    quantityToDeduct: number,
    inventoryService: any,
    itemCode?: string
  ): Promise<void> {
    if (quantityToDeduct <= 0) return;

    console.log(`🔄 FIFO deduction for product ${productId}: ${quantityToDeduct} units`);

    // Build FIFO plan based on current batches
    const batches = await inventoryService.listBatches(productId);
    const activeBatches = batches
      .filter((batch: any) => batch.status === 'active' && batch.quantity > 0)
      .sort((a: any, b: any) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime()); // Oldest first

    if (activeBatches.length === 0) {
      // In offline mode, proceed without FIFO validation - Firestore will validate when synced
      if (!this.networkService.isOnline()) {
        console.log('📱 Offline mode: No batch data available, proceeding with stock deduction only');
        // Just update the product stock without batch-level tracking
        const currentUser = this.authService.getCurrentUser();
        const batch = writeBatch(this.firestore);
        const productRef = doc(this.firestore, 'products', productId);
        
        batch.update(productRef as any, {
          totalStock: increment(-quantityToDeduct),
          lastUpdated: new Date(),
          updatedAt: new Date(),
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
      if (!this.networkService.isOnline()) {
        console.log('📱 Offline mode: proceeding with deduction, will validate when synced');
      } else {
        throw new Error(`Insufficient product totalStock for product ${productId}. Available: ${currentTotal}, Needed: ${quantityToDeduct}`);
      }
    }
  } catch (readError) {
    console.warn('⚠️ Failed to read product for validation:', readError);
    // In offline mode, proceed with deduction - validation will happen when synced
    if (!this.networkService.isOnline()) {
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
      if (!this.networkService.isOnline()) {
        console.log(`📱 Offline mode: proceeding with batch ${p.batchId} update`);
      } else {
        // Online but read failed - skip this batch update
        console.warn(`⚠️ Skipping batch ${p.batchId} update due to read failure`);
        continue;
      }
    }
    
    // Use increment() for atomic offline-compatible deductions
    // Firestore will queue these operations and apply them atomically when online
    batch.update(batchRef as any, {
      quantity: increment(-p.deduct),
      totalDeducted: increment(p.deduct),
      updatedAt: new Date()
      // Note: status update removed - will be handled by cloud functions or manual reconciliation
    });
    
    const newQty = Math.max(0, currentQty - p.deduct);
    
    console.log(`✅ Batch: will update batch ${p.batchId} ${currentQty} -> ${newQty}`);
    
    // Persist a deduction record for audit/querying
    const dedRecord = {
      eventType: 'completed' as const,
      productId,
      itemCode: itemCode || '',
      batchId: p.batchId,
      quantity: p.deduct,
      deductedAt: new Date(),
      note: 'POS FIFO deduction',
      deductedBy: currentUser?.uid || null
    };
    const dedRef = doc(collection(this.firestore, 'inventoryTracking'));
    batch.set(dedRef, dedRecord);
  }
  
  // Update product totalStock using increment() for atomic offline-compatible deduction
  // Firestore offline persistence will queue this and apply atomically when online
  batch.update(productRef as any, {
    totalStock: increment(-quantityToDeduct),
    lastUpdated: new Date(),
    updatedBy: currentUser?.uid || 'system'
  });
  
  const newTotal = Math.max(0, currentTotal - quantityToDeduct);
  
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
    if (!this.networkService.isOnline()) {
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
