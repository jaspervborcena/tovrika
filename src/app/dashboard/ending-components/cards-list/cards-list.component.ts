import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

interface Bet {
  combination: string;
  name: string;
}

@Component({
  standalone: true,
  selector: 'app-cards-list',
  templateUrl: './cards-list.component.html',
  styleUrls: ['./cards-list.component.scss'],
  imports: [CommonModule, ReactiveFormsModule]
})
export class CardsListComponent {
  games = [
    { title: "GSW vs Nets" },
    { title: "Raptors vs Boston" },
    { title: "Lakers vs Heat" },
    { title: "Bulls vs Knicks" }
  ];
  maxRowsArray: number[] = [];

  selectedGame = '';
  showPopup = false;
  selectedBet: Bet | null = null;
  betForm: FormGroup;
  availableBets: Bet[][] = []; // ✅ Stores bets in 4 columns
  maxRows: number = 0; // ✅ Declare maxRows

  constructor(private fb: FormBuilder) {
    this.betForm = this.fb.group({
      name: ['', Validators.required]
    });
    this.generateAvailableBets();
  }

  generateAvailableBets() {
    const column1: Bet[] = [];
    const column2: Bet[] = [];
    const column3: Bet[] = [];
    const column4: Bet[] = [];

    for (let i = 0; i <= 9; i++) {
      for (let j = 0; j <= 9; j++) {
        const combination = `${i}-${j}`;
        const bet: Bet = { combination, name: '' };

        if ((i === 0 && j >= 1) || (i === 1) || (i === 2 && j <= 4)) {
          column1.push(bet);
        } else if ((i === 2 && j >= 5) || (i === 3) || (i === 4 && j <= 9)) {
          column2.push(bet);
        } else if ((i === 5) || (i === 6) || (i === 7 && j <= 4)) {
          column3.push(bet);
        } else {
          column4.push(bet);
        }
      }
    }

    this.availableBets = [column1, column2, column3, column4]; // ✅ Assign bets to columns
    this.maxRows = Math.max(column1.length, column2.length, column3.length, column4.length); // ✅ Compute max rows
  }

  openPopup(bet: Bet) {
    this.selectedBet = bet;
    this.betForm.patchValue({ name: bet.name });
    this.showPopup = true;
  }

  updateBet() {
    if (this.betForm.valid && this.selectedBet) {
      this.selectedBet.name = this.betForm.value.name.trim();
      this.showPopup = false;
    }
  }

  cancelPopup() {
    this.showPopup = false;
    this.betForm.reset({ name: '' });
  }


}
