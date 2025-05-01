export interface LottoDetail {
  id?: string;
  ticketId?:string; 
  wins: number;
  isWinner: boolean;
  createdDt: string;
  modifyDt: string;
  betCombi: string;
  betAmount: number;
  betType: string;
  status:string;
  modifyBy?: string | null;
  createdBy?: string | null;
  userId?:string | null;
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
  modifyBy?: string | null;
  createdBy?: string | null;
  userId?:string | null;
}
// src/app/models/lotto-draw-transaction.ts
export interface LottoDrawTransaction {
  id?: string;               // <-- this is the details.id (UUID)
  ticketId?:string; 
  drawType: string;          // ex: '2PM', '5PM'
  combination: string;       // ex: '432'
  target: number;            // ex: 778
  ramble: number;            // ex: 57
  gross: number;             // ex: 835
  agent: string;             // ex: 'Agent 1'
  date: string;              // ex: ISO string '2025-04-27T19:44:15'
  status?:string;
  modifyBy?: string | null;
  createdBy?: string | null;
  userId?:string | null;
}
export interface LottoDrawDashboard {
  drawType: string;  // "2PM", "5PM", "9PM"
  bet: number;       // Total bet amount
  hits: number;      // Total hits (count of wins not equal to 0)
  commission: string; // Commission (15% of total bet)
  kabig: number;      // Gross bet amount minus total wins (can't be negative)
}
