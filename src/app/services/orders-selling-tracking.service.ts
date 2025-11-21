import { Injectable, inject } from '@angular/core';
import { Firestore, collection, query, where, getDocs, doc, setDoc } from '@angular/fire/firestore';
import { toDateValue } from '../core/utils/date-utils';
import { OfflineDocumentService } from '../core/services/offline-document.service';
import { OrdersSellingTrackingDoc } from '../interfaces/orders-selling-tracking.interface';
import { ProductService } from './product.service';

@Injectable({ providedIn: 'root' })
export class OrdersSellingTrackingService {
  private readonly offlineDocService = inject(OfflineDocumentService);
  constructor(
    private firestore: Firestore,
    private productService: ProductService
  ) {}

  /**
  * Mark all ordersSellingTracking docs for a given orderId from 'processing' to 'completed'.
   * Will attempt an online write that preserves the original createdAt as updatedAt when possible
   * so that updatedAt matches createdAt instead of being a serverTimestamp sentinel map.
   */
  async markOrderTrackingCompleted(orderId: string, completedBy?: string): Promise<{ updated: number; errors: any[] }> {
    const errors: any[] = [];
    let updated = 0;
    try {
      const q = query(collection(this.firestore, 'ordersSellingTracking'), where('orderId', '==', orderId), where('status', '==', 'processing'));
      const snaps = await getDocs(q as any);
      for (const s of snaps.docs) {
        const id = s.id;
        const data: any = s.data() || {};
        const createdAt = data.createdAt;
        const updates: any = {
          status: 'completed',
          updatedBy: completedBy || data.createdBy || 'system'
        };

        try {
          // If we have a concrete createdAt and we are online and the doc ID is not a temp id,
          // write updatedAt equal to createdAt so both timestamps match (avoids serverTimestamp map in the field).
          if (navigator.onLine && !id.startsWith('temp_') && (createdAt instanceof Date || typeof createdAt === 'string' || typeof createdAt === 'number')) {
            updates.updatedAt = createdAt;
            const ref = doc(this.firestore, 'ordersSellingTracking', id);
            // Use setDoc with merge to avoid overriding other fields
            await setDoc(ref as any, updates as any, { merge: true } as any);
          } else {
            // Fallback: use offlineDocService.updateDocument which will handle offline queuing and timestamps
            await this.offlineDocService.updateDocument('ordersSellingTracking', id, updates);
          }
          updated++;
        } catch (e) {
          errors.push({ id, error: e });
        }
      }
    } catch (e) {
      errors.push({ id: 'query', error: e });
    }

    return { updated, errors };
  }

  /**
   * Log a batch of sale items for later reconciliation and apply stock deltas to products.
   * Best-effort per item; continues on individual failures, returns summary.
   */
  async logSaleAndAdjustStock(
    ctx: {
      companyId: string;
      storeId: string;
      orderId: string;
      invoiceNumber?: string;
      cashierId: string;
      cashierEmail?: string;
      cashierName?: string;
    },
    items: Array<{
      productId: string;
      productName?: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
      // Optional fields supported for richer tracking
      discount?: number;
      discountType?: 'percentage' | 'fixed' | 'none' | string;
      vat?: number;
      isVatExempt?: boolean;
      batchNumber?: number;
    }>
  ): Promise<{ success: boolean; tracked: number; adjusted: number; errors: Array<{ productId: string; error: any }> }> {
    const colName = 'ordersSellingTracking';
    const errors: Array<{ productId: string; error: any }> = [];
    let tracked = 0;
    let adjusted = 0;

    let idx = 0;
    for (const it of items) {
      const docData: OrdersSellingTrackingDoc = {
        companyId: ctx.companyId,
        storeId: ctx.storeId,
        orderId: ctx.orderId,
        // Use provided invoiceNumber where available
        // batchNumber defaults to 1 for now (can be set by caller)
        batchNumber: (it as any).batchNumber || 1,
        createdAt: new Date(),
        createdBy: ctx.cashierId,
        uid: ctx.cashierId,
        status: 'processing',

        // item details
        itemIndex: idx,
  orderDetailsId: (it as any).orderDetailsId || undefined,
        productId: it.productId,
        productName: it.productName,
        price: it.unitPrice,
        quantity: it.quantity,
        // Defaults for fields not provided by caller
        discount: (it as any).discount ?? 0,
        discountType: (it as any).discountType ?? 'none',
        vat: (it as any).vat ?? 0,
        total: it.lineTotal,
        isVatExempt: !!((it as any).isVatExempt),

        // legacy cashier info
        cashierId: ctx.cashierId,
        cashierEmail: ctx.cashierEmail,
        cashierName: ctx.cashierName
      } as OrdersSellingTrackingDoc;

      try {
        await this.offlineDocService.createDocument(colName, docData as any);
        tracked++;
      } catch (e) {
        errors.push({ productId: it.productId, error: e });
      }

      // Apply delta to product totalStock immediately (optimistic)
      try {
        const product = this.productService.getProduct(it.productId);
        const current = product?.totalStock ?? 0;
        const newTotal = Math.max(0, current - it.quantity);
        try {
          await this.productService.updateProduct(it.productId, {
            totalStock: newTotal,
            lastUpdated: new Date()
          } as any);

          console.log(`✅ Adjusted product ${it.productId} stock: ${current} -> ${newTotal}`);
          adjusted++;
        } catch (updateErr) {
          console.error(`⚠️ Failed to update product ${it.productId} totalStock. current=${current} calculatedNew=${newTotal}`, updateErr);
          errors.push({ productId: it.productId, error: updateErr });
        }
      } catch (e) {
        errors.push({ productId: it.productId, error: e });
      }
    }

    return { success: errors.length === 0, tracked, adjusted, errors };
  }

  /**
   * Fetch tracking entries for an order directly from Firestore as a fallback when Cloud Function is unavailable.
   */
  async fetchTrackingEntries(orderId: string): Promise<any[]> {
    try {
      const q = query(collection(this.firestore, 'ordersSellingTracking'), where('orderId', '==', orderId));
      const snaps = await getDocs(q as any);
      if (!snaps || snaps.empty) return [];

      const results: any[] = [];
      for (const s of snaps.docs) {
        const data: any = s.data() || {};
        const product = this.productService.getProduct(data.productId);
        results.push({
          id: s.id,
          productId: data.productId,
          productName: data.productName || product?.productName || '',
          sku: product?.skuId || undefined,
          quantity: data.quantity,
          price: data.price,
          total: data.total,
          status: data.status,
          createdAt: toDateValue(data.createdAt) || undefined,
          updatedAt: toDateValue(data.updatedAt) || undefined,
          orderDetailsId: data.orderDetailsId,
          batchNumber: data.batchNumber,
          cashierId: data.cashierId || data.createdBy
        });
      }
      return results;
    } catch (e) {
      return [];
    }
  }
}
