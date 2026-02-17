import { Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CompanyService } from '../../../services/company.service';
import { AuthService } from '../../../services/auth.service';
import { Company } from '../../../interfaces/company.interface';
import { AccessService } from '../../../core/services/access.service';
import { StoreService } from '../../../services/store.service';
import { Store } from '../../../interfaces/store.interface';
import { SubscriptionModalComponent } from '../subscriptions/subscription-modal.component';
import { UpgradeSubscriptionModalComponent } from '../subscriptions/upgrade-subscription-modal.component';
import { SubscriptionDetailsModalComponent } from './subscription-details-modal.component';
import { BillingHistoryModalComponent } from '../subscriptions/billing-history-modal.component';
import { RoleDefinitionService } from '../../../services/role-definition.service';
import { ToastService } from '../../../shared/services/toast.service';
import { BillingService } from '../../../services/billing.service';
import { OfflineDocumentService } from '../../../core/services/offline-document.service';
import { SubscriptionService } from '../../../services/subscription.service';

@Component({
  selector: 'app-company-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SubscriptionModalComponent, SubscriptionDetailsModalComponent, BillingHistoryModalComponent, UpgradeSubscriptionModalComponent],
  template: `
    <div class="company-profile-container">
      <!-- Header with Products style -->
      <div class="header">
        <div class="header-content">
          <div class="header-left">
            <div class="header-text">
              <h1 class="page-title">Company Profile</h1>
              <p class="page-subtitle">Configure your company information and settings</p>
            </div>
          </div>
          <div class="header-actions">
            <!-- Add quick links for Access Management and User Roles inside Company Profile -->
            <button *ngIf="permissions().canViewAccess" class="btn btn-secondary" (click)="navigateTo('/dashboard/access')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="margin-right:0.5rem"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 17l-4 4m0 0l-4-4m4 4V3"/></svg>
              Access Management
            </button>
            <button *ngIf="permissions().canViewUserRoles" class="btn btn-secondary" (click)="navigateTo('/dashboard/user-roles')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="margin-right:0.5rem"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20h6M3 20h5v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75M8 3.13a4 4 0 010 7.75"/></svg>
              User Roles
            </button>
          </div>
        </div>
      </div>

      <!-- Error Message -->
      <div class="content-container" *ngIf="error()">
        <div class="error-alert">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {{ error() }}
        </div>
      </div>

      <!-- Success Message -->
      <div class="content-container" *ngIf="showSuccessMessage()">
        <div class="success-alert">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {{ successMessage() }}
        </div>
      </div>

      <!-- Tab Navigation -->
      <div class="content-container" *ngIf="!isCreatingCompany()">
        <div class="tab-navigation">
          <button 
            class="tab-button"
            [class.active]="activeTab() === 'profile'"
            (click)="setActiveTab('profile')">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="tab-icon">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Company Profile
          </button>
          <button 
            class="tab-button"
            [class.active]="activeTab() === 'subscriptions'"
            (click)="setActiveTab('subscriptions')">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="tab-icon">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Store Subscriptions
          </button>
        </div>
      </div>

      <!-- Company Form -->
      <div class="content-container" *ngIf="activeTab() === 'profile'">
        <div class="form-card">
          <div class="form-header">
            <h2 class="form-title">{{ isCreatingCompany() ? 'Create Company Profile' : 'Company Information' }}</h2>
            <p class="form-subtitle">{{ isCreatingCompany() ? 'Set up your company profile to get started' : 'Update your company details and business information' }}</p>
            <p class="form-note" *ngIf="isCreatingCompany()">
              <strong>Note:</strong> Once the company is created, you will be logged out so your new role can be applied.
            </p>
          </div>

          <form [formGroup]="profileForm" (ngSubmit)="onSubmit()" class="company-form">
            <!-- Company Name -->
            <div class="form-group">
              <label for="name" class="form-label">Company Name *</label>
              <input 
                id="name"
                type="text" 
                formControlName="name"
                class="form-input"
                placeholder="Enter company name"
                [disabled]="loading()"
                [class.error]="profileForm.get('name')?.invalid && profileForm.get('name')?.touched">
              <div class="error-message" *ngIf="profileForm.get('name')?.invalid && profileForm.get('name')?.touched">
                Company name is required
              </div>
            </div>

            <!-- Email -->
            <div class="form-group">
              <label for="email" class="form-label">Company Email *</label>
              <input 
                id="email"
                type="email" 
                formControlName="email"
                class="form-input"
                placeholder="Enter company email"
                [disabled]="loading()"
                [class.error]="profileForm.get('email')?.invalid && profileForm.get('email')?.touched">
              <div class="error-message" *ngIf="profileForm.get('email')?.invalid && profileForm.get('email')?.touched">
                Please enter a valid email address
              </div>
            </div>

            <!-- Phone Number -->
            <div class="form-group">
              <label for="phone" class="form-label">Phone Number</label>
              <input 
                id="phone"
                type="tel" 
                formControlName="phone"
                class="form-input"
                placeholder="Enter phone number"
                [disabled]="loading()">
              <p class="form-note" *ngIf="isCreatingCompany()">
                <strong>Note:</strong> Once the company is created, you will be logged out so your new role can be applied.
              </p>
            </div>

            <!-- UI helper: Show when user has no companyId in permission (explicit requirement) -->
            <div class="form-group" *ngIf="noCompanyId()">
              <label class="form-checkbox">
                <input
                  type="checkbox"
                  [checked]="useSameInfoForStore()"
                  (change)="useSameInfoForStore.set($any($event.target).checked)"
                />
                Use same information for my store
              </label>
              <p class="form-note">
                Note: You can uncheck if you want to set up the store separately.
              </p>
            </div>

            <!-- Form Actions -->
            <div class="form-actions">
              <button 
                type="button" 
                (click)="resetForm()" 
                [disabled]="loading() || !canEditOrAddCompanyProfile()"
                class="btn btn-secondary">
                Reset Form
              </button>
              <button 
                type="submit" 
                [disabled]="loading() || profileForm.invalid || !canEditOrAddCompanyProfile()"
                class="btn btn-primary">
                <span *ngIf="loading()" class="loading-spinner"></span>
                {{ loading() ? 'Saving Changes...' : (isCreatingCompany() ? 'Create Company Profile' : 'Save Company Profile') }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Subscription Management Tab -->
      <div class="content-container" *ngIf="activeTab() === 'subscriptions' && !isCreatingCompany()">
        <div class="subscription-section">
          <div class="section-header">
            <h2>Store Subscriptions</h2>
          </div>

          <!-- Subscription Grid -->
          <div class="subscription-grid" *ngIf="stores().length > 0">
            <table class="subscription-table">
              <thead>
                <tr>
                  <th>Store Name</th>
                  <th>Tier</th>
                  <th>Subscribed At</th>
                  <th>Expires At</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let store of stores()">
                  <td>
                    <div class="store-info">
                      <span class="store-name">{{ store.storeName }}</span>
                    </div>
                  </td>
                  <td>
                    <span [class]="getTierBadgeClass(getStoreTier(store))">
                      {{ getStoreTier(store) | titlecase }}
                    </span>
                  </td>
                  <td>{{ formatDate(getStoreSubscribedAt(store)) }}</td>
                  <td [class.expiring]="isExpiringSoon(getStoreExpiresAt(store))">
                    {{ formatDate(getStoreExpiresAt(store)) }}
                  </td>
                  <td>
                    <span [class]="getStatusBadgeClass(getStoreStatus(store))">
                      {{ getStoreStatus(store) | titlecase }}
                    </span>
                  </td>
                  <td>
                    <div class="action-buttons">
                      <button (click)="upgradeSubscription(store)" class="btn-icon-action btn-upgrade" title="Upgrade Subscription">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="icon">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </button>
                      <button (click)="viewSubscriptionDetails(store)" class="btn-icon-action btn-view" title="View Details">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="icon">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      <button (click)="openBillingHistory(store)" class="btn-icon-action btn-billing" title="Billing History">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="icon">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Empty State -->
          <div class="empty-state" *ngIf="stores().length === 0">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="empty-icon">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <p>No stores yet. Create a store to add subscriptions.</p>
          </div>
        </div>
      </div><!-- End content-container -->

      <!-- Subscription Modal -->
      <app-subscription-modal
        [isOpen]="showSubscriptionModal()"
        [store]="selectedStore()"
        (closeModal)="closeSubscriptionModal()"
        (subscriptionSubmitted)="handleSubscription($event)"
        (openUpgrade)="openUpgradeFromModal($event)"
      ></app-subscription-modal>

      <!-- Centralized Upgrade Modal (opened when subscription modal requests an upgrade flow) -->
      <app-upgrade-subscription-modal
        [isOpen]="showUpgradeModal()"
        [companyId]="currentCompany()?.id || ''"
        [companyName]="currentCompany()?.name || ''"
        [storeId]="upgradeStoreId()"
        [storeName]="upgradeStoreName()"
        [storeCode]="upgradeStoreCode()"
        [initialTier]="upgradeInitialTier()"
        [initialDurationMonths]="upgradeInitialDurationMonths()"
        [initialPromoCode]="upgradeInitialPromoCode()"
        [initialReferralCode]="upgradeInitialReferralCode()"
        (closeModal)="closeUpgradeModal()"
        (completed)="onUpgradeCompleted()"
      ></app-upgrade-subscription-modal>

      <!-- Subscription Details Modal -->
      <app-subscription-details-modal
        [isOpen]="showSubscriptionDialog()"
        [store]="selectedStoreForDetails()"
        (closed)="closeSubscriptionDialog()"
      ></app-subscription-details-modal>

      <!-- Billing History Modal -->
      <app-billing-history-modal
        [isOpen]="showBillingHistoryModal()"
        [storeId]="selectedStoreForBillingHistory()?.id || ''"
        [storeName]="selectedStoreForBillingHistory()?.storeName || ''"
        (closeModal)="closeBillingHistoryModal()"
      ></app-billing-history-modal>
    </div>
  `,
  styles: [`
    .company-profile-container {
      min-height: 100%;
      background: #f8fafc;
    }

    /* Header Styles - Matching Products Header */
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 2rem 0;
      margin-bottom: 2rem;
    }

    .header-content {
      max-width: 1400px;
      margin: 0 auto;
      padding: 0 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 1.5rem;
    }

    .back-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      background: rgba(255, 255, 255, 0.15);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      color: white;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      backdrop-filter: blur(10px);
    }

    .back-btn:hover {
      background: rgba(255, 255, 255, 0.25);
      transform: translateY(-1px);
    }

    .back-btn svg {
      width: 1rem;
      height: 1rem;
    }

    .header-text {
      flex: 1;
    }

    .page-title {
      font-size: 2.5rem;
      font-weight: 700;
      margin: 0 0 0.5rem 0;
      color: white;
      letter-spacing: -0.025em;
    }

    .page-subtitle {
      font-size: 1.125rem;
      margin: 0;
      opacity: 0.9;
      font-weight: 400;
    }

    .header-actions {
      display: flex;
      gap: 0.75rem;
    }

    .btn {
      border: none;
      border-radius: 8px;
      padding: 0.75rem 1.5rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      text-decoration: none;
      font-size: 0.875rem;
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-primary {
      background: #059669;
      color: white;
      box-shadow: 0 2px 8px rgba(5, 150, 105, 0.3);
    }

    .btn-primary:hover:not(:disabled) {
      background: #047857;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(5, 150, 105, 0.4);
    }

    .btn-primary.disabled {
      background: #6b7280;
      color: #d1d5db;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    .btn-icon {
      width: 1rem;
      height: 1rem;
    }

    .content-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
    }

    /* Tab Navigation Styles */
    .tab-navigation {
      display: flex;
      gap: 0;
      background: white;
      border-radius: 12px;
      padding: 0.5rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      margin-bottom: 0;
    }

    .tab-button {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.875rem 1.5rem;
      background: transparent;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.9rem;
      color: #6b7280;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .tab-button:hover {
      background: #f3f4f6;
      color: #374151;
    }

    .tab-button.active {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
    }

    .tab-icon {
      width: 1.25rem;
      height: 1.25rem;
    }

    .error-alert, .success-alert {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 500;
      margin-bottom: 1rem;
    }

    .error-alert {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #dc2626;
    }

    .success-alert {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      color: #16a34a;
    }

    .error-alert svg, .success-alert svg {
      width: 1.25rem;
      height: 1.25rem;
      flex-shrink: 0;
    }

    .form-card {
      background: white;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }

    .form-header {
      padding: 1.5rem 2rem;
      border-bottom: 1px solid #e2e8f0;
      background: #f8fafc;
    }

    .form-title {
      font-size: 1.25rem;
      font-weight: 700;
      color: #1e293b;
      margin: 0 0 0.5rem 0;
    }

    .form-subtitle {
      color: #64748b;
      font-size: 0.875rem;
      margin: 0;
    }

    .company-form {
      padding: 2rem;
    }

    .form-group {
      margin-bottom: 1.5rem;
    }

    .form-label {
      display: block;
      font-size: 0.875rem;
      font-weight: 600;
      color: #374151;
      margin-bottom: 0.5rem;
    }

    .form-input, .form-textarea {
      width: 100%;
      padding: 0.75rem 1rem;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 0.875rem;
      color: #374151;
      background: white;
      transition: all 0.2s ease;
    }

    .form-input:focus, .form-textarea:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .form-input:disabled, .form-textarea:disabled {
      background: #f9fafb;
      color: #9ca3af;
      cursor: not-allowed;
    }

    .form-input.error, .form-textarea.error {
      border-color: #ef4444;
    }

    .form-textarea {
      resize: vertical;
      min-height: 80px;
    }
    /* UI helper styles for the checkbox and note */
    .form-checkbox {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 600;
      color: #374151;
    }

    .form-note {
      color: #64748b;
      font-size: 0.8125rem;
      margin-top: 0.25rem;
    }

    .error-message {
      color: #ef4444;
      font-size: 0.75rem;
      margin-top: 0.25rem;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 1rem;
      margin-top: 2rem;
      padding-top: 1.5rem;
      border-top: 1px solid #e2e8f0;
    }

    .btn {
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      border: none;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .btn-secondary {
      background: #f1f5f9;
      color: #64748b;
      border: 1px solid #e2e8f0;
    }

    .btn-secondary:hover:not(:disabled) {
      background: #e2e8f0;
    }

    .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: linear-gradient(135deg, #5a6fd8 0%, #6b4190 100%);
      transform: translateY(-1px);
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }

    .loading-spinner {
      width: 1rem;
      height: 1rem;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top: 2px solid white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @media (max-width: 768px) {
      .header-content {
        padding: 0 1rem;
      }

      .header-left {
        gap: 1rem;
      }

      .page-title {
        font-size: 1.5rem;
      }

      .form-container {
        padding: 1rem;
      }

      .company-form {
        padding: 1.5rem;
      }

      .form-actions {
        flex-direction: column;
      }
    }

    /* Subscription Section */
    .subscription-section {
      background: white;
      border-radius: 12px;
      padding: 2rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
    }

    .section-header h2 {
      font-size: 1.5rem;
      font-weight: 700;
      color: #1f2937;
      margin: 0;
    }

    .btn-add-subscription {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.5rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 0.5rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 0.875rem;
    }

    .btn-add-subscription:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 25px rgba(102, 126, 234, 0.4);
    }

    /* Subscription Table */
    .subscription-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8125rem;
    }

    .subscription-table thead {
      background: #f9fafb;
    }

    .subscription-table th {
      padding: 0.75rem 0.5rem;
      text-align: left;
      font-weight: 600;
      color: #6b7280;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 2px solid #e5e7eb;
    }

    .subscription-table td {
      padding: 0.75rem 0.5rem;
      border-bottom: 1px solid #f3f4f6;
    }

    .subscription-table tbody tr:hover {
      background: #f9fafb;
    }

    .store-info {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .store-name {
      font-weight: 600;
      color: #1f2937;
      font-size: 0.875rem;
    }

    .store-code {
      font-size: 0.75rem;
      color: #6b7280;
    }

    /* Badges */
    .tier-badge,
    .status-badge {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      border-radius: 9999px;
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .tier-freemium {
      background: #dbeafe;
      color: #1e40af;
    }

    .tier-standard {
      background: #e0e7ff;
      color: #5b21b6;
    }

    .tier-premium {
      background: #fef3c7;
      color: #92400e;
    }

    .tier-enterprise {
      background: #f3e8ff;
      color: #6b21a8;
    }

    .status-active {
      background: #d1fae5;
      color: #065f46;
    }

    .status-inactive {
      background: #f3f4f6;
      color: #6b7280;
    }

    .status-expired {
      background: #fee2e2;
      color: #991b1b;
    }

    .status-cancelled {
      background: #fed7aa;
      color: #9a3412;
    }

    /* Expiring Soon */
    td.expiring {
      color: #dc2626;
      font-weight: 600;
    }

    /* Action Buttons */
    .action-buttons {
      display: flex;
      gap: 0.375rem;
      flex-wrap: nowrap;
      align-items: center;
    }

    .btn-icon-action {
      padding: 0.375rem;
      border: 1px solid #d1d5db;
      background: white;
      border-radius: 0.375rem;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }

    .btn-icon-action .icon {
      width: 1rem;
      height: 1rem;
    }

    .btn-icon-action:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }

    .btn-icon-action[title]:hover::after {
      content: attr(title);
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      margin-bottom: 0.5rem;
      padding: 0.375rem 0.75rem;
      background: #1f2937;
      color: white;
      font-size: 0.75rem;
      border-radius: 0.375rem;
      white-space: nowrap;
      z-index: 10;
      pointer-events: none;
    }

    .btn-icon-action[title]:hover::before {
      content: '';
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      margin-bottom: 0.25rem;
      border: 4px solid transparent;
      border-top-color: #1f2937;
      z-index: 10;
      pointer-events: none;
    }

    .btn-upgrade {
      color: #667eea;
      border-color: #667eea;
    }

    .btn-upgrade:hover {
      background: #eef2ff;
      border-color: #667eea;
    }

    .btn-view {
      color: #10b981;
      border-color: #10b981;
    }

    .btn-view:hover {
      background: #d1fae5;
      border-color: #10b981;
    }

    .btn-billing {
      color: #8b5cf6;
      border-color: #8b5cf6;
    }

    .btn-billing:hover {
      background: #f5f3ff;
      border-color: #8b5cf6;
    }

    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 3rem;
      color: #6b7280;
    }

    .empty-icon {
      width: 4rem;
      height: 4rem;
      margin: 0 auto 1rem;
      color: #d1d5db;
    }

    .empty-state p {
      font-size: 1rem;
      margin: 0;
    }

    /* Responsive - Subscription Section */
    @media (max-width: 768px) {
      .header {
        padding: 1rem 0;
      }

      .header-content {
        padding: 0 1rem;
      }

      .page-title {
        font-size: 1.5rem;
      }

      .page-subtitle {
        font-size: 0.875rem;
      }

      .header-actions {
        width: 100%;
        flex-direction: column;
      }

      .btn {
        width: 100%;
        justify-content: center;
        font-size: 0.8125rem;
        padding: 0.625rem 1rem;
      }

      .content-container {
        padding: 1rem;
      }

      .tab-navigation {
        padding: 0.25rem;
      }

      .tab-button {
        padding: 0.625rem 0.75rem;
        font-size: 0.8125rem;
      }

      .tab-icon {
        width: 1rem;
        height: 1rem;
      }

      .subscription-section {
        padding: 1rem;
      }

      .section-header {
        flex-direction: column;
        gap: 1rem;
        align-items: flex-start;
      }

      .section-header h2 {
        font-size: 1.125rem;
      }

      .btn-add-subscription {
        width: 100%;
        justify-content: center;
        font-size: 0.8125rem;
        padding: 0.625rem 1rem;
      }

      .subscription-table {
        font-size: 0.75rem;
        display: block;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }

      .subscription-table thead,
      .subscription-table tbody,
      .subscription-table tr {
        display: block;
      }

      .subscription-table thead {
        display: none;
      }

      .subscription-table tr {
        margin-bottom: 1rem;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 0.75rem;
        background: white;
      }

      .subscription-table td {
        display: flex;
        justify-content: space-between;
        padding: 0.5rem 0;
        border-bottom: 1px solid #f3f4f6;
        font-size: 0.8125rem;
      }

      .subscription-table td:last-child {
        border-bottom: none;
      }

      .subscription-table td::before {
        content: attr(data-label);
        font-weight: 600;
        color: #6b7280;
        margin-right: 1rem;
      }

      .action-buttons {
        justify-content: flex-end;
        gap: 0.5rem;
      }

      .btn-icon-action {
        padding: 0.5rem;
      }

      .btn-icon-action[title]:hover::after,
      .btn-icon-action[title]:hover::before {
        display: none;
      }

      .form-container {
        padding: 0.75rem;
      }

      .company-form {
        padding: 1rem;
      }

      .form-group label {
        font-size: 0.8125rem;
      }

      .form-control {
        font-size: 0.875rem;
        padding: 0.625rem;
      }

      .form-actions {
        flex-direction: column;
      }
    }

    @media (max-width: 480px) {
      .page-title {
        font-size: 1.25rem;
      }

      .page-subtitle {
        font-size: 0.8125rem;
      }

      .btn {
        font-size: 0.75rem;
        padding: 0.5rem 0.875rem;
      }

      .subscription-table {
        font-size: 0.6875rem;
      }

      .subscription-table td {
        font-size: 0.75rem;
      }

      .section-header h2 {
        font-size: 1rem;
      }
    }
  `]
})
export class CompanyProfileComponent {
  private fb = inject(FormBuilder);
  private companyService = inject(CompanyService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private accessService = inject(AccessService);
  private storeService = inject(StoreService);
  private toastService = inject(ToastService);
  private billingService = inject(BillingService);
  private offlineDocService = inject(OfflineDocumentService);
  private subscriptionService = inject(SubscriptionService);

  protected profileForm: FormGroup;
  protected loading = signal(false);
  protected error = signal<string | null>(null);
  protected showSuccessMessage = signal(false);
  protected successMessage = signal('');
  // UI-only: Default checkbox to reuse company info for initial store setup
  protected useSameInfoForStore = signal(true);
  
  // Tab management
  protected activeTab = signal<'profile' | 'subscriptions'>('profile');
  
  // Subscription-related signals
  protected showSubscriptionModal = signal(false);
  protected selectedStore = signal<Store | undefined>(undefined);
  protected stores = signal<Store[]>([]);
  protected storeSubscriptions = signal<Record<string, { planType: string; startDate?: Date; endDate?: Date; status?: string }>>({});
  // Centralized upgrade modal state
  protected showUpgradeModal = signal(false);
  protected upgradeStoreId = signal<string>('');
  protected upgradeStoreName = signal<string>('');
  protected upgradeStoreCode = signal<string>('');
  // Initial values for the upgrade modal (forwarded from plan selection)
  protected upgradeInitialTier = signal<'standard' | 'premium' | undefined>(undefined);
  protected upgradeInitialDurationMonths = signal<number | undefined>(undefined);
  protected upgradeInitialPromoCode = signal<string | undefined>(undefined);
  protected upgradeInitialReferralCode = signal<string | undefined>(undefined);
  
  // Subscription details modal
  protected showSubscriptionDialog = signal(false);
  protected selectedStoreForDetails = signal<Store | undefined>(undefined);

  // Billing history modal
  protected showBillingHistoryModal = signal(false);
  protected selectedStoreForBillingHistory = signal<Store | undefined>(undefined);

  // Computed values
  protected currentCompany = computed<Company | undefined>(() => this.companyService.companies()[0]);
  // Explicit: whether current permission has no companyId
  protected noCompanyId = computed(() => {
    const cid = this.getPrimaryCompanyId();
    return !cid;
  });
  protected isCreatingCompany = computed(() => {
    // Primary signal: if there are no companies loaded for this user, we're in onboarding/create mode.
    const hasAnyCompany = (this.companyService.companies() || []).length > 0;
    if (hasAnyCompany) return false;

    // Fallback safety for edge cases before companies load: check both permission and IndexedDB-backed currentCompanyId
    const permCompanyId = this.getPrimaryCompanyId();
    const userCompanyId = this.authService.getCurrentUser()?.currentCompanyId?.trim();
    const hasCompanyFromPerm = !!(permCompanyId && permCompanyId !== '');
    const hasCompanyFromUser = !!(userCompanyId && userCompanyId !== '');
    return !(hasCompanyFromPerm || hasCompanyFromUser);
  });
  protected currentUser = computed(() => this.authService.getCurrentUser());
  protected permissions = computed(() => this.accessService.permissions);
  protected canEditOrAddCompanyProfile = computed(() => {
    // Always allow saving during initial company creation to enable onboarding,
    // regardless of granular permissions (e.g., visitor creating their first company).
    if (this.isCreatingCompany()) return true;

    const perms = this.permissions();
    return perms.canViewCompanyProfile && (perms.canEditCompanyProfile || perms.canAddCompanyProfile);
  });

  constructor() {
    this.profileForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['']
    });

    // Load companies and set up form subscription
    this.companyService.loadCompanies();

    // Set permissions based on user role
    // TEMPORARILY DISABLED: This was conflicting with dashboard permission setting
    /*
    effect(() => {
      const user = this.authService.getCurrentUser();
      if (user?.uid) {
        const userRole = this.userRoleService.getUserRoleByUserId(user.uid) as UserRole | undefined;
        const roleId = userRole?.roleId;
        if (roleId) {
          const roleDef = this.roleDefinitionService.getRoleDefinitionByRoleId(roleId) as RoleDefinition | undefined;
          const permissions = roleDef?.permissions;
          if (permissions) {
            this.accessService.setPermissions(permissions, roleId);
          } else {
            // If no role definition found, set permissions based on role alone
            this.accessService.setPermissions({}, roleId);
          }
        }
      }
    });
    */

    // Update form when company changes
    effect(() => {
      const company = this.currentCompany();
      const user = this.currentUser();
      
      if (company) {
        // Existing company - populate form
        this.profileForm.patchValue({
          name: company.name || '',
          email: company.email || '',
          phone: company.phone || ''
        });
        
        // Load stores when company exists
        this.loadStores();
      } else if (user && !this.getPrimaryCompanyId()) {
        // New company creation - pre-populate with user email if available
        this.profileForm.patchValue({
          name: '',
          email: user.email || '',
          phone: ''
        });
      }
    });
  }

  // Expose a template-friendly navigation helper
  protected navigateTo(path: string) {
    try {
      this.router.navigate([path]);
    } catch (e) {
      console.error('Navigation error:', e);
    }
  }

  // Normalize permission.companyId which may be a string or an array; return the first non-empty string
  private getPrimaryCompanyId(): string | undefined {
    const user: any = this.authService.getCurrentUser() as any;

    const pickFirstNonEmpty = (val: any): string | undefined => {
      if (Array.isArray(val)) {
        for (const v of val) {
          if (typeof v === 'string' && v.trim()) return v.trim();
        }
        return undefined;
      }
      if (typeof val === 'string') {
        const s = val.trim();
        return s || undefined;
      }
      return undefined;
    };

    // 1) From user document: companyId (string or array)
    const fromUserDoc = pickFirstNonEmpty(user?.companyId);
    if (fromUserDoc) return fromUserDoc;

    // 2) From user's currentCompanyId selection
    const fromCurrentSelection = pickFirstNonEmpty(user?.currentCompanyId);
    if (fromCurrentSelection) return fromCurrentSelection;

    // 3) From permissions array: first non-empty companyId
    const perms: any[] = Array.isArray(user?.permissions) ? user.permissions : [];
    const fromAnyPermission = pickFirstNonEmpty(perms.map(p => p?.companyId));
    if (fromAnyPermission) return fromAnyPermission;

    // 4) From current permission (which may itself hold string/array)
    const permission: any = this.authService.getCurrentPermission() as any;
    const fromPermission = pickFirstNonEmpty(permission?.companyId);
    if (fromPermission) return fromPermission;

    return undefined;
  }

  private async loadStores() {
    const companyId = this.getPrimaryCompanyId();
    if (!companyId) return;
    
    try {
      const storesData = await this.storeService.getStoresByCompany(companyId);
      this.stores.set(storesData);
      // Build latest subscription map for UI
      const subs: Record<string, { planType: string; startDate?: Date; endDate?: Date; status?: string }> = {};
      for (const s of storesData) {
        if (!s.id) continue;
        const latest = await this.subscriptionService.getSubscriptionForStore(s.companyId, s.id);
        if (latest?.data) {
          subs[s.id] = {
            planType: latest.data.planType,
            startDate: latest.data.startDate,
            endDate: latest.data.endDate,
            status: latest.data.status
          };
        }
      }
      this.storeSubscriptions.set(subs);
    } catch (error) {
      console.error('Error loading stores:', error);
    }
  }

  protected async onSubmit() {
    if (this.profileForm.valid) {
      try {
        this.loading.set(true);
        this.error.set(null);
        this.showSuccessMessage.set(false);
        
        const formData = this.profileForm.value;
        const isCreating = this.isCreatingCompany();
        
        if (isCreating) {
          // Create new company
          const companyData: Omit<Company, 'id' | 'createdAt' | 'updatedAt'> = {
            name: formData.name,
            slug: formData.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
            ownerUid: this.currentUser()?.uid || '',
            email: formData.email,
            phone: formData.phone
          };

          const newCompanyId = await this.companyService.createCompany(companyData);

          // Optionally create or update a default store using company info
          if (this.useSameInfoForStore()) {
            try {
              // Ensure we have the latest snapshot of stores for this company
              await this.storeService.loadStoresByCompany(newCompanyId);
              const existingStores = this.storeService.getStoresByCompany(newCompanyId);

              const baseStoreInfo = {
                storeName: formData.name,
                email: formData.email,
                phoneNumber: formData.phone || '',
                address: ''
              } as const;

              if (!existingStores || existingStores.length === 0) {
                const storePayload: Partial<Store> = {
                  ...baseStoreInfo,
                  companyId: newCompanyId
                };

                try {
                  const storeId = await this.storeService.createStore(storePayload as any);
                  // Create 14-day trial subscription in subscriptions collection and sync end date on store
                  const days = 14;
                  const now = new Date();
                  const trialEnds = new Date(now);
                  trialEnds.setDate(trialEnds.getDate() + days);
                  await this.subscriptionService.createTrial(newCompanyId, storeId, this.currentUser()?.uid || '', days);
                  await this.storeService.updateStore(storeId, { subscriptionEndDate: trialEnds });
                  this.toastService.success('Store created with a 14-day trial.');
                } catch (createErr) {
                  console.warn('⚠️ Failed to auto-create store from company info:', createErr);
                }
              } else {
                // Update the first existing store with any missing info
                const firstStore = existingStores[0];
                const updates: Partial<Store> = {};
                if (!firstStore.storeName && baseStoreInfo.storeName) updates.storeName = baseStoreInfo.storeName;
                if (!firstStore.email && baseStoreInfo.email) updates.email = baseStoreInfo.email;
                if (!firstStore.phoneNumber && baseStoreInfo.phoneNumber) updates.phoneNumber = baseStoreInfo.phoneNumber;
                if (!firstStore.address && baseStoreInfo.address !== undefined) updates.address = baseStoreInfo.address;
                // Initialize trial end if missing
                if (!firstStore.subscriptionEndDate) {
                  const days = 14;
                  const now = new Date();
                  const trialEnds = new Date(now);
                  trialEnds.setDate(trialEnds.getDate() + days);
                  await this.subscriptionService.createTrial(newCompanyId, firstStore.id!, this.currentUser()?.uid || '', days);
                  (updates as any).subscriptionEndDate = trialEnds;
                }

                if (Object.keys(updates).length > 0) {
                  try {
                    await this.storeService.updateStore(firstStore.id!, updates);
                    this.toastService.success('Existing store updated with company info.');
                  } catch (updateErr) {
                    console.warn('⚠️ Failed to update existing store with company info:', updateErr);
                  }
                }
              }
            } catch (prepErr) {
              console.warn('⚠️ Auto store create/update precheck failed:', prepErr);
            }
          }
          // Ensure default userRoles entry (creator) exists for this user at company level
          try {
            const user = this.authService.getCurrentUser();
            if (user && newCompanyId) {
              try {
                const { getFirestore, collection, query, where, getDocs } = await import('firebase/firestore');
                const firestore = getFirestore();
                const userRolesRef = collection(firestore, 'userRoles');
                const q = query(userRolesRef, where('companyId', '==', newCompanyId), where('userId', '==', user.uid));
                const snap = await getDocs(q);
                if (snap.empty) {
                  const userRole = {
                    companyId: newCompanyId,
                    storeId: '',
                    userId: user.uid,
                    email: user.email,
                    roleId: 'creator',
                    createdAt: new Date(),
                    updatedAt: new Date()
                  };
                  await this.offlineDocService.createDocument('userRoles', userRole);
                }
              } catch (checkErr) {
                console.warn('⚠️ userRoles check failed; creating offline entry:', checkErr);
                const userRole = {
                  companyId: newCompanyId,
                  storeId: '',
                  userId: user.uid,
                  email: user.email,
                  roleId: 'creator',
                  createdAt: new Date(),
                  updatedAt: new Date()
                };
                await this.offlineDocService.createDocument('userRoles', userRole);
              }
            }
          } catch (userRoleErr) {
            console.warn('⚠️ Failed to ensure default userRoles entry:', userRoleErr);
          }
          this.successMessage.set('Company created. You will be logged out so your new role can be applied.');
          this.showSuccessMessage.set(true);
          
          // Show success message, then force logout to apply new role
          setTimeout(async () => {
            this.showSuccessMessage.set(false);
            this.successMessage.set('');
            await this.authService.logout();
          }, 2000);
          
        } else {
          // Update existing company
          const company = this.currentCompany();
          if (company) {
            const updateData: Partial<Company> = {
              name: formData.name,
              email: formData.email,
              phone: formData.phone,
              updatedAt: new Date()
            };

            await this.companyService.updateCompany(company.id!, updateData);
            this.successMessage.set('Company profile updated successfully!');
            this.showSuccessMessage.set(true);
            
            // Hide success message after 3 seconds
            setTimeout(() => {
              this.showSuccessMessage.set(false);
              this.successMessage.set('');
            }, 3000);
            
            // Reload companies to refresh the view
            await this.companyService.loadCompanies();
          }
        }
      } catch (error) {
        this.error.set(this.isCreatingCompany() ? 'Failed to create company profile' : 'Failed to update company profile');
        console.error('Error with company profile:', error);
      } finally {
        this.loading.set(false);
      }
    }
  }

  protected resetForm() {
    const company = this.currentCompany();
    const user = this.currentUser();
    
    if (company) {
      // Reset to existing company data
      this.profileForm.patchValue({
        name: company.name || '',
        email: company.email || '',
        phone: company.phone || ''
      });
    } else if (user) {
      // Reset to initial state for new company
      this.profileForm.patchValue({
        name: '',
        email: user.email || '',
        phone: ''
      });
    }
  }

  // Removed unused createNewCompany() button handler

  // Subscription Management Methods
  protected openSubscriptionModal(store?: Store) {
    // If no store is passed but we have stores available
    if (!store && this.stores().length > 0) {
      // If there's only one store, use it automatically
      if (this.stores().length === 1) {
        store = this.stores()[0];
      } else {
        // Multiple stores - should not happen with current button logic
        // but handle gracefully
        this.toastService.warning('Please select a store from the table');
        return;
      }
    }
    
    this.selectedStore.set(store);
    this.showSubscriptionModal.set(true);
  }

  protected closeSubscriptionModal() {
    this.showSubscriptionModal.set(false);
    this.selectedStore.set(undefined);
  }

  protected async handleSubscription(data: any) {
    try {
      const store = this.selectedStore();
      if (!store || !store.id) {
        this.toastService.error('Store information is missing. Please try again.');
        return;
      }

      // Validate required fields
      if (!data.tier || !data.billingCycle) {
        this.toastService.error('Missing subscription details. Please try again.');
        console.error('Missing subscription data:', data);
        return;
      }

      this.loading.set(true);

      // Calculate duration in months
      let durationMonths = 1;
      switch (data.billingCycle) {
        case 'monthly':
          durationMonths = 1;
          break;
        case 'quarterly':
          durationMonths = 3;
          break;
        case 'yearly':
          durationMonths = 12;
          break;
      }

      // Determine paid subscription scheduling based on remaining trial
      const now = new Date();
      const latest = this.storeSubscriptions()[store.id] || {};
      const trialEnd = latest.endDate || store.subscriptionEndDate;
      const paidStart: Date = trialEnd && trialEnd > now ? trialEnd : now;

      // Create paid subscription in subscriptions collection
      const companyId = this.currentCompany()?.id || '';
      await this.subscriptionService.createPaid(
        companyId,
        store.id!,
        this.currentUser()?.uid || '',
        data.tier,
        paidStart,
        durationMonths,
        data.amountPaid || 0,
        {
          promoCode: data.promoCode || undefined,
          referralCode: data.referralCode || undefined,
          paymentMethod: data.paymentMethod || 'gcash'
        }
      );

      // Compute paid end based on start
      const paidEnd = new Date(paidStart);
      if (data.billingCycle === 'monthly') paidEnd.setMonth(paidEnd.getMonth() + 1);
      if (data.billingCycle === 'quarterly') paidEnd.setMonth(paidEnd.getMonth() + 3);
      if (data.billingCycle === 'yearly') paidEnd.setFullYear(paidEnd.getFullYear() + 1);
      await this.storeService.updateStore(store.id!, { subscriptionEndDate: paidEnd });

      // Create billing history record
      if (companyId) {
        await this.billingService.createBillingHistory({
          companyId: companyId,
          storeId: store.id!,
          tier: data.tier,
          cycle: data.billingCycle,
          durationMonths: durationMonths,
          amount: data.amountPaid || 0,
          discountPercent: data.discountPercent || 0,
          finalAmount: data.finalAmount || data.amountPaid || 0,
          promoCode: data.promoCode || '',
          referralCode: data.referralCode || '',
          paymentMethod: data.paymentMethod || 'gcash',
          paidAt: new Date()
        });
        // Billing history record created
      }

      this.toastService.success('Subscription activated successfully! 🎉');
      this.closeSubscriptionModal();
      await this.loadStores(); // Reload stores to show updated subscription
    } catch (error: any) {
      console.error('Error activating subscription:', error);
      
      // Show specific error message
      let errorMessage = 'Failed to activate subscription. Please try again.';
      
      if (error?.code === 'permission-denied') {
        errorMessage = 'Permission denied. Please check your access rights.';
      } else if (error?.code === 'unavailable') {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (error?.message) {
        errorMessage = `Error: ${error.message}`;
      }
      
      this.toastService.error(errorMessage);
    } finally {
      this.loading.set(false);
    }
  }

  // Open centralized upgrade modal when subscription modal requests it
  protected openUpgradeFromModal(payload: any) {
    const store = this.selectedStore();
    if (!store || !store.id) {
      this.toastService.error('Store information is missing. Please select a store first.');
      return;
    }

    // Close the smaller subscription modal and open the full upgrade modal
    this.showSubscriptionModal.set(false);
    this.upgradeStoreId.set(store.id);
    this.upgradeStoreName.set(store.storeName || '');
  this.upgradeStoreCode.set((store as any).storeCode || '');
    // Prefill initial values for the upgrade modal
    const tier = payload?.tier === 'premium' ? 'premium' : 'standard';
    this.upgradeInitialTier.set(tier as 'standard' | 'premium');
    const months = typeof payload?.durationMonths === 'number' && payload.durationMonths > 0 ? payload.durationMonths : 1;
    this.upgradeInitialDurationMonths.set(months);
    this.upgradeInitialPromoCode.set(payload?.promoCode || undefined);
    this.upgradeInitialReferralCode.set(payload?.referralCode || undefined);
    this.showUpgradeModal.set(true);
  }

  protected closeUpgradeModal() {
    this.showUpgradeModal.set(false);
    this.upgradeStoreId.set('');
    this.upgradeStoreName.set('');
  this.upgradeStoreCode.set('');
    // Clear initial values
    this.upgradeInitialTier.set(undefined);
    this.upgradeInitialDurationMonths.set(undefined);
    this.upgradeInitialPromoCode.set(undefined);
    this.upgradeInitialReferralCode.set(undefined);
  }

  protected async onUpgradeCompleted() {
    // After successful upgrade, reload stores to refresh subscription info
    this.closeUpgradeModal();
    try {
      await this.loadStores();
      this.toastService.success('Subscription updated successfully');
    } catch (err) {
      console.warn('Failed to reload stores after upgrade:', err);
    }
  }

  protected upgradeSubscription(store: Store) {
    this.openSubscriptionModal(store);
  }

  protected viewSubscriptionDetails(store: Store) {
    // Show detailed subscription information
    const sub = this.storeSubscriptions()[store.id || ''];
    if (!sub) {
      this.toastService.info('No subscription found for this store.');
      return;
    }

    // Set the store and show the modal
    this.selectedStoreForDetails.set(store);
    this.showSubscriptionDialog.set(true);
  }

  protected closeSubscriptionDialog() {
    this.showSubscriptionDialog.set(false);
    this.selectedStoreForDetails.set(undefined);
  }

  protected openBillingHistory(store: Store) {
    this.selectedStoreForBillingHistory.set(store);
    this.showBillingHistoryModal.set(true);
  }

  protected closeBillingHistoryModal() {
    this.showBillingHistoryModal.set(false);
    this.selectedStoreForBillingHistory.set(undefined);
  }

  protected getTierBadgeClass(tier: string): string {
    const baseClasses = 'tier-badge';
    switch (tier) {
      case 'freemium': return `${baseClasses} tier-freemium`;
      case 'standard': return `${baseClasses} tier-standard`;
      case 'premium': return `${baseClasses} tier-premium`;
      case 'enterprise': return `${baseClasses} tier-enterprise`;
      default: return baseClasses;
    }
  }

  protected getStatusBadgeClass(status: string): string {
    const baseClasses = 'status-badge';
    switch (status) {
      case 'active': return `${baseClasses} status-active`;
      case 'inactive': return `${baseClasses} status-inactive`;
      case 'expired': return `${baseClasses} status-expired`;
      case 'cancelled': return `${baseClasses} status-cancelled`;
      default: return baseClasses;
    }
  }

  protected formatDate(date: Date | undefined): string {
    if (!date) return 'N/A';
    
    // Handle Firestore Timestamp
    let dateObj: Date;
    if (date && typeof date === 'object' && 'toDate' in date) {
      dateObj = (date as any).toDate();
    } else {
      dateObj = new Date(date);
    }
    
    // Check if date is valid
    if (isNaN(dateObj.getTime())) return 'N/A';
    
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  protected isExpiringSoon(expiresAt: Date | undefined): boolean {
    if (!expiresAt) return false;
    const daysUntilExpiry = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  }

  private calculateExpiryDate(billingCycle: 'monthly' | 'quarterly' | 'yearly' | 'trial14'): Date {
    const expiresAt = new Date();
    switch (billingCycle) {
      case 'monthly':
        expiresAt.setMonth(expiresAt.getMonth() + 1);
        break;
      case 'quarterly':
        expiresAt.setMonth(expiresAt.getMonth() + 3);
        break;
      case 'yearly':
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
        break;
      case 'trial14':
        expiresAt.setDate(expiresAt.getDate() + 14);
        break;
    }
    return expiresAt;
  }

  // Tab management
  protected setActiveTab(tab: 'profile' | 'subscriptions') {
    this.activeTab.set(tab);
  }

  // Subscription summary helpers for template
  protected getStoreTier(store: Store): string {
    const sub = this.storeSubscriptions()[store.id || ''];
    return sub?.planType || 'freemium';
  }

  protected getStoreStatus(store: Store): string {
    const sub = this.storeSubscriptions()[store.id || ''];
    const now = new Date();
    const start = sub?.startDate;
    const end = sub?.endDate || store.subscriptionEndDate;
    if (!end) return 'inactive';
    if (start && now < start) return 'inactive';
    if (now <= end) return 'active';
    return 'expired';
  }

  protected getStoreSubscribedAt(store: Store): Date | undefined {
    const sub = this.storeSubscriptions()[store.id || ''];
    return sub?.startDate;
  }

  protected getStoreExpiresAt(store: Store): Date | undefined {
    const sub = this.storeSubscriptions()[store.id || ''];
    return sub?.endDate || store.subscriptionEndDate;
  }
}
