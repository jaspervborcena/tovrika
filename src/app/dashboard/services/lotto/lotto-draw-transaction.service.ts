import { Injectable, inject, signal} from '@angular/core';
import { Firestore, collection, query, where, onSnapshot ,updateDoc,getDocs} from '@angular/fire/firestore';
import { LottoDrawTransaction } from '../../models/lotto/lotto-draw';
import { ENUM_COLLECTION } from '../../enum/collections.enum';
@Injectable({
  providedIn: 'root',
})
export class LottoDrawTransactionService {
  public lottoDrawTransactionsSignal = signal<LottoDrawTransaction[]>([]);
  private collectionName = ENUM_COLLECTION.LOTTO_DRAWS;
  private firestore = inject(Firestore);

  constructor() {}
listenToTransactions(drawIds: string[]): void {
  if (!drawIds.length) return; // 🛑 Prevent empty queries

  const drawCollection = collection(this.firestore, this.collectionName);
  const drawQuery = query(drawCollection, where("dId", "in", drawIds.slice(0, 10)));

  onSnapshot(drawQuery, (querySnapshot) => {
    const mergedTransactions = new Map<string, LottoDrawTransaction>();

    const roleId = Number(localStorage.getItem("roleId")) || 0;
    const userEmail = localStorage.getItem("email") || "";

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const details = Array.isArray(data['details']) ? data['details'] : [];

      details.forEach((detail: any) => {
        if (detail.st !== "S") return; // ✅ Filter only status "S"

        if (roleId < 9 && detail.cBy !== userEmail) return; // ✅ Role-based filtering

        const ticketId = detail.tId || '';
        const existingTransaction = mergedTransactions.get(ticketId);

        if (existingTransaction) {
          existingTransaction.tgt += detail.typ === 'T' ? Number(detail.amt) || 0 : 0;
          existingTransaction.ram += detail.typ === 'R' ? Number(detail.amt) || 0 : 0;
          existingTransaction.grs += Number(detail.amt) || 0;
        } else {
          mergedTransactions.set(ticketId, {
            id: detail.id || '',
            tId: ticketId,
            dTyp: data['dTyp'] || '',
            cmb: detail.cmb || '',
            tgt: detail.typ === 'T' ? Number(detail.amt) || 0 : 0,
            ram: detail.typ === 'R' ? Number(detail.amt) || 0 : 0,
            grs: Number(detail.amt) || 0,
            agt: detail.cBy || '',
            dDt: data['dDt'] || '',
            uId: detail.uId || '',
            st: detail.st || '',
            cDt: detail.cDt || '',
            mDt: detail.mDt || ''
          });
        }
      });
    });

    this.lottoDrawTransactionsSignal.set(Array.from(mergedTransactions.values()));
  }, (error) => {
    console.error("Error fetching transactions:", error);
  });
}
listenToCancelled(drawIds: string[]): void {
  if (!drawIds.length) return; // 🛑 Prevent empty queries

  const drawCollection = collection(this.firestore, this.collectionName);
  const drawQuery = query(drawCollection, where("dId", "in", drawIds.slice(0, 10)));

  const roleId = Number(localStorage.getItem("roleId")) || 0;
  const userEmail = localStorage.getItem("email") || "";

  onSnapshot(drawQuery, (querySnapshot) => {
    const mergedTransactions = new Map<string, LottoDrawTransaction>();

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const details = Array.isArray(data['details']) ? data['details'] : [];

      details.forEach((detail: any) => {
        if (detail.st !== "D") return; // ✅ Filter only status "D"

        if (roleId < 9 && detail.cBy !== userEmail) return; // ✅ Role-based filtering

        const ticketId = detail.tId || '';
        const existingTransaction = mergedTransactions.get(ticketId);

        if (existingTransaction) {
          existingTransaction.tgt += detail.typ === 'T' ? Number(detail.amt) || 0 : 0;
          existingTransaction.ram += detail.typ === 'R' ? Number(detail.amt) || 0 : 0;
          existingTransaction.grs += Number(detail.amt) || 0;
        } else {
          mergedTransactions.set(ticketId, {
            id: detail.id || '',
            tId: ticketId,
            dTyp: data['dTyp'] || '',
            cmb: detail.cmb || '',
            tgt: detail.typ === 'T' ? Number(detail.amt) || 0 : 0,
            ram: detail.typ === 'R' ? Number(detail.amt) || 0 : 0,
            grs: Number(detail.amt) || 0,
            agt: detail.cBy || '',
            dDt: data['dDt'] || '',
            uId: detail.uId || '',
            st: detail.st || '',
            cDt: detail.cDt || '',
            mDt: detail.mDt || ''
          });
        }
      });
    });

    this.lottoDrawTransactionsSignal.set(Array.from(mergedTransactions.values()));
  }, (error) => {
    console.error("Error fetching transactions:", error);
  });
}

async markLottoDrawAsDeleted(drawId: string, ticketId: string): Promise<void> {
  try {
    console.log(`Updating LottoDraw ${drawId} for ticketId ${ticketId}...`);

    const drawCollection = collection(this.firestore, this.collectionName);
    const drawQuery = query(drawCollection, where("dId", "==", drawId));
    const querySnapshot = await getDocs(drawQuery);

    if (querySnapshot.empty) {
      console.warn("No matching drawId found.");
      return;
    }

    for (const doc of querySnapshot.docs) {
      const drawData = doc.data();
      const details = Array.isArray(drawData['details']) ? [...drawData['details']] : []; // Deep copy

      let updated = false;

      details.forEach((detail: any) => {
        if (detail.tId === ticketId && detail.st !== "D") {
          detail.st = "D"; // ✅ Mark as deleted
          updated = true;
        }
      });

      if (updated) {
        await updateDoc(doc.ref, { details }); // ✅ Update only if needed
        console.log(`Updated ticketId ${ticketId} to status "D".`);
      }
    }
  } catch (error) {
    console.error("Error updating lotto draw status:", error);
    throw error;
  }
}
  
  
}
