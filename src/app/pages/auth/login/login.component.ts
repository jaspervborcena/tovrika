import { Component, inject, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { LogoComponent } from '../../../shared/components/logo/logo.component';
import { AppConstants } from '../../../shared/enums';
import { NetworkService } from '../../../core/services/network.service';
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, HeaderComponent, LogoComponent],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private networkService = inject(NetworkService);

  // App constants and network status
  readonly isOnline = this.networkService.isOnline;
  readonly appName = computed(() => 
    this.isOnline() ? AppConstants.APP_NAME : AppConstants.APP_NAME_OFFLINE
  );

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    rememberMe: [false],
    password: ['', [Validators.required]]
  });

  isLoading = false;
  error = '';
  offlineLoginUsed = false;
  showEmailVerificationWarning = false;
  canResendVerification = false;

  ngOnInit() {
    // Check for query parameters (e.g., session expired message)
    this.route.queryParams.subscribe(params => {
      if (params['message']) {
        this.error = params['message'];
      }
    });
  }

  async onSubmit(event: Event) {
    if (this.loginForm.valid) {
      this.isLoading = true;
      this.error = '';
      event.preventDefault();
      try {
        console.log('🔐 Login: Starting hybrid login process...');
        const { email, password, rememberMe } = this.loginForm.value;
        
        const user = await this.authService.login(email!, password!, rememberMe!);
        if (!user) {
          throw new Error('Failed to get user data after login');
        }
        
        console.log('🔐 Login: User authenticated successfully:', user.email);
        
        // Check email verification status
        const isEmailVerified = this.authService.isEmailVerified();
        if (!isEmailVerified && this.isOnline()) {
          console.log('⚠️ Login: Email not verified, showing warning');
          this.showEmailVerificationWarning = true;
          this.canResendVerification = true;
          this.error = 'Please verify your email address. We\'ve sent a verification link to your inbox.';
          return; // Don't proceed with login until email is verified
        }
        
        // Check if offline access was used
        const hasOfflineAccess = await this.authService.hasOfflineAccess(email!);
        this.offlineLoginUsed = hasOfflineAccess && !this.isOnline();
        
        if (this.offlineLoginUsed) {
          console.log('📱 Login: Offline authentication was used');
        }
        
        // Small delay to ensure user session is fully established
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Check user role to determine where to redirect
        const userRole = user.roleId || 'visitor';
        
        // In offline mode, skip policy-agreement to avoid chunk loading issues
        if (!this.isOnline()) {
          console.log('🔐 Login: Offline mode - redirecting directly to dashboard...');
          try {
            await this.router.navigate(['/dashboard']);
          } catch (navError) {
            console.warn('🔐 Login: Dashboard navigation failed, trying POS...', navError);
            // Fallback to POS if dashboard also fails
            await this.router.navigate(['/pos']);
          }
        } else {
          // Online mode - redirect based on user role
          if (userRole === 'visitor') {
            console.log('🔐 Login: Visitor user - redirecting to onboarding...');
            await this.router.navigate(['/onboarding']);
          } else {
            // Business users (creator, store_manager, cashier) go to policy agreement first
            try {
              console.log('🔐 Login: Business user - redirecting to policy agreement...');
              await this.router.navigate(['/policy-agreement']);
            } catch (navError) {
              console.warn('🔐 Login: Policy agreement navigation failed, going to dashboard...', navError);
              // If policy-agreement fails (chunk error), go to dashboard
              await this.router.navigate(['/dashboard']);
            }
          }
        }
      } catch (err: any) {
        console.error('🔐 Login: Login failed:', err);
        this.error = err.message || 'An error occurred during login';
      } finally {
        this.isLoading = false;
      }
    }
  }

  async resendVerificationEmail() {
    try {
      this.isLoading = true;
      await this.authService.sendEmailVerification();
      this.error = 'Verification email sent! Please check your inbox.';
      this.canResendVerification = false;
      
      // Re-enable resend button after 30 seconds
      setTimeout(() => {
        this.canResendVerification = true;
      }, 30000);
      
    } catch (error: any) {
      this.error = error.message || 'Failed to send verification email';
    } finally {
      this.isLoading = false;
    }
  }
}
