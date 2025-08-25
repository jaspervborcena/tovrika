export interface CustomerViewSession {
  id: string;
  companyId: string;
  storeId: string;
  branchId: string;
  cashierId: string;
  cart: LiveCartItem[];
  totals: CartTotals;
  status: 'active' | 'processing' | 'completed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

export interface LiveCartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
  discount?: number;
  discountType?: 'percentage' | 'fixed';
  notes?: string;
}

export interface CartTotals {
  subtotal: number;
  discount: number;
  tax: number;
  evat: number;
  total: number;
}

export interface Receipt {
  id: string;
  orderNumber: string;
  companyId: string;
  storeId: string;
  branchId: string;
  cashierId: string;
  customerId?: string;
  items: ReceiptItem[];
  totals: CartTotals;
  paymentMethod: PaymentMethod;
  status: ReceiptStatus;
  notes?: string;
  createdAt: Date;
  printedAt?: Date;
  voidedAt?: Date;
  voidReason?: string;
}

export interface ReceiptItem extends LiveCartItem {
  sku?: string;
  category?: string;
}

export interface PaymentMethod {
  type: 'cash' | 'card' | 'mobile' | 'split';
  amountTendered: number;
  change: number;
  details?: {
    cardLast4?: string;
    mobileProvider?: string;
    referenceNumber?: string;
  };
}

export type ReceiptStatus = 
  | 'pending' 
  | 'completed' 
  | 'cancelled' 
  | 'voided' 
  | 'rejected';
