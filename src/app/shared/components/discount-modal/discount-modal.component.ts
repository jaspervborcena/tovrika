import { Component, signal, output, computed } from '@angular/core';
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
            <select [ngModel]="discountTypeValue()" (ngModelChange)="setDiscountTypeValue($event)" class="form-control">
              <option value="">Select Discount Type</option>
              <option value="PWD">PWD (Person with Disability)</option>
              <option value="SENIOR">Senior Citizen</option>
              <option value="CUSTOM">Others (Custom Discount)</option>
            </select>
          </div>
          
          <!-- Custom discount type field -->
          <div class="form-group" *ngIf="discountTypeValue() === 'CUSTOM'">
            <label>Custom Discount Name</label>
            <input 
              type="text" 
              [ngModel]="customTypeValue()" 
              (ngModelChange)="setCustomTypeValue($event)" 
              class="form-control"
              placeholder="e.g., Owner, Employee, VIP, Promotion"
              required
            >
          </div>
          
          <!-- Discount method selection -->
          <div class="form-group" *ngIf="discountTypeValue()">
            <label>Discount Method</label>
            <div class="radio-group">
              <label class="radio-option">
                <input 
                  type="radio" 
                  [ngModel]="discountMethod()" 
                  (ngModelChange)="setDiscountMethod($event)"
                  value="percentage"
                  name="discountMethod"
                >
                <span>Percentage (%)</span>
              </label>
              <label class="radio-option">
                <input 
                  type="radio" 
                  [ngModel]="discountMethod()" 
                  (ngModelChange)="setDiscountMethod($event)"
                  value="fixed"
                  name="discountMethod"
                >
                <span>Fixed Amount (₱)</span>
              </label>
            </div>
          </div>
          
          <!-- Percentage input -->
          <div class="form-group" *ngIf="discountTypeValue() && discountMethod() === 'percentage'">
            <label>Discount Percentage</label>
            <div class="input-with-unit">
              <input 
                type="number" 
                [ngModel]="percentageValue()" 
                (ngModelChange)="setPercentageValue($event)" 
                class="form-control"
                min="0"
                max="100"
                step="0.01"
                [placeholder]="getDefaultPercentage().toString()"
              >
              <span class="input-unit">%</span>
            </div>
            <small class="form-hint">Default: {{ getDefaultPercentage() }}% for {{ getDiscountTypeDisplay() }}</small>
          </div>
          
          <!-- Fixed amount input -->
          <div class="form-group" *ngIf="discountTypeValue() && discountMethod() === 'fixed'">
            <label>Discount Amount</label>
            <div class="input-with-unit">
              <span class="input-unit-prefix">₱</span>
              <input 
                type="number" 
                [ngModel]="fixedAmountValue()" 
                (ngModelChange)="setFixedAmountValue($event)" 
                class="form-control"
                min="0"
                step="0.01"
                placeholder="0.00"
              >
            </div>
          </div>
          
          <div class="form-group" *ngIf="discountTypeValue()">
            <label>{{ getIdLabel() }}</label>
            <input 
              type="text" 
              [ngModel]="exemptionIdValue()" 
              (ngModelChange)="setExemptionIdValue($event)" 
              class="form-control"
              [placeholder]="getIdPlaceholder()"
              required
            >
          </div>
          
          <div class="form-group" *ngIf="discountTypeValue()">
            <label>Customer Name</label>
            <input 
              type="text" 
              [ngModel]="customerNameValue()" 
              (ngModelChange)="setCustomerNameValue($event)" 
              class="form-control"
              placeholder="Enter customer name"
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
    
    .radio-group {
      display: flex;
      gap: 1rem;
      margin-top: 0.25rem;
    }
    
    .radio-option {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
      font-weight: normal;
    }
    
    .radio-option input[type="radio"] {
      margin: 0;
    }
    
    .input-with-unit {
      position: relative;
      display: flex;
      align-items: center;
    }
    
    .input-unit {
      position: absolute;
      right: 0.75rem;
      color: #6b7280;
      font-weight: 500;
      pointer-events: none;
    }
    
    .input-unit-prefix {
      position: absolute;
      left: 0.75rem;
      color: #6b7280;
      font-weight: 500;
      pointer-events: none;
      z-index: 1;
    }
    
    .input-with-unit .form-control {
      padding-right: 2rem;
    }
    
    .input-with-unit .form-control:has(+ .input-unit-prefix) {
      padding-left: 2rem;
    }
    
    .form-hint {
      color: #6b7280;
      font-size: 0.75rem;
      margin-top: 0.25rem;
      display: block;
    }
  `]
})
export class DiscountModalComponent {
  // Form state signals
  private discountTypeSignal = signal<string>('');
  private customTypeSignal = signal<string>('');
  private discountMethodSignal = signal<'percentage' | 'fixed'>('percentage');
  private percentageSignal = signal<number>(0);
  private fixedAmountSignal = signal<number>(0);
  private exemptionIdSignal = signal<string>('');
  private customerNameSignal = signal<string>('');

  // Computed properties for template access
  readonly discountTypeValue = computed(() => this.discountTypeSignal());
  readonly customTypeValue = computed(() => this.customTypeSignal());
  readonly discountMethod = computed(() => this.discountMethodSignal());
  readonly percentageValue = computed(() => this.percentageSignal());
  readonly fixedAmountValue = computed(() => this.fixedAmountSignal());
  readonly exemptionIdValue = computed(() => this.exemptionIdSignal());
  readonly customerNameValue = computed(() => this.customerNameSignal());

  // Legacy signals for backward compatibility (will be removed)
  discountType = signal<string>('');
  percentage = signal<number>(0);
  exemptionId = signal<string>('');
  customerName = signal<string>('');

  // Outputs
  discountApplied = output<OrderDiscount>();
  modalClosed = output<void>();
  // Live emit customer info as the user types (exemptionId, customerName, discountType)
  liveCustomerChange = output<{ exemptionId: string; customerName: string; discountType: string }>();

  // Setters for template two-way binding
  setDiscountTypeValue(value: string): void {
    this.discountTypeSignal.set(value);
    this.onDiscountTypeChange(value);
  }

  setCustomTypeValue(value: string): void {
    this.customTypeSignal.set(value);
  }

  setDiscountMethod(value: 'percentage' | 'fixed'): void {
    this.discountMethodSignal.set(value);
  }

  setPercentageValue(value: number): void {
    this.percentageSignal.set(value);
  }

  setFixedAmountValue(value: number): void {
    this.fixedAmountSignal.set(value);
  }

  setExemptionIdValue(value: string): void {
    this.exemptionIdSignal.set(value);
    this.emitLiveCustomerChange();
  }

  setCustomerNameValue(value: string): void {
    this.customerNameSignal.set(value);
    this.emitLiveCustomerChange();
  }

  private emitLiveCustomerChange(): void {
    try {
      this.liveCustomerChange.emit({
        exemptionId: this.exemptionIdValue() || '',
        customerName: this.customerNameValue() || '',
        discountType: this.discountTypeValue() || ''
      });
    } catch (err) {
      console.warn('Failed to emit live customer change:', err);
    }
  }

  onDiscountTypeChange(value: string): void {
    this.discountTypeSignal.set(value);
    
    // Reset method to percentage when changing discount type
    this.discountMethodSignal.set('percentage');
    
    // Set default percentage for PWD/SENIOR
    if (value === 'PWD' || value === 'SENIOR') {
      this.percentageSignal.set(this.getDefaultPercentage());
    } else {
      this.percentageSignal.set(0);
    }
    
    // Clear custom type when not custom
    if (value !== 'CUSTOM') {
      this.customTypeSignal.set('');
    }
  }

  getDefaultPercentage(): number {
    const type = this.discountTypeValue();
    if (type === 'PWD') return 20; // 20% PWD discount
    if (type === 'SENIOR') return 20; // 20% Senior discount
    return 0;
  }

  getDiscountTypeDisplay(): string {
    const type = this.discountTypeValue();
    if (type === 'PWD') return 'PWD';
    if (type === 'SENIOR') return 'Senior Citizen';
    if (type === 'CUSTOM') return this.customTypeValue() || 'Custom';
    return '';
  }

  getIdLabel(): string {
    const type = this.discountTypeValue();
    if (type === 'PWD') return 'PWD ID Number';
    if (type === 'SENIOR') return 'Senior Citizen ID Number';
    if (type === 'CUSTOM') return 'Reference ID/Number';
    return 'ID Number';
  }

  getIdPlaceholder(): string {
    const type = this.discountTypeValue();
    const year = new Date().getFullYear();
    if (type === 'PWD') return `PWD-ID-${year}-XXXXXX`;
    if (type === 'SENIOR') return `SENIOR-ID-${year}-XXXXXX`;
    if (type === 'CUSTOM') return 'Enter reference ID or number';
    return 'Enter ID number';
  }

  isValid(): boolean {
    const hasDiscountType = !!this.discountTypeValue();
    const hasExemptionId = !!this.exemptionIdValue().trim();
    const hasCustomerName = !!this.customerNameValue().trim();
    const hasCustomType = this.discountTypeValue() !== 'CUSTOM' || !!this.customTypeValue().trim();
    
    let hasValidDiscount = false;
    if (this.discountMethod() === 'percentage') {
      hasValidDiscount = this.percentageValue() > 0 || this.getDefaultPercentage() > 0;
    } else if (this.discountMethod() === 'fixed') {
      hasValidDiscount = this.fixedAmountValue() > 0;
    }
    
    return hasDiscountType && hasExemptionId && hasCustomerName && hasCustomType && hasValidDiscount;
  }

  onApply(): void {
    if (!this.isValid()) return;

    const discount: OrderDiscount = {
      type: this.discountTypeValue() as 'PWD' | 'SENIOR' | 'CUSTOM',
      exemptionId: this.exemptionIdValue(),
      customerName: this.customerNameValue()
    };

    // Add percentage or fixed amount based on method
    if (this.discountMethod() === 'percentage') {
      discount.percentage = this.percentageValue() || this.getDefaultPercentage();
    } else {
      discount.fixedAmount = this.fixedAmountValue();
    }

    // Add custom type for CUSTOM discounts
    if (this.discountTypeValue() === 'CUSTOM') {
      discount.customType = this.customTypeValue();
    }

    this.discountApplied.emit(discount);
  }

  onCancel(): void {
    this.modalClosed.emit();
  }
}
