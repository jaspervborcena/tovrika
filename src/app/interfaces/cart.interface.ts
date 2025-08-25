export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
  discount?: number;
  discountType?: 'percentage' | 'fixed';
}

export interface Cart {
  items: CartItem[];
  subtotal: number;
  tax: number;
  discount?: number;
  discountType?: 'percentage' | 'fixed';
  total: number;
  storeId: string;
}

export interface Receipt extends Cart {
  id: string;
  orderNumber: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'completed' | 'cancelled' | 'void';
  voidReason?: 'bad_order' | 'change_order';
  cashierId: string;
  paymentMethod: 'cash' | 'card' | 'other';
  customerInfo?: {
    name?: string;
    email?: string;
    phone?: string;
  };
}
