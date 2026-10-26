import { CartItem, OrderDiscount } from '../interfaces/pos.interface';
import { Product } from '../interfaces/product.interface';
import { calculateCartSummary, isPaymentSufficient } from './pos-checkout.utils';

describe('checkout calculations', () => {
  const vatItem = {
    productId: 'vat-product',
    productName: 'Taxable item',
    skuId: 'VAT-1',
    quantity: 2,
    sellingPrice: 120,
    originalPrice: 100,
    costPrice: 50,
    total: 240,
    isVatApplicable: true,
    vatRate: 12,
    vatAmount: 0,
    hasDiscount: true,
    discountType: 'fixed',
    discountValue: 5,
    discountAmount: 10,
    isVatExempt: false
  } as CartItem;
  const exemptItem = {
    productId: 'exempt-product',
    productName: 'Exempt item',
    skuId: 'EX-1',
    quantity: 1,
    sellingPrice: 50,
    originalPrice: 50,
    total: 50,
    isVatApplicable: false,
    vatRate: 12,
    vatAmount: 0,
    hasDiscount: false,
    discountType: 'fixed',
    discountValue: 0,
    discountAmount: 0,
    isVatExempt: true
  } as CartItem;

  it('calculates taxable, exempt, item discount, order discount, and net total', () => {
    const products = new Map<string, Partial<Product>>([
      ['vat-product', { isVatApplicable: true, vatRate: 12, originalPrice: 100 } as Product],
      ['exempt-product', { isVatApplicable: false, vatRate: 12, originalPrice: 50 } as Product]
    ]);

    const summary = calculateCartSummary(
      [vatItem, exemptItem],
      { percentage: 10 } as OrderDiscount,
      productId => products.get(productId) as Product | undefined
    );

    expect(summary).toEqual({
      itemCount: 2,
      totalQuantity: 3,
      vatableSales: 190,
      vatAmount: 22.8,
      zeroRatedSales: 0,
      vatExemptSales: 50,
      productDiscountAmount: 10,
      orderDiscountAmount: 28,
      grossAmount: 290,
      netAmount: 252
    });
  });

  it('uses cart VAT settings when product lookup fails', () => {
    const summary = calculateCartSummary([vatItem], null, () => {
      throw new Error('Product cache unavailable');
    });

    expect(summary.vatableSales).toBe(190);
    expect(summary.vatAmount).toBeCloseTo(22.8, 2);
    expect(summary.netAmount).toBe(230);
  });
});

describe('payment validation', () => {
  it('accepts exact tender and rejects a short tender', () => {
    expect(isPaymentSufficient(100, 100)).toBeTrue();
    expect(isPaymentSufficient(99.99, 100)).toBeFalse();
  });

  it('rejects invalid amounts and negative totals', () => {
    expect(isPaymentSufficient(Number.NaN, 100)).toBeFalse();
    expect(isPaymentSufficient(100, Number.NaN)).toBeFalse();
    expect(isPaymentSufficient(Number.POSITIVE_INFINITY, 100)).toBeFalse();
    expect(isPaymentSufficient(-1, 0)).toBeFalse();
    expect(isPaymentSufficient(0, -1)).toBeFalse();
  });
});
