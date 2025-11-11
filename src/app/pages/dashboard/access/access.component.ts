import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { RoleDefinitionService, RoleDefinition, RolePermissions } from '../../../services/role-definition.service';
import { StoreService, Store } from '../../../services/store.service';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../shared/services/toast.service';
import { ConfirmationDialogComponent, ConfirmationDialogData } from '../../../shared/components/confirmation-dialog/confirmation-dialog.component';

@Component({
  selector: 'app-access',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmationDialogComponent],
  template: `
    <div class="access-management">
      <!-- Header -->
      <div class="header">
        <div class="header-content">
          <h1 class="page-title">Access Management</h1>
          <p class="page-subtitle">Manage roles and permissions for your organization</p>
        </div>
      </div>

      <!-- Main Content -->

      <!-- Store selector: placed above the tabs so it's globally visible for filtering -->
      <div style="max-width:1200px; margin:0 auto 1rem auto; padding:0 1rem; display:flex; gap:0.75rem; align-items:center;">
        <label style="font-weight:600; color:#4a5568; margin-right:0.5rem;">Store:</label>
        <select class="form-input" [(ngModel)]="selectedStoreId" (change)="onStoreFilterChange()">
          <option value="">All Stores</option>
          <option *ngFor="let store of accessibleStores()" [value]="store.id">{{ store.storeName }}</option>
        </select>
      </div>

      <div class="tabs-container">
        <!-- Loading State -->
        <div *ngIf="isLoading" class="loading-state">
          <div class="loading-content">
            <div class="spinner"></div>
            <p>Loading roles...</p>
          </div>
        </div>

        <!-- Tab Headers -->
        <div *ngIf="!isLoading" class="tab-headers">
          <div 
            *ngFor="let role of filteredRoles(); let i = index" 
            class="tab-header" 
            [class.active]="activeTabIndex === i"
            (click)="setActiveTab(i)">
            <div class="tab-content">
              <div class="tab-label">{{ role.roleId }}</div>
              <div class="tab-details">{{ getPermissionCount(role.permissions) }} permissions</div>
            </div>
          </div>
              <div class="tab-header add-role-tab" (click)="addNewRole()">
            <div class="tab-content">
              <div class="tab-label">+ Add Role</div>
              <div class="tab-details">Create new role</div>
            </div>
          </div>
              
        </div>

        <!-- Tab Content Area -->
  <div *ngIf="!isLoading && activeRole" class="tab-content-area">
          <!-- Role Header -->
          <div class="role-header">
            <h2 class="role-title">{{ activeRole.roleId }}</h2>
            <div class="role-actions">
              <button class="btn-gradient" (click)="duplicateRole(activeRole)" title="Duplicate Role" aria-label="Duplicate Role">
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v16h13c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 18H8V7h11v16z"/>
                </svg>
                Duplicate Role
              </button>
              <button 
                *ngIf="!isDefaultRole(activeRole.roleId)" 
                class="btn btn-danger" 
                (click)="deleteRole(activeRole)">
                Delete Role
              </button>
            </div>
          </div>

          <!-- Permissions Section -->
          <div class="permissions-section">
            <h3 class="permissions-title">Permissions</h3>
            <p class="permissions-subtitle">Configure what this role can access and do</p>
            
            <div class="permissions-grid">
              <!-- Product Management -->
              <div class="permission-group">
                <h4 class="group-title">Product Management</h4>
                <div class="permission-items">
                  <div class="permission-item">
                    <label class="permission-label">
                      <input 
                        type="checkbox" 
                        [(ngModel)]="activeRole.permissions.canViewProducts"
                        (change)="updateRole(activeRole)">
                      <div class="permission-text">
                        <span class="permission-name">View Products</span>
                        <span class="permission-desc">Access product catalog</span>
                      </div>
                    </label>
                  </div>
                  <div class="permission-item">
                    <label class="permission-label">
                      <input 
                        type="checkbox" 
                        [(ngModel)]="activeRole.permissions.canAddProducts"
                        (change)="updateRole(activeRole)">
                      <div class="permission-text">
                        <span class="permission-name">Add Products</span>
                        <span class="permission-desc">Create and edit products</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              <!-- Company Management -->
              <div class="permission-group">
                <h4 class="group-title">Company Management</h4>
                <div class="permission-items">
                  <div class="permission-item">
                    <label class="permission-label">
                      <input 
                        type="checkbox" 
                        [(ngModel)]="activeRole.permissions.canViewCompanyProfile"
                        (change)="updateRole(activeRole)">
                      <div class="permission-text">
                        <span class="permission-name">View Company Profile</span>
                        <span class="permission-desc">Access company information</span>
                      </div>
                    </label>
                  </div>
                  <div class="permission-item">
                    <label class="permission-label">
                      <input 
                        type="checkbox" 
                        [(ngModel)]="activeRole.permissions.canAddCompanyProfile"
                        (change)="updateRole(activeRole)">
                      <div class="permission-text">
                        <span class="permission-name">Edit Company Profile</span>
                        <span class="permission-desc">Modify company settings</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              <!-- POS System -->
              <div class="permission-group">
                <h4 class="group-title">POS System</h4>
                <div class="permission-items">
                  <div class="permission-item">
                    <label class="permission-label">
                      <input 
                        type="checkbox" 
                        [(ngModel)]="activeRole.permissions.canViewPOS"
                        (change)="updateRole(activeRole)">
                      <div class="permission-text">
                        <span class="permission-name">Access POS</span>
                        <span class="permission-desc">Use point of sale system</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <!-- Save Section -->
            <div class="save-section">
              <button class="btn-gradient save-btn" (click)="saveAllChanges()" [disabled]="isLoading" title="Save Changes" aria-label="Save Changes">
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4zm-5 16a3 3 0 1 1 .001-6.001A3 3 0 0 1 12 19zm3-10H5V5h10v4z"/>
                </svg>
                Save Changes
              </button>
            </div>
          </div>
        </div>

  <!-- Empty State -->
  <div *ngIf="!isLoading && filteredRoles().length === 0" class="empty-state">
          <div class="empty-content">
            <h3>No roles found</h3>
            <p>Create your first role to get started</p>
            <button class="btn btn-primary" (click)="addNewRole()">Add Role</button>
          </div>
        </div>
      </div>

      <!-- Add Role Modal -->
  <div *ngIf="showAddRoleModal" class="modal-overlay" (click)="closeAddRoleModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Add New Role</h3>
            <button class="close-btn" (click)="closeAddRoleModal()">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label for="roleId">Role Name</label>
              <input 
                type="text" 
                id="roleId" 
                class="form-input" 
                [(ngModel)]="newRoleId" 
                placeholder="Enter role name"
                (input)="validateRoleName()">
              <div class="form-help">Role name will be converted to lowercase with underscores</div>
              <div *ngIf="roleNameError" class="form-error" style="color: #e53e3e; font-size: 0.875rem; margin-top: 0.25rem;">
                {{ roleNameError }}
              </div>
            </div>
              <div class="form-group">
              <label for="storeId">Store</label>
              <select id="storeId" class="form-input" [(ngModel)]="selectedStoreId" (change)="validateRoleName()">
                <option value="">Select a store</option>
                <option *ngFor="let store of stores" [value]="store.id">{{ store.storeName }}</option>
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeAddRoleModal()">Cancel</button>
            <button class="btn btn-primary" (click)="createNewRole()" [disabled]="!newRoleId.trim() || roleNameError">
              Create Role
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Confirmation Dialog -->
    <app-confirmation-dialog
      *ngIf="showConfirmDialog"
      [dialogData]="confirmDialogData"
      (confirmed)="onConfirmDialog()"
      (cancelled)="onCancelDialog()"
    />
  `,
  styles: [
    '.access-management { padding: 0; min-height: 100vh; background: #f8fafc; } .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 2rem 0; margin-bottom: 2rem; } .header-content { max-width: 1200px; margin: 0 auto; padding: 0 1rem; } .page-title { font-size: 2.5rem; font-weight: 700; margin: 0 0 0.5rem 0; } .page-subtitle { font-size: 1.1rem; opacity: 0.9; margin: 0; } .tabs-container { max-width: 1200px; margin: 0 auto; padding: 0 1rem; } .tab-headers { display: flex; gap: 0.5rem; margin-bottom: 2rem; flex-wrap: wrap; } .tab-header { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem 1.5rem; cursor: pointer; transition: all 0.2s; min-width: 160px; text-align: left; } .tab-header:hover { border-color: #667eea; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); } .tab-header.active { border-color: #667eea; background: #667eea; color: white; } .add-role-tab { border: 2px dashed #cbd5e0; background: transparent; color: #4a5568; } .add-role-tab:hover { border-color: #667eea; background: #f7fafc; color: #667eea; } .tab-content { display: flex; flex-direction: column; gap: 0.25rem; } .tab-label { font-weight: 600; font-size: 1rem; } .tab-details { font-size: 0.875rem; opacity: 0.7; } .tab-content-area { background: white; border-radius: 12px; padding: 2rem; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); margin-bottom: 2rem; } .role-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid #e2e8f0; } .role-title { font-size: 1.875rem; font-weight: 700; color: #1a202c; margin: 0; } .role-actions { display: flex; gap: 0.75rem; } .permissions-section { margin-top: 2rem; } .permissions-title { font-size: 1.5rem; font-weight: 600; color: #2d3748; margin: 0 0 0.5rem 0; } .permissions-subtitle { color: #718096; margin: 0 0 2rem 0; font-size: 0.95rem; } .permissions-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; margin-bottom: 2rem; } .permission-group { background: #f8fafc; border-radius: 8px; padding: 1.5rem; border: 1px solid #e2e8f0; } .group-title { font-size: 1.125rem; font-weight: 600; color: #2d3748; margin: 0 0 1rem 0; padding-bottom: 0.75rem; border-bottom: 1px solid #e2e8f0; } .permission-items { display: flex; flex-direction: column; gap: 1rem; } .permission-item { background: white; border-radius: 6px; padding: 1rem; border: 1px solid #e2e8f0; transition: border-color 0.2s; } .permission-item:hover { border-color: #cbd5e0; } .permission-label { display: flex; align-items: flex-start; gap: 0.75rem; cursor: pointer; font-weight: 500; } .permission-label input[type="checkbox"] { width: 18px; height: 18px; margin: 0; cursor: pointer; } .permission-text { flex: 1; display: flex; flex-direction: column; gap: 0.25rem; } .permission-name { font-weight: 500; color: #2d3748; font-size: 0.95rem; } .permission-desc { color: #718096; font-size: 0.875rem; line-height: 1.4; } .save-section { margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; } .save-btn { padding: 0.75rem 2rem; font-size: 1rem; } .btn { border: none; border-radius: 6px; padding: 0.5rem 1rem; font-weight: 500; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 0.5rem; text-decoration: none; } .btn:disabled { opacity: 0.6; cursor: not-allowed; } .btn-primary { background: #667eea; color: white; } .btn-primary:hover:not(:disabled) { background: #5a6fd8; } .btn-secondary { background: #e2e8f0; color: #4a5568; } .btn-secondary:hover:not(:disabled) { background: #cbd5e0; } .btn-danger { background: #f56565; color: white; } .btn-danger:hover:not(:disabled) { background: #e53e3e; } .btn-gradient { display: inline-flex; align-items: center; gap: 6px; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; border: none; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 2px 4px rgba(79, 70, 229, 0.2); } .btn-gradient:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3); background: linear-gradient(135deg, #4338ca 0%, #6d28d9 100%); } .btn-gradient:disabled { opacity: 0.6; cursor: not-allowed; transform: none; } .btn-gradient svg { width: 16px; height: 16px; } .empty-state, .loading-state { text-align: center; padding: 4rem 2rem; color: #718096; } .empty-content h3, .loading-content p { margin-bottom: 1rem; } .spinner { width: 40px; height: 40px; border: 4px solid #e2e8f0; border-top-color: #667eea; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1rem; } @keyframes spin { to { transform: rotate(360deg); } } .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; } .modal { background: white; border-radius: 12px; max-width: 500px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); } .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1.5rem; border-bottom: 1px solid #e2e8f0; } .modal-header h3 { margin: 0; font-size: 1.25rem; font-weight: 600; color: #2d3748; } .close-btn { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #718096; padding: 0.25rem; line-height: 1; } .close-btn:hover { color: #4a5568; } .modal-body { padding: 1.5rem; } .form-group { margin-bottom: 1rem; } .form-group label { display: block; margin-bottom: 0.5rem; font-weight: 500; color: #2d3748; } .form-input { width: 100%; padding: 0.75rem; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 1rem; transition: border-color 0.2s; } .form-input:focus { outline: none; border-color: #667eea; box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1); } .form-help { margin-top: 0.5rem; font-size: 0.875rem; color: #718096; } .modal-footer { display: flex; gap: 0.75rem; justify-content: flex-end; padding: 1.5rem; border-top: 1px solid #e2e8f0; background: #f8fafc; } @media (max-width: 768px) { .header { padding: 1.5rem 0; } .page-title { font-size: 2rem; } .tab-headers { flex-direction: column; } .tab-header { min-width: auto; } .role-header { flex-direction: column; align-items: flex-start; gap: 1rem; } .role-actions { width: 100%; justify-content: flex-start; } .permissions-grid { grid-template-columns: 1fr; gap: 1.5rem; } }'
  ]
})
export class AccessComponent implements OnInit {
  // Component properties
  roles: RoleDefinition[] = [];
  activeTabIndex = 0;
  activeRole: RoleDefinition | null = null;
  isLoading = false;
  showAddRoleModal = false;
  newRoleId = '';
  roleNameError = '';
  selectedStoreId = '';
  stores: Store[] = [];

  // Confirmation dialog properties
  showConfirmDialog = false;
  confirmDialogData: ConfirmationDialogData = {
    title: '',
    message: '',
    confirmText: 'OK',
    cancelText: '',
    type: 'info'
  };
  private confirmCallback: (() => void) | null = null;

  constructor(
    private roleDefinitionService: RoleDefinitionService,
    private storeService: StoreService,
    private authService: AuthService,
    private toastService: ToastService
  ) {}

  // Return roles filtered by selected store. If no store selected, return all roles.
  filteredRoles(): RoleDefinition[] {
    if (!this.selectedStoreId) return this.roles || [];
    return (this.roles || []).filter(r => (r.storeId || '') === this.selectedStoreId);
  }

  onStoreFilterChange(): void {
    // Reset active tab to first item in the filtered set
    const set = this.filteredRoles();
    this.setActiveTab(0);
    this.roles = this.roles || [];
    this.activeRole = set[0] || null;
  }

  async ngOnInit() {
    await this.loadRoles();
    await this.loadStores();
  }

  // Confirmation dialog methods
  showConfirmationDialog(data: ConfirmationDialogData, callback?: () => void): void {
    this.confirmDialogData = data;
    this.confirmCallback = callback || null;
    this.showConfirmDialog = true;
  }

  onConfirmDialog(): void {
    this.showConfirmDialog = false;
    if (this.confirmCallback) {
      this.confirmCallback();
      this.confirmCallback = null;
    }
  }

  onCancelDialog(): void {
    this.showConfirmDialog = false;
    this.confirmCallback = null;
  }

  async loadRoles() {
    this.isLoading = true;
    try {
      await this.roleDefinitionService.loadRoleDefinitions();
      this.roles = this.roleDefinitionService.roleDefinitions() || [];
      if (this.roles.length > 0) {
        this.setActiveTab(0);
      }
    } catch (error) {
      console.error('Error loading roles:', error);
      this.displayError('Failed to load roles');
    } finally {
      this.isLoading = false;
    }
  }

  async loadStores() {
    try {
      const currentPermission = this.authService.getCurrentPermission();
      if (currentPermission?.companyId) {
        await this.storeService.loadStoresByCompany(currentPermission.companyId);
        this.stores = this.storeService.getStoresByCompany(currentPermission.companyId);
        // If the current permission includes a storeId, prefer it as the default selected store
        const permStoreId = currentPermission.storeId;
        if (permStoreId) {
          const found = this.stores.some(s => s.id === permStoreId);
          if (found) {
            this.selectedStoreId = permStoreId;
          }
        }

        // If no explicit permission store selected, but user only has one accessible store, default to it
        if (!this.selectedStoreId) {
          const accessible = this.accessibleStores();
          if (accessible.length === 1) {
            this.selectedStoreId = accessible[0].id || '';
          }
        }

        // Ensure active role reflects the selected store
        if (this.selectedStoreId) {
          const filtered = this.filteredRoles();
          if (filtered.length > 0) {
            this.activeRole = filtered[0];
            this.activeTabIndex = 0;
          }
        }
      }
    } catch (error) {
      console.error('Error loading stores:', error);
    }
  }

  /**
   * Return stores that the current user has access to.
   * Prefers explicit store-level permissions; falls back to company-level access.
   */
  accessibleStores(): Store[] {
    const all = this.stores || [];
    const user = this.authService.getCurrentUser();
    if (!user) return [];

    let perms: any = user.permissions || [];
    if (perms && !Array.isArray(perms)) perms = [perms];
    if (!perms || perms.length === 0) return [];

    const allowedStoreIds = new Set<string>();
    const allowedCompanyIds = new Set<string>();
    perms.forEach((p: any) => {
      if (p?.storeId) allowedStoreIds.add(p.storeId);
      if (p?.companyId) allowedCompanyIds.add(p.companyId);
    });

    // Return stores that either match explicit store permissions or match the allowed companies.
    return all.filter(s => {
      const sid = s.id || '';
      const cid = s.companyId || '';
      return (allowedStoreIds.size > 0 && allowedStoreIds.has(sid)) || (allowedCompanyIds.size > 0 && allowedCompanyIds.has(cid));
    });
  }

  isDefaultRole(roleId: string): boolean {
    return ['creator', 'store_manager', 'cashier'].includes(roleId);
  }

  async updateRole(role: RoleDefinition) {
    if (!role.id) return;
    try {
      await this.roleDefinitionService.updateRoleDefinition(role.id, role);
    } catch (error) {
      console.error('Error updating role:', error);
      await this.roleDefinitionService.loadRoleDefinitions();
      this.loadRoles();
    }
  }

  async saveAllChanges() {
    if (!this.activeRole) return;
    this.isLoading = true;
    try {
      await this.roleDefinitionService.updateRoleDefinition(this.activeRole.id!, this.activeRole);
      await this.roleDefinitionService.loadRoleDefinitions();
      this.loadRoles();
      this.isLoading = false;
    } catch (error) {
      console.error('Error saving changes:', error);
      this.isLoading = false;
      this.toastService.error('Error saving changes. Please try again.');
      await this.roleDefinitionService.loadRoleDefinitions();
      this.loadRoles();
    }
  }

  duplicateRole(role: RoleDefinition) {
    this.newRoleId = role.roleId + '_copy';
    this.showAddRoleModal = true;
  }

  async deleteRole(role: RoleDefinition) {
    if (this.isDefaultRole(role.roleId)) {
      this.showConfirmationDialog({
        title: 'Cannot Delete Role',
        message: 'Default roles cannot be deleted.',
        confirmText: 'OK',
        type: 'warning'
      });
      return;
    }
    
    this.showConfirmationDialog({
      title: 'Delete Role',
      message: `Are you sure you want to delete the "${role.roleId}" role? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger'
    }, async () => {
      this.isLoading = true;
      try {
        await this.roleDefinitionService.deleteRoleDefinition(role.id!);
        await this.roleDefinitionService.loadRoleDefinitions();
        this.loadRoles();
        this.toastService.success(`Role "${role.roleId}" deleted successfully.`);
        this.isLoading = false;
      } catch (error) {
        console.error('Error deleting role:', error);
        this.isLoading = false;
        this.toastService.error('Error deleting role. Please try again.');
      }
    });
  }

  getPermissionCount(permissions: RolePermissions): number {
    return Object.values(permissions).filter(Boolean).length;
  }

  setActiveTab(index: number): void {
    this.activeTabIndex = index;
    // When a store filter is active, pick from filteredRoles(); otherwise from full roles list
    const list = this.selectedStoreId ? this.filteredRoles() : this.roles;
    this.activeRole = list[index] || null;
  }

  addNewRole(): void {
    this.newRoleId = '';
    this.roleNameError = '';
    this.selectedStoreId = '';
    this.showAddRoleModal = true;
  }

  validateRoleName(): void {
    if (!this.newRoleId.trim()) {
      this.roleNameError = '';
      return;
    }
    
    const roleId = this.newRoleId.toLowerCase().replace(/\s+/g, '_');
    
    // Check for duplicates with same roleId, companyId, and storeId combination
    const duplicateRole = this.roles.find(role => 
      role.roleId === roleId && 
      role.storeId === (this.selectedStoreId || '')
    );
    
    if (duplicateRole) {
      if (this.selectedStoreId) {
        this.roleNameError = `A role with the name "${roleId}" already exists in the selected store.`;
      } else {
        this.roleNameError = `A role with the name "${roleId}" already exists at the company level.`;
      }
      return;
    }
    
    // Check for reserved names
    const reservedRoles = ['creator', 'cashier', 'store_manager', 'admin', 'owner'];
    if (reservedRoles.includes(roleId)) {
      this.roleNameError = `"${roleId}" is a reserved role name.`;
      return;
    }
    
    // Clear error if validation passes
    this.roleNameError = '';
  }

  async createNewRole(): Promise<void> {
    if (!this.newRoleId.trim()) {
      this.toastService.warning('Please enter a role name.');
      return;
    }
    
    const roleId = this.newRoleId.toLowerCase().replace(/\s+/g, '_');
    
    // Client-side validation for duplicates with same roleId, companyId, and storeId combination
    const duplicateRole = this.roles.find(role => 
      role.roleId === roleId && 
      role.storeId === (this.selectedStoreId || '')
    );
    
    if (duplicateRole) {
      if (this.selectedStoreId) {
        this.toastService.warning(`A role with the name "${roleId}" already exists in the selected store. Please choose a different name.`);
      } else {
        this.toastService.warning(`A role with the name "${roleId}" already exists at the company level. Please choose a different name.`);
      }
      return;
    }
    
    // Validate against reserved role names
    const reservedRoles = ['creator', 'cashier', 'store_manager', 'admin', 'owner'];
    if (reservedRoles.includes(roleId)) {
      this.toastService.warning(`"${roleId}" is a reserved role name. Please choose a different name.`);
      return;
    }

    try {
      this.isLoading = true;
      const currentPermission = this.authService.getCurrentPermission();
      if (!currentPermission?.companyId) {
        throw new Error('User company not found');
      }

      const newRole: Omit<RoleDefinition, 'id'> = {
        roleId,
        companyId: currentPermission.companyId,
        storeId: this.selectedStoreId || '',
        permissions: {
          canViewProducts: false,
          canAddProducts: false,
          canViewCompanyProfile: false,
          canAddCompanyProfile: false,
          canEditCompanyProfile: false,
          canViewPOS: false,
          canAddStore: false,
          canViewStore: false,
          canViewInventory: false,
          canRemoveUsers: false,
          canAddUser: false,
          canMakePOS: false,
          canViewOverview: false
        }
      };

      await this.roleDefinitionService.createRoleDefinition(newRole);
      await this.roleDefinitionService.loadRoleDefinitions();
      this.loadRoles();
      this.closeAddRoleModal();
    } catch (error) {
      console.error('Error creating role:', error);
      if (error instanceof Error && error.message.includes('already exists')) {
        this.toastService.error(error.message);
      } else {
        this.toastService.error('Failed to create role. Please try again.');
      }
    } finally {
      this.isLoading = false;
    }
  }

  closeAddRoleModal(): void {
    this.showAddRoleModal = false;
    this.newRoleId = '';
    this.roleNameError = '';
    this.selectedStoreId = '';
  }

  displayError(message: string): void {
    console.error('AccessComponent Error:', message);
  }

  resetRoleState(): void {
    this.roles = [];
    this.activeRole = null;
    this.activeTabIndex = 0;
  }
}