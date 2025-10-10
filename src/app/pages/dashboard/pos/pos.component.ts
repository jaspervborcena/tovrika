import { Component, OnInit, AfterViewInit, OnDestroy, HostListener, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { ReceiptComponent } from './receipt/receipt.component';
import { DiscountModalComponent } from '../../../shared/components/discount-modal/discount-modal.component';
import { ConfirmationDialogComponent, ConfirmationDialogData } from '../../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { ProductService } from '../../../services/product.service';
import { PosService } from '../../../services/pos.service';
import { PosSharedService } from '../../../services/pos-shared.service';
import { PrintService } from '../../../services/print.service';
import { TransactionService } from '../../../services/transaction.service';
import { AuthService } from '../../../services/auth.service';
import { NetworkService } from '../../../core/services/network.service';
import { IndexedDBService } from '../../../core/services/indexeddb.service';

import { OrderService } from '../../../services/order.service';
import { StoreService } from '../../../services/store.service';
import { UserRoleService } from '../../../services/user-role.service';
import { CustomerService } from '../../../services/customer.service';
import { CompanyService } from '../../../services/company.service';
import { Product } from '../../../interfaces/product.interface';
import { ProductViewType, OrderDiscount } from '../../../interfaces/pos.interface';
import { Customer, CustomerFormData } from '../../../interfaces/customer.interface';

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, HeaderComponent, ReceiptComponent, DiscountModalComponent, ConfirmationDialogComponent],
  templateUrl: './pos.component.html',
  styleUrls: ['./pos.component.css']
})
export class PosComponent implements OnInit, AfterViewInit, OnDestroy {

  // Services
  private productService = inject(ProductService);
  private posService = inject(PosService);
  private posSharedService = inject(PosSharedService);
  private printService = inject(PrintService);
  private transactionService = inject(TransactionService);
  private authService = inject(AuthService);
  private networkService = inject(NetworkService);
  private indexedDBService = inject(IndexedDBService);
  private storeService = inject(StoreService);
  private orderService = inject(OrderService);
  private userRoleService = inject(UserRoleService);
  private customerService = inject(CustomerService);
  private companyService = inject(CompanyService);
  private router = inject(Router);

  private routerSubscription: any;

  constructor() {
    console.log('🏗️ POS COMPONENT: Constructor called - Component is being created!');
    console.log('🏗️ POS COMPONENT: Constructor timestamp:', new Date().toISOString());
    
    // Listen for navigation events
    this.routerSubscription = this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        console.log('🔄 Navigation event detected - URL:', event.url);
        if (event.url === '/pos') {
          console.log('🎯 Navigation to POS detected - Reinitializing component');
          // Force reinitialize when navigating to POS
          setTimeout(() => this.reinitializeComponent(), 100);
        }
      }
    });
  }

  // Use shared UI state for synchronization with mobile
  readonly searchQuery = computed(() => this.posSharedService.searchQuery());
  readonly selectedCategory = computed(() => this.posSharedService.selectedCategory());
  readonly currentView = computed(() => this.posSharedService.currentView());
  
  // Show stores loaded from user roles (already filtered by role-based access)
  readonly availableStores = computed(() => {
    const stores = this.storeService.getStores();
    console.log('🏪 availableStores computed - Stores from userRoles:', stores.length, 'stores');
    
    if (stores.length === 0) {
      console.warn('⚠️ No stores available from role-based loading');
      
      // Enhanced debugging for empty stores
      console.log('🔍 DEBUGGING EMPTY STORES:');
      console.log('  - Current user:', this.authService.getCurrentUser()?.uid || 'No user');
      console.log('  - Store service state:', this.storeService.debugStoreStatus());
      console.log('  - Component initialization state:', {
        products: this.products().length,
        categories: this.categories().length,
        selectedStore: this.selectedStoreId()
      });
      
      // Try to trigger store loading as fallback
      this.handleEmptyStores();
    } else {
      console.log('🏪 Store details:', stores.map(s => ({ id: s.id, name: s.storeName, companyId: s.companyId })));
    }
    
    return stores;
  });
  readonly selectedStoreId = computed(() => this.posService.selectedStoreId());
  readonly cartItems = computed(() => this.posService.cartItems());
  readonly cartSummary = computed(() => this.posService.cartSummary());
  readonly isProcessing = computed(() => this.posService.isProcessing());
  
  readonly products = computed(() => {
    const prods = this.productService.getProducts();
    console.log('🔍 PRODUCTS COMPUTED - Count:', prods.length);
    return prods;
  });
  readonly categories = computed(() => {
    const cats = this.productService.getCategories();
    console.log('🔍 CATEGORIES COMPUTED - Count:', cats.length, 'Categories:', cats);
    return cats;
  });
  
  readonly currentStoreInfo = computed(() => 
    this.availableStores().find(s => s.id === this.selectedStoreId())
  );

  // Invoice preview
  readonly nextInvoiceNumber = signal<string>('Loading...');
  readonly showOfflineInvoiceDialog = signal<boolean>(false);

  // New Order Workflow State
  readonly isNewOrderActive = signal<boolean>(false);
  readonly offlineInvoicePreference = signal<'manual' | 'auto'>('auto');
  readonly offlineManualInvoiceNumber = signal<string>('INV-0000-000000');
  
  // Store availability status
  readonly hasStoreLoadingError = computed(() => {
    const stores = this.availableStores();
    const user = this.authService.getCurrentUser();
    return stores.length === 0 && !!user?.uid;
  });
  
  // Hardware printer status
  readonly hardwarePrinterStatus = signal<{ available: boolean; type: string; ready: boolean }>({
    available: false,
    type: 'none',
    ready: false
  });
  
  // Order completion status - tracks if current order is already processed
  readonly isOrderCompleted = signal<boolean>(false);
  readonly completedOrderData = signal<any>(null); // Store completed order data for reprinting
  
  // Regular properties for ngModel binding (signals don't work well with ngModel)
  manualInvoiceInput: string = 'INV-0000-000000';
  
  // Computed properties for UI display
  readonly completeOrderButtonText = computed(() => {
    if (this.isProcessing()) {
      return 'Processing...';
    }
    
    if (this.isOrderCompleted()) {
      return 'Print Receipt';
    }
    
    return 'Complete Order';
  });

  // Check if complete order button should be enabled
  readonly isCompleteOrderButtonEnabled = computed(() => {
    // Button is enabled if:
    // 1. Not currently processing
    // 2. Either has cart items (for new orders) OR order is completed (for reprint)
    return !this.isProcessing() && 
           (this.cartItems().length > 0 || this.isOrderCompleted());
  });

  // Get CSS classes for complete order button to indicate mode
  getCompleteOrderButtonClass(): string {
    const baseClass = 'btn btn-primary';
    
    if (this.isOrderCompleted()) {
      return `${baseClass} btn-reprint`; // Special class for reprint mode
    }
    
    return baseClass;
  }
  
  // Payment Dialog State
  readonly paymentModalVisible = signal<boolean>(false);
  paymentAmountTendered: number = 0;
  paymentDescription: string = '';

  async loadNextInvoicePreview(): Promise<void> {
    try {
      // Always use default placeholder until payment is processed
      console.log('📋 Setting default invoice number placeholder');
      this.nextInvoiceNumber.set('INV-0000-000000');
      this.invoiceNumber = 'INV-0000-000000';
    } catch (error) {
      console.error('Error loading invoice preview:', error);
      this.nextInvoiceNumber.set('INV-0000-000000');
      this.invoiceNumber = 'INV-0000-000000';
    }
  }

  readonly filteredProducts = computed(() => {
    const allProducts = this.products();
    const storeId = this.selectedStoreId();
    const stores = this.availableStores();
    
    // 🔍 DEBUG: Log initial state
    console.log('🔍 FILTERED PRODUCTS DEBUG:', {
      totalProducts: allProducts.length,
      selectedStoreId: storeId,
      availableStores: stores.length,
      storeNames: stores.map(s => s.storeName)
    });

    let filtered = allProducts;

    // ✅ FIXED: Simplified store filtering logic
    if (storeId && stores.length > 0) {
      // Filter products that belong to the selected store OR have no storeId (global products)
      filtered = allProducts.filter(p => {
        const belongsToStore = p.storeId === storeId;
        const isGlobalProduct = !p.storeId;
        const included = belongsToStore || isGlobalProduct;
        
        if (!included && p.storeId) {
          console.log('🔍 Product filtered out:', p.productName, 'productStoreId:', p.storeId, 'selectedStoreId:', storeId);
        }
        
        return included;
      });
      
      console.log('🔍 After store filtering:', {
        originalCount: allProducts.length,
        filteredCount: filtered.length,
        productsWithStoreId: filtered.filter(p => p.storeId === storeId).length,
        globalProducts: filtered.filter(p => !p.storeId).length
      });
    } else if (stores.length > 0) {
      // If no specific store selected but stores available, use all store products
      const storeIds = stores.map(s => s.id).filter(Boolean);
      filtered = allProducts.filter(p => !p.storeId || storeIds.includes(p.storeId));
      
      console.log('🔍 No specific store - using all available stores:', storeIds);
    } else {
      // No stores available - show all products (fallback)
      console.log('🔍 No stores available - showing all products as fallback');
    }

    // Filter by category
    const category = this.selectedCategory();
    if (category !== 'all') {
      const beforeCategoryCount = filtered.length;
      filtered = filtered.filter(p => p.category === category);
      console.log('🔍 After category filtering:', {
        category,
        beforeCount: beforeCategoryCount,
        afterCount: filtered.length
      });
    }

    // Filter by search query
    const query = this.searchQuery().toLowerCase();
    if (query) {
      const beforeSearchCount = filtered.length;
      filtered = filtered.filter(p =>
        p.productName.toLowerCase().includes(query) ||
        p.skuId.toLowerCase().includes(query) ||
        p.barcodeId?.toLowerCase().includes(query)
      );
      console.log('🔍 After search filtering:', {
        query,
        beforeCount: beforeSearchCount,
        afterCount: filtered.length
      });
    }

    // Sort by newest (createdAt) if present, otherwise keep original
    try {
      filtered = filtered.slice().sort((a, b) => (b.createdAt?.getTime ? b.createdAt.getTime() : 0) - (a.createdAt?.getTime ? a.createdAt.getTime() : 0));
    } catch (e) {
      console.warn('🔍 Sort error (ignored):', e);
    }

    // Limit to top 20 when in list or grid view
    const view = this.currentView();
    const finalCount = filtered.length;
    
    if (view === 'list' || view === 'grid') {
      filtered = filtered.slice(0, 20);
    }
    
    console.log('🔍 FINAL FILTERED PRODUCTS:', {
      finalCount: finalCount,
      displayCount: filtered.length,
      view: view,
      sampleProducts: filtered.slice(0, 3).map(p => ({ name: p.productName, storeId: p.storeId, category: p.category }))
    });
    
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

  // UI State for collapsible customer panel
  private isSoldToCollapsedSignal = signal<boolean>(true);
  readonly isSoldToCollapsed = computed(() => this.isSoldToCollapsedSignal());
  
  // Navigation collapse state for desktop POS
  private isNavigationCollapsedSignal = signal<boolean>(true);
  readonly isNavigationCollapsed = computed(() => this.isNavigationCollapsedSignal());
  
  // Access tabs for POS management
  readonly accessTabs = ['New', 'Orders', 'Cancelled', 'Refunds & Returns', 'Split Payments', 'Discounts & Promotions'] as const;
  private accessTabSignal = signal<string>('New');
  readonly accessTab = computed(() => this.accessTabSignal());

  // Order search (used when viewing Orders tab)
  private orderSearchSignal = signal<string>('');
  readonly orderSearchQuery = computed(() => this.orderSearchSignal());

  // Orders state
  private ordersSignal = signal<any[]>([]);
  readonly orders = computed(() => this.ordersSignal());
  
  private isLoadingOrdersSignal = signal<boolean>(false);
  readonly isLoadingOrders = computed(() => this.isLoadingOrdersSignal());

  // Order detail modal
  private selectedOrderSignal = signal<any | null>(null);
  readonly selectedOrder = computed(() => this.selectedOrderSignal());

  // Receipt modal state
  private isReceiptModalVisibleSignal = signal<boolean>(false);
  readonly isReceiptModalVisible = computed(() => this.isReceiptModalVisibleSignal());
  
  private receiptDataSignal = signal<any>(null);
  readonly receiptData = computed(() => this.receiptDataSignal());

  // Discount modal state
  private isDiscountModalVisibleSignal = signal<boolean>(false);
  readonly isDiscountModalVisible = computed(() => this.isDiscountModalVisibleSignal());
  readonly orderDiscount = computed(() => this.posService.orderDiscount());

  // Confirmation dialog state
  private isConfirmationDialogVisibleSignal = signal<boolean>(false);
  readonly isConfirmationDialogVisible = computed(() => this.isConfirmationDialogVisibleSignal());
  
  private confirmationDialogDataSignal = signal<ConfirmationDialogData | null>(null);
  readonly confirmationDialogData = computed(() => this.confirmationDialogDataSignal());

  // Sales type state - now supports both cash and charge
  private salesTypeCashSignal = signal<boolean>(true);  // Default to cash enabled
  private salesTypeChargeSignal = signal<boolean>(false); // Default to charge disabled
  readonly isCashSale = computed(() => this.salesTypeCashSignal());
  readonly isChargeSale = computed(() => this.salesTypeChargeSignal());

  setAccessTab(tab: string): void {
    console.log('🎯 Setting access tab to:', tab);
    console.log('🕐 Current time:', new Date().toLocaleString());
    console.log('📊 Previous tab was:', this.accessTabSignal());
    
    this.accessTabSignal.set(tab);
    
    // When Orders tab is activated, always load recent orders
    if (tab === 'Orders') {
      console.log('📋 Orders tab activated, loading recent orders...');
      console.log('🔄 About to call loadRecentOrders()...');
      
      // Clear search query and load recent orders
      this.setOrderSearchQuery('');
      this.loadRecentOrders();
      
      console.log('✅ loadRecentOrders() called');
    } else if (tab !== 'Orders') {
      // Clear orders when switching away from Orders tab
      console.log('🧹 Clearing orders for tab:', tab);
      this.ordersSignal.set([]);
      this.setOrderSearchQuery('');
    }
  }

  setOrderSearchQuery(value: string): void {
    this.orderSearchSignal.set(value);
  }

  toggleCashSale(): void {
    this.salesTypeCashSignal.update(value => !value);
  }

  toggleChargeSale(): void {
    this.salesTypeChargeSignal.update(value => !value);
  }

  async searchOrders(): Promise<void> {
    try {
      this.isLoadingOrdersSignal.set(true);
      const storeInfo = this.currentStoreInfo();
      const companyId = storeInfo?.companyId;
      const storeId = this.selectedStoreId();
      const q = this.orderSearchQuery().trim();
      if (!companyId) return;
      
      const results = await this.orderService.searchOrders(companyId, storeId || undefined, q);
      this.ordersSignal.set(results);
    } catch (error) {
      console.error('Error searching orders:', error);
      this.ordersSignal.set([]);
    } finally {
      this.isLoadingOrdersSignal.set(false);
    }
  }

  async loadRecentOrders(): Promise<void> {
    try {
      console.log('🔄 Starting loadRecentOrders...');
      this.isLoadingOrdersSignal.set(true);
      const storeInfo = this.currentStoreInfo();
      const companyId = storeInfo?.companyId;
      const storeId = this.selectedStoreId();
      
      console.log('🏪 Store info:', { storeInfo, companyId, storeId });
      
      if (!companyId) {
        console.warn('❌ No company ID available for loading recent orders');
        return;
      }
      
      console.log('📡 Calling orderService.getRecentOrders...');
      const results = await this.orderService.getRecentOrders(companyId, storeId || undefined, 20);
      console.log('✅ Received results:', results.length, 'orders');
      console.log('📋 Orders data:', results);
      
      this.ordersSignal.set(results);
    } catch (error) {
      console.error('❌ Error loading recent orders:', error);
      this.ordersSignal.set([]);
    } finally {
      this.isLoadingOrdersSignal.set(false);
    }
  }

  // Refresh orders - manually triggered by user
  async refreshOrders(): Promise<void> {
    try {
      console.log('🔄 Manual refresh triggered...');
      
      // Clear current orders first to show loading state
      this.ordersSignal.set([]);
      
      // If there's a search query, search again, otherwise load recent orders
      const searchQuery = this.orderSearchQuery().trim();
      if (searchQuery) {
        console.log('🔍 Refreshing search results for query:', searchQuery);
        await this.searchOrders();
      } else {
        console.log('📋 Refreshing recent orders...');
        await this.loadRecentOrders();
      }
      
      console.log('✅ Manual refresh completed');
    } catch (error) {
      console.error('❌ Error during manual refresh:', error);
    }
  }

  // Handle empty stores scenario with fallback recovery
  private handleEmptyStores(): void {
    console.log('🔧 Attempting to recover from empty stores...');
    
    // Debounce multiple calls to avoid infinite loops
    if ((this as any)._emptyStoresRecoveryInProgress) {
      console.log('🔧 Store recovery already in progress, skipping...');
      return;
    }
    
    (this as any)._emptyStoresRecoveryInProgress = true;
    
    // Try recovery after a short delay
    setTimeout(async () => {
      try {
        console.log('🔄 Initiating store recovery process...');
        
        const currentUser = this.authService.getCurrentUser();
        if (!currentUser?.uid) {
          console.error('❌ No authenticated user for store recovery');
          return;
        }
        
        // Try IndexedDB first as most reliable source
        const offlineUserData = await this.indexedDBService.getUserData(currentUser.uid);
        if (offlineUserData?.permissions && offlineUserData.permissions.length > 0) {
          console.log('💾 Found IndexedDB permissions, attempting store recovery...');
          
          const permission = this.getActivePermission(offlineUserData);
          if (permission?.storeId) {
            console.log('🔄 Reloading store from IndexedDB permission:', permission.storeId);
            await this.storeService.loadStores([permission.storeId]);
            
            // Verify recovery worked
            setTimeout(() => {
              const recoveredStores = this.storeService.getStores();
              console.log('✅ Store recovery result:', recoveredStores.length, 'stores recovered');
              (this as any)._emptyStoresRecoveryInProgress = false;
            }, 500);
            return;
          }
        }
        
        // Fallback to user roles loading
        console.log('🗄️ Fallback: Attempting user roles loading...');
        await this.userRoleService.loadUserRoles();
        const userRole = this.userRoleService.getUserRoleByUserId(currentUser.uid);
        
        if (userRole?.storeId) {
          console.log('🔄 Reloading store from user role:', userRole.storeId);
          await this.storeService.loadStores([userRole.storeId]);
        } else if (userRole?.companyId) {
          console.log('🔄 Reloading all company stores from user role:', userRole.companyId);
          await this.storeService.loadStoresByCompany(userRole.companyId);
        }
        
      } catch (error) {
        console.error('❌ Store recovery failed:', error);
      } finally {
        (this as any)._emptyStoresRecoveryInProgress = false;
      }
    }, 1000); // 1 second delay to avoid rapid retries
  }

  // Manual refresh stores - for user-triggered recovery
  async refreshStores(): Promise<void> {
    try {
      console.log('🔄 Manual store refresh initiated...');
      
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser?.uid) {
        console.error('❌ No authenticated user for manual store refresh');
        return;
      }
      
      // Show loading state
      console.log('⏳ Refreshing stores...');
      
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
            console.log('✅ Stores recovered via IndexedDB method');
          }
        }
      } catch (error) {
        console.log('⚠️ IndexedDB recovery method failed:', error);
      }
      
      // Method 2: User roles
      if (!recovered) {
        try {
          await this.userRoleService.loadUserRoles();
          const userRole = this.userRoleService.getUserRoleByUserId(currentUser.uid);
          
          if (userRole?.storeId) {
            await this.storeService.loadStores([userRole.storeId]);
            recovered = true;
            console.log('✅ Stores recovered via user roles method');
          } else if (userRole?.companyId) {
            await this.storeService.loadStoresByCompany(userRole.companyId);
            recovered = true;
            console.log('✅ Stores recovered via company loading method');
          }
        } catch (error) {
          console.log('⚠️ User roles recovery method failed:', error);
        }
      }
      
      // Verify recovery
      setTimeout(() => {
        const stores = this.availableStores();
        if (stores.length > 0) {
          console.log('🎉 Store refresh successful! Recovered', stores.length, 'stores');
        } else {
          console.error('❌ Store refresh failed - still no stores available');
        }
      }, 500);
      
    } catch (error) {
      console.error('❌ Manual store refresh failed:', error);
    }
  }

  // Debug method to create test orders
  async createTestOrder(): Promise<void> {
    try {
      console.log('🎯 Debug button clicked - creating test order...');
      
      // Check authentication first
      const currentUser = this.authService.getCurrentUser();
      console.log('👤 Current user:', currentUser);
      
      const storeInfo = this.currentStoreInfo();
      const companyId = storeInfo?.companyId;
      const storeId = this.selectedStoreId();
      
      console.log('🏪 Debug - Store info check:', { 
        storeInfo, 
        companyId, 
        storeId,
        availableStores: this.availableStores(),
        selectedStoreId: this.selectedStoreId()
      });
      
      if (!companyId || !storeId) {
        console.error('❌ Missing company or store info for test order creation');
        console.error('CompanyId:', companyId, 'StoreId:', storeId);
        console.error('Store Info:', JSON.stringify(storeInfo, null, 2));
        return;
      }
      
      console.log('🧪 Creating test order with valid IDs...');
      await this.orderService.createTestOrder(companyId, storeId);
      
      console.log('🔄 Refreshing orders after test order creation...');
      // Refresh orders after creating test order
      await this.loadRecentOrders();
    } catch (error) {
      console.error('❌ Error in createTestOrder component method:', error);
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
      // refresh
      await this.searchOrders();
      this.closeOrder();
    } catch (e) {
      console.error('Failed to update order status', e);
    }
  }

  // Process individual item actions (return, damage, refund, cancel)
  async processItemAction(orderId: string, itemIndex: number, action: string, item: any): Promise<void> {
    try {
      console.log(`Processing ${action} for item:`, { orderId, itemIndex, action, item });
      
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
            console.log('Processing return for item:', item);
            // TODO: Implement return logic
            break;
          case 'damage':
            console.log('Processing damage for item:', item);
            // TODO: Implement damage reporting logic
            break;
          case 'refund':
            console.log('Processing refund for item:', item);
            // TODO: Implement refund logic
            break;
          case 'cancel':
            console.log('Processing cancellation for item:', item);
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
      console.error(`Error processing ${action} for item:`, error);
      await this.showConfirmationDialog({
        title: 'Error',
        message: `Failed to process ${action}. Please try again.`,
        confirmText: 'OK',
        cancelText: '',
        type: 'danger'
      });
    }
  }

  // Open order receipt for viewing/printing
  async openOrderReceipt(order: any): Promise<void> {
    try {
      console.log('Opening receipt for order:', order);
      
      // Convert order data to receipt format (now async for company data)
      const receiptData = await this.convertOrderToReceiptData(order);
      
      // Set receipt data and show modal
      this.receiptDataSignal.set(receiptData);
      this.isReceiptModalVisibleSignal.set(true);
      
      // Close the order details modal
      this.closeOrder();
    } catch (error) {
      console.error('Error opening order receipt:', error);
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
      console.warn('Could not fetch company info for order receipt:', error);
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
          console.warn('Could not resolve cashier name for user ID:', order.assignedCashierId, error);
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
        address: company?.address || (storeInfo as any)?.address || 'Store Address',
        phone: company?.phone || (storeInfo as any)?.phone || 'N/A', // Use company phone
        email: company?.email || storeInfo?.email || 'N/A', // Use company email
        tin: company?.taxId || company?.tin || (storeInfo as any)?.tinNumber || 'N/A', // Use company tax ID/TIN
        invoiceType: (storeInfo as any)?.invoiceType || 'SALES INVOICE',
        birPermitNo: company?.birPermitNo || (storeInfo as any)?.birPermitNo || null,
        minNumber: (storeInfo as any)?.minNumber || null,
        serialNumber: (storeInfo as any)?.serialNumber || null,
        inclusiveSerialNumber: company?.inclusiveSerialNumber || (storeInfo as any)?.inclusiveSerialNumber || null
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
      // Enhanced order discount handling - check for both exemptionId and full discount object
      orderDiscount: order.orderDiscount || (order.exemptionId ? {
        type: 'CUSTOM',
        exemptionId: order.exemptionId,
        customerName: order.discountCustomerName || customerName
      } : null)
    };
  }

  // Helper method to get the active permission from IndexedDB user data
  private getActivePermission(offlineUserData: any, currentStoreId?: string): any {
    if (!offlineUserData?.permissions || offlineUserData.permissions.length === 0) {
      return null;
    }

    // If user has only one permission, use it
    if (offlineUserData.permissions.length === 1) {
      return offlineUserData.permissions[0];
    }

    // If multiple permissions and we have a currentStoreId, find matching permission
    if (currentStoreId && offlineUserData.permissions.length > 1) {
      const matchingPermission = offlineUserData.permissions.find((p: any) => 
        p.storeId === currentStoreId
      );
      if (matchingPermission) {
        console.log('🔑 Found matching permission for storeId:', currentStoreId);
        return matchingPermission;
      }
    }

    // If multiple permissions but no specific store match, try to find by companyId
    if (offlineUserData.permissions.length > 1) {
      // For now, prioritize permissions with 'creator' or 'admin' role
      const priorityPermission = offlineUserData.permissions.find((p: any) => 
        p.roleId === 'creator' || p.roleId === 'admin'
      );
      if (priorityPermission) {
        console.log('🔑 Using priority permission (creator/admin):', priorityPermission.roleId);
        return priorityPermission;
      }
    }

    // Fallback: use the first permission (could be enhanced with user preference)
    console.log('🔑 Using first permission as fallback from', offlineUserData.permissions.length, 'permissions');
    return offlineUserData.permissions[0];
  }

  async ngOnInit(): Promise<void> {
    console.log('🎯 POS COMPONENT: ngOnInit called - POS is loading!');
    console.log('🎯 POS COMPONENT: Current URL:', window.location.href);
    console.log('🎯 POS COMPONENT: Timestamp:', new Date().toISOString());
    
    // 🔍 DEBUG: Make debug methods available globally for console debugging
    (window as any).debugPOS = {
      refreshProducts: () => this.debugRefreshProducts(),
      checkFilteredProducts: () => {
        console.log('🔍 CURRENT STATE:', {
          products: this.products().length,
          filteredProducts: this.filteredProducts().length,
          selectedStore: this.selectedStoreId(),
          selectedCategory: this.selectedCategory(),
          searchQuery: this.searchQuery(),
          currentView: this.currentView()
        });
        return this.filteredProducts();
      },
      forceUpdate: () => {
        // Force signal updates by accessing them
        this.products();
        this.categories();
        this.filteredProducts();
        console.log('🔍 Signals accessed - check console for update logs');
      },
      // Store debugging methods
      refreshStores: () => this.refreshStores(),
      checkStores: () => {
        console.log('🏪 STORE DEBUG STATE:', {
          availableStores: this.availableStores().length,
          selectedStore: this.selectedStoreId(),
          hasStoreError: this.hasStoreLoadingError(),
          storeServiceState: this.storeService.debugStoreStatus(),
          user: this.authService.getCurrentUser()?.uid || 'No user'
        });
        return this.availableStores();
      },
      forceStoreRecovery: () => this.handleEmptyStores(),
      debugUserData: async () => {
        const user = this.authService.getCurrentUser();
        if (user?.uid) {
          const indexedData = await this.indexedDBService.getUserData(user.uid);
          const userRole = this.userRoleService.getUserRoleByUserId(user.uid);
          console.log('👤 USER DEBUG DATA:', {
            user: { uid: user.uid, email: user.email },
            indexedData,
            userRole,
            currentPermission: this.authService.getCurrentPermission()
          });
          return { indexedData, userRole };
        }
        return null;
      },
      // Hardware printer debugging
      checkPrinterStatus: () => this.checkHardwarePrinterStatus(),
      getPrinterStatus: () => {
        console.log('🖨️ PRINTER STATUS:', {
          status: this.hardwarePrinterStatus(),
          displayText: this.getPrinterStatusText()
        });
        return this.hardwarePrinterStatus();
      },
      testDirectPrint: async () => {
        const mockReceiptData = {
          orderId: 'TEST-123',
          invoiceNumber: 'TEST-INV-001',
          items: [{ productName: 'Test Item', quantity: 1, sellingPrice: 10.00, total: 10.00 }],
          totalAmount: 10.00
        };
        return await this.printService.printReceiptDirect(mockReceiptData);
      },
      // Order completion testing
      simulateCompletedOrder: () => {
        // Simulate a completed order for testing
        this.nextInvoiceNumber.set('INV-2024-001234567890');
        this.isNewOrderActive.set(true);
        this.isOrderCompleted.set(true);
        console.log('🧪 Simulated completed order state for testing');
      },
      checkOrderStatus: () => {
        console.log('📋 ORDER STATUS CHECK:', {
          isOrderCompleted: this.isOrderCompleted(),
          invoiceNumber: this.nextInvoiceNumber(),
          cartItems: this.cartItems().length,
          isNewOrderActive: this.isNewOrderActive(),
          canEditCart: this.canEditCartItems(),
          canClearCart: this.canClearCart(),
          canRemoveFromCart: this.canRemoveFromCart(),
          canChangeQuantity: this.canChangeQuantity(),
          buttonEnabled: this.isCompleteOrderButtonEnabled(),
          buttonText: this.completeOrderButtonText(),
          completedOrderData: this.completedOrderData()
        });
        return {
          isCompleted: this.isOrderCompleted(),
          canEdit: this.canEditCartItems(),
          canClear: this.canClearCart(),
          buttonEnabled: this.isCompleteOrderButtonEnabled()
        };
      },
      resetOrderState: () => {
        this.nextInvoiceNumber.set('INV-0000-000000');
        this.isNewOrderActive.set(false);
        this.isOrderCompleted.set(false);
        this.completedOrderData.set(null);
        this.posService.clearCart();
        console.log('🔄 Order state reset to initial state');
      }
    };
    console.log('🔍 DEBUG: Global debug methods available:');
    console.log('  - window.debugPOS.refreshProducts() - Refresh product data');
    console.log('  - window.debugPOS.checkFilteredProducts() - Check product filtering state');
    console.log('  - window.debugPOS.forceUpdate() - Force signal updates');
    console.log('  - window.debugPOS.refreshStores() - Manual store refresh');
    console.log('  - window.debugPOS.checkStores() - Check store loading state');
    console.log('  - window.debugPOS.forceStoreRecovery() - Force store recovery');
    console.log('  - window.debugPOS.debugUserData() - Show user/permission data');
    console.log('  - window.debugPOS.checkPrinterStatus() - Check hardware printers');
    console.log('  - window.debugPOS.getPrinterStatus() - Show current printer status');
    console.log('  - window.debugPOS.testDirectPrint() - Test direct printing');
    console.log('  - window.debugPOS.simulateCompletedOrder() - Simulate completed order');
    console.log('  - window.debugPOS.checkOrderStatus() - Check order completion status');
    console.log('  - window.debugPOS.resetOrderState() - Reset order to initial state');
    try {
      console.log('📊 STEP 1: Loading data (stores, products, categories)...');
      // Load data first to ensure stores and products are available
      await this.loadData();
      console.log('✅ STEP 1 COMPLETED: Data loading finished');
      
      console.log('📊 STEP 2: Setting current date and time...');
      // Set current date and time
      this.updateCurrentDateTime();
      
      console.log('📊 STEP 3: Loading next invoice number preview...');
      // Load next invoice number preview
      await this.loadNextInvoicePreview();
      console.log('✅ STEP 3 COMPLETED: Invoice number loaded');
      
      console.log('📊 STEP 4: Initializing store selection...');
      await this.initializeStore(); 
      console.log('✅ STEP 4 COMPLETED: Store initialization finished');
      
      console.log('📊 STEP 5: Checking hardware printer availability...');
      await this.checkHardwarePrinterStatus();
      console.log('✅ STEP 5 COMPLETED: Hardware printer status checked');
      
      // 🔍 ENHANCED DEBUG: More detailed final check
      console.log('🔍 FINAL CHECK - currentUser:', this.authService.getCurrentUser());
      console.log('🔍 FINAL CHECK - all stores:', this.storeService.getStores());
      console.log('🔍 FINAL CHECK - available stores:', this.availableStores());
      console.log('🔍 FINAL CHECK - selected store:', this.selectedStoreId());
      console.log('🔍 FINAL CHECK - products count:', this.products().length);
      console.log('🔍 FINAL CHECK - categories count:', this.categories().length);
      
      // 🔍 NEW: Check filtered products specifically
      console.log('🔍 FINAL CHECK - filtered products count:', this.filteredProducts().length);
      console.log('🔍 FINAL CHECK - selected category:', this.selectedCategory());
      console.log('🔍 FINAL CHECK - search query:', this.searchQuery());
      console.log('🔍 FINAL CHECK - current view:', this.currentView());
      
      // 🔍 NEW: Force a small delay to let signals update, then check again
      setTimeout(() => {
        console.log('🔍 DELAYED CHECK (500ms) - filtered products count:', this.filteredProducts().length);
        console.log('🔍 DELAYED CHECK - sample filtered products:', this.filteredProducts().slice(0, 3).map(p => ({ name: p.productName, storeId: p.storeId })));
      }, 500);
      
      console.log('🎉 POS INITIALIZATION COMPLETED SUCCESSFULLY!');
    } catch (error) {
      console.error('❌ Error initializing POS:', error);
      console.error('❌ Error details:', error);
    }
  }

  async ngAfterViewInit(): Promise<void> {
  
  }

  ngOnDestroy(): void {
    console.log('🏗️ POS COMPONENT: ngOnDestroy called - Component is being destroyed');
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }

  // F4 Hotkey for Clear Data
  @HostListener('document:keydown.f4', ['$event'])
  async onF4KeyPress(event: KeyboardEvent): Promise<void> {
    event.preventDefault(); // Prevent default F4 behavior
    
    // Check if order is already completed
    if (this.isOrderCompleted()) {
      await this.showConfirmationDialog({
        title: 'Clear Cart Disabled',
        message: 'This order is already completed. Please start a new order to clear the cart.',
        confirmText: 'Start New Order',
        cancelText: 'Cancel',
        type: 'info'
      }).then(async (confirmed) => {
        if (confirmed) {
          await this.startNewOrderDirect();
        }
      });
      return;
    }
    
    // Only allow clear cart if new order is active
    if (!this.isNewOrderActive()) {
      await this.showConfirmationDialog({
        title: 'Clear Cart Disabled',
        message: 'Please start a new order first before clearing cart data.',
        confirmText: 'OK',
        cancelText: '',
        type: 'warning'
      });
      return;
    }
    
    if (this.cartItems().length > 0) {
      await this.clearCart(); // clearCart() already has confirmation dialog
    }
  }

  // F5 Hotkey for New Order
  @HostListener('document:keydown.f5', ['$event'])
  async onF5KeyPress(event: KeyboardEvent): Promise<void> {
    event.preventDefault(); // Prevent page refresh
    
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
  async onF6KeyPress(event: KeyboardEvent): Promise<void> {
    event.preventDefault(); // Prevent default F6 behavior
    
    // If order is already completed, just show receipt
    if (this.isOrderCompleted()) {
      await this.showCompletedOrderReceipt();
      return;
    }
    
    // For incomplete orders, proceed with normal completion
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


  // Check if products can be clicked (New Order must be active)
  canInteractWithProducts(): boolean {
    return this.isNewOrderActive();
  }

  // Check if cart items can be edited (not completed order)
  canEditCartItems(): boolean {
    return this.isNewOrderActive() && !this.isOrderCompleted();
  }

  // Check if quantity can be changed for cart items
  canChangeQuantity(): boolean {
    return this.isNewOrderActive() && !this.isOrderCompleted();
  }

  // Check if items can be removed from cart
  canRemoveFromCart(): boolean {
    return this.isNewOrderActive() && !this.isOrderCompleted();
  }

  // Check if cart can be cleared
  canClearCart(): boolean {
    return this.isNewOrderActive() && !this.isOrderCompleted() && this.cartItems().length > 0;
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

  // Check and update hardware printer status
  async checkHardwarePrinterStatus(): Promise<void> {
    try {
      const status = await this.printService.isHardwarePrinterAvailable();
      this.hardwarePrinterStatus.set({
        available: status.hasHardware,
        type: status.type,
        ready: status.details.ready || status.details.connected || false
      });
      
      console.log('🖨️ Hardware printer status updated:', this.hardwarePrinterStatus());
    } catch (error) {
      console.error('❌ Failed to check hardware printer status:', error);
      this.hardwarePrinterStatus.set({
        available: false,
        type: 'none',
        ready: false
      });
    }
  }

  // Get printer status display text
  getPrinterStatusText(): string {
    const status = this.hardwarePrinterStatus();
    if (!status.available) {
      return 'Browser Print Only';
    }
    
    if (status.ready) {
      return `${status.type} Printer Ready`;
    } else {
      return `${status.type} Printer Available`;
    }
  }

  // Direct new order without confirmation dialog (used internally)
  async startNewOrderDirect(): Promise<void> {
    console.log('🆕 Starting new order directly');
    
    // Clear completed order status and data
    this.isOrderCompleted.set(false);
    this.completedOrderData.set(null);
    
    // Set new order as active
    this.isNewOrderActive.set(true);
    
    // Clear cart and all order-related data
    this.posService.clearCart();
    
    // Reset customer information with next invoice number
    await this.loadNextInvoicePreview();
    const nextInvoice = this.nextInvoiceNumber();
    
    this.customerInfo = {
      soldTo: '',
      tin: '',
      businessAddress: '',
      customerId: ''
    };
    
    this.invoiceNumber = nextInvoice === 'Loading...' ? 'INV-0000-000000' : nextInvoice;
    this.datetime = new Date().toISOString().slice(0, 16);
    
    console.log('🆕 New order started directly - next invoice:', this.invoiceNumber);
  }

  // Payment Dialog Methods
  showPaymentModal(): boolean {
    return this.paymentModalVisible();
  }

  showPaymentDialog(): void {
    console.log('💳 Opening payment dialog');
    // Only reset if the modal was previously closed, don't reset on reopens
    if (!this.paymentModalVisible()) {
      this.paymentAmountTendered = this.cartSummary().netAmount; // Auto-fill with total amount
      this.paymentDescription = '';
    }
    this.paymentModalVisible.set(true);
  }

  closePaymentDialog(): void {
    console.log('💳 Closing payment dialog');
    this.paymentModalVisible.set(false);
    this.paymentAmountTendered = 0;
    this.paymentDescription = '';
  }

  debugTenderedField(): void {
    console.log('🔍 Tendered field debug:', {
      currentValue: this.paymentAmountTendered,
      fieldType: typeof this.paymentAmountTendered,
      modalVisible: this.paymentModalVisible(),
      element: document.getElementById('amount-tendered'),
      cartTotal: this.cartSummary().netAmount
    });
  }

  // Handle input changes for amount tendered
  onAmountTenderedChange(value: any): void {
    console.log('💳 Amount tendered changed to:', value);
    const numValue = parseFloat(value) || 0;
    this.paymentAmountTendered = numValue;
    console.log('💳 Updated paymentAmountTendered to:', this.paymentAmountTendered);
  }

  calculateChange(): number {
    const totalAmount = this.cartSummary().netAmount;
    const tendered = this.paymentAmountTendered || 0;
    const change = tendered - totalAmount;
    return Math.max(0, change); // Don't allow negative change
  }

  async processPayment(): Promise<void> {
    try {
      console.log('💳 Processing payment and completing order...');
      const totalAmount = this.cartSummary().netAmount;
      const tendered = this.paymentAmountTendered || 0;
      
      // Validate payment amount
      if (tendered < totalAmount) {
        console.warn('⚠️ Insufficient amount tendered');
        // You can add a notification here later
        return;
      }
      
      const change = this.calculateChange();
      console.log('💳 Payment validated:', {
        totalAmount,
        tendered,
        change,
        description: this.paymentDescription
      });
      
      // Generate real invoice number when payment is being processed
      let realInvoiceNumber: string;
      try {
        if (this.networkService.isOffline()) {
          // In offline mode, use manual invoice handling
          realInvoiceNumber = this.manualInvoiceInput || 'INV-0000-000000';
        } else {
          // In online mode, get next invoice number from service
          realInvoiceNumber = await this.posService.getNextInvoiceNumberPreview();
        }
        
        // Update the display immediately
        this.nextInvoiceNumber.set(realInvoiceNumber);
        this.invoiceNumber = realInvoiceNumber;
        console.log('📋 Real invoice number generated:', realInvoiceNumber);
      } catch (invoiceError) {
        console.warn('Warning: Could not generate invoice number:', invoiceError);
        realInvoiceNumber = 'INV-0000-000000';
      }
      
      // Close payment dialog first
      this.closePaymentDialog();
      
      // Now complete the order with payment information
      await this.completeOrderWithPayment({
        amountTendered: tendered,
        changeAmount: change,
        paymentDescription: this.paymentDescription
      });
      
    } catch (error) {
      console.error('❌ Error processing payment:', error);
      // Show error dialog
      await this.showConfirmationDialog({
        title: 'Payment Processing Failed',
        message: 'Failed to process payment and save order. Please try again.',
        confirmText: 'OK',
        cancelText: ''
      });
    }
  }

  // Complete order with payment information - save to Firestore
  async completeOrderWithPayment(paymentInfo: {
    amountTendered: number;
    changeAmount: number;
    paymentDescription: string;
  }): Promise<void> {
    try {
      console.log('💾 Completing order with payment info:', paymentInfo);
      
      // Prepare customer info and payments for the new structure
      const processedCustomerInfo = this.processCustomerInfo();
      const paymentsData = {
        amountTendered: paymentInfo.amountTendered,
        changeAmount: paymentInfo.changeAmount,
        paymentDescription: paymentInfo.paymentDescription
      };
      
      console.log('📝 Processed customer info:', processedCustomerInfo);
      console.log('💳 Payment data:', paymentsData);
      
      // Use the invoice service with the new data structure
      const result = await this.posService.processOrderWithInvoiceAndPayment(
        processedCustomerInfo, 
        paymentsData
      );
      
      if (!result || !result.orderId) {
        throw new Error('Failed to process order with invoice');
      }

      console.log('✅ Order processed successfully with new structure:', {
        orderId: result.orderId,
        invoiceNumber: result.invoiceNumber
      });

      // Update the invoice number for display with the final result
      this.invoiceNumber = result.invoiceNumber;
      this.nextInvoiceNumber.set(result.invoiceNumber);

      console.log('📋 Invoice number updated to final result:', result.invoiceNumber);

      // Save customer information if available
      console.log('👤 Saving customer information...');
      const savedCustomer = await this.saveCustomerData();
      if (savedCustomer) {
        console.log('✅ Customer saved successfully:', savedCustomer.customerId);
      }

      // Prepare receipt data with the real order ID and invoice number
      const receiptData = await this.prepareReceiptData(result.orderId);
      
      // Update receipt data with the correct invoice number and payment info
      const updatedReceiptData = { 
        ...receiptData, 
        orderId: result.orderId,
        invoiceNumber: result.invoiceNumber,
        paymentInfo: paymentInfo
      };
      
      // Mark order as completed and store the receipt data for reprinting
      this.isOrderCompleted.set(true);
      this.completedOrderData.set(updatedReceiptData);
      
      // Set receipt data and show modal
      this.receiptDataSignal.set(updatedReceiptData);
      this.isReceiptModalVisibleSignal.set(true);

      console.log('🧾 Receipt modal opened with invoice:', result.invoiceNumber);
      
    } catch (error) {
      console.error('❌ Error completing order with payment:', error);
      throw error; // Re-throw to be handled by processPayment
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

  // Method to reinitialize the component when navigating back to POS
  private async reinitializeComponent(): Promise<void> {
    console.log('🔄 POS COMPONENT: Reinitializing component due to navigation');
    
    // Check if products are already loaded to prevent unnecessary reloading
    const currentProductCount = this.products().length;
    console.log('🔄 Current product count before reinit:', currentProductCount);
    
    // Only reinitialize if we don't have products or user context has changed
    const user = this.authService.getCurrentUser();
    if (currentProductCount > 0 && user?.uid) {
      console.log('🔄 Products already loaded and user authenticated - skipping full reinit');
      // Just update the time and invoice preview
      this.updateCurrentDateTime();
      await this.loadNextInvoicePreview();
      return;
    }
    
    try {
      console.log('🔄 Performing full reinitialization...');
      // Load data first to ensure stores and products are available
      await this.loadData();
      
      // Set current date and time
      this.updateCurrentDateTime();
      
      // Load next invoice number preview
      await this.loadNextInvoicePreview();
      await this.initializeStore(); 
      
      console.log('🔄 POS COMPONENT: Reinitialization completed - products:', this.products().length);
    } catch (error) {
      console.error('🔄 Error reinitializing POS component:', error);
    }
  }

  private async loadData(): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (user?.uid) {
      try {
        // PRIORITY 1: Check IndexedDB for user data first
        let userRole: any = null;
        let useIndexedDBData = false;
        
        try {
          const offlineUserData = await this.indexedDBService.getUserData(user.uid);
          if (offlineUserData?.permissions && offlineUserData.permissions.length > 0) {
            // Use IndexedDB data - handle multiple permissions
            const permission = this.getActivePermission(offlineUserData, offlineUserData.currentStoreId);
            if (permission) {
              userRole = {
                companyId: permission.companyId,
                storeId: offlineUserData.currentStoreId || permission.storeId,
                roleId: permission.roleId
              };
              useIndexedDBData = true;
              console.log('💾 Selected permission from', offlineUserData.permissions.length, 'available permissions');
            }
            console.log('� PRIORITY: Using user role from IndexedDB:', userRole);
          }
        } catch (error) {
          console.log('⚠️ Could not get user role from IndexedDB:', error);
        }
        
        // FALLBACK: Load from database if IndexedDB data not available
        if (!useIndexedDBData) {
          console.log('🗄️ FALLBACK: Loading user roles from database...');
          await this.userRoleService.loadUserRoles();
          userRole = this.userRoleService.getUserRoleByUserId(user.uid);
          console.log('🗄️ User role from database:', userRole);
        }
        
        console.log('user.uid:', user.uid);
        
        if (userRole && userRole.storeId) {
          // Load companies and stores based on user's assigned store
          console.log('🏪 User has specific store access, loading store:', userRole.storeId);
          await this.storeService.loadStores([userRole.storeId]);
          console.log('🏪 Store loading completed, checking stores...');
          
          const loadedStores = this.storeService.getStores();
          console.log('🏪 Loaded stores count:', loadedStores.length);
          console.log('🏪 Loaded stores details:', loadedStores.map(s => ({ id: s.id, name: s.storeName })));
          
          // Load products for the user's company and selected store
          // Note: initializeStore() will be called after this method completes
          console.log('📦 Loading products for company and store...');
          await this.productService.loadProductsByCompanyAndStore(userRole.companyId, userRole.storeId);
          console.log('📦 Product loading completed');
        } else if (userRole && userRole.companyId) {
          // If user has company access but no specific store, load all company stores
          console.log('🏪 User has company access but no specific store, loading all company stores');
          await this.storeService.loadStoresByCompany(userRole.companyId);
          console.log('🏪 Company stores loading completed, checking stores...');
          
          const loadedStores = this.storeService.getStores();
          console.log('🏪 Loaded company stores count:', loadedStores.length);
          console.log('🏪 Loaded company stores details:', loadedStores.map(s => ({ id: s.id, name: s.storeName })));
          
          // Load products for the company (products will be filtered by store after auto-selection)
          console.log('📦 Loading products for company...');
          await this.productService.loadProductsByCompanyAndStore(userRole.companyId);
          console.log('📦 Company product loading completed');
        } else {
          console.warn('No user role found or no store/company assigned to user');
          console.log('Available user role data:', userRole);
          
          // Enhanced fallback for missing user roles
          console.log('🔄 Attempting IndexedDB fallback for missing user roles...');
          try {
            const offlineUserData = await this.indexedDBService.getUserData(user.uid);
            if (offlineUserData?.permissions && offlineUserData.permissions.length > 0) {
              console.log('💾 Found IndexedDB permissions as fallback');
              const permission = this.getActivePermission(offlineUserData);
              
              if (permission?.storeId) {
                console.log('🏪 Loading store from IndexedDB fallback:', permission.storeId);
                await this.storeService.loadStores([permission.storeId]);
                
                if (permission.companyId) {
                  console.log('📦 Loading products from IndexedDB fallback');
                  await this.productService.loadProductsByCompanyAndStore(permission.companyId, permission.storeId);
                }
              } else if (permission?.companyId) {
                console.log('🏪 Loading company stores from IndexedDB fallback:', permission.companyId);
                await this.storeService.loadStoresByCompany(permission.companyId);
                await this.productService.loadProductsByCompanyAndStore(permission.companyId);
              }
            } else {
              console.error('❌ No IndexedDB fallback data available');
            }
          } catch (fallbackError) {
            console.error('❌ IndexedDB fallback failed:', fallbackError);
          }
        }
      } catch (error) {
        console.error('Error in loadData method:', error);
        throw error; // Re-throw to be caught by ngOnInit
      }
    } else {
      console.warn('No authenticated user found');
    }
  }

  private async initializeStore(): Promise<void> {
    console.log('🎯 Desktop initializeStore called - checking stores and loading if needed');
    
    // First, ensure stores are loaded by checking if we have any stores
    const currentUser = this.authService.getCurrentUser();
    let availableStores = this.availableStores();
    
    if (availableStores.length === 0 && currentUser?.uid) {
      console.log('🏪 Desktop No stores available, loading from database...');
      
      try {
        // Load user roles first to get store access permissions
        await this.userRoleService.loadUserRoles();
        
        // Get the current user's role by userId
        const userRole = this.userRoleService.getUserRoleByUserId(currentUser.uid);
        console.log('👤 Desktop User role loaded:', userRole);
        
        if (userRole && userRole.storeId) {
          // Load companies first
          console.log('📊 Desktop Loading companies...');
          await this.companyService.loadCompanies();
          
          // Load stores based on user's assigned store
          console.log('🏪 Desktop Loading stores for user role:', userRole.storeId);
          await this.storeService.loadStores([userRole.storeId]);
          
          // Wait a bit for signals to update
          await new Promise(resolve => setTimeout(resolve, 100));
          
          console.log('✅ Desktop Stores loaded, refreshing available stores...');
        } else {
          console.warn('⚠️ Desktop No user role or store ID found');
          return;
        }
      } catch (error) {
        console.error('❌ Desktop Error loading stores:', error);
        return;
      }
    } else {
      console.log('✅ Desktop Stores already available, count:', availableStores.length);
    }

    // PRIORITY: Use IndexedDB as primary source for all user data (uid, companyId, storeId, roleId)
    try {
      const offlineUserData = await this.indexedDBService.getUserData(currentUser?.uid || '');
      
      if (offlineUserData?.currentStoreId) {
        console.log('💾 PRIORITY: Using IndexedDB data - uid:', offlineUserData.uid, 'storeId:', offlineUserData.currentStoreId);
        
        // Verify the store exists in availableStores before selecting
        availableStores = this.availableStores(); // Refresh after potential loading
        const storeExists = availableStores.find(store => store.id === offlineUserData.currentStoreId);
        
        if (storeExists) {
          console.log('✅ IndexedDB store verified, selecting store');
          await this.selectStore(offlineUserData.currentStoreId);
          console.log('✅ Store selection from IndexedDB completed');
          return; // Success - exit early
        } else {
          console.warn('⚠️ IndexedDB store not found in available stores');
          console.log('🏪 Available stores:', availableStores.map(s => ({ id: s.id, name: s.storeName })));
        }
      }
      
      // If no currentStoreId, try to get from permissions in IndexedDB
      if (offlineUserData?.permissions && offlineUserData.permissions.length > 0) {
        const permission = this.getActivePermission(offlineUserData);
        if (permission?.storeId) {
          console.log('💾 Using storeId from IndexedDB permissions:', permission.storeId);
          availableStores = this.availableStores(); // Refresh after potential loading
          const storeExists = availableStores.find(store => store.id === permission.storeId);
          
          if (storeExists) {
            await this.selectStore(permission.storeId);
            console.log('✅ Store selection from IndexedDB permissions completed');
            return;
          }
        }
      }
    } catch (error) {
      console.log('⚠️ Could not retrieve userData from IndexedDB:', error);
    }

    // FALLBACK: Use current database process
    // Wait for stores to be available with retries
    let retryCount = 0;
    const maxRetries = 10;
    const retryDelay = 500; // 500ms between retries
    
    while (retryCount < maxRetries) {
      const stores = this.availableStores();
      const currentlySelected = this.selectedStoreId();
      
      console.log(`🏪 Store initialization attempt ${retryCount + 1}/${maxRetries} - Available stores:`, stores.length);
      
      if (stores.length > 0) {
        console.log('🏪 Stores found, proceeding with auto-selection');
        console.log('🏪 Currently selected store:', currentlySelected);
        
        // Check if currently selected store is valid in available stores
        const selectedStore = stores.find(store => store.id === currentlySelected);
        
        if (currentlySelected && selectedStore) {
          console.log('✅ Valid store already selected from persistent state:', selectedStore.storeName);
          
          // Load products for the already selected store
          if (selectedStore.companyId) {
            await this.productService.loadProductsByCompanyAndStore(selectedStore.companyId, currentlySelected);
          }
          return; // Success, exit the function
        } else if (currentlySelected && !selectedStore) {
          console.warn('⚠️ Persisted store selection is invalid, clearing and selecting new store');
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
                    console.log('💾 PRIORITY: Using storeId from IndexedDB permissions:', storeIdToSelect);
                    console.log('💾 Selected from', offlineUserData.permissions.length, 'available permissions');
                  }
                }
              }
            }
          } catch (error) {
            console.log('⚠️ Could not get storeId from IndexedDB permissions:', error);
          }
          
          // Fallback to first available store if no IndexedDB store found
          if (!storeIdToSelect) {
            storeIdToSelect = stores[0]?.id || null;
            console.log('🗄️ FALLBACK: Using first available store:', storeIdToSelect);
          }
          
          const storeToSelect = stores.find(store => store.id === storeIdToSelect);
          
          if (storeToSelect?.id) {
            if (stores.length === 1) {
              console.log('🏪 Single store detected, auto-selecting:', storeToSelect.storeName, '(ID:', storeToSelect.id, ')');
            } else {
              console.log('🏪 Multiple stores available, auto-selecting:', storeToSelect.storeName, '(ID:', storeToSelect.id, ')');
            }
            
            await this.selectStore(storeToSelect.id);
            console.log('✅ Auto-selection completed for store:', storeToSelect.storeName);
            
            // Verify the selection worked
            const afterSelection = this.selectedStoreId();
            if (afterSelection === storeToSelect.id) {
              console.log('✅ Store auto-selection verified successful');
              return; // Success, exit the function
            } else {
              console.warn('⚠️ Store auto-selection may have failed - expected:', storeToSelect.id, 'actual:', afterSelection);
            }
          }
        }
        
        // If we reach here, something went wrong but we have stores
        break;
      } else {
        console.log(`⏳ No stores available yet, waiting... (attempt ${retryCount + 1}/${maxRetries})`);
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
      console.error('❌ Desktop No stores available after all retry attempts. Using IndexedDB fallback...');
      
      // Enhanced error reporting for debugging
      console.error('🔍 STORE LOADING FAILURE ANALYSIS:');
      console.error('  - User:', currentUser?.uid);
      console.error('  - User roles loaded:', this.userRoleService);
      console.error('  - Store service debug:', this.storeService.debugStoreStatus());
      console.error('  - Available stores signal:', this.storeService.getStores());
      console.error('  - Network status:', this.networkService.isOffline() ? 'OFFLINE' : 'ONLINE');
      
      // FALLBACK: Use IndexedDB userData.permissions[0].storeId as reliable default
      try {
        const currentUser = this.authService.getCurrentUser();
        const offlineUserData = await this.indexedDBService.getUserData(currentUser?.uid || '');
        
        if (offlineUserData?.permissions && offlineUserData.permissions.length > 0) {
          const fallbackStoreId = offlineUserData.permissions[0].storeId;
          
          if (fallbackStoreId) {
            console.log('🔄 Using IndexedDB fallback storeId:', fallbackStoreId);
            
            // Force select the store from IndexedDB, even if it's not in availableStores
            await this.selectStore(fallbackStoreId);
            
            // Load products for this store
            const fallbackCompanyId = offlineUserData.permissions[0].companyId;
            if (fallbackCompanyId) {
              console.log('📦 Loading products for fallback store - company:', fallbackCompanyId, 'store:', fallbackStoreId);
              await this.productService.loadProductsByCompanyAndStore(fallbackCompanyId, fallbackStoreId);
            }
            
            console.log('✅ IndexedDB fallback store selection completed');
            return;
          }
        }
      } catch (error) {
        console.error('❌ IndexedDB fallback failed:', error);
      }
    } else {
      console.warn('⚠️ Desktop Stores are available but auto-selection failed after retries');
    }
    
    // FINAL PRODUCT LOADING CHECK - Ensure products are loaded for any selected store
    if (finalSelectedStore && finalStores.length > 0) {
      console.log('🔍 Desktop Final check - ensuring products are loaded for selected store:', finalSelectedStore);
      const selectedStoreInfo = finalStores.find(s => s.id === finalSelectedStore);
      
      if (selectedStoreInfo?.companyId) {
        const currentProducts = this.products();
        console.log('📦 Desktop Current products count:', currentProducts.length);
        
        if (currentProducts.length === 0) {
          console.log('📦 Desktop No products found, loading products for company:', selectedStoreInfo.companyId, 'store:', finalSelectedStore);
          try {
            await this.productService.loadProductsByCompanyAndStore(selectedStoreInfo.companyId, finalSelectedStore);
            console.log('✅ Desktop Final product loading completed, products count:', this.products().length);
            console.log('📂 Desktop Categories available:', this.categories().length);
          } catch (error) {
            console.error('❌ Desktop Error in final product loading:', error);
          }
        } else {
          console.log('✅ Desktop Products already loaded, count:', currentProducts.length);
        }
      }
    } else {
      console.warn('⚠️ Desktop No selected store for final product loading check');
    }
  }

  // Event handlers
  async selectStore(storeId: string): Promise<void> {
    console.log('🎯 selectStore called with storeId:', storeId);
    console.log('🏪 Available stores:', this.availableStores().map(s => ({ id: s.id, name: s.storeName, companyId: s.companyId })));
    
    // Set the selected store first
    await this.posService.setSelectedStore(storeId);
    
    // PRIORITY: Get companyId from IndexedDB first, then fallback to database
    let companyId: string | undefined;
    
    try {
      const currentUser = this.authService.getCurrentUser();
      if (currentUser?.uid) {
        const offlineUserData = await this.indexedDBService.getUserData(currentUser.uid);
        console.log('💾 IndexedDB user data:', offlineUserData);
        
        if (offlineUserData?.permissions && offlineUserData.permissions.length > 0) {
          const permission = this.getActivePermission(offlineUserData, storeId);
          console.log('🔑 Active permission found:', permission);
          
          if (permission) {
            companyId = permission.companyId;
            console.log('💾 PRIORITY: Using companyId from IndexedDB:', companyId);
            console.log('💾 Selected permission from', offlineUserData.permissions.length, 'available permissions');
          }
        }
      }
    } catch (error) {
      console.log('⚠️ Could not get companyId from IndexedDB:', error);
    }
    
    // FALLBACK: Get companyId from database store info (like mobile POS)
    if (!companyId) {
      const storeInfo = this.availableStores().find(s => s.id === storeId);
      companyId = storeInfo?.companyId;
      console.log('🗄️ FALLBACK: Using companyId from database store info:', companyId);
      console.log('🗄️ Store info found:', storeInfo);
    }
    
    if (companyId) {
      console.log('📦 Loading products for companyId:', companyId, 'storeId:', storeId);
      await this.productService.loadProductsByCompanyAndStore(companyId, storeId);
      console.log('✅ Product loading completed');
      console.log('🛍️ Total products loaded:', this.productService.getProducts().length);
      
      // Save selected store to IndexedDB for future sessions
      try {
        const currentUser = this.authService.getCurrentUser();
        if (currentUser?.uid) {
          const existingUserData = await this.indexedDBService.getUserData(currentUser.uid);
          if (existingUserData) {
            const updatedUserData = { ...existingUserData, currentStoreId: storeId };
            await this.indexedDBService.saveUserData(updatedUserData);
            console.log('💾 Store selection saved to IndexedDB:', storeId);
          }
        }
      } catch (error) {
        console.log('⚠️ Could not save store selection to IndexedDB:', error);
      }
    } else {
      console.error('❌ No companyId available from IndexedDB or database - cannot load products');
      console.error('❌ This will prevent products from loading for store:', storeId);
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
      
      if (q) {
        // Search for orders with the query
        void this.searchOrders();
      } else {
        // Load recent orders when no search query
        void this.loadRecentOrders();
      }
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
  }

  // Customer panel methods
  toggleSoldToPanel(): void {
    this.isSoldToCollapsedSignal.set(!this.isSoldToCollapsedSignal());
  }

  toggleNavigationPanel(): void {
    this.isNavigationCollapsedSignal.set(!this.isNavigationCollapsedSignal());
  }

  updateCurrentDateTime(): void {
    this.datetime = new Date().toISOString().slice(0, 16);
  }

  generateNewInvoiceNumber(): void {
    this.invoiceNumber = 'INV-0000-000000';
  }

  // Offline invoice handling methods
  showOfflineInvoiceUpdate(): void {
    this.showOfflineInvoiceDialog.set(true);
  }

  proceedWithDefaultInvoice(): void {
    this.showOfflineInvoiceDialog.set(false);
    this.processOfflineOrder();
  }

  async updateOfflineInvoice(newInvoiceNumber: string): Promise<void> {
    if (newInvoiceNumber.trim()) {
      this.invoiceNumber = newInvoiceNumber.trim();
    }
    this.showOfflineInvoiceDialog.set(false);
    await this.processOfflineOrder();
  }

  async processOfflineOrder(): Promise<void> {
    try {
      console.log('📱 Processing offline order with invoice:', this.invoiceNumber);
      
      // Generate a temporary order ID for offline mode
      const tempOrderId = `offline-${Date.now()}`;
      
      // Prepare receipt data with offline invoice number
      const receiptData = await this.prepareReceiptData(tempOrderId);
      
      // Update receipt data with the offline invoice number
      const updatedReceiptData = { 
        ...receiptData, 
        orderId: tempOrderId,
        invoiceNumber: this.invoiceNumber
      };
      
      // Set receipt data and show modal
      this.receiptDataSignal.set(updatedReceiptData);
      this.isReceiptModalVisibleSignal.set(true);

      console.log('🧾 Offline receipt modal opened with invoice:', this.invoiceNumber);
      
      // Clear cart for next order
      this.clearCart();
      
    } catch (error) {
      console.error('❌ Error processing offline order:', error);
      
      // Show error to user
      await this.showConfirmationDialog({
        title: 'Offline Order Error',
        message: `Failed to process offline order: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confirmText: 'OK'
      });
    }
  }

  async addToCart(product: Product): Promise<void> {
    // Check if order is already completed
    if (this.isOrderCompleted()) {
      await this.showConfirmationDialog({
        title: 'Order Already Completed',
        message: 'This order is already completed. Please start a new order to add more items.',
        confirmText: 'Start New Order',
        cancelText: 'Cancel',
        type: 'info'
      }).then(async (confirmed) => {
        if (confirmed) {
          await this.startNewOrderDirect();
        }
      });
      return;
    }

    // Check if new order is active first
    if (!this.canInteractWithProducts()) {
      const confirmed = await this.showConfirmationDialog({
        title: 'Create New Order',
        message: 'Would you like to create a new order?',
        confirmText: 'Yes',
        cancelText: 'No',
        type: 'info'
      });
      
      if (confirmed) {
        // Start new order automatically (but don't add the product)
        await this.startNewOrderDirect();
      }
      return;
    }

    if (product.totalStock <= 0) {
      await this.showConfirmationDialog({
        title: 'Out of Stock',
        message: 'Product is out of stock',
        confirmText: 'OK',
        cancelText: '',
        type: 'warning'
      });
      return;
    }
    this.posService.addToCart(product);
  }

  removeFromCart(productId: string): void {
    // Prevent removal if order is already completed
    if (!this.canRemoveFromCart()) {
      console.warn('❌ Cannot remove items: Order is already completed');
      return;
    }
    this.posService.removeFromCart(productId);
  }

  updateQuantity(productId: string, quantity: number): void {
    // Prevent quantity changes if order is already completed
    if (!this.canChangeQuantity()) {
      console.warn('❌ Cannot change quantity: Order is already completed');
      return;
    }
    this.posService.updateCartItemQuantity(productId, quantity);
  }

  async clearCart(): Promise<void> {
    // Check if order is already completed
    if (this.isOrderCompleted()) {
      await this.showConfirmationDialog({
        title: 'Clear Cart Disabled',
        message: 'This order is already completed. Please start a new order to clear the cart.',
        confirmText: 'Start New Order',
        cancelText: 'Cancel',
        type: 'info'
      }).then(async (confirmed) => {
        if (confirmed) {
          await this.startNewOrderDirect();
        }
      });
      return;
    }

    // Check if new order is active before allowing cart clearing
    if (!this.isNewOrderActive()) {
      console.log('❌ Clear cart blocked: New order must be initiated first');
      return;
    }

    const confirmed = await this.showConfirmationDialog({
      title: 'Clear Cart',
      message: 'Are you sure you want to clear the cart? All items will be removed.',
      confirmText: 'Clear Cart',
      cancelText: 'Cancel',
      type: 'warning'
    });

    if (confirmed) {
      this.posService.clearCart();
      // Reset invoice number to default placeholder
      this.nextInvoiceNumber.set('INV-0000-000000');
      this.invoiceNumber = 'INV-0000-000000';
      console.log('📋 Invoice number reset to default after clearing cart');
    }
  }

  // Reprint receipt for already completed order
  async reprintCompletedOrderReceipt(): Promise<void> {
    try {
      console.log('🖨️ Reprinting receipt for completed order...');
      
      // Prepare receipt data from current cart and order info
      const receiptData = await this.prepareReceiptData('completed-order-' + Date.now());
      
      // Update receipt data with completed order info
      const updatedReceiptData = { 
        ...receiptData, 
        invoiceNumber: this.nextInvoiceNumber(),
        orderId: 'completed-' + this.nextInvoiceNumber()
      };
      
      // Print directly using the new direct print method
      const printResult = await this.printService.printReceiptDirect(updatedReceiptData);
      
      if (printResult.success) {
        console.log(`✅ Receipt reprinted successfully via ${printResult.method}`);
        
        // Show success message
        await this.showConfirmationDialog({
          title: 'Receipt Reprinted',
          message: `Receipt reprinted successfully via ${printResult.method} printer`,
          confirmText: 'OK',
          cancelText: '',
          type: 'info'
        });
      } else {
        throw new Error(printResult.message);
      }
      
    } catch (error) {
      console.error('❌ Error reprinting receipt:', error);
      
      // Show error dialog
      await this.showConfirmationDialog({
        title: 'Reprint Failed',
        message: 'Failed to reprint receipt. Please try again.',
        confirmText: 'OK',
        cancelText: '',
        type: 'warning'
      });
    }
  }

  // Show receipt for already completed order
  async showCompletedOrderReceipt(): Promise<void> {
    try {
      console.log('🧾 Showing receipt for completed order...');
      
      const completedData = this.completedOrderData();
      if (completedData) {
        // Use stored receipt data
        this.receiptDataSignal.set(completedData);
        this.isReceiptModalVisibleSignal.set(true);
        console.log('📄 Showing stored receipt data for completed order');
      } else {
        // Fallback: prepare receipt data from current state
        const receiptData = await this.prepareReceiptData('completed-order-' + Date.now());
        const updatedReceiptData = { 
          ...receiptData, 
          invoiceNumber: this.nextInvoiceNumber(),
          orderId: 'completed-' + this.nextInvoiceNumber()
        };
        
        this.receiptDataSignal.set(updatedReceiptData);
        this.isReceiptModalVisibleSignal.set(true);
        console.log('📄 Showing fallback receipt data for completed order');
      }
      
    } catch (error) {
      console.error('❌ Error showing completed order receipt:', error);
    }
  }

  async processOrder(): Promise<void> {
    try {
      console.log('🎯 Complete Order clicked...');
      
      // Check if order is already completed - if so, just show receipt
      if (this.isOrderCompleted()) {
        console.log('🖨️ Order already completed, showing receipt...');
        await this.showCompletedOrderReceipt();
        return;
      }
      
      // Validate cart has items for new orders
      if (this.cartItems().length === 0) {
        console.warn('⚠️ Cannot process order: Cart is empty');
        return;
      }
      
      // Handle offline mode - skip payment dialog and go directly to invoice preference
      if (this.networkService.isOffline()) {
        console.log('📱 Offline mode - showing invoice preference dialog...');
        await this.showOfflineInvoicePreferenceDialog();
        return;
      }

      // Online mode - Open payment dialog first (no Firestore save yet)
      console.log('💳 Online mode - opening payment dialog for order completion...');
      this.showPaymentDialog();
    } catch (error) {
      console.error('❌ Error processing order:', error);
      
      // Show error in a modal dialog instead of browser alert
      await this.showConfirmationDialog({
        title: 'Order Processing Failed',
        message: 'Failed to process order. Please try again.',
        confirmText: 'OK',
        cancelText: '',
        type: 'danger'
      });
    }
  }

  private async prepareReceiptData(orderId: string): Promise<any> {
    const cartItems = this.cartItems();
    const cartSummary = this.cartSummary();
    const storeInfo = this.currentStoreInfo();
    const customerInfo = this.customerInfo;
    const currentUser = this.authService.currentUser();
    
    // Get company information for tax ID and phone
    let company = null;
    try {
      company = await this.companyService.getActiveCompany();
    } catch (error) {
      console.warn('Could not fetch company info for receipt:', error);
    }
    
    // Get date and invoice number from shared service (receipt panel data)
    const receiptDate = this.posSharedService.orderDate();
    const invoiceNumber = this.posSharedService.invoiceNumber();

    // Determine customer name - if soldTo is empty or default, treat as N/A
    const customerName = customerInfo.soldTo && customerInfo.soldTo.trim() && customerInfo.soldTo !== 'Walk-in Customer' 
      ? customerInfo.soldTo.trim() 
      : null;

    // Determine payment method based on cash/charge selection
    const paymentMethod = this.getPaymentMethodText();

    // Always use current user as cashier since they're the one doing the POS transaction
    // Whether they're a cashier, manager, or higher - they are the one processing the sale
    const cashierName = currentUser?.displayName || currentUser?.email || 'Unknown Cashier';

    return {
      orderId,
      invoiceNumber: invoiceNumber || this.invoiceNumber,
      receiptDate: receiptDate, // Date from shared service
      storeInfo: {
        storeName: company?.name || (storeInfo as any)?.storeName || 'Unknown Store',
        address: company?.address || (storeInfo as any)?.address || 'Store Address',
        phone: company?.phone || (storeInfo as any)?.phone || 'N/A', // 🔥 Use company phone
        email: company?.email || storeInfo?.email || 'N/A', // 🔥 Use company email
        tin: company?.taxId || company?.tin || (storeInfo as any)?.tinNumber || 'N/A', // 🔥 Use company tax ID/TIN
        invoiceType: (storeInfo as any)?.invoiceType || 'SALES INVOICE',
        birPermitNo: company?.birPermitNo || (storeInfo as any)?.birPermitNo || null,
        minNumber: (storeInfo as any)?.minNumber || null,
        serialNumber: (storeInfo as any)?.serialNumber || null,
        inclusiveSerialNumber: company?.inclusiveSerialNumber || (storeInfo as any)?.inclusiveSerialNumber || null
      },
      customerName: customerName,
      customerAddress: customerName ? (customerInfo.businessAddress || 'N/A') : null,
      customerTin: customerName ? (customerInfo.tin || 'N/A') : null,
      cashier: cashierName,
      paymentMethod: paymentMethod, // Add payment method
      isCashSale: this.isCashSale(),
      isChargeSale: this.isChargeSale(),
      items: cartItems.map(item => ({
        productName: item.productName,
        skuId: item.skuId,
        quantity: item.quantity,
        unitType: item.unitType,
        sellingPrice: item.sellingPrice,
        total: item.total,
        vatAmount: item.vatAmount,
        discountAmount: item.discountAmount,
        quantityWithUnit: `${item.quantity} ${this.getUnitTypeDisplay(item.unitType)}`
      })),
      subtotal: cartSummary.grossAmount,
      vatAmount: cartSummary.vatAmount,
      vatExempt: cartSummary.vatExemptSales,
      discount: cartSummary.productDiscountAmount + cartSummary.orderDiscountAmount,
      totalAmount: cartSummary.netAmount,
      vatRate: 12, // Standard VAT rate
      orderDiscount: this.orderDiscount() // Include order discount information
    };
  }

  // Receipt modal methods
  closeReceiptModal(): void {
    this.isReceiptModalVisibleSignal.set(false);
    this.receiptDataSignal.set(null);
    
    // Don't clear cart automatically - let user decide when to start new order
  }

  // New Order - clears everything for a fresh start
  async startNewOrder(): Promise<void> {
    const confirmed = await this.showConfirmationDialog({
      title: 'Start New Order',
      message: 'Start a new order? This will clear the current cart and all customer information.',
      confirmText: 'Start New Order',
      cancelText: 'Cancel',
      type: 'warning'
    });

    if (confirmed) {
      // Set new order as active
      this.isNewOrderActive.set(true);
      
      // Clear cart and all order-related data
      this.posService.clearCart();
      
      // Reset customer information with next invoice number
      await this.loadNextInvoicePreview();
      const nextInvoice = this.nextInvoiceNumber();
      
      this.customerInfo = {
        soldTo: '',
        tin: '',
        businessAddress: '',
        customerId: ''
      };
      
      this.invoiceNumber = nextInvoice === 'Loading...' ? 'INV-0000-000000' : nextInvoice;
      this.datetime = new Date().toISOString().slice(0, 16);
      
      console.log('🆕 New order started - all data cleared, next invoice:', this.invoiceNumber);
    }
  }

  async printReceipt(): Promise<void> {
    const receiptData = this.receiptData();
    if (!receiptData) {
      console.error('No receipt data available for printing');
      return;
    }

    try {
      console.log('🖨️ Print Receipt clicked - Order already processed, just printing...');
      console.log('🖨️ Receipt data:', {
        orderId: receiptData.orderId,
        invoiceNumber: receiptData.invoiceNumber
      });

      // 🎯 NEW: Use direct hardware print - bypasses browser dialog when hardware is connected
      console.log('🎯 Checking for hardware printers and printing directly...');
      const printResult = await this.printService.printReceiptDirect(receiptData);
      
      if (printResult.success) {
        console.log(`✅ Receipt printed successfully via ${printResult.method}:`, receiptData.orderId);
        console.log(`📄 Print details: ${printResult.message}`);
        
        // Show success message to user
        if (printResult.method !== 'Browser') {
          await this.showConfirmationDialog({
            title: 'Print Successful',
            message: `Receipt printed successfully via ${printResult.method} printer`,
            confirmText: 'OK',
            cancelText: '',
            type: 'info'
          });
        }
        
        // Close the modal after successful print
        this.closeReceiptModal();
      } else {
        throw new Error(printResult.message);
      }
      
    } catch (error) {
      console.error('Error during print process:', error);
      
      // Show error in a modal dialog instead of browser alert
      await this.showConfirmationDialog({
        title: 'Print Receipt Failed',
        message: 'Failed to print receipt. Please check your printer connection and try printing again.',
        confirmText: 'OK',
        cancelText: '',
        type: 'warning'
      });
    }
  }

  private async saveCustomerData(): Promise<Customer | null> {
    try {
      const currentUser = this.authService.currentUser();
      if (!currentUser) {
        console.log('No authenticated user found, skipping customer save');
        return null;
      }

      const storeInfo = this.currentStoreInfo();
      const selectedStore = this.selectedStoreId();
      
      if (!storeInfo?.companyId || !selectedStore) {
        console.log('Missing company or store info, skipping customer save');
        return null;
      }

      // Check if order has discount that might indicate PWD/Senior status
      const orderDiscount = this.posService.orderDiscount();
      const isPWD = orderDiscount?.type === 'PWD';
      const isSeniorCitizen = orderDiscount?.type === 'SENIOR';
      
      // Prepare customer form data
      const customerFormData: CustomerFormData = {
        soldTo: this.customerInfo.soldTo,
        tin: this.customerInfo.tin,
        businessAddress: this.customerInfo.businessAddress,
        exemptionId: orderDiscount?.exemptionId,
        isSeniorCitizen,
        isPWD
      };

      // Save customer using the customer service
      const savedCustomer = await this.customerService.saveCustomerFromPOS(
        customerFormData,
        storeInfo.companyId,
        selectedStore
      );

      return savedCustomer;
    } catch (error) {
      console.error('Error saving customer data:', error);
      return null;
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
      paymentMethod: receiptData.paymentMethod?.toLowerCase() || 'cash', // Use actual payment method from receipt
      amountTendered: cartSummary.netAmount || receiptData.totalAmount, // Assume exact payment for now
      change: 0, // No change for exact payment
      status: 'completed' as const
    };

    // Save transaction using the transaction service
    return await this.transactionService.createTransaction(transactionData);
  }

  // Discount modal methods
  showDiscountModal(): void {
    this.isDiscountModalVisibleSignal.set(true);
  }

  closeDiscountModal(): void {
    this.isDiscountModalVisibleSignal.set(false);
  }

  applyOrderDiscount(discount: OrderDiscount): void {
    this.posService.setOrderDiscount(discount);
    this.closeDiscountModal();
  }

  removeOrderDiscount(): void {
    this.posService.removeOrderDiscount();
  }

  // Confirmation dialog methods
  showConfirmationDialog(data: ConfirmationDialogData): Promise<boolean> {
    return new Promise((resolve) => {
      this.confirmationDialogDataSignal.set(data);
      this.isConfirmationDialogVisibleSignal.set(true);
      
      // Store the resolve function for use in dialog action handlers
      (this as any)._confirmationResolve = resolve;
    });
  }

  onConfirmationConfirmed(): void {
    this.isConfirmationDialogVisibleSignal.set(false);
    this.confirmationDialogDataSignal.set(null);
    
    // Resolve with true (confirmed)
    if ((this as any)._confirmationResolve) {
      (this as any)._confirmationResolve(true);
      (this as any)._confirmationResolve = null;
    }
  }

  onConfirmationCancelled(): void {
    this.isConfirmationDialogVisibleSignal.set(false);
    this.confirmationDialogDataSignal.set(null);
    
    // Resolve with false (cancelled)
    if ((this as any)._confirmationResolve) {
      (this as any)._confirmationResolve(false);
      (this as any)._confirmationResolve = null;
    }
  }

  // Offline Invoice Preference Dialog Methods
  async showOfflineInvoicePreferenceDialog(): Promise<void> {
    // Check if user has a saved preference
    const savedPreference = await this.indexedDBService.getSetting('offlineInvoicePreference');
    
    if (savedPreference && savedPreference.preference) {
      // User has saved preference, use it directly
      console.log('📱 Using saved offline invoice preference:', savedPreference.preference);
      await this.processOfflineOrderWithPreference(savedPreference);
      return;
    }

    // No saved preference, show dialog
    // Initialize manual input with current invoice number
    this.manualInvoiceInput = this.invoiceNumber || 'INV-0000-000000';
    this.showOfflineInvoiceDialog.set(true);
  }

  async onOfflineInvoiceConfirmed(preference: 'manual' | 'auto', manualInvoiceNumber?: string): Promise<void> {
    console.log('📱 Offline invoice preference selected:', preference, manualInvoiceNumber);
    
    const preferenceData = {
      preference,
      manualInvoiceNumber: preference === 'manual' ? manualInvoiceNumber : undefined
    };

    // Save preference to IndexedDB
    await this.indexedDBService.saveSetting('offlineInvoicePreference', preferenceData);
    
    // Close dialog
    this.showOfflineInvoiceDialog.set(false);
    
    // Process the order with the preference
    await this.processOfflineOrderWithPreference(preferenceData);
  }

  async processOfflineOrderWithPreference(preferenceData: { preference: 'manual' | 'auto'; manualInvoiceNumber?: string }): Promise<void> {
    // Generate real invoice number based on preference
    let realInvoiceNumber: string;
    
    if (preferenceData.preference === 'manual' && preferenceData.manualInvoiceNumber) {
      // Use manual invoice number
      realInvoiceNumber = preferenceData.manualInvoiceNumber;
    } else {
      // Auto-increment: try to get next invoice from service, fallback to increment
      try {
        realInvoiceNumber = await this.posService.getNextInvoiceNumberPreview();
      } catch (error) {
        console.warn('Could not get next invoice number, using fallback increment:', error);
        // Fallback: Auto-increment from default
        realInvoiceNumber = 'INV-0001-000001';
      }
    }

    // Update invoice number displays
    this.invoiceNumber = realInvoiceNumber;
    this.nextInvoiceNumber.set(realInvoiceNumber);
    console.log('📋 Real invoice number set for offline order:', realInvoiceNumber);

    // Process the offline order
    await this.processOfflineOrder();
  }

  // Dialog interaction methods
  onInvoicePreferenceChange(preference: 'manual' | 'auto'): void {
    console.log('📱 Invoice preference changed to:', preference);
    this.offlineInvoicePreference.set(preference);
    
    // Initialize manual input with current invoice number if switching to manual
    if (preference === 'manual') {
      this.manualInvoiceInput = this.invoiceNumber || 'INV-0000-000000';
    }
  }

  onManualInvoiceNumberChange(invoiceNumber: string): void {
    this.offlineManualInvoiceNumber.set(invoiceNumber);
    this.manualInvoiceInput = invoiceNumber;
  }

  onOfflineInvoiceCancelled(): void {
    this.showOfflineInvoiceDialog.set(false);
  }

  onOfflineInvoiceOk(): void {
    const preference = this.offlineInvoicePreference();
    const manualNumber = preference === 'manual' ? this.manualInvoiceInput : undefined;
    this.onOfflineInvoiceConfirmed(preference, manualNumber);
  }

  // Helper method to get unit type display
  getUnitTypeDisplay(unitType?: string): string {
    if (!unitType || unitType === 'N/A') return '';
    return unitType === 'pieces' ? 'pc(s)' : unitType;
  }

  // Helper method to get payment method text
  getPaymentMethodText(): string {
    const isCash = this.isCashSale();
    const isCharge = this.isChargeSale();
    
    if (isCash && isCharge) {
      return 'Cash & Charge';
    } else if (isCash) {
      return 'Cash';
    } else if (isCharge) {
      return 'Charge';
    } else {
      return 'Cash'; // Default to cash if neither is selected
    }
  }

  // Helper method to get order status color
  getOrderStatusColor(status: string): string {
    switch (status?.toLowerCase()) {
      case 'paid':
      case 'completed':
        return '#059669'; // Green
      case 'pending':
        return '#d97706'; // Orange
      case 'cancelled':
        return '#dc2626'; // Red
      case 'refunded':
        return '#7c3aed'; // Purple
      default:
        return '#6b7280'; // Gray
    }
  }

  // 🔍 DEBUG: Manual product refresh for debugging
  async debugRefreshProducts(): Promise<void> {
    console.log('🔍 DEBUG: Manual product refresh triggered');
    const storeId = this.selectedStoreId();
    const storeInfo = this.currentStoreInfo();
    
    console.log('🔍 DEBUG: Current state before refresh:', {
      selectedStoreId: storeId,
      storeInfo: storeInfo,
      productsCount: this.products().length,
      filteredProductsCount: this.filteredProducts().length
    });
    
    if (storeInfo?.companyId && storeId) {
      console.log('🔍 DEBUG: Reloading products...');
      await this.productService.loadProductsByCompanyAndStore(storeInfo.companyId, storeId);
      
      // Wait a moment for signals to update
      setTimeout(() => {
        console.log('🔍 DEBUG: After refresh:', {
          productsCount: this.products().length,
          filteredProductsCount: this.filteredProducts().length,
          sampleProducts: this.products().slice(0, 3).map(p => ({ name: p.productName, storeId: p.storeId }))
        });
      }, 200);
    } else {
      console.log('🔍 DEBUG: Cannot refresh - missing store info');
    }
  }

  // Helper method to get discount display name
  getDiscountDisplayName(): string {
    const discount = this.orderDiscount();
    if (!discount) return '';
    
    let discountMethod = '';
    if (discount.percentage) {
      discountMethod = ` (${discount.percentage}%)`;
    } else if (discount.fixedAmount) {
      discountMethod = ` (₱${discount.fixedAmount.toFixed(2)})`;
    }
    
    if (discount.type === 'PWD') return `PWD Discount${discountMethod}`;
    if (discount.type === 'SENIOR') return `Senior Citizen Discount${discountMethod}`;
    if (discount.type === 'CUSTOM' && discount.customType) {
      return `${discount.customType} Discount${discountMethod}`;
    }
    return `Custom Discount${discountMethod}`;
  }
}
