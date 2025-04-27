import { Component, ViewChild, ElementRef } from '@angular/core';
import { FormGroup, FormBuilder, FormArray } from '@angular/forms';
import { ReactiveFormsModule } from '@angular/forms';
import { formatDate } from '@angular/common';
import { LottoDrawService } from '../../services/lotto-draw.service';
import { CommonModule } from '@angular/common';  // Import CommonModule
import { AuthService } from '../../../core/services/auth.service'; 
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
  activeTime: string  = '14:00:00';
  errorMessage: string | null = null;
  successMessage: string | null = null;
  
  constructor(private fb: FormBuilder, private lottoDraw: LottoDrawService,private auth: AuthService) {}

  ngOnInit(): void {
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


///

  }

  get detailsFormArray(): FormArray {
    return this.lottoForm.get('details') as FormArray;
  }
  
  selectTime(time: string): void {
    this.activeTime = time;
    this.lottoForm.patchValue({ drawType: time });
    // console.log("selectTime",this.activeTime);
  }

  ngAfterViewInit(): void {
    //this.targetInput.nativeElement.focus();
  }

handleKeyPress(value: string): void {
  // Validate that the key is a number or 'C' (clear) or '⌫' (backspace)
  if (!/^[0-9]$/.test(value) && value !== 'C' && value !== '⌫') {
    return;
  }

  // Get the active control based on activeField
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

  // Check if both target and ramble have values

  // Handle 'C' (clear) or '⌫' (backspace) operations
  if (value === 'C') {
    activeControl.value = ''; // Clear input field
  } else if (value === '⌫') {
    activeControl.value = currentValue.slice(0, -1); // Remove the last character
  } else if (currentValue.length < maxLength) {
    activeControl.value = currentValue + value;
  }

  // Update the form control value based on active field
  this.playForm.get(this.activeField)?.setValue(activeControl.value);
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
  
  addBet(): void {
    const { target, ramble } = this.playForm.value;
    const betCombi = this.playForm.get('combination')?.value;
    const betAmount = target || ramble || ''; // Default to empty string if neither is provided
    this.errorMessage = ''; // Clear any previous error message
    this.successMessage = '';
  
    const uuid = this.generateUUIDv4();
    const uid = this.auth.userId;   

    const now = new Date();
    const currentDate = formatDate(now, 'yyyy-MM-dd', 'en-US');
    const combinedDateTime = `${currentDate}T${this.activeTime}`;
    const drawDate = formatDate(new Date(combinedDateTime), 'yyyy-MM-ddTHH:mm:ss', 'en-US');
    const drawIdDt = formatDate(now, 'yyyyMMdd', 'en-US');
    const hourOnly = this.activeTime.substring(0, 2);
    const drawId = `${drawIdDt}${hourOnly}`;
  
    let gameType = formatDate(combinedDateTime, 'h a', 'en-US');
    gameType = gameType.replace(' ', ''); // result: "2PM"
  
    this.detailsFormArray.clear(); // Clear all items in the form array


    // Update the lottoForm with dynamic values
    this.lottoForm.patchValue({
      drawType: gameType,
      drawId: drawId,
      drawDate: drawDate,
      drawTime: combinedDateTime,
      createdDt: [formatDate(new Date(), 'MM/dd/yyyy', 'en-US')],
      modifyDt: [formatDate(new Date(), 'MM/dd/yyyy', 'en-US')],
      createdBy: uid,
      modifyBy: uid,
    });
  
    if (!uid) {
      console.error('User not authenticated');
      return;
    }
  
    // Validation checks
    if (!target && !ramble) {
      console.log('Condition: Either target or ramble is empty.');
      this.errorMessage = 'You can add a combination, target, or ramble to proceed.';
      return;
    }
  
    if (this.playForm.get('target')?.value && this.playForm.get('ramble')?.value) {
      console.log('Condition: Both target and ramble are filled.');
      this.errorMessage = 'You cannot fill both Target and Ramble at the same time!';
      return;
    }
  
    if ((!target || !ramble) && !betCombi) {
      console.log('Condition: Neither target nor ramble is filled, and no combination is provided.');
      this.errorMessage = 'You can add a combination, target, or ramble to proceed.';
      return;
    }
  
    if (+betAmount < 10 && betAmount !== '') {
      console.log('Condition: minimum bet 10');
      this.errorMessage = 'The minimum bet is 10. Please add bet amount to proceed.';
      return;
    }

    if ((target && isNaN(+target)) || (ramble && isNaN(+ramble)) || (betCombi && isNaN(+betCombi))) {
      console.log('Condition: Should be numbers');
      this.errorMessage = 'The combination and amount should be a number.';
      return;
    }
  
    if (target && +target > 300) {
      console.log('Condition: Target exceeds 300.');
      this.errorMessage = 'Combination is sold. Please choose another combination.';
      return;
    }
  
    if (ramble && +ramble > 300) {
      console.log('Condition: Ramble exceeds 300.');
      this.errorMessage = 'Combination is sold. Please choose another combination.';
      return;
    }
  
    console.log('Condition: No errors, proceeding with bet.');
    this.errorMessage = null; // Clear error message if condition is no longer true
  
    // Set the betType based on target/ramble state
    this.betType = target && !ramble ? 'T' : ramble && !target ? 'R' : '';
  
    // Create the detail object and add it to the details array
    const detailGroup = this.fb.group({
      id: uuid,
      betCombi: [betCombi],
      betType: [this.betType],
      betAmount: [betAmount],
      wins: [0],
      isWinner: [false],
      createdDt: [formatDate(new Date(), 'MM/dd/yyyy', 'en-US')],
      modifyDt: [formatDate(new Date(), 'MM/dd/yyyy', 'en-US')],
      createdBy: uid,
      modifyBy: uid,
      status:'S'
    });
  
    // Add the detail group to the array
    this.detailsFormArray.push(detailGroup);
  
    // Submit the full lotto form (not just the details)
    
this.lottoDraw.addLottoDraw(this.lottoForm.value, this.betType, uid)
.then((result) => {
  if (result === 'success') {
    // Show success alert/toast
    console.log('Lotto draw successfully added!');
    this.completeBet();
    // console.log('LottoForm:', this.lottoForm.value);

    // ✅ Reset form for next entry
    this.playForm.reset(); // Reset the play form
    this.lottoForm.reset(); // Reset the lotto form
    this.betType = ''; // Optional: reset bet type tracking

  } else if (result === 'exists') {
    // Handle existing draw
    console.warn('Draw already exists. Added bet details instead.');
  } else if (result === 'permission-denied') {
    // Permission issue
    console.error('You do not have permission to add this lotto draw.');
    this.errorMessage = 'You do not have permission to add this lotto draw. Please contact your IT admin.';
    return;

    // alert('Permission denied: You are not allowed to perform this action.');
  } else if (result.startsWith('error')) {
    // Other errors
   // console.error('An error occurred:', result);
    //alert(`Something went wrong: ${result}`);
    
    this.errorMessage = 'You do not have permission to add this lotto draw. Contact your IT admin.';
    return;

  }
})
.catch((err) => {
  // Catch any unexpected unhandled errors
  console.error('Unexpected error:', err);
  alert('Unexpected error: ' + err.message);
});


  }
  
  completeBet(): void {
    const now = new Date();
    const formattedDate = formatDate(now, 'MM-dd-yyyy HH:mm:ss', 'en-US');
    this.successMessage = `Bet is completed at ${formattedDate}`;
  }
  generateUUIDv4(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
