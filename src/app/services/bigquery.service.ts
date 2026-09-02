import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { LoggerService } from '../core/services/logger.service';
import { environment } from '../../environments/environment';
import { Order } from '../interfaces/pos.interface';

/**
 * Detects the device's timezone and returns offset info
 * @returns Object with timezone offset in hours and timezone name
 */
export function getDeviceTimezoneInfo(): { offsetHours: number; offsetMinutes: number; name: string } {
  const now = new Date();
  const offsetMinutes = now.getTimezoneOffset();
  const offsetHours = -offsetMinutes / 60;  // Negative because getTimezoneOffset returns west as positive
  
  // Get timezone name using Intl API
  const timeZoneName = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  return {
    offsetHours,
    offsetMinutes,
    name: timeZoneName
  };
}

/**
 * Converts a date string from device's LOCAL time to UTC
 * Automatically detects the user's timezone (Philippines, US, England, etc.)
 * @param dateStr Date string in format YYYY-MM-DD (interpreted as device's local time)
 * @returns Date object representing the UTC equivalent
 */
export function convertLocalToUtc(dateStr: string): Date {
  const parts = dateStr.split('-').map(Number);
  // Create date in device's LOCAL time (this is key!)
  // The Date constructor automatically handles timezone conversion
  const localDate = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
  return localDate;
}

/**
 * Converts a date range from device's LOCAL time to UTC
 * Works automatically for any timezone (Philippines UTC+8, US UTC-5, UK UTC+0, etc.)
 * @param fromDateStr Start date in format YYYY-MM-DD (device's local time)
 * @param toDateStr End date in format YYYY-MM-DD (device's local time)
 * @returns Object with start and end dates in UTC
 */
export function convertPhilippineDateRangeToUtc(fromDateStr: string, toDateStr: string): { start: Date; end: Date } {
  const fromParts = fromDateStr.split('-').map(Number);
  const toParts = toDateStr.split('-').map(Number);
  
  // Create dates in device's LOCAL time
  // The Date constructor automatically handles timezone conversion internally
  const start = new Date(fromParts[0], fromParts[1] - 1, fromParts[2], 0, 0, 0, 0);
  const end = new Date(toParts[0], toParts[1] - 1, toParts[2], 23, 59, 59, 999);
  
  // Console log for debugging
  const tzInfo = getDeviceTimezoneInfo();
  console.log(`🌍 Device Timezone: ${tzInfo.name} (UTC${tzInfo.offsetHours >= 0 ? '+' : ''}${tzInfo.offsetHours})`);
  console.log(`📅 Local dates: ${fromDateStr} to ${toDateStr}`);
  console.log(`🔄 UTC conversion: ${start.toISOString()} to ${end.toISOString()}`);
  
  return { start, end };
}

export function buildBigQueryRequestParams(
  storeId: string,
  from: Date,
  to: Date,
  includeAllStatus = false
): URLSearchParams {
  return new URLSearchParams({
    storeId,
    from: formatDateForApi(from),
    to: formatDateForApi(to),
    includeAllStatus: String(includeAllStatus)
  });
}

function formatDateForApi(date: Date): string {
  // Ensure date is converted to UTC before formatting
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;
  return dateStr.replace(/-/g, '');
}

@Injectable({
  providedIn: 'root'
})
export class BigQueryService {
  private authService = inject(AuthService);
  private logger = inject(LoggerService);

  async getSalesSummaryRevenue(storeId: string, from: Date, to: Date, includeAllStatus = false): Promise<number | null> {
    const endpoint = environment.api?.salesSummaryApi || environment.api?.salesRevenueApi;
    return this.fetchBigQueryMetric(endpoint, storeId, from, to, [
      'totalRevenue', 'total_revenue', 'revenue', 'totalSales', 'total_sales',
      'totalAmount', 'total_amount', 'netAmount', 'net_amount', 'grossAmount', 'gross_amount',
      'total', 'amount', 'sales'
    ], includeAllStatus);
  }

  async getSalesDashboardRevenue(storeId: string, from: Date, to: Date, includeAllStatus = false): Promise<number> {
    const amount = await this.fetchBigQueryMetric(
      environment.api?.salesRevenueApi || environment.api?.salesSummaryApi,
      storeId,
      from,
      to,
      ['totalRevenue', 'total_revenue', 'revenue', 'totalSales', 'total_sales', 'totalAmount', 'total_amount', 'netAmount', 'net_amount', 'grossAmount', 'gross_amount', 'total', 'amount', 'sales'],
      includeAllStatus
    );
    return Number(amount ?? 0);
  }

  async getSalesSummaryTotals(storeId: string, from: Date, to: Date, includeAllStatus = false): Promise<{ totalSales: number; totalOrders: number; totalItems: number }> {
    const endpoint = environment.api?.salesSummaryApi || environment.api?.salesRevenueApi;
    const currentUser = this.authService.getCurrentUser() as any;
    const token = await currentUser?.getIdToken?.();

    if (!token || !endpoint || !storeId || storeId === 'all') {
      return { totalSales: 0, totalOrders: 0, totalItems: 0 };
    }

    const params = buildBigQueryRequestParams(storeId, from, to, includeAllStatus);

    const response = await fetch(`${endpoint}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error(`BigQuery sales summary totals request failed: ${response.status}`);
    }

    const payload = await response.json();
    const totalSales = this.readNumericValue(payload, [
      'total_sales', 'totalSales', 'totalRevenue', 'total_revenue', 'revenue',
      'totalAmount', 'total_amount', 'grossAmount', 'gross_amount'
    ]);
    const totalOrders = this.readNumericValue(payload, [
      'count', 'total_orders', 'totalOrders', 'orders_count', 'orderCount'
    ]);
    const totalItems = this.readNumericValue(payload, [
      'total_items', 'totalItems', 'items_count', 'itemCount', 'quantity', 'total_quantity'
    ]);

    return {
      totalSales: Number(totalSales ?? 0),
      totalOrders: Number(totalOrders ?? 0),
      totalItems: Number(totalItems ?? 0)
    };
  }

  async getSalesDashboardOrders(storeId: string, from: Date, to: Date, includeAllStatus = false): Promise<Order[]> {
    const rows = await this.fetchBigQueryRows<any>(
      environment.api?.ordersApi || environment.api?.directOrdersApi || environment.api?.salesSummaryApi,
      storeId,
      from,
      to,
      ['orders', 'data', 'rows', 'result'],
      includeAllStatus
    );

    return (rows || []).map((order: any) => this.transformApiOrder(order));
  }

  async getSalesDashboardAdjustments(storeId: string, from: Date, to: Date, includeAllStatus = false): Promise<any[]> {
    return this.fetchBigQueryRows<any>(
      environment.api?.salesAdjustmentsApi,
      storeId,
      from,
      to,
      ['adjustments', 'data', 'rows', 'result'],
      includeAllStatus
    );
  }

  async getSalesDashboardCustomers(storeId: string, from: Date, to: Date, includeAllStatus = false): Promise<any[]> {
    return this.fetchBigQueryRows<any>(
      environment.api?.salesCustomersApi,
      storeId,
      from,
      to,
      ['customers', 'data', 'rows', 'result'],
      includeAllStatus
    );
  }

  async getSalesDashboardStatusBreakdown(storeId: string, from: Date, to: Date, includeAllStatus = false): Promise<any[]> {
    return this.fetchBigQueryRows<any>(
      environment.api?.salesStatusBreakdownApi,
      storeId,
      from,
      to,
      ['statusBreakdown', 'status_breakdown', 'statuses', 'status', 'data', 'rows', 'result'],
      includeAllStatus
    );
  }

  private async fetchBigQueryMetric(
    endpoint: string | undefined,
    storeId: string,
    from: Date,
    to: Date,
    keys: string[],
    includeAllStatus = false
  ): Promise<number | null> {
    const currentUser = this.authService.getCurrentUser() as any;
    const token = await currentUser?.getIdToken?.();

    if (!token || !endpoint || !storeId || storeId === 'all') return null;

    const getDate = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const readMetric = (value: any): number | null => {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
        return Number(value);
      }
      if (Array.isArray(value)) {
        const values = value.map(item => readMetric(item)).filter((item): item is number => item !== null);
        return values.length ? values.reduce((sum, item) => sum + item, 0) : null;
      }
      if (!value || typeof value !== 'object') return null;

      for (const key of keys) {
        if (value[key] !== undefined && value[key] !== null && !Number.isNaN(Number(value[key]))) {
          return Number(value[key]);
        }
      }
      for (const key of ['data', 'summary', 'result', 'rows']) {
        const nested = readMetric(value[key]);
        if (nested !== null) return nested;
      }
      return null;
    };

    const params = buildBigQueryRequestParams(storeId, from, to, includeAllStatus);

    const response = await fetch(`${endpoint}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error(`BigQuery dashboard metric request failed: ${response.status}`);

    const payload = await response.json();
    const metric = readMetric(payload);
    this.logger.info('BigQuery dashboard metric API call succeeded', {
      area: 'orders',
      payload: { storeId, from: getDate(from), to: getDate(to), metric }
    });
    return metric;
  }

  private readNumericValue(value: any, keys: string[]): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
      return Number(value);
    }
    if (Array.isArray(value)) {
      const values = value.map(item => this.readNumericValue(item, keys)).filter((item): item is number => item !== null);
      return values.length ? values.reduce((sum, item) => sum + item, 0) : null;
    }
    if (!value || typeof value !== 'object') return null;

    for (const key of keys) {
      if (value[key] !== undefined && value[key] !== null && !Number.isNaN(Number(value[key]))) {
        return Number(value[key]);
      }
    }

    for (const nestedKey of ['data', 'summary', 'result', 'rows']) {
      const nested = this.readNumericValue(value[nestedKey], keys);
      if (nested !== null) return nested;
    }

    return null;
  }

  private async fetchBigQueryRows<T>(
    endpoint: string | undefined,
    storeId: string,
    from: Date,
    to: Date,
    keys: string[],
    includeAllStatus = false
  ): Promise<T[]> {
    const currentUser = this.authService.getCurrentUser() as any;
    const token = await currentUser?.getIdToken?.();

    if (!token || !endpoint || !storeId || storeId === 'all') return [];

    const params = buildBigQueryRequestParams(storeId, from, to, includeAllStatus);

    const response = await fetch(`${endpoint}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) {
      throw new Error(`BigQuery dashboard rows request failed: ${response.status}`);
    }

    const payload = await response.json();
    if (Array.isArray(payload)) return payload as T[];
    if (payload && typeof payload === 'object') {
      for (const key of keys) {
        const value = payload[key];
        if (Array.isArray(value)) return value as T[];
      }
      for (const key of ['data', 'result', 'rows', 'orders', 'adjustments', 'customers', 'statusBreakdown']) {
        const value = payload[key];
        if (Array.isArray(value)) return value as T[];
      }
    }
    return [];
  }

  private transformApiOrder(apiOrder: any): Order {
    const id = apiOrder.order_id || apiOrder.orderId || apiOrder.id || '';
    const dateRaw = apiOrder.updated_at || apiOrder.updatedAt || apiOrder.created_at || apiOrder.createdAt;
    const date = dateRaw ? new Date(dateRaw) : new Date();
    const gross = Number(apiOrder.gross_amount ?? apiOrder.grossAmount ?? apiOrder.total_amount ?? 0);
    const net = Number(apiOrder.net_amount ?? apiOrder.netAmount ?? apiOrder.total_amount ?? gross);
    const paymentMethod = apiOrder.payment || apiOrder.payment_method || apiOrder.paymentMethod || 'cash';
    const customerName = apiOrder.customerInfo?.fullName || apiOrder.soldTo || apiOrder.customerName || apiOrder.customer_name || 'Walk-in Customer';

    return {
      id,
      orderId: id || undefined,
      companyId: '',
      storeId: apiOrder.store_id || apiOrder.storeId || '',
      terminalId: apiOrder.terminalId || 'terminal-1',
      assignedCashierId: apiOrder.assignedCashierId || '',
      status: (apiOrder.status || apiOrder.order_status) ?? 'completed',
      cashSale: true,
      soldTo: customerName,
      tin: apiOrder.tin || '',
      businessAddress: apiOrder.businessAddress || apiOrder.customer_address || '',
      invoiceNumber: apiOrder.invoice_number || apiOrder.invoiceNumber || '',
      logoUrl: apiOrder.logoUrl || '',
      date,
      vatableSales: Number(apiOrder.vatable_sales ?? apiOrder.vatableSales ?? 0),
      vatAmount: Number(apiOrder.vat_amount ?? apiOrder.vatAmount ?? 0),
      zeroRatedSales: Number(apiOrder.zero_rated_sales ?? apiOrder.zeroRatedSales ?? 0),
      vatExemptAmount: Number(apiOrder.vat_exempt_amount ?? apiOrder.vatExemptAmount ?? 0),
      discountAmount: Number(apiOrder.discount_amount ?? apiOrder.discountAmount ?? 0),
      grossAmount: gross,
      netAmount: net,
      totalAmount: Number(apiOrder.total_amount ?? apiOrder.totalAmount ?? net ?? gross),
      exemptionId: apiOrder.exemptionId || '',
      signature: apiOrder.signature || '',
      atpOrOcn: apiOrder.atpOrOcn || 'OCN-2025-001234',
      birPermitNo: apiOrder.birPermitNo || 'BIR-PERMIT-2025-56789',
      inclusiveSerialNumber: apiOrder.inclusiveSerialNumber || '000001-000999',
      createdAt: date,
      message: apiOrder.message || 'Thank you for your purchase!',
      paymentMethod
    } as Order;
  }
}
