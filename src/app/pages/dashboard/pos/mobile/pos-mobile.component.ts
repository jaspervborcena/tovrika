import { Component, OnInit, AfterViewInit, OnDestroy, computed, signal, inject, ViewChild, HostListener } from '@angular/core';
import { Firestore, collection, query, where, getDocs } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { HeaderComponent } from '../../../../shared/components/header/header.component';
import { ReceiptComponent } from '../receipt/receipt.component';
import { CartFabComponent } from '../../../../shared/components/cart-fab/cart-fab.component';
import { MobileCartModalComponent } from '../../../../shared/components/mobile-cart-modal/mobile-cart-modal.component';
import { ConfirmationDialogComponent } from '../../../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { ProductService } from '../../../../services/product.service';
import { PosService } from '../../../../services/pos.service';
import { PosSharedService } from '../../../../services/pos-shared.service';
import { PrintService } from '../../../../services/print.service';
import { TransactionService } from '../../../../services/transaction.service';
import { AuthService } from '../../../../services/auth.service';
import { CompanyService } from '../../../../services/company.service';
import { CustomerService } from '../../../../services/customer.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { NetworkService } from '../../../../core/services/network.service';
import { IndexedDBService } from '../../../../core/services/indexeddb.service';
import { PosUtilsService } from '../../../../services/pos-utils.service';
import { ErrorMessages, WarningMessages } from '../../../../shared/enums';
import { OrderService } from '../../../../services/order.service';
import { StoreService } from '../../../../services/store.service';
import { UserRoleService } from '../../../../services/user-role.service';
import { CurrencyService } from '../../../../services/currency.service';
import { TranslationService } from '../../../../services/translation.service';
import { TranslateModule } from '@ngx-translate/core';
import { Product } from '../../../../interfaces/product.interface';
import { ProductViewType, ReceiptValidityNotice } from '../../../../interfaces/pos.interface';
import { SubscriptionService } from '../../../../services/subscription.service';

@Component({
  selector: 'app-pos-mobile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, HeaderComponent, ReceiptComponent, CartFabComponent, MobileCartModalComponent, TranslateModule],
  templateUrl: './pos-mobile.component.html',
  styleUrls: ['./pos-mobile.component.css']
})
export class PosMobileComponent implements OnInit, AfterViewInit, OnDestroy {
  // Services
  private productService = inject(ProductService);
  private posService = inject(PosService);
  private posSharedService = inject(PosSharedService);
  private printService = inject(PrintService);
  private transactionService = inject(TransactionService);
  private authService = inject(AuthService);
  private companyService = inject(CompanyService);
  private customerService = inject(CustomerService);
  private storeService = inject(StoreService);
  private orderService = inject(OrderService);
  private userRoleService = inject(UserRoleService);
  public currencyService = inject(CurrencyService);
  private toastService = inject(ToastService);
  private networkService = inject(NetworkService);
  private indexedDBService = inject(IndexedDBService);
  private router = inject(Router);
  private posUtilsService = inject(PosUtilsService);
  private translationService = inject(TranslationService);
  private subscriptionService = inject(SubscriptionService);
  private firestore = inject(Firestore);

  private routerSubscription: Subscription | undefined;

  constructor() {
    console.log('🏗️ POS MOBILE COMPONENT: Constructor called - Component is being created!');
    console.log('🏗️ POS MOBILE COMPONENT: Constructor timestamp:', new Date().toISOString());
    
    // Listen for navigation events
    this.routerSubscription = this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        console.log('🔄 Mobile Navigation event detected - URL:', event.url);
        if (event.url === '/pos/mobile') {
          console.log('🎯 Navigation to POS Mobile detected - Reinitializing component');
          // Force reinitialize when navigating to POS Mobile
          setTimeout(() => this.reinitializeComponent(), 100);
        }
      }
    });
  }

  // Use shared UI state for synchronization with desktop
  readonly searchQuery = computed(() => this.posSharedService.searchQuery());
  readonly selectedCategory = computed(() => this.posSharedService.selectedCategory());
  readonly currentView = computed(() => this.posSharedService.currentView());
  
  // Show stores loaded from user roles (already filtered by role-based access)
  readonly availableStores = computed(() => {
    const stores = this.storeService.getStores();
    console.log('🏪 Mobile availableStores computed - Stores from userRoles:', stores.length, 'stores');
    
    if (stores.length === 0) {
      console.warn('⚠️ No stores available from role-based loading');
    } else {
      console.log('🏪 Mobile store details:', stores.map(s => ({ id: s.id, name: s.storeName, companyId: s.companyId })));
    }
    
    return stores;
  });
  
  readonly selectedStoreId = computed(() => this.posService.selectedStoreId());
  readonly cartItems = computed(() => this.posService.cartItems());
  readonly cartSummary = computed(() => this.posService.cartSummary());
  readonly isProcessing = computed(() => this.posService.isProcessing());
  
  readonly products = computed(() => this.productService.getProducts());
  readonly categories = computed(() => this.productService.getCategories());
  
  readonly currentStoreInfo = computed(() => 
    this.availableStores().find(s => s.id === this.selectedStoreId())
  );

  // Invoice preview
  readonly nextInvoiceNumber = signal<string>('Loading...');
  readonly showOfflineInvoiceDialog = signal<boolean>(false);

  // Store availability status
  readonly hasStoreLoadingError = computed(() => {
    const stores = this.availableStores();
    const user = this.authService.getCurrentUser();
    return stores.length === 0 && !!user?.uid;
  });



  readonly filteredProducts = computed(() => {
    let filtered = this.products();

    // Filter by store only (no company filtering needed since products are already loaded by store)
    const storeId = this.selectedStoreId();
    if (storeId) {
      filtered = filtered.filter(p => p.storeId === storeId);
    }

    // Determine active store ids: if a store is selected use that, otherwise use visible stores
    const activeStoreIds = storeId ? [storeId] : this.availableStores().map(s => s.id).filter(Boolean) as string[];
    if (activeStoreIds && activeStoreIds.length) {
      // Include products that belong to the active stores OR have no storeId (global products)
      filtered = filtered.filter(p => !p.storeId || activeStoreIds.includes(p.storeId));
    }

    // Filter by category
    const category = this.selectedCategory();
    if (category !== 'all') {
      filtered = filtered.filter(p => p.category === category);
    }

    // Filter by search query
    const query = this.searchQuery().toLowerCase();
    if (query) {
      filtered = filtered.filter(p =>
        p.productName.toLowerCase().includes(query) ||
        p.skuId.toLowerCase().includes(query) ||
        p.barcodeId?.toLowerCase().includes(query)
      );
    }

    // Sort by newest (createdAt) if present, otherwise keep original
    try {
      filtered = filtered.slice().sort((a, b) => (b.createdAt?.getTime ? b.createdAt.getTime() : 0) - (a.createdAt?.getTime ? a.createdAt.getTime() : 0));
    } catch (e) {
      // ignore sort errors and continue
    }

    // Limit to top 20 when in list or grid view
    const view = this.currentView();
    if (view === 'list' || view === 'grid') {
      return filtered.slice(0, 20);
    }
    return filtered;
  });

  readonly promoProducts = computed(() =>
    this.filteredProducts().filter(p => p.hasDiscount)
  );

  readonly bestSellerProducts = computed(() =>
    this.filteredProducts().slice(0, 10) // TODO: Implement actual best seller logic
  );

  // Template properties
  currentDate = new Date();
  
  // Customer information for order (only customer-specific fields)
  customerInfo = {
    soldTo: '',
    tin: '',
    businessAddress: '',
    customerId: '' // NEW: for existing/new customers
  };

  // Order-level information (moved from customerInfo)
  invoiceNumber: string = 'INV-0000-000000';
  datetime: string = new Date().toISOString().slice(0, 16); // Format for datetime-local input

  // UI State for collapsible panels
  private isSoldToCollapsedSignal = signal<boolean>(true);
  readonly isSoldToCollapsed = computed(() => this.isSoldToCollapsedSignal());
  
  // Navigation collapse state
  private isNavigationCollapsedSignal = signal<boolean>(false);
  readonly isNavigationCollapsed = computed(() => this.isNavigationCollapsedSignal());
  
  // Access tabs for POS management
  readonly accessTabs = ['New', 'Orders', 'Cancelled', 'Refunds & Returns', 'Split Payments', 'Discounts & Promotions'] as const;
  private accessTabSignal = signal<string>('New');
  readonly accessTab = computed(() => this.accessTabSignal());

  // Order search (used when viewing Orders tab)
  private orderSearchSignal = signal<string>('');
  readonly orderSearchQuery = computed(() => this.orderSearchSignal());

  // Orders state - Enhanced for recent orders
  private ordersSignal = signal<any[]>([]);
  private isLoadingOrdersSignal = signal<boolean>(false);
  readonly orders = computed(() => this.ordersSignal());
  readonly isLoadingOrders = computed(() => this.isLoadingOrdersSignal());

  // Order detail modal
  private selectedOrderSignal = signal<any | null>(null);
  readonly selectedOrder = computed(() => this.selectedOrderSignal());

  // Receipt modal state
  private isReceiptModalVisibleSignal = signal<boolean>(false);
  private receiptDataSignal = signal<any>(null);
  readonly isReceiptModalVisible = computed(() => this.isReceiptModalVisibleSignal());
  readonly receiptData = computed(() => this.receiptDataSignal());

  // Discount modal state
  private isDiscountModalVisibleSignal = signal<boolean>(false);
  readonly isDiscountModalVisible = computed(() => this.isDiscountModalVisibleSignal());
  readonly orderDiscount = computed(() => this.posService.orderDiscount());

  // Confirmation dialog state
  private isConfirmationDialogVisibleSignal = signal<boolean>(false);
  private confirmationDialogDataSignal = signal<any>(null);
  readonly isConfirmationDialogVisible = computed(() => this.isConfirmationDialogVisibleSignal());
  readonly confirmationDialogData = computed(() => this.confirmationDialogDataSignal());

  // Sales type state - now supports both cash and charge
  private salesTypeCashSignal = signal<boolean>(true);
  private salesTypeChargeSignal = signal<boolean>(false);
  readonly isCashSale = computed(() => this.salesTypeCashSignal());
  readonly isChargeSale = computed(() => this.salesTypeChargeSignal());

  // Order completion state - track if order is completed to prevent cart editing
  private isOrderCompletedSignal = signal<boolean>(false);
  readonly isOrderCompleted = computed(() => this.isOrderCompletedSignal());

  // New order state - track if new order has been started
  private hasActiveOrderSignal = signal<boolean>(false);
  readonly hasActiveOrder = computed(() => this.hasActiveOrderSignal());

  // Cart modal reference
  @ViewChild('cartModal') cartModal!: MobileCartModalComponent;

  setAccessTab(tab: string): void {
    this.accessTabSignal.set(tab);
    
    // Auto-load recent orders when switching to Orders tab
    if (tab === 'Orders' && this.orders().length === 0) {
      void this.loadRecentOrders();
    }
  }

  setOrderSearchQuery(value: string): void {
    this.orderSearchSignal.set(value);
  }

  async loadRecentOrders(): Promise<void> {
    try {
      this.isLoadingOrdersSignal.set(true);
      const storeInfo = this.currentStoreInfo();
      const companyId = storeInfo?.companyId;
      const storeId = this.selectedStoreId();
      
      if (!companyId) {
        console.warn('No company ID found for loading recent orders');
        return;
      }

      console.log('📅 Loading recent orders for company:', companyId, 'store:', storeId);
      
      // Get orders from today and yesterday (last 48 hours) - top 20
      const results = await this.orderService.getRecentOrders(companyId, storeId || undefined, 20);
      this.ordersSignal.set(results);
      
      console.log('✅ Loaded recent orders:', results.length);
    } catch (error) {
      console.error('❌ Error loading recent orders:', error);
      this.ordersSignal.set([]);
    } finally {
      this.isLoadingOrdersSignal.set(false);
    }
  }

  async searchOrders(): Promise<void> {
    try {
      this.isLoadingOrdersSignal.set(true);
      const storeInfo = this.currentStoreInfo();
      const companyId = storeInfo?.companyId;
      const storeId = this.selectedStoreId();
      const q = this.orderSearchQuery().trim();
      
      if (!companyId) {
        console.warn('No company ID found for order search');
        return;
      }

      if (!q) {
        // If search is empty, load recent orders instead
        await this.loadRecentOrders();
        return;
      }

      console.log('🔍 Searching orders with query:', q);
      
      // Enhanced search - can search by invoice number or order ID
      const results = await this.orderService.searchOrdersEnhanced(companyId, q, storeId || undefined);
      this.ordersSignal.set(results);
      
      console.log('✅ Found orders:', results.length);
    } catch (error) {
      console.error('❌ Error searching orders:', error);
      this.ordersSignal.set([]);
    } finally {
      this.isLoadingOrdersSignal.set(false);
    }
  }

  openOrder(order: any): void {
    this.selectedOrderSignal.set(order);
  }

  closeOrder(): void {
    this.selectedOrderSignal.set(null);
  }

  async updateOrderStatus(orderId: string, status: string): Promise<void> {
    try {
      await this.orderService.updateOrderStatus(orderId, status);
      // refresh orders
      if (this.orderSearchQuery().trim()) {
        await this.searchOrders();
      } else {
        await this.loadRecentOrders();
      }
      this.closeOrder();
    } catch (e) {
      console.error('Failed to update order status', e);
    }
  }

  // Manager auth modal state for mobile (collect userCode + pin)
  private managerAuthVisibleSignal = signal<boolean>(false);
  readonly managerAuthVisible = computed(() => this.managerAuthVisibleSignal());

  managerAuthUserCode = signal<string>('');
  managerAuthPin = signal<string>('');
  // Inline error message for mobile manager auth modal
  managerAuthError = signal<string>('');
  private _managerAuthResolve: ((value: { userCode: string; pin: string } | null) => void) | null = null;

  // Show manager auth dialog and return credentials or null if cancelled
  showManagerAuthDialog(): Promise<{ userCode: string; pin: string } | null> {
    return new Promise((resolve) => {
      console.log('🔐 Mobile showManagerAuthDialog: opening manager auth modal');
      this.managerAuthUserCode.set('');
      this.managerAuthPin.set('');
      this.managerAuthError.set('');
      this._managerAuthResolve = resolve;
      this.managerAuthVisibleSignal.set(true);
    });
  }

  // Called when confirm is pressed
  async onManagerAuthConfirm(): Promise<void> {
    const userCode = (this.managerAuthUserCode() || '').toString();
    const pin = (this.managerAuthPin() || '').toString();
    console.log('🔐 Mobile onManagerAuthConfirm: creds submitted (redacted)', { userCode: userCode ? 'present' : 'empty', pinProvided: !!pin });

    try {
      const isValid = await this.validateManagerCredentials(userCode, pin);
      if (isValid) {
        this.managerAuthVisibleSignal.set(false);
        if (this._managerAuthResolve) {
          this._managerAuthResolve({ userCode, pin });
          this._managerAuthResolve = null;
        }
        return;
      }

      // Show inline error and keep modal open for retry
      this.managerAuthError.set('Invalid manager code or PIN, or manager is not authorized for this store.');
      this.managerAuthPin.set('');

    } catch (err) {
      console.error('Mobile error validating manager credentials', err);
      await this.showConfirmationDialog({
        title: 'Error',
        message: 'An error occurred while validating credentials. Please try again.',
        confirmText: 'OK',
        cancelText: '',
        type: 'danger'
      });
    }
  }

  // Validate manager credentials against Firestore `users` collection (mobile)
  private async validateManagerCredentials(userCode: string, pin: string): Promise<boolean> {
    if (!userCode || !pin) return false;
    try {
      const usersRef = collection(this.firestore, 'users');
      // Detect if the user entered an email (contains @ and .com or .net)
      const lowered = userCode.toLowerCase();
      const isEmail = userCode.includes('@') && (lowered.includes('.com') || lowered.includes('.net'));
      const q = isEmail
        ? query(usersRef, where('email', '==', userCode))
        : query(usersRef, where('userCode', '==', userCode));
      const snap = await getDocs(q);
      if (!snap || snap.empty) return false;

      const currentStore = this.selectedStoreId();

      for (const docSnap of snap.docs) {
        const data: any = docSnap.data();
        if ((data.pin || '').toString() !== pin.toString()) continue;

        if (data.storeId && currentStore && data.storeId === currentStore) return true;
        if (data.permission && data.permission.storeId && currentStore && data.permission.storeId === currentStore) return true;
        if (Array.isArray(data.permissions) && data.permissions.length > 0 && currentStore) {
          const first = data.permissions[0];
          if (first && first.storeId && first.storeId === currentStore) return true;
        }

        if (!currentStore) return true;
      }

      return false;
    } catch (e) {
      console.error('Mobile error querying users for manager auth', e);
      return false;
    }
  }

  // Called when cancel is pressed
  onManagerAuthCancel(): void {
    console.log('🔐 Mobile onManagerAuthCancel: manager auth cancelled by user');
    this.managerAuthVisibleSignal.set(false);
    this.managerAuthError.set('');
    if (this._managerAuthResolve) {
      this._managerAuthResolve(null);
      this._managerAuthResolve = null;
    }
  }

  // Require manager auth before updating an order status
  async authorizeAndUpdateOrderStatus(orderId: string, status: string): Promise<void> {
    const creds = await this.showManagerAuthDialog();
    if (!creds) return;
    // TODO: validate creds server-side
    await this.updateOrderStatus(orderId, status);
  }

  // Require manager auth before opening return/damage flows on mobile
  async openReturnModeAuthorized(): Promise<void> {
    const creds = await this.showManagerAuthDialog();
    if (!creds) return;
    // Mobile: show informational stub for return workflow
    window.alert('Return flow is not implemented on mobile; please use desktop for detailed returns.');
  }

  async openDamageModeAuthorized(): Promise<void> {
    const creds = await this.showManagerAuthDialog();
    if (!creds) return;
    // Mobile: show informational stub for damage workflow
    window.alert('Damage reporting is not implemented on mobile; please use desktop for detailed reporting.');
  }

  // Refresh orders - manually triggered by user
  async refreshOrders(): Promise<void> {
    try {
      console.log('🔄 Mobile Manual refresh triggered...');
      
      // Clear current orders first to show loading state
      this.ordersSignal.set([]);
      
      // If there's a search query, search again, otherwise load recent orders
      const searchQuery = this.orderSearchQuery().trim();
      if (searchQuery) {
        console.log('🔍 Mobile Refreshing search results for query:', searchQuery);
        await this.searchOrders();
      } else {
        console.log('📋 Mobile Refreshing recent orders...');
        await this.loadRecentOrders();
      }
      
      console.log('✅ Mobile Manual refresh completed');
    } catch (error) {
      console.error('❌ Mobile Error during manual refresh:', error);
    }
  }

  // Handle empty stores scenario with fallback recovery
  private handleEmptyStores(): void {
    console.log('🔧 Mobile Attempting to recover from empty stores...');
    
    // Debounce multiple calls to avoid infinite loops
    if ((this as any)._emptyStoresRecoveryInProgress) {
      console.log('🔧 Mobile Store recovery already in progress, skipping...');
      return;
    }
    
    (this as any)._emptyStoresRecoveryInProgress = true;
    
    // Try recovery after a short delay
    setTimeout(async () => {
      try {
        console.log('🔄 Mobile Initiating store recovery process...');
        
        const currentUser = this.authService.getCurrentUser();
        if (!currentUser?.uid) {
          console.error('❌ Mobile No authenticated user for store recovery');
          return;
        }
        
        // Try IndexedDB first as most reliable source
        const offlineUserData = await this.indexedDBService.getUserData(currentUser.uid);
        if (offlineUserData?.permissions && offlineUserData.permissions.length > 0) {
          console.log('💾 Mobile Found IndexedDB permissions, attempting store recovery...');
          
          const permission = this.getActivePermission(offlineUserData);
          if (permission?.storeId) {
            console.log('🔄 Mobile Reloading store from IndexedDB permission:', permission.storeId);
            await this.storeService.loadStores([permission.storeId]);
            
            // Verify recovery worked
            setTimeout(() => {
              const recoveredStores = this.storeService.getStores();
              console.log('✅ Mobile Store recovery result:', recoveredStores.length, 'stores recovered');
              (this as any)._emptyStoresRecoveryInProgress = false;
            }, 500);
            return;
          }
        }
        
        // Fallback to user roles loading
        console.log('🗄️ Mobile Fallback: Attempting user roles loading...');
        await this.userRoleService.loadUserRoles();
        const userRole = this.userRoleService.getUserRoleByUserId(currentUser.uid);
        
        if (userRole?.storeId) {
          console.log('🔄 Mobile Reloading store from user role:', userRole.storeId);
          await this.storeService.loadStores([userRole.storeId]);
        } else if (userRole?.companyId) {
          console.log('🔄 Mobile Reloading all company stores from user role:', userRole.companyId);
          await this.storeService.loadStoresByCompany(userRole.companyId);
        }
        
      } catch (error) {
        console.error('❌ Mobile Store recovery failed:', error);
      } finally {
        (this as any)._emptyStoresRecoveryInProgress = false;
      }
    }, 1000); // 1 second delay to avoid rapid retries
  }

  // Manual refresh stores - for user-triggered recovery
  async refreshStores(): Promise<void> {
    try {
      console.log('🔄 Mobile Manual store refresh initiated...');
      
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser?.uid) {
        console.error('❌ Mobile No authenticated user for manual store refresh');
        return;
      }
      
      // Show loading state
      console.log('⏳ Mobile Refreshing stores...');
      
      // Try multiple recovery methods
      let recovered = false;
      
      // Method 1: IndexedDB
      try {
        const offlineUserData = await this.indexedDBService.getUserData(currentUser.uid);
        if (offlineUserData?.permissions && offlineUserData.permissions.length > 0) {
          const permission = this.getActivePermission(offlineUserData);
          if (permission?.storeId) {
            await this.storeService.loadStores([permission.storeId]);
            recovered = true;
            console.log('✅ Mobile Stores recovered via IndexedDB method');
          }
        }
      } catch (error) {
        console.log('⚠️ Mobile IndexedDB recovery method failed:', error);
      }
      
      // Method 2: User roles
      if (!recovered) {
        try {
          await this.userRoleService.loadUserRoles();
          const userRole = this.userRoleService.getUserRoleByUserId(currentUser.uid);
          
          if (userRole?.storeId) {
            await this.storeService.loadStores([userRole.storeId]);
            recovered = true;
            console.log('✅ Mobile Stores recovered via user roles method');
          } else if (userRole?.companyId) {
            await this.storeService.loadStoresByCompany(userRole.companyId);
            recovered = true;
            console.log('✅ Mobile Stores recovered via company loading method');
          }
        } catch (error) {
          console.log('⚠️ Mobile User roles recovery method failed:', error);
        }
      }
      
      // Verify recovery
      setTimeout(() => {
        const stores = this.availableStores();
        if (stores.length > 0) {
          console.log('🎉 Mobile Store refresh successful! Recovered', stores.length, 'stores');
        } else {
          console.error('❌ Mobile Store refresh failed - still no stores available');
        }
      }, 500);
      
    } catch (error) {
      console.error('❌ Mobile Manual store refresh failed:', error);
    }
  }

  // (Removed debug-only createTestOrder method)

  // Process individual item actions (return, damage, refund, cancel)
  async processItemAction(orderId: string, itemIndex: number, action: string, item: any): Promise<void> {
    try {
      console.log(`Mobile Processing ${action} for item:`, { orderId, itemIndex, action, item });
      
      const confirmed = await this.showConfirmationDialog({
        title: `${action.charAt(0).toUpperCase() + action.slice(1)} Item`,
        message: `Are you sure you want to ${action} "${item.name || item.productName}"?`,
        confirmText: `Yes, ${action.charAt(0).toUpperCase() + action.slice(1)}`,
        cancelText: 'Cancel',
        type: action === 'cancel' || action === 'damage' ? 'warning' : 'info'
      });

      if (confirmed) {
        // Here you can implement the specific logic for each action
        switch (action) {
          case 'return':
            console.log('Mobile Processing return for item:', item);
            // TODO: Implement return logic
            break;
          case 'damage':
            console.log('Mobile Processing damage for item:', item);
            // TODO: Implement damage reporting logic
            break;
          case 'refund':
            console.log('Mobile Processing refund for item:', item);
            // TODO: Implement refund logic
            break;
          case 'cancel':
            console.log('Mobile Processing cancellation for item:', item);
            // TODO: Implement item cancellation logic
            break;
        }
        
        // Show success message
        await this.showConfirmationDialog({
          title: 'Success',
          message: `Item ${action} has been processed successfully.`,
          confirmText: 'OK',
          cancelText: '',
          type: 'info'
        });
        
        // Refresh the orders list
        await this.refreshOrders();
      }
    } catch (error) {
      console.error(`Mobile Error processing ${action} for item:`, error);
      await this.showConfirmationDialog({
        title: 'Error',
        message: `Failed to process ${action}. Please try again.`,
        confirmText: 'OK',
        cancelText: '',
        type: 'danger'
      });
    }
  }

  // Open a mobile-friendly entry point for Return actions
  async openReturnMode(): Promise<void> {
    await this.showConfirmationDialog({
      title: 'Return',
      message: 'Return flow is available via per-item actions on mobile. Open Manage Item Status on desktop for bulk operations.',
      confirmText: 'OK',
      cancelText: '',
      type: 'info'
    });
  }

  // Open a mobile-friendly entry point for Damage actions
  async openDamageMode(): Promise<void> {
    await this.showConfirmationDialog({
      title: 'Damage',
      message: 'Damage reporting is available via per-item actions on mobile. Open Manage Item Status on desktop for bulk operations.',
      confirmText: 'OK',
      cancelText: '',
      type: 'info'
    });
  }

  // Open order receipt for viewing/printing
  async openOrderReceipt(order: any): Promise<void> {
    try {
      console.log('Mobile Opening receipt for order:', order);
      
      // Convert order data to receipt format (now async for company data)
      const receiptData = await this.convertOrderToReceiptData(order);
      
      // Set receipt data and show modal
      this.receiptDataSignal.set(receiptData);
      this.isReceiptModalVisibleSignal.set(true);
      
      // Close the order details modal
      this.closeOrder();
    } catch (error) {
      console.error('Mobile Error opening order receipt:', error);
    }
  }

  // Convert order data to receipt format - matches prepareReceiptData format
  private async convertOrderToReceiptData(order: any): Promise<any> {
    const storeInfo = this.currentStoreInfo();
    
    // Get company information for consistent display
    let company = null;
    try {
      company = await this.companyService.getActiveCompany();
    } catch (error) {
      console.warn('Mobile Could not fetch company info for order receipt:', error);
    }

    // Determine customer name - consistent with prepareReceiptData
    const customerName = order.soldTo && order.soldTo.trim() && order.soldTo !== 'Walk-in Customer' 
      ? order.soldTo.trim() 
      : null;

    // Resolve cashier name from order data
    let cashierName = 'Unknown Cashier';
    
    // Check if this order was created by the current user
    const currentUser = this.authService.getCurrentUser();
    const isCurrentUserOrder = currentUser && currentUser.uid === order.assignedCashierId;
    
    if (isCurrentUserOrder) {
      // If current user is viewing their own order, always use their current info
      // This handles cases where managers/higher roles are doing POS transactions
      cashierName = currentUser.displayName || currentUser.email || 'Current User';
    } else {
      // For orders by other users, try to resolve the cashier name
      // Priority 1: Use stored cashier name if available (for new orders)
      if (order.assignedCashierName && order.assignedCashierName !== order.assignedCashierId) {
        cashierName = order.assignedCashierName;
      } 
      // Priority 2: Use stored cashier email if available (for new orders)
      else if (order.assignedCashierEmail) {
        cashierName = order.assignedCashierEmail;
      }
      // Priority 3: Legacy support - try to resolve from user ID (for old orders)
      else if (order.assignedCashierId) {
        try {
          // For other users, try to get user role information
          const userRole = this.userRoleService.getUserRoleByUserId(order.assignedCashierId);
          if (userRole?.email) {
            cashierName = userRole.email;
          } else {
            // Try to get user info from IndexedDB as last resort
            try {
              const userData = await this.indexedDBService.getUserData(order.assignedCashierId);
              cashierName = userData?.email || `Cashier ${order.assignedCashierId.slice(0, 8)}...`;
            } catch {
              cashierName = `Cashier ${order.assignedCashierId.slice(0, 8)}...`;
            }
          }
        } catch (error) {
          console.warn('Mobile Could not resolve cashier name for user ID:', order.assignedCashierId, error);
          cashierName = `Cashier ${order.assignedCashierId?.slice(0, 8)}...`;
        }
      }
    }

    return {
      orderId: order.id,
      invoiceNumber: order.invoiceNumber,
      receiptDate: order.date || order.createdAt,
      storeInfo: {
        storeName: company?.name || (storeInfo as any)?.storeName || 'Unknown Store',
        address: (storeInfo as any)?.address || 'Store Address',
        phone: (storeInfo as any)?.phoneNumber || (storeInfo as any)?.phone || 'N/A',
        email: company?.email || storeInfo?.email || 'N/A', // Use company email
        tin: (storeInfo as any)?.tinNumber || 'N/A', // Use store TIN
        invoiceType: (storeInfo as any)?.invoiceType || 'SALES INVOICE',
        birPermitNo: (storeInfo as any)?.birPermitNo || null,
        minNumber: (storeInfo as any)?.minNumber || null,
        serialNumber: (storeInfo as any)?.serialNumber || null,
        inclusiveSerialNumber: (storeInfo as any)?.inclusiveSerialNumber || null
      },
      customerName: customerName,
      customerAddress: customerName ? (order.businessAddress || 'N/A') : null,
      customerTin: customerName ? (order.tin || 'N/A') : null,
      cashier: cashierName,
      paymentMethod: order.cashSale ? 'Cash' : 'Charge',
      isCashSale: order.cashSale || true,
      isChargeSale: !order.cashSale || false,
      items: (order.items || []).map((item: any) => ({
        productName: item.productName || item.name,
        skuId: item.skuId || item.sku,
        quantity: item.quantity || 1,
        unitType: item.unitType || 'pc',
        sellingPrice: item.sellingPrice || item.price || item.amount,
        total: item.total || (item.quantity * (item.sellingPrice || item.price || item.amount)),
        vatAmount: item.vatAmount || 0,
        discountAmount: item.discountAmount || 0
      })),
      subtotal: order.grossAmount || order.subtotal || order.totalAmount,
      vatAmount: order.vatAmount || 0,
      vatExempt: order.vatExemptAmount || 0,
      discount: order.discountAmount || 0,
      totalAmount: order.totalAmount || order.netAmount,
      vatRate: 12,
      // Validity notice based on store BIR accreditation
      validityNotice: (storeInfo as any)?.isBirAccredited 
        ? ReceiptValidityNotice.BIR_ACCREDITED 
        : ReceiptValidityNotice.NON_ACCREDITED,
      // Enhanced order discount handling - check for both exemptionId and full discount object
      orderDiscount: order.orderDiscount || (order.exemptionId ? {
        type: 'CUSTOM',
        exemptionId: order.exemptionId,
        customerName: order.discountCustomerName || customerName
      } : null)
    };
  }

  // Confirmation dialog methods
  async showConfirmationDialog(data: {
    title: string;
    message: string;
    confirmText: string;
    cancelText?: string;
    type?: 'info' | 'warning' | 'danger';
  }): Promise<boolean> {
    return new Promise((resolve) => {
      this.confirmationDialogDataSignal.set({
        ...data,
        onConfirm: () => {
          this.isConfirmationDialogVisibleSignal.set(false);
          resolve(true);
        },
        onCancel: () => {
          this.isConfirmationDialogVisibleSignal.set(false);
          resolve(false);
        }
      });
      this.isConfirmationDialogVisibleSignal.set(true);
    });
  }

  closeConfirmationDialog(): void {
    this.isConfirmationDialogVisibleSignal.set(false);
    this.confirmationDialogDataSignal.set(null);
  }

  toggleCashSale(): void {
    this.salesTypeCashSignal.update(value => !value);
  }

  toggleChargeSale(): void {
    this.salesTypeChargeSignal.update(value => !value);
  }

  // Get user-friendly error message for store loading issues
  getStoreLoadingErrorMessage(): string | null {
    if (!this.hasStoreLoadingError()) {
      return null;
    }
    
    const user = this.authService.getCurrentUser();
    if (!user) {
      return 'Please log in to access stores';
    }
    
    return 'No stores available. This may be due to:\n' +
           '• Network connectivity issues\n' +
           '• User permission problems\n' +
           '• Store configuration issues\n\n' +
           'Please try refreshing or contact your administrator.';
  }

  // Check if the system is ready for POS operations
  isSystemReady(): boolean {
    return this.availableStores().length > 0 && 
           this.products().length > 0 && 
           !!this.selectedStoreId();
  }



  // F4 Hotkey for Clear Data
  @HostListener('document:keydown.f4', ['$event'])
  async onF4KeyPress(event: Event | KeyboardEvent): Promise<void> {
    event.preventDefault(); // Prevent default F4 behavior
    
    if (this.cartItems().length > 0) {
      await this.clearCartWithConfirmation();
    }
  }

  // F5 Hotkey for New Order
  @HostListener('document:keydown.f5', ['$event'])
  async onF5KeyPress(event: Event | KeyboardEvent): Promise<void> {
    event.preventDefault(); // Prevent page refresh
    // Subscription gate
    const canStart = await this.checkSubscriptionGate();
    if (!canStart) return;

    const confirmed = await this.showConfirmationDialog({
      title: 'Create New Order',
      message: 'Would you like to create a new order?',
      confirmText: 'Yes',
      cancelText: 'No',
      type: 'info'
    });
    
    if (confirmed) {
      await this.startNewOrderDirect();
    }
  }

  // F6 Hotkey for Complete Order
  @HostListener('document:keydown.f6', ['$event'])
  async onF6KeyPress(event: Event | KeyboardEvent): Promise<void> {
    event.preventDefault(); // Prevent default F6 behavior
    
    if (this.cartItems().length > 0 && !this.isProcessing()) {
      const confirmed = await this.showConfirmationDialog({
        title: 'Complete Order',
        message: 'Are you sure you want to complete this order?',
        confirmText: 'Yes',
        cancelText: 'No',
        type: 'info'
      });
      
      if (confirmed) {
        await this.processOrder();
      }
    }
  }

  // Simple state checks - like desktop
  canClearCart(): boolean {
    return this.cartItems().length > 0;
  }

  // Simple new order - like desktop
  async startNewOrderDirect(): Promise<void> {
    // Subscription gate
    const allowed = await this.checkSubscriptionGate();
    if (!allowed) return;
    console.log('🆕 Mobile Starting new order via FAB');
    
    // If there's already an active order or completed order, confirm before clearing
    if (this.hasActiveOrder() || this.isOrderCompleted()) {
      const confirmed = await this.showConfirmationDialog({
        title: 'Start New Order',
        message: 'This will clear your current cart and start fresh. Continue?',
        confirmText: 'Start New',
        cancelText: 'Cancel',
        type: 'warning'
      });
      
      if (!confirmed) return;
    }
    
    // Clear cart and reset customer info
    this.posService.clearCart();
    
    // Reset order completion status to allow cart editing
    this.isOrderCompletedSignal.set(false);
    
    // Set active order state
    this.hasActiveOrderSignal.set(true);
    
    this.customerInfo = {
      soldTo: '',
      tin: '',
      businessAddress: '',
      customerId: ''
    };
    
    // Update date/time to current
    this.updateCurrentDateTime();
    
    console.log('🆕 Mobile New order started via FAB');
  }

  /**
   * Check store subscription/status before allowing new orders (mobile)
   */
  private async checkSubscriptionGate(): Promise<boolean> {
    try {
      const store = this.currentStoreInfo();
      if (!store) {
        await this.showConfirmationDialog({
          title: 'No Store Selected',
          message: 'Please select a store before creating a new order.',
          confirmText: 'OK',
          cancelText: ''
        });
        return false;
      }

      if ((store.status || 'inactive') !== 'active') {
        await this.showConfirmationDialog({
          title: 'Store Inactive',
          message: 'Unable to create new order because this store is inactive. Please activate your subscription for this store.',
          confirmText: 'OK',
          cancelText: '',
          type: 'warning'
        });
        return false;
      }

      let endDate: Date | null | undefined = store.subscriptionEndDate as any;
      if (!endDate && store.companyId && store.id) {
        try {
          const latest = await this.subscriptionService.getSubscriptionForStore(store.companyId, store.id);
          endDate = latest?.data.endDate as any;
        } catch {}
      }
      const now = new Date();
      if (!endDate || (endDate instanceof Date && endDate.getTime() < now.getTime())) {
        const when = endDate instanceof Date ? endDate.toLocaleDateString() : 'unavailable';
        await this.showConfirmationDialog({
          title: 'Subscription Required',
          message: `Unable to create new order due to subscription expiration (expiry: ${when}). Please renew or upgrade your subscription to continue.`,
          confirmText: 'OK',
          cancelText: '',
          type: 'warning'
        });
        return false;
      }
      return true;
    } catch {
      await this.showConfirmationDialog({
        title: 'Subscription Check Failed',
        message: 'We could not verify your subscription status. Please try again shortly.',
        confirmText: 'OK',
        cancelText: ''
      });
      return false;
    }
  }

  // Enhanced clear cart with confirmation
  async clearCartWithConfirmation(): Promise<void> {
    if (confirm('Are you sure you want to clear the cart?')) {
      this.posService.clearCart();
      // Reset active order state when cart is cleared
      this.hasActiveOrderSignal.set(false);
    }
  }







  // Process customer information based on form state (for new order structure)
  private processCustomerInfo(): any {
    const soldToField = this.customerInfo.soldTo?.trim();
    const addressField = this.customerInfo.businessAddress?.trim();
    const tinField = this.customerInfo.tin?.trim();
    
    return {
      fullName: soldToField || "Walk-in Customer",
      address: addressField || "Philippines", 
      tin: tinField || "",
      customerId: this.customerInfo.customerId || ""
    };
  }

  // Enhanced prepare receipt data with company integration
  private async prepareReceiptDataEnhanced(orderId: string): Promise<any> {
    const cartItems = this.cartItems();
    const cartSummary = this.cartSummary();
    const storeInfo = this.currentStoreInfo();
    
    // Get company information for consistent display
    let company = null;
    try {
      company = await this.companyService.getActiveCompany();
    } catch (error) {
      console.warn('Mobile Could not fetch company info for receipt:', error);
    }

    // Determine customer name - if soldTo is empty or default, treat as N/A
    const customerName = this.customerInfo.soldTo && this.customerInfo.soldTo.trim() && this.customerInfo.soldTo !== 'Walk-in Customer' 
      ? this.customerInfo.soldTo.trim() 
      : null;

    // Always use current user as cashier since they are operating the POS
    // This handles managers and other roles who use the POS system
    const currentUser = this.authService.getCurrentUser();
    const cashierName = currentUser?.displayName || currentUser?.email || 'Unknown Cashier';

    return {
      orderId,
      invoiceNumber: this.nextInvoiceNumber(),
      receiptDate: new Date(),
      storeInfo: {
        storeName: company?.name || (storeInfo as any)?.storeName || 'Unknown Store',
        address: (storeInfo as any)?.address || 'Store Address',
        phone: (storeInfo as any)?.phoneNumber || (storeInfo as any)?.phone || 'N/A',
        email: company?.email || storeInfo?.email || 'N/A', // Use company email
        tin: (storeInfo as any)?.tinNumber || 'N/A', // Use store TIN
        invoiceType: (storeInfo as any)?.invoiceType || 'SALES INVOICE',
        birPermitNo: (storeInfo as any)?.birPermitNo || null,
        minNumber: (storeInfo as any)?.minNumber || null,
        serialNumber: (storeInfo as any)?.serialNumber || null,
        inclusiveSerialNumber: (storeInfo as any)?.inclusiveSerialNumber || null
      },
      customerName: customerName,
      customerAddress: customerName ? (this.customerInfo.businessAddress || 'N/A') : null,
      customerTin: customerName ? (this.customerInfo.tin || 'N/A') : null,
      cashier: cashierName, // Always use current user as cashier regardless of role
      paymentMethod: this.isCashSale() ? 'Cash' : 'Charge',
      isCashSale: this.isCashSale(),
      isChargeSale: this.isChargeSale(),
      items: cartItems.map(item => ({
        productName: item.productName,
        skuId: item.skuId,
        quantity: item.quantity,
        unitType: item.unitType || 'pc',
        sellingPrice: item.sellingPrice,
        total: item.total,
        vatAmount: item.vatAmount || 0,
        discountAmount: item.discountAmount || 0
      })),
      subtotal: cartSummary.grossAmount,
      vatAmount: cartSummary.vatAmount,
      vatExempt: cartSummary.vatExemptSales,
      discount: cartSummary.productDiscountAmount + cartSummary.orderDiscountAmount,
      totalAmount: cartSummary.netAmount,
      vatRate: 12,
      // Validity notice based on store BIR accreditation
      validityNotice: (storeInfo as any)?.isBirAccredited 
        ? ReceiptValidityNotice.BIR_ACCREDITED 
        : ReceiptValidityNotice.NON_ACCREDITED,
      // Enhanced order discount handling
      orderDiscount: this.orderDiscount()
    };
  }

  // Save customer data if provided
  async saveCustomerData(): Promise<any> {
    try {
      const customerName = this.customerInfo.soldTo?.trim();
      
      // Only save if customer name is provided and not default
      if (!customerName || customerName === 'Walk-in Customer') {
        return null;
      }

      const currentUser = this.authService.getCurrentUser();
      const currentPermission = this.authService.getCurrentPermission();
      const storeInfo = this.currentStoreInfo();
      
      if (!currentUser?.uid || !currentPermission?.companyId || !storeInfo?.id) {
        console.warn('Mobile Missing required info for customer save:', {
          hasUser: !!currentUser?.uid,
          hasCompany: !!currentPermission?.companyId,
          hasStore: !!storeInfo?.id
        });
        return null;
      }

      // Prepare customer data
      const customerData = {
        fullName: customerName,
        email: '', // Not captured in mobile form
        phone: '', // Not captured in mobile form
        address: this.customerInfo.businessAddress?.trim() || '',
        tin: this.customerInfo.tin?.trim() || '',
        companyId: currentPermission.companyId,
        storeId: storeInfo.id,
        createdBy: currentUser.uid,
        isActive: true
      };

      console.log('💾 Mobile Saving customer data:', customerData);
      const savedCustomer = await this.customerService.saveCustomerFromPOS(
        {
          soldTo: customerName,
          tin: this.customerInfo.tin?.trim() || '',
          businessAddress: this.customerInfo.businessAddress?.trim() || ''
        },
        currentPermission.companyId,
        storeInfo.id
      );
      console.log('✅ Mobile Customer saved:', savedCustomer);
      
      // Update the customerInfo with the saved customer ID for future reference
      if (savedCustomer) {
        this.customerInfo.customerId = savedCustomer.customerId;
      }
      
      return savedCustomer;
    } catch (error) {
      console.error('❌ Mobile Error saving customer data:', error);
      return null; // Don't fail the entire order process if customer save fails
    }
  }

  async ngOnInit(): Promise<void> {
    console.log('🎯 POS MOBILE COMPONENT: ngOnInit called - POS Mobile is loading!');
    console.log('🎯 POS MOBILE COMPONENT: Current URL:', window.location.href);
    console.log('🎯 POS MOBILE COMPONENT: Timestamp:', new Date().toISOString());
    try {
      // await this.loadData(); // Commented out to match desktop POS behavior
      // Set current date and time
      this.updateCurrentDateTime();
      
      // Load next invoice number preview
      await this.loadNextInvoicePreview();
      
      // Initialize store (this will handle IndexedDB priority and product loading)
      await this.initializeStore();
      
      // Debug: log current user and stores to ensure user.storeIds and stores list are correct
      console.log('POS Mobile init - currentUser:', this.authService.getCurrentUser());
      console.log('POS Mobile init - all stores:', this.storeService.getStores());
      console.log('POS Mobile init - availableStores:', this.availableStores());
      
      // Initialize active order state based on existing cart
      this.initializeOrderState();
    } catch (error) {
      console.error('Error initializing POS Mobile:', error);
    }
  }

  // Initialize order state based on current situation
  private initializeOrderState(): void {
    const cartItems = this.posService.cartItems();
    
    // If there are items in cart, assume there's an active or completed order
    if (cartItems && cartItems.length > 0) {
      // Check if this is a completed order by checking some completion indicator
      // For now, assume if cart exists but no active order, it's completed
      this.hasActiveOrderSignal.set(false);
      this.isOrderCompletedSignal.set(true);
      console.log('🔄 Found existing completed order - cart disabled');
    } else {
      // No items, fresh start
      this.hasActiveOrderSignal.set(false);
      this.isOrderCompletedSignal.set(false);
      console.log('🔄 Order state initialized - waiting for user to start new order');
    }
  }

  private async loadData(): Promise<void> {
    console.log('🔄 Starting loadData...');
    
    // Load user roles to get store access permissions
    const user = this.authService.getCurrentUser();
    console.log('👤 User in loadData:', user ? { uid: user.uid } : 'null');
    
    if (user?.uid) {
      try {
        // Load user roles first to get store access permissions
        await this.userRoleService.loadUserRoles();
        
        // Get the current user's role by userId
        const userRole = this.userRoleService.getUserRoleByUserId(user.uid);
        
        // Debug logging as requested
        console.log('userRoles in mobile pos:', userRole);
        console.log('user.uid:', user.uid);
        
        if (userRole && userRole.storeId) {
          // Load companies first
          console.log('📊 Loading companies...');
          await this.companyService.loadCompanies();
          console.log('✅ Companies loaded');
          
          // Load stores based on user's assigned store
          console.log('🏪 Loading store for user role:', userRole.storeId);
          await this.storeService.loadStores([userRole.storeId]);
          console.log('✅ Stores loaded, available stores count:', this.availableStores().length);
          
          // Wait a bit for signals to update
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Initialize selected store now that stores are loaded
          console.log('🎯 Initializing store selection...');
          await this.initializeStore();
          
          // Load products for the user's company and current selected store (if any)
          const selectedStore = this.selectedStoreId();
          console.log('📦 Loading products for company:', userRole.companyId, 'store:', selectedStore);
          await this.productService.loadProductsByCompanyAndStore(userRole.companyId, selectedStore);
          
          console.log('✅ LoadData completed successfully');
          
          // Final check - log stores one more time
          setTimeout(() => {
            console.log('🔍 Final stores check after 1s:', this.availableStores().length, 'stores');
            console.log('🔍 Store service stores:', this.storeService.getStores().length, 'stores');
          }, 1000);
        } else {
          console.warn('No user role found or no store assigned to user');
        }
        
      } catch (error) {
        console.error('❌ Error during data loading:', error);
        throw error;
      }
    } else {
      console.warn('⚠️ No companyId found, skipping data loading');
    }
  }

  private async initializeStore(): Promise<void> {
    console.log('🎯 Mobile initializeStore called - checking stores and loading if needed');
    
    // First, ensure stores are loaded by checking if we have any stores
    const currentUser = this.authService.getCurrentUser();
    let availableStores = this.availableStores();
    
    if (availableStores.length === 0 && currentUser?.uid) {
      console.log('🏪 Mobile No stores available, loading from database...');
      
      try {
        // Load user roles first to get store access permissions
        await this.userRoleService.loadUserRoles();
        
        // Get the current user's role by userId
        const userRole = this.userRoleService.getUserRoleByUserId(currentUser.uid);
        console.log('👤 Mobile User role loaded:', userRole);
        
        if (userRole && userRole.storeId) {
          // Load companies first
          console.log('📊 Mobile Loading companies...');
          await this.companyService.loadCompanies();
          
          // Load stores based on user's assigned store
          console.log('🏪 Mobile Loading stores for user role:', userRole.storeId);
          await this.storeService.loadStores([userRole.storeId]);
          
          // Wait a bit for signals to update
          await new Promise(resolve => setTimeout(resolve, 100));
          
          console.log('✅ Mobile Stores loaded, refreshing available stores...');
          
          // Load products for the user's company and store after loading stores
          const refreshedStores = this.availableStores();
          console.log('📦 Mobile Loading products after store loading, available stores:', refreshedStores.length);
          
          if (refreshedStores.length > 0 && userRole.companyId) {
            // Auto-select the loaded store and load products
            const storeToLoad = refreshedStores.find(s => s.id === userRole.storeId) || refreshedStores[0];
            if (storeToLoad?.id) {
              console.log('📦 Mobile Auto-loading products for store:', storeToLoad.storeName, 'company:', userRole.companyId);
              await this.productService.loadProductsByCompanyAndStore(userRole.companyId, storeToLoad.id);
              console.log('✅ Mobile Initial product loading completed');
            }
          }
        } else {
          console.warn('⚠️ Mobile No user role or store ID found');
          return;
        }
      } catch (error) {
        console.error('❌ Mobile Error loading stores:', error);
        return;
      }
    } else {
      console.log('✅ Mobile Stores already available, count:', availableStores.length);
    }

    // PRIORITY: Use IndexedDB as primary source for all user data (uid, companyId, storeId, roleId)
    try {
      const offlineUserData = await this.indexedDBService.getUserData(currentUser?.uid || '');
      
      if (offlineUserData?.currentStoreId) {
        console.log('💾 PRIORITY: Mobile using IndexedDB data - uid:', offlineUserData.uid, 'storeId:', offlineUserData.currentStoreId);
        
        // Verify the store exists in availableStores before selecting
        availableStores = this.availableStores(); // Refresh after potential loading
        const storeExists = availableStores.find(store => store.id === offlineUserData.currentStoreId);
        
        if (storeExists) {
          console.log('✅ Mobile IndexedDB store verified, selecting store');
          await this.selectStore(offlineUserData.currentStoreId);
          console.log('✅ Mobile Store selection from IndexedDB completed');
          return; // Success - exit early
        } else {
          console.warn('⚠️ Mobile IndexedDB store not found in available stores');
          console.log('� Mobile Available stores:', availableStores.map(s => ({ id: s.id, name: s.storeName })));
        }
      }
      
      // If no currentStoreId, try to get from permissions in IndexedDB
      if (offlineUserData?.permissions && offlineUserData.permissions.length > 0) {
        const permission = this.getActivePermission(offlineUserData);
        if (permission?.storeId) {
          console.log('💾 Mobile Using storeId from IndexedDB permissions:', permission.storeId);
          availableStores = this.availableStores(); // Refresh after potential loading
          const storeExists = availableStores.find(store => store.id === permission.storeId);
          
          if (storeExists) {
            await this.selectStore(permission.storeId);
            console.log('✅ Mobile Store selection from IndexedDB permissions completed');
            return;
          }
        }
      }
    } catch (error) {
      console.log('⚠️ Mobile Could not retrieve userData from IndexedDB:', error);
    }

    // FALLBACK: Use current database process
    // Wait for stores to be available with retries
    let retryCount = 0;
    const maxRetries = 10;
    const retryDelay = 500; // 500ms between retries
    
    while (retryCount < maxRetries) {
      const stores = this.availableStores();
      const currentlySelected = this.selectedStoreId();
      
      console.log(`🏪 Mobile Store initialization attempt ${retryCount + 1}/${maxRetries} - Available stores:`, stores.length);
      
      if (stores.length > 0) {
        console.log('🏪 Mobile Stores found, proceeding with auto-selection');
        console.log('� Mobile Currently selected store:', currentlySelected);
        
        // Check if currently selected store is valid in available stores
        const selectedStore = stores.find(store => store.id === currentlySelected);
        
        if (currentlySelected && selectedStore) {
          console.log('✅ Mobile Valid store already selected from persistent state:', selectedStore.storeName);
          
          // Load products for the already selected store
          if (selectedStore.companyId) {
            await this.productService.loadProductsByCompanyAndStore(selectedStore.companyId, currentlySelected);
          }
          return; // Success, exit the function
        } else if (currentlySelected && !selectedStore) {
          console.warn('⚠️ Mobile Persisted store selection is invalid, clearing and selecting new store');
          // Clear invalid selection
          await this.posService.setSelectedStore('');
        }
        
        // Auto-select store if none is currently selected or selection was invalid
        if (!currentlySelected || !selectedStore) {
          let storeIdToSelect: string | null = null;
          
          // First, try to get storeId from IndexedDB user permissions
          try {
            const currentUser = this.authService.getCurrentUser();
            if (currentUser?.uid) {
              const offlineUserData = await this.indexedDBService.getUserData(currentUser.uid);
              if (offlineUserData?.permissions && offlineUserData.permissions.length > 0) {
                const permission = this.getActivePermission(offlineUserData, offlineUserData.currentStoreId);
                if (permission) {
                  const indexedDbStoreId = offlineUserData.currentStoreId || permission.storeId;
                  const indexedDbStore = stores.find(store => store.id === indexedDbStoreId);
                  if (indexedDbStore && indexedDbStoreId) {
                    storeIdToSelect = indexedDbStoreId;
                    console.log('💾 Mobile PRIORITY: Using storeId from IndexedDB permissions:', storeIdToSelect);
                    console.log('💾 Mobile Selected from', offlineUserData.permissions.length, 'available permissions');
                  }
                }
              }
            }
          } catch (error) {
            console.log('⚠️ Mobile Could not get storeId from IndexedDB permissions:', error);
          }
          
          // Fallback to first available store if no IndexedDB store found
          if (!storeIdToSelect) {
            storeIdToSelect = stores[0]?.id || null;
            console.log('🗄️ Mobile FALLBACK: Using first available store:', storeIdToSelect);
          }
          
          const storeToSelect = stores.find(store => store.id === storeIdToSelect);
          
          if (storeToSelect?.id) {
            if (stores.length === 1) {
              console.log('🏪 Mobile Single store detected, auto-selecting:', storeToSelect.storeName, '(ID:', storeToSelect.id, ')');
            } else {
              console.log('🏪 Mobile Multiple stores available, auto-selecting:', storeToSelect.storeName, '(ID:', storeToSelect.id, ')');
            }
            
            await this.selectStore(storeToSelect.id);
            console.log('✅ Mobile Auto-selection completed for store:', storeToSelect.storeName);
            
            // Verify the selection worked
            const afterSelection = this.selectedStoreId();
            if (afterSelection === storeToSelect.id) {
              console.log('✅ Mobile Store auto-selection verified successful');
              return; // Success, exit the function
            } else {
              console.warn('⚠️ Mobile Store auto-selection may have failed - expected:', storeToSelect.id, 'actual:', afterSelection);
            }
          }
        }
        
        // If we reach here, something went wrong but we have stores
        break;
      } else {
        console.log(`⏳ Mobile No stores available yet, waiting... (attempt ${retryCount + 1}/${maxRetries})`);
        retryCount++;
        
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }
    
    // Final check after all retries
    const finalStores = this.availableStores();
    const finalSelectedStore = this.selectedStoreId();
    
    if (finalStores.length === 0) {
      console.error('❌ Mobile No stores available after all retry attempts. Check user permissions and store loading.');
    } else {
      console.warn('⚠️ Mobile Stores are available but auto-selection failed after retries');
    }
    
    // FINAL PRODUCT LOADING CHECK - Ensure products are loaded for any selected store
    if (finalSelectedStore && finalStores.length > 0) {
      console.log('🔍 Mobile Final check - ensuring products are loaded for selected store:', finalSelectedStore);
      const selectedStoreInfo = finalStores.find(s => s.id === finalSelectedStore);
      
      if (selectedStoreInfo?.companyId) {
        const currentProducts = this.products();
        console.log('📦 Mobile Current products count:', currentProducts.length);
        
        if (currentProducts.length === 0) {
          console.log('📦 Mobile No products found, loading products for company:', selectedStoreInfo.companyId, 'store:', finalSelectedStore);
          try {
            await this.productService.loadProductsByCompanyAndStore(selectedStoreInfo.companyId, finalSelectedStore);
            console.log('✅ Mobile Final product loading completed, products count:', this.products().length);
            console.log('📂 Mobile Categories available:', this.categories().length);
          } catch (error) {
            console.error('❌ Mobile Error in final product loading:', error);
          }
        } else {
          console.log('✅ Mobile Products already loaded, count:', currentProducts.length);
        }
      }
    } else {
      console.warn('⚠️ Mobile No selected store for final product loading check');
    }
  }

  // Event handlers
  async selectStore(storeId: string): Promise<void> {
    console.log('🎯 Mobile selectStore called with storeId:', storeId);
    console.log('🏪 Mobile Available stores:', this.availableStores().map(s => ({ id: s.id, name: s.storeName, companyId: s.companyId })));
    
    // Set the selected store first - preserve cart to prevent disappearing
    await this.posService.setSelectedStore(storeId, { preserveCart: true });
    
    // PRIORITY: Get companyId from IndexedDB first, then fallback to database
    let companyId: string | undefined;
    
    try {
      const currentUser = this.authService.getCurrentUser();
      const offlineUserData = await this.indexedDBService.getUserData(currentUser?.uid || '');
      
      if (offlineUserData?.permissions) {
        const permission = this.getActivePermission(offlineUserData, storeId);
        if (permission?.companyId) {
          companyId = permission.companyId;
          console.log('💾 Mobile Using companyId from IndexedDB:', companyId);
        }
      }
    } catch (error) {
      console.log('⚠️ Mobile Could not get companyId from IndexedDB:', error);
    }
    
    // Fallback: Get companyId from availableStores (database data)
    if (!companyId) {
      const storeInfo = this.availableStores().find(s => s.id === storeId);
      companyId = storeInfo?.companyId;
      console.log('🗄️ Mobile Fallback: Using companyId from database:', companyId);
    }
    
    // Load products if we have companyId
    if (companyId) {
      console.log('📦 Mobile Loading products for store:', storeId, 'company:', companyId);
      await this.productService.loadProductsByCompanyAndStore(companyId, storeId);
      console.log('✅ Mobile Product loading completed');
    } else {
      console.error('❌ Mobile No companyId found for store:', storeId);
    }
  }

  setSelectedCategory(category: string): void {
    this.posSharedService.updateSelectedCategory(category);
  }

  setCurrentView(view: ProductViewType): void {
    this.posSharedService.updateCurrentView(view);
  }

  onSearch(): void {
    // If Orders tab is active, trigger order search using the main search input
    if (this.accessTab() === 'Orders') {
      const q = this.searchQuery().trim();
      this.setOrderSearchQuery(q);
      // call searchOrders when user types (debounce could be added later)
      void this.searchOrders();
      return;
    }

    // Otherwise, product search is reactive through the signal
  }

  // Public setter used by the template's ngModelChange
  setSearchQuery(value: string): void {
    this.posSharedService.updateSearchQuery(value);
  }

  clearSearch(): void {
    this.posSharedService.updateSearchQuery('');
    // If on Orders tab, also clear orders and load recent ones
    if (this.accessTab() === 'Orders') {
      this.setOrderSearchQuery('');
      void this.loadRecentOrders();
    }
  }

  async addToCart(product: Product): Promise<void> {
    if (product.totalStock <= 0) {
      this.toastService.warning(WarningMessages.PRODUCT_OUT_OF_STOCK);
      return;
    }

    // Check if order is completed - prevent adding to completed order
    if (this.isOrderCompleted()) {
      const confirmed = await this.showConfirmationDialog({
        title: 'Order Already Completed',
        message: 'The current order is completed. Do you want to start a new order to add this item?',
        confirmText: 'Start New Order',
        cancelText: 'Cancel',
        type: 'info'
      });

      if (confirmed) {
        // Start new order and then add the item
        this.startNewOrderDirect();
        this.posService.addToCart(product);
      }
      return;
    }

    // Check if no active order exists - show create new order dialog (like desktop)
    if (!this.hasActiveOrder()) {
      const confirmed = await this.showConfirmationDialog({
        title: 'Start New Order',
        message: 'Do you want to start a new order? You can then add products to your cart.',
        confirmText: 'Start Order',
        cancelText: 'Cancel',
        type: 'info'
      });

      if (confirmed) {
        // Just mark that new order is started - don't add the product yet
        this.hasActiveOrderSignal.set(true);
        console.log('🆕 New order started - ready to add products');
      }
      return;
    }

    // Normal add to cart for active orders
    this.posService.addToCart(product);
  }

  removeFromCart(productId: string): void {
    this.posService.removeFromCart(productId);
  }

  updateQuantity(productId: string, quantity: number): void {
    this.posService.updateCartItemQuantity(productId, quantity);
  }

  toggleVatExemption(productId: string): void {
    this.posService.toggleVatExemption(productId);
  }

  clearCart(): void {
    if (confirm('Are you sure you want to clear the cart?')) {
      this.posService.clearCart();
      // Reset active order state when cart is cleared
      this.hasActiveOrderSignal.set(false);
    }
  }

  // Cart modal methods
  showCartModal(): void {
    this.cartModal.show();
  }

  hideCartModal(): void {
    // Modal will handle its own closing
  }

  async processOrder(): Promise<void> {
    try {
      console.log('🎯 Complete Order clicked...');
      
      // Check if order is already completed - if so, just print receipt (like desktop)
      if (this.isOrderCompleted()) {
        console.log('🖨️ Order already completed, printing receipt...');
        await this.showCompletedOrderReceipt();
        return;
      }
      
      // Validate cart has items for new orders
      if (this.cartItems().length === 0) {
        console.warn('⚠️ Cannot process order: Cart is empty');
        return;
      }
      
      // Convert datetime string to Date object
      const orderDate = this.datetime ? new Date(this.datetime) : new Date();
      
      const customerData = {
        ...this.customerInfo,
        date: orderDate // Convert to date for backend compatibility
      };
      
      // Use the new invoice service to get both order ID and invoice number
      const result = await this.posService.processOrderWithInvoice(customerData);
      if (result) {
        console.log('Mobile Order processed with invoice:', {
          orderId: result.orderId,
          invoiceNumber: result.invoiceNumber
        });

        // Update the invoice number with the new result
        this.invoiceNumber = result.invoiceNumber;

        // Mark order as completed to prevent cart editing
        this.isOrderCompletedSignal.set(true);
        // orderDetails.status is set at creation time in the invoice/offline flows
        
        // Reset active order state since order is now complete
        this.hasActiveOrderSignal.set(false);

        // Prepare receipt data and show receipt modal immediately (like desktop)
        const receiptData = await this.prepareReceiptDataEnhanced(result.orderId);
        this.receiptDataSignal.set(receiptData);
        this.isReceiptModalVisibleSignal.set(true);
        
        console.log(`Mobile Order completed successfully! Order ID: ${result.orderId}`);
      }
    } catch (error) {
      console.error('Mobile Error processing order:', error);
      this.toastService.error(ErrorMessages.ORDER_PROCESS_ERROR);
    }
  }

  /**
   * Show receipt for already completed order (like desktop POS)
   */
  async showCompletedOrderReceipt(): Promise<void> {
    try {
      console.log('🧾 Showing receipt for completed order...');
      
      const receiptData = this.receiptData();
      if (receiptData) {
        // Navigate to receipt preview with ESC/POS content
        console.log('� Navigating to receipt preview...');
        const escposContent = this.printService.generateESCPOSCommands(receiptData);
        this.router.navigate(['/pos/mobile/receipt-preview'], {
          state: { receiptContent: escposContent }
        });
      } else {
        // Fallback: prepare receipt data from current state
        console.warn('⚠️ No receipt data found, preparing from current cart...');
        const fallbackReceiptData = await this.prepareReceiptDataEnhanced('completed-' + Date.now());
        this.receiptDataSignal.set(fallbackReceiptData);
        const escposContent = this.printService.generateESCPOSCommands(fallbackReceiptData);
        this.router.navigate(['/pos/mobile/receipt-preview'], {
          state: { receiptContent: escposContent }
        });
      }
      
    } catch (error) {
      console.error('❌ Error showing completed order receipt:', error);
    }
  }

  resetCustomerForm(): void {
    this.customerInfo = {
      soldTo: '',
      tin: '',
      businessAddress: '',
      customerId: ''
    };
    this.invoiceNumber = 'INV-0000-000000';
    this.datetime = new Date().toISOString().slice(0, 16); // Format for datetime-local input
  }

  toggleSoldToPanel(): void {
    this.isSoldToCollapsedSignal.set(!this.isSoldToCollapsedSignal());
  }

  toggleNavigationPanel(): void {
    this.isNavigationCollapsedSignal.set(!this.isNavigationCollapsedSignal());
  }

  // Receipt modal methods
  private prepareReceiptData(orderId: string): any {
    const cartItems = this.cartItems();
    const cartSummary = this.cartSummary();
    const storeInfo = this.currentStoreInfo();
    const customerInfo = this.customerInfo;
    const currentUser = this.authService.currentUser();
    
    // Get date and invoice number from shared service (receipt panel data)
    const receiptDate = this.posSharedService.orderDate();
    const invoiceNumber = this.posSharedService.invoiceNumber();

    // Determine customer name - if soldTo is empty or default, treat as N/A
    const customerName = customerInfo.soldTo && customerInfo.soldTo.trim() && customerInfo.soldTo !== 'Walk-in Customer' 
      ? customerInfo.soldTo.trim() 
      : null;

    return {
      orderId,
      invoiceNumber: invoiceNumber || this.invoiceNumber,
      receiptDate: receiptDate, // Date from shared service
      storeInfo: {
        storeName: (storeInfo as any)?.storeName || 'Unknown Store',
        address: (storeInfo as any)?.address || 'Store Address',
        phone: (storeInfo as any)?.phone || 'N/A',
        email: storeInfo?.email || 'N/A',
        tin: (storeInfo as any)?.tinNumber || 'N/A',
        invoiceType: (storeInfo as any)?.invoiceType || 'SALES INVOICE',
        birPermitNo: (storeInfo as any)?.birPermitNo || null,
        minNumber: (storeInfo as any)?.minNumber || null,
        serialNumber: (storeInfo as any)?.serialNumber || null,
        inclusiveSerialNumber: (storeInfo as any)?.inclusiveSerialNumber || null
      },
      customerName: customerName,
      customerAddress: customerName ? (customerInfo.businessAddress || 'N/A') : null,
      customerTin: customerName ? (customerInfo.tin || 'N/A') : null,
      cashier: currentUser?.displayName || currentUser?.email || 'Unknown Cashier',
      items: cartItems.map(item => ({
        productName: item.productName,
        skuId: item.skuId,
        quantity: item.quantity,
        sellingPrice: item.sellingPrice,
        total: item.total
      })),
      subtotal: cartSummary.grossAmount,
      vatAmount: cartSummary.vatAmount,
      vatExempt: cartSummary.vatExemptSales,
      discount: cartSummary.productDiscountAmount + cartSummary.orderDiscountAmount,
      totalAmount: cartSummary.netAmount,
      vatRate: 12 // Standard VAT rate
    };
  }

  closeReceiptModal(): void {
    this.isReceiptModalVisibleSignal.set(false);
    this.receiptDataSignal.set(null);
    
    // DON'T auto-clear cart - let user manually clear when they want to start new order
    // Cart items remain visible but user can manually clear or start new order
    console.log('🧾 Mobile Receipt modal closed - cart preserved');
  }

  async printReceipt(): Promise<void> {
    const receiptData = this.receiptData();
    if (!receiptData) {
      console.error('No receipt data available for printing');
      return;
    }

    try {
      // First, save the transaction to the database
      console.log('Saving transaction before printing...');
      const savedTransaction = await this.saveTransaction(receiptData);
      console.log('Transaction saved successfully:', savedTransaction.transactionNumber);

      // 🔥 MOBILE: Navigate to receipt preview page
      console.log('� Navigating to receipt preview...');
      const escposContent = this.printService.generateESCPOSCommands(receiptData);
      this.router.navigate(['/pos/mobile/receipt-preview'], {
        state: { receiptContent: escposContent }
      });
      
      // Close the modal after successful save and navigation
      this.closeReceiptModal();
      
    } catch (error) {
      console.error('Error during print process:', error);
      // Still try to show preview even if save fails
      try {
        const escposContent = this.printService.generateESCPOSCommands(receiptData);
        this.router.navigate(['/pos/mobile/receipt-preview'], {
          state: { receiptContent: escposContent }
        });
        this.closeReceiptModal();
      } catch (printError) {
        console.error('Navigation error:', printError);
      }
    }
  }

  private async saveTransaction(receiptData: any): Promise<any> {
    const currentUser = this.authService.currentUser();
    if (!currentUser) {
      throw new Error('No authenticated user found');
    }

    const cartSummary = this.cartSummary();
    const storeInfo = this.currentStoreInfo();

    // Prepare transaction data matching the Transaction interface
    const currentPermission = this.authService.getCurrentPermission();
    const transactionData = {
      companyId: currentPermission?.companyId || '',
      storeId: storeInfo?.id || '',
      branchId: currentUser.branchId || 'main-branch', // Use user's branch or default
      cashierId: currentUser.uid || '',
      items: receiptData.items.map((item: any) => ({
        productId: item.skuId || item.productId || '',
        name: item.productName,
        quantity: item.quantity,
        price: item.sellingPrice,
        tax: item.vatAmount || 0
      })),
      subtotal: cartSummary.grossAmount || receiptData.subtotal,
      tax: cartSummary.vatAmount || receiptData.vatAmount,
      total: cartSummary.netAmount || receiptData.totalAmount,
      paymentMethod: 'cash', // Default to cash, could be configurable
      amountTendered: cartSummary.netAmount || receiptData.totalAmount, // Assume exact payment for now
      change: 0, // No change for exact payment
      status: 'completed' as const
    };

    // Save transaction using the transaction service
    return await this.transactionService.createTransaction(transactionData);
  }

  // Lifecycle methods
  async ngAfterViewInit(): Promise<void> {
    // Mobile specific initialization if needed
  }

  ngOnDestroy(): void {
    console.log('🏗️ POS MOBILE COMPONENT: ngOnDestroy called - Component is being destroyed');
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
    
    // Don't clear invoice number on destroy - preserve it for when user returns
    console.log('📋 Mobile Preserving invoice number:', this.invoiceNumber);
  }

  // Method to reinitialize the component when navigating back to POS Mobile
  private async reinitializeComponent(): Promise<void> {
    console.log('🔄 POS MOBILE COMPONENT: Reinitializing component due to navigation');
    try {
      // Set current date and time
      this.updateCurrentDateTime();
      
      // Load next invoice number preview
      await this.loadNextInvoicePreview();
      
      // Initialize store (this will handle IndexedDB priority and product loading)
      await this.initializeStore();
      
      console.log('🔄 POS MOBILE COMPONENT: Reinitialization completed');
    } catch (error) {
      console.error('🔄 Mobile Error reinitializing POS component:', error);
    }
  }

  // Helper method for permissions - same as main POS component
  private getActivePermission(offlineUserData: any, preferredStoreId?: string): any {
    if (!offlineUserData?.permissions || offlineUserData.permissions.length === 0) {
      return null;
    }

    // If preferredStoreId is provided, try to find a permission for that store
    if (preferredStoreId) {
      const preferredPermission = offlineUserData.permissions.find((p: any) => p.storeId === preferredStoreId);
      if (preferredPermission) {
        return preferredPermission;
      }
    }

    // Return the first permission
    return offlineUserData.permissions[0];
  }

  // Date/time management - same as main POS component
  updateCurrentDateTime(): void {
    this.datetime = new Date().toISOString().slice(0, 16);
  }

  // Invoice preview loading - same as main POS component
  async loadNextInvoicePreview(): Promise<void> {
    try {
      // Only load new invoice number if we don't already have one
      if (this.invoiceNumber && this.invoiceNumber !== 'INV-0000-000000') {
        console.log('📋 Mobile Preserving existing invoice number:', this.invoiceNumber);
        return;
      }

      // Check if online/offline
      if (this.networkService.isOffline()) {
        console.log('📋 Mobile Offline mode: Using default invoice number');
        this.invoiceNumber = 'INV-0000-000000 (Offline)';
        return;
      }

      const nextInvoice = await this.posService.getNextInvoiceNumberPreview();
      
      // Update the invoice number for display
      this.invoiceNumber = nextInvoice;
      console.log('📋 Mobile Next invoice number loaded:', nextInvoice);
    } catch (error) {
      console.error('Mobile Error loading invoice preview:', error);
      this.invoiceNumber = 'INV-0000-000000 (Error)';
    }
  }
}
