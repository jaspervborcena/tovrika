import { Injectable, inject } from '@angular/core';
import { Firestore, collection, query, where, getDocs, doc, limit, addDoc } from '@angular/fire/firestore';
import {
  ReconciliationDiscrepancy,
  ReconciliationInvoiceDetails,
  ReconciliationInvoiceItem,
  ReconciliationIssueCode,
  ReconciliationAuditLog,
  ReconciliationSummary
} from '../interfaces/reconciliation.interface';
import { AuthService } from './auth.service';
import { StoreService } from './store.service';
import { NetworkService } from '../core/services/network.service';
import { OrdersSellingTrackingService } from './orders-selling-tracking.service';
import { environment } from '../../environments/environment';

export class ReconSummaryApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'ReconSummaryApiError';
  }
}

interface ReconSummaryResponse {
  success: boolean;
  store_id: string;
  from: string;
  to: string;
  count: number;
  rows: ReconSummaryRow[];
}

interface ReconSummaryRow {
  invoiceNumber: string;
  createdAt: string;
  cashierName: string | null;
  totalAmount: number;
  itemCount: number;
  salesQty: number;
  inventoryQty: number;
  missingInventoryItemCount: number;
  quantityMismatchItemCount: number;
  hasInventoryIssue: true;
  issues: ReconciliationIssueCode[];
  issueType: ReconciliationIssueCode | 'MULTIPLE';
  severity: 'critical' | 'high';
}

@Injectable()
export class ReconciliationService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private storeService = inject(StoreService);
  private networkService = inject(NetworkService);
  private ordersSellingTrackingService = inject(OrdersSellingTrackingService);

  /** Map the invoice-level inventory exceptions returned by the reconciliation API. */
  async findDiscrepancies(
    storeId: string,
    startDate: string,
    endDate: string
  ): Promise<ReconciliationDiscrepancy[]> {
    const [store, rows] = await Promise.all([
      this.storeService.getStore(storeId),
      this.fetchReconSummaryRows(storeId, startDate, endDate)
    ]);
    const storeName = store?.storeName || 'Unknown Store';

    return rows.map(row => ({
      invoiceNumber: row.invoiceNumber,
      storeId,
      storeName,
      orderDate: new Date(row.createdAt),
      trackingAmount: row.totalAmount,
      trackingQuantity: row.salesQty,
      trackingItemCount: row.itemCount,
      salesQuantity: row.salesQty,
      inventoryQuantity: row.inventoryQty,
      missingInventoryItemCount: row.missingInventoryItemCount,
      quantityMismatchItemCount: row.quantityMismatchItemCount,
      issues: row.issues,
      severity: row.severity,
      cashierName: row.cashierName || 'Unknown'
    }));
  }

  /**
   * Get summary statistics for reconciliation
   */
  async getReconciliationSummary(
    storeId: string,
    startDate: string,
    endDate: string,
    existingDiscrepancies?: ReconciliationDiscrepancy[]
  ): Promise<ReconciliationSummary> {
    const discrepancies = existingDiscrepancies ?? await this.findDiscrepancies(storeId, startDate, endDate);

    return {
      totalOrders: discrepancies.length,
      ordersWithDiscrepancies: discrepancies.length,
      criticalIssues: discrepancies.filter(d => d.severity === 'critical').length,
      highIssues: discrepancies.filter(d => d.severity === 'high').length
    };
  }

  async getInvoiceDetails(storeId: string, invoiceNumber: string): Promise<ReconciliationInvoiceItem[]> {
    const endpoint = environment.api?.reconciliationInvoiceDetailsApi;
    if (!endpoint) {
      throw new ReconSummaryApiError(500, 'Reconciliation invoice details endpoint is not configured.');
    }

    await this.authService.waitForAuth();
    const token = await this.authService.getFirebaseIdToken(true);
    if (!token) {
      throw new ReconSummaryApiError(401, 'Sign in before loading reconciliation details.');
    }

    const params = new URLSearchParams({ storeId, invoiceNumber });
    const response = await fetch(`${endpoint}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) {
      throw new ReconSummaryApiError(response.status, `Reconciliation details request failed: ${response.status}`);
    }

    const payload = await response.json() as ReconciliationInvoiceDetails;
    if (
      !payload.success ||
      payload.storeId !== storeId ||
      payload.invoiceNumber !== invoiceNumber ||
      !Array.isArray(payload.items)
    ) {
      throw new ReconSummaryApiError(500, 'Reconciliation details response was invalid.');
    }

    return payload.items.map(item => {
      const numericFields = [
        item.salesQty,
        item.salesAmount,
        item.salesLineCount,
        item.inventoryQty,
        item.quantityDifference
      ];
      const validInventoryRows = Array.isArray(item.inventoryRows) &&
        item.inventoryRows.every(row =>
          typeof row.inventoryTrackingId === 'string' &&
          (row.quantity === null || typeof row.quantity === 'number') &&
          (row.runningBalanceTotalStock === null || typeof row.runningBalanceTotalStock === 'number')
        );
      if (
        item.invoiceNumber !== invoiceNumber ||
        numericFields.some(value => typeof value !== 'number' || !Number.isFinite(value)) ||
        !['NO_INVENTORY', 'QTY_MISMATCH', 'OK'].includes(item.issueType) ||
        !validInventoryRows
      ) {
        throw new ReconSummaryApiError(500, 'Reconciliation details API returned an invalid item row.');
      }
      return item;
    });
  }

  async reprocessInvoiceInventory(
    storeId: string,
    invoiceNumber: string
  ): Promise<{ success: boolean; message: string; error?: any }> {
    if (!storeId || !invoiceNumber) {
      return { success: false, message: 'A store and invoice number are required.' };
    }
    if (!this.networkService.isOnline()) {
      return { success: false, message: 'Connect to the internet before fixing inventory.' };
    }

    try {
      const ordersQuery = query(
        collection(this.firestore, 'orders'),
        where('invoiceNumber', '==', invoiceNumber),
        where('storeId', '==', storeId),
        limit(2)
      );
      const ordersSnapshot = await getDocs(ordersQuery);
      if (ordersSnapshot.empty) {
        return { success: false, message: 'Could not find this invoice in the selected store.' };
      }
      if (ordersSnapshot.size > 1) {
        return { success: false, message: 'More than one order matches this invoice; no inventory was changed.' };
      }

      return this.reprocessInventory(ordersSnapshot.docs[0].id, invoiceNumber, storeId);
    } catch (error) {
      console.error('Error finding invoice for inventory repair:', error);
      return {
        success: false,
        message: `Could not prepare inventory repair: ${error instanceof Error ? error.message : String(error)}`,
        error
      };
    }
  }

  private async fetchReconSummaryRows(
    storeId: string,
    from: string,
    to: string
  ): Promise<ReconSummaryRow[]> {
    const endpoint = environment.api?.reconciliationSummaryApi;
    if (!endpoint) {
      throw new ReconSummaryApiError(500, 'Reconciliation summary endpoint is not configured.');
    }

    return this.requestReconSummaryRows(endpoint, storeId, from, to);
  }

  private async requestReconSummaryRows(
    endpoint: string,
    storeId: string,
    from: string,
    to: string
  ): Promise<ReconSummaryRow[]> {
    await this.authService.waitForAuth();
    const token = await this.authService.getFirebaseIdToken(true);
    if (!token) {
      throw new ReconSummaryApiError(401, 'Sign in before loading reconciliation data.');
    }

    const params = new URLSearchParams({ storeId, from, to });
    const response = await fetch(`${endpoint}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new ReconSummaryApiError(response.status, `Reconciliation summary request failed: ${response.status}`);
    }

    const payload = await response.json() as ReconSummaryResponse;
    if (!payload.success || !Array.isArray(payload.rows)) {
      throw new ReconSummaryApiError(500, 'Reconciliation summary response was invalid.');
    }

    console.log('Reconciliation summary API result:', payload);
    return payload.rows.map(row => {
      const numericFields = [
        row.totalAmount,
        row.itemCount,
        row.salesQty,
        row.inventoryQty,
        row.missingInventoryItemCount,
        row.quantityMismatchItemCount
      ];
      const validIssues = Array.isArray(row.issues) &&
        row.issues.every(issue => issue === 'NO_INVENTORY' || issue === 'QTY_MISMATCH');
      if (
        typeof row.invoiceNumber !== 'string' ||
        typeof row.createdAt !== 'string' ||
        !Number.isFinite(Date.parse(row.createdAt)) ||
        numericFields.some(value => typeof value !== 'number' || !Number.isFinite(value)) ||
        !validIssues ||
        (row.severity !== 'critical' && row.severity !== 'high')
      ) {
        throw new ReconSummaryApiError(500, 'Reconciliation summary API returned an invalid invoice row.');
      }
      return row;
    });
  }

  /**
   * Reprocess inventory for an order using existing FIFO logic
   */
  protected async reprocessInventory(
    orderId: string,
    invoiceNumber = '',
    storeId = ''
  ): Promise<{ success: boolean; message: string; error?: any }> {
    try {
      const result = await this.ordersSellingTrackingService.processPendingInventoryForOrder(
        orderId,
        { trackedOnly: true }
      );
      if (result.errors.length > 0) {
        return {
          success: false,
          message: `FIFO inventory reconciliation processed ${result.processed} sale line(s) before failing: ${result.errors.map(entry => entry.error).join('; ')}`,
          error: result.errors
        };
      }
      if (result.processed === 0) {
        return {
          success: false,
          message: result.skipped > 0
            ? 'The sale line already has an inventory ledger entry or FIFO lock. No additional stock was deducted.'
            : 'No unprocessed completed tracked sale lines were found for this invoice.'
        };
      }

      await this.logReconciliationAction(orderId, invoiceNumber, storeId, 'inventory_reprocess', {
        inventoryProcessed: false,
        needsReconciliation: true
      }, {
        inventoryProcessed: true,
        needsReconciliation: false
      }, true);
      return {
        success: true,
        message: `FIFO inventory reconciliation completed for ${result.processed} tracked sale line(s).`
      };

    } catch (error) {
      console.error('Error reprocessing inventory:', error);
      return {
        success: false,
        message: `Failed to reprocess inventory: ${error instanceof Error ? error.message : String(error)}`,
        error
      };
    }
  }

  /**
   * Log reconciliation action to audit trail
   */
  private async logReconciliationAction(
    orderId: string,
    invoiceNumber: string,
    storeId: string,
    action: ReconciliationAuditLog['action'],
    beforeState: ReconciliationAuditLog['beforeState'],
    afterState: ReconciliationAuditLog['afterState'],
    success: boolean,
    error?: string
  ): Promise<void> {
    try {
      const user = this.authService.getCurrentUser();
      const auditLog: ReconciliationAuditLog = {
        orderId,
        invoiceNumber,
        storeId,
        performedBy: user?.uid || 'system',
        performedByName: user?.displayName || user?.email || 'System',
        performedAt: new Date(),
        action,
        beforeState,
        afterState,
        success,
        error
      };

      const auditRef = collection(this.firestore, 'reconciliationAuditLog');
      await addDoc(auditRef, auditLog);
    } catch (err) {
      console.error('⚠️ Failed to log reconciliation action:', err);
    }
  }
}
