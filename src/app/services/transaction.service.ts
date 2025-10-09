import { Injectable, inject } from '@angular/core';
import { Firestore, collection, doc, setDoc, addDoc, query, where, getDocs, getDoc } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { FirestoreSecurityService } from '../core/services/firestore-security.service';
import { OfflineDocumentService } from '../core/services/offline-document.service';
import { ProductService } from './product.service';
import { InventoryService } from './inventory.service';

export interface Transaction {
  id?: string;
  transactionNumber: string;
  companyId: string;
  storeId: string;
  branchId: string;
  cashierId: string;
  items: {
    productId: string;
    name: string;
    quantity: number;
    price: number;
    tax: number;
  }[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: string;
  amountTendered: number;
  change: number;
  status: 'completed' | 'void' | 'refunded';
  createdAt: Date;
  updatedAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class TransactionService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private firestoreSecurityService = inject(FirestoreSecurityService);
  private offlineDocService = inject(OfflineDocumentService);
  private productService = inject(ProductService);
  private inventoryService = inject(InventoryService);

  async createTransaction(transaction: Omit<Transaction, 'id' | 'transactionNumber' | 'createdAt' | 'updatedAt'>) {
    const user = this.authService.getCurrentUser();
    const currentPermission = this.authService.getCurrentPermission();
    if (!user || !currentPermission?.companyId || !currentPermission?.storeId || !user.branchId) {
      throw new Error('User context not found');
    }

    try {
      // Generate transaction number
      const transactionNumber = await this.generateTransactionNumber(currentPermission.companyId);

      const newTransaction: Transaction = {
        ...transaction,
        transactionNumber,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // 🔥 OFFLINE-SAFE: Use OfflineDocumentService for pre-generated IDs
      const collectionPath = `companies/${currentPermission.companyId}/stores/${currentPermission.storeId}/branches/${user.branchId}/transactions`;
      const documentId = await this.offlineDocService.createDocument(collectionPath, newTransaction);

      // Update inventory
      for (const item of transaction.items) {
        await this.inventoryService.updateStock(
          item.productId,
          -item.quantity,
          currentPermission.companyId,
          currentPermission.storeId,
          user.branchId,
          true
        );
      }

      console.log('✅ Transaction created with pre-generated ID:', documentId, navigator.onLine ? '(online)' : '(offline)');
      return documentId;
    } catch (error) {
      console.error('Error creating transaction:', error);
      throw error;
    }
  }

  private async generateTransactionNumber(companyId: string): Promise<string> {
    const date = new Date();
    const year = date.getFullYear().toString().substr(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    // Get today's transactions count
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));
    
    const q = query(
      collection(this.firestore, 'transactions'),
      where('companyId', '==', companyId),
      where('createdAt', '>=', startOfDay),
      where('createdAt', '<=', endOfDay)
    );
    
    const snapshot = await getDocs(q);
    const sequence = (snapshot.size + 1).toString().padStart(4, '0');
    
    return `${year}${month}${day}-${sequence}`;
  }

  async voidTransaction(transactionId: string) {
    const user = this.authService.getCurrentUser();
    const currentPermission = this.authService.getCurrentPermission();
    if (!user || !currentPermission?.companyId || !currentPermission?.storeId || !user.branchId) {
      throw new Error('User context not found');
    }

    try {
      const transactionRef = doc(
        this.firestore,
        `companies/${currentPermission.companyId}/stores/${currentPermission.storeId}/branches/${user.branchId}/transactions/${transactionId}`
      );

      const updateData = await this.firestoreSecurityService.addUpdateSecurityFields({
        status: 'void',
        updatedAt: new Date()
      });
      await setDoc(transactionRef, updateData, { merge: true });

      // Reverse inventory changes
      const transaction = await getDoc(transactionRef);
      const transactionData = transaction.data() as Transaction;

      if (transactionData) {
        for (const item of transactionData.items) {
          await this.inventoryService.updateStock(
            item.productId,
            item.quantity,
            currentPermission.companyId,
            currentPermission.storeId,
            user.branchId,
            true
          );
        }
      }
    } catch (error) {
      console.error('Error voiding transaction:', error);
      throw error;
    }
  }

  async getTransactions(startDate: Date, endDate: Date) {
    const user = this.authService.getCurrentUser();
    const currentPermission = this.authService.getCurrentPermission();
    if (!user || !currentPermission?.companyId) {
      throw new Error('User context not found');
    }

    try {
      const q = query(
        collection(this.firestore, 'transactions'),
        where('companyId', '==', currentPermission.companyId),
        where('createdAt', '>=', startDate),
        where('createdAt', '<=', endDate)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }) as Transaction);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  }
}
