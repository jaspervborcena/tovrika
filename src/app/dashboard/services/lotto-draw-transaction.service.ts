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
    const drawCollection = collection(this.firestore, this.collectionName);
    const drawQuery = query(drawCollection, where("drawId", "in", drawIds.slice(0, 10)));
  
    // 🔥 Firestore real-time listener (only fetches updates)
    onSnapshot(drawQuery, (querySnapshot) => {
      const transactions: LottoDrawTransaction[] = [];
  
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        console.log('details', data);
        const details = Array.isArray(data['details']) ? data['details'] : [];
        console.log('details2', details);
  
        details.forEach((detail: any) => {
          if (detail.status === "S") { // ✅ Filter for transactions with status "S"
            transactions.push({
              id: detail.id || '',
              drawType: data['drawType'] || '',
              combination: detail.betCombi || '',
              target: detail.betType === 'T' ? parseInt(detail.betAmount) || 0 : 0,
              ramble: detail.betType === 'R' ? parseInt(detail.betAmount) || 0 : 0,
              gross: parseInt(detail.betAmount) || 0,
              agent: detail.createdBy || '',
              date:  data['drawDate'] || '',
              userId: detail.userId || '',
            });
          }
        });
      });
  
      // ✅ Update transactions dynamically using signals
      this.lottoDrawTransactionsSignal.set(transactions);
      console.log("Filtered transactions (status = 'S'):", transactions);
    });
  }
  async markLottoDrawAsDeleted(drawId: string, detailId: string): Promise<void> {
    try {
      console.log(`LottoDraw ${drawId} updated to status and detail id ${detailId} ".`);
      const drawCollection = collection(this.firestore, this.collectionName);
      const drawQuery = query(drawCollection, where("drawId", "==", drawId));
  
      const querySnapshot = await getDocs(drawQuery);
  
      if (!querySnapshot.empty) {
        querySnapshot.forEach(async (doc) => {
          const drawData = doc.data();
          //const details = Array.isArray(drawData.details) ? drawData.details : [];
          const details = Array.isArray(drawData['details']) ? drawData['details'] : [];
          // ✅ Modify only the relevant detail's status
          details.forEach((detail: any) => {
            if (detail.id === detailId) {
              detail.status = "D"; // ✅ Update status to "D"
            }
          });
  
          // ✅ Push updated details back to Firestore
          await updateDoc(doc.ref, { details });
  
          console.log(`LottoDraw ${detailId} updated to status "D".`);
        });
      } else {
        console.warn("No matching drawId found.");
      }
    } catch (error) {
      console.error("Error updating lotto draw status:", error);
      throw error;
    }
  }
  
  
}
