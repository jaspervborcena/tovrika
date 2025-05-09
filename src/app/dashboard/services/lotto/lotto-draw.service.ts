import { Injectable, inject, signal } from '@angular/core';
import { Firestore, collection, getDocs, query, where, addDoc,getDoc, updateDoc, doc } from '@angular/fire/firestore';

import { LottoDraw, LottoDetail } from '../../models/lotto/lotto-draw';
import { DocumentData } from 'firebase/firestore';
import { Observable } from 'rxjs';
import { ENUM_COLLECTION } from '../../enum/collections.enum';
import { Console } from 'console';
@Injectable({
  providedIn: 'root',
})
export class LottoDrawService {
  private lottoDrawsSignal = signal<LottoDraw[]>([]);
  private collectionName = ENUM_COLLECTION.LOTTO_DRAWS;
  private collectionRole = ENUM_COLLECTION.LOTTO_DRAWS_ROLES;
  private  returnStatus: string ='';
  private firestore = inject(Firestore);
  constructor() {}

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

  async  getRoleByUid( uid: string): Promise<string | null> {
    try {
      // ✅ Reference the document where ID matches `uid`
      const docRef = doc(this.firestore,this.collectionRole, uid);
      const docSnap = await getDoc(docRef);
  
      if (docSnap.exists()) {
        // ✅ Use bracket notation to access `roles`
        const data = docSnap.data();
        const roleId = data?.["roles"]?.["roleId"]; // ✅ Fix TypeScript index signature issue
        return roleId;
      } else {
        console.log("No document found for UID:", uid);
        return null;
      }
    } catch (error) {
      console.error("Error fetching roleId:", error);
      return null;
    }
  }
  
  // Trigger lotto draws initialization explicitly from component or service
  get lottoDraws(): LottoDraw[] {
    return this.lottoDrawsSignal();
  }
// Method to add a LottoDraw only if the dId doesn't exist
async addLottoDraw(draw: LottoDraw): Promise<string> {
  try {
    const drawCollection = collection(this.firestore, this.collectionName);
    const drawQuery = query(drawCollection, where("dId", "==", draw.dId));
    const querySnapshot = await getDocs(drawQuery);
    this.returnStatus = "";

    if (querySnapshot.empty) {
      await addDoc(drawCollection, draw);
      console.log('Lotto draw added successfully', draw);
      return 'success';
    } else {
      await this.addLottoDetailsToExistingDraw(draw.dId, draw.details);
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

  async addLottoDetailsToExistingDraw(dId: number, newDetails: LottoDetail[]): Promise<void> {
  try {
    const drawCollection = collection(this.firestore, this.collectionName);
    const drawQuery = query(drawCollection, where("dId", "==", dId));
    const querySnapshot = await getDocs(drawQuery);

    if (!querySnapshot.empty) {
      const drawDoc = querySnapshot.docs[0];
      const drawRef = doc(this.firestore, `${this.collectionName}/${drawDoc.id}`);
      const drawData = drawDoc.data() as LottoDraw;

      const updatedDetails = [...(drawData.details || []), ...newDetails];
      await updateDoc(drawRef, { details: updatedDetails });
      console.log('Lotto detail(s) added to existing draw:', dId);
    } else {
      console.error('Lotto draw not found for ID:', dId);
    }
  } catch (error) {
    console.error('Error adding lotto detail(s):', error);
  }
}
async addBetDetails(amt: number, typ: string, cmb: string, dId: number, uId: string | null, email: string | null): Promise<void> {
  const uuidv4 = this.generateUUID6();
  console.log("betType", typ);

  const newDetail: LottoDetail = {
    id: uuidv4,
    cmb,
    typ,
    amt,
    w: 0,
    win: false,
    cDt: Date.now(),
    mDt: Date.now(),
    cBy: email,
    mBy: email,
    st: 'S',
    uId
  };

  try {
    const drawCollection = collection(this.firestore, this.collectionName);
    const drawQuery = query(drawCollection, where("dId", "==", dId));
    const querySnapshot = await getDocs(drawQuery);

    if (!querySnapshot.empty) {
      const drawDoc = querySnapshot.docs[0];
      const drawRef = doc(this.firestore, `${this.collectionName}/${drawDoc.id}`);
      const drawData = drawDoc.data() as LottoDraw;

      if (cmb) {
        const updatedDetails = [...(drawData.details || []), newDetail];
        await updateDoc(drawRef, { details: updatedDetails });
        console.log('Lotto detail added to existing draw:', dId);
      } else {
        console.error('Invalid combination.');
      }
    } else {
      console.error('Lotto draw not found for ID:', dId);
    }
  } catch (error) {
    console.error('Error adding lotto detail:', error);
  }
}

async getLottoLimit(drawId: string, searchCombination: string): Promise<{ totalAmount: number, matchingRambles: { combination: string, amount: number }[] }> {

    console.log('Lotto collectionName',this.collectionName);
    // const drawCollection = collection(this.firestore, this.collectionName);
    // const drawQuery = query(drawCollection, where("drawId", "==", drawId));
    // const querySnapshot = await getDocs(drawQuery);

    const drawCollection = collection(this.firestore, this.collectionName);
    const drawQuery = query(drawCollection, where("drawId", "==", drawId));

try {
  const querySnapshot = await getDocs(drawQuery);
  console.log("📦 querySnapshot.empty:", querySnapshot.empty);
  console.log("📦 querySnapshot.size:", querySnapshot.size);


    console.log("drawId.empty",drawId)
    console.log("searchCombination.empty",searchCombination)
    console.log("querySnapshot.empty")
    let totalAmount = 0;
    const matchingRambles: { combination: string, amount: number }[] = [];

    // ✅ Generate permutations once before looping
    // const possibleCombinations = this.generatePermutations(searchCombination);

    if (!querySnapshot.empty) {
      console.log("!querySnapshot.empty")
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const details = Array.isArray(data['details']) ? data['details'] : [];
        console.log("details",details)
        details.forEach((detail: any) => {
          if (detail.status === "S") { // ✅ Process only active transactions
            const betAmount = Number(detail.betAmount) || 0;
            console.log("searchCombination",searchCombination)
            console.log("detail.betCombi.toString()",detail.betCombi.toString())

            if (detail.betType === "T" && searchCombination === detail.betCombi.toString()) {
              totalAmount += betAmount; // ✅ Sum "T" bets
            }

            // if (detail.betType === "R" && possibleCombinations.includes(detail.betCombi)) {
            //   matchingRambles.push({ combination: detail.betCombi, amount: betAmount }); // ✅ Store matched ramble bets
            //   totalAmount += betAmount; // ✅ Include "R" bets in total sum
            // }
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

 generateUUID6(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}
}
