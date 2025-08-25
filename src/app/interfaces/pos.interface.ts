import { Product } from './product.interface';

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

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
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
