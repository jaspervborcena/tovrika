import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

type TrackingDoc = {
  id: string;
  companyId: string;
  storeId: string;
  orderId: string;
  productId: string;
  productName?: string;
  quantity: number;
  unitPrice?: number;
  lineTotal?: number;
  status: 'pending' | 'reconciled' | 'error';
  createdAt?: any;
};

type BatchEntry = {
  id: string;
  productId: string;
  quantity: number;
  status: 'active' | 'inactive' | 'removed';
  receivedAt: any;
};

async function recomputeProductSummary(productId: string) {
  const db = admin.firestore();
  const invSnap: any = await db
    .collection('productInventory')
    .where('productId', '==', productId)
    .get();
  const active = invSnap.docs
    .map((d: any) => ({ id: d.id, ...(d.data() as any) }))
    .filter((b: any) => b.status === 'active');
  const totalStock = active.reduce((s: number, b: any) => s + (Number(b.quantity) || 0), 0);
  // Latest batch by receivedAt desc
  const latest = active
    .sort((a: any, b: any) => new Date(b.receivedAt?.toDate?.() || b.receivedAt).getTime() - new Date(a.receivedAt?.toDate?.() || a.receivedAt).getTime())[0];
  const sellingPrice = latest ? Number(latest.unitPrice || 0) : 0;
  await db.collection('products').doc(productId).set({ totalStock, sellingPrice, lastUpdated: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
}

async function reconcileOneTracking(doc: TrackingDoc) {
  const db = admin.firestore();
  const logCol = db.collection('reconciliationLog');
  const invCol = db.collection('productInventory');

  // Use a transaction for atomic FIFO updates per tracking doc
  return db.runTransaction(async (tx: any) => {
    const tRef = db.collection('ordersSellingTracking').doc(doc.id);
    const tSnap = await tx.get(tRef);
    if (!tSnap.exists) return; // already removed?
    const tData = tSnap.data() as any;
    if (tData.status && tData.status !== 'pending') {
      return; // idempotent: already reconciled/errored
    }

    let remaining = Number(doc.quantity) || 0;
    if (remaining <= 0) {
      tx.update(tRef, { status: 'reconciled', reconciledAt: admin.firestore.FieldValue.serverTimestamp() });
      return;
    }

    // Load active batches oldest first
    const batchQuery: any = await invCol
      .where('productId', '==', doc.productId)
      .where('status', '==', 'active')
      .orderBy('receivedAt', 'asc')
      .get();

    const batches = batchQuery.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) })) as BatchEntry[];
    if (batches.length === 0) {
      // No inventory to deduct
      tx.update(tRef, { status: 'error', error: 'no-inventory', reconciledAt: admin.firestore.FieldValue.serverTimestamp() });
      return;
    }

    const deductions: Array<{ batchId: string; quantity: number }> = [];
    for (const b of batches) {
      if (remaining <= 0) break;
      const avail = Number((b as any).quantity) || 0;
      if (avail <= 0) continue;
      const use = Math.min(remaining, avail);
      const newQty = avail - use;
      deductions.push({ batchId: (b as any).batchId || b.id, quantity: use });
      const bRef = invCol.doc(b.id);
      const update: any = { quantity: newQty, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
      if (newQty === 0) update.status = 'inactive';
      tx.update(bRef, update);
      remaining -= use;
    }

    // Write reconciliation log
    const logData = {
      trackingId: doc.id,
      companyId: doc.companyId,
      storeId: doc.storeId,
      orderId: doc.orderId,
      productId: doc.productId,
      quantityProcessed: Number(doc.quantity) - remaining,
      batchesUsed: deductions,
      action: remaining === 0 ? 'deduct' : 'partial',
      message: remaining === 0 ? 'Reconciled successfully' : `Only partially reconciled; remaining ${remaining}`,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    } as any;
    tx.set(logCol.doc(), logData, { merge: false });

    // Update tracking status
    tx.update(tRef, { status: remaining === 0 ? 'reconciled' : 'error', reconciledAt: admin.firestore.FieldValue.serverTimestamp(), remaining });
  });
}

async function reconcilePending(opts: { companyId?: string; storeId?: string; limit?: number } = {}) {
  const db = admin.firestore();
  let q: any = db.collection('ordersSellingTracking').where('status', '==', 'pending');
  if (opts.companyId) q = q.where('companyId', '==', opts.companyId);
  if (opts.storeId) q = q.where('storeId', '==', opts.storeId);
  if (opts.limit) q = q.limit(opts.limit);
  const snap = await q.get();
  const docs = snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) })) as TrackingDoc[];
  for (const d of docs) {
    try {
      await reconcileOneTracking(d);
      // Recompute product summary after each tracking doc for accuracy
      await recomputeProductSummary(d.productId);
    } catch (e) {
      console.error('[reconcilePending] Error', d.id, e);
      try {
        await db.collection('ordersSellingTracking').doc(d.id).set({ status: 'error', error: String((e as any)?.message || e) }, { merge: true });
      } catch {}
    }
  }
  return { processed: docs.length };
}

export const reconcileDaily = functions
  .region('asia-east1')
  .pubsub.schedule('0 2 * * *')
  .timeZone('Asia/Manila')
  .onRun(async (_context: any) => {
    console.log('[reconcileDaily] Starting scheduled reconciliation job', new Date().toISOString());
    const res = await reconcilePending({ limit: 500 });
    console.log('[reconcileDaily] Completed', res);
    return null;
  });

export const reconcileOnDemand = functions
  .region('asia-east1')
  .https.onCall(async (data: any, _context: any) => {
    const { companyId, storeId, limit } = data || {};
    if (!companyId && !storeId) {
      throw new functions.https.HttpsError('invalid-argument', 'Provide companyId or storeId to scope reconciliation.');
    }
    const res = await reconcilePending({ companyId, storeId, limit: limit || 200 });
    return { status: 'ok', ...res };
  });
