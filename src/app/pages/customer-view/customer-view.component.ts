import { Component, OnInit, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { 
  Firestore, 
  doc, 
  onSnapshot, 
  Unsubscribe 
} from '@angular/fire/firestore';
import { CustomerViewSession, LiveCartItem, CartTotals } from '../../interfaces/customer-view.interface';

@Component({
  selector: 'app-customer-view',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 text-white">
      <!-- Header -->
      <div class="bg-black bg-opacity-30 backdrop-blur-sm p-6 border-b border-white border-opacity-20">
        <div class="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <h1 class="text-3xl font-bold">{{ companyName() }}</h1>
            <p class="text-blue-200">{{ storeName() }} - {{ branchName() }}</p>
          </div>
          <div class="text-right">
            <p class="text-sm text-blue-200">Order #</p>
            <p class="text-xl font-mono">{{ orderNumber() || 'Pending...' }}</p>
          </div>
        </div>
      </div>

      <!-- Cart Items -->
      <div class="max-w-4xl mx-auto p-6">
        @if (cartItems().length === 0) {
          <div class="text-center py-20">
            <div class="w-16 h-16 mx-auto mb-6 bg-white bg-opacity-10 rounded-full flex items-center justify-center">
              <svg class="w-8 h-8 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6M7 13l1.5-6M17 13v6a2 2 0 01-2 2H9a2 2 0 01-2-2v-6"></path>
              </svg>
            </div>
            <h2 class="text-2xl font-semibold mb-2">Your Cart is Empty</h2>
            <p class="text-blue-200">Items will appear here as they're added by the cashier</p>
          </div>
        } @else {
          <!-- Items List -->
          <div class="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-6 mb-6">
            <h2 class="text-xl font-semibold mb-4 border-b border-white border-opacity-20 pb-2">
              Your Order
            </h2>
            
            <div class="space-y-3">
              @for (item of cartItems(); track item.productId) {
                <div class="flex justify-between items-center py-2">
                  <div class="flex-1">
                    <h3 class="font-medium">{{ item.name }}</h3>
                    @if (item.notes) {
                      <p class="text-sm text-blue-200">{{ item.notes }}</p>
                    }
                  </div>
                  <div class="text-right ml-4">
                    <div class="flex items-center justify-end space-x-3">
                      <span class="text-blue-200">{{ item.quantity }}x</span>
                      <span class="font-mono">{{ item.price | currency }}</span>
                      <span class="font-semibold font-mono min-w-[80px]">
                        {{ item.subtotal | currency }}
                      </span>
                    </div>
                    @if (item.discount && item.discount > 0) {
                      <div class="text-sm text-green-300">
                        Discount: -{{ item.discount | currency }}
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- Totals -->
          <div class="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-6">
            <h2 class="text-xl font-semibold mb-4">Order Summary</h2>
            
            <div class="space-y-2 text-lg">
              <div class="flex justify-between">
                <span>Subtotal:</span>
                <span class="font-mono">{{ totals().subtotal | currency }}</span>
              </div>
              
              @if (totals().discount > 0) {
                <div class="flex justify-between text-green-300">
                  <span>Discount:</span>
                  <span class="font-mono">-{{ totals().discount | currency }}</span>
                </div>
              }
              
              @if (totals().tax > 0) {
                <div class="flex justify-between">
                  <span>Tax:</span>
                  <span class="font-mono">{{ totals().tax | currency }}</span>
                </div>
              }
              
              @if (totals().evat > 0) {
                <div class="flex justify-between">
                  <span>E-VAT:</span>
                  <span class="font-mono">{{ totals().evat | currency }}</span>
                </div>
              }
              
              <div class="border-t border-white border-opacity-20 pt-2 mt-4">
                <div class="flex justify-between text-2xl font-bold">
                  <span>Total:</span>
                  <span class="font-mono">{{ totals().total | currency }}</span>
                </div>
              </div>
            </div>
          </div>
        }

        <!-- Status Message -->
        <div class="text-center mt-8 text-blue-200">
          @if (sessionStatus() === 'processing') {
            <div class="animate-pulse">
              <svg class="w-6 h-6 mx-auto mb-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
              <p>Processing your order...</p>
            </div>
          } @else {
            <p>Thank you for your business!</p>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .animate-pulse {
      animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
    
    .animate-spin {
      animation: spin 1s linear infinite;
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: .5; }
    }
    
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `]
})
export class CustomerViewComponent implements OnInit, OnDestroy {
  private firestore = inject(Firestore);
  private route = inject(ActivatedRoute);

  // Signals
  private session = signal<CustomerViewSession | null>(null);
  protected cartItems = computed(() => this.session()?.cart || []);
  protected totals = computed(() => this.session()?.totals || {
    subtotal: 0,
    discount: 0,
    tax: 0,
    evat: 0,
    total: 0
  });
  protected sessionStatus = computed(() => this.session()?.status || 'active');
  protected orderNumber = computed(() => 
    this.session() ? `ORD-${this.session()!.id.slice(-6).toUpperCase()}` : ''
  );

  // Static data (these would come from session data in a real app)
  protected companyName = signal('Your Business');
  protected storeName = signal('Main Store');
  protected branchName = signal('Branch 1');

  private unsubscribe: Unsubscribe | null = null;

  ngOnInit() {
    // Get session ID from route parameters
    const sessionId = this.route.snapshot.params['sessionId'];
    if (sessionId) {
      this.subscribeToSession(sessionId);
    }
  }

  ngOnDestroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  private subscribeToSession(sessionId: string) {
    // For demo purposes, we'll create a mock session
    // In production, this would listen to Firestore
    this.createMockSession();
  }

  private createMockSession() {
    // Mock session for demonstration
    const mockSession: CustomerViewSession = {
      id: 'demo-session-001',
      companyId: 'demo-company',
      storeId: 'demo-store',
      branchId: 'demo-branch',
      cashierId: 'demo-cashier',
      cart: [],
      totals: {
        subtotal: 0,
        discount: 0,
        tax: 0,
        evat: 0,
        total: 0
      },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.session.set(mockSession);

    // Simulate adding items after a delay
    setTimeout(() => this.addMockItem(), 2000);
    setTimeout(() => this.addMockItem(), 4000);
    setTimeout(() => this.updateTotals(), 5000);
  }

  private addMockItem() {
    const currentSession = this.session();
    if (!currentSession) return;

    const mockItems: LiveCartItem[] = [
      {
        productId: 'prod-1',
        name: 'Premium Coffee',
        price: 4.99,
        quantity: 1,
        subtotal: 4.99,
        notes: 'Extra hot'
      },
      {
        productId: 'prod-2',
        name: 'Blueberry Muffin',
        price: 2.99,
        quantity: 2,
        subtotal: 5.98
      }
    ];

    const newItem = mockItems[currentSession.cart.length % mockItems.length];
    if (newItem && !currentSession.cart.find((item: LiveCartItem) => item.productId === newItem.productId)) {
      const updatedSession = {
        ...currentSession,
        cart: [...currentSession.cart, newItem],
        updatedAt: new Date()
      };
      this.session.set(updatedSession);
    }
  }

  private updateTotals() {
    const currentSession = this.session();
    if (!currentSession) return;

    const subtotal = currentSession.cart.reduce((sum: number, item: LiveCartItem) => sum + item.subtotal, 0);
    const tax = subtotal * 0.08; // 8% tax
    const total = subtotal + tax;

    const updatedSession = {
      ...currentSession,
      totals: {
        subtotal,
        discount: 0,
        tax,
        evat: 0,
        total
      },
      updatedAt: new Date()
    };
    
    this.session.set(updatedSession);
  }
}
