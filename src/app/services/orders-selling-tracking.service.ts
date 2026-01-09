import { Injectable, inject } from '@angular/core';
import { Firestore, collection, query, where } from '@angular/fire/firestore';
import { getDocs, getDoc, doc, setDoc, updateDoc, runTransaction, orderBy, limit, getAggregateFromServer, count, addDoc } from 'firebase/firestore';
import { toDateValue } from '../core/utils/date-utils';
import { OfflineDocumentService } from '../core/services/offline-document.service';
import { NetworkService } from '../core/services/network.service';
import { IndexedDBService } from '../core/services/indexeddb.service';
import { OrdersSellingTrackingDoc } from '../interfaces/orders-selling-tracking.interface';
import { ProductService } from './product.service';
import { LedgerService } from './ledger.service';

@Injectable({ providedIn: 'root' })
export class OrdersSellingTrackingService {
  private readonly offlineDocService = inject(OfflineDocumentService);
  // Helper to remove undefined fields because Firestore rejects undefined values
  private sanitizeForFirestore(obj: any): any {
    const out: any = {};
    for (const k of Object.keys(obj || {})) {
      const v = obj[k];
      if (v !== undefined) {
        // For *At fields (createdAt/updatedAt) store a human-readable string
        // with epoch in parentheses: "December 9, 2025 at 1:52:05 PM UTC+8 (170...)"
        if (k && typeof k === 'string' && /At$/.test(k)) {
          let d: Date | null = null;
          if (v instanceof Date) d = v;
          else if (v && typeof v.toDate === 'function') {
            try { d = v.toDate(); } catch (e) { d = null; }
          } else if (typeof v === 'number' || typeof v === 'string') {
            const parsed = new Date(v as any);
            d = isNaN(parsed.getTime()) ? null : parsed;
          }
          if (d) out[k] = this.formatDateForFirestore(d);
          else out[k] = v;
        } else {
          // Keep other values unchanged
          if (v instanceof Date) out[k] = v.getTime();
          else out[k] = v;
        }
      }
    }
    return out;
  }

  // Format a Date as: "Month D, YYYY at h:mm:ss AM/PM UTC±H (epoch)"
  private formatDateForFirestore(d: Date): string {
    const months = [
      'January','February','March','April','May','June','July','August','September','October','November','December'
    ];
    const month = months[d.getUTCMonth()];
    const day = d.getUTCDate();
    const year = d.getUTCFullYear();

    // compute time in local offset (so it matches user's zone display like UTC+8)
    const tzOffsetMin = -d.getTimezoneOffset(); // minutes east of UTC
    const tzSign = tzOffsetMin >= 0 ? '+' : '-';
    const tzHours = Math.floor(Math.abs(tzOffsetMin) / 60);

    // time components in local time
    const hours = d.getHours();
    const minutes = d.getMinutes();
    const seconds = d.getSeconds();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = ((hours + 11) % 12) + 1;

    const two = (n: number) => (n < 10 ? '0' + n : String(n));
    const timePart = `${hour12}:${two(minutes)}:${two(seconds)} ${ampm}`;
    const tzPart = `UTC${tzSign}${tzHours}`;
    const epoch = String(d.getTime());
    return `${month} ${day}, ${year} at ${timePart} ${tzPart} (${epoch})`;
  }
  constructor(
    private firestore: Firestore,
    private productService: ProductService,
    private ledgerService: LedgerService,
    private networkService: NetworkService,
    private indexedDBService: IndexedDBService
  ) {}

  /**
  * Mark all ordersSellingTracking docs for a given orderId from 'processing' to 'completed'.
   * Will attempt an online write that preserves the original createdAt as updatedAt when possible
   * so that updatedAt matches createdAt instead of being a serverTimestamp sentinel map.
   */
  async markOrderTrackingCompleted(orderId: string, completedBy?: string): Promise<{ updated: number; errors: any[] }> {
    const errors: any[] = [];
    let updated = 0;
    try {
      const q = query(collection(this.firestore, 'ordersSellingTracking'), where('orderId', '==', orderId), where('status', '==', 'processing'));
      const snaps = await getDocs(q as any);
      for (const s of snaps.docs) {
        const id = s.id;
        const data: any = s.data() || {};
        const createdAt = data.createdAt;
        const updates: any = {
          status: 'completed',
          updatedBy: completedBy || data.createdBy || 'system'
        };

        try {
          // Always use Firestore directly for automatic offline sync
          if (createdAt instanceof Date || typeof createdAt === 'string' || typeof createdAt === 'number') {
            updates.updatedAt = createdAt;
          }
          const ref = doc(this.firestore, 'ordersSellingTracking', id);
          // Use setDoc with merge - Firestore offline persistence will handle sync
          await setDoc(ref as any, updates as any, { merge: true } as any);
          updated++;
        } catch (e) {
          console.warn('⚠️ Update failed, Firestore will retry when online:', e);
          errors.push({ id, error: e });
        }
      }
    } catch (e) {
      errors.push({ id: 'query', error: e });
    }

    // ALSO: update any pending offline queued tracking documents so local UI reflects the completed status immediately.
    try {
      const pending = await this.offlineDocService.getPendingDocuments();
      for (const pd of pending) {
        try {
          if (pd.collectionName === 'ordersSellingTracking' && pd.data && pd.data.orderId === orderId && pd.data.status === 'processing') {
            // Update the pending offline document to completed locally (this uses updateDocument which will update the pending queue)
            await this.offlineDocService.updateDocument('ordersSellingTracking', pd.id, { status: 'completed', updatedBy: completedBy || pd.data.createdBy || 'system' });
            updated++;
          }
        } catch (e) {
          errors.push({ id: pd.id, error: e });
        }
      }
    } catch (e) {
      // Non-fatal: log and continue
      errors.push({ id: 'pending-check', error: e });
    }

    // Ensure updatedAt matches createdAt for any docs that still have serverTimestamp sentinels
    try {
      await this.alignUpdatedAtToCreatedAtForOrder(orderId);
    } catch (e) {
      // non-fatal
      console.warn('markOrderTrackingCompleted: alignUpdatedAtToCreatedAtForOrder failed', e);
    }

    return { updated, errors };
  }

  /**
   * Align updatedAt to createdAt for all tracking docs of an order when updatedAt is a serverTimestamp sentinel
   * or missing. This will perform an online setDoc merge when online, otherwise it will queue an update.
   */
  private async alignUpdatedAtToCreatedAtForOrder(orderId: string): Promise<void> {
    try {
      const q = query(collection(this.firestore, 'ordersSellingTracking'), where('orderId', '==', orderId));
      const snaps = await getDocs(q as any);
      for (const s of snaps.docs) {
        const data: any = s.data() || {};
        const createdAt = data.createdAt;
        const updatedAt = data.updatedAt;

        // Normalize createdAt to Date
        let createdDate: Date | null = null;
        if (!createdAt) continue;
        if (typeof createdAt.toDate === 'function') createdDate = createdAt.toDate();
        else if (createdAt instanceof Date) createdDate = createdAt as Date;
        else createdDate = new Date(createdAt);
        if (!createdDate) continue;

        // Detect serverTimestamp sentinel (Firestore represents it as a map with _methodName)
        const isServerTimestamp = updatedAt && typeof updatedAt === 'object' && (updatedAt._methodName === 'serverTimestamp' || updatedAt._methodName === 'ServerTimestamp');

        if (!updatedAt || isServerTimestamp) {
          try {
            if (this.networkService.isOnline()) {
              const ref = doc(this.firestore, 'ordersSellingTracking', s.id);
              await setDoc(ref as any, { updatedAt: createdDate }, { merge: true } as any);
            } else {
              // Queue update for later sync; offline update will set updatedAt when synced.
              await this.offlineDocService.updateDocument('ordersSellingTracking', s.id, { updatedAt: createdDate as any });
            }
          } catch (e) {
            console.warn('alignUpdatedAtToCreatedAtForOrder: failed to set updatedAt for', s.id, e);
          }
        }
      }
    } catch (e) {
      console.error('alignUpdatedAtToCreatedAtForOrder failed', e);
    }
  }

  /**
   * Mark all ordersSellingTracking docs for a given orderId as 'cancelled'.
   * This updates both online documents and any pending offline queued docs.
   */
  async markOrderTrackingCancelled(orderId: string, cancelledBy?: string, reason?: string): Promise<{ updated: number; errors: any[] }> {
    const errors: any[] = [];
    let updated = 0;
    try {
      const q = query(collection(this.firestore, 'ordersSellingTracking'), where('orderId', '==', orderId));
      const snaps = await getDocs(q as any);
      for (const s of snaps.docs) {
        const id = s.id;
        const data: any = s.data() || {};
        // Skip if already cancelled
        if (data.status === 'cancelled') continue;

        const updates: any = {
          status: 'cancelled',
          updatedBy: cancelledBy || data.updatedBy || cancelledBy || data.createdBy || 'system'
        };
        if (reason) updates.updateReason = reason;

        try {
          // Always use Firestore directly for automatic offline sync
          const ref = doc(this.firestore, 'ordersSellingTracking', id);
          await setDoc(ref as any, updates as any, { merge: true } as any);
          updated++;
        } catch (e) {
          console.warn('⚠️ Update failed, Firestore will retry when online:', e);
          errors.push({ id, error: e });
        }
      }
    } catch (e) {
      errors.push({ id: 'query', error: e });
    }

    // ALSO update any pending offline queued tracking documents so local UI reflects the cancelled status immediately.
    try {
      const pending = await this.offlineDocService.getPendingDocuments();
      for (const pd of pending) {
        try {
          if (pd.collectionName === 'ordersSellingTracking' && pd.data && pd.data.orderId === orderId && pd.data.status !== 'cancelled') {
            // Skip - Firestore offline persistence handles pending updates automatically
            updated++;
          }
        } catch (e) {
          errors.push({ id: pd.id, error: e });
        }
      }
    } catch (e) {
      errors.push({ id: 'pending-check', error: e });
    }

    return { updated, errors };
  }

  async markOrderTrackingReturned(orderId: string, returnedBy?: string, reason?: string): Promise<{ updated: number; errors: any[] }> {
  const errors: any[] = [];
  let updated = 0;
  try {
    const q = query(collection(this.firestore, 'ordersSellingTracking'), where('orderId', '==', orderId));
    const snaps = await getDocs(q as any);
    for (const s of snaps.docs) {
      const id = s.id;
      const data: any = s.data() || {};
      const product = this.productService.getProduct(data.productId);
      // If already returned, skip
      if (data.status === 'returned') continue;

      // Build a copy of the existing record but mark it as 'returned'.
      const onlineCreatedAt = new Date();
      const offlineCreatedAt = new Date();

      const newDoc: any = {
        companyId: data.companyId || undefined,
        storeId: data.storeId || undefined,
        batchNumber: data.batchNumber || 1,
        itemIndex: data.itemIndex ?? 0,
        orderDetailsId: data.orderDetailsId || undefined,
        productId: data.productId,
        productName: data.productName,
        productCode: data.productCode || product?.productCode,
        sku: data.sku || product?.skuId,
        price: data.price,
        quantity: data.quantity,
        total: data.total,
        uid: data.uid || data.createdBy || undefined,
        cashierId: data.cashierId || data.createdBy || undefined,
        status: 'returned',
        createdAt: this.networkService.isOnline() ? onlineCreatedAt : offlineCreatedAt,
        createdBy: returnedBy || data.updatedBy || data.createdBy || 'system',
        updatedAt: this.networkService.isOnline() ? onlineCreatedAt : offlineCreatedAt,
        updatedBy: returnedBy || data.updatedBy || data.createdBy || 'system'
      };
      if (reason) newDoc.updateReason = reason;
      

      try {
        const colRef = collection(this.firestore, 'ordersSellingTracking');
        const ref = doc(colRef as any);
        const payload = this.sanitizeForFirestore(newDoc);
        console.log(`markOrderTrackingReturned: creating returned copy for tracking=${id} -> newId=${ref.id}`);
        // Use Firestore directly for automatic offline sync
        await setDoc(ref as any, payload as any);
        updated++;
      } catch (e) {
        console.error(`markOrderTrackingReturned: failed to create returned copy for ${id}`, e);
        console.warn('⚠️ Firestore will retry automatically when connection is restored');
        const errMsg = (e && (e as any).message) ? (e as any).message : String(e);
        errors.push({ id, error: errMsg });
      }
    }
  } catch (e) {
    errors.push({ id: 'query', error: e });
  }

  // ALSO update any pending offline queued tracking documents so local UI reflects the returned status immediately.
  try {
    const pending = await this.offlineDocService.getPendingDocuments();
    for (const pd of pending) {
      try {
        if (
          pd.collectionName === 'ordersSellingTracking' &&
          pd.data &&
          pd.data.orderId === orderId &&
          pd.data.status !== 'returned'
        ) {
          const upd: any = { status: 'returned', updatedBy: returnedBy || pd.data.createdBy || 'system' };
          if (reason) upd.updateReason = reason;
          await this.offlineDocService.updateDocument('ordersSellingTracking', pd.id, upd);
          updated++;
        }
      } catch (e) {
        errors.push({ id: pd.id, error: e });
      }
    }
  } catch (e) {
    errors.push({ id: 'pending-check', error: e });
  }

  return { updated, errors };
}
async markOrderTrackingRefunded(orderId: string, refundedBy?: string, reason?: string): Promise<{ created: number; errors: any[]; createdIds?: string[] }> {
  const errors: any[] = [];
  let created = 0;
  const createdIds: string[] = [];
  try {
    // Fetch all tracking rows for the order and filter returned ones locally
    const q = query(collection(this.firestore, 'ordersSellingTracking'), where('orderId', '==', orderId));
    const snaps = await getDocs(q as any);

    for (const s of snaps.docs) {
      const data: any = s.data() || {};
      const status = (data.status || '').toString().toLowerCase();
      console.log(`markOrderTrackingRefunded: found ${snaps.docs.length} tracking docs for order ${orderId}`);
      console.log(`markOrderTrackingRefunded: doc=${s.id} status=${status}`);
      if (status !== 'returned' && status !== 'return') continue; // be lenient
      const product = this.productService.getProduct(data.productId);

      // Prepare timestamps appropriate for online vs offline storage
          const onlineCreatedAt = new Date();
      const offlineCreatedAt = new Date();

      // Build a clean refund record (avoid copying internal metadata like doc id)
      const newDoc: any = {
        companyId: data.companyId || undefined,
        storeId: data.storeId || undefined,
        orderId: data.orderId || orderId,
        batchNumber: data.batchNumber || 1,
        itemIndex: data.itemIndex ?? 0,
        orderDetailsId: data.orderDetailsId || undefined,
        productId: data.productId,
        productName: data.productName,
        productCode: data.productCode || product?.productCode,
        sku: data.sku || product?.skuId,
        price: data.price,
        quantity: data.quantity,
        total: data.total,
        uid: data.uid || data.createdBy || undefined,
        cashierId: data.cashierId || data.createdBy || undefined,
        status: 'refunded',
        createdAt: this.networkService.isOnline() ? onlineCreatedAt : offlineCreatedAt,
        createdBy: refundedBy || data.updatedBy || data.createdBy || 'system',
        updatedAt: this.networkService.isOnline() ? onlineCreatedAt : offlineCreatedAt,
        updatedBy: refundedBy || data.updatedBy || data.createdBy || 'system'
      };
      if (reason) newDoc.updateReason = reason;
      

      try {
        if (navigator.onLine) {
          // Create a brand new doc with auto-generated ID using collection ref
          const colRef = collection(this.firestore, 'ordersSellingTracking');
          const ref = doc(colRef as any);
          console.log(`markOrderTrackingRefunded: creating refunded doc online for tracking=${s.id} -> tentativeId=${ref.id}`);
          const payload = this.sanitizeForFirestore(newDoc);
          await setDoc(ref as any, payload as any);
          createdIds.push(ref.id);
          created++;
          console.log(`markOrderTrackingRefunded: success created=${created}, pushed id=${ref.id}`);
        } else {
          // Offline mode: create a new pending doc (use concrete dates)
          console.log(`markOrderTrackingRefunded: queuing offline refunded doc for tracking=${s.id}`);
          const payload = this.sanitizeForFirestore(newDoc);
          await this.offlineDocService.createDocument('ordersSellingTracking', payload as any);
          created++;
          console.log(`markOrderTrackingRefunded: offline queued created=${created}`);
        }
      } catch (e) {
        console.error(`markOrderTrackingRefunded: error creating refunded doc for tracking=${s.id}`, e);
        const errMsg = (e && (e as any).message) ? (e as any).message : String(e);
        errors.push({ id: s.id, error: errMsg });
      }
    }
  } catch (e) {
    errors.push({ id: 'query', error: e });
  }

  // ALSO handle any pending offline queued tracking documents
  try {
    const pending = await this.offlineDocService.getPendingDocuments();
    console.log(`Refund check: found ${pending.length} pending offline docs`);
    for (const pd of pending) {
      try {
        if (
          pd.collectionName === 'ordersSellingTracking' &&
          pd.data &&
          pd.data.orderId === orderId &&
          pd.data.status === 'returned'
        ) {
          const newDoc: any = {
            companyId: pd.data.companyId || undefined,
            storeId: pd.data.storeId || undefined,
            orderId: pd.data.orderId || orderId,
            batchNumber: pd.data.batchNumber || 1,
            itemIndex: pd.data.itemIndex ?? 0,
            orderDetailsId: pd.data.orderDetailsId || undefined,
            productId: pd.data.productId,
            productName: pd.data.productName,
            productCode: pd.data.productCode || (this.productService.getProduct(pd.data.productId)?.productCode),
            sku: pd.data.sku || (this.productService.getProduct(pd.data.productId)?.skuId),
            price: pd.data.price,
            quantity: pd.data.quantity,
            total: pd.data.total,
            uid: pd.data.uid || pd.data.createdBy || undefined,
            cashierId: pd.data.cashierId || pd.data.createdBy || undefined,
            status: 'refunded',
            createdAt: new Date(),
            createdBy: refundedBy || pd.data.createdBy || 'system',
            updatedAt: new Date(),
            updatedBy: refundedBy || pd.data.createdBy || 'system',
          };
          const payload = this.sanitizeForFirestore(newDoc);
          console.log(`Offline: creating NEW refunded doc for pending ${pd.id}, productId=${pd.data.productId}, qty=${pd.data.quantity}`);
          await this.offlineDocService.createDocument('ordersSellingTracking', payload);
          created++;
        }
      } catch (e) {
        console.error(`Failed to create refunded doc for pending ${pd.id}`, e);
        errors.push({ id: pd.id, error: e });
      }
    }
  } catch (e) {
    console.error(`Refund pending-check failed for order ${orderId}`, e);
    errors.push({ id: 'pending-check', error: e });
  }

  console.log(`Refund process completed for order ${orderId}: created=${created}, errors=${errors.length}`);
  return { created, errors, createdIds };
}

/**
 * Create a tracking record (partial or full) based on an existing tracking doc id.
 * `newStatus` may be 'partial_return'|'partial_refund'|'partial_damage' or
 * 'returned'|'refunded'|'damaged'. This method creates a new tracking doc and
 * for damage statuses applies inventory deductions for the given quantity.
 */
async createPartialTrackingFromDoc(trackingId: string, newStatus: string, qty: number, createdBy?: string): Promise<{ created: number; errors: any[] }> {
  const errors: any[] = [];
  let created = 0;
  try {
    const ref = doc(this.firestore, 'ordersSellingTracking', trackingId);
    const snap: any = await getDoc(ref as any);
    let data: any = null;
    if (snap && snap.exists && snap.exists()) {
      data = snap.data() || {};
    } else {
      // Try pending offline docs as fallback
      try {
        const pending = await this.offlineDocService.getPendingDocuments();
        const pd = pending.find((p: any) => p.collectionName === 'ordersSellingTracking' && (p.id === trackingId || p.data?.id === trackingId));
        if (pd && pd.data) data = pd.data;
      } catch (e) {
        // ignore
      }
    }

    if (!data) {
      errors.push({ id: trackingId, error: 'Source tracking document not found' });
      return { created, errors };
    }

    const onlineCreatedAt = new Date();
    const offlineCreatedAt = new Date();

    const unitPrice = Number(data.price || 0);
    const origQty = Number(data.quantity || 0) || 1;
    const discountTotal = Number(data.discount || 0) || 0;
    const vatTotal = Number(data.vat || 0) || 0;

    const perUnitDiscount = origQty ? (discountTotal / origQty) : 0;
    const perUnitVat = origQty ? (vatTotal / origQty) : 0;

    const newDiscount = perUnitDiscount * qty;
    const newVat = perUnitVat * qty;
    const total = Math.max(0, unitPrice * qty - newDiscount - newVat);

    const newDoc: any = {
      companyId: data.companyId || undefined,
      storeId: data.storeId || undefined,
      orderId: data.orderId || undefined,
      batchNumber: data.batchNumber || 1,
      itemIndex: data.itemIndex ?? 0,
      orderDetailsId: data.orderDetailsId || undefined,
      productId: data.productId,
      productName: data.productName,
      price: unitPrice,
      quantity: qty,
      total,
      discount: newDiscount,
      vat: newVat,
      uid: data.uid || data.createdBy || undefined,
      cashierId: data.cashierId || data.createdBy || undefined,
      status: newStatus,
      createdAt: this.networkService.isOnline() ? onlineCreatedAt : offlineCreatedAt,
      createdBy: createdBy || data.updatedBy || data.createdBy || 'system',
      updatedAt: this.networkService.isOnline() ? onlineCreatedAt : offlineCreatedAt,
      updatedBy: createdBy || data.updatedBy || data.createdBy || 'system'
    };

    const newStatusLower = (newStatus || '').toString().toLowerCase();
    const isDamage = newStatusLower.includes('damage');

    if (this.networkService.isOnline()) {
      const colRef = collection(this.firestore, 'ordersSellingTracking');
      const newRef = doc(colRef as any);
      const payload = this.sanitizeForFirestore(newDoc);
      await setDoc(newRef as any, payload as any);
      created++;

      // If damage (partial or full), deduct inventory for the qty
      if (isDamage) {
        try {
          const productId = data.productId;
          const dedQty = qty;
          if (productId && dedQty > 0) {
            const batchQ = query(
              collection(this.firestore, 'productInventory'),
              where('productId', '==', productId),
              orderBy('receivedAt', 'desc'),
              limit(10)
            );
            let batchSnaps: any = null;
            let latestBatch: any = null;
            try {
              batchSnaps = await getDocs(batchQ as any);
              if (batchSnaps && !batchSnaps.empty) {
                for (const b of batchSnaps.docs) {
                  const bd: any = b.data() || {};
                  if ((bd.status || 'active').toString().toLowerCase() === 'active') {
                    latestBatch = b;
                    break;
                  }
                }
                if (!latestBatch) latestBatch = batchSnaps.docs[0];
              }
            } catch (queryErr) {
              try {
                const fallbackQ = query(
                  collection(this.firestore, 'productInventory'),
                  where('productId', '==', productId),
                  limit(10)
                );
                const fallbackSnaps = await getDocs(fallbackQ as any);
                if (fallbackSnaps && !fallbackSnaps.empty) {
                  const docs = fallbackSnaps.docs.slice().sort((a: any, b: any) => {
                    const ad = (a.data()?.receivedAt as any) || new Date(0);
                    const bd = (b.data()?.receivedAt as any) || new Date(0);
                    const at = ad instanceof Date ? ad.getTime() : (typeof ad === 'number' ? ad : new Date(ad).getTime());
                    const bt = bd instanceof Date ? bd.getTime() : (typeof bd === 'number' ? bd : new Date(bd).getTime());
                    return bt - at;
                  });
                  for (const b of docs) {
                    const bd: any = b.data() || {};
                    if ((bd.status || 'active').toString().toLowerCase() === 'active') {
                      latestBatch = b;
                      break;
                    }
                  }
                  if (!latestBatch) latestBatch = docs[0];
                }
              } catch (fbErr) {
                console.warn('createPartialTrackingFromDoc: fallback batch query failed', fbErr);
              }
            }

            await runTransaction(this.firestore, async (transaction) => {
              const productRef = doc(this.firestore, 'products', productId);
              const productSnap = await transaction.get(productRef as any);
              if (!productSnap.exists()) throw new Error(`Product ${productId} not found`);

              let batchRef: any = null;
              let batchSnap: any = null;
              let batchData: any = null;
              if (latestBatch) {
                batchRef = doc(this.firestore, 'productInventory', latestBatch.id as any);
                batchSnap = await transaction.get(batchRef as any);
                if (!batchSnap.exists()) throw new Error(`Batch ${latestBatch.id} not found`);
                batchData = batchSnap.data();
              }

              const prodData: any = productSnap.data();
              const currentTotal = Number(prodData.totalStock || 0);
              const newTotal = Math.max(0, currentTotal - dedQty);
              transaction.update(productRef as any, { totalStock: newTotal, lastUpdated: new Date(), updatedBy: createdBy || 'system' } as any);

              if (batchSnap && batchData) {
                const currentQty = Number(batchData.quantity || 0);
                const newBatchQty = Math.max(0, currentQty - dedQty);
                const updateData: any = {
                  quantity: newBatchQty,
                  totalDeducted: (batchData.totalDeducted || 0) + dedQty,
                  updatedAt: new Date(),
                  status: newBatchQty === 0 ? 'inactive' : batchData.status
                };
                transaction.update(batchRef as any, updateData);

                const dedRecord = {
                  productId,
                  batchId: batchData.batchId || null,
                  quantity: dedQty,
                  deductedAt: new Date(),
                  note: 'DAMAGED - client',
                  deductedBy: createdBy || null,
                  orderId: data.orderId
                };
                const dedRef = doc(collection(this.firestore, 'inventoryDeductions'));
                transaction.set(dedRef, dedRecord as any);
              } else {
                const dedRecord = {
                  productId,
                  batchId: null,
                  quantity: dedQty,
                  deductedAt: new Date(),
                  note: 'DAMAGED - no-batch',
                  deductedBy: createdBy || null,
                  orderId: data.orderId
                };
                const dedRef = doc(collection(this.firestore, 'inventoryDeductions'));
                transaction.set(dedRef, dedRecord as any);
              }
            });
          }
        } catch (invErr) {
          errors.push({ id: newRef ? newRef.id : null, error: invErr });
        }
      }
      // If we created an online damaged/partial-damage tracking row, record a ledger 'damage' event
      try {
        if (isDamage && this.networkService.isOnline()) {
          const companyId = data.companyId || newDoc.companyId;
          const storeId = data.storeId || newDoc.storeId;
          const orderId = newDoc.orderId || data.orderId;
          const amount = Number(newDoc.total || 0);
          const quantity = Number(newDoc.quantity || 0);
          await this.ledgerService.recordEvent(companyId, storeId, orderId, 'damaged' as any, amount, quantity, createdBy || newDoc.createdBy || 'system');
          console.log(`createPartialTrackingFromDoc: recorded ledger damage for order ${orderId}`);
        }
      } catch (ledgerErr) {
        console.warn('createPartialTrackingFromDoc: ledger recordEvent failed', ledgerErr);
      }
    } else {
      const payload = this.sanitizeForFirestore(newDoc);
      await this.offlineDocService.createDocument('ordersSellingTracking', payload as any);
      created++;
      if (isDamage) {
        try {
          // optimistic update locally
          const productId = data.productId;
          const dedQty = qty;
          if (productId && dedQty > 0) {
            const product = this.productService.getProduct(productId);
            const current = product?.totalStock ?? 0;
            const newTotal = Math.max(0, current - dedQty);
            await this.productService.updateProduct(productId, { totalStock: newTotal, lastUpdated: new Date() } as any);
          }
        } catch (localErr) {
          // ignore optimistic failure
        }
      }
    }
  } catch (e) {
    errors.push({ id: trackingId, error: e });
  }

  return { created, errors };
}

/**
 * Create 'damaged' tracking records based on existing returned rows.
 * This does NOT modify the original docs; it creates new docs with status 'damaged'.
 */
async markOrderTrackingDamaged(orderId: string, damagedBy?: string, reason?: string): Promise<{ created: number; errors: any[]; createdIds?: string[] }> {
  const errors: any[] = [];
  let created = 0;
  const createdIds: string[] = [];
  try {
    const q = query(collection(this.firestore, 'ordersSellingTracking'), where('orderId', '==', orderId));
    const snaps = await getDocs(q as any);

    console.log(`markOrderTrackingDamaged: found ${snaps.docs.length} tracking docs for order ${orderId}`);
    for (const s of snaps.docs) {
      const data: any = s.data() || {};
      const status = (data.status || '').toString().toLowerCase();
      console.log(`markOrderTrackingDamaged: doc=${s.id} status=${status}`);
      // Only create damaged copies for returned items (same source as refunds)
      if (status !== 'returned' && status !== 'return') continue;

      const onlineCreatedAt = new Date();
      const offlineCreatedAt = new Date();

      const newDoc: any = {
        companyId: data.companyId || undefined,
        storeId: data.storeId || undefined,
        orderId: data.orderId || orderId,
        batchNumber: data.batchNumber || 1,
        itemIndex: data.itemIndex ?? 0,
        orderDetailsId: data.orderDetailsId || undefined,
        productId: data.productId,
        productName: data.productName,
        price: data.price,
        quantity: data.quantity,
        total: data.total,
        uid: data.uid || data.createdBy || undefined,
        cashierId: data.cashierId || data.createdBy || undefined,
        status: 'damaged',
        createdAt: this.networkService.isOnline() ? onlineCreatedAt : offlineCreatedAt,
        createdBy: damagedBy || data.updatedBy || data.createdBy || 'system',
        updatedAt: this.networkService.isOnline() ? onlineCreatedAt : offlineCreatedAt,
        updatedBy: damagedBy || data.updatedBy || data.createdBy || 'system'
      };
      if (reason) newDoc.updateReason = reason;

      try {
        if (navigator.onLine) {
          const colRef = collection(this.firestore, 'ordersSellingTracking');
          const ref = doc(colRef as any);
          const payload = this.sanitizeForFirestore(newDoc);
          console.log(`markOrderTrackingDamaged: creating damaged doc online for tracking=${s.id} -> tentativeId=${ref.id}`);
          await setDoc(ref as any, payload as any);
          createdIds.push(ref.id);

          // After creating the damaged tracking doc, deduct from product.totalStock and latest productInventory batch
          try {
            const productId = data.productId;
            const qty = Number(data.quantity || 0);
            if (productId && qty > 0) {
              // find latest active batch (most recent receivedAt)
              // NOTE: querying with multiple where+orderBy combinations can require a composite index.
              // To avoid requiring a composite index here, fetch the most recent batches for the product
              // and select the first one with status === 'active' locally.
              const batchQ = query(
                collection(this.firestore, 'productInventory'),
                where('productId', '==', productId),
                orderBy('receivedAt', 'desc'),
                limit(10)
              );
              let batchSnaps: any = null;
              let latestBatch = null as any;
              try {
                batchSnaps = await getDocs(batchQ as any);
                if (batchSnaps && !batchSnaps.empty) {
                  for (const b of batchSnaps.docs) {
                    const bd: any = b.data() || {};
                    if ((bd.status || 'active').toString().toLowerCase() === 'active') {
                      latestBatch = b;
                      break;
                    }
                  }
                  // fallback to the first snapshot if none are active
                  if (!latestBatch) latestBatch = batchSnaps.docs[0];
                }
              } catch (queryErr) {
                // If Firestore complains about missing composite index, fallback to a simpler query
                const msg = (queryErr && (queryErr as any).message) ? (queryErr as any).message : String(queryErr);
                console.warn('markOrderTrackingDamaged: batch query failed, falling back to simpler query:', msg);
                try {
                  const fallbackQ = query(
                    collection(this.firestore, 'productInventory'),
                    where('productId', '==', productId),
                    limit(10)
                  );
                  const fallbackSnaps = await getDocs(fallbackQ as any);
                  if (fallbackSnaps && !fallbackSnaps.empty) {
                    // Sort on client by receivedAt desc and pick first active
                    const docs = fallbackSnaps.docs.slice().sort((a: any, b: any) => {
                      const ad = (a.data()?.receivedAt as any) || new Date(0);
                      const bd = (b.data()?.receivedAt as any) || new Date(0);
                      const at = ad instanceof Date ? ad.getTime() : (typeof ad === 'number' ? ad : new Date(ad).getTime());
                      const bt = bd instanceof Date ? bd.getTime() : (typeof bd === 'number' ? bd : new Date(bd).getTime());
                      return bt - at;
                    });
                    for (const b of docs) {
                      const bd: any = b.data() || {};
                      if ((bd.status || 'active').toString().toLowerCase() === 'active') {
                        latestBatch = b;
                        break;
                      }
                    }
                    if (!latestBatch) latestBatch = docs[0];
                  }
                } catch (fbErr) {
                  console.warn('markOrderTrackingDamaged: fallback batch query also failed', fbErr);
                }
              }

              await runTransaction(this.firestore, async (transaction) => {
                // First: read all documents needed by the transaction (product and batch)
                const productRef = doc(this.firestore, 'products', productId);
                const productSnap = await transaction.get(productRef as any);
                if (!productSnap.exists()) {
                  throw new Error(`Product ${productId} not found while applying damage deduction`);
                }

                let batchRef: any = null;
                let batchSnap: any = null;
                let batchData: any = null;
                if (latestBatch) {
                  batchRef = doc(this.firestore, 'productInventory', latestBatch.id as any);
                  batchSnap = await transaction.get(batchRef as any);
                  if (!batchSnap.exists()) {
                    throw new Error(`Batch ${latestBatch.id} not found during damage transaction`);
                  }
                  batchData = batchSnap.data();
                }

                // All reads complete; now compute new values and perform writes
                const prodData: any = productSnap.data();
                const currentTotal = Number(prodData.totalStock || 0);
                const newTotal = Math.max(0, currentTotal - qty);
                transaction.update(productRef as any, { totalStock: newTotal, lastUpdated: new Date(), updatedBy: damagedBy || 'system' } as any);

                if (batchSnap && batchData) {
                  const currentQty = Number(batchData.quantity || 0);
                  const newBatchQty = Math.max(0, currentQty - qty);
                  const updateData: any = {
                    quantity: newBatchQty,
                    totalDeducted: (batchData.totalDeducted || 0) + qty,
                    updatedAt: new Date(),
                    status: newBatchQty === 0 ? 'inactive' : batchData.status
                  };
                  transaction.update(batchRef as any, updateData);

                  // record deduction referencing batch
                  const dedRecord = {
                    productId,
                    batchId: batchData.batchId || null,
                    quantity: qty,
                    deductedAt: new Date(),
                    note: 'DAMAGED - client',
                    deductedBy: damagedBy || null,
                    orderId: orderId
                  };
                  const dedRef = doc(collection(this.firestore, 'inventoryDeductions'));
                  transaction.set(dedRef, dedRecord as any);
                } else {
                  // No batch found — still record product deduction and an inventoryDeductions record without batch
                  const dedRecord = {
                    productId,
                    batchId: null,
                    quantity: qty,
                    deductedAt: new Date(),
                    note: 'DAMAGED - no-batch',
                    deductedBy: damagedBy || null,
                    orderId: orderId
                  };
                  const dedRef = doc(collection(this.firestore, 'inventoryDeductions'));
                  transaction.set(dedRef, dedRecord as any);
                }
              });

              console.log(`markOrderTrackingDamaged: inventory adjusted for product ${productId} qty ${qty}`);
            }
          } catch (invErr) {
            console.error('markOrderTrackingDamaged: inventory adjustment failed', invErr);
            // Continue; we already created the tracking doc — report error
            errors.push({ id: ref.id, error: (invErr && (invErr as any).message) ? (invErr as any).message : String(invErr) });
          }

          // Record ledger entry for damage (online only)
          try {
            if (this.networkService.isOnline()) {
              const companyId = data.companyId || newDoc.companyId;
              const storeId = data.storeId || newDoc.storeId;
              const ledgerOrderId = newDoc.orderId || data.orderId || orderId;
              const amount = Number(data.total || 0);
              const quantity = Number(data.quantity || 0);
              await this.ledgerService.recordEvent(companyId, storeId, ledgerOrderId, 'damaged' as any, amount, quantity, damagedBy || data.updatedBy || data.createdBy || 'system');
              console.log(`markOrderTrackingDamaged: ledger damage recorded for order ${ledgerOrderId}`);
            }
          } catch (ledgerErr) {
            console.warn('markOrderTrackingDamaged: ledger recordEvent failed', ledgerErr);
          }

          created++;
          console.log(`markOrderTrackingDamaged: success created=${created}, pushed id=${ref.id}`);
        } else {
          const payload = this.sanitizeForFirestore(newDoc);
          console.log(`markOrderTrackingDamaged: queueing offline damaged doc for tracking=${s.id}`);
          await this.offlineDocService.createDocument('ordersSellingTracking', payload as any);
          // Optimistic local product update when offline
          try {
            const productId = data.productId;
            const qty = Number(data.quantity || 0);
            if (productId && qty > 0) {
              const product = this.productService.getProduct(productId);
              const current = product?.totalStock ?? 0;
              const newTotal = Math.max(0, current - qty);
              await this.productService.updateProduct(productId, { totalStock: newTotal, lastUpdated: new Date() } as any);
              console.log(`markOrderTrackingDamaged: optimistic product totalStock updated offline ${productId} ${current} -> ${newTotal}`);
            }
          } catch (localErr) {
            console.warn('markOrderTrackingDamaged: optimistic product update failed', localErr);
          }
          created++;
          console.log(`markOrderTrackingDamaged: offline queued created=${created}`);
        }
      } catch (e) {
        console.error(`markOrderTrackingDamaged: error creating damaged doc for tracking=${s.id}`, e);
        const errMsg = (e && (e as any).message) ? (e as any).message : String(e);
        errors.push({ id: s.id, error: errMsg });
      }
    }
  } catch (e) {
    errors.push({ id: 'query', error: e });
  }

  // Also handle any pending offline returned docs and queue damaged copies
  try {
    const pending = await this.offlineDocService.getPendingDocuments();
    console.log(`Damaged check: found ${pending.length} pending offline docs`);
    for (const pd of pending) {
      try {
        if (pd.collectionName === 'ordersSellingTracking' && pd.data && pd.data.orderId === orderId && pd.data.status === 'returned') {
          const newDoc: any = {
            companyId: pd.data.companyId || undefined,
            storeId: pd.data.storeId || undefined,
            orderId: pd.data.orderId || orderId,
            batchNumber: pd.data.batchNumber || 1,
            itemIndex: pd.data.itemIndex ?? 0,
            orderDetailsId: pd.data.orderDetailsId || undefined,
            productId: pd.data.productId,
            productName: pd.data.productName,
            price: pd.data.price,
            quantity: pd.data.quantity,
            total: pd.data.total,
            uid: pd.data.uid || pd.data.createdBy || undefined,
            cashierId: pd.data.cashierId || pd.data.createdBy || undefined,
            status: 'damaged',
            createdAt: new Date(),
            createdBy: damagedBy || pd.data.createdBy || 'system',
            updatedAt: new Date(),
            updatedBy: damagedBy || pd.data.createdBy || 'system'
          };
          const payload = this.sanitizeForFirestore(newDoc);
          console.log(`Offline: creating NEW damaged doc for pending ${pd.id}, productId=${pd.data.productId}, qty=${pd.data.quantity}`);
          await this.offlineDocService.createDocument('ordersSellingTracking', payload);
          created++;
        }
      } catch (e) {
        console.error(`Failed to create damaged doc for pending ${pd.id}`, e);
        errors.push({ id: pd.id, error: e });
      }
    }
  } catch (e) {
    console.error(`Damaged pending-check failed for order ${orderId}`, e);
    errors.push({ id: 'pending-check', error: e });
  }

  console.log(`Damage process completed for order ${orderId}: created=${created}, errors=${errors.length}`);
  return { created, errors, createdIds };
}

  /**
   * Remove undefined fields from object (Firestore rejects undefined values)
   */
  private removeUndefinedFields(obj: any): any {
    const cleaned: any = {};
    for (const key in obj) {
      if (obj[key] !== undefined) {
        cleaned[key] = obj[key];
      }
    }
    return cleaned;
  }

  /**
   * Log a batch of sale items for later reconciliation and apply stock deltas to products.
   * Best-effort per item; continues on individual failures, returns summary.
   */
  async logSaleAndAdjustStock(
    ctx: {
      companyId: string;
      storeId: string;
      orderId: string;
      invoiceNumber?: string;
      cashierId: string;
      cashierEmail?: string;
      cashierName?: string;
    },
    items: Array<{
      productId: string;
      productName?: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
      // Optional fields supported for richer tracking
      discount?: number;
      discountType?: 'percentage' | 'fixed' | 'none' | string;
      vat?: number;
      isVatExempt?: boolean;
      batchNumber?: number;
    }>
  ): Promise<{ success: boolean; tracked: number; adjusted: number; errors: Array<{ productId: string; error: any }> }> {
    const colName = 'ordersSellingTracking';
    const errors: Array<{ productId: string; error: any }> = [];
    let tracked = 0;
    let adjusted = 0;

    let idx = 0;
    for (const it of items) {
      try {
        // Step 1: Find batches for this product using FIFO (oldest first, active only)
        // Query Firestore - it will automatically use its cache when offline
        let batches: any[] = [];
        
        const batchesQuery = query(
          collection(this.firestore, 'productInventory'),
          where('productId', '==', it.productId),
          where('storeId', '==', ctx.storeId),
          limit(100) // Get more batches since we're filtering/sorting client-side
        );

        let batchesSnapshot;
        try {
          batchesSnapshot = await getDocs(batchesQuery);
          batches = batchesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          
          const isFromCache = batchesSnapshot.metadata.fromCache;
          console.log(`🔥 Firestore returned ${batches.length} batches for product ${it.productId} (source: ${isFromCache ? 'CACHE' : 'SERVER'})`);
        } catch (queryError) {
          console.warn(`⚠️ Failed to query Firestore for product ${it.productId}:`, queryError);
          // If offline and Firestore cache failed, create tracking without batches
          if (!this.networkService.isOnline()) {
            console.log('📱 Offline: No batches available in Firestore cache, creating tracking only');
            
            // Create tracking document without batch deductions
            const docData: OrdersSellingTrackingDoc = {
              companyId: ctx.companyId,
              storeId: ctx.storeId,
              orderId: ctx.orderId,
              batchNumber: (it as any).batchNumber || 1,
              createdAt: new Date(),
              createdBy: ctx.cashierId,
              uid: ctx.cashierId,
              status: 'processing',
              itemIndex: idx,
              orderDetailsId: (it as any).orderDetailsId || undefined,
              productId: it.productId,
              productName: it.productName,
              productCode: (it as any).productCode || undefined,
              sku: (it as any).sku || undefined,
              cost: 0, // Will be calculated when synced
              price: it.unitPrice,
              quantity: it.quantity,
              discount: (it as any).discount ?? 0,
              discountType: (it as any).discountType ?? 'none',
              vat: (it as any).vat ?? 0,
              total: it.lineTotal,
              isVatExempt: !!((it as any).isVatExempt),
              cashierId: ctx.cashierId,
              cashierEmail: ctx.cashierEmail,
              cashierName: ctx.cashierName,
              number: (it as any).number || undefined,
              ...(this.networkService.isOnline() ? {} : { _offlineCreated: true })
            } as OrdersSellingTrackingDoc;

            const trackingRef = collection(this.firestore, 'ordersSellingTracking');
            const cleanedDoc = this.removeUndefinedFields(docData as any);
            await addDoc(trackingRef, cleanedDoc);
            tracked++;
            console.log(`📝 Created offline tracking (no batches) for product ${it.productId}`);
            
            idx++;
            continue; // Skip to next item
          }
          throw queryError; // Re-throw if online
        }

        // batches array now contains data from Firestore (with cache)
        const allBatches = batches;
        
        console.log(`📊 Retrieved ${allBatches.length} batches for product ${it.productId}`);
        
        // Filter and sort client-side: active status, quantity > 0, matching companyId, FIFO order
        const filteredBatches = allBatches
          .filter(b => {
            const match = b.companyId === ctx.companyId &&
              (b.status || '').toLowerCase() === 'active' &&
              (b.quantity || 0) > 0;
            return match;
          })
          .sort((a, b) => {
            // Sort by batchId ascending (FIFO - oldest first, batchId contains timestamp)
            const aBatchId = String(a.batchId || '');
            const bBatchId = String(b.batchId || '');
            if (aBatchId && bBatchId) {
              return aBatchId.localeCompare(bBatchId);
            }
            // Fallback to receivedAt if batchId not available
            const aTime = a.receivedAt?.toDate?.()?.getTime() || a.receivedAt?.getTime?.() || 0;
            const bTime = b.receivedAt?.toDate?.()?.getTime() || b.receivedAt?.getTime?.() || 0;
            return aTime - bTime;
          })
          .slice(0, 20); // Take first 20 after filtering and sorting

        console.log(`📦 Found ${filteredBatches.length} active batches with stock for product ${it.productId} (FIFO sorted)`);

        // Step 2: Deduct quantity from batches using FIFO and track deductions
        let remainingQty = it.quantity;
        const batchDeductions: Array<{
          batchId: string;
          refId: string;
          costPrice: number;
          deductedQty: number;
        }> = [];

        for (const batch of filteredBatches) {
          if (remainingQty <= 0) break;

          const availableQty = batch.quantity || 0;
          const deductQty = Math.min(remainingQty, availableQty);

          // Update the batch quantity in productInventory
          const batchRef = doc(this.firestore, 'productInventory', batch.id);
          const newQty = availableQty - deductQty;
          const newTotalDeducted = (batch.totalDeducted || 0) + deductQty;
          const newStatus = newQty === 0 ? 'depleted' : 'active';

          // Update Firestore (queues for sync when online)
          try {
            await updateDoc(batchRef, {
              quantity: newQty,
              totalDeducted: newTotalDeducted,
              status: newStatus,
              updatedAt: new Date(),
              updatedBy: ctx.cashierId
            });
            console.log(`✅ Updated batch ${batch.batchId} in Firestore`);
          } catch (updateError) {
            console.warn(`⚠️ Failed to update batch ${batch.batchId} in Firestore (will retry via persistence):`, updateError);
            // Firestore offline persistence will queue this update and update its cache automatically
          }

          // Only record deductions for batches where we actually deducted (qty > 0)
          if (deductQty > 0) {
            batchDeductions.push({
              batchId: batch.batchId || batch.id,
              refId: batch.id, // productInventory document ID
              costPrice: batch.costPrice || batch.unitPrice || 0,
              deductedQty: deductQty
            });
          }

          remainingQty -= deductQty;

          console.log(`✅ Deducted ${deductQty} from batch ${batch.batchId}, remaining in batch: ${newQty}`);
        }

        // Step 3: Create inventoryDeductions records (one per batch used, sorted by batchId asc)
        // If no batches found but offline, create a generic deduction record for reconciliation
        if (batchDeductions.length === 0 && !this.networkService.isOnline()) {
          console.log(`📱 Offline: Creating generic deduction for product ${it.productId} (no batches available)`);
          
          const genericDeduction = {
            companyId: ctx.companyId,
            storeId: ctx.storeId,
            orderId: ctx.orderId,
            invoiceNumber: ctx.invoiceNumber || '',
            productId: it.productId,
            productCode: (it as any).productCode || '',
            sku: (it as any).sku || it.productId,
            productName: it.productName || '',
            
            // Generic batch info - will be reconciled when online
            batchId: 'PENDING_RECONCILIATION',
            refId: 'PENDING_RECONCILIATION',
            costPrice: 0,
            
            // Deduction details
            quantity: it.quantity,
            deductedAt: this.sanitizeForFirestore(new Date()),
            
            // Audit
            deductedBy: ctx.cashierId,
            createdAt: this.sanitizeForFirestore(new Date()),
            
            // Mark as offline-created for reconciliation
            _offlineCreated: true,
            _needsReconciliation: true
          };

          try {
            const deductionsRef = collection(this.firestore, 'inventoryDeductions');
            const cleanedDoc = this.removeUndefinedFields(genericDeduction);
            await addDoc(deductionsRef, cleanedDoc);
            console.log(`📝 Created generic deduction for offline reconciliation: product=${it.productId}, qty=${it.quantity}`);
          } catch (error) {
            console.warn(`⚠️ Failed to create generic deduction:`, error);
          }
        }
        
        // Sort by batchId ascending before creating records
        batchDeductions.sort((a, b) => a.batchId.localeCompare(b.batchId));

        for (const deduction of batchDeductions) {
          const deductionDoc = {
            companyId: ctx.companyId,
            storeId: ctx.storeId,
            orderId: ctx.orderId,
            invoiceNumber: ctx.invoiceNumber || '',
            productId: it.productId,
            productCode: (it as any).productCode || '',
            sku: (it as any).sku || it.productId,
            productName: it.productName || '',
            
            // Batch info
            batchId: deduction.batchId,
            refId: deduction.refId, // productInventory document ID
            costPrice: deduction.costPrice,
            
            // Deduction details
            quantity: deduction.deductedQty,
            deductedAt: this.sanitizeForFirestore(new Date()),
            
            // Audit
            deductedBy: ctx.cashierId,
            createdAt: this.sanitizeForFirestore(new Date()),
            
            // Mark as offline-created if offline
            ...(this.networkService.isOnline() ? {} : { _offlineCreated: true })
          };

          // Use Firestore directly for automatic offline sync
          try {
            const deductionsRef = collection(this.firestore, 'inventoryDeductions');
            const cleanedDoc = this.removeUndefinedFields(deductionDoc);
            await addDoc(deductionsRef, cleanedDoc);
            console.log(`📝 Created deduction log: batch=${deduction.batchId}, qty=${deduction.deductedQty}, cost=₱${deduction.costPrice}`);
          } catch (error) {
            console.warn(`⚠️ Failed to create deduction log (will retry via Firestore persistence):`, error);
            // Firestore offline persistence will queue this automatically
          }
        }

        if (remainingQty > 0) {
          console.warn(`⚠️ Insufficient stock for product ${it.productId}. Short by ${remainingQty} units.`);
          errors.push({
            productId: it.productId,
            error: `Insufficient stock. Short by ${remainingQty} units.`
          });
        }

        // Calculate weighted average cost from all batches used
        let totalCost = 0;
        batchDeductions.forEach((d, idx) => {
          const batchTotal = d.costPrice * d.deductedQty;
          totalCost += batchTotal;
        });
        const actualCost = batchDeductions.length > 0 ? totalCost / it.quantity : 0;

        // Step 4: Create ordersSellingTracking record with actual cost
        const docData: OrdersSellingTrackingDoc = {
          companyId: ctx.companyId,
          storeId: ctx.storeId,
          orderId: ctx.orderId,
          batchNumber: (it as any).batchNumber || 1,
          createdAt: new Date(),
          createdBy: ctx.cashierId,
          uid: ctx.cashierId,
          status: 'processing',

          itemIndex: idx,
          orderDetailsId: (it as any).orderDetailsId || undefined,
          productId: it.productId,
          productName: it.productName,
          productCode: (it as any).productCode || undefined,
          sku: (it as any).sku || undefined,
          cost: actualCost, // Actual weighted average cost from batches
          price: it.unitPrice,
          quantity: it.quantity,
          discount: (it as any).discount ?? 0,
          discountType: (it as any).discountType ?? 'none',
          vat: (it as any).vat ?? 0,
          total: it.lineTotal,
          isVatExempt: !!((it as any).isVatExempt),

          cashierId: ctx.cashierId,
          cashierEmail: ctx.cashierEmail,
          cashierName: ctx.cashierName,
          number: (it as any).number || undefined,
          
          // Mark as offline-created if offline
          ...(this.networkService.isOnline() ? {} : { _offlineCreated: true })
        } as OrdersSellingTrackingDoc;

        // Use Firestore directly for automatic offline sync (same as inventoryDeductions)
        try {
          const trackingRef = collection(this.firestore, colName);
          const cleanedDoc = this.removeUndefinedFields(docData as any);
          await addDoc(trackingRef, cleanedDoc);
          tracked++;
          console.log(`📝 Created tracking log for product ${it.productId}, qty=${it.quantity}`);
        } catch (error) {
          console.warn(`⚠️ Failed to create tracking log (will retry via Firestore persistence):`, error);
          // Firestore offline persistence will queue this automatically
        }

        // Step 5: Update product totalStock
        const product = this.productService.getProduct(it.productId);
        if (product) {
          const current = product.totalStock ?? 0;
          const newTotal = Math.max(0, current - it.quantity);
          
          await this.productService.updateProduct(it.productId, {
            totalStock: newTotal,
            lastUpdated: new Date(),
            updatedBy: ctx.cashierId
          } as any);

          console.log(`✅ Adjusted product ${it.productId} stock: ${current} -> ${newTotal}`);
          adjusted++;
        }

      } catch (e) {
        console.error(`❌ Error processing product ${it.productId}:`, e);
        errors.push({ productId: it.productId, error: e });
      }

      idx++;
    }

    return { success: errors.length === 0, tracked, adjusted, errors };
  }

  /**
   * Fetch tracking entries for an order directly from Firestore as a fallback when Cloud Function is unavailable.
   */
  async fetchTrackingEntries(orderId: string): Promise<any[]> {
    try {
      const q = query(collection(this.firestore, 'ordersSellingTracking'), where('orderId', '==', orderId));
      const snaps = await getDocs(q as any);
      if (!snaps || snaps.empty) return [];

      const results: any[] = [];
      for (const s of snaps.docs) {
        const data: any = s.data() || {};
        const product = this.productService.getProduct(data.productId);
        results.push({
          id: s.id,
          productId: data.productId,
          productName: data.productName || product?.productName || '',
          sku: product?.skuId || undefined,
          quantity: data.quantity,
          price: data.price,
          total: data.total,
          status: data.status,
          createdAt: toDateValue(data.createdAt) || undefined,
          updatedAt: toDateValue(data.updatedAt) || undefined,
          orderDetailsId: data.orderDetailsId,
          batchNumber: data.batchNumber,
          cashierId: data.cashierId || data.createdBy
        });
      }
      return results;
    } catch (e) {
      return [];
    }
  }

  /**
   * Get top products ordered by number of completed tracking records.
   * Returns an array of { productId, productName, skuId, completedCount } sorted desc.
   */
  async getTopProductsCompletedCounts(
    companyId: string,
    storeId?: string,
    topN: number = 100
  ): Promise<{ productId: string; productName: string; skuId: string; completedCount: number }[]> {
    try {
      // Step 1: fetch topN product documents (most recently updated first)
      // Build product query: include storeId when provided, otherwise query by company only
      let productsQ: any;
      if (storeId && storeId !== 'all') {
        productsQ = query(
          collection(this.firestore, 'products'),
          where('companyId', '==', companyId),
          where('storeId', '==', storeId),
          orderBy('updatedAt', 'desc'),
          limit(topN)
        );
      } else {
        productsQ = query(
          collection(this.firestore, 'products'),
          where('companyId', '==', companyId),
          orderBy('updatedAt', 'desc'),
          limit(topN)
        );
      }

      const productSnaps: any = await getDocs(productsQ as any);
      const results: { productId: string; productName: string; skuId: string; completedCount: number }[] = [];

      for (const p of productSnaps.docs) {
        const pdata: any = p.data() || {};
        const productId = p.id;
        const productName = pdata.productName || pdata.name || '';
        const skuId = pdata.skuId || pdata.sku || '';

        // Step 2: aggregate completed count for this product
        // Build orders query, include storeId filter only when provided
        let ordersQ: any;
        if (storeId && storeId !== 'all') {
          ordersQ = query(
            collection(this.firestore, 'ordersSellingTracking'),
            where('companyId', '==', companyId),
            where('storeId', '==', storeId),
            where('productId', '==', productId),
            where('status', '==', 'completed')
          );
        } else {
          ordersQ = query(
            collection(this.firestore, 'ordersSellingTracking'),
            where('companyId', '==', companyId),
            where('productId', '==', productId),
            where('status', '==', 'completed')
          );
        }

        let completedCount = 0;
        try {
          const aggSnap: any = await getAggregateFromServer(ordersQ as any, { count: count() } as any);
          completedCount = Number(aggSnap.data().count || 0);
        } catch (e) {
          // If aggregation fails (indexing or unsupported), fallback to fetching docs
          try {
            const snaps = await getDocs(ordersQ as any);
            completedCount = snaps?.docs?.length || 0;
          } catch (e2) {
            completedCount = 0;
          }
        }

        console.log(`getTopProductsCompletedCounts: product=${productId} name=${productName} completedCount=${completedCount}`);
        results.push({ productId, productName, skuId, completedCount });
      }

      // sort desc by completedCount
      results.sort((a, b) => b.completedCount - a.completedCount);
      return results;
    } catch (err) {
      console.warn('getTopProductsCompletedCounts error', err);
      return [];
    }
  }
}
