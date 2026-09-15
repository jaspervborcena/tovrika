import { TestBed } from '@angular/core/testing';
import { BigQueryService } from './bigquery.service';
import { AuthService } from './auth.service';

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
      new Date(2026, 8, 3, 0, 0, 0, 0),
      new Date(2026, 8, 5, 23, 59, 59, 999)
    );
    const requestUrl = (window.fetch as jasmine.Spy).calls.mostRecent().args[0] as string;

    expect(requestUrl).toContain('from=20260903000000');
    expect(requestUrl).toContain('to=20260905235959');
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
