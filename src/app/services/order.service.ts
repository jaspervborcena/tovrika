import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Firestore, collection, query, where, orderBy, limit } from '@angular/fire/firestore';
import { getDocs, getDoc, Timestamp, doc as clientDoc, runTransaction, writeBatch, updateDoc } from 'firebase/firestore';
import { User } from '@angular/fire/auth';
import { Order } from '../interfaces/pos.interface';
import { AuthService } from './auth.service';
import { OrdersSellingTrackingService } from './orders-selling-tracking.service';
import { LoggerService } from '../core/services/logger.service';
import { LedgerService } from './ledger.service';
import { FirestoreSecurityService } from '../core/services/firestore-security.service';
import { IndexedDBService } from '../core/services/indexeddb.service';
import { toDateValue } from '../core/utils/date-utils';
import { OrdersSellingTrackingDoc } from '../interfaces/orders-selling-tracking.interface';

// Client-side logging is currently disabled for this service.
// Logging will be handled server-side (Cloud Function) by passing the authenticated UID.

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private authService = inject(AuthService);
  // Use centralized LoggerService so logs include authenticated uid/company/store via context provider
  private logger = inject(LoggerService);
  private ledgerService = inject(LedgerService);
  
  constructor(
    private firestore: Firestore,
    private http: HttpClient,
    private securityService: FirestoreSecurityService,
    private indexedDb: IndexedDBService,
    private ordersSellingTrackingService: OrdersSellingTrackingService,
  ) {}

  private transformDoc(d: any): Order {
    const data = d.data();
    return {
      id: d.id,
      companyId: data.companyId,
      storeId: data.storeId,
      terminalId: data.terminalId,
      assignedCashierId: data.assignedCashierId,
      status: data.status,
      
      // Status tracking
      statusHistory: data.statusHistory || [],
      statusTags: data.statusTags || [],
      
      // Customer Information
      cashSale: data.cashSale,
      chargeSale: data.chargeSale,
      soldTo: data.soldTo,
      tin: data.tin,
      businessAddress: data.businessAddress,
      
      // Invoice Information
      invoiceNumber: data.invoiceNumber,
      logoUrl: data.logoUrl,
      date: toDateValue(data.date) ?? toDateValue(data.createdAt) ?? new Date(),
      
      // Payment Information
      paymentMethod: data.paymentMethod || data.payment || 'cash',
      cashAmount: data.cashAmount || 0,
      cardAmount: data.cardAmount || 0,
      
      // Financial Calculations
      vatableSales: data.vatableSales || 0,
      vatAmount: data.vatAmount || 0,
      zeroRatedSales: data.zeroRatedSales || 0,
      vatExemptAmount: data.vatExemptAmount || 0,
      discountAmount: data.discountAmount || 0,
      grossAmount: data.grossAmount || 0,
      netAmount: data.netAmount || 0,
      totalAmount: data.totalAmount || data.netAmount || 0,
      
      // BIR Fields
      exemptionId: data.exemptionId,
      signature: data.signature,
      atpOrOcn: data.atpOrOcn || 'OCN-0000-00000',
      birPermitNo: data.birPermitNo || 'BIR-PERMIT-0000-00000',
      inclusiveSerialNumber: data.inclusiveSerialNumber || '000001-000999',
      
      // System Fields
      createdAt: toDateValue(data.createdAt) ?? new Date(),
      message: data.message || 'Thank you! See you again!'
    } as Order;
  }

  async getRecentOrders(companyId: string, storeId?: string, limitCount = 20): Promise<Order[]> {
    try {
      const ordersRef = collection(this.firestore, 'orders');

      // Sanity check: ensure we can read from the collection
      try {
        await getDocs(query(ordersRef, limit(1)));
      } catch (simpleError) {
        this.logger.error('Simple Firestore connectivity check failed', { area: 'orders' }, simpleError);
        return [];
      }

      if (!companyId) {
        this.logger.error('No company ID provided', { area: 'orders' });
        return [];
      }

      // Primary query with orderBy createdAt desc
      try {
        const primaryQuery = storeId
          ? query(
              ordersRef,
              where('companyId', '==', companyId),
              where('storeId', '==', storeId),
              orderBy('createdAt', 'desc'),
              limit(limitCount)
            )
          : query(
              ordersRef,
              where('companyId', '==', companyId),
              orderBy('createdAt', 'desc'),
              limit(limitCount)
            );
        const snapshot = await getDocs(primaryQuery);
        return snapshot.docs.map((d) => this.transformDoc(d));
      } catch (primaryError) {
        this.logger.warn('Primary recent orders query failed, attempting fallback without orderBy', { area: 'orders', payload: { error: String(primaryError) } });
        try {
          const fallbackQuery = storeId
            ? query(ordersRef, where('companyId', '==', companyId), where('storeId', '==', storeId), limit(limitCount))
            : query(ordersRef, where('companyId', '==', companyId), limit(limitCount));
          const fallbackSnapshot = await getDocs(fallbackQuery);
          const results = fallbackSnapshot.docs.map((d) => this.transformDoc(d));
          results.sort((a, b) => {
            const dateA = toDateValue(a.createdAt)?.getTime() || 0;
            const dateB = toDateValue(b.createdAt)?.getTime() || 0;
            return dateB - dateA; // Descending (newest first)
          });
          return results;
          } catch (fallbackError) {
          this.logger.error('Fallback recent orders query failed', { area: 'orders' }, fallbackError);
          return [];
        }
      }
    } catch (error) {
      this.logger.error('Critical error loading recent orders', { area: 'orders' }, error);
      return [];
    }
  }

  async searchOrdersEnhanced(companyId: string, searchQuery: string, storeId?: string): Promise<Order[]> {
    try {
      this.logger.debug('Enhanced order search', { area: 'orders', companyId, storeId, payload: { query: searchQuery } });
      
      const ordersRef = collection(this.firestore, 'orders');
      const results: Order[] = [];
      
      // Search strategies: try multiple fields
      const searchStrategies = [
        // 1. Search by order number/invoice number
        { field: 'orderNumber', value: searchQuery },
        { field: 'invoiceNumber', value: searchQuery },
        
        // 2. Search by order ID (exact match)
        { field: 'id', value: searchQuery },
        
        // 4. Search by partial order number (if it's numeric, try with leading zeros)
        ...(searchQuery.match(/^\d+$/) ? [
          { field: 'orderNumber', value: searchQuery.padStart(6, '0') },
          { field: 'invoiceNumber', value: searchQuery.padStart(8, '0') }
        ] : [])
      ];
      
      // Execute search strategies
      for (const strategy of searchStrategies) {
        try {
          let q;
          if (storeId) {
            q = query(
              ordersRef,
              where('companyId', '==', companyId),
              where('storeId', '==', storeId),
              where(strategy.field, '==', strategy.value),
              orderBy('createdAt', 'desc'),
              limit(20)
            );
          } else {
            q = query(
              ordersRef,
              where('companyId', '==', companyId),
              where(strategy.field, '==', strategy.value),
              orderBy('createdAt', 'desc'),
              limit(20)
            );
          }
          
          const snapshot = await getDocs(q);
          const strategyResults = snapshot.docs.map(d => this.transformDoc(d));
          
          // Add unique results (avoid duplicates)
          strategyResults.forEach(order => {
            if (!results.find(r => r.id === order.id)) {
              results.push(order);
            }
          });
          
          this.logger.info(`Search strategy result`, { area: 'orders', payload: { strategy: strategy.field, value: strategy.value, count: strategyResults.length } });
          
          } catch (strategyError) {
          this.logger.warn(`Search strategy failed`, { area: 'orders', payload: { field: strategy.field, value: strategy.value, error: String(strategyError) } });
          continue;
        }
      }
      
      // If no results found, try date-based search (YYYYMMDD format)
      if (results.length === 0 && /^\d{8}$/.test(searchQuery)) {
        this.logger.debug('Trying date-based search', { area: 'orders', payload: { query: searchQuery } });
        const dateResults = await this.searchOrdersByDate(companyId, searchQuery, storeId);
        results.push(...dateResults);
      }
      
  this.logger.info('Enhanced search complete', { area: 'orders', payload: { count: results.length } });
  return results.slice(0, 20); // Limit final results
      
    } catch (error) {
      this.logger.error('Error in enhanced order search', { area: 'orders' }, error);
      return [];
    }
  }

  private async searchOrdersByDate(companyId: string, dateStr: string, storeId?: string): Promise<Order[]> {
    try {
      const year = Number(dateStr.slice(0, 4));
      const month = Number(dateStr.slice(4, 6)) - 1; // JS months are 0-indexed
      const day = Number(dateStr.slice(6, 8));
      
      const startDate = new Date(year, month, day, 0, 0, 0);
      const endDate = new Date(year, month, day, 23, 59, 59);
      
      const startTs = Timestamp.fromDate(startDate);
      const endTs = Timestamp.fromDate(endDate);
      
      const ordersRef = collection(this.firestore, 'orders');
      let q;
      
      if (storeId) {
        q = query(
          ordersRef,
          where('companyId', '==', companyId),
          where('storeId', '==', storeId),
          where('createdAt', '>=', startTs),
          where('createdAt', '<=', endTs),
          orderBy('createdAt', 'desc'),
          limit(20)
        );
      } else {
        q = query(
          ordersRef,
          where('companyId', '==', companyId),
          where('createdAt', '>=', startTs),
          where('createdAt', '<=', endTs),
          orderBy('createdAt', 'desc'),
          limit(20)
        );
      }
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => this.transformDoc(d));
      
    } catch (error) {
      this.logger.error('Error in date-based search', { area: 'orders' }, error);
      return [];
    }
  }

  async searchOrders(companyId: string, storeId: string | undefined, queryStr: string, statusFilter?: string): Promise<Order[]> {
    try {
      this.logger.debug('Enhanced order search (legacy)', { area: 'orders', companyId, storeId, payload: { query: queryStr } });
      
      const ordersRef = collection(this.firestore, 'orders');
      const results: Order[] = [];
      const searchLower = queryStr.toLowerCase().trim();
      
      // If no search query, return recent orders
      if (!searchLower) {
        return await this.getRecentOrders(companyId, storeId, 20);
      }
      
      // Search strategies: try multiple fields for comprehensive search
      const searchStrategies = [
        // 1. Search by invoice number (exact match)
        { field: 'invoiceNumber', value: queryStr },
        
        // 2. Search by customer name (soldTo) - exact match
        { field: 'soldTo', value: queryStr },
        
        // 3. Search by business address - exact match  
        { field: 'businessAddress', value: queryStr },
        
        // 4. Search by order ID
        { field: 'id', value: queryStr }
      ];
      
      // Execute search strategies
      for (const strategy of searchStrategies) {
        try {
          let q;
          if (storeId) {
            q = query(
              ordersRef,
              where('companyId', '==', companyId),
              where('storeId', '==', storeId),
              where(strategy.field, '==', strategy.value),
              orderBy('createdAt', 'desc'),
              limit(20)
            );
          } else {
            q = query(
              ordersRef,
              where('companyId', '==', companyId),
              where(strategy.field, '==', strategy.value),
              orderBy('createdAt', 'desc'),
              limit(20)
            );
          }
          
          const snapshot = await getDocs(q);
          const strategyResults = snapshot.docs.map(d => this.transformDoc(d));
          
          // Add unique results (avoid duplicates)
          strategyResults.forEach(order => {
            if (!results.find(r => r.id === order.id)) {
              results.push(order);
            }
          });
          
          this.logger.info('Search strategy result', { area: 'orders', payload: { field: strategy.field, value: strategy.value, count: strategyResults.length } });
          
        } catch (strategyError) {
          this.logger.warn('Search strategy failed', { area: 'orders', payload: { field: strategy.field, error: String(strategyError) } });
          continue;
        }
      }
      
      // Date-based search (YYYYMMDD format)
      const dateMatch = /^\d{8}$/.test(queryStr);
      if (dateMatch) {
        this.logger.debug('Trying date-based search', { area: 'orders', payload: { query: queryStr } });
        const year = Number(queryStr.slice(0, 4));
        const month = Number(queryStr.slice(4, 6)) - 1;
        const day = Number(queryStr.slice(6, 8));
        const start = new Date(year, month, day, 0, 0, 0);
        const end = new Date(year, month, day, 23, 59, 59);
        const startTs = Timestamp.fromDate(start);
        const endTs = Timestamp.fromDate(end);
        
        let dateQuery;
        if (storeId) {
          dateQuery = query(
            ordersRef,
            where('companyId', '==', companyId),
            where('storeId', '==', storeId),
            where('createdAt', '>=', startTs),
            where('createdAt', '<=', endTs),
            orderBy('createdAt', 'desc'),
            limit(20)
          );
        } else {
          dateQuery = query(
            ordersRef,
            where('companyId', '==', companyId),
            where('createdAt', '>=', startTs),
            where('createdAt', '<=', endTs),
            orderBy('createdAt', 'desc'),
            limit(20)
          );
        }
        
        const dateSnapshot = await getDocs(dateQuery);
        const dateResults = dateSnapshot.docs.map(d => this.transformDoc(d));
        
        // Add unique date results
        dateResults.forEach(order => {
          if (!results.find(r => r.id === order.id)) {
            results.push(order);
          }
        });
      }
      
      // Apply status filter if provided
      let filteredResults = results;
      if (statusFilter && statusFilter !== 'all') {
        filteredResults = results.filter(order => order.status === statusFilter);
      }
      
      // Sort by most recent first
      filteredResults.sort((a, b) => {
        const dateA = a.createdAt?.getTime() || 0;
        const dateB = b.createdAt?.getTime() || 0;
        return dateB - dateA;
      });
      
  this.logger.info('Enhanced search complete', { area: 'orders', payload: { count: filteredResults.length } });
  return filteredResults.slice(0, 20); // Limit final results
      
    } catch (error) {
      this.logger.error('Error in enhanced order search (legacy)', { area: 'orders' }, error);
      return [];
    }
  }
async updateOrderStatus(orderId: string, status: string, reason?: string): Promise<void> {
  try {
    console.log(`🚀 updateOrderStatus called: orderId=${orderId}, status=${status}, reason=${reason}, online=${navigator.onLine}`);
    const currentUser = this.authService.getCurrentUser();
    const currentUserId = currentUser?.uid || 'system';
    const now = new Date();
    
    // First, get the current order to retrieve existing statusHistory and statusTags
    const orderRef = clientDoc(this.firestore, 'orders', orderId);
    const orderSnap = await getDoc(orderRef as any);
    
    let existingStatusHistory: any[] = [];
    let existingStatusTags: string[] = [];
    
    if (orderSnap && orderSnap.exists()) {
      const orderData: any = orderSnap.data();
      existingStatusHistory = orderData.statusHistory || [];
      existingStatusTags = orderData.statusTags || [];
    }
    
    // Append new status to history
    const newHistoryEntry = {
      status,
      changedAt: now,
      changedBy: currentUserId,
      ...(reason && { reason })
    };
    
    const updatedStatusHistory = [...existingStatusHistory, newHistoryEntry];
    
    // Add status to tags if not already present
    const updatedStatusTags = existingStatusTags.includes(status) 
      ? existingStatusTags 
      : [...existingStatusTags, status];
    
    // Build update payload with updatedAt, never modify createdAt
    // Root status field only updates for 'cancelled', otherwise it stays at initial value
    const updatePayload: any = { 
      updatedAt: now,
      statusHistory: updatedStatusHistory,
      statusTags: updatedStatusTags
    };
    
    // Only update root status field if the new status is 'cancelled'
    if (status === 'cancelled') {
      updatePayload.status = status;
    }
    
    if (reason !== undefined && reason !== null) {
      updatePayload.updateReason = reason;
    }
    
    // Update the order document - Firestore offline persistence handles sync
    const orderDocRef = clientDoc(this.firestore, 'orders', orderId);
    await updateDoc(orderDocRef, updatePayload);
    // If we're online and the order was cancelled or returned, attempt a client-side transactional restock.
    // This is a best-effort attempt — the server-side Cloud Function still exists as authoritative.
  if (navigator.onLine && (status === 'cancelled' || status === 'returned' || status === 'refunded' || status === 'damage' || status === 'damaged')) {
  const currentUser = this.authService.getCurrentUser();
  const performedBy = currentUser?.uid || currentUser?.email || 'system';

  // For cancelled/returned orders, attempt restock
  if (status === 'cancelled' || status === 'returned') {
    try {
      await this.restockOrderAndInventoryTransactional(orderId, performedBy);
    } catch (e) {
      this.logger.warn(
        'Client-side restock attempt failed (server function may handle it)',
        { area: 'orders', docId: orderId, payload: { error: String(e) } }
      );
    }
  }

  // Mark ordersSellingTracking entries appropriately
  try {
    if (status === 'cancelled') {
      await this.ordersSellingTrackingService.markOrderTrackingCancelled(orderId, performedBy, reason);
    } else if (status === 'returned') {
      await this.ordersSellingTrackingService.markOrderTrackingReturned(orderId, performedBy, reason);
    } else if (status === 'refunded') {
      await this.ordersSellingTrackingService.markOrderTrackingRefunded(orderId, performedBy, reason);
    } else if (status === 'damage') {
      await this.ordersSellingTrackingService.markOrderTrackingDamaged(orderId, performedBy, reason);
    }
  } catch (e) {
    this.logger.warn(
      `Failed to mark ordersSellingTracking entries as ${status}`,
      { area: 'orders', docId: orderId, payload: { error: String(e) } }
    );
  }

  // Create ledger entry for cancelled/returned/refunded/damage statuses so accounting stays in sync
  try {
    console.log(`🔔 Starting ledger recording section for orderId=${orderId}, status=${status}, online=${navigator.onLine}`);
    const map: any = { cancelled: 'cancelled', returned: 'returned', refunded: 'refunded', damage: 'damaged', damaged: 'damaged' };
    if (['cancelled', 'returned', 'refunded', 'damage', 'damaged'].includes(status)) {
      console.log(`✅ Status ${status} is in the list, proceeding with ledger entry...`);
      // Prefer summing authoritative tracking documents created/updated for this order
      const mappedStatus = map[status] || status;
      console.log(`📝 Mapped status: ${status} → ${mappedStatus}`);
      let amount = 0;
      let qty = 0;
      let companyId = '';
      let storeId = '';
      
      // First, always get companyId and storeId from the order document
      try {
        const orderRef = clientDoc(this.firestore, 'orders', orderId);
        const orderSnap = await getDoc(orderRef as any);
        if (orderSnap && orderSnap.exists()) {
          const orderData: any = orderSnap.data();
          companyId = orderData.companyId || '';
          storeId = orderData.storeId || '';
          console.log(`📄 Order document: companyId=${companyId}, storeId=${storeId}`);
        }
      } catch (orderFetchErr) {
        console.error(`❌ Failed to fetch order document:`, orderFetchErr);
      }
      
      try {
        const trackingRef = collection(this.firestore, 'ordersSellingTracking');
        
        // Query ALL tracking entries for this order (don't filter by status)
        // We'll sum up all original quantities regardless of current status
        const trackingQ = query(trackingRef, where('orderId', '==', orderId));
        const trackingSnap = await getDocs(trackingQ as any);
        
        console.log(`🔍 OrderService: Querying ALL ordersSellingTracking for orderId=${orderId}`);
        console.log(`📊 Found ${trackingSnap?.docs?.length || 0} total tracking entries`);
        
        if (trackingSnap && !trackingSnap.empty) {
          for (const d of trackingSnap.docs) {
            const data: any = d.data() || {};
            const lineTotal = Number(data.total || data.lineTotal || (Number(data.price || 0) * Number(data.quantity || 0)) || 0);
            const itemQty = Number(data.quantity || 0);
            amount += lineTotal;
            qty += itemQty;
          }
          console.log(`✅ Total from tracking: amount=${amount}, qty=${qty}`);
        } else {
          console.log(`⚠️ No tracking entries found, using order document for amounts`);

          // Fallback to order document if tracking entries are not yet present
          const orderRef = clientDoc(this.firestore, 'orders', orderId);
          const orderSnap = await getDoc(orderRef as any);
          if (orderSnap && orderSnap.exists()) {
            const data: any = orderSnap.data();
            amount = Number(data.netAmount || data.totalAmount || 0);
            qty = Array.isArray(data.items) ? data.items.reduce((s: number, it: any) => s + Number(it.quantity || 0), 0) : 0;
            console.log(`📄 Fallback amounts: amount=${amount}, qty=${qty}, items=${data.items?.length || 0}`);
          }
        }

        try {
          const safeAmount = Number(amount || 0);
          const safeQty = Number(qty || 0);
          
          // Validate required fields before recording ledger
          if (!companyId || !storeId) {
            console.error(`❌ Cannot record ledger: missing companyId=${companyId} or storeId=${storeId}`);
            this.logger.warn('Cannot record ledger entry: missing companyId or storeId', { 
              area: 'orders', 
              docId: orderId, 
              payload: { companyId, storeId, status } 
            });
          } else {
            console.log(`💾 Recording ledger event: eventType=${mappedStatus}, amount=${safeAmount}, qty=${safeQty}, companyId=${companyId}, storeId=${storeId}`);
            await this.ledgerService.recordEvent(companyId, storeId, orderId, mappedStatus as any, safeAmount, safeQty, performedBy);
            console.log(`✅ Ledger entry created successfully for orderId=${orderId}, eventType=${mappedStatus}`);
            this.logger.info('Ledger entry created for status change', { area: 'orders', docId: orderId, payload: { status, amount: safeAmount, qty: safeQty } });
          }
        } catch (ledgerErr) {
          console.error(`❌ Ledger recording failed:`, ledgerErr);
          this.logger.warn('Failed to create ledger entry for status change', { area: 'orders', docId: orderId, payload: { error: String(ledgerErr) } });
        }
      } catch (e) {
        this.logger.warn('Failed while attempting to compute tracking totals for ledger', { area: 'orders', docId: orderId, payload: { error: String(e) } });
      }
    }
  } catch (e) {
    this.logger.warn('Failed while attempting to write ledger for status change', { area: 'orders', docId: orderId, payload: { error: String(e) } });
  }
}

  } catch (error) {
    this.logger.error(
      'Error updating order status',
      { area: 'orders', docId: orderId, payload: { status } },
      error
    );
    throw error;
  }
}

  /**
   * Attempt to restock products and inventory batches for an order atomically from the client.
   * This will: read `ordersSellingTracking` for the order, sum quantities per product,
   * find the latest `productInventory` batch per product, then run a transaction that
   * re-reads each tracking doc and only applies increments for rows that are not yet restocked.
   * The method is defensive and idempotent when tracking rows are already marked `restocked`.
   */


public async restockOrderAndInventoryTransactional(orderId: string, performedBy = 'system'): Promise<void> {
  try {
    // 1) Query tracking entries for this order
    const trackingRef = collection(this.firestore, 'ordersSellingTracking');
    const trackingQ = query(trackingRef, where('orderId', '==', orderId));
    const trackingSnap = await getDocs(trackingQ);

    if (!trackingSnap || trackingSnap.empty) {
      this.logger.info('restock: no tracking entries found for order', { area: 'orders', docId: orderId });
      console.log(`No tracking entries found for order ${orderId}`);
      return;
    }

    // Collect candidate tracking docs (skip zero qty and missing productId)
    const candidates = trackingSnap.docs
      .map(d => {
        const data = d.data() as OrdersSellingTrackingDoc;
        return {
          id: d.id,
          ref: d.ref,
          productId: data.productId,
          quantity: Number(data.quantity || 0),
        };
      })
      .filter(c => !!c.productId && c.quantity > 0);

    if (candidates.length === 0) {
      this.logger.info('restock: nothing to restock (all entries have zero qty)', { area: 'orders', docId: orderId });
      console.log(`Nothing to restock for order ${orderId} (all entries have zero qty)`);
      return;
    }

    // 2) Pre-collect inventory refs (outside transaction, only refs)
    const inventoryRefsByProduct = new Map<string, any>();
    for (const c of candidates) {
      try {
        const invQ = query(
          collection(this.firestore, 'productInventory'),
          where('productId', '==', c.productId),
          orderBy('updatedAt', 'desc'),
          limit(1)
        );
        const invSnap = await getDocs(invQ);
        if (invSnap && !invSnap.empty) {
          inventoryRefsByProduct.set(c.productId, invSnap.docs[0].ref);
        }
      } catch (e) {
        this.logger.warn('restock: failed to pre-query inventory batch', { area: 'orders', payload: { productId: c.productId, error: String(e) } });
      }
    }

    // 3) Use batch writes for offline support
    const batch = writeBatch(this.firestore);
    console.log(`Starting batch write for order ${orderId} restock`);

    // Pre-read order to validate status
    const orderRef = clientDoc(this.firestore, 'orders', orderId);
    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists()) throw new Error('Order not found: ' + orderId);

    const currentStatus = (orderSnap.data() as any).status;
    const restockableStatuses = ['cancelled', 'returned', 'refunded'];
    if (!restockableStatuses.includes(currentStatus)) {
      throw new Error('Order status is not restockable: ' + currentStatus);
    }

    // Pre-read all tracking, product, and inventory docs
    const trackingSnaps = new Map<string, any>();
    const productSnaps = new Map<string, { ref: any; snap: any }>();
    const inventorySnaps = new Map<string, { ref: any; snap: any }>();

    for (const c of candidates) {
      // Read tracking doc
      const tdSnap = await getDoc(c.ref);
      trackingSnaps.set(c.id, tdSnap);

      // Read product
      const prodRef = clientDoc(this.firestore, 'products', c.productId);
      const prodSnap = await getDoc(prodRef);
      productSnaps.set(c.productId, { ref: prodRef, snap: prodSnap });

      // Read inventory batch (if available)
      const invRef = inventoryRefsByProduct.get(c.productId);
      if (invRef) {
        const invSnap = await getDoc(invRef);
        inventorySnaps.set(c.productId, { ref: invRef, snap: invSnap });
      }
    }

    // Now perform all writes in the batch
    for (const c of candidates) {
      const tdSnap = trackingSnaps.get(c.id);
      if (!tdSnap || !tdSnap.exists()) continue;

      const tdData: any = tdSnap.data() || {};
      if (tdData.restocked) {
        console.log(`Skipping already-restocked tracking doc ${c.id}`);
        continue;
      }

      console.log(`Processing restock for tracking doc ${c.id} product=${c.productId}, qty=${c.quantity}`);

      // Update product stock
      const prodEntry = productSnaps.get(c.productId);
      const prodRef = prodEntry?.ref;
      const prodSnap = prodEntry?.snap;
      const currentTotal = prodSnap?.exists() ? Number((prodSnap.data() as any).totalStock || 0) : 0;
      const newTotal = currentTotal + c.quantity;
      console.log(`Updating product ${c.productId}: currentTotal=${currentTotal}, newTotal=${newTotal}`);
      batch.update(prodRef, { totalStock: newTotal, lastUpdated: new Date(), updatedBy: performedBy });

      // Update inventory batch (if we have one)
      const invEntry = inventorySnaps.get(c.productId);
      if (invEntry) {
        const invRef = invEntry.ref;
        const invSnap = invEntry.snap;
        const currentInvQty = invSnap?.exists() ? Number((invSnap.data() as any).quantity || 0) : 0;
        const newInvQty = currentInvQty + c.quantity;
        console.log(`Updating inventory for product ${c.productId}: currentInvQty=${currentInvQty}, newInvQty=${newInvQty}`);
        batch.update(invRef, { quantity: newInvQty, lastUpdated: new Date(), updatedBy: performedBy });
      }

      // Mark tracking doc as restocked
      batch.update(c.ref, { restocked: true, restockedAt: new Date(), restockedBy: performedBy });
    }

    // Touch order metadata
    batch.update(orderRef, { updatedAt: new Date(), updatedBy: performedBy });
    
    // Commit batch (queues offline, syncs when online)
    await batch.commit();
    console.log(`✅ Batch write committed for order ${orderId} restock`);

    this.logger.info('restock: client-side restock transaction completed', { area: 'orders', docId: orderId });
    console.log(`Restock transaction completed for order ${orderId}`);
  } catch (err) {
    this.logger.error('restock: client-side restock failed', { area: 'orders', docId: orderId }, err);
    console.error(`Restock transaction failed for order ${orderId}:`, err);
    throw err;
  }
}

  async getOrdersByDateRange(storeId: string, startDate: Date, endDate: Date): Promise<Order[]> {
    try {
      this.logger.info('HYBRID QUERY - Loading orders', { area: 'orders', payload: { storeId, startDate: startDate.toISOString(), endDate: endDate.toISOString(), userAuth: { isLoggedIn: !!this.authService.getCurrentUser(), userEmail: this.authService.getCurrentUser()?.email || 'null', uid: this.authService.getCurrentUser()?.uid || 'null' } } });

      // Check if we should use API or Firebase based on date
      const useApi = this.shouldUseApi(startDate, endDate);
      
      if (useApi) {
  this.logger.info('Using API for historical data', { area: 'orders', storeId });
        // Attempt to load from BigQuery-backed API first
        try {
          const apiOrders = await this.getOrdersFromApi(storeId, startDate, endDate);
          if (apiOrders && apiOrders.length > 0) {
            this.logger.info('API returned orders; enriching with items if missing', { area: 'orders', storeId, payload: { count: apiOrders.length } });
            const ordersWithItems = await Promise.all(apiOrders.map(async (o: any) => {
              // If API returned items, keep them; otherwise fallback to Firestore orderDetails
              if (o.items && Array.isArray(o.items) && o.items.length > 0) {
                return o;
              }
              try {
                const items = await this.fetchOrderItems(o.id || '');
                return { ...(o as any), items };
              } catch (e) {
                return { ...(o as any), items: [] };
              }
            }));
            return ordersWithItems as any as Order[];
          }
          // If API returned nothing, fall through to Firebase fallback logic below
          this.logger.warn('API returned no orders for this range; falling back to Firebase', { area: 'orders', storeId });
        } catch (apiErr) {
    this.logger.warn('API call failed, falling back to Firebase', { area: 'orders', storeId, payload: { error: String(apiErr) } });
        }
      } else {
  this.logger.info('Using Firebase for current date', { area: 'orders', storeId });
        // Fall back to existing Firebase logic below
      }

      const ordersRef = collection(this.firestore, 'orders');
  this.logger.debug('Firebase orders collection reference created', { area: 'orders', storeId });
      
      // First, let's see if there are ANY orders in Firebase
  this.logger.debug('Checking for any orders in Firebase', { area: 'orders' });
      const anyOrdersQuery = query(ordersRef, limit(3));
      const anyOrdersSnapshot = await getDocs(anyOrdersQuery);
  this.logger.info('Any orders in Firebase', { area: 'orders', payload: { count: anyOrdersSnapshot.docs.length } });
      
      if (anyOrdersSnapshot.docs.length > 0) {
        this.logger.debug('Sample orders', { area: 'orders', payload: anyOrdersSnapshot.docs.map(doc => ({ id: doc.id, storeId: doc.data()['storeId'], createdAt: toDateValue(doc.data()['createdAt']) || doc.data()['createdAt'] })) });
      }

      // Now check for orders with this storeId specifically and within date range
  this.logger.debug('Checking for orders with storeId and date range', { area: 'orders', storeId });
      
      // Convert dates to Firestore Timestamps
      const startTimestamp = Timestamp.fromDate(startDate);
      const endTimestamp = Timestamp.fromDate(endDate);
      
      try {
        const dateRangeQuery = query(
          ordersRef, 
          where('storeId', '==', storeId),
          where('createdAt', '>=', startTimestamp),
          where('createdAt', '<=', endTimestamp),
          orderBy('createdAt', 'desc'),
          limit(100) // Increased limit for date ranges
        );
        
  const dateRangeSnapshot = await getDocs(dateRangeQuery);
  this.logger.info('Orders for store in date range', { area: 'orders', storeId, payload: { count: dateRangeSnapshot.docs.length } });

        if (dateRangeSnapshot.docs.length > 0) {
          this.logger.info('Found orders for this store in date range', { area: 'orders', storeId });
          const baseOrders = dateRangeSnapshot.docs.map(doc => this.transformDoc(doc));
          // Attach items for each order (orderDetails are stored in separate documents)
          const ordersWithItems = await Promise.all(
            baseOrders.map(async (o) => ({ ...(o as any), items: await this.fetchOrderItems(o.id || '') }))
          );
          this.logger.info('Returning orders with items', { area: 'orders', storeId, payload: { count: ordersWithItems.length } });
          return ordersWithItems as any as Order[];
        }
      } catch (dateQueryError) {
        this.logger.warn('Date range query failed, trying without date filter', { area: 'orders', storeId, payload: { error: String(dateQueryError) } });
      }

      // Fallback: Try without date filter if the date query failed
      const storeOrdersQuery = query(ordersRef, where('storeId', '==', storeId), limit(50));
  const storeOrdersSnapshot = await getDocs(storeOrdersQuery);
  this.logger.info('Fallback orders for store (no date filter)', { area: 'orders', storeId, payload: { count: storeOrdersSnapshot.docs.length } });

      if (storeOrdersSnapshot.docs.length > 0) {
        this.logger.info('Found orders for this store (fallback)', { area: 'orders', storeId });
        const baseOrders = storeOrdersSnapshot.docs.map(doc => this.transformDoc(doc));
        // Attach items for each order
        const orders = await Promise.all(
          baseOrders.map(async (o) => ({ ...(o as any), items: await this.fetchOrderItems(o.id || '') }))
        );
        // Persist a snapshot for offline fallback (include items)
        try {
          await this.indexedDb.saveSetting(`orders_snapshot_${storeId}`, orders);
        } catch (e) {
          this.logger.warn('Failed to persist orders snapshot to IndexedDB', { area: 'orders', storeId, payload: { error: String(e) } });
        }
        
        // Filter by date range on client side as fallback
        const filteredOrders = orders.filter(order => {
          const orderDate = toDateValue(order.createdAt) ?? new Date(order.createdAt);
          return orderDate >= startDate && orderDate <= endDate;
        });
        
  this.logger.info('After client-side date filtering', { area: 'orders', storeId, payload: { count: filteredOrders.length } });
        return filteredOrders as any as Order[];
      } else {
        this.logger.warn('No orders found for storeId', { area: 'orders', storeId, payload: { hints: ['Wrong storeId', 'No orders exist for this store', 'Orders exist but with different storeId format'] } });
        return [];
      }
      // If nothing found remotely, attempt offline snapshot fallback
      try {
        const saved: any[] = await this.indexedDb.getSetting(`orders_snapshot_${storeId}`);
        if (saved && Array.isArray(saved)) {
          const filtered = saved.filter(order => {
            const orderDate = toDateValue(order.createdAt) ?? new Date(order.createdAt);
            return orderDate >= startDate && orderDate <= endDate;
          });
          if (filtered.length > 0) return filtered;
        }
      } catch (e) {
        this.logger.warn('Failed to read orders snapshot from IndexedDB', { area: 'orders', storeId, payload: { error: String(e) } });
      }

      return [];
      
    } catch (error) {
      this.logger.error('Error getting orders by date range', { area: 'orders', storeId }, error);
      return [];
    }
  }

  /**
   * Force Firestore-only query for orders in a date range using `updatedAt` when available
   * Falls back to `createdAt` if `updatedAt` query returns no documents.
   */
  public async getOrdersFromFirestoreByRange(storeId: string, startDate: Date, endDate: Date): Promise<Order[]> {
    try {
      const ordersRef = collection(this.firestore, 'orders');
      const startTs = Timestamp.fromDate(startDate);
      const endTs = Timestamp.fromDate(endDate);

      // Try multiple candidate timestamp fields to be resilient to differing schemas
      const candidateFields = ['updatedAt', 'updated_at', 'createdAt', 'created_at', 'date'];

      for (const field of candidateFields) {
        try {
          const q = query(
            ordersRef,
            where('storeId', '==', storeId),
            where(field, '>=', startTs),
            where(field, '<=', endTs),
            orderBy(field, 'desc')
          );

          const snap = await getDocs(q as any);
          this.logger.info('Firestore range query attempted', { area: 'orders', storeId, payload: { field, count: snap?.docs?.length ?? 0 } });

          if (snap && snap.docs && snap.docs.length > 0) {
            this.logger.info(`Firestore query by ${field} returned orders`, { area: 'orders', storeId, payload: { field, count: snap.docs.length } });
            return snap.docs.map(d => this.transformDoc(d));
          }
        } catch (e: any) {
          const errMsg = String(e?.message ?? e);
          // If Firestore indicates a missing composite index, it will often include a URL to create it
          const urlMatch = errMsg.match(/https?:\/\/[^")\s]+/);
          if (urlMatch && urlMatch[0]) {
            this.logger.warn(`Firestore query for field '${field}' failed due to missing index. Create it: ${urlMatch[0]}`, { area: 'orders', storeId, payload: { field, error: errMsg } });
          } else {
            this.logger.debug(`Firestore query by '${field}' failed`, { area: 'orders', storeId, payload: { field, error: errMsg } });
          }
          // Try next candidate field
          continue;
        }
      }

      // If none of the timestamp fields returned documents, provide helpful debugging hints
      this.logger.warn('No orders found when querying by candidate timestamp fields; falling back to store-only query for diagnosis', { area: 'orders', storeId, payload: { startDate: startDate.toISOString(), endDate: endDate.toISOString(), triedFields: candidateFields } });

      try {
        const storeOnlyQ = query(ordersRef, where('storeId', '==', storeId), limit(20));
        const storeOnlySnap = await getDocs(storeOnlyQ as any);
        this.logger.info('Store-only sample fetched', { area: 'orders', storeId, payload: { count: storeOnlySnap?.docs?.length ?? 0 } });
        if (storeOnlySnap && storeOnlySnap.docs && storeOnlySnap.docs.length > 0) {
          this.logger.debug('Store-only sample documents (ids and keys)', { area: 'orders', storeId, payload: storeOnlySnap.docs.map(d => ({ id: d.id, keys: Object.keys(d.data() as any) })) });
        }
      } catch (e) {
        this.logger.debug('Store-only sample query failed', { area: 'orders', storeId, payload: { error: String(e) } });
      }

      return [];
    } catch (error) {
      this.logger.error('Critical error in getOrdersFromFirestoreByRange', { area: 'orders', storeId }, error);
      return [];
    }
  }

  /**
   * Convenience helper: fetch orders for a specific year+month in YYYYMM format (e.g. '202511').
   * Delegates to `getOrdersFromFirestoreByRange` after computing start/end of month.
   */
  public async getOrdersByYearAndMonth(storeId: string, yearMonth: string): Promise<Order[]> {
    if (!yearMonth || !/^[0-9]{6}$/.test(yearMonth)) {
      this.logger.warn('Invalid yearMonth provided to getOrdersByYearAndMonth', { area: 'orders', payload: { yearMonth } });
      return [];
    }

    try {
      const year = Number(yearMonth.slice(0, 4));
      const month = Number(yearMonth.slice(4, 6)) - 1; // JS months are 0-indexed
      const start = new Date(year, month, 1, 0, 0, 0, 0);
      // Last millisecond of month: create next month day 0
      const end = new Date(year, month + 1, 0, 23, 59, 59, 999);

      this.logger.info('Fetching orders for yearMonth', { area: 'orders', payload: { storeId, yearMonth, start: start.toISOString(), end: end.toISOString() } });
      return await this.getOrdersFromFirestoreByRange(storeId, start, end);
    } catch (e) {
      this.logger.error('Error in getOrdersByYearAndMonth', { area: 'orders', payload: { yearMonth, error: String(e) } }, e);
      return [];
    }
  }

  /**
   * Convenience helper: fetch orders for the current day (00:00:00 -> 23:59:59.999).
   * This uses the Firestore range query flow and will prefer `updatedAt` when present.
   */
  public async getOrdersForToday(storeId: string): Promise<Order[]> {
    try {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      this.logger.debug('Fetching orders for today', { area: 'orders', payload: { storeId, start: start.toISOString(), end: end.toISOString() } });
      return await this.getOrdersFromFirestoreByRange(storeId, start, end);
    } catch (e) {
      this.logger.error('Error in getOrdersForToday', { area: 'orders', payload: { storeId, error: String(e) } }, e);
      return [];
    }
  }

  /**
   * Debug helper: fetch up to `limitCount` orders for the given store without date filters.
   * Returns raw document data for inspection (not transformed) so callers can log field names.
   */
  public async getSampleOrdersForDebug(storeId: string, limitCount = 10): Promise<any[]> {
    try {
      const ordersRef = collection(this.firestore, 'orders');
      let q;
      if (storeId) {
        q = query(ordersRef, where('storeId', '==', storeId), limit(limitCount));
      } else {
        q = query(ordersRef, limit(limitCount));
      }
      const snap = await getDocs(q);
      if (!snap || !snap.docs) return [];
      return snap.docs.map(d => ({ id: d.id, data: d.data() }));
    } catch (e) {
      this.logger.warn('getSampleOrdersForDebug failed', { area: 'orders', payload: { storeId, error: String(e) } });
      return [];
    }
  }

  // (Removed test-only order creation methods)

  /**
   * Determines if we should use API based on date range
   * Rule: If current date (today) → Firebase, else → API
   */
  private shouldUseApi(startDate: Date, endDate: Date): boolean {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    
    // If date range is current date (today), use Firebase
    const isCurrentDate = startStr === todayStr && endStr === todayStr;
    
    this.logger.debug('Date logic check', { area: 'orders', payload: { today: todayStr, startDate: startStr, endDate: endStr, isCurrentDate, willUseFirebase: isCurrentDate, willUseAPI: !isCurrentDate } });
    
    // Use API for all dates except current date
    return !isCurrentDate;
  }

  /**
   * Fetch order items from the orderDetails collection for a given orderId.
   * orderDetails may be batched across multiple documents, so we flatten all items.
   */
  public async fetchOrderItems(orderId: string): Promise<any[]> {
    if (!orderId) return [];
    try {
      const orderDetailsRef = collection(this.firestore, 'orderDetails');
      const q = query(orderDetailsRef, where('orderId', '==', orderId));
      const snap = await getDocs(q);
      if (!snap || snap.empty) return [];
      const items = snap.docs.flatMap(d => {
        const data: any = d.data();
        return data.items || [];
      });
      return items;
    } catch (e) {
      this.logger.warn('Failed to fetch orderDetails for orderId', { area: 'orders', payload: { orderId, error: String(e) } });
      return [];
    }
  }

  /**
   * Fetch order selling tracking entries for a given orderId from the Cloud Function.
   * Uses the manage_item_status endpoint which joins ordersSellingTracking with products table.
   * Returns array of tracking documents with proper product information.
   */
  public async getOrderSellingTracking(orderId: string): Promise<any[]> {
    if (!orderId) return [];
    try {
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) {
        console.warn('No authenticated user for manage_item_status request');
        return [];
      }

      // Get the current store ID from auth service permissions
      const currentPermission = this.authService.getCurrentPermission();
      const currentStoreId = currentPermission?.storeId;
      if (!currentStoreId) {
        console.warn('No current store ID available for manage_item_status request');
        return [];
      }

      // Use HttpClient so auth interceptor can automatically add Authorization header
      const data = await this.http.post<any>(`${environment.api.baseUrl}/manage_item_status`, {
        storeId: currentStoreId,
        orderId: orderId
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      }).toPromise();
      
      // The Cloud Function returns: { success: true, storeId, orderId, count, rows: [...] }
      // Each row contains: productName, SKU, quantity, discountType, discount, vat, isVatApplicable, isVatExempt, total, updatedAt, status
      let results = [];
      
      if (Array.isArray(data)) {
        // Direct array response
        results = data;
      } else if (data.rows && Array.isArray(data.rows)) {
        // Response with rows property (current format)
        results = data.rows;
      } else if (data.results && Array.isArray(data.results)) {
        // Alternative format with results property
        results = data.results;
      } else if (data.data && Array.isArray(data.data)) {
        // Alternative format with data property
        results = data.data;
      } else {
        console.warn('❌ Unexpected Cloud Function response format:', data);
        results = [];
      }
      
      console.log('✅ Normalized results:', results.length, 'tracking entries');
      // Deduplicate near-identical entries to avoid UI duplicates
      const deduped: any[] = [];
      const seen = new Set<string>();

      for (const r of results) {
        // Build a stable key from the most likely identifying fields
        const productName = (r.productName || r.product || '').toString();
        const sku = (r.SKU || r.sku || r.skuCode || '').toString();
        const qty = (r.quantity || r.qty || '').toString();
        const price = (r.price || r.unitPrice || r.total || r.totalAmount || '').toString();
        const key = `${productName}::${sku}::${qty}::${price}`;

        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(r);
        }
      }

      console.log('✅ Normalized results:', results.length, 'tracking entries -> deduped:', deduped.length);
      return deduped;

    } catch (e) {
      console.error('💥 Error calling manage_item_status Cloud Function:', e);
      this.logger.warn('Failed to fetch orderSellingTracking via Cloud Function', { area: 'orders', payload: { orderId, error: String(e) } });
      // Fallback: attempt to read directly from Firestore 'ordersSellingTracking' collection
      try {
        const fallback = await this.ordersSellingTrackingService.fetchTrackingEntries(orderId);
        console.info('Fallback fetched tracking entries from Firestore:', fallback.length);
        return fallback;
      } catch (fbErr) {
        this.logger.warn('Fallback to Firestore ordersSellingTracking failed', { area: 'orders', payload: { orderId, error: String(fbErr) } });
        return [];
      }
    }
  }

  /**
   * Mark all orderDetails documents for a given orderId as COMPLETED.
   * Uses OfflineDocumentService so updates work both online and offline.
   */
  // markOrderDetailsCompleted intentionally removed: status is now set at creation time in invoice/offline flows

  /**
   * Get orders from API (for historical dates)
   * Auth interceptor automatically adds Firebase ID token to all /api/* requests
   */
  private async getOrdersFromApi(storeId: string, startDate: Date, endDate: Date): Promise<Order[]> {
    const fromDate = this.formatDateForApi(startDate);
    const toDate = this.formatDateForApi(endDate);
    
    // Check if user is signed in at all
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      this.logger.error('User is not signed in - cannot call orders API', { area: 'orders' });
      return [];
    }

    const params = new URLSearchParams({
      storeId,
      from: fromDate,
      to: toDate
    });

    // Include the authenticated user's UID so the Cloud Function can perform server-side logging
    if (currentUser?.uid) {
      try {
        params.append('uid', currentUser.uid);
      } catch (e) {
        // noop - URLSearchParams should work in modern environments; swallow any error
      }
    }
    // Updated API URLs with authentication - prioritize proxy for development
    // Build deduplicated API URL list. Keep proxy but ensure direct endpoint is also tried.
    const rawUrls = [environment.api?.ordersApi || '', environment.api?.directOrdersApi || ''].filter(Boolean);
    const apiUrls = Array.from(new Set(rawUrls));

    for (let i = 0; i < apiUrls.length; i++) {
      const apiUrl = apiUrls[i];
      
      try {
        this.logger.debug('Attempting API fetch', { area: 'orders', payload: { attempt: i + 1, apiUrl, storeId, fromDate, toDate, currentUser: this.authService.getCurrentUser()?.email || 'null' } });

        const headers: any = {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        };
        // Note: Auth interceptor automatically adds Authorization header for /api/* requests

        const response = await this.http.get<any>(
          `${apiUrl}?${params.toString()}`,
          { headers }
        ).toPromise();

  this.logger.info('API call success', { area: 'orders', payload: { apiUrl, responseSummary: response?.success ? 'success' : 'no-data' } });

        if (response?.success && response.orders) {
          const orders = response.orders.map((order: any) => this.transformApiOrder(order));
          this.logger.info('API returned orders', { area: 'orders', storeId, payload: { count: orders.length, fromDate, toDate } });
          this.logger.debug('Sample transformed order', { area: 'orders', payload: orders[0] });
          return orders;
        } else {
          this.logger.warn('API response unsuccessful or empty', { area: 'orders', payload: { apiUrl, response } });
          // If this URL didn't work, try the next one
          if (i === apiUrls.length - 1) {
            return []; // This was the last URL, return empty
          }
          continue; // Try next URL
        }
      } catch (error: any) {
          // Capture as much of the error/response body as possible to help diagnose 500s
          let bodyText: any = error?.error;
          try {
            // If server returned a Blob (stacktrace or HTML), read as text (modern browsers support blob.text())
            if (bodyText && typeof bodyText === 'object' && typeof (bodyText as any).text === 'function') {
              bodyText = await (bodyText as any).text();
            } else if (bodyText && typeof bodyText === 'object') {
              // Try to stringify JSON body
              try { bodyText = JSON.stringify(bodyText); } catch { bodyText = String(bodyText); }
            }
          } catch (bodyErr) {
            bodyText = String(error?.error || bodyErr);
          }

          const attemptPayload = {
            attempt: i + 1,
            apiUrl,
            message: error?.message,
            status: error?.status,
            statusText: error?.statusText,
            url: error?.url,
            // HttpClient surfaces server response body under `error` — include it (sanitized later)
            body: bodyText
          };

          this.logger.error('API call error', { area: 'orders', payload: attemptPayload }, error);

        // Check if it's a CORS/network error (status 0 or unknown)
        if (error?.status === 0 && (error?.statusText === 'Unknown Error' || !error?.statusText)) {
          this.logger.error('Possible CORS or network error for API URL', { area: 'orders', payload: { apiUrl, tryNext: i < apiUrls.length - 1 } }, error);
        }
        
        // If this is the last URL, return empty array
        if (i === apiUrls.length - 1) {
          this.logger.error('All API endpoints failed', { area: 'orders', storeId });
          return [];
        }
        // Otherwise, continue to next URL
      }
    }
    
    return []; // Fallback return
  }

  /**
   * Fetch a paginated page of orders from the API (BigQuery-backed).
   * Allows specifying page_size, page_number and an optional fields projection.
   * Returns transformed Order[] and does NOT attempt Firebase fallbacks.
   */
  async getOrdersPage(storeId: string, startDate: Date, endDate: Date, pageSize = 50, pageNumber = 1, fields?: string[]): Promise<Order[]> {
    const fromDate = this.formatDateForApi(startDate);
    const toDate = this.formatDateForApi(endDate);

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      this.logger.error('User not signed in - cannot call paged orders API', { area: 'orders' });
      return [];
    }

    const params = new URLSearchParams({
      storeId,
      from: fromDate,
      to: toDate,
      page_size: String(pageSize),
      page_number: String(pageNumber)
    });

    if (fields && fields.length > 0) {
      try { params.append('fields', fields.join(',')); } catch {}
    }

    if (currentUser?.uid) {
      try { params.append('uid', currentUser.uid); } catch {}
    }

    const rawUrls = [environment.api?.ordersApi || '', environment.api?.directOrdersApi || ''].filter(Boolean);
    const apiUrls = Array.from(new Set(rawUrls));

    for (let i = 0; i < apiUrls.length; i++) {
      const apiUrl = apiUrls[i];
      try {
        const headers: any = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
        // Auth interceptor automatically adds Authorization header

  const response = await this.http.get<any>(`${apiUrl}?${params.toString()}`, { headers }).toPromise();

  if (response?.success && response.orders) {
          const orders = response.orders.map((order: any) => this.transformApiOrder(order));
          return orders;
        } else {
          this.logger.warn('Paged API response unsuccessful or empty', { area: 'orders', payload: { apiUrl, response } });
          if (i === apiUrls.length - 1) return [];
          continue;
        }
      } catch (error: any) {
        // capture body if available
        let bodyText: any = error?.error;
        try {
          if (bodyText && typeof bodyText === 'object' && typeof (bodyText as any).text === 'function') {
            bodyText = await (bodyText as any).text();
          } else if (bodyText && typeof bodyText === 'object') {
            try { bodyText = JSON.stringify(bodyText); } catch { bodyText = String(bodyText); }
          }
        } catch (e) { bodyText = String(error?.error || e); }

        this.logger.error('Paged API call error', { area: 'orders', payload: { apiUrl, pageSize, pageNumber, message: error?.message, status: error?.status, body: bodyText } }, error);
        if (i === apiUrls.length - 1) return [];
        continue;
      }
    }

    return [];
  }

  /**
   * Format date for API (YYYYMMDD format for Python Cloud Function)
   */
  private formatDateForApi(date: Date): string {
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    return dateStr.replace(/-/g, ''); // Convert to YYYYMMDD
  }

  /**
   * Transform API order data to Order interface
   * Handles the response structure from get-orders-by-date API
   */
  private transformApiOrder(apiOrder: any): Order {
  this.logger.debug('Transforming API order', { area: 'orders', payload: apiOrder });
  const id = apiOrder.order_id || apiOrder.orderId || apiOrder.id || '';
  const dateRaw = apiOrder.updated_at || apiOrder.updatedAt || apiOrder.created_at || apiOrder.createdAt;
    const date = dateRaw ? new Date(dateRaw) : new Date();
    const gross = Number(apiOrder.gross_amount ?? apiOrder.grossAmount ?? apiOrder.total_amount ?? 0);
    const net = Number(apiOrder.net_amount ?? apiOrder.netAmount ?? apiOrder.total_amount ?? gross);
    const paymentMethod = apiOrder.payment || apiOrder.payment_method || apiOrder.paymentMethod || 'cash';

    const customerName = apiOrder.customerInfo?.fullName || apiOrder.soldTo || apiOrder.customerName || apiOrder.customer_name || 'Walk-in Customer';

    return {
      id: id,
      orderId: id || undefined,
      companyId: '',
      storeId: apiOrder.store_id || apiOrder.storeId || '',
      terminalId: apiOrder.terminalId || 'terminal-1',
      assignedCashierId: apiOrder.assignedCashierId || '',
      // Preserve the raw status from API (e.g., 'completed') when present; fall back to mapped values
      status: (apiOrder.status || apiOrder.order_status) ?? this.mapApiStatus(apiOrder.status),

      cashSale: true,
      soldTo: customerName,
      tin: apiOrder.tin || '',
      businessAddress: apiOrder.businessAddress || apiOrder.customer_address || '',

      invoiceNumber: apiOrder.invoice_number || apiOrder.invoiceNumber || '',
      logoUrl: apiOrder.logoUrl || '',
      date,

      vatableSales: Number(apiOrder.vatable_sales ?? apiOrder.vatableSales ?? 0),
      vatAmount: Number(apiOrder.vat_amount ?? apiOrder.vatAmount ?? 0),
      zeroRatedSales: Number(apiOrder.zero_rated_sales ?? apiOrder.zeroRatedSales ?? 0),
      vatExemptAmount: Number(apiOrder.vat_exempt_amount ?? apiOrder.vatExemptAmount ?? 0),
      discountAmount: Number(apiOrder.discount_amount ?? apiOrder.discountAmount ?? 0),
      grossAmount: gross,
      netAmount: net,
      totalAmount: Number(apiOrder.total_amount ?? apiOrder.totalAmount ?? net ?? gross),

      exemptionId: apiOrder.exemptionId || '',
      signature: apiOrder.signature || '',
      atpOrOcn: apiOrder.atpOrOcn || 'OCN-2025-001234',
      birPermitNo: apiOrder.birPermitNo || 'BIR-PERMIT-2025-56789',
      inclusiveSerialNumber: apiOrder.inclusiveSerialNumber || '000001-000999',

      createdAt: date,
      message: apiOrder.message || 'Thank you for your purchase!',
      // Do not include items in the API-mapped Order (UI fetches details separately if needed)
      // items: undefined,
      // Explicitly provide paymentMethod for UI
      paymentMethod: paymentMethod
    } as Order;
  }

  /**
   * Map API status to expected status values
   */
  private mapApiStatus(apiStatus: string): 'pending' | 'paid' | 'cancelled' | 'refunded' {
    switch (apiStatus?.toLowerCase()) {
      case 'paid':
        return 'paid';
      case 'cancelled':
        return 'cancelled';
      case 'refunded':
        return 'refunded';
      default:
        return 'paid'; // Default to paid for completed orders
    }
  }

  
}
