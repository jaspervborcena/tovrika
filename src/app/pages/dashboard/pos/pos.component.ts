import { Component, OnInit, AfterViewInit, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
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
export class PosComponent implements OnInit, AfterViewInit {

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
    } else {
      console.log('🏪 Store details:', stores.map(s => ({ id: s.id, name: s.storeName, companyId: s.companyId })));
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

  async loadNextInvoicePreview(): Promise<void> {
    try {
      // Check if online/offline
      if (this.networkService.isOffline()) {
        console.log('📋 Offline mode: Using default invoice number');
        this.nextInvoiceNumber.set('INV-0000-000000 (Offline)');
        this.customerInfo.invoiceNumber = 'INV-0000-000000';
        return;
      }

      const nextInvoice = await this.posService.getNextInvoiceNumberPreview();
      this.nextInvoiceNumber.set(nextInvoice);
      
      // Update the customer info invoice number for display
      this.customerInfo.invoiceNumber = nextInvoice;
      console.log('📋 Next invoice number loaded:', nextInvoice);
    } catch (error) {
      console.error('Error loading invoice preview:', error);
      this.nextInvoiceNumber.set('INV-0000-000000 (Error)');
      this.customerInfo.invoiceNumber = 'INV-0000-000000';
    }
  }

  readonly filteredProducts = computed(() => {
    let filtered = this.products();

    // Use selectedStoreId for filtering (this will already be set from IndexedDB via initializeStore)
    // The IndexedDB-first logic is handled in loadData() and initializeStore() methods
    let storeId = this.selectedStoreId();

    // Filter by store only (no company filtering needed since products are already loaded by store)
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
  
  // Customer information for order (like mobile version)
  customerInfo = {
    soldTo: '',
    tin: '',
    businessAddress: '',
    invoiceNumber: 'INV-0000-000000',
    datetime: new Date().toISOString().slice(0, 16) // Format for datetime-local input
  };

  // UI State for collapsible customer panel
  private isSoldToCollapsedSignal = signal<boolean>(true);
  readonly isSoldToCollapsed = computed(() => this.isSoldToCollapsedSignal());
  
  // Navigation collapse state for desktop POS
  private isNavigationCollapsedSignal = signal<boolean>(false);
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
  openOrderReceipt(order: any): void {
    try {
      console.log('Opening receipt for order:', order);
      
      // Convert order data to receipt format
      const receiptData = this.convertOrderToReceiptData(order);
      
      // Set receipt data and show modal
      this.receiptDataSignal.set(receiptData);
      this.isReceiptModalVisibleSignal.set(true);
      
      // Close the order details modal
      this.closeOrder();
    } catch (error) {
      console.error('Error opening order receipt:', error);
    }
  }

  // Convert order data to receipt format
  private convertOrderToReceiptData(order: any): any {
    const storeInfo = this.currentStoreInfo();
    
    return {
      orderId: order.id,
      invoiceNumber: order.invoiceNumber,
      receiptDate: order.date || order.createdAt,
      storeInfo: {
        storeName: storeInfo?.storeName || 'Unknown Store',
        address: storeInfo?.address || 'Store Address',
        phone: (storeInfo as any)?.phone || 'N/A',
        email: storeInfo?.email || 'N/A',
        tin: (storeInfo as any)?.tinNumber || 'N/A',
        invoiceType: (storeInfo as any)?.invoiceType || 'SALES INVOICE',
        birPermitNo: (storeInfo as any)?.birPermitNo || null,
        minNumber: (storeInfo as any)?.minNumber || null,
        serialNumber: (storeInfo as any)?.serialNumber || null,
        inclusiveSerialNumber: (storeInfo as any)?.inclusiveSerialNumber || null
      },
      customerName: order.soldTo && order.soldTo !== 'Walk-in Customer' ? order.soldTo : null,
      customerAddress: order.businessAddress || null,
      customerTin: order.tin || null,
      cashier: order.assignedCashierId || 'Unknown Cashier',
      paymentMethod: order.cashSale ? 'Cash' : 'Charge', // Determine from order data
      isCashSale: order.cashSale || true,
      isChargeSale: !order.cashSale || false,
      items: order.items || [],
      subtotal: order.grossAmount || order.totalAmount,
      vatAmount: order.vatAmount || 0,
      vatExempt: order.vatExemptAmount || 0,
      discount: order.discountAmount || 0,
      totalAmount: order.totalAmount,
      vatRate: 12,
      orderDiscount: order.exemptionId ? {
        type: 'CUSTOM',
        exemptionId: order.exemptionId
      } : null
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
    try {
      await this.loadData();
      // Set current date and time
      this.updateCurrentDateTime();
      
      // Load next invoice number preview
      await this.loadNextInvoicePreview();
      
      // Debug: log current user and stores to ensure user.storeIds and stores list are correct
      console.log('POS init - currentUser:', this.authService.getCurrentUser());
      console.log('POS init - all stores:', this.storeService.getStores());
    } catch (error) {
      console.error('Error initializing POS:', error);
    }
  }

  async ngAfterViewInit(): Promise<void> {
    // Auto-select store after DOM is fully initialized and data is loaded
    try {
      await this.initializeStore();
      console.log('POS AfterViewInit - availableStores:', this.availableStores());
      console.log('POS AfterViewInit - selectedStoreId after auto-selection:', this.selectedStoreId());
      
      // Multiple fallback attempts to ensure store selection works
      const fallbackIntervals = [500, 1000, 2000]; // Try after 0.5s, 1s, and 2s
      
      fallbackIntervals.forEach((delay, index) => {
        setTimeout(async () => {
          if (!this.selectedStoreId() && this.availableStores().length > 0) {
            console.log(`🔄 Fallback auto-selection triggered (attempt ${index + 1})`);
            await this.initializeStore();
          }
        }, delay);
      });
    } catch (error) {
      console.error('Error in auto-store selection:', error);
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
    // PRIORITY 1: Check IndexedDB first for stored user data
    try {
      const currentUser = this.authService.getCurrentUser();
      if (currentUser?.uid) {
        const offlineUserData = await this.indexedDBService.getUserData(currentUser.uid);
        if (offlineUserData?.currentStoreId) {
          console.log('💾 PRIORITY: Using storeId from IndexedDB:', offlineUserData.currentStoreId);
          await this.selectStore(offlineUserData.currentStoreId);
          return; // Success - exit early
        }
        console.log('💾 No currentStoreId found in IndexedDB, falling back to database process');
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
          this.posService.setSelectedStore('');
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
    if (finalStores.length === 0) {
      console.error('❌ No stores available after all retry attempts. Check user permissions and store loading.');
    } else {
      console.warn('⚠️ Stores are available but auto-selection failed after retries');
    }
  }

  // Event handlers
  async selectStore(storeId: string): Promise<void> {
    console.log('🎯 selectStore called with storeId:', storeId);
    console.log('🏪 Available stores:', this.availableStores().map(s => ({ id: s.id, name: s.storeName, companyId: s.companyId })));
    
    // Set the selected store first
    this.posService.setSelectedStore(storeId);
    
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
    this.customerInfo.datetime = new Date().toISOString().slice(0, 16);
  }

  generateNewInvoiceNumber(): void {
    this.customerInfo.invoiceNumber = 'INV-0000-000000';
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
      this.customerInfo.invoiceNumber = newInvoiceNumber.trim();
    }
    this.showOfflineInvoiceDialog.set(false);
    await this.processOfflineOrder();
  }

  async processOfflineOrder(): Promise<void> {
    try {
      console.log('📱 Processing offline order with invoice:', this.customerInfo.invoiceNumber);
      
      // Generate a temporary order ID for offline mode
      const tempOrderId = `offline-${Date.now()}`;
      
      // Prepare receipt data with offline invoice number
      const receiptData = this.prepareReceiptData(tempOrderId);
      
      // Update receipt data with the offline invoice number
      const updatedReceiptData = { 
        ...receiptData, 
        orderId: tempOrderId,
        invoiceNumber: this.customerInfo.invoiceNumber
      };
      
      // Set receipt data and show modal
      this.receiptDataSignal.set(updatedReceiptData);
      this.isReceiptModalVisibleSignal.set(true);

      console.log('🧾 Offline receipt modal opened with invoice:', this.customerInfo.invoiceNumber);
      
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
    this.posService.removeFromCart(productId);
  }

  updateQuantity(productId: string, quantity: number): void {
    this.posService.updateCartItemQuantity(productId, quantity);
  }

  async clearCart(): Promise<void> {
    const confirmed = await this.showConfirmationDialog({
      title: 'Clear Cart',
      message: 'Are you sure you want to clear the cart? All items will be removed.',
      confirmText: 'Clear Cart',
      cancelText: 'Cancel',
      type: 'warning'
    });

    if (confirmed) {
      this.posService.clearCart();
    }
  }

  async processOrder(): Promise<void> {
    try {
      console.log('🎯 Complete Order clicked - Processing order with invoice increment...');
      
      // Handle offline mode
      if (this.networkService.isOffline()) {
        // Check if invoice number is still default, show dialog to update if needed
        if (this.customerInfo.invoiceNumber === 'INV-0000-000000') {
          this.showOfflineInvoiceDialog.set(true);
          return; // Wait for user to handle the dialog
        }
        
        // Process offline order with hardcoded invoice number
        await this.processOfflineOrder();
        return;
      }
      
      // Online mode - use the invoice service to process the order with proper invoice numbering
      const result = await this.posService.processOrderWithInvoice();
      
      if (!result || !result.orderId) {
        throw new Error('Failed to process order with invoice');
      }

      console.log('✅ Order processed successfully:', {
        orderId: result.orderId,
        invoiceNumber: result.invoiceNumber
      });

      // Update the customer info with the new invoice number for display
      this.customerInfo.invoiceNumber = result.invoiceNumber;

      // Update the next invoice preview for the next order
      await this.loadNextInvoicePreview();

      // Save customer information if available
      console.log('👤 Saving customer information...');
      const savedCustomer = await this.saveCustomerData();
      if (savedCustomer) {
        console.log('✅ Customer saved successfully:', savedCustomer.customerId);
      }

      // Prepare receipt data with the real order ID and invoice number
      const receiptData = this.prepareReceiptData(result.orderId);
      
      // Update receipt data with the correct invoice number
      const updatedReceiptData = { 
        ...receiptData, 
        orderId: result.orderId,
        invoiceNumber: result.invoiceNumber
      };
      
      // Set receipt data and show modal
      this.receiptDataSignal.set(updatedReceiptData);
      this.isReceiptModalVisibleSignal.set(true);

      console.log('🧾 Receipt modal opened with invoice:', result.invoiceNumber);
      
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

    // Determine payment method based on cash/charge selection
    const paymentMethod = this.getPaymentMethodText();

    return {
      orderId,
      invoiceNumber: invoiceNumber || customerInfo.invoiceNumber,
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
      // Clear cart and all order-related data
      this.posService.clearCart();
      
      // Reset customer information with next invoice number
      await this.loadNextInvoicePreview();
      const nextInvoice = this.nextInvoiceNumber();
      
      this.customerInfo = {
        soldTo: '',
        tin: '',
        businessAddress: '',
        invoiceNumber: nextInvoice === 'Loading...' ? 'INV-0000-000000' : nextInvoice,
        datetime: new Date().toISOString().slice(0, 16)
      };
      
      console.log('New order started - all data cleared, next invoice:', this.customerInfo.invoiceNumber);
    }
  }

  async printReceipt(printerType?: string): Promise<void> {
    const receiptData = this.receiptData();
    if (!receiptData) {
      console.error('No receipt data available for printing');
      return;
    }

    // Type guard for printer type
    const validPrinterType = ['thermal', 'network', 'browser'].includes(printerType || '') 
      ? printerType as 'thermal' | 'network' | 'browser'
      : 'thermal';

    try {
      console.log('🖨️ Print Receipt clicked - Order already processed, just printing...');
      console.log('🖨️ Receipt data:', {
        orderId: receiptData.orderId,
        invoiceNumber: receiptData.invoiceNumber
      });

      // Save the transaction to the database (for transaction history)
      console.log('💾 Saving transaction for history...');
      const savedTransaction = await this.saveTransaction(receiptData);
      console.log('✅ Transaction saved successfully:', savedTransaction.transactionNumber);

      // Print the receipt (order is already saved)
      await this.printService.printReceipt(receiptData, validPrinterType);
      console.log(`✅ Receipt sent to ${validPrinterType} printer for order:`, receiptData.orderId);
      
      // Close the modal after successful print
      this.closeReceiptModal();
      
    } catch (error) {
      console.error('Error during save and print process:', error);
      
      // Show error in a modal dialog instead of browser alert
      await this.showConfirmationDialog({
        title: 'Print Receipt Failed',
        message: 'Failed to save order and print receipt. Please try again.',
        confirmText: 'OK',
        cancelText: '',
        type: 'danger'
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
