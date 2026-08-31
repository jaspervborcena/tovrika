import { resolvePeriodDateRange } from './sales-summary.component';

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
});
