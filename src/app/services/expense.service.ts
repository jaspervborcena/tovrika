import { Injectable, inject } from '@angular/core';
import { Firestore, collection, query, where, getDocs, Timestamp } from '@angular/fire/firestore';
import { ExpenseLog } from '../interfaces/expense-log.interface';
import { OfflineDocumentService } from '../core/services/offline-document.service';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private firestore = inject(Firestore);
  private offlineDocService = inject(OfflineDocumentService);
  private authService = inject(AuthService);

  constructor() {}

  /**
   * Fetch expense logs for a store within optional date range.
   */
  async getExpensesByStore(storeId: string, startDate?: Date, endDate?: Date): Promise<ExpenseLog[]> {
    if (!storeId) return [];
    try {
      const expensesRef = collection(this.firestore, 'expenseLogs');
      const q = query(expensesRef, where('storeId', '==', storeId));
      const snap = await getDocs(q);
      const results: ExpenseLog[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as ExpenseLog));

      if (!startDate || !endDate) {
        return results;
      }

      const normalizedStart = new Date(startDate);
      const normalizedEnd = new Date(endDate);
      normalizedEnd.setHours(23, 59, 59, 999);

      return results.filter((expense) => {
        const dateCandidate = (expense as any)?.paymentDate ?? (expense as any)?.createdAt;
        let expenseDate: Date | null = null;

        if (dateCandidate?.toDate) {
          expenseDate = dateCandidate.toDate();
        } else if (dateCandidate instanceof Date) {
          expenseDate = dateCandidate;
        } else if (dateCandidate) {
          expenseDate = new Date(dateCandidate);
        }

        if (!expenseDate || Number.isNaN(expenseDate.getTime())) {
          return false;
        }

        return expenseDate >= normalizedStart && expenseDate <= normalizedEnd;
      });
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
