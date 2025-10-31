export type ReconciliationStatus = 'pending' | 'reconciled' | 'error';

export interface OrdersSellingTrackingDoc {
  id?: string;
  companyId: string;
  storeId: string;
  orderId: string;
  invoiceNumber?: string;
  productId: string;
  productName?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  cashierId: string;
  cashierEmail?: string;
  cashierName?: string;
  status: ReconciliationStatus;
  createdAt: Date;
}
export interface OrdersSellingTracking {
  id?: string;
  companyId: string;
  storeId: string;
  productId: string;
  quantity: number;
  soldAt: Date;
  orderId?: string;
  cashierId?: string;
  cashierEmail?: string;
  cashierName?: string;
  createdAt?: Date;
}
