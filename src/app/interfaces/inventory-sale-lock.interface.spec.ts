import { createInventorySaleLockId } from './inventory-sale-lock.interface';

describe('createInventorySaleLockId', () => {
  it('returns the same ID for retries of the same sale line', () => {
    expect(createInventorySaleLockId('order-1', 0, 'product-1', 'mug-123'))
      .toBe(createInventorySaleLockId('order-1', 0, 'product-1', 'mug-123'));
  });

  it('separates repeated products by order and line index', () => {
    const firstOrderLine = createInventorySaleLockId('order-1', 0, 'product-1', 'mug-123');
    const nextOrderLine = createInventorySaleLockId('order-1', 1, 'product-1', 'mug-123');
    const otherOrderLine = createInventorySaleLockId('order-2', 0, 'product-1', 'mug-123');

    expect(new Set([firstOrderLine, nextOrderLine, otherOrderLine]).size).toBe(3);
  });
});
