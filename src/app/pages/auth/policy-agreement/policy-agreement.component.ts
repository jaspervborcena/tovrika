import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { OfflineStorageService } from '../../../core/services/offline-storage.service';
import { AuthService } from '../../../services/auth.service';
import { AppConstants } from '../../../shared/enums';

@Component({
  selector: 'app-policy-agreement',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './policy-agreement.component.html',
  styleUrls: ['./policy-agreement.component.css']
})
export class PolicyAgreementComponent implements OnInit {
  private offlineStorageService = inject(OfflineStorageService);
  private authService = inject(AuthService);
  private router = inject(Router);

  // App constants
  readonly appName = AppConstants.APP_NAME;

  // Component state
  isLoading = signal(false);
  agreedToTerms = signal(false);
  agreedToPrivacy = signal(false);
  showTermsModal = signal(false);
  showPrivacyModal = signal(false);
  error = signal('');

  // Computed
  canProceed = () => this.agreedToTerms() && this.agreedToPrivacy() && !this.isLoading();

  async ngOnInit() {
    // Check if user is authenticated
    if (!this.authService.isAuthenticated()) {
      console.warn('⚠️ Policy Agreement: User not authenticated, redirecting to login');
      await this.router.navigate(['/login']);
      return;
    }

    // Check if already agreed to policies
    const currentUser = this.offlineStorageService.currentUser();
    if (currentUser?.isAgreedToPolicy) {
      console.log('✅ Policy Agreement: User already agreed, redirecting...');
      // Redirect to appropriate page
      if (this.authService.hasMultipleCompanies()) {
        await this.router.navigate(['/company-selection']);
      } else {
        await this.router.navigate(['/dashboard']);
      }
    }
  }

  async acceptPolicies() {
    if (!this.canProceed()) return;

    this.isLoading.set(true);
    this.error.set('');

    try {
      console.log('📝 Policy Agreement: Starting policy acceptance process...');
      
      // Check current user state before proceeding
      const currentAuthUser = this.authService.getCurrentUser();
      const offlineUser = this.offlineStorageService.currentUser();
      console.log('📝 Policy Agreement: Auth user:', currentAuthUser?.email);
      console.log('📝 Policy Agreement: Offline user:', offlineUser?.email);
      
      if (!currentAuthUser) {
        throw new Error('No current user found in AuthService');
      }
      
      // Ensure offline storage is initialized
      await this.offlineStorageService.loadOfflineData();
      
      // If still no offline user, try refreshing user data
      if (!this.offlineStorageService.currentUser()) {
        console.log('📝 Policy Agreement: No offline user found, refreshing user data...');
        await this.offlineStorageService.refreshUserData();
      }
      
      // Update policy agreement
      await this.offlineStorageService.updatePolicyAgreement(true);
      console.log('✅ Policy Agreement: User accepted policies');
      
      // Small delay to ensure data is saved
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify the update was successful
      const userData = this.offlineStorageService.currentUser();
      if (!userData?.isAgreedToPolicy) {
        throw new Error('Policy agreement was not saved properly');
      }
      
      // Redirect based on user's authentication state
      const redirectAuthUser = this.authService.getCurrentUser();
      const currentPermission = this.authService.getCurrentPermission();
      
      console.log('📍 Policy Agreement: Redirecting user...');
      console.log('📍 User:', redirectAuthUser?.email);
      console.log('📍 User permissions:', currentPermission);
      console.log('📍 User has multiple companies:', this.authService.hasMultipleCompanies());
      
      // Determine redirect destination
      if (this.authService.hasMultipleCompanies()) {
        console.log('📍 Redirecting to company selection (multiple companies)');
        await this.router.navigate(['/company-selection']);
      } else if (currentPermission?.companyId) {
        // User has a company, redirect to dashboard
        console.log('📍 Redirecting to dashboard (has company)');
        await this.router.navigate(['/dashboard']);
      } else {
        // User needs to select/create company
        console.log('📍 Redirecting to company selection (no company)');
        await this.router.navigate(['/company-selection']);
      }
    } catch (error: any) {
      console.error('❌ Policy Agreement: Failed to save agreement:', error);
      this.error.set(error.message || 'Failed to save policy agreement. Please try again.');
    } finally {
      this.isLoading.set(false);
    }
  }

  openTermsModal() {
    this.showTermsModal.set(true);
  }

  openPrivacyModal() {
    this.showPrivacyModal.set(true);
  }

  closeModals() {
    this.showTermsModal.set(false);
    this.showPrivacyModal.set(false);
  }

  onTermsChange(event: Event) {
    const checkbox = event.target as HTMLInputElement;
    this.agreedToTerms.set(checkbox?.checked || false);
  }

  onPrivacyChange(event: Event) {
    const checkbox = event.target as HTMLInputElement;
    this.agreedToPrivacy.set(checkbox?.checked || false);
  }
}