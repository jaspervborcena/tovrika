import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderService } from '../../../../services/order.service';
import { AuthService } from '../../../../services/auth.service';
import { StoreService, Store } from '../../../../services/store.service';
import { LedgerService } from '../../../../services/ledger.service';
import { Order as PosOrder, OrderItem } from '../../../../interfaces/pos.interface';
import { IndexedDBService } from '../../../../core/services/indexeddb.service';

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
          
          <div class="control-row">
            <label class="control-label">Period</label>
            <select class="control-select" [(ngModel)]="selectedPeriod" (change)="onPeriodChange()">
              <option *ngFor="let p of periodOptions" [value]="p.key">{{ p.label }}</option>
            </select>

            <div *ngIf="selectedPeriod === 'date_range'" class="date-range-inputs">
              <input type="date" class="control-input" [(ngModel)]="fromDate" />
              <input type="date" class="control-input" [(ngModel)]="toDate" />
              <button class="control-go" (click)="loadSalesDataManual()">Go</button>
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
          <div class="table-info-container">
            <div class="table-info">
              Showing {{ paginatedOrders().length }} of {{ totalOrders() }} orders
            </div>
            <div *ngIf="sortColumn()" class="sort-info">
              Sorted by {{ getSortDisplayName(sortColumn()) }} 
              <span class="sort-direction">{{ sortDirection() === 'asc' ? '↑' : '↓' }}</span>
            </div>
          </div>
        </div>
        
        <div class="table-wrapper">
          <table class="sales-table">
            <thead>
              <tr>
                <th class="sortable-header" (click)="sort('invoiceNumber')" [class.active]="isSortedColumn('invoiceNumber')">
                  <div class="header-content">
                    <span>Invoice Number</span>
                    <svg class="sort-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path [attr.d]="getSortIcon('invoiceNumber')"/>
                    </svg>
                  </div>
                </th>
                <th class="sortable-header" (click)="sort('createdAt')" [class.active]="isSortedColumn('createdAt')">
                  <div class="header-content">
                    <span>Date & Time</span>
                    <svg class="sort-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path [attr.d]="getSortIcon('createdAt')"/>
                    </svg>
                  </div>
                </th>
                <th class="sortable-header" (click)="sort('customerName')" [class.active]="isSortedColumn('customerName')">
                  <div class="header-content">
                    <span>Customer</span>
                    <svg class="sort-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path [attr.d]="getSortIcon('customerName')"/>
                    </svg>
                  </div>
                </th>
                <!-- Items column removed (API no longer returns embedded items) -->
                <th class="sortable-header" (click)="sort('totalAmount')" [class.active]="isSortedColumn('totalAmount')">
                  <div class="header-content">
                    <span>Total Amount</span>
                    <svg class="sort-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path [attr.d]="getSortIcon('totalAmount')"/>
                    </svg>
                  </div>
                </th>
                <th class="sortable-header" (click)="sort('paymentMethod')" [class.active]="isSortedColumn('paymentMethod')">
                  <div class="header-content">
                    <span>Payment Method</span>
                    <svg class="sort-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path [attr.d]="getSortIcon('paymentMethod')"/>
                    </svg>
                  </div>
                </th>
                <th class="sortable-header" (click)="sort('status')" [class.active]="isSortedColumn('status')">
                  <div class="header-content">
                    <span>Status</span>
                    <svg class="sort-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path [attr.d]="getSortIcon('status')"/>
                    </svg>
                  </div>
                </th>
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
                <!-- items column removed -->
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
                <td colspan="7">
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
        
  <!-- Pagination Controls (hide when using API paging) -->
  <div *ngIf="dataSource() !== 'api' && totalFilteredOrders() > itemsPerPage()" class="pagination-container">
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
        
        <!-- Show more for API-backed (BigQuery) results -->
        <div *ngIf="dataSource() === 'api' && apiHasMore()" style="text-align:center; margin-top:12px;">
          <button class="btn btn-primary" (click)="loadMoreApiOrders()" [disabled]="apiLoadingMore()">
            <span *ngIf="apiLoadingMore()" class="loading-spinner" style="width:1rem; height:1rem; border-top-color: #fff; margin-right:8px;"></span>
            {{ apiLoadingMore() ? 'Loading...' : 'Show more' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Order Details Modal -->
    <div *ngIf="showOrderDetails()" 
         class="modal-overlay" 
         (click)="closeOrderDetails()"
         style="position: fixed !important; z-index: 9999 !important; background: rgba(0, 0, 0, 0.8) !important;">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>📋 Order Details</h3>
          <button class="close-btn" (click)="closeOrderDetails()">×</button>
        </div>
        <div class="modal-body">
          <div *ngIf="selectedOrder()" class="order-details">
            <div class="form-section">
              <h4 class="section-title">
                <span>📝</span>
                <span>Order Information</span>
              </h4>
              <div class="order-info">
                <div class="info-row">
                  <span class="info-label">Invoice Number:</span>
                  <span class="info-value">{{ selectedOrder()!.invoiceNumber || 'N/A' }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Date:</span>
                  <span class="info-value">{{ formatDate(selectedOrder()!.createdAt) }} at {{ formatTime(selectedOrder()!.createdAt) }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Customer:</span>
                  <span class="info-value">{{ selectedOrder()!.customerName || 'Walk-in Customer' }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Payment Method:</span>
                  <span class="info-value">{{ selectedOrder()!.paymentMethod || 'Cash' }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Status:</span>
                  <span class="info-value">
                    <span class="status-badge" [class]="'status-' + selectedOrder()!.status.toLowerCase()">
                      {{ selectedOrder()!.status }}
                    </span>
                  </span>
                </div>
              </div>
            </div>
            
            <div class="form-section">
              <h4 class="section-title">
                <span>🛒</span>
                <span>Items Ordered</span>
              </h4>
              <div class="order-items-table-wrapper">
                <table class="order-items-table">
                  <thead>
                    <tr>
                      <th>Product Name</th>
                      <th>Quantity</th>
                      <th>Price</th>
                      <th>Discount</th>
                      <th>VAT</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let item of selectedOrder()!.items || []">
                     <td class="mono">{{ item.productName || '-' }}</td>
                      <td>{{ getQuantity(item) }}</td>
                      <td>₱{{ formatCurrency(item?.price) }}</td>
                      <td>{{ getDiscount(item) }}</td>
                      <td>₱{{ formatCurrency(item?.vat) }}</td>
                      <td class="mono">₱{{ formatCurrency(getItemTotal(item)) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            
            <div class="form-section">
              <h4 class="section-title">
                <span>💰</span>
                <span>Order Total</span>
              </h4>
              <div class="order-total">
                <strong>Total: ₱{{ selectedOrder()!.totalAmount.toLocaleString('en-US', {minimumFractionDigits: 2}) }}</strong>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" (click)="closeOrderDetails()">Close</button>
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

    /* Overview controls pattern */
    .overview-controls {
      display: flex;
      gap: 12px;
      align-items: center;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }

    .overview-controls .control-row {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .control-label { 
      font-weight: 600; 
      color: #374151; 
      min-width: 60px;
    }
    
    .control-select { 
      padding: 6px 8px; 
      border-radius: 8px; 
      border: 1px solid #e5e7eb; 
      background: white;
      min-width: 150px;
    }
    
    .control-input { 
      padding: 6px 8px; 
      border-radius: 8px; 
      border: 1px solid #e5e7eb; 
    }
    
    .control-go { 
      background: #3b82f6; 
      color: white; 
      border: none; 
      padding: 6px 10px; 
      border-radius: 8px; 
      cursor: pointer;
      font-weight: 500;
    }

    .control-go:hover {
      background: #2563eb;
    }

    .date-range-inputs {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .single-store {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .single-store .store-name {
      font-weight: 600;
      color: #1f2937;
    }

    .date-picker-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 30px;
      flex-wrap: wrap;
      gap: 20px;
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

    /* Modal header styled to match BIR compliance dialog */
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.5rem 2rem;
      border-bottom: 1px solid #e5e7eb;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 12px 12px 0 0;
    }

    .modal-header h3 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
      color: white;
    }

    .close-btn {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      font-size: 1.5rem;
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      line-height: 1;
    }

    .close-btn:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: scale(1.1);
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

    .table-info-container {
      display: flex;
      flex-direction: column;
      gap: 4px;
      align-items: flex-end;
    }

    .table-info {
      color: #718096;
      font-size: 14px;
    }

    .sort-info {
      color: #4299e1;
      font-size: 12px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .sort-direction {
      font-size: 14px;
      font-weight: 700;
    }

    .table-wrapper {
      overflow-x: auto;
    }

    /* Order items table styling - matches BIR dialog patterns */
    .order-items-table-wrapper {
      overflow: auto;
      max-height: 300px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      background: white;
      margin-top: 0.5rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .order-items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
      table-layout: auto;
    }

    .order-items-table thead th {
      background: #f7fafc;
      padding: 0.75rem;
      text-align: left;
      font-weight: 600;
      color: #4a5568;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.025em;
      border-bottom: 1px solid #e2e8f0;
    }

    .order-items-table td {
      padding: 0.75rem;
      border-bottom: 1px solid #f1f5f9;
      color: #2d3748;
      vertical-align: middle;
    }

    .order-items-table .mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', 'Courier New', monospace;
      font-size: 0.8125rem;
      color: #2b6cb0;
    }

    .order-total {
      text-align: center;
      padding: 1.5rem;
      background: white;
      border-radius: 8px;
      border: 2px solid #e5e7eb;
      font-size: 1.125rem;
      color: #1f2937;
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

    .sortable-header {
      cursor: pointer;
      user-select: none;
      transition: all 0.2s ease;
      position: relative;
    }

    .sortable-header:hover {
      background: #edf2f7;
      color: #2d3748;
    }

    .sortable-header.active {
      background: #e2e8f0;
      color: #2d3748;
    }

    .header-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .sort-icon {
      opacity: 0.5;
      transition: all 0.2s ease;
      flex-shrink: 0;
    }

    .sortable-header:hover .sort-icon {
      opacity: 0.8;
    }

    .sortable-header.active .sort-icon {
      opacity: 1;
      color: #4299e1;
    }

    /* Visual indicator for sortable headers */
    .sortable-header::before {
      content: '';
      position: absolute;
      left: 0;
      bottom: 0;
      width: 100%;
      height: 2px;
      background: linear-gradient(90deg, transparent, #4299e1, transparent);
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .sortable-header.active::before {
      opacity: 1;
    }

    .sortable-header:hover::before {
      opacity: 0.5;
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
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      backdrop-filter: blur(2px);
      padding: 1rem;
    }

    .modal {
      background: white;
      border-radius: 12px;
      width: 90%;
      max-width: 720px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 18px 20px;
      border-bottom: 1px solid #e2e8f0;
    }
    .modal-header h3 {
      margin: 0;
      color: #2d3748;
      font-size: 18px;
      font-weight: 700;
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
      transform: scale(1.05);
    }

    .modal-body {
      padding: 2rem;
      overflow-y: auto;
      flex: 1;
    }

    .form-section {
      margin-bottom: 2rem;
      padding: 1.5rem;
      background: #f9fafb;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }

    .form-section:last-child {
      margin-bottom: 0;
    }

    .section-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 1rem;
      font-weight: 600;
      color: #374151;
      margin: 0 0 1rem 0;
      padding-bottom: 0.75rem;
      border-bottom: 2px solid #e5e7eb;
    }

    .section-title span:first-child {
      font-size: 1.25rem;
    }

    .order-info {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem 0;
      border-bottom: 1px solid #f1f5f9;
    }

    .info-row:last-child {
      border-bottom: none;
    }

    .info-label {
      font-weight: 500;
      color: #6b7280;
      font-size: 0.875rem;
    }

    .info-value {
      font-weight: 600;
      color: #1f2937;
      font-size: 0.875rem;
    }

    .status-badge {
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.025em;
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

    .order-items h4 {
      margin: 0 0 1rem 0;
      color: #2d3748;
      font-size: 1rem;
      font-weight: 600;
    }

    /* Modal footer styled like other footers */
    /* Modal footer styled to match BIR compliance dialog */
    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 1rem;
      padding: 1.5rem 2rem;
      border-top: 1px solid #e5e7eb;
      background: #f9fafb;
      border-radius: 0 0 12px 12px;
    }

    .btn {
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      border: none;
    }

    .btn-secondary {
      background: #f1f5f9;
      color: #64748b;
      border: 1px solid #e2e8f0;
    }

    .btn-secondary:hover {
      background: #e2e8f0;
      transform: translateY(-1px);
    }

    @media (max-width: 768px) {
      .header {
        padding: 1rem 0;
      }

      .header-content {
        padding: 0 1rem;
      }

      .page-title {
        font-size: 1.5rem;
      }

      .page-subtitle {
        font-size: 0.875rem;
      }

      .sales-controls {
        padding: 0 1rem 1.5rem 1rem;
      }

      .date-picker-section {
        flex-direction: column;
        align-items: stretch;
        gap: 1rem;
      }

      .date-inputs {
        flex-direction: column;
        gap: 0.75rem;
      }

      .date-input-group label {
        font-size: 0.8125rem;
      }

      .date-input {
        width: 100%;
        font-size: 0.875rem;
        padding: 0.625rem 0.75rem;
      }

      .go-button-group {
        flex-direction: column;
        align-items: stretch;
        width: 100%;
      }

      .go-button,
      .debug-button {
        width: 100%;
        font-size: 0.8125rem;
        padding: 0.625rem 1rem;
      }

      .store-selection {
        padding: 0.75rem;
      }

      .store-selector {
        flex-direction: column;
        align-items: stretch;
        gap: 0.5rem;
      }

      .store-select {
        width: 100%;
        min-width: auto;
        font-size: 0.875rem;
      }

      .totals-section {
        grid-template-columns: 1fr;
        gap: 0.75rem;
      }

      .total-card {
        min-width: auto;
        padding: 1rem;
      }

      .total-card-label {
        font-size: 0.75rem;
      }

      .total-card-value {
        font-size: 1.25rem;
      }

      .table-wrapper {
        font-size: 0.75rem;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }

      .sales-table {
        min-width: 600px;
      }

      .sales-table th,
      .sales-table td {
        padding: 0.5rem 0.375rem;
        font-size: 0.75rem;
      }

      .header-content {
        gap: 0.25rem;
      }

      .header-content span {
        font-size: 0.6875rem;
      }

      .sort-icon {
        width: 0.875rem;
        height: 0.875rem;
      }

      .table-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.75rem;
      }

      .table-info-container {
        align-items: flex-start;
        flex-direction: column;
        gap: 0.5rem;
      }

      .export-container {
        width: 100%;
      }

      .export-button {
        width: 100%;
        justify-content: center;
        font-size: 0.8125rem;
      }

      .pagination-container {
        flex-direction: column;
        gap: 0.75rem;
        align-items: center;
      }

      .pagination-controls {
        flex-wrap: wrap;
        justify-content: center;
        gap: 0.375rem;
      }

      .page-button,
      .page-number {
        padding: 0.375rem 0.625rem;
        font-size: 0.75rem;
      }
    }

    @media (max-width: 480px) {
      .page-title {
        font-size: 1.25rem;
      }

      .page-subtitle {
        font-size: 0.8125rem;
      }

      .date-input-group label {
        font-size: 0.75rem;
      }

      .date-input {
        font-size: 0.8125rem;
      }

      .go-button,
      .debug-button {
        font-size: 0.75rem;
      }

      .total-card {
        padding: 0.75rem;
      }

      .total-card-label {
        font-size: 0.6875rem;
      }

      .total-card-value {
        font-size: 1.125rem;
      }

      .sales-table th,
      .sales-table td {
        padding: 0.375rem 0.25rem;
        font-size: 0.6875rem;
      }

      /* Modal responsive styles */
      .modal {
        width: 95%;
        max-height: 95vh;
      }

      .modal-header {
        padding: 1rem 1.5rem;
      }

      .modal-body {
        padding: 1rem;
      }

      .form-section {
        padding: 1rem;
      }

      .modal-footer {
        padding: 1rem 1.5rem;
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

    /* .close-btn floating style removed to keep header-styled close button visible in modal header */

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
  private indexedDb = inject(IndexedDBService);
  private ledgerService = inject(LedgerService);

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
  // API pagination for BigQuery-backed endpoint
  apiPageSize = 50;
  apiCurrentPage = signal<number>(1);
  apiHasMore = signal<boolean>(false);
  apiLoadingMore = signal<boolean>(false);

  // Sorting signals
  sortColumn = signal<string>('createdAt');
  sortDirection = signal<'asc' | 'desc'>('desc');

  // Date properties
  fromDate: string = '';
  toDate: string = '';

  // Period options
  periodOptions = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'this_month', label: 'This Month' },
    { key: 'previous_month', label: 'Previous Month' },
    { key: 'date_range', label: 'Date Range' }
  ];
  selectedPeriod: 'today' | 'yesterday' | 'this_month' | 'previous_month' | 'date_range' = 'this_month';

  // Computed for store display
  selectedStore = computed(() => {
    const storeId = this.selectedStoreId();
    return this.stores().find(store => store.id === storeId);
  });

  hasMultipleStores = computed(() => {
    return this.stores().length > 1;
  });

  // Computed values for sorting and pagination
  sortedOrders = computed(() => {
    const orders = this.orders();
    const column = this.sortColumn();
    const direction = this.sortDirection();

    if (!column) return orders;

    return [...orders].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (column) {
        case 'invoiceNumber':
          aValue = a.invoiceNumber || '';
          bValue = b.invoiceNumber || '';
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt);
          bValue = new Date(b.createdAt);
          break;
        case 'customerName':
          aValue = a.customerName || a.soldTo || 'Walk-in Customer';
          bValue = b.customerName || b.soldTo || 'Walk-in Customer';
          break;
        // itemsCount removed from sorting because Sales Summary no longer includes embedded items
        case 'totalAmount':
          aValue = a.totalAmount || 0;
          bValue = b.totalAmount || 0;
          break;
        case 'paymentMethod':
          aValue = a.paymentMethod || 'Cash';
          bValue = b.paymentMethod || 'Cash';
          break;
        case 'status':
          aValue = a.status || 'completed';
          bValue = b.status || 'completed';
          break;
        default:
          return 0;
      }

      // Handle string comparison
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.toLowerCase().localeCompare(bValue.toLowerCase());
        return direction === 'asc' ? comparison : -comparison;
      }

      // Handle number/date comparison
      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  });

  filteredOrders = computed(() => {
    return this.sortedOrders();
  });

  totalFilteredOrders = computed(() => {
    return this.filteredOrders().length;
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
  // Ledger-backed totals (preferred)
  ledgerTotalRevenue = signal<number>(0);
  ledgerTotalOrders = signal<number>(0);

  totalSales = computed(() => {
    const l = this.ledgerTotalRevenue();
    if (l && Number(l) !== 0) return l;
    return this.orders().reduce((total, order) => total + order.totalAmount, 0);
  });

  totalOrders = computed(() => {
    const l = this.ledgerTotalOrders();
    if (l && Number(l) !== 0) return l;
    return this.orders().length;
  });

  constructor() {
    // Initialize default range to the current month (From = first day of month, To = today)
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    this.fromDate = this.formatDateForInput(startOfMonth);
    this.toDate = this.formatDateForInput(today);
  }

  async ngOnInit(): Promise<void> {
    // Ensure default date range is ordered correctly and stay as last-7-days set in constructor
    this.ensureDateOrder();
    const today = new Date(this.toDate);
    
    await this.loadStores();
    
    // Wait a bit for stores to be set, then load today's data automatically from Firebase
    setTimeout(() => {
      this.loadCurrentDateData();
      // Also load ledger totals for the selected store
      this.loadLedgerTotalsForStore();
    }, 100);
  }

  // Load ledger totals when loading current date data
  private async loadLedgerTotalsForStore(): Promise<void> {
    try {
      const currentPermission = this.authService.getCurrentPermission();
      const companyId = currentPermission?.companyId || '';
      const storeId = this.selectedStoreId() || currentPermission?.storeId || '';
      if (!companyId || !storeId) return;
      const balances = await this.ledgerService.getLatestOrderBalances(companyId, storeId, new Date(), 'completed');
      this.ledgerTotalRevenue.set(Number(balances.runningBalanceAmount || 0));
      this.ledgerTotalOrders.set(Number(balances.runningBalanceQty || 0));
    } catch (err) {
      console.warn('SalesSummary: failed to load ledger totals', err);
    }
  }

  async loadStores(): Promise<void> {
    try {
      const currentPermission = this.authService.getCurrentPermission();
      if (!currentPermission?.companyId) {
        console.warn('No companyId found in current permission');
        return;
      }

      // Use centralized method from store.service
      const activeStores = await this.storeService.getActiveStoresForDropdown(currentPermission.companyId);
      this.stores.set(activeStores);

      // Set selected store - if user has storeId, use it, otherwise use first store
      if (currentPermission?.storeId) {
        this.selectedStoreId.set(currentPermission.storeId);
      } else if (activeStores.length > 0 && activeStores[0].id) {
        this.selectedStoreId.set(activeStores[0].id);
      }
    } catch (error) {
      console.error('Error loading stores:', error);
      this.stores.set([]);
    }
  }

  onDateChange(): void {
    // Ensure user-entered dates maintain a valid range (From <= To).
    this.ensureDateOrder();
  }

  onStoreChange(): void {
    // Only reload current date data automatically when store changes
    if (this.isCurrentDate()) {
      this.loadCurrentDateData();
    }
  }

  /**
   * Handle period selection change
   */
  onPeriodChange(): void {
    const period = this.selectedPeriod;
    const now = new Date();
    
    if (period === 'today') {
      const today = this.formatDateForInput(now);
      this.fromDate = today;
      this.toDate = today;
      this.loadSalesDataManual();
    } else if (period === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yesterdayStr = this.formatDateForInput(yesterday);
      this.fromDate = yesterdayStr;
      this.toDate = yesterdayStr;
      this.loadSalesDataManual();
    } else if (period === 'this_month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      this.fromDate = this.formatDateForInput(startOfMonth);
      this.toDate = this.formatDateForInput(now);
      this.loadSalesDataManual();
    } else if (period === 'previous_month') {
      const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      this.fromDate = this.formatDateForInput(startOfPrevMonth);
      this.toDate = this.formatDateForInput(endOfPrevMonth);
      this.loadSalesDataManual();
    }
    // For date_range, user will select dates and click Go button
  }

  /**
   * Load current date data from Firebase (default behavior)
   */
  async loadCurrentDateData(): Promise<void> {
    // Ensure date order before loading
    this.ensureDateOrder();
    
    // Use Firestore for Sales Summary (orders are few) — query by updatedAt/createdAt range
    this.dataSource.set('firebase');
    
    // Check if we have any stores and data first
    const storeId = this.selectedStoreId() || this.authService.getCurrentPermission()?.storeId;
    
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

    // Ensure date ordering before proceeding (swap if user accidentally set From > To)
    this.ensureDateOrder();

    // Always use API for sales summary (BigQuery-backed). Save snapshot to IndexedDB after fetch.
    this.dataSource.set('api');
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
      
      console.log('📊 SalesSummary loadSalesData called:', {
        storeId,
        fromDate: this.fromDate,
        toDate: this.toDate,
        selectedPeriod: this.selectedPeriod
      });
      
      if (!storeId) {
        console.warn('❌ No storeId found - cannot load data');
        this.orders.set([]);
        this.dataSource.set(null);
        return;
      }

      // Convert date strings to Date objects - use local timezone
      const [fromYear, fromMonth, fromDay] = this.fromDate.split('-').map(Number);
      const [toYear, toMonth, toDay] = this.toDate.split('-').map(Number);
      
      const startDate = new Date(fromYear, fromMonth - 1, fromDay, 0, 0, 0, 0);
      const endDate = new Date(toYear, toMonth - 1, toDay, 23, 59, 59, 999);

      console.log('🔍 Querying orders for date range:', {
        startDate: startDate.toISOString(),
        startDateLocal: startDate.toLocaleString(),
        endDate: endDate.toISOString(),
        endDateLocal: endDate.toLocaleString()
      });

      // Use Firestore-only flow: query `orders` collection by `storeId` and `updatedAt` (fallback to createdAt)
      let orders: any[] = [];
      try {
        const results = await this.orderService.getOrdersByDateRange(storeId, startDate, endDate);
        orders = results || [];
        console.log('✅ Orders loaded:', orders.length, 'orders found');
      } catch (e) {
        console.warn('❌ Firestore sales query failed, setting orders to empty', e);
        orders = [];
      }

      // If no results from date-range query (likely missing composite index), fetch store orders and filter client-side
      if (!orders || orders.length === 0) {
        try {
          const rawDocs = await this.orderService.getSampleOrdersForDebug(storeId, 500);
          if (rawDocs && rawDocs.length > 0) {
            // Transform raw docs to Order objects and filter by date range
            const allOrders = rawDocs.map((doc: any) => {
              const data = doc.data;
              // Parse timestamps from various field names
              let orderDate: Date | null = null;
              if (data.updatedAt) {
                orderDate = data.updatedAt.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt);
              } else if (data.updated_at) {
                orderDate = data.updated_at.toDate ? data.updated_at.toDate() : new Date(data.updated_at);
              } else if (data.createdAt) {
                orderDate = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
              } else if (data.created_at) {
                orderDate = data.created_at.toDate ? data.created_at.toDate() : new Date(data.created_at);
              } else if (data.date) {
                orderDate = data.date.toDate ? data.date.toDate() : new Date(data.date);
              }

              return {
                id: doc.id,
                companyId: data.companyId || '',
                storeId: data.storeId || '',
                terminalId: data.terminalId || '',
                assignedCashierId: data.assignedCashierId || '',
                status: data.status || 'paid',
                cashSale: data.cashSale !== false,
                soldTo: data.soldTo || 'Walk-in Customer',
                tin: data.tin || '',
                businessAddress: data.businessAddress || '',
                invoiceNumber: data.invoiceNumber || '',
                logoUrl: data.logoUrl || '',
                date: orderDate || new Date(),
                vatableSales: data.vatableSales || 0,
                vatAmount: data.vatAmount || 0,
                zeroRatedSales: data.zeroRatedSales || 0,
                vatExemptAmount: data.vatExemptAmount || 0,
                discountAmount: data.discountAmount || 0,
                grossAmount: data.grossAmount || 0,
                netAmount: data.netAmount || 0,
                totalAmount: data.totalAmount || data.netAmount || 0,
                exemptionId: data.exemptionId || '',
                signature: data.signature || '',
                atpOrOcn: data.atpOrOcn || '',
                birPermitNo: data.birPermitNo || '',
                inclusiveSerialNumber: data.inclusiveSerialNumber || '',
                createdAt: orderDate || new Date(),
                message: data.message || '',
                paymentMethod: data.paymentMethod || data.payment || 'cash'
              };
            });

            // Filter by date range client-side
            orders = allOrders.filter((o: any) => {
              const oDate = o.createdAt;
              return oDate >= startDate && oDate <= endDate;
            });

            console.log('📊 After client-side date filtering:', orders.length, 'orders');
            if (orders.length > 0) {
              console.log('📊 Sample filtered order:', orders[0]);
            }
          }
        } catch (debugErr) {
          console.warn('Failed to fetch orders via getSampleOrdersForDebug', debugErr);
        }
      }

      // No API pagination when using Firestore for this view
      this.apiHasMore.set(false);

      // Persist snapshot to IndexedDB for offline fallback
      try {
        if (orders && orders.length > 0) {
          await this.indexedDb.saveSetting(`orders_snapshot_${storeId}`, orders);
          console.log(`📦 Saved ${orders.length} orders to IndexedDB snapshot for store ${storeId}`);
        }
      } catch (saveErr) {
        console.warn('Failed to save orders snapshot to IndexedDB', saveErr);
      }

      // If service returned no orders, attempt IndexedDB snapshot fallback
      if (!orders || orders.length === 0) {
        try {
          const saved: any[] = await this.indexedDb.getSetting(`orders_snapshot_${storeId}`);
          if (saved && Array.isArray(saved) && saved.length > 0) {
            orders = saved;
            // mark data source as offline fallback
            this.dataSource.set('api');
          }
        } catch (dbErr) {
          console.warn('📦 Failed to read orders snapshot from IndexedDB:', dbErr);
        }
        // If still no orders, fetch a few sample docs for debugging (helps identify field names/storeId)
        try {
          const samples = await this.orderService.getSampleOrdersForDebug(storeId, 5);
        } catch (dbgErr) {
          console.warn('Failed to fetch sample orders for debug', dbgErr);
        }
      }

      // No need to filter on client side - the service handles it when possible
  const filteredOrders = orders || [];

      // Transform to match our interface - spread all existing properties and add display properties
      const transformedOrders: Order[] = filteredOrders.map((order: any) => ({
        ...order, // Spread all existing order properties
        id: order.id || '', // Ensure id is not undefined
        customerName: order.soldTo || 'Walk-in Customer',
        paymentMethod: order.paymentMethod || 'cash'
      }));

      // Deduplicate results by a stable key (prefer `invoiceNumber`, then `id`, then fallback).
      // If duplicates exist, keep the most recent entry by `createdAt`.
      const dedupMap = new Map<string, Order>();
      for (const o of transformedOrders) {
        const key = this.makeOrderKey(o);
        const existing = dedupMap.get(key);
        if (!existing) {
          dedupMap.set(key, o);
        } else {
          try {
            const existingTime = new Date(existing.createdAt as any).getTime() || 0;
            const newTime = new Date(o.createdAt as any).getTime() || 0;
            if (newTime > existingTime) dedupMap.set(key, o);
          } catch {
            // If parsing fails, prefer the new one by default
            dedupMap.set(key, o);
          }
        }
      }

      const deduped = Array.from(dedupMap.values());
      this.orders.set(deduped);
    } catch (error) {
      console.error('Error loading sales data:', error);
      this.orders.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }

  // Load next API page and append results (used when dataSource === 'api')
  async loadMoreApiOrders(): Promise<void> {
    if (this.apiLoadingMore()) return;
    this.apiLoadingMore.set(true);
    try {
      const storeId = this.selectedStoreId() || this.authService.getCurrentPermission()?.storeId;
      if (!storeId) return;
      const startDate = new Date(this.fromDate);
      const endDate = new Date(this.toDate);
      endDate.setHours(23, 59, 59, 999);
      const nextPage = this.apiCurrentPage() + 1;
      const fields = ['invoice_number','updated_at','gross_amount','net_amount','payment','status'];
      const page = await this.orderService.getOrdersPage(storeId, startDate, endDate, this.apiPageSize, nextPage, fields);
        if (page && page.length > 0) {
        // Append - transform and dedupe against existing orders
        const current = this.orders();
        const transformed = page.map((order: any) => ({ ...(order as any), customerName: order.soldTo || 'Walk-in Customer', paymentMethod: order.payment || order.paymentMethod || 'cash' }));

        // Build a map from existing orders for quick dedupe
        const map = new Map<string, Order>();
        for (const o of current) {
          const key = this.makeOrderKey(o);
          map.set(key, o);
        }

        for (const o of transformed) {
          const key = this.makeOrderKey(o);
          const existing = map.get(key);
          if (!existing) {
            map.set(key, o);
          } else {
            try {
              const existingTime = new Date(existing.createdAt as any).getTime() || 0;
              const newTime = new Date(o.createdAt as any).getTime() || 0;
              if (newTime > existingTime) map.set(key, o);
            } catch {
              map.set(key, o);
            }
          }
        }

        this.orders.set(Array.from(map.values()));
        this.apiCurrentPage.set(nextPage);
        this.apiHasMore.set(page.length >= this.apiPageSize);
      } else {
        this.apiHasMore.set(false);
      }
    } catch (err) {
      console.error('Error loading more API orders:', err);
    } finally {
      this.apiLoadingMore.set(false);
    }
  }

  async openOrderDetails(order: Order): Promise<void> {
    try {
      // Fetch order items (orderDetails) by orderId. Some orders may have multiple orderDetails documents (batches).
      const targetOrderId = (order as any).orderId || order.id || '';
      let items: any[] = [];
      if (targetOrderId) {
        try {
          items = await this.orderService.fetchOrderItems(targetOrderId);
        } catch (e) {
          console.warn('Failed to fetch order items for orderId', targetOrderId, e);
          items = [];
        }
      }

      // Merge items into a copy of the order for display. Do not surface internal document ids.
      const displayOrder = { ...(order as any), items } as Order & { items?: any[] };
      this.selectedOrder.set(displayOrder as any);
      this.showOrderDetails.set(true);
    } catch (err) {
      console.error('Error opening order details', err);
      this.selectedOrder.set(order);
      this.showOrderDetails.set(true);
    }
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

  /**
   * Ensure the selected date range has fromDate <= toDate.
   * If the user selected the dates in reverse, swap them so the UI always has a valid range.
   */
  private ensureDateOrder(): void {
    if (!this.fromDate || !this.toDate) return;

    try {
      const from = new Date(this.fromDate);
      const to = new Date(this.toDate);

      if (from.getTime() > to.getTime()) {
        // Swap them
        const oldFrom = this.fromDate;
        this.fromDate = this.toDate;
        this.toDate = oldFrom;
        // Reset pagination when swapping to avoid confusing page numbers
        this.currentPage.set(1);
        console.log('🔁 Date range swapped to maintain From <= To:', { from: this.fromDate, to: this.toDate });
      }
    } catch (err) {
      // If parsing fails, do nothing - validation will catch missing/invalid dates later
      console.warn('Could not ensure date order due to parse error', err);
    }
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

  // Formatting and item helpers used by the template
  formatCurrency(value: any): string {
    const n = Number(value ?? 0);
    return n.toLocaleString('en-US', { minimumFractionDigits: 2 });
  }

  getQuantity(item: any): number {
    return item?.quantity ?? 0;
  }

  getDiscount(item: any): number {
    return item?.discount ?? 0;
  }

  isVatExempt(item: any): boolean {
    return !!item?.isVatExempt;
  }

  getItemTotal(item: any): number {
    if (!item) return 0;
    if (item.total != null) return Number(item.total);
    const price = Number(item.price ?? 0);
    const qty = Number(item.quantity ?? 0);
    return price * qty;
  }

  getBatch(item: any): string {
    return item?.batchNumber || item?.batchId || '-';
  }

  /**
   * Build a stable dedupe key for an order object.
   * Preference order:
   *  - invoiceNumber (normalized, strip leading zeros)
   *  - id (if present)
   *  - fallback using customerName + totalAmount
   */
  private makeOrderKey(o: any): string {
    const inv = (o.invoiceNumber || o.invoice_number || '').toString().trim();
    if (inv) {
      // normalize invoice numbers by stripping leading zeros
      const normalized = inv.replace(/^0+/, '') || inv;
      return `inv:${normalized}`;
    }
    if (o.id) return `id:${o.id}`;
    const cust = (o.customerName || o.soldTo || '').toString().trim() || 'unknown';
    const total = Number(o.totalAmount ?? o.netAmount ?? o.grossAmount ?? 0);
    return `fallback:${cust}:${total}`;
  }

  // Sorting methods
  sort(column: string): void {
    const currentColumn = this.sortColumn();
    const currentDirection = this.sortDirection();

    if (currentColumn === column) {
      // Toggle direction if same column
      this.sortDirection.set(currentDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column and default to ascending
      this.sortColumn.set(column);
      this.sortDirection.set('asc');
    }

    // Reset to first page when sorting
    this.currentPage.set(1);
  }

  getSortIcon(column: string): string {
    const currentColumn = this.sortColumn();
    const direction = this.sortDirection();

    if (currentColumn !== column) {
      return 'M7 10L12 15L17 10H7Z'; // Neutral sort icon
    }

    return direction === 'asc' 
      ? 'M7 14L12 9L17 14H7Z' // Up arrow
      : 'M7 10L12 15L17 10H7Z'; // Down arrow
  }

  isSortedColumn(column: string): boolean {
    return this.sortColumn() === column;
  }

  getSortDisplayName(column: string): string {
    const displayNames: { [key: string]: string } = {
      'invoiceNumber': 'Invoice Number',
      'createdAt': 'Date & Time',
      'customerName': 'Customer',
      'itemsCount': 'Items Count',
      'totalAmount': 'Total Amount',
      'paymentMethod': 'Payment Method',
      'status': 'Status'
    };
    return displayNames[column] || column;
  }

}