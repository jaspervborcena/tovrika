import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
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
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
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
        
        // Check if offline access was used
        const hasOfflineAccess = await this.authService.hasOfflineAccess(email!);
        this.offlineLoginUsed = hasOfflineAccess && !this.isOnline();
        
        if (this.offlineLoginUsed) {
          console.log('📱 Login: Offline authentication was used');
        }
        
        // Small delay to ensure user session is fully established
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Always redirect to policy agreement first
        // The policy guard will handle subsequent navigation based on agreement status
        console.log('🔐 Login: Redirecting to policy agreement...');
        await this.router.navigate(['/policy-agreement']);
      } catch (err: any) {
        console.error('🔐 Login: Login failed:', err);
        this.error = err.message || 'An error occurred during login';
      } finally {
        this.isLoading = false;
      }
    }
  }
}
