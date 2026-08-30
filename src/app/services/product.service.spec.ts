import { ProductService } from './product.service';

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
});
