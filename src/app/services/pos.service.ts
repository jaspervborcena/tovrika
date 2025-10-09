import { Injectable, signal, computed, inject } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc
} from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { CompanyService } from './company.service';
import { ProductService } from './product.service';
import { InvoiceService } from './invoice.service';
import { IndexedDBService } from '../core/services/indexeddb.service';
import { FirestoreSecurityService } from '../core/services/firestore-security.service';
import { OfflineDocumentService } from '../core/services/offline-document.service';
import { Order, OrderDetail, OrderItem, CartItem, ReceiptData, OrderDiscount, CartSummary } from '../interfaces/pos.interface';
import { Product } from '../interfaces/product.interface';

@Injectable({
  providedIn: 'root'
})
export class PosService {
  private readonly cartItemsSignal = signal<CartItem[]>([]);
  private readonly selectedStoreIdSignal = signal<string>('');
  private readonly isProcessingSignal = signal<boolean>(false);
  private readonly orderDiscountSignal = signal<OrderDiscount | null>(null);
  private readonly offlineDocService = inject(OfflineDocumentService);

  // Computed values
  readonly cartItems = computed(() => this.cartItemsSignal());
  readonly selectedStoreId = computed(() => this.selectedStoreIdSignal());
  readonly isProcessing = computed(() => this.isProcessingSignal());
  readonly orderDiscount = computed(() => this.orderDiscountSignal());

  readonly cartSummary = computed((): CartSummary => {
    const items = this.cartItems();
    const orderDiscount = this.orderDiscount();
    
    // Calculate base amounts
    const grossAmount = items.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0);
    const productDiscountAmount = items.reduce((sum, item) => sum + item.discountAmount, 0);
    const subtotalAfterProductDiscounts = grossAmount - productDiscountAmount;
    
    // Calculate VAT amounts
    const vatableItems = items.filter(item => item.isVatApplicable && !item.isVatExempt);
    const vatExemptItems = items.filter(item => item.isVatExempt || !item.isVatApplicable);
    
    const vatableSales = vatableItems.reduce((sum, item) => 
      sum + ((item.sellingPrice * item.quantity) - item.discountAmount), 0);
    const vatExemptSales = vatExemptItems.reduce((sum, item) => 
      sum + ((item.sellingPrice * item.quantity) - item.discountAmount), 0);
    const zeroRatedSales = 0; // Can be added later for specific business needs
    
    const vatAmount = vatableItems.reduce((sum, item) => sum + item.vatAmount, 0);
    
    // Calculate order-level discount
    let orderDiscountAmount = 0;
    if (orderDiscount) {
      if (orderDiscount.percentage) {
        orderDiscountAmount = (subtotalAfterProductDiscounts * orderDiscount.percentage) / 100;
      } else if (orderDiscount.fixedAmount) {
        orderDiscountAmount = orderDiscount.fixedAmount;
      }
    }
    
    const netAmount = subtotalAfterProductDiscounts - orderDiscountAmount;

    return {
      itemCount: items.length,
      totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
      vatableSales,
      vatAmount,
      zeroRatedSales,
      vatExemptSales,
      productDiscountAmount,
      orderDiscountAmount,
      grossAmount,
      netAmount
    };
  });

  private invoiceService = inject(InvoiceService);

  constructor(
    private firestore: Firestore,
    private authService: AuthService,
    private companyService: CompanyService,
    private productService: ProductService,
    private indexedDBService: IndexedDBService,
    private securityService: FirestoreSecurityService
  ) {
    // Load persisted store selection on service initialization
    this.loadPersistedStoreSelection();
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
  }

  // Reset all POS state (called on logout)
  resetAll(): void {
    console.log('🔍 [POSService] Resetting all POS data');
    this.clearCart();
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
  async setSelectedStore(storeId: string): Promise<void> {
    this.selectedStoreIdSignal.set(storeId);
    
    // Save to IndexedDB for persistence
    try {
      const currentUser = this.authService.getCurrentUser();
      if (currentUser?.uid) {
        // Get existing user data and update currentStoreId
        const existingUserData = await this.indexedDBService.getUserData(currentUser.uid);
        if (existingUserData) {
          existingUserData.currentStoreId = storeId;
          await this.indexedDBService.saveUserData(existingUserData);
          console.log('💾 Store selection saved to IndexedDB:', storeId);
        }
      }
    } catch (error) {
      console.error('⚠️ Failed to save store selection to IndexedDB:', error);
    }
    
    this.clearCart(); // Clear cart when switching stores
  }

  // Load selected store from IndexedDB on service initialization
  private async loadPersistedStoreSelection(): Promise<void> {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (currentUser?.uid) {
        const offlineUserData = await this.indexedDBService.getUserData(currentUser.uid);
        if (offlineUserData?.currentStoreId) {
          this.selectedStoreIdSignal.set(offlineUserData.currentStoreId);
          console.log('💾 Restored store selection from IndexedDB:', offlineUserData.currentStoreId);
        }
      }
    } catch (error) {
      console.error('⚠️ Failed to load store selection from IndexedDB:', error);
    }
  }

  // Order Processing with Invoice Number Transaction
  async processOrder(customerInfo?: any): Promise<string | null> {
    try {
      this.isProcessingSignal.set(true);
      console.log('🧾 Starting order processing with invoice transaction...');
      
      const user = this.authService.getCurrentUser();
      const company = await this.companyService.getActiveCompany();
      
      if (!user || !company) {
        throw new Error('User or company not found');
      }

      const storeId = this.selectedStoreId();
      if (!storeId) {
        throw new Error('No store selected');
      }

      const cartItems = this.cartItems();
      if (cartItems.length === 0) {
        throw new Error('Cart is empty');
      }

      const summary = this.cartSummary();

      // Prepare order items for storage
      const orderItems: OrderItem[] = cartItems.map(item => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        price: item.sellingPrice,
        total: item.total,
        vat: item.vatAmount,
        discount: item.discountAmount,
        isVatExempt: item.isVatExempt
      }));

      // Prepare complete order data (without invoice number - will be assigned by transaction)
      const orderData = {
        companyId: company.id!,
        storeId: storeId,
        assignedCashierId: user.uid,
        status: 'paid',
        
        // Customer Information
        cashSale: true,
        soldTo: customerInfo?.soldTo || 'Walk-in Customer',
        tin: customerInfo?.tin || '',
        businessAddress: customerInfo?.businessAddress || '',
        
        // Invoice Information (invoiceNumber will be set by transaction)
        date: customerInfo?.date || new Date(),
        logoUrl: company.logoUrl || '',
        
        // Company Information
        companyName: company.name || '',
        companyAddress: company.address || '',
        companyPhone: company.phone || '',
        companyTaxId: company.taxId || company.tin || '',
        companyEmail: company.email || '',
        
        // Financial Calculations
        vatableSales: summary.vatableSales,
        vatAmount: summary.vatAmount,
        zeroRatedSales: summary.zeroRatedSales,
        vatExemptAmount: summary.vatExemptSales,
        discountAmount: summary.productDiscountAmount + summary.orderDiscountAmount,
        grossAmount: summary.grossAmount,
        netAmount: summary.netAmount,
        totalAmount: summary.netAmount,
        
        // Order Items
        items: orderItems,
        
        // BIR Required Fields
        atpOrOcn: company.atpOrOcn || 'OCN-2025-001234',
        birPermitNo: company.birPermitNo || 'BIR-PERMIT-2025-56789',
        inclusiveSerialNumber: company.inclusiveSerialNumber || '000001-000999',
        
        // System Fields
        message: 'Thank you! See you again!'
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
        await this.updateProductInventory(cartItems);
        console.log('✅ Product inventory updated successfully');
      } catch (inventoryError) {
        console.error('⚠️ Warning: Order created but inventory update failed:', inventoryError);
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
    customerInfo: { fullName: string; address: string; tin: string; customerId: string }, 
    payments: { amountTendered: number; changeAmount: number; paymentDescription: string }
  ): Promise<{ orderId: string; invoiceNumber: string } | null> {
    try {
      this.isProcessingSignal.set(true);
      console.log('🧾 Starting NEW order processing with customerInfo and payments...');
      
      const user = this.authService.getCurrentUser();
      const company = await this.companyService.getActiveCompany();
      
      if (!user || !company) {
        throw new Error('User or company not found');
      }

      const storeId = this.selectedStoreId();
      if (!storeId) {
        throw new Error('No store selected');
      }

      const cartItems = this.cartItems();
      if (cartItems.length === 0) {
        throw new Error('Cart is empty');
      }

      console.log('Processing NEW order structure for store:', storeId);
      console.log('📝 Customer info:', customerInfo);
      console.log('💳 Payment info:', payments);

      const cartSummary = this.cartSummary();

      // Prepare order items for storage
      const orderItems: OrderItem[] = cartItems.map(item => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        price: item.sellingPrice,
        total: item.total,
        vat: item.vatAmount,
        discount: item.discountAmount,
        isVatExempt: item.isVatExempt
      }));

      console.log('📦 Order items prepared:', orderItems.length, 'items');

      // Prepare NEW order data structure (without customerInfo at root level)
      const orderData: any = {
        companyId: company.id || '',
        storeId: storeId,
        assignedCashierId: user.uid,
        
        // Payment type determination
        cashSale: payments.paymentDescription.toLowerCase().includes('cash') || !payments.paymentDescription,
        
        // Invoice Information (invoiceNumber will be set by transaction)
        invoiceNumber: '',  // Will be filled by transaction
        date: new Date(),
        
        // Company Information
        companyName: company.name || '',
        companyAddress: company.address || '',
        companyPhone: company.phone || '',
        companyTaxId: company.taxId || company.tin || '',
        companyEmail: company.email || '',
        
        // Financial Information
        grossAmount: cartSummary.grossAmount,
        discountAmount: cartSummary.productDiscountAmount + cartSummary.orderDiscountAmount,
        vatAmount: cartSummary.vatAmount,
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

      console.log('📦 Complete orderData being sent to invoice service:', JSON.stringify(orderData, null, 2));
      
      // 🧾 Execute invoice transaction with NEW structure
      const invoiceResult = await this.invoiceService.processInvoiceTransaction({
        storeId: storeId,
        orderData: orderData,
        customerInfo: customerInfo, // Pass as separate parameter
        paymentsData: payments      // Pass as separate parameter
      });

      // Check transaction result
      if (!invoiceResult.success) {
        throw new Error(`Invoice transaction failed: ${invoiceResult.error}`);
      }

      console.log('✅ NEW Invoice transaction completed:', {
        invoiceNumber: invoiceResult.invoiceNumber,
        orderId: invoiceResult.orderId
      });

      // Update product inventory
      try {
        await this.updateProductInventory(cartItems);
        console.log('✅ Product inventory updated successfully');
      } catch (inventoryError) {
        console.error('⚠️ Warning: Order created but inventory update failed:', inventoryError);
      }

      return {
        orderId: invoiceResult.orderId!,
        invoiceNumber: invoiceResult.invoiceNumber!
      };

    } catch (error) {
      console.error('❌ Error processing NEW order with invoice:', error);
      throw error;
    } finally {
      this.isProcessingSignal.set(false);
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
      
      const user = this.authService.getCurrentUser();
      const company = await this.companyService.getActiveCompany();
      
      if (!user || !company) {
        throw new Error('User or company not found');
      }

      const storeId = this.selectedStoreId();
      if (!storeId) {
        throw new Error('No store selected');
      }

      const cartItems = this.cartItems();
      if (cartItems.length === 0) {
        throw new Error('Cart is empty');
      }

      console.log('Processing order for store:', storeId);

      const cartSummary = this.cartSummary();

      // Prepare complete order data (without invoice number - will be assigned by transaction)
      const orderData = {
        companyId: company.id || '',
        storeId: storeId,
        assignedCashierId: user.uid,
        
        // Customer Information
        cashSale: !customerInfo?.soldTo,
        soldTo: customerInfo?.soldTo || '',
        tin: customerInfo?.tin || '',
        businessAddress: customerInfo?.businessAddress || '',
        
        // Invoice Information (invoiceNumber will be set by transaction)
        invoiceNumber: '',  // Will be filled by transaction
        date: new Date(),
        
        // Company Information
        companyName: company.name || '',
        companyAddress: company.address || '',
        companyPhone: company.phone || '',
        companyTaxId: company.taxId || company.tin || '',
        companyEmail: company.email || '',
        
        // Financial Information
        grossAmount: cartSummary.grossAmount,
        discountAmount: cartSummary.productDiscountAmount + cartSummary.orderDiscountAmount,
        vatAmount: cartSummary.vatAmount,
        vatExemptAmount: cartSummary.vatExemptSales,
        totalAmount: cartSummary.netAmount,
        netAmount: cartSummary.netAmount,
        
        vatableSales: cartSummary.vatableSales,
        zeroRatedSales: cartSummary.zeroRatedSales,
        
        status: 'paid',
        
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
        await this.updateProductInventory(cartItems);
        console.log('✅ Product inventory updated successfully');
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
    const stores = this.companyService.companies()[0]?.stores || [];
    const currentStore = stores.find(s => s.id === this.selectedStoreId());

    if (!user || !company || !currentStore) {
      throw new Error('Required data not found');
    }

    const summary = this.cartSummary();

    return {
      companyName: company.name,
      storeName: currentStore.storeName,
      storeAddress: currentStore.address,
      companyPhone: company.phone || '',
      companyEmail: company.email || '',
      date: new Date(),
      orderId: orderId || 'TEMP',
      items: this.cartItems(),
      vatAmount: summary.vatAmount,
      vatExemptAmount: summary.vatExemptSales,
      discountAmount: summary.productDiscountAmount + summary.orderDiscountAmount,
      grossAmount: summary.grossAmount,
      netAmount: summary.netAmount,
      message: 'Thank you! See you again!'
    };
  }

  // Helper Methods
  private createCartItem(product: Product, quantity: number): CartItem {
    const baseTotal = product.sellingPrice * quantity;
    let discountAmount = 0;
    
    if (product.hasDiscount) {
      if (product.discountType === 'percentage') {
        discountAmount = (baseTotal * product.discountValue) / 100;
      } else {
        discountAmount = product.discountValue * quantity;
      }
    }

    const discountedTotal = baseTotal - discountAmount;
    let vatAmount = 0;
    
    if (product.isVatApplicable) {
      vatAmount = (discountedTotal * product.vatRate) / 100;
    }

    return {
      productId: product.id!,
      productName: product.productName,
      skuId: product.skuId,
      unitType: product.unitType,
      quantity,
      sellingPrice: product.sellingPrice,
      total: discountedTotal + vatAmount,
      isVatApplicable: product.isVatApplicable,
      vatRate: product.vatRate,
      vatAmount,
      hasDiscount: product.hasDiscount,
      discountType: product.discountType,
      discountValue: product.discountValue,
      discountAmount,
      isVatExempt: false,
      imageUrl: product.imageUrl
    };
  }

  private recalculateCartItem(item: CartItem): CartItem {
    const baseTotal = item.sellingPrice * item.quantity;
    let discountAmount = 0;
    
    if (item.hasDiscount) {
      if (item.discountType === 'percentage') {
        discountAmount = (baseTotal * item.discountValue) / 100;
      } else {
        discountAmount = item.discountValue * item.quantity;
      }
    }

    const discountedTotal = baseTotal - discountAmount;
    let vatAmount = 0;
    
    if (item.isVatApplicable && !item.isVatExempt) {
      vatAmount = (discountedTotal * item.vatRate) / 100;
    }

    return {
      ...item,
      total: discountedTotal + vatAmount,
      vatAmount,
      discountAmount
    };
  }

  private async updateProductInventory(cartItems: CartItem[]): Promise<void> {
    // This would typically update the product inventory
    // For now, we'll just log it
    console.log('Updating inventory for items:', cartItems);
    
    // TODO: Implement actual inventory updates
    // This would involve updating the product quantities in Firestore
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
