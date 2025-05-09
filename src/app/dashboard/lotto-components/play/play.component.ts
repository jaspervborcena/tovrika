import { Component, ViewChild, ElementRef } from '@angular/core';
import { FormGroup, FormBuilder, FormArray } from '@angular/forms';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';  // Import CommonModule
import { formatDate } from '@angular/common';
import { LottoDrawService } from '../../services/lotto/lotto-draw.service';
import { computed } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service'; 
import { Router ,NavigationEnd } from '@angular/router';
import { ENUM_COLLECTION,ENUM_LIMITS } from '../../enum/collections.enum';
@Component({
  selector: 'app-play',
  templateUrl: './play.component.html',
  styleUrls: ['./play.component.less'],
  standalone: true,
  imports: [ReactiveFormsModule,CommonModule],
})
export class PlayComponent {
  @ViewChild('combinationInput') combinationInput!: ElementRef;
  @ViewChild('targetInput') targetInput!: ElementRef;
  @ViewChild('rambleInput') rambleInput!: ElementRef;

  betType: string = '';
  playForm!: FormGroup;
  lottoForm!: FormGroup;

  activeField: 'combination' | 'target' | 'ramble' = 'combination';
  activeTime = '';
  errorMessage: string | null = null;
  successMessage: string | null = null;
   uuid:string;
   uid: string | null = null;
   email: string | null = null;

   comboId = 1;
combos: Combo[] = [];
submittedCombos: Combo[] = [];
activeTab: 'entry' | 'view' | 'receipt' = 'entry';  // default to Entry Bet
returnStatus:string=""
isSubmitting = false;
currentDateTime:string=Date.now().toString()
agent:string | null="";

currentTime = new Date();
  timeOptions = ['14:00:00', '17:00:00', '21:00:00'];
  disabledTimes: Set<string> = new Set();
  hasAvailableOptions = true;
  
  constructor(private fb: FormBuilder, private lottoDraw: LottoDrawService,private auth: AuthService,private route:Router) {
    this.uuid = this.generateUUIDv4();
    
  
  }

  ngOnInit(): void {
    // this.activeTab = 'view';
    this.playForm = this.fb.group({
      combination: [''],
      target: [''],
      ramble: [''],
    });

    this.lottoForm = this.fb.group({
      drawId: [''],
      drawDate:  [''],
      drawTime: [''],
      drawType:  [''],
      details: this.fb.array([]), // LottoDetail[]
    });
    this.uid=this.auth.userId;
    this.email=this.auth.userEmail;
    if (! this.uid) {
      this.route.navigate(["/signin"]); // Redirect to sign-in page
    }
    this.route.events.subscribe(event => {
      if (event instanceof NavigationEnd && event.url.includes('/play')) {
        this.resetState();
      }
    });
    setInterval(() => {
      this.currentTime = new Date();
      this.updateDisabledTimes(); // Update disabled buttons dynamically
    }, 1000);
    this.focusCombination(); 
  }
  updateDisabledTimes() {
    this.disabledTimes.clear(); // Reset disabled states
    const now = new Date();

    this.timeOptions.forEach(time => {
      const [hours, minutes, seconds] = time.split(':').map(Number);
      const buttonTime = new Date();
      buttonTime.setHours(hours, minutes - 10, seconds); // 10 minutes before

      if (now >= buttonTime) {
        this.disabledTimes.add(time);
      }
    });
  }

  isDisabled(time: string): boolean {
    return this.disabledTimes.has(time);
  }
  get detailsFormArray(): FormArray {
    return this.lottoForm.get('details') as FormArray;
  }
  
  selectTime(time: string): void {
    this.activeTime = time;
    this.lottoForm.patchValue({ drawType: time });
  }

  ngAfterViewInit(): void {
    //this.targetInput.nativeElement.focus();
  }
  handleKeyPress(value: string): void {
    // ✅ Validate that the key is a number or 'C' (clear) or '⌫' (backspace)
    if (!/^[0-9]$/.test(value) && value !== 'C' && value !== '⌫') {
      return;
    }
  
    // ✅ Get the active control based on activeField
    let activeControl: any;
    let otherField: any;
  
    if (this.activeField === 'target') {
      activeControl = this.targetInput?.nativeElement;
      otherField = this.playForm.get('ramble');
    } else if (this.activeField === 'ramble') {
      activeControl = this.rambleInput?.nativeElement;
      otherField = this.playForm.get('target');
    } else if (this.activeField === 'combination') {
      activeControl = this.combinationInput?.nativeElement;
    }
  
    if (!activeControl) return;
  
    const currentValue = activeControl.value || '';
    const maxLength = 3;
  
    // ✅ Handle 'C' (clear) or '⌫' (backspace) operations
    if (value === 'C') {
      activeControl.value = ''; // Clear input field
    } else if (value === '⌫') {
      activeControl.value = currentValue.slice(0, -1); // Remove the last character
    } else if (currentValue.length < maxLength) {
      activeControl.value = currentValue + value;
    }
  
    // ✅ Update the form control value based on active field
    this.playForm.get(this.activeField)?.setValue(activeControl.value);
  
    // ✅ Move focus to Target input when 3 digits are entered in Combination
    if (this.activeField === 'combination' && activeControl.value.length === 3) {
      this.targetInput.nativeElement.focus();
    }
  }
  


  setActiveField(field: 'combination' | 'target' | 'ramble'): void {
    this.activeField = field;
  
    setTimeout(() => {
      if (field === 'combination') {
        this.combinationInput.nativeElement.focus();
      } else if (field === 'target') {
        this.targetInput.nativeElement.focus();
      } else if (field === 'ramble') {
        this.rambleInput.nativeElement.focus();
      }
    });
  }
  
  removeCombo(id: number) {
    this.combos = this.combos.filter(c => c.ticketId !== id);
  }
  async addBet(): Promise<void> {
    try {
      const formValue = this.playForm.value;
      const combination = formValue.combination?.trim();
      const target = formValue.target?.trim();
      const ramble = formValue.ramble?.trim();
      const betCombi = this.playForm.get('combination')?.value;
  
      this.errorMessage = ''; // Clear any previous errors
      this.successMessage = '';
  
      const now = new Date();


      if (this.activeTime === '') {
        this.errorMessage = '⚠ You must select a time before proceeding.';
        return;
      }

      const currentDate = formatDate(now, 'yyyy-MM-dd', 'en-US');
      const combinedDateTime = `${currentDate}T${this.activeTime}`;
      const drawDate = formatDate(new Date(combinedDateTime), 'yyyy-MM-ddTHH:mm:ss', 'en-US');
      const drawIdDt = formatDate(now, 'yyyyMMdd', 'en-US');
      const hourOnly = this.activeTime.substring(0, 2);
      const drawId = `${drawIdDt}${hourOnly}`;
  
      let gameType = formatDate(combinedDateTime, 'h a', 'en-US').replace(' ', '');
      if (!this.hasAvailableOptions) {
        this.errorMessage = 'Time is closed! No options available.';
        return;
      }
      // 🛑 **Check validation before pushing combos**
      if (+combination < 1 && (+target + +ramble) < 1) {
        this.errorMessage = 'Combination and at least one amount is required.';
        return;
      }
      if (!target && !ramble) {
        this.errorMessage = 'You need to provide either a target or ramble amount.';
        return;
      }
      if ((+target + +ramble) < 1) {
        this.errorMessage = 'The minimum bet is 1. Please enter a valid amount.';
        return;
      }
      if ((+target + +ramble < 1) && (+betCombi < 1)) {
        this.errorMessage = 'Combination and amount should be numbers.';
        return;
      }
  
      const ticketId = this.generateTicketId();
      const tempCombos: any[] = [];
  
      
      if (target) {
        tempCombos.push({ id: this.comboId++, ticketId, combination, amount: target, type: 'T' });
      }
      if (ramble) {
        tempCombos.push({ id: this.comboId++, ticketId, combination, amount: ramble, type: 'R' });
      }

      const totalCombi = await this.calculateTotalTBet(combination);

      console.log("totalCombi",totalCombi)

      // 🛑 **Check bet limit before pushing to `combos`**
      const { totalAmount } = await this.lottoDraw.getLottoLimit(drawId, combination);
      const getBetAmount = (+target) + (+totalCombi) + (+totalAmount);
  
      if (getBetAmount > ENUM_LIMITS.LIMIT_BET) {
        this.returnStatus = "overlimit";
        this.errorMessage = `Limit exceeded! Combination ${combination} is sold out.`;
        return; // Stop execution before pushing invalid combos
      }
  
      // ✅ No errors? Now push valid combos
      this.combos.push(...tempCombos);
  
      // ✅ Clear the form after successful addition
      this.playForm.reset();
      //this.activeTab = 'view';
      setTimeout(() => this.focusCombination(), 0);
    } catch (error: any) {
      console.error('Error adding lotto draw:', error);
      if (error.code === 'permission-denied') {
        this.errorMessage = 'You do not have permission to access this site. Please contact IT support.';
        return;
      }
      this.errorMessage = `Error: ${error.message || 'Unknown error'}`;
    }
  }
  calculateTotalTBet(combination: string): Promise<number> {
    return Promise.resolve(
      this.combos
        .filter(combo => combo.type === "T" && combo.combination === combination) // ✅ Filter by type & combination
        .reduce((total, combo) => total + Number(combo.amount) || 0, 0) // ✅ Accumulate total
    );
  }
  
  getTotalAmount(): number {
    return this.combos.reduce((total, combo) => total + Number(combo.amount) || 0, 0);
  }
  
  focusCombination(): void {
    if (this.combinationInput) {
      this.combinationInput.nativeElement.focus(); // ✅ Move cursor to input field
    }
  }
  generateTicketId(): string {
    const epochTime = Date.now().toString(); // Convert to string
    const lastFourDigits = epochTime.slice(-4); // Get last 4 digits of epoch time
    const randomNumber = Math.floor(1000 + Math.random() * 9000); // Generate 4-digit random number
    
    return `${lastFourDigits}${randomNumber}`; // Concatenate for 8-digit ID
  }
  




async onSubmit(): Promise<void> {
  this.isSubmitting = true;
  this.errorMessage = '';
  this.successMessage = '';


  if (!this.hasAvailableOptions) {
    this.errorMessage = 'Time is closed! No options available.';
    this.isSubmitting = false;
    return;
  }
  const now = new Date();
  const currentDate = formatDate(now, 'yyyy-MM-dd', 'en-US');
  const combinedDateTime = `${currentDate}T${this.activeTime}`;
  const drawDate = formatDate(new Date(combinedDateTime), 'yyyy-MM-ddTHH:mm:ss', 'en-US');
  const drawIdDt = formatDate(now, 'yyyyMMdd', 'en-US');
  const hourOnly = this.activeTime.substring(0, 2);
  const drawId = `${drawIdDt}${hourOnly}`;
  const timestamp = formatDate(new Date(), 'MM/dd/yyyy hh:mm:ss a', 'en-US');
  this.currentDateTime=timestamp;
  this.agent=this.email;
  try {
    let gameType = formatDate(combinedDateTime, 'h a', 'en-US').replace(' ', '');

    this.lottoForm.patchValue({
      drawType: gameType,
      drawId: drawId,
      drawDate: drawDate,
      drawTime: combinedDateTime,
      createdDt: timestamp,
      modifyDt: timestamp,
      createdBy: this.email,
      modifyBy: this.email,
      userId: this.uid
    });

    this.detailsFormArray.clear();

    if (this.combos.length === 0) {
      this.errorMessage = 'No bet combinations found.';
      this.isSubmitting = false;
      return;
    }
    
    const totalCombiMap = new Map<string, number>(); // Stores summed betAmounts for each unique combination
const detailGroups: any[] = [];

// 🔹 Collecting values first
for (const combo of this.combos) {
  const detailGroup = this.fb.group({
    id: this.uuid,
    ticketId: combo.ticketId,
    betCombi: combo.combination,
    betType: combo.type,
    betAmount: combo.amount,
    wins: 0,
    isWinner: false,
    createdDt: timestamp,
    modifyDt: timestamp,
    createdBy: this.email,
    modifyBy: this.email,
    status: 'S',
    userId: this.uid,
  });

  detailGroups.push(detailGroup);

  // 🔹 Store in map (Summing up betAmounts per unique combination)
  if (detailGroup.value.status === "S" && detailGroup.value.betType === "T") {
    totalCombiMap.set(
      combo.combination, 
      (Number(totalCombiMap.get(combo.combination)) || 0) + Number(combo.amount)
    );
    
  }
}

// 🔍 **Loop through totalCombiMap to check limits**
for (const [combi, amount] of totalCombiMap.entries()) {
  const { totalAmount } = await this.lottoDraw.getLottoLimit(drawId, combi);

  // Convert to number safely
  const numericAmount = Number(amount);
  const numericTotalAmount = Number(totalAmount);

  const getBetAmount = numericAmount + numericTotalAmount;

  if (getBetAmount > ENUM_LIMITS.LIMIT_BET) {
    this.returnStatus = "overlimit";
    this.errorMessage = `Combination ${combi} is sold out with total bet amount ${getBetAmount}.`;
    this.isSubmitting = false;
    return; // Stop execution if limit exceeded
  }
}

// ✅ No issues? Push to detailsFormArray & proceed
detailGroups.forEach(group => this.detailsFormArray.push(group));

const result = await this.lottoDraw.addLottoDraw(this.lottoForm.value, this.betType, this.uid, this.email);
this.submittedCombos = this.combos;

if (result === 'success') {
  this.completeBet();
} else if (result === 'overlimit') {
  this.errorMessage = 'Betting for this combination is overlimit';
} else if (result === 'exists') {
  console.warn('Draw already exists. Added bet details instead.');
  this.completeBet();
} else if (result === 'permission-denied') {
  throw new Error('You do not have permission to add this lotto draw. Contact your IT admin.');
} else if (result.startsWith('error')) {
  throw new Error('Error encountered while processing your request.');
}
  
  } catch (err: any) {
    console.error('Unexpected error:', err);
    this.errorMessage = err?.message || 'Unexpected error occurred.';
    this.isSubmitting = false;
  }
  
}
resetViewBet(){
  this.combos = [];
}
resetState() {
  this.successMessage = '';
  this.errorMessage = '';
  this.isSubmitting = false;
 // this.combos = []; // or however you reset this
}
goBackToEntry() {
  this.resetState();
  this.activeTab = 'entry';
}
goDone() {
  this.resetState();
  this.combos=[];
  this.activeTab = 'entry';
}

  completeBet(): void {
    this.activeTab = 'receipt'; 
    const now = new Date();
    const formattedDate = formatDate(now, 'MM-dd-yyyy HH:mm:ss', 'en-US');
    this.successMessage = `Bet is completed at ${formattedDate}`;
    this.playForm.reset();
    this.lottoForm.reset();
    this.resetViewBet();
  }
  generateUUIDv4(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  
  
}
export interface Combo {
  id: number;
  ticketId:number;
  combination: string;
  amount: string;
  type: 'T' | 'R';
}