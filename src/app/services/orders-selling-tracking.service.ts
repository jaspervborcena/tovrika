import { Injectable, inject } from '@angular/core';
import { Firestore, collection, query, where } from '@angular/fire/firestore';
import { getDocs, doc, setDoc, serverTimestamp, runTransaction, orderBy, limit } from 'firebase/firestore';
import { toDateValue } from '../core/utils/date-utils';
import { OfflineDocumentService } from '../core/services/offline-document.service';
import { OrdersSellingTrackingDoc } from '../interfaces/orders-selling-tracking.interface';
import { ProductService } from './product.service';

@Injectable({ providedIn: 'root' })
export class OrdersSellingTrackingService {
  private readonly offlineDocService = inject(OfflineDocumentService);
  // Helper to remove undefined fields because Firestore rejects undefined values
  private sanitizeForFirestore(obj: any): any {
    const out: any = {};
    for (const k of Object.keys(obj || {})) {
      const v = obj[k];
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  constructor(
    private firestore: Firestore,
    private productService: ProductService
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
          // If we have a concrete createdAt and we are online and the doc ID is not a temp id,
          // write updatedAt equal to createdAt so both timestamps match (avoids serverTimestamp map in the field).
          if (navigator.onLine && !id.startsWith('temp_') && (createdAt instanceof Date || typeof createdAt === 'string' || typeof createdAt === 'number')) {
            updates.updatedAt = createdAt;
            const ref = doc(this.firestore, 'ordersSellingTracking', id);
            // Use setDoc with merge to avoid overriding other fields
            await setDoc(ref as any, updates as any, { merge: true } as any);
          } else {
            // Fallback: use offlineDocService.updateDocument which will handle offline queuing and timestamps
            await this.offlineDocService.updateDocument('ordersSellingTracking', id, updates);
          }
          updated++;
        } catch (e) {
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

    return { updated, errors };
  }

  /**
   * Mark all ordersSellingTracking docs for a given orderId as 'cancelled'.
   * This updates both online documents and any pending offline queued docs.
   */
  async markOrderTrackingCancelled(orderId: string, cancelledBy?: string): Promise<{ updated: number; errors: any[] }> {
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

        try {
          if (navigator.onLine && !id.startsWith('temp_')) {
            const ref = doc(this.firestore, 'ordersSellingTracking', id);
            await setDoc(ref as any, updates as any, { merge: true } as any);
          } else {
            await this.offlineDocService.updateDocument('ordersSellingTracking', id, updates);
          }
          updated++;
        } catch (e) {
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
            await this.offlineDocService.updateDocument('ordersSellingTracking', pd.id, { status: 'cancelled', updatedBy: cancelledBy || pd.data.createdBy || 'system' });
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

  async markOrderTrackingReturned(orderId: string, returnedBy?: string): Promise<{ updated: number; errors: any[] }> {
  const errors: any[] = [];
  let updated = 0;
  try {
    const q = query(collection(this.firestore, 'ordersSellingTracking'), where('orderId', '==', orderId));
    const snaps = await getDocs(q as any);
    for (const s of snaps.docs) {
      const id = s.id;
      const data: any = s.data() || {};
      // If already returned, skip
      if (data.status === 'returned') continue;

      // Build a copy of the existing record but mark it as 'returned'.
      const onlineCreatedAt = serverTimestamp();
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
        status: 'returned',
        createdAt: navigator.onLine ? onlineCreatedAt : offlineCreatedAt,
        createdBy: returnedBy || data.updatedBy || data.createdBy || 'system',
        updatedAt: navigator.onLine ? onlineCreatedAt : offlineCreatedAt,
        updatedBy: returnedBy || data.updatedBy || data.createdBy || 'system'
      };

      try {
        if (navigator.onLine && !id.startsWith('temp_')) {
          const colRef = collection(this.firestore, 'ordersSellingTracking');
          const ref = doc(colRef as any);
          const payload = this.sanitizeForFirestore(newDoc);
          console.log(`markOrderTrackingReturned: creating returned copy for tracking=${id} -> newId=${ref.id}`);
          await setDoc(ref as any, payload as any);
          updated++;
        } else {
          // Offline: queue a new pending document rather than updating the existing one
          const payload = this.sanitizeForFirestore(newDoc);
          console.log(`markOrderTrackingReturned: queueing offline returned copy for pendingId=${id}`);
          await this.offlineDocService.createDocument('ordersSellingTracking', payload as any);
          updated++;
        }
      } catch (e) {
        console.error(`markOrderTrackingReturned: failed to create returned copy for ${id}`, e);
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
          await this.offlineDocService.updateDocument(
            'ordersSellingTracking',
            pd.id,
            { status: 'returned', updatedBy: returnedBy || pd.data.createdBy || 'system' }
          );
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

async markOrderTrackingRefunded(orderId: string, refundedBy?: string): Promise<{ created: number; errors: any[]; createdIds?: string[] }> {
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

      // Prepare timestamps appropriate for online vs offline storage
      const onlineCreatedAt = serverTimestamp();
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
        price: data.price,
        quantity: data.quantity,
        total: data.total,
        uid: data.uid || data.createdBy || undefined,
        cashierId: data.cashierId || data.createdBy || undefined,
        status: 'refunded',
        createdAt: navigator.onLine ? onlineCreatedAt : offlineCreatedAt,
        createdBy: refundedBy || data.updatedBy || data.createdBy || 'system',
        updatedAt: navigator.onLine ? onlineCreatedAt : offlineCreatedAt,
        updatedBy: refundedBy || data.updatedBy || data.createdBy || 'system'
      };

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

  console.log(`Refund process completed for order ${orderId}: created=${created}, createdIds=${JSON.stringify(createdIds)}, errors=${errors.length}`);
  return { created, errors, createdIds };
}

/**
 * Create 'damaged' tracking records based on existing returned rows.
 * This does NOT modify the original docs; it creates new docs with status 'damaged'.
 */
async markOrderTrackingDamaged(orderId: string, damagedBy?: string): Promise<{ created: number; errors: any[]; createdIds?: string[] }> {
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

      const onlineCreatedAt = serverTimestamp();
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
        createdAt: navigator.onLine ? onlineCreatedAt : offlineCreatedAt,
        createdBy: damagedBy || data.updatedBy || data.createdBy || 'system',
        updatedAt: navigator.onLine ? onlineCreatedAt : offlineCreatedAt,
        updatedBy: damagedBy || data.updatedBy || data.createdBy || 'system'
      };

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

  console.log(`Damage process completed for order ${orderId}: created=${created}, createdIds=${JSON.stringify(createdIds)}, errors=${errors.length}`);
  return { created, errors, createdIds };
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
      const docData: OrdersSellingTrackingDoc = {
        companyId: ctx.companyId,
        storeId: ctx.storeId,
        orderId: ctx.orderId,
        // Use provided invoiceNumber where available
        // batchNumber defaults to 1 for now (can be set by caller)
        batchNumber: (it as any).batchNumber || 1,
        createdAt: new Date(),
        createdBy: ctx.cashierId,
        uid: ctx.cashierId,
        status: 'processing',

        // item details
        itemIndex: idx,
        orderDetailsId: (it as any).orderDetailsId || undefined,
        productId: it.productId,
        productName: it.productName,
        price: it.unitPrice,
        quantity: it.quantity,
        // Defaults for fields not provided by caller
        discount: (it as any).discount ?? 0,
        discountType: (it as any).discountType ?? 'none',
        vat: (it as any).vat ?? 0,
        total: it.lineTotal,
        isVatExempt: !!((it as any).isVatExempt),

        // legacy cashier info
        cashierId: ctx.cashierId,
        cashierEmail: ctx.cashierEmail,
        cashierName: ctx.cashierName
      } as OrdersSellingTrackingDoc;

      try {
        await this.offlineDocService.createDocument(colName, docData as any);
        tracked++;
      } catch (e) {
        errors.push({ productId: it.productId, error: e });
      }

      idx++;

      // Apply delta to product totalStock immediately (optimistic)
      try {
        const product = this.productService.getProduct(it.productId);
        const current = product?.totalStock ?? 0;
        const newTotal = Math.max(0, current - it.quantity);
        try {
          await this.productService.updateProduct(it.productId, {
            totalStock: newTotal,
            lastUpdated: new Date()
          } as any);

          console.log(`✅ Adjusted product ${it.productId} stock: ${current} -> ${newTotal}`);
          adjusted++;
        } catch (updateErr) {
          console.error(`⚠️ Failed to update product ${it.productId} totalStock. current=${current} calculatedNew=${newTotal}`, updateErr);
          errors.push({ productId: it.productId, error: updateErr });
        }
      } catch (e) {
        errors.push({ productId: it.productId, error: e });
      }
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
}
