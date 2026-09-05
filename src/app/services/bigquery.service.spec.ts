import { TestBed } from '@angular/core/testing';
import { BigQueryService } from './bigquery.service';

describe('BigQueryService', () => {
  let service: BigQueryService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [BigQueryService]
    });
    service = TestBed.inject(BigQueryService);
    (service as any).authService = {
      getCurrentUser: () => ({ getIdToken: async () => 'fake-token' })
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
          { status: 'cancelled', count: 3, amount: 500 }
        ]
      }
    };

    spyOn(window, 'fetch').and.resolveTo(new Response(JSON.stringify(payload), { status: 200 }));

    const summary = await service.getSalesSummaryTotals('store123', new Date('2025-04-01'), new Date('2025-04-30'));
    expect(summary).toEqual({
      totalSales: 12450.75,
      totalOrders: 45,
      totalItems: 0,
      statusBreakdown: payload.result.statusBreakdown
    });

    const statuses = await service.getSalesDashboardStatusBreakdown('store123', new Date('2025-04-01'), new Date('2025-04-30'));
    expect(statuses).toEqual(payload.result.statusBreakdown);
  });

  it('should send UTC ISO dates and parse status rows from sales summary API', async () => {
    const payload = [
      { storeId: 'store123', status: 'completed', totalSales: 1500, totalItems: 25, totalOrders: 8 },
      { storeId: 'store123', status: 'cancelled', totalSales: 100, totalItems: 2, totalOrders: 1 }
    ];

    spyOn(window, 'fetch').and.resolveTo(new Response(JSON.stringify(payload), { status: 200 }));

    const summary = await service.getSalesSummaryTotals(
      'store123',
      new Date('2026-09-03T00:00:00.000Z'),
      new Date('2026-09-05T00:00:00.000Z')
    );
    const requestUrl = (window.fetch as jasmine.Spy).calls.mostRecent().args[0] as string;

    expect(requestUrl).toContain('from=2026-09-03T00%3A00%3A00.000Z');
    expect(requestUrl).toContain('to=2026-09-05T00%3A00%3A00.000Z');
    expect(summary.totalSales).toBe(1500);
    expect(summary.totalOrders).toBe(9);
    expect(summary.totalItems).toBe(27);
    expect(summary.statusBreakdown).toEqual([
      { status: 'completed', count: 8, amount: 1500, totalItems: 25 },
      { status: 'cancelled', count: 1, amount: 100, totalItems: 2 }
    ]);
  });
});
