export type ReconciliationAction = 'deduct' | 'skip' | 'error';

export interface ReconciliationLogEntry {
  id?: string;
  trackingId: string; // Reference to OrdersSellingTrackingDoc id
  companyId: string;
  storeId: string;
  orderId: string;
  productId: string;
  quantityProcessed: number; // Quantity actually deducted during FIFO
  batchesUsed: Array<{
    batchId: string;
    quantity: number;
  }>;
  action: ReconciliationAction;
  message?: string;
  createdAt: Date;
}
export interface ReconciliationLogItemSummary {
  productId: string;
  soldQuantity: number;
  batchesDeducted: Array<{ batchId: string; quantity: number }>;
}

export interface ReconciliationLog {
  id?: string;
  companyId: string;
  storeId?: string;
  date: string; // YYYY-MM-DD for idempotency
  status: 'pending' | 'success' | 'partial' | 'failed';
  processedAt?: Date;
  items?: ReconciliationLogItemSummary[];
  error?: string;
}
