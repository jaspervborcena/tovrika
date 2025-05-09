export interface Winner {
    id?:string 
    drawDate: string;         // Date of the draw
    drawType: string;         // Type of draw (e.g., lottery type)
    combination: string;      // Winning combination
    amount: number;           // Amount won
    betType: string;          // Type of bet (e.g., "T" or "R")
    status: string;           // Status (e.g., "Active", "Deleted", etc.)
    wins: number;             // Number of wins
    isWinner: boolean;        // Whether the user is a winner
    agent: string;            // Agent who created the record
    createdDt: string;        // Date when the record was created
    createdBy: string;        // User who created the record
  }
  