import { Product } from './product.interface';

export enum ReceiptValidityNotice {
  BIR_ACCREDITED = 'This serves as your official receipt.',
  NON_ACCREDITED = 'This receipt serves as a sales acknowledgment and is not valid for BIR audit purposes.'
}

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
  
  // Company Information
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyTaxId?: string;
  companyEmail?: string;
  
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
  unitType?: string; // Added for display like "1 pc(s)", "2 boxes"
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

export interface OrderDiscount {
  type: 'PWD' | 'SENIOR' | 'CUSTOM';
  percentage?: number;
  fixedAmount?: number;
  exemptionId: string; // PWD-ID or Senior-ID or Custom ID
  customerName: string;
  signature?: string;
  customType?: string; // For custom discount types like "Owner", "Friend", etc.
}

export interface CartSummary {
  itemCount: number;
  totalQuantity: number;
  vatableSales: number;
  vatAmount: number;
  zeroRatedSales: number;
  vatExemptSales: number;
  productDiscountAmount: number;
  orderDiscountAmount: number;
  grossAmount: number;
  netAmount: number;
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
  validityNotice?: string; // BIR validity notice based on accreditation status
  orderDiscount?: OrderDiscount; // Added order discount information
  customerName?: string; // Added customer name
  customerAddress?: string; // Added customer address
  customerTin?: string; // Added customer TIN
  cashier?: string; // Added cashier name
  receiptDate?: Date; // Added receipt date
  subtotal?: number; // Added subtotal
  totalAmount?: number; // Added total amount
  vatRate?: number; // Added VAT rate
  vatExempt?: number; // Added VAT exempt amount
  discount?: number; // Added discount amount
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
