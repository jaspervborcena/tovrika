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
          status: 'active',
          roleId: UserRolesEnum.VISITOR // All new users start as visitors
          // permission will be set when company/store access is granted
        });
        
        // Send email verification after successful registration
        try {
          console.log('📧 Attempting to send email verification to:', email);
          await this.authService.sendEmailVerification();
          console.log('✅ Email verification sent successfully to:', email);
        } catch (verificationError: any) {
          console.error('❌ Failed to send verification email:', verificationError);
          console.error('❌ Error code:', verificationError.code);
          console.error('❌ Error message:', verificationError.message);
          
          // Show error to user
          this.error = `Registration successful, but failed to send verification email: ${verificationError.message}. You can try to resend it after logging in.`;
          this.isLoading = false;
          return; // Don't proceed with logout and redirect
        }
        
        // Log out the user since they need to verify their email first
        await this.authService.logout();
        console.log('🔐 User logged out after registration - email verification required');
        
        // Redirect to verify-email page with a pending state
        this.router.navigate(['/verify-email'], { 
          queryParams: { 
            email: email,
            registered: 'true'
          } 
        });
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
