import { Component, OnInit, ChangeDetectorRef, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { StoreService, Store } from '../../../services/store.service';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../shared/services/toast.service';
import { PredefinedTypesService, PredefinedType } from '../../../services/predefined-types.service';
import { DeviceService, Device } from '../../../services/device.service';
import { ExpenseService } from '../../../services/expense.service';
import { ConfirmationDialogComponent, ConfirmationDialogData } from '../../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { UpgradeSubscriptionModalComponent } from '../subscriptions/upgrade-subscription-modal.component';
import { SubscriptionService } from '../../../services/subscription.service';
import { UserRolesEnum } from '../../../shared/enums/user-roles.enum';
import { Subscription as SubscriptionDoc } from '../../../interfaces/subscription.interface';
import { Timestamp } from '@angular/fire/firestore';

@Component({
  selector: 'app-stores-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ConfirmationDialogComponent, UpgradeSubscriptionModalComponent],
  template: `
    <div class="stores-management">
      <!-- Header -->
      <div class="header">
        <div class="header-content">
          <div class="header-text">
            <h1 class="page-title">Store Management</h1>
            <p class="page-subtitle">Manage your company stores and locations</p>
          </div>
          <div class="header-actions">
            <button class="btn btn-primary" (click)="openAddStoreModal()">
              Add New Store
            </button>
          </div>
        </div>
      </div>

      <!-- Search and Filters -->
      <div class="filters-section">
        <div class="search-container">
          <input 
            type="text" 
            [(ngModel)]="searchTerm"
            (input)="onSearchChange()"
            placeholder="Search stores by name, code, or type..."
            class="search-input">
          <button class="btn-gradient" (click)="clearSearch()" title="Clear search" aria-label="Clear search">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm3.54 12.46-1.08 1.08L12 13.08l-2.46 2.46-1.08-1.08L10.92 12 8.46 9.54l1.08-1.08L12 10.92l2.46-2.46 1.08 1.08L13.08 12l2.46 2.46z"/>
            </svg>
            Clear
          </button>
        </div>
      </div>

      <!-- Stores Table -->
      <div class="table-container">
        <div class="table-header">
          <h3>Stores ({{ filteredStores.length }})</h3>
          <button 
            class="btn-icon-action" 
            (click)="refreshStores()"
            title="Refresh stores"
            aria-label="Refresh stores">
            🔄
          </button>
        </div>

        <div class="table-wrapper" *ngIf="filteredStores.length > 0">
          <div class="table-scroll">
            <table class="stores-table">
            <thead>
              <tr>
                <th>Store Name</th>
                <th>Branch Name</th>
                <th>Store Type</th>
                <th>BIR Status</th>
                <th>Subscription</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let store of filteredStores">
                <td class="store-name-cell">{{ store.storeName }}</td>
                <td class="branch-name-cell">{{ store.branchName || '-' }}</td>
                <td class="store-type-cell">{{ store.storeType }}</td>
                <td class="bir-status-cell">
                  <span class="status-badge" [class]="store.isBirAccredited ? 'status-active' : 'status-inactive'">
                    {{ store.isBirAccredited ? 'BIR Accredited' : 'Not Accredited' }}
                  </span>
                </td>
                <td class="subscription-cell">
                  <div class="subscription-cell-content">
                    <span class="subscription-badge" [class]="'subscription-' + (getStoreTier(store))">
                      {{ (getStoreTier(store)) | titlecase }}
                    </span>
                    <div class="subscription-expiry" 
                         *ngIf="getStoreExpiresAt(store) as exp"
                         [class.expiry-soon]="isExpiringSoon(exp)">
                      <span class="label">Expires:</span>
                      <span class="value">{{ formatDate(exp) }}</span>
                      <span class="days-left" *ngIf="isExpiringSoon(exp)">
                        ({{ getDaysUntilExpiry(exp) }} days left)
                      </span>
                    </div>
                  </div>
                </td>
                <td class="status-cell">
                  <label class="toggle-switch" 
                         [class.disabled]="true"
                         [title]="isStoreExpired(store) ? 'Expired — status set to Inactive automatically' : 'Active — managed by subscription'">
                    <input 
                      type="checkbox" 
                      [checked]="getEffectiveStatus(store) === 'active'"
                      [disabled]="true">
                    <span class="toggle-slider"></span>
                  </label>
                </td>
                <td class="actions-cell">
                  <div class="action-buttons">
                    <button 
                      class="btn-icon-action btn-edit"
                      (click)="editStore(store)"
                      title="Edit Store">
                      ✏️
                    </button>
                    <button 
                      class="btn-icon-action btn-bir"
                      (click)="openBirComplianceModal(store)"
                      [title]="canManageBirCompliance() ? 'BIR Compliance' : 'BIR Compliance (View Only)'">
                      📋
                    </button>
                    <button 
                      class="btn-icon-action btn-devices"
                      (click)="openDevicesModal(store)"
                      [title]="canManageDevices() ? 'Manage Devices' : 'Device Management (View Only)'">
                      💻
                    </button>
                    <button
                      class="btn-icon-action btn-expense"
                      (click)="openExpenseLog(store)"
                      title="Expense Log">
                      💸
                    </button>
                    <button 
                      class="btn-icon-action btn-upgrade"
                      (click)="openUpgradeModal(store)"
                      title="Upgrade Subscription">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="icon">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
            </table>
          </div>
        </div>

        <!-- Empty State -->
        <div class="empty-state" *ngIf="filteredStores.length === 0 && !isLoading">
          <div class="empty-content">
            <h3>No Stores Found</h3>
            <p *ngIf="searchTerm">No stores match your search criteria.</p>
            <p *ngIf="!searchTerm">No stores have been created yet.</p>
            <button class="btn btn-primary" (click)="openAddStoreModal()">
              Create First Store
            </button>
          </div>
        </div>

        <!-- Loading State -->
        <div class="loading-state" *ngIf="isLoading">
          <div class="loading-content">
            <div class="spinner"></div>
            <p>Loading stores...</p>
          </div>
        </div>
      </div>

      <!-- Add/Edit Store Modal -->
      <div class="modal-overlay" 
           *ngIf="showStoreModal" 
           (click)="cancelStoreModal()"
           style="position: fixed !important; z-index: 9999 !important; background: rgba(0, 0, 0, 0.8) !important;">
        <div class="modal store-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editingStore ? '✏️ Edit Store' : '🏪 Add New Store' }}</h3>
            <button class="close-btn" (click)="cancelStoreModal()">×</button>
          </div>
          <div class="modal-body">
            <form [formGroup]="storeForm">
              <!-- Basic Information Section -->
              <div class="form-section">
                <h4 class="section-title">
                  <span>📋</span>
                  <span>Basic Information</span>
                </h4>
                
                <div class="form-group">
                  <label for="storeName">Store Name</label>
                  <input 
                    type="text" 
                    id="storeName"
                    formControlName="storeName"
                    placeholder="Enter store name"
                    class="form-input">
                  <div class="error-message" *ngIf="storeForm.get('storeName')?.invalid && storeForm.get('storeName')?.touched">
                    Store name is required
                  </div>
                </div>

                <div class="form-group">
                  <label for="branchName">Branch Name</label>
                  <input 
                    type="text" 
                    id="branchName"
                    formControlName="branchName"
                    placeholder="e.g., Main Branch, Cebu Branch"
                    class="form-input">
                </div>

                <div class="form-group">
                  <label for="storeType">Store Type</label>
                  <select 
                    id="storeType"
                    formControlName="storeType"
                    class="form-input">
                    <option value="">Select store type</option>
                    <option 
                      *ngFor="let storeType of storeTypes" 
                      [value]="storeType.typeLabel"
                      [title]="storeType.typeDescription">
                      {{ storeType.typeLabel }}
                    </option>
                  </select>
                  <div class="error-message" *ngIf="storeForm.get('storeType')?.invalid && storeForm.get('storeType')?.touched">
                    Store type is required
                  </div>
                </div>

                <div class="form-group">
                  <label for="status">Status</label>
                  <select 
                    id="status"
                    formControlName="status"
                    class="form-input"
                    [class.status-active]="storeForm.get('status')?.value === 'active'"
                    [class.status-inactive]="storeForm.get('status')?.value === 'inactive'">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <!-- Location Information Section -->
              <div class="form-section">
                <h4 class="section-title">
                  <span>📍</span>
                  <span>Location Information</span>
                </h4>
                
                <div class="form-group">
                  <label for="address">Address</label>
                  <textarea 
                    id="address"
                    formControlName="address"
                    placeholder="Enter complete address"
                    class="form-input"
                    rows="3"></textarea>
                  <div class="error-message" *ngIf="storeForm.get('address')?.invalid && storeForm.get('address')?.touched">
                    Address is required
                  </div>
                </div>
              </div>

              <!-- Contact Information Section -->
              <div class="form-section">
                <h4 class="section-title">
                  <span>📞</span>
                  <span>Contact Information</span>
                </h4>
                
                <div class="form-group">
                  <label for="phoneNumber">Phone Number</label>
                  <input 
                    type="tel" 
                    id="phoneNumber"
                    formControlName="phoneNumber"
                    placeholder="Enter phone number"
                    class="form-input">
                </div>

                <div class="form-group">
                  <label for="email">Email</label>
                  <input 
                    type="email" 
                    id="email"
                    formControlName="email"
                    placeholder="Enter email address"
                    class="form-input">
                </div>
              </div>

              <!-- Business Information Section -->
              <div class="form-section">
                <h4 class="section-title">
                  <span>💼</span>
                  <span>Business Information</span>
                </h4>
                
                <div class="form-group">
                  <label for="tinNumber">TIN Number</label>
                  <input 
                    type="text" 
                    id="tinNumber"
                    formControlName="tinNumber"
                    placeholder="000-000-000-000"
                    class="form-input">
                </div>

                <!-- Store Logo Upload -->
                <div class="form-group">
                  <label for="logoUrl">Store Logo</label>
                  <div class="logo-upload-section" style="display: flex; align-items: center; gap: 12px;">
                    <!-- Logo Preview -->
                    <div class="logo-preview" style="width: 60px; height: 60px; border: 2px dashed #ddd; border-radius: 8px; display: flex; align-items: center; justify-content: center; background: #f8f9fa;">
                      <img *ngIf="storeForm.get('logoUrl')?.value" 
                           [src]="storeForm.get('logoUrl')?.value" 
                           style="width: 56px; height: 56px; object-fit: cover; border-radius: 6px;"
                           alt="Store Logo">
                      <span *ngIf="!storeForm.get('logoUrl')?.value" style="color: #666; font-size: 12px;">No Logo</span>
                    </div>
                    
                    <!-- Upload Controls -->
                    <div style="flex: 1;">
                      <button 
                        type="button" 
                        class="btn btn-primary btn-sm"
                        (click)="triggerLogoUpload()"
                        [disabled]="isLoading">
                        📷 Upload Logo
                      </button>
                      <button 
                        type="button" 
                        class="btn btn-secondary btn-sm"
                        (click)="clearLogo()"
                        *ngIf="storeForm.get('logoUrl')?.value"
                        style="margin-left: 8px;">
                        🗑️ Remove
                      </button>
                      <div style="font-size: 12px; color: #666; margin-top: 4px;">
                        Recommended: 400x400px, max 2MB (PNG, JPG, WebP)
                      </div>
                    </div>
                    
                    <!-- Hidden File Input -->
                    <input 
                      type="file" 
                      id="hiddenLogoFile"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      (change)="onLogoFileChange($event)"
                      style="display: none;">
                  </div>
                  
                  <!-- URL Input (for manual entry if needed) -->
                  <details style="margin-top: 8px;">
                    <summary style="cursor: pointer; color: #666; font-size: 12px;">Enter URL manually</summary>
                    <input 
                      type="text" 
                      id="logoUrl"
                      formControlName="logoUrl"
                      placeholder="https://..."
                      class="form-input"
                      style="margin-top: 8px; font-size: 12px;">
                  </details>
                </div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="cancelStoreModal()">Cancel</button>
            <button 
              class="btn btn-primary" 
              (click)="saveStore()"
              [disabled]="!storeForm.valid || isLoading">
              {{ isLoading ? 'Saving...' : (editingStore ? 'Update Store' : 'Create Store') }}
            </button>
          </div>
        </div>
      </div>

      <!-- BIR Compliance Modal -->
      <div class="modal-overlay" 
           *ngIf="showBirModal" 
           (click)="closeBirModal()"
           style="position: fixed !important; z-index: 9999 !important; background: rgba(0, 0, 0, 0.8) !important;">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>📋 BIR Compliance{{ !canManageBirCompliance() ? ' (View Only)' : '' }} - {{ selectedStore?.storeName }}</h3>
            <button class="close-btn" (click)="closeBirModal()">×</button>
          </div>
          <div class="modal-body">
            <div *ngIf="!canManageBirCompliance()" class="view-only-notice">
              <p><strong>View Only Mode:</strong> You can view BIR compliance information but cannot make changes. Contact your administrator to modify these settings.</p>
            </div>
            <form [formGroup]="birForm">
              <div class="form-group">
                <label for="birPermitNo">BIR Permit Number *</label>
                <input 
                  type="text" 
                  id="birPermitNo"
                  formControlName="birPermitNo"
                  placeholder="BIR-PERMIT-2025-XXXXX"
                  class="form-input"
                  [readonly]="!canManageBirCompliance()"
                  [class.readonly]="!canManageBirCompliance()">
              </div>

              <div class="form-group">
                <label for="atpOrOcn">ATP / OCN Number *</label>
                <input 
                  type="text" 
                  id="atpOrOcn"
                  formControlName="atpOrOcn"
                  placeholder="OCN-2025-XXXXXX"
                  class="form-input"
                  [readonly]="!canManageBirCompliance()"
                  [class.readonly]="!canManageBirCompliance()">
              </div>

              <div class="form-group">
                <label for="permitDateIssued">Permit Date Issued *</label>
                <input 
                  type="date" 
                  id="permitDateIssued"
                  formControlName="permitDateIssued"
                  class="form-input"
                  [readonly]="!canManageBirCompliance()"
                  [class.readonly]="!canManageBirCompliance()">
              </div>

              <div class="form-group">
                <label for="validityNotice">Validity Notice</label>
                <textarea 
                  id="validityNotice"
                  formControlName="validityNotice"
                  placeholder="e.g., Valid for 5 years from permit date"
                  class="form-textarea"
                  rows="2"
                  [readonly]="!canManageBirCompliance()"
                  [class.readonly]="!canManageBirCompliance()"></textarea>
              </div>

              <div class="form-group">
                <label for="vatRegistrationType">VAT Registration Type *</label>
                <select 
                  id="vatRegistrationType"
                  formControlName="vatRegistrationType"
                  class="form-select"
                  [disabled]="!canManageBirCompliance()"
                  [class.readonly]="!canManageBirCompliance()">
                  <option value="VAT-registered">VAT Registered</option>
                  <option value="Non-VAT">Non-VAT</option>
                  <option value="VAT-exempt">VAT Exempt</option>
                </select>
              </div>

              <div class="form-group">
                <label for="vatRate">VAT Rate (%)</label>
                <input 
                  type="number" 
                  id="vatRate"
                  formControlName="vatRate"
                  placeholder="12.0"
                  step="0.1"
                  class="form-input"
                  [readonly]="!canManageBirCompliance()"
                  [class.readonly]="!canManageBirCompliance()">
              </div>

              <div class="form-group">
                <label for="receiptType">Receipt Type *</label>
                <select 
                  id="receiptType"
                  formControlName="receiptType"
                  class="form-select"
                  [disabled]="!canManageBirCompliance()"
                  [class.readonly]="!canManageBirCompliance()">
                  <option value="POS Receipt">POS Receipt</option>
                  <option value="Sales Invoice">Sales Invoice</option>
                  <option value="Official Receipt">Official Receipt</option>
                </select>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeBirModal()">{{ canManageBirCompliance() ? 'Cancel' : 'Close' }}</button>
            <button 
              *ngIf="canManageBirCompliance()"
              class="btn btn-primary" 
              (click)="saveBirCompliance()"
              [disabled]="!birForm.valid || isLoading">
              {{ isLoading ? 'Saving...' : 'Save BIR Compliance' }}
            </button>
          </div>
        </div>

          <!-- Expense Log Modal (moved to root level) -->
      </div>

      <!-- Devices Modal -->
      <div class="modal-overlay" 
           *ngIf="showDevicesModal" 
           (click)="closeDevicesModal()"
           style="position: fixed !important; z-index: 9999 !important; background: rgba(0, 0, 0, 0.8) !important;">
        <div class="modal modal-large" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>💻 {{ canManageDevices() ? 'Manage Devices' : 'View Devices (View Only)' }} - {{ selectedStore?.storeName }}</h3>
            <button class="close-btn" (click)="closeDevicesModal()">×</button>
          </div>
          <div class="modal-body">
            <div *ngIf="!canManageDevices()" class="view-only-notice">
              <p><strong>View Only Mode:</strong> You can view device information but cannot make changes. Contact your administrator to modify device settings.</p>
            </div>
            <!-- Add Device Button -->
            <div class="devices-header" *ngIf="!showDeviceForm && canManageDevices()">
              <button class="btn btn-primary btn-sm" (click)="showAddDeviceForm()">
                ➕ Add New Device
              </button>
            </div>

            <!-- Device Form (Add/Edit) -->
            <div class="device-form-container" *ngIf="showDeviceForm && canManageDevices()">
              <h4>{{ editingDevice ? 'Edit Device' : 'Add New Device' }}</h4>
              <form [formGroup]="deviceForm">
                <div class="form-row">
                  <div class="form-group">
                    <label for="terminalId">Terminal ID *</label>
                    <input 
                      type="text" 
                      id="terminalId"
                      formControlName="terminalId"
                      placeholder="TERM001"
                      class="form-input">
                  </div>

                  <div class="form-group">
                    <label for="deviceLabel">Device Label *</label>
                    <input 
                      type="text" 
                      id="deviceLabel"
                      formControlName="deviceLabel"
                      placeholder="TechMart Terminal 1"
                      class="form-input">
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label for="invoicePrefix">Invoice Prefix *</label>
                    <input 
                      type="text" 
                      id="invoicePrefix"
                      formControlName="invoicePrefix"
                      placeholder="INV-MKT-001"
                      class="form-input">
                  </div>

                  <div class="form-group">
                    <label for="currentInvoiceNumber">Current Invoice Number *</label>
                    <input 
                      type="number" 
                      id="currentInvoiceNumber"
                      formControlName="currentInvoiceNumber"
                      placeholder="100123"
                      class="form-input">
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label for="invoiceSeriesStart">Series Start *</label>
                    <input 
                      type="number" 
                      id="invoiceSeriesStart"
                      formControlName="invoiceSeriesStart"
                      placeholder="100001"
                      class="form-input">
                  </div>

                  <div class="form-group">
                    <label for="invoiceSeriesEnd">Series End *</label>
                    <input 
                      type="number" 
                      id="invoiceSeriesEnd"
                      formControlName="invoiceSeriesEnd"
                      placeholder="199999"
                      class="form-input">
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label for="minNumber">MIN Number *</label>
                    <input 
                      type="text" 
                      id="minNumber"
                      formControlName="minNumber"
                      placeholder="MIN-2025-456789012"
                      class="form-input">
                  </div>

                  <div class="form-group">
                    <label for="serialNumber">Serial Number *</label>
                    <input 
                      type="text" 
                      id="serialNumber"
                      formControlName="serialNumber"
                      placeholder="SN-2025-000888"
                      class="form-input">
                  </div>
                </div>

                <div class="form-actions">
                  <button type="button" class="btn btn-secondary btn-sm" (click)="cancelDeviceForm()">Cancel</button>
                  <button 
                    type="button" 
                    class="btn btn-primary btn-sm" 
                    (click)="saveDevice()"
                    [disabled]="!deviceForm.valid || isLoadingDevices">
                    {{ isLoadingDevices ? 'Saving...' : (editingDevice ? 'Update Device' : 'Add Device') }}
                  </button>
                </div>
              </form>
            </div>

            <!-- Devices List -->
            <div class="devices-list" *ngIf="!showDeviceForm">
              <div *ngIf="isLoadingDevices" class="loading-text">Loading devices...</div>
              
              <div *ngIf="!isLoadingDevices && storeDevices.length === 0" class="empty-devices">
                <p>No devices configured for this store yet.</p>
                <p class="hint">Click "Add New Device" to configure your first device.</p>
              </div>

              <div *ngIf="!isLoadingDevices && storeDevices.length > 0" class="devices-grid">
                <div *ngFor="let device of storeDevices" class="device-card">
                  <div class="device-card-header">
                    <h5>{{ device.deviceLabel }}</h5>
                    <div class="device-actions" *ngIf="canManageDevices()">
                      <button class="btn-icon-sm" (click)="editDevice(device)" title="Edit">✏️</button>
                      <button class="btn-icon-sm" (click)="deleteDevice(device)" title="Delete">🗑️</button>
                    </div>
                    <div class="device-actions" *ngIf="!canManageDevices()">
                      <span class="view-only-badge">View Only</span>
                    </div>
                  </div>
                  <div class="device-card-body">
                    <div class="device-info-row">
                      <span class="label">Terminal ID:</span>
                      <span class="value">{{ device.terminalId }}</span>
                    </div>
                    <div class="device-info-row">
                      <span class="label">Invoice Prefix:</span>
                      <span class="value">{{ device.invoicePrefix }}</span>
                    </div>
                    <div class="device-info-row">
                      <span class="label">Current Invoice:</span>
                      <span class="value">{{ device.currentInvoiceNumber }}</span>
                    </div>
                    <div class="device-info-row">
                      <span class="label">Series Range:</span>
                      <span class="value">{{ device.invoiceSeriesStart }} - {{ device.invoiceSeriesEnd }}</span>
                    </div>
                    <div class="device-info-row">
                      <span class="label">MIN:</span>
                      <span class="value">{{ device.minNumber }}</span>
                    </div>
                    <div class="device-info-row">
                      <span class="label">Serial:</span>
                      <span class="value">{{ device.serialNumber }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer" *ngIf="!showDeviceForm">
            <button class="btn btn-secondary" (click)="closeDevicesModal()">Close</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Confirmation Dialog -->
    <app-confirmation-dialog
      *ngIf="isConfirmationDialogVisible() && confirmationDialogData()"
      [dialogData]="confirmationDialogData()!"
      (confirmed)="onConfirmationConfirmed()"
      (cancelled)="onConfirmationCancelled()">
    </app-confirmation-dialog>

    <!-- Upgrade Subscription Modal -->
    <app-upgrade-subscription-modal
      [isOpen]="upgradeModalOpen"
      [companyId]="currentCompanyId || ''"
      [storeId]="upgradeTarget?.id || ''"
      [storeName]="upgradeTarget?.storeName || ''"
      [storeCode]="upgradeTarget?.storeCode || ''"
      (closeModal)="closeUpgradeModal()"
      (completed)="onUpgradeCompleted()"
    ></app-upgrade-subscription-modal>

    <!-- Expense Log Modal (root-level) -->
    <div class="modal-overlay expense-overlay" 
         *ngIf="showExpenseModal" 
         (click)="cancelExpenseModal()"
         style="position: fixed !important; z-index: 1000001 !important; background: rgba(0, 0, 0, 0.8) !important;">
      <div class="modal modal-large" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>💸 Expense Log - {{ selectedStore?.storeName }}</h3>
          <button class="close-btn" (click)="cancelExpenseModal()">×</button>
        </div>
        <div class="modal-body">
          <div class="expense-tabs" style="display:flex; gap:12px; align-items:center; margin-bottom:1rem;">
            <button class="btn btn-secondary" [class.active]="expenseTab === 'recent'" (click)="setExpenseTab('recent')">Recent Expenses</button>
            <button class="btn btn-secondary" [class.active]="expenseTab === 'add'" (click)="setExpenseTab('add')">Add Expense</button>
          </div>

          <div class="expense-grid">
            <!-- Recent tab -->
            <div *ngIf="expenseTab === 'recent'" class="expense-list" style="margin-bottom: 1rem;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <h4 style="margin:0">Recent Expenses</h4>
                <button class="btn btn-primary btn-sm" (click)="setExpenseTab('add')">+ Add Expense..</button>
              </div>
              <div *ngIf="expenseLogs.length === 0" class="empty-devices">No expenses yet</div>
              <div *ngFor="let exp of expenseLogs" style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #f1f5f9;">
                <div>
                  <div style="font-weight:600">{{ exp.category | titlecase }} — {{ (exp.amount/100) | number:'1.2-2' }} {{ exp.currency }}</div>
                  <div style="font-size:12px; color:#6b7280">{{ exp.description }}</div>
                </div>
                <div style="display:flex; gap:8px; align-items:center">
                  <button class="btn-icon-sm" (click)="editExpense(exp)" title="Edit">✏️</button>
                  <button class="btn-icon-sm" (click)="deleteExpense(exp)" title="Delete">🗑️</button>
                </div>
              </div>
            </div>

            <!-- Add tab -->
            <div *ngIf="expenseTab === 'add'" class="expense-form">
              <h4 style="margin-top:0">{{ selectedExpense ? 'Edit Expense' : 'Add Expense' }}</h4>
              <form [formGroup]="expenseForm">
                <div class="form-row">
                  <div class="form-group">
                    <label>Category</label>
                    <select formControlName="category" class="form-input">
                      <option value="supplies">Supplies</option>
                      <option value="utilities">Utilities</option>
                      <option value="rent">Rent</option>
                      <option value="salary">Salary</option>
                      <option value="marketing">Marketing</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div class="form-group">
                    <label>Amount (PHP)</label>
                    <input type="number" formControlName="amount" class="form-input" step="0.01" />
                  </div>
                </div>

                <div class="form-group">
                  <label>Description</label>
                  <textarea formControlName="description" class="form-textarea" rows="3"></textarea>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label>Payment Method</label>
                    <select formControlName="paymentMethod" class="form-input">
                      <option value="cash">Cash</option>
                      <option value="gcash">GCash</option>
                      <option value="bank">Bank</option>
                      <option value="credit">Credit</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div class="form-group">
                    <label>Payment Date</label>
                    <input type="date" formControlName="paymentDate" class="form-input" />
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label>Reference ID</label>
                    <input type="text" formControlName="referenceId" class="form-input" />
                  </div>

                  <div class="form-group">
                    <label>Tags (comma separated)</label>
                    <input type="text" formControlName="tags" class="form-input" />
                  </div>
                </div>

                <div style="display:flex; gap:8px; align-items:center; margin-top:12px;">
                  <label style="display:flex; align-items:center; gap:8px"><input type="checkbox" formControlName="isRecurring" /> Recurring</label>
                  <label style="display:flex; align-items:center; gap:8px"><input type="checkbox" formControlName="voided" /> Voided</label>
                </div>
              </form>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" (click)="cancelExpenseModal()">Cancel</button>
          <button class="btn btn-primary" (click)="saveExpense()">{{ selectedExpense ? 'Update' : 'Save' }}</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .stores-management {
      padding: 0;
      min-height: 100vh;
      background: #f8fafc;
    }

    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 2rem 0;
      margin-bottom: 2rem;
    }

    .header-content {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .page-title {
      font-size: 2.5rem;
      font-weight: 700;
      margin: 0 0 0.5rem 0;
    }

    .page-subtitle {
      font-size: 1.1rem;
      opacity: 0.9;
      margin: 0;
    }

    .header-actions {
      display: flex;
      gap: 0.75rem;
    }

    .filters-section {
      max-width: 1200px;
      margin: 0 auto 2rem auto;
      padding: 0 1rem;
    }

    .search-container {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      max-width: 500px;
    }

    .search-input {
      flex: 1;
      padding: 0.75rem;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 1rem;
    }

    .search-input:focus {
      outline: none;
      border-color: #059669;
      box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.1);
    }

    .table-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 1rem;
    }

    .table-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }

    .table-header h3 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 600;
      color: #2d3748;
    }

    .table-wrapper {
      background: white;
      border-radius: 12px;
      /* Keep visual clipping but allow inner scrolling */
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    /* Horizontal scroll container for wide tables */
    .table-scroll {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      width: 100%;
    }

    /* Custom thin scrollbar for modern browsers */
    .table-scroll::-webkit-scrollbar {
      height: 8px;
    }
    .table-scroll::-webkit-scrollbar-thumb {
      background: rgba(99,102,241,0.35);
      border-radius: 8px;
    }

    .stores-table {
      width: 100%;
      border-collapse: collapse;
      /* Allow the table to be wider than its container so horizontal scroll appears */
      min-width: 900px;
    }

    .stores-table th,
    .stores-table td {
      padding: 1rem;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }

    .stores-table th {
      background: #f8fafc;
      font-weight: 600;
      color: #2d3748;
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.025em;
    }

    .stores-table tbody tr:hover {
      background: #f8fafc;
    }

    .store-name-cell {
      font-weight: 500;
      color: #2d3748;
    }

    .store-code-cell {
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 0.875rem;
      color: #059669;
      font-weight: 600;
    }

    .invoice-no-cell {
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 0.875rem;
    }

    .invoice-number {
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      background: #e6fffa;
      color: #234e52;
      font-weight: 600;
    }

    .invoice-number.default-value {
      background: #f7fafc;
      color: #718096;
      font-style: italic;
      border: 1px dashed #cbd5e0;
    }

    .store-type-cell {
      color: #4a5568;
    }

    .address-cell {
      color: #718096;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .status-badge {
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.025em;
    }

    .status-badge.status-active {
      background: #c6f6d5;
      color: #2f855a;
    }

    .status-badge.status-inactive {
      background: #fed7d7;
      color: #c53030;
    }

    .status-cell {
      text-align: center;
    }

    .actions-cell {
      display: flex;
      gap: 0.5rem;
    }

    .btn {
      border: none;
      border-radius: 6px;
      padding: 0.5rem 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
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
    }

    .btn-primary:hover:not(:disabled) {
      background: #047857;
    }

    .btn-secondary {
      background: #e2e8f0;
      color: #4a5568;
    }

    .btn-secondary:hover:not(:disabled) {
      background: #cbd5e0;
    }

    .btn-danger {
      background: #f56565;
      color: white;
    }

    .btn-danger:hover:not(:disabled) {
      background: #e53e3e;
    }

    /* Gradient primary style to match View Details cosmetic */
    .btn-gradient {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 2px 4px rgba(79, 70, 229, 0.2);
    }

    .btn-gradient:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
      background: linear-gradient(135deg, #4338ca 0%, #6d28d9 100%);
    }

    .btn-gradient:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
    .btn-gradient svg { width: 16px; height: 16px; }

    .btn-sm {
      padding: 0.25rem 0.5rem;
      font-size: 0.75rem;
    }

    .empty-state, .loading-state {
      text-align: center;
      padding: 4rem 2rem;
      color: #718096;
      background: white;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .empty-content h3, .loading-content p {
      margin-bottom: 1rem;
      color: #2d3748;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #e2e8f0;
      border-top-color: #059669;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .modal-overlay {
      position: fixed !important;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999 !important;
      backdrop-filter: blur(2px);
      padding: 1rem;
    }

    .modal {
      background: white;
      border-radius: 12px;
      width: 90%;
      max-width: 600px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    }

    .modal-header {
      padding: 1.5rem 2rem;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 12px 12px 0 0;
    }

    .modal-header h3 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
      color: white;
    }

    .close-btn {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      font-size: 1.5rem;
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      line-height: 1;
    }

    .close-btn:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: scale(1.1);
    }

    .modal-body {
      padding: 2rem;
      overflow-y: auto;
      flex: 1;
    }

    .form-section {
      margin-bottom: 2rem;
      padding: 1.5rem;
      background: #f9fafb;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }

    .form-section:last-child {
      margin-bottom: 0;
    }

    .section-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 1rem;
      font-weight: 600;
      color: #374151;
      margin: 0 0 1rem 0;
      padding-bottom: 0.75rem;
      border-bottom: 2px solid #e5e7eb;
    }

    .section-title span:first-child {
      font-size: 1.25rem;
    }

    .form-group {
      margin-bottom: 1rem;
    }

    .form-group:last-child {
      margin-bottom: 0;
    }

    .form-group label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
      color: #6b7280;
      font-size: 0.875rem;
    }

    .form-input,
    .form-select,
    .form-textarea {
      width: 100%;
      max-width: 100%;
      padding: 0.75rem 1rem;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 500;
      color: #1f2937;
      background: white;
      transition: all 0.2s ease;
      box-sizing: border-box;
    }

    .form-input:focus,
    .form-select:focus,
    .form-textarea:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .form-textarea {
      resize: vertical;
      min-height: 80px;
    }

    .form-input.readonly {
      background: #f3f4f6;
      color: #6b7280;
      cursor: not-allowed;
    }

    .form-input.status-active,
    .form-select.status-active {
      background: #d1fae5;
      color: #065f46;
      border-color: #10b981;
      font-weight: 600;
    }

    .form-input.status-inactive,
    .form-select.status-inactive {
      background: #f3f4f6;
      color: #6b7280;
      border-color: #9ca3af;
    }

    .error-message {
      margin-top: 0.5rem;
      font-size: 0.875rem;
      color: #ef4444;
      font-weight: 500;
    }

    .modal-footer {
      padding: 1.5rem 2rem;
      border-top: 1px solid #e5e7eb;
      display: flex;
      justify-content: flex-end;
      gap: 1rem;
      background: #f9fafb;
      border-radius: 0 0 12px 12px;
    }

    .btn {
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      border: none;
    }

    .btn-secondary {
      background: #f1f5f9;
      color: #64748b;
      border: 1px solid #e2e8f0;
    }

    .btn-secondary:hover {
      background: #e2e8f0;
      transform: translateY(-1px);
    }

    /* Highlighted state for selected expense tab */
    .btn-secondary.active,
    .expense-tabs .btn-secondary.active {
      background: #667eea !important;
      color: white !important;
      border-color: #667eea !important;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
      transform: none;
    }

    .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
    }

    .btn-primary:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .form-help {
      margin-top: 0.25rem;
      font-size: 0.75rem;
      color: #718096;
      font-style: italic;
    }

    .form-section-header {
      margin: 2rem 0 1rem 0;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid #e2e8f0;
    }

    .form-section-header h4 {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 600;
      color: #2d3748;
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
    }

    .form-checkbox {
      width: 1.25rem;
      height: 1.25rem;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
      cursor: pointer;
    }

    .subscription-badge {
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.025em;
    }

    .subscription-badge.subscription-free,
    .subscription-badge.subscription-freemium {
      background: #e6fffa;
      color: #234e52;
    }

    .subscription-badge.subscription-standard {
      background: #bee3f8;
      color: #2c5282;
    }

    .subscription-badge.subscription-premium {
      background: #fbd38d;
      color: #7c2d12;
    }

    .subscription-badge.subscription-enterprise {
      background: #d6bcfa;
      color: #44337a;
    }

    /* Subscription expiry styles (compact) */
    .subscription-cell-content {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .subscription-expiry {
      font-size: 12px;
      color: #6b7280; /* gray-600 */
      line-height: 1.2;
    }
    .subscription-expiry .label { opacity: 0.9; margin-right: 4px; }
    .subscription-expiry .value { font-weight: 600; }
    .subscription-expiry .days-left { margin-left: 4px; opacity: 0.9; }
    .subscription-expiry.expiry-soon { color: #dc2626; } /* red-600 */

    .modal-footer {
      display: flex;
      gap: 0.75rem;
      justify-content: flex-end;
      padding: 1.5rem;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
    }

    @media (max-width: 768px) {
      .header-content {
        flex-direction: column;
        align-items: flex-start;
      }

      .page-title {
        font-size: 2rem;
      }

      .search-container {
        max-width: 100%;
      }

      .table-wrapper {
        overflow-x: auto;
      }

      .stores-table {
        min-width: 800px;
      }

      .modal {
        width: 95%;
        max-height: 95vh;
      }

      .modal-header {
        padding: 1rem 1.5rem;
      }

      .modal-body {
        padding: 1rem;
      }

      .form-section {
        padding: 1rem;
      }

      .modal-footer {
        padding: 1rem 1.5rem;
      }
    }

    /* Action Buttons */
    .action-buttons {
      display: flex;
      gap: 0.375rem;
      align-items: center;
      justify-content: center;
    }

    .btn-icon-action {
      padding: 0.5rem;
      border: 1px solid #667eea;
      color: #667eea;
      background: white;
      border-radius: 0.375rem;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 1.25rem;
      line-height: 1;
      position: relative;
    }

    .btn-icon-action:hover {
      transform: translateY(-2px);
      background: #eef2ff;
      border-color: #667eea;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }

    /* Ensure inline SVG icons inherit color and have consistent size */
    .btn-icon-action .icon {
      width: 1rem;
      height: 1rem;
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

    /* All icon buttons follow indigo treatment for consistency */

    /* Match Company Profile upgrade button color treatment (indigo) */
    .btn-upgrade {
      color: #667eea;
      border-color: #667eea;
    }

    .btn-upgrade:hover {
      background: #eef2ff;
      border-color: #667eea;
    }

    .btn-icon-action.disabled {
      opacity: 0.4;
      cursor: not-allowed;
      background: #f3f4f6 !important;
      border-color: #d1d5db !important;
      color: #9ca3af !important;
    }

    .btn-icon-action.disabled:hover {
      transform: none !important;
      box-shadow: none !important;
      background: #f3f4f6 !important;
      border-color: #d1d5db !important;
    }

    /* Toggle Switch Styles */
    .toggle-switch {
      position: relative;
      display: inline-block;
      width: 48px;
      height: 24px;
      cursor: pointer;
    }

    .toggle-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .toggle-slider {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #cbd5e1;
      border-radius: 24px;
      transition: all 0.3s ease;
    }

    .toggle-slider:before {
      position: absolute;
      content: "";
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      border-radius: 50%;
      transition: all 0.3s ease;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }

    .toggle-switch input:checked + .toggle-slider {
      background-color: #10b981;
    }

    .toggle-switch input:checked + .toggle-slider:before {
      transform: translateX(24px);
    }

    /* Disabled (read-only) toggle styling */
    .toggle-switch.disabled,
    .toggle-switch input[disabled] + .toggle-slider {
      cursor: not-allowed;
      opacity: 0.6;
      box-shadow: none;
    }

    .toggle-switch.disabled:hover .toggle-slider {
      box-shadow: none;
    }

    .toggle-switch:hover .toggle-slider {
      box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
    }

    .modal-large {
      max-width: 900px;
    }

    .info-text {
      text-align: center;
      color: #6b7280;
      padding: 2rem;
      font-size: 1rem;
    }

    /* Device Modal Styles */
    .devices-header {
      margin-bottom: 1.5rem;
      display: flex;
      justify-content: flex-end;
    }

    .device-form-container {
      background: #f9fafb;
      padding: 1.5rem;
      border-radius: 8px;
      margin-bottom: 1.5rem;
    }

    .device-form-container h4 {
      margin: 0 0 1rem 0;
      color: #1f2937;
      font-size: 1.125rem;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .form-actions {
      display: flex;
      gap: 0.75rem;
      justify-content: flex-end;
      margin-top: 1.5rem;
    }

    .devices-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1rem;
    }

    .device-card {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 1rem;
      transition: all 0.2s;
    }

    .device-card:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      transform: translateY(-2px);
    }

    .device-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      padding-bottom: 0.75rem;
      border-bottom: 2px solid #f3f4f6;
    }

    .device-card-header h5 {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: #1f2937;
    }

    .device-actions {
      display: flex;
      gap: 0.375rem;
    }

    .btn-icon-sm {
      padding: 0.25rem 0.5rem;
      border: 1px solid #d1d5db;
      background: white;
      border-radius: 0.25rem;
      cursor: pointer;
      font-size: 1rem;
      transition: all 0.2s;
    }

    .btn-icon-sm:hover {
      transform: scale(1.1);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .device-card-body {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .device-info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.875rem;
    }

    .device-info-row .label {
      color: #6b7280;
      font-weight: 500;
    }

    .device-info-row .value {
      color: #1f2937;
      font-family: monospace;
      background: #f3f4f6;
      padding: 0.125rem 0.5rem;
      border-radius: 0.25rem;
    }

    .loading-text {
      text-align: center;
      color: #6b7280;
      padding: 2rem;
    }

    .empty-devices {
      text-align: center;
      color: #6b7280;
      padding: 3rem 2rem;
    }

    .empty-devices p {
      margin: 0.5rem 0;
    }

    .empty-devices .hint {
      font-size: 0.875rem;
      opacity: 0.8;
    }

    .btn-sm {
      padding: 0.5rem 1rem;
      font-size: 0.875rem;
    }

    /* View Only Styles */
    .view-only-notice {
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 1.5rem;
      color: #856404;
    }

    .view-only-notice p {
      margin: 0;
      font-size: 0.875rem;
    }

    .view-only-badge {
      background: #e2e8f0;
      color: #64748b;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.025em;
    }

    .form-input.readonly,
    .form-select.readonly,
    .form-textarea.readonly {
      background: #f8f9fa !important;
      color: #6c757d !important;
      cursor: not-allowed !important;
      border-color: #e9ecef !important;
    }

    .form-select[disabled] {
      background: #f8f9fa !important;
      color: #6c757d !important;
      cursor: not-allowed !important;
      border-color: #e9ecef !important;
    }
  `]
})
export class StoresManagementComponent implements OnInit {
  stores: Store[] = [];
  filteredStores: Store[] = [];
  storeTypes: PredefinedType[] = [];
  // Latest subscription per storeId
  private storeSubscriptions: Record<string, SubscriptionDoc> = {};
  
  searchTerm: string = '';
  isLoading: boolean = false;
  showStoreModal: boolean = false;
  showBirModal: boolean = false;
  showDevicesModal: boolean = false;
  showDeviceForm: boolean = false;
  isLoadingDevices: boolean = false;
  // Expense Log modal state
  showExpenseModal: boolean = false;
  expenseForm: FormGroup;
  expenseLogs: any[] = [];
  selectedExpense: any = null;
  // Expense modal tab state: 'recent' or 'add'
  // Default to 'add' to show the Add Expense form first as requested
  expenseTab: 'recent' | 'add' = 'add';
  editingStore: Store | null = null;
  selectedStore: Store | null = null;
  editingDevice: Device | null = null;
  storeDevices: Device[] = [];

  // Upgrade modal state
  upgradeModalOpen: boolean = false;
  upgradeTarget: Store | null = null;
  currentCompanyId: string | null = null;

  storeForm: FormGroup;
  birForm: FormGroup;
  deviceForm: FormGroup;

  // Confirmation dialog
  private isConfirmationDialogVisibleSignal = signal<boolean>(false);
  readonly isConfirmationDialogVisible = computed(() => this.isConfirmationDialogVisibleSignal());
  
  private confirmationDialogDataSignal = signal<ConfirmationDialogData | null>(null);
  readonly confirmationDialogData = computed(() => this.confirmationDialogDataSignal());

  constructor(
    private storeService: StoreService,
    private authService: AuthService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private toastService: ToastService,
    private predefinedTypesService: PredefinedTypesService,
    private deviceService: DeviceService,
    private expenseService: ExpenseService,
    private router: Router,
    private subscriptionService: SubscriptionService
  ) {
    this.storeForm = this.fb.group({
      storeName: ['', [Validators.required]],
      storeType: ['', [Validators.required]],
      branchName: [''],
      address: ['', [Validators.required]],
      phoneNumber: [''],
      email: ['', [Validators.email]],
      uid: [''],
      status: ['active', [Validators.required]],
      logoUrl: [''],
      // BIR Compliance fields
      isBirAccredited: [false],
      tempInvoiceNumber: [''],
      tinNumber: [''],
      birPermitNo: [''],
      atpOrOcn: [''],
      inclusiveSerialNumber: [''],
      serialNumber: [''],
      minNumber: [''],
      invoiceType: [''],
      invoiceNumber: [''],
      permitDateIssued: [''],
      validityNotice: [''],
      // Subscription (UI-only flags)
      subscriptionTier: ['freemium'],
      subscriptionStatus: ['active'],
      subscriptionPopupShown: [false]
    });

    this.birForm = this.fb.group({
      birPermitNo: ['', [Validators.required]],
      atpOrOcn: ['', [Validators.required]],
      permitDateIssued: ['', [Validators.required]],
      validityNotice: ['Valid for 5 years from permit date'],
      vatRegistrationType: ['VAT-registered', [Validators.required]],
      vatRate: [12.0, [Validators.required]],
      receiptType: ['POS Receipt', [Validators.required]]
    });

    this.deviceForm = this.fb.group({
      terminalId: ['', [Validators.required]],
      deviceLabel: ['', [Validators.required]],
      invoicePrefix: ['', [Validators.required]],
      invoiceSeriesStart: [100001, [Validators.required, Validators.min(1)]],
      invoiceSeriesEnd: [199999, [Validators.required, Validators.min(1)]],
      currentInvoiceNumber: [100001, [Validators.required, Validators.min(1)]],
      minNumber: ['', [Validators.required]],
      serialNumber: ['', [Validators.required]]
    });

    // Expense form (used in Expense Log modal)
    this.expenseForm = this.fb.group({
      category: ['other', [Validators.required]],
      description: [''],
      amount: [0, [Validators.required, Validators.min(0)]],
      currency: ['PHP'],
      paymentMethod: ['cash', [Validators.required]],
      paymentDate: [new Date(), [Validators.required]],
      referenceId: [''],
      tags: [''],
      isRecurring: [false],
      voided: [false],
      voidReason: ['']
    });
  }

  async ngOnInit() {
    await this.loadStores();
    await this.loadStoreTypes();
  }

  // Role-based access control methods
  isAdminUser(): boolean {
    const role = this.authService.getCurrentPermission()?.roleId;
    return role === UserRolesEnum.ADMIN || role === UserRolesEnum.CREATOR; // historical: creator treated as admin of the business
  }

  isStoreManagerUser(): boolean {
    const currentPermission = this.authService.getCurrentPermission();
    return currentPermission?.roleId === 'store_manager';
  }

  canManageBirCompliance(): boolean {
    return this.isAdminUser(); // Only admin can manage BIR compliance
  }

  canManageDevices(): boolean {
    return this.isAdminUser(); // Only admin can manage devices
  }

  showAccessDeniedMessage(feature: string): void {
    this.toastService.error(`Access denied: ${feature} is only available for administrators.`);
  }

  async loadStoreTypes() {
    try {
      this.storeTypes = await this.predefinedTypesService.getStoreTypes();
    } catch (error) {
      console.error('Error loading store types:', error);
      this.toastService.error('Failed to load store types');
    }
  }

  async loadStores() {
    this.isLoading = true;
    
    try {
      await this.authService.waitForAuth();
      const currentPermission = this.authService.getCurrentPermission();
      if (currentPermission?.companyId) {
        this.currentCompanyId = currentPermission.companyId;
        await this.storeService.loadStoresByCompany(currentPermission.companyId);
        this.stores = this.storeService.getStoresByCompany(currentPermission.companyId);
        this.filteredStores = [...this.stores];

        // Load latest subscription per store
        const subs = await Promise.all(
          this.stores.map(async (s) => {
            try {
              const latest = await this.subscriptionService.getSubscriptionForStore(currentPermission.companyId!, s.id!);
              return { storeId: s.id!, sub: latest?.data || null } as { storeId: string; sub: SubscriptionDoc | null };
            } catch {
              return { storeId: s.id!, sub: null } as { storeId: string; sub: SubscriptionDoc | null };
            }
          })
        );
        const map: Record<string, SubscriptionDoc> = {};
        subs.forEach(({ storeId, sub }) => { if (sub) map[storeId] = sub; });
        this.storeSubscriptions = map;
      } else {
        // Creator account, no companyId yet, allow empty stores array for onboarding
        this.stores = [];
        this.filteredStores = [];
      }
    } catch (error) {
      console.error('Error loading stores:', error);
    } finally {
      this.isLoading = false;
    }
  }

  // ===== Upgrade Subscription Integration =====
  private canUpgradeSubscription(): boolean {
    const role = this.authService.getCurrentPermission()?.roleId as string | undefined;
    return role === UserRolesEnum.CREATOR || role === UserRolesEnum.ADMIN || role === UserRolesEnum.STORE_MANAGER;
  }

  openUpgradeModal(store: Store) {
    if (!this.canUpgradeSubscription()) {
      this.showAccessDeniedMessage('Upgrade Subscription');
      return;
    }
    this.upgradeTarget = store;
    this.upgradeModalOpen = true;
  }
  closeUpgradeModal() {
    this.upgradeModalOpen = false;
    this.upgradeTarget = null;
  }
  async onUpgradeCompleted() {
    // Refresh stores to reflect updated subscription badge
    await this.refreshStores();
    this.toastService.success('Subscription upgraded successfully');
    // Optional: navigate to subscriptions dashboard
    try { this.router.navigate(['/dashboard/subscriptions']); } catch {}
  }

  cancelExpenseModal() {
    this.showExpenseModal = false;
    this.selectedExpense = null;
    this.selectedStore = null;
  }

  async saveExpense() {
    if (!this.expenseForm.valid) {
      this.toastService.error('Please complete required expense fields');
      return;
    }

    const values = this.expenseForm.value;
    // Convert amount to centavos (assume user entered pesos)
    const amountCentavos = Math.round(Number(values.amount) * 100);

    try {
      // Build payload (do not include createdAt/updatedAt - OfflineDocumentService will add timestamps)
      const payload: any = {
        storeId: this.selectedStore?.id || '',
        createdBy: this.authService.getCurrentUser()?.uid || 'unknown',
        category: values.category,
        description: values.description,
        amount: amountCentavos,
        currency: values.currency || 'PHP',
        paymentMethod: values.paymentMethod,
        // Use JS Date so Firestore client converts it to a timestamp
        paymentDate: values.paymentDate ? new Date(values.paymentDate) : new Date(),
        referenceId: values.referenceId,
        tags: values.tags ? String(values.tags).split(',').map((t: string) => t.trim()).filter(Boolean) : [],
        isRecurring: !!values.isRecurring,
        voided: !!values.voided,
        voidReason: values.voidReason
      };

      if (this.selectedExpense && this.selectedExpense.id) {
        // Update existing
        await this.expenseService.updateExpense(this.selectedExpense.id, payload);
        // Update in-memory list
        const idx = this.expenseLogs.findIndex(e => e.id === this.selectedExpense.id);
        if (idx >= 0) this.expenseLogs[idx] = { ...this.expenseLogs[idx], ...payload };
        this.toastService.success('Expense updated');
      } else {
        // Create new
        const newId = await this.expenseService.createExpense(payload);
        const saved = { id: newId, ...payload };
        this.expenseLogs.unshift(saved);
        this.toastService.success('Expense saved');
      }

      // After saving, switch to Recent tab so the user sees the saved expense in the list
      this.expenseTab = 'recent';
      this.cancelExpenseModal();
    } catch (error) {
      console.error('Error saving expense:', error);
      this.toastService.error('Failed to save expense. Please try again.');
    }
  }

  editExpense(exp: any) {
    this.selectedExpense = exp;
    this.expenseForm.patchValue({
      category: exp.category || 'other',
      description: exp.description || '',
      amount: (exp.amount || 0) / 100,
      currency: exp.currency || 'PHP',
      paymentMethod: exp.paymentMethod || 'cash',
      paymentDate: exp.paymentDate ? new Date(exp.paymentDate.toDate ? exp.paymentDate.toDate() : exp.paymentDate) : new Date(),
      referenceId: exp.referenceId || '',
      tags: (exp.tags || []).join(', '),
      isRecurring: !!exp.isRecurring,
      voided: !!exp.voided,
      voidReason: exp.voidReason || ''
    });
    // Open modal and switch to Add tab for editing
    this.expenseTab = 'add';
    this.showExpenseModal = true;
  }

  deleteExpense(exp: any) {
    (async () => {
      try {
        if (exp?.id) {
          await this.expenseService.deleteExpense(exp.id);
        }
        this.expenseLogs = this.expenseLogs.filter(e => e.id !== exp.id);
        this.toastService.success('Expense deleted');
      } catch (error) {
        console.error('Failed to delete expense', error);
        this.toastService.error('Failed to delete expense. Please try again.');
      }
    })();
  }

  /**
   * Open the Expense Log view for the selected store.
   * Currently navigates to a store-specific expenses route. If you prefer a modal,
   * I can implement an in-place modal instead.
   */
  openExpenseLog(store: Store) {
    if (!store || !store.id) {
      this.toastService.error('Cannot open expense log for unknown store');
      return;
    }
    // Debug: ensure click handler is firing
    console.log('openExpenseLog called for store', store && store.id);
    try { this.toastService.info('Opening Expense Log...'); } catch {}

    // Open modal in-place (patterned like inventory modal)
  this.selectedStore = store;
  this.selectedExpense = null;
  this.expenseLogs = [];
    this.expenseForm.reset({
      category: 'other',
      description: '',
      amount: 0,
      currency: 'PHP',
      paymentMethod: 'cash',
      paymentDate: new Date(),
      referenceId: '',
      tags: '',
      isRecurring: false,
      voided: false,
      voidReason: ''
    });

  // Default to Add tab when opening (user requested default Add view)
  this.expenseTab = 'add';

    // Load persisted expenses for this store (if any)
    setTimeout(async () => {
      try {
        if (this.selectedStore?.id) {
          const rows = await this.expenseService.getExpensesByStore(this.selectedStore.id);
          // Normalise paymentDate to Date for UI preview if it's a Firestore Timestamp
          this.expenseLogs = rows.map(r => ({
            ...r,
            paymentDate: (r.paymentDate && (r.paymentDate as any).toDate) ? (r.paymentDate as any).toDate() : r.paymentDate
          }));
        }
      } catch (err) {
        console.warn('Failed to load persisted expenses', err);
      }

      this.showExpenseModal = true;
      try { this.cdr.detectChanges(); } catch (e) { console.warn('detectChanges failed', e); }
    }, 0);
  }

  setExpenseTab(tab: 'recent' | 'add') {
    this.expenseTab = tab;
    if (tab === 'add') {
      // reset selectedExpense when switching to add
      this.selectedExpense = null;
      this.expenseForm.reset({
        category: 'other',
        description: '',
        amount: 0,
        currency: 'PHP',
        paymentMethod: 'cash',
        paymentDate: new Date(),
        referenceId: '',
        tags: '',
        isRecurring: false,
        voided: false,
        voidReason: ''
      });
    }
  }

  onSearchChange() {
    const term = this.searchTerm?.toLowerCase() || '';
    this.filteredStores = (this.stores || []).filter(store => 
      store.storeName?.toLowerCase().includes(term) ||
      store.id?.toLowerCase().includes(term) ||
      store.storeType?.toLowerCase().includes(term) ||
      store.address?.toLowerCase().includes(term)
    );
  }

  clearSearch() {
    this.searchTerm = '';
    this.filteredStores = [...this.stores];
  }

  async refreshStores() {
    await this.loadStores();
  }

  openAddStoreModal() {
    console.log('openAddStoreModal called');
    this.editingStore = null;
    this.storeForm.reset({
      invoiceNo: 'INV-0000-000000',
      status: 'active'
    });
    this.showStoreModal = true;
    console.log('showStoreModal set to:', this.showStoreModal);
    this.cdr.detectChanges();
  }

  editStore(store: Store) {
    console.log('📝 editStore called with store:', store);
    
    this.editingStore = store;
    
    const formValues = {
      storeName: store.storeName,
      storeType: store.storeType,
      branchName: store.branchName || '',
      address: store.address,
      phoneNumber: store.phoneNumber || '',
      email: store.email || '',
      uid: store.uid || '',
      status: store.status,
      logoUrl: store.logoUrl || '',
      // BIR Compliance
      isBirAccredited: store.isBirAccredited || false,
      tempInvoiceNumber: store.tempInvoiceNumber || '',
      tinNumber: store.tinNumber || '',
      birPermitNo: store.birDetails?.birPermitNo || '',
      atpOrOcn: store.birDetails?.atpOrOcn || '',
      inclusiveSerialNumber: store.birDetails?.inclusiveSerialNumber || '',
      serialNumber: store.birDetails?.serialNumber || '',
      minNumber: store.birDetails?.minNumber || '',
      invoiceType: store.birDetails?.invoiceType || '',
      invoiceNumber: store.birDetails?.invoiceNumber || '',
      permitDateIssued: store.birDetails?.permitDateIssued || '',
      validityNotice: store.birDetails?.validityNotice || '',
      // Subscription (derived)
      subscriptionTier: this.getStoreTier(store) || 'freemium',
      subscriptionStatus: 'active',
      subscriptionPopupShown: store.subscriptionPopupShown || false
    };
    
    console.log('📝 Form values being patched:', formValues);
    
    this.storeForm.patchValue(formValues);
    
    console.log('📝 Form value after patch:', this.storeForm.value);
    
    this.showStoreModal = true;
  }

  cancelStoreModal() {
    this.showStoreModal = false;
    this.editingStore = null;
    this.storeForm.reset({
      storeName: '',
      storeType: '',
      branchName: '',
      address: '',
      phoneNumber: '',
      email: '',
      uid: '',
      status: 'active',
      logoUrl: '',
      isBirAccredited: false,
      tempInvoiceNumber: '',
      tinNumber: '',
      birPermitNo: '',
      atpOrOcn: '',
      inclusiveSerialNumber: '',
      serialNumber: '',
      minNumber: '',
      invoiceType: '',
      invoiceNumber: '',
      permitDateIssued: '',
      validityNotice: '',
      subscriptionTier: 'freemium',
      subscriptionStatus: 'active',
      subscriptionPopupShown: false
    });
  }

  async saveStore() {
    if (!this.storeForm.valid) {
      this.storeForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;

    try {
      await this.authService.waitForAuth();
      const currentPermission = this.authService.getCurrentPermission();
      if (!currentPermission?.companyId) {
        throw new Error('No company ID found');
      }

      const formData = this.storeForm.value;
      
      // Build the BIR details object
      const birDetails = {
        birPermitNo: formData.birPermitNo || '',
        atpOrOcn: formData.atpOrOcn || '',
        inclusiveSerialNumber: formData.inclusiveSerialNumber || '',
        serialNumber: formData.serialNumber || '',
        minNumber: formData.minNumber || '',
        invoiceType: formData.invoiceType || '',
        invoiceNumber: formData.invoiceNumber || '',
        permitDateIssued: this.validateAndCreateDate(formData.permitDateIssued),
        validityNotice: formData.validityNotice || ''
      };

      const storeData: Omit<Store, 'id' | 'createdAt' | 'updatedAt'> = {
        companyId: currentPermission.companyId,
        storeName: formData.storeName,
        storeType: formData.storeType,
        branchName: formData.branchName || '',
        address: formData.address,
        phoneNumber: formData.phoneNumber || '',
        email: formData.email || '',
        uid: formData.uid || '',
        status: formData.status,
        logoUrl: formData.logoUrl || '',
        // BIR Compliance
        isBirAccredited: formData.isBirAccredited || false,
        tempInvoiceNumber: formData.tempInvoiceNumber || '',
        birDetails: birDetails,
        tinNumber: formData.tinNumber || '',
        subscriptionPopupShown: formData.subscriptionPopupShown || false
      };

      console.log('💾 Saving store data:', {
        formData,
        storeData,
        editingStore: this.editingStore?.id
      });

      if (this.editingStore) {
        // Update existing store
        console.log('📝 Updating store:', this.editingStore.id, 'with data:', storeData);
        await this.storeService.updateStore(this.editingStore.id!, storeData);
        console.log('✅ Store updated successfully');
        this.toastService.success('Store updated successfully');
      } else {
        // Create new store
        console.log('➕ Creating new store with data:', storeData);
        const newStoreId = await this.storeService.createStore(storeData);
        console.log('✅ Store created successfully with ID:', newStoreId);
        
        // If there's a logo URL from temp upload, move it to final location
        if (storeData.logoUrl && storeData.logoUrl.includes('/temp/logo/')) {
          console.log('🔄 Moving logo from temp to final location...');
          try {
            const finalLogoUrl = await this.moveLogoToFinalLocation(storeData.logoUrl, newStoreId);
            // Update the store with the final logo URL
            await this.storeService.updateStore(newStoreId, { logoUrl: finalLogoUrl });
            console.log('✅ Logo moved and store updated with final URL');
          } catch (logoError) {
            console.warn('⚠️ Failed to move logo, but store was created successfully:', logoError);
            this.toastService.warning('Store created, but logo upload needs to be redone');
          }
        }
        
        this.toastService.success('Store created successfully');
      }

      await this.loadStores();
      this.cancelStoreModal();
    } catch (error) {
      console.error('Error saving store:', error);
      this.toastService.error('Error saving store. Please try again.');
    } finally {
      this.isLoading = false;
    }
  }

  onToggleClick(event: Event, store: Store) {
    // Prevent the checkbox from changing state
    event.preventDefault();
    event.stopPropagation();
    
    // Call the toggle method
    this.toggleStoreStatus(store);
  }

  async toggleStoreStatus(store: Store) {
    // Determine the intended status and readable action
    const intendedStatus = store.status === 'active' ? 'inactive' : 'active';
    const actionTitle = intendedStatus === 'active' ? 'Activate' : 'Deactivate';

    const confirmed = await this.showConfirmationDialog({
      title: `${actionTitle} Store`,
      message: `Are you sure you want to ${actionTitle.toLowerCase()} "${store.storeName}"?`,
      confirmText: actionTitle,
      cancelText: 'Cancel',
      type: 'warning'
    });

    if (!confirmed) return;

    // Store original status in case we need to revert
    const originalStatus = store.status;
    
    this.isLoading = true;
    try {
      // Attempt update
      await this.storeService.updateStore(store.id!, { status: intendedStatus });

      // Update the local store status only on success
      store.status = intendedStatus;

      // Show success message based on the new status
      const pastTense = intendedStatus === 'active' ? 'activated' : 'deactivated';
      this.toastService.success(`Store ${pastTense} successfully!`);

      // Reload stores to ensure consistency with backend
      await this.loadStores();
    } catch (error: any) {
      console.error('Error updating store status:', error);

      // Ensure the store status remains unchanged in the UI
      store.status = originalStatus;

      // Handle permission-related errors explicitly
      if (error?.code === 'permission-denied' || (error?.message && error.message.toLowerCase().includes('permission'))) {
        this.toastService.error('You do not have permission to change the store status. Contact your administrator.');
      } else {
        this.toastService.error(`${actionTitle} failed. Please try again.`);
      }
    } finally {
      this.isLoading = false;
    }
  }

  // BIR Compliance Modal Methods
  openBirComplianceModal(store: Store) {
    this.selectedStore = store;
    
    // Check if BIR details exist, if not create default structure
    if (store.birDetails && store.birDetails.birPermitNo) {
      // BIR details exist, populate form
      this.birForm.patchValue({
        birPermitNo: store.birDetails.birPermitNo || '',
        atpOrOcn: store.birDetails.atpOrOcn || '',
        permitDateIssued: store.birDetails.permitDateIssued ? 
          this.formatDateForInput(store.birDetails.permitDateIssued) : '',
        validityNotice: store.birDetails.validityNotice || 'Valid for 5 years from permit date',
        vatRegistrationType: (store.birDetails as any).vatRegistrationType || 'VAT-registered',
        vatRate: (store.birDetails as any).vatRate || 12.0,
        receiptType: (store.birDetails as any).receiptType || 'POS Receipt'
      });
    } else {
      // No BIR details, set default values
      this.birForm.reset({
        birPermitNo: `BIR-PERMIT-2025-${Math.floor(10000 + Math.random() * 90000)}`,
        atpOrOcn: `OCN-2025-${Math.floor(100000 + Math.random() * 900000)}`,
        permitDateIssued: '',
        validityNotice: 'Valid for 5 years from permit date',
        vatRegistrationType: 'VAT-registered',
        vatRate: 12.0,
        receiptType: 'POS Receipt'
      });
    }
    
    this.showBirModal = true;
  }

  closeBirModal() {
    this.showBirModal = false;
    this.selectedStore = null;
    this.birForm.reset();
  }

  async saveBirCompliance() {
    if (!this.birForm.valid || !this.selectedStore) {
      this.toastService.error('Please fill in all required fields');
      return;
    }

    this.isLoading = true;

    try {
      const formData = this.birForm.value;
      const permitDate = formData.permitDateIssued ? new Date(formData.permitDateIssued) : new Date();
      
      // Update the store's BIR details
      const updatedBirDetails = {
        birPermitNo: formData.birPermitNo,
        atpOrOcn: formData.atpOrOcn,
        permitDateIssued: permitDate,
        validityNotice: formData.validityNotice,
        vatRegistrationType: formData.vatRegistrationType,
        vatRate: formData.vatRate,
        receiptType: formData.receiptType,
        // Keep existing fields if they exist
        inclusiveSerialNumber: this.selectedStore.birDetails?.inclusiveSerialNumber || '',
        serialNumber: this.selectedStore.birDetails?.serialNumber || '',
        minNumber: this.selectedStore.birDetails?.minNumber || '',
        invoiceType: this.selectedStore.birDetails?.invoiceType || '',
        invoiceNumber: this.selectedStore.birDetails?.invoiceNumber || ''
      };

      await this.storeService.updateStore(this.selectedStore.id!, {
        birDetails: updatedBirDetails as any,
        isBirAccredited: true,
        updatedAt: new Date()
      });

      this.toastService.success('BIR Compliance information saved successfully!');
      await this.loadStores();
      this.closeBirModal();
    } catch (error) {
      console.error('Error saving BIR compliance:', error);
      this.toastService.error('Error saving BIR compliance. Please try again.');
    } finally {
      this.isLoading = false;
    }
  }

  // Devices Modal Methods
  async openDevicesModal(store: Store) {
    console.log('🔵 Opening devices modal for store:', store.id, store.storeName);
    this.selectedStore = store;
    this.showDevicesModal = true;
    this.showDeviceForm = false;
    this.isLoadingDevices = true;
    this.editingDevice = null;
    
    try {
      // Load devices for this store
      console.log('🔵 Calling getDevicesByStore for storeId:', store.id);
      this.storeDevices = await this.deviceService.getDevicesByStore(store.id!);
      console.log('🔵 Loaded devices:', this.storeDevices.length, this.storeDevices);
    } catch (error: any) {
      console.error('❌ Error loading devices:', error);
      
      // Check if it's a permission error (likely due to missing uid field)
      if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
        console.warn('⚠️ Permission error detected - you may have old devices without uid field');
        this.toastService.error('Cannot load devices. Please fix old devices in Firebase Console by adding your uid field.');
      } else {
        this.toastService.error('Failed to load devices');
      }
      
      this.storeDevices = [];
    } finally {
      this.isLoadingDevices = false;
      console.log('🔵 Final storeDevices state:', this.storeDevices);
    }
  }

  closeDevicesModal() {
    this.showDevicesModal = false;
    this.showDeviceForm = false;
    this.selectedStore = null;
    this.editingDevice = null;
    this.storeDevices = [];
    this.deviceForm.reset();
  }

  showAddDeviceForm() {
    this.editingDevice = null;
    this.showDeviceForm = true;
    
    // Generate default terminal ID
    const nextTerminalNumber = this.storeDevices.length + 1;
    const terminalId = `TERM${String(nextTerminalNumber).padStart(3, '0')}`;
    
    this.deviceForm.reset({
      terminalId: terminalId,
      deviceLabel: '',
      invoicePrefix: '',
      invoiceSeriesStart: 100001,
      invoiceSeriesEnd: 199999,
      currentInvoiceNumber: 100001,
      minNumber: '',
      serialNumber: ''
    });
  }

  editDevice(device: Device) {
    this.editingDevice = device;
    this.showDeviceForm = true;
    
    this.deviceForm.patchValue({
      terminalId: device.terminalId,
      deviceLabel: device.deviceLabel,
      invoicePrefix: device.invoicePrefix,
      invoiceSeriesStart: device.invoiceSeriesStart,
      invoiceSeriesEnd: device.invoiceSeriesEnd,
      currentInvoiceNumber: device.currentInvoiceNumber,
      minNumber: device.minNumber,
      serialNumber: device.serialNumber
    });
  }

  async saveDevice() {
    if (!this.deviceForm.valid || !this.selectedStore) {
      this.toastService.error('Please fill in all required fields');
      return;
    }

    this.isLoadingDevices = true;
    
    try {
      const currentPermission = this.authService.getCurrentPermission();
      if (!currentPermission) {
        this.toastService.error('User permission not found');
        return;
      }

      const currentUser = this.authService.currentUser();
      if (!currentUser) {
        this.toastService.error('User not authenticated');
        return;
      }

      const deviceData = {
        ...this.deviceForm.value,
        storeId: this.selectedStore.id!,
        companyId: currentPermission.companyId,
        uid: currentUser.uid // Add uid for Firestore security rules
      };

      if (this.editingDevice) {
        // Update existing device
        await this.deviceService.updateDevice(this.editingDevice.id!, deviceData);
        this.toastService.success('Device updated successfully!');
      } else {
        // Create new device
        await this.deviceService.createDevice(deviceData);
        this.toastService.success('Device created successfully!');
      }

      // Reload devices list
      this.storeDevices = await this.deviceService.getDevicesByStore(this.selectedStore.id!);
      this.cancelDeviceForm();
    } catch (error) {
      console.error('Error saving device:', error);
      this.toastService.error('Error saving device. Please try again.');
    } finally {
      this.isLoadingDevices = false;
    }
  }

  async deleteDevice(device: Device) {
    const confirmed = await this.showConfirmationDialog({
      title: 'Delete Device',
      message: `Are you sure you want to delete device "${device.deviceLabel}"?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger'
    });

    if (!confirmed) {
      return;
    }

    this.isLoadingDevices = true;
    
    try {
      await this.deviceService.deleteDevice(device.id!);
      this.toastService.success('Device deleted successfully!');
      
      // Reload devices list
      if (this.selectedStore) {
        this.storeDevices = await this.deviceService.getDevicesByStore(this.selectedStore.id!);
      }
    } catch (error) {
      console.error('Error deleting device:', error);
      this.toastService.error('Error deleting device. Please try again.');
    } finally {
      this.isLoadingDevices = false;
    }
  }

  cancelDeviceForm() {
    this.showDeviceForm = false;
    this.editingDevice = null;
    this.deviceForm.reset();
  }

  // ===== Subscription helpers (derived from subscriptions collection) =====
  getStoreTier(store: Store): string {
    if (!store?.id) return 'freemium';
    const sub = this.storeSubscriptions[store.id];
    return (sub?.planType as string) || 'freemium';
  }

  getStoreExpiresAt(store: Store): Date | null {
    if (!store?.id) return store?.subscriptionEndDate || null;
    const sub = this.storeSubscriptions[store.id];
    return (sub?.endDate as any) || store.subscriptionEndDate || null;
  }

  isExpiringSoon(date: Date | null): boolean {
    if (!date) return false;
    const d = new Date(date);
    const days = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days <= 7 && days > 0;
  }

  getDaysUntilExpiry(date: Date | null): number {
    if (!date) return 0;
    const d = new Date(date);
    return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  formatDate(date: Date | null): string {
    if (!date) return '—';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  // Compute effective status based on subscription expiry (UI-only enforcement)
  isStoreExpired(store: Store): boolean {
    const exp = this.getStoreExpiresAt(store);
    if (!exp) return false; // No expiry recorded -> treat as active
    const d = new Date(exp);
    return d.getTime() < Date.now();
  }

  getEffectiveStatus(store: Store): 'active' | 'inactive' {
    return this.isStoreExpired(store) ? 'inactive' : 'active';
  }

  // Helper method to format date for input
  private formatDateForInput(date: Date | any): string {
    if (!date) return '';
    const d = date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Confirmation dialog methods
  showConfirmationDialog(data: ConfirmationDialogData): Promise<boolean> {
    return new Promise((resolve) => {
      this.confirmationDialogDataSignal.set(data);
      this.isConfirmationDialogVisibleSignal.set(true);
      
      // Store the resolve function for use in dialog action handlers
      (this as any)._confirmationResolve = resolve;
    });
  }

  onConfirmationConfirmed(): void {
    this.isConfirmationDialogVisibleSignal.set(false);
    this.confirmationDialogDataSignal.set(null);
    
    // Resolve with true (confirmed)
    if ((this as any)._confirmationResolve) {
      (this as any)._confirmationResolve(true);
      (this as any)._confirmationResolve = null;
    }
  }

  onConfirmationCancelled(): void {
    this.isConfirmationDialogVisibleSignal.set(false);
    this.confirmationDialogDataSignal.set(null);
    
    // Resolve with false (cancelled)
    if ((this as any)._confirmationResolve) {
      (this as any)._confirmationResolve(false);
      (this as any)._confirmationResolve = null;
    }
  }

  // ===== LOGO UPLOAD METHODS =====

  /**
   * Trigger logo file upload
   */
  triggerLogoUpload(): void {
    const el = document.getElementById('hiddenLogoFile') as HTMLInputElement | null;
    el?.click();
  }

  /**
   * Handle logo file selection and upload
   */
  async onLogoFileChange(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    
    const file = input.files[0];
    console.log('📷 Starting store logo upload:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });
    
    try {
      // Show loading state
      this.isLoading = true;
      this.toastService.info('Compressing and uploading logo...');
      
      // Compress the image
      console.log('🔄 Compressing logo...');
      const compressed = await this.compressImage(file, 800 * 800); // 800x800 max for logos
      console.log('✅ Logo compressed:', {
        originalSize: file.size,
        compressedSize: compressed.size,
        compression: Math.round((1 - compressed.size / file.size) * 100) + '%'
      });
      
      // Upload to Firebase Storage with structured path
      console.log('☁️ Uploading logo to Firebase Storage...');
      const url = await this.uploadLogoToStorage(compressed);
      console.log('✅ Logo uploaded successfully:', url);
      
      // Set the URL in the form
      this.storeForm.get('logoUrl')?.setValue(url);
      this.toastService.success('Logo uploaded successfully!');
      
    } catch (err: any) {
      console.error('❌ Logo upload error:', err);
      this.toastService.error(`Logo upload failed: ${err.message || 'Unknown error'}`);
    } finally {
      this.isLoading = false;
      // Reset the file input
      if (input) input.value = '';
    }
  }

  /**
   * Clear the logo URL
   */
  clearLogo(): void {
    this.storeForm.get('logoUrl')?.setValue('');
    this.toastService.info('Logo removed');
  }

  /**
   * Upload logo to Firebase Storage with structured path
   * Path: {storeId}/logo/logo_{storeId}.{extension}
   */
  async uploadLogoToStorage(file: File): Promise<string> {
    try {
      console.log('☁️ Starting structured logo upload...');
      
      // For new stores, use a temporary path that will be updated after store creation
      // For existing stores, use the actual store ID
      const storeId = this.editingStore?.id || `temp_${Date.now()}`;
      const isNewStore = !this.editingStore?.id;
      
      // Get file extension
      const extension = file.name.split('.').pop()?.toLowerCase() || 'png';
      
      // Create structured path
      const fileName = isNewStore 
        ? `temp/logo/logo_${storeId}.${extension}`
        : `${storeId}/logo/logo_${storeId}.${extension}`;
      
      console.log('📤 Uploading logo with structure:', {
        storeId,
        isNewStore,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        storagePath: fileName
      });
      
      // Dynamic import to avoid top-level SDK usage
      const { getStorage, ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
      const { app } = await import('../../../firebase.config');
      
      const storage = getStorage(app);
      const storageRef = ref(storage, fileName);
      
      // Upload with metadata
      const snapshot = await uploadBytes(storageRef, file, {
        contentType: file.type,
        customMetadata: {
          uploadedBy: this.authService.currentUser()?.uid || 'unknown',
          uploadedAt: new Date().toISOString(),
          storeId: storeId,
          imageType: 'logo'
        }
      });
      
      console.log('✅ Upload complete, getting download URL...');
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      console.log('✅ Logo upload complete with structured path:', {
        downloadURL,
        fullPath: fileName,
        size: snapshot.metadata.size || 0
      });
      
      return downloadURL;
    } catch (error: any) {
      console.error('❌ Structured logo upload error:', error);
      throw new Error(`Logo upload failed: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Move logo from temporary location to final store location
   */
  async moveLogoToFinalLocation(tempUrl: string, finalStoreId: string): Promise<string> {
    try {
      console.log('🔄 Moving logo from temp to final location...');
      
      // Dynamic import Firebase Storage
      const { getStorage, ref, getDownloadURL, uploadBytes, deleteObject } = await import('firebase/storage');
      const { app } = await import('../../../firebase.config');
      
      const storage = getStorage(app);
      
      // Parse temp URL to get the file
      const tempRef = ref(storage, this.extractStoragePathFromUrl(tempUrl));
      
      // Download the file from temp location
      const response = await fetch(tempUrl);
      const blob = await response.blob();
      
      // Get file extension from the temp URL
      const extension = tempUrl.split('.').pop()?.split('?')[0] || 'png';
      
      // Create final path
      const finalPath = `${finalStoreId}/logo/logo_${finalStoreId}.${extension}`;
      const finalRef = ref(storage, finalPath);
      
      // Upload to final location
      await uploadBytes(finalRef, blob, {
        contentType: blob.type,
        customMetadata: {
          uploadedBy: this.authService.currentUser()?.uid || 'unknown',
          uploadedAt: new Date().toISOString(),
          storeId: finalStoreId,
          imageType: 'logo',
          movedFromTemp: 'true'
        }
      });
      
      // Get final download URL
      const finalUrl = await getDownloadURL(finalRef);
      
      // Delete temp file
      try {
        await deleteObject(tempRef);
        console.log('🗑️ Temp logo file deleted');
      } catch (deleteError) {
        console.warn('⚠️ Could not delete temp logo file:', deleteError);
      }
      
      console.log('✅ Logo moved successfully:', {
        from: tempUrl,
        to: finalUrl,
        finalPath
      });
      
      return finalUrl;
    } catch (error: any) {
      console.error('❌ Error moving logo to final location:', error);
      throw new Error(`Failed to move logo: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Extract storage path from Firebase Storage URL
   */
  private extractStoragePathFromUrl(url: string): string {
    try {
      const urlParts = url.split('/o/')[1];
      const path = urlParts.split('?')[0];
      return decodeURIComponent(path);
    } catch (error) {
      console.error('❌ Error extracting storage path:', error);
      throw new Error('Invalid storage URL');
    }
  }

  /**
   * Compress image before upload
   */
  async compressImage(file: File, maxSize: number = 800 * 800): Promise<File> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions maintaining aspect ratio
        let { width, height } = img;
        const maxDimension = Math.sqrt(maxSize);
        
        if (width > height) {
          if (width > maxDimension) {
            height = height * (maxDimension / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = width * (maxDimension / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              resolve(file); // Fallback to original
            }
          },
          file.type,
          0.8 // 80% quality
        );
      };

      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Validate and create a Date object, returning current date if invalid
   */
  private validateAndCreateDate(dateValue: any): Date {
    // Handle null, undefined, or empty string
    if (!dateValue || dateValue === '') {
      return new Date();
    }

    // Try to create date
    const date = new Date(dateValue);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn('⚠️ Invalid date value provided:', dateValue, 'Using current date instead');
      return new Date();
    }

    return date;
  }

}

