import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Firestore, collection, query, where, getDocs, Timestamp, orderBy, limit } from '@angular/fire/firestore';
import { Order } from '../interfaces/pos.interface';
import { AuthService } from './auth.service';
import { LoggerService } from '../core/services/logger.service';
import { FirestoreSecurityService } from '../core/services/firestore-security.service';
import { OfflineDocumentService } from '../core/services/offline-document.service';
import { IndexedDBService } from '../core/services/indexeddb.service';
// Client-side logging is currently disabled for this service.
// Logging will be handled server-side (Cloud Function) by passing the authenticated UID.

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private authService = inject(AuthService);
  private offlineDocService = inject(OfflineDocumentService);
  // Use centralized LoggerService so logs include authenticated uid/company/store via context provider
  private logger = inject(LoggerService);
  
  constructor(
    private firestore: Firestore,
    private http: HttpClient,
    private securityService: FirestoreSecurityService,
    private indexedDb: IndexedDBService,
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
      
      // Customer Information
      cashSale: data.cashSale,
      soldTo: data.soldTo,
      tin: data.tin,
      businessAddress: data.businessAddress,
      
      // Invoice Information
      invoiceNumber: data.invoiceNumber,
      logoUrl: data.logoUrl,
      date: data.date?.toDate ? data.date.toDate() : data.createdAt?.toDate(),
      
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
      atpOrOcn: data.atpOrOcn || 'OCN-2025-001234',
      birPermitNo: data.birPermitNo || 'BIR-PERMIT-2025-56789',
      inclusiveSerialNumber: data.inclusiveSerialNumber || '000001-000999',
      
      // System Fields
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
      message: data.message || 'Thank you! See you again!'
    } as Order;
  }

  async getRecentOrders(companyId: string, storeId?: string, limitCount: number = 20): Promise<Order[]> {
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
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
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

  async updateOrderStatus(orderId: string, status: string): Promise<void> {
    try {
      await this.offlineDocService.updateDocument('orders', orderId, { status });
    } catch (error) {
      this.logger.error('Error updating order status', { area: 'orders', docId: orderId, payload: { status } }, error);
      throw error;
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
        this.logger.debug('Sample orders', { area: 'orders', payload: anyOrdersSnapshot.docs.map(doc => ({ id: doc.id, storeId: doc.data()['storeId'], createdAt: doc.data()['createdAt']?.toDate?.() || doc.data()['createdAt'] })) });
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
          const orderDate = new Date(order.createdAt);
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
            const orderDate = new Date(order.createdAt);
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
  private async fetchOrderItems(orderId: string): Promise<any[]> {
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
   * Get orders from API (for historical dates)
   */
  private async getOrdersFromApi(storeId: string, startDate: Date, endDate: Date): Promise<Order[]> {
    const fromDate = this.formatDateForApi(startDate);
    const toDate = this.formatDateForApi(endDate);
    
    // Get Firebase ID token for authentication
    const idToken = await this.authService.getFirebaseIdToken();
    this.logger.debug('Firebase ID token status', { area: 'orders', payload: { hasToken: !!idToken, tokenLength: idToken?.length || 0, tokenStart: idToken ? idToken.substring(0, 10) + '...' : 'null', currentUser: this.authService.getCurrentUser()?.email || 'null', authStatus: 'logged in: ' + !!this.authService.getCurrentUser() } });
    
    // Check if user is signed in at all
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      this.logger.error('User is not signed in - cannot call orders API', { area: 'orders' });
      return [];
    }
    
    if (!idToken) {
      this.logger.error('No Firebase ID token available for API authentication', { area: 'orders', storeId });
      this.logger.error('User is signed in but token is null - possible token refresh issue', { area: 'orders', storeId });
      // Try to force refresh the token
      try {
        this.logger.debug('Attempting to force refresh Firebase ID token', { area: 'orders', storeId });
        const refreshedToken = await this.authService.getFirebaseIdToken(true);
        if (refreshedToken) {
          this.logger.info('Token refresh successful, retrying API call', { area: 'orders', storeId });
          // Retry the API call with the refreshed token by calling this method again
          return await this.getOrdersFromApi(storeId, startDate, endDate);
        }
      } catch (refreshError) {
        this.logger.error('Token refresh failed', { area: 'orders', storeId }, refreshError);
      }
      
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
    const rawUrls = ['/api', environment.api?.ordersApi || '', environment.api?.directOrdersApi || ''].filter(Boolean);
    const apiUrls = Array.from(new Set(rawUrls));

    for (let i = 0; i < apiUrls.length; i++) {
      const apiUrl = apiUrls[i];
      
      try {
        this.logger.debug('Attempting API fetch', { area: 'orders', payload: { attempt: i + 1, apiUrl, storeId, fromDate, toDate, hasToken: !!idToken, currentUser: this.authService.getCurrentUser()?.email || 'null' } });

        const headers: any = {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        };

        // Add Authorization header with Firebase ID token
        if (idToken) {
          headers['Authorization'] = `Bearer ${idToken}`;
          this.logger.debug('Added Firebase ID token to Authorization header (redacted)', { area: 'orders', storeId });
        } else {
          this.logger.warn('No ID token available - attempting request without authentication', { area: 'orders', storeId });
        }

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

    const idToken = await this.authService.getFirebaseIdToken();
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

    const rawUrls = ['/api', environment.api?.ordersApi || '', environment.api?.directOrdersApi || ''].filter(Boolean);
    const apiUrls = Array.from(new Set(rawUrls));

    for (let i = 0; i < apiUrls.length; i++) {
      const apiUrl = apiUrls[i];
      try {
        const headers: any = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
        if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

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
    
    return {
      id: apiOrder.order_id || apiOrder.id || '',
      companyId: '', // Not provided in API response
      storeId: apiOrder.store_id || '',
      terminalId: 'terminal-1', // Default since not in API
      assignedCashierId: '', // Not provided in API response
      status: this.mapApiStatus(apiOrder.status),
      
      // Customer Information
      cashSale: true, // Default for API orders
      soldTo: 'Walk-in Customer', // Default since not in API
      tin: '',
      businessAddress: '',
      
      // Invoice Information
      invoiceNumber: apiOrder.invoice_number || '',
      logoUrl: '',
      date: apiOrder.created_at ? new Date(apiOrder.created_at) : new Date(),
      
      // Financial Calculations - using API response fields
      vatableSales: 0, // Not provided in current API response
      vatAmount: 0, // Not provided in current API response
      zeroRatedSales: 0,
      vatExemptAmount: 0,
      discountAmount: 0, // Not provided in current API response
      grossAmount: apiOrder.gross_amount || apiOrder.total_amount || 0,
      netAmount: apiOrder.net_amount || apiOrder.total_amount || 0,
      totalAmount: apiOrder.total_amount || 0,
      
      // BIR Fields - defaults since not in API
      exemptionId: '',
      signature: '',
      atpOrOcn: 'OCN-2025-001234',
      birPermitNo: 'BIR-PERMIT-2025-56789',
      inclusiveSerialNumber: '000001-000999',
      
      // System Fields
      createdAt: apiOrder.created_at ? new Date(apiOrder.created_at) : new Date(),
      message: 'Thank you for your purchase!',
      // Preserve items if API provides them (BigQuery endpoint may include order items)
      items: apiOrder.items || []
    };
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
