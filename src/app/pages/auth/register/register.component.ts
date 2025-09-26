import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { LogoComponent } from '../../../shared/components/logo/logo.component';

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
          // permission will be set when company/store access is granted
        });
        
        // Admin should create a company first
        this.router.navigate(['/dashboard']);
      } catch (err: any) {
        this.error = err.message || 'An error occurred during registration';
      } finally {
        this.isLoading = false;
      }
    }
  }
}
