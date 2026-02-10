/**
 * Event types for inventory tracking records
 */
export type InventoryEventType = 'completed' | 'damage' | 'restock' | 'update';

/**
 * Old data structure for tracking changes during updates
 */
export interface InventoryOldData {
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  originalPrice: number;
}

/**
 * Interface for inventory tracking records in Firestore
 * Tracks all inventory movements (deductions, damages, restocks)
 */
export interface InventoryTracking {
  // Identifiers
  id?: string;
  refId?: string; // Reference to productInventory document
  
  // Event information
  eventType: InventoryEventType; // Type of inventory event
  
  // Product information
  productId: string;
  productName?: string;
  productCode?: string;
  skuId?: string;
  
  // Batch information
  batchId?: string | null;
  batchNumber?: string;
  
  // Company/Store context
  companyId: string;
  storeId: string;
  
  // Order context (for completed/damage events)
  orderId?: string;
  orderDetailId?: string;
  invoiceNumber?: string;
  
  // Quantity and stock tracking
  quantity: number; // Quantity deducted/damaged/added
  totalStock?: number; // Product's totalStock at time of event (deprecated)
  runningBalanceTotalStock?: number; // Product's totalStock at time of event
  
  // Pricing
  costPrice?: number; // Unit cost price from batch
  sellingPrice?: number; // Product selling price (for update events)
  originalPrice?: number; // Product original price (for update events)
  
  // Old data (for update events only)
  oldData?: InventoryOldData;
  
  // Timestamps
  deductedAt?: Date; // For completed/damage events
  createdAt: Date;
  
  // Audit trail
  deductedBy?: string; // User who performed the action
  createdBy?: string; // User who created the record
  
  // Additional metadata
  note?: string;
  
  // Sync status (for offline support)
  isOffline?: boolean;
  syncStatus?: 'SYNCED' | 'PENDING' | 'ERROR';
  _offlineCreated?: boolean;
}

/**
 * Partial type for creating new inventory tracking records
 */
export type CreateInventoryTracking = Omit<InventoryTracking, 'id' | 'createdAt'> & {
  createdAt?: Date;
};
