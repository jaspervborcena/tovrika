import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { LogoComponent } from '../../../shared/components/logo/logo.component';
import { AppConstants } from '../../../shared/enums';
import { NetworkService } from '../../../core/services/network.service';
import { UserRolesEnum } from '../../../shared/enums/user-roles.enum';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, HeaderComponent, LogoComponent],
 templateUrl: './register.component.html',
 styleUrls: ['./register.component.css']
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private networkService = inject(NetworkService);

  // App constants and network status
  readonly isOnline = this.networkService.isOnline;
  readonly appName = computed(() => 
    this.isOnline() ? AppConstants.APP_NAME : AppConstants.APP_NAME_OFFLINE
  );

  registerForm = this.fb.group({
    displayName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  isLoading = false;
  error = '';

  async onSubmit() {
    if (this.registerForm.valid) {
      this.isLoading = true;
      this.error = '';

      try {
        const { email, password, displayName } = this.registerForm.value;
        
        await this.authService.registerUser(email!, password!, {
          email: email!,
          displayName: displayName!,
          status: 'active'
          // permissions will be initialized in the service (default visitor)
        });
        
        // TEMP: Email verification flow disabled — keep user logged in and proceed to onboarding
        await this.router.navigate(['/onboarding']);
      } catch (err: any) {
        // Handle Firebase auth errors more gracefully
        if (err.code === 'auth/email-already-in-use') {
          this.error = `An account with this email already exists. You can <a href="/login" class="text-blue-600 hover:underline">log in here</a>.`;
        } else {
          this.error = err.message || 'An error occurred during registration';
        }
      } finally {
        this.isLoading = false;
      }
    }
  }
}
