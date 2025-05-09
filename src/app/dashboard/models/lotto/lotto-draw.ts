export interface LottoDetail {
  id?: string;       // ✅ Keep as is (UUID)
  tId?: string;      // ✅ Shortened from ticketId
  w?: number;        // ✅ Shortened from wins
  win?: boolean;     // ✅ Shortened from isWinner
  cDt: number;       // ✅ Timestamp instead of string (createdDt)
  mDt: number;       // ✅ Timestamp instead of string (modifyDt)
  cmb: string;       // ✅ Shortened from betCombi
  amt: number;       // ✅ Shortened from betAmount
  typ: string;       // ✅ Shortened from betType
  st: string;        // ✅ Shortened from status
  mBy?: string | null; // ✅ Shortened from modifyBy
  cBy?: string | null; // ✅ Shortened from createdBy
  uId?: string | null; // ✅ Shortened from userId
}
export interface LottoDraw {
  id?: string;       // ✅ Keep as is (UUID)
  dId: number;       // ✅ Shortened from drawId
  winCmb: string;    // ✅ Shortened from betWinCombi
  winStr: number;    // ✅ Shortened from betStraightWin
  winRam: number;    // ✅ Shortened from betRambleWin
  dDt: number;       // ✅ Timestamp instead of string (drawDate)
  dTm: string;       // ✅ Shortened from drawTime
  dTyp: string;      // ✅ Shortened from drawType
  details: LottoDetail[]; // ✅ Keep as is (nested array)
  cDt: number;       // ✅ Timestamp instead of string (createdDt)
  mDt: number;       // ✅ Timestamp instead of string (modifyDt)
  mBy?: string | null; // ✅ Shortened from modifyBy
  cBy?: string | null; // ✅ Shortened from createdBy
  uId?: string | null; // ✅ Shortened from userId
}
export interface LottoDrawTransaction {
  id?: string;       // ✅ Keep as is (UUID)
  tId?: string;      // ✅ Shortened from ticketId
  dTyp: string;      // ✅ Shortened from drawType
  cmb: string;       // ✅ Shortened from combination
  tgt: number;       // ✅ Shortened from target
  ram: number;       // ✅ Shortened from ramble
  grs: number;       // ✅ Shortened from gross
  agt: string;       // ✅ Shortened from agent
  dDt: string;        // ✅ Timestamp instead of string (date)
  st?: string;       // ✅ Shortened from status
  mBy?: string | null; // ✅ Shortened from modifyBy
  cBy?: string | null; // ✅ Shortened from createdBy
  cDt: number;       // ✅ Timestamp instead of string (createdDt)
  mDt: number;       // ✅ Timestamp instead of string (modifyDt)
  uId?: string | null; // ✅ Shortened from userId
}
export interface LottoDrawDashboard {
  dTyp: string;      // ✅ Shortened from drawType
  bet: number;       // ✅ Total bet amount
  hits: number;      // ✅ Total hits (count of wins not equal to 0)
  com: string;       // ✅ Shortened from commission
  kabig: number;     // ✅ Gross bet amount minus total wins (can't be negative)
}
export interface LottoDrawRole {
  id: string;        // ✅ Keep as is (UUID)
  rId: string;       // ✅ Shortened from roleId
  rDesc: string;     // ✅ Shortened from roleDesc
  st: string;        // ✅ Shortened from status
  uId: string;       // ✅ Shortened from uid (User ID)
  cTm: number;       // ✅ Timestamp instead of string (createTime)
  uTm: number;       // ✅ Timestamp instead of string (updateTime)
}
export interface Combo {
  id: number;      // ✅ Keep as is (UUID or numeric ID)
  tId: number;     // 🔥 Shortened from ticketId
  cmb: string;     // 🔥 Shortened from combination
  amt: string;     // 🔥 Shortened from amount
  typ: 'T' | 'R';  // 🔥 Shortened from type
}
