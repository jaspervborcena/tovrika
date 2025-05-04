import { Injectable, Signal, signal,inject } from '@angular/core';
import { Firestore, collection, query, where, getDocs, updateDoc } from '@angular/fire/firestore';
import { ENUM_COLLECTION,ENUM_LIMITS } from '../enum/collections.enum';
import { Winner } from '../models/lotto-winner';
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

    // ✅ Fetch all matching drawIds, removing slice restriction
    const drawQuery = query(drawCollection, where("drawId", "in", drawIdsArray));

    getDocs(drawQuery).then(querySnapshot => {
        const winners: Winner[] = []; // ✅ Explicitly typed array

        querySnapshot.forEach(doc => {
            const drawData = doc.data();
            const details = Array.isArray(drawData['details']) ? drawData['details'] : [];

            details.forEach((detail: any) => {
                if (detail.isWinner) {
                    winners.push({
                        id: detail.id || '', // ✅ Ensure ID exists
                        drawDate: drawData['drawDate'] || '',
                        drawType: drawData['drawType'] || '',
                        combination: detail.betCombi || '',
                        amount: Number(detail.betAmount) || 0,
                        betType: detail.betType || '',
                        status: detail.status || '', // ✅ Include status
                        wins: Number(detail.wins) || 0,
                        isWinner: detail.isWinner || false,
                        agent: detail.createdBy || '',
                        createdDt: detail.createdDt || '', // ✅ Include createdDt
                        createdBy: detail.createdBy || ''
                    });
                }
            });
        });

        // ✅ Update the winners signal
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
  async markAsWinner(drawId: string, combination: string): Promise<void> {
    try {
      console.log(`Marking winner for drawId: ${drawId}, combination: ${combination}...`);
  
      const drawCollection = collection(this.firestore, this.collectionName);
      const drawQuery = query(drawCollection, where("drawId", "==", drawId));
      const querySnapshot = await getDocs(drawQuery);
  
      if (querySnapshot.empty) {
        console.warn("No matching drawId found.");
        return;
      }
  
      // 🔥 Generate all possible permutations of the combination
      const allCombinations = this.generatePermutations(combination);
  
      const updatePromises = querySnapshot.docs
        .map(async (doc) => {
          const drawData = doc.data();
          const details = Array.isArray(drawData['details']) ? [...drawData['details']] : []; // Deep copy
          let updated = false;
  
          details.forEach((detail: any) => {
            // ✅ Only generate permutations if betType === 'R'
            const validCombinations = detail.betType === 'R' 
                ? this.generatePermutations(combination) 
                : [combination]; // Direct match for 'T'
        
            if (validCombinations.includes(detail.betCombi) && detail.status === 'S') {
                detail.isWinner = true;
        
                // ✅ Calculate winnings based on betType
                const betAmount = detail.betAmount || 0;
                detail.wins = detail.betType === 'R' ? betAmount * ENUM_LIMITS.RAMBLE_WIN : betAmount * ENUM_LIMITS.TARGET_WIN;
        
                updated = true;
            }
        });
        
  
          // ✅ Update Firestore only if relevant changes exist
          if (updated) {
            try {
              await updateDoc(doc.ref, { details });
              console.log(`Winner updated for drawId ${drawId}, combination ${combination}.`);
            } catch (error) {
              console.error("Firestore update error:", error);
            }
          }
        })
        .filter((promise) => promise !== undefined);
  
      await Promise.all(updatePromises); // ✅ Ensure all updates finish
  
    } catch (error) {
      console.error("Error marking winner:", error);
      throw error;
    }
  }
  async clearWinner(drawId: string): Promise<void> {
    try {
      console.log(`Clearing winners for drawId: ${drawId}...`);
  
      const drawCollection = collection(this.firestore, this.collectionName);
      const drawQuery = query(drawCollection, where("drawId", "==", drawId));
      const querySnapshot = await getDocs(drawQuery);
  
      if (querySnapshot.empty) {
        console.warn(`No matching drawId found for ${drawId}.`);
        return;
      }
  
      // 🔥 Reset `isWinner` and `wins` for all details in the matching drawId
      const updatePromises = querySnapshot.docs
        .map(async (doc) => {
          const drawData = doc.data();
          const details = Array.isArray(drawData['details']) ? [...drawData['details']] : [];
          let updated = false;
  
          details.forEach((detail: any) => {
            if (detail.isWinner) {
              detail.isWinner = false;
              detail.wins = 0; // ✅ Reset winnings
              updated = true;
            }
          });
  
          if (updated) {
            try {
              await updateDoc(doc.ref, { details });
              console.log(`All winners cleared for drawId ${drawId}.`);
            } catch (error) {
              console.error("Firestore update error:", error);
            }
          }
        })
        .filter((promise) => promise !== undefined);
  
      await Promise.all(updatePromises); // ✅ Ensure all updates finish
  
    } catch (error) {
      console.error("Error clearing winners:", error);
      throw error;
    }
  }
  
  
}
