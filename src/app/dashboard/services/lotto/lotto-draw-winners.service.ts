import { Injectable, Signal, signal,inject } from '@angular/core';
import { Firestore, collection, query, where, getDocs, updateDoc } from '@angular/fire/firestore';
import { ENUM_COLLECTION,ENUM_LIMITS } from '../../enum/collections.enum';
import { Winner } from '../../models/lotto/lotto-winner';
@Injectable({
  providedIn: 'root'
})
export class WinnerService {
  private collectionName = ENUM_COLLECTION.LOTTO_DRAWS;
  winnersSignal = signal<any[]>([]);
  private firestore = inject(Firestore);
  constructor() {}
listenToWinners(drawId: string): void {
  const drawCollection = collection(this.firestore, this.collectionName);
  const drawIdsArray = drawId.split(',').map(id => id.trim());

  const drawQuery = query(drawCollection, where("dId", "in", drawIdsArray));

  getDocs(drawQuery).then(querySnapshot => {
    const winners: Winner[] = [];

    querySnapshot.forEach(doc => {
      const drawData = doc.data();
      const details = Array.isArray(drawData['details']) ? drawData['details'] : [];

      details.forEach((detail: any) => {
        if (detail.win) {
          winners.push({
            id: detail.id || '',
            dDt: drawData['dDt'] || '',
            dTyp: drawData['dTyp'] || '',
            cmb: detail.cmb || '',
            amt: Number(detail.amt) || 0,
            typ: detail.typ || '',
            st: detail.st || '',
            w: Number(detail.w) || 0,
            win: detail.win || false,
            agt: detail.cBy || '',
            cDt: detail.cDt || '',
            cBy: detail.cBy || ''
          });
        }
      });
    });

    this.winnersSignal.set(winners);
  }).catch(error => console.error('Error fetching winners:', error));
}
  

  generatePermutations(combination: string): string[] {
    const results: string[] = [];
  
    function permute(arr: string[], m: string[] = []) {
      if (arr.length === 0) {
        results.push(m.join("")); // Ensure output is a string
      } else {
        for (let i = 0; i < arr.length; i++) {
          const curr = arr.slice();
          const next = curr.splice(i, 1);
          permute(curr.slice(), m.concat(next));
        }
      }
    }
  
    permute(combination.split("")); // Convert input string to array
    return results; // ✅ Ensure return type matches function definition
  }
async markAsWinner(dId: string, cmb: string): Promise<void> {
  try {
    console.log(`Marking winner for dId: ${dId}, cmb: ${cmb}...`);

    const drawCollection = collection(this.firestore, this.collectionName);
    const drawQuery = query(drawCollection, where("dId", "==", dId));
    const querySnapshot = await getDocs(drawQuery);

    if (querySnapshot.empty) {
      console.warn("No matching dId found.");
      return;
    }

    // 🔥 Generate all possible permutations **only once**
    const allCombinations = this.generatePermutations(cmb);

    for (const doc of querySnapshot.docs) {
      const drawData = doc.data();
      const details = Array.isArray(drawData['details']) ? [...drawData['details']] : [];
      let updated = false;

      details.forEach((detail: any) => {
        const validCombinations = detail.typ === 'R' ? allCombinations : [cmb];

        if (validCombinations.includes(detail.cmb) && detail.st === 'S') {
          detail.win = true;
          detail.w = detail.typ === 'R' 
            ? detail.amt * ENUM_LIMITS.RAMBLE_WIN 
            : detail.amt * ENUM_LIMITS.TARGET_WIN;
          updated = true;
        }
      });

      if (updated) {
        await updateDoc(doc.ref, { details });
        console.log(`Winner updated for dId ${dId}, cmb ${cmb}.`);
      }
    }
  } catch (error) {
    console.error("Error marking winner:", error);
    throw error;
  }
}
async clearWinner(dId: string): Promise<void> {
  try {
    console.log(`Clearing winners for dId: ${dId}...`);

    const drawCollection = collection(this.firestore, this.collectionName);
    const drawQuery = query(drawCollection, where("dId", "==", dId));
    const querySnapshot = await getDocs(drawQuery);

    if (querySnapshot.empty) {
      console.warn(`No matching dId found for ${dId}.`);
      return;
    }

    for (const doc of querySnapshot.docs) {
      const drawData = doc.data();
      const details = Array.isArray(drawData['details']) ? [...drawData['details']] : [];
      let updated = false;

      details.forEach((detail: any) => {
        if (detail.win) {
          detail.win = false;
          detail.w = 0; // ✅ Reset winnings
          updated = true;
        }
      });

      if (updated) {
        await updateDoc(doc.ref, { details });
        console.log(`All winners cleared for dId ${dId}.`);
      }
    }
  } catch (error) {
    console.error("Error clearing winners:", error);
    throw error;
  }
}
  
  
}
