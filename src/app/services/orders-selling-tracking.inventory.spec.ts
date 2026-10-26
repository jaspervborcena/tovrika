import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore';
import { OfflineDocumentService } from '../core/services/offline-document.service';
import { SqliteStorageService } from '../core/services/sqlite-storage.service';
import { createInventorySaleLockId } from '../interfaces/inventory-sale-lock.interface';
import { NetworkService } from '../core/services/network.service';
import { ProductService } from './product.service';
import { OrdersSellingTrackingService } from './orders-selling-tracking.service';

describe('OrdersSellingTrackingService inventory transaction', () => {
  const firestore = {} as Firestore;
  let service: OrdersSellingTrackingService;
  let reads: Array<{ ref: any; snapshot: any }>;
  let writes: Array<{ operation: string; ref: any; data?: any }>;
  let documentReferences: Map<string, any>;
  let online: boolean;
  let offlineDocuments: any[];
  let offlineDocumentUpdates: Array<{ collectionName: string; id: string; updates: any }>;

  beforeEach(async () => {
    reads = [];
    writes = [];
    online = true;
    offlineDocuments = [];
    offlineDocumentUpdates = [];
    documentReferences = new Map();
    batchSnapshot.docs = [
      makeBatch('batch-new', 1, 25, '2026-01-02T00:00:00.000Z'),
      makeBatch('batch-old', 2, 30, '2026-01-01T00:00:00.000Z')
    ];

    await TestBed.configureTestingModule({
      providers: [
        OrdersSellingTrackingService,
        { provide: Firestore, useValue: firestore },
        { provide: ProductService, useValue: { getProduct: () => undefined, applyLocalPatch: () => undefined } },
        { provide: NetworkService, useValue: { isOnline: () => online } },
        { provide: SqliteStorageService, useValue: {} },
        {
          provide: OfflineDocumentService,
          useValue: {
            onDocumentSynced: () => () => undefined,
            getPendingDocuments: async () => offlineDocuments,
            updateDocument: async (collectionName: string, id: string, updates: any) => {
              offlineDocumentUpdates.push({ collectionName, id, updates });
            }
          }
        }
      ]
    }).compileComponents();

    service = TestBed.inject(OrdersSellingTrackingService);
    spyOn(service as any, 'createInventoryDocumentReference').and.callFake((collectionName: string, id?: string) => {
      const key = `${collectionName}/${id || ''}`;
      if (!documentReferences.has(key)) {
        documentReferences.set(key, { collectionName, id: id || `generated-${documentReferences.size}` });
      }
      return documentReferences.get(key);
    });
    spyOn(service as any, 'createInventoryBatchQuery').and.returnValue({ queryRef: true });
    spyOn(service as any, 'runInventoryTransaction').and.callFake(async (callback: any) => {
      const transaction = {
        get: async (ref: any) => reads.find(entry => entry.ref === ref)?.snapshot ??
          (ref?.queryRef ? batchSnapshot : emptySnapshot),
        set: (ref: any, data: any) => writes.push({ operation: 'set', ref, data }),
        update: (ref: any, data: any) => writes.push({ operation: 'update', ref, data })
      };
      return callback(transaction);
    });
    reads = [
      {
        ref: (service as any).createInventoryDocumentReference('products', 'product-1'),
        snapshot: productSnapshot
      },
      {
        ref: (service as any).createInventoryDocumentReference(
          'inventorySaleLocks',
          createInventorySaleLockId('order-1', 0, 'product-1', 'MUG-1')
        ),
        snapshot: emptySnapshot
      }
    ];
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('commits FIFO batch deductions, allocation audits, and the sale-line lock in one transaction', async () => {
    const result = await (service as any).logSaleAndAdjustStockAtomic({
      companyId: 'company-1',
      storeId: 'store-1',
      orderId: 'order-1',
      status: 'completed',
      cashierId: 'cashier-1'
    }, [{
      productId: 'product-1',
      itemCode: 'MUG-1',
      quantity: 3,
      unitPrice: 40,
      lineTotal: 120,
      isStockTracked: true
    }]);

    expect(result.success).toBeTrue();
    expect(result.adjusted).toBe(1);
    expect(writes.filter(write => write.operation === 'update' && write.ref.collectionName === 'productInventory').length).toBe(2);
    const allocations = writes
      .filter(write => write.ref.collectionName === 'inventoryTracking')
      .map(write => write.data);
    expect(allocations.map(entry => [entry.batchId, entry.quantity, entry.costPrice])).toEqual([
      ['batch-old', 2, 30],
      ['batch-new', 1, 25]
    ]);
    expect(allocations.every(entry => entry.saleLineIndex === 0 && entry.itemCode === 'MUG-1')).toBeTrue();

    const lock = writes.find(write =>
      write.operation === 'set' &&
      write.ref.collectionName === 'inventorySaleLocks' &&
      write.ref.id === createInventorySaleLockId('order-1', 0, 'product-1', 'MUG-1')
    );
    expect(lock?.data.quantity).toBe(3);
    expect(writes.some(write => write.operation === 'update' && write.ref.collectionName === 'products')).toBeTrue();
  });

  it('does not write anything when FIFO batches cannot fulfill the sale quantity', async () => {
    batchSnapshot.docs = [makeBatch('batch-old', 1, 30, '2026-01-01T00:00:00.000Z')];

    const result = await (service as any).logSaleAndAdjustStockAtomic({
      companyId: 'company-1',
      storeId: 'store-1',
      orderId: 'order-1',
      status: 'completed',
      cashierId: 'cashier-1'
    }, [{
      productId: 'product-1',
      itemCode: 'MUG-1',
      quantity: 3,
      unitPrice: 40,
      lineTotal: 120,
      isStockTracked: true
    }]);

    expect(result.success).toBeFalse();
    expect(writes).toEqual([]);
  });

  it('skips a line whose inventory lock already exists', async () => {
    const lockRef = (service as any).createInventoryDocumentReference(
      'inventorySaleLocks',
      createInventorySaleLockId('order-1', 0, 'product-1', 'MUG-1')
    );
    reads = [{ ref: lockRef, snapshot: { exists: () => true, data: () => ({}) } }];

    const result = await (service as any).logSaleAndAdjustStockAtomic({
      companyId: 'company-1',
      storeId: 'store-1',
      orderId: 'order-1',
      status: 'completed',
      cashierId: 'cashier-1'
    }, [{
      productId: 'product-1',
      itemCode: 'MUG-1',
      quantity: 1,
      unitPrice: 40,
      lineTotal: 40,
      isStockTracked: true
    }]);

    expect(result).toEqual({ success: true, tracked: 0, adjusted: 0, errors: [] });
    expect(writes).toEqual([]);
  });

  it('updates queued tracking locally without querying Firestore while offline', async () => {
    online = false;
    offlineDocuments = [{
      id: 'queued-line-1',
      collectionName: 'ordersSellingTracking',
      data: { orderId: 'order-1', status: 'open', createdBy: 'cashier-1' }
    }];

    const result = await service.markOrderTrackingCompleted('order-1', 'cashier-2');

    expect(result).toEqual({ updated: 1, errors: [] });
    expect(offlineDocumentUpdates).toEqual([{
      collectionName: 'ordersSellingTracking',
      id: 'queued-line-1',
      updates: { status: 'completed', updatedBy: 'cashier-2' }
    }]);
    expect(writes).toEqual([]);
  });
});

const emptySnapshot = {
  exists: () => false,
  data: () => undefined
};

const productSnapshot = {
  exists: () => true,
  data: () => ({ totalStock: 3, pendingBatchDeductionQty: 0 })
};

const makeBatch = (id: string, quantity: number, costPrice: number, receivedAt: string) => ({
  id,
  ref: { collectionName: 'productInventory', id },
  data: () => ({ companyId: 'company-1', status: 'active', quantity, costPrice, receivedAt, totalDeducted: 0 })
});

const batchSnapshot: { docs: ReturnType<typeof makeBatch>[] } = {
  docs: []
};
