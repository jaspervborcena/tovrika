import { resolvePeriodDateRange } from './sales-summary.component';
import { buildBigQueryRequestParams } from '../../../../services/bigquery.service';

describe('SalesSummary period helper', () => {
  it('should resolve this week from a reference date', () => {
    const ref = new Date('2026-08-31T12:00:00');
    const { from, to } = resolvePeriodDateRange('this_week', ref);

    expect(from).toBe('2026-08-31');
    expect(to).toBe('2026-09-06');
  });

  it('should honor a custom date range', () => {
    const ref = new Date('2026-08-31T12:00:00');
    const { from, to } = resolvePeriodDateRange('date_range', ref, '2026-08-20', '2026-08-27');

    expect(from).toBe('2026-08-20');
    expect(to).toBe('2026-08-27');
  });

  it('should include the includeAllStatus flag in BigQuery request params', () => {
    const params = buildBigQueryRequestParams('store-1', new Date('2026-08-31T00:00:00Z'), new Date('2026-08-31T23:59:59Z'), true);

    expect(params.get('storeId')).toBe('store-1');
    expect(params.get('from')).toBe('20260831');
    expect(params.get('to')).toBe('20260831');
    expect(params.get('includeAllStatus')).toBe('true');
  });

  it('should default includeAllStatus to false when not provided', () => {
    const params = buildBigQueryRequestParams('store-1', new Date('2026-08-31T00:00:00Z'), new Date('2026-08-31T23:59:59Z'));

    expect(params.get('includeAllStatus')).toBe('false');
  });
});
