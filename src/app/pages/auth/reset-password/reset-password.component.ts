import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

type ResetState = 'loading' | 'form' | 'success' | 'error' | 'expired';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="reset-password-container">
      <div class="reset-card">
        <!-- Logo -->
        <div class="logo-section">
          <h1 class="logo">Tovrika</h1>
          <p class="tagline">Point of Sale System</p>
        </div>

        <!-- Loading State -->
        <div *ngIf="resetState() === 'loading'" class="reset-content">
          <div class="loading-spinner"></div>
          <h2>Verifying Reset Link...</h2>
          <p>Please wait while we verify your password reset link.</p>
        </div>

        <!-- Reset Form State -->
        <div *ngIf="resetState() === 'form'" class="reset-content">
          <h2>Reset Your Password</h2>
          <p class="reset-email">Resetting password for: <strong>{{ resetEmail() }}</strong></p>
          
          <form [formGroup]="resetForm" (ngSubmit)="onSubmit()" class="reset-form">
            <div class="form-group">
              <label for="newPassword">New Password</label>
              <input
                type="password"
                id="newPassword"
                formControlName="newPassword"
                class="form-control"
                placeholder="Enter your new password"
                [class.error]="resetForm.get('newPassword')?.invalid && resetForm.get('newPassword')?.touched"
              >
              <div *ngIf="resetForm.get('newPassword')?.invalid && resetForm.get('newPassword')?.touched" class="error-message">
                <span *ngIf="resetForm.get('newPassword')?.errors?.['required']">Password is required</span>
                <span *ngIf="resetForm.get('newPassword')?.errors?.['minlength']">Password must be at least 6 characters</span>
              </div>
            </div>

            <div class="form-group">
              <label for="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                formControlName="confirmPassword"
                class="form-control"
                placeholder="Confirm your new password"
                [class.error]="resetForm.get('confirmPassword')?.invalid && resetForm.get('confirmPassword')?.touched"
              >
              <div *ngIf="resetForm.get('confirmPassword')?.invalid && resetForm.get('confirmPassword')?.touched" class="error-message">
                <span *ngIf="resetForm.get('confirmPassword')?.errors?.['required']">Please confirm your password</span>
                <span *ngIf="resetForm.get('confirmPassword')?.errors?.['mismatch']">Passwords do not match</span>
              </div>
            </div>

            <div *ngIf="error()" class="error-message">
              {{ error() }}
            </div>

            <button type="submit" class="btn btn-primary" [disabled]="resetForm.invalid || isLoading()">
              <span *ngIf="!isLoading()">Reset Password</span>
              <span *ngIf="isLoading()">Resetting...</span>
            </button>
          </form>
        </div>

        <!-- Success State -->
        <div *ngIf="resetState() === 'success'" class="reset-content success">
          <div class="success-icon">✅</div>
          <h2>Password Reset Successfully!</h2>
          <p>Your password has been updated. You can now log in with your new password.</p>
          <div class="action-buttons">
            <button class="btn btn-primary" (click)="goToLogin()">
              Continue to Login
            </button>
          </div>
        </div>

        <!-- Error State -->
        <div *ngIf="resetState() === 'error'" class="reset-content error">
          <div class="error-icon">❌</div>
          <h2>Reset Link Invalid</h2>
          <p class="error-message">{{ error() }}</p>
          <div class="action-buttons">
            <button class="btn btn-primary" (click)="goToLogin()">
              Back to Login
            </button>
          </div>
        </div>

        <!-- Expired State -->
        <div *ngIf="resetState() === 'expired'" class="reset-content expired">
          <div class="warning-icon">⚠️</div>
          <h2>Reset Link Expired</h2>
          <p>This password reset link has expired. Please request a new one.</p>
          <div class="action-buttons">
            <button class="btn btn-primary" (click)="goToLogin()">
              Back to Login
            </button>
          </div>
        </div>

        <!-- Footer -->
        <div class="footer">
          <p>Need help? <a href="/help">Contact Support</a></p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .reset-password-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
    }

    .reset-card {
      background: white;
      padding: 3rem;
      border-radius: 16px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
      max-width: 500px;
      width: 100%;
      text-align: center;
    }

    .logo-section {
      margin-bottom: 2rem;
    }

    .logo {
      font-size: 2.5rem;
      font-weight: bold;
      color: #667eea;
      margin: 0;
    }

    .tagline {
      color: #6b7280;
      margin: 0.5rem 0 0 0;
      font-size: 0.9rem;
    }

    .reset-content {
      margin-bottom: 2rem;
    }

    .reset-content h2 {
      margin: 1rem 0;
      color: #1f2937;
    }

    .reset-content p {
      color: #6b7280;
      line-height: 1.6;
      margin-bottom: 1.5rem;
    }

    .reset-email {
      background: #f3f4f6;
      padding: 1rem;
      border-radius: 8px;
      font-size: 0.9rem;
    }

    .reset-form {
      text-align: left;
      margin-top: 2rem;
    }

    .form-group {
      margin-bottom: 1.5rem;
    }

    .form-group label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 600;
      color: #374151;
    }

    .form-control {
      width: 100%;
      padding: 12px 16px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 1rem;
      transition: border-color 0.2s;
    }

    .form-control:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .form-control.error {
      border-color: #dc2626;
    }

    .loading-spinner {
      width: 50px;
      height: 50px;
      border: 4px solid #f3f4f6;
      border-top: 4px solid #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .success-icon, .error-icon, .warning-icon {
      font-size: 4rem;
      margin-bottom: 1rem;
    }

    .error-message {
      color: #dc2626;
      font-weight: 500;
      text-align: center;
      margin: 1rem 0;
      font-size: 0.9rem;
    }

    .action-buttons {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-top: 2rem;
    }

    .btn {
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      text-decoration: none;
      display: inline-block;
      width: 100%;
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-primary {
      background: #667eea;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #5a67d8;
    }

    .footer {
      margin-top: 2rem;
      padding-top: 2rem;
      border-top: 1px solid #e5e7eb;
    }

    .footer p {
      color: #9ca3af;
      font-size: 0.9rem;
      margin: 0;
    }

    .footer a {
      color: #667eea;
      text-decoration: none;
    }

    .footer a:hover {
      text-decoration: underline;
    }

    @media (max-width: 640px) {
      .reset-card {
        padding: 2rem;
      }
    }
  `]
})
export class ResetPasswordComponent implements OnInit {
  resetState = signal<ResetState>('loading');
  resetEmail = signal<string>('');
  error = signal<string>('');
  isLoading = signal<boolean>(false);
  
  resetForm: any;
  private actionCode: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private fb: FormBuilder
  ) {
    this.resetForm = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  async ngOnInit() {
    // Get action code from URL parameters
    const mode = this.route.snapshot.queryParamMap.get('mode');
    const oobCode = this.route.snapshot.queryParamMap.get('oobCode');

    if (mode === 'resetPassword' && oobCode) {
      this.actionCode = oobCode;
      await this.verifyResetCode();
    } else {
      this.resetState.set('error');
      this.error.set('Invalid or missing reset link parameters.');
    }
  }

  private async verifyResetCode() {
    try {
      this.resetState.set('loading');
      
      // Verify the reset code and get the email
      const email = await this.authService.verifyPasswordResetCode(this.actionCode);
      
      this.resetEmail.set(email);
      this.resetState.set('form');
    } catch (error: any) {
      console.error('❌ Failed to verify reset code:', error);
      
      if (error.message.includes('expired')) {
        this.resetState.set('expired');
      } else {
        this.resetState.set('error');
        this.error.set(error.message || 'Invalid reset link.');
      }
    }
  }

  async onSubmit() {
    if (this.resetForm.valid) {
      this.isLoading.set(true);
      this.error.set('');

      try {
        const { newPassword } = this.resetForm.value;
        
        await this.authService.confirmPasswordReset(this.actionCode, newPassword!);
        
        this.resetState.set('success');
      } catch (error: any) {
        console.error('❌ Password reset failed:', error);
        this.error.set(error.message || 'Failed to reset password. Please try again.');
      } finally {
        this.isLoading.set(false);
      }
    }
  }

  private passwordMatchValidator(form: any) {
    const password = form.get('newPassword');
    const confirmPassword = form.get('confirmPassword');
    
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ mismatch: true });
      return { mismatch: true };
    }
    
    return null;
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }
}