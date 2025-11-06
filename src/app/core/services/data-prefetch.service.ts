import { Injectable, inject } from '@angular/core';
import { CompanyService } from '../../services/company.service';
import { StoreService } from '../../services/store.service';
import { ProductService } from '../../services/product.service';
import { OrderService } from '../../services/order.service';

@Injectable({ providedIn: 'root' })
export class DataPrefetchService {
  private companyService = inject(CompanyService);
  private storeService = inject(StoreService);
  private productService = inject(ProductService);
  private orderService = inject(OrderService);

  /**
   * Prefetch commonly used collections and let those services persist snapshots to IndexedDB.
   * Run this once after a successful online login. Best-effort only - failures are swallowed.
   */
  async prefetchForUser(userId: string, companyId?: string): Promise<void> {
    try {
      // Load companies (will resolve primary company via auth if companyId not provided)
      await this.companyService.loadCompanies().catch(() => {});

      const primaryCompanyId = companyId || (await this.companyService.getActiveCompany())?.id;
      if (!primaryCompanyId) return;

      // Load stores for company and persist snapshot
      await this.storeService.loadStoresByCompany(primaryCompanyId).catch(() => {});

      // Get the loaded stores and prefetch products/orders per store
      const stores = this.storeService.getStoresByCompany(primaryCompanyId) || [];

      for (const s of stores) {
        try {
          // Prefetch products using Firestore-only path to avoid BigQuery API calls during login
          // (BigQuery calls can trigger Cloud Run 403s if token/iam mismatches exist)
          if (typeof (this.productService as any).loadProductsByCompanyAndStoreFromFirestore === 'function') {
            await (this.productService as any).loadProductsByCompanyAndStoreFromFirestore(primaryCompanyId, s.id).catch(() => {});
          } else {
            // Fallback to original call if the Firestore-only path isn't available
            await this.productService.loadProductsByCompanyAndStore(primaryCompanyId, s.id).catch(() => {});
          }
        } catch (e) {
          // ignore
        }

        try {
          // Prefetch recent orders for store and persist snapshot (OrderService handles persisting)
          await this.orderService.getRecentOrders(primaryCompanyId, s.id, 20).catch(() => {});
        } catch (e) {
          // ignore
        }
      }
    } catch (error) {
      // Best-effort only - do not fail login flow if prefetch fails
      console.warn('DataPrefetchService: Prefetch failed (non-blocking):', error);
    }
  }
}
