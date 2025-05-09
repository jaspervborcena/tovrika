import { Component, OnInit, Signal ,OnDestroy,signal,effect,EffectRef ,runInInjectionContext,Injector   } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { FormBuilder, FormGroup, FormControl, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { LottoDrawTransactionService } from '../../services/lotto/lotto-draw-transaction.service'; // <--- Your service
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, Inject } from '@angular/core';
import { LottoDrawDashboardService } from '../../services/lotto/lotto-draw.dashboard.service';
import { LottoDrawDashboard } from '../../models/lotto/lotto-draw';
import { formatDate } from '@angular/common'; // To format the date
import { MatDatepickerInputEvent } from '@angular/material/datepicker';


@Component({
  selector: 'app-dashboard',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.less']
})
export class DashboardComponent implements OnInit {
  dashboardForm!: FormGroup;
  selectedDate: FormControl = new FormControl(new Date());  // Initialize with current date
  activeTime: string = 'ALL';
  bets = signal<any[]>([]);
  dashboard!: Signal<LottoDrawDashboard[]>;
  private cleanupEffect!: EffectRef;
  drawId: string = ''; // Will store the dynamic drawId
  currentPage = 1; // Pagination setup
  itemsPerPage = 20;
  totalItems = 100; // Example total items for pagination
  drawIds: string[] = []; 
  constructor(
    private fb: FormBuilder,
    private lottoDashboardService: LottoDrawDashboardService ,
    private injector: Injector,@Inject(PLATFORM_ID) private platformId: Object,
  ) {}


  ngOnInit(): void {
    this.dashboardForm = this.fb.group({
      selectedDate: this.selectedDate
    });


    // ✅ Run Signals only if on the browser (prevents SSR issues)
    if (isPlatformBrowser(this.platformId)) {
        this.dashboard = this.lottoDashboardService.lottoDrawSummarySignal;

        runInInjectionContext(this.injector, () => {
            this.cleanupEffect = effect(() => {
                this.bets.set(this.dashboard());
            });
        });

        this.loadDashboard();
    }
}
getTotalValues(): { bet: number; hits: number; commission: number; kabig: number } {
  return this.dashboard().reduce(
    (totals, bet) => {
      totals.bet += Number(bet.bet) || 0;
      totals.hits += Number(bet.hits) || 0;
      totals.commission += Number(bet.commission) || 0;
      totals.kabig += Number(bet.kabig) || 0;
      return totals;
    },
    { bet: 0, hits: 0, commission: 0, kabig: 0 } // ✅ Initialize totals
  );
}

loadDashboard(): void {
  const formattedDate = this.formatDate(this.selectedDate.value || new Date());
  this.drawIds = this.getDrawIds(formattedDate, "ALL");
  this.listenTolistenToDashboard();
}
onDateChange(event: MatDatepickerInputEvent<Date>): void {
  const selectedDate = event.value|| new Date();
  const formattedDate = this.formatDate(selectedDate);
  this.drawIds = this.getDrawIds(formattedDate, this.activeTime);

  this.lottoDashboardService.listenToSummaryTransactions(this.drawIds);

  this.lottoDashboardService.lottoDrawSummarySignal();
  // You can implement further logic here, such as filtering data or updating UI
}

  // ✅ Fetch transactions based on selected date
  listenTolistenToDashboard(): void {
    const selectedDate = this.selectedDate.value || new Date();
    const formattedDate = this.formatDate(selectedDate);
    this.drawIds = this.getDrawIds(formattedDate, this.activeTime);
  
    this.lottoDashboardService.listenToSummaryTransactions(this.drawIds);
  
    this.lottoDashboardService.lottoDrawSummarySignal();
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
  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}${month}${day}`;
  }
  // Handle pagination
  get paginatedBets() {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = this.currentPage * this.itemsPerPage;

    // Directly access transactions Signal
    const betsData = this.dashboard(); // ✅ No need to reassign this.transactions

    return betsData.slice(start, end);
}

}
