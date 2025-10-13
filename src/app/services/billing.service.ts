import { Injectable, signal, computed } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp,
  limit,
  getDoc
} from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { CompanyBillingHistory } from '../interfaces/billing.interface';

export type { CompanyBillingHistory } from '../interfaces/billing.interface';

@Injectable({
  providedIn: 'root'
})
export class BillingService {
  private readonly billingHistorySignal = signal<CompanyBillingHistory[]>([]);
  
  // Public computed values
  readonly billingHistory = computed(() => this.billingHistorySignal());
  readonly totalRecords = computed(() => this.billingHistorySignal().length);

  constructor(
    private firestore: Firestore,
    private authService: AuthService
  ) {}

  /**
   * Create a new billing history record
   * Called when a subscription is purchased, upgraded, or renewed
   */
  async createBillingHistory(data: Omit<CompanyBillingHistory, 'id'>): Promise<string> {
    try {
      console.log('💳 Creating billing history record:', data);

      const billingData = {
        ...data,
        paidAt: data.paidAt instanceof Date ? Timestamp.fromDate(data.paidAt) : Timestamp.now(),
        createdAt: Timestamp.now()
      };

      const billingRef = collection(this.firestore, 'companyBillingHistory');
      const docRef = await addDoc(billingRef, billingData);

      console.log('✅ Billing history created with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error creating billing history:', error);
      throw error;
    }
  }

  /**
   * Get all billing history for a specific store
   */
  async getBillingHistoryByStore(storeId: string): Promise<CompanyBillingHistory[]> {
    try {
      console.log('📊 Loading billing history for store:', storeId);

      const billingRef = collection(this.firestore, 'companyBillingHistory');
      const billingQuery = query(
        billingRef,
        where('storeId', '==', storeId),
        orderBy('paidAt', 'desc')
      );

      const querySnapshot = await getDocs(billingQuery);
      const history = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          companyId: data['companyId'],
          storeId: data['storeId'],
          tier: data['tier'],
          cycle: data['cycle'],
          durationMonths: data['durationMonths'],
          amount: data['amount'],
          discountPercent: data['discountPercent'] || 0,
          finalAmount: data['finalAmount'],
          promoCode: data['promoCode'],
          referralCode: data['referralCode'],
          paymentMethod: data['paymentMethod'],
          transactionId: data['transactionId'],
          paidAt: data['paidAt']?.toDate() || new Date(),
          createdAt: data['createdAt']?.toDate() || new Date()
        } as CompanyBillingHistory;
      });

      this.billingHistorySignal.set(history);
      console.log('✅ Loaded', history.length, 'billing records');
      return history;
    } catch (error) {
      console.error('❌ Error loading billing history:', error);
      throw error;
    }
  }

  /**
   * Get all billing history for a company (all stores)
   */
  async getBillingHistoryByCompany(companyId: string): Promise<CompanyBillingHistory[]> {
    try {
      console.log('📊 Loading billing history for company:', companyId);

      const billingRef = collection(this.firestore, 'companyBillingHistory');
      const billingQuery = query(
        billingRef,
        where('companyId', '==', companyId),
        orderBy('paidAt', 'desc')
      );

      const querySnapshot = await getDocs(billingQuery);
      const history = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          companyId: data['companyId'],
          storeId: data['storeId'],
          tier: data['tier'],
          cycle: data['cycle'],
          durationMonths: data['durationMonths'],
          amount: data['amount'],
          discountPercent: data['discountPercent'] || 0,
          finalAmount: data['finalAmount'],
          promoCode: data['promoCode'],
          referralCode: data['referralCode'],
          paymentMethod: data['paymentMethod'],
          transactionId: data['transactionId'],
          paidAt: data['paidAt']?.toDate() || new Date(),
          createdAt: data['createdAt']?.toDate() || new Date()
        } as CompanyBillingHistory;
      });

      console.log('✅ Loaded', history.length, 'billing records for company');
      return history;
    } catch (error) {
      console.error('❌ Error loading company billing history:', error);
      throw error;
    }
  }

  /**
   * Get total amount spent by a store
   */
  async getTotalSpentByStore(storeId: string): Promise<number> {
    try {
      const history = await this.getBillingHistoryByStore(storeId);
      const total = history.reduce((sum, record) => sum + record.finalAmount, 0);
      console.log('💰 Total spent by store', storeId, ':', total);
      return total;
    } catch (error) {
      console.error('❌ Error calculating total spent:', error);
      return 0;
    }
  }

  /**
   * Get total amount spent by a company (all stores)
   */
  async getTotalSpentByCompany(companyId: string): Promise<number> {
    try {
      const history = await this.getBillingHistoryByCompany(companyId);
      const total = history.reduce((sum, record) => sum + record.finalAmount, 0);
      console.log('💰 Total spent by company', companyId, ':', total);
      return total;
    } catch (error) {
      console.error('❌ Error calculating company total spent:', error);
      return 0;
    }
  }

  /**
   * Get latest billing record for a store
   */
  async getLatestBillingByStore(storeId: string): Promise<CompanyBillingHistory | null> {
    try {
      const billingRef = collection(this.firestore, 'companyBillingHistory');
      const billingQuery = query(
        billingRef,
        where('storeId', '==', storeId),
        orderBy('paidAt', 'desc'),
        limit(1)
      );

      const querySnapshot = await getDocs(billingQuery);
      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      const data = doc.data();
      return {
        id: doc.id,
        companyId: data['companyId'],
        storeId: data['storeId'],
        tier: data['tier'],
        cycle: data['cycle'],
        durationMonths: data['durationMonths'],
        amount: data['amount'],
        discountPercent: data['discountPercent'] || 0,
        finalAmount: data['finalAmount'],
        promoCode: data['promoCode'],
        referralCode: data['referralCode'],
        paymentMethod: data['paymentMethod'],
        transactionId: data['transactionId'],
        paidAt: data['paidAt']?.toDate() || new Date(),
        createdAt: data['createdAt']?.toDate() || new Date()
      } as CompanyBillingHistory;
    } catch (error) {
      console.error('❌ Error getting latest billing:', error);
      return null;
    }
  }

  /**
   * Get billing history by payment method
   */
  async getBillingHistoryByPaymentMethod(
    companyId: string,
    paymentMethod: string
  ): Promise<CompanyBillingHistory[]> {
    try {
      const billingRef = collection(this.firestore, 'companyBillingHistory');
      const billingQuery = query(
        billingRef,
        where('companyId', '==', companyId),
        where('paymentMethod', '==', paymentMethod),
        orderBy('paidAt', 'desc')
      );

      const querySnapshot = await getDocs(billingQuery);
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          companyId: data['companyId'],
          storeId: data['storeId'],
          tier: data['tier'],
          cycle: data['cycle'],
          durationMonths: data['durationMonths'],
          amount: data['amount'],
          discountPercent: data['discountPercent'] || 0,
          finalAmount: data['finalAmount'],
          promoCode: data['promoCode'],
          referralCode: data['referralCode'],
          paymentMethod: data['paymentMethod'],
          transactionId: data['transactionId'],
          paidAt: data['paidAt']?.toDate() || new Date(),
          createdAt: data['createdAt']?.toDate() || new Date()
        } as CompanyBillingHistory;
      });
    } catch (error) {
      console.error('❌ Error getting billing by payment method:', error);
      return [];
    }
  }

  /**
   * Delete a billing history record (admin only)
   */
  async deleteBillingHistory(billingId: string): Promise<void> {
    try {
      console.log('🗑️ Deleting billing history:', billingId);
      const billingRef = doc(this.firestore, 'companyBillingHistory', billingId);
      await deleteDoc(billingRef);
      console.log('✅ Billing history deleted');
    } catch (error) {
      console.error('❌ Error deleting billing history:', error);
      throw error;
    }
  }

  /**
   * Clear local signal
   */
  clearBillingHistory(): void {
    this.billingHistorySignal.set([]);
  }
}
