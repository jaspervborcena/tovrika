import { TestBed } from '@angular/core/testing';
import { SqliteStorageService } from './sqlite-storage.service';

describe('SqliteStorageService', () => {
  let service: SqliteStorageService;

  beforeEach(async () => {
    localStorage.removeItem('tovrika_sqlite_database');
    await TestBed.configureTestingModule({
      providers: [SqliteStorageService]
    });

    service = TestBed.inject(SqliteStorageService);
    await service.init();
  });

  it('stores and retrieves settings in SQLite', async () => {
    await service.saveSetting('offline_test', { ok: true, count: 2 });
    const value = await service.getSetting('offline_test');
    const restoredService = new SqliteStorageService();
    await restoredService.init();
    const restoredValue = await restoredService.getSetting('offline_test');

    expect(value).toEqual({ ok: true, count: 2 });
    expect(restoredValue).toEqual({ ok: true, count: 2 });
  });

  it('stores and fetches user data by uid', async () => {
    await service.saveUserData({
      uid: 'u-123',
      email: 'test@example.com',
      displayName: 'Tester',
      isLoggedIn: true,
      isAgreedToPolicy: true,
      permissions: [],
      lastSync: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      companyId: '',
      currentStoreId: 'store-1',
      userRole: 'cashier',
      role: 'cashier',
      roles: ['cashier'],
      companyIds: []
    } as any);

    const user = await service.getUserData('u-123');

    expect(user?.uid).toBe('u-123');
    expect(user?.email).toBe('test@example.com');
  });

  it('queues offline order-related documents for later sync', async () => {
    const queuedDocs = [
      { id: 'order-1', collectionName: 'orders', data: { id: 'order-1', total: 100 }, uid: 'u-1', synced: false, createdAt: new Date(), isOffline: true },
      { id: 'detail-1', collectionName: 'orderDetails', data: { id: 'detail-1', orderId: 'order-1' }, uid: 'u-1', synced: false, createdAt: new Date(), isOffline: true },
      { id: 'tracking-1', collectionName: 'ordersSellingTracking', data: { id: 'tracking-1', orderId: 'order-1' }, uid: 'u-1', synced: false, createdAt: new Date(), isOffline: true }
    ];

    for (const doc of queuedDocs) {
      await service.saveOfflineDocument(doc as any);
    }

    const orders = await service.getOfflineDocumentsByCollection('orders');
    const orderDetails = await service.getOfflineDocumentsByCollection('orderDetails');
    const tracking = await service.getOfflineDocumentsByCollection('ordersSellingTracking');
    const restoredService = new SqliteStorageService();
    await restoredService.init();
    const restoredOrders = await restoredService.getOfflineDocumentsByCollection('orders');
    const restoredOrderDetails = await restoredService.getOfflineDocumentsByCollection('orderDetails');
    const restoredTracking = await restoredService.getOfflineDocumentsByCollection('ordersSellingTracking');

    expect(orders.some(item => item.id === 'order-1')).toBeTrue();
    expect(orderDetails.some(item => item.id === 'detail-1')).toBeTrue();
    expect(tracking.some(item => item.id === 'tracking-1')).toBeTrue();
    expect(restoredOrders.some(item => item.id === 'order-1')).toBeTrue();
    expect(restoredOrderDetails.some(item => item.id === 'detail-1')).toBeTrue();
    expect(restoredTracking.some(item => item.id === 'tracking-1')).toBeTrue();
  });

  it('migrates existing queued documents from localStorage', async () => {
    localStorage.setItem('pendingDocuments', JSON.stringify([
      { id: 'legacy-order', collectionName: 'orders', data: { total: 25 }, synced: false, createdAt: new Date().toISOString() }
    ]));

    const migratedService = new SqliteStorageService();
    await migratedService.init();
    const orders = await migratedService.getOfflineDocumentsByCollection('orders');

    expect(orders.some(item => item.id === 'legacy-order')).toBeTrue();
    expect(localStorage.getItem('pendingDocuments')).toBeNull();
  });
});
