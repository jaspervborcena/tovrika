import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Location } from '@angular/common';

@Component({
  selector: 'app-mobile-receipt-preview-bak',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="receipt-preview-container">
      <!-- Header -->
      <div class="preview-header">
        <button 
          (click)="goBack()" 
          class="back-btn"
          [disabled]="isPrinting()">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back
        </button>
        <h2>Receipt Preview</h2>
        <div class="spacer"></div>
      </div>

      <!-- Receipt Content -->
      <div class="receipt-content" id="receipt-content">
        <pre>{{ receiptContent() }}</pre>
      </div>

      <!-- Print Button -->
      <div class="print-actions">
        <button 
          (click)="printReceipt()" 
          class="print-btn"
          [disabled]="isPrinting()"
          [class.printing]="isPrinting()">
          <svg *ngIf="!isPrinting()" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
          </svg>
          <span *ngIf="isPrinting()" class="spinner"></span>
          {{ isPrinting() ? 'Printing...' : 'Print Receipt' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .receipt-preview-container {
      display: flex;
      flex-direction: column;
      height: 100vh;
      background: #f5f5f5;
    }

    .preview-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem;
      background: white;
      border-bottom: 1px solid #e5e7eb;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .back-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background: #f3f4f6;
      border: none;
      border-radius: 0.5rem;
      font-size: 1rem;
      cursor: pointer;
      transition: background 0.2s;
    }

    .back-btn:hover:not(:disabled) {
      background: #e5e7eb;
    }

    .back-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .back-btn svg {
      width: 1.25rem;
      height: 1.25rem;
    }

    .preview-header h2 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
    }

    .spacer {
      width: 100px;
    }

    .receipt-content {
      flex: 1;
      overflow-y: auto;
      padding: 1rem;
      display: flex;
      justify-content: center;
    }

    .receipt-content pre {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.3;
      white-space: pre-wrap;
      word-wrap: break-word;
      background: white;
      padding: 1rem;
      border-radius: 0.5rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      max-width: 300px;
      margin: 0;
      font-weight: 500;
      letter-spacing: 0.3px;
    }

    .print-actions {
      padding: 1rem;
      background: white;
      border-top: 1px solid #e5e7eb;
      box-shadow: 0 -1px 3px rgba(0, 0, 0, 0.1);
    }

    .print-btn {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 1rem;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 0.5rem;
      font-size: 1.125rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }

    .print-btn:hover:not(:disabled) {
      background: #2563eb;
    }

    .print-btn:disabled {
      background: #9ca3af;
      cursor: not-allowed;
    }

    .print-btn.printing {
      background: #6b7280;
    }

    .print-btn svg {
      width: 1.5rem;
      height: 1.5rem;
    }

    .spinner {
      width: 1.5rem;
      height: 1.5rem;
      border: 3px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @media print {
      .preview-header,
      .print-actions {
        display: none !important;
      }

      .receipt-preview-container {
        background: white;
      }

      .receipt-content {
        padding: 0;
      }

      .receipt-content pre {
        box-shadow: none;
        border-radius: 0;
        padding: 3px;
        max-width: none;
        font-size: 12px;
        line-height: 1.3;
        font-weight: 500;
      }

      @page {
        margin: 3mm;
        size: 58mm auto;
      }
    }
  `]
})
export class MobileReceiptPreviewBakComponent implements OnInit {
  receiptContent = signal<string>('');
  isPrinting = signal<boolean>(false);

  constructor(
    private router: Router,
    private location: Location
  ) {}

  ngOnInit() {
    // Get receipt data from navigation state
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras?.state || history.state;
    
    if (state && state['receiptContent']) {
      this.receiptContent.set(state['receiptContent']);
    } else {
      console.error('No receipt content found, redirecting back');
      this.goBack();
    }
  }

  goBack() {
    // Navigate back to POS mobile instead of using location.back()
    // This ensures we always go to the correct page
    this.router.navigate(['/pos/mobile']);
  }

  printReceipt() {
    this.isPrinting.set(true);
    
    try {
      // Trigger browser print dialog
      // On mobile, this will show available printers including Bluetooth
      window.print();
      
      // Reset printing state after print dialog closes
      // Use a longer timeout to ensure print dialog has time to process
      setTimeout(() => {
        this.isPrinting.set(false);
      }, 2000);
    } catch (error) {
      console.error('Print error:', error);
      alert('Failed to print receipt. Please try again.');
      this.isPrinting.set(false);
    }
  }
}
