import { Component, OnInit, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { ProductService } from '../../../services/product.service';
import { PosService } from '../../../services/pos.service';
import { PosSharedService } from '../../../services/pos-shared.service';
import { AuthService } from '../../../services/auth.service';
import { CompanyService } from '../../../services/company.service';
import { OrderService } from '../../../services/order.service';
import { StoreService } from '../../../services/store.service';
import { UserRoleService } from '../../../services/user-role.service';
import { Product } from '../../../interfaces/product.interface';
import { CartItem, ProductViewType, ReceiptData } from '../../../interfaces/pos.interface';
import { Store } from '../../../interfaces/store.interface';

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, HeaderComponent],
  templateUrl: './pos.component.html',
  styleUrls: ['./pos.component.css']
})
export class PosComponent implements OnInit {
  // Services
  private productService = inject(ProductService);
  private posService = inject(PosService);
  private posSharedService = inject(PosSharedService);
  private authService = inject(AuthService);
  private companyService = inject(CompanyService);
  private storeService = inject(StoreService);
  private orderService = inject(OrderService);
  private userRoleService = inject(UserRoleService);

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
  
  // Customer information for order (like mobile version)
  customerInfo = {
    soldTo: '',
    tin: '',
    businessAddress: '',
    invoiceNumber: `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
    datetime: new Date().toISOString().slice(0, 16) // Format for datetime-local input
  };

  // UI State for collapsible customer panel
  private isSoldToCollapsedSignal = signal<boolean>(true);
  readonly isSoldToCollapsed = computed(() => this.isSoldToCollapsedSignal());
  
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

  // Order detail modal
  private selectedOrderSignal = signal<any | null>(null);
  readonly selectedOrder = computed(() => this.selectedOrderSignal());

  setAccessTab(tab: string): void {
    this.accessTabSignal.set(tab);
  }

  setOrderSearchQuery(value: string): void {
    this.orderSearchSignal.set(value);
  }

  async searchOrders(): Promise<void> {
    try {
      const storeInfo = this.currentStoreInfo();
      const companyId = storeInfo?.companyId;
      const storeId = this.selectedStoreId();
      const q = this.orderSearchQuery().trim();
      if (!companyId || !q) return;
      const results = await this.orderService.searchOrders(companyId, storeId || undefined, q);
      this.ordersSignal.set(results);
    } catch (error) {
      console.error('Error searching orders:', error);
      this.ordersSignal.set([]);
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

  async ngOnInit(): Promise<void> {
    try {
      await this.loadData();
      // Set current date and time
      this.updateCurrentDateTime();
      // Auto-select store after data is loaded
      this.initializeStore();
      
      // Debug: log current user and stores to ensure user.storeIds and stores list are correct
      console.log('POS init - currentUser:', this.authService.getCurrentUser());
      console.log('POS init - all stores:', this.storeService.getStores());
      console.log('POS init - availableStores:', this.availableStores());
      console.log('POS init - selectedStoreId after auto-selection:', this.selectedStoreId());
    } catch (error) {
      console.error('Error initializing POS:', error);
    }
  }

  private async loadData(): Promise<void> {
    // Load user roles to get store access permissions
    const user = this.authService.getCurrentUser();
    if (user?.uid) {
      // Load user roles first
      await this.userRoleService.loadUserRoles();
      
      // Get the current user's role by userId
      const userRole = this.userRoleService.getUserRoleByUserId(user.uid);
      
      // Debug logging as requested
      console.log('userRoles in pos:', userRole);
      console.log('user.uid:', user.uid);
      
      if (userRole && userRole.storeId) {
        // Load companies and stores based on user's assigned store
        await this.storeService.loadStores([userRole.storeId]);
        
        // Load products for the user's company and selected store
        // Note: initializeStore() will be called after this method completes
        await this.productService.loadProductsByCompanyAndStore(userRole.companyId, userRole.storeId);
      } else if (userRole && userRole.companyId) {
        // If user has company access but no specific store, load all company stores
        console.log('🏪 User has company access but no specific store, loading all company stores');
        await this.storeService.loadStoresByCompany(userRole.companyId);
        
        // Load products for the company (products will be filtered by store after auto-selection)
        await this.productService.loadProductsByCompanyAndStore(userRole.companyId);
      } else {
        console.warn('No user role found or no store/company assigned to user');
      }
    } 
  }

  private async initializeStore(): Promise<void> {
    const stores = this.availableStores();
    const currentlySelected = this.selectedStoreId();
    
    console.log('🏪 Initializing store selection - Available stores:', stores.length);
    console.log('🏪 Currently selected store:', currentlySelected);
    
    // Auto-select store if none is currently selected
    if (!currentlySelected && stores.length > 0) {
      const storeToSelect = stores[0]; // Always select the first store
      
      if (stores.length === 1) {
        console.log('🏪 Single store detected, auto-selecting:', storeToSelect.storeName, '(ID:', storeToSelect.id, ')');
      } else {
        console.log('🏪 Multiple stores available, auto-selecting first:', storeToSelect.storeName, '(ID:', storeToSelect.id, ')');
      }
      
      if (storeToSelect.id) {
        await this.selectStore(storeToSelect.id);
        console.log('✅ Auto-selection completed for store:', storeToSelect.storeName);
      }
    } else if (currentlySelected) {
      console.log('✅ Store already selected:', currentlySelected);
    } else {
      console.warn('⚠️ No stores available for auto-selection');
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
  }

  // Customer panel methods
  toggleSoldToPanel(): void {
    this.isSoldToCollapsedSignal.set(!this.isSoldToCollapsedSignal());
  }

  updateCurrentDateTime(): void {
    this.customerInfo.datetime = new Date().toISOString().slice(0, 16);
  }

  generateNewInvoiceNumber(): void {
    this.customerInfo.invoiceNumber = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
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

  async processOrder(): Promise<void> {
    try {
      const orderId = await this.posService.processOrder();
      if (orderId) {
        alert(`Order completed successfully! Order ID: ${orderId}`);
        // TODO: Print receipt or show receipt modal
      }
    } catch (error) {
      console.error('Error processing order:', error);
      alert('Failed to process order. Please try again.');
    }
  }
}
