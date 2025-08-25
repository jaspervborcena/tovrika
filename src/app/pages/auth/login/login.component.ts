import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ButtonComponent, RouterLink],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div class="max-w-md w-full space-y-8">
        <div>
          <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
        </div>
        
        <form class="mt-8 space-y-6" [formGroup]="loginForm" (ngSubmit)="onSubmit()">
          <div class="rounded-md shadow-sm -space-y-px">
            <div>
              <label for="email-address" class="sr-only">Email address</label>
              <input
                id="email-address"
                name="email"
                type="email"
                autocomplete="email"
                formControlName="email"
                [ngClass]="{
                  'border-red-300 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500': loginForm.get('email')?.invalid && loginForm.get('email')?.touched
                }"
                class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
              />
              <div
                *ngIf="loginForm.get('email')?.invalid && loginForm.get('email')?.touched"
                class="text-red-500 text-sm mt-1"
              >
                Please enter a valid email address
              </div>
            </div>
            
            <div>
              <label for="password" class="sr-only">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autocomplete="current-password"
                formControlName="password"
                [ngClass]="{
                  'border-red-300 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500': loginForm.get('password')?.invalid && loginForm.get('password')?.touched
                }"
                class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                placeholder="Password"
              />
              <div
                *ngIf="loginForm.get('password')?.invalid && loginForm.get('password')?.touched"
                class="text-red-500 text-sm mt-1"
              >
                Password is required
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                formControlName="rememberMe"
                class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label for="remember-me" class="ml-2 block text-sm text-gray-900">
                Remember me
              </label>
            </div>
            <div class="text-sm">
              <a routerLink="/register" class="font-medium text-primary-600 hover:text-primary-500">
                Don't have an account? Sign up
              </a>
            </div>
          </div>

          <div>
            <ui-button
              type="submit"
              [disabled]="!loginForm.valid"
              [loading]="isLoading"
            >
              Sign in
            </ui-button>
          </div>

          <div *ngIf="error" class="text-red-500 text-sm text-center mt-2">
            {{ error }}
          </div>
        </form>
      </div>
    </div>
  `
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    rememberMe: [false],
    password: ['', [Validators.required]]
  });

  isLoading = false;
  error = '';

  async onSubmit() {
    if (this.loginForm.valid) {
      this.isLoading = true;
      this.error = '';

      try {
        const { email, password, rememberMe } = this.loginForm.value;
        const user = await this.authService.login(email!, password!, rememberMe!);
        if (!user) {
          throw new Error('Failed to get user data after login');
        }
        
        // Navigate based on user role
        if (user.role === 'admin') {
          this.router.navigate(['/dashboard']);
        } else if (user.role === 'manager') {
          this.router.navigate(['/dashboard']);
        } else {
          this.router.navigate(['/pos']);
        }
      } catch (err: any) {
        this.error = err.message || 'An error occurred during login';
      } finally {
        this.isLoading = false;
      }
    }
  }
}
