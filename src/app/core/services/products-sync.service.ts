import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, collection, query, where, getDocs, onSnapshot, Timestamp } from '@angular/fire/firestore';
import { IndexedDBService, OfflineProduct } from './indexeddb.service';
import { LoggerService } from './logger.service';
// Client-side logging disabled for products sync. Server-side logging should be handled in Cloud Functions.

@Injectable({ providedIn: 'root' })
export class ProductsSyncService {
  private firestore = inject(Firestore);
  private indexedDb = inject(IndexedDBService);
  private injector = inject(Injector);
  // Use centralized LoggerService so logs include authenticated uid/company/store via context provider
  private logger = inject(LoggerService);

  private pollingHandle: any = null;
  private unsubscribeSnapshot: (() => void) | null = null;

  constructor() {}

  private lastSyncKey(storeId?: string, companyId?: string) {
    if (storeId) return `lastSync_products_store_${storeId}`;
    if (companyId) return `lastSync_products_company_${companyId}`;
    return `lastSync_products_global`;
  }

  /**
   * Start realtime snapshot listener for products for a company/store.
   */
  startRealtime(companyId?: string, storeId?: string) {
    try {
      // Detach previous
      if (this.unsubscribeSnapshot) {
        try { this.unsubscribeSnapshot(); } catch (e) {}
        this.unsubscribeSnapshot = null;
      }

      const productsRef = collection(this.firestore as any, 'products');
      // Build basic query
      let q: any;
      if (companyId && storeId) {
        q = query(productsRef, where('companyId', '==', companyId), where('storeId', '==', storeId));
      } else if (companyId) {
        q = query(productsRef, where('companyId', '==', companyId));
      } else {
        q = query(productsRef);
      }

      const unsub = runInInjectionContext(this.injector, () => onSnapshot(q as any, async (snapshot: any) => {
        try {
          const toSave: OfflineProduct[] = [];
          snapshot.docChanges().forEach((change: any) => {
            const doc = change.doc;
            const data = doc.data();
            // Transform to OfflineProduct minimal shape
            const p: OfflineProduct = {
              id: doc.id,
              uid: data.uid || '',
              productName: data.productName || '',
              skuId: data.skuId || '',
              unitType: data.unitType || 'pieces',
              category: data.category || '',
              totalStock: Number(data.totalStock || 0),
              sellingPrice: Number(data.sellingPrice || 0),
              originalPrice: Number(data.originalPrice || data.sellingPrice || 0),
              companyId: data.companyId || '',
              storeId: data.storeId || storeId || '',
              barcodeId: data.barcodeId || undefined,
              imageUrl: data.imageUrl || undefined,
              isFavorite: !!data.isFavorite,
              isVatApplicable: !!data.isVatApplicable,
              vatRate: Number(data.vatRate || 0),
              hasDiscount: !!data.hasDiscount,
              discountType: data.discountType || 'percentage',
              discountValue: Number(data.discountValue || 0),
              status: data.status || 'active',
              createdAt: data.createdAt && typeof data.createdAt.toDate === 'function' ? data.createdAt.toDate() : new Date(),
              updatedAt: data.updatedAt && typeof data.updatedAt.toDate === 'function' ? data.updatedAt.toDate() : new Date(),
              lastUpdated: data.updatedAt && typeof data.updatedAt.toDate === 'function' ? data.updatedAt.toDate() : new Date()
            };
            toSave.push(p);
          });

          if (toSave.length > 0) {
            await this.indexedDb.saveProducts(toSave);
            // update last sync
            const key = this.lastSyncKey(storeId, companyId);
            await this.indexedDb.saveLastSync(key, new Date().toISOString());
            // Optionally trigger a lightweight UI refresh; productService currently uses its own sources.
            // We'll log the event and leave UI update to components reading from IndexedDB.
            this.logger.dbSuccess('ProductsSyncService: saved products snapshot', { storeId, companyId, payload: { saved: toSave.length } });
          }
        } catch (e) {
          this.logger.dbFailure('ProductsSyncService: realtime handling failed', { companyId, storeId }, e);
        }
      }, (err: any) => {
        this.logger.dbFailure('ProductsSyncService: onSnapshot error', { companyId, storeId }, err);
      }));

      this.unsubscribeSnapshot = () => unsub();
    } catch (error) {
      this.logger.dbFailure('ProductsSyncService: startRealtime failed', { companyId, storeId }, error);
    }
  }

  /**
   * Poll for updates comparing updatedAt > lastSync and persist them.
   * Useful as a fallback when onSnapshot or persistence is unreliable.
   */
  startPolling(companyId?: string, storeId?: string, intervalMs: number = 60_000) {
    if (this.pollingHandle) return; // already polling

    const runner = async () => {
      try {
        const key = this.lastSyncKey(storeId, companyId);
        const lastIso = await this.indexedDb.getLastSync(key);
        const lastTs = lastIso ? Timestamp.fromDate(new Date(lastIso)) : Timestamp.fromDate(new Date(0));

        const productsRef = collection(this.firestore as any, 'products');
        let q: any;
        if (companyId && storeId) {
          q = query(productsRef, where('companyId', '==', companyId), where('storeId', '==', storeId), where('updatedAt', '>', lastTs));
        } else if (companyId) {
          q = query(productsRef, where('companyId', '==', companyId), where('updatedAt', '>', lastTs));
        } else {
          q = query(productsRef, where('updatedAt', '>', lastTs));
        }

        const snap = await runInInjectionContext(this.injector, () => getDocs(q as any));
        if (!snap.empty) {
          const toSave: OfflineProduct[] = [];
          snap.docs.forEach((doc: any) => {
            const data = doc.data();
            toSave.push({
              id: doc.id,
              uid: data.uid || '',
              productName: data.productName || '',
              skuId: data.skuId || '',
              unitType: data.unitType || 'pieces',
              category: data.category || '',
              totalStock: Number(data.totalStock || 0),
              sellingPrice: Number(data.sellingPrice || 0),
              originalPrice: Number(data.originalPrice || data.sellingPrice || 0),
              companyId: data.companyId || '',
              storeId: data.storeId || storeId || '',
              barcodeId: data.barcodeId || undefined,
              imageUrl: data.imageUrl || undefined,
              isFavorite: !!data.isFavorite,
              isVatApplicable: !!data.isVatApplicable,
              vatRate: Number(data.vatRate || 0),
              hasDiscount: !!data.hasDiscount,
              discountType: data.discountType || 'percentage',
              discountValue: Number(data.discountValue || 0),
              status: data.status || 'active',
              createdAt: data.createdAt && typeof data.createdAt.toDate === 'function' ? data.createdAt.toDate() : new Date(),
              updatedAt: data.updatedAt && typeof data.updatedAt.toDate === 'function' ? data.updatedAt.toDate() : new Date(),
              lastUpdated: data.updatedAt && typeof data.updatedAt.toDate === 'function' ? data.updatedAt.toDate() : new Date()
            });
          });

          if (toSave.length > 0) {
            await this.indexedDb.saveProducts(toSave);
            const key = this.lastSyncKey(storeId, companyId);
            await this.indexedDb.saveLastSync(key, new Date().toISOString());
            this.logger.dbSuccess('ProductsSyncService: polled and saved products', { companyId, storeId, payload: { saved: toSave.length } });
            // Create a technical notification for background sync (persisted locally)
            try {
              await this.indexedDb.saveNotification({
                id: `tech-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
                type: 'technical',
                title: 'Products updated',
                message: `Synchronized ${toSave.length} product(s)` ,
                storeId: storeId || '',
                createdAt: new Date().toISOString(),
                read: true,
                metadata: { count: toSave.length }
              });
            } catch (notifErr) {
              // swallow
            }
          }
        }
      } catch (err) {
        this.logger.dbFailure('ProductsSyncService: polling tick failed', { companyId, storeId }, err);
      }
    };

    // Run immediately then schedule
    runner();
    this.pollingHandle = setInterval(runner, intervalMs);
  }

  stopAll() {
    if (this.pollingHandle) {
      clearInterval(this.pollingHandle);
      this.pollingHandle = null;
    }
    if (this.unsubscribeSnapshot) {
      try { this.unsubscribeSnapshot(); } catch (e) {}
      this.unsubscribeSnapshot = null;
    }
  }
}
