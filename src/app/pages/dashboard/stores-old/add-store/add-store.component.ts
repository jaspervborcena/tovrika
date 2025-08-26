import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { StoreService } from '../../../../services/store.service';
import { CompanySetupService } from '../../../../services/companySetup.service';

@Component({
  selector: 'app-add-store',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="add-store-container">
      <!-- Page Header -->
      <div class="page-header">
        <div class="header-content">
          <div class="header-left">
            <button 
              (click)="goBack()" 
              class="back-btn">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
              Back to Stores
            </button>
            <div class="header-text">
              <h1 class="page-title">Add New Store</h1>
              <p class="page-subtitle">Create a new store location for your business</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Store Form -->
      <div class="form-container">
        <div class="form-card">
          <div class="form-header">
            <h2 class="form-title">Store Information</h2>
            <p class="form-subtitle">Enter the details for your new store location</p>
          </div>

          <form [formGroup]="storeForm" (ngSubmit)="onSubmit()" class="store-form">
            <!-- Store Name -->
            <div class="form-group">
              <label for="storeName" class="form-label">Store Name *</label>
              <input 
                id="storeName"
                type="text" 
                formControlName="storeName"
                class="form-input"
                placeholder="Enter store name"
                [class.error]="storeForm.get('storeName')?.invalid && storeForm.get('storeName')?.touched">
              <div class="error-message" *ngIf="storeForm.get('storeName')?.invalid && storeForm.get('storeName')?.touched">
                Store name is required
              </div>
            </div>

            <!-- Store Code -->
            <div class="form-group">
              <label for="storeCode" class="form-label">Store Code *</label>
              <input 
                id="storeCode"
                type="text" 
                formControlName="storeCode"
                class="form-input"
                placeholder="e.g., MAIN-01, BRANCH-02"
                [class.error]="storeForm.get('storeCode')?.invalid && storeForm.get('storeCode')?.touched">
              <div class="error-message" *ngIf="storeForm.get('storeCode')?.invalid && storeForm.get('storeCode')?.touched">
                Store code is required
              </div>
            </div>

            <!-- Store Type -->
            <div class="form-group">
              <label for="storeType" class="form-label">Store Type *</label>
              <select 
                id="storeType"
                formControlName="storeType" 
                class="form-select"
                [class.error]="storeForm.get('storeType')?.invalid && storeForm.get('storeType')?.touched">
                <option value="">Select Store Type</option>
                <option value="Convenience Store">Convenience Store</option>
                <option value="Department Store">Department Store</option>
                <option value="Grocery Store">Grocery Store</option>
                <option value="Supermarket">Supermarket</option>
                <option value="Electronics Store">Electronics Store</option>
                <option value="Clothing Store">Clothing Store</option>
                <option value="Restaurant">Restaurant</option>
                <option value="Cafe">Cafe</option>
                <option value="Pharmacy">Pharmacy</option>
                <option value="Hardware Store">Hardware Store</option>
                <option value="Book Store">Book Store</option>
                <option value="Other">Other</option>
              </select>
              <div class="error-message" *ngIf="storeForm.get('storeType')?.invalid && storeForm.get('storeType')?.touched">
                Store type is required
              </div>
            </div>

            <!-- Address -->
            <div class="form-group">
              <label for="address" class="form-label">Address *</label>
              <textarea 
                id="address"
                formControlName="address"
                class="form-textarea"
                placeholder="Enter store address"
                rows="3"
                [class.error]="storeForm.get('address')?.invalid && storeForm.get('address')?.touched"></textarea>
              <div class="error-message" *ngIf="storeForm.get('address')?.invalid && storeForm.get('address')?.touched">
                Address is required
              </div>
            </div>

            <!-- Phone Number -->
            <div class="form-group">
              <label for="phoneNumber" class="form-label">Phone Number</label>
              <input 
                id="phoneNumber"
                type="tel" 
                formControlName="phoneNumber"
                class="form-input"
                placeholder="Enter phone number">
            </div>

            <!-- Email -->
            <div class="form-group">
              <label for="email" class="form-label">Email</label>
              <input 
                id="email"
                type="email" 
                formControlName="email"
                class="form-input"
                placeholder="Enter email address"
                [class.error]="storeForm.get('email')?.invalid && storeForm.get('email')?.touched">
              <div class="error-message" *ngIf="storeForm.get('email')?.invalid && storeForm.get('email')?.touched">
                Please enter a valid email address
              </div>
            </div>

            <!-- Manager Name -->
            <div class="form-group">
              <label for="managerName" class="form-label">Manager Name</label>
              <input 
                id="managerName"
                type="text" 
                formControlName="managerName"
                class="form-input"
                placeholder="Enter manager name">
            </div>

            <!-- Status -->
            <div class="form-group">
              <label for="status" class="form-label">Status</label>
              <select formControlName="status" class="form-select">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <!-- Form Actions -->
            <div class="form-actions">
              <button 
                type="button" 
                (click)="goBack()" 
                class="btn btn-secondary">
                Cancel
              </button>
              <button 
                type="submit" 
                [disabled]="storeForm.invalid || isLoading"
                class="btn btn-primary">
                <span *ngIf="isLoading" class="loading-spinner"></span>
                {{ isLoading ? 'Creating Store...' : 'Create Store' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .add-store-container {
      min-height: 100%;
      background: #f8fafc;
    }

    .page-header {
      background: white;
      border-bottom: 1px solid #e2e8f0;
      padding: 2rem 0;
    }

    .header-content {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 2rem;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 1.5rem;
    }

    .back-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      color: #64748b;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .back-btn:hover {
      background: #e2e8f0;
      color: #475569;
    }

    .back-btn svg {
      width: 1rem;
      height: 1rem;
    }

    .header-text {
      flex: 1;
    }

    .page-title {
      font-size: 1.875rem;
      font-weight: 700;
      color: #1e293b;
      margin: 0 0 0.5rem 0;
    }

    .page-subtitle {
      color: #64748b;
      font-size: 1rem;
      margin: 0;
    }

    .form-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
    }

    .form-card {
      background: white;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }

    .form-header {
      padding: 1.5rem 2rem;
      border-bottom: 1px solid #e2e8f0;
      background: #f8fafc;
    }

    .form-title {
      font-size: 1.25rem;
      font-weight: 700;
      color: #1e293b;
      margin: 0 0 0.5rem 0;
    }

    .form-subtitle {
      color: #64748b;
      font-size: 0.875rem;
      margin: 0;
    }

    .store-form {
      padding: 2rem;
    }

    .form-group {
      margin-bottom: 1.5rem;
    }

    .form-label {
      display: block;
      font-size: 0.875rem;
      font-weight: 600;
      color: #374151;
      margin-bottom: 0.5rem;
    }

    .form-input, .form-textarea, .form-select {
      width: 100%;
      padding: 0.75rem 1rem;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 0.875rem;
      color: #374151;
      background: white;
      transition: all 0.2s ease;
    }

    .form-input:focus, .form-textarea:focus, .form-select:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .form-input.error, .form-textarea.error {
      border-color: #ef4444;
    }

    .form-textarea {
      resize: vertical;
      min-height: 80px;
    }

    .error-message {
      color: #ef4444;
      font-size: 0.75rem;
      margin-top: 0.25rem;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 1rem;
      margin-top: 2rem;
      padding-top: 1.5rem;
      border-top: 1px solid #e2e8f0;
    }

    .btn {
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      border: none;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .btn-secondary {
      background: #f1f5f9;
      color: #64748b;
      border: 1px solid #e2e8f0;
    }

    .btn-secondary:hover {
      background: #e2e8f0;
    }

    .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: linear-gradient(135deg, #5a6fd8 0%, #6b4190 100%);
      transform: translateY(-1px);
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }

    .loading-spinner {
      width: 1rem;
      height: 1rem;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top: 2px solid white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @media (max-width: 768px) {
      .header-content {
        padding: 0 1rem;
      }

      .header-left {
        gap: 1rem;
      }

      .page-title {
        font-size: 1.5rem;
      }

      .form-container {
        padding: 1rem;
      }

      .store-form {
        padding: 1.5rem;
      }

      .form-actions {
        flex-direction: column;
      }
    }
  `]
})
export class AddStoreComponent implements OnInit {
  storeForm: FormGroup;
  isLoading = false;
  companyId: string | null = null;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private storeService: StoreService,
    private companySetupService: CompanySetupService
  ) {
    this.storeForm = this.fb.group({
      storeName: ['', Validators.required],
      storeCode: ['', Validators.required],
      storeType: ['', Validators.required],
      address: ['', Validators.required],
      phoneNumber: [''],
      email: ['', Validators.email],
      managerName: [''],
      status: ['active']
    });
  }

  ngOnInit(): void {
    // Get company ID from company setup service or local storage
    this.loadCompanyId();
  }

  private loadCompanyId(): void {
    // Try to get company ID from the company setup service
    const companies = this.companySetupService.companies();
    if (companies && companies.length > 0) {
      this.companyId = companies[0].id || null;
    } else {
      // Fallback: try to get from localStorage if company was set up
      const storedCompany = localStorage.getItem('companyProfile');
      if (storedCompany) {
        const company = JSON.parse(storedCompany);
        this.companyId = company.id;
      }
    }
  }

  onSubmit(): void {
    if (this.storeForm.valid && this.companyId) {
      this.isLoading = true;
      
      const storeData = {
        name: this.storeForm.value.storeName,
        address: {
          street: this.storeForm.value.address,
          city: '',
          state: '',
          zipCode: '',
          country: ''
        },
        phone: this.storeForm.value.phoneNumber || '',
        email: this.storeForm.value.email || '',
        companyId: this.companyId,
        status: this.storeForm.value.status as 'active' | 'inactive',
        // Additional fields for our custom implementation
        storeCode: this.storeForm.value.storeCode,
        storeType: this.storeForm.value.storeType,
        managerName: this.storeForm.value.managerName || ''
      };

      // Call the store service to create the store
      this.storeService.createStore(storeData as any).then(() => {
        this.isLoading = false;
        // Cache the store data for immediate use
        this.cacheStoreData(storeData);
        this.router.navigate(['/dashboard/stores']);
      }).catch(error => {
        console.error('Error creating store:', error);
        this.isLoading = false;
        // You might want to show an error message to the user here
      });
    } else if (!this.companyId) {
      console.error('Company ID is required to create a store');
      // Redirect to company profile if no company ID
      this.router.navigate(['/dashboard/company-profile']);
    }
  }

  private cacheStoreData(storeData: any): void {
    // Cache the store data in localStorage for immediate access
    const existingStores = JSON.parse(localStorage.getItem('userStores') || '[]');
    existingStores.push({
      id: Date.now().toString(), // Temporary ID until we get the real one from Firebase
      ...storeData
    });
    localStorage.setItem('userStores', JSON.stringify(existingStores));
  }

  goBack(): void {
    this.router.navigate(['/dashboard/stores']);
  }
}
