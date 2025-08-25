import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Firestore, doc, setDoc, getDoc } from '@angular/fire/firestore';
import { AuthService } from '../../../app/core/services/auth.service';

export interface CompanyProfile {
  id: string;
  companyName: string;
  email: string;
  phone: string;
  address: string;
  taxId: string;
  website: string;
  logo: string;
  createdAt: Date;
  updatedAt: Date;
}

@Component({
  selector: 'app-company-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="company-profile-container">
      <!-- Header -->
      <div class="profile-header">
        <div class="header-content">
          <button class="back-btn" (click)="goBack()">
            <i class="fas fa-arrow-left"></i> Back to Dashboard
          </button>
          <h1>Company Profile</h1>
          <p>Manage your company information and settings</p>
        </div>
        
        <!-- User Menu -->
        <div class="user-menu" [class.active]="isDropdownOpen" (click)="toggleDropdown($event)">
          <div class="user-avatar">
            <i class="fas fa-user"></i>
          </div>
          <span class="user-email">{{ userEmail }}</span>
          <i class="fas fa-chevron-down"></i>
          
          <div class="dropdown-menu" *ngIf="isDropdownOpen">
            <a class="dropdown-item" (click)="navigateHome()">
              <i class="fas fa-home"></i> Home
            </a>
            <a class="dropdown-item" (click)="viewProfile()">
              <i class="fas fa-user-circle"></i> Profile
            </a>
            <div class="dropdown-divider"></div>
            <a class="dropdown-item" (click)="signOut()">
              <i class="fas fa-sign-out-alt"></i> Sign Out
            </a>
          </div>
        </div>
      </div>

      <!-- Profile Form -->
      <div class="profile-content">
        <form [formGroup]="profileForm" (ngSubmit)="onSubmit()" class="profile-form">
          <div class="form-section">
            <h2>Company Information</h2>
            
            <div class="form-group">
              <label for="companyName">Company Name *</label>
              <input 
                id="companyName"
                type="text" 
                formControlName="companyName"
                class="form-control"
                [class.error]="isFieldInvalid('companyName')"
                placeholder="Enter company name"
              >
              <div *ngIf="isFieldInvalid('companyName')" class="error-message">
                Company name is required
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="email">Email Address *</label>
                <input 
                  id="email"
                  type="email" 
                  formControlName="email"
                  class="form-control"
                  [class.error]="isFieldInvalid('email')"
                  placeholder="company@example.com"
                >
                <div *ngIf="isFieldInvalid('email')" class="error-message">
                  <span *ngIf="profileForm.get('email')?.errors?.['required']">Email is required</span>
                  <span *ngIf="profileForm.get('email')?.errors?.['email']">Please enter a valid email</span>
                </div>
              </div>

              <div class="form-group">
                <label for="phone">Phone Number</label>
                <input 
                  id="phone"
                  type="tel" 
                  formControlName="phone"
                  class="form-control"
                  placeholder="+1 (555) 123-4567"
                >
              </div>
            </div>

            <div class="form-group">
              <label for="address">Business Address</label>
              <textarea 
                id="address"
                formControlName="address"
                class="form-control textarea"
                rows="3"
                placeholder="Enter your business address"
              ></textarea>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="taxId">Tax ID / EIN</label>
                <input 
                  id="taxId"
                  type="text" 
                  formControlName="taxId"
                  class="form-control"
                  placeholder="XX-XXXXXXX"
                >
              </div>

              <div class="form-group">
                <label for="website">Website</label>
                <input 
                  id="website"
                  type="url" 
                  formControlName="website"
                  class="form-control"
                  placeholder="https://www.example.com"
                >
              </div>
            </div>

            <div class="form-group">
              <label for="logo">Company Logo URL</label>
              <input 
                id="logo"
                type="url" 
                formControlName="logo"
                class="form-control"
                placeholder="https://www.example.com/logo.png"
              >
              <small class="form-hint">Recommended size: 200x200px, PNG or JPG format</small>
            </div>
          </div>

          <!-- Form Actions -->
          <div class="form-actions">
            <button 
              type="button" 
              class="btn btn-secondary"
              (click)="resetForm()"
            >
              Reset
            </button>
            <button 
              type="submit" 
              class="btn btn-primary"
              [disabled]="isSubmitting() || profileForm.invalid"
            >
              <span *ngIf="isSubmitting()" class="loading-spinner"></span>
              {{ isSubmitting() ? 'Saving...' : 'Save Profile' }}
            </button>
          </div>
        </form>
      </div>

      <!-- Success/Error Messages -->
      <div *ngIf="successMessage()" class="alert alert-success">
        <i class="fas fa-check-circle"></i>
        {{ successMessage() }}
      </div>

      <div *ngIf="errorMessage()" class="alert alert-error">
        <i class="fas fa-exclamation-circle"></i>
        {{ errorMessage() }}
      </div>
    </div>
  `,
  styles: [`
    .company-profile-container {
      min-height: 100vh;
      background: #f8fafc;
    }

    .profile-header {
      background: white;
      border-bottom: 1px solid #e2e8f0;
      padding: 1.5rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .header-content h1 {
      margin: 0;
      font-size: 2rem;
      font-weight: 700;
      color: #1a202c;
    }

    .header-content p {
      margin: 0.5rem 0 0 0;
      color: #718096;
      font-size: 1rem;
    }

    .back-btn {
      background: none;
      border: none;
      color: #4299e1;
      font-size: 0.9rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1rem;
      padding: 0.5rem 0;
    }

    .back-btn:hover {
      color: #2b6cb0;
    }

    .user-menu {
      display: flex;
      align-items: center;
      gap: 1rem;
      cursor: pointer;
      padding: 0.75rem 1rem;
      border-radius: 0.5rem;
      position: relative;
      background: #f7fafc;
      border: 1px solid #e2e8f0;
    }

    .user-menu:hover {
      background: #edf2f7;
    }

    .user-avatar {
      width: 2.5rem;
      height: 2.5rem;
      background: #4299e1;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }

    .user-email {
      font-weight: 500;
      color: #2d3748;
    }

    .dropdown-menu {
      position: absolute;
      top: 100%;
      right: 0;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 0.5rem;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
      min-width: 200px;
      z-index: 20;
    }

    .dropdown-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      color: #4a5568;
      text-decoration: none;
      border-bottom: 1px solid #f7fafc;
    }

    .dropdown-item:hover {
      background: #f7fafc;
      color: #2d3748;
    }

    .dropdown-divider {
      height: 1px;
      background: #e2e8f0;
      margin: 0.5rem 0;
    }

    .profile-content {
      max-width: 800px;
      margin: 2rem auto;
      padding: 0 2rem;
    }

    .profile-form {
      background: white;
      border-radius: 1rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
      overflow: hidden;
    }

    .form-section {
      padding: 2rem;
    }

    .form-section h2 {
      margin: 0 0 2rem 0;
      font-size: 1.5rem;
      font-weight: 600;
      color: #2d3748;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 1rem;
    }

    .form-group {
      margin-bottom: 1.5rem;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
    }

    label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
      color: #4a5568;
      font-size: 0.9rem;
    }

    .form-control {
      width: 100%;
      padding: 0.75rem 1rem;
      border: 2px solid #e2e8f0;
      border-radius: 0.5rem;
      font-size: 1rem;
      transition: all 0.2s;
      background: white;
    }

    .form-control:focus {
      outline: none;
      border-color: #4299e1;
      box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
    }

    .form-control.error {
      border-color: #e53e3e;
    }

    .textarea {
      resize: vertical;
      min-height: 100px;
    }

    .form-hint {
      display: block;
      margin-top: 0.25rem;
      font-size: 0.8rem;
      color: #718096;
    }

    .error-message {
      color: #e53e3e;
      font-size: 0.8rem;
      margin-top: 0.25rem;
    }

    .form-actions {
      padding: 1.5rem 2rem;
      background: #f7fafc;
      display: flex;
      justify-content: flex-end;
      gap: 1rem;
      border-top: 1px solid #e2e8f0;
    }

    .btn {
      padding: 0.75rem 2rem;
      border-radius: 0.5rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .btn-primary {
      background: #4299e1;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #3182ce;
    }

    .btn-primary:disabled {
      background: #a0aec0;
      cursor: not-allowed;
    }

    .btn-secondary {
      background: #edf2f7;
      color: #4a5568;
    }

    .btn-secondary:hover {
      background: #e2e8f0;
    }

    .loading-spinner {
      width: 1rem;
      height: 1rem;
      border: 2px solid transparent;
      border-top: 2px solid currentColor;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .alert {
      position: fixed;
      top: 2rem;
      right: 2rem;
      padding: 1rem 1.5rem;
      border-radius: 0.5rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      z-index: 1000;
      animation: slideIn 0.3s ease-out;
    }

    .alert-success {
      background: #f0fff4;
      border: 1px solid #9ae6b4;
      color: #22543d;
    }

    .alert-error {
      background: #fed7d7;
      border: 1px solid #feb2b2;
      color: #742a2a;
    }

    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @media (max-width: 768px) {
      .profile-header {
        padding: 1rem;
        flex-direction: column;
        align-items: flex-start;
        gap: 1rem;
      }

      .user-menu {
        align-self: flex-end;
      }

      .profile-content {
        padding: 0 1rem;
      }

      .form-row {
        grid-template-columns: 1fr;
      }

      .form-section {
        padding: 1.5rem 1rem;
      }

      .form-actions {
        padding: 1rem;
        flex-direction: column;
      }

      .alert {
        position: relative;
        top: auto;
        right: auto;
        margin: 1rem;
      }
    }
  `]
})
export class CompanyProfileComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private firestore = inject(Firestore);
  private authService = inject(AuthService);

  profileForm: FormGroup;
  isSubmitting = signal(false);
  successMessage = signal('');
  errorMessage = signal('');
  isDropdownOpen = false;
  userEmail: string | null = null;

  constructor() {
    this.profileForm = this.fb.group({
      companyName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      address: [''],
      taxId: [''],
      website: [''],
      logo: ['']
    });

    if (typeof window !== 'undefined') {
      this.userEmail = localStorage.getItem('email');
    }
  }

  ngOnInit() {
    this.loadProfile();
  }

  async loadProfile() {
    try {
      const userId = this.authService.userId;
      if (!userId) return;

      const docRef = doc(this.firestore, 'companies', userId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        this.profileForm.patchValue(data);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      this.showError('Failed to load profile data');
    }
  }

  async onSubmit() {
    if (this.profileForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.clearMessages();

    try {
      const userId = this.authService.userId;
      if (!userId) throw new Error('User not authenticated');

      const profileData: CompanyProfile = {
        id: userId,
        ...this.profileForm.value,
        updatedAt: new Date(),
        createdAt: new Date()
      };

      const docRef = doc(this.firestore, 'companies', userId);
      await setDoc(docRef, profileData, { merge: true });

      this.showSuccess('Company profile saved successfully!');
    } catch (error) {
      console.error('Error saving profile:', error);
      this.showError('Failed to save profile. Please try again.');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  resetForm() {
    this.profileForm.reset();
    this.clearMessages();
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.profileForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  private markFormGroupTouched() {
    Object.keys(this.profileForm.controls).forEach(key => {
      this.profileForm.get(key)?.markAsTouched();
    });
  }

  private showSuccess(message: string) {
    this.successMessage.set(message);
    setTimeout(() => this.successMessage.set(''), 5000);
  }

  private showError(message: string) {
    this.errorMessage.set(message);
    setTimeout(() => this.errorMessage.set(''), 5000);
  }

  private clearMessages() {
    this.successMessage.set('');
    this.errorMessage.set('');
  }

  // Header menu methods
  toggleDropdown(event: Event) {
    event.stopPropagation();
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }

  navigateHome() {
    this.router.navigate(['/']);
  }

  viewProfile() {
    // Already on profile page
  }

  signOut() {
    this.authService.signOut().then(() => {
      localStorage.removeItem('user');
      localStorage.removeItem('email');
      this.router.navigate(['/']);
    });
  }
}
