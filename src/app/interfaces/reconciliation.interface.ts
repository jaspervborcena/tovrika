// Reconciliation interfaces
export type ReconciliationIssueCode = 'NO_INVENTORY' | 'QTY_MISMATCH';
export type ReconciliationItemIssueCode = ReconciliationIssueCode | 'OK';

export interface ReconciliationInventoryRow {
  inventoryTrackingId: string;
  batchId: string | null;
  eventType: string | null;
  quantity: number | null;
  createdAt: string | null;
  deductedAt: string | null;
  itemCode: string | null;
  productCode: string | null;
  productId: string | null;
  productName: string | null;
  runningBalanceTotalStock: number | null;
  saleLineIndex: number | null;
  saleTrackingId: string | null;
  stockMovement: boolean | null;
}

export interface ReconciliationInvoiceItem {
  invoiceNumber: string;
  itemCode: string | null;
  productName: string | null;
  salesQty: number;
  salesAmount: number;
  salesLineCount: number;
  inventoryQty: number;
  quantityDifference: number;
  issueType: ReconciliationItemIssueCode;
  inventoryRows: ReconciliationInventoryRow[];
}

export interface ReconciliationInvoiceDetails {
  success: boolean;
  storeId: string;
  invoiceNumber: string;
  count: number;
  items: ReconciliationInvoiceItem[];
}

export interface ReconciliationDiscrepancy {
  invoiceNumber: string;
  storeId: string;
  storeName: string;
  orderDate: Date;

  trackingAmount: number;
  trackingQuantity: number;
  trackingItemCount: number;
  salesQuantity: number;
  inventoryQuantity: number;
  missingInventoryItemCount: number;
  quantityMismatchItemCount: number;
  issues: ReconciliationIssueCode[];
  severity: 'critical' | 'high';
  cashierName?: string;
}

export interface ReconciliationAuditLog {
  id?: string;
  orderId: string;
  invoiceNumber: string;
  storeId: string;
  performedBy: string;
  performedByName?: string;
  performedAt: Date;
  action: 'inventory_reprocess' | 'mark_reconciled' | 'flag_review';
  beforeState: {
    inventoryProcessed: boolean;
    needsReconciliation: boolean;
  };
  afterState: {
    inventoryProcessed: boolean;
    needsReconciliation: boolean;
  };
  success: boolean;
  error?: string;
  details?: any;
}

export interface ReconciliationValidation {
  canProcess: boolean;
  warnings: string[];
  errors: string[];
  currentStock?: { [productId: string]: number };
  requiredStock?: { [productId: string]: number };
}

export interface ReconciliationSummary {
  totalOrders: number;
  ordersWithDiscrepancies: number;
  criticalIssues: number;
  highIssues: number;
}
