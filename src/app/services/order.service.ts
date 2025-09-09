import { Injectable } from '@angular/core';
import { Firestore, collection, query, where, getDocs, updateDoc, doc, Timestamp, orderBy, limit, addDoc } from '@angular/fire/firestore';
import { Order } from '../interfaces/pos.interface';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  constructor(private firestore: Firestore) {}

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
      console.log('🔍 Step 1: Testing simple query (no filters)...');
      try {
        const simpleQuery = query(ordersRef, limit(5));
        console.log('📡 Executing simple query...');
        const simpleSnapshot = await getDocs(simpleQuery);
        console.log('📊 Simple query results - Document count:', simpleSnapshot.docs.length);
        
        if (simpleSnapshot.docs.length > 0) {
          console.log('📄 Sample documents found:');
          simpleSnapshot.docs.forEach((d, index) => {
            const data = d.data();
            console.log(`   Document ${index + 1}:`, {
              id: d.id,
              companyId: data['companyId'],
              storeId: data['storeId'],
              invoiceNumber: data['invoiceNumber'],
              soldTo: data['soldTo'],
              createdAt: data['createdAt']?.toDate?.()?.toLocaleString() || 'No date'
            });
          });
        } else {
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
        console.log('🔍 Step 2: Testing company-only query for companyId:', companyId);
        try {
          const companyQuery = query(
            ordersRef,
            where('companyId', '==', companyId),
            limit(limitCount)
          );
          console.log('📡 Executing company query...');
          const companySnapshot = await getDocs(companyQuery);
          console.log('📊 Company query results - Document count:', companySnapshot.docs.length);
          
          if (companySnapshot.docs.length > 0) {
            console.log('✅ Found orders for company! Details:');
            companySnapshot.docs.forEach((d, index) => {
              const data = d.data();
              console.log(`   Order ${index + 1}:`, {
                id: d.id,
                companyId: data['companyId'],
                storeId: data['storeId'],
                invoiceNumber: data['invoiceNumber'],
                status: data['status'],
                soldTo: data['soldTo'],
                totalAmount: data['totalAmount'],
                createdAt: data['createdAt']?.toDate?.()?.toLocaleString() || 'No date'
              });
            });
            
            console.log('🔍 Step 3: Proceeding with full query (with orderBy)...');
            
            // Now try the full query with orderBy
            let finalQuery;
            if (storeId) {
              console.log('🏪 Building store-specific query for storeId:', storeId);
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
            
            console.log('📡 Executing final query with orderBy...');
            const finalSnapshot = await getDocs(finalQuery);
            console.log('📊 Final query results - Document count:', finalSnapshot.docs.length);
            
            if (finalSnapshot.docs.length === 0) {
              console.log('⚠️ Final query returned no results despite company query having results');
              console.log('💡 This suggests an indexing issue with orderBy clause');
            }
            
            const results = finalSnapshot.docs.map((d, index) => {
              console.log(`📄 Processing document ${index + 1}:`, d.id);
              const transformedOrder = this.transformDoc(d);
              console.log(`   Transformed order:`, {
                id: transformedOrder.id,
                invoiceNumber: transformedOrder.invoiceNumber,
                soldTo: transformedOrder.soldTo,
                totalAmount: transformedOrder.totalAmount,
                createdAt: transformedOrder.createdAt?.toLocaleString()
              });
              return transformedOrder;
            });
            
            console.log('✅ Successfully loaded recent orders:', results.length);
            console.log('=============== ORDER LOADING END (SUCCESS) ===============');
            return results;
            
          } else {
            console.log('⚠️ No orders found for company:', companyId);
            console.log('💡 This could mean:');
            console.log('   - No orders exist for this company');
            console.log('   - Company ID is incorrect');
            console.log('   - Data structure mismatch');
            console.log('=============== ORDER LOADING END (NO COMPANY DATA) ===============');
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
        
        // 2. Search by QR code
        { field: 'qrCode', value: searchQuery },
        
        // 3. Search by order ID (exact match)
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
}
