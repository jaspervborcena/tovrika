import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore';
import { FirestoreSecurityService } from './firestore-security.service';
import { LoggerService } from './logger.service';
import { OfflineDocument, OfflineDocumentService } from './offline-document.service';
import { SqliteStorageService } from './sqlite-storage.service';
import { NetworkService } from './network.service';
import { createInventorySaleLockId } from '../../interfaces/inventory-sale-lock.interface';
import { OrdersSellingTrackingService } from '../../services/orders-selling-tracking.service';
import { ProductService } from '../../services/product.service';

describe('OfflineDocumentService inventory sale-line sync', () => {
  let service: OfflineDocumentService;
  let ordersSellingTrackingService: OrdersSellingTrackingService;
  let online: boolean;
  let queue: OfflineDocument[];

  beforeEach(async () => {
    online = false;
    queue = [];
    spyOnProperty(navigator, 'onLine', 'get').and.callFake(() => online);

    const sqlite = {
      getPendingDocuments: async () => queue,
      saveOfflineDocument: async (document: OfflineDocument) => {
        const index = queue.findIndex(entry =>
          entry.id === document.id && entry.collectionName === document.collectionName
        );
        if (index >= 0) queue[index] = document;
        else queue.push(document);
      },
      deleteOfflineDocument: async (id: string, collectionName: string) => {
        queue = queue.filter(entry => entry.id !== id || entry.collectionName !== collectionName);
      },
      clearOfflineDocuments: async () => { queue = []; }
    };

    await TestBed.configureTestingModule({
      providers: [
        OfflineDocumentService,
        OrdersSellingTrackingService,
        { provide: Firestore, useValue: {} },
        { provide: SqliteStorageService, useValue: sqlite },
        { provide: NetworkService, useValue: { isOnline: () => true } },
        { provide: ProductService, useValue: { getProduct: () => undefined, applyLocalPatch: () => undefined } },
        { provide: FirestoreSecurityService, useValue: { addSecurityFields: async (data: any) => data } },
        {
          provide: LoggerService,
          useValue: {
            debug: () => undefined,
            info: () => undefined,
            warn: () => undefined,
            error: () => undefined,
            dbSuccess: () => undefined,
            dbFailure: () => undefined
          }
        }
      ]
    }).compileComponents();

    service = TestBed.inject(OfflineDocumentService);
    ordersSellingTrackingService = TestBed.inject(OrdersSellingTrackingService);
    spyOn(ordersSellingTrackingService, 'processPendingInventoryForOrder')
      .and.resolveTo({ processed: 1, skipped: 0, errors: [] });
    spyOn(service as any, 'createOnlineDocumentWithId').and.resolveTo(undefined);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    localStorage.removeItem('pendingDeletes');
  });

  it('remaps the queued sale-line ID after its offline order syncs and notifies inventory processing', async () => {
    const temporaryOrderId = 'temp_orders_offline-order';
    queue.push({
      id: temporaryOrderId,
      collectionName: 'orders',
      data: { id: temporaryOrderId, total: 120 },
      isOffline: true,
      synced: false,
      createdAt: new Date(),
      uid: 'cashier-1'
    });

    await service.createDocumentWithId('ordersSellingTracking', 'old-line-id', {
      orderId: temporaryOrderId,
      itemIndex: 0,
      productId: 'product-1',
      itemCode: 'MUG-1',
      status: 'completed',
      isStockTracked: true
    }, true);

    online = true;
    const result = await service.syncOfflineDocuments();
    const syncedOrderId = queue.find(document => document.collectionName === 'orders')?.id || '';
    const expectedSaleTrackingId = createInventorySaleLockId(
      syncedOrderId,
      0,
      'product-1',
      'MUG-1'
    );
    const syncedLine = queue.find(document => document.collectionName === 'ordersSellingTracking');

    expect(result).toEqual({ synced: 2, failed: 0 });
    expect((service as any).createOnlineDocumentWithId).toHaveBeenCalledWith(
      'ordersSellingTracking',
      expectedSaleTrackingId,
      jasmine.objectContaining({ isStockTracked: true })
    );
    expect(syncedLine?.synced).toBeTrue();
    expect(syncedLine?.id).toBe(expectedSaleTrackingId);
    expect(ordersSellingTrackingService.processPendingInventoryForOrder).toHaveBeenCalledWith(syncedOrderId);
  });
});
