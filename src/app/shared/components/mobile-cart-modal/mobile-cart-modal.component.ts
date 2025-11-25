import { Component, computed, inject, signal, output, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { PosService } from '../../../services/pos.service';
import { CartItem } from '../../../interfaces/pos.interface';
import { AppConstants } from '../../../shared/enums/app-constants.enum';

@Component({
  selector: 'app-mobile-cart-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  template: `
    <div class="cart-modal-overlay" (click)="closeModal()" *ngIf="isVisible()">
      <div class="cart-modal-content" (click)="$event.stopPropagation()">
        <!-- Modal Header -->
        <div class="cart-modal-header">
          <h3>{{ 'pos.cartSummary' | translate }}</h3>
          <button class="close-btn" (click)="closeModal()">×</button>
        </div>
        
        <!-- Modal Body (Scrollable) -->
        <div class="cart-modal-body">
          <!-- Cart Information Fieldset -->
          <fieldset class="cart-fieldset">
            <legend class="clickable-legend" (click)="openCartInformationDialog()">
              <svg class="view-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              {{ 'pos.cartInformation' | translate }}
            </legend>
            
            <!-- Cart Items -->
            <div class="cart-items-container">
              <div *ngIf="cartItems().length === 0" class="empty-cart">
                <p>{{ 'pos.cartEmpty' | translate }}</p>
              </div>
              
              <div *ngFor="let item of cartItemsLatestFirst()" class="cart-item-mobile">
                <!-- Item Header Row -->
                <div class="item-header-row">
                  <div class="item-info">
                    <div class="item-name">{{ item.productName }}</div>
                    <div class="item-sku">{{ item.skuId }} - ₱{{ item.sellingPrice.toFixed(2) }} each
                      <small class="text-muted" style="display:block">base ₱{{ (item.originalPrice || 0).toFixed(2) }}</small>
                    </div>
                  </div>
                  <button 
                    (click)="removeFromCart(item.productId)" 
                    class="remove-item-btn" 
                    [disabled]="isOrderCompleted()"
                    [class.disabled]="isOrderCompleted()">×</button>
                </div>
                
                <!-- Item Controls Row -->
                <div class="item-controls-row">
                  <div class="quantity-control">
                    <button 
                      (click)="updateQuantity(item.productId, item.quantity - 1)" 
                      class="qty-btn"
                      [disabled]="isOrderCompleted()"
                      [class.disabled]="isOrderCompleted()">-</button>
                    <span class="qty-display">{{ item.quantity }}</span>
                    <button 
                      (click)="updateQuantity(item.productId, item.quantity + 1)" 
                      class="qty-btn"
                      [disabled]="isOrderCompleted()"
                      [class.disabled]="isOrderCompleted()">+</button>
                  </div>
                  <div class="item-total-price">₱{{ item.total.toFixed(2) }}</div>
                </div>
                
                <!-- VAT Exemption Toggle -->
                <div class="item-controls" *ngIf="item.isVatApplicable">
                  <label class="vat-exempt-toggle" [class.disabled]="isOrderCompleted()">
                    <input 
                      type="checkbox" 
                      [checked]="item.isVatExempt"
                      [disabled]="isOrderCompleted()"
                      (change)="toggleVatExemption(item.productId)">
                    {{ 'pos.vatExempt' | translate }}
                  </label>
                </div>
              </div>
            </div>
            
            <!-- Cart Summary -->
            <div class="cart-summary-section" *ngIf="cartItems().length > 0">
              <div class="summary-row">
                <span class="summary-label">{{ 'pos.vatableSales' | translate }}:</span>
                <span class="summary-value">₱{{ cartSummary().vatableSales.toFixed(2) }}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">{{ 'pos.vatAmount' | translate }}:</span>
                <span class="summary-value">₱{{ cartSummary().vatAmount.toFixed(2) }}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">{{ 'pos.vatExemptSales' | translate }}:</span>
                <span class="summary-value">₱{{ cartSummary().vatExemptSales.toFixed(2) }}</span>
              </div>
              <div class="summary-row" *ngIf="cartSummary().productDiscountAmount > 0">
                <span class="summary-label">{{ 'pos.productDiscounts' | translate }}:</span>
                <span class="summary-value">-₱{{ cartSummary().productDiscountAmount.toFixed(2) }}</span>
              </div>
              <div class="summary-row gross-row">
                <span class="summary-label">{{ 'pos.grossAmount' | translate }}:</span>
                <span class="summary-value">₱{{ cartSummary().grossAmount.toFixed(2) }}</span>
              </div>
              <div class="summary-row total-row">
                <span class="summary-label">{{ 'pos.netAmount' | translate }}:</span>
                <span class="summary-value total-amount">₱{{ cartSummary().netAmount.toFixed(2) }}</span>
              </div>
            </div>
          </fieldset>
        </div>
        
        <!-- Fixed Footer -->
        <div class="cart-modal-footer">
          <button 
            class="btn btn-secondary" 
            (click)="clearCart()" 
            [disabled]="isOrderCompleted() || cartItems().length === 0"
            [class.disabled]="isOrderCompleted() || cartItems().length === 0">{{ 'buttons.clearCart' | translate }}</button>
          <button 
            class="btn btn-primary" 
            (click)="processOrder()" 
            [disabled]="isProcessing() || cartItems().length === 0"
            [class.processing]="isProcessing()"
            [class.disabled]="cartItems().length === 0">
            {{ getOrderButtonText() }}
          </button>
        </div>
      </div>
    </div>

    <!-- Cart Information Dialog -->
    <div *ngIf="showCartInformationDialog()" class="cart-info-modal-overlay">
      <div class="cart-info-modal-content" (click)="$event.stopPropagation()">
        <!-- Dialog Header -->
        <div class="cart-info-header">
          <h3>🛒 {{ 'pos.cartInformation' | translate }}</h3>
          <button class="close-btn" (click)="closeCartInformationDialog()">×</button>
        </div>
        
        <!-- Dialog Body (Scrollable) -->
        <div class="cart-info-body">
          <div class="cart-items-section">
            <div class="cart-items-list-mobile">
              <div class="cart-item-mobile-row" *ngFor="let item of cartItems(); let i = index">
                <!-- Product Info Row -->
                <div class="product-info-row">
                  <div class="product-details">
                    <div class="product-name">{{ item.productName }}</div>
                    <div class="product-sku">{{ item.skuId }}</div>
                  </div>
                  <div class="product-price">₱{{ item.sellingPrice.toFixed(2) }}
                    <div class="text-muted small">base ₱{{ (item.originalPrice || 0).toFixed(2) }}</div>
                  </div>
                </div>
                
                <!-- Quantity Row -->
                <div class="control-row">
                  <label class="control-label">{{ 'pos.quantity' | translate }}:</label>
                  <div class="quantity-controls-mobile">
                    <button (click)="updateQuantity(item.productId, item.quantity - 1)" class="qty-btn-mobile">-</button>
                    <span class="quantity-display">{{ item.quantity }}</span>
                    <button (click)="updateQuantity(item.productId, item.quantity + 1)" class="qty-btn-mobile">+</button>
                  </div>
                </div>
                
                <!-- VAT Row -->
                <div class="control-row">
                  <label class="control-label">
                    <input 
                      type="checkbox" 
                      [(ngModel)]="item.isVatApplicable"
                      (change)="updateCartItemField(i, 'isVatApplicable', item.isVatApplicable)"
                      class="mobile-checkbox">
                    {{ 'pos.vatApplicable' | translate }}
                  </label>
                  <input 
                    type="number" 
                    [(ngModel)]="item.vatRate"
                    (change)="updateCartItemField(i, 'vatRate', item.vatRate)"
                    [disabled]="!item.isVatApplicable"
                    min="0"
                    max="100"
                    step="0.01"
                    class="mobile-input"
                    placeholder="VAT %">
                </div>
                
                <!-- Discount Row -->
                <div class="control-row">
                  <label class="control-label">
                    <input 
                      type="checkbox" 
                      [(ngModel)]="item.hasDiscount"
                      (change)="updateCartItemField(i, 'hasDiscount', item.hasDiscount)"
                      class="mobile-checkbox">
                    {{ 'pos.hasDiscount' | translate }}
                  </label>
                  <div class="discount-controls">
                    <select 
                      [(ngModel)]="item.discountType"
                      (change)="updateCartItemField(i, 'discountType', item.discountType)"
                      [disabled]="!item.hasDiscount"
                      class="mobile-select">
                      <option value="percentage">%</option>
                      <option value="fixed">₱</option>
                    </select>
                    <input 
                      type="number" 
                      [(ngModel)]="item.discountValue"
                      (change)="updateCartItemField(i, 'discountValue', item.discountValue)"
                      [disabled]="!item.hasDiscount"
                      [max]="item.discountType === 'percentage' ? 100 : item.sellingPrice * item.quantity"
                      min="0"
                      step="0.01"
                      class="mobile-input"
                      placeholder="Value">
                  </div>
                </div>
                
                <!-- Total Row -->
                <div class="control-row total-row">
                  <label class="control-label">{{ 'pos.total' | translate }}:</label>
                  <input 
                    type="number" 
                    [(ngModel)]="item.total"
                    (change)="updateCartItemField(i, 'total', item.total)"
                    min="0"
                    step="0.01"
                    class="mobile-input total-input"
                    placeholder="Total">
                </div>
              </div>
              
              <div *ngIf="cartItems().length === 0" class="empty-cart-message">
                {{ 'pos.cartEmpty' | translate }}
              </div>
            </div>
          </div>
        </div>
        
        <!-- Dialog Footer -->
        <div class="cart-info-footer">
          <button 
            type="button"
            class="btn-secondary-mobile"
            (click)="closeCartInformationDialog()">
            {{ 'buttons.cancel' | translate }}
          </button>
          <button 
            type="button"
            class="btn-primary-mobile"
            (click)="saveAndCloseCartInformationDialog()">
            {{ 'buttons.save' | translate }}
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
    
    .cart-modal-body {
      flex: 1 1 auto;
      overflow-y: auto;
      min-height: 0;
    }
    
    .cart-modal-footer {
      padding: 1rem;
      border-top: 1px solid #e5e7eb;
      display: flex;
      gap: 0.75rem;
      flex-shrink: 0;
      background: white;
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
      padding: 1rem;
      /* Remove fixed height and overflow, let it flow naturally */
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
      /* Remove flex-shrink: 0 since this is now in the scrollable body */
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
    
    .btn:disabled,
    .btn.disabled {
      background: #d1d5db;
      color: #9ca3af;
      cursor: not-allowed;
    }

    .remove-item-btn:disabled,
    .remove-item-btn.disabled {
      background: #d1d5db;
      color: #9ca3af;
      cursor: not-allowed;
    }

    .qty-btn:disabled,
    .qty-btn.disabled {
      background: #d1d5db;
      color: #9ca3af;
      cursor: not-allowed;
    }

    .vat-exempt-toggle.disabled {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    }

    /* Cart Information Fieldset Styles */
    .cart-fieldset {
      border: 2px solid #10b981;
      border-radius: 8px;
      padding: 0;
      margin: 1rem;
      background: #f0fdf4;
    }

    .clickable-legend {
      background: #10b981;
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.2s ease;
      font-size: 0.875rem;
    }

    .clickable-legend:hover {
      background: #059669;
      transform: translateY(-1px);
    }

    .view-icon {
      width: 16px;
      height: 16px;
      stroke-width: 2.5;
    }

    /* Mobile Cart Information Dialog Styles */
    .cart-info-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10001;
      padding: 1rem;
    }

    .cart-info-modal-content {
      background: white;
      border-radius: 12px;
      width: 100%;
      max-width: 500px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
    }

    .cart-info-header {
      padding: 1rem;
      border-bottom: 1px solid #e5e7eb;
      background: #f9fafb;
      border-radius: 12px 12px 0 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    }

    .cart-info-header h3 {
      margin: 0;
      font-size: 1.125rem;
      font-weight: 600;
      color: #1f2937;
    }

    .cart-info-body {
      flex: 1;
      overflow-y: auto;
      padding: 1rem;
    }

    .cart-items-list-mobile {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .cart-item-mobile-row {
      background: #f9fafb;
      border-radius: 8px;
      padding: 1rem;
      border: 1px solid #e5e7eb;
    }

    .product-info-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid #e5e7eb;
    }

    .product-details {
      flex: 1;
    }

    .product-name {
      font-weight: 600;
      color: #1f2937;
      font-size: 1rem;
      margin-bottom: 0.25rem;
    }

    .product-sku {
      font-size: 0.875rem;
      color: #6b7280;
    }

    .product-price {
      font-weight: 600;
      color: #059669;
      font-size: 1rem;
    }

    .control-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }

    .control-row:last-child {
      margin-bottom: 0;
    }

    .control-label {
      font-weight: 500;
      color: #374151;
      font-size: 0.875rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      min-width: 120px;
    }

    .mobile-checkbox {
      width: 16px;
      height: 16px;
      cursor: pointer;
    }

    .quantity-controls-mobile {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .qty-btn-mobile {
      width: 32px;
      height: 32px;
      border: 1px solid #d1d5db;
      background: #3b82f6;
      color: white;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1rem;
      font-weight: 600;
    }

    .qty-btn-mobile:hover {
      background: #2563eb;
    }

    .quantity-display {
      font-weight: 600;
      color: #1f2937;
      min-width: 32px;
      text-align: center;
      font-size: 1rem;
    }

    .mobile-input {
      width: 120px;
      padding: 0.5rem;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 0.875rem;
      text-align: center;
    }

    .mobile-input:focus {
      outline: none;
      border-color: #10b981;
      box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.1);
    }

    .mobile-input:disabled {
      background: #f3f4f6;
      color: #9ca3af;
      cursor: not-allowed;
    }

    .mobile-select {
      width: 60px;
      padding: 0.5rem;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 0.875rem;
      text-align: center;
      margin-right: 0.5rem;
    }

    .mobile-select:focus {
      outline: none;
      border-color: #10b981;
      box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.1);
    }

    .mobile-select:disabled {
      background: #f3f4f6;
      color: #9ca3af;
      cursor: not-allowed;
    }

    .discount-controls {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .total-row {
      border-top: 1px solid #e5e7eb;
      padding-top: 0.75rem;
      margin-top: 0.75rem;
    }

    .total-input {
      font-weight: 600;
      color: #059669;
      background-color: #f0fdf4;
      border-color: #059669;
    }

    .total-input:focus {
      background-color: #ffffff;
    }

    .cart-info-footer {
      padding: 1rem;
      border-top: 1px solid #e5e7eb;
      background: #f9fafb;
      display: flex;
      gap: 0.75rem;
      border-radius: 0 0 12px 12px;
      flex-shrink: 0;
    }

    .btn-secondary-mobile,
    .btn-primary-mobile {
      flex: 1;
      padding: 0.75rem;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-secondary-mobile {
      background: #6b7280;
      color: white;
    }

    .btn-secondary-mobile:hover {
      background: #4b5563;
    }

    .btn-primary-mobile {
      background: #059669;
      color: white;
    }

    .btn-primary-mobile:hover {
      background: #047857;
    }
  `]
})
export class MobileCartModalComponent {
  private posService = inject(PosService);
  
  // Props
  isVisible = signal<boolean>(false);
  isOrderCompleted = input<boolean>(false);
  
  // Cart Information Dialog Signal
  cartInformationModalVisible = signal<boolean>(false);
  
  // Outputs
  modalClosed = output<void>();
  orderProcessed = output<void>();
  
  // Computed values
  readonly cartItems = computed(() => this.posService.cartItems());
  // Display most recently added first in mobile cart modal
  readonly cartItemsLatestFirst = computed(() => {
    const items = this.posService.cartItems();
    return Array.isArray(items) ? [...items].reverse() : items;
  });
  readonly cartSummary = computed(() => this.posService.cartSummary());
  readonly isProcessing = computed(() => this.posService.isProcessing());
  
  // Cart Information Dialog Methods
  showCartInformationDialog(): boolean {
    return this.cartInformationModalVisible();
  }
  
  openCartInformationDialog(): void {
    this.cartInformationModalVisible.set(true);
  }
  
  closeCartInformationDialog(): void {
    this.cartInformationModalVisible.set(false);
  }
  
  saveAndCloseCartInformationDialog(): void {
    // Changes are already saved in real-time through updateCartItemField
    // Just close the dialog
    this.cartInformationModalVisible.set(false);
  }
  
  updateCartItemField(index: number, field: string, value: any): void {
    try {
      const currentItems = this.cartItems();
      if (index >= 0 && index < currentItems.length) {
        const updatedItem = { ...currentItems[index] };
        
        // Update the specific field
        (updatedItem as any)[field] = value;
        
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
        
        // Update the cart item through the POS service using productId
        this.posService.updateCartItem(updatedItem);
      }
    } catch (error) {
      console.error('Error updating cart item field:', error);
    }
  }
  
  // Methods
  show(): void {
    this.isVisible.set(true);
  }
  
  closeModal(): void {
    this.isVisible.set(false);
    this.modalClosed.emit();
  }
  
  getOrderButtonText(): string {
    if (this.isOrderCompleted()) {
      return 'Print Receipt';
    }
    if (this.isProcessing()) {
      return 'Processing...';
    }
    return 'Complete Order';
  }
  
  updateQuantity(productId: string, quantity: number): void {
    if (this.isOrderCompleted()) return; // Prevent editing completed orders
    this.posService.updateCartItemQuantity(productId, quantity);
  }
  
  removeFromCart(productId: string): void {
    if (this.isOrderCompleted()) return; // Prevent editing completed orders
    this.posService.removeFromCart(productId);
  }
  
  toggleVatExemption(productId: string): void {
    if (this.isOrderCompleted()) return; // Prevent editing completed orders
    this.posService.toggleVatExemption(productId);
  }
  
  clearCart(): void {
    if (this.isOrderCompleted()) return; // Prevent clearing completed orders
    this.posService.clearCart();
    this.closeModal();
  }
  
  processOrder(): void {
    // Allow processing even if order is completed (for reprinting)
    // The parent component's processOrder() will check isOrderCompleted() 
    // and show the receipt instead
    this.orderProcessed.emit();
    this.closeModal();
  }
}
