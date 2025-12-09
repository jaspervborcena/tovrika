import { Injectable, inject } from '@angular/core';
import { Firestore, collection, query, where, getDocs, Timestamp } from '@angular/fire/firestore';
import { ExpenseLog } from '../interfaces/expense-log.interface';
import { OfflineDocumentService } from '../core/services/offline-document.service';
import { LedgerService } from './ledger.service';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private firestore = inject(Firestore);
  private offlineDocService = inject(OfflineDocumentService);
  private ledgerService = inject(LedgerService);
  private authService = inject(AuthService);

  constructor() {}

  /**
   * Fetch expense logs for a store within optional date range.
   */
  async getExpensesByStore(storeId: string, startDate?: Date, endDate?: Date): Promise<ExpenseLog[]> {
    if (!storeId) return [];
    try {
      const expensesRef = collection(this.firestore, 'expenseLogs');
      let q;
      if (startDate && endDate) {
        const startTs = Timestamp.fromDate(startDate);
        const endTs = Timestamp.fromDate(endDate);
        q = query(expensesRef, where('storeId', '==', storeId), where('paymentDate', '>=', startTs), where('paymentDate', '<=', endTs));
      } else {
        q = query(expensesRef, where('storeId', '==', storeId));
      }

      const snap = await getDocs(q);
      const results: ExpenseLog[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as ExpenseLog));
      return results;
    } catch (e) {
      console.warn('ExpenseService: failed to load expenses', e);
      return [];
    }
  }

  /**
   * Create a new expense log (offline-safe).
   * Returns the document ID (may be a temp id when offline).
   */
  async createExpense(payload: Partial<ExpenseLog>): Promise<string> {
    try {
      // Ensure collection name matches reads
      const id = await this.offlineDocService.createDocument('expenseLogs', payload);

      // After successfully creating an expense log, write an 'expense' ledger entry.
      // ExpenseLog.amount is stored in centavos; convert to PHP (divide by 100).
      try {
        const companyId = this.authService.getCurrentPermission()?.companyId || '';
        const storeId = (payload as any)?.storeId || '';
        const performedBy = (payload as any)?.createdBy || this.authService.getCurrentUser()?.uid || 'system';
        const amountCentavos = Number((payload as any)?.amount || 0);
        const amountPhp = amountCentavos / 100;

        // Call ledger service - qty is 0 for expense entries
        await this.ledgerService.recordEvent(companyId, storeId, id, 'expense' as any, amountPhp, 0, performedBy);
        console.log('ExpenseService: ledger expense entry created for', id, 'amountPhp=', amountPhp);
      } catch (ledgerErr) {
        console.warn('ExpenseService: failed to write expense ledger entry', ledgerErr);
      }

      return id;
    } catch (error) {
      console.error('ExpenseService.createExpense failed', error);
      throw error;
    }
  }

  /**
   * Update an expense (offline-safe)
   */
  async updateExpense(id: string, updates: Partial<ExpenseLog>): Promise<void> {
    try {
      await this.offlineDocService.updateDocument('expenseLogs', id, updates);
    } catch (error) {
      console.error('ExpenseService.updateExpense failed', error);
      throw error;
    }
  }

  /**
   * Delete an expense (offline-safe)
   */
  async deleteExpense(id: string): Promise<void> {
    try {
      await this.offlineDocService.deleteDocument('expenseLogs', id);
    } catch (error) {
      console.error('ExpenseService.deleteExpense failed', error);
      throw error;
    }
  }
}
