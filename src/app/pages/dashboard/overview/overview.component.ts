import { Component, inject, signal, computed, OnInit, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { CommonModule } from '@angular/common';
import { StoreService, Store } from '../../../services/store.service';
import { ProductService } from '../../../services/product.service';
import { Product } from '../../../interfaces/product.interface';
import { Order } from '../../../interfaces/pos.interface';
import { OrderService } from '../../../services/order.service';
import { AuthService } from '../../../services/auth.service';
import { IndexedDBService } from '@app/core/services/indexeddb.service';
import { ExpenseService } from '../../../services/expense.service';
import { ExpenseLog } from '../../../interfaces/expense-log.interface';
import { LedgerService } from '../../../services/ledger.service';
import { OrdersSellingTrackingService } from '../../../services/orders-selling-tracking.service';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule],
  template: `
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
              <select class="control-select" (change)="onOverviewStoreChange($event)">
                <option *ngFor="let s of storeList()" [value]="s.id" [selected]="selectedStoreId()===s.id">{{ s.storeName || s.storeName }}</option>
              </select>
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
                  <span class="change-text">{{ revenueChange().percent | number:'1.1-1' }}% From Last Day</span>
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
                <div class="card-value">{{ totalOrders() }}</div>
                <div class="card-label">Total Orders</div>
                <div class="card-change">
                  <span class="change-icon">↗</span>
                  <span class="change-text">10.5% From Last Day</span>
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
                  <span class="change-icon">↗</span>
                  <span class="change-text">10.5% From Last Day</span>
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
                <div class="analytics-summary" style="display:flex;gap:12px;align-items:center;">
                  <div><strong>Completed:</strong> {{ salesAnalytics().completed.count }} ({{ salesAnalytics().completed.percentage | number:'1.1-1' }}%)</div>
                </div>
                <div style="display:flex;gap:8px;align-items:center;">
                </div>
              </div>
              <div class="donut-chart">
                <div class="bar-chart">
                  <!-- Sale Analytics header removed -->

                  <div class="bars">
                    <div class="bar-row">
                      <div class="bar-label">Completed</div>
                      <div class="bar"><div class="bar-fill completed" [style.width.%]="salesAnalytics().completed.percentage"></div></div>
                      <div class="bar-percent">{{ salesAnalytics().completed.percentage | number:'1.1-1' }}%</div>
                    </div>
                    <div class="bar-row">
                      <div class="bar-label">Cancelled</div>
                      <div class="bar"><div class="bar-fill cancelled" [style.width.%]="salesAnalytics().cancelled.percentage"></div></div>
                      <div class="bar-percent">{{ salesAnalytics().cancelled.percentage | number:'1.1-1' }}%</div>
                    </div>
                    <div class="bar-row">
                      <div class="bar-label">Returned</div>
                      <div class="bar"><div class="bar-fill returned" [style.width.%]="salesAnalytics().returned.percentage"></div></div>
                      <div class="bar-percent">{{ salesAnalytics().returned.percentage | number:'1.1-1' }}%</div>
                    </div>
                    <div class="bar-row">
                      <div class="bar-label">Refunded</div>
                      <div class="bar"><div class="bar-fill refunded" [style.width.%]="salesAnalytics().refunded.percentage"></div></div>
                      <div class="bar-percent">{{ salesAnalytics().refunded.percentage | number:'1.1-1' }}%</div>
                    </div>
                    <div class="bar-row">
                      <div class="bar-label">Damage</div>
                      <div class="bar"><div class="bar-fill damage" [style.width.%]="salesAnalytics().damage.percentage"></div></div>
                      <div class="bar-percent">{{ salesAnalytics().damage.percentage | number:'1.1-1' }}%</div>
                    </div>
                  </div>

                  

                  <!-- Total Expenses removed -->
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
                  <span>SKU</span>
                  <span>Sales</span>
                </div>
                <div class="product-item" *ngFor="let product of topProducts()">
                  <div class="product-info">
                    <div class="product-avatar">{{ product.avatar }}</div>
                    <span>{{ product.name }}</span>
                  </div>
                  <span class="product-code">{{ product.code }}</span>
                  <span class="product-sales">{{ product.count || product.sales || 0 }}</span>
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
  `,
  styles: [`
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
      margin-bottom: 8px;
    }

    .page-subtitle {
      color: #6b7280;
      font-size: 1rem;
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
      background: #06b6d4;
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

    .expenses-card { background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); }
    .profit-card { background: linear-gradient(135deg, #d1fae5 0%, #bbf7d0 100%); }

    .revenue-card {
      background: linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%);
    }

    .orders-card {
      background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
    }

    .customers-card {
      background: linear-gradient(135deg, #cffafe 0%, #bfdbfe 100%);
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
      color: #111827;
      margin-bottom: 0;
    }

    .card-label {
      font-size: 0.875rem;
      color: #6b7280;
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
      color: #6b7280;
    }

    .stats-card {
      background: white;
    }

    .stats-title {
      font-size: 1rem;
      font-weight: 600;
      color: #111827;
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
    }

    .product-code {
      font-size: 0.875rem;
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
    .bar-percent { width:48px; text-align:right; font-weight:600; color:#111827; }

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
  `]
})
export class OverviewComponent implements OnInit {
  private http = inject(HttpClient);
  private storeService = inject(StoreService);
  private productService = inject(ProductService);
  private orderService = inject(OrderService);
  private authService = inject(AuthService);
  private indexedDb = inject(IndexedDBService);
  private expenseService = inject(ExpenseService);
  private ledgerService = inject(LedgerService);
  private ordersSellingTrackingService = inject(OrdersSellingTrackingService);

  // Signals
  protected stores = signal<Store[]>([]);
  protected products = signal<Product[]>([]);
  protected orders = signal<Order[]>([]);
  protected expenses = signal<ExpenseLog[]>([]);
  // Aggregates for expenses: month-to-date and yesterday totals (in PHP, not cents)
  protected monthExpensesTotal = signal<number>(0);
  protected yesterdayExpensesTotal = signal<number>(0);
  // Ledger-driven totals
  protected ledgerTotalRevenue = signal<number>(0);
  protected ledgerTotalOrders = signal<number>(0);
  protected ledgerTotalRefunds = signal<number>(0);
  // Totals for adjustments
  protected ledgerReturnAmount = signal<number>(0);
  protected ledgerReturnQty = signal<number>(0);
  protected ledgerRefundAmount = signal<number>(0);
  protected ledgerRefundQty = signal<number>(0);
  protected ledgerDamageAmount = signal<number>(0);
  protected ledgerDamageQty = signal<number>(0);
  protected ledgerCompletedAmount = signal<number>(0);
  // Ledger-sourced order counts
  protected ledgerOrderQty = signal<number>(0);
  protected ledgerCancelQty = signal<number>(0);
  protected ledgerCompletedQty = signal<number>(0);
  protected topProductsList = signal<any[]>([]);
  protected selectedStoreId = signal<string>('all');
  protected isLoading = signal<boolean>(true);

  // UI controls for overview filtering
  protected periodOptions = [
    { key: 'this_month', label: 'This Month' },
    { key: 'previous_month', label: 'Previous Month' },
    { key: 'date_range', label: 'Date Range' }
  ];
  protected selectedPeriod = signal<'this_month' | 'previous_month' | 'date_range'>('this_month');
  protected dateFrom = signal<string | null>(null); // YYYY-MM-DD
  protected dateTo = signal<string | null>(null);

  // Computed values
  protected currentUserName = computed(() => {
    const user = this.authService.getCurrentUser();
    
    // Get displayName from Firestore user data, fallback to email or 'User'
    return user?.displayName || 
           user?.email?.split('@')[0] || 
           'User';
  });
  
  protected totalStores = computed(() => this.stores().length);
  protected totalProducts = computed(() => this.products().length);
  protected lowStockCount = computed(() => 
    this.products().filter(p => p.totalStock <= 10).length
  );
  protected recentProducts = computed(() => 
    [...this.products()]
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
      .slice(0, 5)
  );
  protected storeList = computed(() => this.stores());
  protected totalRevenue = computed(() => {
    const ledger = this.ledgerTotalRevenue();
    if (ledger && Number(ledger) !== 0) return ledger;
    return this.orders().reduce((s, o) => s + (Number(o.netAmount ?? o.totalAmount ?? 0) || 0), 0);
  });
  // Prefer ledger total orders when available
  protected totalOrders = computed(() => {
    const l = this.ledgerTotalOrders();
    if (l && Number(l) !== 0) return l;
    return this.orders().length;
  });
  // Total expenses shown on the card should reflect month-to-date totals
  protected totalExpenses = computed(() => this.monthExpensesTotal());

  // Change vs yesterday: symbol and percent
  protected expenseChange = computed(() => {
    const month = this.monthExpensesTotal();
    const yesterday = this.yesterdayExpensesTotal();
    const diff = month - yesterday;
    const percent = (() => {
      if (yesterday === 0) return (month === 0 ? 0 : 100);
      const raw = (Math.abs(diff) / yesterday) * 100;
      return Math.round(raw * 10) / 10; // one decimal place
    })();
    const symbol = diff > 0 ? '↗' : (diff < 0 ? '↘' : '→');
    return { symbol, percent, diff };
  });
  protected netProfit = computed(() => this.totalRevenue() - this.totalExpenses());
  protected totalCustomers = computed(() => {
    const set = new Set<string>();
    this.orders().forEach(o => { if (o.soldTo && String(o.soldTo).trim()) set.add(String(o.soldTo)); });
    return set.size;
  });
  protected todayOrders = computed(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    return this.orders().filter(o => {
      const d = o.createdAt ? new Date(o.createdAt) : undefined;
      if (!d) return false;
      const dd = new Date(d); dd.setHours(0,0,0,0);
      return dd.getTime() === today.getTime();
    }).length;
  });

  // Revenue for a specific day (sums netAmount/totalAmount)
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

  // Compute percent change for revenue: compare today vs yesterday
  protected revenueChange = computed(() => {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0,0,0,0);
      const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);

      const revToday = this.revenueForDay(today);
      const revYesterday = this.revenueForDay(yesterday);
      const diff = revToday - revYesterday;

      const percent = (() => {
        if (revYesterday === 0) return (revToday === 0 ? 0 : 100);
        const raw = (Math.abs(diff) / revYesterday) * 100;
        return Math.round(raw * 10) / 10; // one decimal place
      })();

      const symbol = diff > 0 ? '↗' : (diff < 0 ? '↘' : '→');
      return { symbol, percent, diff, revToday, revYesterday };
    } catch (e) {
      return { symbol: '→', percent: 0, diff: 0, revToday: 0, revYesterday: 0 };
    }
  });
  protected monthOrders = computed(() => {
    const now = new Date();
    const m = now.getMonth(); const y = now.getFullYear();
    return this.orders().filter(o => {
      const d = o.createdAt ? new Date(o.createdAt) : undefined;
      return d && d.getMonth() === m && d.getFullYear() === y;
    }).length;
  });

  constructor() {
    this.loadData();

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
    const v = target.value as 'this_month' | 'previous_month' | 'date_range';
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
    const start = new Date(from + 'T00:00:00');
    const end = new Date(to + 'T23:59:59.999');
    this.loadAnalyticsData(start, end);
  }

  // Compute start/end dates for selected period and call analytics loader
  protected applyPeriodAndLoad() {
    const period = this.selectedPeriod();
    const now = new Date();
    let start: Date | undefined;
    let end: Date | undefined;
    if (period === 'this_month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(), 23, 59, 59, 999);
    } else if (period === 'previous_month') {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      start = new Date(prev.getFullYear(), prev.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(prev.getFullYear(), prev.getMonth(), new Date(prev.getFullYear(), prev.getMonth() + 1, 0).getDate(), 23, 59, 59, 999);
    } else if (period === 'date_range') {
      const from = this.dateFrom();
      const to = this.dateTo();
      if (from && to) {
        start = new Date(from + 'T00:00:00');
        end = new Date(to + 'T23:59:59.999');
      }
    }

    // If we have a store selected, trigger analytics load
    const storeId = this.selectedStoreId() || this.authService.getCurrentPermission()?.storeId;
    if (storeId && start && end) {
      this.loadAnalyticsData(start, end);
    }
  }

  ngOnInit(): void {
    // Initialize data loading on component init - same as sales-summary
    this.loadData();
  }

  private async loadData() {
    try {
      this.isLoading.set(true);
      console.log('🚀 Dashboard: Starting data load...');
      
      // EXACT same approach as sales-summary
      await this.loadStores();
      
      // After stores load, use the selected period/store to load analytics
      // This ensures the new store/period controls drive the initial load
      setTimeout(() => {
        this.applyPeriodAndLoad();
      }, 100);

    } catch (error) {
      console.error('❌ Dashboard error loading data:', error);
      this.isLoading.set(false);
    }
  }

  // Note: SVG pie helpers removed — Chart.js (ng2-charts) canvas is used instead.

  async loadStores(): Promise<void> {
    try {
      const currentPermission = this.authService.getCurrentPermission();
      console.log('🔐 Dashboard permission:', currentPermission);
      
      if (!currentPermission?.companyId) {
        console.warn('No companyId found in current permission');
        return;
      }

      const stores = await this.storeService.getStoresByCompany(currentPermission.companyId);
      this.stores.set(stores);
      console.log('🏪 Dashboard stores loaded:', stores?.length || 0);

      // Set selected store - EXACT same logic as sales-summary
      if (currentPermission?.storeId) {
        this.selectedStoreId.set(currentPermission.storeId);
        console.log('🎯 Using permission store ID:', currentPermission.storeId);
      } else if (stores.length > 0 && stores[0].id) {
        this.selectedStoreId.set(stores[0].id);
        console.log('🎯 Using first store ID:', stores[0].id);
      }
    } catch (error) {
      console.error('Error loading stores:', error);
      this.stores.set([]);
    }
  }

  async loadCurrentDateData(): Promise<void> {
    console.log('🔄 Dashboard: Loading current date data from Firebase');
    
    try {
      // Use selected store ID or get from permission - EXACT same logic
      const storeId = this.selectedStoreId() || this.authService.getCurrentPermission()?.storeId;
      console.log('🏪 Dashboard Store ID resolution:', {
        selectedStoreId: this.selectedStoreId(),
        permissionStoreId: this.authService.getCurrentPermission()?.storeId,
        finalStoreId: storeId,
        allStores: this.stores().map(s => ({ id: s.id, name: s.storeName }))
      });
      
      if (!storeId) {
        console.warn('❌ Dashboard: No storeId found - cannot load data');
        this.orders.set([]);
        return;
      }

      // Load TODAY's data - same as sales-summary
      const today = new Date();
      const startDate = new Date(today.toISOString().split('T')[0]); // Start of today
      const endDate = new Date(today.toISOString().split('T')[0]); // End of today
      endDate.setHours(23, 59, 59, 999);

      console.log('📅 Dashboard loading sales data for store:', storeId, 'from:', startDate, 'to:', endDate);

  // Use Cloud Function API for sales data (same as sales summary)
  // Explicitly request completed sales for the overview dashboard
  await this.loadSalesFromCloudFunction(storeId, startDate, endDate, 'completed');

      // Load today's expenses for the same date range
      const expenses = await this.expenseService.getExpensesByStore(storeId, startDate, endDate);
      this.expenses.set(expenses || []);

      // Also compute month-to-date and yesterday aggregates for the Overview card
      try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        const monthEnd = now; // month-to-date
        let monthExpenses = await this.expenseService.getExpensesByStore(storeId, monthStart, monthEnd);

        // Debugging: if no results, try a fallback query without date filters to detect schema mismatches
        if ((!monthExpenses || monthExpenses.length === 0)) {
          console.warn('Overview: monthExpenses query returned 0 rows, trying fallback no-date query');
          const fallback = await this.expenseService.getExpensesByStore(storeId);
          if (fallback && fallback.length > 0) {
            console.warn('Overview: fallback expenses returned', fallback.length, 'rows; using these for month total');
            monthExpenses = fallback;
          }
        }

        const monthTotal = (monthExpenses || []).reduce((s, e) => s + (Number((e as any).amount || 0) / 100), 0);
        console.log('Overview: monthExpenses count=', (monthExpenses || []).length, 'monthTotal=', monthTotal);
        // Start with expense service total (PHP units)
        this.monthExpensesTotal.set(monthTotal);

        // Also compute ledger expense/refund totals for the same month-to-date range and add to expenses
        try {
          const currentPermission = this.authService.getCurrentPermission();
          const companyId = currentPermission?.companyId || '';
          // Include both 'refund' and manual 'expense' ledger event types
          const ledgerExpenses = await this.ledgerService.sumEventsInRange(companyId, storeId, monthStart, monthEnd, ['refund', 'expense']);
          const ledgerExpensesNum = Number(ledgerExpenses || 0);
          this.ledgerTotalRefunds.set(ledgerExpensesNum);
          // Add ledger expense/refund amounts to monthExpensesTotal
          this.monthExpensesTotal.set(monthTotal + ledgerExpensesNum);
        } catch (ledgerErr) {
          console.warn('Overview: failed to compute ledger expenses', ledgerErr);
        }

        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const yStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
        const yEnd = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
        let yExpenses = await this.expenseService.getExpensesByStore(storeId, yStart, yEnd);
        if ((!yExpenses || yExpenses.length === 0)) {
          console.warn('Overview: yesterdayExpenses query returned 0 rows, trying fallback no-date query');
          const fallbackY = await this.expenseService.getExpensesByStore(storeId);
          if (fallbackY && fallbackY.length > 0) {
            // Derive yesterday total by filtering fallback result locally
            yExpenses = (fallbackY || []).filter((e: any) => {
              const pd = (e.paymentDate && (e.paymentDate as any).toDate) ? (e.paymentDate as any).toDate() : (e.paymentDate ? new Date(e.paymentDate) : null);
              if (!pd) return false;
              const d = new Date(pd); d.setHours(0,0,0,0);
              return d.getTime() === new Date(yStart).getTime();
            });
            console.warn('Overview: derived yesterdayExpenses count=', yExpenses.length);
          }
        }

        let yTotal = (yExpenses || []).reduce((s, e) => s + (Number((e as any).amount || 0) / 100), 0);
        try {
          const currentPermission = this.authService.getCurrentPermission();
          const companyId = currentPermission?.companyId || '';
          const ledgerYesterday = await this.ledgerService.sumEventsInRange(companyId, storeId, yStart, yEnd, ['refund', 'expense']);
          const ledgerY = Number(ledgerYesterday || 0);
          yTotal = yTotal + ledgerY;
        } catch (ledgerErr) {
          console.warn('Overview: failed to compute ledger yesterday expenses', ledgerErr);
        }
        console.log('Overview: yesterdayExpenses count=', (yExpenses || []).length, 'yTotal=', yTotal);
        this.yesterdayExpensesTotal.set(yTotal);
      } catch (e) {
        console.warn('Overview: Failed to load expense aggregates', e);
        this.monthExpensesTotal.set(0);
        this.yesterdayExpensesTotal.set(0);
      }
        // Ensure Top Products are refreshed for the currently selected store/company
        try {
          await this.fetchTopProducts(storeId);
        } catch (tpErr) {
          console.warn('Overview: failed to refresh top products during analytics load', tpErr);
          this.topProductsList.set([]);
        }
        console.log('📈 Analytics data loaded:', this.orders().length);

      console.log('📊 Dashboard sales data loaded from Cloud Function:', this.orders().length, 'orders');
      if (this.orders().length > 0) {
        const totalRevenue = this.totalRevenue();
        console.log('💰 Dashboard total revenue:', totalRevenue);
        console.log('📋 Dashboard sample order:', this.orders()[0]);
      }

      // Fetch ledger-driven totals (orders running balances) for display
      try {
        const currentPermission = this.authService.getCurrentPermission();
        const companyId = currentPermission?.companyId || '';
        const storeId = this.selectedStoreId() || this.authService.getCurrentPermission()?.storeId || '';
        const end = endDate || new Date();
        const orderBalances = await this.ledgerService.getLatestOrderBalances(companyId, storeId, end, 'completed');
        this.ledgerTotalRevenue.set(Number(orderBalances.runningBalanceAmount || 0));
        // Use runningBalanceQty for total orders and prefer runningBalanceOrderQty if present
        this.ledgerTotalOrders.set(Number(orderBalances.runningBalanceOrderQty || orderBalances.runningBalanceQty || 0));
      } catch (err) {
        console.warn('Overview: failed to load ledger totals', err);
      }

      // Load products for analytics
      const products = await this.productService.getProducts();
      this.products.set(products || []);

      // Load top products by completed counts (prefer ledger/aggregates)
      try {
        await this.fetchTopProducts();
      } catch (e) {
        console.warn('Overview: failed to load top products', e);
        this.topProductsList.set([]);
      }

    } catch (error) {
      console.error('❌ Dashboard error loading current date data:', error);
      this.orders.set([]);
    } finally {
      this.isLoading.set(false);
      console.log('✅ Dashboard data loading complete');
    }
  }

  // Analytics computed properties based on BigQuery/Firebase data
  readonly salesAnalytics = computed(() => {
    const orders = this.orders() || [];

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

    // Ensure values are numeric and normalize rounding if needed
    const total = segments.reduce((s, x) => s + (isFinite(x.pct) ? x.pct : 0), 0) || 100;
    // If total is not 100, scale values to fit 100
    const scale = total === 0 ? 0 : 100 / total;
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
    // Prefer topProductsList if available (from ledger aggregation)
    const topList = this.topProductsList();
    if (topList && topList.length > 0) return topList;

    const products = this.products();
    const orders = this.orders();

    // Create a map to track product sales from orders
    const productSales = new Map<string, { product: any; sales: number; code: string }>();

    // Initialize with existing products
    products.forEach(product => {
      if (product.id) {
        productSales.set(product.id, {
          product: product,
          sales: 0,
          code: product.skuId || product.id.slice(-4).toUpperCase()
        });
      }
    });

    // Count sales from orders (you would extend this to parse order items)
    orders.forEach(order => {
      // For now, simulate product sales distribution
      const randomProducts = Array.from(productSales.keys()).slice(0, 3);
      randomProducts.forEach(productId => {
        const existing = productSales.get(productId);
        if (existing) {
          existing.sales += Math.floor(Math.random() * 5) + 1;
        }
      });
    });

    // Get top 4 products by sales
    return Array.from(productSales.values())
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 4)
      .map(item => ({
        name: item.product.productName || 'Product',
        code: item.code,
        avatar: item.product.productName?.charAt(0).toUpperCase() || 'P',
        sales: item.sales
      }));
  });

  readonly monthlyChartData = computed(() => {
    const orders = this.orders();

    // If the selected period is a single month, return daily data for that month
    const period = this.selectedPeriod();
    if (period === 'this_month' || period === 'previous_month') {
      const now = new Date();
      const ref = period === 'this_month' ? now : new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const year = ref.getFullYear();
      const month = ref.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      return Array.from({ length: daysInMonth }).map((_, idx) => {
        const day = idx + 1;
        const start = new Date(year, month, idx, 0, 0, 0, 0);
        const end = new Date(year, month, idx, 23, 59, 59, 999);
        const dayOrders = orders.filter(o => {
          const d = o.createdAt ? new Date(o.createdAt) : null;
          return d && d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
        });
        const ordersCount = dayOrders.length;
        const profit = dayOrders.reduce((s, o) => s + (Number(o.netAmount ?? o.totalAmount ?? 0) || 0), 0);
        return { label: String(day), orders: ordersCount, profit: Math.round(profit) };
      });
    }

    // Default: monthly overview across months
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonth = new Date().getMonth();

    return months.map((month, index) => {
      const baseValue = orders.length > 0 ? this.totalRevenue() : 0;
      const multiplier = index <= currentMonth ? Math.random() * 0.8 + 0.4 : 0;

      return {
        label: month,
        orders: Math.floor(baseValue * multiplier / 1000),
        profit: Math.floor(baseValue * multiplier * 0.3 / 1000)
      };
    });
  });

  protected chartLabels = computed(() => this.monthlyChartData().map(d => d.label));

  // Method to load sales data from Cloud Function API
  async loadSalesFromCloudFunction(storeId: string, startDate?: Date, endDate?: Date, status: string = 'completed'): Promise<void> {
    // Ensure we have a reference date available both in try and catch blocks
    const refDate = startDate || new Date();
    try {
      // Format dates for API (YYYYMM for month queries)
      const year = refDate.getFullYear();
      const month = refDate.getMonth() + 1;
      const monthStr = `${year}${month.toString().padStart(2, '0')}`; // e.g. 202511

  const apiBase = environment.api?.baseUrl || '';
  const apiUrl = `${apiBase}/sales_summary_by_store?month=${monthStr}&storeId=${storeId}&status=${encodeURIComponent(status)}`;
      
      console.log('🌐 Fetching sales data from Cloud Function:', apiUrl);
      console.log('🔐 Auth interceptor will automatically attach Firebase ID token');

      // Use HttpClient so auth interceptor can automatically add Authorization header
      const salesData = await this.http.get<any>(apiUrl, {
        headers: { 'Accept': 'application/json' }
      }).toPromise();
      console.log('📊 Cloud Function response (raw):', salesData);
      console.log('📊 Cloud Function response structure check:', {
        hasSuccess: !!salesData?.success,
        hasRows: !!salesData?.rows,
        rowsLength: salesData?.rows?.length || 0,
        firstRow: salesData?.rows?.[0] || null,
        hasSummary: !!salesData?.summary
      });

      if (salesData && (salesData.summary || (salesData.success && salesData.rows))) {
        // Extract data from Cloud Function response
        let totalRevenue = 0;
        let totalOrders = 0;
        let totalCustomers = 0;
        
        if (salesData.summary) {
          // Legacy format: use summary object
          totalRevenue = Number(salesData.summary.totalRevenue || 0);
          totalOrders = Number(salesData.summary.totalOrders || 0);
          totalCustomers = Number(salesData.summary.uniqueCustomers || 0);
        } else if (salesData.success && salesData.rows && salesData.rows.length > 0) {
          // New format: use rows array
          const firstRow = salesData.rows[0];
          totalRevenue = Number(firstRow.totalAmount || 0);
          totalOrders = Number(salesData.count || 0);
          totalCustomers = Number(firstRow.uniqueCustomers || 0);
        }
        
        console.log('📊 Extracted values:', { totalRevenue, totalOrders, totalCustomers });

        // Create synthetic orders array for computed values
        // This maintains compatibility with existing template
        const syntheticOrders: any[] = Array.from({ length: totalOrders }, (_, index) => ({
          id: `cf-order-${index}`,
          orderId: `cf-order-${index}`,
          companyId: '',
          storeId: storeId,
          assignedCashierId: '',
          status: 'completed',
          netAmount: totalRevenue / Math.max(1, totalOrders), // Average order value
          totalAmount: totalRevenue / Math.max(1, totalOrders),
          vatAmount: 0,
          vatExemptAmount: 0,
          discountAmount: 0,
          grossAmount: totalRevenue / Math.max(1, totalOrders),
          atpOrOcn: '',
          birPermitNo: '',
          inclusiveSerialNumber: '',
          message: '',
          soldTo: index < totalCustomers ? `Customer ${index + 1}` : '',
          createdAt: new Date(refDate.getTime() + (index * 86400000)), // Spread across period (use refDate when startDate may be undefined)
          customerName: index < totalCustomers ? `Customer ${index + 1}` : 'Cash Sale',
          items: [],
          paymentMethod: 'cash' as const
        }));

        this.orders.set(syntheticOrders);
        
        console.log(`✅ Loaded sales data: ₱${totalRevenue} revenue, ${totalOrders} orders, ${totalCustomers} customers`);
      } else {
        console.warn('⚠️ Cloud Function returned unexpected data format');
        this.orders.set([]);
      }

    } catch (error) {
      console.error('❌ Error loading from Cloud Function, falling back to Firebase:', error);
      
      // Fallback to original Firebase/BigQuery approach
  const orders = await this.orderService.getOrdersByDateRange(storeId, startDate || refDate, endDate || refDate);
      this.orders.set(orders.map((order: any) => ({
        ...order,
        id: order.id || '',
        customerName: order.soldTo || 'Cash Sale',
        items: [],
        paymentMethod: 'cash'
      })));
    }
  }

  // Method to load analytics data from Cloud Function API
  async loadAnalyticsData(startDate: Date, endDate: Date): Promise<void> {
    try {
      this.isLoading.set(true);
      
      const storeId = this.selectedStoreId() || this.authService.getCurrentPermission()?.storeId;
      if (!storeId) return;

      console.log('📊 Loading analytics data from Cloud Function API...', { storeId, startDate, endDate });
      
  // Use Cloud Function API for sales data (same as sales summary)
  // Explicitly request completed sales for analytics/overview
  await this.loadSalesFromCloudFunction(storeId, startDate, endDate, 'completed');

      // Load expenses for the same date range and compute totals
      try {
        let expenses = await this.expenseService.getExpensesByStore(storeId, startDate, endDate);

        // If the query returned no rows, it's possible paymentDate is stored in a different shape
        // (string or different field type). Fallback: fetch all expenses for store and filter locally.
        if ((!expenses || expenses.length === 0)) {
          const fallback = await this.expenseService.getExpensesByStore(storeId);
          if (fallback && fallback.length > 0) {
            // Filter by paymentDate within [startDate,endDate]
            expenses = (fallback || []).filter((e: any) => this.isPaymentDateInRange(e?.paymentDate, startDate, endDate));
            console.warn('Overview: used fallback expenses and filtered locally; count=', expenses.length);
          }
        }

        this.expenses.set(expenses || []);
        const periodTotal = (expenses || []).reduce((s, e) => s + (Number((e as any).amount || 0) / 100), 0);
        this.monthExpensesTotal.set(periodTotal);

        // Also fetch ledger totals for returns/refunds/damage within the selected range
        try {
          const currentPermission = this.authService.getCurrentPermission();
          const companyId = currentPermission?.companyId || '';
          const adjustments = await this.ledgerService.getAdjustmentTotals(companyId, storeId, startDate, endDate);

          this.ledgerReturnAmount.set(Number(adjustments.returns.amount || 0));
          this.ledgerReturnQty.set(Number(adjustments.returns.qty || 0));
          this.ledgerRefundAmount.set(Number(adjustments.refunds.amount || 0));
          this.ledgerRefundQty.set(Number(adjustments.refunds.qty || 0));
          this.ledgerDamageAmount.set(Number(adjustments.damages.amount || 0));
          this.ledgerDamageQty.set(Number(adjustments.damages.qty || 0));
          // If getAdjustmentTotals now returns completed totals, prefer that for completed qty
          const adjAny: any = adjustments as any;
          if (adjAny && adjAny.completed) {
            this.ledgerCompletedQty.set(Number(adjAny.completed.qty || 0));
            this.ledgerCompletedAmount.set(Number(adjAny.completed.amount || 0));
          }

          // Also compute ledger order / cancel / completed qty for the selected range
          try {
            // Query ledger for completed events (service now uses 'completed' eventType)
            const ordersAgg = await this.ledgerService.sumEventsAmountAndQty(companyId, storeId, startDate, endDate, ['completed']);
            const cancelsAgg = await this.ledgerService.sumEventsAmountAndQty(companyId, storeId, startDate, endDate, ['cancel']);
            const orderQty = Number(ordersAgg.qty || 0);
            const cancelQty = Number(cancelsAgg.qty || 0);
            // If adjustments.completed was not present, compute completed as order - cancel
            this.ledgerOrderQty.set(orderQty);
            this.ledgerCancelQty.set(cancelQty);
            // Use the aggregation amount if adjustments.completed.amount wasn't provided
            if (!this.ledgerCompletedAmount() || this.ledgerCompletedAmount() === 0) {
              this.ledgerCompletedAmount.set(Number(ordersAgg.amount || 0));
            }
            if (!this.ledgerCompletedQty() || this.ledgerCompletedQty() === 0) {
              const completedQty = Math.max(0, orderQty - cancelQty);
              this.ledgerCompletedQty.set(completedQty);
            }
          } catch (e) {
            console.warn('Overview: failed to compute ledger order/cancel totals', e);
            this.ledgerOrderQty.set(0);
            this.ledgerCancelQty.set(0);
            this.ledgerCompletedQty.set(0);
          }

          // Add refunds/damages to monthExpensesTotal if desired (refunds typically reduce revenue, but user previously added refunds to expenses)
          // Here we keep monthExpensesTotal as expense logs + ledger expense/refund (already handled elsewhere). Returns/damages are shown separately.
        } catch (ledgerErr) {
          console.warn('Overview: failed to load ledger event totals', ledgerErr);
        }

        // Also compute yesterday total for comparison
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const yStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
        const yEnd = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
        let yExpenses = await this.expenseService.getExpensesByStore(storeId, yStart, yEnd);
        if ((!yExpenses || yExpenses.length === 0)) {
          const fallbackY = await this.expenseService.getExpensesByStore(storeId);
          if (fallbackY && fallbackY.length > 0) {
            yExpenses = (fallbackY || []).filter((e: any) => this.isPaymentDateInRange(e?.paymentDate, yStart, yEnd));
          }
        }
        const yTotal = (yExpenses || []).reduce((s, e) => s + (Number((e as any).amount || 0) / 100), 0);
        this.yesterdayExpensesTotal.set(yTotal);
      } catch (e) {
        console.warn('Overview: failed to load expenses for selected range', e);
        this.expenses.set([]);
        this.monthExpensesTotal.set(0);
        this.yesterdayExpensesTotal.set(0);
      }

      console.log('📈 Analytics data loaded:', this.orders().length, 'orders');
      
    } catch (error) {
      console.error('❌ Error loading analytics data:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  // Method to refresh analytics for different date ranges
  refreshAnalytics(days: number = 30): void {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    this.loadAnalyticsData(startDate, endDate);
  }

  /**
   * Fetch top products using OrdersSellingTrackingService.getTopProductsCompletedCounts
   * and map results to the UI-friendly shape stored in `topProductsList`.
   */
  private async fetchTopProducts(storeId?: string): Promise<void> {
    try {
      const currentPermission = this.authService.getCurrentPermission();
      const companyId = currentPermission?.companyId || '';
      // Resolve store: prefer explicit arg, then selectedStoreId, then permission storeId, omit when 'all' or empty
      let resolvedStoreId = storeId;
      if (!resolvedStoreId) {
        const sel = this.selectedStoreId();
        resolvedStoreId = (sel && sel !== 'all') ? sel : (this.authService.getCurrentPermission()?.storeId || undefined);
      }

      const top = await this.ordersSellingTrackingService.getTopProductsCompletedCounts(companyId, resolvedStoreId, 10);
      console.log('Overview.fetchTopProducts: raw', top?.length || 0);
      const mapped = (top || []).slice(0, 10).map((p: any) => ({
        avatar: (p.productName || '').split(' ').map((s: string) => s.charAt(0)).slice(0,2).join('').toUpperCase() || 'P',
        name: p.productName || 'Product',
        code: p.skuId || '',
        count: Number(p.completedCount || 0)
      }));
      console.log('Overview.fetchTopProducts: mapped', mapped);
      this.topProductsList.set(mapped);
    } catch (err) {
      console.warn('fetchTopProducts error', err);
      this.topProductsList.set([]);
    }
  }

  // Helper: determine if a paymentDate value (Timestamp, ISO string, or Date) falls within start/end
  private isPaymentDateInRange(paymentDate: any, start?: Date | null, end?: Date | null): boolean {
    if (!paymentDate || !start || !end) return false;
    let pd: Date | null = null;
    try {
      // Firestore Timestamp
      if (paymentDate?.toDate && typeof paymentDate.toDate === 'function') {
        pd = paymentDate.toDate();
      } else if (typeof paymentDate === 'string') {
        pd = new Date(paymentDate);
      } else if (paymentDate instanceof Date) {
        pd = paymentDate;
      } else if (paymentDate && paymentDate.seconds) {
        // unix-like object
        pd = new Date(paymentDate.seconds * 1000);
      }
    } catch (e) {
      return false;
    }
    if (!pd || isNaN(pd.getTime())) return false;
    // Normalize to day boundaries for inclusive comparison
    const t = pd.getTime();
    return t >= start.getTime() && t <= end.getTime();
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
}