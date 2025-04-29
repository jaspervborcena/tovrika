import { Injectable, signal } from '@angular/core';
import { Firestore, collection, getDocs, query, where, addDoc, updateDoc, doc } from '@angular/fire/firestore';
import { LottoDraw, LottoDetail } from '../models/lotto-draw';
import { DocumentData } from 'firebase/firestore';
import { Observable } from 'rxjs';
import { Collection } from '../enum/collection.enum';
@Injectable({
  providedIn: 'root',
})
export class LottoDrawService {
  private lottoDrawsSignal = signal<LottoDraw[]>([]);
  private collectionName = Collection.LOTTO_DRAWS;
  private  returnStatus: string ='';
  constructor(private firestore: Firestore) {}

  // Initialize service and load Lotto draws on startup
  async initializeLottoDraws(): Promise<void> {
    try {
      const drawCollection = collection(this.firestore, this.collectionName);
      const querySnapshot = await getDocs(drawCollection);
      const lottoDraws: LottoDraw[] = querySnapshot.docs.map(doc => ({
        ...(doc.data() as LottoDraw),
        id: doc.id
      }));
      this.lottoDrawsSignal.set(lottoDraws);
    } catch (error) {
      console.error('Error fetching lotto draws:', error);
    }
  }
  

  // Trigger lotto draws initialization explicitly from component or service
  get lottoDraws(): LottoDraw[] {
    return this.lottoDrawsSignal();
  }

  // Method to add a LottoDraw only if the drawId doesn't exist
  async addLottoDraw(draw: LottoDraw, betType: string, uid: string | null,email:string | null): Promise<string> {
    try {
      const drawCollection = collection(this.firestore, this.collectionName);
      const drawQuery = query(drawCollection, where("drawId", "==", draw.drawId));
      const querySnapshot = await getDocs(drawQuery);
      this.returnStatus="";
      if (querySnapshot.empty) {
        await addDoc(drawCollection, draw);
        console.log('Lotto draw added successfully',draw);
        return 'success';
      } else {
        console.log('Lotto draw with this drawId already exists.');
        const drawId = draw.drawId;
        const amount = draw.details[0]?.betAmount;
        const combination = draw.details[0].betCombi;
  
        if (amount) {
          console.warn('Both target and ramble are provided. Using only one.');
        }
        
        await this.addBetDetails(amount, betType, combination, drawId, uid, email);
        if(this.returnStatus)
        {
          return 'overlimit'
        }
        return 'exists';
      }
    } catch (error: any) {
      console.error('Error adding lotto draw:', error);
  
      if (error.code === 'permission-denied') {
        return 'permission-denied';
      }
  
      return `error: ${error.message || 'unknown error'}`;
    }
  }
  
  
  // Method to add LottoDetails to an existing draw
  async addLottoDetailsToExistingDraw(drawId: string, newDetail: LottoDetail): Promise<void> {
    try {
      const drawCollection = collection(this.firestore, this.collectionName);
      const drawQuery = query(drawCollection, where("drawId", "==", drawId));
      const querySnapshot = await getDocs(drawQuery);

      if (!querySnapshot.empty) {
        const drawDoc = querySnapshot.docs[0];
        const drawRef = doc(this.firestore, `${this.collectionName}/${drawDoc.id}`);
        const drawData = drawDoc.data() as LottoDraw;

        const updatedDetails = [...(drawData.details || []), newDetail];
        await updateDoc(drawRef, { details: updatedDetails });
        console.log('Lotto detail added to existing draw:', drawId);
      } else {
        console.error('Lotto draw not found for ID:', drawId);
      }
    } catch (error) {
      console.error('Error adding lotto detail:', error);
    }
  }

  async addBetDetails(amount: number,type:string, combination: string, drawId: number,uid:string | null,email:string | null): Promise<void> {
    // Determine the bet type based on which value (target or ramble) is provided.
    const {totalAmount} = await this.getLottoLimit(drawId, combination);
    const betAmount=(+amount + +totalAmount)
    console.log("Returned Data:", betAmount); 
    if (betAmount > 300) {
      this.returnStatus="overlimit"
      console.error("Bet limit exceeded for drawId:", drawId);
      return;
    }

    const uuidv4 = this.generateUUIDv4();
    // Parse the combination value into an integer or default to 100
    console.log("betType",type)
    let betCombi=combination;
    // Create the new LottoDetail object
    const newDetail: LottoDetail = {
        id:uuidv4,
        betCombi,
        betType:type,
        betAmount:amount,
        wins: 0,
        isWinner: false,
        createdDt: new Date().toISOString(),
        modifyDt: new Date().toISOString(),
        createdBy: email,
        modifyBy: email,
        status:'S',
        userId:uid
    };

    try {
        const drawCollection = collection(this.firestore, this.collectionName);
        const drawQuery = query(drawCollection, where("drawId", "==", drawId));
        const querySnapshot = await getDocs(drawQuery);

        if (!querySnapshot.empty) {
            const drawDoc = querySnapshot.docs[0];
            const drawRef = doc(this.firestore, `${this.collectionName}/${drawDoc.id}`);
            const drawData = drawDoc.data() as LottoDraw;

            // Check if betCombi is set (non-empty) and is either 'target' or 'ramble', and add only one LottoDetail
            if (betCombi) {
                const updatedDetails = [...(drawData.details || []), newDetail];
                
                // Update only the 'details' field of the existing Lotto draw document
                await updateDoc(drawRef, { details: updatedDetails });
                console.log('Lotto detail added to existing draw:', drawId);
            } else {
                console.error('Neither target nor ramble has a valid value.');
            }
        } else {
            console.error('Lotto draw not found for ID:', drawId);
        }
    } catch (error) {
        console.error('Error adding lotto detail:', error);
    }
}
async getLottoLimit(drawId: number, searchCombination: string): Promise<{ totalAmount: number, matchingRambles: { combination: string, amount: number }[] }> {
  try {
    const drawCollection = collection(this.firestore, this.collectionName);
    const drawQuery = query(drawCollection, where("drawId", "==", drawId));
    const querySnapshot = await getDocs(drawQuery);

    let totalAmount = 0;
    const matchingRambles: { combination: string, amount: number }[] = [];

    // ✅ Generate permutations once before looping
    const possibleCombinations = this.generatePermutations(searchCombination);

    if (!querySnapshot.empty) {
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const details = Array.isArray(data['details']) ? data['details'] : [];

        details.forEach((detail: any) => {
          if (detail.status === "S") { // ✅ Process only active transactions
            const betAmount = Number(detail.betAmount) || 0;

            if (detail.betType === "T") {
              totalAmount += betAmount; // ✅ Sum "T" bets
            }

            if (detail.betType === "R" && possibleCombinations.includes(detail.betCombi)) {
              matchingRambles.push({ combination: detail.betCombi, amount: betAmount }); // ✅ Store matched ramble bets
              totalAmount += betAmount; // ✅ Include "R" bets in total sum
            }
          }
        });
      });
      console.log("getLottoLimit",totalAmount);
    } else {
      console.warn(`No transactions found for drawId: ${drawId}`);
    }

    return { totalAmount, matchingRambles };
  } catch (error) {
    console.error("Error fetching lotto transactions:", error);
    throw error;
  }
}


generatePermutations(combination: string): string[] {
  const results: string[] = [];

  function permute(arr: string[], m: string[] = []) {
    if (arr.length === 0) {
      results.push(m.join(""));
    } else {
      for (let i = 0; i < arr.length; i++) {
        const curr = arr.slice();
        const next = curr.splice(i, 1);
        permute(curr.slice(), m.concat(next));
      }
    }
  }

  permute(combination.split(""));
  return results;
}

generateUUIDv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
}
