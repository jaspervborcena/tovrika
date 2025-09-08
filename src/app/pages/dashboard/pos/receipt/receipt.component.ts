import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-receipt',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './receipt.component.html',
  styleUrls: ['./receipt.component.css']
})
export class ReceiptComponent implements OnInit {
  @Input() isVisible: boolean = false;
  @Input() receiptData: any = null;
  @Output() closeModal = new EventEmitter<void>();
  @Output() printReceipt = new EventEmitter<string>(); // Pass printer type

  selectedPrinterType: 'thermal' | 'network' | 'browser' = 'thermal';
  isPrinting: boolean = false;

  ngOnInit() {
    console.log('Receipt Data:', this.receiptData);
  }

  onCloseModal() {
    this.closeModal.emit();
  }

  onPrintReceipt() {
    if (this.isPrinting) return; // Prevent double-clicking
    
    this.isPrinting = true;
    this.printReceipt.emit(this.selectedPrinterType);
    
    // Reset printing state after a delay (will be reset when modal closes anyway)
    setTimeout(() => {
      this.isPrinting = false;
    }, 3000);
  }

  // Prevent modal from closing when clicking inside
  onModalContentClick(event: Event) {
    event.stopPropagation();
  }
}
