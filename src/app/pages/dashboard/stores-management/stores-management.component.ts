import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { StoreService, Store } from '../../../services/store.service';
import { AuthService } from '../../../services/auth.service';

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
                <th>Store Type</th>
                <th>Address</th>
                <th>Manager</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let store of filteredStores">
                <td class="store-name-cell">{{ store.storeName }}</td>
                <td class="store-code-cell">{{ store.storeCode }}</td>
                <td class="store-type-cell">{{ store.storeType }}</td>
                <td class="address-cell">{{ store.address }}</td>
                <td class="manager-cell">{{ store.managerName || 'Not assigned' }}</td>
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
                <label for="storeType">Store Type *</label>
                <select 
                  id="storeType"
                  formControlName="storeType"
                  class="form-select">
                  <option value="">Select store type</option>
                  <option value="Convenience Store">Convenience Store</option>
                  <option value="Supermarket">Supermarket</option>
                  <option value="Department Store">Department Store</option>
                  <option value="Specialty Store">Specialty Store</option>
                  <option value="Warehouse">Warehouse</option>
                  <option value="Outlet">Outlet</option>
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
                <label for="managerName">Manager Name</label>
                <input 
                  type="text" 
                  id="managerName"
                  formControlName="managerName"
                  placeholder="Enter manager name"
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
      background: linear-gradient(135deg, #059669 0%, #10b981 100%);
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

    .manager-cell {
      color: #4a5568;
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
  
  searchTerm: string = '';
  isLoading: boolean = false;
  showStoreModal: boolean = false;
  editingStore: Store | null = null;

  storeForm: FormGroup;

  constructor(
    private storeService: StoreService,
    private authService: AuthService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.storeForm = this.fb.group({
      storeName: ['', [Validators.required]],
      storeCode: ['', [Validators.required]],
      storeType: ['', [Validators.required]],
      address: ['', [Validators.required]],
      phoneNumber: [''],
      email: ['', [Validators.email]],
      managerName: [''],
      status: ['active', [Validators.required]]
    });
  }

  async ngOnInit() {
    await this.loadStores();
  }

  async loadStores() {
    this.isLoading = true;
    
    try {
      const currentUser = await this.authService.waitForAuth();
      if (currentUser?.companyId) {
        await this.storeService.loadStores(currentUser.companyId);
        this.stores = this.storeService.getStoresByCompany(currentUser.companyId);
        this.filteredStores = [...this.stores];
      }
    } catch (error) {
      console.error('Error loading stores:', error);
    } finally {
      this.isLoading = false;
    }
  }

  onSearchChange() {
    if (!this.searchTerm.trim()) {
      this.filteredStores = [...this.stores];
      return;
    }

    const term = this.searchTerm.toLowerCase();
    this.filteredStores = this.stores.filter(store => 
      store.storeName.toLowerCase().includes(term) ||
      store.storeCode.toLowerCase().includes(term) ||
      store.storeType.toLowerCase().includes(term) ||
      store.address.toLowerCase().includes(term)
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
      status: 'active'
    });
    this.showStoreModal = true;
    console.log('showStoreModal set to:', this.showStoreModal);
    this.cdr.detectChanges();
  }

  editStore(store: Store) {
    this.editingStore = store;
    this.storeForm.patchValue({
      storeName: store.storeName,
      storeCode: store.storeCode,
      storeType: store.storeType,
      address: store.address,
      phoneNumber: store.phoneNumber || '',
      email: store.email || '',
      managerName: store.managerName || '',
      status: store.status
    });
    this.showStoreModal = true;
  }

  cancelStoreModal() {
    this.showStoreModal = false;
    this.editingStore = null;
    this.storeForm.reset();
  }

  async saveStore() {
    if (!this.storeForm.valid) {
      this.storeForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;

    try {
      const currentUser = await this.authService.waitForAuth();
      if (!currentUser?.companyId) {
        throw new Error('No company ID found');
      }

      const formData = this.storeForm.value;
      const storeData: Omit<Store, 'id' | 'createdAt' | 'updatedAt'> = {
        ...formData,
        companyId: currentUser.companyId
      };

      if (this.editingStore) {
        // Update existing store
        await this.storeService.updateStore(this.editingStore.id!, storeData);
      } else {
        // Create new store
        await this.storeService.createStore(storeData);
      }

      await this.loadStores();
      this.cancelStoreModal();
    } catch (error) {
      console.error('Error saving store:', error);
      alert('Error saving store. Please try again.');
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
        alert('Error deleting store. Please try again.');
      } finally {
        this.isLoading = false;
      }
    }
  }
}
