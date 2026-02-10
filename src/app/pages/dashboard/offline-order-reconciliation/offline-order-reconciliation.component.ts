import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OfflineReconciliationService } from '../../../services/offline-reconciliation.service';
import { StoreService } from '../../../services/store.service';
import { NetworkService } from '../../../core/services/network.service';
import { ReconciliationDiscrepancy, ReconciliationSummary } from '../../../interfaces/reconciliation.interface';
import { ConfirmationDialogComponent, ConfirmationDialogData } from '../../../shared/components/confirmation-dialog/confirmation-dialog.component';

@Component({
  selector: 'app-offline-order-reconciliation',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmationDialogComponent],
  templateUrl: './offline-order-reconciliation.component.html',
  styleUrl: './offline-order-reconciliation.component.scss'
})
export class OfflineOrderReconciliationComponent implements OnInit {
  private reconciliationService = inject(OfflineReconciliationService);
  private storeService = inject(StoreService);
  private networkService = inject(NetworkService);

  // Expose Math for template
  Math = Math;

  stores: any[] = [];
  selectedStoreId: string = '';
  
  // Date range defaults to last 30 days
  startDate: string = '';
  endDate: string = '';
  
  discrepancies: ReconciliationDiscrepancy[] = [];
  summary: ReconciliationSummary | null = null;
  
  loading = false;
  selectedDiscrepancy: ReconciliationDiscrepancy | null = null;
  showDetailModal = false;
  
  // Filters
  severityFilter: 'all' | 'critical' | 'warning' | 'info' = 'all';
  offlineOnlyFilter = false;
  
  // Processing state
  processing = false;
  processingMessage = '';

  // Confirmation dialog state
  showConfirmDialog = signal<boolean>(false);
  confirmDialogData = signal<ConfirmationDialogData | null>(null);
  private pendingAction: (() => Promise<void>) | null = null;

  async ngOnInit() {
    await this.loadStores();
    this.initializeDateRange();
  }

  private async loadStores() {
    try {
      this.stores = await this.storeService.getStores();
      if (this.stores.length > 0) {
        this.selectedStoreId = this.stores[0].id;
      }
    } catch (error) {
      console.error('Error loading stores:', error);
    }
  }

  private initializeDateRange() {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    this.endDate = this.formatDateForInput(today);
    this.startDate = this.formatDateForInput(thirtyDaysAgo);
  }

  private formatDateForInput(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  async searchDiscrepancies() {
    if (!this.selectedStoreId || !this.startDate || !this.endDate) {
      alert('Please select store and date range');
      return;
    }

    if (!this.networkService.isOnline()) {
      alert('⚠️ Cannot search for discrepancies while offline. Please connect to the internet.');
      return;
    }

    this.loading = true;
    try {
      const start = new Date(this.startDate);
      const end = new Date(this.endDate);
      end.setHours(23, 59, 59, 999); // End of day

      this.discrepancies = await this.reconciliationService.findDiscrepancies(
        this.selectedStoreId,
        start,
        end
      );

      this.summary = await this.reconciliationService.getReconciliationSummary(
        this.selectedStoreId,
        start,
        end
      );
    } catch (error) {
      console.error('Error searching discrepancies:', error);
      alert('Error searching discrepancies. Please try again.');
    } finally {
      this.loading = false;
    }
  }

  get filteredDiscrepancies(): ReconciliationDiscrepancy[] {
    let filtered = this.discrepancies;

    if (this.severityFilter !== 'all') {
      filtered = filtered.filter(d => d.severity === this.severityFilter);
    }

    if (this.offlineOnlyFilter) {
      filtered = filtered.filter(d => d.isOfflineOrder);
    }

    return filtered;
  }

  viewDetails(discrepancy: ReconciliationDiscrepancy) {
    this.selectedDiscrepancy = discrepancy;
    this.showDetailModal = true;
  }

  closeDetailModal() {
    this.showDetailModal = false;
    this.selectedDiscrepancy = null;
  }

  async reprocessInventory(discrepancy: ReconciliationDiscrepancy) {
    // Check online status first
    if (!this.networkService.isOnline()) {
      this.confirmDialogData.set({
        title: 'Offline Mode',
        message: 'Cannot reprocess inventory while offline. Please connect to the network to continue.',
        confirmText: 'OK',
        type: 'warning'
      });
      this.showConfirmDialog.set(true);
      return;
    }

    // Show confirmation dialog
    this.confirmDialogData.set({
      title: 'Reprocess Inventory',
      message: `Reprocess inventory for invoice ${discrepancy.invoiceNumber}?\n\nThis will deduct stock using FIFO logic. This action cannot be undone.`,
      confirmText: 'Reprocess',
      cancelText: 'Cancel',
      type: 'warning'
    });

    // Store the action to execute on confirmation
    this.pendingAction = async () => {
      this.processing = true;
      this.processingMessage = 'Reprocessing inventory...';

      try {
        const result = await this.reconciliationService.reprocessInventory(discrepancy.orderId);
        
        if (result.success) {
          await this.searchDiscrepancies(); // Refresh
          this.closeDetailModal();
          // Show success message
          this.confirmDialogData.set({
            title: 'Success',
            message: result.message,
            confirmText: 'OK',
            type: 'info'
          });
          this.showConfirmDialog.set(true);
        } else {
          // Show error message
          this.confirmDialogData.set({
            title: 'Error',
            message: result.message,
            confirmText: 'OK',
            type: 'danger'
          });
          this.showConfirmDialog.set(true);
        }
      } catch (error) {
        console.error('Error reprocessing inventory:', error);
        this.confirmDialogData.set({
          title: 'Error',
          message: 'Error reprocessing inventory. Please try again.',
          confirmText: 'OK',
          type: 'danger'
        });
        this.showConfirmDialog.set(true);
      } finally {
        this.processing = false;
        this.processingMessage = '';
      }
    };

    this.showConfirmDialog.set(true);
  }

  async createLedgerEntry(discrepancy: ReconciliationDiscrepancy) {
    // Check online status first
    if (!this.networkService.isOnline()) {
      this.confirmDialogData.set({
        title: 'Offline Mode',
        message: 'Cannot create ledger entry while offline. Please connect to the network to continue.',
        confirmText: 'OK',
        type: 'warning'
      });
      this.showConfirmDialog.set(true);
      return;
    }

    // Show confirmation dialog
    this.confirmDialogData.set({
      title: 'Create Ledger Entry',
      message: `Create ledger entry for invoice ${discrepancy.invoiceNumber}?\n\nAmount: ₱${discrepancy.trackingAmount.toFixed(2)}\n\nThis will create an accounting record for this transaction.`,
      confirmText: 'Create',
      cancelText: 'Cancel',
      type: 'info'
    });

    // Store the action to execute on confirmation
    this.pendingAction = async () => {
      this.processing = true;
      this.processingMessage = 'Creating ledger entry...';

      try {
        const result = await this.reconciliationService.createMissingLedger(discrepancy.orderId);
        
        if (result.success) {
          await this.searchDiscrepancies(); // Refresh
          this.closeDetailModal();
          // Show success message
          this.confirmDialogData.set({
            title: 'Success',
            message: result.message,
            confirmText: 'OK',
            type: 'info'
          });
          this.showConfirmDialog.set(true);
        } else {
          // Show error message
          this.confirmDialogData.set({
            title: 'Error',
            message: result.message,
            confirmText: 'OK',
            type: 'danger'
          });
          this.showConfirmDialog.set(true);
        }
      } catch (error) {
        console.error('Error creating ledger:', error);
        this.confirmDialogData.set({
          title: 'Error',
          message: 'Error creating ledger entry. Please try again.',
          confirmText: 'OK',
          type: 'danger'
        });
        this.showConfirmDialog.set(true);
      } finally {
        this.processing = false;
        this.processingMessage = '';
      }
    };

    this.showConfirmDialog.set(true);
  }

  async markReconciled(discrepancy: ReconciliationDiscrepancy) {
    // Check online status first
    if (!this.networkService.isOnline()) {
      this.confirmDialogData.set({
        title: 'Offline Mode',
        message: 'Cannot mark as reconciled while offline. Please connect to the network to continue.',
        confirmText: 'OK',
        type: 'warning'
      });
      this.showConfirmDialog.set(true);
      return;
    }

    // Show confirmation dialog
    this.confirmDialogData.set({
      title: 'Mark as Reconciled',
      message: `Mark invoice ${discrepancy.invoiceNumber} as reconciled?\n\nThis will clear the reconciliation flag and indicate that this discrepancy has been manually resolved.`,
      confirmText: 'Mark Reconciled',
      cancelText: 'Cancel',
      type: 'info'
    });

    // Store the action to execute on confirmation
    this.pendingAction = async () => {
      this.processing = true;
      this.processingMessage = 'Marking as reconciled...';

      try {
        const result = await this.reconciliationService.markAsReconciled(discrepancy.orderId);
        
        if (result.success) {
          await this.searchDiscrepancies(); // Refresh
          this.closeDetailModal();
          // Show success message
          this.confirmDialogData.set({
            title: 'Success',
            message: result.message,
            confirmText: 'OK',
            type: 'info'
          });
          this.showConfirmDialog.set(true);
        } else {
          // Show error message
          this.confirmDialogData.set({
            title: 'Error',
            message: result.message,
            confirmText: 'OK',
            type: 'danger'
          });
          this.showConfirmDialog.set(true);
        }
      } catch (error) {
        console.error('Error marking reconciled:', error);
        this.confirmDialogData.set({
          title: 'Error',
          message: 'Error marking as reconciled. Please try again.',
          confirmText: 'OK',
          type: 'danger'
        });
        this.showConfirmDialog.set(true);
      } finally {
        this.processing = false;
        this.processingMessage = '';
      }
    };

    this.showConfirmDialog.set(true);
  }

  getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return 'text-red-600';
      case 'warning': return 'text-yellow-600';
      default: return 'text-blue-600';
    }
  }

  getSeverityBgColor(severity: string): string {
    switch (severity) {
      case 'critical': return 'bg-red-100';
      case 'warning': return 'bg-yellow-100';
      default: return 'bg-blue-100';
    }
  }

  getRiskColor(risk: string): string {
    switch (risk) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      default: return 'text-green-600';
    }
  }

  // Confirmation dialog callbacks
  async onConfirmed(): Promise<void> {
    this.showConfirmDialog.set(false);
    this.confirmDialogData.set(null);
    
    // Execute the pending action if any
    if (this.pendingAction) {
      await this.pendingAction();
      this.pendingAction = null;
    }
  }

  onCancelled(): void {
    this.showConfirmDialog.set(false);
    this.confirmDialogData.set(null);
    this.pendingAction = null;
  }
}
