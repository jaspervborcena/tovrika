import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CartItem } from '../../../../../interfaces/pos.interface';

@Component({
  selector: 'app-shopping-cart',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './shopping-cart.component.html',
  styleUrl: './shopping-cart.component.css'
})
export class ShoppingCartComponent {
  @Input() cartItems: CartItem[] = [];
  @Input() cartSummary: any = {};
  @Input() isProcessing = false;
  @Input() paymentAmount = 0;
  @Input() paymentMethod = 'cash';

  @Output() quantityChanged = new EventEmitter<{productId: string, quantity: number}>();
  @Output() itemRemoved = new EventEmitter<string>();
  @Output() vatToggled = new EventEmitter<string>();
  @Output() paymentMethodChanged = new EventEmitter<string>();
  @Output() paymentAmountChanged = new EventEmitter<number>();
  @Output() checkoutRequested = new EventEmitter<void>();

  readonly paymentMethods = [
    { value: 'cash', label: 'Cash' },
    { value: 'card', label: 'Card' },
    { value: 'gcash', label: 'GCash' }
  ];

  onQuantityChange(productId: string, quantity: number): void {
    if (quantity > 0) {
      this.quantityChanged.emit({ productId, quantity });
    }
  }

  onRemoveItem(productId: string): void {
    this.itemRemoved.emit(productId);
  }

  onToggleVat(productId: string): void {
    this.vatToggled.emit(productId);
  }

  onPaymentMethodChange(method: string): void {
    this.paymentMethodChanged.emit(method);
  }

  onPaymentAmountChange(amount: number): void {
    this.paymentAmountChanged.emit(amount);
  }

  onCheckout(): void {
    if (this.cartItems.length > 0 && !this.isProcessing) {
      this.checkoutRequested.emit();
    }
  }

  get changeAmount(): number {
    return Math.max(0, this.paymentAmount - this.cartSummary.netAmount);
  }

  get canCheckout(): boolean {
    return this.cartItems.length > 0 && 
           !this.isProcessing && 
           (this.paymentMethod !== 'cash' || this.paymentAmount >= this.cartSummary.netAmount);
  }
}
