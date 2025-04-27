export interface LottoDetail {
  id?: string; 
  wins: number;
  isWinner: boolean;
  createdDt: string;
  modifyDt: string;
  betCombi: string;
  betAmount: number;
  betType: string;
  status:string;
  modifyBy: string;
  createdBy: string;
}

export interface LottoDraw {
  id?: string; // ✅ Needed to handle document ID
  drawId: number;
  betWinCombi: string;
  betStraightWin: number;
  betRambleWin: number;
  drawDate: string; // or Date if using date picker or timestamp
  drawTime: string;
  drawType: string;
  details: LottoDetail[];
  createdDt: string;
  modifyDt: string;
  modifyBy: string;
  createdBy: string;
}
