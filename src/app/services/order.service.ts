import { Injectable } from '@angular/core';
import { Firestore, collection, query, where, getDocs, updateDoc, doc, Timestamp, orderBy, limit } from '@angular/fire/firestore';
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
      console.log('📅 Loading recent orders - Company:', companyId, 'Store:', storeId, 'Limit:', limitCount);
      
      const ordersRef = collection(this.firestore, 'orders');
      
      // Calculate date range: last 48 hours (today + yesterday)
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - (48 * 60 * 60 * 1000));
      const startTs = Timestamp.fromDate(twoDaysAgo);
      
      console.log('📅 Date range from:', twoDaysAgo.toISOString(), 'to now');
      
      // Build query based on whether we have a specific store
      let q;
      if (storeId) {
        q = query(
          ordersRef,
          where('companyId', '==', companyId),
          where('storeId', '==', storeId),
          where('createdAt', '>=', startTs),
          orderBy('createdAt', 'desc'),
          limit(limitCount)
        );
      } else {
        q = query(
          ordersRef,
          where('companyId', '==', companyId),
          where('createdAt', '>=', startTs),
          orderBy('createdAt', 'desc'),
          limit(limitCount)
        );
      }
      
      const snapshot = await getDocs(q);
      const results = snapshot.docs.map(d => this.transformDoc(d));
      
      console.log('✅ Loaded recent orders:', results.length);
      return results;
    } catch (error) {
      console.error('❌ Error loading recent orders:', error);
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
    const ordersRef = collection(this.firestore, 'orders');
    // detect date in YYYYMMDD
    const dateMatch = /^\d{8}$/.test(queryStr);
    try {
      let q;
      if (dateMatch) {
        const year = Number(queryStr.slice(0, 4));
        const month = Number(queryStr.slice(4, 6)) - 1;
        const day = Number(queryStr.slice(6, 8));
        const start = new Date(year, month, day, 0, 0, 0);
        const end = new Date(year, month, day, 23, 59, 59);
        const startTs = Timestamp.fromDate(start);
        const endTs = Timestamp.fromDate(end);
        if (storeId) {
          q = query(ordersRef, where('companyId', '==', companyId), where('storeId', '==', storeId), where('createdAt', '>=', startTs), where('createdAt', '<=', endTs));
        } else {
          q = query(ordersRef, where('companyId', '==', companyId), where('createdAt', '>=', startTs), where('createdAt', '<=', endTs));
        }
      } else {
        // try matching orderNumber or invoice
        if (storeId) {
          q = query(ordersRef, where('companyId', '==', companyId), where('storeId', '==', storeId), where('orderNumber', '==', queryStr));
        } else {
          q = query(ordersRef, where('companyId', '==', companyId), where('orderNumber', '==', queryStr));
        }
      }

      if (statusFilter && q) {
        // Firestore doesn't allow adding where to an existing query variable directly, so rebuild
        const base = collection(this.firestore, 'orders');
        if (dateMatch) {
          // already built with createdAt, include status
        }
      }

      const snap = await getDocs(q);
      return snap.docs.map(d => this.transformDoc(d));
    } catch (error) {
      console.error('Error searching orders:', error);
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
}
