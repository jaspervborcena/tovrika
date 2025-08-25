import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ButtonComponent, RouterLink],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div class="max-w-md w-full space-y-8">
        <div>
          <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Create your account
          </h2>
        </div>
        
        <form class="mt-8 space-y-6" [formGroup]="registerForm" (ngSubmit)="onSubmit()">
          <div class="rounded-md shadow-sm -space-y-px">
            <div>
              <label for="display-name" class="sr-only">Display Name</label>
              <input
                id="display-name"
                name="displayName"
                type="text"
                formControlName="displayName"
                [ngClass]="{
                  'border-red-300 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500': registerForm.get('displayName')?.invalid && registerForm.get('displayName')?.touched
                }"
                class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                placeholder="Full Name"
              />
            </div>

            <div>
              <label for="email-address" class="sr-only">Email address</label>
              <input
                id="email-address"
                name="email"
                type="email"
                autocomplete="email"
                formControlName="email"
                [ngClass]="{
                  'border-red-300 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500': registerForm.get('email')?.invalid && registerForm.get('email')?.touched
                }"
                class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
              />
            </div>
            
            <div>
              <label for="password" class="sr-only">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autocomplete="new-password"
                formControlName="password"
                [ngClass]="{
                  'border-red-300 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500': registerForm.get('password')?.invalid && registerForm.get('password')?.touched
                }"
                class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                placeholder="Password"
              />
            </div>
          </div>

          <div class="flex items-center justify-between">
            <div class="text-sm">
              <a routerLink="/login" class="font-medium text-primary-600 hover:text-primary-500">
                Already have an account? Sign in
              </a>
            </div>
          </div>

          <div>
            <ui-button
              type="submit"
              [disabled]="!registerForm.valid"
              [loading]="isLoading"
            >
              Create Account
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
        const user = await this.authService.registerUser(email!, password!, {
          email: email!,
          displayName: displayName!,
          role: 'admin', // First user is admin
          permissions: ['all'],
          companyId: '',
          storeId: '',
          branchId: ''
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
