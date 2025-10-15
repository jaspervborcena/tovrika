import { BusinessType } from './company.interface';

export interface Product {
  id?: string;
  productName: string;
  description?: string;
  skuId: string;
  unitType: string;
  category: string;
  totalStock: number;
  sellingPrice: number;
  companyId: string;
  storeId: string;
  isMultipleInventory: boolean;
  barcodeId?: string;
  imageUrl?: string;
  inventory: ProductInventory[];
  
  // Tax and Discount Fields
  isVatApplicable: boolean;
  vatRate: number; // percentage
  hasDiscount: boolean;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  
  // Price and Quantity Tracking
  priceHistory?: PriceChange[];
  quantityAdjustments?: QuantityAdjustment[];
  
  status?: 'active' | 'inactive';
  createdAt?: Date;
  updatedAt?: Date;
  lastUpdated?: Date;
}

export interface PriceChange {
  oldPrice: number;
  newPrice: number;
  changeType: 'increase' | 'decrease' | 'initial';
  changeAmount: number;
  changePercentage: number;
  changedAt: Date;
  changedBy: string;  // uid
  changedByName: string;
  reason?: string;
  batchId?: string;  // If price change is for specific batch
}

export interface QuantityAdjustment {
  batchId: string;
  oldQuantity: number;
  newQuantity: number;
  adjustmentType: 'manual' | 'sale' | 'return' | 'damage' | 'restock' | 'transfer';
  adjustedAt: Date;
  adjustedBy: string;  // uid
  adjustedByName: string;
  reason?: string;
  notes?: string;
}

export interface ProductInventory {
  batchId: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  receivedAt: Date;
  expiryDate?: Date;
  supplier?: string;
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

// Unit type constants for products
export const UNIT_TYPES = [
  { value: 'N/A', label: 'N/A' },
  { value: 'pieces', label: 'Pieces' },
  { value: 'kg', label: 'Kilograms' },
  { value: 'grams', label: 'Grams' },
  { value: 'liters', label: 'Liters' },
  { value: 'ml', label: 'Milliliters' },
  { value: 'meters', label: 'Meters' },
  { value: 'cm', label: 'Centimeters' },
  { value: 'boxes', label: 'Boxes' },
  { value: 'packs', label: 'Packs' },
  { value: 'bottles', label: 'Bottles' },
  { value: 'cans', label: 'Cans' },
  { value: 'units', label: 'Units' }
] as const;

export type UnitType = typeof UNIT_TYPES[number]['value'];
