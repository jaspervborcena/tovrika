import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { ProductSummaryService } from './product-summary.service';

describe('ProductSummaryService stock tracking', () => {
  let service: ProductSummaryService;
  let updates: Array<{ ref: unknown; data: Record<string, unknown> }>;

  beforeEach(() => {
    updates = [];
    TestBed.configureTestingModule({
      providers: [
        ProductSummaryService,
        { provide: Firestore, useValue: {} },
        {
          provide: AuthService,
          useValue: {
            getCurrentUser: () => ({ uid: 'user-1' }),
            getCurrentPermission: () => ({ companyId: 'company-1', storeId: 'store-1' })
          }
        }
      ]
    });

    service = TestBed.inject(ProductSummaryService);
    spyOn(service as any, 'getActiveBatchesFIFO').and.resolveTo([
      { batchId: 'batch-1', quantity: 5, unitPrice: 10, sellingPrice: 12, receivedAt: new Date() }
    ]);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('does not re-enable tracking or overwrite stock summaries for an explicitly untracked product', async () => {
    const transaction = {
      get: async () => ({
        exists: () => true,
        data: () => ({ isStockTracked: false, totalStock: 5, pendingBatchDeductionQty: 0 })
      }),
      update: (ref: unknown, data: Record<string, unknown>) => updates.push({ ref, data })
    };

    const result = await service.recomputeProductSummaryInTransaction(
      transaction as any,
      'product-1',
      {} as any
    );

    expect(result.isStockTracked).toBeFalse();
    expect(updates.length).toBe(1);
    expect(updates[0].data['isStockTracked']).toBeUndefined();
    expect(updates[0].data['totalStock']).toBeUndefined();
  });
});
