import { Product } from './product.interface';

export interface Order {
  id?: string;
  companyId: string;
  storeId: string;
  branchId?: string;
  terminalId?: string;
  assignedCashierId: string;
  status: 'pending' | 'paid' | 'cancelled' | 'refunded';
  
  // Customer Information
  cashSale?: boolean;
  soldTo?: string;
  tin?: string;
  businessAddress?: string;
  
  // Invoice Information
  invoiceNumber?: string;
  logoUrl?: string;
  date?: Date;
  
  // Financial Calculations
  vatableSales?: number;
  vatAmount: number;
  zeroRatedSales?: number;
  vatExemptAmount: number;
  discountAmount: number;
  grossAmount: number;
  netAmount: number;
  totalAmount: number;
  
  // BIR and Legal Requirements
  exemptionId?: string;
  signature?: string;
  atpOrOcn: string; // Authority to Print or Official Control Number - Required
  birPermitNo: string; // BIR Permit Number - Required
  inclusiveSerialNumber: string; // Inclusive Serial Number Range - Required
  
  // System Fields
  createdAt: Date;
  message: string; // Receipt message - Required
}

export interface OrderDetail {
  id?: string;
  companyId: string;
  storeId: string;
  branchId?: string;
  orderId: string;
  items: OrderItem[];
  createdAt: Date;
}

export interface OrderItem {
  productId: string;
  productName?: string;
  quantity: number;
  price: number;
  total: number;
  vat: number;
  discount: number;
  isVatExempt: boolean;
}

export interface CartItem {
  productId: string;
  productName: string;
  skuId: string;
  quantity: number;
  sellingPrice: number;
  total: number;
  isVatApplicable: boolean;
  vatRate: number;
  vatAmount: number;
  hasDiscount: boolean;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  discountAmount: number;
  isVatExempt: boolean;
  imageUrl?: string;
}

export type ProductViewType = 'list' | 'grid' | 'custom' | 'bestsellers';

export interface ReceiptData {
  companyName: string;
  storeName: string;
  storeAddress: string;
  companyPhone: string;
  companyEmail: string;
  date: Date;
  orderId: string;
  items: CartItem[];
  vatAmount: number;
  vatExemptAmount: number;
  discountAmount: number;
  grossAmount: number;
  netAmount: number;
  message: string;
}

// Legacy interfaces for backward compatibility
export interface PosFeatures {
  viewMode: 'tile' | 'list';
  selectedCategory: string;
  searchQuery: string;
  categories: string[];
  products: Product[];
  searchResults: Product[];
  cart: {
    items: CartItem[];
    subtotal: number;
    tax: number;
    total: number;
  };
}

export interface Receipt {
  id: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: 'cash' | 'card';
  cashierId: string;
  storeId: string;
  createdAt: Date;
  status: 'completed' | 'cancelled' | 'void';
  orderNumber: string;
}
