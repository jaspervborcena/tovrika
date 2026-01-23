import { Injectable, inject } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { getDocs, getDoc, setDoc, addDoc, query, collection, where, doc } from 'firebase/firestore';
import { OfflineDocumentService } from '../core/services/offline-document.service';
import { NetworkService } from '../core/services/network.service';
import { IndexedDBService } from '../core/services/indexeddb.service';
import { ProductService } from './product.service';
import { LedgerService } from './ledger.service';

// Helper: Validate required fields for OrdersSellingTrackingDoc
function validateOrdersSellingTrackingDoc(doc: Partial<OrdersSellingTrackingDoc>): void {
  console.log('[ordersSellingTracking] 🔍 Validating tracking doc:', {
    hasOrderId: !!doc.orderId,
    hasProductId: !!doc.productId,
    orderId: doc.orderId,
    productId: doc.productId
  });
  
  if (!doc.orderId) {
    console.error('[ordersSellingTracking] ❌ Validation failed: orderId is missing');
    throw new Error('orderId is required');
  }
  if (!doc.productId) {
    console.error('[ordersSellingTracking] ❌ Validation failed: productId is missing');
    throw new Error('productId is required');
  }
  
  console.log('[ordersSellingTracking] ✅ Validation passed');
  // price, quantity, total have defaults via ?? operators in buildTrackingBase
}
export interface OrdersSellingTrackingDoc {
  id?: string;
  companyId?: string;
  storeId?: string;
  orderId: string;
  batchNumber?: number;
  itemIndex?: number;
  productId: string;
  productName?: string;
  productCode?: string;
  sku?: string;
  price: number;
  quantity: number;
  total: number;
  uid?: string;
  cashierId?: string;
  orderDetailsId?: string;
  invoiceNumber?: string;
  status: 'open'|'completed'|'cancelled'|'returned'|'refunded'|'damaged'|'partial_return'|'partial_refund'|'partial_damage'|'recovered';
  createdAt: number;          // epoch ms
  createdAtText?: string;     // optional human-readable
  createdBy?: string;
  updatedAt?: number;         // epoch ms
  updatedAtText?: string;     // optional human-readable
  updatedBy?: string;
  updateReason?: string;


}
@Injectable({ providedIn: 'root' })
export class OrdersSellingTrackingService {
  private readonly offlineDocService = inject(OfflineDocumentService);

  constructor(
    private firestore: Firestore,
    private productService: ProductService,
    private ledgerService: LedgerService,
    private networkService: NetworkService,
    private indexedDBService: IndexedDBService
  ) {}

  // ---------- Utilities ----------

  private now(): { epoch: number; text: string } {
    const d = new Date();
    return { epoch: d.getTime(), text: this.formatDateForDisplay(d) };
  }

  private formatDateForDisplay(d: Date): string {
    const months = [
      'January','February','March','April','May','June','July','August','September','October','November','December'
    ];
    const month = months[d.getMonth()];
    const day = d.getDate();
    const year = d.getFullYear();

    const tzOffsetMin = -d.getTimezoneOffset();
    const tzSign = tzOffsetMin >= 0 ? '+' : '-';
    const tzHours = Math.floor(Math.abs(tzOffsetMin) / 60);

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

  private sanitizeForFirestore<T extends Record<string, any>>(obj: T): T {
    const out: any = {};
    for (const k of Object.keys(obj || {})) {
      const v = obj[k];
      if (v === undefined) continue;

      // Normalize Date to epoch
      if (v instanceof Date) {
        out[k] = v.getTime();
        continue;
      }

      // Avoid Firestore sentinel maps or complex objects leaking
      if (v && typeof v === 'object' && typeof (v as any).toDate === 'function') {
        try {
          const d = (v as any).toDate();
          out[k] = d instanceof Date ? d.getTime() : v;
        } catch {
          out[k] = v;
        }
        continue;
      }

      out[k] = v;
    }
    return out;
  }

  private buildTrackingBase(partial: Partial<OrdersSellingTrackingDoc>): OrdersSellingTrackingDoc {
    validateOrdersSellingTrackingDoc(partial);
    const t = this.now();
    const createdAt = partial.createdAt ?? t.epoch;
    const updatedAt = partial.updatedAt ?? createdAt;
    // Accept 'processing' as a valid status
    let status: OrdersSellingTrackingDoc['status'] = partial.status ?? 'open';
    if (status !== 'open' && status !== 'completed' && status !== 'cancelled' && status !== 'returned' && status !== 'refunded' && status !== 'damaged' && status !== 'partial_return' && status !== 'partial_refund' && status !== 'partial_damage' && status !== 'recovered') {
      status = 'open';
    }
    return {
      orderId: partial.orderId!,
      productId: partial.productId!,
      price: Number(partial.price ?? 0),
      quantity: Number(partial.quantity ?? 0),
      total: Number(partial.total ?? (Number(partial.price ?? 0) * Number(partial.quantity ?? 0))),
      status,
      invoiceNumber: partial.invoiceNumber,
      createdAt,
      createdAtText: partial.createdAtText ?? this.formatDateForDisplay(new Date(createdAt)),
      updatedAt,
      updatedAtText: partial.updatedAtText ?? this.formatDateForDisplay(new Date(updatedAt)),
      companyId: partial.companyId,
      storeId: partial.storeId,
      batchNumber: partial.batchNumber ?? 1,
      itemIndex: partial.itemIndex ?? 0,
      orderDetailsId: partial.orderDetailsId,
      productName: partial.productName,
      productCode: partial.productCode,
      sku: partial.sku,
      uid: partial.uid,
      cashierId: partial.cashierId,
      createdBy: partial.createdBy ?? 'system',
      updatedBy: partial.updatedBy ?? partial.createdBy ?? 'system',
      updateReason: partial.updateReason
    };
  }

  // ---------- Debug helper ----------

  async logSaleAndAdjustStock(trackingInfo: any, items: any[]): Promise<{ success: boolean; errors: any[] }> {
    console.log('[ordersSellingTracking] ⭐ logSaleAndAdjustStock called:', { trackingInfo, items });
    const errors: any[] = [];
    let success = true;

    if (!trackingInfo || !items || items.length === 0) {
      console.warn('[ordersSellingTracking] ❌ No items to track:', { trackingInfo, items });
      return { success: false, errors: ['No items to track'] };
    }

    console.log(`[ordersSellingTracking] 📦 Processing ${items.length} items for tracking`);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      console.log(`[ordersSellingTracking] 📝 Item ${i + 1}/${items.length}:`, item);
      
      // Allow explicit status override, default to 'OPEN'
      const status = item.status || trackingInfo.status || 'OPEN';
      console.log(`[ordersSellingTracking] 🏷️ Status for item: ${status}`);
      
      try {
        const base = this.buildTrackingBase({
          ...trackingInfo,
          ...item,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          price: item.unitPrice || item.price,
          total: item.lineTotal || item.total,
          // Populate invoiceNumber from trackingInfo or nested order object if present
          invoiceNumber: trackingInfo?.invoiceNumber ?? trackingInfo?.order?.invoiceNumber,
          status,
          // Ensure createdBy uses cashierId when available to avoid 'system'
          createdBy: trackingInfo?.cashierId ?? trackingInfo?.createdBy
        });
        
        console.log(`[ordersSellingTracking] 🔨 Built tracking base:`, {
          productId: base.productId,
          orderId: base.orderId,
          status: base.status,
          quantity: base.quantity,
          price: base.price
        });

        // Idempotency: skip if an OPEN tracking entry already exists for same orderId+productId+itemIndex
        try {
          const dupQ = query(
            collection(this.firestore, 'ordersSellingTracking'),
            where('orderId', '==', base.orderId),
            where('productId', '==', base.productId),
            where('itemIndex', '==', base.itemIndex ?? 0),
            where('status', '==', base.status?.toString().toLowerCase() === 'open' ? 'open' : base.status)
          );
          const dupSnaps = await getDocs(dupQ as any);
          if (dupSnaps && !dupSnaps.empty) {
            console.log(`[ordersSellingTracking] ⏭️ Skipping duplicate tracking for orderId=${base.orderId}, productId=${base.productId}, itemIndex=${base.itemIndex}`);
          } else {
            if (this.networkService.isOnline()) {
              const colRef = collection(this.firestore, 'ordersSellingTracking');
              const docRef = await addDoc(colRef as any, this.sanitizeForFirestore(base) as any);
              console.log(`[ordersSellingTracking] ✅ Firestore write SUCCESS: docId=${docRef.id}, productId=${base.productId}, orderId=${base.orderId}, status=${base.status}`);
            } else {
              // Before queuing offline, ensure no pending document already represents this tracking
              try {
                const pending = this.offlineDocService.getPendingDocuments();
                const hasPending = pending && pending.some((pd: any) => pd.collectionName === 'ordersSellingTracking' && pd.data && pd.data.orderId === base.orderId && pd.data.productId === base.productId && (pd.data.itemIndex ?? 0) === (base.itemIndex ?? 0) && ((pd.data.status || '').toString().toLowerCase() === (base.status || '').toString().toLowerCase()));
                if (hasPending) {
                  console.log(`[ordersSellingTracking] ⏭️ Skipping queueing duplicate offline tracking for orderId=${base.orderId}, productId=${base.productId}`);
                } else {
                  await this.offlineDocService.createDocument('ordersSellingTracking', this.sanitizeForFirestore(base));
                  console.log(`[ordersSellingTracking] 📴 Queued offline tracking for productId=${base.productId}, orderId=${base.orderId}, status=${base.status}`);
                }
              } catch (pdErr) {
                console.warn('[ordersSellingTracking] ⚠️ Pending-check failed, queuing offline doc anyway:', pdErr);
                await this.offlineDocService.createDocument('ordersSellingTracking', this.sanitizeForFirestore(base));
                console.log(`[ordersSellingTracking] 📴 Queued offline tracking for productId=${base.productId}, orderId=${base.orderId}, status=${base.status}`);
              }
            }
          }
        } catch (dupErr) {
          console.warn('[ordersSellingTracking] ⚠️ Dup-check failed, proceeding to write:', dupErr);
          if (this.networkService.isOnline()) {
            const colRef = collection(this.firestore, 'ordersSellingTracking');
            const docRef = await addDoc(colRef as any, this.sanitizeForFirestore(base) as any);
            console.log(`[ordersSellingTracking] ✅ Firestore write SUCCESS: docId=${docRef.id}, productId=${base.productId}, orderId=${base.orderId}, status=${base.status}`);
          } else {
            await this.offlineDocService.createDocument('ordersSellingTracking', this.sanitizeForFirestore(base));
            console.log(`[ordersSellingTracking] 📴 Queued offline tracking for productId=${base.productId}, orderId=${base.orderId}, status=${base.status}`);
          }
        }
      } catch (e) {
        console.error('[ordersSellingTracking] ❌ Error creating tracking doc:', e);
        console.error('[ordersSellingTracking] ❌ Failed item data:', item);
        console.error('[ordersSellingTracking] ❌ Failed trackingInfo:', trackingInfo);
        errors.push(e);
        success = false;
      }
    }

    console.log(`[ordersSellingTracking] 🏁 Completed: success=${success}, errors=${errors.length}`);
    return { success, errors };
  }

  // ---------- Status transitions ----------

  async markOrderTrackingCompleted(orderId: string, completedBy?: string): Promise<{ updated: number; errors: any[] }> {
    const errors: any[] = [];
    let updated = 0;

    try {
      // Query for ALL tracking docs for this order (regardless of current status)
      const q = query(collection(this.firestore, 'ordersSellingTracking'), where('orderId', '==', orderId));
      const snaps = await getDocs(q as any);

      // If there are no existing 'completed' rows, create a single completed record
      const hasCompleted = snaps.docs.some(s => (((s.data() as any).status || '') as string).toString().toLowerCase() === 'completed');
      if (!hasCompleted && snaps.docs.length > 0) {
        try {
          // Use the first tracking doc as a template to create one completed row
          const first = snaps.docs[0];
          const d: any = first.data() || {};
          const t = this.now();
          const product = this.productService.getProduct?.(d.productId);
          const newDoc = this.buildTrackingBase({
            companyId: d.companyId,
            storeId: d.storeId,
            orderId: d.orderId,
            batchNumber: d.batchNumber ?? 1,
            itemIndex: d.itemIndex ?? 0,
            orderDetailsId: d.orderDetailsId,
            productId: d.productId,
            productName: d.productName,
            productCode: d.productCode || product?.productCode,
            sku: d.sku || product?.skuId,
            price: d.price,
            quantity: d.quantity,
            total: d.total ?? (Number(d.price) * Number(d.quantity || 0)),
            uid: d.uid || completedBy,
            cashierId: d.cashierId || completedBy,
            status: 'completed',
            createdAt: t.epoch,
            createdAtText: t.text,
            createdBy: completedBy || d.updatedBy || d.createdBy || 'system',
            updatedAt: t.epoch,
            updatedAtText: t.text,
            updatedBy: completedBy || d.updatedBy || d.createdBy || 'system'
          });

          if (this.networkService.isOnline()) {
            const colRef = collection(this.firestore, 'ordersSellingTracking');
            await addDoc(colRef as any, this.sanitizeForFirestore(newDoc) as any);
          } else {
            await this.offlineDocService.createDocument('ordersSellingTracking', this.sanitizeForFirestore(newDoc));
          }
          updated++;
        } catch (e) {
          errors.push({ id: 'create_completed', error: e });
        }
      }

      for (const s of snaps.docs) {
        const id = s.id;
        const data: any = s.data() || {};
        const currentStatus = (data.status || '').toString().toLowerCase();
        
        // Skip if already completed or in a terminal status that shouldn't be changed
        if (currentStatus === 'completed' || currentStatus === 'refunded' || currentStatus === 'damaged' || currentStatus === 'recovered') {
          continue;
        }

        const createdAt = this.normalizeEpoch(data.createdAt);
        const updates: Partial<OrdersSellingTrackingDoc> = {
          status: 'completed',
          updatedBy: completedBy || data.createdBy || 'system',
          updatedAt: createdAt,
          updatedAtText: this.formatDateForDisplay(new Date(createdAt))
        };

        try {
          const ref = doc(this.firestore, 'ordersSellingTracking', id);
          await setDoc(ref as any, this.sanitizeForFirestore(updates), { merge: true } as any);
          updated++;
        } catch (e) {
          console.warn('⚠️ Update failed, Firestore will retry when online:', e);
          errors.push({ id, error: e });
        }
      }
    } catch (e) {
      errors.push({ id: 'query', error: e });
    }

    // Mirror pending queue
    try {
      const pending = await this.offlineDocService.getPendingDocuments();
      for (const pd of pending) {
        try {
          if (pd.collectionName === 'ordersSellingTracking' && pd.data?.orderId === orderId) {
            const currentStatus = (pd.data?.status || '').toString().toLowerCase();
            
            // Skip if already completed or in a terminal status
            if (currentStatus === 'completed' || currentStatus === 'refunded' || currentStatus === 'damaged' || currentStatus === 'recovered') {
              continue;
            }

            const createdAt = this.normalizeEpoch(pd.data.createdAt);
            await this.offlineDocService.updateDocument('ordersSellingTracking', pd.id, {
              status: 'completed',
              updatedBy: completedBy || pd.data.createdBy || 'system',
              updatedAt: createdAt,
              updatedAtText: this.formatDateForDisplay(new Date(createdAt))
            });
            updated++;
          }
        } catch (e) {
          errors.push({ id: pd.id, error: e });
        }
      }
    } catch (e) {
      errors.push({ id: 'pending-check', error: e });
    }

    try {
      await this.alignUpdatedAtToCreatedAtForOrder(orderId);
    } catch (e) {
      console.warn('markOrderTrackingCompleted: alignUpdatedAtToCreatedAtForOrder failed', e);
    }

    return { updated, errors };
  }

  async markOrderTrackingCancelled(orderId: string, cancelledBy?: string, reason?: string): Promise<{ updated: number; errors: any[] }> {
    const errors: any[] = [];
    let updated = 0;

    try {
      const q = query(collection(this.firestore, 'ordersSellingTracking'), where('orderId', '==', orderId));
      const snaps = await getDocs(q as any);

      for (const s of snaps.docs) {
        const id = s.id;
        const data: any = s.data() || {};
        if ((data.status || '').toString().toLowerCase() === 'cancelled') continue;

        const t = this.now();
        const updates: Partial<OrdersSellingTrackingDoc> = {
          status: 'cancelled',
          updatedBy: cancelledBy || data.updatedBy || data.createdBy || 'system',
          updatedAt: t.epoch,
          updatedAtText: t.text,
          updateReason: reason
        };

        try {
          const ref = doc(this.firestore, 'ordersSellingTracking', id);
          await setDoc(ref as any, this.sanitizeForFirestore(updates), { merge: true } as any);
          updated++;
        } catch (e) {
          console.warn('⚠️ Update failed, Firestore will retry when online:', e);
          errors.push({ id, error: e });
        }
      }
    } catch (e) {
      errors.push({ id: 'query', error: e });
    }

    // Mirror pending queue
    try {
      const pending = await this.offlineDocService.getPendingDocuments();
      for (const pd of pending) {
        try {
          if (pd.collectionName === 'ordersSellingTracking' && pd.data?.orderId === orderId && pd.data?.status !== 'cancelled') {
            const t = this.now();
            await this.offlineDocService.updateDocument('ordersSellingTracking', pd.id, {
              status: 'cancelled',
              updatedBy: cancelledBy || pd.data.updatedBy || pd.data.createdBy || 'system',
              updatedAt: t.epoch,
              updatedAtText: t.text,
              updateReason: reason
            });
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

      if (!snaps || snaps.empty) {
        const partial = await this.createPartialTrackingFromOrderDoc(orderId, 'returned', returnedBy, reason);
        updated += partial.created;
        if (partial.errors?.length) errors.push(...partial.errors);
      }

      for (const s of snaps.docs) {
        const id = s.id;
        const data: any = s.data() || {};
        const status = (data.status || '').toString().toLowerCase();
        if (status === 'returned') continue;

        const t = this.now();
        const product = this.productService.getProduct?.(data.productId);
        const newDoc = this.buildTrackingBase({
          companyId: data.companyId,
          storeId: data.storeId,
          orderId,
          batchNumber: data.batchNumber ?? 1,
          itemIndex: data.itemIndex ?? 0,
          orderDetailsId: data.orderDetailsId,
          productId: data.productId,
          productName: data.productName,
          productCode: data.productCode || product?.productCode,
          sku: data.sku || product?.skuId,
          price: data.price,
          quantity: data.quantity,
          total: data.total,
          uid: data.uid || data.createdBy,
          cashierId: data.cashierId || data.createdBy,
          status: 'returned',
          createdAt: t.epoch,
          createdAtText: t.text,
          createdBy: returnedBy || data.updatedBy || data.createdBy || 'system',
          updatedAt: t.epoch,
          updatedAtText: t.text,
          updatedBy: returnedBy || data.updatedBy || data.createdBy || 'system',
          updateReason: reason
        });

        try {
          const existing = snaps.docs.find(d => {
            const dd: any = d.data() || {};
            return (dd.orderDetailsId === newDoc.orderDetailsId) && ((dd.status || '').toString().toLowerCase() === 'returned');
          });

          if (existing) {
            const existingRef = doc(this.firestore, 'ordersSellingTracking', existing.id);
            const upd: Partial<OrdersSellingTrackingDoc> = {
              quantity: newDoc.quantity,
              total: newDoc.total,
              updatedAt: newDoc.updatedAt,
              updatedAtText: newDoc.updatedAtText,
              updatedBy: newDoc.updatedBy,
              status: 'returned',
              updateReason: reason
            };
            await setDoc(existingRef as any, this.sanitizeForFirestore(upd), { merge: true } as any);
            updated++;
          } else {
            if (this.networkService.isOnline()) {
              const colRef = collection(this.firestore, 'ordersSellingTracking');
              await addDoc(colRef as any, this.sanitizeForFirestore(newDoc) as any);
            } else {
              await this.offlineDocService.createDocument('ordersSellingTracking', this.sanitizeForFirestore(newDoc));
            }
            updated++;
          }
        } catch (e) {
          console.error(`markOrderTrackingReturned: failed for ${id}`, e);
          errors.push({ id, error: (e as any)?.message ?? String(e) });
        }
      }
    } catch (e) {
      errors.push({ id: 'query', error: e });
    }

    // Mirror pending queue
    try {
      const pending = await this.offlineDocService.getPendingDocuments();
      for (const pd of pending) {
        try {
          if (pd.collectionName === 'ordersSellingTracking' && pd.data?.orderId === orderId && pd.data?.status !== 'returned') {
            const t = this.now();
            await this.offlineDocService.updateDocument('ordersSellingTracking', pd.id, {
              status: 'returned',
              updatedBy: returnedBy || pd.data.updatedBy || pd.data.createdBy || 'system',
              updatedAt: t.epoch,
              updatedAtText: t.text,
              updateReason: reason
            });
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
    const q = query(collection(this.firestore, 'ordersSellingTracking'), where('orderId', '==', orderId));
    const snaps = await getDocs(q as any);

    for (const s of snaps.docs) {
      const data: any = s.data() || {};
      const t = this.now();
      const newDoc = this.buildTrackingBase({
        ...data,
        orderId,
        status: 'refunded',
        createdAt: t.epoch,
        createdAtText: t.text,
        createdBy: refundedBy || data.createdBy || 'system',
        updatedAt: t.epoch,
        updatedAtText: t.text,
        updatedBy: refundedBy || data.updatedBy || 'system',
        updateReason: reason
      });

      try {
        const ref = doc(this.firestore, 'ordersSellingTracking', s.id);
        await setDoc(ref as any, this.sanitizeForFirestore(newDoc), { merge: true } as any);
        created++;
        createdIds.push(s.id);
      } catch (e) {
        errors.push({ id: s.id, error: e });
      }
    }
  } catch (e) {
    errors.push({ id: 'query', error: e });
  }

  return { created, errors, createdIds };
}

  async markOrderTrackingDamaged(orderId: string, damagedBy?: string, reason?: string): Promise<{ created: number; errors: any[] }> {
    const errors: any[] = [];
    let created = 0;

    try {
      const partial = await this.createPartialTrackingFromOrderDoc(orderId, 'damaged', damagedBy, reason);
      created += partial.created;
      if (partial.errors?.length) errors.push(...partial.errors);
    } catch (e) {
      errors.push({ id: 'damage-creation', error: e });
    }

    return { created, errors };
  }

  async markOrderTrackingRecovered(orderId: string, recoveredBy?: string, reason?: string): Promise<{ created: number; errors: any[] }> {
    const errors: any[] = [];
    let created = 0;

    try {
      const q = query(collection(this.firestore, 'ordersSellingTracking'), where('orderId', '==', orderId));
      const snaps = await getDocs(q as any);

      for (const s of snaps.docs) {
        const id = s.id;
        const data: any = s.data() || {};
        if ((data.status || '').toString().toLowerCase() === 'recovered') continue;

        const t = this.now();
        const updates: Partial<OrdersSellingTrackingDoc> = {
          status: 'recovered',
          updatedBy: recoveredBy || data.updatedBy || data.createdBy || 'system',
          updatedAt: t.epoch,
          updatedAtText: t.text,
          updateReason: reason
        };

        try {
          const ref = doc(this.firestore, 'ordersSellingTracking', id);
          await setDoc(ref as any, this.sanitizeForFirestore(updates), { merge: true } as any);
          created++;
        } catch (e) {
          console.warn('⚠️ Update failed, Firestore will retry when online:', e);
          errors.push({ id, error: e });
        }
      }
    } catch (e) {
      errors.push({ id: 'query', error: e });
    }

    return { created, errors };
  }

  async createUnpaidTrackingFromOrder(
    orderId: string,
    companyId: string,
    storeId: string,
    trackingItems: Array<{ productId: string; quantity: number; price: number }>,
    createdBy?: string,
    reason?: string
  ): Promise<{ created: number; errors: any[] }> {
    const errors: any[] = [];
    let created = 0;

    try {
      const t = this.now();

      for (const item of trackingItems) {
        try {
          const newDoc = this.buildTrackingBase({
            companyId,
            storeId,
            orderId,
            productId: item.productId,
            price: item.price,
            quantity: item.quantity,
            total: item.price * item.quantity,
            status: 'open',
            createdAt: t.epoch,
            createdAtText: t.text,
            createdBy: createdBy || 'system',
            updatedAt: t.epoch,
            updatedAtText: t.text,
            updatedBy: createdBy || 'system',
            updateReason: reason
          });

          if (this.networkService.isOnline()) {
            const colRef = collection(this.firestore, 'ordersSellingTracking');
            await addDoc(colRef as any, this.sanitizeForFirestore(newDoc) as any);
          } else {
            await this.offlineDocService.createDocument('ordersSellingTracking', this.sanitizeForFirestore(newDoc));
          }
          created++;
        } catch (ie) {
          errors.push({ productId: item.productId, error: ie });
        }
      }
    } catch (e) {
      errors.push({ id: 'unpaid-tracking', error: e });
    }

    return { created, errors };
  }

  // ---------- Alignment ----------

  private async alignUpdatedAtToCreatedAtForOrder(orderId: string): Promise<void> {
    try {
      const q = query(collection(this.firestore, 'ordersSellingTracking'), where('orderId', '==', orderId));
      const snaps = await getDocs(q as any);
      for (const s of snaps.docs) {
        const data: any = s.data() || {};
        const createdAt = this.normalizeEpoch(data.createdAt);
        const updatedAt = this.normalizeEpochOrNull(data.updatedAt);

        const needsAlign = !updatedAt || this.looksLikeSentinel(data.updatedAt);
        if (createdAt && needsAlign) {
          try {
            const ref = doc(this.firestore, 'ordersSellingTracking', s.id);
            await setDoc(ref as any, this.sanitizeForFirestore({
              updatedAt: createdAt,
              updatedAtText: this.formatDateForDisplay(new Date(createdAt))
            }), { merge: true } as any);
          } catch (e) {
            console.warn('alignUpdatedAtToCreatedAtForOrder: failed for', s.id, e);
          }
        }
      }
    } catch (e) {
      console.error('alignUpdatedAtToCreatedAtForOrder failed', e);
    }
  }

  private looksLikeSentinel(v: any): boolean {
    return v && typeof v === 'object' && (v._methodName === 'serverTimestamp' || v._methodName === 'ServerTimestamp');
  }

  private normalizeEpoch(v: any): number {
    if (v instanceof Date) return v.getTime();
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const d = new Date(v);
      const t = d.getTime();
      return isNaN(t) ? Date.now() : t;
    }
    if (v && typeof v.toDate === 'function') {
      try { return v.toDate().getTime(); } catch { return Date.now(); }
    }
    return Date.now();
  }

  private normalizeEpochOrNull(v: any): number | null {
    if (!v && v !== 0) return null;
    return this.normalizeEpoch(v);
  }

  // ---------- Partial creation helpers ----------
async createPartialTrackingFromOrderDoc(
  trackingId: string,
  newStatus: OrdersSellingTrackingDoc['status'],
  createdBy?: string,
  reason?: string
): Promise<{ created: number; errors: any[] }> {
  const errors: any[] = [];
  let created = 0;

  try {
    let data: any = null;
    const ref = doc(this.firestore, 'ordersSellingTracking', trackingId);
    const snap = await getDoc(ref as any);
    if (snap?.exists()) {
      data = snap.data() || {};
    } else {
      const pending = await this.offlineDocService.getPendingDocuments();
      const pd = pending.find(p => p.collectionName === 'ordersSellingTracking' && p.id === trackingId);
      data = pd?.data || null;
    }

    if (!data) return { created, errors };

    const d = data;
    const t = this.now();
    const product = this.productService.getProduct?.(d.productId);
    const newDoc = this.buildTrackingBase({
      ...d,
      quantity: d.quantity ?? 0,
      total: Number(d.price) * Number(d.quantity ?? 0),
      uid: d.uid || createdBy,
      cashierId: d.cashierId || createdBy,
      status: newStatus,
      createdAt: t.epoch,
      createdAtText: t.text,
      createdBy: createdBy || d.updatedBy || d.createdBy || 'system',
      updatedAt: t.epoch,
      updatedAtText: t.text,
      updatedBy: createdBy || d.updatedBy || d.createdBy || 'system',
      updateReason: reason
    });

    if (this.networkService.isOnline()) {
      const colRef = collection(this.firestore, 'ordersSellingTracking');
      await addDoc(colRef as any, this.sanitizeForFirestore(newDoc));
    } else {
      await this.offlineDocService.createDocument('ordersSellingTracking', this.sanitizeForFirestore(newDoc));
    }
    created++;
  } catch (e) {
    errors.push({ id: trackingId, error: e });
  }

  return { created, errors };
}

  async createPartialTrackingFromDoc(
    trackingId: string,
    newStatus: OrdersSellingTrackingDoc['status'],
    qty: number,
    createdBy?: string
  ): Promise<{ created: number; errors: any[] }> {
    const errors: any[] = [];
    let created = 0;
    try {
      const ref = doc(this.firestore, 'ordersSellingTracking', trackingId);
      const snap = await getDoc(ref as any);
      let data: any = null;
      if (snap && typeof snap.exists === 'function' && snap.exists()) {
        data = snap.data() || {};
      } else {
        // Fallback to pending queue
        const pending = await this.offlineDocService.getPendingDocuments();
        const pd = pending.find((p: any) => p.collectionName === 'ordersSellingTracking' && p.id === trackingId);
        data = pd?.data || null;
      }
      if (!data) {
        return { created, errors: [{ id: trackingId, error: 'Tracking not found' }] };
      }
      const d = data;
      const t = this.now();
      const product = this.productService.getProduct?.(d.productId);
      const newDoc = this.buildTrackingBase({
        companyId: d.companyId,
        storeId: d.storeId,
        orderId: d.orderId,
        batchNumber: d.batchNumber ?? 1,
        itemIndex: d.itemIndex ?? 0,
        orderDetailsId: d.orderDetailsId,
        productId: d.productId,
        productName: d.productName,
        productCode: d.productCode || product?.productCode,
        sku: d.sku || product?.skuId,
        price: d.price,
        quantity: qty,
        total: Number(d.price) * Number(qty),
        uid: d.uid || createdBy,
        cashierId: d.cashierId || createdBy,
        status: newStatus,
        createdAt: t.epoch,
        createdAtText: t.text,
        createdBy: createdBy || d.updatedBy || d.createdBy || 'system',
        updatedAt: t.epoch,
        updatedAtText: t.text,
        updatedBy: createdBy || d.updatedBy || d.createdBy || 'system'
      });
      // Idempotency: check if a partial row for same orderDetailsId + status exists
      const qDup = query(
        collection(this.firestore, 'ordersSellingTracking'),
        where('orderId', '==', newDoc.orderId),
        where('orderDetailsId', '==', newDoc.orderDetailsId),
        where('status', '==', newStatus)
      );
      const dupSnaps = await getDocs(qDup as any);
      const hasDup = dupSnaps && !dupSnaps.empty;
      if (hasDup) {
        const existing = dupSnaps.docs[0];
        const existingRef = doc(this.firestore, 'ordersSellingTracking', existing.id);
        await setDoc(existingRef as any, this.sanitizeForFirestore({
          quantity: newDoc.quantity,
          total: newDoc.total,
          updatedAt: newDoc.updatedAt,
          updatedAtText: newDoc.updatedAtText,
          updatedBy: newDoc.updatedBy
        }), { merge: true } as any);
        created++;
      } else {
        if (this.networkService.isOnline()) {
          const colRef = collection(this.firestore, 'ordersSellingTracking');
          await addDoc(colRef as any, this.sanitizeForFirestore(newDoc) as any);
        } else {
          await this.offlineDocService.createDocument('ordersSellingTracking', this.sanitizeForFirestore(newDoc));
        }
        created++;
      }
      // Optional: inventory adjustments for damage flows
      if (newStatus === 'partial_damage' || newStatus === 'damaged') {
        // Hook your productService / ledgerService here for stock adjustments and audit entries
        // await this.productService.adjustStock(data.productId, -qty, 'damage', { orderId: data.orderId });
        // await this.ledgerService.recordInventoryEvent(...);
      }
    } catch (e) {
      errors.push({ id: trackingId, error: e });
    }
    return { created, errors };
  }

  // Returns a map of productId to count of appearances in tracking entries for a company/store/date
  async getTopProductsCounts(
    companyId: string,
    storeId: string,
    limitCount: number = 10,
    queryDate?: number
  ): Promise<{ [productId: string]: number }> {
    const counts: { [productId: string]: number } = {};
    try {
      const colRef = collection(this.firestore, 'ordersSellingTracking');
      const constraints = [
        where('companyId', '==', companyId),
        where('storeId', '==', storeId)
      ];
      if (queryDate) {
        // Assume queryDate is epoch ms for a single day; filter by createdAt >= start, < end
        const start = queryDate;
        const end = start + 24 * 60 * 60 * 1000;
        constraints.push(where('createdAt', '>=', start));
        constraints.push(where('createdAt', '<', end));
      }
      const q = query(colRef, ...constraints);
      const snaps = await getDocs(q as any);
      let productEntries: [string, number][] = [];
      for (const docSnap of snaps.docs) {
        const data = docSnap.data() as OrdersSellingTrackingDoc;
        if (!data.productId) continue;
        counts[data.productId] = (counts[data.productId] || 0) + 1;
      }
      // Sort and limit early for pagination efficiency
      productEntries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      if (productEntries.length > limitCount) {
        productEntries = productEntries.slice(0, limitCount);
      }
      const result: { [productId: string]: number } = {};
      for (const [pid, count] of productEntries) result[pid] = count;
      return result;
    } catch (e) {
      console.error('getTopProductsCounts failed:', e);
      return {};
    }
  }

  // Fetch all tracking entries for a specific order
  async fetchTrackingEntries(orderId: string): Promise<OrdersSellingTrackingDoc[]> {
    try {
      const q = query(
        collection(this.firestore, 'ordersSellingTracking'),
        where('orderId', '==', orderId)
      );
      const snaps = await getDocs(q as any);
      const entries: OrdersSellingTrackingDoc[] = [];
      for (const docSnap of snaps.docs) {
        const data = docSnap.data() as OrdersSellingTrackingDoc;
        entries.push({ ...data, id: docSnap.id });
      }
      return entries;
    } catch (e) {
      console.error('fetchTrackingEntries failed:', e);
      return [];
    }
  }

}
