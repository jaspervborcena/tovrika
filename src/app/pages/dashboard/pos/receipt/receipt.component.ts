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

  // Helper method to format quantity with unit type
  formatQuantityWithUnit(quantity: number, unitType?: string): string {
    if (!unitType || unitType === 'N/A') {
      return quantity.toString();
    }
    
    const unitDisplay = unitType === 'pieces' ? 'pc(s)' : unitType;
    return `${quantity} ${unitDisplay}`;
  }

  // Get customer display name with fallback to discount customer name
  getCustomerDisplayName(): string {
    // First check if we have a customer name from sold-to
    if (this.receiptData?.customerName && 
        this.receiptData.customerName !== 'N/A' && 
        this.receiptData.customerName !== 'Walk-in Customer') {
      return this.receiptData.customerName;
    }
    
    // Fallback to discount customer name if available
    if (this.receiptData?.orderDiscount?.customerName) {
      return this.receiptData.orderDiscount.customerName;
    }
    
    // Default fallback
    return 'Walk-in Customer';
  }

  // Check if we have customer details to show (address/TIN)
  hasCustomerDetails(): boolean {
    const customerName = this.getCustomerDisplayName();
    
    // Only show details if we have a real customer name (not Walk-in Customer) and either address or TIN
    return customerName !== 'Walk-in Customer' && 
           ((this.receiptData?.customerAddress && this.receiptData.customerAddress !== 'N/A') ||
            (this.receiptData?.customerTin && this.receiptData.customerTin !== 'N/A'));
  }
}
