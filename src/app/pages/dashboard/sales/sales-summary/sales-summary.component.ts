import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderService } from '../../../../services/order.service';
import { AuthService } from '../../../../services/auth.service';
import { StoreService, Store } from '../../../../services/store.service';
import { Order as PosOrder, OrderItem } from '../../../../interfaces/pos.interface';

// Extended interface for display purposes
interface OrderDisplay extends PosOrder {
  customerName?: string;
  items?: OrderItem[];
  paymentMethod?: string;
}

type Order = OrderDisplay;

@Component({
  selector: 'app-sales-summary',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="sales-summary-container">
      <!-- Header -->
      <div class="header">
        <div class="header-content">
          <h1 class="page-title">Sales Summary</h1>
          <p class="page-subtitle">View and analyze your sales performance</p>
        </div>
      </div>

      <!-- Controls Section -->
      <div class="sales-controls">
        <div class="date-picker-section">
          
          <!-- Store Selection -->
          <div class="store-selection" *ngIf="stores().length > 0">
            <div *ngIf="hasMultipleStores(); else singleStore" class="store-selector">
              <label for="storeSelect">Store:</label>
              <select 
                id="storeSelect"
                [(ngModel)]="selectedStoreId"
                (change)="onStoreChange()"
                class="store-select">
                <option *ngFor="let store of stores()" [value]="store.id">
                  {{ store.storeName.toUpperCase() }}
                </option>
              </select>
            </div>
            <ng-template #singleStore>
              <div class="single-store">
                <label>Store:</label>
                <span class="store-name">{{ stores()[0].storeName.toUpperCase() }}</span>
              </div>
            </ng-template>
          </div>
          
          <div class="date-inputs">
            <div class="date-input-group">
              <label for="fromDate">From:</label>
              <input 
                type="date" 
                id="fromDate"
                [(ngModel)]="fromDate"
                class="date-input">
            </div>
            <div class="date-input-group">
              <label for="toDate">To:</label>
              <input 
                type="date" 
                id="toDate"
                [(ngModel)]="toDate"
                class="date-input">
            </div>
            <div class="go-button-group">
              <button 
                (click)="loadSalesDataManual()"
                [disabled]="isLoading()"
                class="go-button">
                <span *ngIf="!isLoading()">{{ getDataSourceButtonText() }}</span>
                <span *ngIf="isLoading()" class="loading-text">Loading...</span>
              </button>
            </div>
          </div>
        </div>
        
        <div class="totals-section">
          <div class="total-card">
            <div class="total-label">Total Sales</div>
            <div class="total-amount">₱{{ totalSales().toLocaleString('en-US', {minimumFractionDigits: 2}) }}</div>
          </div>
          <div class="total-card">
            <div class="total-label">Total Orders</div>
            <div class="total-count">{{ totalOrders() }}</div>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div *ngIf="isLoading()" class="loading-state">
        <div class="spinner"></div>
        <p>Loading sales data...</p>
        <p *ngIf="dataSource()" class="data-source-info">
          Source: {{ dataSource() === 'api' ? 'External API (Older Data)' : 'Firebase (Recent Data)' }}
        </p>
      </div>

      <!-- Sales Table -->
      <div *ngIf="!isLoading()" class="sales-table-container">
        <div class="table-header">
          <h3>Sales Details</h3>
          <div class="table-info">
            Showing {{ paginatedOrders().length }} of {{ totalOrders() }} orders
          </div>
        </div>
        
        <div class="table-wrapper">
          <table class="sales-table">
            <thead>
              <tr>
                <th>Invoice Number</th>
                <th>Date & Time</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total Amount</th>
                <th>Payment Method</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr 
                *ngFor="let order of paginatedOrders(); trackBy: trackByOrderId"
                class="order-row">
                <td class="invoice-number">{{ order.invoiceNumber || 'N/A' }}</td>
                <td class="order-date">
                  <div class="date">{{ formatDate(order.createdAt) }}</div>
                  <div class="time">{{ formatTime(order.createdAt) }}</div>
                </td>
                <td class="customer">{{ order.customerName || 'Walk-in Customer' }}</td>
                <td class="items-count">{{ order.items?.length || 0 }} items</td>
                <td class="amount">₱{{ order.totalAmount.toLocaleString('en-US', {minimumFractionDigits: 2}) }}</td>
                <td class="payment-method">
                  <span class="payment-badge" [class]="'payment-' + (order.paymentMethod || 'cash').toLowerCase()">
                    {{ order.paymentMethod || 'Cash' }}
                  </span>
                </td>
                <td class="status">
                  <span class="status-badge" [class]="'status-' + order.status.toLowerCase()">
                    {{ order.status }}
                  </span>
                </td>
                <td class="action">
                  <button 
                    (click)="openOrderDetails(order)"
                    class="view-details-btn">
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                    </svg>
                    View Details
                  </button>
                </td>
              </tr>
              
              <!-- Empty State -->
              <tr *ngIf="paginatedOrders().length === 0" class="empty-state">
                <td colspan="8">
                  <div class="empty-message">
                    <div class="empty-icon">📊</div>
                    <p>No sales found for the selected date range</p>
                    <button (click)="refreshData()" class="refresh-btn">
                      <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M4 12a8 8 0 0 1 8-8V2.5L16 6l-4 3.5V8a6 6 0 1 0 6 6h1.5A7.5 7.5 0 1 1 4 12Z"/>
                      </svg>
                      Refresh Data
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <!-- Pagination Controls -->
        <div *ngIf="totalFilteredOrders() > itemsPerPage()" class="pagination-container">
          <div class="pagination-info">
            Page {{ currentPage() }} of {{ totalPages() }} 
            ({{ ((currentPage() - 1) * itemsPerPage()) + 1 }}-{{ min(currentPage() * itemsPerPage(), totalFilteredOrders()) }} of {{ totalFilteredOrders() }} items)
          </div>
          
          <div class="pagination-controls">
            <button 
              (click)="goToFirstPage()" 
              [disabled]="currentPage() === 1"
              class="pagination-btn"
              title="First page">
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.41 7.41L17 6l-6 6 6 6 1.41-1.41L13.83 12l4.58-4.59zM6 6h2v12H6V6z"/>
              </svg>
            </button>
            
            <button 
              (click)="goToPreviousPage()" 
              [disabled]="currentPage() === 1"
              class="pagination-btn"
              title="Previous page">
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12l4.58-4.59z"/>
              </svg>
            </button>
            
            <div class="page-numbers">
              <button 
                *ngFor="let page of getPageNumbers()"
                (click)="goToPage(page)"
                [class.active]="page === currentPage()"
                class="page-number-btn">
                {{ page }}
              </button>
            </div>
            
            <button 
              (click)="goToNextPage()" 
              [disabled]="currentPage() === totalPages()"
              class="pagination-btn"
              title="Next page">
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12l-4.58 4.59z"/>
              </svg>
            </button>
            
            <button 
              (click)="goToLastPage()" 
              [disabled]="currentPage() === totalPages()"
              class="pagination-btn"
              title="Last page">
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                <path d="M5.59 7.41L7 6l6 6-6 6-1.41-1.41L10.17 12 5.59 7.41zM16 6h2v12h-2V6z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Order Details Modal -->
    <div *ngIf="showOrderDetails()" class="modal-overlay" (click)="closeOrderDetails()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>Order Details - #{{ selectedOrder()?.id }}</h3>
          <button class="close-btn" (click)="closeOrderDetails()">×</button>
        </div>
        <div class="modal-body">
          <div *ngIf="selectedOrder()" class="order-details">
            <div class="order-info">
              <p><strong>Date:</strong> {{ formatDate(selectedOrder()!.createdAt) }} at {{ formatTime(selectedOrder()!.createdAt) }}</p>
              <p><strong>Customer:</strong> {{ selectedOrder()!.customerName || 'Walk-in Customer' }}</p>
              <p><strong>Payment Method:</strong> {{ selectedOrder()!.paymentMethod || 'Cash' }}</p>
              <p><strong>Status:</strong> {{ selectedOrder()!.status }}</p>
            </div>
            
            <div class="order-items">
              <h4>Items Ordered:</h4>
              <div *ngFor="let item of selectedOrder()!.items || []" class="order-item">
                <span class="item-name">{{ item.productName }}</span>
                <span class="item-quantity">Qty: {{ item.quantity }}</span>
                <span class="item-price">₱{{ (item.price * item.quantity).toLocaleString('en-US', {minimumFractionDigits: 2}) }}</span>
              </div>
            </div>
            
            <div class="order-total">
              <strong>Total: ₱{{ selectedOrder()!.totalAmount.toLocaleString('en-US', {minimumFractionDigits: 2}) }}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .sales-summary-container {
      background: #f8fafc;
      min-height: 100vh;
    }

    /* Header Styles */
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 2rem 0;
      margin-bottom: 2rem;
    }

    .header-content {
      max-width: 1400px;
      margin: 0 auto;
      padding: 0 2rem;
    }

    .page-title {
      font-size: 2.5rem;
      font-weight: 700;
      margin: 0 0 0.5rem 0;
      letter-spacing: -0.025em;
    }

    .page-subtitle {
      font-size: 1.125rem;
      margin: 0;
      opacity: 0.9;
      font-weight: 400;
    }

    .sales-controls {
      max-width: 1400px;
      margin: 0 auto;
      padding: 0 2rem 2rem 2rem;
    }

    .date-picker-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 30px;
      flex-wrap: wrap;
      gap: 20px;
    }

    .date-inputs {
      display: flex;
      gap: 15px;
      flex-wrap: wrap;
    }

    .date-input-group {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .date-input-group label {
      font-weight: 500;
      color: #4a5568;
      font-size: 14px;
    }

    .date-input {
      padding: 10px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-size: 14px;
      width: 160px;
      transition: border-color 0.2s;
    }

    .date-input:focus {
      outline: none;
      border-color: #4299e1;
      box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
    }

    .go-button-group {
      display: flex;
      align-items: flex-end;
      gap: 10px;
    }

    .go-button {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      min-width: 140px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .go-button:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .go-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }

    

    .loading-text {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .loading-text:before {
      content: "";
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top: 2px solid white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    .debug-button {
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      height: 40px;
    }

    .debug-button:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 3px 8px rgba(245, 158, 11, 0.4);
    }

    .debug-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .store-selection {
      margin-bottom: 15px;
      padding: 12px;
      background: white;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }

    .store-selector {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .store-selector label, .single-store label {
      font-weight: 600;
      color: #2d3748;
      min-width: 50px;
    }

    .store-select {
      padding: 8px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 14px;
      min-width: 200px;
      background: white;
    }

    .single-store {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .store-name {
      font-weight: 700;
      color: #4299e1;
      letter-spacing: 0.5px;
      font-size: 16px;
    }

    .totals-section {
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
      align-items: flex-start;
    }

    .total-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 24px;
      border-radius: 12px;
      text-align: center;
      min-width: 160px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.15);
    }

    .total-label {
      font-size: 14px;
      opacity: 0.9;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .total-amount, .total-count {
      font-size: 28px;
      font-weight: 700;
    }

    .loading-state {
      text-align: center;
      padding: 80px 20px;
      color: #718096;
    }

    .data-source-info {
      font-size: 0.875rem;
      color: #6b7280;
      margin-top: 10px;
      font-style: italic;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #e2e8f0;
      border-top: 4px solid #4299e1;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    /* Data Source Indicator Styles */
    .data-source-indicator {
      margin-left: auto;
    }



    .sales-table-container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
      overflow: hidden;
    }

    .table-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 24px;
      background: #f7fafc;
      border-bottom: 1px solid #e2e8f0;
    }

    .table-header h3 {
      margin: 0;
      color: #2d3748;
      font-size: 18px;
      font-weight: 600;
    }

    .table-info {
      color: #718096;
      font-size: 14px;
    }

    .table-wrapper {
      overflow-x: auto;
    }

    .sales-table {
      width: 100%;
      border-collapse: collapse;
    }

    .sales-table th {
      background: #f7fafc;
      padding: 16px 12px;
      text-align: left;
      font-weight: 600;
      color: #4a5568;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.025em;
      border-bottom: 1px solid #e2e8f0;
    }

    .sales-table td {
      padding: 16px 12px;
      border-bottom: 1px solid #f1f5f9;
      color: #2d3748;
    }

    .order-row {
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .order-row:hover {
      background-color: #f7fafc;
    }

    .order-id {
      font-family: monospace;
      font-weight: 600;
      color: #4299e1;
    }

    .order-date .date {
      font-weight: 500;
    }

    .order-date .time {
      font-size: 12px;
      color: #718096;
    }

    .amount {
      font-weight: 600;
      color: #38a169;
    }

    .payment-badge, .status-badge {
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.025em;
    }

    .payment-cash {
      background: #c6f6d5;
      color: #2f855a;
    }

    .payment-card {
      background: #bee3f8;
      color: #2b6cb0;
    }

    .payment-digital {
      background: #e9d8fd;
      color: #6b46c1;
    }

    .status-completed {
      background: #c6f6d5;
      color: #2f855a;
    }

    .status-pending {
      background: #faf089;
      color: #d69e2e;
    }

    .status-cancelled {
      background: #fed7d7;
      color: #c53030;
    }

    .empty-state td {
      text-align: center;
      padding: 60px 20px;
      color: #718096;
    }

    .empty-message p {
      margin: 0;
      font-size: 16px;
    }

    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 20px;
    }

    .modal-content {
      background: white;
      border-radius: 12px;
      max-width: 600px;
      width: 100%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 24px;
      border-bottom: 1px solid #e2e8f0;
    }

    .modal-header h3 {
      margin: 0;
      color: #2d3748;
      font-size: 20px;
      font-weight: 600;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #718096;
      padding: 4px;
      line-height: 1;
    }

    .close-btn:hover {
      color: #4a5568;
    }

    .modal-body {
      padding: 24px;
    }

    .order-info {
      margin-bottom: 24px;
    }

    .order-info p {
      margin: 8px 0;
      font-size: 14px;
      line-height: 1.5;
    }

    .order-items h4 {
      margin: 0 0 16px 0;
      color: #2d3748;
      font-size: 16px;
      font-weight: 600;
    }

    .order-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid #f1f5f9;
    }

    .order-item:last-child {
      border-bottom: none;
    }

    .item-name {
      font-weight: 500;
      color: #2d3748;
    }

    .item-quantity {
      color: #718096;
      font-size: 14px;
    }

    .item-price {
      font-weight: 600;
      color: #38a169;
    }

    .order-total {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 2px solid #e2e8f0;
      text-align: right;
      font-size: 18px;
      color: #2d3748;
    }

    @media (max-width: 768px) {
      .sales-header {
        flex-direction: column;
        align-items: stretch;
      }

      .totals-section {
        justify-content: center;
      }

      .table-wrapper {
        font-size: 14px;
      }

      .sales-table th,
      .sales-table td {
        padding: 12px 8px;
      }
    }

    /* Professional Button Styles */
    .view-details-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 2px 4px rgba(79, 70, 229, 0.2);
    }

    .view-details-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
      background: linear-gradient(135deg, #4338ca 0%, #6d28d9 100%);
    }

    .view-details-btn:active {
      transform: translateY(0);
      box-shadow: 0 2px 4px rgba(79, 70, 229, 0.2);
    }

    .refresh-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 3px 6px rgba(16, 185, 129, 0.2);
    }

    .refresh-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(16, 185, 129, 0.3);
      background: linear-gradient(135deg, #059669 0%, #047857 100%);
    }

    .refresh-btn:active {
      transform: translateY(0);
      box-shadow: 0 3px 6px rgba(16, 185, 129, 0.2);
    }

    .refresh-btn svg {
      animation: none;
      transition: transform 0.3s ease;
    }

    .refresh-btn:hover svg {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .close-btn {
      position: absolute;
      top: 16px;
      right: 16px;
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: white;
      border: none;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      font-size: 18px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 2px 4px rgba(239, 68, 68, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .close-btn:hover {
      transform: scale(1.1);
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
      background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
    }

    .close-btn:active {
      transform: scale(0.95);
    }

    /* Pagination Styles */
    .pagination-container {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
    }

    .pagination-info {
      font-size: 14px;
      color: #6b7280;
    }

    .pagination-controls {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .pagination-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border: 1px solid #d1d5db;
      background: white;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s ease;
      color: #6b7280;
    }

    .pagination-btn:hover:not(:disabled) {
      background: #f3f4f6;
      border-color: #9ca3af;
      color: #374151;
    }

    .pagination-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      background: #f9fafb;
    }

    .page-numbers {
      display: flex;
      gap: 4px;
      margin: 0 8px;
    }

    .page-number-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border: 1px solid #d1d5db;
      background: white;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s ease;
      color: #6b7280;
      font-size: 14px;
      font-weight: 500;
    }

    .page-number-btn:hover {
      background: #f3f4f6;
      border-color: #9ca3af;
      color: #374151;
    }

    .page-number-btn.active {
      background: #3b82f6;
      border-color: #3b82f6;
      color: white;
    }

    .page-number-btn.active:hover {
      background: #2563eb;
      border-color: #2563eb;
    }
  `]
})
export class SalesSummaryComponent implements OnInit {
  // Services
  private orderService = inject(OrderService);
  private authService = inject(AuthService);
  private storeService = inject(StoreService);

  // Signals for reactive state management
  orders = signal<Order[]>([]);
  stores = signal<Store[]>([]);
  selectedStoreId = signal<string>('');
  isLoading = signal(false);
  showOrderDetails = signal(false);
  selectedOrder = signal<Order | null>(null);
  dataSource = signal<'firebase' | 'api' | null>(null);
  
  // Pagination signals
  currentPage = signal<number>(1);
  itemsPerPage = signal<number>(20);

  // Date properties
  fromDate: string = '';
  toDate: string = '';

  // Computed for store display
  selectedStore = computed(() => {
    const storeId = this.selectedStoreId();
    return this.stores().find(store => store.id === storeId);
  });

  hasMultipleStores = computed(() => {
    return this.stores().length > 1;
  });

  // Computed values for pagination
  filteredOrders = computed(() => {
    return this.orders();
  });

  totalFilteredOrders = computed(() => {
    return this.orders().length;
  });

  totalPages = computed(() => {
    return Math.ceil(this.totalFilteredOrders() / this.itemsPerPage());
  });

  paginatedOrders = computed(() => {
    const filtered = this.filteredOrders();
    const startIndex = (this.currentPage() - 1) * this.itemsPerPage();
    const endIndex = startIndex + this.itemsPerPage();
    return filtered.slice(startIndex, endIndex);
  });

  // Original computed values
  totalSales = computed(() => {
    return this.orders().reduce((total, order) => total + order.totalAmount, 0);
  });

  totalOrders = computed(() => {
    return this.orders().length;
  });

  constructor() {
    // Initialize with current date
    const today = new Date();
    this.fromDate = this.formatDateForInput(today);
    this.toDate = this.formatDateForInput(today);
  }

  async ngOnInit(): Promise<void> {
    // Set default dates to today
    const today = new Date();
    this.fromDate = today.toISOString().split('T')[0];
    this.toDate = today.toISOString().split('T')[0];
    
    await this.loadStores();
    
    // Wait a bit for stores to be set, then load today's data automatically from Firebase
    setTimeout(() => {
      this.loadCurrentDateData();
    }, 100);
  }

  async loadStores(): Promise<void> {
    try {
      const currentPermission = this.authService.getCurrentPermission();
      if (!currentPermission?.companyId) {
        console.warn('No companyId found in current permission');
        return;
      }

      const stores = await this.storeService.getStoresByCompany(currentPermission.companyId);
      this.stores.set(stores);

      // Set selected store - if user has storeId, use it, otherwise use first store
      if (currentPermission?.storeId) {
        this.selectedStoreId.set(currentPermission.storeId);
      } else if (stores.length > 0 && stores[0].id) {
        this.selectedStoreId.set(stores[0].id);
      }
    } catch (error) {
      console.error('Error loading stores:', error);
      this.stores.set([]);
    }
  }

  onDateChange(): void {
    // Don't auto-load on date change, wait for user to click Go button
  }

  onStoreChange(): void {
    // Only reload current date data automatically when store changes
    if (this.isCurrentDate()) {
      this.loadCurrentDateData();
    }
  }

  /**
   * Load current date data from Firebase (default behavior)
   */
  async loadCurrentDateData(): Promise<void> {
    console.log('🔄 Loading current date data from Firebase');
    console.log('📅 Date range:', { from: this.fromDate, to: this.toDate });
    console.log('🏪 Selected store:', this.selectedStoreId());
    
    // Set data source for UI (OrderService handles the actual logic)
    this.dataSource.set('firebase');
    
    // Check if we have any stores and data first
    const storeId = this.selectedStoreId() || this.authService.getCurrentPermission()?.storeId;
    console.log('🔍 Debug - Store availability:', {
      selectedStoreId: this.selectedStoreId(),
      permissionStoreId: this.authService.getCurrentPermission()?.storeId,
      finalStoreId: storeId,
      allStores: this.stores().map(s => ({ id: s.id, name: s.storeName }))
    });
    
    await this.loadSalesData();
  }

  /**
   * Manual load triggered by Go button - uses hybrid logic
   */
  async loadSalesDataManual(): Promise<void> {
    if (!this.fromDate || !this.toDate) {
      alert('Please select both from and to dates');
      return;
    }

    // Determine data source based on date range for display purposes
    const startDate = new Date(this.fromDate);
    const endDate = new Date(this.toDate);
    const shouldUseApi = this.shouldUseApiForDates(startDate, endDate);
    
    // Set data source for UI indication (OrderService will handle actual logic)
    this.dataSource.set(shouldUseApi ? 'api' : 'firebase');
    await this.loadSalesData();
  }

  /**
   * Check if current selected dates are today (current date)
   */
  private isCurrentDate(): boolean {
    const today = new Date().toISOString().split('T')[0];
    return this.fromDate === today && this.toDate === today;
  }

  /**
   * Determine if should use API based on dates
   * Rule: If current date (today) → use Firestore, else → use API
   */
  private shouldUseApiForDates(startDate: Date, endDate: Date): boolean {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    
    // If date range is current date (today), use Firestore
    const isCurrentDate = startStr === todayStr && endStr === todayStr;
    
    console.log('📅 Date range check:', {
      today: todayStr,
      startDate: startStr,
      endDate: endStr,
      isCurrentDate,
      willUseFirestore: isCurrentDate,
      willUseAPI: !isCurrentDate
    });
    
    // Use API for all dates except current date
    return !isCurrentDate;
  }

  /**
   * Get button text - always shows "Go"
   */
  getDataSourceButtonText(): string {
    return 'Go';
  }

  refreshData(): void {
    this.loadSalesData();
  }

  /**
   * Determines which data source will be used based on date range
   */
  async loadSalesData(): Promise<void> {
    this.isLoading.set(true);
    
    try {
      // Use selected store ID or get from permission
      const storeId = this.selectedStoreId() || this.authService.getCurrentPermission()?.storeId;
      console.log('🏪 Store ID resolution:', {
        selectedStoreId: this.selectedStoreId(),
        permissionStoreId: this.authService.getCurrentPermission()?.storeId,
        finalStoreId: storeId,
        allStores: this.stores().map(s => ({ id: s.id, name: s.storeName }))
      });
      
      if (!storeId) {
        console.warn('❌ No storeId found - cannot load data');
        this.orders.set([]);
        this.dataSource.set(null);
        return;
      }

      // Convert date strings to Date objects
      const startDate = new Date(this.fromDate);
      const endDate = new Date(this.toDate);
      // Set end date to end of day
      endDate.setHours(23, 59, 59, 999);

      console.log('Loading sales data for store:', storeId, 'from:', startDate, 'to:', endDate);
      console.log('Data source:', this.dataSource() === 'api' ? 'External API (2+ days old)' : 'Firebase (Recent data)');

      // Use the hybrid method that automatically determines the data source
      console.log('📊 Using hybrid data loading...');
      const orders = await this.orderService.getOrdersByDateRange(storeId, startDate, endDate);

      // Debug: Check what we got back
      console.log('📊 Order Service returned:', orders.length, 'orders');
      if (orders.length === 0) {
        console.log('⚠️ No orders found. This could mean:');
        console.log('1. No orders exist for this date range');
        console.log('2. Store ID is incorrect');
        console.log('3. API/Firebase connection issue');
        console.log('4. Date format issue');
      }

      // No need to filter on client side - the service handles it
      const filteredOrders = orders;

      // Transform to match our interface - spread all existing properties and add display properties
      const transformedOrders: Order[] = filteredOrders.map((order: any) => ({
        ...order, // Spread all existing order properties
        id: order.id || '', // Ensure id is not undefined
        customerName: order.soldTo || 'Cash Sale',
        items: [], // We'll load items separately if needed
        paymentMethod: 'cash' // Default payment method since it's not in Order interface
      }));

      this.orders.set(transformedOrders);
    } catch (error) {
      console.error('Error loading sales data:', error);
      this.orders.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }

  openOrderDetails(order: Order): void {
    this.selectedOrder.set(order);
    this.showOrderDetails.set(true);
  }

  closeOrderDetails(): void {
    this.showOrderDetails.set(false);
    this.selectedOrder.set(null);
  }

  trackByOrderId(index: number, order: Order): string {
    return order.id || index.toString();
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  }

  formatTime(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  private formatDateForInput(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  // Pagination methods
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  goToFirstPage(): void {
    this.currentPage.set(1);
  }

  goToLastPage(): void {
    this.currentPage.set(this.totalPages());
  }

  goToPreviousPage(): void {
    const current = this.currentPage();
    if (current > 1) {
      this.currentPage.set(current - 1);
    }
  }

  goToNextPage(): void {
    const current = this.currentPage();
    if (current < this.totalPages()) {
      this.currentPage.set(current + 1);
    }
  }

  getPageNumbers(): number[] {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: number[] = [];
    
    // Show up to 5 pages around current page
    const start = Math.max(1, current - 2);
    const end = Math.min(total, start + 4);
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  // Helper method for template
  min(a: number, b: number): number {
    return Math.min(a, b);
  }

  // Test authentication method
  

}