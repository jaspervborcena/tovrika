import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'ui-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      [type]="type"
      [disabled]="disabled || loading"
      [class]="buttonClasses"
    >
      <svg
        *ngIf="loading"
        class="animate-spin -ml-1 mr-3 h-4 w-4"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          class="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width="4"
        ></circle>
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
      <ng-content></ng-content>
    </button>
  `,
  styles: [`
    /* Professional Button Animations */
    button {
      position: relative;
      overflow: hidden;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    
    button.primary-btn {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    button.primary-btn::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
      transition: left 0.8s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    button.primary-btn:hover::before {
      left: 100%;
    }
    
    button.primary-btn:hover {
      background: linear-gradient(135deg, #5a6fd8 0%, #6b4190 100%);
      transform: translateY(-2px);
      box-shadow: 0 12px 30px rgba(102, 126, 234, 0.4), 0 6px 16px rgba(102, 126, 234, 0.3);
    }
    
    button.primary-btn:active {
      transform: translateY(0);
    }
  `]
})
export class ButtonComponent {
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() variant: 'primary' | 'secondary' | 'danger' | 'ghost' = 'primary';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() disabled = false;
  @Input() loading = false;
  @Input() fullWidth = false;

  get buttonClasses(): string {
    const base = 'inline-flex items-center justify-center font-semibold rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed border-none cursor-pointer';
    
    // Size classes
    const sizeClasses = {
      sm: 'px-4 py-2 text-sm gap-2',
      md: 'px-6 py-3 text-base gap-2',
      lg: 'px-8 py-4 text-lg gap-3'
    };
    
    // Variant classes with professional styling
    const variantClasses = {
      primary: 'primary-btn text-white font-weight-600 letter-spacing-0.025em shadow-lg',
      secondary: 'border-2 border-gray-200 text-gray-700 bg-white hover:bg-gray-50 focus:ring-gray-500 hover:border-gray-300 hover:shadow-md hover:-translate-y-1',
      danger: 'text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 focus:ring-red-500 shadow-lg hover:shadow-xl hover:-translate-y-1',
      ghost: 'text-gray-700 bg-transparent hover:bg-gray-100 focus:ring-gray-500 hover:shadow-sm'
    };
    
    const width = this.fullWidth ? 'w-full' : '';
    
    return [
      base,
      sizeClasses[this.size],
      variantClasses[this.variant],
      width
    ].filter(Boolean).join(' ');
  }
}
