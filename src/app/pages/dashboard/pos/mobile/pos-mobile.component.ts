import { Component, OnInit, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HeaderComponent } from '../../../../shared/components/header/header.component';
import { ProductService } from '../../../../services/product.service';
import { PosService } from '../../../../services/pos.service';
import { AuthService } from '../../../../services/auth.service';
import { CompanyService } from '../../../../services/company.service';
import { OrderService } from '../../../../services/order.service';
import { StoreService, Store } from '../../../../services/store.service';
import { UserRoleService } from '../../../../services/user-role.service';
import { CurrencyService } from '../../../../services/currency.service';
import { Product } from '../../../../interfaces/product.interface';
import { CartItem, ProductViewType } from '../../../../interfaces/pos.interface';

@Component({
  selector: 'app-pos-mobile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, HeaderComponent],
  templateUrl: './pos-mobile.component.html',
  styleUrls: ['./pos-mobile.component.css']
})
export class PosMobileComponent implements OnInit {
  // Services
  private productService = inject(ProductService);
  private posService = inject(PosService);
  private authService = inject(AuthService);
  private companyService = inject(CompanyService);
  private storeService = inject(StoreService);
  private orderService = inject(OrderService);
  private userRoleService = inject(UserRoleService);
  public currencyService = inject(CurrencyService);

  // Signals
  private searchQuerySignal = signal<string>('');
  private selectedCategorySignal = signal<string>('all');
  private currentViewSignal = signal<ProductViewType>('grid');

  // Computed properties
  readonly searchQuery = computed(() => this.searchQuerySignal());
  readonly selectedCategory = computed(() => this.selectedCategorySignal());
  readonly currentView = computed(() => this.currentViewSignal());
  
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
        p.barcodeId?.toLowerCase().includes(query) ||
        p.qrCode?.toLowerCase().includes(query)
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
  
  // Customer information for order
  customerInfo = {
    soldTo: '',
    tin: '',
    businessAddress: '',
    invoiceNumber: `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
    datetime: new Date().toISOString().slice(0, 16) // Format for datetime-local input
  };

  // UI State for collapsible panels
  private isSoldToCollapsedSignal = signal<boolean>(true);
  readonly isSoldToCollapsed = computed(() => this.isSoldToCollapsedSignal());
  
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
      
      // Enhanced search - can search by invoice number, QR code, or order ID
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

  async ngOnInit(): Promise<void> {
    try {
      // Set up a watcher to monitor store changes
      const storeWatcher = setInterval(() => {
        const currentStoreCount = this.availableStores().length;
        if (currentStoreCount === 0) {
          console.warn('🚨 STORES DISAPPEARED! Store count is now 0');
          console.log('🔍 StoreService stores:', this.storeService.getStores().length);
          console.log('🔍 Current user:', this.authService.getCurrentUser());
        }
      }, 2000);
      
      // Clear watcher after 30 seconds
      setTimeout(() => clearInterval(storeWatcher), 30000);
      
      this.initializeStore();
      await this.loadData();
      
      // debug: log current user and stores to ensure user.storeIds and stores list are correct
      console.log('POS init - currentUser:', this.authService.getCurrentUser());
      console.log('POS init - all stores:', this.storeService.getStores());
      console.log('POS init - availableStores:', this.availableStores());
    } catch (error) {
      console.error('Error initializing POS:', error);
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
          this.initializeStore();
          
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

  private initializeStore(): void {
    console.log('🎯 initializeStore called');
    const stores = this.availableStores();
    console.log('🎯 Available stores for initialization:', stores.length);
    
    const currentSelectedStore = this.selectedStoreId();
    console.log('🎯 Currently selected store:', currentSelectedStore);
    
    if (stores.length > 0 && !currentSelectedStore) {
      console.log('🎯 Selecting first store:', stores[0].storeName, 'ID:', stores[0].id);
      this.selectStore(stores[0].id!);
    } else if (stores.length === 0) {
      console.warn('⚠️ No stores available for initialization');
    } else {
      console.log('✅ Store already selected:', currentSelectedStore);
    }
  }

  // Event handlers
  async selectStore(storeId: string): Promise<void> {
    this.posService.setSelectedStore(storeId);
    const storeInfo = this.availableStores().find(s => s.id === storeId);
    if (storeInfo?.companyId) {
      await this.productService.loadProductsByCompanyAndStore(storeInfo.companyId, storeId);
    }
  }

  setSelectedCategory(category: string): void {
    this.selectedCategorySignal.set(category);
  }

  setCurrentView(view: ProductViewType): void {
    this.currentViewSignal.set(view);
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
    this.searchQuerySignal.set(value);
  }

  clearSearch(): void {
    this.searchQuerySignal.set('');
    // If on Orders tab, also clear orders and load recent ones
    if (this.accessTab() === 'Orders') {
      this.setOrderSearchQuery('');
      void this.loadRecentOrders();
    }
  }

  addToCart(product: Product): void {
    if (product.totalStock <= 0) {
      alert('Product is out of stock');
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

  toggleVatExemption(productId: string): void {
    this.posService.toggleVatExemption(productId);
  }

  clearCart(): void {
    if (confirm('Are you sure you want to clear the cart?')) {
      this.posService.clearCart();
    }
  }

  generateNewInvoiceNumber(): void {
    this.customerInfo.invoiceNumber = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  }

  async processOrder(): Promise<void> {
    try {
      // Convert datetime string to Date object
      const orderDate = this.customerInfo.datetime ? new Date(this.customerInfo.datetime) : new Date();
      
      const customerData = {
        ...this.customerInfo,
        date: orderDate // Convert to date for backend compatibility
      };
      
      const orderId = await this.posService.processOrder('cash', customerData);
      if (orderId) {
        alert(`Order completed successfully! Order ID: ${orderId}`);
        // Reset form for next customer
        this.resetCustomerForm();
        // TODO: Print receipt or show receipt modal
      }
    } catch (error) {
      console.error('Error processing order:', error);
      alert('Failed to process order. Please try again.');
    }
  }

  resetCustomerForm(): void {
    this.customerInfo = {
      soldTo: '',
      tin: '',
      businessAddress: '',
      invoiceNumber: '',
      datetime: new Date().toISOString().slice(0, 16) // Format for datetime-local input
    };
    this.generateNewInvoiceNumber();
  }

  toggleSoldToPanel(): void {
    this.isSoldToCollapsedSignal.set(!this.isSoldToCollapsedSignal());
  }
}
