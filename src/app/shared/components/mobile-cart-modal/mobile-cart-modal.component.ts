import { Component, computed, inject, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PosService } from '../../../services/pos.service';
import { CartItem } from '../../../interfaces/pos.interface';

@Component({
  selector: 'app-mobile-cart-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="cart-modal-overlay" (click)="closeModal()" *ngIf="isVisible()">
      <div class="cart-modal-content" (click)="$event.stopPropagation()">
        <!-- Modal Header -->
        <div class="cart-modal-header">
          <h3>Cart Summary</h3>
          <button class="close-btn" (click)="closeModal()">×</button>
        </div>
        
        <!-- Cart Items -->
        <div class="cart-items-container">
          <div *ngIf="cartItems().length === 0" class="empty-cart">
            <p>No items in cart</p>
          </div>
          
          <div *ngFor="let item of cartItems()" class="cart-item-mobile">
            <!-- Item Header Row -->
            <div class="item-header-row">
              <div class="item-info">
                <div class="item-name">{{ item.productName }}</div>
                <div class="item-sku">{{ item.skuId }} - ₱{{ item.sellingPrice.toFixed(2) }} each</div>
              </div>
              <button (click)="removeFromCart(item.productId)" class="remove-item-btn">×</button>
            </div>
            
            <!-- Item Controls Row -->
            <div class="item-controls-row">
              <div class="quantity-control">
                <button (click)="updateQuantity(item.productId, item.quantity - 1)" class="qty-btn">-</button>
                <span class="qty-display">{{ item.quantity }}</span>
                <button (click)="updateQuantity(item.productId, item.quantity + 1)" class="qty-btn">+</button>
              </div>
              <div class="item-total-price">₱{{ item.total.toFixed(2) }}</div>
            </div>
            
            <!-- VAT Exemption Toggle -->
            <div class="item-controls" *ngIf="item.isVatApplicable">
              <label class="vat-exempt-toggle">
                <input 
                  type="checkbox" 
                  [checked]="item.isVatExempt"
                  (change)="toggleVatExemption(item.productId)">
                VAT Exempt
              </label>
            </div>
          </div>
        </div>
        
        <!-- Cart Summary -->
        <div class="cart-summary-section" *ngIf="cartItems().length > 0">
          <div class="summary-row">
            <span class="summary-label">Vatable Sales:</span>
            <span class="summary-value">₱{{ cartSummary().vatableSales.toFixed(2) }}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">VAT Amount:</span>
            <span class="summary-value">₱{{ cartSummary().vatAmount.toFixed(2) }}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Non-Vatable:</span>
            <span class="summary-value">₱{{ cartSummary().vatExemptSales.toFixed(2) }}</span>
          </div>
          <div class="summary-row" *ngIf="cartSummary().productDiscountAmount > 0">
            <span class="summary-label">Product Discounts:</span>
            <span class="summary-value">-₱{{ cartSummary().productDiscountAmount.toFixed(2) }}</span>
          </div>
          <div class="summary-row gross-row">
            <span class="summary-label">Gross Amount:</span>
            <span class="summary-value">₱{{ cartSummary().grossAmount.toFixed(2) }}</span>
          </div>
          <div class="summary-row total-row">
            <span class="summary-label">NET AMOUNT:</span>
            <span class="summary-value total-amount">₱{{ cartSummary().netAmount.toFixed(2) }}</span>
          </div>
        </div>
        
        <!-- Action Buttons -->
        <div class="cart-actions" *ngIf="cartItems().length > 0">
          <button class="btn btn-secondary" (click)="clearCart()">Clear Cart</button>
          <button class="btn btn-primary" (click)="processOrder()" [disabled]="isProcessing()">
            {{ isProcessing() ? 'Processing...' : 'Complete Order' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .cart-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      padding: 1rem;
      box-sizing: border-box;
    }
    
    .cart-modal-content {
      background: white;
      border-radius: 12px;
      width: 100%;
      max-width: 500px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    }
    
    .cart-modal-header {
      padding: 1rem;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    }
    
    .cart-modal-header h3 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
      color: #1f2937;
    }
    
    .close-btn {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      padding: 0;
      color: #6b7280;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
    }
    
    .close-btn:hover {
      background: #f3f4f6;
      color: #374151;
    }
    
    .cart-items-container {
      flex: 1;
      overflow-y: auto;
      padding: 1rem;
      max-height: 400px;
    }
    
    .empty-cart {
      text-align: center;
      padding: 2rem;
      color: #6b7280;
    }
    
    .cart-item-mobile {
      background: #f9fafb;
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 0.75rem;
      border: 1px solid #e5e7eb;
    }
    
    .item-header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 0.75rem;
    }
    
    .item-info {
      flex: 1;
    }
    
    .item-name {
      font-weight: 600;
      color: #1f2937;
      font-size: 1rem;
      margin-bottom: 0.25rem;
    }
    
    .item-sku {
      font-size: 0.875rem;
      color: #6b7280;
    }
    
    .remove-item-btn {
      background: #ef4444;
      color: white;
      border: none;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      font-size: 1rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-left: 0.5rem;
    }
    
    .remove-item-btn:hover {
      background: #dc2626;
    }
    
    .item-controls-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .quantity-control {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .qty-btn {
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 6px;
      width: 32px;
      height: 32px;
      font-size: 1rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .qty-btn:hover {
      background: #2563eb;
    }
    
    .qty-display {
      font-weight: 600;
      font-size: 1rem;
      min-width: 2rem;
      text-align: center;
    }
    
    .item-total-price {
      font-weight: 600;
      font-size: 1.1rem;
      color: #059669;
    }
    
    .item-controls {
      margin-top: 0.5rem;
      padding-top: 0.5rem;
      border-top: 1px solid #e5e7eb;
    }
    
    .vat-exempt-toggle {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      color: #6b7280;
      cursor: pointer;
    }
    
    .cart-summary-section {
      padding: 1rem;
      border-top: 1px solid #e5e7eb;
      background: #f9fafb;
      flex-shrink: 0;
    }
    
    .summary-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.5rem;
    }
    
    .summary-label {
      color: #6b7280;
      font-size: 0.875rem;
    }
    
    .summary-value {
      font-weight: 600;
      color: #1f2937;
    }
    
    .gross-row {
      border-top: 1px solid #e5e7eb;
      padding-top: 0.5rem;
      margin-top: 0.5rem;
    }
    
    .total-row {
      border-top: 2px solid #1f2937;
      padding-top: 0.5rem;
      margin-top: 0.5rem;
    }
    
    .total-amount {
      font-size: 1.125rem;
      color: #059669;
    }
    
    .cart-actions {
      padding: 1rem;
      border-top: 1px solid #e5e7eb;
      display: flex;
      gap: 0.75rem;
      flex-shrink: 0;
    }
    
    .btn {
      flex: 1;
      padding: 0.75rem;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .btn-secondary {
      background: #6b7280;
      color: white;
    }
    
    .btn-secondary:hover {
      background: #4b5563;
    }
    
    .btn-primary {
      background: #059669;
      color: white;
    }
    
    .btn-primary:hover {
      background: #047857;
    }
    
    .btn:disabled {
      background: #d1d5db;
      color: #9ca3af;
      cursor: not-allowed;
    }
  `]
})
export class MobileCartModalComponent {
  private posService = inject(PosService);
  
  // Props
  isVisible = signal<boolean>(false);
  
  // Outputs
  modalClosed = output<void>();
  orderProcessed = output<void>();
  
  // Computed values
  readonly cartItems = computed(() => this.posService.cartItems());
  readonly cartSummary = computed(() => this.posService.cartSummary());
  readonly isProcessing = computed(() => this.posService.isProcessing());
  
  // Methods
  show(): void {
    this.isVisible.set(true);
  }
  
  closeModal(): void {
    this.isVisible.set(false);
    this.modalClosed.emit();
  }
  
  updateQuantity(productId: string, quantity: number): void {
    this.posService.updateCartItemQuantity(productId, quantity);
  }
  
  removeFromCart(productId: string): void {
    this.posService.removeFromCart(productId);
  }
  
  toggleVatExemption(productId: string): void {
    this.posService.toggleVatExemption(productId);
  }
  
  clearCart(): void {
    this.posService.clearCart();
    this.closeModal();
  }
  
  processOrder(): void {
    this.orderProcessed.emit();
    this.closeModal();
  }
}
