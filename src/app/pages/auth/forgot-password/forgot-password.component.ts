import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="forgot-password-container">
      <div class="forgot-card">
        <div class="logo-section">
          <h1 class="logo">Tovrika</h1>
          <p class="tagline">Point of Sale System</p>
        </div>
        <h2 class="forgot-title">Forgot Password</h2>
        <form [formGroup]="forgotForm" (ngSubmit)="onSubmit()" class="forgot-form">
          <div class="form-group">
            <label for="email">Email</label>
            <input id="email" type="email" formControlName="email" required autocomplete="email" />
            <div *ngIf="forgotForm.get('email')?.invalid && forgotForm.get('email')?.touched" class="error-message">
              Valid email is required
            </div>
          </div>
          <button type="submit" [disabled]="forgotForm.invalid || isLoading" class="forgot-btn">
            <span *ngIf="isLoading" class="loading-spinner"></span>
            <span>{{ isLoading ? 'Sending...' : 'Send Reset Email' }}</span>
          </button>
        </form>
        <div *ngIf="successMessage" class="success-message">{{ successMessage }}</div>
        <div *ngIf="errorMessage" class="error-message">{{ errorMessage }}</div>
      </div>
    </div>
  `,
  styles: [`
    .forgot-password-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f8fafc;
    }
    .forgot-card {
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      padding: 2.5rem 2rem 2rem 2rem;
      width: 100%;
      max-width: 370px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .logo-section {
      text-align: center;
      margin-bottom: 1.5rem;
    }
    .logo {
      font-family: 'Inter', sans-serif;
      font-size: 2rem;
      font-weight: 700;
      color: #667eea;
      margin: 0;
    }
    .tagline {
      font-size: 0.95rem;
      color: #64748b;
      margin: 0;
    }
    .forgot-title {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 1.5rem;
      color: #334155;
      text-align: center;
    }
    .forgot-form {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 1.2rem;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    label {
      font-size: 0.95rem;
      color: #475569;
      font-weight: 500;
    }
    input[type="email"] {
      padding: 0.7rem 1rem;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-size: 1rem;
      outline: none;
      transition: border 0.2s;
    }
    input[type="email"]:focus {
      border-color: #667eea;
    }
    .forgot-btn {
      background: #667eea;
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 0.8rem 0;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
      width: 100%;
      margin-top: 0.5rem;
    }
    .forgot-btn:disabled {
      background: #cbd5e1;
      cursor: not-allowed;
    }
    .loading-spinner {
      border: 2px solid #f3f3f3;
      border-top: 2px solid #667eea;
      border-radius: 50%;
      width: 16px;
      height: 16px;
      animation: spin 1s linear infinite;
      display: inline-block;
      margin-right: 8px;
      vertical-align: middle;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .success-message {
      color: #22c55e;
      margin-top: 1.2rem;
      font-size: 1rem;
      text-align: center;
    }
    .error-message {
      color: #ef4444;
      margin-top: 0.5rem;
      font-size: 0.97rem;
      text-align: center;
    }
  `]
})
export class ForgotPasswordComponent {
  forgotForm: FormGroup;
  isLoading = false;
  successMessage = '';
  errorMessage = '';

  constructor(private fb: FormBuilder, private authService: AuthService) {
    this.forgotForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  onSubmit() {
    if (this.forgotForm.invalid) return;
    this.isLoading = true;
    this.successMessage = '';
    this.errorMessage = '';
    const email = this.forgotForm.value.email;
    this.authService.sendPasswordResetEmail(email)
      .catch(() => {/* Intentionally ignore errors for privacy */})
      .finally(() => {
        this.successMessage = 'If an account exists for this email, a reset link has been sent.';
        this.isLoading = false;
      });
  }
}
