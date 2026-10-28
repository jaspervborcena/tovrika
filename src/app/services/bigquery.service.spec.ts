import { TestBed } from '@angular/core/testing';
import { BigQueryService, normalizeLocalDateRange } from './bigquery.service';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

describe('BigQueryService', () => {
  let service: BigQueryService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        BigQueryService,
        {
          provide: AuthService,
          useValue: {
            waitForAuth: async () => undefined,
            getFirebaseIdToken: async () => 'fake-token'
          }
        }
      ]
    });
    service = TestBed.inject(BigQueryService);
    (service as any).authService = {
      getCurrentUser: () => ({ getIdToken: async () => 'fake-token' }),
      waitForAuth: async () => undefined,
      getFirebaseIdToken: async () => 'fake-token'
    };
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should expose sales dashboard revenue lookup', () => {
    expect(typeof service.getSalesDashboardRevenue).toBe('function');
  });

  it('should normalize local date ranges without shifting days across timezones', () => {
    expect(normalizeLocalDateRange('2026-08-31', '2026-09-06')).toEqual({
      from: '2026-08-31',
      to: '2026-09-06'
    });

    expect(normalizeLocalDateRange('2026-10-10', '2026-10-01')).toEqual({
      from: '2026-10-01',
      to: '2026-10-10'
    });
  });

  it('should request a paginated sales summary page with auth and normalize its orders', async () => {
    spyOn(window, 'fetch').and.resolveTo(new Response(JSON.stringify({
      success: true,
      count: 1,
      page_size: 25,
      page_number: 2,
      has_more: true,
      orders: [{
        orderId: 'ORD-1001',
        invoiceNumber: 'INV-1001',
        status: 'completed',
        storeId: 'STORE-001',
        createdAt: '2026-10-06T10:23:44Z',
        total: 245.5,
        vat: 12.25,
        discount: 0,
        customerId: 'CUST-77'
      }]
    }), { status: 200 }));

    const page = await service.getSalesSummaryDetails('store123', '2026-10-01', '2026-10-09', 2, 25);
    const [requestUrl, requestInit] = (window.fetch as jasmine.Spy).calls.mostRecent().args as [string, RequestInit];

    expect(requestUrl).toContain('storeId=store123');
    expect(requestUrl).toContain('from=20261001');
    expect(requestUrl).toContain('to=20261009');
    expect(requestUrl).toContain('page_number=2');
    expect(requestUrl).toContain('page_size=25');
    expect(requestInit.headers).toEqual({ Authorization: 'Bearer fake-token' });
    expect(page.hasMore).toBeTrue();
    expect(page.orders[0].id).toBe('ORD-1001');
    expect(page.orders[0].invoiceNumber).toBe('INV-1001');
    expect(page.orders[0].createdAt).toEqual(new Date('2026-10-06T10:23:44Z'));
    expect(page.orders[0].totalAmount).toBe(245.5);
    expect(page.orders[0].vatAmount).toBe(12.25);
    expect(page.orders[0].discountAmount).toBe(0);
    expect(page.orders[0].customerId).toBe('CUST-77');
  });

  it('should normalize order rows nested under a data wrapper', async () => {
    spyOn(window, 'fetch').and.callFake(async () => new Response(JSON.stringify({
      success: true,
      count: 1,
      data: {
        rows: [{
          order_id: 'ORD-2001',
          invoice_number: 'INV-2001',
          created_at: '2026-10-27T02:00:00Z',
          total_amount: 640
        }]
      }
    }), { status: 200 }));

    const page = await service.getSalesSummaryDetails('store123', '2026-10-27', '2026-10-27');

    expect(page.orders).toHaveSize(1);
    expect(page.orders[0].id).toBe('ORD-2001');
    expect(page.orders[0].invoiceNumber).toBe('INV-2001');
    expect(page.orders[0].totalAmount).toBe(640);
    expect(page.count).toBe(1);
  });

  it('should keep summary totals and paginated orders scoped to the same store and date range', async () => {
    const requests: string[] = [];
    spyOn(window, 'fetch').and.callFake(async (input: RequestInfo | URL) => {
      const requestUrl = String(input);
      requests.push(requestUrl);
      if (requestUrl.startsWith(environment.api.salesSummaryApi)) {
        return new Response(JSON.stringify({
          success: true,
          total_sales: 640,
          count: 1,
          total_items: 4
        }), { status: 200 });
      }

      return new Response(JSON.stringify({
        success: true,
        count: 1,
        orders: [{
          order_id: 'ORD-3001',
          invoice_number: 'INV-3001',
          created_at: '2026-10-27T10:00:00Z',
          total_amount: 640
        }]
      }), { status: 200 });
    });
    const start = new Date('2026-10-27T00:00:00Z');
    const end = new Date('2026-10-27T23:59:59Z');

    const summary = await service.getSalesSummaryTotals('store-1', start, end);
    const page = await service.getSalesSummaryDetails('store-1', '2026-10-27', '2026-10-27');

    expect(requests).toHaveSize(2);
    const summaryParams = new URL(requests[0]).searchParams;
    const ordersParams = new URL(requests[1]).searchParams;
    expect(summaryParams.get('storeId')).toBe('store-1');
    expect(ordersParams.get('storeId')).toBe('store-1');
    expect(summaryParams.get('from')).toBe('20261027000000');
    expect(summaryParams.get('to')).toBe('20261027235959');
    expect(ordersParams.get('from')).toBe('20261027');
    expect(ordersParams.get('to')).toBe('20261027');
    expect(summary.totalOrders).toBe(page.count);
    expect(page.orders).toHaveSize(1);
    expect(page.orders[0].id).toBe('ORD-3001');
  });

  it('should report an invalid sales details response instead of silently showing an empty list', async () => {
    spyOn(window, 'fetch').and.callFake(async () => new Response(JSON.stringify({
      success: true,
      count: 1
    }), { status: 200 }));

    await expectAsync(
      service.getSalesSummaryDetails('store123', '2026-10-27', '2026-10-27')
    ).toBeRejectedWithError('Sales summary details response did not contain an orders array.');
  });

  it('should request order tracking details by orderId and normalize the rows', async () => {
    spyOn(window, 'fetch').and.resolveTo(new Response(JSON.stringify({
      success: true,
      count: 1,
      details: [{ product_id: 'product-1', product_name: 'Coffee', quantity: 2, unit_price: 30, total_amount: 60 }]
    }), { status: 200 }));

    const details = await service.getSalesSummaryOrderDetails({ orderId: 'order-1' });
    const [requestUrl, requestInit] = (window.fetch as jasmine.Spy).calls.mostRecent().args as [string, RequestInit];

    expect(requestUrl).toContain('orderId=order-1');
    expect(requestUrl).not.toContain('invoiceNumber=');
    expect(requestInit.headers).toEqual({ Authorization: 'Bearer fake-token' });
    expect(details).toEqual([jasmine.objectContaining({
      productId: 'product-1', productName: 'Coffee', quantity: 2, price: 30, total: 60
    })]);
  });

  it('should parse nested summary payloads and status arrays from the new API response', async () => {
    const payload = {
      success: true,
      store_id: 'store123',
      from: '20250401',
      to: '20250430',
      result: {
        summary: {
          totalOrders: 45,
          totalAmount: 12450.75
        },
        statusBreakdown: [
          { status: 'completed', count: 30, amount: 9500 },
          { status: 'returned', totalOrders: 2, totalAmount: 360, totalItems: 2 },
          { status: 'refunds', totalOrders: 0, totalAmount: 0, totalItems: 0 },
          { status: 'damage', totalOrders: 0, totalAmount: 0, totalItems: 0 },
          { status: 'cancellations', totalOrders: 1, totalAmount: 100, totalItems: 1 }
        ]
      }
    };

    spyOn(window, 'fetch').and.callFake(async () => new Response(JSON.stringify(payload), { status: 200 }));

    const summary = await service.getSalesSummaryTotals('store123', new Date('2025-04-01'), new Date('2025-04-30'));
    expect(summary).toEqual({
      totalSales: 12450.75,
      totalOrders: 45,
      totalItems: 0,
      totalCustomers: 0,
      statusBreakdown: [
        { status: 'completed', count: 30, amount: 9500, totalItems: 0, totalCustomers: 0 },
        { status: 'returned', count: 2, amount: 360, totalItems: 2, totalCustomers: 0 },
        { status: 'refunds', count: 0, amount: 0, totalItems: 0, totalCustomers: 0 },
        { status: 'damage', count: 0, amount: 0, totalItems: 0, totalCustomers: 0 },
        { status: 'cancellations', count: 1, amount: 100, totalItems: 1, totalCustomers: 0 }
      ],
      revenue: { status: 'revenue', count: 45, amount: 12450.75, totalItems: 0, totalCustomers: 0 },
      netTotals: { status: 'nettotals', count: 0, amount: 0, totalItems: 0, totalCustomers: 0 }
    });

    const statuses = await service.getSalesDashboardStatusBreakdown('store123', new Date('2025-04-01'), new Date('2025-04-30'));
    expect(statuses).toEqual(summary.statusBreakdown);
  });

  it('should send compact date-time values and parse status rows from sales summary API', async () => {
    const payload = [
      { storeId: 'store123', status: 'completed', totalSales: 1500, totalItems: 25, totalOrders: 8, totalCustomer: 6 },
      { storeId: 'store123', status: 'cancelled', totalSales: 100, totalItems: 2, totalOrders: 1, totalCustomer: 1 },
      { storeId: 'store123', status: 'Revenue', totalSales: 1500, totalItems: 25, totalOrders: 8, totalCustomer: 6 }
    ];

    spyOn(window, 'fetch').and.resolveTo(new Response(JSON.stringify(payload), { status: 200 }));

    const summary = await service.getSalesSummaryTotals(
      'store123',
      new Date('2026-09-02T16:00:00.000Z'),
      new Date('2026-09-05T15:59:59.999Z')
    );
    const requestUrl = (window.fetch as jasmine.Spy).calls.mostRecent().args[0] as string;

    expect(requestUrl).toContain('from=20260902160000');
    expect(requestUrl).toContain('to=20260905155959');
    expect(summary.totalSales).toBe(1500);
    expect(summary.totalOrders).toBe(9);
    expect(summary.totalItems).toBe(27);
    expect(summary.totalCustomers).toBe(6);
    expect(summary.statusBreakdown).toEqual([
      { status: 'completed', count: 8, amount: 1500, totalItems: 25, totalCustomers: 6 },
      { status: 'cancelled', count: 1, amount: 100, totalItems: 2, totalCustomers: 1 }
    ]);
  });

  it('should use completed totals when an array response has no revenue row', async () => {
    const payload = [
      { storeId: 'store123', status: 'completed', totalSales: 900, totalItems: 6, totalOrders: 3, totalCustomer: 2 },
      { storeId: 'store123', status: 'cancelled', totalSales: 100, totalItems: 1, totalOrders: 1, totalCustomer: 1 }
    ];

    spyOn(window, 'fetch').and.resolveTo(new Response(JSON.stringify(payload), { status: 200 }));

    const summary = await service.getSalesSummaryTotals(
      'store123',
      new Date('2026-09-15T00:00:00.000Z'),
      new Date('2026-09-15T23:59:59.999Z')
    );

    expect(summary.totalSales).toBe(900);
    expect(summary.totalOrders).toBe(3);
    expect(summary.totalItems).toBe(6);
    expect(summary.totalCustomers).toBe(2);
  });
});
