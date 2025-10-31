import { Injectable } from '@angular/core';
import { getFunctions, httpsCallable } from 'firebase/functions';

@Injectable({ providedIn: 'root' })
export class ReconciliationService {
  private readonly region = 'asia-east1';

  /**
   * Trigger on-demand reconciliation for a company or store scope.
   * Provide at least companyId or storeId. Optional limit (default 200).
   */
  async reconcileOnDemand(params: { companyId?: string; storeId?: string; limit?: number }): Promise<{ status: string; processed: number } | any> {
    const fn = getFunctions(undefined, this.region);
    const call = httpsCallable(fn, 'reconcileOnDemand');
    const res = await call(params);
    return res.data as any;
  }
}
