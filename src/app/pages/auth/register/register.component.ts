import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { LogoComponent } from '../../../shared/components/logo/logo.component';
import { AppConstants } from '../../../shared/enums';
import { NetworkService } from '../../../core/services/network.service';
import { ROLE_OPTIONS, UserRolesEnum } from '../../../shared/enums/user-roles.enum';

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

  // Role options for dropdown
  readonly roleOptions = ROLE_OPTIONS;

  registerForm = this.fb.group({
    displayName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    roleId: [UserRolesEnum.CREATOR, [Validators.required]]
  });

  isLoading = false;
  error = '';

  // Get role description for selected role
  get selectedRoleDescription(): string {
    const selectedRoleId = this.registerForm.get('roleId')?.value;
    const selectedRole = this.roleOptions.find(role => role.id === selectedRoleId);
    return selectedRole?.description || '';
  }

  async onSubmit() {
    if (this.registerForm.valid) {
      this.isLoading = true;
      this.error = '';

      try {
        const { email, password, displayName, roleId } = this.registerForm.value;
        await this.authService.registerUser(email!, password!, {
          email: email!,
          displayName: displayName!,
          status: 'active',
          roleId: roleId! // Store the selected role for later use
          // permission will be set when company/store access is granted
        });
        
        // Always redirect to policy agreement first
        // The policy guard will handle subsequent navigation based on agreement status
        this.router.navigate(['/policy-agreement']);
      } catch (err: any) {
        this.error = err.message || 'An error occurred during registration';
      } finally {
        this.isLoading = false;
      }
    }
  }
}
