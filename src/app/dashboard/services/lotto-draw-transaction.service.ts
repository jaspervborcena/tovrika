import { Injectable, inject, signal} from '@angular/core';
import { Firestore, collection, query, where, onSnapshot ,updateDoc,getDocs} from '@angular/fire/firestore';
import { LottoDrawTransaction } from '../models/lotto-draw';
import { Collection } from '../enum/collection.enum';
@Injectable({
  providedIn: 'root',
})
export class LottoDrawTransactionService {
  public lottoDrawTransactionsSignal = signal<LottoDrawTransaction[]>([]);
  private collectionName = Collection.LOTTO_DRAWS;
  private firestore = inject(Firestore);

  constructor() {}

  // ✅ Listen for changes dynamically
  listenToTransactions(drawIds: string[]): void {
    if (!drawIds.length) return; // 🛑 Prevent empty queries
  
    const drawCollection = collection(this.firestore, this.collectionName);
    const drawQuery = query(drawCollection, where("drawId", "in", drawIds.slice(0, 10)));
  
    onSnapshot(drawQuery, (querySnapshot) => {
      const mergedTransactions = new Map<string, LottoDrawTransaction>(); // Map to store merged results
  
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const details = Array.isArray(data['details']) ? data['details'] : [];
  
        details.forEach((detail: any) => {
          if (detail.status !== "S") return; // 🔥 Skip irrelevant transactions
  
          const ticketId = detail.ticketId || ''; // Get ticketId
          const existingTransaction = mergedTransactions.get(ticketId);
  
          if (existingTransaction) {
            // ✅ Merge ramble & target values if ticketId already exists
            existingTransaction.target += detail.betType === 'T' ? Number(detail.betAmount) || 0 : 0;
            existingTransaction.ramble += detail.betType === 'R' ? Number(detail.betAmount) || 0 : 0;
            existingTransaction.gross += Number(detail.betAmount) || 0; // Update total amount
          } else {
            // ✅ Add new transaction entry if ticketId doesn't exist yet
            mergedTransactions.set(ticketId, {
              id: detail.id || '',
              ticketId: ticketId,
              drawType: data['drawType'] || '',
              combination: detail.betCombi || '',
              target: detail.betType === 'T' ? Number(detail.betAmount) || 0 : 0,
              ramble: detail.betType === 'R' ? Number(detail.betAmount) || 0 : 0,
              gross: Number(detail.betAmount) || 0,
              agent: detail.createdBy || '',
              date: data['drawDate'] || '',
              userId: detail.userId || '',
            });
          }
        });
      });
  
      // ✅ Convert merged results from Map to an array and update the signal
      const transactionsArray = Array.from(mergedTransactions.values());
      this.lottoDrawTransactionsSignal.set(transactionsArray);
      console.log("Merged transactions by ticketId:", transactionsArray);
    }, (error) => {
      console.error("Error fetching transactions:", error);
    });
  }
  async markLottoDrawAsDeleted(drawId: string, ticketId: string): Promise<void> {
    try {
      console.log(`Updating LottoDraw ${drawId} for ticketId ${ticketId}...`);
      
      const drawCollection = collection(this.firestore, this.collectionName);
      const drawQuery = query(drawCollection, where("drawId", "==", drawId));
      const querySnapshot = await getDocs(drawQuery);
  
      if (querySnapshot.empty) {
        console.warn("No matching drawId found.");
        return;
      }
  
      // 🔥 Filter only updated documents before calling updateDoc()
      const updatePromises = querySnapshot.docs
        .map(async (doc) => {
          const drawData = doc.data();
          const details = Array.isArray(drawData['details']) ? [...drawData['details']] : []; // Deep copy
  
          let updated = false;
  
          details.forEach((detail: any) => {
            if (detail.ticketId === ticketId) {
              detail.status = "D"; // ✅ Mark as deleted
              updated = true;
            }
          });
  
          // ✅ Ensure update happens only if there was a change
          if (updated) {
            return updateDoc(doc.ref, { details });
          }
        })
        .filter((promise) => promise !== undefined); // Remove undefined promises
  
      await Promise.all(updatePromises); // ✅ Ensure all updates finish
  
      console.log(`LottoDraw for ticketId ${ticketId} updated to status "D".`);
  
    } catch (error) {
      console.error("Error updating lotto draw status:", error);
      throw error;
    }
  }
  
  
  
  
}
