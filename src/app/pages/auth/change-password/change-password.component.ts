import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { ContentLayoutComponent } from '../../../shared/components/content-layout/content-layout.component';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, HeaderComponent, ContentLayoutComponent],
  templateUrl: './change-password.component.html',
  styleUrls: ['./change-password.component.css']
})
export class ChangePasswordComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  readonly appVersion = environment.version;
  readonly currentUser = this.authService.currentUser;

  readonly isLoading = signal(false);
  readonly successMessage = signal('');
  readonly errorMessage = signal('');

  private readonly differentPasswordValidator = (control: AbstractControl): ValidationErrors | null => {
    const currentPassword = control.get('currentPassword')?.value;
    const newPassword = control.get('newPassword')?.value;
    return currentPassword && newPassword && currentPassword === newPassword
      ? { samePassword: true }
      : null;
  };

  readonly passwordForm = this.formBuilder.nonNullable.group({
    currentPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]]
  }, { validators: this.differentPasswordValidator });

  async onSubmit(): Promise<void> {
    this.successMessage.set('');
    this.errorMessage.set('');

    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    const { currentPassword, newPassword, confirmPassword } = this.passwordForm.getRawValue();
    if (currentPassword === newPassword) {
      this.errorMessage.set('Previous password and new password must be different.');
      return;
    }

    if (newPassword !== confirmPassword) {
      this.errorMessage.set('New password and confirmation do not match.');
      this.passwordForm.controls.confirmPassword.setErrors({ mismatch: true });
      return;
    }

    this.isLoading.set(true);
    try {
      await this.authService.changePassword(currentPassword, newPassword);
      this.passwordForm.reset();
      this.successMessage.set('Your password has been changed successfully.');
    } catch (error: any) {
      this.errorMessage.set(error?.message || 'Password change failed. Please try again.');
    } finally {
      this.isLoading.set(false);
    }
  }
}