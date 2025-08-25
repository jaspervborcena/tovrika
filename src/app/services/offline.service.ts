import { Injectable, signal } from '@angular/core';
import { Firestore, collection, doc, setDoc, getDocs, query, where } from '@angular/fire/firestore';
import { fromEvent, merge, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class OfflineService {
  private readonly isOnline = signal<boolean>(navigator.onLine);
  private readonly pendingTransactions = signal<any[]>([]);
  private readonly syncInProgress = signal<boolean>(false);

  readonly online$ = merge(
    fromEvent(window, 'online').pipe(map(() => true)),
    fromEvent(window, 'offline').pipe(map(() => false))
  );

  constructor(private firestore: Firestore) {
    // Listen for online/offline events
    this.online$.subscribe(online => {
      this.isOnline.set(online);
      if (online) {
        this.syncPendingTransactions();
      }
    });

    // Load pending transactions from IndexedDB
    this.loadPendingTransactions();
  }

  async savePendingTransaction(transaction: any) {
    try {
      // Store in IndexedDB
      const pendingTx = {
        ...transaction,
        pendingId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        synced: false
      };

      // Add to pending transactions
      this.pendingTransactions.update(txs => [...txs, pendingTx]);

      // Store in local storage as backup
      localStorage.setItem(
        'pendingTransactions',
        JSON.stringify(this.pendingTransactions())
      );

      return pendingTx.pendingId;
    } catch (error) {
      console.error('Error saving pending transaction:', error);
      throw error;
    }
  }

  private async loadPendingTransactions() {
    try {
      const stored = localStorage.getItem('pendingTransactions');
      if (stored) {
        const transactions = JSON.parse(stored);
        this.pendingTransactions.set(transactions);
      }
    } catch (error) {
      console.error('Error loading pending transactions:', error);
    }
  }

  private async syncPendingTransactions() {
    if (this.syncInProgress() || !this.isOnline()) return;

    try {
      this.syncInProgress.set(true);
      const transactions = this.pendingTransactions();

      for (const tx of transactions) {
        if (!tx.synced) {
          try {
            // Remove pendingId and synced status before saving to Firestore
            const { pendingId, synced, ...transactionData } = tx;
            
            // Create transaction in Firestore
            const transactionsRef = collection(
              this.firestore,
              `companies/${tx.companyId}/stores/${tx.storeId}/branches/${tx.branchId}/transactions`
            );
            await setDoc(doc(transactionsRef), transactionData);

            // Mark as synced
            tx.synced = true;
          } catch (error) {
            console.error(`Error syncing transaction ${tx.pendingId}:`, error);
          }
        }
      }

      // Remove synced transactions
      this.pendingTransactions.update(txs => txs.filter(tx => !tx.synced));
      
      // Update local storage
      localStorage.setItem(
        'pendingTransactions',
        JSON.stringify(this.pendingTransactions())
      );
    } finally {
      this.syncInProgress.set(false);
    }
  }

  getConnectionStatus() {
    return {
      isOnline: this.isOnline(),
      pendingTransactions: this.pendingTransactions().length,
      syncInProgress: this.syncInProgress()
    };
  }

  getPendingTransactions() {
    return this.pendingTransactions();
  }
}
