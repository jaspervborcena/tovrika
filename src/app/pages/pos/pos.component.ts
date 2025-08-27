import { Component, OnInit, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../services/product.service';
import { PosService } from '../../services/pos.service';
import { AuthService } from '../../services/auth.service';
import { CompanyService } from '../../services/company.service';
import { StoreService } from '../../services/store.service';
import { Product } from '../../interfaces/product.interface';
import { CartItem, ProductViewType, ReceiptData } from '../../interfaces/pos.interface';
import { Store } from '../../interfaces/store.interface';

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="pos-container">
      <!-- Store Tabs (if multiple stores) -->
      <div class="store-tabs" *ngIf="availableStores().length > 1">
        <div class="tabs-header">
          <button 
            *ngFor="let store of availableStores()"
            [class.active]="selectedStoreId() === store.id"
            (click)="selectStore(store.id!)"
            class="store-tab">
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
          <div class="search-section">
            <div class="search-bar">
              <svg class="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
              <input 
                type="text"
                [(ngModel)]="searchQuery"
                (input)="onSearch()"
                placeholder="Search by barcode, QR code, SKU, or name..."
                class="search-input">
              <button *ngIf="searchQuery" (click)="clearSearch()" class="clear-btn">×</button>
            </div>
          </div>

          <!-- Product View Tabs -->
          <div class="product-tabs">
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

          <!-- Products Display -->
          <div class="products-display">
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
                  \${{ product.sellingPrice.toFixed(2) }}
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
                    <span class="price">\${{ product.sellingPrice.toFixed(2) }}</span>
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
                    <div class="product-price">\${{ product.sellingPrice.toFixed(2) }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Panel: Receipt/Cart -->
        <div class="right-panel">
          <div class="receipt-panel">
            <!-- Receipt Header -->
            <div class="receipt-header">
              <div class="company-info">
                <h2>{{ (companyInfo()?.name) || 'Company Name' }}</h2>
                <p>{{ currentStoreInfo()?.storeName || 'Store Name' }}</p>
                <p>{{ currentStoreInfo()?.address || 'Store Address' }}</p>
                <p>{{ (companyInfo()?.phone) || 'Contact Number' }}</p>
                <p>{{ (companyInfo()?.email) || 'Email Address' }}</p>
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
      height: 100vh;
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
      padding: 1rem;
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
      flex: 1;
      overflow-y: auto;
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
      padding: 0.5rem;
      margin-bottom: 0.5rem;
    }

    .cart-item:last-child {
      border-bottom: none;
    }

    .cart-item > div {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1fr;
      gap: 0.5rem;
      align-items: center;
      margin-bottom: 0.5rem;
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
      gap: 0.5rem;
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
      width: 20px;
      height: 20px;
      cursor: pointer;
      font-size: 0.75rem;
    }

    .item-controls {
      grid-column: span 4;
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
    }

    @media (max-width: 768px) {
      .pos-layout {
        flex-direction: column;
      }
      
      .left-panel {
        height: 60%;
      }
      
      .right-panel {
        width: 100%;
        height: 40%;
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

  // Signals
  private searchQuerySignal = signal<string>('');
  private selectedCategorySignal = signal<string>('all');
  private currentViewSignal = signal<ProductViewType>('grid');

  // Computed properties
  readonly searchQuery = computed(() => this.searchQuerySignal());
  readonly selectedCategory = computed(() => this.selectedCategorySignal());
  readonly currentView = computed(() => this.currentViewSignal());
  
  readonly availableStores = computed(() => this.storeService.getStores());
  readonly selectedStoreId = computed(() => this.posService.selectedStoreId());
  readonly cartItems = computed(() => this.posService.cartItems());
  readonly cartSummary = computed(() => this.posService.cartSummary());
  readonly isProcessing = computed(() => this.posService.isProcessing());
  
  readonly products = computed(() => this.productService.getProducts());
  readonly categories = computed(() => this.productService.getCategories());
  
  readonly companyInfo = computed(() => {
    const companies = this.companyService.companies();
    return companies.length > 0 ? companies[0] : null;
  });
  readonly currentStoreInfo = computed(() => 
    this.availableStores().find(s => s.id === this.selectedStoreId())
  );

  readonly filteredProducts = computed(() => {
    let filtered = this.products();
    
    // Filter by store
    const storeId = this.selectedStoreId();
    if (storeId) {
      filtered = filtered.filter(p => p.storeId === storeId);
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

  async ngOnInit(): Promise<void> {
    try {
      await this.loadData();
      this.initializeStore();
    } catch (error) {
      console.error('Error initializing POS:', error);
    }
  }

  private async loadData(): Promise<void> {
    await Promise.all([
      this.companyService.loadCompanies(),
      this.storeService.loadStores(),
      this.productService.loadProducts()
    ]);
  }

  private initializeStore(): void {
    const stores = this.availableStores();
    if (stores.length > 0 && !this.selectedStoreId()) {
      this.selectStore(stores[0].id!);
    }
  }

  // Event handlers
  selectStore(storeId: string): void {
    this.posService.setSelectedStore(storeId);
  }

  setSelectedCategory(category: string): void {
    this.selectedCategorySignal.set(category);
  }

  setCurrentView(view: ProductViewType): void {
    this.currentViewSignal.set(view);
  }

  onSearch(): void {
    // Search is reactive through the signal
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
