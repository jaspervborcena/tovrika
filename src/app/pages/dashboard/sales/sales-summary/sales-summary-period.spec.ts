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
    const params = buildBigQueryRequestParams('store-1', new Date(2026, 7, 31, 0, 0, 0, 0), new Date(2026, 7, 31, 23, 59, 59, 999), true);

    expect(params.get('storeId')).toBe('store-1');
    expect(params.get('from')).toBe('20260831000000');
    expect(params.get('to')).toBe('20260831235959');
    expect(params.get('includeAllStatus')).toBe('true');
  });

  it('should preserve a local day when converting a local date range to API params', () => {
    const localRange = new Date(2026, 7, 31, 0, 0, 0, 0);
    const localDayEnd = new Date(2026, 7, 31, 23, 59, 59, 999);
    const params = buildBigQueryRequestParams('store-1', localRange, localDayEnd);

    expect(params.get('from')).toBe('20260831000000');
    expect(params.get('to')).toBe('20260831235959');
  });

  it('should omit includeAllStatus when not provided', () => {
    const params = buildBigQueryRequestParams('store-1', new Date(2026, 7, 31, 0, 0, 0, 0), new Date(2026, 7, 31, 23, 59, 59, 999));

    expect(params.has('includeAllStatus')).toBe(false);
  });
});
