import { ProductService } from './product.service';
import { PosService } from './pos.service';

describe('ProductService normalization', () => {
  it('should zero VAT and discount values when their toggles are off', () => {
    const normalized = ProductService.normalizeProductTaxAndDiscountFields({
      uid: 'user-1',
      productName: 'Sample',
      skuId: 'SKU-1',
      unitType: 'pieces',
      category: 'General',
      totalStock: 10,
      originalPrice: 100,
      sellingPrice: 120,
      companyId: 'company-1',
      storeId: 'store-1',
      isVatApplicable: false,
      vatRate: 12,
      hasDiscount: false,
      discountType: 'percentage',
      discountValue: 10
    });

    expect(normalized.isVatApplicable).toBeFalse();
    expect(normalized.vatRate).toBe(0);
    expect(normalized.hasDiscount).toBeFalse();
    expect(normalized.discountType).toBe('percentage');
    expect(normalized.discountValue).toBe(0);
  });

  it('should retain values only when the feature is enabled', () => {
    const normalized = ProductService.normalizeProductTaxAndDiscountFields({
      uid: 'user-1',
      productName: 'Sample',
      skuId: 'SKU-1',
      unitType: 'pieces',
      category: 'General',
      totalStock: 10,
      originalPrice: 100,
      sellingPrice: 120,
      companyId: 'company-1',
      storeId: 'store-1',
      isVatApplicable: true,
      vatRate: 12,
      hasDiscount: true,
      discountType: 'percentage',
      discountValue: 10
    });

    expect(normalized.isVatApplicable).toBeTrue();
    expect(normalized.vatRate).toBe(12);
    expect(normalized.hasDiscount).toBeTrue();
    expect(normalized.discountType).toBe('percentage');
    expect(normalized.discountValue).toBe(10);
  });

  it('should default blank product tax and discount data to off', () => {
    const normalized = ProductService.normalizeProductTaxAndDiscountFields({
      uid: 'user-1',
      productName: 'Sample',
      skuId: 'SKU-1',
      unitType: 'pieces',
      category: 'General',
      totalStock: 10,
      originalPrice: 100,
      sellingPrice: 120,
      companyId: 'company-1',
      storeId: 'store-1'
    } as any);

    expect(normalized.isVatApplicable).toBeFalse();
    expect(normalized.vatRate).toBe(0);
    expect(normalized.hasDiscount).toBeFalse();
    expect(normalized.discountValue).toBe(0);
  });

  it('should normalize cart items before saving to orderDetails', () => {
    const item = PosService.normalizeCartItemForStorage({
      productId: 'p-1',
      productName: 'Americano',
      skuId: 'Americano Large',
      quantity: 1,
      sellingPrice: 180,
      originalPrice: 160.71,
      total: 180,
      isVatApplicable: true,
      vatRate: 12,
      vatAmount: 19.29,
      hasDiscount: false,
      discountType: 'percentage',
      discountValue: 0,
      discountAmount: 0,
      isVatExempt: false
    } as any, 1);

    expect(item.price).toBe(180);
    expect(item.vat).toBeCloseTo(19.29, 2);
    expect(item.discount).toBe(0);
    expect(item.total).toBe(180);
  });
});
