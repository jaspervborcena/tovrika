import { CartItem, CartSummary, OrderDiscount } from '../interfaces/pos.interface';
import { Product } from '../interfaces/product.interface';

export function calculateCartSummary(
  items: CartItem[],
  orderDiscount: OrderDiscount | null,
  getProduct: (productId: string) => Product | undefined
): CartSummary {
  const grossAmount = items.reduce((sum, item) => sum + item.sellingPrice * item.quantity, 0);
  const productDiscountAmount = items.reduce((sum, item) => sum + item.discountAmount, 0);
  const subtotalAfterProductDiscounts = grossAmount - productDiscountAmount;

  const effectiveForItem = (item: CartItem) => {
    try {
      const product = getProduct(item.productId);
      return {
        isVatApplicable: product?.isVatApplicable ?? item.isVatApplicable,
        vatRate: Number(product?.vatRate ?? item.vatRate ?? 0),
        originalPrice: Number(product?.originalPrice ?? product?.sellingPrice ?? item.originalPrice ?? item.sellingPrice ?? 0)
      };
    } catch {
      return {
        isVatApplicable: item.isVatApplicable,
        vatRate: Number(item.vatRate || 0),
        originalPrice: Number(item.originalPrice ?? item.sellingPrice ?? 0)
      };
    }
  };

  const vatableSales = items.reduce((sum, item) => {
    const effective = effectiveForItem(item);
    if (!effective.isVatApplicable) return sum;
    const baseTotal = effective.originalPrice * Number(item.quantity || 0) - Number(item.discountAmount || 0);
    return sum + Math.max(0, baseTotal);
  }, 0);

  const vatExemptSales = items.reduce((sum, item) => {
    const effective = effectiveForItem(item);
    if (effective.isVatApplicable) return sum;
    const baseTotal = effective.originalPrice * Number(item.quantity || 0) - Number(item.discountAmount || 0);
    return sum + Math.max(0, baseTotal);
  }, 0);

  const vatAmount = items.reduce((sum, item) => {
    const effective = effectiveForItem(item);
    if (!effective.isVatApplicable || effective.vatRate <= 0) return sum;
    const quantity = Number(item.quantity || 0);
    const subtotal = Math.max(0, effective.originalPrice * quantity - Number(item.discountAmount || 0));
    return sum + subtotal * effective.vatRate / 100;
  }, 0);

  let orderDiscountAmount = 0;
  if (orderDiscount?.percentage) {
    orderDiscountAmount = subtotalAfterProductDiscounts * orderDiscount.percentage / 100;
  } else if (orderDiscount?.fixedAmount) {
    orderDiscountAmount = orderDiscount.fixedAmount;
  }

  return {
    itemCount: items.length,
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    vatableSales,
    vatAmount,
    zeroRatedSales: 0,
    vatExemptSales,
    productDiscountAmount,
    orderDiscountAmount,
    grossAmount,
    netAmount: subtotalAfterProductDiscounts - orderDiscountAmount
  };
}

export function isPaymentSufficient(amountTendered: number, totalAmount: number): boolean {
  return Number.isFinite(amountTendered) &&
    Number.isFinite(totalAmount) &&
    totalAmount >= 0 &&
    amountTendered >= totalAmount;
}
