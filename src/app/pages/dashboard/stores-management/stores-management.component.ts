import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { StoreService, Store } from '../../../services/store.service';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../shared/services/toast.service';
import { PredefinedTypesService, PredefinedType } from '../../../services/predefined-types.service';

@Component({
  selector: 'app-stores-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
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
            <button class="btn btn-primary" (click)="openAddStoreModal()" style="background: #007bff !important; color: white !important; padding: 8px 16px !important;">
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
          <button class="btn btn-secondary" (click)="clearSearch()">
            Clear
          </button>
        </div>
      </div>

      <!-- Stores Table -->
      <div class="table-container">
        <div class="table-header">
          <h3>Stores ({{ filteredStores.length }})</h3>
          <button class="btn btn-secondary" (click)="refreshStores()">
            Refresh
          </button>
        </div>

        <div class="table-wrapper" *ngIf="filteredStores.length > 0">
          <table class="stores-table">
            <thead>
              <tr>
                <th>Store Name</th>
                <th>Store Code</th>
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
                <td class="store-code-cell">{{ store.storeCode }}</td>
                <td class="branch-name-cell">{{ store.branchName || '-' }}</td>
                <td class="store-type-cell">{{ store.storeType }}</td>
                <td class="bir-status-cell">
                  <span class="status-badge" [class]="store.isBirAccredited ? 'status-active' : 'status-inactive'">
                    {{ store.isBirAccredited ? 'BIR Accredited' : 'Not Accredited' }}
                  </span>
                </td>
                <td class="subscription-cell">
                  <span class="subscription-badge" [class]="'subscription-' + (store.subscription.tier || 'freemium')">
                    {{ (store.subscription.tier || 'freemium') | titlecase }}
                  </span>
                </td>
                <td class="status-cell">
                  <span class="status-badge" [class]="'status-' + store.status">
                    {{ store.status | titlecase }}
                  </span>
                </td>
                <td class="actions-cell">
                  <button 
                    class="btn btn-sm btn-secondary"
                    (click)="editStore(store)">
                    Edit
                  </button>
                  <button 
                    class="btn btn-sm btn-danger"
                    (click)="deleteStore(store)">
                    Delete
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
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
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editingStore ? 'Edit Store' : 'Add New Store' }}</h3>
            <button class="close-btn" (click)="cancelStoreModal()">×</button>
          </div>
          <div class="modal-body">
            <form [formGroup]="storeForm">
              <div class="form-group">
                <label for="storeName">Store Name *</label>
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
                <label for="storeCode">Store Code *</label>
                <input 
                  type="text" 
                  id="storeCode"
                  formControlName="storeCode"
                  placeholder="e.g., MAIN-01, BRANCH-02"
                  class="form-input">
                <div class="error-message" *ngIf="storeForm.get('storeCode')?.invalid && storeForm.get('storeCode')?.touched">
                  Store code is required
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
                <label for="uid">User ID</label>
                <input 
                  type="text" 
                  id="uid"
                  formControlName="uid"
                  placeholder="Associated user ID"
                  class="form-input">
              </div>

              <div class="form-group">
                <label for="logoUrl">Logo URL</label>
                <input 
                  type="text" 
                  id="logoUrl"
                  formControlName="logoUrl"
                  placeholder="https://..."
                  class="form-input">
              </div>

              <!-- BIR Compliance Section -->
              <div class="form-section-header">
                <h4>BIR Compliance</h4>
              </div>

              <div class="form-group">
                <label class="checkbox-label">
                  <input 
                    type="checkbox" 
                    formControlName="isBirAccredited"
                    class="form-checkbox">
                  <span>BIR Accredited</span>
                </label>
              </div>

              <div class="form-group">
                <label for="tempInvoiceNumber">Temporary Invoice Number</label>
                <input 
                  type="text" 
                  id="tempInvoiceNumber"
                  formControlName="tempInvoiceNumber"
                  placeholder="INV-2025-000001"
                  class="form-input">
              </div>

              <div class="form-group">
                <label for="tinNumber">TIN Number</label>
                <input 
                  type="text" 
                  id="tinNumber"
                  formControlName="tinNumber"
                  placeholder="000-000-000-000"
                  class="form-input">
              </div>

              <div class="form-group">
                <label for="birPermitNo">BIR Permit Number</label>
                <input 
                  type="text" 
                  id="birPermitNo"
                  formControlName="birPermitNo"
                  placeholder="BIR Permit #"
                  class="form-input">
              </div>

              <div class="form-group">
                <label for="atpOrOcn">ATP/OCN Number</label>
                <input 
                  type="text" 
                  id="atpOrOcn"
                  formControlName="atpOrOcn"
                  placeholder="ATP/OCN #"
                  class="form-input">
              </div>

              <div class="form-group">
                <label for="inclusiveSerialNumber">Inclusive Serial Number</label>
                <input 
                  type="text" 
                  id="inclusiveSerialNumber"
                  formControlName="inclusiveSerialNumber"
                  placeholder="e.g., 0001-9999"
                  class="form-input">
              </div>

              <div class="form-group">
                <label for="serialNumber">Serial Number</label>
                <input 
                  type="text" 
                  id="serialNumber"
                  formControlName="serialNumber"
                  placeholder="Serial #"
                  class="form-input">
              </div>

              <div class="form-group">
                <label for="minNumber">Minimum Number</label>
                <input 
                  type="text" 
                  id="minNumber"
                  formControlName="minNumber"
                  placeholder="Min #"
                  class="form-input">
              </div>

              <!-- Subscription Section -->
              <div class="form-section-header">
                <h4>Subscription</h4>
              </div>

              <div class="form-group">
                <label for="subscriptionTier">Subscription Tier</label>
                <select 
                  id="subscriptionTier"
                  formControlName="subscriptionTier"
                  class="form-select">
                  <option value="free">Free</option>
                  <option value="freemium">Freemium</option>
                  <option value="premium">Premium</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>

              <div class="form-group">
                <label for="subscriptionStatus">Subscription Status</label>
                <select 
                  id="subscriptionStatus"
                  formControlName="subscriptionStatus"
                  class="form-select">
                  <option value="trial">Trial</option>
                  <option value="active">Active</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="expired">Expired</option>
                </select>
              </div>

              <div class="form-group">
                <label for="invoiceNo">Invoice Number (Legacy)</label>
                <input 
                  type="text" 
                  id="invoiceNo"
                  formControlName="invoiceNo"
                  placeholder="INV-0000-000000"
                  class="form-input">
                <div class="form-help">
                  Format: INV-YYYY-XXXXXX (e.g., INV-2025-000001)
                </div>
              </div>

              <div class="form-group">
                <label for="storeType">Store Type *</label>
                <select 
                  id="storeType"
                  formControlName="storeType"
                  class="form-select">
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
                <label for="address">Address *</label>
                <textarea 
                  id="address"
                  formControlName="address"
                  placeholder="Enter complete address"
                  class="form-textarea"
                  rows="3"></textarea>
                <div class="error-message" *ngIf="storeForm.get('address')?.invalid && storeForm.get('address')?.touched">
                  Address is required
                </div>
              </div>

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

              <div class="form-group">
                <label for="status">Status *</label>
                <select 
                  id="status"
                  formControlName="status"
                  class="form-select">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
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
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .stores-table {
      width: 100%;
      border-collapse: collapse;
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
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 1rem;
    }

    .modal {
      background: white;
      border-radius: 12px;
      max-width: 600px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.5rem;
      border-bottom: 1px solid #e2e8f0;
    }

    .modal-header h3 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
      color: #2d3748;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: #718096;
      padding: 0.25rem;
      line-height: 1;
    }

    .close-btn:hover {
      color: #4a5568;
    }

    .modal-body {
      padding: 1.5rem;
    }

    .form-group {
      margin-bottom: 1.5rem;
    }

    .form-group label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
      color: #2d3748;
    }

    .form-input,
    .form-select,
    .form-textarea {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 1rem;
      transition: border-color 0.2s;
    }

    .form-input:focus,
    .form-select:focus,
    .form-textarea:focus {
      outline: none;
      border-color: #059669;
      box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.1);
    }

    .form-textarea {
      resize: vertical;
      min-height: 80px;
    }

    .error-message {
      margin-top: 0.5rem;
      font-size: 0.875rem;
      color: #f56565;
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
        margin: 1rem;
        max-width: none;
        width: auto;
      }
    }
  `]
})
export class StoresManagementComponent implements OnInit {
  stores: Store[] = [];
  filteredStores: Store[] = [];
  storeTypes: PredefinedType[] = [];
  
  searchTerm: string = '';
  isLoading: boolean = false;
  showStoreModal: boolean = false;
  editingStore: Store | null = null;

  storeForm: FormGroup;

  constructor(
    private storeService: StoreService,
    private authService: AuthService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private toastService: ToastService,
    private predefinedTypesService: PredefinedTypesService
  ) {
    this.storeForm = this.fb.group({
      storeName: ['', [Validators.required]],
      storeCode: ['', [Validators.required]],
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
      // Subscription fields
      subscriptionTier: ['freemium'],
      subscriptionStatus: ['active'],
      subscriptionPopupShown: [false]
    });
  }

  async ngOnInit() {
    await this.loadStores();
    await this.loadStoreTypes();
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
        await this.storeService.loadStoresByCompany(currentPermission.companyId);
        this.stores = this.storeService.getStoresByCompany(currentPermission.companyId);
        this.filteredStores = [...this.stores];
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

  onSearchChange() {
    const term = this.searchTerm?.toLowerCase() || '';
    this.filteredStores = (this.stores || []).filter(store => 
      store.storeName?.toLowerCase().includes(term) ||
      store.storeCode?.toLowerCase().includes(term) ||
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
      storeCode: store.storeCode,
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
      // Subscription
      subscriptionTier: store.subscription?.tier || 'freemium',
      subscriptionStatus: store.subscription?.status || 'active',
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
      storeCode: '',
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
        permitDateIssued: formData.permitDateIssued ? new Date(formData.permitDateIssued) : new Date(),
        validityNotice: formData.validityNotice || ''
      };

      // Build the subscription object
      const subscription = {
        tier: formData.subscriptionTier || 'freemium',
        status: formData.subscriptionStatus || 'active',
        subscribedAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        billingCycle: 'monthly' as const,
        durationMonths: 12,
        amountPaid: 0,
        discountPercent: 0,
        finalAmount: 0,
        paymentMethod: 'gcash' as const,
        lastPaymentDate: new Date()
      };

      const storeData: Omit<Store, 'id' | 'createdAt' | 'updatedAt'> = {
        companyId: currentPermission.companyId,
        storeName: formData.storeName,
        storeCode: formData.storeCode,
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
        // Subscription
        subscription: subscription,
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
        await this.storeService.createStore(storeData);
        console.log('✅ Store created successfully');
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

  async deleteStore(store: Store) {
    if (confirm(`Are you sure you want to delete "${store.storeName}"?`)) {
      this.isLoading = true;
      
      try {
        await this.storeService.deleteStore(store.id!);
        await this.loadStores();
      } catch (error) {
        console.error('Error deleting store:', error);
        this.toastService.error('Error deleting store. Please try again.');
      } finally {
        this.isLoading = false;
      }
    }
  }

}
