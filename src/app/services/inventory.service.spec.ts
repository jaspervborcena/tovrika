import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore';
import { OfflineDocumentService } from '../core/services/offline-document.service';
import { AuthService } from './auth.service';
import { InventoryRow, InventoryService } from './inventory.service';
import { ProductService } from './product.service';

describe('InventoryService summary source', () => {
  let service: InventoryService;
  const firestore = {} as Firestore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        InventoryService,
        { provide: Firestore, useValue: firestore },
        { provide: ProductService, useValue: { getProduct: () => undefined } },
        { provide: OfflineDocumentService, useValue: {} },
        {
          provide: AuthService,
          useValue: {
            waitForAuth: async () => undefined,
            getFirebaseIdToken: async () => 'test-token'
          }
        }
      ]
    });
    service = TestBed.inject(InventoryService);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('uses the Inventory Summary API by default and maps its records', async () => {
    const now = new Date();
    const localStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const localEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    spyOn(window, 'fetch').and.resolveTo(new Response(JSON.stringify({
      success: true,
      storeId: 'store-1',
      from: '',
      to: '',
      count: 1,
      inventory: [{
        eventType: 'completed',
        invoiceNumber: 'INV-1',
        productId: 'product-1',
        productName: 'Coffee',
        productCode: 'COF-1',
        skuId: 'COF-M',
        quantity: 2,
        costPrice: 10,
        sellingPrice: 25,
        runningBalanceTotalStock: 8,
        createdAt: '2026-09-03T08:00:00.000Z',
        deductedAt: '2026-09-03T08:00:00.000Z'
      }]
    }), { status: 200 }));
    const firestoreFallback = spyOn(service, 'fetchRowsFromCollection').and.resolveTo([]);

    await service.loadRowsForPeriod(
      'today',
      1,
      'store-1'
    );

    const requestUrl = (window.fetch as jasmine.Spy).calls.mostRecent().args[0] as string;
    const request = new URL(requestUrl);
    expect(request.searchParams.get('storeId')).toBe('store-1');
    expect(request.searchParams.get('from')).toBe(formatUtcDateForApi(localStart));
    expect(request.searchParams.get('to')).toBe(formatUtcDateForApi(localEnd));
    expect((window.fetch as jasmine.Spy).calls.mostRecent().args[1]).toEqual({
      headers: { Authorization: 'Bearer test-token' }
    });
    expect(firestoreFallback).not.toHaveBeenCalled();
    expect(service.rows()).toEqual([jasmine.objectContaining({
      invoiceNo: 'INV-1',
      productName: 'Coffee',
      quantity: 2,
      totalGross: 50,
      totalProfit: 30,
      source: 'deduction'
    })]);
  });

  it('falls back to Firestore for supported short periods when the API fails', async () => {
    spyOn(window, 'fetch').and.rejectWith(new Error('API unavailable'));
    const fallbackRow: InventoryRow = {
      invoiceNo: 'INV-FALLBACK',
      costPrice: 10,
      sellingPrice: 20,
      quantity: 1,
      profitPerUnit: 10,
      totalGross: 20,
      totalProfit: 10,
      runningBalanceTotalStock: 4
    };
    spyOn(service, 'fetchRowsFromCollection').and.resolveTo([fallbackRow]);
    spyOn(service, 'fetchRowsFromOrdersSellingTracking').and.resolveTo([]);

    await service.loadRowsForPeriod('today', 1, 'store-1');

    expect(service.fetchRowsFromCollection).toHaveBeenCalledWith(
      'inventoryTracking',
      jasmine.any(Array),
      20,
      jasmine.any(Object)
    );
    expect(service.rows()).toEqual([fallbackRow]);
  });

  it('uses Firestore directly for periods outside the API short-range list', async () => {
    const apiFetch = spyOn(window, 'fetch');
    const firestoreRows: InventoryRow[] = [{
      invoiceNo: 'INV-FIRESTORE',
      costPrice: 10,
      sellingPrice: 20,
      quantity: 1,
      profitPerUnit: 10,
      totalGross: 20,
      totalProfit: 10,
      runningBalanceTotalStock: 4
    }];
    const firestoreFetch = spyOn(service, 'fetchRowsFromCollection').and.resolveTo(firestoreRows);
    spyOn(service, 'fetchRowsFromOrdersSellingTracking').and.resolveTo([]);

    await service.loadRowsForPeriod('this_month', 1, 'store-1');

    expect(apiFetch).not.toHaveBeenCalled();
    expect(firestoreFetch).toHaveBeenCalled();
    expect(service.rows()).toEqual(firestoreRows);
  });
});

function formatUtcDateForApi(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}
