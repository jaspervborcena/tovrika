import { BusinessType } from './company.interface';

export enum ProductStatus {
  Active = 'active',
  Inactive = 'inactive',
  Expired = 'expired'
}

export interface Product {
  id?: string;
  uid: string;  // User ID for security rules
  productName: string;
  description?: string;
  skuId: string;
  productCode?: string;  // Additional product identifier
  unitType: string;
  category: string;
  totalStock: number;
  originalPrice: number;
  sellingPrice: number;
  companyId: string;
  storeId: string;
  barcodeId?: string;
  imageUrl?: string;
  /**
   * Tags for product differentiation (e.g., size, color, variant).
   * Used to differentiate products with same name but different characteristics.
   * Example: ['Large', 'Venti', 'Red', 'XL']
   */
  tags?: string[]; // Tag IDs
  tagLabels?: string[]; // Denormalized tag labels for quick display without loading productTags collection
  /**
   * Mark product as favorite for quicker access in POS Favorites tab.
   * Optional to keep backward compatibility; defaults to false when missing.
   */
  isFavorite?: boolean;
  /**
   * Deprecated: inventory is managed in productInventory collection.
   * Kept optional for backward compatibility during migration.
   */
  // inventory?: ProductInventory[];
  
  // Tax and Discount Fields
  isVatApplicable: boolean;
  vatRate?: number; // percentage
  hasDiscount: boolean;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  
  // Price and Quantity Tracking
  // priceHistory?: PriceChange[];
  // quantityAdjustments removed: tracking moved to productInventoryEntries and deduction history
  
  status?: ProductStatus;
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
  status: ProductStatus;
  unitType?: string;  // Added to match Firestore structure
  // VAT fields for batch-level taxation (optional)
  isVatApplicable: boolean;
  vatRate?: number; // percentage
  hasDiscount: boolean;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
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
