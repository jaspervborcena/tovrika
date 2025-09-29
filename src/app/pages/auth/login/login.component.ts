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

  async onSubmit(event: Event) {
    if (this.loginForm.valid) {
      this.isLoading = true;
      this.error = '';
      event.preventDefault();
      try {
        const { email, password, rememberMe } = this.loginForm.value;
        const user = await this.authService.login(email!, password!, rememberMe!);
        if (!user) {
          throw new Error('Failed to get user data after login');
        }
        
        // Always redirect to policy agreement first
        // The policy guard will handle subsequent navigation based on agreement status
        this.router.navigate(['/policy-agreement']);
      } catch (err: any) {
        this.error = err.message || 'An error occurred during login';
      } finally {
        this.isLoading = false;
      }
    }
  }
}
