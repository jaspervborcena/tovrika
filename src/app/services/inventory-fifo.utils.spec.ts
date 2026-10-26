import { FifoInventoryBatch, planFifoBatchDeductions } from './inventory-fifo.utils';

describe('planFifoBatchDeductions', () => {
  const batches: FifoInventoryBatch<string>[] = [
    {
      id: 'batch-oldest',
      batchId: 'lot-1',
      ref: 'ref-1',
      status: 'active',
      quantity: 3,
      receivedAt: '2026-01-01T00:00:00.000Z',
      costPrice: 10,
      totalDeducted: 2
    },
    {
      id: 'batch-next',
      ref: 'ref-2',
      status: 'active',
      quantity: 4,
      receivedAt: '2026-01-02T00:00:00.000Z',
      unitPrice: 12
    },
    {
      id: 'batch-inactive',
      ref: 'ref-inactive',
      status: 'depleted',
      quantity: 20,
      receivedAt: '2025-01-01T00:00:00.000Z'
    }
  ];

  it('deducts oldest active batches first and splits quantities as needed', () => {
    const plan = planFifoBatchDeductions(batches, 5, 0, new Map());

    expect(plan.allocations.map(({ refId, quantity, costPrice }) => ({ refId, quantity, costPrice }))).toEqual([
      { refId: 'batch-oldest', quantity: 3, costPrice: 10 },
      { refId: 'batch-next', quantity: 2, costPrice: 12 }
    ]);
    expect(plan.batchWrites.get('batch-oldest')).toEqual({
      ref: 'ref-1',
      quantity: 0,
      totalDeducted: 5,
      status: 'depleted'
    });
    expect(plan.batchWrites.get('batch-next')).toEqual({
      ref: 'ref-2',
      quantity: 2,
      totalDeducted: 2,
      status: 'active'
    });
    expect(plan.remainingQuantity).toBe(0);
  });

  it('allocates units at each batch cost in FIFO order', () => {
    const plan = planFifoBatchDeductions([
      {
        id: 'lot-30',
        ref: 'ref-30',
        status: 'active',
        quantity: 2,
        receivedAt: '2026-01-01T00:00:00.000Z',
        costPrice: 30
      },
      {
        id: 'lot-25',
        ref: 'ref-25',
        status: 'active',
        quantity: 1,
        receivedAt: '2026-01-02T00:00:00.000Z',
        costPrice: 25
      }
    ], 3, 0, new Map());

    expect(plan.allocations.map(({ batchId, quantity, costPrice }) => ({ batchId, quantity, costPrice }))).toEqual([
      { batchId: 'lot-30', quantity: 2, costPrice: 30 },
      { batchId: 'lot-25', quantity: 1, costPrice: 25 }
    ]);
    expect(plan.allocations.reduce((cost, allocation) => cost + allocation.quantity * allocation.costPrice, 0)).toBe(85);
  });

  it('honors pending batch reservations before allocating new deductions', () => {
    const plan = planFifoBatchDeductions(batches, 4, 3, new Map());

    expect(plan.allocations.map(({ refId, quantity }) => ({ refId, quantity }))).toEqual([
      { refId: 'batch-next', quantity: 4 }
    ]);
    expect(plan.batchWrites.has('batch-oldest')).toBeFalse();
    expect(plan.pendingReservation).toBe(0);
    expect(plan.remainingQuantity).toBe(0);
  });

  it('accounts for earlier planned deductions and reports insufficient batch stock', () => {
    const plan = planFifoBatchDeductions(
      batches,
      4,
      0,
      new Map([['batch-oldest', 1]]),
      7
    );

    expect(plan.allocations).toEqual([
      jasmine.objectContaining({ refId: 'batch-oldest', quantity: 2, costPrice: 10 }),
      jasmine.objectContaining({ refId: 'batch-next', quantity: 2, costPrice: 12 })
    ]);
    expect(plan.plannedBatchQuantities.get('batch-oldest')).toBe(3);
    expect(plan.batchWrites.get('batch-oldest')?.totalDeducted).toBe(5);
    expect(plan.remainingQuantity).toBe(0);

    const insufficientPlan = planFifoBatchDeductions(batches, 8, 0, new Map());
    expect(insufficientPlan.remainingQuantity).toBe(1);
  });
});
