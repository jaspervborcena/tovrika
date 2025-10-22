import { SyncStatus } from './product-inventory-entry.interface';

export interface OrderDetails {
  id?: string;
  orderId: string;
  storeId: string;
  companyId: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  
  // User tracking
  createdBy: string; // uid
  updatedBy: string; // uid
  
  // Offline and sync support
  isOffline: boolean;
  syncStatus: SyncStatus;
  batchNumber: number; // Sequential order batch number
  
  // Order items with detailed tracking
  items: OrderDetailItem[];
  
  // Financial summary
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  
  // Sync and adjustment tracking
  lastSyncAt?: Date;
  adjustmentRequired?: boolean;
  adjustmentNotes?: string;
  originalTotal?: number; // Original total before any adjustments
  
  // Offline-specific fields
  offlineTimestamp?: Date;
  onlineProcessedAt?: Date;
  syncAttempts?: number;
  syncErrors?: string[];
}

export interface OrderDetailItem {
  productId: string;
  productName: string;
  productSku?: string;
  
  // Quantity and pricing
  quantity: number;
  price: number; // Current selling price from product (not batch cost)
  total: number;
  
  // Tax and discounts
  discount: number;
  isVatExempt: boolean;
  vat: number;
  vatRate?: number;
  
  // Batch deduction tracking (FIFO implementation)
  batchDeductions: BatchDeductionDetail[];
  
  // Sync status per item
  syncStatus: SyncStatus;
  adjustmentRequired?: boolean;
  
  // Expected vs actual deductions (for sync validation)
  expectedDeductions?: BatchDeductionDetail[];
  actualDeductions?: BatchDeductionDetail[];
  discrepancy?: {
    type: 'QUANTITY_MISMATCH' | 'BATCH_UNAVAILABLE' | 'PRICE_DIFFERENCE';
    expectedQuantity: number;
    actualQuantity: number;
    notes?: string;
  };
}

export interface BatchDeductionDetail {
  batchId: string;
  batchNumber?: string;
  quantity: number;
  batchUnitPrice?: number; // For reference, but use product selling price
  deductedAt?: Date;
  
  // Sync tracking
  isOffline?: boolean;
  synced?: boolean;
  syncError?: string;
}

// Supporting interfaces for offline order management
export interface OfflineOrderQueue {
  id: string;
  orderDetails: OrderDetails;
  queuedAt: Date;
  retryCount: number;
  lastRetryAt?: Date;
  status: 'QUEUED' | 'PROCESSING' | 'FAILED' | 'SYNCED';
  errorMessage?: string;
}

export interface SyncResult {
  orderId: string;
  success: boolean;
  syncStatus: SyncStatus;
  adjustmentRequired: boolean;
  discrepancies?: ItemDiscrepancy[];
  message?: string;
  errorDetails?: string;
}

export interface ItemDiscrepancy {
  productId: string;
  productName: string;
  expectedQuantity: number;
  actualQuantity: number;
  missingQuantity: number;
  affectedBatches: string[];
  recommendedAction: 'MANUAL_ADJUSTMENT' | 'INVENTORY_RECOUNT' | 'CANCEL_ORDER';
}

// Validation interfaces
export interface StockValidation {
  isValid: boolean;
  availableStock: number;
  requestedQuantity: number;
  availableBatches: {
    batchId: string;
    quantity: number;
    createdAt: Date;
    unitPrice: number;
  }[];
  warnings?: string[];
  errors?: string[];
}

export interface FIFODeductionPlan {
  productId: string;
  totalQuantityNeeded: number;
  batchAllocations: {
    batchId: string;
    allocatedQuantity: number;
    remainingInBatch: number;
    batchOrder: number; // Order in FIFO sequence
  }[];
  canFulfill: boolean;
  shortfall?: number;
}