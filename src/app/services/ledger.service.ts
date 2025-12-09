import { Injectable, inject } from '@angular/core';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  setDoc,
  serverTimestamp,
  Firestore
} from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class LedgerService {
  private firestore = inject(Firestore);

  constructor() {}

  /**
   * Record an accounting ledger event for an order.
   * Creates a new document in `orderAccountingLedger` with running balances
   * computed from the latest ledger entry for the same company/store for today.
   */
  async recordEvent(
  companyId: string,
  storeId: string,
  orderId: string,
  eventType: 'order' | 'return' | 'refund' | 'cancel' | 'damage',
  amount: number,
  qty: number,
  performedBy: string
): Promise<any> {
  try {
    // Query latest ledger entry for this company/store (any eventType)
    const q = query(
      collection(this.firestore, 'orderAccountingLedger'),
      where('companyId', '==', companyId),
      where('storeId', '==', storeId),
      where('eventType', '==', eventType),
      orderBy('createdAtClient', 'desc'),
      limit(1)
    );

    let latestBalanceAmount = 0;
    let latestBalanceQty = 0;
    let latestOrderBalanceQty = 0;

    const snaps = await getDocs(q);
    if (!snaps.empty) {
      const latest = snaps.docs[0].data() as any;
      latestBalanceAmount = Number(latest.runningBalanceAmount || 0);
      latestBalanceQty = Number(latest.runningBalanceQty || 0);
      latestOrderBalanceQty = Number(latest.runningBalanceOrderQty || 0);
    }

    // Always add new values to balances
    const newBalanceAmount = latestBalanceAmount + amount;
    const newBalanceQty = latestBalanceQty + qty;

    // Only add to order-specific balance if eventType is 'order'
    const newOrderBalanceQty =
      latestOrderBalanceQty + (eventType === 'order' ? qty : 0);

    const newDoc = {
      companyId,
      storeId,
      orderId,
      eventType,
      amount,
      quantity: qty,
      runningBalanceAmount: newBalanceAmount,
      runningBalanceQty: newBalanceQty,
      runningBalanceOrderQty: newOrderBalanceQty,
      createdAt: serverTimestamp(),
      createdAtClient: new Date(),
      createdBy: performedBy
    };

    const ref = doc(collection(this.firestore, 'orderAccountingLedger'));
    await setDoc(ref, newDoc);

    console.log(
      `LedgerService: recorded ${eventType} for order ${orderId}, ` +
      `new balance=${newBalanceAmount}, qty=${newBalanceQty}, ` +
      `orderBalance=${newOrderBalanceQty}, docId=${ref.id}`
    );

    return {
      id: ref.id,
      runningBalanceAmount: newBalanceAmount,
      runningBalanceQty: newBalanceQty,
      runningBalanceOrderQty: newOrderBalanceQty
    };
  } catch (err) {
    console.error('LedgerService.recordEvent error', err);
    throw err;
  }
}

  /**
   * Get the latest running balance for a given company, store, date, and eventType.
   */
  async getLatestBalance(
    companyId: string,
    storeId: string,
    date: Date,
    eventType: 'order' | 'return' | 'refund' | 'cancel' | 'damage'
  ): Promise<{ amount: number; qty: number }> {
    try {
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

      const q = query(
        collection(this.firestore, 'orderAccountingLedger'),
        where('companyId', '==', companyId),
        where('storeId', '==', storeId),
        where('eventType', '==', eventType),
        where('createdAtClient', '>=', startOfDay),
        orderBy('createdAtClient', 'desc'),
        limit(1)
      );

      try {
        const snaps = await getDocs(q);

        if (!snaps.empty) {
          const latest = snaps.docs[0].data() as any;
          return {
            amount: Number(latest.runningBalanceAmount || 0),
            qty: Number(latest.runningBalanceQty || 0)
          };
        }

        return { amount: 0, qty: 0 };
      } catch (err: any) {
        const msg = String(err?.message || err);
        if (msg.includes('requires an index')) {
          console.warn('LedgerService.getLatestBalance: composite index missing, using client-side fallback');
          const recentQ = query(
            collection(this.firestore, 'orderAccountingLedger'),
            orderBy('createdAt', 'desc'),
            limit(200)
          );
          const recentSnaps = await getDocs(recentQ);
          const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
          for (const d of recentSnaps.docs) {
            const data: any = d.data();
            if (data.companyId !== companyId || data.storeId !== storeId || data.eventType !== eventType) continue;
            const created = data.createdAtClient ? new Date(data.createdAtClient) : (data.createdAt && typeof data.createdAt.toDate === 'function' ? data.createdAt.toDate() : new Date(data.createdAt));
            if (created >= startOfDay) {
              return { amount: Number(data.runningBalanceAmount || 0), qty: Number(data.runningBalanceQty || 0) };
            }
          }
          return { amount: 0, qty: 0 };
        }
        throw err;
      }
    } catch (err) {
      console.error('LedgerService.getLatestBalance error', err);
      throw err;
    }
  }
}
