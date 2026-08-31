import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { LoggerService } from '../core/services/logger.service';
import { environment } from '../../environments/environment';
import { Order } from '../interfaces/pos.interface';

@Injectable({
  providedIn: 'root'
})
export class BigQueryService {
  private authService = inject(AuthService);
  private logger = inject(LoggerService);

  async getSalesSummaryRevenue(storeId: string, from: Date, to: Date): Promise<number | null> {
    const endpoint = environment.api?.salesSummaryApi || environment.api?.salesRevenueApi;
    return this.fetchBigQueryMetric(endpoint, storeId, from, to, [
      'totalRevenue', 'total_revenue', 'revenue', 'totalSales', 'total_sales',
      'totalAmount', 'total_amount', 'netAmount', 'net_amount', 'grossAmount', 'gross_amount',
      'total', 'amount', 'sales'
    ]);
  }

  async getSalesDashboardRevenue(storeId: string, from: Date, to: Date): Promise<number> {
    const amount = await this.fetchBigQueryMetric(
      environment.api?.salesRevenueApi || environment.api?.salesSummaryApi,
      storeId,
      from,
      to,
      ['totalRevenue', 'total_revenue', 'revenue', 'totalSales', 'total_sales', 'totalAmount', 'total_amount', 'netAmount', 'net_amount', 'grossAmount', 'gross_amount', 'total', 'amount', 'sales']
    );
    return Number(amount ?? 0);
  }

  async getSalesSummaryTotals(storeId: string, from: Date, to: Date): Promise<{ totalSales: number; totalOrders: number; totalItems: number }> {
    const endpoint = environment.api?.salesSummaryApi || environment.api?.salesRevenueApi;
    const currentUser = this.authService.getCurrentUser() as any;
    const token = await currentUser?.getIdToken?.();

    if (!token || !endpoint || !storeId || storeId === 'all') {
      return { totalSales: 0, totalOrders: 0, totalItems: 0 };
    }

    const params = new URLSearchParams({
      storeId,
      from: this.formatDateForApi(from),
      to: this.formatDateForApi(to)
    });

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

  async getSalesDashboardOrders(storeId: string, from: Date, to: Date): Promise<Order[]> {
    const rows = await this.fetchBigQueryRows<any>(
      environment.api?.ordersApi || environment.api?.directOrdersApi || environment.api?.salesSummaryApi,
      storeId,
      from,
      to,
      ['orders', 'data', 'rows', 'result']
    );

    return (rows || []).map((order: any) => this.transformApiOrder(order));
  }

  async getSalesDashboardAdjustments(storeId: string, from: Date, to: Date): Promise<any[]> {
    return this.fetchBigQueryRows<any>(
      environment.api?.salesAdjustmentsApi,
      storeId,
      from,
      to,
      ['adjustments', 'data', 'rows', 'result']
    );
  }

  async getSalesDashboardCustomers(storeId: string, from: Date, to: Date): Promise<any[]> {
    return this.fetchBigQueryRows<any>(
      environment.api?.salesCustomersApi,
      storeId,
      from,
      to,
      ['customers', 'data', 'rows', 'result']
    );
  }

  async getSalesDashboardStatusBreakdown(storeId: string, from: Date, to: Date): Promise<any[]> {
    return this.fetchBigQueryRows<any>(
      environment.api?.salesStatusBreakdownApi,
      storeId,
      from,
      to,
      ['statusBreakdown', 'status_breakdown', 'statuses', 'status', 'data', 'rows', 'result']
    );
  }

  private async fetchBigQueryMetric(
    endpoint: string | undefined,
    storeId: string,
    from: Date,
    to: Date,
    keys: string[]
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

    const params = new URLSearchParams({
      storeId,
      from: getDate(from),
      to: getDate(to)
    });

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
    keys: string[]
  ): Promise<T[]> {
    const currentUser = this.authService.getCurrentUser() as any;
    const token = await currentUser?.getIdToken?.();

    if (!token || !endpoint || !storeId || storeId === 'all') return [];

    const params = new URLSearchParams({
      storeId,
      from: this.formatDateForApi(from),
      to: this.formatDateForApi(to)
    });

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

  private formatDateForApi(date: Date): string {
    const dateStr = date.toISOString().split('T')[0];
    return dateStr.replace(/-/g, '');
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
