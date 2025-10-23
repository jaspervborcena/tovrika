import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

type VerificationState = 'checking' | 'success' | 'error' | 'expired' | 'already-verified';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="verify-email-container">
      <div class="verify-card">
        <!-- Logo -->
        <div class="logo-section">
          <div class="logo-container">
            <img src="/assets/images/logo.png" alt="Tovrika Logo" class="logo-image" />
            <h1 class="logo">Tovrika</h1>
          </div>
          <p class="tagline">Point of Sale System</p>
        </div>

        <!-- Checking State -->
        <div *ngIf="verificationState() === 'checking'" class="verification-content">
          <div class="loading-spinner"></div>
          <h2>Verifying Your Email...</h2>
          <p>Please wait while we verify your email address.</p>
        </div>

        <!-- Success State -->
        <div *ngIf="verificationState() === 'success'" class="verification-content success">
          <div class="success-icon">✅</div>
          <h2>Email Verified Successfully!</h2>
          <p>Your email has been verified. You can now log in to your account.</p>
          <div class="action-buttons">
            <button class="btn btn-primary" (click)="goToLogin()">
              Continue to Login
            </button>
          </div>
        </div>

        <!-- Error State / Registration Success -->
        <div *ngIf="verificationState() === 'error'" class="verification-content" 
             [class.error]="!isRegistrationSuccess()"
             [class.registration-success]="isRegistrationSuccess()">
          <div *ngIf="isRegistrationSuccess()" class="success-icon">📧</div>
          <div *ngIf="!isRegistrationSuccess()" class="error-icon">❌</div>
          
          <h2 *ngIf="isRegistrationSuccess()">Check Your Email!</h2>
          <h2 *ngIf="!isRegistrationSuccess()">Verification Failed</h2>
          
          <p class="message">{{ errorMessage() }}</p>
          <div class="action-buttons">
            <button class="btn btn-secondary" (click)="resendVerification()" 
                    [disabled]="resending()" *ngIf="canResend()">
              <span *ngIf="!resending()">Resend Verification Email</span>
              <span *ngIf="resending()">Sending...</span>
            </button>
            <button class="btn btn-primary" (click)="goToLogin()">
              {{ isRegistrationSuccess() ? 'Go to Login' : 'Back to Login' }}
            </button>
          </div>
        </div>

        <!-- Expired State -->
        <div *ngIf="verificationState() === 'expired'" class="verification-content expired">
          <div class="warning-icon">⚠️</div>
          <h2>Verification Link Expired</h2>
          <p>This verification link has expired. Please request a new one.</p>
          <div class="action-buttons">
            <button class="btn btn-secondary" (click)="resendVerification()" 
                    [disabled]="resending()">
              <span *ngIf="!resending()">Send New Verification Email</span>
              <span *ngIf="resending()">Sending...</span>
            </button>
            <button class="btn btn-primary" (click)="goToLogin()">
              Back to Login
            </button>
          </div>
        </div>

        <!-- Already Verified State -->
        <div *ngIf="verificationState() === 'already-verified'" class="verification-content already-verified">
          <div class="info-icon">ℹ️</div>
          <h2>Email Already Verified</h2>
          <p>Your email address is already verified. You can log in to your account.</p>
          <div class="action-buttons">
            <button class="btn btn-primary" (click)="goToLogin()">
              Continue to Login
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
    .verify-email-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
    }

    .verify-card {
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

    .logo-container {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      margin-bottom: 0.5rem;
    }

    .logo-image {
      width: 48px;
      height: 48px;
      object-fit: contain;
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

    .verification-content {
      margin-bottom: 2rem;
    }

    .verification-content h2 {
      margin: 1rem 0;
      color: #1f2937;
    }

    .verification-content p {
      color: #6b7280;
      line-height: 1.6;
      margin-bottom: 1.5rem;
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

    .success-icon, .error-icon, .warning-icon, .info-icon {
      font-size: 4rem;
      margin-bottom: 1rem;
    }

    .error-message {
      color: #dc2626;
      font-weight: 500;
    }

    .message {
      color: #6b7280;
      line-height: 1.6;
    }

    .registration-success .message {
      color: #059669;
      font-weight: 500;
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

    .btn-secondary {
      background: #f3f4f6;
      color: #374151;
      border: 1px solid #d1d5db;
    }

    .btn-secondary:hover:not(:disabled) {
      background: #e5e7eb;
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

    /* Mobile responsive styles */
    @media (max-width: 768px) {
      .logo-container {
        gap: 0.75rem;
      }
      
      .logo-image {
        width: 36px;
        height: 36px;
      }
      
      .logo-text {
        font-size: 2rem;
      }
    }

    @media (max-width: 640px) {
      .verify-card {
        padding: 2rem;
      }

      .action-buttons {
        flex-direction: column;
      }
    }
  `]
})
export class VerifyEmailComponent implements OnInit {
  verificationState = signal<VerificationState>('checking');
  errorMessage = signal<string>('');
  resending = signal<boolean>(false);
  isRegistrationFlow = signal<boolean>(false);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {}

  async ngOnInit() {
    // Check if user is already verified
    if (this.authService.isEmailVerified()) {
      this.verificationState.set('already-verified');
      return;
    }

    // Get URL parameters
    const mode = this.route.snapshot.queryParamMap.get('mode');
    const oobCode = this.route.snapshot.queryParamMap.get('oobCode');
    const registered = this.route.snapshot.queryParamMap.get('registered');
    const email = this.route.snapshot.queryParamMap.get('email');

    if (mode === 'verifyEmail' && oobCode) {
      // User clicked verification link from email
      await this.handleEmailVerification(oobCode);
    } else if (registered === 'true') {
      // User just registered and was redirected here
      this.showRegistrationSuccess(email);
    } else {
      // No verification code, just show the verification pending state
      this.showVerificationPending();
    }
  }

  private async handleEmailVerification(actionCode: string) {
    try {
      this.verificationState.set('checking');
      
      // Verify the email using the action code
      await this.authService.verifyEmail(actionCode);
      
      this.verificationState.set('success');
    } catch (error: any) {
      console.error('❌ Email verification failed:', error);
      
      if (error.message.includes('expired')) {
        this.verificationState.set('expired');
      } else {
        this.verificationState.set('error');
        this.errorMessage.set(error.message || 'Verification failed. Please try again.');
      }
    }
  }

  private showVerificationPending() {
    // This state can be used when user visits /verify-email directly
    // without a verification code (e.g., after registration)
    this.verificationState.set('checking');
    
    // Show a different message after a delay
    setTimeout(() => {
      this.verificationState.set('error');
      this.errorMessage.set('Please check your email for the verification link.');
    }, 2000);
  }

  private showRegistrationSuccess(email: string | null) {
    // User just registered successfully and was redirected here
    this.isRegistrationFlow.set(true);
    this.verificationState.set('error'); // Using error state but with success message
    this.errorMessage.set(
      email 
        ? `Registration successful! We've sent a verification email to ${email}. Please check your inbox and click the verification link to complete your account setup.`
        : 'Registration successful! Please check your email and click the verification link to complete your account setup.'
    );
  }

  isRegistrationSuccess(): boolean {
    return this.isRegistrationFlow();
  }

  async resendVerification() {
    try {
      this.resending.set(true);
      this.errorMessage.set('');
      
      console.log('📧 Attempting to resend verification email...');
      await this.authService.sendEmailVerification();
      console.log('✅ Verification email resent successfully');
      
      // Show success message
      this.verificationState.set('checking');
      
      // Update message after sending
      setTimeout(() => {
        this.verificationState.set('error');
        this.errorMessage.set('New verification email sent! Please check your inbox and spam folder.');
        this.isRegistrationFlow.set(true); // Show as success state
      }, 1000);
      
    } catch (error: any) {
      console.error('❌ Failed to resend verification email:', error);
      this.errorMessage.set(error.message || 'Failed to send verification email.');
    } finally {
      this.resending.set(false);
    }
  }

  canResend(): boolean {
    // Only show resend option if user is logged in
    return !!this.authService.currentUser();
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }
}