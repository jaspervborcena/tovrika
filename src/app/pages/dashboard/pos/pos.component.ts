import { Component, OnInit, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { ProductService } from '../../../services/product.service';
import { PosService } from '../../../services/pos.service';
import { AuthService } from '../../../services/auth.service';
import { CompanyService } from '../../../services/company.service';
import { OrderService } from '../../../services/order.service';
import { StoreService } from '../../../services/store.service';
import { UserRoleService } from '../../../services/user-role.service';
import { Product } from '../../../interfaces/product.interface';
import { CartItem, ProductViewType, ReceiptData } from '../../../interfaces/pos.interface';
import { Store } from '../../../interfaces/store.interface';

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, HeaderComponent],
  template: `
    <div class="pos-container">
      <app-header></app-header>
      <!-- Store selector as pill-tabs (reuse category button styles) -->
      <div class="store-selector" *ngIf="availableStores().length">
        <div class="category-list" style="padding:0.75rem 1rem; gap:0.5rem;">
          <button
            *ngFor="let store of availableStores()"
            [class.active]="selectedStoreId() === store.id"
            (click)="selectStore(store.id!)"
            class="category-btn"
            title="{{ store.storeName }}">
            {{ store.storeName }}
          </button>
        </div>
      </div>

      <!-- Main POS Layout -->
      <div class="pos-layout">
        <!-- Left Panel: Categories & Products -->
        <div class="left-panel">
          <!-- Categories Panel -->
          <div class="categories-panel">
            <h3>Categories</h3>
            <div class="category-list">
              <button 
                [class.active]="selectedCategory() === 'all'"
                (click)="setSelectedCategory('all')"
                class="category-btn">
                All Products
              </button>
              <button 
                *ngFor="let category of categories()"
                [class.active]="selectedCategory() === category"
                (click)="setSelectedCategory(category)"
                class="category-btn">
                {{ category }}
              </button>
            </div>
          </div>

          <!-- Search Bar -->
          <!-- Access Tabs (New, Orders, Cancelled, Refunds & Returns, Split Payments, Discounts & Promotions) -->
          <div class="access-tabs" style="padding: 0 1rem;">
            <div class="access-tab-list">
              <button *ngFor="let t of accessTabs" 
                      (click)="setAccessTab(t)"
                      [class.active]="accessTab() === t"
                      class="tab-header">
                <div class="tab-content">
                  <span class="tab-label">{{ t }}</span>
                </div>
              </button>
            </div>
          </div>

          <div class="search-section">
            <div class="search-bar">
              <svg class="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
              <input 
                type="text"
                [ngModel]="searchQuery()"
                (ngModelChange)="setSearchQuery($event)"
                (input)="onSearch()"
                [placeholder]="accessTab() === 'Orders' ? 'Search Orders (OrderId / Invoice / YYYYMMDD)' : 'Search by barcode, QR code, SKU, or name...'"
                class="search-input">
              <button *ngIf="searchQuery()" (click)="clearSearch()" class="clear-btn">×</button>
            </div>
          </div>

          <!-- Product View Tabs -->
          <div class="product-tabs" *ngIf="accessTab() === 'New'">
            <button 
              [class.active]="currentView() === 'list'"
              (click)="setCurrentView('list')"
              class="tab-btn">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path>
              </svg>
              List
            </button>
            <button 
              [class.active]="currentView() === 'grid'"
              (click)="setCurrentView('grid')"
              class="tab-btn">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"></path>
              </svg>
              Grid
            </button>
            <button 
              [class.active]="currentView() === 'custom'"
              (click)="setCurrentView('custom')"
              class="tab-btn">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
              </svg>
              Promos
            </button>
            <button 
              [class.active]="currentView() === 'bestsellers'"
              (click)="setCurrentView('bestsellers')"
              class="tab-btn">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              Best Sellers
            </button>
          </div>

            <!-- Products Display (shown only for New access tab). Orders will use the same area for results -->
            <div class="products-display" *ngIf="accessTab() === 'New'">
            <!-- List View -->
            <div *ngIf="currentView() === 'list'" class="products-list">
              <div 
                *ngFor="let product of filteredProducts()"
                (click)="addToCart(product)"
                class="product-list-item">
                <img 
                  [src]="product.imageUrl || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xNiAxNkMyMC40MTgzIDE2IDI0IDE5LjU4MTcgMjQgMjRDMjQgMjguNDE4MyAyMC40MTgzIDMyIDE2IDMyQzExLjU4MTcgMzIgOCAyOC40MTgzIDggMjRDOCAxOS41ODE3IDExLjU4MTcgMTYgMTYgMTZaIiBmaWxsPSIjRDFENURCIi8+CjxwYXRoIGQ9Ik0yNiAxNkMzMC40MTgzIDE2IDM0IDE5LjU4MTcgMzQgMjRDMzQgMjguNDE4MyAzMC40MTgzIDMyIDI2IDMyQzIxLjU4MTcgMzIgMTggMjguNDE4MyAxOCAyNEMxOCAxOS41ODE3IDIxLjU4MTcgMTYgMjYgMTZaIiBmaWxsPSIjRDFENURCIi8+CjwvZ3ZnPgo='"
                  [alt]="product.productName"
                  class="product-image-small">
                <div class="product-info">
                  <h4>{{ product.productName }}</h4>
                  <p class="product-sku">{{ product.skuId }}</p>
                  <p class="product-stock">Stock: {{ product.totalStock }}</p>
                </div>
                <div class="product-price">
                  \${{ (product.sellingPrice || 0).toFixed(2) }}
                  <span *ngIf="product.hasDiscount" class="discount-badge">
                    {{ product.discountType === 'percentage' ? product.discountValue + '%' : '$' + product.discountValue }} OFF
                  </span>
                </div>
              </div>
            </div>

            <!-- Grid View -->
            <div *ngIf="currentView() === 'grid'" class="products-grid">
              <div 
                *ngFor="let product of filteredProducts()"
                (click)="addToCart(product)"
                class="product-grid-item">
                <img 
                  [src]="product.imageUrl || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xNiAxNkMyMC40MTgzIDE2IDI0IDE5LjU4MTcgMjQgMjRDMjQgMjguNDE4MyAyMC40MTgzIDMyIDE2IDMyQzExLjU4MTcgMzIgOCAyOC40MTgzIDggMjRDOCAxOS41ODE3IDExLjU4MTcgMTYgMTYgMTZaIiBmaWxsPSIjRDFENURCIi8+CjxwYXRoIGQ9Ik0yNiAxNkMzMC40MTgzIDE2IDM0IDE5LjU4MTcgMzQgMjRDMzQgMjguNDE4MyAzMC40MTgzIDMyIDI2IDMyQzIxLjU4MTcgMzIgMTggMjguNDE4MyAxOCAyNEMxOCAxOS41ODE3IDIxLjU4MTcgMTYgMjYgMTZaIiBmaWxsPSIjRDFENURCIi8+CjwvZ3ZnPgo='"
                  [alt]="product.productName"
                  class="product-image">
                <div class="product-details">
                  <h4>{{ product.productName }}</h4>
                  <p class="product-description">{{ product.category }}</p>
                  <div class="product-pricing">
                    <span class="price">\${{ (product.sellingPrice || 0).toFixed(2) }}</span>
                    <span *ngIf="product.hasDiscount" class="discount">
                      {{ product.discountType === 'percentage' ? product.discountValue + '% OFF' : '$' + product.discountValue + ' OFF' }}
                    </span>
                  </div>
                  <div class="product-stock">Stock: {{ product.totalStock }}</div>
                </div>
              </div>
            </div>

            <!-- Custom/Promos View -->
            <div *ngIf="currentView() === 'custom'" class="custom-products">
              <div class="custom-section">
                <h4>Promotional Items</h4>
                <div class="products-grid">
                  <div 
                    *ngFor="let product of promoProducts()"
                    (click)="addToCart(product)"
                    class="product-grid-item promo">
                    <div class="promo-badge">PROMO</div>
                    <img 
                      [src]="product.imageUrl || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xNiAxNkMyMC40MTgzIDE2IDI0IDE5LjU4MTcgMjQgMjRDMjQgMjguNDE4MyAyMC40MTgzIDMyIDE2IDMyQzExLjU4MTcgMzIgOCAyOC40MTgzIDggMjRDOCAxOS41ODE3IDExLjU4MTcgMTYgMTYgMTZaIiBmaWxsPSIjRDFENURCIi8+CjxwYXRoIGQ9Ik0yNiAxNkMzMC40MTgzIDE2IDM0IDE5LjU4MTcgMzQgMjRDMzQgMjguNDE4MyAzMC40MTgzIDMyIDI2IDMyQzIxLjU4MTcgMzIgMTggMjguNDE4MyAxOCAyNEMxOCAxOS41ODE3IDIxLjU4MTcgMTYgMjYgMTZaIiBmaWxsPSIjRDFENURCIi8+CjwvZ3ZnPgo='"
                      [alt]="product.productName"
                      class="product-image">
                    <div class="product-details">
                      <h4>{{ product.productName }}</h4>
                      <div class="product-pricing">
                        <span class="price">\${{ product.sellingPrice.toFixed(2) }}</span>
                        <span class="discount">{{ product.discountValue }}% OFF</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Best Sellers View -->
            <div *ngIf="currentView() === 'bestsellers'" class="bestsellers-products">
              <div class="bestsellers-section">
                <h4>Best Selling Items</h4>
                <div class="products-list">
                  <div 
                    *ngFor="let product of bestSellerProducts(); let i = index"
                    (click)="addToCart(product)"
                    class="product-list-item bestseller">
                    <div class="rank-badge">{{ i + 1 }}</div>
                    <img 
                      [src]="product.imageUrl || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xNiAxNkMyMC40MTgzIDE2IDI0IDE5LjU4MTcgMjQgMjRDMjQgMjguNDE4MyAyMC40MTgzIDMyIDE2IDMyQzExLjU4MTcgMzIgOCAyOC40MTgzIDggMjRDOCAxOS41ODE3IDExLjU4MTcgMTYgMTYgMTZaIiBmaWxsPSIjRDFENURCIi8+CjxwYXRoIGQ9Ik0yNiAxNkMzMC40MTgzIDE2IDM0IDE5LjU4MTcgMzQgMjRDMzQgMjguNDE4MyAzMC40MTgzIDMyIDI2IDMyQzIxLjU4MTcgMzIgMTggMjguNDE4MyAxOCAyNEMxOCAxOS41ODE3IDIxLjU4MTcgMTYgMjYgMTZaIiBmaWxsPSIjRDFENURCIi8+CjwvZ3JnPgo='"
                      [alt]="product.productName"
                      class="product-image-small">
                    <div class="product-info">
                      <h4>{{ product.productName }}</h4>
                      <p class="product-sku">{{ product.skuId }}</p>
                    </div>
                    <div class="product-price">\${{ (product.sellingPrice || 0).toFixed(2) }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Orders results use the same display area when Orders tab is active -->
          <div class="products-display" *ngIf="accessTab() === 'Orders'" style="padding:1rem;">
            <div *ngIf="orders().length === 0" class="muted">No orders found</div>
            <div *ngFor="let order of orders()" class="order-row" (dblclick)="openOrder(order)" style="padding:0.5rem; border-bottom:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-weight:600">{{ order.orderNumber || order.id }}</div>
                <div style="font-size:0.85rem; color:#6b7280">{{ order.createdAt?.toDate ? (order.createdAt.toDate() | date:'short') : '' }} — {{ order.customerName || 'Walk-in' }}</div>
              </div>
              <div style="text-align:right">
                <div style="font-weight:700">{{ order.totalAmount | currency }}</div>
                <div style="font-size:0.85rem; color:#6b7280">Status: {{ order.status }}</div>
              </div>
            </div>
          </div>
        </div>

       

        <!-- Order detail modal -->
        <div *ngIf="selectedOrder()" class="modal-backdrop" style="position:fixed; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.4); z-index:40;">
          <div class="modal" style="background:white; padding:1rem; width:520px; border-radius:8px;">
            <h3>Order {{ selectedOrder()?.orderNumber || selectedOrder()?.id }}</h3>
            <div style="display:flex; gap:1rem; margin-bottom:0.5rem;">
              <div style="flex:1">
                <div><strong>Created:</strong> {{ selectedOrder()?.createdAt?.toDate ? (selectedOrder()?.createdAt.toDate() | date:'full') : '' }}</div>
                <div><strong>Store:</strong> {{ selectedOrder()?.storeId || 'Global' }}</div>
                <div><strong>Status:</strong> {{ selectedOrder()?.status }}</div>
              </div>
              <div style="width:160px; text-align:right">
                <div style="font-weight:700; font-size:1.25rem">{{ selectedOrder()?.totalAmount | currency }}</div>
              </div>
            </div>
            <div style="max-height:220px; overflow:auto; border-top:1px solid #eef2f7; padding-top:0.5rem; margin-bottom:0.5rem;">
              <div *ngFor="let it of selectedOrder()?.items" style="display:flex; justify-content:space-between; padding:0.25rem 0;">
                <div>{{ it.name }} x{{ it.quantity }}</div>
                <div>{{ it.price | currency }}</div>
              </div>
            </div>
            <div style="display:flex; gap:0.5rem; justify-content:flex-end;">
              <button class="btn btn-secondary" (click)="closeOrder()">Close</button>
              <button *ngIf="selectedOrder()?.status !== 'Cancelled'" class="btn" style="background:#f97316; color:white;" (click)="updateOrderStatus(selectedOrder()?.id, 'Cancelled')">Cancel</button>
              <button *ngIf="selectedOrder()?.status !== 'Refunded'" class="btn btn-primary" (click)="updateOrderStatus(selectedOrder()?.id, 'Refunded')">Refund</button>
            </div>
          </div>
        </div>

        <!-- Right Panel: Receipt/Cart -->
        <div class="right-panel">
          <div class="receipt-panel">
            <!-- Receipt Header -->
            <div class="receipt-header">
              <div class="company-info">
                <h2>{{ currentStoreInfo()?.storeName || 'Store Name' }}</h2>
                <p>{{ currentStoreInfo()?.storeName || 'Store Name' }}</p>
                <p>{{ currentStoreInfo()?.address || 'Store Address' }}</p>
                <p>{{ currentStoreInfo()?.phoneNumber || 'Contact Number' }}</p>
                <p>{{ currentStoreInfo()?.email || 'Email Address' }}</p>
                <p class="receipt-date">{{ currentDate | date:'medium' }}</p>
              </div>
            </div>

            <!-- Cart Items -->
            <div class="cart-items">
              <div class="cart-header">
                <span>Item</span>
                <span>Qty</span>
                <span>Price</span>
                <span>Total</span>
              </div>
              
              <div *ngIf="cartItems().length === 0" class="empty-cart">
                <p>No items in cart</p>
              </div>

              <div 
                *ngFor="let item of cartItems()" 
                class="cart-item">
                <div class="item-details">
                  <span class="item-name">{{ item.productName }}</span>
                  <span class="item-sku">{{ item.skuId }}</span>
                </div>
                <div class="quantity-controls">
                  <button (click)="updateQuantity(item.productId, item.quantity - 1)" class="qty-btn">-</button>
                  <span class="quantity">{{ item.quantity }}</span>
                  <button (click)="updateQuantity(item.productId, item.quantity + 1)" class="qty-btn">+</button>
                </div>
                <div class="item-price">\${{ item.sellingPrice.toFixed(2) }}</div>
                <div class="item-total">
                  \${{ item.total.toFixed(2) }}
                  <button (click)="removeFromCart(item.productId)" class="remove-btn">×</button>
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

            <!-- Receipt Summary -->
            <div class="receipt-summary">
              <div class="summary-line">
                <span>VAT Deduction:</span>
                <span>\${{ cartSummary().vatAmount.toFixed(2) }}</span>
              </div>
              <div class="summary-line">
                <span>VAT Exempt Amount:</span>
                <span>\${{ cartSummary().vatExemptAmount.toFixed(2) }}</span>
              </div>
              <div class="summary-line">
                <span>Discount:</span>
                <span>\${{ cartSummary().discountAmount.toFixed(2) }}</span>
              </div>
              <div class="summary-line gross">
                <span>Gross Amount:</span>
                <span>\${{ cartSummary().grossAmount.toFixed(2) }}</span>
              </div>
              <div class="summary-line total">
                <span>Net Amount:</span>
                <span>\${{ cartSummary().netAmount.toFixed(2) }}</span>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="action-buttons">
              <button 
                (click)="clearCart()" 
                [disabled]="cartItems().length === 0"
                class="btn btn-secondary">
                Clear Cart
              </button>
              <button 
                (click)="processOrder()" 
                [disabled]="cartItems().length === 0 || isProcessing()"
                class="btn btn-primary">
                {{ isProcessing() ? 'Processing...' : 'Complete Order' }}
              </button>
            </div>

            <!-- Receipt Footer -->
            <div class="receipt-footer">
              <p>Thank you! See you again!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .pos-container {
      /* account for fixed header height (80px) so the POS content sits below it */
      margin-top: 80px;
      height: calc(100vh - 80px);
      display: flex;
      flex-direction: column;
      background: #f8fafc;
    }

    .store-tabs {
      background: white;
      border-bottom: 1px solid #e2e8f0;
      padding: 1rem 2rem;
    }

    .tabs-header {
      display: flex;
      gap: 0.5rem;
    }

    .store-tab {
      padding: 0.75rem 1.5rem;
      border: 1px solid #d1d5db;
      background: white;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .store-tab.active {
      background: #3b82f6;
      color: white;
      border-color: #3b82f6;
    }

    .pos-layout {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    /* small horizontal padding so content doesn't start too far from left on responsive widths */
    @media (max-width: 1250px) {
      .pos-container {
        padding-left: 12px;
        padding-right: 12px;
      }
      .pos-layout {
        padding-left: 0;
        padding-right: 0;
      }
    }

    .left-panel {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: white;
      border-right: 1px solid #e2e8f0;
    }

    .categories-panel {
      padding: 1rem;
      border-bottom: 1px solid #e2e8f0;
      max-height: 200px;
      overflow-y: auto;
    }

    .categories-panel h3 {
      margin: 0 0 1rem 0;
      font-size: 1.125rem;
      font-weight: 600;
      color: #1f2937;
    }

    .category-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .category-btn {
      padding: 0.5rem 1rem;
      border: 1px solid #d1d5db;
      background: white;
      border-radius: 20px;
      cursor: pointer;
      font-size: 0.875rem;
      transition: all 0.2s;
    }

    .category-btn:hover,
    .category-btn.active {
      background: #3b82f6;
      color: white;
      border-color: #3b82f6;
    }

    .search-section {
      padding: 1rem;
      border-bottom: 1px solid #e2e8f0;
    }

    .search-bar {
      position: relative;
      display: flex;
      align-items: center;
    }

    .search-icon {
      position: absolute;
      left: 1rem;
      width: 1.25rem;
      height: 1.25rem;
      color: #6b7280;
      z-index: 1;
    }

    .search-input {
      width: 100%;
      padding: 0.75rem 1rem 0.75rem 3rem;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 0.875rem;
      background: white;
    }

    .search-input:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .clear-btn {
      position: absolute;
      right: 1rem;
      background: none;
      border: none;
      font-size: 1.25rem;
      color: #6b7280;
      cursor: pointer;
    }

    .product-tabs {
      display: flex;
      border-bottom: 1px solid #e2e8f0;
    }

    /* Access tabs (horizontal row above search) */
    .access-tabs {
      padding: 0.5rem 0;
      margin-bottom: 0.5rem;
    }

    .access-tab-list {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      overflow-x: auto;
      padding: 0.25rem 0.25rem;
      -webkit-overflow-scrolling: touch;
      white-space: nowrap;
    }

    .tab-btn.small {
      padding: 0.5rem 0.75rem;
      font-size: 0.875rem;
      min-width: auto;
      border: 1px solid transparent;
      background: #ffffff;
      border-radius: 9999px;
      cursor: pointer;
    }

    .tab-btn.small.active,
    .tab-btn.small:hover {
      background: #3b82f6;
      color: white;
      border-color: #3b82f6;
    }

    .tab-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 1rem;
      border: none;
      background: white;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 500;
      color: #6b7280;
      transition: all 0.2s;
    }

    .tab-btn svg {
      width: 1.25rem;
      height: 1.25rem;
    }

    .tab-btn:hover,
    .tab-btn.active {
      color: #3b82f6;
      background: #f8fafc;
    }

    /* Reuse Access component's square tab header styles for consistency */
    .tab-header {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 0.75rem 1rem;
      cursor: pointer;
      transition: all 0.2s;
      min-width: 120px;
      text-align: left;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }

    .tab-header:hover {
      border-color: #667eea;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .tab-header.active {
      border-color: #667eea;
      background: #667eea;
      color: white;
    }

    .tab-content {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .tab-label {
      font-weight: 600;
      font-size: 0.95rem;
    }

    .products-display {
      flex: 1;
      overflow-y: auto;
      padding: 1rem;
    }

    .products-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .product-list-item {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      background: white;
    }

    .product-list-item:hover {
      border-color: #3b82f6;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .product-list-item.bestseller {
      position: relative;
    }

    .rank-badge {
      position: absolute;
      top: -8px;
      left: -8px;
      background: #f59e0b;
      color: white;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: bold;
    }

    .product-image-small {
      width: 60px;
      height: 60px;
      object-fit: cover;
      border-radius: 6px;
      background: #f3f4f6;
    }

    .product-info {
      flex: 1;
    }

    .product-info h4 {
      margin: 0 0 0.25rem 0;
      font-size: 1rem;
      font-weight: 600;
      color: #1f2937;
    }

    .product-sku,
    .product-stock {
      margin: 0;
      font-size: 0.75rem;
      color: #6b7280;
    }

    .product-price {
      text-align: right;
      font-weight: 600;
      color: #1f2937;
    }

    .discount-badge {
      display: block;
      font-size: 0.75rem;
      color: #dc2626;
      font-weight: 500;
      margin-top: 0.25rem;
    }

    .products-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 1rem;
    }

    .product-grid-item {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 1rem;
      cursor: pointer;
      transition: all 0.2s;
      background: white;
      position: relative;
    }

    .product-grid-item:hover {
      border-color: #3b82f6;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }

    .product-grid-item.promo {
      border-color: #f59e0b;
    }

    .promo-badge {
      position: absolute;
      top: -8px;
      right: -8px;
      background: #f59e0b;
      color: white;
      padding: 0.25rem 0.5rem;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: bold;
    }

    .product-image {
      width: 100%;
      height: 120px;
      object-fit: cover;
      border-radius: 6px;
      background: #f3f4f6;
      margin-bottom: 1rem;
    }

    .product-details h4 {
      margin: 0 0 0.5rem 0;
      font-size: 1rem;
      font-weight: 600;
      color: #1f2937;
    }

    .product-description {
      margin: 0 0 0.5rem 0;
      font-size: 0.875rem;
      color: #6b7280;
    }

    .product-pricing {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }

    .price {
      font-weight: 600;
      color: #1f2937;
    }

    .discount {
      font-size: 0.75rem;
      color: #dc2626;
      font-weight: 500;
    }

    .right-panel {
      width: 400px;
      background: white;
      border-left: 1px solid #e2e8f0;
    }

    .receipt-panel {
      height: 100%;
      display: flex;
      flex-direction: column;
      /* add ~10px more internal padding for breathing room */
      padding: calc(1rem + 0.1px);
      min-height: 0; /* allow flex children to shrink so footer stays visible */
    }

    .receipt-header {
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 1rem;
      margin-bottom: 1rem;
    }

    .company-info h2 {
      margin: 0 0 0.5rem 0;
      font-size: 1.25rem;
      font-weight: 700;
      color: #1f2937;
    }

    .company-info p {
      margin: 0.25rem 0;
      font-size: 0.875rem;
      color: #6b7280;
    }

    .receipt-date {
      margin-top: 0.5rem !important;
      font-weight: 500 !important;
      color: #374151 !important;
    }

    .cart-items {
      flex: 1 1 auto;
      overflow-y: auto;
      min-height: 0; /* allow the cart to shrink inside the receipt panel */
      /* keep a reasonable max so the footer (summary/actions) remains visible */
      max-height: calc(100% - 200px);
    }

    .cart-header {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1fr;
      gap: 0.5rem;
      padding: 0.5rem;
      font-size: 0.75rem;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      border-bottom: 1px solid #e2e8f0;
      margin-bottom: 0.5rem;
    }

    .empty-cart {
      text-align: center;
      padding: 2rem;
      color: #6b7280;
    }

    .cart-item {
      border-bottom: 1px solid #f3f4f6;
      padding: 0.75rem;
      margin-bottom: 0.5rem;
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1fr;
      gap: 0.75rem;
      align-items: center;
      min-height: 64px; /* give each cart row more vertical space */
    }

    .cart-item:last-child {
      border-bottom: none;
    }

    .item-details {
      display: flex !important;
      flex-direction: column !important;
      align-items: flex-start !important;
    }

    .item-name {
      font-weight: 500;
      color: #1f2937;
      font-size: 0.875rem;
    }

    .item-sku {
      font-size: 0.75rem;
      color: #6b7280;
    }

    .quantity-controls {
      display: flex !important;
      align-items: center;
     
    }

    .qty-btn {
      width: 24px;
      height: 24px;
      border: 1px solid #d1d5db;
      background: white;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.875rem;
    }

    .qty-btn:hover {
      background: #f3f4f6;
    }

    .quantity {
      font-weight: 500;
      min-width: 20px;
      text-align: center;
    }

    .item-price,
    .item-total {
      font-weight: 500;
      color: #1f2937;
      text-align: right;
    }

    .item-total {
      display: flex !important;
      align-items: center;
      justify-content: space-between;
    }

    .remove-btn {
      background: #ef4444;
      color: white;
      border: none;
      border-radius: 50%;
      width: 22px;
      height: 22px;
      cursor: pointer;
      font-size: 0.75rem;
      margin-left: 0.5rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .item-controls {
      grid-column: 1 / -1; /* span all grid columns */
      padding-top: 0.5rem;
    }

    .vat-exempt-toggle {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.75rem;
      color: #6b7280;
      cursor: pointer;
    }

    .receipt-summary {
      border-top: 1px solid #e2e8f0;
      padding-top: 1rem;
      margin-top: 1rem;
    }

    .summary-line {
      display: flex;
      justify-content: space-between;
      padding: 0.25rem 0;
      font-size: 0.875rem;
    }

    .summary-line.gross {
      border-top: 1px solid #e2e8f0;
      padding-top: 0.5rem;
      margin-top: 0.5rem;
      font-weight: 600;
    }

    .summary-line.total {
      border-top: 2px solid #1f2937;
      padding-top: 0.5rem;
      margin-top: 0.5rem;
      font-weight: 700;
      font-size: 1.125rem;
      color: #1f2937;
    }

    .action-buttons {
      display: flex;
      gap: 0.5rem;
      margin-top: 1rem;
    }

    .btn {
      flex: 1;
      padding: 0.75rem 1rem;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-secondary {
      background: #f3f4f6;
      color: #374151;
      border: 1px solid #d1d5db;
    }

    .btn-secondary:hover:not(:disabled) {
      background: #e5e7eb;
    }

    .btn-primary {
      background: #3b82f6;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #2563eb;
    }

    .receipt-footer {
      border-top: 1px solid #e2e8f0;
      padding-top: 1rem;
      margin-top: 1rem;
      text-align: center;
    }

    .receipt-footer p {
      margin: 0;
      font-size: 0.875rem;
      color: #6b7280;
      font-style: italic;
    }

    @media (max-width: 1024px) {
      .right-panel {
        width: 350px;
      }
      
      .products-grid {
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      }
      /* Slightly move down the receipt panel on tablet for better spacing */
      .receipt-panel {
        margin-top: 8px;
        padding: calc(1rem + 8px);
      }
    }

    @media (max-width: 768px) {
      .pos-layout {
        flex-direction: column;
      }

      .left-panel {
        height: auto;
      }

      /* Make the receipt full-width and place it after the products on mobile */
      .right-panel {
        width: 100%;
        height: auto;
        order: 2; /* place receipt after products */
        border-left: none;
        border-top: 1px solid #e2e8f0;
        margin-top: 12px;
      }

      .categories-panel {
        max-height: 120px;
      }

      .product-tabs {
        font-size: 0.75rem;
      }

      .tab-btn {
        padding: 0.75rem 0.5rem;
      }

      /* Allow the receipt to show fully on mobile: remove cart max-height and show full content */
      .cart-items {
        max-height: none !important;
        overflow: visible !important;
      }
      .receipt-summary,
      .action-buttons {
        position: static !important;
      }
    }
  `]
})
export class PosComponent implements OnInit {
  // Services
  private productService = inject(ProductService);
  private posService = inject(PosService);
  private authService = inject(AuthService);
  private companyService = inject(CompanyService);
  private storeService = inject(StoreService);
  private orderService = inject(OrderService);
  private userRoleService = inject(UserRoleService);

  // Signals
  private searchQuerySignal = signal<string>('');
  private selectedCategorySignal = signal<string>('all');
  private currentViewSignal = signal<ProductViewType>('grid');

  // Computed properties
  readonly searchQuery = computed(() => this.searchQuerySignal());
  readonly selectedCategory = computed(() => this.selectedCategorySignal());
  readonly currentView = computed(() => this.currentViewSignal());
  
  // Show stores loaded from user roles (already filtered by role-based access)
  readonly availableStores = computed(() => {
    const stores = this.storeService.getStores();
    console.log('🏪 availableStores computed - Stores from userRoles:', stores.length, 'stores');
    
    if (stores.length === 0) {
      console.warn('⚠️ No stores available from role-based loading');
    } else {
      console.log('🏪 Store details:', stores.map(s => ({ id: s.id, name: s.storeName, companyId: s.companyId })));
    }
    
    return stores;
  });
  readonly selectedStoreId = computed(() => this.posService.selectedStoreId());
  readonly cartItems = computed(() => this.posService.cartItems());
  readonly cartSummary = computed(() => this.posService.cartSummary());
  readonly isProcessing = computed(() => this.posService.isProcessing());
  
  readonly products = computed(() => this.productService.getProducts());
  readonly categories = computed(() => this.productService.getCategories());
  
  readonly currentStoreInfo = computed(() => 
    this.availableStores().find(s => s.id === this.selectedStoreId())
  );

  readonly filteredProducts = computed(() => {
    let filtered = this.products();

    // Filter by store only (no company filtering needed since products are already loaded by store)
    const storeId = this.selectedStoreId();
    if (storeId) {
      filtered = filtered.filter(p => p.storeId === storeId);
    }

    // Determine active store ids: if a store is selected use that, otherwise use visible stores
    const activeStoreIds = storeId ? [storeId] : this.availableStores().map(s => s.id).filter(Boolean) as string[];
    if (activeStoreIds && activeStoreIds.length) {
      // Include products that belong to the active stores OR have no storeId (global products)
      filtered = filtered.filter(p => !p.storeId || activeStoreIds.includes(p.storeId));
    }

    // Filter by category
    const category = this.selectedCategory();
    if (category !== 'all') {
      filtered = filtered.filter(p => p.category === category);
    }

    // Filter by search query
    const query = this.searchQuery().toLowerCase();
    if (query) {
      filtered = filtered.filter(p =>
        p.productName.toLowerCase().includes(query) ||
        p.skuId.toLowerCase().includes(query) ||
        p.barcodeId?.toLowerCase().includes(query) ||
        p.qrCode?.toLowerCase().includes(query)
      );
    }

    // Sort by newest (createdAt) if present, otherwise keep original
    try {
      filtered = filtered.slice().sort((a, b) => (b.createdAt?.getTime ? b.createdAt.getTime() : 0) - (a.createdAt?.getTime ? a.createdAt.getTime() : 0));
    } catch (e) {
      // ignore sort errors and continue
    }

    // Limit to top 20 when in list or grid view
    const view = this.currentView();
    if (view === 'list' || view === 'grid') {
      return filtered.slice(0, 20);
    }
    return filtered;
  });

  readonly promoProducts = computed(() =>
    this.filteredProducts().filter(p => p.hasDiscount)
  );

  readonly bestSellerProducts = computed(() =>
    this.filteredProducts().slice(0, 10) // TODO: Implement actual best seller logic
  );

  // Template properties
  currentDate = new Date();
  // Access tabs for POS management
  readonly accessTabs = ['New', 'Orders', 'Cancelled', 'Refunds & Returns', 'Split Payments', 'Discounts & Promotions'] as const;
  private accessTabSignal = signal<string>('New');
  readonly accessTab = computed(() => this.accessTabSignal());

  // Order search (used when viewing Orders tab)
  private orderSearchSignal = signal<string>('');
  readonly orderSearchQuery = computed(() => this.orderSearchSignal());

  // Orders state
  private ordersSignal = signal<any[]>([]);
  readonly orders = computed(() => this.ordersSignal());

  // Order detail modal
  private selectedOrderSignal = signal<any | null>(null);
  readonly selectedOrder = computed(() => this.selectedOrderSignal());

  setAccessTab(tab: string): void {
    this.accessTabSignal.set(tab);
  }

  setOrderSearchQuery(value: string): void {
    this.orderSearchSignal.set(value);
  }

  async searchOrders(): Promise<void> {
    try {
      const storeInfo = this.currentStoreInfo();
      const companyId = storeInfo?.companyId;
      const storeId = this.selectedStoreId();
      const q = this.orderSearchQuery().trim();
      if (!companyId || !q) return;
      const results = await this.orderService.searchOrders(companyId, storeId || undefined, q);
      this.ordersSignal.set(results);
    } catch (error) {
      console.error('Error searching orders:', error);
      this.ordersSignal.set([]);
    }
  }

  openOrder(order: any): void {
    this.selectedOrderSignal.set(order);
  }

  closeOrder(): void {
    this.selectedOrderSignal.set(null);
  }

  async updateOrderStatus(orderId: string, status: string): Promise<void> {
    try {
      await this.orderService.updateOrderStatus(orderId, status);
      // refresh
      await this.searchOrders();
      this.closeOrder();
    } catch (e) {
      console.error('Failed to update order status', e);
    }
  }

  async ngOnInit(): Promise<void> {
    try {
  this.initializeStore();
  await this.loadData();
  // debug: log current user and stores to ensure user.storeIds and stores list are correct
  console.log('POS init - currentUser:', this.authService.getCurrentUser());
  console.log('POS init - all stores:', this.storeService.getStores());
  console.log('POS init - availableStores:', this.availableStores());
  
   
    } catch (error) {
      console.error('Error initializing POS:', error);
    }
  }

  private async loadData(): Promise<void> {
    // Load user roles to get store access permissions
    const user = this.authService.getCurrentUser();
    if (user?.uid) {
      // Load user roles first
      await this.userRoleService.loadUserRoles();
      
      // Get the current user's role by userId
      const userRole = this.userRoleService.getUserRoleByUserId(user.uid);
      
      // Debug logging as requested
      console.log('userRoles in pos:', userRole);
      console.log('user.uid:', user.uid);
      
      if (userRole && userRole.storeId) {
        // Load companies and stores based on user's assigned store
        await this.storeService.loadStores([userRole.storeId]);
        
        // Initialize selected store now that stores are loaded
        this.initializeStore();
        
        // Load products for the user's company and selected store
        await this.productService.loadProductsByCompanyAndStore(userRole.companyId, this.selectedStoreId());
      } else {
        console.warn('No user role found or no store assigned to user');
      }
    } 
  }

  private initializeStore(): void {
    const stores = this.availableStores();
    if (stores.length > 0 && !this.selectedStoreId()) {
      this.selectStore(stores[0].id!);
      
    }
  }

  // Event handlers
  async selectStore(storeId: string): Promise<void> {
    this.posService.setSelectedStore(storeId);
    const storeInfo = this.availableStores().find(s => s.id === storeId);
    if (storeInfo?.companyId) {
      await this.productService.loadProductsByCompanyAndStore(storeInfo.companyId, storeId);
    }
  }

  setSelectedCategory(category: string): void {
    this.selectedCategorySignal.set(category);
  }

  setCurrentView(view: ProductViewType): void {
    this.currentViewSignal.set(view);
  }

  onSearch(): void {
    // If Orders tab is active, trigger order search using the main search input
    if (this.accessTab() === 'Orders') {
      const q = this.searchQuery().trim();
      this.setOrderSearchQuery(q);
      // call searchOrders when user types (debounce could be added later)
      void this.searchOrders();
      return;
    }

    // Otherwise, product search is reactive through the signal
  }

  // Public setter used by the template's ngModelChange
  setSearchQuery(value: string): void {
    this.searchQuerySignal.set(value);
  }

  clearSearch(): void {
    this.searchQuerySignal.set('');
  }

  addToCart(product: Product): void {
    if (product.totalStock <= 0) {
      alert('Product is out of stock');
      return;
    }
    this.posService.addToCart(product);
  }

  removeFromCart(productId: string): void {
    this.posService.removeFromCart(productId);
  }

  updateQuantity(productId: string, quantity: number): void {
    this.posService.updateCartItemQuantity(productId, quantity);
  }

  toggleVatExemption(productId: string): void {
    this.posService.toggleVatExemption(productId);
  }

  clearCart(): void {
    if (confirm('Are you sure you want to clear the cart?')) {
      this.posService.clearCart();
    }
  }

  async processOrder(): Promise<void> {
    try {
      const orderId = await this.posService.processOrder();
      if (orderId) {
        alert(`Order completed successfully! Order ID: ${orderId}`);
        // TODO: Print receipt or show receipt modal
      }
    } catch (error) {
      console.error('Error processing order:', error);
      alert('Failed to process order. Please try again.');
    }
  }
}
