import { BusinessType } from './company.interface';

export interface Product {
  id?: string;
  productName: string;
  skuId: string;
  category: string;
  totalStock: number;
  sellingPrice: number;
  companyId: string;
  storeId: string;
  isMultipleInventory: boolean;
  barcodeId?: string;
  qrCode?: string;
  imageUrl?: string;
  inventory: ProductInventory[];
  status?: 'active' | 'inactive';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProductInventory {
  batchId: string;
  quantity: number;
  unitPrice: number;
  receivedAt: Date;
  status: 'active' | 'inactive' | 'expired';
}

// Legacy interfaces for backward compatibility
export interface InventorySettings {
  trackInventory: boolean;
  stockQuantity: number;
  lowStockAlert?: number;
  unit?: string; // 'pieces', 'grams', 'ml', 'hours', etc.
  cost?: number;
}

export interface BusinessTypeSettings {
  // Restaurant specific
  ingredients?: Ingredient[];
  isComboMeal?: boolean;
  comboItems?: string[]; // Product IDs for combo meals
  
  // Service specific (car wash, etc.)
  duration?: number; // Service duration in minutes
  requiresEquipment?: boolean;
  
  // General
  taxable: boolean;
  taxRate?: number;
}

export interface Ingredient {
  ingredientId: string;
  name: string;
  quantity: number;
  unit: string; // 'grams', 'ml', etc.
}

export type ProductType = 
  | 'product'      // Physical item
  | 'service'      // Service (non-inventory)
  | 'combo'        // Bundle/meal
  | 'ingredient';  // Raw material/ingredient

export interface ProductCategory {
  id: string;
  name: string;
  businessType: BusinessType;
  color?: string;
  sortOrder: number;
}
