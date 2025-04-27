import { Injectable, signal } from '@angular/core';
import { Firestore, collection, getDocs, query, where, addDoc, updateDoc, doc } from '@angular/fire/firestore';
import { LottoDraw, LottoDetail } from '../models/lotto-draw';
import { DocumentData } from 'firebase/firestore';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class LottoDrawService {
  private lottoDrawsSignal = signal<LottoDraw[]>([]);
  private collectionName = 'lottoDraw';

  constructor(private firestore: Firestore) {}

  // Initialize service and load Lotto draws on startup
  initializeLottoDraws(): void {
    const drawCollection = collection(this.firestore, this.collectionName);

    getDocs(drawCollection)
      .then((querySnapshot) => {
        const lottoDraws: LottoDraw[] = [];
        querySnapshot.forEach((doc) => {
          // Map the DocumentData into your LottoDraw model
          const data = doc.data() as LottoDraw;
          lottoDraws.push({ ...data, id: doc.id });
        });
        this.lottoDrawsSignal.set(lottoDraws);
      })
      .catch((err) => {
        console.error('Error fetching lotto draws:', err);
      });
  }

  // Trigger lotto draws initialization explicitly from component or service
  get lottoDraws(): LottoDraw[] {
    return this.lottoDrawsSignal();
  }

  // Method to add a LottoDraw only if the drawId doesn't exist
  async addLottoDraw(draw: LottoDraw, betType: string, uid: string): Promise<string> {
    try {
      const drawCollection = collection(this.firestore, this.collectionName);
      const drawQuery = query(drawCollection, where("drawId", "==", draw.drawId));
      const querySnapshot = await getDocs(drawQuery);
  
      if (querySnapshot.empty) {
        await addDoc(drawCollection, draw);
        console.log('Lotto draw added successfully');
        return 'success';
      } else {
        console.log('Lotto draw with this drawId already exists.');
        const drawId = draw.drawId;
        const amount = draw.details[0]?.betAmount;
        const combination = draw.details[0].betCombi;
  
        if (amount) {
          console.warn('Both target and ramble are provided. Using only one.');
        }
  
        await this.addBetDetails(amount, betType, combination, drawId, uid);
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

  async addBetDetails(amount: number,type:string, combination: string, drawId: number,userId:string): Promise<void> {
    // Determine the bet type based on which value (target or ramble) is provided.
    
    const uuidv4 = this.generateUUIDv4();
    // Parse the combination value into an integer or default to 100
    const betAmount = amount;
    console.log("betType",type)
    let betCombi=combination;
    // Create the new LottoDetail object
    const newDetail: LottoDetail = {
        id:uuidv4,
        betCombi,
        betType:type,
        betAmount,
        wins: 0,
        isWinner: false,
        createdDt: new Date().toISOString(),
        modifyDt: new Date().toISOString(),
        createdBy: userId,
        modifyBy: userId,
        status:'S'
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
 
generateUUIDv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
}
