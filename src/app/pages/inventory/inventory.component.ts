import { Component, OnInit, effect } from '@angular/core';
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

export interface InventoryRow {
  orderId?: string;
  batchId: string;
  date?: Date | string;
  performedBy?: string;
  productCode: string;
  sku: string;
  costPrice: number;
  sellingPrice: number;
  quantity: number;
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
        display: flex;
        align-items: center;
        justify-content: space-between;
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
      .overview-controls { display: flex; gap: 12px; align-items: center; margin-top: 12px; flex-wrap: wrap; }
      .overview-controls .control-row { display: flex; gap: 8px; align-items: center; }
      .control-label { font-weight: 600; color: #374151; }
      .control-select { padding: 6px 8px; border-radius: 8px; border: 1px solid #e5e7eb; background: white; }
      .control-input { padding: 6px 8px; border-radius: 8px; border: 1px solid #e5e7eb; }
      .control-go { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 6px 10px; border-radius: 8px; cursor: pointer; }
      .date-range-inputs { display: flex; gap: 8px; align-items: center; }

      .store-name { text-transform: uppercase; }

      /* Table / wrapper */
      .table-wrap { width:100%; overflow:auto }
      table { width:100%; min-width:800px }
      .mat-elevation { padding: 12px; border-radius: 8px }
    `
  ]
})
export class InventoryComponent implements OnInit {
  displayedColumns: string[] = [
    'batchId',
    'date',
    'performedBy',
    'productCode',
    'sku',
    'costPrice',
    'sellingPrice',
    'quantity',
    'profitPerUnit',
    'totalGross',
    'totalProfit'
  ];

  inventoryData: InventoryRow[] = [
    { orderId: 'INV-1001', batchId: 'BATCH-001', productCode: 'CDL Venti', sku: 'PROD-001', costPrice: 120, sellingPrice: 150, quantity: 10 },
    { orderId: 'INV-1002', batchId: 'BATCH-002', productCode: 'CLV1', sku: 'PROD-002', costPrice: 80, sellingPrice: 120, quantity: 5 },
    { orderId: 'INV-1003', batchId: 'BATCH-003', productCode: 'PROD-003', sku: 'PROD-003', costPrice: 50, sellingPrice: 75, quantity: 20 },
    { orderId: 'INV-1004', batchId: 'BATCH-004', productCode: 'PROD-004', sku: 'PROD-004', costPrice: 200, sellingPrice: 250, quantity: 2 },
  ];

  dataSource = new MatTableDataSource<InventoryRow>(this.inventoryData);

  constructor(public inventoryService: AppInventoryService) {
    // reactively update datasource when service rows change
    effect(() => {
      const rows = this.inventoryService.rows();
      // map service row shape to local InventoryRow if necessary
      const mapped = (rows || []).map(r => ({
        orderId: r.invoiceNo,
        batchId: r.batchId || '',
        productCode: r.productCode || '',
        sku: r.sku || '',
        costPrice: r.costPrice || 0,
        sellingPrice: r.sellingPrice || 0,
        quantity: r.quantity || 0
      } as InventoryRow));
      this.dataSource.data = mapped;
    });
  }

  async ngOnInit(): Promise<void> {
    await this.inventoryService.loadRowsForPeriod(this.selectedPeriod, 1);
  }

  // UI controls (simple, mock-driven for now)
  storeName = 'BREW ORGANICS INC';
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
    this.inventoryService.loadRowsForPeriod(this.selectedPeriod, 1);
  }

  onApplyDateRange() {
    if (!this.dateFrom || !this.dateTo) return;
    // trigger reload with custom date range
    this.inventoryService.loadRowsForPeriod(this.selectedPeriod, 1);
  }

  async goToPage(pageOrValue: any) {
    const page = Number(pageOrValue);
    if (!isFinite(page) || page < 1) return;
    await this.inventoryService.loadRowsForPeriod(this.selectedPeriod, page);
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

  profitPerUnit(row: InventoryRow): number {
    return row.sellingPrice - row.costPrice;
  }

  totalProfit(row: InventoryRow): number {
    return this.profitPerUnit(row) * row.quantity;
  }

  totalGross(row: InventoryRow): number {
    return row.sellingPrice * (row.quantity || 0);
  }
}
