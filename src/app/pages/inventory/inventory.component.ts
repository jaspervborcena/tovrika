import { Component, OnInit, effect, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTableDataSource } from '@angular/material/table';
import { InventoryService as AppInventoryService } from '../../services/inventory.service';
import { StoreService, Store } from '../../services/store.service';
import { AuthService } from '../../services/auth.service';
import { OrderService } from '../../services/order.service';

export interface InventoryRow {
  orderId?: string;
  batchId: string;
  date?: Date | string;
  performedBy?: string;
  productName?: string;
  productCode: string;
  sku: string;
  costPrice: number;
  sellingPrice: number;
  quantity: number;
  runningBalanceTotalStock?: number;  // Beginning stock (product stock at transaction time)
  remainingStock?: number;  // Remaining stock after transaction (beginning - quantity)
  productId?: string;  // Product ID for querying max stock
}

export interface AggregatedInventoryRow {
  date: Date | string;  // Latest date
  productName?: string;
  sku: string;
  productCode: string;
  costPrice: number;  // Average or latest
  sellingPrice: number;  // Average or latest
  quantity: number;  // Sum of all quantities
  runningBalanceTotalStock?: number;  // Beginning stock (highest stock)
  remainingStock?: number;  // Remaining stock (beginning - total quantity)
  profitPerUnit: number;
  totalGross: number;  // Sum
  totalProfit: number;  // Sum
  transactions: InventoryRow[];  // All transactions for this SKU
}

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
  ],
  templateUrl: './inventory.component.html',
  styles: [
    `
      /* Header styles matched to Sales Summary */
      .inventory-container { background: #f8fafc; min-height: 100vh; }

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

      /* Overview-like controls */
      .overview-controls { 
        max-width: 1400px;
        margin: 0 auto;
        padding: 0 2rem 2rem 2rem;
        display: flex;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;
      }
      .overview-controls .control-row { display: flex; gap: 8px; align-items: center; }
      .control-label { font-weight: 600; color: #374151; }
      .control-select { padding: 6px 8px; border-radius: 8px; border: 1px solid #e5e7eb; background: white; cursor: pointer; }
      .control-input { padding: 6px 8px; border-radius: 8px; border: 1px solid #e5e7eb; }
      .control-go { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 6px 10px; border-radius: 8px; cursor: pointer; }
      .date-range-inputs { display: flex; gap: 8px; align-items: center; }

      .single-store { display: inline-block; }
      .store-name { 
        text-transform: uppercase; 
        font-weight: 600;
        color: #111827;
        padding: 6px 12px;
        background-color: #f3f4f6;
        border-radius: 8px;
        display: inline-block;
      }

      /* Table / wrapper */
      .table-wrap { 
        width: 100%; 
        overflow-x: auto; 
        overflow-y: auto;
        max-height: calc(100vh - 300px);
        background: white;
        border-radius: 8px;
        box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
      }
      
      table { 
        width: 100%; 
        min-width: 1200px;
        border-collapse: collapse;
      }
      
      .mat-elevation { 
        padding: 0;
        border-radius: 8px;
      }

      /* Table cell styles */
      th.mat-header-cell, td.mat-cell {
        white-space: nowrap;
        padding: 12px 16px !important;
        font-size: 0.875rem;
      }

      th.mat-header-cell {
        background: #f9fafb;
        font-weight: 600;
        color: #374151;
        border-bottom: 2px solid #e5e7eb;
        position: sticky;
        top: 0;
        z-index: 10;
      }

      td.mat-cell {
        border-bottom: 1px solid #f3f4f6;
        color: #1f2937;
      }

      tr.mat-row:hover {
        background-color: #f9fafb;
      }

      /* Duplicate row highlighting */
      tr.mat-row.duplicate-row {
        background-color: #ffeb3b !important;
      }

      tr.mat-row.duplicate-row:hover {
        background-color: #fdd835 !important;
      }

      /* Column-specific widths */
      .mat-column-date { min-width: 100px; }
      .mat-column-productName { min-width: 180px; }
      .mat-column-productCode { min-width: 120px; }
      .mat-column-sku { min-width: 150px; }
      .mat-column-costPrice { min-width: 100px; text-align: right; }
      .mat-column-sellingPrice { min-width: 100px; text-align: right; }
      .mat-column-quantity { min-width: 80px; text-align: center; }
      .mat-column-profitPerUnit { min-width: 100px; text-align: right; }
      .mat-column-runningBalanceTotalStock { min-width: 130px; text-align: center; }
      .mat-column-remainingStock { min-width: 130px; text-align: center; }
      .mat-column-totalGross { min-width: 120px; text-align: right; }
      .mat-column-totalProfit { min-width: 120px; text-align: right; }
      .mat-column-actions { min-width: 120px; text-align: center; }

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

        .overview-controls {
          padding: 0 1rem 1.5rem 1rem;
          flex-direction: column;
          align-items: stretch;
        }

        .overview-controls .control-row {
          width: 100%;
          justify-content: space-between;
          flex-wrap: wrap;
        }

        .control-label {
          font-size: 0.8125rem;
        }

        .control-select,
        .control-input {
          font-size: 0.875rem;
          padding: 0.625rem 0.75rem;
        }

        .control-go {
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

        .control-label {
          font-size: 0.75rem;
        }

        .control-select,
        .control-input {
          font-size: 0.8125rem;
        }
      }
    `
  ]
})
export class InventoryComponent implements OnInit {
  displayedColumns: string[] = [
    'date',
    'productName',
    'productCode',
    'sku',
    'costPrice',
    'sellingPrice',
    'quantity',
    'profitPerUnit',
    'runningBalanceTotalStock',
    'remainingStock',
    'totalGross',
    'totalProfit',
    'actions'
  ];

  inventoryData: InventoryRow[] = [
    { orderId: 'INV-1001', batchId: 'BATCH-001', productCode: 'CDL Venti', sku: 'PROD-001', costPrice: 120, sellingPrice: 150, quantity: 10 },
    { orderId: 'INV-1002', batchId: 'BATCH-002', productCode: 'CLV1', sku: 'PROD-002', costPrice: 80, sellingPrice: 120, quantity: 5 },
    { orderId: 'INV-1003', batchId: 'BATCH-003', productCode: 'PROD-003', sku: 'PROD-003', costPrice: 50, sellingPrice: 75, quantity: 20 },
    { orderId: 'INV-1004', batchId: 'BATCH-004', productCode: 'PROD-004', sku: 'PROD-004', costPrice: 200, sellingPrice: 250, quantity: 2 },
  ];

  dataSource = new MatTableDataSource<AggregatedInventoryRow>([]);

  // Store management
  stores = signal<Store[]>([]);
  selectedStoreId = signal<string>('');
  hasMultipleStores = computed(() => this.stores().length > 1);

  // Details modal
  showDetails = signal<boolean>(false);
  selectedRow = signal<AggregatedInventoryRow | null>(null);

  constructor(
    public inventoryService: AppInventoryService,
    private storeService: StoreService,
    private authService: AuthService,
    private orderService: OrderService
  ) {
    // reactively update datasource when service rows change
    effect(() => {
      const rows = this.inventoryService.rows();
      console.log('📥 Raw inventory service rows:', rows);
      
      // Check what runningBalanceTotalStock values we have
      rows.forEach((r, idx) => {
        console.log(`Row ${idx}:`, {
          sku: r.sku,
          productId: r.productId,
          runningBalanceTotalStock: r.runningBalanceTotalStock,
          hasStock: r.runningBalanceTotalStock !== undefined && r.runningBalanceTotalStock !== null,
          invoiceNo: r.invoiceNo
        });
      });
      
      // Compute max stock from the already loaded rows
      const mapped = this.computeMaxStockForRows(rows);
      console.log('Mapped rows with computed stock:', mapped);
      
      // Aggregate by SKU
      const aggregated = this.aggregateBySku(mapped);
      console.log('Aggregated rows:', aggregated);
      this.dataSource.data = aggregated;
    });
  }

  /**
   * Compute max runningBalanceTotalStock for each row from already loaded data
   */
  computeMaxStockForRows(rows: any[]): InventoryRow[] {
    return rows.map(r => {
      let maxStock = r.runningBalanceTotalStock || 0;
      
      // Find max stock from all rows with same productId or SKU on the same date
      // Only look at rows that have runningBalanceTotalStock defined (from ordersSellingTracking)
      const rowDate = r.date instanceof Date ? r.date : new Date(r.date || new Date());
      const rowDateStr = rowDate.toISOString().split('T')[0]; // YYYY-MM-DD
      
      rows.forEach(otherRow => {
        // Skip rows without runningBalanceTotalStock (from inventoryDeductions)
        if (!otherRow.runningBalanceTotalStock && otherRow.runningBalanceTotalStock !== 0) {
          return;
        }
        
        const otherDate = otherRow.date instanceof Date ? otherRow.date : new Date(otherRow.date || new Date());
        const otherDateStr = otherDate.toISOString().split('T')[0];
        
        // Check if same product and same date
        const sameProduct = (r.productId && otherRow.productId === r.productId) || 
                           (r.sku && otherRow.sku === r.sku);
        const sameDate = rowDateStr === otherDateStr;
        
        if (sameProduct && sameDate) {
          const stock = Number(otherRow.runningBalanceTotalStock);
          console.log('Comparing stocks:', { current: maxStock, other: stock, sku: r.sku });
          if (stock > maxStock) {
            maxStock = stock;
          }
        }
      });
      
      console.log('Final max stock for', r.sku, ':', maxStock);
      
      const beginningStock = maxStock;
      const remainingStock = beginningStock - (r.quantity || 0);
      
      return {
        orderId: r.invoiceNo,
        batchId: r.batchId || '',
        date: r.date,
        performedBy: r.performedBy,
        productName: r.productName || '',
        productCode: r.productCode || '',
        sku: r.sku || '',
        costPrice: r.costPrice || 0,
        sellingPrice: r.sellingPrice || 0,
        quantity: r.quantity || 0,
        runningBalanceTotalStock: beginningStock,
        remainingStock: remainingStock,
        productId: r.productId || ''
      } as InventoryRow;
    });
  }

  async ngOnInit(): Promise<void> {
    await this.loadStores();
    const currentPermission = this.authService.getCurrentPermission();
    await this.inventoryService.loadRowsForPeriod(
      this.selectedPeriod, 
      1, 
      this.selectedStoreId(),
      currentPermission?.companyId
    );
  }

  async loadStores(): Promise<void> {
    try {
      const currentPermission = this.authService.getCurrentPermission();
      if (!currentPermission?.companyId) {
        console.warn('No companyId found in current permission');
        return;
      }

      const activeStores = await this.storeService.getActiveStoresForDropdown(currentPermission.companyId);
      this.stores.set(activeStores);

      // Set selected store
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

  onStoreChange(): void {
    const currentPermission = this.authService.getCurrentPermission();
    // Reload inventory data for selected store
    this.inventoryService.loadRowsForPeriod(
      this.selectedPeriod, 
      1, 
      this.selectedStoreId(),
      currentPermission?.companyId
    );
  }

  getSelectedStoreName(): string {
    const store = this.stores().find(s => s.id === this.selectedStoreId());
    return store?.storeName.toUpperCase() || 'BREW ORGANICS INC';
  }

  // UI controls - Daily summary optimized (Today/Yesterday recommended)
  periodOptions = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'this_month', label: 'This Month' },
    { key: 'previous_month', label: 'Previous Month' },
    { key: 'date_range', label: 'Date Range' }
  ];
  selectedPeriod: 'today' | 'yesterday' | 'this_month' | 'previous_month' | 'date_range' = 'today';
  dateFrom: string | null = null; // YYYY-MM-DD
  dateTo: string | null = null;

  onPeriodChange(event: Event) {
    const t = event.target as HTMLSelectElement;
    this.selectedPeriod = t.value as 'today' | 'yesterday' | 'this_month' | 'previous_month' | 'date_range';
    if (this.selectedPeriod === 'date_range') {
      // default dateTo = today, dateFrom = today - 30 days
      const now = new Date();
      const toIso = now.toISOString().slice(0, 10);
      const from = new Date(now);
      from.setDate(from.getDate() - 30);
      const fromIso = from.toISOString().slice(0, 10);
      // Only set defaults if not already set by the user
      if (!this.dateFrom) this.dateFrom = fromIso;
      if (!this.dateTo) this.dateTo = toIso;
    } else {
      this.dateFrom = null;
      this.dateTo = null;
    }
    // trigger reload/filter for page 1
    const currentPermission = this.authService.getCurrentPermission();
    this.inventoryService.loadRowsForPeriod(
      this.selectedPeriod, 
      1, 
      this.selectedStoreId(),
      currentPermission?.companyId
    );
  }

  onApplyDateRange() {
    if (!this.dateFrom || !this.dateTo) return;
    const currentPermission = this.authService.getCurrentPermission();
    // trigger reload with custom date range
    this.inventoryService.loadRowsForPeriod(
      this.selectedPeriod, 
      1, 
      this.selectedStoreId(),
      currentPermission?.companyId
    );
  }

  async goToPage(pageOrValue: any) {
    const page = Number(pageOrValue);
    if (!isFinite(page) || page < 1) return;
    const currentPermission = this.authService.getCurrentPermission();
    await this.inventoryService.loadRowsForPeriod(
      this.selectedPeriod, 
      page, 
      this.selectedStoreId(),
      currentPermission?.companyId
    );
    try { window.scrollTo({ top: 120, behavior: 'smooth' }); } catch {}
  }

  pagesToShow(): Array<number | '...'> {
    const total = this.inventoryService.totalPages();
    const current = this.inventoryService.currentPage();
    const maxVisible = 10;
    if (total <= maxVisible) return Array.from({ length: total }, (_, i) => i + 1);

    const pages: Array<number | '...'> = [];
    // show first 3
    pages.push(1, 2, 3);
    if (current > 4 && current < total - 3) {
      pages.push('...');
      pages.push(current - 1, current, current + 1);
      pages.push('...');
    } else {
      pages.push('...');
    }
    // always include last two pages
    pages.push(total - 1, total);
    // unique and filter invalid
    const uniq: Array<number | '...'> = [];
    for (const p of pages) {
      if (p === '...') {
        if (uniq[uniq.length - 1] !== '...') uniq.push('...');
      } else if (typeof p === 'number' && p >= 1 && p <= total) {
        if (!uniq.includes(p)) uniq.push(p);
      }
    }
    return uniq;
  }

  // Aggregate rows by SKU
  aggregateBySku(rows: InventoryRow[]): AggregatedInventoryRow[] {
    const groups = new Map<string, AggregatedInventoryRow & { productId?: string }>();
    
    rows.forEach(row => {
      const key = row.sku;
      
      if (!groups.has(key)) {
        // First transaction for this SKU
        const profitPerUnit = row.sellingPrice - row.costPrice;
        const totalGross = row.sellingPrice * row.quantity;
        const totalProfit = profitPerUnit * row.quantity;
        const beginningStock = row.runningBalanceTotalStock || 0;
        const remainingStock = beginningStock - row.quantity;
        
        groups.set(key, {
          date: row.date || new Date(),
          productName: row.productName || '',
          sku: row.sku,
          productCode: row.productCode,
          costPrice: row.costPrice,
          sellingPrice: row.sellingPrice,
          quantity: row.quantity,
          runningBalanceTotalStock: beginningStock,
          remainingStock: remainingStock,
          profitPerUnit,
          totalGross,
          totalProfit,
          transactions: [row],
          productId: row.productId
        });
      } else {
        // Add to existing group
        const existing = groups.get(key)!;
        existing.quantity += row.quantity;
        existing.totalGross += (row.sellingPrice * row.quantity);
        existing.totalProfit += ((row.sellingPrice - row.costPrice) * row.quantity);
        
        // Get the max stock from all transactions for this SKU
        if ((row.runningBalanceTotalStock || 0) > (existing.runningBalanceTotalStock || 0)) {
          existing.runningBalanceTotalStock = row.runningBalanceTotalStock;
        }
        
        // Recalculate remaining stock (beginning stock - total quantity sold)
        existing.remainingStock = (existing.runningBalanceTotalStock || 0) - existing.quantity;
        
        // Update to latest date
        const existingDate = existing.date instanceof Date ? existing.date : new Date(existing.date);
        const rowDate = row.date instanceof Date ? row.date : new Date(row.date || new Date());
        if (rowDate > existingDate) {
          existing.date = row.date || new Date();
        }
        
        existing.transactions.push(row);
        
        // Recalculate profit per unit (weighted average)
        existing.profitPerUnit = existing.totalProfit / existing.quantity;
      }
    });
    
    const aggregatedArray = Array.from(groups.values());
    console.log('🎯 Aggregated data with max stock from transactions:', aggregatedArray);
    return aggregatedArray;
  }

  // Open details modal
  openDetails(row: AggregatedInventoryRow): void {
    this.selectedRow.set(row);
    this.showDetails.set(true);
  }

  // Close details modal
  closeDetails(): void {
    this.showDetails.set(false);
    this.selectedRow.set(null);
  }
}
