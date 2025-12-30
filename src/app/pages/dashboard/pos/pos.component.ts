import { Component, OnInit, AfterViewInit, OnDestroy, HostListener, ViewChild, ElementRef, computed, signal, inject } from '@angular/core';
import { Firestore, doc, getDoc, collection, query, where } from '@angular/fire/firestore';
import { getDocs } from 'firebase/firestore';
import { ProductStatus } from '../../../interfaces/product.interface';
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
import { AppConstants } from '../../../shared/enums/app-constants.enum';

import { OrderService } from '../../../services/order.service';
import { OrdersSellingTrackingService } from '../../../services/orders-selling-tracking.service';
import { LedgerService } from '../../../services/ledger.service';
import { StoreService } from '../../../services/store.service';
import { UserRoleService } from '../../../services/user-role.service';
import { CustomerService } from '../../../services/customer.service';
import { CompanyService } from '../../../services/company.service';
import { TranslationService } from '../../../services/translation.service';
import { TranslateModule } from '@ngx-translate/core';
import { Product } from '../../../interfaces/product.interface';
import { ProductViewType, OrderDiscount, ReceiptValidityNotice, CartItem, CartItemTaxDiscount } from '../../../interfaces/pos.interface';
import { Customer, CustomerFormData } from '../../../interfaces/customer.interface';
import { SubscriptionService } from '../../../services/subscription.service';
import { toDateValue } from '../../../core/utils/date-utils';

import { NgxBarcode6Module } from 'ngx-barcode6';
import JsBarcode from 'jsbarcode';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, HeaderComponent, ReceiptComponent, DiscountModalComponent, ConfirmationDialogComponent, TranslateModule, NgxBarcode6Module],
  templateUrl: './pos.component.html',
  styleUrls: ['./pos.component.css']
})
export class PosComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('processPaymentButton', { read: ElementRef }) processPaymentButton?: ElementRef<HTMLButtonElement>;

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
  private ordersSellingTrackingService = inject(OrdersSellingTrackingService);
  private ledgerService = inject(LedgerService);
  private userRoleService = inject(UserRoleService);
  private customerService = inject(CustomerService);
  private companyService = inject(CompanyService);
  
  private translationService = inject(TranslationService);
  private subscriptionService = inject(SubscriptionService);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);

  private routerSubscription: any;
  private resizeListener?: () => void;
  
  // Barcode image cache
  private barcodeImageCache = new Map<string, SafeUrl>();
  
  // Expose Math for template
  readonly Math = Math;

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

  /**
   * Returns true when there is at least one actionable partial adjustment
   * (adjustmentType starts with 'partial_' and qtyToAdjust > 0).
   */
  hasActionableChanges(): boolean {
    try {
      const entries = this.trackingEntries() || [];
      return entries.some((entry: any) => {
        const adj = (entry.adjustmentType || '').toString().toLowerCase();
        const qty = Number(entry.qtyToAdjust || entry.quantity || 0);
        return adj.startsWith('partial_') && qty > 0;
      });
    } catch (e) {
      return false;
    }
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
      
      // Count products per store and prioritize stores with products
      const allProducts = this.productService.getProductsSignal()();
      const storeProductCounts = new Map<string, number>();
      
      stores.forEach(store => {
        const productCount = allProducts.filter(p => p.storeId === store.id).length;
        storeProductCounts.set(store.id || '', productCount);
      });
      
      // Sort stores: stores with products first, then by product count descending
      const sortedStores = [...stores].sort((a, b) => {
        const countA = storeProductCounts.get(a.id || '') || 0;
        const countB = storeProductCounts.get(b.id || '') || 0;
        
        // If one has products and other doesn't, prioritize the one with products
        if (countA > 0 && countB === 0) return -1;
        if (countA === 0 && countB > 0) return 1;
        
        // If both have products or both don't, sort by count descending
        return countB - countA;
      });
      
      console.log('🏪 Store product counts:', Array.from(storeProductCounts.entries()).map(([id, count]) => ({
        store: stores.find(s => s.id === id)?.storeName,
        count
      })));
      
      return sortedStores;
    }
    
    return stores;
  });
  readonly selectedStoreId = computed(() => this.posService.selectedStoreId());
  readonly cartItems = computed(() => this.posService.cartItems());
  // Show most recently added cart item at the top for display purposes
  readonly cartItemsLatestFirst = computed(() => {
    const items = this.posService.cartItems();
    // Return a reversed copy to avoid mutating the original array
    return Array.isArray(items) ? [...items].reverse() : items;
  });
  readonly cartSummary = computed(() => this.posService.cartSummary());
  readonly isProcessing = computed(() => this.posService.isProcessing());
  
  readonly products = computed(() => {
    const prods = this.productService.getProductsSignal()();
    console.log('🔍 PRODUCTS COMPUTED - Count:', prods.length);
    
    // Check for missing required fields in products
    if (prods.length > 0) {
      const sampleProduct = prods[0];
      console.log('🔍 Sample product structure:', sampleProduct);
      
      const requiredFields = ['uid', 'productName', 'skuId', 'unitType', 'category', 'companyId', 'storeId', 'isVatApplicable', 'hasDiscount', 'discountType'];
      const missingFields = requiredFields.filter(field => 
        sampleProduct[field as keyof Product] === undefined || 
        sampleProduct[field as keyof Product] === null ||
        sampleProduct[field as keyof Product] === ''
      );
      
      if (missingFields.length > 0) {
        console.warn('⚠️ Missing or empty required fields in products:', missingFields);
      } else {
        console.log('✅ All required fields present in products');
      }
    }
    
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

  // Sorting mode for products list/grid
  private sortModeSignal = signal<'asc' | 'desc' | 'mid'>('asc');
  readonly sortMode = computed(() => this.sortModeSignal());

  // Sort dropdown open state (for Excel-like menu)
  private sortMenuOpenSignal = signal<boolean>(false);
  readonly sortMenuOpen = computed(() => this.sortMenuOpenSignal());

  // Tag filters
  readonly activeTagFilters = signal<string[]>([]); // Track active tag label filters
  readonly availableTagsByGroup = signal<{ group: string; tags: { id: string; label: string }[] }[]>([]); // Tags from database
  readonly isTagFilterExpanded = signal<boolean>(window.innerWidth > 1024); // Track tag filter section collapse state - collapsed on mobile/tablet
  readonly isHotkeyExpanded = signal<boolean>(window.innerWidth > 1024); // Track hotkey section collapse state - collapsed on mobile/tablet
  readonly isInvoiceExpanded = signal<boolean>(window.innerWidth > 1024); // Track invoice section collapse state - collapsed on mobile/tablet

  setSortMode(mode: 'asc' | 'desc' | 'mid'): void {
    if (this.sortModeSignal() !== mode) {
      this.sortModeSignal.set(mode);
      // Reset grid pagination to initial 3 rows when sort changes
      this.gridRowsVisible.set(3);
      // Reset to page 1 when sort changes
      this.resetPagination();
    }
    // Close dropdown after a selection
    this.sortMenuOpenSignal.set(false);
  }

  // Toggle/close sort dropdown
  toggleSortMenu(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.sortMenuOpenSignal.set(!this.sortMenuOpenSignal());
  }

  closeSortMenu(): void {
    if (this.sortMenuOpenSignal()) {
      this.sortMenuOpenSignal.set(false);
    }
  }

  // Close dropdown on outside click or Escape
  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeSortMenu();
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: KeyboardEvent): void {
    event.stopPropagation();
    this.closeSortMenu();
  }

  // Grid pagination state: number of visible rows in the product grid.
  // Each "Show more" reveals 2 more rows. With a 6-column grid, each row shows 6 items.
  readonly gridRowsVisible = signal<number>(3); // initial rows visible (3 rows -> 18 items)
  private readonly gridColumns = 6; // must match CSS grid columns for desktop
  
  // Pagination state
  readonly currentPage = signal<number>(1);
  readonly isMobileView = signal<boolean>(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  readonly isTabletView = signal<boolean>(typeof window !== 'undefined' ? (window.innerWidth >= 768 && window.innerWidth < 1024) : false);
  readonly isDesktopView = computed(() => !this.isMobileView() && !this.isTabletView());
  
  // Dynamic page size based on screen width
  readonly pageSize = computed(() => {
    if (this.isMobileView()) return 6; // Mobile: 3 cols × 2 rows = 6 items
    if (this.isTabletView()) return 10; // Tablet: 5 cols × 2 rows = 10 items
    return 12; // Desktop: 6 cols × 2 rows = 12 items
  });

  // Products to display in grid view based on visible rows
  readonly displayGridProducts = computed(() => {
    const all = this.filteredProducts();
    // Apply pagination: show products per page based on screen size
    if (this.accessTab() === 'New' && this.currentView() === 'grid') {
      const startIndex = (this.currentPage() - 1) * this.pageSize();
      const endIndex = startIndex + this.pageSize();
      return all.slice(startIndex, endIndex);
    }
    return all;
  });
  
  // Total pages for pagination
  readonly totalPages = computed(() => {
    const total = this.filteredProducts().length;
    return Math.ceil(total / this.pageSize());
  });
  
  // Check if there are more pages
  readonly hasNextPage = computed(() => this.currentPage() < this.totalPages());
  readonly hasPreviousPage = computed(() => this.currentPage() > 1);

  // Favorite products derived from filtered list
  readonly favoriteProducts = computed(() => {
    try {
      return this.filteredProducts().filter((p: any) => !!(p && (p as any).isFavorite));
    } catch {
      return [] as any[];
    }
  });

  // Favorites grid with same pagination behavior as standard grid
  readonly displayFavoriteGridProducts = computed(() => {
    const allFavs = this.favoriteProducts();
    const count = this.gridRowsVisible() * this.gridColumns;
    if (this.accessTab() === 'New' && this.currentView() === 'favorites') {
      return allFavs.slice(0, count);
    }
    return allFavs;
  });

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

  // Cart Item Details Modal State
  showCartItemDetails = false;
  selectedCartItem: CartItem | null = null;
  cartItemDetails: CartItemTaxDiscount = this.getDefaultCartItemDetails();
  
  // Product Preview Modal State
  readonly selectedPreviewProduct = signal<any>(null);
  
  // Order completion status - tracks if current order is already processed
  readonly isOrderCompleted = signal<boolean>(false);
  readonly completedOrderData = signal<any>(null); // Store completed order data for reprinting
  
  // Regular properties for ngModel binding (signals don't work well with ngModel)
  manualInvoiceInput: string = 'INV-0000-000000';
  
  // Computed properties for UI display
  readonly completeOrderButtonText = computed(() => {
    if (this.isProcessing()) {
      return 'messages.loading';
    }
    
    if (this.isOrderCompleted()) {
      return 'pos.printReceipt';
    }
    
    return 'pos.completeOrder';
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
  paymentType: string = 'Cash';

  // Cart Information Dialog State
  readonly cartInformationModalVisible = signal<boolean>(false);
  
  // Cart VAT and Discount Settings
  public cartVatSettings = {
    isVatApplicable: true,
    vatRate: 12,
    hasDiscount: false,
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: 0
  };

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
    
    console.log('═══════════════════════════════════════════');
    console.log('🔍 FILTERING START - Total products:', allProducts.length);
    console.log('═══════════════════════════════════════════');
    
    console.log('🔍 FILTERED PRODUCTS DEBUG:', {
      totalProducts: allProducts.length,
      selectedStoreId: storeId,
      availableStores: stores.length,
      storeNames: stores.map(s => s.storeName),
      productTagsSample: allProducts.slice(0, 10).map(p => ({
        name: p.productName,
        tagLabels: p.tagLabels,
        tags: p.tags
      }))
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

    // Filter by active tag labels (AND logic - show products with ALL selected tags)
    const activeTagFilters = this.activeTagFilters();
    if (activeTagFilters.length > 0) {
      const beforeTagCount = filtered.length;
      
      console.log('═══════════════════════════════════════════');
      console.log('🏷️ TAG FILTERING - Active filters:', activeTagFilters);
      console.log('🏷️ Products to check:', beforeTagCount);
      console.log('═══════════════════════════════════════════');
      
      // Show sample of what we're filtering
      console.log('🏷️ Sample products BEFORE tag filter:');
      filtered.slice(0, 5).forEach(p => {
        console.log(`  - ${p.productName}: tagLabels =`, p.tagLabels);
      });
      
      filtered = filtered.filter(p => {
        if (!p.tagLabels || p.tagLabels.length === 0) {
          console.log('❌ REJECTED (no tags):', p.productName);
          return false;
        }
        
        // Check if product has ALL of the active tag labels (AND logic)
        const hasAllTags = activeTagFilters.every(filterLabel => {
          const hasThisTag = p.tagLabels?.includes(filterLabel) ?? false;
          if (!hasThisTag) {
            console.log(`❌ REJECTED ${p.productName}: Missing tag "${filterLabel}" (has: ${p.tagLabels?.join(', ') ?? 'none'})`);
          }
          return hasThisTag;
        });
        
        if (hasAllTags) {
          console.log(`✅ ACCEPTED: ${p.productName} (has all: ${activeTagFilters.join(', ')})`);
        }
        
        return hasAllTags;
      });
      
      console.log('═══════════════════════════════════════════');
      console.log('🏷️ TAG FILTERING COMPLETE');
      console.log('🏷️ Before:', beforeTagCount, 'products');
      console.log('🏷️ After:', filtered.length, 'products');
      console.log('🏷️ Required tags (ALL must match):', activeTagFilters);
      console.log('🏷️ Remaining products:', filtered.map(p => p.productName));
      console.log('═══════════════════════════════════════════');
    }

    // Sort by name based on current sort mode (default A–Z)
    try {
      const mode = this.sortMode();
      const name = (p: any) => (p.productName || '').toString().toLowerCase();
      // Base ascending sort by name
      let sorted = filtered.slice().sort((a, b) => name(a).localeCompare(name(b)));

      if (mode === 'desc') {
        sorted = sorted.reverse();
      } else if (mode === 'mid') {
        // Rotate the ascending-sorted list so it starts from the middle item
        const n = sorted.length;
        if (n > 1) {
          const start = Math.floor(n / 2); // e.g., n=30 -> 15 (0-based), which is the 16th item
          sorted = sorted.slice(start).concat(sorted.slice(0, start));
        }
      }

      filtered = sorted;
    } catch (e) {
      console.warn('🔍 Sort error (ignored):', e);
    }

    // Limit list view to top 20 for performance; grid view uses Show More pagination
    const view = this.currentView();
    const finalCount = filtered.length;
    
    if (view === 'list') {
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
    this.filteredProducts().filter(p => p.discountValue && p.discountValue > 0)
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
    pwdId: '',
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
  
  // Panel toggle for mobile/tablet (drawer mode)
  private showReceiptPanelSignal = signal<boolean>(false);
  readonly showReceiptPanel = computed(() => this.showReceiptPanelSignal());
  
  // Access tabs for POS management
  readonly accessTabs = ['New', 'Orders', 'Cancelled', 'Returns', 'Refunds', 'Damage', 'Split Payments', 'Discounts & Promotions'] as const;
  private accessTabSignal = signal<string>('New');
  readonly accessTab = computed(() => this.accessTabSignal());

  // Method to translate access tab names
  getAccessTabTranslation(tab: string): string {
    const tabKeyMap: { [key: string]: string } = {
      'New': 'pos.newTab',
      'Orders': 'pos.ordersTab',
      'Cancelled': 'pos.cancelledTab',
      'Returns': 'pos.returnsTab',
      'Refunds': 'pos.refundsTab',
      'Damage': 'pos.damageTab',
      'Split Payments': 'pos.splitPaymentsTab',
      'Discounts & Promotions': 'pos.discountsTab'
    };
    return this.translationService.instant(tabKeyMap[tab] || tab);
  }

  // Order search (used when viewing Orders tab)
  private orderSearchSignal = signal<string>('');
  readonly orderSearchQuery = computed(() => this.orderSearchSignal());

  // Orders state
  private ordersSignal = signal<any[]>([]);
  readonly orders = computed(() => this.ordersSignal());
  
  // Filtered orders based on active tab
  readonly filteredOrders = computed(() => {
    const allOrders = this.ordersSignal();
    const tab = this.accessTab();
    
    console.log('🔍 Filtering orders for tab:', tab, 'Total orders:', allOrders.length);
    
    if (tab === 'New' || tab === 'Orders') {
      return allOrders;
    }
    
    const filtered = allOrders.filter(order => {
      // Helper to check if order has status in statusHistory
      const hasStatusInHistory = (statusToCheck: string) => {
        if (order.statusHistory && Array.isArray(order.statusHistory)) {
          return order.statusHistory.some((historyItem: any) => 
            historyItem.status?.toLowerCase() === statusToCheck.toLowerCase()
          );
        }
        // Fallback to statusTags or status field
        if (order.statusTags && Array.isArray(order.statusTags)) {
          return order.statusTags.some((t: string) => t.toLowerCase() === statusToCheck.toLowerCase());
        }
        return order.status?.toLowerCase() === statusToCheck.toLowerCase();
      };
      
      let matches = false;
      
      switch (tab) {
        case 'Cancelled':
          matches = hasStatusInHistory('cancelled');
          break;
        case 'Returns':
          matches = hasStatusInHistory('return') || hasStatusInHistory('returned');
          break;
        case 'Refunds':
          matches = hasStatusInHistory('refund') || hasStatusInHistory('refunded');
          break;
        case 'Damage':
          matches = hasStatusInHistory('damage') || hasStatusInHistory('damaged');
          break;
        case 'Split Payments':
          // Orders with both cash and charge payments
          const hasCashSale = order.cashSale === true;
          const hasChargeSale = order.chargeSale === true;
          const hasCash = (order.cashAmount && order.cashAmount > 0) || false;
          const hasCard = (order.cardAmount && order.cardAmount > 0) || false;
          const isBothPayment = order.paymentMethod?.toLowerCase().includes('both') || false;
          matches = (hasCashSale && hasChargeSale) || (hasCash && hasCard) || isBothPayment;
          if (matches) {
            console.log('✅ Split payment match:', order.invoiceNumber, { 
              cashSale: order.cashSale, 
              chargeSale: order.chargeSale, 
              hasCash, 
              hasCard, 
              isBothPayment, 
              paymentMethod: order.paymentMethod, 
              cashAmount: order.cashAmount, 
              cardAmount: order.cardAmount 
            });
          }
          break;
        case 'Discounts & Promotions':
          // Orders with discountAmount > 0
          matches = (order.discountAmount && order.discountAmount > 0) || false;
          if (!matches) {
            console.log('❌ No discount:', order.invoiceNumber, { 
              discountAmount: order.discountAmount,
              hasDiscountAmount: !!order.discountAmount,
              allOrderFields: Object.keys(order)
            });
          } else {
            console.log('✅ Discount match:', order.invoiceNumber, { discountAmount: order.discountAmount });
          }
          break;
        default:
          matches = true;
      }
      
      if (matches && tab !== 'Split Payments' && tab !== 'Discounts & Promotions') {
        console.log('✅ Order matched:', order.invoiceNumber, 'for tab:', tab, 'statusHistory:', order.statusHistory);
      }
      
      return matches;
    });
    
    console.log('🔍 Filtered result:', filtered.length, 'orders for tab:', tab);
    return filtered;
  });
  
  private isLoadingOrdersSignal = signal<boolean>(false);
  readonly isLoadingOrders = computed(() => this.isLoadingOrdersSignal());

  // Order detail modal
  private selectedOrderSignal = signal<any | null>(null);
  readonly selectedOrder = computed(() => this.selectedOrderSignal());

  // Convenience computed flags for order status checks used by the template
  readonly isOrderCancelled = computed(() => {
    const s = (this.selectedOrder()?.status || '').toString().toLowerCase();
    return s === 'cancelled';
  });

  // Cancel is only allowed when the order is in 'completed' state
  readonly canCancelOrder = computed(() => {
    const s = (this.selectedOrder()?.status || '').toString().toLowerCase();
    return s === 'completed';
  });

  // Additional order status flags used to control button visibility/enablement
  readonly isOrderReturned = computed(() => {
    const s = (this.selectedOrder()?.status || '').toString().toLowerCase();
    return s === 'returned';
  });

  readonly isOrderRefunded = computed(() => {
    const s = (this.selectedOrder()?.status || '').toString().toLowerCase();
    return s === 'refunded';
  });

  readonly isOrderDamaged = computed(() => {
    const s = (this.selectedOrder()?.status || '').toString().toLowerCase();
    return s === 'damaged';
  });

  // Lock actions (Cancel / Manage Item Status) when order is in any final/adjusted state.
  // Note: 'returned' is considered an adjusted state where Cancel/Manage should be locked,
  // but Refund and Damage should still be allowed so we exclude 'returned' here.
  readonly isOrderActionLocked = computed(() => {
    const s = (this.selectedOrder()?.status || '').toString().toLowerCase();
    return ['cancelled', 'refunded', 'damaged'].includes(s);
  });

  // Specific disable flags for Refund and Damage buttons. These are false for 'returned'
  // so that refund/damage can be performed after a return.
  readonly isRefundDisabled = computed(() => {
    const s = (this.selectedOrder()?.status || '').toString().toLowerCase();
    // Only cancel should block refund; refunded/damaged states should not block showing refund
    return ['cancelled'].includes(s);
  });

  readonly isDamageDisabled = computed(() => {
    const s = (this.selectedOrder()?.status || '').toString().toLowerCase();
    // Only cancel should block damage action here; allow damage if order was refunded or returned
    return ['cancelled'].includes(s);
  });

  // Disable Manage Item Status when order is in final/adjusted states including 'returned'
  readonly isManageStatusDisabled = computed(() => {
    const s = (this.selectedOrder()?.status || '').toString().toLowerCase();
    return ['cancelled', 'returned', 'refunded', 'damaged'].includes(s);
  });

  // Signal to indicate we've applied damage action and need to lock UI accordingly
  private damageAppliedSignal = signal<boolean>(false);

  // When damage has been applied, lock other actions (except Open Receipt)
  readonly postDamageLock = computed(() => this.damageAppliedSignal());

  // Whether the currently loaded tracking entries already contain a 'returned' row
  readonly hasReturnTracking = computed(() => {
    try {
      const entries = this.trackingEntries() || [];
      return entries.some((e: any) => ((e.status || '').toString().toLowerCase() === 'returned'));
    } catch {
      return false;
    }
  });

  // Determine whether the Return button should be shown for the selected order
  readonly shouldShowReturnButton = computed(() => {
    const order = this.selectedOrder();
    if (!order) return false;
    const s = (order.status || '').toString().toLowerCase();

    // Never show if order already marked returned
    if (s === 'returned') return false;


    // If order is refunded, show Return (user requested both Return and Damage visible/enabled)
    if (s === 'refunded') {
      return true;
    }

    // Default: show return when not already returned
    return !this.isOrderReturned();
  });

  // Determine whether the Damage button should be shown for the selected order
  readonly shouldShowDamageButton = computed(() => {
    const order = this.selectedOrder();
    if (!order) return false;
    const s = (order.status || '').toString().toLowerCase();


    // If order is refunded, show Damage as well (user requested both Return and Damage enabled)
    if (s === 'refunded') {
      return true;
    }

    // For all other statuses, keep previous behavior (show button)
    return true;
  });

  // Receipt modal state
  private isReceiptModalVisibleSignal = signal<boolean>(false);
  readonly isReceiptModalVisible = computed(() => this.isReceiptModalVisibleSignal());
  
  private receiptDataSignal = signal<any>(null);
  readonly receiptData = computed(() => this.receiptDataSignal());

  // Manage Item Status (orderSellingTracking) modal state
  private showTrackingSignal = signal<boolean>(false);
  readonly showTracking = computed(() => this.showTrackingSignal());

  private trackingEntriesSignal = signal<any[]>([]);
  readonly trackingEntries = computed(() => this.trackingEntriesSignal());

  // Optional mode to indicate why Manage Item Status was opened (e.g., 'return' or 'damage')
  private trackingModeSignal = signal<string | null>(null);
  readonly trackingMode = computed(() => this.trackingModeSignal());

  // Which tab is active in Manage Item Status modal: 'edit' => Completed editable, 'view' => All read-only
  private trackingTabSignal = signal<'edit' | 'view'>('edit');
  readonly trackingTab = computed(() => this.trackingTabSignal());

  // Setter used from template to change tabs
  setTrackingTab(tab: 'edit' | 'view'): void {
    this.trackingTabSignal.set(tab);
  }

  // Computed list of entries based on selected tab
  readonly displayedTrackingEntries = computed(() => {
    const entries = this.trackingEntries() || [];
    if (this.trackingTab() === 'edit') {
      return entries.filter((e: any) => (e.status || '').toString().toLowerCase() === 'completed');
    }

    // view tab: sort by priority: completed, returned, refunded, damaged, others
    const priority: Record<string, number> = {
      completed: 0,
      returned: 1,
      refunded: 2,
      damaged: 3
    };

    return entries.slice().sort((a: any, b: any) => {
      const sa = (a.status || '').toString().toLowerCase();
      const sb = (b.status || '').toString().toLowerCase();
      const pa = priority.hasOwnProperty(sa) ? priority[sa] : 99;
      const pb = priority.hasOwnProperty(sb) ? priority[sb] : 99;
      if (pa !== pb) return pa - pb;
      // fallback to product name
      return (a.productName || '').localeCompare(b.productName || '');
    });
  });

  private loadingTrackingSignal = signal<boolean>(false);
  readonly loadingTracking = computed(() => this.loadingTrackingSignal());

  // Manager auth modal state (collect userCode + pin)
  private managerAuthVisibleSignal = signal<boolean>(false);
  readonly managerAuthVisible = computed(() => this.managerAuthVisibleSignal());

  managerAuthUserCode = signal<string>('');
  managerAuthPin = signal<string>('');
  // Inline error message to show inside the manager auth modal when creds are invalid
  managerAuthError = signal<string>('');

  // Internal resolver for showManagerAuthDialog promise
  private _managerAuthResolve: ((value: { userCode: string; pin: string } | null) => void) | null = null;

  // Discount modal state
  private isDiscountModalVisibleSignal = signal<boolean>(false);
  readonly isDiscountModalVisible = computed(() => this.isDiscountModalVisibleSignal());
  readonly orderDiscount = computed(() => this.posService.orderDiscount());

  // Confirmation dialog state
  private isConfirmationDialogVisibleSignal = signal<boolean>(false);
  readonly isConfirmationDialogVisible = computed(() => this.isConfirmationDialogVisibleSignal());
  
  private confirmationDialogDataSignal = signal<ConfirmationDialogData | null>(null);
  readonly confirmationDialogData = computed(() => this.confirmationDialogDataSignal());

  // Store last entered reason from confirmation dialog when used with showReason
  private lastConfirmationReasonSignal = signal<string | null>(null);
  readonly lastConfirmationReason = computed(() => this.lastConfirmationReasonSignal());

  // Sales type state - delegated to PosService so multiple UI elements stay in sync
  readonly isCashSale = computed(() => this.posService.isCashSale());
  readonly isChargeSale = computed(() => this.posService.isChargeSale());

  setAccessTab(tab: string): void {
    console.log('🎯 Setting access tab to:', tab);
    console.log('🕐 Current time:', new Date().toLocaleString());
    console.log('📊 Previous tab was:', this.accessTabSignal());
    
    this.accessTabSignal.set(tab);
    
    // When any order-related tab is activated, ensure orders are loaded
    const orderRelatedTabs = ['Orders', 'Cancelled', 'Returns', 'Refunds', 'Damage', 'Split Payments', 'Discounts & Promotions'];
    if (orderRelatedTabs.includes(tab)) {
      // Only load if we don't have orders yet
      if (this.ordersSignal().length === 0) {
        console.log('📋 Order tab activated, loading recent orders...');
        this.setOrderSearchQuery('');
        this.loadRecentOrders();
      } else {
        console.log('📋 Orders already loaded, just filtering for tab:', tab);
      }
    } else {
      // Clear orders only when switching to non-order tabs (New tab)
      console.log('🧹 Clearing orders for non-order tab:', tab);
      this.ordersSignal.set([]);
      this.setOrderSearchQuery('');
    }
  }

  setOrderSearchQuery(value: string): void {
    this.orderSearchSignal.set(value);
  }

  toggleCashSale(): void {
    this.posService.toggleCashSale();
  }

  toggleChargeSale(): void {
    this.posService.toggleChargeSale();
  }

  setPaymentMethod(method: 'cash' | 'charge' | 'both'): void {
    this.posService.setPaymentMethod(method);
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

  // (Removed debug-only createTestOrder method)

  openOrder(order: any): void {
    this.selectedOrderSignal.set(order);
  }

  closeOrder(): void {
    this.selectedOrderSignal.set(null);
  }

  // Open Manage Item Status modal and load tracking entries for the currently selected order
  async openManageItemStatus(mode?: 'return' | 'damage' | null): Promise<void> {
    try {
      // Store the requested mode (used by the modal UI if needed)
      this.trackingModeSignal.set(mode || null);

      const order = this.selectedOrder();
      const orderId = order?.id || order?.orderId || '';

      console.log('🔍 Debug: openManageItemStatus called', {
        selectedOrder: order,
        orderId: orderId,
        orderKeys: order ? Object.keys(order) : 'No order',
        mode: this.trackingMode()
      });
      
      if (!orderId) {
        console.warn('No order id available for Manage Item Status');
        return;
      }

      this.loadingTrackingSignal.set(true);
      
      // Fetch tracking entries using OrderService (returns array of docs)
      const entries = await this.orderService.getOrderSellingTracking(orderId);

      const normalized = (entries || []).map((e: any) => {
        // Cloud Function returns: productName, SKU, quantity, discountType, discount, vat, isVatApplicable, isVatExempt, total, updatedAt, status
        const quantity = Number(e.quantity ?? 0);
        const total = Number(e.total ?? 0);
        const vat = Number(e.vat ?? 0);
        const discount = Number(e.discount ?? 0);
        
        // Calculate price from total/quantity since API doesn't provide price directly
        const price = quantity > 0 ? total / quantity : total;
        
        return {
          id: e.id || `${e.productName}-${e.SKU}`,
          updatedAt: e.updatedAt ? (e.updatedAt instanceof Date ? e.updatedAt : new Date(e.updatedAt)) : null,
          productName: e.productName || '-',
          sku: e.SKU || e.skuId || e.sku || '-', // Cloud Function returns SKU field
          unitPrice: price, // Store as unitPrice for clarity
          price, // Keep both for backward compatibility
          quantity,
          vat,
          discount,
          discountType: e.discountType || '',
          isVatApplicable: e.isVatApplicable || false,
          isVatExempt: e.isVatExempt || false,
          total,
          status: e.status || 'unknown',
          isModified: false, // Track if user has modified this entry
          ...e
        };
      });

      this.trackingEntriesSignal.set(normalized);
      this.showTrackingSignal.set(true);
    } catch (err) {
      console.error('Failed to load order selling tracking entries', err);
      this.trackingEntriesSignal.set([]);
      this.showTrackingSignal.set(false);
    } finally {
      this.loadingTrackingSignal.set(false);
    }
  }

  closeTracking(): void {
    this.showTrackingSignal.set(false);
    this.trackingEntriesSignal.set([]);
    this.loadingTrackingSignal.set(false);
  }

  // Interactive Tracking Methods

  /**
   * Update quantity for a tracking item and recalculate total
   */
  updateTrackingItemQuantity(index: number, event: any): void {
    const newQuantity = parseInt(event.target.value) || 0;
    const entries = this.trackingEntries();
    
    if (entries[index]) {
      const updatedEntry = { 
        ...entries[index], 
        quantity: newQuantity,
        // Mark as modified for saving
        isModified: true
      };
      
      const updatedEntries = [...entries];
      updatedEntries[index] = updatedEntry;
      this.trackingEntriesSignal.set(updatedEntries);
      
      console.log('📝 Updated quantity for item', index, 'to', newQuantity);
    }
  }

  /**
   * Update status for a tracking item
   */
  updateTrackingItemStatus(index: number, event: any): void {
    const newStatus = event.target.value;
    const entries = this.trackingEntries();
    
    if (entries[index]) {
      const updatedEntry = { 
        ...entries[index], 
        status: newStatus,
        // Mark as modified for saving
        isModified: true
      };
      
      const updatedEntries = [...entries];
      updatedEntries[index] = updatedEntry;
      this.trackingEntriesSignal.set(updatedEntries);
      
      console.log('📝 Updated status for item', index, 'to', newStatus);
    }
  }

  /**
   * Calculate total for a tracking item based on: (unitPrice × quantity) - discount - VAT
   * Formula: total = (price * quantity) - discount - vat
   */
  calculateTrackingItemTotal(item: any): number {
    const unitPrice = Number(item.unitPrice || item.price || 0);
    const quantity = Number(item.quantity || 0);
    const discount = Number(item.discount || 0);
    const vat = Number(item.vat || 0);
    
    // Calculate subtotal
    const subtotal = unitPrice * quantity;
    
    // Apply discount first, then VAT
    const afterDiscount = subtotal - discount;
    const total = afterDiscount - vat;
    
    return Math.max(0, total); // Ensure total is never negative
  }

  /**
   * Save tracking changes back to the API/Cloud Function
   */
  async saveTrackingChanges(): Promise<void> {
    try {
      const entries = this.trackingEntries();
      // Only consider entries actionable when user selected a partial adjustment AND qtyToAdjust > 0
      const actionableEntries = entries.filter(entry => {
        const adj = (entry.adjustmentType || '').toString().toLowerCase();
        const qty = Number(entry.qtyToAdjust || entry.quantity || 0);
        return adj.startsWith('partial_') && qty > 0;
      });

      if (actionableEntries.length === 0) {
        await this.showConfirmationDialog({
          title: 'No Changes',
          message: 'There are no changes for these Invoice.',
          confirmText: 'OK',
          cancelText: '',
          type: 'info'
        });
        return;
      }

      // Validate partial adjustments: qtyToAdjust must be >0 and <= original quantity
      for (const e of actionableEntries) {
        const qty = Number(e.qtyToAdjust || e.quantity || 0);
        const orig = Number(e.quantity || 0);
        if (qty <= 0 || qty > orig) {
          await this.showConfirmationDialog({
            title: 'Invalid Quantity',
            message: `Quantity to adjust for "${e.productName || ''}" must be between 1 and ${orig}.`,
            confirmText: 'OK',
            cancelText: '',
            type: 'danger'
          });
          return;
        }
      }

      const confirmed = await this.showConfirmationDialog({
        title: 'Save Changes',
        message: `Are you sure you want to save changes to ${actionableEntries.length} item(s)?`,
        confirmText: 'Yes, Save',
        cancelText: 'Cancel',
        type: 'info'
      });

      if (!confirmed) return;

      // If every actionable entry is requesting the full quantity, allow mapping
      // partial_* -> full status. If there's any partial row, keep all entries
      // as partial to preserve per-item partial adjustments.
      const allFull = actionableEntries.every(ae => {
        const qty = Number(ae.qtyToAdjust || ae.quantity || 0);
        const orig = Number(ae.quantity || 0);
        return qty === orig;
      });

      this.loadingTrackingSignal.set(true);

      const order = this.selectedOrder();
      const orderId = order?.id || order?.orderId || '';

      const currentUser = this.authService.getCurrentUser();
      const userId = currentUser?.uid || undefined;

      const results: { created: number; errors: any[] } = { created: 0, errors: [] };

      // Process only actionable entries
      // We'll aggregate totals by eventType (return/refund/damage) and write a single ledger entry per eventType
      const totalsByEvent: Record<string, { amount: number; qty: number }> = {};
      for (const e of actionableEntries) {
        try {
          const adj = (e.adjustmentType || '').toString().toLowerCase();
          const qty = Number(e.qtyToAdjust || e.quantity || 0);
          // require the source tracking doc id
          if (!e.id) {
            results.errors.push({ id: e.id || null, error: 'Missing tracking id for partial adjustment' });
            continue;
          }
          // determine target status: only map partial_* -> full when EVERY actionable
          // entry is requesting the full quantity. If any row is partial, leave
          // statuses as partial to avoid mixed partial/full behavior.
          let targetStatus = adj;
          if (allFull) {
            if (adj === 'partial_return' && qty === Number(e.quantity || 0)) targetStatus = 'returned';
            if (adj === 'partial_refund' && qty === Number(e.quantity || 0)) targetStatus = 'refunded';
            if (adj === 'partial_damage' && qty === Number(e.quantity || 0)) targetStatus = 'damaged';
          }

          // create partial/full tracking doc via service which will also handle damage inventory deduction when needed
          const r = await this.ordersSellingTrackingService.createPartialTrackingFromDoc(e.id, targetStatus, qty, userId);
          if (r && r.created) results.created += r.created;
          if (r && r.errors && r.errors.length) results.errors.push(...r.errors);
          // Aggregate totals for ledger per event type when partial adjustments were created
          try {
            const adjType = (e.adjustmentType || '').toString().toLowerCase();
            const mapPartial: any = {
              partial_return: 'returned',
              partial_refund: 'refunded',
              partial_damage: 'damaged'
            };
            const eventType = mapPartial[adjType];
            if (eventType && r && r.created && r.created > 0) {
              const amount = Number(e.lineTotal || ((e.unitPrice || e.price || 0) * qty) || 0);
              if (!totalsByEvent[eventType]) totalsByEvent[eventType] = { amount: 0, qty: 0 };
              totalsByEvent[eventType].amount += amount;
              totalsByEvent[eventType].qty += Number(qty || 0);
            }
          } catch (ledgerEx) {
            console.warn('Unexpected error while aggregating partial adjustments for ledger', ledgerEx);
          }
        } catch (err) {
          results.errors.push({ id: e.id || null, error: err });
        }
      }

      await this.showConfirmationDialog({
        title: 'Changes Saved',
        message: `Processed ${results.created} partial adjustment(s). ${results.errors.length ? 'Errors: ' + results.errors.length : ''}`,
        confirmText: 'OK',
        cancelText: '',
        type: 'info'
      });

      // Refresh the tracking data
      await this.openManageItemStatus();

      // After refreshing, write aggregated ledger entries per event type (non-blocking)
      try {
        const companyId = order?.companyId || '';
        const storeId = order?.storeId || '';
        const performedBy = userId || this.authService.getCurrentUser()?.uid || 'system';
        for (const [eventType, sums] of Object.entries(totalsByEvent)) {
          try {
            // `eventType` is derived from keys and TypeScript treats it as string;
            // cast to the allowed union to satisfy the LedgerService signature.
            const typedEvent = eventType as 'completed' | 'returned' | 'refunded' | 'cancelled' | 'damaged';
            const res: any = await this.ledgerService.recordEvent(companyId, storeId, orderId, typedEvent, Number((sums as any).amount || 0), Number((sums as any).qty || 0), performedBy);
            console.log('LedgerService: aggregated entry created', { orderId, eventType, amount: (sums as any).amount, qty: (sums as any).qty, id: res?.id });
          } catch (ledgerErr) {
            console.warn('LedgerService: failed to create aggregated ledger entry', ledgerErr);
          }
        }
      } catch (aggErr) {
        console.warn('Failed to write aggregated ledger entries after saving tracking changes', aggErr);
      }

    } catch (error) {
      console.error('❌ Error saving tracking changes:', error);
      
      await this.showConfirmationDialog({
        title: 'Save Failed',
        message: 'Failed to save changes. Please try again.',
        confirmText: 'OK',
        cancelText: '',
        type: 'danger'
      });
    } finally {
      this.loadingTrackingSignal.set(false);
    }
  }

  /**
   * Get quantity to adjust for a tracking item (defaults to original quantity)
   */
  getQtyToAdjust(item: any): number {
    return item?.qtyToAdjust ?? Number(item?.quantity || 0);
  }

  /**
   * Update quantity to adjust for a tracking item
   */
  updateQtyToAdjust(index: number, newQty: string): void {
    const entries = this.trackingEntries();
    let idx = typeof index === 'number' ? index : entries.findIndex(e => e.id === index || e.itemId === index);
    if (idx === -1) return;

    if (entries[idx]) {
      const rawQty = Number(newQty) || 0;
      const maxQty = Number(entries[idx].quantity || 0);
      const qtyValue = Math.max(0, Math.min(rawQty, maxQty));
      const updatedEntry = { 
        ...entries[idx], 
        qtyToAdjust: qtyValue,
        // Mark as modified for saving
        isModified: true
      };
      
      const updatedEntries = [...entries];
      updatedEntries[idx] = updatedEntry;
      this.trackingEntriesSignal.set(updatedEntries);
      
      console.log('📝 Updated qty to adjust for item', idx, 'to', qtyValue);
    }
  }

  /**
   * Get adjustment type for a tracking item (defaults to current status)
   */
  getAdjustmentType(item: any): string {
    // In edit mode, prefer showing the explicit adjustmentType if set, otherwise show empty so
    // the "Select action" placeholder is displayed. In view mode, show adjustmentType or fall
    // back to the actual status for read-only display.
    if (this.trackingTab() === 'edit') {
      return item?.adjustmentType ?? '';
    }
    return item?.adjustmentType ?? item?.status ?? '';
  }

  /**
   * Update adjustment type for a tracking item
   */
  updateAdjustmentType(index: number, newType: string): void {
    const entries = this.trackingEntries();
    let idx = typeof index === 'number' ? index : entries.findIndex(e => e.id === index || e.itemId === index);
    if (idx === -1) return;

    if (entries[idx]) {
      const updatedEntry = { 
        ...entries[idx], 
        adjustmentType: newType,
        // Mark as modified for saving
        isModified: true
      };
      
      const updatedEntries = [...entries];
      updatedEntries[idx] = updatedEntry;
      this.trackingEntriesSignal.set(updatedEntries);
      
      console.log('📝 Updated adjustment type for item', idx, 'to', newType);
    }
  }

  /**
   * Get update reason for a tracking item
   */
  getUpdateReason(item: any): string {
    return item?.updateReason ?? '';
  }

  /**
   * Update reason for a tracking item
   */
  updateReason(index: number, newReason: string): void {
    const entries = this.trackingEntries();
    let idx = typeof index === 'number' ? index : entries.findIndex(e => e.id === index || e.itemId === index);
    if (idx === -1) return;

    if (entries[idx]) {
      const updatedEntry = { 
        ...entries[idx], 
        updateReason: newReason,
        // Mark as modified for saving
        isModified: true
      };
      
      const updatedEntries = [...entries];
      updatedEntries[idx] = updatedEntry;
      this.trackingEntriesSignal.set(updatedEntries);
      
      console.log('📝 Updated reason for item', idx, 'to', newReason);
    }
  }

  /**
   * Return a user-friendly store name for the given order.
   * Falls back to 'Global' when order has no storeId and returns the id
   * when the store object cannot be found.
   */
  getOrderStoreName(order: any): string {
    try {
      if (!order) return 'N/A';
      const storeId = order.storeId;
      if (!storeId) return 'Global';
      const store = this.storeService.getStore(storeId);
      if (store && store.storeName) return store.storeName;

      // Some older orders may contain denormalized storeName field
      if (order.storeName) return order.storeName;
      if (order.store && order.store.storeName) return order.store.storeName;

      // Fallback to the raw id so user can at least see something
      return storeId;
    } catch (err) {
      console.warn('Error resolving store name for order', err);
      return order?.storeName || order?.store?.storeName || order?.storeId || 'Unknown Store';
    }
  }

  async updateOrderStatus(orderId: string, status: string, reason?: string): Promise<void> {
    try {
      await this.orderService.updateOrderStatus(orderId, status, reason);
      // refresh
      await this.searchOrders();
      this.closeOrder();
    } catch (e) {
      console.error('Failed to update order status', e);
    }
  }

  // Show manager auth modal and return credentials or null if cancelled
  showManagerAuthDialog(): Promise<{ userCode: string; pin: string } | null> {
    return new Promise((resolve) => {
      console.log('🔐 showManagerAuthDialog: opening manager auth modal');
      this.managerAuthUserCode.set('');
      this.managerAuthPin.set('');
      // Clear any previous inline error
      this.managerAuthError.set('');
      this._managerAuthResolve = resolve;
      this.managerAuthVisibleSignal.set(true);
    });
  }

  // Called by modal confirm
  async onManagerAuthConfirm(): Promise<void> {
    const userCode = (this.managerAuthUserCode() || '').toString();
    const pin = (this.managerAuthPin() || '').toString();
    console.log('🔐 onManagerAuthConfirm: creds submitted (redacted)', { userCode: userCode ? 'present' : 'empty', pinProvided: !!pin });

    // Validate credentials against users collection and check store permission
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

      // Invalid credentials - display inline error in the auth modal and keep it open for retry
      this.managerAuthError.set('Invalid manager code or PIN, or manager is not authorized for this store.');
      // Clear pin for security and allow retry
      this.managerAuthPin.set('');

    } catch (err) {
      console.error('Error validating manager credentials', err);
      await this.showConfirmationDialog({
        title: 'Error',
        message: 'An error occurred while validating credentials. Please try again.',
        confirmText: 'OK',
        cancelText: '',
        type: 'danger'
      });
    }
  }

  // Validate manager credentials against Firestore `users` collection
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
        // Basic pin match (assumes pin stored in users collection as plain or comparable string)
        if ((data.pin || '').toString() !== pin.toString()) continue;

        // Check permission/store mapping - flexible support for different shapes
        // 1) direct storeId on user
        if (data.storeId && currentStore && data.storeId === currentStore) return true;

        // 2) permission object
        if (data.permission && data.permission.storeId && currentStore && data.permission.storeId === currentStore) return true;

        // 3) permissions array - require permissions[0].storeId to match the current store
        if (Array.isArray(data.permissions) && data.permissions.length > 0 && currentStore) {
          const first = data.permissions[0];
          if (first && first.storeId && first.storeId === currentStore) return true;
        }

        // 4) if currentStore is falsy, accept pin/userCode match (fallback)
        if (!currentStore) return true;
      }

      return false;
    } catch (e) {
      console.error('Error querying users for manager auth', e);
      return false;
    }
  }

  // Called by modal cancel
  onManagerAuthCancel(): void {
    console.log('🔐 onManagerAuthCancel: manager auth cancelled by user');
    this.managerAuthVisibleSignal.set(false);
    // Clear inline error when user cancels
    this.managerAuthError.set('');
    if (this._managerAuthResolve) {
      this._managerAuthResolve(null);
      this._managerAuthResolve = null;
    }
  }

  // Require manager auth before opening Manage Item Status modal
  async openManageItemStatusAuthorized(mode?: 'return' | 'damage' | null): Promise<void> {
    const creds = await this.showManagerAuthDialog();
    if (!creds) return; // cancelled

    // If caller requested damage mode, run the damaged flow immediately
    if (mode === 'damage') {
      try {
        const order = this.selectedOrder();
        const orderId = order?.id || order?.orderId || '';
        if (!orderId) {
          await this.showConfirmationDialog({ title: 'No Order', message: 'No order selected.', confirmText: 'OK', cancelText: '', type: 'info' });
          return;
        }

        // Show confirmation with optional reason (patterned like refund flow)
        const confirmed = await this.showConfirmationDialog({
          title: 'Damage Items',
          message: 'Are you sure you want to mark these items as damaged?',
          confirmText: 'Yes, Damage',
          cancelText: 'No',
          type: 'warning',
          showReason: true,
          reasonLabel: 'Update Reason (optional)',
          reasonPlaceholder: 'Enter reason for adjustment (optional)...'
        });

        if (!confirmed) return;

        const reason = this.lastConfirmationReason();

        const res = await this.ordersSellingTrackingService.markOrderTrackingDamaged(orderId, creds.userCode || undefined, reason || undefined);
        const created = res?.created ?? 0;
        const errors = res?.errors ?? [];
        const msg = `Created ${created} damaged record(s). ${errors.length ? 'Errors: ' + errors.length : ''}`;
        
        // Update order status to "damaged" - this will also record to ledger automatically
        await this.orderService.updateOrderStatus(orderId, 'damaged', reason || undefined);
        
        await this.showConfirmationDialog({ title: 'Success', message: 'Successfully marked damage. ' + msg, confirmText: 'OK', cancelText: '', type: 'info' });

        // Mark that damage has been applied so UI will hide/lock actions as required
        this.damageAppliedSignal.set(true);
        
        // Refresh orders list and close order details
        await this.searchOrders();
        this.closeOrder();

        // Do NOT open the Manage Item Status dialog automatically after damage
        return;
      } catch (e) {
        console.error('Failed to apply damage tracking', e);
        await this.showConfirmationDialog({ title: 'Failed', message: 'Failed to mark damage. See console for details.', confirmText: 'OK', cancelText: '', type: 'danger' });
        // Even on failure, lock/hide damage to avoid repeated attempts until user refreshes
        this.damageAppliedSignal.set(true);
        return;
      }
    }

    // Default: open the Manage Item Status modal (return mode or manual manage)
    await this.openManageItemStatus(mode);
  }

  // Wrapper to require manager auth before updating order status
  async authorizeAndUpdateOrderStatus(orderId: string, status: string): Promise<void> {
    const creds = await this.showManagerAuthDialog();
    if (!creds) return; // cancelled
    // TODO: validate creds before proceeding (server-side validation recommended)
    // Ask for confirmation and optional update reason before applying status
    const titleMap: any = {
      cancelled: 'Cancel Order',
      returned: 'Return Items',
      refunded: 'Refund Order',
      damaged: 'Mark as Damaged'
    };
    const messageMap: any = {
      cancelled: 'Are you sure you want to cancel this order?',
      returned: 'Are you sure you want to return these items?',
      refunded: 'Are you sure you want to refund this order?',
      damaged: 'Are you sure you want to mark these items as damaged?'
    };

    const title = titleMap[status] || 'Confirm Action';
    const message = messageMap[status] || `Are you sure you want to set status to ${status}?`;

    // Capture order totals before we close the order (updateOrderStatus will refresh/close)
    const currentOrder = this.selectedOrder();
    const orderAmount = Number(currentOrder?.netAmount ?? currentOrder?.totalAmount ?? 0);
    const orderQty = (currentOrder?.items || []).reduce((s: number, it: any) => s + Number(it.quantity || 0), 0);

    const confirmed = await this.showConfirmationDialog({
      title,
      message,
      confirmText: 'Yes',
      cancelText: 'No',
      type: status === 'cancelled' || status === 'damaged' ? 'warning' : 'info',
      showReason: true,
      reasonLabel: 'Update Reason (optional)',
      reasonPlaceholder: 'Enter reason for adjustment (optional)...'
    });

    if (!confirmed) return;

    const reason = this.lastConfirmationReason() || undefined;
    await this.updateOrderStatus(orderId, status, reason);

    // Show a simple success dialog for the status change. Ledger writes are handled
    // inside `OrderService.updateOrderStatus` to avoid duplicate entries.
    const map: any = { returned: 'returned', refunded: 'refunded', damaged: 'damaged', cancelled: 'cancelled' };
    const eventType = map[status] || status;
    const statusSuccessMap: any = {
      return: 'Successfully marked items as returned.',
      refund: 'Successfully refunded the order.',
      damage: 'Successfully marked items as damaged.',
      cancel: 'Order successfully cancelled.'
    };
    const successMessage = statusSuccessMap[eventType] || 'Action completed successfully.';
    await this.showConfirmationDialog({
      title: 'Success',
      message: successMessage,
      confirmText: 'OK',
      cancelText: '',
      type: 'info'
    });
  }

  // Wrapper to require manager auth before processing item actions
  async processItemActionAuthorized(orderId: string, itemIndex: number, action: string, item: any): Promise<void> {
    const creds = await this.showManagerAuthDialog();
    if (!creds) return;
    await this.processItemAction(orderId, itemIndex, action, item);
  }

  // Wrapper for opening return/damage modes with auth
  async openReturnModeAuthorized(): Promise<void> {
    const creds = await this.showManagerAuthDialog();
    if (!creds) return;
    await this.openReturnMode();
  }

  async openDamageModeAuthorized(): Promise<void> {
    const creds = await this.showManagerAuthDialog();
    if (!creds) return;
    await this.openDamageMode();
  }

  // Open Manage Item Status modal pre-set to 'return' mode
  async openReturnMode(): Promise<void> {
    await this.openManageItemStatus('return');
  }

  // Open Manage Item Status modal pre-set to 'damage' mode
  async openDamageMode(): Promise<void> {
    await this.openManageItemStatus('damage');
  }

  // Process individual item actions (return, damage, refund, cancel)
  async processItemAction(orderId: string, itemIndex: number, action: string, item: any): Promise<void> {
    try {
      console.log(`Processing ${action} for item:`, { orderId, itemIndex, action, item });
      
      const confirmed = await this.showConfirmationDialog({
        title: `${action.charAt(0).toUpperCase() + action.slice(1)} Item`,
        message: `Are you sure you want to ${action} "${item.name || item.productName}"?`,
        confirmText: `Yes, ${action.charAt(0).toUpperCase() + action.slice(1)}`,
        cancelText: 'No',
        type: action === 'cancel' || action === 'damage' ? 'warning' : 'info',
        showReason: true,
        reasonLabel: 'Update Reason (optional)',
        reasonPlaceholder: 'Enter reason for adjustment (optional)...'
      });

      if (confirmed) {
        // Here you can implement the specific logic for each action
        switch (action) {
          case 'return':
            console.log('Processing return for item:', item);
            // TODO: Implement return logic (per-item) if needed
            // Per requirement: treat Return as equivalent to cancelling the order
            try {
              const reason = this.lastConfirmationReason();
              await this.updateOrderStatus(orderId, 'cancelled', reason || undefined);
            } catch (e) {
              console.error('Failed to set order to cancelled after return action', e);
            }
            break;
          case 'damage':
            console.log('Processing damage for item:', item);
            // TODO: Implement damage reporting logic (per-item) if needed
            // Per requirement: treat Damage as equivalent to cancelling the order
            try {
              const reason = this.lastConfirmationReason();
              await this.updateOrderStatus(orderId, 'cancelled', reason || undefined);
            } catch (e) {
              console.error('Failed to set order to cancelled after damage action', e);
            }
            break;
          case 'refund':
            console.log('Processing refund for item:', item);
            // TODO: Implement refund logic
            break;
          case 'cancel':
            console.log('Processing cancellation for item:', item);
            // TODO: Implement item cancellation logic
            try {
              const reason = this.lastConfirmationReason();
              await this.updateOrderStatus(orderId, 'cancelled', reason || undefined);
            } catch (e) {
              console.error('Failed to set order to cancelled after cancel action', e);
            }
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

    // Normalize and compute items first so we can derive customer-level discounts for legacy orders
    const itemsList: any[] = await (async () => {
      try {
        let itemsSource = Array.isArray(order.items) && order.items.length > 0 ? order.items : [];
        if ((!itemsSource || itemsSource.length === 0) && order.id) {
          try {
            const fetched = await this.orderService.fetchOrderItems(order.id);
            if (Array.isArray(fetched) && fetched.length > 0) itemsSource = fetched;
          } catch (e) {
            console.warn('Failed to fetch order items for order', order.id, e);
          }
        }

        return (itemsSource || []).map((item: any) => ({
          productName: item.productName || item.name,
          skuId: item.skuId || item.sku,
          quantity: item.quantity || 1,
          unitType: item.unitType || 'pc',
          sellingPrice: item.sellingPrice || item.price || item.amount,
          originalPrice: item.originalPrice || item.unitPrice || item.sellingPrice || item.price || item.amount,
          total: item.total || (item.quantity * (item.sellingPrice || item.price || item.amount)),
          vatAmount: item.vatAmount || 0,
          discountAmount: item.discountAmount || 0,
          // Preserve any per-item customer name/pwdId if present on historical orders
          customerName: item.customerName || (item as any).discountCustomerName || null,
          pwdId: item.pwdId || null,
          customerDiscount: item.customerDiscount || (item as any).customerDiscount || null
        }));
      } catch (err) {
        console.warn('Error normalizing order items', err);
        return [];
      }
    })();

    // Group discounts by customer identity for legacy/converted orders
    const customerDiscounts = (() => {
      try {
        const groups = new Map<string, any>();
        for (const it of itemsList) {
          const name = (it.customerName || '').toString().trim();
          const pwd = it.pwdId || '';
          const key = name || pwd || '__WALKIN__';
          const discountAmt = Number(it.discountAmount || 0) || 0;
          if (!groups.has(key)) {
            groups.set(key, {
              customerName: name || null,
              exemptionId: pwd || null,
              discountAmount: 0,
              type: it.customerDiscount || null
            });
          }
          const g = groups.get(key);
          g.discountAmount += discountAmt;
          if (!g.type && it.customerDiscount) g.type = it.customerDiscount;
        }
        return Array.from(groups.values()).filter(g => g.discountAmount && g.discountAmount > 0).map(g => ({
          ...g,
          discountAmount: Number(g.discountAmount.toFixed ? g.discountAmount.toFixed(2) : Math.round((g.discountAmount + Number.EPSILON) * 100) / 100)
        }));
      } catch (e) {
        return [];
      }
    })();

    return {
      orderId: order.id,
      invoiceNumber: order.invoiceNumber,
      receiptDate: order.date || order.createdAt,
      storeInfo: {
        storeName: (storeInfo as any)?.storeName || company?.name || 'Unknown Store',
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
      items: itemsList,
      // For legacy orders, extract unique customer names from embedded items or order-level fields
      customerNames: ((): string[] => {
        try {
          const names = [] as string[];
          let sourceItems: any[] = itemsList && itemsList.length > 0 ? itemsList : [];
          if (sourceItems.length === 0 && order.id) {
            if (order.discountCustomerName) sourceItems.push({ customerName: order.discountCustomerName });
            if (order.soldTo && order.soldTo !== 'Walk-in Customer') sourceItems.push({ customerName: order.soldTo });
          }
          for (const it of sourceItems) {
            const n = (it.customerName || it.discountCustomerName || '').toString().trim();
            if (n) names.push(n);
          }
          return Array.from(new Set(names));
        } catch (e) {
          return [];
        }
      })(),
      customerDiscounts: customerDiscounts,
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
    
    // Scroll to top when POS component loads
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
    
    // Add window resize listener for mobile view
    if (typeof window !== 'undefined') {
      this.resizeListener = () => {
        const width = window.innerWidth;
        this.isMobileView.set(width < 768);
        this.isTabletView.set(width >= 768 && width < 1024);
      };
      window.addEventListener('resize', this.resizeListener);
    }
    
    // Add Firestore test
    await this.testFirestoreConnection();
    
    // 🔍 DEBUG: Make debug methods available globally for console debugging
    (window as any).debugPOS = {
      refreshProducts: () => this.debugRefreshProducts(),
      testProductService: async () => {
        console.log('🧪 Testing ProductService manually...');
        const currentPermission = this.authService.getCurrentPermission();
        if (currentPermission?.storeId) {
          console.log('🔄 Calling initializeProducts with storeId:', currentPermission.storeId);
          await this.productService.initializeProducts(currentPermission.storeId, true);
        } else {
          console.log('❌ No storeId available');
        }
      },
      showCurrentProducts: () => {
        console.log('📊 Current products:', this.products());
        console.log('📊 Current products count:', this.products().length);
      },
      showProductServiceState: () => {
        console.log('📊 ProductService state:', {
          products: this.productService.getProductsSignal()(),
          isLoading: this.productService.getLoadingSignal()(),
          error: this.productService.getErrorSignal()(),
          hasInitialLoad: (this.productService as any).hasInitialLoad()
        });
      },
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
      
      // Sync local order state with service (for switching between desktop/mobile)
      const serviceOrderActive = this.posService.isOrderActive();
      if (serviceOrderActive && !this.isNewOrderActive()) {
        this.isNewOrderActive.set(true);
        console.log('🔄 Synced order state from service: order is active');
      }
      
      console.log('🎉 POS INITIALIZATION COMPLETED SUCCESSFULLY!');
    } catch (error) {
      console.error('❌ Error initializing POS:', error);
      console.error('❌ Error details:', error);
    }
  }

  async ngAfterViewInit(): Promise<void> {
    // Generate barcode images for all products
    setTimeout(() => {
      const products = this.products();
      products.forEach(product => {
        if (product.barcodeId) {
          this.generateBarcodeImage(product.barcodeId);
        }
      });
    }, 500);
  }

  // Generate barcode as PNG image
  generateBarcodeImage(barcodeValue: string): SafeUrl {
    // Check cache first
    if (this.barcodeImageCache.has(barcodeValue)) {
      return this.barcodeImageCache.get(barcodeValue)!;
    }

    try {
      // Create a temporary canvas
      const canvas = document.createElement('canvas');
      
      // Generate barcode on canvas with smaller dimensions
      JsBarcode(canvas, barcodeValue, {
        format: 'CODE128',
        displayValue: true,
        width: 1.5,
        height: 40,
        margin: 5,
        fontSize: 12,
        textMargin: 3
      });

      // Convert canvas to PNG data URL
      const pngDataUrl = canvas.toDataURL('image/png');
      const safeUrl = this.sanitizer.bypassSecurityTrustUrl(pngDataUrl);
      
      // Cache the result
      this.barcodeImageCache.set(barcodeValue, safeUrl);
      
      return safeUrl;
    } catch (error) {
      console.error('Error generating barcode:', error);
      return this.sanitizer.bypassSecurityTrustUrl('');
    }
  }

  ngOnDestroy(): void {
    console.log('🏗️ POS COMPONENT: ngOnDestroy called - Component is being destroyed');
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
    if (this.resizeListener && typeof window !== 'undefined') {
      window.removeEventListener('resize', this.resizeListener);
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
    // Use unified flow so hotkey, button, and item-click behave the same
    await this.requestStartNewOrder('hotkey');
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

  // F7 Hotkey for Add Discount (mirrors Add Discount button behavior)
  @HostListener('document:keydown.f7', ['$event'])
  async onF7KeyPress(event: KeyboardEvent): Promise<void> {
    event.preventDefault(); // Prevent default F7 behavior

    // Block on completed orders
    if (this.isOrderCompleted()) return;

    // Ensure we have an active new order; if not, prompt using the unified flow
    if (!this.isNewOrderActive()) {
      const started = await this.requestStartNewOrder('hotkey');
      if (!started) return;
    }

    // If a discount already exists, do not open modal again
    if (this.orderDiscount()) return;

    // Open the same discount modal as the button
    this.showDiscountModal();
  }

  // Clickable Hotkey handlers (same behavior as keyboard shortcuts)
  async handleF4HotkeyClick(): Promise<void> {
    // Mirror onF4KeyPress logic without relying on KeyboardEvent
    if (this.isOrderCompleted()) {
      const confirmed = await this.showConfirmationDialog({
        title: 'Clear Cart Disabled',
        message: 'This order is already completed. Please start a new order to clear the cart.',
        confirmText: 'Start New Order',
        cancelText: 'Cancel',
        type: 'info'
      });
      if (confirmed) {
        await this.startNewOrderDirect();
      }
      return;
    }
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
      await this.clearCart();
    }
  }

  async handleF5HotkeyClick(): Promise<void> {
    await this.requestStartNewOrder('hotkey');
  }

  async handleF6HotkeyClick(): Promise<void> {
    if (this.isOrderCompleted()) {
      await this.showCompletedOrderReceipt();
      return;
    }
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

  async handleF7HotkeyClick(): Promise<void> {
    if (this.isOrderCompleted()) return;
    if (!this.isNewOrderActive()) {
      const started = await this.requestStartNewOrder('hotkey');
      if (!started) return;
    }
    if (this.orderDiscount()) return;
    this.showDiscountModal();
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
    // Disable when subscription/store is inactive or expired (sync check using denormalized store fields)
    const store = this.currentStoreInfo();
    let subscriptionActive = false;
    if (store) {
      const statusOk = (store.status || ProductStatus.Inactive) === ProductStatus.Active;
      let endDate: any = store.subscriptionEndDate as any;
      let notExpired = false;
      if (endDate) {
        const end = endDate instanceof Date ? endDate : new Date(endDate);
        notExpired = !isNaN(end.getTime()) && end.getTime() >= Date.now();
      }
      subscriptionActive = statusOk && notExpired;
    }
    return subscriptionActive && this.isNewOrderActive() && !this.isOrderCompleted() && this.cartItems().length > 0;
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
    // Subscription gate: block if subscription expired or store inactive
    const canStart = await this.checkSubscriptionGate();
    if (!canStart) {
      return;
    }
    console.log('🆕 Starting new order directly');
    
    // Clear completed order status and data
    this.isOrderCompleted.set(false);
    this.completedOrderData.set(null);
    
    // Set new order as active (both local and shared)
    this.isNewOrderActive.set(true);
    this.posService.setOrderActive(true);
    this.posService.setOrderCompleted(false);
    
    // Clear cart and all order-related data
    this.posService.clearCart();
    
    // Reset customer information with next invoice number
    await this.loadNextInvoicePreview();
    const nextInvoice = this.nextInvoiceNumber();
    
    this.customerInfo = {
      soldTo: '',
      tin: '',
      pwdId: '',
      businessAddress: '',
      customerId: ''
    };
    
    this.invoiceNumber = nextInvoice === 'Loading...' ? 'INV-0000-000000' : nextInvoice;
    this.datetime = new Date().toISOString().slice(0, 16);
    
    // Auto-focus search input after new order
    setTimeout(() => {
      this.focusSearchInput();
    }, 100);
    
    console.log('🆕 New order started directly - next invoice:', this.invoiceNumber);
  }

  // Unified New Order request flow used by button, hotkey, and item-click
  async requestStartNewOrder(trigger: 'button' | 'hotkey' | 'item' = 'button'): Promise<boolean> {
    // Subscription gate before any prompts
    const ok = await this.checkSubscriptionGate();
    if (!ok) return false;
    // If order is already completed, allow starting a fresh order
    if (this.isOrderCompleted()) {
      const confirmed = await this.showConfirmationDialog({
        title: this.translationService.instant('pos.createNewOrder'),
        message: this.translationService.instant('pos.createNewOrderPrompt'),
        confirmText: this.translationService.instant('buttons.yes'),
        cancelText: this.translationService.instant('buttons.no'),
        type: 'info'
      });
      if (confirmed) {
        await this.startNewOrderDirect();
        return true;
      }
      return false;
    }

    // If already active, do not prompt again
    if (this.isNewOrderActive()) {
      return true;
    }

    // Otherwise, confirm before starting new order
    const confirmed = await this.showConfirmationDialog({
      title: this.translationService.instant('pos.createNewOrder'),
      message: this.translationService.instant('pos.createNewOrderPrompt'),
      confirmText: this.translationService.instant('buttons.yes'),
      cancelText: this.translationService.instant('buttons.no'),
      type: 'info'
    });
    if (confirmed) {
      await this.startNewOrderDirect();
      return true;
    }
    return false;
  }

  /**
   * Check if current store is allowed to start a new order based on subscription and status.
   * Uses denormalized store.subscriptionEndDate when available; falls back to latest subscription doc.
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

      // Status check first
  if ((store.status || ProductStatus.Inactive) !== ProductStatus.Active) {
        await this.showConfirmationDialog({
          title: 'Store Inactive',
          message: 'Unable to create new order because this store is inactive. Please activate your subscription for this store.',
          confirmText: 'OK',
          cancelText: '',
          type: 'warning'
        });
        return false;
      }

      // Expiry check using denormalized end date (normalize various shapes)
      const rawEndDate = store.subscriptionEndDate as any;
      let endDate: Date | null | undefined = toDateValue(rawEndDate) ?? undefined;

      // If raw value is a string (ISO) and toDateValue returned null, attempt Date conversion
      if (!endDate && typeof rawEndDate === 'string') {
        const parsed = new Date(rawEndDate);
        if (!isNaN(parsed.getTime())) endDate = parsed;
      }

      // If still missing, try to fetch the latest subscription
      if (!endDate && store.companyId && store.id) {
        try {
          const latest = await this.subscriptionService.getSubscriptionForStore(store.companyId, store.id);
          endDate = toDateValue(latest?.data?.endDate) ?? (latest?.data?.endDate instanceof Date ? latest.data.endDate : (latest?.data?.endDate ? new Date(latest.data.endDate) : undefined));
        } catch (e) {
          // ignore fetch errors; treat as unknown
        }
      }

      const now = new Date();
      if (!endDate || endDate.getTime() < now.getTime()) {
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
    } catch (err) {
      // Fail-safe: if something goes wrong, block and inform the user
      await this.showConfirmationDialog({
        title: 'Subscription Check Failed',
        message: 'We could not verify your subscription status. Please try again shortly.',
        confirmText: 'OK',
        cancelText: ''
      });
      return false;
    }
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
    // Ensure the primary action button receives focus when dialog opens
    setTimeout(() => {
      try {
        this.processPaymentButton?.nativeElement?.focus();
      } catch (e) {
        // ignore focus errors
      }
    }, 50);
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

  // Cart Information Dialog Methods
  public showCartInformationDialog(): boolean {
    return this.cartInformationModalVisible();
  }

  public async openCartInformationDialog(): Promise<void> {
    console.log('🛒 Opening cart information dialog - using cart VAT settings as source-of-truth');

    // Do NOT pull VAT rates from product collection here. Prefer the user/cart-level VAT settings.
    // Precedence for VAT values when opening the dialog:
    // 1. item.vatRate / item.isVatApplicable if already set (user previously edited)
    // 2. cartVatSettings values if the user saved a cart-level VAT
    // 3. AppConstants.DEFAULT_VAT_RATE / true as fallback
    try {
      const items = this.cartItems();
      const defaultVatRate = this.cartVatSettings?.vatRate ?? AppConstants.DEFAULT_VAT_RATE;
      const defaultIsVat = this.cartVatSettings?.isVatApplicable ?? true;

      for (const item of items) {
        try {
          const updatedItem: any = { ...item };

          // Prefer existing item settings if present
          updatedItem.isVatApplicable = (item.isVatApplicable !== undefined && item.isVatApplicable !== null)
            ? item.isVatApplicable
            : defaultIsVat;

          updatedItem.vatRate = (item.vatRate !== undefined && item.vatRate !== null)
            ? item.vatRate
            : defaultVatRate;

          // Only update through service if values actually change to avoid unnecessary recalcs
          if (updatedItem.isVatApplicable !== item.isVatApplicable || updatedItem.vatRate !== item.vatRate) {
            this.posService.updateCartItem(updatedItem);
          }
        } catch (err) {
          console.warn('Failed to apply cart VAT settings for cart item', item.productId, err);
        }
      }
    } catch (err) {
      console.warn('Error while applying cart VAT settings to items:', err);
    }

    this.cartInformationModalVisible.set(true);
  }

  public closeCartInformationDialog(): void {
    console.log('🛒 Closing cart information dialog');
    this.cartInformationModalVisible.set(false);
  }

  editCartDetails(): void {
    console.log('✏️ Opening cart details for editing');
    // Close cart information dialog and open the existing cart details modal
    this.closeCartInformationDialog();
    this.openCartDetailsModal();
  }

  public updateCartItemField(index: number, field: string, value: any): void {
    try {
      const currentItems = this.cartItems();
      if (index >= 0 && index < currentItems.length) {
        const updatedItem = { ...currentItems[index] };
        
        // Update the specific field
        (updatedItem as any)[field] = value;

        // Handle per-item customer fields and discounts
        if (field === 'customerName') {
          // nothing extra to do here; saved on item
        }

        if (field === 'pwdId') {
          // nothing extra to do here; saved on item
        }

        // If customerDiscount (PWD/SENIOR) is set, apply default discount settings
        if (field === 'customerDiscount') {
          const cd = (value || '').toString();
          if (cd === 'PWD' || cd === 'SENIOR') {
            updatedItem.hasDiscount = true;
            updatedItem.discountType = AppConstants.DEFAULT_DISCOUNT_TYPE as 'percentage' | 'fixed';
            updatedItem.discountValue = AppConstants.DEFAULT_DISCOUNT_VALUE;
            // store marker for later reference
            (updatedItem as any).customerDiscountType = cd;
          } else {
            // clear any customer-applied discount marker but keep item-level manual discounts intact only if they differ
            (updatedItem as any).customerDiscountType = '';
            // Conservative approach: if the discount was introduced by this customer selector, clear it
            if (updatedItem.discountValue === AppConstants.DEFAULT_DISCOUNT_VALUE && (updatedItem as any).discountType === AppConstants.DEFAULT_DISCOUNT_TYPE) {
              updatedItem.hasDiscount = false;
              updatedItem.discountValue = 0;
              updatedItem.discountType = 'percentage';
            }
          }
        }
        
        // Handle VAT logic
        if (field === 'isVatApplicable') {
          if (value) {
            // When VAT is enabled, set default rate from enum if not already set
            updatedItem.vatRate = updatedItem.vatRate || AppConstants.DEFAULT_VAT_RATE;
          } else {
            // When VAT is disabled, set rate to 0
            updatedItem.vatRate = 0;
          }
        }
        
        // Handle discount logic
        if (field === 'hasDiscount') {
          if (value) {
            // When discount is enabled, set defaults from enum if not already set
            updatedItem.discountType = updatedItem.discountType || AppConstants.DEFAULT_DISCOUNT_TYPE as 'percentage' | 'fixed';
            updatedItem.discountValue = updatedItem.discountValue || AppConstants.DEFAULT_DISCOUNT_VALUE;
          } else {
            // When discount is disabled, reset values
            updatedItem.discountType = 'percentage';
            updatedItem.discountValue = 0;
          }
        }

        // If the discount value itself was changed, enforce hasDiscount flag accordingly
        if (field === 'discountValue') {
          const num = Number(value) || 0;
          if (num <= 0) {
            updatedItem.hasDiscount = false;
            updatedItem.discountValue = 0;
            updatedItem.discountType = 'percentage';
          } else {
            updatedItem.hasDiscount = true;
            updatedItem.discountValue = num;
          }
        }
        
        // Update the cart item through the POS service using productId
        this.posService.updateCartItem(updatedItem);
      }
    } catch (error) {
      console.error('Error updating cart item field:', error);
    }
  }

  public saveAndCloseCartInformationDialog(): void {
    console.log('💾 Saving individual cart item settings and closing dialog...');
    
    // Individual item changes are already saved in real-time through updateCartItemField()
    // No need to overwrite with global settings
    
    // Close the dialog
    this.closeCartInformationDialog();
    
    console.log('✅ Cart information dialog closed - individual item settings preserved');
  }

  // Handler for editable order-level customer fields inside Cart Information dialog
  public onCustomerInfoChange(field: 'pwdId' | 'soldTo', value: string): void {
    try {
      if (!this.customerInfo) this.customerInfo = { soldTo: '', tin: '', pwdId: '', businessAddress: '', customerId: '' } as any;
      // update local object
      (this.customerInfo as any)[field] = value;
      console.log(`✏️ Customer info updated: ${field} =`, value);
      // No immediate persistence required here; the value will be used when saving/processing the order
    } catch (err) {
      console.error('Error updating customer info field:', err);
    }
  }

  public saveCartVatDiscountSettings(): void {
    console.log('💾 Saving cart VAT and discount settings:', this.cartVatSettings);
    
    // Apply settings to all cart items
    this.cartItems().forEach(item => {
      const updatedItem = {
        ...item,
        isVatApplicable: this.cartVatSettings.isVatApplicable,
        vatRate: this.cartVatSettings.vatRate,
        hasDiscount: this.cartVatSettings.hasDiscount,
        discountType: this.cartVatSettings.discountType,
        discountValue: this.cartVatSettings.discountValue
      };
      
      // Update each item through the POS service
      this.posService.updateCartItem(updatedItem);
    });
    
    // Close the dialog
    this.closeCartInformationDialog();
    
    console.log('✅ Cart VAT and discount settings applied to all items');
  }

  async processPayment(): Promise<void> {
    // Prevent double-submission
    if (this.isProcessing()) {
      console.log('⚠️ Payment already processing, ignoring duplicate request');
      return;
    }
    
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
      
      // IMPORTANT: Capture payment info BEFORE closing dialog (dialog close resets these values)
      const paymentInfo = {
        amountTendered: tendered,
        changeAmount: change,
        paymentDescription: this.paymentDescription,
        paymentType: this.paymentType
      };
      
      console.log('💳 Payment validated:', {
        totalAmount,
        tendered,
        change,
        description: paymentInfo.paymentDescription,
        type: paymentInfo.paymentType
      });
      
      // Generate real invoice number when payment is being processed
      // CRITICAL: Always fetch fresh from Firestore to avoid duplicate invoice numbers
      let realInvoiceNumber: string;
      try {
        console.log('📋 Fetching fresh invoice number from Firestore...');
        // Force a fresh read from Firestore, not from cache
        realInvoiceNumber = await this.posService.getNextInvoiceNumberPreview();
        
        // Validate the invoice number is not a placeholder or error
        if (realInvoiceNumber.includes('ERROR') || realInvoiceNumber.includes('0000-000000')) {
          console.warn('⚠️ Invalid invoice number received, retrying...');
          // Wait a moment and try once more
          await new Promise(resolve => setTimeout(resolve, 500));
          realInvoiceNumber = await this.posService.getNextInvoiceNumberPreview();
        }
        
        // Update the display immediately
        this.nextInvoiceNumber.set(realInvoiceNumber);
        this.invoiceNumber = realInvoiceNumber;
        console.log('📋 Fresh invoice number generated from Firestore:', realInvoiceNumber);
      } catch (invoiceError) {
        console.warn('Warning: Could not generate invoice number:', invoiceError);
        realInvoiceNumber = 'INV-0000-000000';
      }
      
      // Close payment dialog after capturing values
      this.closePaymentDialog();
      
      // Now complete the order with payment information (using captured values)
      // Add timeout to prevent indefinite hanging
      const orderPromise = this.completeOrderWithPayment(paymentInfo);
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Order processing timeout - please check your connection')), 15000)
      );
      
      await Promise.race([orderPromise, timeoutPromise]);
      
    } catch (error) {
      console.error('❌ Error processing payment:', error);
      
      // Reset processing state in service if it got stuck
      this.posService['isProcessingSignal']?.set(false);
      
      // Check if this is a duplicate invoice error
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isDuplicateError = errorMessage.includes('Duplicate invoice number');
      
      // Reload the invoice number to get the latest from Firestore
      // This prevents duplicate invoice number errors on retry
      try {
        console.log('🔄 Reloading invoice number after failed order...');
        await this.loadNextInvoicePreview();
        const freshInvoiceNumber = this.nextInvoiceNumber();
        this.invoiceNumber = freshInvoiceNumber === 'Loading...' ? 'INV-0000-000000' : freshInvoiceNumber;
        console.log('📋 Invoice number refreshed:', this.invoiceNumber);
      } catch (invoiceReloadError) {
        console.warn('⚠️ Failed to reload invoice number:', invoiceReloadError);
      }
      
      // Show error dialog with appropriate message
      const errorTitle = isDuplicateError ? 'Order Already Processed' : 'Payment Processing Failed';
      const errorMsg = isDuplicateError 
        ? 'This invoice number has already been used. The invoice number has been refreshed. Please start a new order or try again.'
        : `Failed to process payment and save order. Please try again.\nReason: ${errorMessage}`;
      
      await this.showConfirmationDialog({
        title: errorTitle,
        message: errorMsg,
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
    paymentType: string;
  }): Promise<void> {
    try {
      console.log('💾 Completing order with payment info:', paymentInfo);
      
      // Prepare customer info and payments for the new structure
      const processedCustomerInfo = this.processCustomerInfo();
      const paymentsData = {
        amountTendered: paymentInfo.amountTendered,
        changeAmount: paymentInfo.changeAmount,
        paymentDescription: paymentInfo.paymentDescription,
        paymentType: paymentInfo.paymentType
      };
      
      console.log('📝 Processed customer info:', processedCustomerInfo);
      console.log('💳 Payment data:', paymentsData);
      
      // Save customer first if this is a new customer (so we can attach the doc id to the order)
      let savedCustomer: any = null;
      try {
        // Only attempt to save when we don't already have a customerId
        if (!processedCustomerInfo.customerId && (this.customerInfo.soldTo && this.customerInfo.soldTo.trim())) {
          console.log('👤 No existing customerId - saving customer before order to attach doc id');
          savedCustomer = await this.saveCustomerData();
          if (savedCustomer && savedCustomer.id) {
            // Attach the newly created customer document id into the order payload
            processedCustomerInfo.customerId = savedCustomer.id;
            console.log('👤 Attached saved customer id to customerInfo for order:', savedCustomer.id);
          }
        } else {
          console.log('👤 Existing customerId present or no customer info provided - skipping pre-save');
        }
      } catch (err) {
        console.warn('⚠️ Failed to save customer before order - proceeding without attaching id:', err);
      }

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

      // If we didn't save the customer earlier (for some reason), try once more but avoid duplicate
      if (!savedCustomer) {
        try {
          if (!this.customerInfo.customerId && (this.customerInfo.soldTo && this.customerInfo.soldTo.trim())) {
            console.log('👤 Attempting post-order customer save (fallback)');
            const postSaved = await this.saveCustomerData();
            if (postSaved) console.log('✅ Customer saved post-order:', postSaved.id || postSaved.customerId);
          }
        } catch (e) {
          console.warn('⚠️ Post-order customer save failed:', e);
        }
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
      // orderDetails.status is set at creation time by the invoice service
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
          await this.productService.initializeProducts(userRole.storeId);
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
          console.log('📦 Products will be loaded after store selection...');
          // await this.productService.loadProductsByCompanyAndStore(userRole.companyId);
          console.log('📦 Company product loading skipped - waiting for store selection');
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
                  await this.productService.initializeProducts(permission.storeId);
                }
              } else if (permission?.companyId) {
                console.log('🏪 Loading company stores from IndexedDB fallback:', permission.companyId);
                await this.storeService.loadStoresByCompany(permission.companyId);
                // Products will be loaded after store selection
                console.log('📦 Products will be loaded after store selection...');
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
            await this.productService.initializeProducts(currentlySelected);
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
              await this.productService.initializeProducts(fallbackStoreId);
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
            await this.productService.initializeProducts(finalSelectedStore);
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
    
    // Get companyId for the selected store first
    const storeInfo = this.availableStores().find(s => s.id === storeId);
    const companyIdForStore = storeInfo?.companyId;
    
    // Update IndexedDB immediately with the new selected store
    try {
      const currentUser = this.authService.getCurrentUser();
      console.log('💾 Current user for IndexedDB update:', currentUser?.uid);
      
      if (currentUser?.uid) {
        const existingUserData = await this.indexedDBService.getUserData(currentUser.uid);
        console.log('💾 Existing user data from IndexedDB:', existingUserData);
        
        if (existingUserData) {
          // Update permissions array to reflect the new store selection
          let updatedPermissions = existingUserData.permissions || [];
          
          if (companyIdForStore) {
            // Find the permission for this company
            const permissionIndex = updatedPermissions.findIndex(p => p.companyId === companyIdForStore);
            
            if (permissionIndex >= 0) {
              // Update existing permission with new storeId
              updatedPermissions[permissionIndex] = {
                ...updatedPermissions[permissionIndex],
                storeId: storeId
              };
              console.log('💾 Updated permission for company:', companyIdForStore, 'with storeId:', storeId);
            } else {
              // Add new permission if it doesn't exist
              const roleId = existingUserData.roleId || 'creator';
              updatedPermissions.push({
                companyId: companyIdForStore,
                storeId: storeId,
                roleId: roleId
              });
              console.log('💾 Added new permission for company:', companyIdForStore, 'with storeId:', storeId);
            }
          }
          
          const updatedUserData = { 
            ...existingUserData, 
            currentStoreId: storeId,
            permissions: updatedPermissions,
            updatedAt: new Date()
          };
          
          console.log('💾 About to save updated user data:', updatedUserData);
          await this.indexedDBService.saveUserData(updatedUserData);
          console.log('💾 ✅ Store selection and permissions updated in IndexedDB:', storeId);
          console.log('💾 ✅ Updated permissions:', updatedPermissions);
          
          // Verify the save by reading back
          const verifyData = await this.indexedDBService.getUserData(currentUser.uid);
          console.log('💾 ✅ VERIFICATION - Data read back from IndexedDB:', verifyData);
          console.log('💾 ✅ VERIFICATION - currentStoreId:', verifyData?.currentStoreId);
        } else {
          console.error('❌ No existing user data found in IndexedDB for uid:', currentUser.uid);
        }
      } else {
        console.error('❌ No current user UID available');
      }
    } catch (error) {
      console.error('❌ ERROR updating store selection in IndexedDB:', error);
      console.error('❌ Error details:', error);
    }
    
    // Set the selected store first - preserve cart to prevent accidental clearing
    await this.posService.setSelectedStore(storeId, { preserveCart: true });
    
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
      await this.productService.initializeProducts(storeId);
      console.log('✅ Product loading completed');
      console.log('🛍️ Total products loaded:', this.productService.getProductsSignal()().length);
      
      // Load available tags for the store
      await this.loadAvailableTags();
      
  // Reset grid pagination when store changes
  this.gridRowsVisible.set(4);
    } else {
      console.error('❌ No companyId available from IndexedDB or database - cannot load products');
      console.error('❌ This will prevent products from loading for store:', storeId);
    }
  }

  // Show More controls for product grid
  showMoreGridProducts(): void {
    // Reveal two more rows in the grid
    this.gridRowsVisible.update(v => v + 2);
  }

  hasMoreGridProducts(): boolean {
    if (this.accessTab() !== 'New') return false;
    const view = this.currentView();
    if (view === 'grid') {
      return this.displayGridProducts().length < this.filteredProducts().length;
    }
    if (view === 'favorites') {
      return this.displayFavoriteGridProducts().length < this.favoriteProducts().length;
    }
    return false;
  }
  
  // Pagination methods
  nextPage(): void {
    if (this.hasNextPage()) {
      this.currentPage.update(p => p + 1);
    }
  }
  
  previousPage(): void {
    if (this.hasPreviousPage()) {
      this.currentPage.update(p => p - 1);
    }
  }
  
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }
  
  resetPagination(): void {
    this.currentPage.set(1);
  }
  
  // Generate page numbers for pagination display
  getPageNumbers(): number[] {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: number[] = [];
    
    if (total <= 7) {
      // Show all pages if 7 or fewer
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      if (current <= 3) {
        // Near start: 1 2 3 4 ... total
        pages.push(2, 3, 4);
        pages.push(-1); // ellipsis
        pages.push(total);
      } else if (current >= total - 2) {
        // Near end: 1 ... total-3 total-2 total-1 total
        pages.push(-1); // ellipsis
        pages.push(total - 3, total - 2, total - 1, total);
      } else {
        // Middle: 1 ... current-1 current current+1 ... total
        pages.push(-1); // ellipsis
        pages.push(current - 1, current, current + 1);
        pages.push(-1); // ellipsis
        pages.push(total);
      }
    }
    
    return pages;
  }

  setSelectedCategory(category: string): void {
    this.posSharedService.updateSelectedCategory(category);
    // Reset grid pagination when filters change
    this.gridRowsVisible.set(4);
    this.resetPagination();
  }

  setCurrentView(view: ProductViewType): void {
    this.posSharedService.updateCurrentView(view);
    // Reset pagination when switching views
    if (view === 'grid' || view === 'favorites') {
      this.gridRowsVisible.set(4);
      this.resetPagination();
    }
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
    // Reset grid pagination on search change
    this.gridRowsVisible.set(4);
  }

  clearSearch(): void {
    this.posSharedService.updateSearchQuery('');
  }

  // Focus on search input
  focusSearchInput(): void {
    const searchInput = document.querySelector('.search-input') as HTMLInputElement;
    if (searchInput) {
      searchInput.focus();
    }
  }

  // Ctrl+F hotkey to focus search
  @HostListener('document:keydown.control.f', ['$event'])
  onCtrlF(event: KeyboardEvent): void {
    event.preventDefault();
    this.focusSearchInput();
  }

  // Barcode scanner state
  private barcodeScanBuffer = '';
  private barcodeScanTimeout: any = null;

  // Handle barcode scanner input
  handleBarcodeSearch(barcodeValue: string): void {
    if (!barcodeValue || barcodeValue.length < 8) {
      return;
    }

    console.log('🔍 Searching for barcode:', barcodeValue);

    // Find product by exact barcode match
    const products = this.products();
    const matchedProduct = products.find(p => 
      p.barcodeId && p.barcodeId.trim() === barcodeValue.trim()
    );

    if (matchedProduct) {
      console.log('✅ Barcode matched:', matchedProduct.productName);
      
      // Add to cart automatically
      this.addToCart(matchedProduct);
      
      // Clear search and reset
      setTimeout(() => {
        this.clearSearch();
        const searchInput = document.querySelector('.search-input') as HTMLInputElement;
        if (searchInput) {
          searchInput.value = '';
          searchInput.placeholder = 'Search products...';
        }
      }, 100);
    } else {
      console.warn('⚠️ No product found with barcode:', barcodeValue);
      
      // Show error feedback
      const searchInput = document.querySelector('.search-input') as HTMLInputElement;
      if (searchInput) {
        searchInput.placeholder = '❌ Product not found - try again';
        setTimeout(() => {
          searchInput.placeholder = 'Search products...';
        }, 2000);
      }
    }
  }

  // Trigger barcode scanner from button click
  triggerBarcodeScanner(): void {
    console.log('🔍 Barcode scanner triggered - ready to scan');
    
    // Focus on search input to prepare for barcode scanner input
    const searchInput = document.querySelector('.search-input') as HTMLInputElement;
    if (searchInput) {
      // Clear any existing value
      this.clearSearch();
      searchInput.value = '';
      searchInput.focus();
      
      // Show visual feedback that scanner is ready
      searchInput.placeholder = '📷 Scan barcode now...';
      
      // Reset placeholder after 5 seconds
      setTimeout(() => {
        if (searchInput.placeholder === '📷 Scan barcode now...') {
          searchInput.placeholder = 'Search products...';
        }
      }, 5000);
    }
  }

  // Handle search input keyup for barcode scanning
  onSearchKeyup(event: KeyboardEvent, searchValue: string): void {
    // Clear any existing timeout
    if (this.barcodeScanTimeout) {
      clearTimeout(this.barcodeScanTimeout);
    }

    // When Enter is pressed, treat as barcode scan completion
    if (event.key === 'Enter') {
      if (searchValue && searchValue.length >= 8) {
        console.log('🔍 Barcode scan detected (Enter key):', searchValue);
        this.handleBarcodeSearch(searchValue);
      }
      return;
    }

    // Detect rapid input (typical of barcode scanners)
    // Barcode scanners typically input all characters within 100ms
    this.barcodeScanBuffer += event.key;
    
    // Set timeout to auto-trigger search after rapid input stops
    this.barcodeScanTimeout = setTimeout(() => {
      if (this.barcodeScanBuffer.length >= 8) {
        console.log('🔍 Barcode scan detected (rapid input):', this.barcodeScanBuffer);
        this.handleBarcodeSearch(this.barcodeScanBuffer);
      }
      this.barcodeScanBuffer = '';
    }, 100); // 100ms window for barcode scanner input
  }

  // Customer panel methods
  toggleSoldToPanel(): void {
    this.isSoldToCollapsedSignal.set(!this.isSoldToCollapsedSignal());
  }

  toggleNavigationPanel(): void {
    this.isNavigationCollapsedSignal.set(!this.isNavigationCollapsedSignal());
  }

  // Toggle between left panel (products) and right panel (receipt) on mobile/tablet
  togglePanelView(): void {
    this.showReceiptPanelSignal.set(!this.showReceiptPanelSignal());
  }

  showProductPanel(): void {
    this.showReceiptPanelSignal.set(false);
  }

  showReceiptPanelView(): void {
    this.showReceiptPanelSignal.set(true);
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
      
      // Clear cart directly without confirmation (order is completed)
      this.posService.clearCart();
      console.log('🗑️ Cart cleared after successful offline order');
      
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
      // Use unified flow
      const started = await this.requestStartNewOrder('item');
      return;
    }

    // Check if new order is active first
    if (!this.canInteractWithProducts()) {
      // Use unified flow; do not auto-add the product on the same click
      await this.requestStartNewOrder('item');
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

    // If user has saved a cart-level VAT rate, ensure the newly added/updated cart item uses it
    try {
      const cartVat = this.cartVatSettings?.vatRate;
      const cartVatApplicable = this.cartVatSettings?.isVatApplicable;
      if (cartVat !== undefined && cartVat !== null) {
        const updatedItems = this.cartItems();
        const matching = updatedItems.find(i => i.productId === product.id);
        if (matching) {
          const shouldUpdateVat = (matching.vatRate !== cartVat) || (matching.isVatApplicable !== (cartVatApplicable ?? matching.isVatApplicable));
          if (shouldUpdateVat) {
            const updated = { ...matching, vatRate: cartVat, isVatApplicable: (cartVatApplicable ?? matching.isVatApplicable) } as any;
            this.posService.updateCartItem(updated);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to apply cart-level VAT to newly added item:', err);
    }
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

  // Cart Item Details Methods
  getDefaultCartItemDetails(): CartItemTaxDiscount {
    return {
      isVatApplicable: true,
      vatRate: 12,
      hasDiscount: false,
      discountType: 'percentage',
      discountValue: 0,
      subtotalBeforeDiscount: 0,
      discountAmount: 0,
      subtotalAfterDiscount: 0,
      vatAmount: 0,
      finalTotal: 0
    };
  }

  openCartItemDetails(item: CartItem): void {
    this.selectedCartItem = item;
    this.cartItemDetails = {
      isVatApplicable: item.isVatApplicable ?? true,
      vatRate: item.vatRate ?? 12,
      hasDiscount: item.hasDiscount ?? false,
      discountType: item.discountType || 'percentage',
      discountValue: item.discountValue ?? 0,
      subtotalBeforeDiscount: item.quantity * item.sellingPrice,
      discountAmount: 0,
      subtotalAfterDiscount: 0,
      vatAmount: 0,
      finalTotal: 0
    };
    this.recalculateCartItem();
    this.showCartItemDetails = true;
  }

  closeCartItemDetails(): void {
    this.showCartItemDetails = false;
    this.selectedCartItem = null;
    this.cartItemDetails = this.getDefaultCartItemDetails();
  }

  openProductPreviewModal(product: any, event: Event): void {
    event.stopPropagation(); // Prevent add to cart
    this.selectedPreviewProduct.set(product);
  }

  closeProductPreviewModal(): void {
    this.selectedPreviewProduct.set(null);
  }

  openCartDetailsModal(): void {
    // Open the cart details modal to show all cart items details
    // For now, we'll use the existing cart item details modal but show a summary
    // You can customize this to show a different modal if needed
    this.showCartItemDetails = true;
    this.selectedCartItem = null; // No specific item selected, show all
  }

  recalculateCartItem(): void {
    if (!this.selectedCartItem) return;

    const subtotal = this.selectedCartItem.quantity * this.selectedCartItem.sellingPrice;
    this.cartItemDetails.subtotalBeforeDiscount = subtotal;

    // Calculate discount
    let discountAmount = 0;
    if (this.cartItemDetails.hasDiscount) {
      if (this.cartItemDetails.discountType === 'percentage') {
        discountAmount = (subtotal * this.cartItemDetails.discountValue) / 100;
      } else {
        discountAmount = this.cartItemDetails.discountValue;
      }
      // Ensure discount doesn't exceed subtotal
      discountAmount = Math.min(discountAmount, subtotal);
    }
    this.cartItemDetails.discountAmount = discountAmount;

    // Calculate after discount
    const afterDiscount = subtotal - discountAmount;
    this.cartItemDetails.subtotalAfterDiscount = afterDiscount;

    // Calculate VAT
    let vatAmount = 0;
    if (this.cartItemDetails.isVatApplicable) {
      vatAmount = (afterDiscount * (this.cartItemDetails.vatRate || 12)) / 100;
    }
    this.cartItemDetails.vatAmount = vatAmount;

    // Final total
    this.cartItemDetails.finalTotal = afterDiscount + vatAmount;
  }

  saveCartItemChanges(): void {
    if (!this.selectedCartItem) return;

    // Update the cart item with new tax/discount settings
    const updatedItem: CartItem = {
      ...this.selectedCartItem,
      isVatApplicable: this.cartItemDetails.isVatApplicable,
      vatRate: this.cartItemDetails.vatRate || 12,
      hasDiscount: this.cartItemDetails.hasDiscount,
      discountType: this.cartItemDetails.discountType,
      discountValue: this.cartItemDetails.discountValue,
      total: this.cartItemDetails.finalTotal
    };

    // Update the item in the cart via POS service
    this.posService.updateCartItem(updatedItem);
    
    console.log('✅ Cart item updated:', updatedItem);
    this.closeCartItemDetails();
  }

  // Batch operations
  removeVatFromAllItems(): void {
    const cartItems = this.cartItems();
    cartItems.forEach(item => {
      const updatedItem = {
        ...item,
        isVatApplicable: false,
        vatRate: 0
      };
      this.posService.updateCartItem(updatedItem);
    });
    console.log('🚫 VAT removed from all cart items');
  }

  removeDiscountFromAllItems(): void {
    const cartItems = this.cartItems();
    cartItems.forEach(item => {
      const updatedItem = {
        ...item,
        hasDiscount: false,
        discountValue: 0
      };
      this.posService.updateCartItem(updatedItem);
    });
    console.log('🚫 Discounts removed from all cart items');
  }

  applyVatToAllItems(): void {
    const cartItems = this.cartItems();
    cartItems.forEach(item => {
      const updatedItem = {
        ...item,
        isVatApplicable: true,
        vatRate: this.cartVatSettings?.vatRate ?? AppConstants.DEFAULT_VAT_RATE
      };
      this.posService.updateCartItem(updatedItem);
    });
    console.log('✅ VAT applied to all cart items');
  }

  async clearCart(): Promise<void> {
    // Subscription gate: block if subscription expired or store inactive
    const ok = await this.checkSubscriptionGate();
    if (!ok) return;
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
      // Keep order active - don't reset state, user can continue adding items
      console.log('🗑️ Cart cleared - order still active for new items');
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
      
      // Both online and offline modes - Open payment dialog first
      console.log('💳 Opening payment dialog for order completion...');
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

  // When payment dialog is open, pressing Enter should activate the focused button
  onPaymentDialogEnter(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement && activeElement.tagName === 'BUTTON') {
      activeElement.click();
    } else {
      // Default to processing payment if nothing specific is focused
      this.processPayment();
    }
  }

  @HostListener('document:keydown.enter', ['$event'])
  onGlobalEnterForModals(event: KeyboardEvent): void {
    try {
      if (this.showPaymentModal()) {
        event.preventDefault();
        event.stopPropagation();
        const active = document.activeElement as HTMLElement;
        if (active && active.tagName === 'BUTTON') {
          active.click();
        } else {
          this.processPayment();
        }
        return;
      }

      if (this.isReceiptModalVisible()) {
        event.preventDefault();
        event.stopPropagation();
        const active = document.activeElement as HTMLElement;
        if (active && active.tagName === 'BUTTON') {
          active.click();
        } else {
          this.printReceipt();
        }
        return;
      }
    } catch (err) {
      console.warn('Enter key global handler error:', err);
    }
  }

  @HostListener('document:keydown.enter', ['$event'])
  handleGlobalEnterForPayment(event: Event): void {
    // If payment dialog is visible, delegate Enter to the payment handler
    if (this.paymentModalVisible && this.paymentModalVisible()) {
      this.onPaymentDialogEnter(event);
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

    // Build receipt items list first so we can compute per-customer discount groups
    const itemsList = cartItems.map(item => ({
      productName: item.productName,
      skuId: item.skuId,
      quantity: item.quantity,
      unitType: item.unitType,
      sellingPrice: item.sellingPrice,
      total: item.total,
      vatAmount: item.vatAmount,
      discountAmount: item.discountAmount,
      quantityWithUnit: `${item.quantity} ${this.getUnitTypeDisplay(item.unitType)}`,
      // Per-item customer fields (support multiple customers per receipt)
      customerName: (item as any).customerName || null,
      pwdId: (item as any).pwdId || null,
      customerDiscount: (item as any).customerDiscount || null
    }));

    const customerNamesList = Array.from(new Set(itemsList.map(i => ((i as any).customerName || '').toString().trim()).filter(n => !!n)));

    // Compute per-customer discount aggregation
    const customerDiscounts = (() => {
      try {
        const groups = new Map<string, any>();
        for (const it of itemsList) {
          const name = (it.customerName || '').toString().trim();
          const pwd = it.pwdId || '';
          const key = name || pwd || '__WALKIN__';
          const discountAmt = Number(it.discountAmount || 0) || 0;
          if (!groups.has(key)) {
            groups.set(key, { customerName: name || null, exemptionId: pwd || null, discountAmount: 0, type: it.customerDiscount || null });
          }
          const g = groups.get(key);
          g.discountAmount += discountAmt;
          if (!g.type && it.customerDiscount) g.type = it.customerDiscount;
        }
        return Array.from(groups.values()).filter(g => g.discountAmount && g.discountAmount > 0).map(g => ({
          ...g,
          discountAmount: Number(g.discountAmount.toFixed ? g.discountAmount.toFixed(2) : Math.round((g.discountAmount + Number.EPSILON) * 100) / 100)
        }));
      } catch (e) {
        return [];
      }
    })();

    return {
      orderId,
      invoiceNumber: invoiceNumber || this.invoiceNumber,
      receiptDate: receiptDate, // Date from shared service
      storeInfo: {
        storeName: (storeInfo as any)?.storeName || company?.name || 'Unknown Store',
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
      customerAddress: customerName ? (customerInfo.businessAddress || 'N/A') : null,
      customerTin: customerName ? (customerInfo.tin || 'N/A') : null,
      cashier: cashierName,
      paymentMethod: paymentMethod, // Add payment method
      isCashSale: this.isCashSale(),
      isChargeSale: this.isChargeSale(),
      items: itemsList,
      // Collect unique customer names across items and include them for receipt display
      customerNames: customerNamesList,
      customerDiscounts: customerDiscounts,
      subtotal: cartSummary.grossAmount,
      vatAmount: Number(((cartSummary.vatAmount || 0)).toFixed(2)),
      vatExempt: cartSummary.vatExemptSales,
      discount: cartSummary.productDiscountAmount + cartSummary.orderDiscountAmount,
      totalAmount: cartSummary.netAmount,
      vatRate: this.cartVatSettings?.vatRate ?? AppConstants.DEFAULT_VAT_RATE, // Use latest user-set VAT if available
      // Validity notice based on store BIR accreditation
      validityNotice: (storeInfo as any)?.isBirAccredited 
        ? ReceiptValidityNotice.BIR_ACCREDITED 
        : ReceiptValidityNotice.NON_ACCREDITED,
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
    // Delegate to unified flow to ensure consistent behavior
    await this.requestStartNewOrder('button');
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
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // Show error in a modal dialog with more details
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      await this.showConfirmationDialog({
        title: 'Print Receipt Failed',
        message: `Failed to print receipt: ${errorMessage}\n\nPlease check your printer connection and try again.`,
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

    // Propagate the order discount to each cart item so Cart Information shows it
    try {
      const items = this.cartItems();
      if (Array.isArray(items) && items.length > 0) {
        // Compute gross amount for proportional distribution of fixed discounts
        const gross = items.reduce((s: number, it: any) => s + ((it.sellingPrice || 0) * (it.quantity || 1)), 0);

        for (const it of items) {
          const updated: any = { ...it };
          updated.hasDiscount = true;

          if ((discount as any).percentage) {
            updated.discountType = 'percentage';
            updated.discountValue = Number((discount as any).percentage) || 0;
          } else if ((discount as any).fixedAmount) {
            updated.discountType = 'fixed';
            const fixed = Number((discount as any).fixedAmount) || 0;
            if (gross > 0) {
              // Distribute fixed amount proportionally based on item's line gross
              const lineGross = (it.sellingPrice || 0) * (it.quantity || 1);
              const lineShare = lineGross / gross;
              const lineDiscountTotal = fixed * lineShare;
              // Store per-unit discount value so item controls accept it
              updated.discountValue = Number((lineDiscountTotal / (it.quantity || 1)).toFixed(2));
            } else {
              // Fallback: split equally per item unit
              const perUnit = fixed / Math.max(1, items.reduce((c: number, x: any) => c + (x.quantity || 1), 0));
              updated.discountValue = Number(perUnit.toFixed(2));
            }
          }

          // Also propagate exemption ID and customer name into each item (so multiple customers per receipt show up)
          if (discount.exemptionId) {
            updated.pwdId = discount.exemptionId;
          }
          if (discount.customerName) {
            updated.customerName = discount.customerName;
          }
          // Mark the per-item customer discount type (PWD/SENIOR/CUSTOM)
          if (discount.type) {
            updated.customerDiscount = discount.type;
          }

          // Use PosService API to update the cart item (this will recalc totals)
          this.posService.updateCartItem(updated);
        }
      }
    } catch (err) {
      console.warn('Failed to propagate order discount to items:', err);
    }

    this.closeDiscountModal();
  }

  // Live handler for discount modal's live customer changes (as-you-type)
  public onDiscountModalLiveCustomer(payload: { exemptionId: string; customerName: string; discountType: string }): void {
    try {
      const { exemptionId, customerName, discountType } = payload || { exemptionId: '', customerName: '', discountType: '' };
      const items = this.cartItems();
      if (!Array.isArray(items) || items.length === 0) return;

      for (const it of items) {
        // Only update if there's an actual change to avoid unnecessary updates
        const updated: any = { ...it };
        let changed = false;

        if (exemptionId !== undefined && String(updated.pwdId || '') !== String(exemptionId || '')) {
          updated.pwdId = exemptionId || '';
          changed = true;
        }

        if (customerName !== undefined && String(updated.customerName || '') !== String(customerName || '')) {
          updated.customerName = customerName || '';
          changed = true;
        }

        if (discountType !== undefined && String(updated.customerDiscount || '') !== String(discountType || '')) {
          updated.customerDiscount = discountType || '';
          changed = true;
        }

        if (changed) {
          this.posService.updateCartItem(updated);
        }
      }
    } catch (err) {
      console.warn('Failed to apply live customer info to cart items:', err);
    }
  }

  removeOrderDiscount(): void {
    // Clear the order discount and remove propagated per-item discounts
    const existing = this.posService.orderDiscount();
    this.posService.removeOrderDiscount();

    try {
      const items = this.cartItems();
      if (Array.isArray(items) && items.length > 0) {
        for (const it of items) {
          const updated: any = { ...it };
          // Only clear the per-item discount fields if they were set by order-level discount
          // Conservative approach: clear hasDiscount and discountValue for all items
          updated.hasDiscount = false;
          updated.discountValue = 0;
          updated.discountType = 'percentage';
          // Also clear propagated customer identification fields
          if ((updated as any).pwdId) updated.pwdId = '';
          if ((updated as any).customerName) updated.customerName = '';
          if ((updated as any).customerDiscount) updated.customerDiscount = '';
          this.posService.updateCartItem(updated);
        }
      }
    } catch (err) {
      console.warn('Failed to clear per-item discounts after removing order discount:', err);
    }
  }

  // Confirmation dialog methods
  showConfirmationDialog(data: ConfirmationDialogData): Promise<boolean> {
    return new Promise((resolve) => {
      this.confirmationDialogDataSignal.set(data);
      this.isConfirmationDialogVisibleSignal.set(true);
      // Reset last reason
      this.lastConfirmationReasonSignal.set(null);
      // Store the resolve function for use in dialog action handlers
      (this as any)._confirmationResolve = resolve;
    });
  }
  onConfirmationConfirmed(event?: { reason?: string }): void {
    this.isConfirmationDialogVisibleSignal.set(false);
    this.confirmationDialogDataSignal.set(null);
    // Store reason if provided
    if (event && event.reason) this.lastConfirmationReasonSignal.set(event.reason);
    // Resolve with true (confirmed)
    if ((this as any)._confirmationResolve) {
      (this as any)._confirmationResolve(true);
      (this as any)._confirmationResolve = null;
    }
  }

  onConfirmationCancelled(): void {
    this.isConfirmationDialogVisibleSignal.set(false);
    this.confirmationDialogDataSignal.set(null);
    this.lastConfirmationReasonSignal.set(null);
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
      await this.productService.initializeProducts(storeId, true); // Force reload
      
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

  // trackBy function for cart item ngFor to preserve DOM nodes (prevents input losing focus)
  public trackByCartItem(index: number, item: any): string | number {
    try {
      return item?.productId || item?.skuId || index;
    } catch (err) {
      return index;
    }
  }

  /**
   * Test Firestore connection and product data availability
   */
  private async testFirestoreConnection(): Promise<void> {
    try {
      console.log('🧪 === FIRESTORE CONNECTION TEST ===');
      
      // Test 1: Check authentication
      const currentUser = this.authService.getCurrentUser();
      const currentPermission = this.authService.getCurrentPermission();
      
      console.log('🔑 Auth Status:', {
        user: currentUser?.email || 'No user',
        permission: currentPermission || 'No permission',
        companyId: currentPermission?.companyId || 'No company',
        storeId: currentPermission?.storeId || 'No store'
      });
      
      if (!currentUser) {
        console.log('❌ Test skipped - no user authenticated');
        return;
      }
      
      // Test 2: Direct Firestore query
      console.log('🔍 Testing direct Firestore access...');
      const { collection, query, where, getDocs, limit } = await import('@angular/fire/firestore');
      const firestore = (this.productService as any)['firestore']; // Access private firestore instance
      
      const productsRef = collection(firestore, 'products');
      const basicQuery = query(productsRef, limit(5));
      const basicSnapshot = await getDocs(basicQuery);
      
      console.log('📊 Total products in collection:', basicSnapshot.size);
      
      if (basicSnapshot.empty) {
        console.log('❌ Products collection is empty!');
        return;
      }
      
      // Test 3: Analyze structure
      const companies = new Set<string>();
      const stores = new Set<string>();
      const statuses = new Set<string>();
      
      basicSnapshot.docs.forEach(doc => {
        const data = doc.data();
        console.log('📦 Sample product:', {
          id: doc.id,
          name: data['productName'],
          company: data['companyId'],
          store: data['storeId'],
          status: data['status']
        });
        
        if (data['companyId']) companies.add(data['companyId']);
        if (data['storeId']) stores.add(data['storeId']);
        if (data['status']) statuses.add(data['status']);
      });
      
      console.log('📈 Data Summary:');
      console.log('🏢 Companies:', Array.from(companies));
      console.log('🏪 Stores:', Array.from(stores));
      console.log('📊 Statuses:', Array.from(statuses));
      
      // Test 4: Try ProductService query pattern
      if (currentPermission?.companyId) {
        console.log('🎯 Testing ProductService query pattern...');
        
        const testQuery = query(
          productsRef,
          where('companyId', '==', currentPermission.companyId),
          where('status', '==', ProductStatus.Active),
          limit(10)
        );
        
        const testSnapshot = await getDocs(testQuery);
        console.log('🎯 ProductService pattern results:', testSnapshot.size, 'products');
        
        if (testSnapshot.empty) {
          console.log('❌ No products found with ProductService query!');
          console.log('💡 Check if products have correct companyId and status=active');
        } else {
          console.log('✅ ProductService query pattern works!');
          testSnapshot.docs.forEach(doc => {
            const data = doc.data();
            console.log('  📦', data['productName'], '(Store:', data['storeId'], ')');
          });
        }
      }
      
      console.log('🧪 === END FIRESTORE TEST ===');
      
    } catch (error) {
      console.error('❌ Firestore test error:', error);
    }
  }

  getProductTagLabels(product: Product): string[] {
    // Use denormalized tagLabels from product document for instant display
    if (product.tagLabels && product.tagLabels.length > 0) {
      // console.log('🏷️ Product', product.productName, 'has tagLabels:', product.tagLabels);
      return product.tagLabels;
    }
    // Fallback: if tagLabels not available, return empty (old products)
    if (product.tags && product.tags.length > 0) {
      // console.log('⚠️ Product', product.productName, 'has tags but no tagLabels:', product.tags);
    }
    return [];
  }

  /**
   * Toggle tag filter section expand/collapse
   */
  toggleTagFilterSection(): void {
    this.isTagFilterExpanded.set(!this.isTagFilterExpanded());
  }

  /**
   * Toggle hotkey section expand/collapse
   */
  toggleHotkeySection(): void {
    this.isHotkeyExpanded.set(!this.isHotkeyExpanded());
  }

  /**
   * Toggle invoice section expand/collapse
   */
  toggleInvoiceSection(): void {
    this.isInvoiceExpanded.set(!this.isInvoiceExpanded());
  }

  /**
   * Toggle a tag label filter on/off
   */
  toggleTagFilter(tagLabel: string): void {
    const currentFilters = this.activeTagFilters();
    const index = currentFilters.indexOf(tagLabel);
    
    if (index > -1) {
      // Remove filter if already active
      this.activeTagFilters.set(currentFilters.filter(label => label !== tagLabel));
      console.log('🏷️ Removed tag filter:', tagLabel, 'Active filters:', this.activeTagFilters());
    } else {
      // Add filter
      this.activeTagFilters.set([...currentFilters, tagLabel]);
      console.log('🏷️ Added tag filter:', tagLabel, 'Active filters:', this.activeTagFilters());
    }
  }

  /**
   * Check if a tag label is currently active in filters
   */
  isTagFilterActive(tagLabel: string): boolean {
    return this.activeTagFilters().includes(tagLabel);
  }

  /**
   * Load available tags from database for current store
   */
  async loadAvailableTags(): Promise<void> {
    const storeId = this.selectedStoreId();
    if (!storeId) {
      this.availableTagsByGroup.set([]);
      return;
    }

    try {
      console.log('🏷️ Loading tags from database for store:', storeId);
      const tags = await this.posService.getTagsForStore(storeId);
      console.log('🏷️ Loaded tags from database:', tags);

      // Group tags by their group field and track first createdAt per group
      const groupMap = new Map<string, { id: string; label: string; createdAt?: any }[]>();
      const groupFirstCreatedAt = new Map<string, any>();
      
      tags.forEach(tag => {
        const group = tag.group || 'Other';
        if (!groupMap.has(group)) {
          groupMap.set(group, []);
          // Track the first createdAt for this group
          groupFirstCreatedAt.set(group, tag.createdAt);
        }
        groupMap.get(group)!.push({
          id: tag.id || tag.tagId,
          label: tag.label,
          createdAt: tag.createdAt
        });
      });

      // Convert to array and sort groups by their first createdAt (ascending)
      const tagsByGroup = Array.from(groupMap.entries())
        .map(([group, tags]) => ({
          group: group.charAt(0).toUpperCase() + group.slice(1),
          tags: tags, // Keep database order (createdAt asc within group)
          firstCreatedAt: groupFirstCreatedAt.get(group)
        }))
        .sort((a, b) => {
          // Sort by first createdAt of each group
          const timeA = a.firstCreatedAt?.toMillis?.() || a.firstCreatedAt?.getTime?.() || 0;
          const timeB = b.firstCreatedAt?.toMillis?.() || b.firstCreatedAt?.getTime?.() || 0;
          return timeA - timeB;
        });

      console.log('🏷️ Tags grouped by category:', tagsByGroup);
      this.availableTagsByGroup.set(tagsByGroup);
    } catch (error) {
      console.error('❌ Failed to load tags:', error);
      this.availableTagsByGroup.set([]);
    }
  }

  getAvailableTagGroups(): { group: string; labels: string[] }[] {
    const storeId = this.selectedStoreId();
    console.log('🏷️ getAvailableTagGroups called for storeId:', storeId);
    if (!storeId) return [];

    // Get all products for current store
    const storeProducts = this.products().filter(p => p.storeId === storeId);
    console.log('🏷️ Store products count:', storeProducts.length);
    
    // Debug: Log ALL products to see what they contain
    storeProducts.forEach(product => {
      console.log('🔍 Product:', product.productName, {
        hasTags: !!product.tags,
        hasTagLabels: !!product.tagLabels,
        tagsLength: product.tags?.length || 0,
        tagLabelsLength: product.tagLabels?.length || 0,
        tags: product.tags,
        tagLabels: product.tagLabels
      });
    });
    
    // Collect all tags with their IDs from products
    const tagMap = new Map<string, Set<string>>(); // group -> Set of labels
    
    storeProducts.forEach(product => {
      if (product.tags && product.tagLabels && product.tags.length === product.tagLabels.length) {
        console.log('✅ Product', product.productName, 'has matching tags:', product.tags, 'labels:', product.tagLabels);
        product.tags.forEach((tagId, index) => {
          // Extract group from tagId (format: group_value)
          const parts = tagId.split('_');
          if (parts.length >= 2) {
            const group = parts[0];
            const label = product.tagLabels![index];
            console.log('🏷️ Adding to group', group, 'label:', label);
            
            if (!tagMap.has(group)) {
              tagMap.set(group, new Set());
            }
            tagMap.get(group)!.add(label);
          }
        });
      } else if (product.tags || product.tagLabels) {
        console.log('⚠️ Product', product.productName, 'has mismatched tags/labels:', { tags: product.tags, tagLabels: product.tagLabels });
      }
    });

    console.log('🏷️ Final tagMap:', Array.from(tagMap.entries()));

    // Convert to array format
    const result = Array.from(tagMap.entries())
      .map(([group, labels]) => ({
        group: group.charAt(0).toUpperCase() + group.slice(1),
        labels: Array.from(labels).sort()
      }))
      .sort((a, b) => a.group.localeCompare(b.group));
    
    console.log('🏷️ Returning tag groups:', result);
    return result;
  }
}
