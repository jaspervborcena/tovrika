import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OfflineReconciliationService, ReconSummaryApiError } from '../../../services/offline-reconciliation.service';
import { StoreService, formatStoreDisplayName } from '../../../services/store.service';
import { ReportPeriod, StoreSelectionService } from '../../../services/store-selection.service';
import { resolvePeriodDateRange } from '../../../services/report-period.utils';
import { NetworkService } from '../../../core/services/network.service';
import {
  ReconciliationDiscrepancy,
  ReconciliationInvoiceItem,
  ReconciliationIssueCode,
  ReconciliationSummary
} from '../../../interfaces/reconciliation.interface';

@Component({
  selector: 'app-offline-order-reconciliation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './offline-order-reconciliation.component.html',
  styleUrl: './offline-order-reconciliation.component.scss',
  providers: [OfflineReconciliationService]
})
export class OfflineOrderReconciliationComponent implements OnInit {
  private reconciliationService = inject(OfflineReconciliationService);
  private storeService = inject(StoreService);
  private storeSelectionService = inject(StoreSelectionService);
  private networkService = inject(NetworkService);

  // Expose Math for template
  Math = Math;
  protected readonly formatStoreDisplayName = formatStoreDisplayName;

  stores: any[] = [];
  selectedStoreId: string = '';
  periodOptions = this.storeSelectionService.periodOptions;

  get selectedPeriod(): ReportPeriod {
    return this.storeSelectionService.selectedPeriod();
  }

  set selectedPeriod(period: ReportPeriod) {
    this.storeSelectionService.setSelectedPeriod(period);
  }
  
  // Date range defaults to today
  startDate: string = '';
  endDate: string = '';
  
  discrepancies: ReconciliationDiscrepancy[] = [];
  summary: ReconciliationSummary | null = null;
  
  loading = false;
  errorMessage: string | null = null;
  selectedDiscrepancy: ReconciliationDiscrepancy | null = null;
  showDetailModal = false;
  detailRows: ReconciliationInvoiceItem[] = [];
  detailLoading = false;
  detailError: string | null = null;
  private detailRequestId = 0;
  
  // Filters
  severityFilter: 'all' | 'critical' | 'high' = 'all';
  
  async ngOnInit() {
    this.selectedPeriod = 'today';
    this.updateDateRange('today');
    await this.loadStores();
    if (this.selectedStoreId) {
      await this.searchDiscrepancies();
    }
  }

  private async loadStores() {
    try {
      this.stores = this.storeSelectionService.getActiveStores(await this.storeService.getStores());
      if (this.stores.length > 0) {
        this.selectedStoreId = this.stores[0].id;
      }
    } catch (error) {
      console.error('Error loading stores:', error);
    }
  }

  private updateDateRange(period: ReportPeriod): void {
    const range = resolvePeriodDateRange(period);
    this.startDate = range.from;
    this.endDate = range.to;
  }

  onStoreChange(): void {
    void this.searchDiscrepancies();
  }

  onPeriodChange(event: Event): void {
    const period = (event.target as HTMLSelectElement).value as ReportPeriod;
    this.selectedPeriod = period;
    this.updateDateRange(period);
    if (period !== 'date_range') {
      void this.searchDiscrepancies();
    }
  }

  onApplyDateRange(): void {
    void this.searchDiscrepancies();
  }

  async searchDiscrepancies() {
    if (!this.selectedStoreId || !this.startDate || !this.endDate) {
      this.errorMessage = 'Please select a store and date range.';
      this.summary = null;
      return;
    }

    if (this.startDate > this.endDate) {
      this.errorMessage = 'From date must be on or before To date.';
      this.summary = null;
      return;
    }

    if (!this.networkService.isOnline) {
      this.errorMessage = 'You are offline. Connect to the internet and retry.';
      this.summary = null;
      return;
    }

    this.loading = true;
    this.errorMessage = null;
    this.discrepancies = [];
    this.summary = null;
    try {
      this.discrepancies = await this.reconciliationService.findDiscrepancies(
        this.selectedStoreId,
        this.startDate,
        this.endDate
      );

      this.summary = await this.reconciliationService.getReconciliationSummary(
        this.selectedStoreId,
        this.startDate,
        this.endDate,
        this.discrepancies
      );
    } catch (error) {
      console.error('Error searching discrepancies:', error);
      this.discrepancies = [];
      this.summary = null;
      this.errorMessage = this.getSearchErrorMessage(error);
    } finally {
      this.loading = false;
    }
  }

  private getSearchErrorMessage(error: unknown): string {
    if (!(error instanceof ReconSummaryApiError)) {
      return 'Could not load reconciliation data. Please try again.';
    }

    switch (error.status) {
      case 400:
        return 'The selected store or date range is invalid. Check the filters and try again.';
      case 401:
        return 'Your session has expired. Sign in again, then retry.';
      case 403:
        return 'You do not have access to reconciliation data for this store.';
      default:
        return 'Could not load reconciliation data. Please try again.';
    }
  }

  get filteredDiscrepancies(): ReconciliationDiscrepancy[] {
    let filtered = this.discrepancies;

    if (this.severityFilter !== 'all') {
      filtered = filtered.filter(d => d.severity === this.severityFilter);
    }

    return filtered;
  }

  async viewDetails(invoiceNumber: string): Promise<void> {
    const requestId = ++this.detailRequestId;
    this.selectedDiscrepancy = this.discrepancies.find(row => row.invoiceNumber === invoiceNumber) || null;
    this.detailRows = [];
    this.detailError = null;
    this.detailLoading = true;
    this.showDetailModal = true;

    try {
      const rows = await this.reconciliationService.getInvoiceDetails(this.selectedStoreId, invoiceNumber);
      if (requestId === this.detailRequestId) {
        this.detailRows = rows;
      }
    } catch (error) {
      console.error('Reconciliation details request failed.', error);
      if (requestId === this.detailRequestId) {
        this.detailError = 'Could not load invoice details. Please try again.';
      }
    } finally {
      if (requestId === this.detailRequestId) {
        this.detailLoading = false;
      }
    }
  }

  closeDetailModal() {
    this.detailRequestId++;
    this.showDetailModal = false;
    this.selectedDiscrepancy = null;
    this.detailRows = [];
    this.detailError = null;
    this.detailLoading = false;
  }

  getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return 'text-red-600';
      case 'high': return 'text-orange-600';
      default: return 'text-blue-600';
    }
  }

  getSeverityBgColor(severity: string): string {
    switch (severity) {
      case 'critical': return 'bg-red-100';
      case 'high': return 'bg-orange-100';
      default: return 'bg-blue-100';
    }
  }

  getIssueLabel(issue: ReconciliationIssueCode): string {
    switch (issue) {
      case 'NO_INVENTORY': return 'No inventory';
      case 'QTY_MISMATCH': return 'Quantity mismatch';
      default: return issue;
    }
  }

  getIssueCount(discrepancy: ReconciliationDiscrepancy, issue: ReconciliationIssueCode): number {
    return issue === 'NO_INVENTORY'
      ? discrepancy.missingInventoryItemCount
      : discrepancy.quantityMismatchItemCount;
  }

  getItemIssueLabel(issue: string): string {
    switch (issue) {
      case 'NO_INVENTORY': return 'No inventory';
      case 'QTY_MISMATCH': return 'Quantity mismatch';
      case 'OK': return 'No issue';
      default: return issue;
    }
  }

}
