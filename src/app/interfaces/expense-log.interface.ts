import { Timestamp } from '@angular/fire/firestore';

export interface ExpenseLog {
  id: string; // Unique ID (e.g., UUID or Firestore doc ID)
  storeId: string; // FK to store or branch
  createdBy: string; // UID of user who logged the expense
  createdAt: Timestamp; // Firestore timestamp
  updatedAt?: Timestamp; // Optional for audit trail

  category: 'supplies' | 'utilities' | 'rent' | 'salary' | 'marketing' | 'other';
  description: string; // Free-text or templated
  amount: number; // In centavos for precision
  currency: 'PHP'; // Future-proofing for multi-currency

  paymentMethod: 'cash' | 'gcash' | 'bank' | 'credit' | 'other';
  paymentDate: Timestamp; // Actual date of payment
  referenceId?: string; // Optional: OR number, transaction ID, etc.

  tags?: string[]; // Optional: for filtering or analytics
  isRecurring?: boolean; // Optional: for future automation
  voided?: boolean; // Soft delete / audit trail
  voidReason?: string; // If voided, explain why
}

export type ExpenseCategory = ExpenseLog['category'];
