import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type LogoSize = 'sm' | 'md' | 'lg' | 'xl' | 'custom';
export type LogoVariant = 'full' | 'icon' | 'text';
export type LogoBackground = 'none' | 'white' | 'light' | 'rounded' | 'circle';

@Component({
  selector: 'app-logo',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="logo-container" [ngClass]="containerClasses">
      <img 
        [src]="logoSrc" 
        [alt]="altText"
        [ngClass]="imageClasses"
        [style.width]="customWidth"
        [style.height]="customHeight"
      />
      <span *ngIf="showText && variant !== 'icon'" [ngClass]="textClasses">
        {{ companyName }}
      </span>
    </div>
  `,
  styles: [`
    .logo-container {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .logo-container.center {
      justify-content: center;
    }

    .logo-container.start {
      justify-content: flex-start;
    }

    .logo-container.end {
      justify-content: flex-end;
    }

    .logo-image {
      object-fit: contain;
      transition: all 0.2s ease;
    }

    .logo-image.clickable {
      cursor: pointer;
    }

    .logo-image.clickable:hover {
      opacity: 0.8;
      transform: scale(1.02);
    }

    /* Background variants */
    .logo-image.bg-none {
      background: none;
    }

    .logo-image.bg-white {
      background: #ffffff;
      padding: 4px;
      border-radius: 4px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .logo-image.bg-light {
      background: #f8fafc;
      padding: 4px;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
    }

    .logo-image.bg-rounded {
      background: #ffffff;
      padding: 6px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .logo-image.bg-circle {
      background: #ffffff;
      padding: 6px;
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    /* Size variants */
    .logo-image.size-sm {
      width: 24px;
      height: 24px;
    }

    .logo-image.size-md {
      width: 32px;
      height: 32px;
    }

    .logo-image.size-lg {
      width: 48px;
      height: 48px;
    }

    .logo-image.size-xl {
      width: 64px;
      height: 64px;
    }

    /* Text styles */
    .logo-text {
      font-weight: 700;
      transition: color 0.2s ease;
    }

    .logo-text.size-sm {
      font-size: 0.875rem;
    }

    .logo-text.size-md {
      font-size: 1rem;
    }

    .logo-text.size-lg {
      font-size: 1.25rem;
    }

    .logo-text.size-xl {
      font-size: 1.5rem;
    }

    .logo-text.theme-light {
      color: #1a202c;
    }

    .logo-text.theme-dark {
      color: #ffffff;
    }

    .logo-text.theme-primary {
      color: #667eea;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .logo-container.responsive .logo-image.size-lg {
        width: 32px;
        height: 32px;
      }

      .logo-container.responsive .logo-image.size-xl {
        width: 48px;
        height: 48px;
      }

      .logo-container.responsive .logo-text.size-lg {
        font-size: 1rem;
      }

      .logo-container.responsive .logo-text.size-xl {
        font-size: 1.25rem;
      }
    }
  `]
})
export class LogoComponent {
  @Input() size: LogoSize = 'md';
  @Input() variant: LogoVariant = 'full';
  @Input() theme: 'light' | 'dark' | 'primary' = 'light';
  @Input() alignment: 'start' | 'center' | 'end' = 'start';
  @Input() showText: boolean = true;
  @Input() clickable: boolean = false;
  @Input() companyName: string = 'Tovrika POS System';
  @Input() customWidth: string = '';
  @Input() customHeight: string = '';
  @Input() responsive: boolean = true;
  @Input() background: LogoBackground = 'white';

  get logoSrc(): string {
    return '/assets/tovrika_logo.png';
  }

  get altText(): string {
    return `${this.companyName} Logo`;
  }

  get containerClasses(): string {
    const classes = [];
    
    if (this.alignment) {
      classes.push(this.alignment);
    }
    
    if (this.responsive) {
      classes.push('responsive');
    }

    return classes.join(' ');
  }

  get imageClasses(): string {
    const classes = ['logo-image'];
    
    if (this.size !== 'custom') {
      classes.push(`size-${this.size}`);
    }
    
    if (this.clickable) {
      classes.push('clickable');
    }

    // Add background class
    classes.push(`bg-${this.background}`);

    return classes.join(' ');
  }

  get textClasses(): string {
    const classes = ['logo-text'];
    
    if (this.size !== 'custom') {
      classes.push(`size-${this.size}`);
    }
    
    classes.push(`theme-${this.theme}`);

    return classes.join(' ');
  }
}