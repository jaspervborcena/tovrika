// Reconciliation interfaces
export interface ReconciliationDiscrepancy {
  invoiceNumber: string;
  orderId: string;
  storeId: string;
  storeName: string;
  orderDate: Date;
  
  // Tracking data (from ordersSellingTracking)
  trackingAmount: number;
  trackingQuantity: number;
  trackingItemCount: number;
  trackingExists: boolean;
  
  // Inventory processing status
  inventoryProcessed: boolean;
  fifoSkipped: boolean;
  
  // Order flags
  isOfflineOrder: boolean;
  needsInventoryReprocess: boolean;
  
  // Severity and priority
  severity: 'critical' | 'warning' | 'info';
  priority: number; // 1 (highest) to 5 (lowest)
  
  // Recommended actions
  reconciliationActions: ReconciliationAction[];
  
  // Additional context
  orderDetails?: any;
  cashierName?: string;
}

export interface ReconciliationAction {
  type: 'reprocess_inventory' | 'mark_reconciled';
  description: string;
  canAutomate: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  estimatedDuration?: string;
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
  warningIssues: number;
  offlineOrders: number;
  unreconciledOrders: number;
}
