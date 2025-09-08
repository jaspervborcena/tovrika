import { Component, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderDiscount } from '../../../interfaces/pos.interface';

@Component({
  selector: 'app-discount-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" (click)="onCancel()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>Add Order Discount</h3>
          <button type="button" class="close-btn" (click)="onCancel()">×</button>
        </div>
        
        <div class="modal-body">
          <div class="form-group">
            <label>Discount Type</label>
            <select [(ngModel)]="discountType" class="form-control">
              <option value="">Select Discount Type</option>
              <option value="PWD">PWD (Person with Disability)</option>
              <option value="SENIOR">Senior Citizen</option>
              <option value="OTHERS">Others</option>
            </select>
          </div>
          
          <div class="form-group" *ngIf="discountType() === 'OTHERS'">
            <label>Custom Discount Type</label>
            <input 
              type="text" 
              [(ngModel)]="customDiscountType" 
              class="form-control"
              placeholder="e.g., Owner, Friend, Employee, etc."
              required
            >
          </div>
          
          <div class="form-group" *ngIf="discountType()">
            <label>Discount Method</label>
            <select [(ngModel)]="discountMethod" class="form-control">
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed Amount (₱)</option>
            </select>
          </div>
          
          <div class="form-group" *ngIf="discountType() && discountMethod() === 'percentage'">
            <label>Discount Percentage</label>
            <input 
              type="number" 
              [(ngModel)]="percentage" 
              class="form-control"
              min="0"
              max="100"
              [placeholder]="getDefaultPercentage() + '%'"
            >
          </div>
          
          <div class="form-group" *ngIf="discountType() && discountMethod() === 'fixed'">
            <label>Fixed Discount Amount</label>
            <input 
              type="number" 
              [(ngModel)]="fixedAmount" 
              class="form-control"
              min="0"
              step="0.01"
              placeholder="Enter amount in ₱"
            >
          </div>
          
          <div class="form-group" *ngIf="discountType() && discountType() !== 'OTHERS'">
            <label>{{ getIdLabel() }}</label>
            <input 
              type="text" 
              [(ngModel)]="exemptionId" 
              class="form-control"
              [placeholder]="getIdPlaceholder()"
              required
            >
          </div>
          
          <div class="form-group" *ngIf="discountType()">
            <label>{{ getCustomerNameLabel() }}</label>
            <input 
              type="text" 
              [(ngModel)]="customerName" 
              class="form-control"
              [placeholder]="getCustomerNamePlaceholder()"
              required
            >
          </div>
        </div>
        
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" (click)="onCancel()">Cancel</button>
          <button 
            type="button" 
            class="btn btn-primary" 
            (click)="onApply()"
            [disabled]="!isValid()"
          >
            Apply Discount
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
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
    }
    
    .modal-content {
      background: white;
      border-radius: 8px;
      width: 90%;
      max-width: 500px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    
    .modal-header {
      padding: 1rem;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .modal-header h3 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
    }
    
    .close-btn {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      padding: 0;
      color: #6b7280;
    }
    
    .close-btn:hover {
      color: #374151;
    }
    
    .modal-body {
      padding: 1rem;
    }
    
    .form-group {
      margin-bottom: 1rem;
    }
    
    .form-group label {
      display: block;
      margin-bottom: 0.25rem;
      font-weight: 500;
      color: #374151;
    }
    
    .form-control {
      width: 100%;
      padding: 0.5rem;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      font-size: 0.875rem;
    }
    
    .form-control:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }
    
    .modal-footer {
      padding: 1rem;
      border-top: 1px solid #e5e7eb;
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }
    
    .btn {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 4px;
      font-size: 0.875rem;
      cursor: pointer;
    }
    
    .btn-secondary {
      background: #6b7280;
      color: white;
    }
    
    .btn-secondary:hover {
      background: #4b5563;
    }
    
    .btn-primary {
      background: #3b82f6;
      color: white;
    }
    
    .btn-primary:hover {
      background: #2563eb;
    }
    
    .btn:disabled {
      background: #d1d5db;
      color: #9ca3af;
      cursor: not-allowed;
    }
  `]
})
export class DiscountModalComponent {
  discountType = signal<string>('');
  discountMethod = signal<string>('percentage');
  percentage = signal<number>(0);
  fixedAmount = signal<number>(0);
  exemptionId = signal<string>('');
  customerName = signal<string>('');
  customDiscountType = signal<string>('');

  // Outputs
  discountApplied = output<OrderDiscount>();
  modalClosed = output<void>();

  getDefaultPercentage(): number {
    const type = this.discountType();
    if (type === 'PWD') return 20; // 20% PWD discount
    if (type === 'SENIOR') return 20; // 20% Senior discount
    if (type === 'OTHERS') return 10; // 10% Others discount (customizable)
    return 0;
  }

  getIdLabel(): string {
    const type = this.discountType();
    if (type === 'PWD') return 'PWD ID Number';
    if (type === 'SENIOR') return 'Senior Citizen ID Number';
    return 'ID Number';
  }

  getIdPlaceholder(): string {
    const type = this.discountType();
    const year = new Date().getFullYear();
    if (type === 'PWD') return `PWD-ID-${year}-XXXXXX`;
    if (type === 'SENIOR') return `SENIOR-ID-${year}-XXXXXX`;
    return 'Enter ID number';
  }

  getCustomerNameLabel(): string {
    const type = this.discountType();
    if (type === 'OTHERS') return 'Customer/Person Name';
    return 'Customer Name';
  }

  getCustomerNamePlaceholder(): string {
    const type = this.discountType();
    if (type === 'OTHERS') return 'Enter customer or person name';
    return 'Enter customer name';
  }

  isValid(): boolean {
    const type = this.discountType();
    const method = this.discountMethod();
    const hasValidType = !!type;
    const hasValidAmount = method === 'percentage' 
      ? (this.percentage() > 0 || this.getDefaultPercentage() > 0)
      : this.fixedAmount() > 0;
    const hasValidCustomerName = !!this.customerName().trim();
    
    if (type === 'OTHERS') {
      const hasValidCustomDiscountType = !!this.customDiscountType().trim();
      return hasValidType && hasValidAmount && hasValidCustomerName && hasValidCustomDiscountType;
    } else {
      const hasValidExemptionId = !!this.exemptionId().trim();
      return hasValidType && hasValidAmount && hasValidCustomerName && hasValidExemptionId;
    }
  }

  onApply(): void {
    if (!this.isValid()) return;

    const type = this.discountType();
    const method = this.discountMethod();
    const discount: OrderDiscount = {
      type: type as 'PWD' | 'SENIOR' | 'CUSTOM',
      percentage: method === 'percentage' ? (this.percentage() || this.getDefaultPercentage()) : undefined,
      fixedAmount: method === 'fixed' ? this.fixedAmount() : undefined,
      exemptionId: type === 'OTHERS' ? `CUSTOM-${Date.now()}` : this.exemptionId(),
      customerName: this.customerName(),
      customType: type === 'OTHERS' ? this.customDiscountType() : undefined
    };

    this.discountApplied.emit(discount);
  }

  onCancel(): void {
    this.modalClosed.emit();
  }
}
