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
        
        console.log('🔐 Login: Calling authService.login...');
        const user = await this.authService.login(email!, password!, rememberMe!);
        console.log('🔐 Login: authService.login returned:', user);
        
        if (!user) {
          console.error('🔐 Login: No user returned from login');
          throw new Error('Failed to get user data after login');
        }
        
        console.log('🔐 Login: User authenticated successfully:', {
          email: user.email,
          uid: user.uid,
          displayName: user.displayName,
          hasPermissions: !!user.permissions,
          permissionsCount: user.permissions?.length || 0
        });
        
        // TEMP: Skip email verification enforcement (will be re-enabled later)
        
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
        console.log('🔐 Login: User role:', userRole);
        
        // In offline mode, skip policy-agreement to avoid chunk loading issues
        if (!this.isOnline()) {
          console.log('🔐 Login: Offline mode - redirecting directly to dashboard...');
          try {
            await this.router.navigate(['/dashboard']);
            console.log('🔐 Login: Navigation to dashboard successful');
          } catch (navError) {
            console.warn('🔐 Login: Dashboard navigation failed, trying POS...', navError);
            // Fallback to POS if dashboard also fails
            await this.router.navigate(['/pos']);
          }
        } else {
          // Online mode - always go to policy agreement after successful login
          try {
            console.log('🔐 Login: Online mode - redirecting to policy agreement...');
            const navResult = await this.router.navigate(['/policy-agreement']);
            console.log('🔐 Login: Navigation result:', navResult);
          } catch (navError) {
            console.error('🔐 Login: Policy agreement navigation failed:', navError);
            console.warn('🔐 Login: Falling back to onboarding...');
            // Fallback to onboarding if policy-agreement chunk fails
            await this.router.navigate(['/onboarding']);
          }
        }
      } catch (err: any) {
        console.error('🔐 Login: Login failed with error:', err);
        console.error('🔐 Login: Error stack:', err.stack);
        this.error = err.message || 'An error occurred during login';
      } finally {
        this.isLoading = false;
        console.log('🔐 Login: Login process completed, isLoading:', this.isLoading);
      }
    } else {
      console.warn('🔐 Login: Form is invalid');
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
