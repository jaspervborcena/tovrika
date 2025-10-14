import { Component, signal, output, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ConfirmationDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'danger' | 'info';
  isHtml?: boolean; // Flag to indicate if message contains HTML
}

@Component({
  selector: 'app-confirmation-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="confirmation-overlay" (click)="onCancel()">
      <div class="confirmation-content" (click)="$event.stopPropagation()" [class]="'type-' + dialogData().type">
        <!-- Header with Icon -->
        <div class="confirmation-header">
          <div class="confirmation-icon" [class]="'icon-' + dialogData().type">
            <svg *ngIf="dialogData().type === 'warning'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 18.5c-.77.833.192 2.5 1.732 2.5z"></path>
            </svg>
            <svg *ngIf="dialogData().type === 'danger'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
            <svg *ngIf="dialogData().type === 'info'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <h3 class="confirmation-title">{{ dialogData().title }}</h3>
        </div>
        
        <!-- Message -->
        <div class="confirmation-body">
          <p class="confirmation-message" *ngIf="!dialogData().isHtml">{{ dialogData().message }}</p>
          <div class="confirmation-message" *ngIf="dialogData().isHtml" [innerHTML]="dialogData().message"></div>
        </div>
        
        <!-- Action Buttons -->
        <div class="confirmation-footer">
          <button 
            *ngIf="dialogData().cancelText" 
            type="button" 
            class="btn btn-secondary" 
            (click)="onCancel()">
            {{ dialogData().cancelText }}
          </button>
          <button 
            type="button" 
            class="btn btn-confirm" 
            [class]="'btn-' + dialogData().type"
            (click)="onConfirm()">
            {{ dialogData().confirmText || 'Confirm' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .confirmation-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      backdrop-filter: blur(2px);
    }
    
    .confirmation-content {
      background: white;
      border-radius: 12px;
      width: 90%;
      max-width: 480px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      overflow: hidden;
      animation: slideIn 0.3s ease-out;
    }
    
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-20px) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
    
    .confirmation-header {
      padding: 1.5rem 1.5rem 1rem;
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    
    .confirmation-icon {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    
    .confirmation-icon svg {
      width: 24px;
      height: 24px;
    }
    
    .icon-warning {
      background: #fef3c7;
      color: #f59e0b;
    }
    
    .icon-danger {
      background: #fee2e2;
      color: #ef4444;
    }
    
    .icon-info {
      background: #dbeafe;
      color: #3b82f6;
    }
    
    .confirmation-title {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
      color: #1f2937;
      line-height: 1.3;
    }
    
    .confirmation-body {
      padding: 0 1.5rem 1rem;
    }
    
    .confirmation-message {
      margin: 0;
      color: #6b7280;
      font-size: 0.95rem;
      line-height: 1.5;
    }

    /* Professional label-value styling for subscription details */
    .confirmation-message .details-grid {
      display: grid;
      gap: 1rem;
      text-align: left;
    }

    .confirmation-message .details-section {
      background: #f9fafb;
      border-radius: 8px;
      padding: 1rem;
      border: 1px solid #e5e7eb;
    }

    .confirmation-message .section-title {
      font-size: 0.875rem;
      font-weight: 600;
      color: #374151;
      margin: 0 0 0.75rem 0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .confirmation-message .detail-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem 0;
      border-bottom: 1px solid #e5e7eb;
    }

    .confirmation-message .detail-row:last-child {
      border-bottom: none;
    }

    .confirmation-message .detail-label {
      font-size: 0.875rem;
      font-weight: 500;
      color: #6b7280;
      display: flex;
      align-items: center;
      gap: 0.375rem;
    }

    .confirmation-message .detail-value {
      font-size: 0.875rem;
      font-weight: 500;
      color: #1f2937;
      text-align: right;
      background: white;
      padding: 0.5rem 0.75rem;
      border-radius: 0.375rem;
      border: 1px solid #d1d5db;
      min-width: 200px;
      cursor: text;
      user-select: text;
    }

    .confirmation-message .detail-value.readonly {
      background: #f9fafb;
      color: #6b7280;
      cursor: default;
    }

    /* Input-style textbox appearance for detail values */
    .confirmation-message .detail-input-style {
      font-size: 0.875rem;
      font-weight: 500;
      color: #1f2937;
      text-align: right;
      background: white;
      padding: 0.5rem 0.75rem;
      border-radius: 0.375rem;
      border: 1px solid #d1d5db;
      min-width: 200px;
      flex: 1;
      max-width: 300px;
      font-family: inherit;
      cursor: text;
      user-select: text;
      word-break: break-word;
    }

    .confirmation-message .detail-input-style.readonly {
      background: #f9fafb;
      color: #6b7280;
      cursor: default;
    }

    /* Input field styling for editable subscription details */
    .confirmation-message .detail-input {
      font-size: 0.875rem;
      font-weight: 500;
      color: #1f2937;
      text-align: right;
      background: white;
      padding: 0.5rem 0.75rem;
      border-radius: 0.375rem;
      border: 1px solid #d1d5db;
      min-width: 200px;
      flex: 1;
      max-width: 300px;
      outline: none;
      transition: all 0.2s ease;
      font-family: inherit;
    }

    .confirmation-message .detail-input:focus {
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .confirmation-message .detail-input:hover {
      border-color: #9ca3af;
    }

    .confirmation-message .detail-input[readonly] {
      background: #f9fafb;
      cursor: not-allowed;
      color: #6b7280;
    }

    .confirmation-message .status-active {
      color: #10b981;
      background: #ecfdf5;
      border-color: #10b981;
    }

    .confirmation-message .status-inactive {
      color: #6b7280;
      background: #f3f4f6;
      border-color: #9ca3af;
    }

    .confirmation-message .status-expired {
      color: #ef4444;
      background: #fef2f2;
      border-color: #ef4444;
    }

    .confirmation-message .amount-highlight {
      color: #667eea;
      font-size: 1rem;
      font-weight: 600;
      background: #eef2ff;
      border-color: #667eea;
    }
    
    .confirmation-footer {
      padding: 1rem 1.5rem 1.5rem;
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      background: #f9fafb;
      border-top: 1px solid #e5e7eb;
    }
    
    .confirmation-footer:has(.btn:only-child) {
      justify-content: center;
    }
    
    .btn {
      padding: 0.625rem 1.25rem;
      border: none;
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      min-width: 80px;
    }
    
    .btn-secondary {
      background: white;
      color: #374151;
      border: 1px solid #d1d5db;
    }
    
    .btn-secondary:hover {
      background: #f9fafb;
      border-color: #9ca3af;
    }
    
    .btn-warning {
      background: #f59e0b;
      color: white;
    }
    
    .btn-warning:hover {
      background: #d97706;
    }
    
    .btn-danger {
      background: #ef4444;
      color: white;
    }
    
    .btn-danger:hover {
      background: #dc2626;
    }
    
    .btn-info {
      background: #3b82f6;
      color: white;
    }
    
    .btn-info:hover {
      background: #2563eb;
    }
    
    /* Type-specific content styling */
    .type-warning .confirmation-title {
      color: #92400e;
    }
    
    .type-danger .confirmation-title {
      color: #991b1b;
    }
    
    .type-info .confirmation-title {
      color: #1e40af;
    }
    
    /* Mobile responsiveness */
    @media (max-width: 480px) {
      .confirmation-content {
        width: 95%;
        margin: 1rem;
      }
      
      .confirmation-header {
        padding: 1rem 1rem 0.75rem;
        flex-direction: column;
        text-align: center;
        gap: 0.75rem;
      }
      
      .confirmation-body {
        padding: 0.75rem 1rem;
        text-align: center;
      }
      
      .confirmation-footer {
        padding: 1rem;
        flex-direction: column-reverse;
      }
      
      .btn {
        width: 100%;
      }
    }
  `]
})
export class ConfirmationDialogComponent {
  // Input for dialog configuration
  dialogData = input.required<ConfirmationDialogData>();

  // Outputs for user actions
  confirmed = output<void>();
  cancelled = output<void>();

  onConfirm(): void {
    this.confirmed.emit();
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}
