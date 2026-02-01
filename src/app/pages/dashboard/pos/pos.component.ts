import { Component, OnInit, AfterViewInit, OnDestroy, HostListener, ViewChild, ElementRef, computed, signal, inject, ChangeDetectorRef } from '@angular/core';
import { Firestore, doc, getDoc, getDocs, updateDoc, collection, query, where } from '@angular/fire/firestore';
import { onSnapshot } from 'firebase/firestore';
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
import { InvoiceService } from '../../../services/invoice.service';
import { UserRoleService } from '../../../services/user-role.service';
import { CustomerService } from '../../../services/customer.service';
import { CompanyService } from '../../../services/company.service';
import { TranslationService } from '../../../services/translation.service';
import { TranslateModule } from '@ngx-translate/core';
import { Product } from '../../../interfaces/product.interface';
import { Store } from '../../../interfaces/store.interface';
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
  @ViewChild('accessTabListContainer', { read: ElementRef }) accessTabListContainer?: ElementRef;

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
  private invoiceService = inject(InvoiceService);
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
  private cdr = inject(ChangeDetectorRef);

  private routerSubscription: any;
  private inventorySnapshotUnsubscribe?: (() => void) | null = null; // Firestore snapshot listener cleanup
  private resizeListener?: () => void;
  
  // Touch event properties for swipe navigation
  private touchStartX: number = 0;
  private touchEndX: number = 0;
  private readonly minSwipeDistance = 50; // Minimum distance for swipe

  // Mobile cart FAB drag state (prevents hiding tiles on small screens)
  private readonly mobileCartFabStorageKey = 'pos.mobileCartFabPosition.v1';
  readonly mobileCartFabPosition = signal<{ x: number; y: number } | null>(null);
  private mobileCartFabPointerId: number | null = null;
  private mobileCartFabDragStart:
    | { pointerX: number; pointerY: number; startX: number; startY: number }
    | null = null;
  private mobileCartFabDidDrag = false;
  private readonly mobileCartFabSizePx = 56;
  private readonly mobileCartFabEdgeMarginPx = 8;
  
  // Barcode image cache
  private barcodeImageCache = new Map<string, SafeUrl>();
  
  // Expose Math for template
  readonly Math = Math;

  constructor() {
    
    // Listen for navigation events
    this.routerSubscription = this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        if (event.url === '/pos') {
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
  
  // Cached company data for faster receipt preparation
  private cachedCompanySignal = signal<any>(null);
  
  // Available stores signal
  private storesSignal = signal<Store[]>([]);
  readonly availableStores = computed(() => this.storesSignal());
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
    
    // Check for missing required fields in products
    if (prods.length > 0) {
      const sampleProduct = prods[0];
      
      const requiredFields = ['uid', 'productName', 'skuId', 'unitType', 'category', 'companyId', 'storeId', 'isVatApplicable', 'hasDiscount', 'discountType'];
      const missingFields = requiredFields.filter(field => 
        sampleProduct[field as keyof Product] === undefined || 
        sampleProduct[field as keyof Product] === null ||
        sampleProduct[field as keyof Product] === ''
      );
      
      if (missingFields.length > 0) {
        console.warn('⚠️ Missing or empty required fields in products:', missingFields);
      }
    }
    
    return prods;
  });
  readonly categories = computed(() => {
    // Get all categories from ALL products (global categories)
    // Categories should be visible across all stores
    const allProducts = this.products();
    const categorySet = new Set(allProducts.map(p => p.category).filter(cat => cat && cat.trim()));
    const cats = Array.from(categorySet).sort();
    
    return cats;
  });
  
  readonly currentStoreInfo = computed(() => 
    this.availableStores().find(s => s.id === this.selectedStoreId())
  );

  // Check if current store has no products
  readonly currentStoreHasNoProducts = computed(() => {
    const storeId = this.selectedStoreId();
    const filtered = this.filteredProducts();
    const allProducts = this.products();
    
    if (!storeId) return false;
    
    // Check if there are any products for this specific store
    const storeProducts = allProducts.filter(p => p.storeId === storeId);
    return storeProducts.length === 0 && filtered.length === 0;
  });

  // Get store name for empty state message
  readonly currentStoreName = computed(() => {
    const store = this.currentStoreInfo();
    return store?.storeName || 'Unknown Store';
  });

  // Sorting mode for products list/grid
  private sortModeSignal = signal<'asc' | 'desc' | 'mid'>('asc');
  readonly sortMode = computed(() => this.sortModeSignal());

  // Sort dropdown open state (for Excel-like menu)
  private sortMenuOpenSignal = signal<boolean>(false);
  readonly sortMenuOpen = computed(() => this.sortMenuOpenSignal());

  // Tag filters
  readonly activeTagFilters = signal<string[]>([]); // Track active tag label filters
  readonly availableTagsByGroup = signal<{ group: string; tags: { id: string; label: string }[] }[]>([]); // Tags from database
  
  // Check if current store's products have any tags
  readonly hasProductsWithTags = computed(() => {
    const filtered = this.filteredProducts();
    const hasTags = filtered.some(product => product.tagLabels && product.tagLabels.length > 0);
    return hasTags;
  });
  
  readonly isTagFilterExpanded = signal<boolean>(true); // Track tag filter section collapse state

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
  onEscapeKey(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    keyboardEvent.stopPropagation();
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
    if (this.isMobileView()) return 6; // Mobile: 2 cols × 3 rows = 6 items
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
  readonly payingForExistingOrder = signal<any | null>(null); // Tracks if paying for existing OPEN order
  paymentAmountTendered: number = 0;
  paymentDescription: string = '';
  paymentType: string = 'Cash';
  tableNumber: string = '';

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
      // Generate a preview invoice number that works both online and offline
      const storeId = this.selectedStoreId();
      if (!storeId) {
        console.log('📋 No store selected - using default placeholder');
        this.nextInvoiceNumber.set('INV-0000-000000');
        this.invoiceNumber = 'INV-0000-000000';
        return;
      }
      
      const previewInvoice = await this.invoiceService.getNextInvoiceNumberPreview(storeId);
      
      this.nextInvoiceNumber.set(previewInvoice);
      this.invoiceNumber = previewInvoice;
    } catch (error) {
      console.error('Error loading invoice preview:', error);
      // Even on error, generate a basic preview
      const fallback = this.storeService.generateRandomInvoiceNo();
      this.nextInvoiceNumber.set(fallback);
      this.invoiceNumber = fallback;
    }
  }

  readonly filteredProducts = computed(() => {
    const allProducts = this.products();
    const storeId = this.selectedStoreId();
    const stores = this.availableStores();

    let filtered = allProducts;

    // ✅ FIXED: Simplified store filtering logic
    if (storeId && stores.length > 0) {
      // Filter products that belong to the selected store OR have no storeId (global products)
      filtered = allProducts.filter(p => {
        const belongsToStore = p.storeId === storeId;
        const isGlobalProduct = !p.storeId;
        const included = belongsToStore || isGlobalProduct;
        
        if (!included && p.storeId) {
        }
        
        return included;
      });
    } else if (stores.length > 0) {
      // If no specific store selected but stores available, use all store products
      const storeIds = stores.map(s => s.id).filter(Boolean);
      filtered = allProducts.filter(p => !p.storeId || storeIds.includes(p.storeId));
    } else {
      // No stores available - show all products (fallback)
    }

    // Filter by category
    const category = this.selectedCategory();
    if (category !== 'all') {
      const beforeCategoryCount = filtered.length;
      filtered = filtered.filter(p => p.category === category);
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
  readonly accessTabs = ['New', 'Orders', 'Open', 'Cancelled', 'Returns', 'Refunds', 'Damage', 'Unpaid', 'Recovered', 'Split Payments', 'Discounts & Promotions'] as const;
  private accessTabSignal = signal<string>('New');
  readonly accessTab = computed(() => this.accessTabSignal());
  
  // Access tab scrolling for mobile
  accessTabScrollPosition = 0;

  // Method to translate access tab names
  getAccessTabTranslation(tab: string): string {
    const tabKeyMap: { [key: string]: string } = {
      'New': 'pos.newTab',
      'Orders': 'pos.ordersTab',
      'Open': 'pos.openTab',
      'Cancelled': 'pos.cancelledTab',
      'Returns': 'pos.returnsTab',
      'Refunds': 'pos.refundsTab',
      'Damage': 'pos.damageTab',
      'Unpaid': 'pos.unpaidTab',
      'Recovered': 'pos.recoveredTab',
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
    
    // New tab shows nothing (for creating new orders)
    if (tab === 'New') {
      return [];
    }
    
    // Orders tab shows closed orders (completed + unpaid)
    if (tab === 'Orders') {
      return allOrders.filter(order => {
        const status = (order.status || '').toString().toLowerCase();
        return status === 'completed' || status === 'unpaid';
      });
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
        case 'Open':
          // Only show orders with current status OPEN (not historical)
          matches = order.status?.toLowerCase() === 'open';
          break;
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
        case 'Unpaid':
          // Only show orders with current status 'unpaid', exclude recovered orders
          matches = order.status?.toLowerCase() === 'unpaid';
          break;
        case 'Recovered':
          matches = order.status?.toLowerCase() === 'recovered' || hasStatusInHistory('recovered');
          break;
        case 'Split Payments':
          // Orders with both cash and charge payments
          const hasCashSale = order.cashSale === true;
          const hasChargeSale = order.chargeSale === true;
          const hasCash = (order.cashAmount && order.cashAmount > 0) || false;
          const hasCard = (order.cardAmount && order.cardAmount > 0) || false;
          const isBothPayment = order.paymentMethod?.toLowerCase().includes('both') || false;
          matches = (hasCashSale && hasChargeSale) || (hasCash && hasCard) || isBothPayment;
          // Split payment matched
          break;
        case 'Discounts & Promotions':
          // Orders with discountAmount > 0
          matches = (order.discountAmount && order.discountAmount > 0) || false;
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

  readonly isOrderOpen = computed(() => {
    const order = this.selectedOrder();
    const s = (order?.status || '').toString().toLowerCase();
    const isOpen = s === 'open';
    console.log('🔍 isOrderOpen check:', { status: order?.status, isOpen, currentTab: this.accessTab() });
    return isOpen;
  });

  readonly isOrderUnpaid = computed(() => {
    const s = (this.selectedOrder()?.status || '').toString().toLowerCase();
    return s === 'unpaid';
  });

  readonly isOrderRecovered = computed(() => {
    const s = (this.selectedOrder()?.status || '').toString().toLowerCase();
    return s === 'recovered';
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
    const orderRelatedTabs = ['Orders', 'Open', 'Cancelled', 'Returns', 'Refunds', 'Damage', 'Unpaid', 'Recovered', 'Split Payments', 'Discounts & Promotions'];
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

      
      if (!companyId) {
        console.warn('❌ No company ID available for loading recent orders');
        return;
      }
      
      console.log('📡 Calling orderService.getRecentOrders...');
      const results = await this.orderService.getRecentOrders(companyId, storeId || undefined, 20);
      console.log('✅ Received results:', results.length, 'orders');
      
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
    console.log('📋 Opening order:', { id: order.id, status: order.status, invoiceNumber: order.invoiceNumber });
    this.selectedOrderSignal.set(order);
  }

  closeOrder(): void {
    this.selectedOrderSignal.set(null);
  }

  // Handle "Update Order" button for OPEN orders - loads order back into cart for editing
  async updateOpenOrder(): Promise<void> {
    const order = this.selectedOrder();
    if (!order) {
      console.warn('No order selected');
      return;
    }

    try {
      // Fetch orderDetails documents for this order
      const orderDetailsQuery = query(
        collection(this.firestore, 'orderDetails'),
        where('orderId', '==', order.id)
      );
      const orderDetailsSnapshot = await getDocs(orderDetailsQuery);

      if (orderDetailsSnapshot.empty) {
        await this.showConfirmationDialog({
          title: 'No Items Found',
          message: 'No items found for this order.',
          confirmText: 'OK',
          cancelText: '',
          type: 'warning'
        });
        return;
      }

      // Clear current cart first
      if (this.cartItems().length > 0) {
        const confirmed = await this.showConfirmationDialog({
          title: 'Clear Current Cart?',
          message: 'Current cart will be cleared to load this order. Continue?',
          confirmText: 'Yes',
          cancelText: 'No',
          type: 'warning'
        });
        if (!confirmed) return;
        this.posService.clearCart();
      }

      // Collect all items from orderDetails batches
      let allItems: any[] = [];
      orderDetailsSnapshot.forEach(doc => {
        const data = doc.data();
        if (data['items'] && Array.isArray(data['items'])) {
          allItems = allItems.concat(data['items']);
        }
      });

      // Load items into cart
      for (const item of allItems) {
        // Find the product from the products list
        const product = this.products().find(p => p.id === item.productId);
        if (product) {
          // Add to cart with the original quantity
          this.posService.addToCart(product, item.quantity);
          
          // Update cart item with original pricing and settings
          const cartItem = this.cartItems().find(ci => ci.productId === item.productId);
          if (cartItem) {
            const updatedCartItem = {
              ...cartItem,
              sellingPrice: item.unitPrice || item.sellingPrice || cartItem.sellingPrice,
              discount: item.discount || 0,
              discountType: item.discountType || 'fixed',
              isVatExempt: item.isVatExempt || false,
              isVatApplicable: item.isVatApplicable !== undefined ? item.isVatApplicable : cartItem.isVatApplicable
            };
            this.posService.updateCartItem(updatedCartItem);
          }
        }
      }

      // Close the order detail modal and switch to NEW tab
      this.closeOrder();
      this.accessTabSignal.set('New');
      
      // Activate new order state so user can add products
      this.isNewOrderActive.set(true);

      await this.showConfirmationDialog({
        title: 'Order Loaded',
        message: `${allItems.length} item(s) loaded into cart for editing.`,
        confirmText: 'OK',
        cancelText: '',
        type: 'info'
      });

    } catch (error) {
      console.error('Error loading order into cart:', error);
      await this.showConfirmationDialog({
        title: 'Error',
        message: 'Failed to load order into cart.',
        confirmText: 'OK',
        cancelText: '',
        type: 'danger'
      });
    }
  }

  // Handle "Pay Now" button for OPEN orders - shows payment dialog to complete the order
  async payNowForOpenOrder(): Promise<void> {
    const order = this.selectedOrder();
    if (!order) {
      console.warn('No order selected');
      return;
    }

    try {
      // Fetch orderDetails to get items
      const orderDetailsQuery = query(
        collection(this.firestore, 'orderDetails'),
        where('orderId', '==', order.id)
      );
      const orderDetailsSnapshot = await getDocs(orderDetailsQuery);

      if (orderDetailsSnapshot.empty) {
        await this.showConfirmationDialog({
          title: 'No Items Found',
          message: 'No items found for this order.',
          confirmText: 'OK',
          cancelText: '',
          type: 'warning'
        });
        return;
      }

      // Collect all items
      let allItems: any[] = [];
      orderDetailsSnapshot.forEach(doc => {
        const data = doc.data();
        if (data['items'] && Array.isArray(data['items'])) {
          allItems = allItems.concat(data['items']);
        }
      });

      // Store reference to the order being paid for
      this.payingForExistingOrder.set({
        ...order,
        items: allItems
      });

      // Close order detail modal
      this.closeOrder();

      // Pre-fill payment dialog with order amount and table number
      this.paymentAmountTendered = order.totalAmount || 0;
      this.tableNumber = order.tableNumber || '';
      
      // Set default payment method based on order type, default to cash
      if (order.cashSale && order.chargeSale) {
        this.posService.setPaymentMethod('both');
        this.paymentType = 'Both';
      } else if (order.chargeSale) {
        this.posService.setPaymentMethod('charge');
        this.paymentType = 'Charge';
      } else {
        // Default to cash if not specified or if cashSale is true
        this.posService.setPaymentMethod('cash');
        this.paymentType = 'Cash';
      }
      
      console.log('💳 Pre-filling payment dialog for OPEN order - Table Number:', this.tableNumber, 'Amount:', this.paymentAmountTendered, 'Payment Type:', this.paymentType);

      // Show payment dialog
      this.paymentModalVisible.set(true);

    } catch (error) {
      console.error('Error preparing payment for open order:', error);
      await this.showConfirmationDialog({
        title: 'Error',
        message: 'Failed to prepare payment dialog.',
        confirmText: 'OK',
        cancelText: '',
        type: 'danger'
      });
    }
  }

  // Mark an OPEN order as UNPAID while executing background operations
  async markOpenOrderAsUnpaid(): Promise<void> {
    const order = this.selectedOrder();
    if (!order) {
      console.warn('No order selected for UNPAID processing');
      await this.showConfirmationDialog({
        title: 'No Order',
        message: 'No order selected.',
        confirmText: 'OK',
        cancelText: '',
        type: 'info'
      });
      return;
    }

    // Only allow this when the current status is OPEN
    const status = (order.status || '').toString().toLowerCase();
    if (status !== 'open') {
      console.warn('markOpenOrderAsUnpaid called for non-OPEN status:', status);
      await this.showConfirmationDialog({
        title: 'Not Open',
        message: 'Only OPEN orders can be marked as UNPAID.',
        confirmText: 'OK',
        cancelText: '',
        type: 'warning'
      });
      return;
    }

    const confirmed = await this.showConfirmationDialog({
      title: 'Mark as UNPAID',
      message: 'This will close the order as UNPAID and process inventory, tracking, and ledger like a completed order. Continue?',
      confirmText: 'Yes',
      cancelText: 'No',
      type: 'warning'
    });

    if (!confirmed) {
      return;
    }

    try {
      this.posService['isProcessingSignal']?.set(true);

      const orderId = order.id;
      if (!orderId) {
        throw new Error('Order ID is missing');
      }

      // Update the order and orderDetails status from OPEN to UNPAID
      const orderRef = doc(this.firestore, 'orders', orderId);

      const orderDetailsQuery = query(
        collection(this.firestore, 'orderDetails'),
        where('orderId', '==', orderId)
      );
      const orderDetailsSnapshot = await getDocs(orderDetailsQuery);

      const currentUser = this.authService.getCurrentUser();
      const existingStatusHistory = order.statusHistory || [];
      const existingStatusTags = order.statusTags || [];

      // Collect items from orderDetails for tracking
      let allItems: any[] = [];
      orderDetailsSnapshot.forEach(docSnap => {
        const data = docSnap.data();
        console.log('🔍 orderDetails data:', data);
        if (data['items'] && Array.isArray(data['items'])) {
          allItems = allItems.concat(data['items']);
        }
      });
      console.log('🔍 allItems collected:', allItems.length, 'items', allItems);

      const orderUpdate: any = {
        status: 'unpaid',
        tableNumber: order.tableNumber || '',
        statusHistory: [
          ...existingStatusHistory,
          {
            status: 'unpaid',
            changedAt: new Date(),
            changedBy: currentUser?.uid || 'system'
          }
        ],
        statusTags: [...existingStatusTags, 'unpaid'],
        updatedAt: new Date()
      };

      await updateDoc(orderRef, orderUpdate);

      const updatePromises: Promise<void>[] = [];
      orderDetailsSnapshot.forEach(docSnap => {
        updatePromises.push(
          updateDoc(docSnap.ref, {
            status: 'UNPAID',
            updatedAt: new Date().toISOString()
          })
        );
      });
      await Promise.all(updatePromises);

      console.log('✅ Order status updated to UNPAID');

      // Create unpaid tracking entries directly from order items
      console.log('🔄 Creating unpaid tracking entries from order items...');
      
      // Use same source as dashboard overview for companyId/storeId to ensure data matches
      const companyId = order.companyId || this.authService.getCurrentPermission()?.companyId || '';
      const storeId = order.storeId || this.posService.selectedStoreId() || '';
      console.log('🔍 markOpenOrderAsUnpaid: using companyId=', companyId, 'storeId=', storeId);
      
      // Record ledger entry for unpaid (same pattern as completed orders)
      try {
        const totalAmount = Number(order.totalAmount || order.netAmount || 0);
        const totalQuantity = allItems.reduce((sum: number, item: any) => sum + (Number(item.quantity || item.qty) || 1), 0) || 1;
        
        await this.ledgerService.recordEvent(
          companyId,
          storeId,
          orderId,
          'unpaid',
          totalAmount,
          totalQuantity,
          currentUser?.uid || 'system'
        );
        console.log('✅ Unpaid ledger entry recorded - amount:', totalAmount, 'qty:', totalQuantity);
      } catch (ledgerError) {
        console.warn('⚠️ Failed to record unpaid ledger entry:', ledgerError);
      }
      
      // Create tracking entries (optional - for item-level tracking)
      try {
        // Map items to the format expected by createUnpaidTrackingFromOrder
        const trackingItems = allItems.map((item: any) => ({
          productId: item.productId || item.id,
          productName: item.productName || item.name,
          productCode: item.productCode || item.code,
          sku: item.sku || item.skuId,
          quantity: item.quantity || item.qty || 1,
          price: item.price || item.sellingPrice || item.unitPrice || 0,
          total: item.total || item.lineTotal || ((item.price || item.sellingPrice || 0) * (item.quantity || 1))
        }));

        if (trackingItems.length > 0) {
          const unpaidResult = await this.ordersSellingTrackingService.createUnpaidTrackingFromOrder(
            orderId,
            companyId,
            storeId,
            trackingItems,
            currentUser?.uid || 'system',
            'Marked as unpaid from open order'
          );
          console.log('✅ Unpaid tracking entries created:', unpaidResult);
        } else {
          console.log('⚠️ No items found for tracking, skipping tracking creation');
        }
      } catch (trackingError) {
        console.warn('⚠️ Failed to create unpaid tracking entries (non-critical):', trackingError);
      }

      // Close details modal and refresh list
      this.closeOrder();
      await this.loadRecentOrders();

      await this.showConfirmationDialog({
        title: 'Marked as UNPAID',
        message: `Order ${order.invoiceNumber || orderId} has been closed as UNPAID.`,
        confirmText: 'OK',
        cancelText: '',
        type: 'info'
      });

    } catch (error) {
      console.error('❌ Error marking OPEN order as UNPAID:', error);
      await this.showConfirmationDialog({
        title: 'Failed',
        message: 'Failed to mark order as UNPAID. Please try again.',
        confirmText: 'OK',
        cancelText: '',
        type: 'danger'
      });
    } finally {
      this.posService['isProcessingSignal']?.set(false);
    }
  }

  // Pay Now for an UNPAID order (converts it to recovered)
  async payNowForUnpaidOrder(): Promise<void> {
    const order = this.selectedOrder();
    if (!order) {
      console.warn('No order selected');
      return;
    }

    // Verify order is unpaid
    const status = (order.status || '').toString().toLowerCase();
    if (status !== 'unpaid') {
      console.warn('payNowForUnpaidOrder called for non-UNPAID status:', status);
      await this.showConfirmationDialog({
        title: 'Not Unpaid',
        message: 'Only UNPAID orders can be recovered.',
        confirmText: 'OK',
        cancelText: '',
        type: 'warning'
      });
      return;
    }

    try {
      // Fetch orderDetails to get items
      const orderDetailsQuery = query(
        collection(this.firestore, 'orderDetails'),
        where('orderId', '==', order.id)
      );
      const orderDetailsSnapshot = await getDocs(orderDetailsQuery);

      if (orderDetailsSnapshot.empty) {
        await this.showConfirmationDialog({
          title: 'No Items Found',
          message: 'No items found for this order.',
          confirmText: 'OK',
          cancelText: '',
          type: 'warning'
        });
        return;
      }

      // Collect all items
      let allItems: any[] = [];
      orderDetailsSnapshot.forEach(doc => {
        const data = doc.data();
        if (data['items'] && Array.isArray(data['items'])) {
          allItems = allItems.concat(data['items']);
        }
      });

      // Store reference to the unpaid order being recovered
      this.payingForExistingOrder.set({
        ...order,
        items: allItems,
        isRecovery: true // Flag to indicate this is a recovery from unpaid
      });

      // Close order detail modal
      this.closeOrder();

      // Pre-fill payment dialog with order amount
      this.paymentAmountTendered = order.totalAmount || 0;
      this.tableNumber = order.tableNumber || '';
      
      // Default to cash payment
      this.posService.setPaymentMethod('cash');
      this.paymentType = 'Cash';
      
      console.log('💳 Pre-filling payment dialog for UNPAID order recovery - Amount:', this.paymentAmountTendered);

      // Show payment dialog
      this.paymentModalVisible.set(true);

    } catch (error) {
      console.error('Error preparing payment for unpaid order:', error);
      await this.showConfirmationDialog({
        title: 'Error',
        message: 'Failed to prepare payment dialog.',
        confirmText: 'OK',
        cancelText: '',
        type: 'danger'
      });
    }
  }

  // Process payment for an existing OPEN order (converts it to completed)
  // Also handles UNPAID orders being recovered (converts to recovered)
  async processPaymentForExistingOrder(orderData: any): Promise<void> {
    try {
      this.posService['isProcessingSignal']?.set(true);
      
      // Check if this is a recovery from unpaid status
      const isRecovery = orderData.isRecovery === true;
      const targetStatus = isRecovery ? 'recovered' : 'completed';
      
      console.log(`💳 Processing payment for existing ${isRecovery ? 'UNPAID' : 'OPEN'} order:`, orderData.id);

      const totalAmount = orderData.totalAmount || 0;
      const tendered = this.paymentAmountTendered || 0;

      // Validate payment amount
      if (tendered < totalAmount) {
        console.warn('⚠️ Insufficient amount tendered');
        await this.showConfirmationDialog({
          title: 'Insufficient Amount',
          message: `Please tender at least ₱${totalAmount.toFixed(2)}`,
          confirmText: 'OK',
          cancelText: '',
          type: 'warning'
        });
        this.posService['isProcessingSignal']?.set(false);
        return;
      }

      const change = tendered - totalAmount;

      // Capture payment info and table number BEFORE closing dialog
      const tableNumber = this.tableNumber;
      const paymentType = this.paymentType;
      const paymentDescription = this.paymentDescription;
      
      const paymentsData = {
        amountTendered: tendered,
        changeAmount: Math.max(0, change),
        paymentDescription: paymentDescription || (isRecovery ? 'Payment for UNPAID order (recovered)' : 'Payment for OPEN order'),
        paymentType: paymentType
      };

      // Determine cashSale and chargeSale flags based on payment type
      const isCashSale = this.posService.isCashSale();
      const isChargeSale = this.posService.isChargeSale();

      // Close payment dialog
      this.closePaymentDialog();

      // Update the order and orderDetails status
      const orderRef = doc(this.firestore, 'orders', orderData.id);
      
      // Get all orderDetails docs for this order
      const orderDetailsQuery = query(
        collection(this.firestore, 'orderDetails'),
        where('orderId', '==', orderData.id)
      );
      const orderDetailsSnapshot = await getDocs(orderDetailsQuery);

      // Prepare order update with all payment-related fields
      const currentUser = this.authService.getCurrentUser();
      const existingStatusHistory = orderData.statusHistory || [];
      const existingStatusTags = orderData.statusTags || [];
      
      const orderUpdate: any = {
        status: targetStatus,
        payments: {
          amountTendered: paymentsData.amountTendered,
          changeAmount: paymentsData.changeAmount,
          paymentDescription: paymentsData.paymentDescription,
          paymentType: paymentsData.paymentType
        },
        tableNumber: tableNumber || '',
        cashSale: isCashSale,
        chargeSale: isChargeSale,
        statusHistory: [...existingStatusHistory, {
          status: targetStatus,
          changedAt: new Date(),
          changedBy: currentUser?.uid || 'system'
        }],
        statusTags: [...existingStatusTags, targetStatus],
        updatedAt: new Date()
      };

      // Update order document
      await updateDoc(orderRef, orderUpdate);

      // Update all orderDetails documents
      const updatePromises: Promise<void>[] = [];
      orderDetailsSnapshot.forEach(doc => {
        updatePromises.push(
          updateDoc(doc.ref, {
            status: targetStatus.toUpperCase(),
            updatedAt: new Date().toISOString()
          })
        );
      });
      await Promise.all(updatePromises);

      console.log(`✅ Order status updated to ${targetStatus}`);

      // Execute background operations (tracking, inventory, ledger) - only for non-recovery
      if (!isRecovery) {
        console.log('🔄 Executing background operations for existing order...');
        try {
          await this.posService.executeBackgroundOperationsForExistingOrder(
            orderData.id,
            orderData.invoiceNumber
          );
          console.log('✅ Background operations completed successfully');
        } catch (bgError) {
          console.warn('⚠️ Background operations failed (non-critical):', bgError);
          // Continue with success flow even if background operations fail
        }
      }

      // If this is a recovery from unpaid, create recovered tracking entries
      if (isRecovery) {
        console.log('🔄 Creating recovered tracking entries for unpaid order...');
        try {
          const recoveredResult = await this.ordersSellingTrackingService.markOrderTrackingRecovered(
            orderData.id,
            currentUser?.uid || 'system',
            'Recovered from unpaid status - payment received'
          );
          console.log('✅ Recovered tracking entries created:', recoveredResult);
        } catch (trackingError) {
          console.warn('⚠️ Failed to create recovered tracking entries (non-critical):', trackingError);
        }
      }

      // Clear the paying flag
      this.payingForExistingOrder.set(null);
      
      // Close order details modal
      this.closeOrder();

      // Show success and receipt
      await this.showConfirmationDialog({
        title: '✅ Payment Successful',
        message: `Order ${orderData.invoiceNumber} has been ${isRecovery ? 'recovered' : 'completed'}.`,
        confirmText: 'OK',
        cancelText: '',
        type: 'info'
      });

      // Build normalized receipt data for preview (ensure fields expected by receipt template exist)
      const storeInfo: any = this.currentStoreInfo() || {};
      const items = (orderData.items || orderData.orderItems || []).map((it: any) => ({
        productName: it.productName || it.name || it.title || 'Item',
        skuId: it.skuId || it.productId || '',
        quantity: it.quantity || it.qty || 1,
        unitType: it.unitType || 'pieces',
        sellingPrice: it.price || it.sellingPrice || it.unitPrice || 0,
        total: it.total || (it.price || it.sellingPrice || 0) * (it.quantity || 1),
        vatAmount: it.vat || it.tax || 0,
        discountAmount: it.discount || 0
      }));

      const normalizedReceipt: any = {
        orderId: orderData.id || orderData.orderId || null,
        invoiceNumber: orderData.invoiceNumber || orderData.invoice || this.nextInvoiceNumber(),
        receiptDate: orderData.completedAt || orderData.updatedAt || new Date(),
        storeInfo: {
          storeName: storeInfo.storeName || storeInfo.name || 'Store Name',
          address: storeInfo.address || '',
          phone: storeInfo.phoneNumber || storeInfo.phone || '',
          email: storeInfo.email || '',
          tin: storeInfo.tinNumber || storeInfo.tin || 'N/A',
          invoiceType: storeInfo.invoiceType || 'SALES INVOICE'
        },
        customerName: orderData.customerName || orderData.soldTo || null,
        customerAddress: orderData.customerAddress || orderData.soldToAddress || null,
        customerTin: orderData.customerTin || orderData.soldToTin || null,
        cashier: orderData.cashier || orderData.cashierName || currentUser?.displayName || currentUser?.email || 'N/A',
        paymentMethod: isCashSale ? 'Cash' : 'Charge',
        isCashSale: isCashSale,
        isChargeSale: isChargeSale,
        items,
        subtotal: orderData.subtotal || orderData.grossAmount || items.reduce((s: number, i: any) => s + (i.total || 0), 0),
        vatAmount: orderData.vatAmount || orderData.tax || 0,
        vatExempt: orderData.vatExempt || 0,
        discount: orderData.discount || 0,
        totalAmount: orderData.total || orderData.netAmount || orderData.amount || 0,
        orderDiscount: orderData.orderDiscount || null,
        payments: paymentsData,
        tableNumber: tableNumber,
        status: 'completed'
      };

      this.receiptDataSignal.set(normalizedReceipt);
      this.isReceiptModalVisibleSignal.set(true);

      // Refresh orders list
      await this.loadRecentOrders();

    } catch (error) {
      console.error('❌ Error processing payment for existing order:', error);
      await this.showConfirmationDialog({
        title: 'Payment Failed',
        message: 'Failed to process payment. Please try again.',
        confirmText: 'OK',
        cancelText: '',
        type: 'danger'
      });
    } finally {
      this.posService['isProcessingSignal']?.set(false);
      this.payingForExistingOrder.set(null);
    }
  }

  // Open Manage Item Status modal and load tracking entries for the currently selected order
  async openManageItemStatus(mode?: 'return' | 'damage' | null): Promise<void> {
    try {
      // Store the requested mode (used by the modal UI if needed)
      this.trackingModeSignal.set(mode || null);

      const order = this.selectedOrder();
      const orderId = order?.id || order?.orderId || '';
      
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
    console.log('🔐 onManagerAuthConfirm: creds submitted (redacted)');

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
      

      
      if (!snap || snap.empty) {
        console.log('❌ No user found with this code/email');
        return false;
      }

      const currentStore = this.selectedStoreId();

      for (const docSnap of snap.docs) {
        const data: any = docSnap.data();
        
        // Basic pin match (assumes pin stored in users collection as plain or comparable string)
        if ((data.pin || '').toString() !== pin.toString()) {
          continue;
        }

        // Check if user has managerial role - bypass store check (check both 'role' and 'roleId' fields)
        const userRole = (data.role || data.roleId || '').toLowerCase();
        const managerialRoles = ['manager', 'admin', 'creator', 'owner', 'store_manager', 'store manager'];
        if (managerialRoles.includes(userRole)) {
          return true;
        }

        // Fallback: If no role but user has admin-like characteristics, allow authorization
        if (!data.role || data.role === '') {
          // Check if user has companyId (any company-level user can authorize)
          if (data.companyId) {
            console.log('✅ User has companyId, authorization granted');
            return true;
          }
          // Check if user has access to multiple stores (likely an admin)
          if (Array.isArray(data.permissions) && data.permissions.length > 1) {
            console.log('✅ User has multiple store permissions, likely admin - authorization granted');
            return true;
          }
        }

        // Otherwise must be authorized for the currently selected store
        // Check permission/store mapping - flexible support for different shapes
        // 1) direct storeId on user
        if (data.storeId && currentStore && data.storeId === currentStore) return true;

        // 2) permission object
        if (data.permission && data.permission.storeId && currentStore && data.permission.storeId === currentStore) return true;

        // 3) permissions array - check if any permission matches the current store
        if (Array.isArray(data.permissions) && data.permissions.length > 0 && currentStore) {
          for (const perm of data.permissions) {
            if (perm && perm.storeId && perm.storeId === currentStore) return true;
          }
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

        // Use already-loaded products for SKU lookup when missing on order items
        const allProducts: any[] = this.products ? this.products() : [];

        return (itemsSource || []).map((item: any) => {
          const productName = item.productName || item.name;

          // Primary sources: explicit SKU fields on the order item
          let skuId: string = item.skuId || item.sku || '';

          // If SKU is missing, try to resolve it from cached products using productId / productCode / name
          if (!skuId && Array.isArray(allProducts) && allProducts.length > 0) {
            const productId = item.productId || item.product_id || '';
            let matched: any = null;

            if (productId) {
              matched = allProducts.find((p: any) =>
                p.id === productId ||
                p.skuId === productId ||
                p.productCode === productId
              );
            }

            // As a last resort, try matching by product name
            if (!matched && productName) {
              matched = allProducts.find((p: any) => p.productName === productName);
            }

            if (matched?.skuId) {
              skuId = matched.skuId;
            }
          }

          return {
            productName,
            // Only use real SKU values (from order item or product), never document IDs
            skuId,
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
          };
        });
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
    
    // Set default payment method to cash
    this.posService.setPaymentMethod('cash');
    
    // Set default tab to first available tab
    if (this.accessTabs.length > 0) {
      this.accessTabSignal.set(this.accessTabs[0]);
    }
    
    // Scroll to top when POS component loads
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
    
    // Add window resize listener for mobile view
    if (typeof window !== 'undefined') {
      this.resizeListener = () => {
        this.isMobileView.set(window.innerWidth < 768);
        this.clampMobileCartFabPositionToViewport();
      };
      window.addEventListener('resize', this.resizeListener);
    }

    // Restore draggable FAB position (if user moved it)
    this.restoreMobileCartFabPosition();
    
    // Add Firestore test
    await this.testFirestoreConnection();
    
    try {
      // Load company data early for faster receipt preparation
      this.loadCompanyDataForReceipts();
      
      // Load data first to ensure stores and products are available
      await this.loadData();
      
      // Load stores using the same method as Access Management
      await this.loadStoresForPOS();
      
      // Set current date and time
      this.updateCurrentDateTime();
      
      // Load next invoice number preview
      await this.loadNextInvoicePreview();
      
      await this.initializeStore();
      
      await this.preloadProductInventory();
      
      await this.checkHardwarePrinterStatus();
      
      // Sync local order state with service (for switching between desktop/mobile)
      const serviceOrderActive = this.posService.isOrderActive();
      if (serviceOrderActive && !this.isNewOrderActive()) {
        this.isNewOrderActive.set(true);
      }
    } catch (error) {
      console.error('❌ Error initializing POS:', error);
      console.error('❌ Error details:', error);
    }
  }

  getMobileCartFabStyle(): Record<string, string> {
    const pos = this.mobileCartFabPosition();
    if (!pos) return {};
    return {
      left: `${pos.x}px`,
      top: `${pos.y}px`,
      right: 'auto',
      bottom: 'auto'
    };
  }

  onMobileCartFabClick(event: Event): void {
    // If the user just dragged, suppress the click that follows pointerup.
    if (this.mobileCartFabDidDrag) {
      event.preventDefault();
      event.stopPropagation();
      this.mobileCartFabDidDrag = false;
      return;
    }

    // Original behavior from template
    if (this.showReceiptPanel()) {
      this.showProductPanel();
    } else {
      this.showReceiptPanelView();
    }
  }

  onMobileCartFabPointerDown(event: Event): void {
    // Only enable drag on mobile view where the FAB is rendered
    if (!this.isMobileView()) return;

    const pointerEvent = event as PointerEvent;
    const target = pointerEvent.currentTarget as HTMLElement | null;
    if (!target) return;

    this.mobileCartFabPointerId = pointerEvent.pointerId;
    this.mobileCartFabDidDrag = false;

    // Establish a starting position using either stored style or current DOM rect
    const rect = target.getBoundingClientRect();
    const current = this.mobileCartFabPosition() ?? { x: rect.left, y: rect.top };

    this.mobileCartFabDragStart = {
      pointerX: pointerEvent.clientX,
      pointerY: pointerEvent.clientY,
      startX: current.x,
      startY: current.y
    };

    try {
      target.setPointerCapture(pointerEvent.pointerId);
    } catch {
      // ignore (not supported in some webviews)
    }

    window.addEventListener('pointermove', this.onMobileCartFabPointerMove, { passive: false });
    window.addEventListener('pointerup', this.onMobileCartFabPointerUpOrCancel, { passive: true });
    window.addEventListener('pointercancel', this.onMobileCartFabPointerUpOrCancel, { passive: true });
  }

  private readonly onMobileCartFabPointerMove = (event: Event): void => {
    const pointerEvent = event as PointerEvent;
    if (this.mobileCartFabPointerId === null) return;
    if (pointerEvent.pointerId !== this.mobileCartFabPointerId) return;
    if (!this.mobileCartFabDragStart) return;

    const dx = pointerEvent.clientX - this.mobileCartFabDragStart.pointerX;
    const dy = pointerEvent.clientY - this.mobileCartFabDragStart.pointerY;

    if (!this.mobileCartFabDidDrag) {
      if (Math.abs(dx) + Math.abs(dy) >= 6) {
        this.mobileCartFabDidDrag = true;
      }
    }

    const nextX = this.mobileCartFabDragStart.startX + dx;
    const nextY = this.mobileCartFabDragStart.startY + dy;
    const clamped = this.clampMobileCartFabPosition(nextX, nextY);
    this.mobileCartFabPosition.set(clamped);

    // Prevent page scroll while dragging the FAB
    (event as PointerEvent).preventDefault();
  };

  private readonly onMobileCartFabPointerUpOrCancel = (event: Event): void => {
    const pointerEvent = event as PointerEvent;
    if (this.mobileCartFabPointerId === null) return;
    if (pointerEvent.pointerId !== this.mobileCartFabPointerId) return;

    window.removeEventListener('pointermove', this.onMobileCartFabPointerMove);
    window.removeEventListener('pointerup', this.onMobileCartFabPointerUpOrCancel);
    window.removeEventListener('pointercancel', this.onMobileCartFabPointerUpOrCancel);

    this.mobileCartFabPointerId = null;
    this.mobileCartFabDragStart = null;

    if (this.mobileCartFabDidDrag) {
      this.persistMobileCartFabPosition();
    }
  };

  private clampMobileCartFabPosition(x: number, y: number): { x: number; y: number } {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 0;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 0;

    const margin = this.mobileCartFabEdgeMarginPx;
    const size = this.mobileCartFabSizePx;

    const minX = margin;
    const minY = margin;
    const maxX = Math.max(margin, vw - size - margin);
    const maxY = Math.max(margin, vh - size - margin);

    return {
      x: Math.min(Math.max(x, minX), maxX),
      y: Math.min(Math.max(y, minY), maxY)
    };
  }

  private clampMobileCartFabPositionToViewport(): void {
    const pos = this.mobileCartFabPosition();
    if (!pos) return;
    this.mobileCartFabPosition.set(this.clampMobileCartFabPosition(pos.x, pos.y));
  }

  private restoreMobileCartFabPosition(): void {
    try {
      const raw = localStorage.getItem(this.mobileCartFabStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (typeof parsed?.x !== 'number' || typeof parsed?.y !== 'number') return;
      this.mobileCartFabPosition.set(this.clampMobileCartFabPosition(parsed.x, parsed.y));
    } catch {
      // ignore
    }
  }

  private persistMobileCartFabPosition(): void {
    try {
      const pos = this.mobileCartFabPosition();
      if (!pos) return;
      localStorage.setItem(this.mobileCartFabStorageKey, JSON.stringify(pos));
    } catch {
      // ignore
    }
  }

  async ngAfterViewInit(): Promise<void> {
    // Trigger change detection to avoid ExpressionChangedAfterItHasBeenCheckedError
    this.cdr.detectChanges();
    
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
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
    if (this.inventorySnapshotUnsubscribe) {
      this.inventorySnapshotUnsubscribe();
      this.inventorySnapshotUnsubscribe = null;
    }
    if (this.resizeListener && typeof window !== 'undefined') {
      window.removeEventListener('resize', this.resizeListener);
    }
  }

  // F4 Hotkey for Clear Data
  @HostListener('document:keydown.f4', ['$event'])
  async onF4KeyPress(event: Event): Promise<void> {
    (event as KeyboardEvent).preventDefault(); // Prevent default F4 behavior
    
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
  async onF5KeyPress(event: Event): Promise<void> {
    (event as KeyboardEvent).preventDefault(); // Prevent page refresh
    // Use unified flow so hotkey, button, and item-click behave the same
    await this.requestStartNewOrder('hotkey');
  }

  // F6 Hotkey for Complete Order
  @HostListener('document:keydown.f6', ['$event'])
  async onF6KeyPress(event: Event): Promise<void> {
    (event as KeyboardEvent).preventDefault(); // Prevent default F6 behavior
    
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
  async onF7KeyPress(event: Event): Promise<void> {
    (event as KeyboardEvent).preventDefault(); // Prevent default F7 behavior

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
    
    // Set default payment method to cash
    this.posService.setPaymentMethod('cash');
    
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
    this.tableNumber = '';
    this.payingForExistingOrder.set(null); // Clear existing order flag
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

  // Save order as OPEN (Pay Later)
  async saveOrderAsOpen(): Promise<void> {
    // Prevent double-submission
    if (this.isProcessing()) {
      console.log('⚠️ Order already processing, ignoring duplicate request');
      return;
    }
    
    try {
      console.log('💼 Saving order as OPEN (Pay Later)...');
      const totalAmount = this.cartSummary().netAmount;
      
      // IMPORTANT: Capture payment info and table number BEFORE closing dialog
      const paymentInfo = {
        amountTendered: 0,
        changeAmount: 0,
        paymentDescription: this.paymentDescription || 'Pay Later - OPEN Order',
        paymentType: this.paymentType
      };
      const tableNumber = this.tableNumber;
      console.log('📋 Captured table number for OPEN order:', tableNumber);
      
      // Generate real invoice number
      let realInvoiceNumber: string;
      try {
        console.log('📋 Fetching fresh invoice number from Firestore...');
        realInvoiceNumber = await this.posService.getNextInvoiceNumberPreview();
        
        if (realInvoiceNumber.includes('ERROR') || realInvoiceNumber.includes('0000-000000')) {
          console.warn('⚠️ Invalid invoice number received, retrying...');
          await new Promise(resolve => setTimeout(resolve, 500));
          realInvoiceNumber = await this.posService.getNextInvoiceNumberPreview();
        }
        
        this.nextInvoiceNumber.set(realInvoiceNumber);
        this.invoiceNumber = realInvoiceNumber;
        console.log('📋 Fresh invoice number generated:', realInvoiceNumber);
      } catch (invoiceError) {
        console.warn('Warning: Could not generate invoice number:', invoiceError);
        realInvoiceNumber = 'INV-0000-000000';
      }
      
      // Close payment dialog
      this.closePaymentDialog();
      
      // Process order as OPEN
      console.log('📝 Processing OPEN order...');
      await this.completeOrderWithPayment(paymentInfo, true, tableNumber); // Pass true for saveAsOpen and tableNumber separately
      
      console.log('✅ Order saved as OPEN successfully');
      
    } catch (error) {
      console.error('❌ Error saving order as OPEN:', error);
      
      // Reset processing state
      this.posService['isProcessingSignal']?.set(false);
      
      // Reload invoice number
      try {
        console.log('🔄 Reloading invoice number after failed order...');
        await this.loadNextInvoicePreview();
        const freshInvoiceNumber = this.nextInvoiceNumber();
        this.invoiceNumber = freshInvoiceNumber === 'Loading...' ? 'INV-0000-000000' : freshInvoiceNumber;
      } catch (invoiceReloadError) {
        console.warn('⚠️ Failed to reload invoice number:', invoiceReloadError);
      }
      
      // Show error dialog
      await this.showConfirmationDialog({
        title: 'Failed to Save Order',
        message: `Failed to save order as OPEN. Please try again.\nReason: ${error instanceof Error ? error.message : String(error)}`,
        confirmText: 'OK',
        cancelText: ''
      });
    }
  }

  async processPayment(): Promise<void> {
    // Prevent double-submission
    if (this.isProcessing()) {
      console.log('⚠️ Payment already processing, ignoring duplicate request');
      return;
    }

    // Check if we're paying for an existing OPEN order
    const existingOrder = this.payingForExistingOrder();
    if (existingOrder) {
      await this.processPaymentForExistingOrder(existingOrder);
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
      
      // IMPORTANT: Capture payment info and table number BEFORE closing dialog (dialog close resets these values)
      const paymentInfo = {
        amountTendered: tendered,
        changeAmount: change,
        paymentDescription: this.paymentDescription,
        paymentType: this.paymentType
      };
      const tableNumber = this.tableNumber;
      

      
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
      
      // Check if we're online or offline before processing
      // Use NetworkService which monitors Firestore connection (SOURCE OF TRUTH)
      const isOnline = this.networkService.isOnline();
      

      
      // If offline or slow connection detected, inform user and proceed with offline mode
      if (!isOnline) {
        const offlineConfirmation = await this.showConfirmationDialog({
          title: '📴 Offline Mode',
          message: 'You are currently offline. Your order will be saved locally and automatically synced when you reconnect.\n\nDo you want to proceed?',
          confirmText: 'Proceed',
          cancelText: 'Cancel'
        });
        
        if (!offlineConfirmation) {
          console.log('❌ User cancelled offline order processing');
          this.posService['isProcessingSignal']?.set(false);
          return;
        }
        
        // Process offline without any timeout
        console.log('📴 Processing in offline mode');
        await this.completeOrderWithPayment(paymentInfo, false, tableNumber);
      } else {
        // Online mode - use short timeout to detect connection issues quickly
        console.log('🌐 Processing in online mode');
        const orderPromise = this.completeOrderWithPayment(paymentInfo, false, tableNumber);
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 5000) // Short 5 second timeout
        );
        
        try {
          await Promise.race([orderPromise, timeoutPromise]);
        } catch (error) {
          // Quick timeout - ask user to proceed offline
          console.warn('⚠️ Online processing timed out, offering offline mode');
          
          const proceedOffline = await this.showConfirmationDialog({
            title: '⚠️ Connection Slow or Unavailable',
            message: 'Your internet connection is too slow or unavailable. Would you like to process this order offline? It will sync automatically when connection improves.',
            confirmText: 'Process Offline',
            cancelText: 'Cancel'
          });
          
          if (!proceedOffline) {
            throw new Error('Order cancelled by user due to connection issues');
          }
          
          // Process offline without timeout
          console.log('📴 User chose offline processing');
          await this.completeOrderWithPayment(paymentInfo);
        }
      }
      
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
  }, saveAsOpen: boolean = false, tableNumber: string = ''): Promise<void> {
    try {
      console.log('💼 completeOrderWithPayment called with:', { saveAsOpen, tableNumber });
      
      // Prepare customer info and payments for the new structure
      const processedCustomerInfo = this.getCustomerInfoForOrder();
      const paymentsData = {
        amountTendered: paymentInfo.amountTendered,
        changeAmount: paymentInfo.changeAmount,
        paymentDescription: paymentInfo.paymentDescription,
        paymentType: paymentInfo.paymentType
      };
      
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
      // Add better error handling and offline detection
      let result;
      try {
        // Log progress for offline mode
        if (!this.networkService.isOnline()) {
          console.log('📴 Processing order in offline mode...');
          console.log('📴 Step 1: Saving order locally...');
        }
        
        result = await this.posService.processOrderWithInvoiceAndPayment(
          processedCustomerInfo,
          paymentsData,
          saveAsOpen,
          tableNumber
        );
        
        if (!this.networkService.isOnline()) {
          console.log('📴 Step 2: Order saved successfully, queued for sync');
        }
      } catch (error) {
        console.error('❌ Error during order processing:', error);
        
        // Check if this is a network/timeout error
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isNetworkError = errorMessage.includes('timeout') || 
                              errorMessage.includes('network') || 
                              errorMessage.includes('connection') ||
                              errorMessage.includes('Store read timeout') ||
                              errorMessage.includes('unavailable') ||
                              !this.networkService.isOnline();
        
        // If already offline, the order should have been queued by Firestore offline persistence
        // In this case, don't throw - the invoice service returned the order info
        if (!this.networkService.isOnline() && isNetworkError) {
          console.log('📴 Offline mode: Order should be queued by Firestore persistence');
          // Result might not be set if error occurred, but offline processing should continue
          // The error is likely just from timeout, but Firestore queued the write
          if (!result) {
            console.warn('⚠️ Result not set, but offline mode active - order may still be queued');
            // Re-throw to let user know there was an issue
            throw error;
          }
        } else if (isNetworkError && this.networkService.isOnline()) {
          // We're online but experiencing network issues
          console.log('🔄 Network error detected while online, offering offline fallback...');
          
          // Ask user if they want to proceed in offline mode
          const offlineConfirmation = await this.showConfirmationDialog({
            title: '⚠️ Connection Issue Detected',
            message: 'Network connection is experiencing issues. Would you like to process this order offline? It will be auto-synced when connection is restored.\n\nNote: Inventory may be temporarily out of sync.',
            confirmText: 'Proceed Offline',
            cancelText: 'Cancel'
          });
          
          if (!offlineConfirmation) {
            throw new Error('Order cancelled by user due to connection issues');
          }
          
          console.log('📴 User confirmed offline processing, retrying...');
          // Retry with offline processing (Firestore persistence will handle it)
          result = await this.posService.processOrderWithInvoiceAndPayment(
            processedCustomerInfo,
            paymentsData,
            false,
            tableNumber
          );
        } else {
          // Non-network error, re-throw
          throw error;
        }
      }
      
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
      console.log(`✅ Order processed successfully: ${result.orderId}, Invoice: ${result.invoiceNumber}`);
      
      // Save customer data if needed (fallback for post-order)
      if (this.customerInfo.soldTo && this.customerInfo.soldTo.trim()) {
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

      // IMPORTANT: Clear processing state
      this.posService['isProcessingSignal']?.set(false);
      console.log('✅ Processing state cleared');
      
      // If this is an OPEN order, show simple success message instead of receipt
      if (saveAsOpen) {
        console.log('💼 OPEN order: Showing success message instead of receipt');
        
        // Prepare simple order summary
        const cartItems = this.cartItems();
        const itemsList = cartItems.map(item => 
          `${item.productName} (x${item.quantity}) - ₱${item.total.toFixed(2)}`
        ).join('\n');
        
        // Show success dialog with items
        await this.showConfirmationDialog({
          title: '✅ Order Successfully Saved',
          message: `Invoice: ${result.invoiceNumber}\n${tableNumber ? `Table: ${tableNumber}\n` : ''}Status: OPEN (Pay Later)\n\nItems:\n${itemsList}\n\nTotal: ₱${this.cartSummary().netAmount.toFixed(2)}`,
          confirmText: 'OK',
          cancelText: ''
        });
        
        // Preserve cart so user can reprint — mark order completed instead
        this.isOrderCompleted.set(true);
        
        // Reset new order state so user must click "New" again
        this.isNewOrderActive.set(false);
        
        // Refresh orders list to show new OPEN order
        console.log('💼 OPEN order created, refreshing orders list...');
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for Firestore to complete
        await this.loadRecentOrders();
        
        return; // Exit early, don't show receipt modal
      }
      
      // For regular orders, show receipt modal immediately
      this.isReceiptModalVisibleSignal.set(true);
      console.log('✅ Receipt modal shown immediately');
      
      // Preserve cart so user can reprint — mark order completed instead
      console.log('ℹ️ Preserving cart after order completion so printing can be repeated');
      
      // Prepare receipt data in background (non-blocking)
      console.log('📝 Preparing receipt data for order:', result.orderId);
      const receiptData = await this.prepareReceiptData(result.orderId);
      console.log('✅ Receipt data prepared successfully');
      
      // Update receipt data with the correct invoice number and payment info
      const updatedReceiptData = { 
        ...receiptData, 
        orderId: result.orderId,
        invoiceNumber: result.invoiceNumber,
        paymentInfo: paymentInfo
      };
      
      console.log('📋 Updated receipt data:', {
        orderId: updatedReceiptData.orderId,
        invoiceNumber: updatedReceiptData.invoiceNumber,
        hasItems: !!updatedReceiptData.items?.length
      });
      
      // Mark order as completed and store the receipt data for reprinting
      this.isOrderCompleted.set(true);
      console.log('✅ Order marked as completed');
      
      // orderDetails.status is set at creation time by the invoice service
      this.completedOrderData.set(updatedReceiptData);
      // Ensure receipt modal has data immediately when opened
      this.receiptDataSignal.set(updatedReceiptData);
      console.log('✅ Completed order data stored');
      console.log(`📋 Updated receipt data: ${updatedReceiptData.orderId}, Invoice: ${updatedReceiptData.invoiceNumber}`);
      console.log('🧾 Receipt modal opened with invoice:', result.invoiceNumber);
      console.log('🎯 Receipt modal state:', {
        isVisible: this.isReceiptModalVisible(),
        hasReceiptData: !!this.receiptData(),
        isOrderCompleted: this.isOrderCompleted()
      });
      
      // If this was an OPEN order, refresh the orders list so it appears in the Open tab
      if (saveAsOpen) {
        console.log('💼 OPEN order created, refreshing orders list...');
        setTimeout(() => {
          this.loadRecentOrders();
        }, 500); // Small delay to ensure Firestore has processed the write
      }
      
    } catch (error) {
      console.error('❌ Error completing order with payment:', error);
      throw error; // Re-throw to be handled by processPayment
    }
  }

  // Process customer information based on form state (for new order structure)
  private getCustomerInfoForOrder() {
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
    // Check if products are already loaded to prevent unnecessary reloading
    const currentProductCount = this.products().length;
    
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
      // Load data first to ensure stores and products are available
      await this.loadData();
      
      // Set current date and time
      this.updateCurrentDateTime();
      
      // Load next invoice number preview
      await this.loadNextInvoicePreview();
      await this.initializeStore(); 
      
    } catch (error) {
      console.error('🔄 Error reinitializing POS component:', error);
    }
  }

  /**
   * Load company data early and cache it for faster receipt preparation.
   * This runs async in the background and doesn't block initialization.
   */
  private async loadCompanyDataForReceipts(): Promise<void> {
    try {
      const company = await this.companyService.getActiveCompany();
      if (company) {
        this.cachedCompanySignal.set(company);
      }
    } catch (error) {
      console.warn('⚠️ Could not load company data for receipts:', error);
      // Non-critical error - receipts will work with store info only
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
            }
          }
        } catch (error) {
          console.log('⚠️ Could not get user role from IndexedDB:', error);
        }
        
        // FALLBACK: Load from database if IndexedDB data not available
        if (!useIndexedDBData) {
          await this.userRoleService.loadUserRoles();
          userRole = this.userRoleService.getUserRoleByUserId(user.uid);
        }
        
        if (userRole && userRole.storeId) {
          // Load companies and stores based on user's assigned store
          await this.storeService.loadStores([userRole.storeId]);
          await this.productService.initializeProducts(userRole.storeId);
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
    
    // First, ensure stores are loaded by checking if we have any stores
    const currentUser = this.authService.getCurrentUser();
    let availableStores = this.availableStores();
    
    if (availableStores.length === 0 && currentUser?.uid) {
      
      try {
        // Load user roles first to get store access permissions
        await this.userRoleService.loadUserRoles();
        
        // Get the current user's role by userId
        const userRole = this.userRoleService.getUserRoleByUserId(currentUser.uid);
        
        if (userRole && userRole.storeId) {
          // Load companies first
          await this.companyService.loadCompanies();
          
          // Load stores based on user's assigned store
          await this.storeService.loadStores([userRole.storeId]);
          
          // Wait a bit for signals to update
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } else {
          console.warn('⚠️ Desktop No user role or store ID found');
          return;
        }
      } catch (error) {
        console.error('❌ Desktop Error loading stores:', error);
        return;
      }
    }

    // PRIORITY: Use IndexedDB as primary source for all user data (uid, companyId, storeId, roleId)
    try {
      const offlineUserData = await this.indexedDBService.getUserData(currentUser?.uid || '');
      
      if (offlineUserData?.currentStoreId) {
        
        // Verify the store exists in availableStores before selecting
        availableStores = this.availableStores(); // Refresh after potential loading
        const storeExists = availableStores.find(store => store.id === offlineUserData.currentStoreId);
        
        if (storeExists) {
          await this.selectStore(offlineUserData.currentStoreId);
          return; // Success - exit early
        } else {
          console.warn('⚠️ IndexedDB store not found in available stores');
        }
      }
      
      // If no currentStoreId, try to get from permissions in IndexedDB
      if (offlineUserData?.permissions && offlineUserData.permissions.length > 0) {
        const permission = this.getActivePermission(offlineUserData);
        if (permission?.storeId) {
          availableStores = this.availableStores(); // Refresh after potential loading
          const storeExists = availableStores.find(store => store.id === permission.storeId);
          
          if (storeExists) {
            await this.selectStore(permission.storeId);
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
      
      if (stores.length > 0) {
        
        // Check if currently selected store is valid in available stores
        const selectedStore = stores.find(store => store.id === currentlySelected);
        
        if (currentlySelected && selectedStore) {
          
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
                  }
                }
              }
            }
          } catch (error) {
            console.log('⚠️ Could not get storeId from IndexedDB permissions:', error);
          }
          
          // Fallback: Prioritize stores with products if no IndexedDB store found
          if (!storeIdToSelect) {
            // Get all products to check which stores have data
            const allProducts = this.productService.getProductsSignal()();
            
            // Find store with products
            const storeWithProducts = stores.find(store => {
              const storeProducts = allProducts.filter(p => p.storeId === store.id);
              return storeProducts.length > 0;
            });
            
            if (storeWithProducts?.id) {
              storeIdToSelect = storeWithProducts.id || null;
            } else {
              // If no stores have products, use first available store
              storeIdToSelect = stores[0]?.id || null;
            }
          }
          
          const storeToSelect = stores.find(store => store.id === storeIdToSelect);
          
          if (storeToSelect?.id) {
            
            await this.selectStore(storeToSelect.id);
            
            // Verify the selection worked
            const afterSelection = this.selectedStoreId();
            if (afterSelection === storeToSelect.id) {
              return; // Success, exit the function
            } else {
              console.warn('⚠️ Store auto-selection may have failed - expected:', storeToSelect.id, 'actual:', afterSelection);
            }
          }
        }
        
        // If we reach here, something went wrong but we have stores
        break;
      } else {
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

  /**
   * Preload product inventory for the selected store
   * This ensures we have offline access to inventory data for FIFO calculations
   */
  async preloadProductInventory(): Promise<void> {
    try {
      const storeId = this.selectedStoreId();
      if (!storeId) {
        console.log('📦 No store selected - skipping inventory preload');
        return;
      }

      const companyId = this.authService.getCurrentPermission()?.companyId;
      if (!companyId) {
        console.log('📦 No companyId - skipping inventory preload');
        return;
      }

      
      // Unsubscribe from any existing snapshot listener
      if (this.inventorySnapshotUnsubscribe) {
        this.inventorySnapshotUnsubscribe();
        this.inventorySnapshotUnsubscribe = null;
      }
      
      // Query productInventory collection for this store
      // Important: Query must match or be broader than queries used during order processing
      // Order processing queries by: productId + storeId (no status filter)
      // So we preload by: storeId + companyId only (broader, includes all statuses)
      const inventoryRef = collection(this.firestore, 'productInventory');
      const inventoryQuery = query(
        inventoryRef,
        where('storeId', '==', storeId),
        where('companyId', '==', companyId)
        // Note: No status filter - we need ALL batches cached for offline processing
      );

      // Use Firestore's built-in snapshot listener for automatic caching
      // This is more reliable than custom IndexedDB because:
      // 1. Firestore automatically manages its own IndexedDB cache
      // 2. Real-time updates when online
      // 3. Automatic sync when connection is restored
      // 4. Better metadata tracking (fromCache, hasPendingWrites)
      
      this.inventorySnapshotUnsubscribe = onSnapshot(
        inventoryQuery,
        { includeMetadataChanges: true }, // Enable cache metadata
        (snapshot) => {
          const fromCache = snapshot.metadata.fromCache;
          const hasPendingWrites = snapshot.metadata.hasPendingWrites;

          if (snapshot.size > 0) {
            const products = new Set<string>();
            snapshot.docs.forEach(doc => {
              const data = doc.data();
              if (data['productId']) {
                products.add(data['productId']);
              }
            });
          }
        },
        (error) => {
          console.error('❌ Error in inventory snapshot listener:', error);
          // Don't throw - allow offline operation with existing cache
        }
      );
      
      
      // REMARKED: Custom IndexedDB preload logic - replaced with Firestore snapshot listener
      /*
      // TODO: Implement Firestore snapshot-based caching (more reliable)
      // REMARKED: Custom IndexedDB preload - testing Firestore offline persistence instead
      // Initialize IndexedDB first to ensure productInventory store exists
      try {
        console.log('📦 Initializing IndexedDB for productInventory store...');
        await this.indexedDBService.initDB();
        console.log('✅ IndexedDB initialized - productInventory store should be available');
      } catch (initError) {
        console.error('❌ Failed to initialize IndexedDB:', initError);
      }
      
      // Query productInventory collection for this store
      // Important: Query must match or be broader than queries used during order processing
      // Order processing queries by: productId + storeId (no status filter)
      // So we preload by: storeId + companyId only (broader, includes all statuses)
      const inventoryRef = collection(this.firestore, 'productInventory');
      const inventoryQuery = query(
        inventoryRef,
        where('storeId', '==', storeId),
        where('companyId', '==', companyId)
        // Note: No status filter - we need ALL batches cached for offline processing
      );

      try {
        // Use short timeout to avoid hanging
        const snapshot = await Promise.race([
          getDocs(inventoryQuery),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Inventory preload timeout')), 3000)
          )
        ]);

        console.log(`📦 Loaded ${snapshot.size} inventory batches from Firestore`);
        
        // TODO: Implement proper Firestore snapshot listener for offline caching
        // REMARKED: Custom IndexedDB saving logic - testing Firestore persistence instead
        if (snapshot.size > 0) {
          // Save to IndexedDB for guaranteed offline access
          const batches: any[] = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data
            };
          });

          try {
            // Only clear old data when ONLINE to sync with Firestore
            // When offline, keep existing IndexedDB data
            if (this.networkService.isOnline()) {
              console.log('🗑️ Online: Clearing old productInventory data from IndexedDB to sync...');
              await this.indexedDBService.clearProductInventory();
            } else {
              console.log('📱 Offline: Keeping existing IndexedDB data, will merge updates');
            }
            
            // Save fresh data from Firestore
            await this.indexedDBService.saveProductInventoryBatches(batches);
            
            const products = new Set<string>();
            batches.forEach((batch) => {
              const productId = batch.productId;
              if (productId) products.add(productId);
            });
            console.log(`✅ Synced ${batches.length} batches to IndexedDB (${products.size} products)`);
          } catch (idbError) {
            console.warn('⚠️ Failed to save inventory to IndexedDB:', idbError);
            // Fallback to Firestore cache only
          }
        } else {
          // If Firestore is empty, clear IndexedDB too (only when online)
          if (this.networkService.isOnline()) {
            console.log('🗑️ Online: No batches in Firestore - clearing IndexedDB cache');
            try {
              await this.indexedDBService.clearProductInventory();
            } catch (clearError) {
              console.warn('⚠️ Failed to clear IndexedDB:', clearError);
            }
          } else {
            console.log('📱 Offline: Keeping existing IndexedDB data');
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (errorMsg.includes('timeout') || !this.networkService.isOnline()) {
          console.log('📱 Offline or timeout - will use IndexedDB cached inventory');
        } else {
          console.warn('⚠️ Error preloading inventory (non-critical):', error);
        }
      }
      */
    } catch (error) {
      console.warn('⚠️ Error in preloadProductInventory (non-critical):', error);
    }
  }

  // Load stores using getActiveStoresForDropdown (same as Access Management)
  async loadStoresForPOS(): Promise<void> {
    try {
      const currentPermission = this.authService.getCurrentPermission();
      
      if (currentPermission?.companyId) {
        // Load stores into StoreService first
        await this.storeService.loadStoresByCompany(currentPermission.companyId);
        
        // Get stores with userRoles filtering
        const stores = await this.storeService.getActiveStoresForDropdown(currentPermission.companyId);
        this.storesSignal.set(stores);
      } else {
        console.warn('⚠️ loadStoresForPOS: No companyId available for loading stores');
        this.storesSignal.set([]);
      }
    } catch (error) {
      console.error('❌ loadStoresForPOS: Error loading stores:', error);
      this.storesSignal.set([]);
    }
  }

  // Event handlers
  async selectStore(storeId: string): Promise<void> {
    // Get companyId for the selected store first
    const storeInfo = this.availableStores().find(s => s.id === storeId);
    const companyIdForStore = storeInfo?.companyId;
    
    // Update IndexedDB immediately with the new selected store
    try {
      const currentUser = this.authService.getCurrentUser();
      
      if (currentUser?.uid) {
        const existingUserData = await this.indexedDBService.getUserData(currentUser.uid);
        
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
            } else {
              // Add new permission if it doesn't exist
              const roleId = existingUserData.roleId || 'creator';
              updatedPermissions.push({
                companyId: companyIdForStore,
                storeId: storeId,
                roleId: roleId
              });
            }
          }
          
          const updatedUserData = { 
            ...existingUserData, 
            currentStoreId: storeId,
            permissions: updatedPermissions,
            updatedAt: new Date()
          };
          
          await this.indexedDBService.saveUserData(updatedUserData);
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
        
        if (offlineUserData?.permissions && offlineUserData.permissions.length > 0) {
          const permission = this.getActivePermission(offlineUserData, storeId);
          
          if (permission) {
            companyId = permission.companyId;
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
    }
    
    if (companyId) {
      await this.productService.initializeProducts(storeId);
      
      // Load available tags for the store
      await this.loadAvailableTags();
      
      // Preload productInventory for this store to IndexedDB
      await this.preloadProductInventory();
      
      // Refresh orders for the selected store
      console.log('🔄 Refreshing orders for selected store:', storeId);
      await this.refreshOrders();
      
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
  
  // Touch event handlers for swipe navigation
  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.touches[0].clientX;
  }

  onTouchEnd(event: TouchEvent): void {
    this.touchEndX = event.changedTouches[0].clientX;
    this.handleSwipeGesture();
  }

  private handleSwipeGesture(): void {
    const swipeDistance = this.touchEndX - this.touchStartX;
    
    if (Math.abs(swipeDistance) < this.minSwipeDistance) {
      return; // Not a swipe, ignore
    }
    
    if (swipeDistance > 0) {
      // Swipe right - go to previous page
      this.previousPage();
    } else {
      // Swipe left - go to next page
      this.nextPage();
    }
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
  onCtrlF(event: Event): void {
    (event as KeyboardEvent).preventDefault();
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
      
      // Set receipt data and show modal, preserve cart for reprinting
      this.receiptDataSignal.set(updatedReceiptData);
      this.isReceiptModalVisibleSignal.set(true);

      console.log('🧾 Offline receipt modal opened with invoice:', this.invoiceNumber);
      // Mark order completed so UI will prompt to start a new order when interacting
      this.isOrderCompleted.set(true);
      
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

  async clearCart(silent: boolean = false): Promise<void> {
    // Subscription gate: block if subscription expired or store inactive
    const ok = await this.checkSubscriptionGate();
    if (!ok) return;
    // Check if order is already completed
    if (this.isOrderCompleted()) {
      if (!silent) {
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
      }
      return;
    }

    // Check if new order is active before allowing cart clearing
    if (!this.isNewOrderActive() && !silent) {
      console.log('❌ Clear cart blocked: New order must be initiated first');
      return;
    }

    // If silent mode, skip confirmation dialog
    if (silent) {
      this.posService.clearCart();
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
  onGlobalEnterForModals(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    try {
      if (this.showPaymentModal()) {
        keyboardEvent.preventDefault();
        keyboardEvent.stopPropagation();
        const active = document.activeElement as HTMLElement;
        if (active && active.tagName === 'BUTTON') {
          active.click();
        } else {
          this.processPayment();
        }
        return;
      }

      if (this.isReceiptModalVisible()) {
        keyboardEvent.preventDefault();
        keyboardEvent.stopPropagation();
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
    
    // Use cached company data for faster receipt preparation (no async fetch needed)
    const company = this.cachedCompanySignal();
    
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
        message: `[DEBUG-POS-100] Failed to print receipt: ${errorMessage}\n\nPlease check your printer connection and try again.`,
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

  // Helper method to get cart item count for FAB badge
  getCartItemCount(): number {
    return this.cartItems().reduce((total, item) => total + item.quantity, 0);
  }

  // Helper method to get order status color
  getOrderStatusColor(status: string): string {
    switch (status?.toLowerCase()) {
      case 'paid':
      case 'completed':
        return '#059669'; // Green
      case 'unpaid':
        return '#eab308'; // Yellow
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

  // Manual product refresh - forces reload of products from service
  async manualRefreshProducts(): Promise<void> {
    const storeId = this.selectedStoreId();
    const storeInfo = this.currentStoreInfo();
    
    if (storeInfo?.companyId && storeId) {
      await this.productService.initializeProducts(storeId, true); // Force reload
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
      // Test 1: Check authentication
      const currentUser = this.authService.getCurrentUser();
      const currentPermission = this.authService.getCurrentPermission();
      
      if (!currentUser) {
        console.log('❌ Test skipped - no user authenticated');
        return;
      }
      
      // Test 2: Direct Firestore query
      const { collection, query, where, getDocs, limit } = await import('@angular/fire/firestore');
      const firestore = (this.productService as any)['firestore']; // Access private firestore instance
      
      const productsRef = collection(firestore, 'products');
      const basicQuery = query(productsRef, limit(5));
      const basicSnapshot = await getDocs(basicQuery);
      
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
        
        if (data['companyId']) companies.add(data['companyId']);
        if (data['storeId']) stores.add(data['storeId']);
        if (data['status']) statuses.add(data['status']);
      });
      
      // Test 4: Try ProductService query pattern
      if (currentPermission?.companyId) {
        
        const testQuery = query(
          productsRef,
          where('companyId', '==', currentPermission.companyId),
          where('status', '==', ProductStatus.Active),
          limit(10)
        );
        
        const testSnapshot = await getDocs(testQuery);
      }
      
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
    console.log('🏷️ Loading tags for store:', storeId);
    if (!storeId) {
      this.availableTagsByGroup.set([]);
      return;
    }

    try {
      const tags = await this.posService.getTagsForStore(storeId);
      console.log('🏷️ Retrieved tags from service:', tags.length, 'tags');
      console.log('🏷️ RAW TAGS DATA:', JSON.stringify(tags, null, 2));
      
      // Log each tag's structure
      tags.forEach((tag, index) => {
        console.log(`🏷️ Tag ${index + 1}:`, {
          id: tag.id,
          tagId: tag.tagId,
          label: tag.label,
          group: tag.group,
          storeId: tag.storeId,
          isActive: tag.isActive,
          createdAt: tag.createdAt,
          allFields: Object.keys(tag)
        });
      });

      // Group tags by their group field and track first createdAt per group
      const groupMap = new Map<string, { id: string; label: string; createdAt?: any }[]>();
      const groupFirstCreatedAt = new Map<string, any>();
      
      tags.forEach(tag => {
        const group = tag.group || 'Other';
        console.log(`🏷️ Processing tag "${tag.label}" with group: "${group}"`);
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

      console.log('🏷️ Group Map entries:', Array.from(groupMap.entries()).map(([group, tags]) => ({
        group,
        tagCount: tags.length,
        tags: tags.map(t => t.label)
      })));

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

      console.log('🏷️ FINAL Grouped tags (to be set):', JSON.stringify(tagsByGroup, null, 2));
      this.availableTagsByGroup.set(tagsByGroup);
      console.log('🏷️ availableTagsByGroup signal updated. Current value:', this.availableTagsByGroup());
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

  // Access tab scrolling methods for mobile
  scrollAccessTabsLeft(): void {
    if (this.accessTabListContainer) {
      const container = this.accessTabListContainer.nativeElement;
      const scrollAmount = container.clientWidth * 0.6;
      container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      this.accessTabScrollPosition = Math.max(0, container.scrollLeft - scrollAmount);
    }
  }

  scrollAccessTabsRight(): void {
    if (this.accessTabListContainer) {
      const container = this.accessTabListContainer.nativeElement;
      const scrollAmount = container.clientWidth * 0.6;
      container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      this.accessTabScrollPosition = container.scrollLeft + scrollAmount;
    }
  }

  isAccessTabScrollAtEnd(): boolean {
    if (!this.accessTabListContainer?.nativeElement) return true;
    const container = this.accessTabListContainer.nativeElement;
    const isAtEnd = container.scrollLeft + container.clientWidth >= container.scrollWidth - 10;
    return isAtEnd;
  }
}
