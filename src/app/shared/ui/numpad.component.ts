import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from './button.component';

@Component({
  selector: 'ui-numpad',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  template: `
    <div class="grid grid-cols-3 gap-2">
      <button
        *ngFor="let num of numbers"
        (click)="onNumberClick(num)"
        class="inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
      >
        {{ num }}
      </button>
      <button
        (click)="onNumberClick('.')"
        class="inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
      >
        .
      </button>
      <button
        (click)="onNumberClick('0')"
        class="inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
      >
        0
      </button>
      <button
        (click)="onClear()"
        class="inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
      >
        C
      </button>
    </div>
  `
})
export class NumpadComponent {
  @Input() maxLength = 10;
  @Input() allowDecimal = true;
  @Output() numberClick = new EventEmitter<string>();
  @Output() clear = new EventEmitter<void>();

  numbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  onNumberClick(num: string) {
    this.numberClick.emit(num);
  }

  onClear() {
    this.clear.emit();
  }
}
