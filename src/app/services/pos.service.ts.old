import { Injectable, computed, inject, signal } from '@angular/core';
import { Firestore, collection, addDoc, query, where, orderBy, getDocs } from '@angular/fire/firestore';
import { Cart, CartItem, Receipt } from '../interfaces/cart.interface';

@Injectable({
  providedIn: 'root'
})
export class PosService {
  private firestore = inject(Firestore);
  
  // Signals
  private _cart = signal<Cart>({
    items: [],
    subtotal: 0,
    tax: 0,
    total: 0,
    storeId: ''
  });

  private _viewMode = signal<'tile' | 'list'>('tile');
  private _selectedCategory = signal<string>('all');

  // Computed values
  cart = computed(() => this._cart());
  viewMode = computed(() => this._viewMode());
  selectedCategory = computed(() => this._selectedCategory());

  // Methods for cart management
  addToCart(product: any, quantity: number = 1) {
    const currentCart = this._cart();
    const existingItem = currentCart.items.find(item => item.productId === product.id);

    if (existingItem) {
      // Update existing item
      const updatedItems = currentCart.items.map(item =>
        item.productId === product.id
          ? { ...item, quantity: item.quantity + quantity, subtotal: (item.quantity + quantity) * item.price }
          : item
      );
      this.updateCart({ ...currentCart, items: updatedItems });
    } else {
      // Add new item
      const newItem: CartItem = {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity,
        subtotal: quantity * product.price
      };
      this.updateCart({ ...currentCart, items: [...currentCart.items, newItem] });
    }
  }

  removeFromCart(productId: string) {
    const currentCart = this._cart();
    const updatedItems = currentCart.items.filter(item => item.productId !== productId);
    this.updateCart({ ...currentCart, items: updatedItems });
  }

  updateItemQuantity(productId: string, quantity: number) {
    const currentCart = this._cart();
    const updatedItems = currentCart.items.map(item =>
      item.productId === productId
        ? { ...item, quantity, subtotal: quantity * item.price }
        : item
    );
    this.updateCart({ ...currentCart, items: updatedItems });
  }

  private updateCart(cart: Cart) {
    // Calculate totals
    const subtotal = cart.items.reduce((sum, item) => sum + item.subtotal, 0);
    const tax = subtotal * 0.12; // 12% tax
    const total = subtotal + tax;

    this._cart.set({
      ...cart,
      subtotal,
      tax,
      total
    });
  }

  // Methods for receipt management
  async createReceipt(paymentMethod: 'cash' | 'card' | 'other', cashierId: string): Promise<string> {
    const currentCart = this._cart();
    
    const receipt: Omit<Receipt, 'id'> = {
      ...currentCart,
      orderNumber: this.generateOrderNumber(),
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'completed',
      cashierId,
      paymentMethod
    };

    const receiptRef = collection(this.firestore, `stores/${currentCart.storeId}/receipts`);
    const docRef = await addDoc(receiptRef, receipt);

    // Clear cart after successful receipt creation
    this.clearCart();

    return docRef.id;
  }

  clearCart() {
    this._cart.set({
      items: [],
      subtotal: 0,
      tax: 0,
      total: 0,
      storeId: this._cart().storeId
    });
  }

  setViewMode(mode: 'tile' | 'list') {
    this._viewMode.set(mode);
  }

  setSelectedCategory(category: string) {
    this._selectedCategory.set(category);
  }

  private generateOrderNumber(): string {
    const date = new Date();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}-${random}`;
  }

  async getFavoriteProducts(storeId: string): Promise<string[]> {
    const receiptRef = collection(this.firestore, `stores/${storeId}/receipts`);
    const q = query(
      receiptRef,
      where('status', '==', 'completed'),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const productCounts = new Map<string, number>();

    snapshot.docs.forEach(doc => {
      const receipt = doc.data() as Receipt;
      receipt.items.forEach(item => {
        const count = productCounts.get(item.productId) || 0;
        productCounts.set(item.productId, count + item.quantity);
      });
    });

    // Sort products by frequency and return top 10 product IDs
    const sortedProducts = Array.from(productCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([productId]) => productId);

    return sortedProducts;
  }
}
