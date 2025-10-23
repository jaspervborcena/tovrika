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
    const user = this.currentUser();
    if (user?.roleId === 'visitor') {
      return;
    }
    if (role === 'cashier') {
      this.router.navigate(['/pos']);
    } else {
      this.router.navigate(['/dashboard']);
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
      this.error = e?.message || 'Failed to submit access request. Please try again.';
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
