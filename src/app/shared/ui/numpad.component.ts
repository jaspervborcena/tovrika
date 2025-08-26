import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from './button.component';

@Component({
  selector: 'ui-numpad',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  template: `
    <div class="bg-white rounded-lg p-4 shadow-md">
      <div class="grid grid-cols-3 gap-3">
        <!-- Numbers 1-9 -->
        <ui-button
          *ngFor="let num of numbers"
          variant="ghost"
          size="lg"
          (click)="onNumberClick(num)"
          class="h-12 text-lg font-semibold hover:bg-gray-100 border border-gray-200"
        >
          {{ num }}
        </ui-button>
        
        <!-- Row 4: Decimal, 0, Clear -->
        <ui-button
          *ngIf="allowDecimal"
          variant="ghost"
          size="lg"
          (click)="onNumberClick('.')"
          class="h-12 text-lg font-semibold hover:bg-gray-100 border border-gray-200"
        >
          .
        </ui-button>
        <div *ngIf="!allowDecimal" class="h-12"></div>
        
        <ui-button
          variant="ghost"
          size="lg"
          (click)="onNumberClick('0')"
          class="h-12 text-lg font-semibold hover:bg-gray-100 border border-gray-200"
        >
          0
        </ui-button>
        
        <ui-button
          variant="danger"
          size="lg"
          (click)="onClear()"
          class="h-12 text-lg font-semibold"
        >
          <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V9a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
          </svg>
        </ui-button>
      </div>
      
      <!-- Additional function buttons -->
      <div class="grid grid-cols-2 gap-3 mt-3">
        <ui-button
          variant="secondary"
          size="md"
          (click)="onBackspace()"
          class="h-10"
        >
          <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V9a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
          </svg>
          Backspace
        </ui-button>
        
        <ui-button
          variant="primary"
          size="md"
          (click)="onEnter()"
          class="h-10"
        >
          <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          Enter
        </ui-button>
      </div>
    </div>
  `
})
export class NumpadComponent {
  @Input() maxLength = 10;
  @Input() allowDecimal = true;
  @Output() numberClick = new EventEmitter<string>();
  @Output() clear = new EventEmitter<void>();
  @Output() backspace = new EventEmitter<void>();
  @Output() enter = new EventEmitter<void>();

  numbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  onNumberClick(num: string) {
    this.numberClick.emit(num);
  }

  onClear() {
    this.clear.emit();
  }

  onBackspace() {
    this.backspace.emit();
  }

  onEnter() {
    this.enter.emit();
  }
}
