import { Component, input, output, computed, OnInit, signal, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BillingService } from '../../../services/billing.service';
import { CompanyBillingHistory } from '../../../interfaces/billing.interface';

@Component({
  selector: 'app-billing-history-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-overlay" *ngIf="isOpen()" (click)="close()">
      <div class="modal billing-modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>📜 Billing History</h3>
          <button class="close-btn" (click)="close()">×</button>
        </div>
        
        <div class="modal-body">
          <!-- Store Information -->
          <div class="store-info-section">
            <h4 class="store-name">{{ storeName() }}</h4>
          </div>

          <!-- Loading State -->
          @if (loading()) {
            <div class="loading-state">
              <div class="spinner"></div>
              <p>Loading billing history...</p>
            </div>
          }

          <!-- Empty State -->
          @else if (billingHistory().length === 0) {
            <div class="empty-state">
              <svg class="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>No billing history found for this store.</p>
            </div>
          }

          <!-- Billing History Table -->
          @else {
            <div class="billing-table-container">
              <table class="billing-table">
                <thead>
                  <tr>
                    <th>Date Paid</th>
                    <th>Tier</th>
                    <th>Cycle</th>
                    <th>Duration</th>
                    <th>Amount</th>
                    <th>Discount</th>
                    <th>Final Amount</th>
                    <th>Payment Method</th>
                  </tr>
                </thead>
                <tbody>
                  @for (record of billingHistory(); track record.id) {
                    <tr>
                      <td>{{ formatDate(record.paidAt) }}</td>
                      <td>
                        <span [class]="getTierBadgeClass(record.tier)">
                          {{ record.tier | titlecase }}
                        </span>
                      </td>
                      <td>{{ record.cycle | titlecase }}</td>
                      <td>{{ record.durationMonths }} {{ record.durationMonths === 1 ? 'month' : 'months' }}</td>
                      <td>₱{{ record.amount.toFixed(2) }}</td>
                      <td class="discount-cell">{{ record.discountPercent }}%</td>
                      <td class="final-amount-cell">₱{{ record.finalAmount.toFixed(2) }}</td>
                      <td>
                        <span class="payment-badge">
                          {{ formatPaymentMethod(record.paymentMethod) }}
                        </span>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <!-- Summary Section -->
            <div class="summary-section">
              <div class="summary-grid">
                <div class="summary-item">
                  <span class="summary-label">Total Transactions:</span>
                  <span class="summary-value">{{ billingHistory().length }}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">Total Paid:</span>
                  <span class="summary-value total-paid">₱{{ calculateTotalPaid().toFixed(2) }}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">Total Savings:</span>
                  <span class="summary-value total-savings">₱{{ calculateTotalSavings().toFixed(2) }}</span>
                </div>
              </div>
            </div>
          }
        </div>

        <div class="modal-footer">
          <button class="btn-secondary" (click)="close()">Close</button>
          @if (billingHistory().length > 0) {
            <button class="btn-primary" (click)="exportToCSV()">
              Export CSV
            </button>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      inset: 0;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 1rem;
    }

    .modal {
      background: white;
      border-radius: 12px;
      width: 100%;
      max-width: 1200px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    }

    .billing-modal {
      max-width: 1400px;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.5rem;
      border-bottom: 1px solid #e5e7eb;
    }

    .modal-header h3 {
      font-size: 1.5rem;
      font-weight: 600;
      color: #111827;
      margin: 0;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 2rem;
      color: #6b7280;
      cursor: pointer;
      padding: 0;
      width: 2rem;
      height: 2rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 0.375rem;
      transition: all 0.2s;
    }

    .close-btn:hover {
      background-color: #f3f4f6;
      color: #111827;
    }

    .modal-body {
      overflow-y: auto;
      padding: 1.5rem;
      flex: 1;
    }

    .store-info-section {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 1.5rem;
      border-radius: 8px;
      margin-bottom: 1.5rem;
      color: white;
    }

    .store-name {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0 0 0.5rem 0;
    }

    .store-code {
      font-size: 0.875rem;
      opacity: 0.9;
      margin: 0;
    }

    .loading-state {
      text-align: center;
      padding: 3rem;
    }

    .spinner {
      border: 4px solid #f3f4f6;
      border-top: 4px solid #667eea;
      border-radius: 50%;
      width: 3rem;
      height: 3rem;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .empty-state {
      text-align: center;
      padding: 3rem;
      color: #6b7280;
    }

    .empty-icon {
      width: 4rem;
      height: 4rem;
      margin: 0 auto 1rem;
      stroke: #9ca3af;
    }

    .billing-table-container {
      overflow-x: auto;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      margin-bottom: 1.5rem;
    }

    .billing-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }

    .billing-table thead {
      background-color: #f9fafb;
      border-bottom: 2px solid #e5e7eb;
    }

    .billing-table th {
      padding: 0.75rem 1rem;
      text-align: left;
      font-weight: 600;
      color: #374151;
      white-space: nowrap;
    }

    .billing-table td {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid #e5e7eb;
      color: #1f2937;
    }

    .billing-table tbody tr:hover {
      background-color: #f9fafb;
    }

    .billing-table tbody tr:last-child td {
      border-bottom: none;
    }

    .discount-cell {
      color: #10b981;
      font-weight: 600;
    }

    .final-amount-cell {
      font-weight: 700;
      color: #111827;
    }

    .payment-badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      background-color: #dbeafe;
      color: #1e40af;
      font-size: 0.75rem;
      font-weight: 500;
      text-transform: uppercase;
    }

    .summary-section {
      background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
      padding: 1.5rem;
      border-radius: 8px;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }

    .summary-item {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .summary-label {
      font-size: 0.875rem;
      color: #6b7280;
      font-weight: 500;
    }

    .summary-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: #111827;
    }

    .total-paid {
      color: #667eea;
    }

    .total-savings {
      color: #10b981;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      padding: 1.5rem;
      border-top: 1px solid #e5e7eb;
    }

    .btn-secondary,
    .btn-primary {
      padding: 0.625rem 1.5rem;
      border-radius: 0.5rem;
      font-weight: 500;
      font-size: 0.875rem;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
    }

    .btn-secondary {
      background-color: #f3f4f6;
      color: #374151;
    }

    .btn-secondary:hover {
      background-color: #e5e7eb;
    }

    .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .btn-primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    /* Tier Badges */
    .px-3 {
      padding-left: 0.75rem;
      padding-right: 0.75rem;
    }

    .py-1 {
      padding-top: 0.25rem;
      padding-bottom: 0.25rem;
    }

    .rounded-full {
      border-radius: 9999px;
    }

    .text-xs {
      font-size: 0.75rem;
    }

    .font-semibold {
      font-weight: 600;
    }

    .bg-blue-100 { background-color: #dbeafe; }
    .text-blue-800 { color: #1e40af; }
    .bg-purple-100 { background-color: #e9d5ff; }
    .text-purple-800 { color: #6b21a8; }
    .bg-yellow-100 { background-color: #fef3c7; }
    .text-yellow-800 { color: #92400e; }
    .bg-indigo-100 { background-color: #e0e7ff; }
    .text-indigo-800 { color: #3730a3; }
  `]
})
export class BillingHistoryModalComponent implements OnInit {
  private billingService = inject(BillingService);

  // Inputs
  isOpen = input.required<boolean>();
  storeId = input.required<string>();
  storeName = input.required<string>();

  // Outputs
  closeModal = output<void>();

  // State
  billingHistory = signal<CompanyBillingHistory[]>([]);
  loading = signal(false);

  constructor() {
    // Watch for modal open and reload data
    effect(() => {
      if (this.isOpen() && this.storeId()) {
        this.loadBillingHistory();
      }
    });
  }

  ngOnInit() {
    // Initial load if modal is already open
    if (this.isOpen()) {
      this.loadBillingHistory();
    }
  }

  async loadBillingHistory() {
    this.loading.set(true);
    try {
      const history = await this.billingService.getBillingHistoryByStore(this.storeId());
      // Sort by paidAt descending (newest first)
      history.sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
      this.billingHistory.set(history);
    } catch (error) {
      console.error('Error loading billing history:', error);
      this.billingHistory.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  close() {
    this.closeModal.emit();
  }

  formatDate(date: Date): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getTierBadgeClass(tier: string): string {
    const baseClasses = 'px-3 py-1 rounded-full text-xs font-semibold';
    switch (tier) {
      case 'freemium':
        return `${baseClasses} bg-blue-100 text-blue-800`;
      case 'standard':
        return `${baseClasses} bg-purple-100 text-purple-800`;
      case 'premium':
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case 'enterprise':
        return `${baseClasses} bg-indigo-100 text-indigo-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  }

  formatPaymentMethod(method: string): string {
    const methodMap: Record<string, string> = {
      'credit_card': 'Credit Card',
      'paypal': 'PayPal',
      'bank_transfer': 'Bank Transfer',
      'gcash': 'GCash',
      'paymaya': 'PayMaya'
    };
    return methodMap[method] || method;
  }

  calculateTotalPaid(): number {
    return this.billingHistory().reduce((sum, record) => sum + record.finalAmount, 0);
  }

  calculateTotalSavings(): number {
    return this.billingHistory().reduce((sum, record) => {
      const discount = record.amount * (record.discountPercent / 100);
      return sum + discount;
    }, 0);
  }

  exportToCSV() {
    const csvData = this.billingHistory().map(record => ({
      'Date Paid': this.formatDate(record.paidAt),
      'Tier': record.tier,
      'Cycle': record.cycle,
      'Duration': `${record.durationMonths} month${record.durationMonths === 1 ? '' : 's'}`,
      'Amount': record.amount.toFixed(2),
      'Discount': `${record.discountPercent}%`,
      'Final Amount': record.finalAmount.toFixed(2),
      'Payment Method': this.formatPaymentMethod(record.paymentMethod)
    }));

    // Convert to CSV string
    const headers = Object.keys(csvData[0] || {});
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => headers.map(h => `"${row[h as keyof typeof row]}"`).join(','))
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `billing_history_${this.storeName()}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }
}
