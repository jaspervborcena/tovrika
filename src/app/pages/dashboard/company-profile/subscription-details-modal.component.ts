import { Component, input, output, computed, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '../../../interfaces/store.interface';
import { SubscriptionService } from '../../../services/subscription.service';
import { Subscription as SubscriptionDoc } from '../../../interfaces/subscription.interface';

@Component({
  selector: 'app-subscription-details-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-overlay" *ngIf="isOpen()" (click)="close()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>� Subscription Details (View Only)</h3>
          <button class="close-btn" (click)="close()">×</button>
        </div>
        
        <div class="modal-body">
          <!-- Store Information Section -->
          <div class="form-section">
            <h4 class="section-title">
              <span>🏪</span>
              <span>Store Information</span>
            </h4>
            
            <div class="form-group">
              <label>Store Name</label>
              <input type="text" class="form-input readonly" [value]="store()?.storeName" readonly />
            </div>
            
            <div class="form-group">
              <label>Store ID</label>
              <input type="text" class="form-input readonly" [value]="store()?.id" readonly />
            </div>
          </div>

          <!-- Subscription Details Section -->
          <div class="form-section" *ngIf="latestSub() as sub">
            <h4 class="section-title">
              <span>🎯</span>
              <span>Subscription Details</span>
            </h4>
            <div class="form-group">
              <label>Subscription Doc ID</label>
              <input type="text" class="form-input readonly" [value]="sub.id || '—'" readonly />
            </div>
            <div class="form-group">
              <label>Subscription UUID</label>
              <input type="text" class="form-input readonly" [value]="sub.subscriptionId || '—'" readonly />
            </div>
            
            <div class="form-group">
              <label>Tier</label>
              <input type="text" class="form-input" [value]="(sub.planType || 'freemium')!.toUpperCase()" readonly />
            </div>
            
            <div class="form-group">
              <label>Status</label>
              <input 
                type="text" 
                class="form-input" 
                [class.status-active]="sub.status === 'active'"
                [class.status-expired]="sub.status === 'expired'"
                [class.status-inactive]="sub.status === 'inactive'"
                [value]="(sub.status || 'inactive').toUpperCase()" 
                readonly />
            </div>
            
            <div class="form-group">
              <label>Subscribed Date</label>
              <input type="text" class="form-input" [value]="formatDate(sub.startDate)" readonly />
            </div>
            
            <div class="form-group">
              <label>Expiry Date</label>
              <input type="text" class="form-input" [value]="formatDate(sub.endDate || store()?.subscriptionEndDate || null)" readonly />
            </div>
          </div>

          <!-- Pricing Information Section -->
          <div class="form-section" *ngIf="latestSub() as sub">
            <h4 class="section-title">
              <span>💰</span>
              <span>Pricing Information</span>
            </h4>
            
            <div class="form-group">
              <label>Original Amount</label>
              <input type="text" class="form-input" [value]="'₱' + (sub.amountPaid || 0)" readonly />
            </div>
            
            <div class="form-group" *ngIf="sub.promoCode">
              <label>Promo Code Used</label>
              <input type="text" class="form-input" [value]="sub.promoCode" readonly />
            </div>
            
            <div class="form-group" *ngIf="sub.referralCode">
              <label>Referral Code Used</label>
              <input type="text" class="form-input" [value]="sub.referralCode" readonly />
            </div>
          </div>

          <!-- Payment Information Section -->
          <div class="form-section" *ngIf="latestSub() as sub">
            <h4 class="section-title">
              <span>💳</span>
              <span>Payment Information</span>
            </h4>
            
            <div class="form-group">
              <label>Payment Method</label>
              <input type="text" class="form-input" [value]="(sub.paymentMethod || '').replace('_', ' ').toUpperCase()" readonly />
            </div>
            <div class="form-group" *ngIf="sub.paymentReference">
              <label>Payment Reference</label>
              <input type="text" class="form-input" [value]="sub.paymentReference" readonly />
            </div>
          </div>

          <!-- Features Section -->
          <div class="form-section" *ngIf="latestSub()?.features as f">
            <h4 class="section-title">
              <span>🧰</span>
              <span>Plan Features</span>
            </h4>
            <div class="form-group">
              <label>Limits</label>
              <input type="text" class="form-input readonly" [value]="featureLimits(f)" readonly />
            </div>
            <div class="form-group">
              <label>Included</label>
              <input type="text" class="form-input readonly" [value]="featureFlags(f)" readonly />
            </div>
          </div>
        </div>
        
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" (click)="close()">Close</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed !important;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999 !important;
      backdrop-filter: blur(2px);
    }

    .modal {
      background: white;
      border-radius: 12px;
      width: 90%;
      max-width: 600px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    }

    .modal-header {
      padding: 1.5rem 2rem;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
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

    .form-group {
      margin-bottom: 1rem;
    }

    .form-group:last-child {
      margin-bottom: 0;
    }

    .form-group label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
      color: #6b7280;
      font-size: 0.875rem;
    }

    .form-input {
      width: 100%;
      padding: 0.75rem 1rem;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 500;
      color: #1f2937;
      background: white;
      transition: all 0.2s ease;
    }

    .form-input:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .form-input.readonly {
      background: #f3f4f6;
      color: #6b7280;
      cursor: not-allowed;
    }

    .form-input.status-active {
      background: #d1fae5;
      color: #065f46;
      border-color: #10b981;
      font-weight: 600;
    }

    .form-input.status-inactive {
      background: #f3f4f6;
      color: #6b7280;
      border-color: #9ca3af;
    }

    .form-input.status-expired {
      background: #fee2e2;
      color: #991b1b;
      border-color: #ef4444;
      font-weight: 600;
    }

    .form-input.amount-highlight {
      background: #eef2ff;
      color: #667eea;
      border-color: #667eea;
      font-weight: 600;
      font-size: 1rem;
    }

    .modal-footer {
      padding: 1.5rem 2rem;
      border-top: 1px solid #e5e7eb;
      display: flex;
      justify-content: flex-end;
      gap: 1rem;
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
  `]
})
export class SubscriptionDetailsModalComponent {
  isOpen = input.required<boolean>();
  store = input.required<Store | undefined>();
  // Optional: directly view a specific subscription document by ID
  subscriptionDocId = input<string | undefined>();
  closed = output<void>();

  private readonly subs = inject(SubscriptionService);
  latestSub = signal<SubscriptionDoc | null>(null);

  // Reactively load latest subscription when store changes
  private _eff = effect(() => {
    const s = this.store();
    const docId = this.subscriptionDocId();
    if (docId) {
      this.subs.getSubscriptionById(docId)
        .then(res => this.latestSub.set(res?.data || null))
        .catch(() => this.latestSub.set(null));
      return;
    }
    if (s?.id && s.companyId) {
      this.subs.getSubscriptionForStore(s.companyId, s.id)
        .then(res => this.latestSub.set(res?.data || null))
        .catch(() => this.latestSub.set(null));
    } else {
      this.latestSub.set(null);
    }
  });

  close() {
    this.closed.emit();
  }

  formatDate(date: Date | undefined | null): string {
    if (!date) return 'N/A';
    
    // Handle Firestore Timestamp
    let dateObj: Date;
    if (date && typeof date === 'object' && 'toDate' in date) {
      dateObj = (date as any).toDate();
    } else {
      dateObj = new Date(date);
    }
    
    // Check if date is valid
    if (isNaN(dateObj.getTime())) return 'N/A';
    
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  featureLimits(f: any): string {
    if (!f) return '—';
    const parts = [] as string[];
    if (typeof f.maxStores === 'number') parts.push(`Stores: ${f.maxStores}`);
    if (typeof f.maxDevicesPerStore === 'number') parts.push(`Devices/Store: ${f.maxDevicesPerStore}`);
    if (typeof f.maxProducts === 'number') parts.push(`Products: ${f.maxProducts}`);
    if (typeof f.maxUsers === 'number') parts.push(`Users: ${f.maxUsers}`);
    if (typeof f.transactionLimit === 'number') parts.push(`Txn limit: ${f.transactionLimit}`);
    return parts.join(' • ');
  }

  featureFlags(f: any): string {
    const flags: string[] = [];
    if (f?.cloudSync) flags.push('Cloud Sync');
    if (f?.birCompliance) flags.push('BIR Compliance');
    if (f?.crmEnabled) flags.push('CRM');
    if (f?.loyaltyEnabled) flags.push('Loyalty');
    if (f?.apiAccess) flags.push('API Access');
    if (f?.whiteLabel) flags.push('White Label');
    return flags.length ? flags.join(', ') : '—';
  }
}
