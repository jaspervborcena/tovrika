import { Injectable, signal, computed } from '@angular/core';
import { CartItem } from '../interfaces/cart.interface';

export interface SharedPosData {
  customerName: string;
  customerTin: string;
  customerAddress: string;
  invoiceNumber: string;
  orderDate: string;
  cartItems: CartItem[];
  selectedStoreId: string;
}

@Injectable({
  providedIn: 'root'
})
export class PosSharedService {
  // Shared signals for data synchronization between desktop and mobile POS
  private customerNameSignal = signal<string>('');
  private customerTinSignal = signal<string>('');
  private customerAddressSignal = signal<string>('');
  private invoiceNumberSignal = signal<string>(`INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`);
  private orderDateSignal = signal<string>(new Date().toISOString().slice(0, 16));
  private cartItemsSignal = signal<CartItem[]>([]);
  private selectedStoreIdSignal = signal<string>('');

  // Read-only computed properties
  readonly customerName = computed(() => this.customerNameSignal());
  readonly customerTin = computed(() => this.customerTinSignal());
  readonly customerAddress = computed(() => this.customerAddressSignal());
  readonly invoiceNumber = computed(() => this.invoiceNumberSignal());
  readonly orderDate = computed(() => this.orderDateSignal());
  readonly cartItems = computed(() => this.cartItemsSignal());
  readonly selectedStoreId = computed(() => this.selectedStoreIdSignal());

  // Cart summary computed
  readonly cartSummary = computed(() => {
    const items = this.cartItems();
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Calculate VAT (12% in Philippines)
    const vatRate = 0.12;
    const vatExemptAmount = items
      .filter(item => item.isVatExempt)
      .reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    const vatableAmount = subtotal - vatExemptAmount;
    const vatAmount = vatableAmount * vatRate;
    
    // For now, no discounts - can be enhanced later
    const discountAmount = 0;
    const grossAmount = subtotal;
    const netAmount = grossAmount - discountAmount;
    
    return {
      subtotal,
      vatAmount,
      vatExemptAmount,
      vatableAmount,
      discountAmount,
      grossAmount,
      netAmount,
      itemCount: items.length
    };
  });

  // Update methods
  updateCustomerName(name: string) {
    this.customerNameSignal.set(name);
  }

  updateCustomerTin(tin: string) {
    this.customerTinSignal.set(tin);
  }

  updateCustomerAddress(address: string) {
    this.customerAddressSignal.set(address);
  }

  updateInvoiceNumber(invoiceNumber: string) {
    this.invoiceNumberSignal.set(invoiceNumber);
  }

  updateOrderDate(date: string) {
    this.orderDateSignal.set(date);
  }

  updateSelectedStoreId(storeId: string) {
    this.selectedStoreIdSignal.set(storeId);
  }

  updateCartItems(items: CartItem[]) {
    this.cartItemsSignal.set(items);
  }

  addToCart(item: CartItem) {
    const currentItems = this.cartItems();
    const existingIndex = currentItems.findIndex(existing => existing.productId === item.productId);
    
    if (existingIndex >= 0) {
      // Update existing item quantity
      const updatedItems = [...currentItems];
      updatedItems[existingIndex] = {
        ...updatedItems[existingIndex],
        quantity: updatedItems[existingIndex].quantity + item.quantity,
        subtotal: (updatedItems[existingIndex].quantity + item.quantity) * updatedItems[existingIndex].price
      };
      this.cartItemsSignal.set(updatedItems);
    } else {
      // Add new item
      this.cartItemsSignal.set([...currentItems, item]);
    }
  }

  removeFromCart(productId: string) {
    const currentItems = this.cartItems();
    this.cartItemsSignal.set(currentItems.filter(item => item.productId !== productId));
  }

  updateQuantity(productId: string, newQuantity: number) {
    if (newQuantity <= 0) {
      this.removeFromCart(productId);
      return;
    }

    const currentItems = this.cartItems();
    const updatedItems = currentItems.map(item => 
      item.productId === productId 
        ? { ...item, quantity: newQuantity, subtotal: newQuantity * item.price }
        : item
    );
    this.cartItemsSignal.set(updatedItems);
  }

  toggleVatExemption(productId: string) {
    const currentItems = this.cartItems();
    const updatedItems = currentItems.map(item => 
      item.productId === productId 
        ? { ...item, isVatExempt: !item.isVatExempt }
        : item
    );
    this.cartItemsSignal.set(updatedItems);
  }

  clearCart() {
    this.cartItemsSignal.set([]);
  }

  // Get current state as object (useful for saving/loading)
  getCurrentState(): SharedPosData {
    return {
      customerName: this.customerName(),
      customerTin: this.customerTin(),
      customerAddress: this.customerAddress(),
      invoiceNumber: this.invoiceNumber(),
      orderDate: this.orderDate(),
      cartItems: this.cartItems(),
      selectedStoreId: this.selectedStoreId()
    };
  }

  // Load state from object (useful for restoring saved data)
  loadState(data: Partial<SharedPosData>) {
    if (data.customerName !== undefined) this.updateCustomerName(data.customerName);
    if (data.customerTin !== undefined) this.updateCustomerTin(data.customerTin);
    if (data.customerAddress !== undefined) this.updateCustomerAddress(data.customerAddress);
    if (data.invoiceNumber !== undefined) this.updateInvoiceNumber(data.invoiceNumber);
    if (data.orderDate !== undefined) this.updateOrderDate(data.orderDate);
    if (data.cartItems !== undefined) this.updateCartItems(data.cartItems);
    if (data.selectedStoreId !== undefined) this.updateSelectedStoreId(data.selectedStoreId);
  }
}
