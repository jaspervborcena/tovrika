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
@Component({
  selector: 'app-cancelled',
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
  templateUrl: './cancelled.component.html',
  styleUrls: ['./cancelled.component.less'],
})
export class CancelledComponent implements OnInit,OnDestroy {
  transactionForm!: FormGroup;
  bets = signal<any[]>([]);
  activeTime: string = 'ALL';
  selectedDate: FormControl = new FormControl(new Date());  // Initialize with current date
  drawId: string = ''; // Will store the dynamic drawId
  currentPage = 1; // Pagination setup
  itemsPerPage = 20;
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

        this.loadCancelledTransactions();
    }
}

  listenToTransactions(): void {
    const selectedDate = this.selectedDate.value || new Date();
    const formattedDate = this.formatDate(selectedDate);
    this.drawIds = this.getDrawIds(formattedDate, this.activeTime);
  
    this.lottoDrawTransactionService.listenToCancelled(this.drawIds);
  }

  selectTime(time: string): void {
    this.activeTime = time;
    this.updateDrawId();  // Update drawId whenever the time is selected
    this.loadCancelledTransactions();  // Reload transactions based on new drawId
  }

  onDateChange(): void {
    this.updateDrawId();  // Update drawId whenever the date changes
    this.loadCancelledTransactions();  // Reload transactions based on new drawId
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

  loadCancelledTransactions(): void {
    const formattedDate = this.formatDate(this.selectedDate.value || new Date());
    this.drawIds = this.getDrawIds(formattedDate, this.activeTime);
    this.lottoDrawTransactionService.listenToCancelled(this.drawIds);
  }

  // Handle pagination
  get paginatedBets() {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = this.currentPage * this.itemsPerPage;

    // Directly access transactions Signal
    const betsData = this.transactions(); // ✅ No need to reassign this.transactions

    return betsData.slice(start, end);
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

  // Get total pages for pagination
  get totalPages() {
    return Math.ceil(this.totalItems / this.itemsPerPage);
  }
  ngOnDestroy(): void {
    console.log('Component destroyed, cleaning up Signals...');

    // ✅ Ensure cleanupEffect is defined before calling .destroy()
    if (this.cleanupEffect) {
        this.cleanupEffect.destroy();
    }
}


}
