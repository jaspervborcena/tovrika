import { Component, OnInit, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { ReceiptComponent } from './receipt/receipt.component';
import { DiscountModalComponent } from '../../../shared/components/discount-modal/discount-modal.component';
import { ProductService } from '../../../services/product.service';
import { PosService } from '../../../services/pos.service';
import { PosSharedService } from '../../../services/pos-shared.service';
import { PrintService } from '../../../services/print.service';
import { TransactionService } from '../../../services/transaction.service';
import { AuthService } from '../../../services/auth.service';
import { CompanyService } from '../../../services/company.service';
import { OrderService } from '../../../services/order.service';
import { StoreService } from '../../../services/store.service';
import { UserRoleService } from '../../../services/user-role.service';
import { Product } from '../../../interfaces/product.interface';
import { CartItem, ProductViewType, ReceiptData, OrderDiscount } from '../../../interfaces/pos.interface';
import { Store } from '../../../interfaces/store.interface';

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, HeaderComponent, ReceiptComponent, DiscountModalComponent],
  templateUrl: './pos.component.html',
  styleUrls: ['./pos.component.css']
})
export class PosComponent implements OnInit {
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

  // Receipt modal state
  private isReceiptModalVisibleSignal = signal<boolean>(false);
  readonly isReceiptModalVisible = computed(() => this.isReceiptModalVisibleSignal());
  
  private receiptDataSignal = signal<any>(null);
  readonly receiptData = computed(() => this.receiptDataSignal());

  // Discount modal state
  private isDiscountModalVisibleSignal = signal<boolean>(false);
  readonly isDiscountModalVisible = computed(() => this.isDiscountModalVisibleSignal());
  readonly orderDiscount = computed(() => this.posService.orderDiscount());

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

  clearCart(): void {
    if (confirm('Are you sure you want to clear the cart?')) {
      this.posService.clearCart();
    }
  }

  async processOrder(): Promise<void> {
    try {
      // Generate temporary order ID for receipt display (will be replaced when actually saved)
      const tempOrderId = 'temp-' + Date.now();
      
      // Prepare receipt data without saving the order yet
      const receiptData = this.prepareReceiptData(tempOrderId);
      
      // Set receipt data and show modal
      this.receiptDataSignal.set(receiptData);
      this.isReceiptModalVisibleSignal.set(true);
    } catch (error) {
      console.error('Error preparing order:', error);
      alert('Failed to prepare order. Please try again.');
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
  startNewOrder(): void {
    if (confirm('Start a new order? This will clear the current cart and all customer information.')) {
      // Clear cart and all order-related data
      this.posService.clearCart();
      
      // Reset customer information
      this.customerInfo = {
        soldTo: '',
        tin: '',
        businessAddress: '',
        invoiceNumber: `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
        datetime: new Date().toISOString().slice(0, 16)
      };
      
      console.log('New order started - all data cleared');
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
      // First, save the order to get a real order ID
      console.log('Saving order to database...');
      const orderId = await this.posService.processOrder();
      
      if (!orderId) {
        throw new Error('Failed to save order');
      }

      // Update receipt data with real order ID
      const updatedReceiptData = { ...receiptData, orderId };
      this.receiptDataSignal.set(updatedReceiptData);

      // Then save the transaction to the database
      console.log('Saving transaction before printing...');
      const savedTransaction = await this.saveTransaction(updatedReceiptData);
      console.log('Transaction saved successfully:', savedTransaction.transactionNumber);

      // Then print the receipt
      await this.printService.printReceipt(updatedReceiptData, validPrinterType);
      console.log(`Receipt sent to ${validPrinterType} printer for order:`, orderId);
      
      // Close the modal after successful save and print
      this.closeReceiptModal();
      
    } catch (error) {
      console.error('Error during save and print process:', error);
      alert('Failed to save order and print receipt. Please try again.');
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
    const transactionData = {
      companyId: currentUser.companyId || '',
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

  // Helper method to get unit type display
  getUnitTypeDisplay(unitType?: string): string {
    if (!unitType || unitType === 'N/A') return '';
    return unitType === 'pieces' ? 'pc(s)' : unitType;
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
