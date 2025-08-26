import { Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CompanyService } from '../../../services/company.service';
import { Company } from '../../../interfaces/company.interface';

@Component({
  selector: 'app-company-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="company-profile-container">
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
              Back to Dashboard
            </button>
            <div class="header-text">
              <h1 class="page-title">Company Profile</h1>
              <p class="page-subtitle">Configure your company information and settings</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Error Message -->
      <div class="form-container" *ngIf="error()">
        <div class="error-alert">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {{ error() }}
        </div>
      </div>

      <!-- Success Message -->
      <div class="form-container" *ngIf="showSuccessMessage()">
        <div class="success-alert">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Company profile updated successfully!
        </div>
      </div>

      <!-- Company Form -->
      <div class="form-container">
        <div class="form-card">
          <div class="form-header">
            <h2 class="form-title">Company Information</h2>
            <p class="form-subtitle">Enter your company details and business information</p>
          </div>

          <form [formGroup]="profileForm" (ngSubmit)="onSubmit()" class="company-form">
            <!-- Company Name -->
            <div class="form-group">
              <label for="name" class="form-label">Company Name *</label>
              <input 
                id="name"
                type="text" 
                formControlName="name"
                class="form-input"
                placeholder="Enter company name"
                [disabled]="loading()"
                [class.error]="profileForm.get('name')?.invalid && profileForm.get('name')?.touched">
              <div class="error-message" *ngIf="profileForm.get('name')?.invalid && profileForm.get('name')?.touched">
                Company name is required
              </div>
            </div>

            <!-- Email -->
            <div class="form-group">
              <label for="email" class="form-label">Company Email</label>
              <input 
                id="email"
                type="email" 
                formControlName="email"
                class="form-input"
                placeholder="Enter company email"
                [disabled]="loading()"
                [class.error]="profileForm.get('email')?.invalid && profileForm.get('email')?.touched">
              <div class="error-message" *ngIf="profileForm.get('email')?.invalid && profileForm.get('email')?.touched">
                Please enter a valid email address
              </div>
            </div>

            <!-- Phone -->
            <div class="form-group">
              <label for="phone" class="form-label">Phone Number</label>
              <input 
                id="phone"
                type="tel" 
                formControlName="phone"
                class="form-input"
                placeholder="Enter phone number"
                [disabled]="loading()">
            </div>

            <!-- Address -->
            <div class="form-group">
              <label for="address" class="form-label">Address</label>
              <textarea 
                id="address"
                formControlName="address"
                class="form-textarea"
                placeholder="Enter company address"
                rows="3"
                [disabled]="loading()"></textarea>
            </div>

            <!-- Logo URL -->
            <div class="form-group">
              <label for="logoUrl" class="form-label">Logo URL</label>
              <input 
                id="logoUrl"
                type="url" 
                formControlName="logoUrl"
                class="form-input"
                placeholder="Enter logo URL"
                [disabled]="loading()">
            </div>

            <!-- Tax ID -->
            <div class="form-group">
              <label for="taxId" class="form-label">Tax ID</label>
              <input 
                id="taxId"
                type="text" 
                formControlName="taxId"
                class="form-input"
                placeholder="Enter tax identification number"
                [disabled]="loading()">
            </div>

            <!-- Website -->
            <div class="form-group">
              <label for="website" class="form-label">Website</label>
              <input 
                id="website"
                type="url" 
                formControlName="website"
                class="form-input"
                placeholder="Enter company website"
                [disabled]="loading()">
            </div>

            <!-- Form Actions -->
            <div class="form-actions">
              <button 
                type="button" 
                (click)="resetForm()" 
                [disabled]="loading()"
                class="btn btn-secondary">
                Reset Form
              </button>
              <button 
                type="submit" 
                [disabled]="loading() || profileForm.invalid"
                class="btn btn-primary">
                <span *ngIf="loading()" class="loading-spinner"></span>
                {{ loading() ? 'Saving Changes...' : 'Save Company Profile' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .company-profile-container {
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

    .error-alert, .success-alert {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 500;
      margin-bottom: 1rem;
    }

    .error-alert {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #dc2626;
    }

    .success-alert {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      color: #16a34a;
    }

    .error-alert svg, .success-alert svg {
      width: 1.25rem;
      height: 1.25rem;
      flex-shrink: 0;
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

    .company-form {
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

    .form-input, .form-textarea {
      width: 100%;
      padding: 0.75rem 1rem;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 0.875rem;
      color: #374151;
      background: white;
      transition: all 0.2s ease;
    }

    .form-input:focus, .form-textarea:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .form-input:disabled, .form-textarea:disabled {
      background: #f9fafb;
      color: #9ca3af;
      cursor: not-allowed;
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

    .btn-secondary:hover:not(:disabled) {
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

      .company-form {
        padding: 1.5rem;
      }

      .form-actions {
        flex-direction: column;
      }
    }
  `]
})
export class CompanyProfileComponent {
  private fb = inject(FormBuilder);
  private companyService = inject(CompanyService);
  private router = inject(Router);

  protected profileForm: FormGroup;
  protected loading = signal(false);
  protected error = signal<string | null>(null);
  protected showSuccessMessage = signal(false);

  // Computed value for the current company
  protected currentCompany = computed(() => this.companyService.companies()[0]);

  constructor() {
    this.profileForm = this.fb.group({
      name: ['', Validators.required],
      logoUrl: [''],
      phone: [''],
      address: [''],
      email: ['', [Validators.required, Validators.email]],
      taxId: [''],
      website: ['']
    });

    // Load companies and set up form subscription
    this.companyService.loadCompanies();
    
    // Update form when company changes
    effect(() => {
      const company = this.currentCompany();
      if (company) {
        this.profileForm.patchValue({
          name: company.name,
          logoUrl: company.logoUrl,
          phone: company.phone,
          address: company.address,
          email: company.email,
          taxId: company.taxId,
          website: company.website
        });
      }
    });
  }

  protected async onSubmit() {
    if (this.profileForm.valid) {
      try {
        this.loading.set(true);
        this.error.set(null);
        this.showSuccessMessage.set(false);
        
        const company = this.currentCompany();
        if (company) {
          // Prepare the update data to match Company interface
          const updateData: Partial<Company> = {
            name: this.profileForm.value.name,
            logoUrl: this.profileForm.value.logoUrl,
            email: this.profileForm.value.email,
            phone: this.profileForm.value.phone,
            address: this.profileForm.value.address,
            taxId: this.profileForm.value.taxId,
            website: this.profileForm.value.website,
            updatedAt: new Date()
          };

          await this.companyService.updateCompany(company.id!, updateData);
          
          // Show success message
          this.showSuccessMessage.set(true);
          
          // Hide success message after 3 seconds
          setTimeout(() => {
            this.showSuccessMessage.set(false);
          }, 3000);
          
          // Reload companies to refresh the view
          await this.companyService.loadCompanies();
        }
      } catch (error) {
        this.error.set('Failed to update company profile');
        console.error('Error updating company profile:', error);
      } finally {
        this.loading.set(false);
      }
    }
  }

  protected resetForm() {
    const company = this.currentCompany();
    if (company) {
      this.profileForm.patchValue({
        name: company.name,
        logoUrl: company.logoUrl,
        phone: company.phone,
        address: company.address,
        email: company.email,
        taxId: company.taxId,
        website: company.website
      });
    }
  }

  protected goBack(): void {
    this.router.navigate(['/dashboard/overview']);
  }
}
