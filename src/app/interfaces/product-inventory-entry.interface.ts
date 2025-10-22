export type InventoryStatus = 'active' | 'inactive' | 'removed' | 'expired';
export type SyncStatus = 'PENDING' | 'SYNCED' | 'PENDING_ADJUSTMENT' | 'CONFLICT';

export interface ProductInventoryEntry {
  id?: string;
  // ownership and linkage
  productId: string;
  companyId: string;
  storeId: string;
  uid: string; // creator/editor uid

  // batch details
  batchId: string;
  quantity: number;
  initialQuantity?: number; // Original quantity for tracking deductions
  unitPrice: number;
  costPrice?: number;
  receivedAt: Date; // stored as Firestore Timestamp
  expiryDate?: Date; // stored as Firestore Timestamp
  supplier?: string;
  status: InventoryStatus;
  unitType?: string;

  // FIFO and batch tracking
  batchNumber?: number; // Sequential batch number for sorting
  lotNumber?: string; // Manufacturing lot number
  
  // Offline and sync support
  syncStatus?: SyncStatus;
  isOffline?: boolean; // Created while offline
  pendingDeductions?: number; // Quantity pending deduction from offline orders
  lastSyncAt?: Date;
  adjustmentRequired?: boolean; // Flag for manual review
  adjustmentNotes?: string;
  
  // Enhanced audit trail
  createdAt?: Date; // server timestamp
  updatedAt?: Date; // server timestamp
  createdBy?: string; // uid of creator
  updatedBy?: string; // uid of last updater
  
  // Deduction tracking
  totalDeducted?: number; // Total amount deducted from this batch
  deductionHistory?: BatchDeduction[]; // Track individual deductions
}

export interface BatchDeduction {
  orderId: string;
  orderDetailId: string;
  quantity: number;
  deductedAt: Date;
  deductedBy: string;
  isOffline: boolean;
  syncStatus: SyncStatus;
}
