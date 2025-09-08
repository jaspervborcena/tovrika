import { Component, computed, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PosService } from '../../../services/pos.service';

@Component({
  selector: 'app-cart-fab',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button 
      *ngIf="cartItems().length > 0"
      class="cart-fab"
      (click)="openCart()"
      [class.pulse]="cartItems().length > 0">
      <div class="fab-icon">🛒</div>
      <div class="cart-badge" *ngIf="itemCount() > 0">{{ itemCount() }}</div>
      <div class="cart-total">₱{{ netAmount().toFixed(0) }}</div>
    </button>
  `,
  styles: [`
    .cart-fab {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 80px;
      height: 80px;
      background: linear-gradient(135deg, #059669, #047857);
      border: none;
      border-radius: 50%;
      box-shadow: 0 8px 20px rgba(5, 150, 105, 0.3);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      transition: all 0.3s ease;
      color: white;
      font-weight: 600;
    }
    
    .cart-fab:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 25px rgba(5, 150, 105, 0.4);
    }
    
    .cart-fab:active {
      transform: translateY(0);
    }
    
    .cart-fab.pulse {
      animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
      0% {
        transform: scale(1);
        box-shadow: 0 8px 20px rgba(5, 150, 105, 0.3);
      }
      50% {
        transform: scale(1.05);
        box-shadow: 0 12px 25px rgba(5, 150, 105, 0.4);
      }
      100% {
        transform: scale(1);
        box-shadow: 0 8px 20px rgba(5, 150, 105, 0.3);
      }
    }
    
    .fab-icon {
      font-size: 1.5rem;
      margin-bottom: 2px;
    }
    
    .cart-badge {
      position: absolute;
      top: -5px;
      right: -5px;
      background: #ef4444;
      color: white;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      font-size: 0.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      border: 2px solid white;
    }
    
    .cart-total {
      font-size: 0.7rem;
      margin-top: 1px;
      opacity: 0.9;
    }
    
    /* Hide FAB on very small screens to avoid overlap */
    @media (max-width: 360px) {
      .cart-fab {
        width: 70px;
        height: 70px;
        bottom: 15px;
        right: 15px;
      }
      
      .fab-icon {
        font-size: 1.25rem;
      }
      
      .cart-total {
        font-size: 0.65rem;
      }
    }
  `]
})
export class CartFabComponent {
  private posService = inject(PosService);
  
  // Outputs
  cartOpened = output<void>();
  
  // Computed values
  readonly cartItems = computed(() => this.posService.cartItems());
  readonly cartSummary = computed(() => this.posService.cartSummary());
  readonly itemCount = computed(() => this.cartSummary().itemCount);
  readonly netAmount = computed(() => this.cartSummary().netAmount);
  
  openCart(): void {
    this.cartOpened.emit();
  }
}
