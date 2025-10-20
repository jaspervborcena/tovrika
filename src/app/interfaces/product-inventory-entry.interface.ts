export type InventoryStatus = 'active' | 'inactive' | 'removed' | 'expired';

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
  unitPrice: number;
  costPrice?: number;
  receivedAt: Date; // stored as Firestore Timestamp
  expiryDate?: Date; // stored as Firestore Timestamp
  supplier?: string;
  status: InventoryStatus;
  unitType?: string;

  // audit
  createdAt?: Date; // server timestamp
  updatedAt?: Date; // server timestamp
}
