import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'ui-search',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="relative">
      <label [for]="id" class="sr-only">{{ placeholder }}</label>
      <div class="relative">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          [id]="id"
          [formControl]="searchControl"
          [placeholder]="placeholder"
          class="form-input pl-10 pr-4 transition-all duration-200"
          [class.border-red-300]="error"
          [class.ring-red-200]="error"
          [class.text-red-900]="error"
          [class.placeholder-red-300]="error"
          [class.focus:ring-red-500]="error"
          [class.focus:border-red-500]="error"
        />
        <div *ngIf="searchControl.value" class="absolute inset-y-0 right-0 pr-3 flex items-center">
          <button
            type="button"
            (click)="clearSearch()"
            class="text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600 transition-colors duration-150"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      <div *ngIf="error" class="mt-2 text-sm text-red-600 flex items-center">
        <svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        {{ error }}
      </div>
    </div>
  `
})
export class SearchComponent {
  @Input() id = 'search';
  @Input() placeholder = 'Search';
  @Input() error = '';
  @Input() debounceTime = 300;

  @Output() search = new EventEmitter<string>();

  searchControl = new FormControl('');

  constructor() {
    this.searchControl.valueChanges.pipe(
      debounceTime(this.debounceTime),
      distinctUntilChanged()
    ).subscribe(value => {
      this.search.emit(value || '');
    });
  }

  clearSearch() {
    this.searchControl.setValue('');
  }
}
