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
  <div class="p-4 max-w-4xl mx-auto">
    <h2 class="text-xl font-semibold mb-2">Reconciliation</h2>
    <p class="text-sm text-gray-600 mb-4">Trigger on-demand FIFO reconciliation for your company or a specific store.</p>

    <div class="border rounded p-3 mb-4 bg-white shadow-sm">
      <div class="flex items-center gap-2 text-sm mb-2">
        <div><strong>Company:</strong> {{ companyId() || 'unknown' }}</div>
        <div><strong>Store:</strong> {{ selectedStoreId() || 'all (company scope)' }}</div>
      </div>
      <div class="flex items-center gap-2 mb-2">
        <label class="text-sm">Limit:</label>
        <input type="number" class="border rounded px-2 py-1 w-24" [value]="limit()" (input)="onLimit($any($event.target).value)" />
      </div>
      <div class="flex items-center gap-3">
        <button class="px-3 py-2 bg-blue-600 text-white rounded disabled:opacity-50" [disabled]="isLoading()" (click)="reconcile(true)">
          Reconcile (Store scope)
        </button>
        <button class="px-3 py-2 bg-indigo-600 text-white rounded disabled:opacity-50" [disabled]="isLoading()" (click)="reconcile(false)">
          Reconcile (Company scope)
        </button>
        <div *ngIf="isLoading()" class="text-sm text-gray-500">Working…</div>
      </div>
      <div *ngIf="lastResult() as r" class="mt-3 text-sm">
        <div class="text-green-700">Status: {{ r.status }}</div>
        <div>Processed: {{ r.processed }}</div>
      </div>
      <div *ngIf="errorMsg()" class="mt-3 text-sm text-red-700">{{ errorMsg() }}</div>
    </div>

    <div class="text-xs text-gray-500">
      Note: Nightly job also runs automatically at 02:00 Asia/Manila.
    </div>
  </div>
  `
})
export class ReconciliationComponent {
  private readonly recon = inject(ReconciliationService);
  private readonly auth = inject(AuthService);
  private readonly pos = inject(PosService);

  readonly isLoading = signal(false);
  readonly lastResult = signal<{ status: string; processed: number } | null>(null);
  readonly errorMsg = signal<string | null>(null);
  readonly limit = signal<number>(200);

  readonly selectedStoreId = computed(() => this.pos.selectedStoreId());
  readonly companyId = computed(() => this.auth.getCurrentPermission()?.companyId || '');

  onLimit(v: any) {
    const n = Number(v);
    this.limit.set(Number.isFinite(n) && n > 0 ? n : 200);
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
}
