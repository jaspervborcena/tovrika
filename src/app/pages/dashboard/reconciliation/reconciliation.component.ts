import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReconciliationService } from '../../../services/reconciliation.service';
import { AuthService } from '../../../services/auth.service';
import { PosService } from '../../../services/pos.service';

@Component({
  selector: 'app-reconciliation',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="reconciliation-container">
      <!-- Header -->
      <div class="header">
        <div class="header-content">
          <h1 class="page-title">Inventory Reconciliation</h1>
          <p class="page-subtitle">Trigger FIFO reconciliation to maintain accurate inventory tracking</p>
        </div>
      </div>

      <!-- Controls Section -->
      <div class="reconciliation-controls">
        
        <!-- Current Settings Card -->
        <div class="settings-card">
          <div class="card-header">
            <h3>Current Settings</h3>
          </div>
          <div class="settings-content">
            <div class="setting-item">
              <label>Company:</label>
              <span class="setting-value">{{ companyId() || 'Not Available' }}</span>
            </div>
            <div class="setting-item">
              <label>Store:</label>
              <span class="setting-value">{{ selectedStoreId() || 'All Stores (Company Scope)' }}</span>
            </div>
            <div class="setting-item">
              <label>Processing Limit:</label>
              <input 
                type="number" 
                class="setting-input" 
                [value]="limit()" 
                (input)="onLimit($any($event.target).value)"
                min="1"
                max="1000" />
              <span class="setting-hint">orders per run</span>
            </div>
            <div class="setting-item">
              <label>Auto-trigger Threshold:</label>
              <input 
                type="number" 
                class="setting-input" 
                [value]="autoTriggerThreshold()" 
                (input)="onThreshold($any($event.target).value)"
                min="1"
                max="500" />
              <span class="setting-hint">pending orders</span>
            </div>
          </div>
        </div>

        <!-- Action Buttons Section -->
        <div class="actions-section">
          <div class="action-group">
            <h4>Manual Reconciliation</h4>
            <div class="action-buttons">
              <button 
                class="action-btn primary" 
                [disabled]="isLoading()" 
                (click)="reconcile(true)">
                <svg class="btn-icon" width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
                </svg>
                <span *ngIf="!isLoading()">Store Reconciliation</span>
                <span *ngIf="isLoading()" class="loading-text">Processing...</span>
              </button>
              
              <button 
                class="action-btn secondary" 
                [disabled]="isLoading()" 
                (click)="reconcile(false)">
                <svg class="btn-icon" width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                <span *ngIf="!isLoading()">Company Reconciliation</span>
                <span *ngIf="isLoading()" class="loading-text">Processing...</span>
              </button>
            </div>
          </div>

          <div class="action-group">
            <h4>Quick Actions</h4>
            <div class="action-buttons">
              <button 
                class="action-btn success" 
                [disabled]="isLoading()" 
                (click)="quickReconcile()">
                <svg class="btn-icon" width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
                <span *ngIf="!isLoading()">Quick Reconcile (10 orders)</span>
                <span *ngIf="isLoading()" class="loading-text">Processing...</span>
              </button>
            </div>
            <p class="action-hint">For immediate post-order reconciliation</p>
          </div>
        </div>

        <!-- Results Section -->
        <div *ngIf="lastResult() || errorMsg()" class="results-section">
          <div *ngIf="lastResult() as r" class="result-card success">
            <div class="result-header">
              <svg class="result-icon" width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
              <h4>Reconciliation Complete</h4>
            </div>
            <div class="result-content">
              <div class="result-item">
                <label>Status:</label>
                <span class="status-badge success">{{ r.status }}</span>
              </div>
              <div class="result-item">
                <label>Orders Processed:</label>
                <span class="processed-count">{{ r.processed }}</span>
              </div>
            </div>
          </div>

          <div *ngIf="errorMsg()" class="result-card error">
            <div class="result-header">
              <svg class="result-icon" width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              <h4>Reconciliation Error</h4>
            </div>
            <div class="result-content">
              <p class="error-message">{{ errorMsg() }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Information Section -->
      <div class="info-section">
        <div class="info-card">
          <div class="info-header">
            <svg class="info-icon" width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            <h4>Scheduling Options</h4>
          </div>
          <div class="info-content">
            <div class="schedule-option">
              <div class="option-label">Automatic</div>
              <div class="option-description">Nightly job runs at 02:00 Asia/Manila timezone</div>
            </div>
            <div class="schedule-option">
              <div class="option-label">Frequent</div>
              <div class="option-description">Run manually every 2-4 hours during business hours</div>
            </div>
            <div class="schedule-option">
              <div class="option-label">End-of-shift</div>
              <div class="option-description">Execute when closing each shift for accurate reporting</div>
            </div>
            <div class="schedule-option">
              <div class="option-label">Real-time</div>
              <div class="option-description">Available but not recommended for each individual order</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .reconciliation-container {
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

    .reconciliation-controls {
      max-width: 1400px;
      margin: 0 auto;
      padding: 0 2rem 2rem 2rem;
      display: grid;
      gap: 2rem;
      grid-template-columns: 1fr 1fr;
    }

    /* Settings Card */
    .settings-card {
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
      overflow: hidden;
    }

    .card-header {
      background: #f7fafc;
      padding: 1.5rem;
      border-bottom: 1px solid #e2e8f0;
    }

    .card-header h3 {
      margin: 0;
      color: #2d3748;
      font-size: 1.125rem;
      font-weight: 600;
    }

    .settings-content {
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .setting-item {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .setting-item label {
      font-weight: 500;
      color: #4a5568;
      min-width: 120px;
      font-size: 0.875rem;
    }

    .setting-value {
      color: #2d3748;
      font-weight: 600;
      flex: 1;
    }

    .setting-input {
      padding: 0.5rem 0.75rem;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 0.875rem;
      width: 100px;
      transition: border-color 0.2s;
    }

    .setting-input:focus {
      outline: none;
      border-color: #4299e1;
      box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
    }

    .setting-hint {
      font-size: 0.75rem;
      color: #718096;
    }

    /* Actions Section */
    .actions-section {
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }

    .action-group h4 {
      margin: 0 0 1rem 0;
      color: #2d3748;
      font-size: 1.125rem;
      font-weight: 600;
    }

    .action-buttons {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .action-btn {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 1.5rem;
      border: none;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      min-height: 48px;
    }

    .action-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }

    .action-btn.primary {
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      color: white;
      box-shadow: 0 2px 4px rgba(79, 70, 229, 0.2);
    }

    .action-btn.primary:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
    }

    .action-btn.secondary {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: white;
      box-shadow: 0 2px 4px rgba(99, 102, 241, 0.2);
    }

    .action-btn.secondary:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
    }

    .action-btn.success {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
    }

    .action-btn.success:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    }

    .btn-icon {
      flex-shrink: 0;
    }

    .loading-text {
      display: flex;
      align-items: center;
      gap: 0.5rem;
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

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .action-hint {
      margin: 0.5rem 0 0 0;
      font-size: 0.75rem;
      color: #718096;
      font-style: italic;
    }

    /* Results Section */
    .results-section {
      grid-column: 1 / -1;
      margin-top: 1rem;
    }

    .result-card {
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
      overflow: hidden;
      border-left: 4px solid;
    }

    .result-card.success {
      border-left-color: #10b981;
    }

    .result-card.error {
      border-left-color: #ef4444;
    }

    .result-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1.5rem;
      background: #f7fafc;
      border-bottom: 1px solid #e2e8f0;
    }

    .result-header h4 {
      margin: 0;
      color: #2d3748;
      font-size: 1.125rem;
      font-weight: 600;
    }

    .result-icon {
      flex-shrink: 0;
    }

    .result-card.success .result-icon {
      color: #10b981;
    }

    .result-card.error .result-icon {
      color: #ef4444;
    }

    .result-content {
      padding: 1.5rem;
    }

    .result-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.75rem;
    }

    .result-item:last-child {
      margin-bottom: 0;
    }

    .result-item label {
      font-weight: 500;
      color: #4a5568;
    }

    .status-badge {
      padding: 0.25rem 0.75rem;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.025em;
    }

    .status-badge.success {
      background: #c6f6d5;
      color: #2f855a;
    }

    .processed-count {
      font-weight: 700;
      color: #2d3748;
      font-size: 1.125rem;
    }

    .error-message {
      margin: 0;
      color: #ef4444;
      font-weight: 500;
    }

    /* Information Section */
    .info-section {
      max-width: 1400px;
      margin: 0 auto;
      padding: 0 2rem 2rem 2rem;
    }

    .info-card {
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
      overflow: hidden;
    }

    .info-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1.5rem;
      background: #f7fafc;
      border-bottom: 1px solid #e2e8f0;
    }

    .info-header h4 {
      margin: 0;
      color: #2d3748;
      font-size: 1.125rem;
      font-weight: 600;
    }

    .info-icon {
      color: #4299e1;
      flex-shrink: 0;
    }

    .info-content {
      padding: 1.5rem;
    }

    .schedule-option {
      display: flex;
      gap: 1rem;
      margin-bottom: 1rem;
      align-items: flex-start;
    }

    .schedule-option:last-child {
      margin-bottom: 0;
    }

    .option-label {
      font-weight: 600;
      color: #4299e1;
      min-width: 120px;
      font-size: 0.875rem;
    }

    .option-description {
      color: #4a5568;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    /* Mobile Responsive */
    @media (max-width: 768px) {
      .header-content {
        padding: 0 1rem;
      }

      .page-title {
        font-size: 2rem;
      }

      .reconciliation-controls {
        grid-template-columns: 1fr;
        padding: 0 1rem 2rem 1rem;
        gap: 1.5rem;
      }

      .info-section {
        padding: 0 1rem 2rem 1rem;
      }

      .setting-item {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
      }

      .setting-item label {
        min-width: auto;
      }

      .schedule-option {
        flex-direction: column;
        gap: 0.5rem;
      }

      .option-label {
        min-width: auto;
      }
    }
  `]
})
export class ReconciliationComponent {
  private readonly recon = inject(ReconciliationService);
  private readonly auth = inject(AuthService);
  private readonly pos = inject(PosService);

  readonly isLoading = signal(false);
  readonly lastResult = signal<{ status: string; processed: number } | null>(null);
  readonly errorMsg = signal<string | null>(null);
  readonly limit = signal<number>(200);
  readonly autoTriggerThreshold = signal<number>(50); // Auto-trigger when 50+ pending orders

  readonly selectedStoreId = computed(() => this.pos.selectedStoreId());
  readonly companyId = computed(() => this.auth.getCurrentPermission()?.companyId || '');

  onLimit(v: any) {
    const n = Number(v);
    this.limit.set(Number.isFinite(n) && n > 0 ? n : 200);
  }

  onThreshold(v: any) {
    const n = Number(v);
    this.autoTriggerThreshold.set(Number.isFinite(n) && n > 0 ? n : 50);
  }

  async reconcile(useStoreScope: boolean) {
    this.isLoading.set(true);
    this.errorMsg.set(null);
    this.lastResult.set(null);
    try {
      const params: any = { limit: this.limit() };
      if (useStoreScope && this.selectedStoreId()) {
        params.storeId = this.selectedStoreId();
      } else {
        params.companyId = this.companyId();
      }
      const res = await this.recon.reconcileOnDemand(params);
      this.lastResult.set({ status: res?.status || 'ok', processed: res?.processed || 0 });
    } catch (e: any) {
      this.errorMsg.set(e?.message || 'Failed to trigger reconciliation');
    } finally {
      this.isLoading.set(false);
    }
  }

  async quickReconcile() {
    this.isLoading.set(true);
    this.errorMsg.set(null);
    this.lastResult.set(null);
    try {
      const params: any = { 
        limit: 10, // Small limit for quick processing
        storeId: this.selectedStoreId()
      };
      const res = await this.recon.reconcileOnDemand(params);
      this.lastResult.set({ status: res?.status || 'ok', processed: res?.processed || 0 });
    } catch (e: any) {
      this.errorMsg.set(e?.message || 'Quick reconciliation failed');
    } finally {
      this.isLoading.set(false);
    }
  }
}
