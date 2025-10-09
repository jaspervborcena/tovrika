import { Component, OnInit, AfterViewInit, OnDestroy, computed, signal, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { HeaderComponent } from '../../../../shared/components/header/header.component';
import { ReceiptComponent } from '../receipt/receipt.component';
import { CartFabComponent } from '../../../../shared/components/cart-fab/cart-fab.component';
import { MobileCartModalComponent } from '../../../../shared/components/mobile-cart-modal/mobile-cart-modal.component';
import { ProductService } from '../../../../services/product.service';
import { PosService } from '../../../../services/pos.service';
import { PosSharedService } from '../../../../services/pos-shared.service';
import { PrintService } from '../../../../services/print.service';
import { TransactionService } from '../../../../services/transaction.service';
import { AuthService } from '../../../../services/auth.service';
import { CompanyService } from '../../../../services/company.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { NetworkService } from '../../../../core/services/network.service';
import { IndexedDBService } from '../../../../core/services/indexeddb.service';
import { PosUtilsService } from '../../../../services/pos-utils.service';
import { ErrorMessages, WarningMessages } from '../../../../shared/enums';
import { OrderService } from '../../../../services/order.service';
import { StoreService } from '../../../../services/store.service';
import { UserRoleService } from '../../../../services/user-role.service';
import { CurrencyService } from '../../../../services/currency.service';
import { Product } from '../../../../interfaces/product.interface';
import { ProductViewType } from '../../../../interfaces/pos.interface';

@Component({
  selector: 'app-pos-mobile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, HeaderComponent, ReceiptComponent, CartFabComponent, MobileCartModalComponent],
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
  private storeService = inject(StoreService);
  private orderService = inject(OrderService);
  private userRoleService = inject(UserRoleService);
  public currencyService = inject(CurrencyService);
  private toastService = inject(ToastService);
  private networkService = inject(NetworkService);
  private indexedDBService = inject(IndexedDBService);
  private router = inject(Router);
  private posUtilsService = inject(PosUtilsService);

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
  
  // Customer information for order
  customerInfo = {
    soldTo: '',
    tin: '',
    businessAddress: '',
    invoiceNumber: 'INV-0000-000000',
    datetime: new Date().toISOString().slice(0, 16) // Format for datetime-local input
  };

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
    } catch (error) {
      console.error('Error initializing POS Mobile:', error);
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
    
    // Set the selected store first
    await this.posService.setSelectedStore(storeId);
    
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

  addToCart(product: Product): void {
    if (product.totalStock <= 0) {
      this.toastService.warning(WarningMessages.PRODUCT_OUT_OF_STOCK);
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

  // Cart modal methods
  showCartModal(): void {
    this.cartModal.show();
  }

  hideCartModal(): void {
    // Modal will handle its own closing
  }

  async processOrder(): Promise<void> {
    try {
      // Convert datetime string to Date object
      const orderDate = this.customerInfo.datetime ? new Date(this.customerInfo.datetime) : new Date();
      
      const customerData = {
        ...this.customerInfo,
        date: orderDate // Convert to date for backend compatibility
      };
      
      // Use the new invoice service to get both order ID and invoice number
      const result = await this.posService.processOrderWithInvoice(customerData);
      if (result) {
        console.log('Order processed with invoice:', {
          orderId: result.orderId,
          invoiceNumber: result.invoiceNumber
        });

        // Update the customer info with the new invoice number
        this.customerInfo.invoiceNumber = result.invoiceNumber;

        // Prepare receipt data and show receipt modal
        const receiptData = this.prepareReceiptData(result.orderId);
        this.receiptDataSignal.set(receiptData);
        this.isReceiptModalVisibleSignal.set(true);
        
        // Don't clear cart yet - wait until receipt modal is closed
        console.log(`Order completed successfully! Order ID: ${result.orderId}`);
      }
    } catch (error) {
      console.error('Error processing order:', error);
      this.toastService.error(ErrorMessages.ORDER_PROCESS_ERROR);
    }
  }

  resetCustomerForm(): void {
    this.customerInfo = {
      soldTo: '',
      tin: '',
      businessAddress: '',
      invoiceNumber: 'INV-0000-000000',
      datetime: new Date().toISOString().slice(0, 16) // Format for datetime-local input
    };
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
    
    // Clear cart and reset form after receipt modal is closed
    this.posService.clearCart();
    this.resetCustomerForm();
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

      // 🔥 ENHANCED: Use smart print - auto-connects if needed
      console.log('🖨️ Using smart print (auto-detect and connect)...');
      await this.printService.printReceiptSmart(receiptData);
      console.log(`✅ Receipt printed successfully for order:`, receiptData.orderId);
      
      // Close the modal after successful save and print
      this.closeReceiptModal();
      
    } catch (error) {
      console.error('Error during print process:', error);
      // Still try to print even if save fails
      try {
        await this.printService.printReceiptSmart(receiptData);
        console.log('Receipt printed despite save error');
        this.closeReceiptModal();
      } catch (printError) {
        console.error('Print error:', printError);
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
    this.customerInfo.datetime = new Date().toISOString().slice(0, 16);
  }

  // Invoice preview loading - same as main POS component
  async loadNextInvoicePreview(): Promise<void> {
    try {
      // Check if online/offline
      if (this.networkService.isOffline()) {
        console.log('📋 Mobile Offline mode: Using default invoice number');
        this.customerInfo.invoiceNumber = 'INV-0000-000000 (Offline)';
        return;
      }

      const nextInvoice = await this.posService.getNextInvoiceNumberPreview();
      
      // Update the customer info invoice number for display
      this.customerInfo.invoiceNumber = nextInvoice;
      console.log('📋 Mobile Next invoice number loaded:', nextInvoice);
    } catch (error) {
      console.error('Mobile Error loading invoice preview:', error);
      this.customerInfo.invoiceNumber = 'INV-0000-000000 (Error)';
    }
  }
}
