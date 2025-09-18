import { Injectable, signal, computed, inject } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  doc,
  updateDoc,
  query,
  where,
  getDocs,
  orderBy,
  limit
} from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { CompanyService } from './company.service';
import { ProductService } from './product.service';
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

  constructor(
    private firestore: Firestore,
    private authService: AuthService,
    private companyService: CompanyService,
    private productService: ProductService
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
  setSelectedStore(storeId: string): void {
    this.selectedStoreIdSignal.set(storeId);
    
    // Save to localStorage for persistence
    if (storeId) {
      localStorage.setItem('pos_selected_store_id', storeId);
    } else {
      localStorage.removeItem('pos_selected_store_id');
    }
    
    this.clearCart(); // Clear cart when switching stores
  }

  // Load selected store from localStorage on service initialization
  private loadPersistedStoreSelection(): void {
    const savedStoreId = localStorage.getItem('pos_selected_store_id');
    if (savedStoreId) {
      this.selectedStoreIdSignal.set(savedStoreId);
      console.log('🏪 Restored store selection from localStorage:', savedStoreId);
    }
  }

  // Order Processing
  async processOrder(paymentMethod: string = 'cash', customerInfo?: any): Promise<string | null> {
    try {
      this.isProcessingSignal.set(true);
      
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

      // Create order with enhanced BIR-compliant fields
      const order: Omit<Order, 'id'> = {
        companyId: company.id!,
        storeId: storeId,
        assignedCashierId: user.uid,
        status: 'paid',
        
        // Customer Information - Use provided data or defaults
        cashSale: true,
        soldTo: customerInfo?.soldTo || 'Walk-in Customer',
        tin: customerInfo?.tin || '',
        businessAddress: customerInfo?.businessAddress || '',
        
        // Invoice Information
        invoiceNumber: customerInfo?.invoiceNumber || `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
        date: customerInfo?.date || new Date(),
        logoUrl: company.logoUrl || '',
        
        // Financial Calculations
        vatableSales: summary.vatableSales,
        vatAmount: summary.vatAmount,
        zeroRatedSales: summary.zeroRatedSales,
        vatExemptAmount: summary.vatExemptSales,
        discountAmount: summary.productDiscountAmount + summary.orderDiscountAmount,
        grossAmount: summary.grossAmount,
        netAmount: summary.netAmount,
        totalAmount: summary.netAmount,
        
        // BIR Required Fields - Use company settings if available, otherwise hardcoded defaults
        atpOrOcn: company.atpOrOcn || 'OCN-2025-001234',
        birPermitNo: company.birPermitNo || 'BIR-PERMIT-2025-56789',
        inclusiveSerialNumber: company.inclusiveSerialNumber || '000001-000999',
        
        // System Fields
        createdAt: new Date(),
        message: 'Thank you! See you again!'
      };

      const orderRef = await addDoc(collection(this.firestore, 'orders'), order);

      // Create order details
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

      const orderDetail: Omit<OrderDetail, 'id'> = {
        companyId: company.id!,
        storeId: storeId,
        orderId: orderRef.id,
        items: orderItems,
        createdAt: new Date()
      };

      await addDoc(collection(this.firestore, 'orderDetails'), orderDetail);

      // Update product inventory
      await this.updateProductInventory(cartItems);

      // Don't clear cart here - let receipt component handle it
      // this.clearCart();
      return orderRef.id;

    } catch (error) {
      console.error('Error processing order:', error);
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
