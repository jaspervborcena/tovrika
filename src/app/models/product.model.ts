export interface InventoryBatch {
  batchId: string;
  quantity: number;
  unitPrice: number;
  receivedAt: string; // ISO timestamp
  status: 'active' | 'inactive' | string;
}

export interface Product {
  id?: string;
  productName: string;
  skuId?: string;
  category?: string;
  totalStock?: number;
  sellingPrice?: number;
  companyId?: string;
  storeId?: string;
  isMultipleInventory?: boolean;
  isInventory?: boolean;
  barcodeId?: string;
  imageUrl?: string;
  isVatApplicable?: boolean;
  vatRate?: number;
  hasDiscount?: boolean;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  inventory?: InventoryBatch[];
}
