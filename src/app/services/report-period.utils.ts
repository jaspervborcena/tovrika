import { ReportPeriod } from './store-selection.service';

export function resolvePeriodDateRange(
  period: ReportPeriod,
  referenceDate: Date = new Date(),
  forcedFrom?: string | null,
  forcedTo?: string | null
): { from: string; to: string } {
  if (period === 'date_range') {
    const from = forcedFrom || formatDateForInput(new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      referenceDate.getDate() - 30
    ));
    const to = forcedTo || formatDateForInput(referenceDate);
    return { from, to };
  }

  const now = new Date(referenceDate);
  let start: Date;
  let end: Date;

  if (period === 'today') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  } else if (period === 'yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
    end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
  } else if (period === 'this_week') {
    const mondayOffset = (now.getDay() + 6) % 7;
    start = new Date(now);
    start.setDate(now.getDate() - mondayOffset);
    start.setHours(0, 0, 0, 0);
    end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'previous_week') {
    const mondayOffset = (now.getDay() + 6) % 7;
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() - mondayOffset);
    currentWeekStart.setHours(0, 0, 0, 0);
    start = new Date(currentWeekStart);
    start.setDate(currentWeekStart.getDate() - 7);
    start.setHours(0, 0, 0, 0);
    end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'this_month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  } else {
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    start = new Date(previousMonth.getFullYear(), previousMonth.getMonth(), 1, 0, 0, 0, 0);
    end = new Date(previousMonth.getFullYear(), previousMonth.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  return { from: formatDateForInput(start), to: formatDateForInput(end) };
}

function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
