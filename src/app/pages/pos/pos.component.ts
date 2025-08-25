import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ButtonComponent } from '../../shared/ui/button.component';
import { SearchComponent } from '../../shared/ui/search.component';
import { NumpadComponent } from '../../shared/ui/numpad.component';
import { ModalComponent } from '../../shared/ui/modal.component';
import { TableComponent } from '../../shared/ui/table.component';
import { ProductService } from '../../services/product.service';
import { PosService } from '../../services/pos.service';
import { AuthService } from '../../services/auth.service';
import { Product } from '../../interfaces/product.interface';
import { CartItem } from '../../interfaces/cart.interface';

interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
}

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonComponent,
    SearchComponent,
    NumpadComponent,
    ModalComponent
  ],
  template: `
    <div class="h-screen flex">
      <!-- Left Side - Product Search and Cart -->
      <div class="flex-1 flex flex-col">
        <!-- Search Bar -->
        <div class="p-4 border-b">
          <ui-search
            placeholder="Search products by name or SKU..."
            (search)="onSearch($event)"
          ></ui-search>
        </div>

        <!-- Product Grid -->
        <div class="flex-1 overflow-y-auto p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div
            *ngFor="let product of filteredProducts()"
            (click)="addToCart(product)"
            class="border rounded-lg p-4 cursor-pointer hover:shadow-lg transition-shadow"
          >
            <h3 class="font-medium text-gray-900">{{ product.name }}</h3>
            <p class="text-gray-500">{{ product.sku }}</p>
            <p class="text-lg font-bold text-primary-600">{{ product.price | currency }}</p>
          </div>
        </div>
      </div>

      <!-- Right Side - Cart and Payment -->
      <div class="w-96 border-l flex flex-col bg-gray-50">
        <!-- Cart Header -->
        <div class="p-4 border-b bg-white">
          <h2 class="text-lg font-medium text-gray-900">Current Sale</h2>
        </div>

        <!-- Cart Items -->
        <div class="flex-1 overflow-y-auto p-4">
          <div *ngFor="let item of cart(); let i = index" class="mb-4">
            <div class="flex justify-between items-start">
              <div>
                <h3 class="font-medium text-gray-900">{{ item.name }}</h3>
                <p class="text-sm text-gray-500">
                  {{ item.quantity }} × {{ item.price | currency }}
                </p>
              </div>
              <div class="flex items-center space-x-2">
                <p class="font-medium">{{ item.subtotal | currency }}</p>
                <button
                  (click)="removeFromCart(i)"
                  class="text-red-600 hover:text-red-800"
                >
                  <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Cart Summary -->
        <div class="border-t bg-white p-4">
          <div class="space-y-2">
            <div class="flex justify-between text-sm">
              <span class="text-gray-500">Subtotal</span>
              <span class="font-medium">{{ subtotal() | currency }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-500">Tax</span>
              <span class="font-medium">{{ tax() | currency }}</span>
            </div>
            <div class="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span>{{ total() | currency }}</span>
            </div>
          </div>

          <div class="mt-4">
            <ui-button
              (click)="openPaymentModal()"
              [disabled]="cart().length === 0"
              class="w-full"
            >
              Pay Now
            </ui-button>
          </div>
        </div>
      </div>
    </div>

    <!-- Payment Modal -->
    <ui-modal
      [isOpen]="isPaymentModalOpen"
      title="Complete Payment"
      [saveLabel]="'Complete'"
      [loading]="isProcessing"
      (onClose)="closePaymentModal()"
      (onSave)="processPayment()"
    >
      <div class="space-y-4">
        <!-- Payment Methods -->
        <div>
          <label class="block text-sm font-medium text-gray-700">Payment Method</label>
          <div class="mt-2 grid grid-cols-2 gap-3">
            <div
              *ngFor="let method of paymentMethods"
              (click)="selectPaymentMethod(method)"
              [class.ring-2]="selectedPaymentMethod?.id === method.id"
              class="relative rounded-lg border bg-white p-4 flex flex-col items-center cursor-pointer hover:border-primary-500"
            >
              <span [class]="method.icon"></span>
              <span class="mt-2 text-sm font-medium text-gray-900">{{ method.name }}</span>
            </div>
          </div>
        </div>

        <!-- Amount Tendered -->
        <div>
          <label class="block text-sm font-medium text-gray-700">Amount Tendered</label>
          <div class="mt-2">
            <div class="flex items-center justify-between p-4 border rounded-lg">
              <span class="text-2xl font-bold">{{ amountTendered() | currency }}</span>
              <span class="text-sm text-gray-500">Change: {{ change() | currency }}</span>
            </div>
          </div>
        </div>

        <!-- Numpad -->
        <ui-numpad
          (numberClick)="onNumpadClick($event)"
          (clear)="clearAmountTendered()"
        ></ui-numpad>
      </div>
    </ui-modal>
  `
})
export class PosComponent implements OnInit {
  private fb = inject(FormBuilder);
  private productService = inject(ProductService);
  private authService = inject(AuthService);

  // Signals
  private products = signal<any[]>([]);
  cart = signal<CartItem[]>([]);
  searchQuery = signal<string>('');
  amountTendered = signal<number>(0);
  
  // Computed values
  filteredProducts = computed(() => {
    const query = this.searchQuery().toLowerCase();
    return this.products().filter(product =>
      product.name.toLowerCase().includes(query) ||
      product.sku.toLowerCase().includes(query)
    );
  });

  subtotal = computed(() => 
    this.cart().reduce((sum, item) => sum + item.subtotal, 0)
  );

  tax = computed(() => {
    // Calculate tax based on a default tax rate (this could be configurable)
    const taxRate = 0.08; // 8% tax rate
    return this.subtotal() * taxRate;
  });

  total = computed(() => this.subtotal() + this.tax());

  change = computed(() => Math.max(0, this.amountTendered() - this.total()));

  // Component state
  isPaymentModalOpen = false;
  isProcessing = false;
  selectedPaymentMethod: PaymentMethod | null = null;

  paymentMethods: PaymentMethod[] = [
    { id: 'cash', name: 'Cash', icon: 'text-2xl fas fa-money-bill-wave' },
    { id: 'card', name: 'Card', icon: 'text-2xl fas fa-credit-card' },
    { id: 'mobile', name: 'Mobile Payment', icon: 'text-2xl fas fa-mobile-alt' },
    { id: 'other', name: 'Other', icon: 'text-2xl fas fa-ellipsis-h' }
  ];

  ngOnInit() {
    this.loadProducts();
  }

  private async loadProducts() {
    const user = this.authService.getCurrentUser();
    if (user?.companyId) {
      await this.productService.loadProducts(user.companyId);
      this.products.set(this.productService.getProducts());
    }
  }

  onSearch(query: string) {
    this.searchQuery.set(query);
  }

  addToCart(product: any) {
    const existingItem = this.cart().find(item => item.productId === product.id);
    
    if (existingItem) {
      this.cart.update(items =>
        items.map(item =>
          item.productId === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                subtotal: (item.quantity + 1) * item.price
              }
            : item
        )
      );
    } else {
      const newItem: CartItem = {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        subtotal: product.price
      };
      this.cart.update(items => [...items, newItem]);
    }
  }

  removeFromCart(index: number) {
    this.cart.update(items => items.filter((_, i) => i !== index));
  }

  selectPaymentMethod(method: PaymentMethod) {
    this.selectedPaymentMethod = method;
    if (method.id === 'card' || method.id === 'mobile') {
      this.amountTendered.set(this.total());
    }
  }

  openPaymentModal() {
    this.isPaymentModalOpen = true;
    this.amountTendered.set(0);
    this.selectedPaymentMethod = null;
  }

  closePaymentModal() {
    this.isPaymentModalOpen = false;
    this.amountTendered.set(0);
    this.selectedPaymentMethod = null;
  }

  onNumpadClick(value: string) {
    if (value === '.' && this.amountTendered().toString().includes('.')) {
      return;
    }

    const newAmount = parseFloat(this.amountTendered().toString() + value);
    if (!isNaN(newAmount)) {
      this.amountTendered.set(newAmount);
    }
  }

  clearAmountTendered() {
    this.amountTendered.set(0);
  }

  async processPayment() {
    if (!this.selectedPaymentMethod) {
      // Show error message
      return;
    }

    if (this.selectedPaymentMethod.id === 'cash' && this.amountTendered() < this.total()) {
      // Show error message
      return;
    }

    this.isProcessing = true;
    try {
      // TODO: Implement transaction processing
      // 1. Create transaction record
      // 2. Update inventory
      // 3. Print receipt
      // 4. Clear cart
      this.cart.set([]);
      this.closePaymentModal();
    } catch (error) {
      console.error('Error processing payment:', error);
    } finally {
      this.isProcessing = false;
    }
  }
}
