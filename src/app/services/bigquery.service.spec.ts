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
    expect(summary).toEqual({ totalSales: 12450.75, totalOrders: 45, totalItems: 0 });

    const statuses = await service.getSalesDashboardStatusBreakdown('store123', new Date('2025-04-01'), new Date('2025-04-30'));
    expect(statuses).toEqual(payload.result.statusBreakdown);
  });
});
