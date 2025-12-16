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
  eventType: 'completed' | 'return' | 'refund' | 'cancel' | 'damage',
  amount: number,
  qty: number,
  performedBy: string
): Promise<any> {
  try {
    // Get start of today to reset balances daily
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    
    // Query latest ledger entry for this company/store/eventType from TODAY only
    const q = query(
      collection(this.firestore, 'orderAccountingLedger'),
      where('companyId', '==', companyId),
      where('storeId', '==', storeId),
      where('eventType', '==', eventType),
      where('createdAt', '>=', startOfToday),
      orderBy('createdAt', 'desc'),
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
      latestOrderBalanceQty + (eventType === 'completed' ? qty : 0);

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
      createdAt: new Date(),
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
   * Get the latest running balances for 'order' eventType (or any provided eventType)
   */
  async getLatestOrderBalances(
    companyId: string,
    storeId: string,
    date: Date = new Date(),
    eventType: 'completed' | 'return' | 'refund' | 'cancel' | 'damage' = 'completed'
  ): Promise<{ runningBalanceAmount: number; runningBalanceQty: number; runningBalanceOrderQty: number }> {
    try {
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
      
      // Query for the latest ledger entry for the specified eventType on the specified date
      const q = query(
        collection(this.firestore, 'orderAccountingLedger'),
        where('companyId', '==', companyId),
        where('storeId', '==', storeId),
        where('eventType', '==', eventType),
        orderBy('createdAt', 'desc')
      );
      
      const snaps = await getDocs(q);
      
      // Filter client-side for the specific date range
      const filteredDocs = snaps.docs.filter(doc => {
        const data = doc.data();
        const createdAt = data['createdAt']?.toDate?.();
        if (!createdAt) return false;
        return createdAt >= startOfDay && createdAt <= endOfDay;
      });
      
      if (filteredDocs.length > 0) {
        const d: any = filteredDocs[0].data();
        return {
          runningBalanceAmount: Number(d.runningBalanceAmount || 0),
          runningBalanceQty: Number(d.runningBalanceQty || 0),
          runningBalanceOrderQty: Number(d.runningBalanceOrderQty || 0)
        };
      }
      
      return { runningBalanceAmount: 0, runningBalanceQty: 0, runningBalanceOrderQty: 0 };
    } catch (err) {
      console.warn('LedgerService.getLatestOrderBalances fallback', err);
      return { runningBalanceAmount: 0, runningBalanceQty: 0, runningBalanceOrderQty: 0 };
    }
  }

  /**
   * Sum ledger amounts for given eventTypes within a date range.
   * Uses client-side filtering after querying by company/store + createdAt range.
   */
  async sumEventsInRange(
    companyId: string,
    storeId: string,
    startDate: Date,
    endDate: Date,
    eventTypes: string[] = ['refund']
  ): Promise<number> {
    try {
      const q = query(
        collection(this.firestore, 'orderAccountingLedger'),
        where('companyId', '==', companyId),
        where('storeId', '==', storeId),
        where('createdAt', '>=', startDate),
        where('createdAt', '<=', endDate),
        orderBy('createdAt', 'asc'),
        limit(2000)
      );

      const snaps = await getDocs(q);
      if (!snaps || snaps.empty) return 0;
      let sum = 0;
      for (const s of snaps.docs) {
        const d: any = s.data();
        if (!d) continue;
        if (!d.eventType || eventTypes.indexOf(d.eventType) === -1) continue;
        sum += Number(d.amount || 0);
      }
      return sum;
    } catch (err) {
      console.warn('LedgerService.sumEventsInRange error', err);
      return 0;
    }
  }

  /**
   * Sum both amount and quantity for given event types within date range.
   */
  async sumEventsAmountAndQty(
    companyId: string,
    storeId: string,
    startDate: Date,
    endDate: Date,
    eventTypes: string[] = ['refund']
  ): Promise<{ amount: number; qty: number }> {
    try {
      const q = query(
        collection(this.firestore, 'orderAccountingLedger'),
        where('companyId', '==', companyId),
        where('storeId', '==', storeId),
        where('createdAt', '>=', startDate),
        where('createdAt', '<=', endDate),
        orderBy('createdAt', 'desc'),
        limit(1)
      );

      const snaps = await getDocs(q);
      if (!snaps || snaps.empty) return { amount: 0, qty: 0 };
      let sumAmount = 0;
      let sumQty = 0;
      for (const s of snaps.docs) {
        const d: any = s.data();
        if (!d) continue;
        if (!d.eventType || eventTypes.indexOf(d.eventType) === -1) continue;
        sumAmount += Number(d.amount || 0);
        sumQty += Number(d.quantity || d.qty || 0);
      }
      return { amount: sumAmount, qty: sumQty };
    } catch (err) {
      console.warn('LedgerService.sumEventsAmountAndQty error', err);
      return { amount: 0, qty: 0 };
    }
  }

  /**
   * Get aggregate totals for common adjustment event types (return, refund, damage).
   * Returns amounts and quantities grouped by eventType.
   */
 async getAdjustmentTotals(
  companyId: string,
  storeId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  returns: { amount: number; qty: number };
  refunds: { amount: number; qty: number };
  damages: { amount: number; qty: number };
}> {
  try {
    const types = ['completed','return', 'refund', 'damage'];
      const result = {
        completed: { amount: 0, qty: 0 },
        returns: { amount: 0, qty: 0 },
        refunds: { amount: 0, qty: 0 },
        damages: { amount: 0, qty: 0 }
      };

      // For each event type, fetch the latest ledger row (if any) and include it if within range
      for (const et of types) {
        try {
          const qType = query(
            collection(this.firestore, 'orderAccountingLedger'),
            where('companyId', '==', companyId),
            where('storeId', '==', storeId),
            where('eventType', '==', et),
            where('createdAt', '>=', startDate),
            where('createdAt', '<=', endDate),
            orderBy('createdAt', 'desc'),
            limit(1)
          );

          const snapsType = await getDocs(qType);
          if (!snapsType || snapsType.empty) continue;

          const d: any = snapsType.docs[0].data();
          if (!d) continue;

          // Normalize createdAt to Date
          let created: Date | null = null;
          try {
            if (d.createdAt && typeof d.createdAt.toDate === 'function') {
              created = d.createdAt.toDate();
            } else if (d.createdAt) {
              created = new Date(d.createdAt);
            }
          } catch (e) {
            created = null;
          }

          if (!created) continue;
          if (created.getTime() < startDate.getTime() || created.getTime() > endDate.getTime()) continue;

          // Prefer running balance fields (these reflect cumulative values at this ledger row).
          const amt = Number(d.runningBalanceAmount ?? d.amount ?? 0);
          const qty = Number(d.runningBalanceQty ?? d.quantity ?? d.qty ?? 0);

          if (et === 'completed') {
            result.completed.amount += amt;
            result.completed.qty += qty;
          } else if (et === 'return') {
             result.returns.amount += amt;
            result.returns.qty += qty;
          } else if (et === 'refund') {
            result.refunds.amount += amt;
            result.refunds.qty += qty;
          } else if (et === 'damage') {
            result.damages.amount += amt;
            result.damages.qty += qty;
          }
        } catch (e) {
          console.warn(`LedgerService.getAdjustmentTotals: failed to fetch latest ${et}`, e);
          continue;
        }
      }

      return result;
  } catch (err) {
    console.warn('LedgerService.getAdjustmentTotals error', err);
    return {
      returns: { amount: 0, qty: 0 },
      refunds: { amount: 0, qty: 0 },
      damages: { amount: 0, qty: 0 }
    };
  }
}

  /**
   * Get the latest running balance for a given company, store, date, and eventType.
   */
  async getLatestBalance(
    companyId: string,
    storeId: string,
    date: Date,
    eventType: 'completed' | 'return' | 'refund' | 'cancel' | 'damage'
  ): Promise<{ amount: number; qty: number }> {
    try {
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

      const q = query(
        collection(this.firestore, 'orderAccountingLedger'),
        where('companyId', '==', companyId),
        where('storeId', '==', storeId),
        where('eventType', '==', eventType),
        where('createdAt', '>=', startOfDay),
        orderBy('createdAt', 'desc'),
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
            const created = data.createdAt && typeof data.createdAt.toDate === 'function' ? data.createdAt.toDate() : new Date(data.createdAt);
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
