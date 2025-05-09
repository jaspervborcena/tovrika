import { Component, OnInit, Signal ,OnDestroy,signal,effect,EffectRef ,runInInjectionContext,Injector   } from '@angular/core';
import { FormBuilder, FormGroup, FormControl, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { LottoDrawTransactionService } from '../../services/lotto/lotto-draw-transaction.service'; // <--- Your service
import { formatDate } from '@angular/common'; // To format the date
import { LottoDrawTransaction } from '../../models/lotto/lotto-draw';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, Inject } from '@angular/core';
import { MatDatepickerInputEvent } from '@angular/material/datepicker';
@Component({
  selector: 'app-transaction',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './transaction.component.html',
  styleUrls: ['./transaction.component.less'],
})
export class TransactionComponent implements OnInit,OnDestroy {
  transactionForm!: FormGroup;
  bets = signal<any[]>([]);
  activeTime: string = 'ALL';
  selectedDate: FormControl = new FormControl(new Date());  // Initialize with current date
  drawId: string = ''; // Will store the dynamic drawId
  currentPage = 1; // Pagination setup
  itemsPerPage = 30;
  totalItems = 100; // Example total items for pagination
  drawIds: string[] = []; 

  // Predefined times for ALL
  predefinedTimes = ['14', '17', '21']; // Representing 14:00, 17:00, 21:00
  // transactions = signal<LottoDrawTransaction[]>([]);
  transactions!: Signal<LottoDrawTransaction[]>;
  private cleanupEffect!: EffectRef;
  
  constructor(
    private fb: FormBuilder,
    private lottoDrawTransactionService: LottoDrawTransactionService ,
    private injector: Injector,@Inject(PLATFORM_ID) private platformId: Object,
  ) {}
  ngOnInit(): void {
    this.transactionForm = this.fb.group({
      selectedDate: [''],
      combination: [''],
      target: [''],
      ramble: ['']
    });

    // ✅ Run Signals only if on the browser (prevents SSR issues)
    if (isPlatformBrowser(this.platformId)) {
        this.transactions = this.lottoDrawTransactionService.lottoDrawTransactionsSignal;

        runInInjectionContext(this.injector, () => {
            this.cleanupEffect = effect(() => {
                this.bets.set(this.transactions());
            });
        });

        this.loadTransactions();
    }
}

  listenToTransactions(): void {
    const selectedDate = this.selectedDate.value || new Date();
    const formattedDate = this.formatDate(selectedDate);
    this.drawIds = this.getDrawIds(formattedDate, this.activeTime);
  
    this.lottoDrawTransactionService.listenToTransactions(this.drawIds);
  }

  selectTime(time: string): void {
    this.activeTime = time;
    this.updateDrawId();  // Update drawId whenever the time is selected
    this.loadTransactions();  // Reload transactions based on new drawId
  }

  // onDateChange(): void {
  //   this.updateDrawId();  // Update drawId whenever the date changes
  //   this.loadTransactions();  // Reload transactions based on new drawId
  // }
  isDeleteDisabled(betTime: string): boolean {
    const currentTime = new Date();
    const betDateTime = new Date(betTime); // ✅ Convert `betTime` to Date object
  
    // ✅ Calculate 10 minutes before bet time
    const tenMinutesBeforeBet = new Date(betDateTime);
    tenMinutesBeforeBet.setMinutes(betDateTime.getMinutes() - 10);
  
    // ✅ Enable delete when current time is LESS than 10 minutes before bet time
    return currentTime >= tenMinutesBeforeBet; // 🔥 If current time is past `tenMinutesBeforeBet`, disable
  }
  
  
  
  
  onDateChange(event: MatDatepickerInputEvent<Date>): void {
    const selectedDate = event.value|| new Date();
     this.updateDrawId();  // Update drawId whenever the date changes
    this.loadTransactions();  // Reload transactions based on new drawId
    
  }
  updateDrawId(): void {
    const selectedDate = this.selectedDate.value;
    if (selectedDate && this.activeTime && this.activeTime !== 'ALL') {
      // Format date as YYYYMMDD
      const formattedDate = formatDate(selectedDate, 'yyyyMMdd', 'en-US');
      // Extract the hour part from the activeTime (first 2 digits)
      const hour = this.activeTime.split(':')[0]; 
      // Construct drawId (YYYYMMDD + Hour)
      this.drawId = `${formattedDate}${hour}`;
    } else {
      this.drawId = '';  // Default to empty if there's no valid date/time selected
    }
    // console.log('Updated drawId:', this.drawId);
  }

  loadTransactions(): void {
    const formattedDate = this.formatDate(this.selectedDate.value || new Date());
    this.drawIds = this.getDrawIds(formattedDate, this.activeTime);
    this.lottoDrawTransactionService.listenToTransactions(this.drawIds);

  }

  // Handle pagination

get paginatedBets() {
  const start = (this.currentPage - 1) * this.itemsPerPage;
  const end = this.currentPage * this.itemsPerPage;

  // ✅ Sort transactions by `details.createdDt` in descending order
  const sortedBets = this.transactions()
    .sort((a, b) => new Date(b.createdDt).getTime() - new Date(a.createdDt).getTime());

  console.log("Sorted Bets:", sortedBets);

  // ✅ Apply pagination (30 items per page)
  return sortedBets.slice(start, end);
}



  buildDrawId(date: string, time: string): string {
    // Generate the drawId in the format YYYYMMDD + HH
    return `${date}${time.substring(0, 2)}`; // Format: YYYYMMDDHH
  }
  getDrawIds(date: string, time: string): string[] {
    let times: string[] = [];
    if (time === 'ALL') {
      times = ['14', '17', '21'];  // Hardcoded times for ALL
    } else {
      times = [time.substring(0, 2)];  // Extract hours (e.g., 14 from '14:00:00')
    }
    
    // Create drawIds based on date and time combinations
    return times.map(hour => `${date}${hour}`);
  }

  deleteBet(date:string, ticketId: string | undefined): void {
    if (!ticketId) return; // ✅ Prevent deletion attempts on undefined ids
    this.updateDrawId();
    //this.bets.update(currentBets => currentBets.filter(b => b.id !== betId));
    console.log("deleteBet",date)
   const drawId=this.formatDateToDrawId(date);

    this.lottoDrawTransactionService.markLottoDrawAsDeleted(drawId,ticketId);

    
}

formatDateToDrawId(timestamp: string): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // ✅ Ensure 2 digits
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0'); // ✅ Extract hour

  return `${year}${month}${day}${hour}`;
}

  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}${month}${day}`;
  }

  // Handle page change
  setPage(page: number) {
    this.currentPage = page;
  }
  
  get totalPages(): number {
    return Math.ceil(this.transactions().length / this.itemsPerPage);
  }
  
  goToFirstPage() {
    this.currentPage = 1;
  }
  
  goToPreviousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }
  
  goToNextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }
  
  goToLastPage() {
    this.currentPage = this.totalPages;
  }

  ngOnDestroy(): void {
    console.log('Component destroyed, cleaning up Signals...');

    // ✅ Ensure cleanupEffect is defined before calling .destroy()
    if (this.cleanupEffect) {
        this.cleanupEffect.destroy();
    }
}


}
