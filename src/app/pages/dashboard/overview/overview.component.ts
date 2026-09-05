import { Component, inject, signal, computed, OnInit, effect } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { CommonModule } from '@angular/common';
import { StoreService, Store, dedupeStoresForDropdown, formatStoreDisplayName } from '../../../services/store.service';
import { ProductService } from '../../../services/product.service';
import { Product } from '../../../interfaces/product.interface';
import { Order } from '../../../interfaces/pos.interface';
import { OrderService } from '../../../services/order.service';
import { BigQueryService, convertPhilippineDateRangeToUtc } from '../../../services/bigquery.service';
import { AuthService } from '../../../services/auth.service';
import { IndexedDBService } from '@app/core/services/indexeddb.service';
import { ExpenseService } from '../../../services/expense.service';
import { ExpenseLog } from '../../../interfaces/expense-log.interface';
import { LedgerService } from '../../../services/ledger.service';
import { OrdersSellingTrackingService } from '../../../services/orders-selling-tracking.service';
import { Firestore, collection, query, where, orderBy, limit, getDocs } from '@angular/fire/firestore';
import { ConfirmationDialogComponent, ConfirmationDialogData } from '../../../shared/components/confirmation-dialog/confirmation-dialog.component';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule, ConfirmationDialogComponent],
  template: `
    <!-- Loading Overlay -->
    <div *ngIf="isLoading()" class="loading-overlay">
      <div class="loading-spinner"></div>
      <p class="loading-text">Loading dashboard data...</p>
    </div>

    <div class="dashboard-container">
      <!-- Header -->
      <div class="header">
        <div class="header-content">
          <h1 class="page-title">Dashboard Overview</h1>
          <p class="page-subtitle">Welcome, {{ currentUserName() }} 🎉 - Here's what's happening in your store</p>
          <!-- Overview controls: store selector and period -->
          <div class="overview-controls">
            <div class="control-row">
                <label class="control-label">Store</label>
                <ng-container *ngIf="storeList().length > 1; else singleStore">
                  <select class="control-select" (change)="onOverviewStoreChange($event)">
                    <option *ngFor="let s of storeList()" [value]="s.id" [selected]="selectedStoreId()===s.id">{{ formatStoreDisplayName(s) }}</option>
                  </select>
                </ng-container>
                <ng-template #singleStore>
                  <div class="single-store">
                    <span class="store-name">{{ storeList().length ? formatStoreDisplayName(storeList()[0]) : 'All Stores' }}</span>
                  </div>
                </ng-template>
              </div>

            <div class="control-row">
              <label class="control-label">Period</label>
              <select class="control-select" (change)="onOverviewPeriodChange($event)">
                <option *ngFor="let p of periodOptions" [value]="p.key" [selected]="selectedPeriod()===p.key">{{ p.label }}</option>
              </select>

              <div *ngIf="selectedPeriod()==='date_range'" class="date-range-inputs">
                <input type="date" class="control-input" [value]="dateFrom() || ''" (change)="dateFrom.set($any($event.target).value)" />
                <input type="date" class="control-input" [value]="dateTo() || ''" (change)="dateTo.set($any($event.target).value)" />
                <button class="control-go" (click)="onApplyDateRange()">Go</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Content Grid -->
      <div class="dashboard-grid">
        <!-- Left Sidebar: Sales Overview Cards -->
        <div class="sidebar">
          <!-- Overview Navigation -->
       

          <h2 class="sidebar-title">Sales Overview</h2>
          
          <!-- Sales Cards -->
          <div class="sales-cards">
            <!-- Total Revenue Card -->
            <div class="sales-card revenue-card">
              <div class="card-icon">
                <svg class="icon" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/>
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clip-rule="evenodd"/>
                </svg>
              </div>
              <div class="card-content">
                <div class="card-value">₱{{ totalRevenue() | number:'1.0-0' }}</div>
                <div class="card-label">Total Revenue</div>
                <div class="card-change">
                  <span class="change-icon">{{ revenueChange().symbol }}</span>
                  <span class="change-text">{{ revenueChange().percent | number:'1.1-1' }}% {{ comparisonLabel() }}</span>
                </div>
              </div>
            </div>

            <!-- Total Orders Card -->
            <div class="sales-card orders-card">
              <div class="card-icon">
                <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
                </svg>
              </div>
              <div class="card-content">
                <div class="card-value">Orders: ({{ ledgerOrderQty() }})</div>
                <div class="card-label">Items: ({{ totalItems() }})</div>
                <div class="card-change">
                  <span class="change-icon">{{ ordersChange().symbol }}</span>
                  <span class="change-text">{{ ordersChange().percent | number:'1.1-1' }}% {{ comparisonLabel() }}</span>
                </div>
              </div>
            </div>

            <!-- Cancelled / Void Card -->
            <div class="sales-card adjustments-card">
              <div class="card-icon">
                <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 6l12 12M18 6L6 18"/>
                </svg>
              </div>
              <div class="card-content">
                <div class="card-value">Cancelled / Void: ₱{{ ledgerCancelledAmount() | number:'1.0-0' }}</div>
                <div class="card-label">Orders ({{ ledgerCancelledQty() }})</div>
                <div class="card-change">
                  <span class="change-icon">×</span>
                  <span class="change-text">Cancelled transactions</span>
                </div>
              </div>
            </div>

            <!-- Returns / Refunds / Damage Cards (amount + qty) -->
            <div class="sales-card adjustments-card">
              <div class="card-icon">
                <svg class="icon" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6 2a1 1 0 00-1 1v3H3a1 1 0 000 2h2v3a1 1 0 001 1h3v2a1 1 0 102 0v-2h3a1 1 0 000-2h-3V6a1 1 0 00-1-1H6z"/>
                </svg>
              </div>
              <div class="card-content">
                <div class="card-value">Returns: ₱{{ ledgerReturnAmount() | number:'1.0-0' }} ({{ ledgerReturnQty() }})</div>
                <div class="card-label">Refunds: ₱{{ ledgerRefundAmount() | number:'1.0-0' }} ({{ ledgerRefundQty() }})</div>
                <div class="card-label">Damage: ₱{{ ledgerDamageAmount() | number:'1.0-0' }} ({{ ledgerDamageQty() }})</div>
              </div>
            </div>

            <!-- Unpaid Card -->
            <div class="sales-card unpaid-card">
              <div class="card-icon">
                <svg class="icon" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 11.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z"/>
                </svg>
              </div>
              <div class="card-content">
                <div class="card-value">₱{{ ledgerUnpaidAmount() | number:'1.0-0' }}</div>
                <div class="card-label">Unpaid ({{ ledgerUnpaidQty() }})</div>
                <div class="card-change">
                  <span class="change-icon">⏳</span>
                  <span class="change-text">Pending payments</span>
                </div>
              </div>
            </div>

            <!-- Recovered Card -->
            <div class="sales-card recovered-card">
              <div class="card-icon">
                <svg class="icon" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/>
                </svg>
              </div>
              <div class="card-content">
                <div class="card-value">₱{{ ledgerRecoveredAmount() | number:'1.0-0' }}</div>
                <div class="card-label">Recovered ({{ ledgerRecoveredQty() }})</div>
                <div class="card-change">
                  <span class="change-icon">✓</span>
                  <span class="change-text">Payments collected</span>
                </div>
              </div>
            </div>

            <!-- Total Expenses Card -->
            <div class="sales-card expenses-card">
              <div class="card-icon">
                <svg class="icon" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M4 3h12v2H4V3zm0 4h12v2H4V7zm0 4h8v2H4v-2z" />
                </svg>
              </div>
              <div class="card-content">
                <div class="card-value">₱{{ totalExpenses() | number:'1.0-0' }}</div>
                <div class="card-label">Total Expenses</div>
                <div class="card-change">
                  <span class="change-icon">{{ expenseChange().symbol }}</span>
                  <span class="change-text">{{ expenseChange().percent }}% Compared to yesterday</span>
                </div>
              </div>
            </div>

            <!-- Net Profit Card -->
            <div class="sales-card profit-card">
              <div class="card-icon">
                <svg class="icon" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 2l3 6 6 .5-4.5 3.5L16 18l-6-4-6 4 1.5-6L1 8.5 7 8 10 2z" />
                </svg>
              </div>
              <div class="card-content">
                <div class="card-value">₱{{ netProfit() | number:'1.0-0' }}</div>
                <div class="card-label">Net Profit</div>
                <div class="card-change">
                  <span class="change-icon">↗</span>
                  <span class="change-text">After expenses</span>
                </div>
              </div>
            </div>

            <!-- Total Customers Card -->
            <div class="sales-card customers-card">
              <div class="card-icon">
                <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"/>
                </svg>
              </div>
              <div class="card-content">
                <div class="card-value">{{ totalCustomers() }}</div>
                <div class="card-label">Total Customers</div>
                <div class="card-change">
                  <span class="change-icon">{{ customersChange().symbol }}</span>
                  <span class="change-text">{{ customersChange().percent | number:'1.1-1' }}% From Last Day</span>
                </div>
              </div>
            </div>

            <!-- Sales Stats Card removed -->
          </div>
        </div>

        <!-- Right Content: Charts and Analytics -->
        <div class="main-content">
          <!-- Orders Overview Chart -->
          <div class="chart-container">
            <div class="chart-header">
              <h3 class="chart-title">Orders Overview</h3>
              <!-- chart legend removed -->
            </div>
            <!-- Orders donut (no debug output) -->
            <div class="chart-content">
              <!-- Chart placeholder - can be replaced with actual chart library -->
              <div class="chart-placeholder">
                <svg viewBox="0 0 800 300" class="chart-svg">
                  <!-- Grid lines -->
                  <defs>
                    <pattern id="grid" width="80" height="60" patternUnits="userSpaceOnUse">
                      <path d="M 80 0 L 0 0 0 60" fill="none" stroke="#f3f4f6" stroke-width="1"/>
                    </pattern>
                  </defs>
                  <rect width="800" height="300" fill="url(#grid)" />
                  
                  <!-- Sample chart lines -->
                  <path d="M 50 250 Q 150 200 250 180 T 450 160 T 650 140 T 750 120" 
        fill="none" stroke="#f59e0b" stroke-width="3" stroke-linecap="round" [attr.d]="chartPath()"/>
      <path 
        fill="none" stroke="#8b5cf6" stroke-width="3" stroke-linecap="round" [attr.d]="chartPathProfit()"/>
                  
                  <!-- Data points -->
                  <circle cx="450" cy="160" r="4" fill="#f59e0b" stroke="white" stroke-width="2"/>
                  <text x="440" y="145" class="chart-label">{{ netProfit() | number:'1.0-0' }}</text>
                </svg>
                
                <!-- Orders donut (CSS conic-gradient) -->
                <div class="orders-pie-wrapper">
                  <div class="orders-pie">
                    <div class="orders-donut" [style.background]="pieGradient()">
                      <div class="orders-donut-hole"></div>
                    </div>
                    <div class="orders-pie-center">
                      <div class="orders-count">{{ totalOrders() || 0 }}</div>
                      <div class="orders-profit">₱{{ (netProfit() !== 0 ? netProfit() : 0) | number:'1.0-0' }}</div>
                    </div>
                  </div>
                    <div class="orders-pie-legend">
                    <div class="legend-item"><div class="legend-dot completed-dot"></div><span>Completed</span><span class="legend-percent">{{ salesAnalytics().completed.percentage | number:'1.1-1' }}%</span></div>
                    <div class="legend-item"><div class="legend-dot cancelled-dot"></div><span>Cancelled</span><span class="legend-percent">{{ salesAnalytics().cancelled.percentage | number:'1.1-1' }}%</span></div>
                    <div class="legend-item"><div class="legend-dot returned-dot"></div><span>Returned</span><span class="legend-percent">{{ salesAnalytics().returned.percentage | number:'1.1-1' }}%</span></div>
                    <div class="legend-item"><div class="legend-dot refunded-dot"></div><span>Refunded</span><span class="legend-percent">{{ salesAnalytics().refunded.percentage | number:'1.1-1' }}%</span></div>
                    <div class="legend-item"><div class="legend-dot damage-dot"></div><span>Damage</span><span class="legend-percent">{{ salesAnalytics().damage.percentage | number:'1.1-1' }}%</span></div>
                  </div>
                </div>
            </div>
          </div>

          <!-- Bottom Analytics Row -->
          <div class="analytics-row">
            <!-- Sale Analytics -->
            <div class="analytics-card">
              <h3 class="analytics-title">Sale Analytics</h3>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <div style="display:flex;gap:8px;align-items:center;">
                </div>
              </div>
              <div class="donut-chart">
                <div class="sales-analytics-table">
                  <table class="analytics-table">
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th class="text-right">Count</th>
                        <th class="text-right">Percentage</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr class="completed-row">
                        <td>
                          <div class="status-label">
                            <span class="status-dot completed-dot"></span>
                            <span>Completed</span>
                          </div>
                        </td>
                        <td class="text-right">{{ salesAnalytics().completed.count }}</td>
                        <td class="text-right">{{ salesAnalytics().completed.percentage | number:'1.1-1' }}%</td>
                      </tr>
                      <tr class="cancelled-row">
                        <td>
                          <div class="status-label">
                            <span class="status-dot cancelled-dot"></span>
                            <span>Cancelled</span>
                          </div>
                        </td>
                        <td class="text-right">{{ salesAnalytics().cancelled.count }}</td>
                        <td class="text-right">{{ salesAnalytics().cancelled.percentage | number:'1.1-1' }}%</td>
                      </tr>
                      <tr class="returned-row">
                        <td>
                          <div class="status-label">
                            <span class="status-dot returned-dot"></span>
                            <span>Returned</span>
                          </div>
                        </td>
                        <td class="text-right">{{ salesAnalytics().returned.count }}</td>
                        <td class="text-right">{{ salesAnalytics().returned.percentage | number:'1.1-1' }}%</td>
                      </tr>
                      <tr class="refunded-row">
                        <td>
                          <div class="status-label">
                            <span class="status-dot refunded-dot"></span>
                            <span>Refunded</span>
                          </div>
                        </td>
                        <td class="text-right">{{ salesAnalytics().refunded.count }}</td>
                        <td class="text-right">{{ salesAnalytics().refunded.percentage | number:'1.1-1' }}%</td>
                      </tr>
                      <tr class="damage-row">
                        <td>
                          <div class="status-label">
                            <span class="status-dot damage-dot"></span>
                            <span>Damage</span>
                          </div>
                        </td>
                        <td class="text-right">{{ salesAnalytics().damage.count }}</td>
                        <td class="text-right">{{ salesAnalytics().damage.percentage | number:'1.1-1' }}%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <!-- Top Products -->
            <div class="analytics-card">
              <h3 class="analytics-title">Top Products</h3>
              <div style="display:flex;justify-content:flex-end;margin-bottom:8px;">
              </div>
              <div class="products-list">
                <div class="products-header">
                  <span>Product</span>
                  <span>Sales</span>
                </div>
                <div class="product-item" *ngFor="let product of topProducts()">
                  <div class="product-info">
                    <div class="product-avatar">{{ product.avatar }}</div>
                    <div class="product-details">
                      <span class="product-name">{{ product.name }}</span>
                      <span class="product-sku" *ngIf="product.skuId">{{ product.skuId }}</span>
                    </div>
                  </div>
                  <span class="product-sales">{{ product.sales || 0 }}</span>
                </div>
                
                <!-- Show message if no products -->
                <div *ngIf="topProducts().length === 0" class="no-products">
                  <p>No product data available</p>
                  <small>Products will appear here once orders are processed</small>
                </div>
                
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Confirmation Dialog -->
    <app-confirmation-dialog
      *ngIf="showConfirmDialog()"
      [dialogData]="confirmDialogData()"
      (confirmed)="onConfirmDialog()"
      (cancelled)="onCancelDialog()"
    />
  `,
  styles: [`
    /* Loading Overlay */
    .loading-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.95);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      backdrop-filter: blur(4px);
    }

    .loading-spinner {
      width: 48px;
      height: 48px;
      border: 4px solid #e5e7eb;
      border-top-color: #667eea;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .loading-text {
      margin-top: 16px;
      color: #6b7280;
      font-size: 1rem;
      font-weight: 500;
    }

    .dashboard-container {
      min-height: 100vh;
      background-color: #f9fafb;
      padding: 24px;
    }

    .header {
      margin-bottom: 32px;
    }

    .header-content {
      max-width: 1200px;
      margin: 0 auto;
    }

    .page-title {
      font-size: 2rem;
      font-weight: 700;
      color: #111827;
      margin: 0 0 8px 0;
    }

    .page-subtitle {
      color: #6b7280;
      font-size: 1rem;
      margin: 0;
    }

    @media (max-width: 640px) {
      .dashboard-container {
        padding: 12px;
      }

      .header {
        margin-bottom: 16px;
      }
    }

    /* Overview controls */
    .overview-controls {
      display: flex;
      gap: 12px;
      align-items: center;
      margin-top: 12px;
      flex-wrap: wrap;
    }

    .overview-controls .control-row {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .control-label { font-weight: 600; color: #374151; }
    .control-select { padding: 6px 8px; border-radius: 8px; border: 1px solid #e5e7eb; background: white; }
    .control-input { padding: 6px 8px; border-radius: 8px; border: 1px solid #e5e7eb; }
    .control-go { background: #3b82f6; color: white; border: none; padding: 6px 10px; border-radius: 8px; cursor: pointer; }

    .dashboard-grid {
      display: grid;
      grid-template-columns: 300px 1fr;
      gap: 24px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .sidebar {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .nav-section {
      margin-bottom: 24px;
    }

    .nav-title {
      font-size: 1rem;
      font-weight: 600;
      color: #111827;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-size: 0.875rem;
    }

    .nav-menu {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .nav-item {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      background: white;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      border: 1px solid #e5e7eb;
      gap: 12px;
    }

    .nav-item:hover {
      background: #f9fafb;
      border-color: #d1d5db;
      transform: translateY(-1px);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }

    .nav-item.active {
      background: #eff6ff;
      border-color: #3b82f6;
      color: #3b82f6;
    }

    .nav-icon {
      width: 20px;
      height: 20px;
      color: #6b7280;
      flex-shrink: 0;
    }

    .nav-item.active .nav-icon {
      color: #3b82f6;
    }

    .nav-label {
      flex: 1;
      font-size: 0.875rem;
      font-weight: 500;
      color: #374151;
    }

    .nav-item.active .nav-label {
      color: #3b82f6;
      font-weight: 600;
    }

    .sidebar-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: #111827;
      margin-bottom: 8px;
      /* Tab background to match pie chart "Completed" color */
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #ffffff;
      display: inline-block;
      padding: 6px 10px;
      border-radius: 8px;
    }

    .sales-cards {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .sales-card {
      background: white;
      border-radius: 16px;
      padding: 14px 18px;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.08);
      border: 1px solid #e5e7eb;
      min-height: 68px; /* slightly shorter height */
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .expenses-card { background: #ef4444; }
    .profit-card { background: #10b981; }

    .revenue-card {
      background: #06b6d4;
    }

    .orders-card {
      background: #ec4899;
    }

    .customers-card {
      background: #38bdf8;
    }

    .adjustments-card {
      background: #f97316;
    }

    .unpaid-card {
      background: #f59e0b;
    }

    .recovered-card {
      background: #06b6d4;
    }

    .card-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: rgba(0, 0, 0, 0.06);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .icon {
      width: 20px;
      height: 20px;
      color: white;
    }

    .card-value {
      font-size: 1.625rem;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 0;
    }

    .card-label {
      font-size: 0.875rem;
      color: #ffffff;
      margin-bottom: 0;
    }

    .card-change {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.85rem;
    }

    .change-icon {
      color: #10b981;
      font-weight: 600;
    }

    .change-text {
      color: #ffffff;
    }

    .stats-card {
      background: white;
    }

    .stats-title {
      font-size: 1rem;
      font-weight: 600;
      color: #ffffff;
      margin-bottom: 16px;
    }

    .stats-grid {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 16px;
    }

    .stat-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .stat-label {
      font-size: 0.875rem;
      color: #6b7280;
    }

    .stat-value {
      font-weight: 600;
      color: #111827;
    }

    .stats-footer {
      display: flex;
      align-items: center;
      gap: 4px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
      font-size: 0.875rem;
    }

    .company-section {
      margin-top: 24px;
    }

    .section-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: #111827;
      margin-bottom: 12px;
    }

    .company-menu {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .menu-item {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      background: white;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      border: 1px solid #e5e7eb;
      gap: 12px;
    }

    .menu-item:hover {
      background: #f9fafb;
      border-color: #d1d5db;
      transform: translateY(-1px);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }

    .menu-icon {
      width: 20px;
      height: 20px;
      color: #6b7280;
      flex-shrink: 0;
    }

    .menu-label {
      flex: 1;
      font-size: 0.875rem;
      font-weight: 500;
      color: #374151;
    }

    .menu-arrow {
      width: 16px;
      height: 16px;
      color: #9ca3af;
      transition: transform 0.2s ease;
    }

    .menu-item:hover .menu-arrow {
      transform: translateX(2px);
    }

    .main-content {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .chart-container {
      background: white;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
      border: 1px solid #e5e7eb;
    }

    .chart-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }

    .chart-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: #111827;
    }

    .chart-legend {
      display: flex;
      gap: 24px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.875rem;
      color: #6b7280;
    }

    .legend-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }

    .orders-dot {
      background-color: #f59e0b;
    }

    .profit-dot {
      background-color: #8b5cf6;
    }

    .chart-content {
      height: 300px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 24px;
    }

    .chart-placeholder {
      height: 100%;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      width: 520px;
    }

    .chart-svg {
      width: 100%;
      height: 100%;
    }

    .chart-label {
      font-size: 12px;
      fill: #6b7280;
      font-weight: 500;
    }

    .chart-labels {
      display: flex;
      justify-content: space-between;
      margin-top: 12px;
      padding: 0 40px;
      font-size: 0.875rem;
      color: #6b7280;
    }

    .analytics-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }

    .analytics-card {
      background: white;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
      border: 1px solid #e5e7eb;
    }

    .analytics-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: #111827;
      margin-bottom: 20px;
    }

    .donut-chart {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
    }

    .donut-container {
      position: relative;
      width: 120px;
      height: 120px;
    }

    .donut-svg {
      width: 100%;
      height: 100%;
      transform: rotate(-90deg);
    }

    .donut-center {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
    }

    .donut-percentage {
      font-size: 1.5rem;
      font-weight: 700;
      color: #111827;
    }

    .donut-label {
      font-size: 0.75rem;
      color: #6b7280;
    }

    .donut-legend {
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 100%;
    }

    .donut-legend .legend-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .legend-percent {
      font-weight: 600;
      color: #111827;
    }

    .completed-dot {
      background-color: #06b6d4;
    }

    .returned-dot {
      background-color: #f97316;
    }

    .distributed-dot {
      background-color: #8b5cf6;
    }
    .cancelled-dot {
      background-color: #ef4444;
    }
    .refunded-dot {
      background-color: #f59e0b;
    }
    .damage-dot {
      background-color: #8b5cf6;
    }
    .analytics-expenses {
      margin-top: 12px;
      padding: 10px 12px;
      border-radius: 8px;
      background: #f8fafc;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border: 1px solid #eef2ff;
    }
    .analytics-expenses .expenses-label { color: #6b7280; font-size: 0.875rem; }
    .analytics-expenses .expenses-value { font-weight: 700; color: #111827; }

    .products-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .products-header {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      color: #6b7280;
      letter-spacing: 0.05em;
      padding-bottom: 8px;
      border-bottom: 1px solid #e5e7eb;
    }

    .product-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
    }

    .product-info {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
    }

    .product-avatar {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: #8b5cf6;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 600;
      flex-shrink: 0;
    }

    .product-details {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .product-name {
      font-size: 0.875rem;
      font-weight: 500;
      color: #111827;
    }

    .product-sku {
      font-size: 0.75rem;
      color: #6b7280;
    }

    .product-sales {
      font-size: 0.875rem;
      font-weight: 700;
      color: #111827;
    }

    .debug-btn {
      background: #111827;
      color: white;
      border: none;
      padding: 6px 10px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.8rem;
    }

    .debug-panel {
      margin-top: 12px;
      background: #0f172a;
      color: #d1fae5;
      padding: 12px;
      border-radius: 8px;
      overflow: auto;
      max-height: 200px;
    }

    /* Bar chart styles */
    .bar-chart { display: flex; flex-direction: column; gap: 12px; }
    .bar-chart-header { display:flex; justify-content:space-between; gap:12px; }
    .bar-chart-title { display:flex; flex-direction:column; }
    .bar-chart-orders { font-weight:700; font-size:1.25rem; }
    .bar-chart-profit { font-weight:700; color:#ef4444; }
    .bars { display:flex; flex-direction:column; gap:8px; }
    .bar-row { display:flex; align-items:center; gap:12px; }
    .bar-label { width:90px; color:#6b7280; font-weight:600; }
    .bar { flex:1; height:12px; background:#f3f4f6; border-radius:6px; overflow:hidden; }
    .bar-fill { height:100%; border-radius:6px; }
    .bar-fill.completed { background:#06b6d4; }
    .bar-fill.cancelled { background:#ef4444; }
    .bar-fill.returned { background:#f97316; }
    .bar-fill.refunded { background:#f59e0b; }
    .bar-fill.damage { background:#8b5cf6; }
    .bar-fill.no-data { background:#eab308; }
    .bar-percent { width:48px; text-align:right; font-weight:600; color:#111827; }

    /* Sales Analytics Table */
    .sales-analytics-table {
      width: 100%;
      overflow-x: auto;
    }

    .analytics-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 1rem;
    }

    .analytics-table thead {
      background: #f9fafb;
      border-bottom: 2px solid #e5e7eb;
    }

    .analytics-table th {
      padding: 12px 16px;
      text-align: left;
      font-weight: 600;
      color: #374151;
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .analytics-table th.text-right {
      text-align: right;
    }

    .analytics-table tbody tr {
      border-bottom: 1px solid #f3f4f6;
      transition: background-color 0.15s ease;
    }

    .analytics-table tbody tr:hover {
      background: #f9fafb;
    }

    .analytics-table td {
      padding: 14px 16px;
      color: #111827;
      font-size: 1rem;
      font-weight: 500;
    }

    .analytics-table td.text-right {
      text-align: right;
    }

    .status-label {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .status-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .completed-row:hover {
      background: #ecfeff !important;
    }

    .cancelled-row:hover {
      background: #fef2f2 !important;
    }

    .returned-row:hover {
      background: #fff7ed !important;
    }

    .refunded-row:hover {
      background: #fffbeb !important;
    }

    .damage-row:hover {
      background: #faf5ff !important;
    }

    @media (max-width: 768px) {
      .analytics-table {
        font-size: 0.9rem;
      }

      .analytics-table th {
        padding: 10px 12px;
        font-size: 0.8rem;
      }

      .analytics-table td {
        padding: 12px;
        font-size: 0.9rem;
      }

      .status-dot {
        width: 10px;
        height: 10px;
      }
    }

    @media (max-width: 640px) {
      .analytics-table {
        font-size: 0.85rem;
      }

      .analytics-table th {
        padding: 8px 10px;
        font-size: 0.75rem;
      }

      .analytics-table td {
        padding: 10px;
        font-size: 0.85rem;
      }

      .status-label {
        gap: 8px;
      }

      .status-dot {
        width: 8px;
        height: 8px;
      }
    }

    /* Orders Overview pie chart */
    .orders-pie-wrapper { display:flex; gap:20px; align-items:center; margin-top:12px; }
    .orders-pie { position: relative; width:220px; height:220px; }
    /* Donut via CSS conic-gradient */
    .orders-donut { width:220px; height:220px; border-radius:50%; position:relative; }
    .orders-donut-hole { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:110px; height:110px; background:white; border-radius:50%; box-shadow:0 1px 3px rgba(0,0,0,0.05); display:flex; align-items:center; justify-content:center; }
    .orders-pie-center { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); text-align:center; }
    .orders-count { font-weight:700; font-size:1.25rem; }
    .orders-profit { font-size:0.95rem; color:#ef4444; }
    .orders-pie-legend { display:flex; flex-direction:column; gap:6px; }
    .orders-pie-legend .legend-item { display:flex; align-items:center; gap:8px; }

    /* orders-pie-debug removed */

    /* Responsive Design */
    @media (max-width: 1024px) {
      .dashboard-grid {
        grid-template-columns: 1fr;
        gap: 16px;
      }

      .sidebar {
        order: 2;
      }

      .main-content {
        order: 1;
      }

      .analytics-row {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 768px) {
      .dashboard-container {
        padding: 12px; /* Reduced from 16px */
      }

      .page-title {
        font-size: 1.375rem; /* Slightly reduced */
      }

      .page-subtitle {
        font-size: 0.8125rem; /* Slightly reduced */
      }

      .overview-controls {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
      }

      .overview-controls .control-row {
        flex-direction: column;
        gap: 4px;
      }

      .control-select, .control-input {
        width: 100%;
        font-size: 0.875rem; /* Smaller text */
      }

      .date-range-inputs {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .chart-content {
        height: 180px; /* Reduced from 200px */
        flex-direction: column;
      }

      .chart-placeholder {
        width: 100%;
        height: 130px; /* Reduced from 150px */
      }

      .sales-cards {
        gap: 6px; /* Reduced from 8px */
      }

      .sales-card {
        padding: 10px; /* Reduced from 12px */
        min-height: auto;
        flex-direction: column;
        align-items: flex-start;
        gap: 6px; /* Reduced from 8px */
      }

      .card-content {
        width: 100%;
      }

      .card-value {
        font-size: 1.125rem; /* Reduced from 1.25rem */
      }

      .card-label {
        font-size: 0.6875rem; /* Reduced from 0.75rem */
      }

      .card-change {
        font-size: 0.6875rem; /* Reduced from 0.75rem */
      }
    }

    @media (max-width: 640px) {
      .dashboard-container {
        padding: 4px; /* Further reduced from 8px */
        margin-left: -2px; /* Move everything more to the left */
      }

      .header {
        margin-bottom: 8px; /* Reduced from 12px */
        margin-left: -2px; /* Move header content left */
      }

      .page-title {
        font-size: 1rem; /* Further reduced from 1.125rem */
        margin-bottom: 2px;
      }

      .page-subtitle {
        font-size: 0.6875rem; /* Further reduced from 0.75rem */
        margin-bottom: 6px; /* Reduced from 8px */
      }

      .dashboard-grid {
        gap: 6px; /* Reduced from 8px */
        margin-left: -2px; /* Move grid content left */
      }

      .chart-container {
        padding: 6px; /* Further reduced from 8px */
        margin-left: -6px; /* Move more to the left */
        margin-right: -4px; /* Extend to right edge */
      }

      .sales-cards {
        margin-left: -6px; /* Move further to the left */
        margin-right: -4px; /* Extend to right edge */
        max-width: calc(100vw - 12px); /* Limit width to viewport */
        margin-bottom: 12px; /* Add spacing after sales cards */
      }

      .sales-card {
        padding: 6px; /* Further reduced from 8px */
        border-radius: 6px; /* Reduced from 8px */
        min-height: 45px; /* Reduced from 50px */
        margin: 0 2px 4px 2px; /* Reduced margins */
        max-width: calc(100vw - 24px); /* Match chart header width constraint */
        width: calc(100% - 16px); /* Responsive width, more constrained */
      }

      .card-icon {
        width: 24px; /* Further reduced from 28px */
        height: 24px;
        border-radius: 4px; /* Reduced from 6px */
      }

      .icon {
        width: 12px; /* Further reduced from 14px */
        height: 12px;
      }

      .card-value {
        font-size: 0.9375rem; /* Reduced from 1rem */
        line-height: 1.1;
      }

      .card-label {
        font-size: 0.625rem; /* Reduced from 0.6875rem */
      }

      .card-change {
        font-size: 0.5625rem; /* Reduced from 0.625rem */
      }

      .sidebar-title {
        font-size: 0.8125rem; /* Reduced from 0.875rem */
        padding: 2px 4px; /* Reduced from 3px 6px */
      }

      .analytics-card {
        padding: 8px; /* Reduced from 12px */
        margin-left: -6px; /* Move more to the left */
        margin-right: -4px; /* Extend to right edge */
        margin-top: 16px; /* Add spacing from orders overview */
      }

      .analytics-title {
        font-size: 0.8125rem; /* Reduced from 0.875rem */
        margin-bottom: 6px; /* Reduced from 8px */
      }

      .donut-container {
        width: 70px; /* Further reduced from 80px */
        height: 70px;
      }

      .donut-center-text {
        font-size: 0.6875rem; /* Reduced from 0.75rem */
      }

      /* Horizontal scroll for controls if needed */
      .overview-controls {
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        padding: 0 2px; /* Reduced from 4px */
        margin-left: -2px; /* Move controls left */
      }

      .control-label {
        font-size: 0.6875rem; /* Reduced from 0.75rem */
      }

      .control-select, .control-input {
        font-size: 0.6875rem; /* Reduced from 0.75rem */
        padding: 3px 4px; /* Reduced padding */
      }

      /* Make sure chart svg is responsive */
      .chart-svg {
        max-width: 100%;
        height: auto;
      }

      /* Adjust spacing for mobile */
      .chart-labels {
        padding: 0 8px; /* Reduced from 12px */
        font-size: 0.5625rem; /* Reduced from 0.625rem */
      }

      /* Make analytics items smaller */
      .stat-label, .stat-value {
        font-size: 0.6875rem; /* Reduced from 0.75rem */
      }

      /* Reduce legend spacing */
      .legend-item {
        font-size: 0.6875rem; /* Reduced from 0.75rem */
        gap: 2px; /* Reduced gap */
      }

      /* Mobile bar-chart optimizations */
      .bar-chart {
        gap: 6px; /* Reduced from 12px */
        padding: 4px; /* Add compact padding */
      }

      .bars {
        gap: 4px; /* Reduced from 8px */
      }

      .bar-row {
        gap: 6px; /* Reduced from 12px */
        align-items: center;
        min-width: 0;
      }

      .bar-label {
        width: 60px; /* Reduced from 90px */
        flex: 0 0 60px;
        font-size: 0.6875rem; /* Smaller font size */
        font-weight: 500; /* Reduced from 600 */
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .bar {
        flex: 1 1 auto;
        height: 8px; /* Reduced from 12px */
        border-radius: 4px; /* Reduced from 6px */
        min-width: 0;
      }

      .bar-fill {
        border-radius: 4px; /* Match bar border-radius */
      }

      .bar-percent {
        width: 44px; /* Ensure % text doesn't overlap on Android */
        flex: 0 0 44px;
        font-size: 0.625rem; /* Smaller font size */
        font-weight: 500; /* Reduced from 600 */
        white-space: nowrap;
      }

      .legend-dot {
        width: 6px; /* Further reduced from 8px */
        height: 6px;
      }

      /* Compact main content */
      .main-content {
        padding: 2px; /* Further reduced padding */
        margin-left: -2px; /* Move main content left */
      }

      /* Orders Overview specific adjustments */
      .chart-header {
        margin-bottom: 4px; /* Reduced spacing */
        margin-left: -2px; /* Move header left */
      }

      .chart-container {
        padding: 6px; /* Further reduced from 8px */
        margin-left: -6px; /* Move more to the left */
        margin-right: -4px; /* Extend to right edge */
        margin-bottom: 8px; /* Add spacing after chart container */
      }

      /* Sales Analytics specific adjustments */
      .analytics-row {
        margin-left: -4px; /* Move analytics left */
        margin-right: -2px; /* Extend to right */
        margin-top: 12px; /* Add spacing from previous section */
      }

      /* Make donut chart text smaller */
      .donut-svg text {
        font-size: 0.625rem !important; /* Force smaller text */
      }

      /* Reduce analytics spacing */
      .analytics-card .stat-item {
        padding: 2px 0; /* Reduce item spacing */
      }
    }
  `]
})
export class OverviewComponent implements OnInit {
    // --- Template method/property stubs for build ---
    // (Removed duplicate stub methods; real implementations exist later in the class)
  private storeService = inject(StoreService);
  private productService = inject(ProductService);
  private orderService = inject(OrderService);
  private bigQueryService = inject(BigQueryService);
  private authService = inject(AuthService);
  private indexedDb = inject(IndexedDBService);
  private expenseService = inject(ExpenseService);
  private ledgerService = inject(LedgerService);
  private ordersSellingTrackingService = inject(OrdersSellingTrackingService);
  private firestore = inject(Firestore);

  // Confirmation Dialog
  protected showConfirmDialog = signal<boolean>(false);
  protected confirmDialogData = signal<ConfirmationDialogData>({
    title: '',
    message: '',
    confirmText: 'OK',
    type: 'info'
  });


  // Signals
  protected readonly formatStoreDisplayName = formatStoreDisplayName;
  protected stores = signal<Store[]>([]);
  protected products = signal<Product[]>([]);
  protected orders = signal<Order[]>([]);
  protected expenses = signal<ExpenseLog[]>([]);
  // Aggregates for expenses: month-to-date and yesterday totals (in PHP, not cents)
  protected monthExpensesTotal = signal<number>(0);
  protected yesterdayExpensesTotal = signal<number>(0);
  // BigQuery-backed summary totals for the dashboard cards
  protected salesSummary = signal({ totalSales: 0, totalOrders: 0, totalItems: 0 });
  protected statusBreakdown = signal<Array<{ status: string; count: number; amount: number }>>([]);
  protected ledgerTotalRevenue = signal<number>(0);
  protected ledgerTotalOrders = signal<number>(0);
  protected ledgerTotalRefunds = signal<number>(0);
  protected ledgerCancelledAmount = signal<number>(0);
  protected ledgerCancelledQty = signal<number>(0);
  // Totals for adjustments
  protected ledgerReturnAmount = signal<number>(0);
  protected ledgerReturnQty = signal<number>(0);
  protected ledgerRefundAmount = signal<number>(0);
  protected ledgerRefundQty = signal<number>(0);
  protected ledgerDamageAmount = signal<number>(0);
  protected ledgerDamageQty = signal<number>(0);
  protected ledgerUnpaidAmount = signal<number>(0);
  protected ledgerUnpaidQty = signal<number>(0);
  protected ledgerOutstandingUnpaidAmount = signal<number>(0);
  protected ledgerOutstandingUnpaidQty = signal<number>(0);
  protected ledgerRecoveredAmount = signal<number>(0);
  protected ledgerRecoveredQty = signal<number>(0);
  protected ledgerCompletedAmount = signal<number>(0);
  // Ledger-sourced order counts
  protected ledgerOrderQty = signal<number>(0);
  protected ledgerItemsQty = signal<number>(0);
  protected ledgerCancelQty = signal<number>(0);
  protected netItemsQty = computed(() => Math.max(0, this.ledgerItemsQty() - this.ledgerCancelQty()));
  protected ledgerCompletedQty = signal<number>(0);
  protected topProductsList = signal<any[]>([]);
  protected selectedStoreId = signal<string>('all');
  protected isLoading = signal<boolean>(true);
  private analyticsLoadInProgress = false;
  private overviewLoadSequence = 0;

  // UI controls for overview filtering
  protected periodOptions = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'this_week', label: 'This Week' },
    { key: 'previous_week', label: 'Previous Week' },
    { key: 'this_month', label: 'This Month' },
    { key: 'previous_month', label: 'Previous Month' },
    { key: 'date_range', label: 'Date Range' }
  ];
  protected selectedPeriod = signal<'today' | 'yesterday' | 'this_week' | 'previous_week' | 'this_month' | 'previous_month' | 'date_range'>('today');
  protected dateFrom = signal<string | null>(null); // YYYY-MM-DD
  protected dateTo = signal<string | null>(null);
  protected dateRangeRevenue = signal<number>(0);
  protected dateRangeOrders = signal<number>(0);
  protected previousDateRangeRevenue = signal<number>(0);
  protected previousDateRangeOrders = signal<number>(0);

  // Computed values
  protected currentUserName = computed(() => {
    const user = this.authService.getCurrentUser();
    
    // Get displayName from Firestore user data, fallback to email or 'User'
    return user?.displayName || 
           user?.email?.split('@')[0] || 
           'User';
  });
  
  protected totalStores = computed(() => this.stores().length);
  protected storeList = computed(() => dedupeStoresForDropdown(this.stores()));
  protected totalProducts = computed(() => this.products().length);
  protected lowStockCount = computed(() => 
    this.products().filter(p => p.totalStock <= 10).length
  );
  protected recentProducts = computed(() => 
    [...this.products()]
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
      .slice(0, 5)
  );
  
  // Filtered orders based on selected period for client-side safety
  protected filteredOrders = computed(() => {
    const allOrders = this.orders();
    const period = this.selectedPeriod();
    const now = new Date();
    
    let dateFromStr: string;
    let dateToStr: string;
    
    if (period === 'today') {
      dateFromStr = this.formatDateAsString(now);
      dateToStr = this.formatDateAsString(now);
    } else if (period === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      dateFromStr = this.formatDateAsString(yesterday);
      dateToStr = this.formatDateAsString(yesterday);
    } else if (period === 'this_week') {
      const nowWeekDay = now.getDay();
      const mondayOffset = (nowWeekDay + 6) % 7;
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - mondayOffset);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      dateFromStr = this.formatDateAsString(weekStart);
      dateToStr = this.formatDateAsString(weekEnd);
    } else if (period === 'previous_week') {
      const nowWeekDay = now.getDay();
      const mondayOffset = (nowWeekDay + 6) % 7;
      const currentWeekStart = new Date(now);
      currentWeekStart.setDate(now.getDate() - mondayOffset);
      const prevWeekStart = new Date(currentWeekStart);
      prevWeekStart.setDate(currentWeekStart.getDate() - 7);
      const prevWeekEnd = new Date(prevWeekStart);
      prevWeekEnd.setDate(prevWeekStart.getDate() + 6);
      dateFromStr = this.formatDateAsString(prevWeekStart);
      dateToStr = this.formatDateAsString(prevWeekEnd);
    } else if (period === 'this_month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      dateFromStr = this.formatDateAsString(monthStart);
      dateToStr = this.formatDateAsString(monthEnd);
    } else if (period === 'previous_month') {
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      dateFromStr = this.formatDateAsString(prevMonthStart);
      dateToStr = this.formatDateAsString(prevMonthEnd);
    } else if (period === 'date_range') {
      dateFromStr = this.dateFrom() || '';
      dateToStr = this.dateTo() || '';
    } else {
      return allOrders; // Fallback
    }
    
    if (!dateFromStr || !dateToStr) {
      return allOrders;
    }
    
    // Convert from device's local time to UTC (works for ANY timezone)
    const range = convertPhilippineDateRangeToUtc(dateFromStr, dateToStr);
    const start = range.start;
    const end = range.end;
    
    // Filter orders by createdAt within the date range
    return allOrders.filter(o => {
      const orderDate = o.createdAt ? new Date(o.createdAt) : null;
      if (!orderDate) return false;
      return orderDate >= start && orderDate <= end;
    });
  });

  /**
   * Formats a Date object as YYYY-MM-DD string (local date)
   * @param date Date object to format
   * @returns Date string in YYYY-MM-DD format
   */
  private formatDateAsString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  protected totalRevenue = computed(() => {
    if (this.bigQueryRevenueLoaded()) {
      return Math.max(0, this.bigQueryRevenue());
    }
    const summary = this.salesSummary();
    const adjustedRevenue = summary.totalSales - this.ledgerRefundAmount() - this.ledgerDamageAmount();
    return Math.max(0, adjustedRevenue || this.dateRangeRevenue());
  });
  protected revenueSource = computed(() => this.bigQueryRevenueLoaded() ? 'BigQuery' : 'fallback');
  protected totalOrders = computed(() => {
    const summary = this.salesSummary();
    if (summary.totalOrders > 0) {
      return Math.max(0, summary.totalOrders);
    }
    return Math.max(0, this.orders().length || this.dateRangeOrders() || 0);
  });
  protected totalItems = computed(() => {
    const summary = this.salesSummary();
    const excludedItems = this.ledgerCancelledQty() + this.ledgerReturnQty();
    if (summary.totalItems > 0) {
      return Math.max(0, summary.totalItems - excludedItems);
    }
    return Math.max(0, this.orders()
      .filter(order => String(order.status || '').toLowerCase() === 'completed')
      .reduce((sum, order: any) => sum + (Number(order.itemCount || order.totalItems || 0) || 0), 0) - excludedItems);
  });
  // Total expenses shown on the card should reflect the active period.
  // For date-range mode, use the explicit range total; otherwise keep the
  // month-scoped aggregate used by the standard period selectors.
  protected totalExpenses = computed(() => {
    if (this.selectedPeriod() === 'date_range') {
      return (this.expenses() || []).reduce((s, e) => s + (Number((e as any).amount || 0) / 100), 0);
    }
    return this.monthExpensesTotal();
  });

  // Change vs yesterday: symbol and percent
  protected expenseChange = computed(() => {
    const current = this.totalExpenses();
    const yesterday = this.yesterdayExpensesTotal();
    const diff = current - yesterday;
    const percent = (() => {
      if (yesterday === 0) return (current === 0 ? 0 : 100);
      const raw = (Math.abs(diff) / yesterday) * 100;
      return Math.round(raw * 10) / 10; // one decimal place
    })();
    const symbol = diff > 0 ? '↗' : (diff < 0 ? '↘' : '→');
    return { symbol, percent, diff };
  });
  protected netProfit = computed(() =>
    this.totalRevenue() + this.ledgerRecoveredAmount() - this.totalExpenses()
  );
  protected totalCustomers = computed(() => {
    // Customers: not tracked in ledger, fallback to 0
    return 0;
  });
  protected todayOrders = computed(() => {
    // Always use ledgerCompletedQty
    return Math.max(0, this.ledgerCompletedQty());
  });

  protected revenueForDay = (date: Date) => {
    const start = new Date(date); start.setHours(0,0,0,0);
    const end = new Date(date); end.setHours(23,59,59,999);
    const orders = this.orders() || [];
    return orders.reduce((s, o) => {
      const d = o.createdAt ? new Date(o.createdAt) : null;
      if (!d) return s;
      const t = d.getTime();
      if (t >= start.getTime() && t <= end.getTime()) {
        return s + (Number(o.netAmount ?? o.totalAmount ?? 0) || 0);
      }
      return s;
    }, 0);
  }

  // Store yesterday's revenue and orders for comparison
  protected yesterdayRevenue = signal<number>(0);
  protected yesterdayOrders = signal<number>(0);
  protected currentMonthRevenue = signal<number>(0);
  protected currentMonthOrders = signal<number>(0);
  protected previousMonthRevenue = signal<number>(0);
  protected previousMonthOrders = signal<number>(0);
  protected selectedDayOrderRevenue = signal<number>(0);
  protected comparisonDayOrderRevenue = signal<number>(0);
  protected bigQueryRevenue = signal<number>(0);
  protected bigQueryComparisonRevenue = signal<number>(0);
  protected bigQueryRevenueLoaded = signal<boolean>(false);

  protected revenueChange = computed(() => {
    try {
      const period = this.selectedPeriod();
      let revCurrent: number;
      let revPrevious: number;
      
      // Use the sales-summary API values whenever the current revenue card does.
      if (this.bigQueryRevenueLoaded()) {
        revCurrent = this.bigQueryRevenue();
        revPrevious = this.bigQueryComparisonRevenue();
      } else if (period === 'this_month') {
        revCurrent = this.currentMonthRevenue();
        revPrevious = this.previousMonthRevenue();
      } else if (period === 'previous_month') {
        // When viewing previous month, compare to 2 months ago
        revCurrent = this.previousMonthRevenue();
        revPrevious = 0; // Could implement 2-months-ago if needed
      } else if (period === 'date_range' || period === 'this_week' || period === 'previous_week') {
        // Compare selected date range or weekly periods with the previous equivalent period
        revCurrent = this.dateRangeRevenue();
        revPrevious = this.previousDateRangeRevenue();
      } else {
        // Day-over-day comparison for today/yesterday
        revCurrent = this.bigQueryRevenueLoaded() ? this.bigQueryRevenue() : this.selectedDayOrderRevenue();
        revPrevious = this.bigQueryRevenueLoaded() ? this.bigQueryComparisonRevenue() : this.comparisonDayOrderRevenue();
      }
      
      const diff = revCurrent - revPrevious;

      const percent = (() => {
        if (revPrevious === 0 && revCurrent === 0) return 0;
        if (revPrevious === 0) return 100;
        const raw = (Math.abs(diff) / revPrevious) * 100;
        return Math.round(raw * 10) / 10; // one decimal place
      })();

      const symbol = diff > 0 ? '↗' : (diff < 0 ? '↘' : '→');
      return { symbol, percent, diff, revToday: revCurrent, revYesterday: revPrevious };
    } catch (e) {
      return { symbol: '→', percent: 0, diff: 0, revToday: 0, revYesterday: 0 };
    }
  });

  protected ordersChange = computed(() => {
    try {
      const period = this.selectedPeriod();
      let ordersCurrent: number;
      let ordersPrevious: number;
      
      // Use month-over-month comparison for monthly periods
      if (period === 'this_month') {
        ordersCurrent = this.currentMonthOrders();
        ordersPrevious = this.previousMonthOrders();
      } else if (period === 'previous_month') {
        ordersCurrent = this.previousMonthOrders();
        ordersPrevious = 0; // Could implement 2-months-ago if needed
      } else if (period === 'date_range' || period === 'this_week' || period === 'previous_week') {
        // Compare selected date range or weekly periods with the previous equivalent period
        ordersCurrent = this.dateRangeOrders();
        ordersPrevious = this.previousDateRangeOrders();
      } else {
        // Day-over-day comparison
        ordersCurrent = this.ledgerTotalOrders();
        ordersPrevious = this.yesterdayOrders();
      }
      
      const diff = ordersCurrent - ordersPrevious;

      const percent = (() => {
        if (ordersPrevious === 0 && ordersCurrent === 0) return 0;
        if (ordersPrevious === 0) return 100;
        const raw = (Math.abs(diff) / ordersPrevious) * 100;
        return Math.round(raw * 10) / 10;
      })();

      const symbol = diff > 0 ? '↗' : (diff < 0 ? '↘' : '→');
      return { symbol, percent };
    } catch (e) {
      return { symbol: '→', percent: 0 };
    }
  });

  protected customersChange = computed(() => {
    try {
      const customersToday = this.totalCustomers();
      // For now, return neutral since we don't track yesterday's customers yet
      return { symbol: '→', percent: 0 };
    } catch (e) {
      return { symbol: '→', percent: 0 };
    }
  });

  // Computed label for comparison text
  protected comparisonLabel = computed(() => {
    const period = this.selectedPeriod();
    if (period === 'this_month' || period === 'previous_month') {
      return 'From Last Month';
    } else if (period === 'this_week' || period === 'previous_week') {
      return 'From Previous Week';
    } else if (period === 'date_range') {
      return 'From Previous Period';
    }
    return 'From Last Day';
  });

  // Fetch yesterday's revenue for comparison
  protected async fetchYesterdayRevenue(): Promise<void> {
    try {
      const companyId = this.authService.getCurrentPermission()?.companyId || '';
      const storeId = this.selectedStoreId() || this.authService.getCurrentPermission()?.storeId;
      if (!companyId || !storeId) {
        this.yesterdayRevenue.set(0);
        this.yesterdayOrders.set(0);
        return;
      }

      // Calculate yesterday's date (today - 1 day)
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);

      const summary = await this.bigQueryService.getSalesSummaryTotals(storeId, yesterday, yesterday);
      this.yesterdayRevenue.set(Number(summary?.totalSales || 0));
      this.yesterdayOrders.set(Number(summary?.totalOrders || 0));
      this.salesSummary.set(summary ?? { totalSales: 0, totalOrders: 0, totalItems: 0 });
    } catch (error) {
      console.error('Error fetching yesterday revenue:', error);
      this.yesterdayRevenue.set(0);
      this.yesterdayOrders.set(0);
    }
  }

  // Sales overview is now driven by BigQuery summary totals; no ledger analytics fetch remains here.
  protected async fetchTodayAnalytics(): Promise<void> {
    const storeId = this.selectedStoreId() || this.authService.getCurrentPermission()?.storeId;
    if (!storeId) {
      return;
    }

    const today = new Date();
    try {
      const summary = await this.bigQueryService.getSalesSummaryTotals(storeId, today, today);
      this.salesSummary.set(summary ?? { totalSales: 0, totalOrders: 0, totalItems: 0 });
      this.ledgerTotalRevenue.set(Number(summary?.totalSales || 0));
      this.ledgerTotalOrders.set(Number(summary?.totalOrders || 0));
      this.ledgerCompletedQty.set(Number(summary?.totalOrders || 0));
      this.ledgerOrderQty.set(Number(summary?.totalOrders || 0));
      this.ledgerItemsQty.set(Number(summary?.totalItems || 0));
    } catch {
      this.ledgerTotalRevenue.set(0);
      this.ledgerTotalOrders.set(0);
      this.ledgerCompletedQty.set(0);
      this.ledgerOrderQty.set(0);
      this.ledgerItemsQty.set(0);
    }
  }

  // Fetch monthly revenue comparison (current month vs previous month)
  protected async fetchMonthlyComparison(): Promise<void> {
    try {
      const storeId = this.selectedStoreId() || this.authService.getCurrentPermission()?.storeId;
      if (!storeId) {
        this.currentMonthRevenue.set(0);
        this.currentMonthOrders.set(0);
        this.previousMonthRevenue.set(0);
        this.previousMonthOrders.set(0);
        return;
      }

      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

      const [currentSummary, previousSummary] = await Promise.all([
        this.bigQueryService.getSalesSummaryTotals(storeId, currentMonthStart, currentMonthEnd),
        this.bigQueryService.getSalesSummaryTotals(storeId, previousMonthStart, previousMonthEnd)
      ]);

      const currentRevenue = Number(currentSummary?.totalSales || 0);
      const currentOrders = Number(currentSummary?.totalOrders || 0);
      const previousRevenue = Number(previousSummary?.totalSales || 0);
      const previousOrders = Number(previousSummary?.totalOrders || 0);

      this.currentMonthRevenue.set(currentRevenue);
      this.currentMonthOrders.set(currentOrders);
      this.previousMonthRevenue.set(previousRevenue);
      this.previousMonthOrders.set(previousOrders);
      this.ledgerCompletedQty.set(currentOrders);
      this.ledgerOrderQty.set(currentOrders);
    } catch (error) {
      console.error('Error fetching monthly comparison:', error);
      this.currentMonthRevenue.set(0);
      this.currentMonthOrders.set(0);
      this.previousMonthRevenue.set(0);
      this.previousMonthOrders.set(0);
    }
  }

  // Fetch date range comparison (selected range vs previous equivalent period)
  protected async fetchDateRangeComparison(): Promise<void> {
    try {
      const storeId = this.selectedStoreId() || this.authService.getCurrentPermission()?.storeId;
      if (!storeId) return;

      const fromStr = this.dateFrom();
      const toStr = this.dateTo();
      const startDate = fromStr ? new Date(fromStr) : new Date();
      const endDate = toStr ? new Date(toStr) : new Date();
      endDate.setHours(23, 59, 59, 999);

      const days = Math.round((endDate.getTime() - startDate.getTime()) / (24 * 3600 * 1000)) + 1;
      const prevEnd = new Date(startDate);
      prevEnd.setDate(prevEnd.getDate() - 1);
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - (days - 1));

      const [currentSummary, previousSummary] = await Promise.all([
        this.bigQueryService.getSalesSummaryTotals(storeId, startDate, endDate),
        this.bigQueryService.getSalesSummaryTotals(storeId, prevStart, prevEnd)
      ]);

      const currentRangeRevenueTotal = Number(currentSummary?.totalSales || 0);
      const currentRangeOrdersTotal = Number(currentSummary?.totalOrders || 0);
      const previousRangeRevenueTotal = Number(previousSummary?.totalSales || 0);
      const previousRangeOrdersTotal = Number(previousSummary?.totalOrders || 0);

      this.dateRangeRevenue.set(currentRangeRevenueTotal);
      this.dateRangeOrders.set(currentRangeOrdersTotal);
      this.previousDateRangeRevenue.set(previousRangeRevenueTotal);
      this.previousDateRangeOrders.set(previousRangeOrdersTotal);
      this.ledgerTotalRevenue.set(currentRangeRevenueTotal);
      this.ledgerTotalOrders.set(currentRangeOrdersTotal);
      this.ledgerCompletedQty.set(currentRangeOrdersTotal);
      this.ledgerCompletedAmount.set(currentRangeRevenueTotal);
      this.ledgerOrderQty.set(currentRangeOrdersTotal);
    } catch (error) {
      console.error('Error fetching date range comparison:', error);
      this.dateRangeRevenue.set(0);
      this.dateRangeOrders.set(0);
      this.previousDateRangeRevenue.set(0);
      this.previousDateRangeOrders.set(0);
      this.ledgerTotalRevenue.set(0);
      this.ledgerTotalOrders.set(0);
      this.ledgerCompletedQty.set(0);
      this.ledgerCompletedAmount.set(0);
      this.ledgerOrderQty.set(0);
      this.ledgerCancelQty.set(0);
      this.ledgerReturnAmount.set(0);
      this.ledgerReturnQty.set(0);
      this.ledgerRefundAmount.set(0);
      this.ledgerRefundQty.set(0);
      this.ledgerDamageAmount.set(0);
      this.ledgerDamageQty.set(0);
      this.ledgerUnpaidAmount.set(0);
      this.ledgerUnpaidQty.set(0);
      this.ledgerRecoveredAmount.set(0);
      this.ledgerRecoveredQty.set(0);
    }
  }

  protected async fetchWeeklyComparison(startDate: Date, endDate: Date): Promise<void> {
    try {
      const storeId = this.selectedStoreId() || this.authService.getCurrentPermission()?.storeId;
      if (!storeId) {
        this.dateRangeRevenue.set(0);
        this.dateRangeOrders.set(0);
        this.previousDateRangeRevenue.set(0);
        this.previousDateRangeOrders.set(0);
        return;
      }

      const previousStart = new Date(startDate);
      previousStart.setDate(previousStart.getDate() - 7);
      const previousEnd = new Date(endDate);
      previousEnd.setDate(previousEnd.getDate() - 7);

      const [currentSummary, previousSummary] = await Promise.all([
        this.bigQueryService.getSalesSummaryTotals(storeId, startDate, endDate),
        this.bigQueryService.getSalesSummaryTotals(storeId, previousStart, previousEnd)
      ]);

      this.dateRangeRevenue.set(Number(currentSummary?.totalSales || 0));
      this.previousDateRangeRevenue.set(Number(previousSummary?.totalSales || 0));
      this.dateRangeOrders.set(Number(currentSummary?.totalOrders || 0));
      this.previousDateRangeOrders.set(Number(previousSummary?.totalOrders || 0));
    } catch (error) {
      console.error('Error fetching weekly comparison:', error);
      this.dateRangeRevenue.set(0);
      this.dateRangeOrders.set(0);
      this.previousDateRangeRevenue.set(0);
      this.previousDateRangeOrders.set(0);
    }
  }
  
  protected monthOrders = computed(() => {
    const now = new Date();
    const m = now.getMonth(); const y = now.getFullYear();
    return this.orders().filter(o => {
      const d = o.createdAt ? new Date(o.createdAt) : undefined;
      return d && d.getMonth() === m && d.getFullYear() === y;
    }).length;
  });

  constructor() {
    // Initialize default date range (last 30 days)
    const now = new Date();
    const toIso = now.toISOString().slice(0, 10);
    const from = new Date(now);
    from.setDate(from.getDate() - 30);
    const fromIso = from.toISOString().slice(0, 10);
    this.dateFrom.set(fromIso);
    this.dateTo.set(toIso);
    
    // Re-fetch top products whenever the selected store changes
    effect(() => {
      const sid = this.selectedStoreId();
      // If 'all' or empty, let fetchTopProducts resolve storeId itself
      void this.fetchTopProducts(sid && sid !== 'all' ? sid : undefined);
    });
  }


  // Handler: when user changes store selection
  protected onOverviewStoreChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    if (target && target.value) {
      this.selectedStoreId.set(target.value);
      this.applyPeriodAndLoad();
    }
  }

  // Handler: when user changes period selection
  protected onOverviewPeriodChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    if (!target) return;
    const v = target.value as 'today' | 'yesterday' | 'this_week' | 'previous_week' | 'this_month' | 'previous_month' | 'date_range';
    
    // Reset all ledger signals to 0 when period changes to prevent stale data
    this.ledgerReturnAmount.set(0);
    this.ledgerReturnQty.set(0);
    this.ledgerRefundAmount.set(0);
    this.ledgerRefundQty.set(0);
    this.ledgerDamageAmount.set(0);
    this.ledgerDamageQty.set(0);
    this.ledgerUnpaidAmount.set(0);
    this.ledgerUnpaidQty.set(0);
    this.ledgerRecoveredAmount.set(0);
    this.ledgerRecoveredQty.set(0);
    this.ledgerCancelledAmount.set(0);
    this.ledgerCancelledQty.set(0);
    this.ledgerCancelQty.set(0);
    this.ledgerCompletedQty.set(0);
    this.ledgerOrderQty.set(0);
    this.ledgerItemsQty.set(0);
    this.ledgerTotalRevenue.set(0);
    this.ledgerTotalOrders.set(0);
    
    this.selectedPeriod.set(v);
    if (v === 'date_range') {
      // default dateTo = today, dateFrom = today - 30 days
      const now = new Date();
      const toIso = now.toISOString().slice(0,10);
      const from = new Date(now);
      from.setDate(from.getDate() - 30);
      const fromIso = from.toISOString().slice(0,10);
      // Only set defaults if not already set by the user
      if (!this.dateFrom()) this.dateFrom.set(fromIso);
      if (!this.dateTo()) this.dateTo.set(toIso);
      this.applyPeriodAndLoad();
    } else {
      this.dateFrom.set(null);
      this.dateTo.set(null);
      this.applyPeriodAndLoad();
    }
  }

  protected onApplyDateRange() {
    const from = this.dateFrom();
    const to = this.dateTo();
    if (!from || !to) return;

    const fromIso = from.slice(0, 10);
    const toIso = to.slice(0, 10);
    this.dateFrom.set(fromIso);
    this.dateTo.set(toIso);
    
    const start = new Date(fromIso + 'T00:00:00');
    const end = new Date(toIso + 'T23:59:59.999');
    
    // Validate date range: max 31 days
    const daysDifference = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDifference >   31) {
      this.confirmDialogData.set({
        title: 'Invalid Date Range',
        message: 'Date range cannot exceed 31 days. Please select a shorter period.',
        confirmText: 'OK',
        type: 'warning'
      });
      this.showConfirmDialog.set(true);
      return;
    }
    
    // Validate: end date must be >= start date
    if (end < start) {
      this.confirmDialogData.set({
        title: 'Invalid Date Range',
        message: 'End date must be after or equal to start date.',
        confirmText: 'OK',
        type: 'warning'
      });
      this.showConfirmDialog.set(true);
      return;
    }

    this.selectedPeriod.set('date_range');
    this.loadAnalyticsData(start, end);
    // Fetch date range comparison data
    this.fetchDateRangeComparison().catch(err => console.error('Failed to fetch date range comparison:', err));
  }

  protected onConfirmDialog() {
    this.showConfirmDialog.set(false);
  }

  protected onCancelDialog() {
    this.showConfirmDialog.set(false);
  }

  // Compute start/end dates for selected period and call analytics loader
  protected async applyPeriodAndLoad() {
    const period = this.selectedPeriod();
    
    // Note: Signal reset moved to loadAnalyticsData to prevent race conditions
    // where duplicate calls reset data while loading is in progress
    
    const now = new Date();
    let dateFromStr: string | undefined;
    let dateToStr: string | undefined;
    
    if (period === 'today') {
      dateFromStr = this.formatDateAsString(now);
      dateToStr = this.formatDateAsString(now);
    } else if (period === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      dateFromStr = this.formatDateAsString(yesterday);
      dateToStr = this.formatDateAsString(yesterday);
    } else if (period === 'this_week') {
      const nowWeekDay = now.getDay();
      const mondayOffset = (nowWeekDay + 6) % 7;
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - mondayOffset);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      dateFromStr = this.formatDateAsString(weekStart);
      dateToStr = this.formatDateAsString(weekEnd);
    } else if (period === 'previous_week') {
      const nowWeekDay = now.getDay();
      const mondayOffset = (nowWeekDay + 6) % 7;
      const currentWeekStart = new Date(now);
      currentWeekStart.setDate(now.getDate() - mondayOffset);
      const prevWeekStart = new Date(currentWeekStart);
      prevWeekStart.setDate(currentWeekStart.getDate() - 7);
      const prevWeekEnd = new Date(prevWeekStart);
      prevWeekEnd.setDate(prevWeekStart.getDate() + 6);
      dateFromStr = this.formatDateAsString(prevWeekStart);
      dateToStr = this.formatDateAsString(prevWeekEnd);
    } else if (period === 'this_month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      dateFromStr = this.formatDateAsString(monthStart);
      dateToStr = this.formatDateAsString(monthEnd);
    } else if (period === 'previous_month') {
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      dateFromStr = this.formatDateAsString(prevMonthStart);
      dateToStr = this.formatDateAsString(prevMonthEnd);
    } else if (period === 'date_range') {
      dateFromStr = this.dateFrom() || undefined;
      dateToStr = this.dateTo() || undefined;
    }

    // Convert from device's local time to UTC using timezone-aware conversion
    let start: Date | undefined;
    let end: Date | undefined;
    
    if (dateFromStr && dateToStr) {
      const range = convertPhilippineDateRangeToUtc(dateFromStr, dateToStr);
      start = range.start;
      end = range.end;
    }

    // If we have a store selected, trigger analytics load
    const storeId = this.selectedStoreId() || this.authService.getCurrentPermission()?.storeId;
    if (storeId && start && end) {
      await this.loadAnalyticsData(start, end);
      // Weekly and monthly periods need extra comparison loads
      if (period === 'this_month' || period === 'previous_month') {
        await this.fetchMonthlyComparison().catch(err => console.error('fetchMonthlyComparison error:', err));
      }
      if (period === 'this_week' || period === 'previous_week') {
        await this.fetchWeeklyComparison(start, end).catch(err => console.error('fetchWeeklyComparison error:', err));
      }
    }
  }

  ngOnInit(): void {
    // Initialize data loading on component init - same as sales-summary
    this.loadData();
  }

  private applyStatusBreakdownToLedger(statusBreakdown: any[] = []): void {
    const findStatus = (status: string) => {
      const aliases: Record<string, string[]> = {
        completed: ['completed', 'complete', 'paid'],
        returned: ['returned', 'return'],
        refunded: ['refunded', 'refund'],
        damaged: ['damaged', 'damage', 'damages'],
        cancelled: ['cancelled', 'canceled', 'cancel', 'void', 'voided'],
        unpaid: ['unpaid', 'open', 'pending'],
        recovered: ['recovered', 'paid_recovered']
      };
      const item = statusBreakdown.find((entry) => aliases[status]?.includes(String(entry?.status ?? entry?.name ?? '').trim().toLowerCase()) ?? false);
      return item ?? { count: 0, amount: 0 };
    };

    const completed = findStatus('completed');
    const returned = findStatus('returned');
    const cancelled = findStatus('cancelled');
    const refunded = findStatus('refunded');
    const damaged = findStatus('damaged');
    const unpaid = findStatus('unpaid');
    const recovered = findStatus('recovered');

    const statusItemQty = (item: any) => Number(item.totalItems ?? item.items ?? item.count ?? 0);
    this.ledgerCompletedQty.set(Number(completed.count || 0));
    this.ledgerCancelQty.set(statusItemQty(cancelled));
    this.ledgerCancelledQty.set(statusItemQty(cancelled));
    this.ledgerCancelledAmount.set(Number(cancelled.amount || 0));
    this.ledgerReturnQty.set(statusItemQty(returned));
    this.ledgerReturnAmount.set(Number(returned.amount || 0));
    this.ledgerRefundQty.set(statusItemQty(refunded));
    this.ledgerRefundAmount.set(Number(refunded.amount || 0));
    this.ledgerDamageQty.set(statusItemQty(damaged));
    this.ledgerDamageAmount.set(Number(damaged.amount || 0));
    this.ledgerUnpaidQty.set(statusItemQty(unpaid));
    this.ledgerUnpaidAmount.set(Number(unpaid.amount || 0));
    this.ledgerRecoveredQty.set(statusItemQty(recovered));
    this.ledgerRecoveredAmount.set(Number(recovered.amount || 0));
  }

  private hasApiAdjustmentStatuses(statusBreakdown: any[]): boolean {
    const adjustmentStatuses = new Set(['returned', 'return', 'refunded', 'refund', 'damaged', 'damage', 'damages', 'unpaid', 'recovered', 'cancelled', 'canceled', 'cancel', 'void', 'voided']);
    return statusBreakdown.some(entry => adjustmentStatuses.has(String(entry?.status ?? entry?.name ?? '').trim().toLowerCase()));
  }

  private applyAdjustmentTotalsToCards(totals: Awaited<ReturnType<LedgerService['getAdjustmentTotals']>>): void {
    this.ledgerReturnQty.set(Number(totals.returns.qty || 0));
    this.ledgerReturnAmount.set(Number(totals.returns.amount || 0));
    this.ledgerRefundQty.set(Number(totals.refunds.qty || 0));
    this.ledgerRefundAmount.set(Number(totals.refunds.amount || 0));
    this.ledgerDamageQty.set(Number(totals.damages.qty || 0));
    this.ledgerDamageAmount.set(Number(totals.damages.amount || 0));
    this.ledgerUnpaidQty.set(Number(totals.unpaid.qty || 0));
    this.ledgerUnpaidAmount.set(Number(totals.unpaid.amount || 0));
    this.ledgerRecoveredQty.set(Number(totals.recovered.qty || 0));
    this.ledgerRecoveredAmount.set(Number(totals.recovered.amount || 0));
    this.ledgerCancelledQty.set(Number(totals.cancelled.qty || 0));
    this.ledgerCancelledAmount.set(Number(totals.cancelled.amount || 0));
    this.ledgerCancelQty.set(Number(totals.cancelled.qty || 0));
  }

  private async applyTrackingAdjustmentFallbacks(
    companyId: string,
    storeId: string,
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    const trackingStatuses = [
      { status: 'returned', amount: this.ledgerReturnAmount, qty: this.ledgerReturnQty },
      { status: 'refunded', amount: this.ledgerRefundAmount, qty: this.ledgerRefundQty },
      { status: 'damaged', amount: this.ledgerDamageAmount, qty: this.ledgerDamageQty }
    ];

    for (const entry of trackingStatuses) {
      if (entry.amount() !== 0 || entry.qty() !== 0) continue;
      const trackingTotals = await this.ordersSellingTrackingService.getTrackingSummary(
        companyId,
        storeId,
        entry.status,
        startDate,
        endDate
      );
      if (trackingTotals.amount !== 0 || trackingTotals.qty !== 0) {
        entry.amount.set(Number(trackingTotals.amount || 0));
        entry.qty.set(Number(trackingTotals.qty || 0));
      }
    }
  }

  private async loadAnalyticsData(startDate: Date, endDate: Date): Promise<void> {
    // Load analytics data for the given date range and keep the full-page
    // loading overlay visible until every important fetch has completed.
    this.isLoading.set(true);
    console.log('📊 [Overview] loadAnalyticsData started for period:', this.selectedPeriod(), 'from', startDate, 'to', endDate);

    try {
      await this.loadCurrentDateData(startDate, endDate);
      if (this.selectedPeriod() === 'today' || this.selectedPeriod() === 'yesterday') {
        await this.fetchSingleDayOrderRevenue(startDate);
      } else {
        this.selectedDayOrderRevenue.set(0);
        this.comparisonDayOrderRevenue.set(0);
      }
      const comparisonEnd = new Date(startDate);
      comparisonEnd.setDate(comparisonEnd.getDate() - 1);
      const periodLength = Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 86400000));
      const comparisonStart = new Date(comparisonEnd);
      comparisonStart.setDate(comparisonStart.getDate() - periodLength);
      await this.fetchBigQueryRevenue(startDate, endDate, comparisonStart, comparisonEnd);
      
      const storeId = this.selectedStoreId() || this.authService.getCurrentPermission()?.storeId || '';
      const companyId = this.authService.getCurrentPermission()?.companyId || '';
      console.log('📊 [Overview] storeId for summary:', storeId);
      
      if (storeId) {
        try {
          console.log('💰 [Overview] Fetching sales summary totals...');
          const [summary, ordersSummary] = await Promise.all([
            this.bigQueryService.getSalesSummaryTotals(storeId, startDate, endDate),
            this.bigQueryService.getSalesDashboardOrderSummary(storeId, startDate, endDate)
          ]);
          const mergedSummary = {
            totalSales: Number(summary?.totalSales || 0),
            totalOrders: Number(ordersSummary?.totalOrders || 0),
            totalItems: Number(ordersSummary?.totalItems || summary?.totalItems || this.totalItems())
          };
          console.log('✅ [Overview] Sales summary and orders API totals received:', {
            salesSummary: summary,
            ordersSummary,
            mergedSummary
          });
          this.salesSummary.set(mergedSummary);
          this.ledgerTotalRevenue.set(mergedSummary.totalSales);
          this.ledgerTotalOrders.set(mergedSummary.totalOrders);
          this.ledgerOrderQty.set(mergedSummary.totalOrders);
          this.ledgerItemsQty.set(mergedSummary.totalItems);
          this.ledgerCompletedQty.set(mergedSummary.totalOrders);
          this.statusBreakdown.set(summary?.statusBreakdown || []);
          this.applyStatusBreakdownToLedger(summary?.statusBreakdown || []);
          const apiHasAdjustmentStatuses = this.hasApiAdjustmentStatuses(summary?.statusBreakdown || []);
          console.log('📊 [Overview] Summary API adjustment statuses:', apiHasAdjustmentStatuses);
        } catch (err) {
          console.error('❌ [Overview] Sales summary totals failed:', err);
          this.salesSummary.set({ totalSales: 0, totalOrders: 0, totalItems: 0 });
          this.ledgerTotalRevenue.set(0);
          this.ledgerTotalOrders.set(0);
          this.ledgerOrderQty.set(0);
          this.ledgerItemsQty.set(0);
          this.ledgerCompletedQty.set(0);
          this.statusBreakdown.set([]);
        }

        if (companyId) {
          try {
            const statusRows = this.statusBreakdown();
            if (!this.hasApiAdjustmentStatuses(statusRows)) {
              const adjustmentTotals = await this.ledgerService.getAdjustmentTotals(companyId, storeId, startDate, endDate);
              this.applyAdjustmentTotalsToCards(adjustmentTotals);
              await this.applyTrackingAdjustmentFallbacks(companyId, storeId, startDate, endDate);
            }
          } catch (err) {
            console.warn('⚠️ [Overview] Ledger adjustment totals failed:', err);
            this.applyAdjustmentTotalsToCards({
              completed: { amount: 0, qty: 0 },
              cancelled: { amount: 0, qty: 0 },
              returns: { amount: 0, qty: 0 },
              refunds: { amount: 0, qty: 0 },
              damages: { amount: 0, qty: 0 },
              unpaid: { amount: 0, qty: 0 },
              recovered: { amount: 0, qty: 0 }
            });
          }
        }

      } else {
        console.warn('⚠️ [Overview] No storeId available for summary');
      }
    } catch (err) {
      console.error('❌ [Overview] Error loading analytics data:', err);
    } finally {
      console.log('📊 [Overview] loadAnalyticsData completed');
      this.isLoading.set(false);
    }
  }

  private async fetchSingleDayOrderRevenue(selectedDate: Date): Promise<void> {
    const storeId = this.selectedStoreId() || this.authService.getCurrentPermission()?.storeId || '';
    if (!storeId || storeId === 'all') {
      this.selectedDayOrderRevenue.set(0);
      this.comparisonDayOrderRevenue.set(0);
      return;
    }

    const getDayRange = (date: Date): { start: Date; end: Date } => ({
      start: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0),
      end: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
    });
    const sumRevenueGross = async (date: Date): Promise<number> => {
      const { start, end } = getDayRange(date);
      const orders = await this.bigQueryService.getSalesDashboardOrders(storeId, start, end);
      const includedOrderIds = new Set<string>();
      return (orders || []).reduce((sum, order) => {
        if (order.storeId !== storeId) return sum;

        // Adjustment actions may update statusHistory/statusTags while leaving
        // the root order status as completed. Use the latest available status.
        const history = Array.isArray(order.statusHistory) ? order.statusHistory : [];
        const latestHistoryStatus = history.length > 0
          ? String(history[history.length - 1]?.status || '').toLowerCase()
          : '';
        const tags = Array.isArray(order.statusTags) ? order.statusTags : [];
        const latestTagStatus = tags.length > 0 ? String(tags[tags.length - 1] || '').toLowerCase() : '';
        const latestStatus = latestHistoryStatus || latestTagStatus || String(order.status || '').toLowerCase();
        const status = latestStatus === 'return' ? 'returned' : latestStatus;
        if (status !== 'completed' && status !== 'returned') return sum;

        const orderId = String(order.id || order.orderId || '');
        if (orderId && includedOrderIds.has(orderId)) return sum;
        if (orderId) includedOrderIds.add(orderId);
        return sum + (Number(order.grossAmount) || 0);
      }, 0);
    };

    try {
      const comparisonDate = new Date(selectedDate);
      comparisonDate.setDate(comparisonDate.getDate() - 1);
      const [selectedRevenue, comparisonRevenue] = await Promise.all([
        sumRevenueGross(selectedDate),
        sumRevenueGross(comparisonDate)
      ]);
      this.selectedDayOrderRevenue.set(selectedRevenue);
      this.comparisonDayOrderRevenue.set(comparisonRevenue);
    } catch (error) {
      console.warn('Overview: failed to load completed order revenue fallback:', error);
      this.selectedDayOrderRevenue.set(0);
      this.comparisonDayOrderRevenue.set(0);
    }
  }

  private async fetchBigQueryRevenue(startDate: Date, endDate: Date, comparisonStart: Date, comparisonEnd: Date): Promise<void> {
    const storeId = this.selectedStoreId() || this.authService.getCurrentPermission()?.storeId || '';
    const companyId = this.authService.getCurrentPermission()?.companyId || '';
    this.bigQueryRevenueLoaded.set(false);
    if (!storeId || storeId === 'all') {
      return;
    }

    try {
      const [currentRevenue, comparisonRevenue, currentAdjustments, comparisonAdjustments] = await Promise.all([
        this.bigQueryService.getSalesSummaryRevenue(storeId, startDate, endDate),
        this.bigQueryService.getSalesSummaryRevenue(storeId, comparisonStart, comparisonEnd),
        companyId
          ? this.ledgerService.getAdjustmentTotals(companyId, storeId, startDate, endDate)
          : Promise.resolve(null),
        companyId
          ? this.ledgerService.getAdjustmentTotals(companyId, storeId, comparisonStart, comparisonEnd)
          : Promise.resolve(null)
      ]);
      if (currentRevenue === null) {
        this.bigQueryRevenueLoaded.set(false);
        return;
      }
      const currentAdjustedRevenue = Math.max(
        0,
        Number(currentRevenue || 0)
          - Number(currentAdjustments?.refunds.amount || 0)
          - Number(currentAdjustments?.damages.amount || 0)
      );
      const comparisonAdjustedRevenue = Math.max(
        0,
        Number(comparisonRevenue || 0)
          - Number(comparisonAdjustments?.refunds.amount || 0)
          - Number(comparisonAdjustments?.damages.amount || 0)
      );
      this.bigQueryRevenue.set(currentAdjustedRevenue);
      this.bigQueryComparisonRevenue.set(comparisonAdjustedRevenue);
      this.bigQueryRevenueLoaded.set(true);
      console.log('Overview Total Revenue source: BigQuery', {
        storeId,
        completedSales: currentRevenue,
        refunds: currentAdjustments?.refunds.amount || 0,
        damage: currentAdjustments?.damages.amount || 0,
        revenue: currentAdjustedRevenue,
        comparisonRevenue: comparisonAdjustedRevenue
      });
    } catch (error) {
      console.warn('Overview: BigQuery sales summary unavailable; using existing revenue source:', error);
      this.bigQueryRevenueLoaded.set(false);
      console.warn('Overview Total Revenue source: fallback', error);
    }
  }

  private async loadSalesFromCloudFunction(storeId: string, startDate: Date, endDate: Date, status: string): Promise<void> {
    const orders = await this.bigQueryService.getSalesDashboardOrders(storeId, startDate, endDate);
    this.orders.set(orders || []);
  }

  private async loadData() {
    try {
      this.isLoading.set(true);
      
      // ALWAYS reload stores from Firestore to get latest changes (including newly created stores)
      await this.loadStores();
      
      // After stores load, use the selected period/store to load analytics
      // This ensures the new store/period controls drive the initial load
      await this.applyPeriodAndLoad();
      await this.fetchTopProducts();
      this.isLoading.set(false);

    } catch (error) {
      console.error('❌ Dashboard error loading data:', error);
      // Don't block the UI - allow dashboard to render with whatever data is available
      console.warn('⚠️ Dashboard will show with cached/available data');
      this.isLoading.set(false);
    }
  }

  // Note: SVG pie helpers removed — Chart.js (ng2-charts) canvas is used instead.

  async loadStores(): Promise<void> {
    try {
      const currentPermission = this.authService.getCurrentPermission();
      
      if (!currentPermission?.companyId) {
        console.warn('⚠️ No companyId found in current permission');
        return;
      }

      // Load stores into StoreService
      await this.storeService.loadStoresByCompany(currentPermission.companyId);
      
      // Use full company store list (no userRoles filtering)
      const stores = this.storeService.getStoresByCompany(currentPermission.companyId)
        .filter(store => store.status === 'active');
      
      this.stores.set(stores);

      // Set selected store after stores are loaded
      if (currentPermission?.storeId) {
        this.selectedStoreId.set(currentPermission.storeId);
      } else if (stores.length > 0 && stores[0].id) {
        this.selectedStoreId.set(stores[0].id);
      } else {
        console.warn('⚠️ Overview: No stores available to select');
      }
    } catch (error) {
      console.error('❌ Error loading stores:', error);
      console.warn('⚠️ Will use cached store data if available');
      // Try to set selectedStoreId from permission even if store load failed
      const currentPermission = this.authService.getCurrentPermission();
      if (currentPermission?.storeId) {
        this.selectedStoreId.set(currentPermission.storeId);
      }
    }
  }

  async loadCurrentDateData(startDate?: Date, endDate?: Date): Promise<void> {
    const requestId = ++this.overviewLoadSequence;
    this.monthExpensesTotal.set(0);
    this.yesterdayExpensesTotal.set(0);

    try {
      // Use selected store ID or get from permission - EXACT same logic
      const storeId = this.selectedStoreId() || this.authService.getCurrentPermission()?.storeId;
      const companyId = this.authService.getCurrentPermission()?.companyId || '';
      
      if (!storeId) {
        console.warn('❌ Dashboard: No storeId found - cannot load data');
        this.orders.set([]);
        return;
      }

      // Default to today if no explicit range is supplied
      const now = new Date();
      const queryStart = startDate ? new Date(startDate) : new Date(now.toISOString().split('T')[0]);
      const queryEnd = endDate ? new Date(endDate) : new Date(now.toISOString().split('T')[0]);
      queryEnd.setHours(23, 59, 59, 999);

      // Load orders for the requested date range from the BigQuery-backed dashboard API
      const orders = await this.bigQueryService.getSalesDashboardOrders(storeId, queryStart, queryEnd);
      if (requestId !== this.overviewLoadSequence) {
        return;
      }
      this.orders.set(orders || []);

      // Load expenses for the requested date range
      const expenses = await this.expenseService.getExpensesByStore(storeId, queryStart, queryEnd);
      if (requestId !== this.overviewLoadSequence) {
        return;
      }
      this.expenses.set(expenses || []);

      // Compute the expense total from the selected period's actual month window.
      // This keeps today/yesterday/this_week/previous_week summaries aligned to the
      // month of the reference date instead of leaking older historical expense rows.
      try {
        const referenceDate = startDate ? new Date(startDate) : new Date();
        const monthStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1, 0, 0, 0, 0);
        const monthEnd = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0, 23, 59, 59, 999);

        const monthExpenses = await this.expenseService.getExpensesByStore(storeId, monthStart, monthEnd);
        if (requestId !== this.overviewLoadSequence) {
          return;
        }
        const monthTotal = (monthExpenses || []).reduce((s, e) => s + (Number((e as any).amount || 0) / 100), 0);
        this.monthExpensesTotal.set(monthTotal);

        const yesterdayRef = new Date(referenceDate);
        yesterdayRef.setDate(referenceDate.getDate() - 1);
        const yesterdayStart = new Date(yesterdayRef.getFullYear(), yesterdayRef.getMonth(), yesterdayRef.getDate(), 0, 0, 0, 0);
        const yesterdayEnd = new Date(yesterdayRef.getFullYear(), yesterdayRef.getMonth(), yesterdayRef.getDate(), 23, 59, 59, 999);
        const yesterdayExpenses = await this.expenseService.getExpensesByStore(storeId, yesterdayStart, yesterdayEnd);
        if (requestId !== this.overviewLoadSequence) {
          return;
        }
        const yesterdayTotal = (yesterdayExpenses || []).reduce((s, e) => s + (Number((e as any).amount || 0) / 100), 0);
        this.yesterdayExpensesTotal.set(yesterdayTotal);
      } catch (monthErr) {
        console.warn('Overview: month expense query failed, will skip month expense calc:', monthErr);
        if (requestId === this.overviewLoadSequence) {
          this.monthExpensesTotal.set(0);
          this.yesterdayExpensesTotal.set(0);
        }
      }

      // Loading completion is managed by the outer analytics load wrapper.
      // This preserves the full-page loader until all dashboard data has finished.
    } catch (error) {
      console.error('❌ Error loading current date data:', error);
    }
  }

  // Analytics computed properties based on BigQuery/Firebase data
  readonly salesAnalytics = computed(() => {
    const orders = this.filteredOrders() || [];

    // Prefer ledger-sourced per-range order totals when available.
    // Otherwise prefer the local `orders.length` (range-loaded) before falling back to global ledgerTotalOrders.
    const ledgerOrderQty = Math.max(0, Number(this.ledgerOrderQty() || 0));
    const ledgerCancelQty = Math.max(0, Number(this.ledgerCancelQty() || 0));
    const ledgerCompletedQty = Math.max(0, Number(this.ledgerCompletedQty() || 0));
    const ordersLen = Array.isArray(orders) ? orders.length : 0;
    const reportedTotal = ledgerOrderQty > 0 ? ledgerOrderQty : (ordersLen > 0 ? ordersLen : Number(this.totalOrders() || 0));

    // Sanitize adjustment counts (ensure non-negative)
    const returnedCount = Math.max(0, Number(this.ledgerReturnQty() || 0));
    const refundedCount = Math.max(0, Number(this.ledgerRefundQty() || 0));
    const damageCount = Math.max(0, Number(this.ledgerDamageQty() || 0));

    // Cancelled: prefer ledger cancel qty when available, otherwise fallback to scanning orders
    let cancelledCount = 0;
    try {
      cancelledCount = ledgerCancelQty > 0 ? ledgerCancelQty : Math.max(0, orders.filter(o => (o.status || '').toString().toLowerCase().includes('cancel')).length);
    } catch (e) {
      cancelledCount = 0;
    }

    // Compute completed count: prefer ledger-computed completedQty when available (orders - cancels), otherwise infer from reported total
    const knownSum = returnedCount + refundedCount + damageCount + cancelledCount;
    let completedCount = ledgerCompletedQty > 0 ? ledgerCompletedQty : Math.max(0, reportedTotal - knownSum);

    // Base total for percentages: prefer ledgerOrderQty if available
    let baseTotal = ledgerOrderQty > 0 ? ledgerOrderQty : reportedTotal;
    // If we don't have a per-range ledger order total but we do have ledger-computed completed qty,
    // derive the base from ledgerCompletedQty + known adjustments so percentages are meaningful.
    if (ledgerOrderQty === 0 && ledgerCompletedQty > 0) {
      baseTotal = Math.max(1, ledgerCompletedQty + knownSum);
    }
    if (baseTotal <= 0) baseTotal = Math.max(1, knownSum + completedCount);

    const result: any = {
      completed: { count: completedCount, percentage: 0 },
      cancelled: { count: cancelledCount, percentage: 0 },
      returned: { count: returnedCount, percentage: 0 },
      refunded: { count: refundedCount, percentage: 0 },
      damage: { count: damageCount, percentage: 0 }
    };

    // If there's no actual data (all counts are 0), show 0% for all
    const hasData = completedCount > 0 || cancelledCount > 0 || returnedCount > 0 || refundedCount > 0 || damageCount > 0;
    
    if (!hasData) {
      // No data - show all 0%
      return result;
    }

    // Compute percentages with one decimal place
    let accumulated = 0;
    for (const k of Object.keys(result)) {
      const r = result[k];
      const raw = (Number(r.count || 0) / baseTotal) * 100;
      r.percentage = Math.max(0, Math.round(raw * 10) / 10); // one decimal
      accumulated += r.percentage;
    }

    // Normalize rounding error by adjusting completed (allow small fractional diff)
    const roundedAccum = Math.round(accumulated * 10) / 10;
    if (roundedAccum !== 100) {
      const diff = Math.round((100 - roundedAccum) * 10) / 10;
      result.completed.percentage = Math.min(100, Math.max(0, (result.completed.percentage || 0) + diff));
    }
    
    return result;
  });

  // Generate CSS conic-gradient string for donut based on salesAnalytics
  protected pieGradient(): string {
    const sa: any = this.salesAnalytics();
    const segments = [
      { color: '#06b6d4', pct: Number(sa.completed?.percentage || 0) },
      { color: '#ef4444', pct: Number(sa.cancelled?.percentage || 0) },
      { color: '#f97316', pct: Number(sa.returned?.percentage || 0) },
      { color: '#f59e0b', pct: Number(sa.refunded?.percentage || 0) },
      { color: '#8b5cf6', pct: Number(sa.damage?.percentage || 0) }
    ];

    // Check if there's any data
    const total = segments.reduce((s, x) => s + (isFinite(x.pct) ? x.pct : 0), 0);
    
    // If no data, show default yellow color
    if (total === 0) {
      return `conic-gradient(#eab308 0% 100%)`;
    }

    // If total is not 100, scale values to fit 100
    const scale = 100 / total;
    let acc = 0;
    const stops: string[] = [];
    for (const seg of segments) {
      // scale and keep one decimal place
      const raw = (seg.pct || 0) * scale;
      const p = Math.max(0, Math.round(raw * 10) / 10);
      const start = Math.round(acc * 10) / 10;
      const end = Math.round((acc + p) * 10) / 10;
      stops.push(`${seg.color} ${start}% ${end}%`);
      acc += p;
    }

    // If rounding left a tiny gap, fill with white at end
    if (Math.round(acc * 10) / 10 < 100) stops.push(`#ffffff ${Math.round(acc * 10) / 10}% 100%`);

    return `conic-gradient(${stops.join(', ')})`;
  }

  readonly topProducts = computed(() => {
    const topList = this.topProductsList();
    if (topList && topList.length > 0) {
      return topList.map(p => ({
        name: p.name || 'Product',
        skuId: p.skuId || '',
        avatar: p.avatar || 'P',
        sales: Number(p.sales || 0)
      })).filter(item => item.sales > 0).sort((a, b) => b.sales - a.sales).slice(0, 10);
    }

    const productSales = new Map<string, { product: any; sales: number; skuId: string }>();
    this.products().forEach(product => {
      if (product.id) {
        productSales.set(product.id, { product, sales: 0, skuId: product.skuId || '' });
      }
    });

    this.orders().forEach(order => {
      const keys = Array.from(productSales.keys());
      keys.slice(0, Math.min(3, keys.length)).forEach(productId => {
        const existing = productSales.get(productId);
        if (existing) existing.sales += Math.floor(Math.random() * 5) + 1;
      });
    });

    return Array.from(productSales.values())
      .filter(item => item.sales > 0)
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10)
      .map(item => ({
        name: item.product.productName || 'Product',
        skuId: item.skuId,
        avatar: item.product.productName?.charAt(0).toUpperCase() || 'P',
        sales: item.sales
      }));
  });

  private async fetchTopProducts(storeId?: string): Promise<void> {
    try {
      const currentPermission = this.authService.getCurrentPermission();
      const companyId = currentPermission?.companyId || '';
      let resolvedStoreId = storeId || this.selectedStoreId() || this.authService.getCurrentPermission()?.storeId || '';

      const top = await this.ordersSellingTrackingService.getTopProductsCompletedCounts(companyId, resolvedStoreId, 10);
      const mapped = (top || []).slice(0, 10).map((p: any) => ({
        avatar: (p.productName || '').split(' ').map((s: string) => s.charAt(0)).slice(0, 2).join('').toUpperCase() || 'P',
        name: p.productName || 'Product',
        skuId: p.skuId || '',
        sales: Number(p.completedCount || 0)
      }));
      this.topProductsList.set(mapped);
    } catch (err) {
      console.warn('fetchTopProducts error', err);
      this.topProductsList.set([]);
    }
  }

  // Build an SVG path for orders line using monthlyChartData
  protected chartPath = computed(() => {
    try {
      const data = this.monthlyChartData();
      if (!Array.isArray(data) || data.length === 0) return '';
      const width = 700;
      const height = 220;
      const padding = 40;
      const values = data.map(d => d.orders || 0);
      const max = Math.max(...values, 1);
      const step = (width - padding * 2) / Math.max(1, values.length - 1);
      return values.map((v, i) => {
        const x = padding + i * step;
        const y = height - padding - (v / max) * (height - padding * 2);
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      }).join(' ');
    } catch (e) {
      return '';
    }
  });

  // Build an SVG path for profit line (uses profit values)
  protected chartPathProfit = computed(() => {
    try {
      const data = this.monthlyChartData();
      if (!Array.isArray(data) || data.length === 0) return '';
      const width = 700;
      const height = 220;
      const padding = 40;
      const values = data.map(d => d.profit || 0);
      const max = Math.max(...values, 1);
      const step = (width - padding * 2) / Math.max(1, values.length - 1);
      return values.map((v, i) => {
        const x = padding + i * step;
        const y = height - padding - (v / max) * (height - padding * 2);
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      }).join(' ');
    } catch (e) {
      return '';
    }
  });

  private async fetchLedgerTotalsForPeriod(startDate: Date, endDate: Date): Promise<void> {
    const storeId = this.selectedStoreId() || this.authService.getCurrentPermission()?.storeId || '';
    if (!storeId) {
      this.salesSummary.set({ totalSales: 0, totalOrders: 0, totalItems: 0 });
      return;
    }

    try {
      const [summary, ordersSummary] = await Promise.all([
        this.bigQueryService.getSalesSummaryTotals(storeId, startDate, endDate),
        this.bigQueryService.getSalesDashboardOrderSummary(storeId, startDate, endDate)
      ]);
      const mergedSummary = {
        totalSales: Number(summary?.totalSales || 0),
        totalOrders: Number(ordersSummary?.totalOrders || 0),
        totalItems: Number(ordersSummary?.totalItems || 0)
      };
      this.salesSummary.set(mergedSummary);
      this.ledgerTotalRevenue.set(mergedSummary.totalSales);
      this.ledgerTotalOrders.set(mergedSummary.totalOrders);
      this.ledgerOrderQty.set(mergedSummary.totalOrders);
      this.ledgerItemsQty.set(mergedSummary.totalItems);
      this.ledgerCompletedQty.set(mergedSummary.totalOrders);
    } catch (err) {
      console.warn('fetchLedgerTotalsForPeriod error:', err);
      this.salesSummary.set({ totalSales: 0, totalOrders: 0, totalItems: 0 });
      this.ledgerTotalRevenue.set(0);
      this.ledgerTotalOrders.set(0);
    }
  }

  private monthlyChartData = computed(() => {
    // Stub: Return empty array or sample data for monthly chart
    // This is used by chartPath() and chartPathProfit() computed properties
    return [] as any[];
  });
}

