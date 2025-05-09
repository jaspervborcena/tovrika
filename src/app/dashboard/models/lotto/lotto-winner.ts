export interface Winner {
  id?: string;      // ✅ Keep as is (UUID)
  dDt: string;      // 🔥 Shortened from drawDate
  dTyp: string;     // 🔥 Shortened from drawType
  cmb: string;      // 🔥 Shortened from combination
  amt: number;      // 🔥 Shortened from amount
  typ: string;      // 🔥 Shortened from betType
  st: string;       // 🔥 Shortened from status
  w: number;        // 🔥 Shortened from wins
  win: boolean;     // 🔥 Shortened from isWinner
  agt: string;      // 🔥 Shortened from agent
  cDt: string;      // 🔥 Shortened from createdDt
  cBy: string;      // 🔥 Shortened from createdBy
}
