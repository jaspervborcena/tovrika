import { Injectable, inject } from '@angular/core';
import { Firestore, collection, query, where, getDocs, Timestamp } from '@angular/fire/firestore';
import { ExpenseLog } from '../interfaces/expense-log.interface';
import { OfflineDocumentService } from '../core/services/offline-document.service';

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private firestore = inject(Firestore);
  private offlineDocService = inject(OfflineDocumentService);

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
