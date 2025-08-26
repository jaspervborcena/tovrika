import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from './button.component';

@Component({
  selector: 'ui-modal',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  template: `
    <div
      *ngIf="isOpen"
      class="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <!-- Background overlay with animation -->
      <div class="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm transition-opacity duration-300"></div>
      
      <!-- Modal container -->
      <div class="flex min-h-full items-center justify-center p-4">
        <!-- Modal panel -->
        <div 
          class="animate-fade-in relative bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden"
          [class.sm:max-w-lg]="size === 'lg'"
          [class.sm:max-w-2xl]="size === 'xl'"
          [class.sm:max-w-4xl]="size === '2xl'"
        >
          <!-- Header -->
          <div class="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
            <h3 class="text-xl font-semibold text-gray-900" id="modal-title">
              {{ title }}
            </h3>
            <button
              type="button"
              (click)="onClose.emit()"
              class="p-2 hover:bg-gray-200 rounded-full transition-colors duration-200"
            >
              <svg class="icon text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Content -->
          <div class="p-6 overflow-y-auto max-h-[60vh]">
            <ng-content></ng-content>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
            <ui-button
              type="button"
              variant="ghost"
              (click)="onClose.emit()"
            >
              {{ cancelLabel }}
            </ui-button>
            <ui-button
              type="button"
              variant="primary"
              [loading]="loading"
              [disabled]="saveDisabled"
              (click)="onSave.emit()"
            >
              {{ saveLabel }}
            </ui-button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class ModalComponent {
  @Input() isOpen = false;
  @Input() title = '';
  @Input() saveLabel = 'Save';
  @Input() cancelLabel = 'Cancel';
  @Input() loading = false;
  @Input() saveDisabled = false;
  @Input() size: 'md' | 'lg' | 'xl' | '2xl' = 'md';

  @Output() onClose = new EventEmitter<void>();
  @Output() onSave = new EventEmitter<void>();
}
