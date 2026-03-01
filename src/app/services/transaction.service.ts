import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionGroup, doc, setDoc, addDoc, query, where, getDocs, getDoc, writeBatch } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { FirestoreSecurityService } from '../core/services/firestore-security.service';
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
  private productService = inject(ProductService);
  private inventoryService = inject(InventoryService);
  // NOTE: InventoryService writes to a different collection path than the newer inventory modules
  // (InventoryDataService/FIFOInventoryService). This service currently decrements a legacy
  // branches/{branch}/inventory subcollection. Consider refactoring to use FIFOInventoryService
  // so batch-level inventory is updated consistently across the app.

  async createTransaction(transaction: Omit<Transaction, 'id' | 'transactionNumber' | 'createdAt' | 'updatedAt'>) {
    const user = this.authService.getCurrentUser();
    const currentPermission = this.authService.getCurrentPermission();
    if (!user || !currentPermission?.companyId || !currentPermission?.storeId || !user.branchId) {
      throw new Error('User context not found');
    }

    try {
      // Generate transaction number
      const transactionNumber = await this.generateTransactionNumber(currentPermission.companyId);

      const now = new Date();
      // Normalize numeric fields to 2 decimals before saving
      const normalize = (n: any) => Math.round((Number(n || 0)) * 100) / 100;

      const newTransaction: Transaction = {
        ...transaction,
        transactionNumber,
        createdAt: now,
        updatedAt: now,
        subtotal: normalize(transaction.subtotal),
        tax: normalize(transaction.tax),
        total: normalize(transaction.total),
        amountTendered: normalize(transaction.amountTendered),
        change: normalize(transaction.change)
      };

      // 🔥 ATOMIC: Use batch write for transaction + inventory updates
      const batch = writeBatch(this.firestore);
      
      // Create transaction document
      const collectionPath = `companies/${currentPermission.companyId}/stores/${currentPermission.storeId}/branches/${user.branchId}/transactions`;
      const transactionRef = doc(collection(this.firestore, collectionPath));
      batch.set(transactionRef, newTransaction);
      
      // Add all inventory updates to the same batch
      for (const item of transaction.items) {
        const inventoryPath = `companies/${currentPermission.companyId}/stores/${currentPermission.storeId}/branches/${user.branchId}/inventory`;
        const inventoryRef = doc(this.firestore, inventoryPath, item.productId);
        
        // Get current inventory to calculate new quantity
        const currentInventory = await getDoc(inventoryRef);
        const currentQuantity = currentInventory.exists() ? (currentInventory.data()?.['quantity'] || 0) : 0;
        const newQuantity = currentQuantity - item.quantity;
        
        const inventoryData = {
          productId: item.productId,
          branchId: user.branchId,
          storeId: currentPermission.storeId,
          companyId: currentPermission.companyId,
          quantity: newQuantity,
          lastRestocked: currentInventory.exists() ? currentInventory.data()?.['lastRestocked'] : new Date(),
          updatedAt: new Date()
        };
        
        batch.set(inventoryRef, inventoryData, { merge: true });
      }
      
      // Commit all changes atomically - Firestore offline persistence queues this
      await batch.commit();
      
      console.log('✅ Transaction + inventory updated atomically:', transactionRef.id, navigator.onLine ? '(online)' : '(offline)');
      return transactionRef.id;
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

    // Query across all nested branch transactions using a collection group
    // Path: companies/{companyId}/stores/{storeId}/branches/{branchId}/transactions/{transactionId}
    const q = query(
      collectionGroup(this.firestore, 'transactions'),
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
      
      // Get transaction data first
      const transaction = await getDoc(transactionRef);
      const transactionData = transaction.data() as Transaction;
      
      if (!transactionData) {
        throw new Error('Transaction not found');
      }
      
      // 🔥 ATOMIC: Use batch write for void + inventory reversal
      const batch = writeBatch(this.firestore);
      
      // Void the transaction
      batch.set(transactionRef, updateData, { merge: true });
      
      // Reverse all inventory changes in the same batch
      for (const item of transactionData.items) {
        const inventoryPath = `companies/${currentPermission.companyId}/stores/${currentPermission.storeId}/branches/${user.branchId}/inventory`;
        const inventoryRef = doc(this.firestore, inventoryPath, item.productId);
        
        const currentInventory = await getDoc(inventoryRef);
        const currentQuantity = currentInventory.exists() ? (currentInventory.data()?.['quantity'] || 0) : 0;
        const restoredQuantity = currentQuantity + item.quantity;
        
        batch.set(inventoryRef, {
          quantity: restoredQuantity,
          updatedAt: new Date()
        }, { merge: true });
      }
      
      // Commit all changes atomically
      await batch.commit();
      console.log('✅ Transaction voided + inventory restored atomically:', transactionId);
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
      // Query across all branches using a collection group
      const q = query(
        collectionGroup(this.firestore, 'transactions'),
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
