import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { OfflineDocumentService } from '../../core/services/offline-document.service';
import { LogoComponent } from '../../shared/components/logo/logo.component';
import { NetworkService } from '../../core/services/network.service';
import { AppConstants } from '../../shared/enums';

@Component({
  selector: 'app-join-store',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, LogoComponent],
  templateUrl: './join-store.component.html',
  styleUrls: ['./join-store.component.css']
})
export class JoinStoreComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private offlineDocService = inject(OfflineDocumentService);
  private networkService = inject(NetworkService);

  readonly currentUser = this.authService.currentUser;
  readonly userEmail = computed(() => this.currentUser()?.email || '');
  readonly isAuthenticated = this.authService.isAuthenticated;
  readonly userRole = this.authService.userRole;
  readonly isOnline = this.networkService.isOnline;
  readonly appName = computed(() =>
    this.isOnline() ? AppConstants.APP_NAME : AppConstants.APP_NAME_OFFLINE
  );
  readonly headerClass = computed(() =>
    this.isOnline() ? 'home-header' : 'home-header offline'
  );

  isSubmitting = false;
  submittedId: string | null = null;
  error = '';

  form = this.fb.group({
    storeCode: ['', [Validators.required, Validators.minLength(4)]],
    roleId: ['cashier', [Validators.required]]
  });

  roleOptions = [
    { id: 'cashier', label: 'Cashier' },
    { id: 'store_manager', label: 'Store Manager' }
  ];

  navigateToDashboard() {
    const role = this.userRole();
    const currentUser = this.currentUser();
    const currentPermission = this.authService.getCurrentPermission();
    
    // Check if user has valid permissions (not visitor)
    const isVisitor = !currentPermission || 
                     !currentPermission.companyId || 
                     currentPermission.companyId.trim() === '' || 
                     currentPermission.roleId === 'visitor';
    
    if (isVisitor) {
      return;
    }
    
    this.router.navigate(['/dashboard']);
  }

  // Handle cancel button click - visitors go to onboarding, others go home
  async handleCancel() {
    const currentPermission = this.authService.getCurrentPermission();
    
    // Check if user is a visitor
    const isVisitor = !currentPermission || 
                     !currentPermission.companyId || 
                     currentPermission.companyId.trim() === '' || 
                     currentPermission.roleId === 'visitor';
    
    if (isVisitor) {
      await this.router.navigate(['/onboarding']);
    } else {
      await this.router.navigate(['/']);
    }
  }

  // Handle logo click - visitors go to onboarding, others go home  
  async handleLogoClick() {
    const currentPermission = this.authService.getCurrentPermission();
    
    // Check if user is a visitor
    const isVisitor = !currentPermission || 
                     !currentPermission.companyId || 
                     currentPermission.companyId.trim() === '' || 
                     currentPermission.roleId === 'visitor';
    
    if (isVisitor) {
      await this.router.navigate(['/onboarding']);
    } else {
      await this.router.navigate(['/']);
    }
  }

  async logout() {
    await this.authService.logout();
  }

  async submitRequest() {
    if (this.form.invalid || this.isSubmitting) return;
    this.isSubmitting = true;
    this.error = '';

    try {
      const user = this.currentUser();
      if (!user) {
        this.error = 'You must be signed in to request access.';
        this.isSubmitting = false;
        return;
      }

      const { storeCode, roleId } = this.form.value;
      const payload = {
        uid: user.uid,
        email: user.email,
        storeCode: (storeCode || '').toString().replace(/-/g, '').trim(),
        requestedRole: roleId,
        status: 'pending',
        createdAt: new Date()
      };

      const id = await this.offlineDocService.createDocument('accessRequests', payload);
      this.submittedId = id;
    } catch (e: any) {
      console.error('Failed to submit access request:', e);
      
      // Provide more specific error messages
      const errorMessage = e?.message || '';
      if (errorMessage.includes('Authentication failed') || errorMessage.includes('auth')) {
        this.error = 'Authentication error. Please sign in again and try again.';
      } else if (errorMessage.includes('network') || errorMessage.includes('timeout') || !navigator.onLine) {
        this.error = 'Network connection issue. Your request has been saved offline and will be submitted when connection is restored.';
        // In this case, the offline document service should have saved it offline
      } else if (errorMessage.includes('quota') || errorMessage.includes('storage')) {
        this.error = 'Storage limit reached. Please clear some data and try again.';
      } else {
        this.error = 'Failed to submit access request. Please try again.';
      }
    } finally {
      this.isSubmitting = false;
    }
  }

  goHome() {
    this.router.navigate(['/']);
  }

  onStoreCodeInput(event: Event) {
    const target = event.target as HTMLInputElement;
    if (!target) return;
    const cleaned = target.value.replace(/-/g, '');
    if (cleaned !== target.value) {
      this.form.controls.storeCode.setValue(cleaned, { emitEvent: false });
    }
  }
}
