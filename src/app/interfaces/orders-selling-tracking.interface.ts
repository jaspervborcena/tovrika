import {OrderDetailsStatus} from './order-details.interface';
/**
 * Document structure for ordersSellingTracking collection
 * Fields requested: batchNumber, companyId, createdAt, createdBy, orderId, status,
 * storeId, uid, updatedAt, updatedBy, itemIndex, productId, productName, price,
 * quantity, discount, discountType, vat, total, isVatExempt
 */
export interface OrdersSellingTrackingDoc {
  id?: string;
  batchNumber?: number;
  companyId: string;
  createdAt: Date;
  createdBy: string; // uid of creator
  orderId: string;
  status: OrderDetailsStatus | string;
  storeId: string;
  uid?: string; // convenience alias for createdBy (used in security rules)
  updatedAt?: Date;
  updatedBy?: string;

  // Item-level fields
  itemIndex?: number; // index of the item within the order
  orderDetailsId?: string; // reference to the orderDetails document for this line
  productId: string;
  productName?: string;
  productCode: string;
  skuId: string;
  cost:number;
  price: number; // unit price
  quantity: number;
  discount?: number; // absolute discount amount
  discountType?: 'percentage' | 'fixed' | 'none' | string;
  vat?: number; // VAT amount for this line
  total: number; // line total after discounts and tax
  isVatExempt?: boolean;
  
  // Product stock tracking
  runningBalanceTotalStock?: number; // Product's totalStock at transaction time
  isStockTracked?: boolean; // Whether product stock is tracked (from products.isStockTracked)

  // Offline metadata (added when captured offline)
  _offlineCreated?: boolean;
  _offlineId?: string;

  // Legacy / optional cashier fields
  cashierId?: string;
  cashierEmail?: string;
  cashierName?: string;
}
