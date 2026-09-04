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

export interface SalesOrdersSummary {
  totalOrders: number;
  totalItems: number;
  totalSales: number;
}

export interface SalesSummaryTotals extends SalesOrdersSummary {
  statusBreakdown: Array<{ status: string; count: number; amount: number }>;
}

const productionSalesOrdersApi = 'https://asia-east1-jasperpos-1dfd5.cloudfunctions.net/get_sales_orders_bq';

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

  async getSalesSummaryTotals(storeId: string, from: Date, to: Date, includeAllStatus = false): Promise<SalesSummaryTotals> {
    const endpoint = environment.api?.salesSummaryApi || environment.api?.salesRevenueApi;
    await this.authService.waitForAuth();
    const token = await this.authService.getFirebaseIdToken(true);

    if (!token) {
      console.warn('❌ getSalesSummaryTotals - Missing token (user not authenticated or session expired)');
      return { totalSales: 0, totalOrders: 0, totalItems: 0, statusBreakdown: [] };
    }
    if (!endpoint) {
      console.warn('❌ getSalesSummaryTotals - Missing endpoint (API URL not configured)');
      return { totalSales: 0, totalOrders: 0, totalItems: 0, statusBreakdown: [] };
    }
    if (!storeId) {
      console.warn('❌ getSalesSummaryTotals - Missing storeId');
      return { totalSales: 0, totalOrders: 0, totalItems: 0, statusBreakdown: [] };
    }
    if (storeId === 'all') {
      console.warn('❌ getSalesSummaryTotals - storeId is "all" (not supported for BigQuery)');
      return { totalSales: 0, totalOrders: 0, totalItems: 0, statusBreakdown: [] };
    }

    const params = buildBigQueryRequestParams(storeId, from, to, includeAllStatus);
    const urlString = `${endpoint}?${params.toString()}`;
    console.log('💰 [Revenue API Call] GET', urlString);

    const response = await fetch(urlString, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ BigQuery sales summary totals request failed: ${response.status}`, errorText);
      throw new Error(`BigQuery sales summary totals request failed: ${response.status}`);
    }

    const payload = await response.json();
    console.log('📦 [Revenue API Response] Full payload:', JSON.stringify(payload, null, 2));
    console.log('📦 [Revenue API Response] payload keys:', Object.keys(payload));
    console.log('📦 [Revenue API Response] payload.data:', payload.data);
    console.log('📦 [Revenue API Response] payload.rows:', payload.rows);
    console.log('📦 [Revenue API Response] payload.result:', payload.result);
    console.log('📦 [Revenue API Response] payload.summary:', payload.summary);

    const totalSales = this.readNumericValue(payload, [
      'total_sales', 'totalSales', 'totalRevenue', 'total_revenue', 'revenue',
      'totalAmount', 'total_amount', 'grossAmount', 'gross_amount', 'amount'
    ]);
    const totalOrders = this.readNumericValue(payload, [
      'count', 'total_orders', 'totalOrders', 'orders_count', 'orderCount', 'order_count'
    ]);
    const totalItems = this.readNumericValue(payload, [
      'total_items', 'totalItems', 'items_count', 'itemCount', 'quantity', 'total_quantity'
    ]);
    const statusBreakdown = this.findNestedArray(payload, [
      'statusBreakdown', 'status_breakdown', 'statuses'
    ]) ?? [];

    const result = {
      totalSales: Number(totalSales ?? 0),
      totalOrders: Number(totalOrders ?? 0),
      totalItems: Number(totalItems ?? 0),
      statusBreakdown: statusBreakdown as Array<{ status: string; count: number; amount: number }>
    };

    console.log('✅ [Revenue Extracted] totalSales:', totalSales, 'totalOrders:', totalOrders, 'totalItems:', totalItems);
    console.log('✅ [Revenue Final Result]', result);
    return result;
  }

  async getSalesDashboardOrders(storeId: string, from: Date, to: Date, includeAllStatus = false): Promise<Order[]> {
    console.log('📦 [Orders API] Fetching orders for storeId:', storeId);
    const rows = await this.fetchBigQueryRows<any>(
      environment.production
        ? productionSalesOrdersApi
        : environment.api?.ordersApi || environment.api?.directOrdersApi || environment.api?.salesSummaryApi,
      storeId,
      from,
      to,
      ['orders', 'data', 'rows', 'result'],
      includeAllStatus
    );

    const orders = (rows || []).map((order: any) => this.transformApiOrder(order));
    console.log('✅ [Orders API Response] Received', orders.length, 'orders');
    return orders;
  }

  async getSalesDashboardOrderSummary(storeId: string, from: Date, to: Date, includeAllStatus = false): Promise<SalesOrdersSummary> {
    const endpoint = environment.production
      ? productionSalesOrdersApi
      : environment.api?.ordersApi || environment.api?.directOrdersApi || environment.api?.salesSummaryApi;
    await this.authService.waitForAuth();
    const token = await this.authService.getFirebaseIdToken(true);

    if (!token || !endpoint || !storeId || storeId === 'all') {
      return { totalOrders: 0, totalItems: 0, totalSales: 0 };
    }

    const params = buildBigQueryRequestParams(storeId, from, to, includeAllStatus);
    const response = await fetch(`${endpoint}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ BigQuery orders summary request failed: ${response.status}`, errorText);
      throw new Error(`BigQuery orders summary request failed: ${response.status}`);
    }

    const payload = await response.json();
    return {
      totalOrders: Number(this.readNumericValue(payload, ['totalOrders', 'total_orders', 'orders_count', 'orderCount', 'order_count', 'count']) ?? 0),
      totalItems: Number(this.readNumericValue(payload, ['totalItems', 'total_items', 'items_count', 'itemCount', 'total_quantity', 'quantity']) ?? 0),
      totalSales: Number(this.readNumericValue(payload, ['totalSales', 'total_sales', 'totalRevenue', 'total_revenue', 'totalAmount', 'total_amount', 'amount']) ?? 0)
    };
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
    const summary = await this.getSalesSummaryTotals(storeId, from, to, includeAllStatus);
    return summary.statusBreakdown;
  }

  private async fetchBigQueryMetric(
    endpoint: string | undefined,
    storeId: string,
    from: Date,
    to: Date,
    keys: string[],
    includeAllStatus = false
  ): Promise<number | null> {
    await this.authService.waitForAuth();
    const token = await this.authService.getFirebaseIdToken(true);

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
    await this.authService.waitForAuth();
    const token = await this.authService.getFirebaseIdToken(true);

    if (!token) {
      console.warn('❌ fetchBigQueryRows - Missing token (user not authenticated or session expired)');
      return [];
    }
    if (!endpoint) {
      console.warn('❌ fetchBigQueryRows - Missing endpoint (API URL not configured)');
      return [];
    }
    if (!storeId) {
      console.warn('❌ fetchBigQueryRows - Missing storeId');
      return [];
    }
    if (storeId === 'all') {
      console.warn('❌ fetchBigQueryRows - storeId is "all" (not supported for BigQuery)');
      return [];
    }

    const params = buildBigQueryRequestParams(storeId, from, to, includeAllStatus);
    const urlString = `${endpoint}?${params.toString()}`;
    console.log('🌐 [BigQuery API Call]', urlString.split('?')[0], '| Params:', params.toString());

    const response = await fetch(urlString, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ BigQuery dashboard rows request failed: ${response.status}`, errorText);
      throw new Error(`BigQuery dashboard rows request failed: ${response.status}`);
    }

    const payload = await response.json();
    console.log('📋 [BigQuery Response]', payload);

    const foundArray = this.findNestedArray(payload, keys);
    if (foundArray) {
      console.log('✅ [BigQuery] Found nested array in response, returning', foundArray.length, 'items');
      return foundArray as T[];
    }

    console.warn('⚠️ [BigQuery] No array found in response');
    return [];
  }

  private findNestedArray(value: any, preferredKeys: string[]): any[] | null {
    if (Array.isArray(value)) {
      return value;
    }

    if (!value || typeof value !== 'object') {
      return null;
    }

    const directKeys = [...preferredKeys, 'data', 'result', 'rows', 'orders', 'adjustments', 'customers', 'statusBreakdown', 'statuses'];

    for (const key of directKeys) {
      const nested = value[key];
      if (Array.isArray(nested)) {
        return nested;
      }

      const found = this.findNestedArray(nested, preferredKeys);
      if (found) {
        return found;
      }
    }

    for (const nestedValue of Object.values(value)) {
      const found = this.findNestedArray(nestedValue, preferredKeys);
      if (found) {
        return found;
      }
    }

    return null;
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
