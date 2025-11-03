import { Injectable, inject } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
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
    items: Array<{ productId: string; productName?: string; quantity: number; unitPrice: number; lineTotal: number }>
  ): Promise<{ success: boolean; tracked: number; adjusted: number; errors: Array<{ productId: string; error: any }> }> {
    const colName = 'ordersSellingTracking';
    const errors: Array<{ productId: string; error: any }> = [];
    let tracked = 0;
    let adjusted = 0;

    for (const it of items) {
      const docData: OrdersSellingTrackingDoc = {
        companyId: ctx.companyId,
        storeId: ctx.storeId,
        orderId: ctx.orderId,
        invoiceNumber: ctx.invoiceNumber,
        productId: it.productId,
        productName: it.productName,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        lineTotal: it.lineTotal,
        cashierId: ctx.cashierId,
        cashierEmail: ctx.cashierEmail,
        cashierName: ctx.cashierName,
        // Include uid for Firestore rules compatibility
        // Aligns with existing rule pattern that validates request.resource.data.uid == request.auth.uid on create
        // Here we equate uid = cashierId
        // (Admin writes from Cloud Functions bypass rules)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...( { uid: ctx.cashierId } as any ),
        status: 'pending',
        createdAt: new Date()
      };

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
}
