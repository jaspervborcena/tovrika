import { Product } from './product.interface';

export enum ReceiptValidityNotice {
  BIR_ACCREDITED = 'This serves as your invoice.',
  NON_ACCREDITED = 'This receipt serves as a sales acknowledgment receipt.This document is not valid for claim of input tax.'
}

export interface OrderStatusHistoryEntry {
  status: string;
  changedAt: Date | string;
  changedBy: string;
  reason?: string;
}

export interface Order {
  id?: string;
  /** Optional orderId coming from BigQuery / Cloud Function (documentId in storage) */
  orderId?: string;
  companyId: string;
  storeId: string;
  branchId?: string;
  terminalId?: string;
  assignedCashierId: string;
  // Status can come from various data sources (Firestore, BigQuery). Keep as string to
  // preserve source-specific values like 'completed' while older code may expect specific values.
  status: string;
  
  // Status tracking
  statusHistory?: OrderStatusHistoryEntry[];
  statusTags?: string[];
  
  // Customer Information
  cashSale?: boolean;
  chargeSale?: boolean;
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
  // Optional items array (orderDetails may be attached from API or fetched separately)
  items?: OrderItem[];
}

// Ledger entry for order-level accounting events (order, return, refund, cancel, damage)
export interface OrderAccountingLedger {
  id?: string;
  companyId: string;
  storeId: string;
  orderId: string;
  // Event type describing the kind of ledger entry
  eventType: 'order' | 'returned' | 'refunded' | 'cancelled' | 'damaged';

  // Monetary and quantity impact of this event (cumulative for the day)
  amount: number;
  quantity: number;

  // Running balances immediately after this event is applied
  runningBalanceAmount: number;
  runningBalanceQty: number;
  // Running balance for 'order' events only (cumulative across orders)
  runningBalanceOrderQty?: number;

  // Audit fields
  createdAt: Date;
  createdBy?: string;
  updatedAt: Date;
  updatedBy?: string;
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
  originalPrice?: number;
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
  tags?: string[]; // Product tag IDs
  tagLabels?: string[]; // Product tag labels for display
  // Per-item customer fields (optional)
  pwdId?: string;
  customerName?: string;
  customerDiscount?: string; // e.g., 'PWD'|'SENIOR' or empty
  customerDiscountType?: string; // internal marker for applied discount
  // Identification type (optional) - e.g., SSS, UMID, DriverLicense, Passport
  idType?: string;
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

export type ProductViewType = 'list' | 'grid' | 'custom' | 'bestsellers' | 'favorites';

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

export interface CartItemTaxDiscount {
  isVatApplicable: boolean;
  vatRate?: number;
  hasDiscount: boolean;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  // Calculated values
  subtotalBeforeDiscount: number;
  discountAmount: number;
  subtotalAfterDiscount: number;
  vatAmount: number;
  finalTotal: number;
}

export interface CartItemDetailsDialog {
  item: CartItem;
  onUpdate: (updatedItem: CartItem) => void;
  onClose: () => void;
}
