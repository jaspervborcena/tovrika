import { Component, OnInit, Signal, OnDestroy, signal, effect, EffectRef, runInInjectionContext, Injector } from '@angular/core';
import { FormBuilder, FormGroup, FormControl, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { WinnerService } from '../../services/lotto/lotto-draw-winners.service';
import { formatDate } from '@angular/common';
import { Winner } from '../../models/lotto/lotto-winner';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, Inject } from '@angular/core';

@Component({
  selector: 'app-winners',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './winners.component.html',
  styleUrls: ['./winners.component.less'],
})
export class WinnersComponent implements OnInit, OnDestroy {
  winnersForm!: FormGroup;
  activeTime: string = 'ALL';
  selectedDate: FormControl = new FormControl(new Date());
  drawId: string = ''; 
  currentPage = 1; 
  itemsPerPage = 20;
  totalItems = 100;
  drawIds: string = "";

  predefinedTimes = ['14', '17', '21']; 
  winners!: Signal<Winner[]>; // ✅ Correct Signal type
  private cleanupEffect!: EffectRef;


  roleId: number;
  isAgentNotAllowed: boolean;
  
  constructor(
    private fb: FormBuilder,
    private winnerService: WinnerService,
    private injector: Injector,
    @Inject(PLATFORM_ID) private platformId: Object,
  ) {
    const storedRoleId = localStorage.getItem("roleId");

    // ✅ Check if roleId is missing or invalid
    this.roleId = storedRoleId && !isNaN(Number(storedRoleId)) ? Number(storedRoleId) : 0;
    this.isAgentNotAllowed = this.roleId < 9;
  }

  

  ngOnInit(): void {
    this.winnersForm = this.fb.group({
      selectedDate: [''],
      combination: ['']
    });

    // ✅ Run Signals only if on the browser (prevents SSR issues)
    if (isPlatformBrowser(this.platformId)) {
        this.winners = this.winnerService.winnersSignal; // ✅ Fix incorrect assignment

        runInInjectionContext(this.injector, () => {
            this.cleanupEffect = effect(() => {
                console.log("Updated winners:", this.winners());
            });
        });

        this.loadWinners();
    }
  }

  listenToWinners(): void { // ✅ Fixed method name
    const formattedDate = this.formatDate(this.selectedDate.value || new Date());
    this.drawIds = this.getDrawIds(formattedDate, this.activeTime);
    this.winnerService.listenToWinners(this.drawIds);
  }

  selectTime(time: string): void {
    this.activeTime = time;
    this.updateDrawId();
    this.loadWinners();
  }

  onDateChange(): void {
    this.updateDrawId();
    this.loadWinners();
  }

  updateDrawId(): void {
    const selectedDate = this.selectedDate.value;
    if (selectedDate && this.activeTime !== 'ALL') {
      const formattedDate = formatDate(selectedDate, 'yyyyMMdd', 'en-US');
      const hour = this.activeTime.split(':')[0]; 
      this.drawId = `${formattedDate}${hour}`;
    } else {
      this.drawId = '';
    }
  }

  loadWinners(): void {
    const formattedDate = this.formatDate(this.selectedDate.value || new Date());
    this.drawIds = this.getDrawIds(formattedDate, this.activeTime);
    this.winnerService.listenToWinners(this.drawIds);
  }

  get paginatedWinners(): Winner[] { // ✅ Renamed for clarity
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = this.currentPage * this.itemsPerPage;
    return this.winners()?.slice(start, end) || []; // ✅ Ensure safe access
  }

  getDrawIds(date: string, time: string): string {
    return `${date}${time.substring(0, 2)}`;
  }

  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}${month}${day}`;
  }

  setPage(page: number): void {
    this.currentPage = page;
  }

  get totalPages(): number {
    return Math.ceil(this.totalItems / this.itemsPerPage);
  }

  setWinner()
  {
    const selectedDate = this.selectedDate.value || new Date();
    const formattedDate = this.formatDate(selectedDate);
    this.drawIds = this.getDrawIds(formattedDate, this.activeTime);
    const combination = this.winnersForm.get('combination')?.value?.trim();
    this.winnerService.markAsWinner(this.drawIds,combination);
    this.loadWinners();
  }
clearWinner()
{
  const selectedDate = this.selectedDate.value || new Date();
  const formattedDate = this.formatDate(selectedDate);
  this.drawIds = this.getDrawIds(formattedDate, this.activeTime);
  const combination = this.winnersForm.get('combination')?.value?.trim();
  this.winnerService.clearWinner(this.drawIds);
  this.loadWinners();
}
  ngOnDestroy(): void {
    console.log('Component destroyed, cleaning up Signals...');
    if (this.cleanupEffect) {
        this.cleanupEffect.destroy();
    }
  }
}
