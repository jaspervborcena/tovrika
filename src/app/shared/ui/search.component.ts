import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'ui-search',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="max-w-lg w-full lg:max-w-xs">
      <label for="search" class="sr-only">Search</label>
      <div class="relative">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg class="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd" />
          </svg>
        </div>
        <input
          [id]="id"
          [formControl]="searchControl"
          [placeholder]="placeholder"
          class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
          [class.border-red-300]="error"
          [class.text-red-900]="error"
          [class.placeholder-red-300]="error"
          [class.focus:ring-red-500]="error"
          [class.focus:border-red-500]="error"
        />
      </div>
      @if (error) {
        <p class="mt-2 text-sm text-red-600">{{ error }}</p>
      }
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
}
