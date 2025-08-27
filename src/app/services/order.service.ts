import { Injectable } from '@angular/core';
import { Firestore, collection, query, where, getDocs, updateDoc, doc, Timestamp } from '@angular/fire/firestore';
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
      assignedCashierId: data.assignedCashierId,
      status: data.status,
      totalAmount: data.totalAmount || 0,
      vatAmount: data.vatAmount || 0,
      vatExemptAmount: data.vatExemptAmount || 0,
      discountAmount: data.discountAmount || 0,
      grossAmount: data.grossAmount || 0,
      netAmount: data.netAmount || 0,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
      message: data.message || ''
    } as Order;
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
