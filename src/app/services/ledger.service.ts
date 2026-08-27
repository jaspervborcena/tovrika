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
  updateDoc,
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
   * Creates ONE document per day per eventType that gets updated throughout the day.
   * First transaction: creates document with createdAt/createdBy = updatedAt/updatedBy
   * Subsequent transactions: updates document with new updatedAt/updatedBy
   */
  async recordEvent(
  companyId: string,
  storeId: string,
  orderId: string,
  eventType: 'completed' | 'returned' | 'refunded' | 'cancelled' | 'damaged' | 'unpaid' | 'recovered',
  amount: number,
  qty: number,
  performedBy: string
): Promise<any> {
  try {
    console.log('🎯 LedgerService.recordEvent called:', { 
      companyId, 
      storeId, 
      orderId, 
      eventType, 
      amount, 
      qty, 
      performedBy 
    });
    
    // Get start of today to reset balances daily
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    
    // Check if a document already exists for this day's eventType
    const existingQ = query(
      collection(this.firestore, 'orderAccountingLedger'),
      where('companyId', '==', companyId),
      where('storeId', '==', storeId),
      where('eventType', '==', eventType),
      where('createdAt', '>=', startOfToday),
      where('createdAt', '<=', endOfToday),
      limit(1)
    );

    const existingSnaps = await getDocs(existingQ);
    
    if (!existingSnaps.empty) {
      // Document exists for today - UPDATE it
      const existingDoc = existingSnaps.docs[0];
      const existing = existingDoc.data() as any;
      
      // Add new values to existing balances
      const newBalanceAmount = Number(existing.runningBalanceAmount || 0) + amount;
      const newBalanceQty = Number(existing.runningBalanceQty || 0) + qty;
      
      const updateData = {
        orderId, // Update to latest order ID
        amount: Number(existing.amount || 0) + amount,
        quantity: Number(existing.quantity || 0) + qty,
        runningBalanceAmount: newBalanceAmount,
        runningBalanceQty: newBalanceQty,
        updatedAt: new Date(),
        updatedBy: performedBy
      };
      
      try {
        await updateDoc(existingDoc.ref, updateData);
      } catch (error) {
        console.warn('⚠️ Failed to update ledger entry online:', error);
        throw error;
      }
      
      console.log(`✅ LedgerService: updated ${eventType} for order ${orderId}`);
      
      return {
        id: existingDoc.id,
        runningBalanceAmount: newBalanceAmount,
        runningBalanceQty: newBalanceQty,
        updated: true
      };
    }

    // No document exists for today - CREATE new one
    const newBalanceAmount = amount;
    const newBalanceQty = qty;

    const newDoc = {
      companyId,
      storeId,
      orderId,
      eventType,
      amount,
      quantity: qty,
      runningBalanceAmount: newBalanceAmount,
      runningBalanceQty: newBalanceQty,
      createdAt: new Date(),
      createdBy: performedBy,
      updatedAt: new Date(),
      updatedBy: performedBy
    };

    const ref = doc(collection(this.firestore, 'orderAccountingLedger'));
    
    try {
      await setDoc(ref, newDoc);
    } catch (error) {
      console.warn('⚠️ Failed to create ledger entry online:', error);
      throw error;
    }

    console.log(`✅ LedgerService: created ${eventType} for order ${orderId}`);

    return {
      id: ref.id,
      runningBalanceAmount: newBalanceAmount,
      runningBalanceQty: newBalanceQty,
      created: true
    };
  } catch (err) {
    console.error('LedgerService.recordEvent error', err);
    throw err;
  }
}

  /**
   * Get the latest running balances for 'order' eventType (or any provided eventType)
   * Returns the runningBalanceAmount from the LATEST entry (cumulative total)
   */
  async getLatestOrderBalances(
    companyId: string,
    storeId: string,
    date: Date = new Date(),
    eventType: 'completed' | 'returned' | 'refunded' | 'cancelled' | 'damaged' | 'unpaid' | 'recovered' = 'completed'
  ): Promise<{ runningBalanceAmount: number; runningBalanceQty: number }> {
    try {
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

      // When the dashboard is scoped to all stores, aggregate the matching
      // ledger docs across store IDs rather than filtering to a single store.
      const baseQuery = query(
        collection(this.firestore, 'orderAccountingLedger'),
        where('companyId', '==', companyId),
        where('eventType', '==', eventType),
        where('createdAt', '>=', startOfDay),
        where('createdAt', '<=', endOfDay),
        orderBy('createdAt', 'desc')
      );

      const q = storeId && storeId !== 'all'
        ? query(baseQuery, where('storeId', '==', storeId))
        : baseQuery;

      const snaps = await getDocs(q);

      if (snaps.empty) {
        return { runningBalanceAmount: 0, runningBalanceQty: 0 };
      }

      if (storeId && storeId !== 'all') {
        const latestDoc = snaps.docs[0];
        const d: any = latestDoc.data();
        return {
          runningBalanceAmount: Number(d.runningBalanceAmount || 0),
          runningBalanceQty: Number(d.runningBalanceQty || 0)
        };
      }

      let runningBalanceAmount = 0;
      let runningBalanceQty = 0;
      snaps.docs.forEach((docSnap) => {
        const d: any = docSnap.data();
        runningBalanceAmount += Number(d.runningBalanceAmount || 0);
        runningBalanceQty += Number(d.runningBalanceQty || 0);
      });

      return { runningBalanceAmount, runningBalanceQty };
    } catch (err) {
      console.warn('LedgerService.getLatestOrderBalances fallback', err);
      return { runningBalanceAmount: 0, runningBalanceQty: 0 };
    }
  }

  /**
   * Get totals for a date RANGE by summing all entries.
   * Sums amount, qty from all entries in the range.
   * - runningBalanceAmount = sum of amounts (revenue for completed)
   * - runningBalanceQty = sum of qty (total items)
   */
  async getOrderBalancesForRange(
    companyId: string,
    storeId: string,
    startDate: Date,
    endDate: Date,
    eventType: 'completed' | 'returned' | 'refunded' | 'cancelled' | 'damaged' | 'unpaid' | 'recovered' = 'completed'
  ): Promise<{ runningBalanceAmount: number; runningBalanceQty: number }> {
    try {
      console.log(`📅 getOrderBalancesForRange: ${startDate.toISOString()} to ${endDate.toISOString()}`);
      console.log(`📅 Query params: companyId=${companyId}, storeId=${storeId}, eventType=${eventType}`);

      const baseQuery = query(
        collection(this.firestore, 'orderAccountingLedger'),
        where('companyId', '==', companyId),
        where('eventType', '==', eventType),
        where('createdAt', '>=', startDate),
        where('createdAt', '<=', endDate),
        orderBy('createdAt', 'desc'),
        limit(2000)
      );

      const q = storeId && storeId !== 'all'
        ? query(baseQuery, where('storeId', '==', storeId))
        : baseQuery;

      const snaps = await getDocs(q);
      console.log(`📊 Found ${snaps.docs.length} ledger entries for ${eventType} in range`);

      if (snaps.empty) {
        console.log(`📊 No ${eventType} entries found for range - returning zeros`);
        return { runningBalanceAmount: 0, runningBalanceQty: 0 };
      }

      let totalAmount = 0;
      let totalQty = 0;

      snaps.docs.forEach((doc, idx) => {
        const d: any = doc.data();
        const amount = Number(d.amount || 0);
        const qty = Number(d.qty || d.quantity || 1);

        totalAmount += amount;
        totalQty += qty;

        if (idx < 5) {
          const docCreatedAt = d.createdAt?.toDate ? d.createdAt.toDate() : new Date(d.createdAt);
          console.log(`📊 Entry ${idx + 1}: date=${docCreatedAt.toLocaleDateString()}, amount=${amount}, qty=${qty}`);
        }
      });

      const result = {
        runningBalanceAmount: totalAmount,
        runningBalanceQty: totalQty
      };
      console.log(`📊 Range totals for ${eventType}: amount=${totalAmount}, items=${totalQty}`);
      return result;
    } catch (err) {
      console.warn('LedgerService.getOrderBalancesForRange error', err);
      return { runningBalanceAmount: 0, runningBalanceQty: 0 };
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
    eventTypes: string[] = ['refunded']
  ): Promise<number> {
    try {
      const baseQuery = query(
        collection(this.firestore, 'orderAccountingLedger'),
        where('companyId', '==', companyId),
        where('createdAt', '>=', startDate),
        where('createdAt', '<=', endDate),
        orderBy('createdAt', 'asc'),
        limit(2000)
      );

      const q = storeId && storeId !== 'all'
        ? query(baseQuery, where('storeId', '==', storeId))
        : baseQuery;

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
    eventTypes: string[] = ['refunded']
  ): Promise<{ amount: number; qty: number }> {
    try {
      const baseQuery = query(
        collection(this.firestore, 'orderAccountingLedger'),
        where('companyId', '==', companyId),
        where('createdAt', '>=', startDate),
        where('createdAt', '<=', endDate),
        orderBy('createdAt', 'desc'),
        limit(1)
      );

      const q = storeId && storeId !== 'all'
        ? query(baseQuery, where('storeId', '==', storeId))
        : baseQuery;

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
    completed: { amount: number; qty: number };
    returns: { amount: number; qty: number };
    refunds: { amount: number; qty: number };
    damages: { amount: number; qty: number };
    unpaid: { amount: number; qty: number };
    recovered: { amount: number; qty: number };
  }> {
    try {
      const types = ['completed','returned', 'refunded', 'damaged', 'unpaid', 'recovered'];
      const result = {
        completed: { amount: 0, qty: 0 },
        returns: { amount: 0, qty: 0 },
        refunds: { amount: 0, qty: 0 },
        damages: { amount: 0, qty: 0 },
        unpaid: { amount: 0, qty: 0 },
        recovered: { amount: 0, qty: 0 }
      };

      for (const et of types) {
        try {
          const baseQuery = query(
            collection(this.firestore, 'orderAccountingLedger'),
            where('companyId', '==', companyId),
            where('eventType', '==', et),
            where('createdAt', '>=', startDate),
            where('createdAt', '<=', endDate),
            orderBy('createdAt', 'desc')
          );

          const qType = storeId && storeId !== 'all'
            ? query(baseQuery, where('storeId', '==', storeId))
            : baseQuery;

          const snapsType = await getDocs(qType);
          if (!snapsType || snapsType.empty) continue;

          if (storeId && storeId !== 'all') {
            const d: any = snapsType.docs[0].data();
            if (!d) continue;
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

            const amt = Number(d.runningBalanceAmount ?? d.amount ?? 0);
            const qty = Number(d.runningBalanceQty ?? d.quantity ?? d.qty ?? 0);

            if (et === 'completed') {
              result.completed.amount += amt;
              result.completed.qty += qty;
            } else if (et === 'returned') {
              result.returns.amount += amt;
              result.returns.qty += qty;
            } else if (et === 'refunded') {
              result.refunds.amount += amt;
              result.refunds.qty += qty;
            } else if (et === 'damaged') {
              result.damages.amount += amt;
              result.damages.qty += qty;
            } else if (et === 'unpaid') {
              result.unpaid.amount += amt;
              result.unpaid.qty += qty;
            } else if (et === 'recovered') {
              result.recovered.amount += amt;
              result.recovered.qty += qty;
            }
            continue;
          }

          let amountSum = 0;
          let qtySum = 0;
          snapsType.docs.forEach((entrySnap) => {
            const d: any = entrySnap.data();
            if (!d) return;
            amountSum += Number(d.runningBalanceAmount ?? d.amount ?? 0);
            qtySum += Number(d.runningBalanceQty ?? d.quantity ?? d.qty ?? 0);
          });

          if (et === 'completed') {
            result.completed.amount += amountSum;
            result.completed.qty += qtySum;
          } else if (et === 'returned') {
            result.returns.amount += amountSum;
            result.returns.qty += qtySum;
          } else if (et === 'refunded') {
            result.refunds.amount += amountSum;
            result.refunds.qty += qtySum;
          } else if (et === 'damaged') {
            result.damages.amount += amountSum;
            result.damages.qty += qtySum;
          } else if (et === 'unpaid') {
            result.unpaid.amount += amountSum;
            result.unpaid.qty += qtySum;
          } else if (et === 'recovered') {
            result.recovered.amount += amountSum;
            result.recovered.qty += qtySum;
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
        completed: { amount: 0, qty: 0 },
        returns: { amount: 0, qty: 0 },
        refunds: { amount: 0, qty: 0 },
        damages: { amount: 0, qty: 0 },
        unpaid: { amount: 0, qty: 0 },
        recovered: { amount: 0, qty: 0 }
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
    eventType: 'completed' | 'returned' | 'refunded' | 'cancelled' | 'damaged'
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
