import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Firestore, collection, query, where, getDocs, Timestamp, orderBy, limit } from '@angular/fire/firestore';
import { Order } from '../interfaces/pos.interface';
import { AuthService } from './auth.service';
import { FirestoreSecurityService } from '../core/services/firestore-security.service';
import { OfflineDocumentService } from '../core/services/offline-document.service';
import { IndexedDBService } from '../core/services/indexeddb.service';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private authService = inject(AuthService);
  private offlineDocService = inject(OfflineDocumentService);
  
  constructor(
    private firestore: Firestore,
    private http: HttpClient,
    private securityService: FirestoreSecurityService
    ,
    private indexedDb: IndexedDBService
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
        console.error('Simple Firestore connectivity check failed:', simpleError);
        return [];
      }

      if (!companyId) {
        console.error('No company ID provided');
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
        console.warn('Primary recent orders query failed, attempting fallback without orderBy:', primaryError);
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
          console.error('Fallback recent orders query failed:', fallbackError);
          return [];
        }
      }
    } catch (error) {
      console.error('Critical error loading recent orders:', error);
      return [];
    }
  }

  async searchOrdersEnhanced(companyId: string, searchQuery: string, storeId?: string): Promise<Order[]> {
    try {
      console.log('🔍 Enhanced order search - Company:', companyId, 'Store:', storeId, 'Query:', searchQuery);
      
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
          
          console.log(`🎯 Strategy "${strategy.field}=${strategy.value}" found:`, strategyResults.length);
          
        } catch (strategyError) {
          console.warn(`⚠️ Search strategy failed for ${strategy.field}:`, strategyError);
          continue;
        }
      }
      
      // If no results found, try date-based search (YYYYMMDD format)
      if (results.length === 0 && /^\d{8}$/.test(searchQuery)) {
        console.log('📅 Trying date-based search for:', searchQuery);
        const dateResults = await this.searchOrdersByDate(companyId, searchQuery, storeId);
        results.push(...dateResults);
      }
      
      console.log('✅ Enhanced search complete. Total results:', results.length);
      return results.slice(0, 20); // Limit final results
      
    } catch (error) {
      console.error('❌ Error in enhanced order search:', error);
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
      console.error('Error in date-based search:', error);
      return [];
    }
  }

  async searchOrders(companyId: string, storeId: string | undefined, queryStr: string, statusFilter?: string): Promise<Order[]> {
    try {
      console.log('🔍 Enhanced order search - Company:', companyId, 'Store:', storeId, 'Query:', queryStr);
      
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
          
          console.log(`🎯 Strategy "${strategy.field}=${strategy.value}" found:`, strategyResults.length);
          
        } catch (strategyError) {
          console.warn(`⚠️ Search strategy failed for ${strategy.field}:`, strategyError);
          continue;
        }
      }
      
      // Date-based search (YYYYMMDD format)
      const dateMatch = /^\d{8}$/.test(queryStr);
      if (dateMatch) {
        console.log('📅 Trying date-based search for:', queryStr);
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
      
      console.log('✅ Enhanced search complete. Total results:', filteredResults.length);
      return filteredResults.slice(0, 20); // Limit final results
      
    } catch (error) {
      console.error('❌ Error in enhanced order search:', error);
      return [];
    }
  }

  async updateOrderStatus(orderId: string, status: string): Promise<void> {
    try {
      await this.offlineDocService.updateDocument('orders', orderId, { status });
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  }

  async getOrdersByDateRange(storeId: string, startDate: Date, endDate: Date): Promise<Order[]> {
    try {
      console.log('📊 HYBRID QUERY - Loading orders:', {
        storeId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        userAuth: {
          isLoggedIn: !!this.authService.getCurrentUser(),
          userEmail: this.authService.getCurrentUser()?.email || 'null',
          uid: this.authService.getCurrentUser()?.uid || 'null'
        }
      });

      // Check if we should use API or Firebase based on date
      const useApi = this.shouldUseApi(startDate, endDate);
      
      if (useApi) {
        console.log('🌐 Using API for historical data');
        // TEMPORARY: Skip API for now due to auth issues, use Firebase instead
        console.log('⚠️ TEMPORARY: Skipping API due to auth issues, using Firebase for all dates');
        // return await this.getOrdersFromApi(storeId, startDate, endDate);
      } else {
        console.log('🔥 Using Firebase for current date');
        // Fall back to existing Firebase logic below
      }

      const ordersRef = collection(this.firestore, 'orders');
      console.log('📡 Firebase orders collection reference created');
      
      // First, let's see if there are ANY orders in Firebase
      console.log('🔍 Step 1: Checking for any orders in Firebase...');
      const anyOrdersQuery = query(ordersRef, limit(3));
      const anyOrdersSnapshot = await getDocs(anyOrdersQuery);
      console.log(`📊 Any orders in Firebase: ${anyOrdersSnapshot.docs.length}`);
      
      if (anyOrdersSnapshot.docs.length > 0) {
        console.log('📋 Sample orders:', anyOrdersSnapshot.docs.map(doc => ({
          id: doc.id,
          storeId: doc.data()['storeId'],
          createdAt: doc.data()['createdAt']?.toDate?.() || doc.data()['createdAt']
        })));
      }

      // Now check for orders with this storeId specifically and within date range
      console.log('🔍 Step 2: Checking for orders with storeId and date range:', storeId);
      
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
        console.log(`📊 Orders for store ${storeId} in date range: ${dateRangeSnapshot.docs.length}`);

        if (dateRangeSnapshot.docs.length > 0) {
          console.log('✅ Found orders for this store in date range!');
          const baseOrders = dateRangeSnapshot.docs.map(doc => this.transformDoc(doc));
          // Attach items for each order (orderDetails are stored in separate documents)
          const ordersWithItems = await Promise.all(
            baseOrders.map(async (o) => ({ ...(o as any), items: await this.fetchOrderItems(o.id || '') }))
          );
          console.log(`📊 Returning ${ordersWithItems.length} orders (with items)`);
          return ordersWithItems as any as Order[];
        }
      } catch (dateQueryError) {
        console.warn('⚠️ Date range query failed, trying without date filter:', dateQueryError);
      }

      // Fallback: Try without date filter if the date query failed
      const storeOrdersQuery = query(ordersRef, where('storeId', '==', storeId), limit(50));
      const storeOrdersSnapshot = await getDocs(storeOrdersQuery);
      console.log(`📊 Fallback - Orders for store ${storeId} (no date filter): ${storeOrdersSnapshot.docs.length}`);

      if (storeOrdersSnapshot.docs.length > 0) {
        console.log('✅ Found orders for this store (fallback)!');
        const baseOrders = storeOrdersSnapshot.docs.map(doc => this.transformDoc(doc));
        // Attach items for each order
        const orders = await Promise.all(
          baseOrders.map(async (o) => ({ ...(o as any), items: await this.fetchOrderItems(o.id || '') }))
        );
        // Persist a snapshot for offline fallback (include items)
        try {
          await this.indexedDb.saveSetting(`orders_snapshot_${storeId}`, orders);
        } catch (e) {
          console.warn('Failed to persist orders snapshot to IndexedDB:', e);
        }
        
        // Filter by date range on client side as fallback
        const filteredOrders = orders.filter(order => {
          const orderDate = new Date(order.createdAt);
          return orderDate >= startDate && orderDate <= endDate;
        });
        
        console.log(`📊 After client-side date filtering: ${filteredOrders.length} orders`);
        return filteredOrders as any as Order[];
      } else {
        console.log('⚠️ No orders found for storeId:', storeId);
        console.log('💡 This might mean:');
        console.log('1. Wrong storeId');
        console.log('2. No orders exist for this store');
        console.log('3. Orders exist but with different storeId format');
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
        console.warn('Failed to read orders snapshot from IndexedDB:', e);
      }

      return [];
      
    } catch (error) {
      console.error('❌ Error getting orders by date range:', error);
      console.error('❌ Full error:', error);
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
    
    console.log('🔍 Date logic check:', {
      today: todayStr,
      startDate: startStr,
      endDate: endStr,
      isCurrentDate,
      willUseFirebase: isCurrentDate,
      willUseAPI: !isCurrentDate
    });
    
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
      console.warn('Failed to fetch orderDetails for orderId', orderId, e);
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
    console.log('🔐 Firebase ID token status:', {
      hasToken: !!idToken,
      tokenLength: idToken?.length || 0,
      tokenStart: idToken ? idToken.substring(0, 10) + '...' : 'null',
      currentUser: this.authService.getCurrentUser()?.email || 'null',
      authStatus: 'logged in: ' + !!this.authService.getCurrentUser()
    });
    
    // Check if user is signed in at all
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      console.error('❌ User is not signed in - redirecting to login or showing auth error');
      return [];
    }
    
    if (!idToken) {
      console.error('❌ No Firebase ID token available for API authentication');
      console.error('❌ User is signed in but token is null - possible token refresh issue');
      // Try to force refresh the token
      try {
        console.log('🔄 Attempting to force refresh Firebase ID token...');
        const refreshedToken = await this.authService.getFirebaseIdToken(true);
        if (refreshedToken) {
          console.log('✅ Token refresh successful, retrying API call...');
          // Retry the API call with the refreshed token by calling this method again
          return await this.getOrdersFromApi(storeId, startDate, endDate);
        }
      } catch (refreshError) {
        console.error('❌ Token refresh failed:', refreshError);
      }
      
      return [];
    }

    const params = new URLSearchParams({
      storeId,
      from: fromDate,
      to: toDate
    });

    // Updated API URLs with authentication - prioritize proxy for development
    const apiUrls = [
      '/api', // Proxy URL (for development) - try this first to avoid CORS
      environment.api?.ordersApi || '',
      environment.api?.directOrdersApi || ''
    ].filter(Boolean);

    for (let i = 0; i < apiUrls.length; i++) {
      const apiUrl = apiUrls[i];
      
      try {
        console.log(`🌐 Attempt ${i + 1}: Fetching from ${apiUrl}`, {
          storeId,
          fromDate,
          toDate,
          fullUrl: `${apiUrl}?${params.toString()}`,
          hasToken: !!idToken,
          currentUser: this.authService.getCurrentUser()?.email || 'null',
          authStatus: 'logged in: ' + !!this.authService.getCurrentUser()
        });

        const headers: any = {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        };

        // Add Authorization header with Firebase ID token
        if (idToken) {
          headers['Authorization'] = `Bearer ${idToken}`;
          console.log('🔐 Added Firebase ID token to Authorization header');
        } else {
          console.warn('⚠️ No ID token available - attempting request without authentication');
        }

        const response = await this.http.get<any>(
          `${apiUrl}?${params.toString()}`,
          { headers }
        ).toPromise();

        console.log(`✅ Success with ${apiUrl}:`, response);

        if (response?.success && response.orders) {
          const orders = response.orders.map((order: any) => this.transformApiOrder(order));
          console.log(`🌐 API returned ${orders.length} orders for date range ${fromDate} to ${toDate}`);
          console.log('🌐 Sample transformed order:', orders[0]);
          return orders;
        } else {
          console.warn(`⚠️ API response unsuccessful or empty from ${apiUrl}:`, response);
          // If this URL didn't work, try the next one
          if (i === apiUrls.length - 1) {
            return []; // This was the last URL, return empty
          }
          continue; // Try next URL
        }
      } catch (error: any) {
        console.error(`❌ API call error for ${apiUrl}:`, {
          attempt: i + 1,
          message: error.message,
          status: error.status,
          statusText: error.statusText,
          url: error.url,
          error: error
        });
        
        // Check if it's a CORS error
        if (error.status === 0 && error.statusText === 'Unknown Error') {
          console.error(`🚫 CORS error detected for ${apiUrl}. ${i < apiUrls.length - 1 ? 'Trying direct URL...' : 'All URLs failed.'}`);
        }
        
        // If this is the last URL, return empty array
        if (i === apiUrls.length - 1) {
          console.error('❌ All API endpoints failed');
          return [];
        }
        // Otherwise, continue to next URL
      }
    }
    
    return []; // Fallback return
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
    console.log('🔄 Transforming API order:', apiOrder);
    
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
      message: 'Thank you for your purchase!'
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
