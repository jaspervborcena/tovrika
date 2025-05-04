import { Injectable, inject, signal} from '@angular/core';
import { Firestore, collection, query, where, onSnapshot ,updateDoc,getDocs} from '@angular/fire/firestore';
import { LottoDrawDashboard } from '../models/lotto-draw';
import { ENUM_COLLECTION } from '../enum/collections.enum';
@Injectable({
  providedIn: 'root',
})
export class LottoDrawDashboardService {
  public lottoDrawSummarySignal = signal<LottoDrawDashboard[]>([]);
  private collectionName = ENUM_COLLECTION.LOTTO_DRAWS;
  private firestore = inject(Firestore);

  constructor() {}


  listenToSummaryTransactions(drawIds: string[]): void {
    const drawCollection = collection(this.firestore, this.collectionName);
    const drawQuery = query(drawCollection, where("drawId", "in", drawIds.slice(0, 10)));
  
    // 🔥 Firestore real-time listener
    onSnapshot(drawQuery, (querySnapshot) => {
      const summary: { [key: string]: { drawType: string; bet: number; hits: number; commission: string; kabig: number } } = {
        "2PM": { drawType: "2PM", bet: 0, hits: 0, commission: "0.00", kabig: 0 },
        "5PM": { drawType: "5PM", bet: 0, hits: 0, commission: "0.00", kabig: 0 },
        "9PM": { drawType: "9PM", bet: 0, hits: 0, commission: "0.00", kabig: 0 },
      };
  
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const details = Array.isArray(data['details']) ? data['details'] : [];
        details.forEach((detail: any) => {
          if (detail.status === "S" && summary[data['drawType']]) { // ✅ Filter by status "S"
            const betAmount = parseInt(detail.betAmount) || 0;
            const wins = parseInt(detail.wins) || 0;
            
            summary[data['drawType']].bet += betAmount; // ✅ Sum bets
            if (wins !== 0) summary[data['drawType']].hits += 1; // ✅ Count hits
            summary[data['drawType']].commission = (summary[data['drawType']].bet * 0.15).toFixed(2); ; // ✅ Calculate commission
            summary[data['drawType']].kabig = summary[data['drawType']].bet - wins; // ✅ Allows negative values

          }
        });
      });
  
      // ✅ Update summary data using signals
      this.lottoDrawSummarySignal.set(Object.values(summary));
      console.log("Lotto Summary:", summary);
    });
  }
  

  // ✅ Listen for changes dynamically
//   listenToTransactions(drawIds: string[]): void {
//     const drawCollection = collection(this.firestore, this.collectionName);
//     const drawQuery = query(drawCollection, where("drawId", "in", drawIds.slice(0, 10)));
  
//     // 🔥 Firestore real-time listener (only fetches updates)
//     onSnapshot(drawQuery, (querySnapshot) => {
//       const transactions: LottoDrawTransaction[] = [];
  
//       querySnapshot.forEach((doc) => {
//         const data = doc.data();
//         console.log('details', data);
//         const details = Array.isArray(data['details']) ? data['details'] : [];
//         console.log('details2', details);
  
//         details.forEach((detail: any) => {
//           if (detail.status === "S") { // ✅ Filter for transactions with status "S"
//             transactions.push({
//               id: detail.id || '',
//               drawType: data['drawType'] || '',
//               combination: detail.betCombi || '',
//               target: detail.betType === 'T' ? parseInt(detail.betAmount) || 0 : 0,
//               ramble: detail.betType === 'R' ? parseInt(detail.betAmount) || 0 : 0,
//               gross: parseInt(detail.betAmount) || 0,
//               agent: detail.createdBy || '',
//               date:  data['drawDate'] || '',
//               userId: detail.userId || '',
//             });
//           }
//         });
//       });
  
//       // ✅ Update transactions dynamically using signals
//       this.lottoDrawTransactionsSignal.set(transactions);
//       console.log("Filtered transactions (status = 'S'):", transactions);
//     });
//   }
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
