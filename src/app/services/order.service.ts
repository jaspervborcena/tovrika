import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Firestore, collection, query, where, getDocs, updateDoc, doc, Timestamp, orderBy, limit, addDoc } from '@angular/fire/firestore';
import { Order } from '../interfaces/pos.interface';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  constructor(
    private firestore: Firestore,
    private http: HttpClient
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
      console.log('=============== ORDER LOADING START ===============');
      console.log('📅 Loading recent orders - Company:', companyId, 'Store:', storeId, 'Limit:', limitCount);
      console.log('🕐 Timestamp:', new Date().toLocaleString());
      
      const ordersRef = collection(this.firestore, 'orders');
      console.log('📡 Firestore orders collection reference created');
      
      // Try a simple query first to test connectivity
      try {
        const simpleQuery = query(ordersRef, limit(5));
        const simpleSnapshot = await getDocs(simpleQuery);
        
        if (simpleSnapshot.docs.length === 0) {
          console.log('⚠️ No documents found in orders collection at all');
          console.log('=============== ORDER LOADING END (EMPTY) ===============');
          return [];
        }
      } catch (simpleError) {
        console.error('❌ Simple query failed:', simpleError);
        console.log('=============== ORDER LOADING END (ERROR) ===============');
        return [];
      }
      
      // If we have companyId, try with company filter only first
      if (companyId) {
        try {
          const companyQuery = query(
            ordersRef,
            where('companyId', '==', companyId),
            limit(limitCount)
          );
          const companySnapshot = await getDocs(companyQuery);
          
          if (companySnapshot.docs.length > 0) {
            // Now try the full query with orderBy
            let finalQuery;
            if (storeId) {
              finalQuery = query(
                ordersRef,
                where('companyId', '==', companyId),
                where('storeId', '==', storeId),
                orderBy('createdAt', 'desc'),
                limit(limitCount)
              );
            } else {
              console.log('🏢 Building company-wide query (all stores)');
              finalQuery = query(
                ordersRef,
                where('companyId', '==', companyId),
                orderBy('createdAt', 'desc'),
                limit(limitCount)
              );
            }
            
            const finalSnapshot = await getDocs(finalQuery);
            
            const results = finalSnapshot.docs.map(d => this.transformDoc(d));
            return results;
            
          } else {
            return [];
          }
          
        } catch (companyError) {
          console.error('❌ Company query failed:', companyError);
          console.error('❌ Error details:', {
            code: (companyError as any)?.code,
            message: (companyError as any)?.message
          });
          
          // Fallback to simple company query without orderBy
          console.log('🔄 Step 4: Trying fallback query without orderBy...');
          try {
            const fallbackQuery = query(
              ordersRef,
              where('companyId', '==', companyId),
              limit(limitCount)
            );
            console.log('📡 Executing fallback query...');
            const fallbackSnapshot = await getDocs(fallbackQuery);
            const results = fallbackSnapshot.docs.map(d => this.transformDoc(d));
            console.log('✅ Fallback query successful, found:', results.length, 'orders');
            console.log('=============== ORDER LOADING END (FALLBACK SUCCESS) ===============');
            return results;
          } catch (fallbackError) {
            console.error('❌ Fallback query also failed:', fallbackError);
            console.log('=============== ORDER LOADING END (FALLBACK FAILED) ===============');
            return [];
          }
        }
      } else {
        console.error('❌ No company ID provided');
        console.log('💡 Company ID is required for order queries');
        console.log('=============== ORDER LOADING END (NO COMPANY ID) ===============');
        return [];
      }
      
    } catch (error) {
      console.error('❌ Critical error loading recent orders:', error);
      console.error('❌ Error details:', {
        name: (error as any)?.name,
        code: (error as any)?.code,
        message: (error as any)?.message,
        stack: (error as any)?.stack
      });
      console.log('=============== ORDER LOADING END (CRITICAL ERROR) ===============');
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
      const orderRef = doc(this.firestore, 'orders', orderId);
      await updateDoc(orderRef, { status });
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  }
  
  // Debug method to create test orders
  async createTestOrder(companyId: string, storeId: string): Promise<void> {
    try {
      console.log('🧪 Creating test order with companyId:', companyId, 'storeId:', storeId);
      
      // First, test basic Firestore connectivity
      console.log('🔍 Testing Firestore connectivity...');
      const ordersRef = collection(this.firestore, 'orders');
      console.log('📡 Orders collection reference created:', ordersRef);
      
      // Create multiple test orders for better testing
      for (let i = 1; i <= 3; i++) {
        const testOrder = {
          companyId,
          storeId,
          terminalId: `terminal-00${i}`,
          assignedCashierId: 'test-cashier',
          status: i === 1 ? 'completed' : i === 2 ? 'pending' : 'cancelled',
          cashSale: true,
          soldTo: `Test Customer ${i}`,
          tin: `123-456-789-00${i}`,
          businessAddress: `${100 + i} Test St., Test City`,
          invoiceNumber: `INV-TEST-${Date.now()}-${i}`,
          logoUrl: '',
          date: Timestamp.now(),
          vatableSales: 1000 * i,
          vatAmount: 120 * i,
          zeroRatedSales: 0,
          vatExemptAmount: 0,
          discountAmount: 0,
          grossAmount: 1000 * i,
          netAmount: 1120 * i,
          totalAmount: 1120 * i,
          exemptionId: '',
          signature: '',
          atpOrOcn: `OCN-2025-00123${i}`,
          birPermitNo: `BIR-PERMIT-2025-5678${i}`,
          inclusiveSerialNumber: `00000${i}-00099${i}`,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          message: `Test order ${i} - Thank you for your business!`
        };

        console.log(`📝 Creating test order ${i}:`, testOrder);
        console.log(`📡 Attempting to add document ${i} to Firestore...`);
        
        const docRef = await addDoc(ordersRef, testOrder);
        console.log(`✅ Test order ${i} created with ID:`, docRef.id);
        
        // Small delay between orders
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Wait a bit for Firestore to index the new documents
      console.log('⏳ Waiting for Firestore indexing...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Try to fetch them back to verify they were saved
      console.log('🔄 Verifying orders were saved...');
      const verifyQuery = query(
        ordersRef, 
        where('companyId', '==', companyId),
        where('storeId', '==', storeId)
      );
      const verifySnapshot = await getDocs(verifyQuery);
      console.log('✅ Verification query results:', verifySnapshot.docs.length, 'documents found');
      
      if (verifySnapshot.docs.length > 0) {
        console.log('📄 Found documents:', verifySnapshot.docs.map(d => ({
          id: d.id, 
          invoiceNumber: d.data()['invoiceNumber'],
          soldTo: d.data()['soldTo'],
          status: d.data()['status']
        })));
      }
      
    } catch (error) {
      console.error('❌ Error creating test order:', error);
      console.error('❌ Full error details:', JSON.stringify(error, null, 2));
      
      // Check if it's a permission error
      if (error && typeof error === 'object' && 'code' in error) {
        console.error('❌ Firebase error code:', (error as any).code);
        console.error('❌ Firebase error message:', (error as any).message);
      }
    }
  }

  async getOrdersByDateRange(storeId: string, startDate: Date, endDate: Date): Promise<Order[]> {
    try {
      console.log('📊 HYBRID QUERY - Loading orders:', {
        storeId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      // Check if we should use API or Firebase based on date
      const useApi = this.shouldUseApi(startDate, endDate);
      
      if (useApi) {
        console.log('🌐 Using API for historical data');
        return await this.getOrdersFromApi(storeId, startDate, endDate);
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

      // Now check for orders with this storeId specifically
      console.log('🔍 Step 2: Checking for orders with storeId:', storeId);
      const storeOrdersQuery = query(ordersRef, where('storeId', '==', storeId), limit(10));
      const storeOrdersSnapshot = await getDocs(storeOrdersQuery);
      console.log(`📊 Orders for store ${storeId}: ${storeOrdersSnapshot.docs.length}`);

      if (storeOrdersSnapshot.docs.length > 0) {
        console.log('✅ Found orders for this store! Returning them...');
        const orders = storeOrdersSnapshot.docs.map(doc => this.transformDoc(doc));
        console.log(`📊 Returning ${orders.length} orders`);
        return orders;
      } else {
        console.log('⚠️ No orders found for storeId:', storeId);
        console.log('💡 This might mean:');
        console.log('1. Wrong storeId');
        console.log('2. No orders exist for this store');
        console.log('3. Orders exist but with different storeId format');
        return [];
      }
      
    } catch (error) {
      console.error('❌ Error getting orders by date range:', error);
      console.error('❌ Full error:', error);
      return [];
    }
  }

  // DEBUG METHOD - Create test order for current date
  async createTestOrderForToday(companyId: string, storeId: string): Promise<void> {
    try {
      console.log('🧪 Creating test order for today:', { companyId, storeId });
      
      const testOrder = {
        companyId,
        storeId,
        terminalId: 'terminal-1',
        assignedCashierId: 'cashier-1',
        status: 'completed',
        
        // Customer Information
        cashSale: true,
        soldTo: 'Test Customer',
        tin: '',
        businessAddress: '',
        
        // Invoice Information
        invoiceNumber: `INV-${Date.now()}`,
        logoUrl: '',
        
        // Financial Calculations
        vatableSales: 100,
        vatAmount: 12,
        zeroRatedSales: 0,
        vatExemptAmount: 0,
        discountAmount: 0,
        grossAmount: 112,
        netAmount: 112,
        totalAmount: 112,
        
        // BIR Fields
        exemptionId: '',
        signature: '',
        atpOrOcn: 'OCN-2025-001234',
        birPermitNo: 'BIR-PERMIT-2025-56789',
        inclusiveSerialNumber: '000001-000999',
        
        // System Fields - IMPORTANT: Use current timestamp
        createdAt: new Date(),
        message: 'Test order for debugging - Created on ' + new Date().toISOString()
      };

      const ordersRef = collection(this.firestore, 'orders');
      const docRef = await addDoc(ordersRef, testOrder);
      
      console.log('✅ Test order created with ID:', docRef.id);
      console.log('📅 Created at:', new Date().toISOString());
      
    } catch (error) {
      console.error('❌ Error creating test order:', error);
    }
  }

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
   * Get orders from API (for historical dates)
   */
  private async getOrdersFromApi(storeId: string, startDate: Date, endDate: Date): Promise<Order[]> {
    const fromDate = this.formatDateForApi(startDate);
    const toDate = this.formatDateForApi(endDate);
    
    const params = new URLSearchParams({
      storeId,
      from: fromDate,
      to: toDate
    });

    // Try proxy first, then fallback to direct URL
    const apiUrls = [
      '/api', // Proxy URL (for development)
      'https://get-orders-by-date-7bpeqovfmq-de.a.run.app' // Direct URL (fallback)
    ];

    for (let i = 0; i < apiUrls.length; i++) {
      const apiUrl = apiUrls[i];
      
      try {
        console.log(`🌐 Attempt ${i + 1}: Fetching from ${apiUrl}`, {
          storeId,
          fromDate,
          toDate,
          fullUrl: `${apiUrl}?${params.toString()}`
        });

        const response = await this.http.get<any>(
          `${apiUrl}?${params.toString()}`,
          {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          }
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
