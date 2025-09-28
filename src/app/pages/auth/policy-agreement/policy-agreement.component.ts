import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { OfflineStorageService } from '../../../core/services/offline-storage.service';
import { AppConstants } from '../../../shared/enums';

@Component({
  selector: 'app-policy-agreement',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './policy-agreement.component.html',
  styleUrls: ['./policy-agreement.component.css']
})
export class PolicyAgreementComponent {
  private offlineStorageService = inject(OfflineStorageService);
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

  async acceptPolicies() {
    if (!this.canProceed()) return;

    this.isLoading.set(true);
    this.error.set('');

    try {
      await this.offlineStorageService.updatePolicyAgreement(true);
      console.log('✅ Policy Agreement: User accepted policies');
      
      // Redirect to appropriate page based on user state
      const currentUser = this.offlineStorageService.currentUser();
      if (currentUser?.storeId) {
        this.router.navigate(['/dashboard']);
      } else {
        this.router.navigate(['/company-selection']);
      }
    } catch (error: any) {
      console.error('❌ Policy Agreement: Failed to save agreement:', error);
      this.error.set('Failed to save policy agreement. Please try again.');
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
}