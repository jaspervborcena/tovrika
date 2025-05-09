import { Injectable, inject, signal} from '@angular/core';
import { Firestore, collection, query, where, onSnapshot ,updateDoc,getDocs} from '@angular/fire/firestore';
import { LottoDrawDashboard } from '../../models/lotto/lotto-draw';
import { ENUM_COLLECTION } from '../../enum/collections.enum';
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
  const drawQuery = query(drawCollection, where("dId", "in", drawIds.slice(0, 10)));

  // ✅ Get roleId and email from localStorage
  const roleId = Number(localStorage.getItem("roleId")) || 0;
  const userEmail = localStorage.getItem("email") || "";

  // 🔥 Firestore real-time listener
  onSnapshot(drawQuery, (querySnapshot) => {
    const summary: { [key: string]: LottoDrawDashboard } = {
      "2PM": { dTyp: "2PM", bet: 0, hits: 0, com: "0.00", kabig: 0 },
      "5PM": { dTyp: "5PM", bet: 0, hits: 0, com: "0.00", kabig: 0 },
      "9PM": { dTyp: "9PM", bet: 0, hits: 0, com: "0.00", kabig: 0 },
    };

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const details = Array.isArray(data['details']) ? data['details'] : [];

      details.forEach((detail: any) => {
        if (detail.st !== "S") return; // ✅ Filter by status "S"

        // ✅ Apply filtering based on roleId
        if (roleId < 9 && detail.cBy !== userEmail) return; // 🔥 Exclude transactions not created by the user

        const amt = Number(detail.amt) || 0;
        const w = Number(detail.w) || 0;

        summary[data['dTyp']].bet += amt; // ✅ Sum bets
        if (w !== 0) summary[data['dTyp']].hits += 1; // ✅ Count hits
        summary[data['dTyp']].com = (summary[data['dTyp']].bet * 0.15).toFixed(2); // ✅ Calculate commission
        summary[data['dTyp']].kabig = summary[data['dTyp']].bet - w; // ✅ Allows negative values
      });
    });

    // ✅ Update summary data using signals
    this.lottoDrawSummarySignal.set(Object.values(summary));
  });
}
async markLottoDrawAsDeleted(dId: string, detailId: string): Promise<void> {
  try {
    console.log(`LottoDraw ${dId} updated to status and detail id ${detailId} ".`);
    const drawCollection = collection(this.firestore, this.collectionName);
    const drawQuery = query(drawCollection, where("dId", "==", dId));

    const querySnapshot = await getDocs(drawQuery);

    if (!querySnapshot.empty) {
      for (const doc of querySnapshot.docs) {
        const drawData = doc.data();
        const details = Array.isArray(drawData['details']) ? drawData['details'] : [];

        // ✅ Modify only the relevant detail's status
        details.forEach((detail: any) => {
          if (detail.id === detailId) {
            detail.st = "D"; // ✅ Update status to "D"
          }
        });

        // ✅ Push updated details back to Firestore
        await updateDoc(doc.ref, { details });

        console.log(`LottoDraw ${detailId} updated to status "D".`);
      }
    } else {
      console.warn("No matching dId found.");
    }
  } catch (error) {
    console.error("Error updating lotto draw status:", error);
    throw error;
  }
}
  
  
}
