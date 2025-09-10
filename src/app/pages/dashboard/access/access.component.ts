import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RoleDefinitionService, RoleDefinition, RolePermissions } from '../../../services/role-definition.service';
import { StoreService } from '../../../services/store.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-access',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="access-management">
      <!-- Header -->
      <div class="header">
        <div class="header-content">
          <div class="header-text">
            <h1 class="page-title">Access Management</h1>
            <p class="page-subtitle">Manage roles and permissions for your team</p>
          </div>
        </div>
      </div>

      <!-- Tabs Interface -->
      <div class="tabs-container">
        <!-- Tab Headers -->
        <div class="tab-headers">
          <button 
            *ngFor="let role of roles; let i = index" 
            (click)="setActiveTab(i)"
            class="tab-header"
            [class.active]="activeTabIndex === i">
            <div class="tab-content">
              <span class="tab-label">{{ role.roleId | titlecase }}</span>
              <div class="tab-details">
                {{ getPermissionCount(role.permissions) }} permissions
              </div>
            </div>
          </button>

          <!-- Add New Role Tab -->
          <button 
            (click)="addNewRole()"
            class="tab-header add-role-tab">
            <div class="tab-content">
              <span class="tab-label">+ Add Role</span>
            </div>
          </button>
        </div>

        <!-- Tab Content Area -->
        <div class="tab-content-area" *ngIf="activeRole">
          <div class="role-header">
            <h2 class="role-title">{{ activeRole.roleId | titlecase }} Role</h2>
            <div class="role-actions">
              <button 
                class="btn btn-secondary"
                (click)="duplicateRole(activeRole)">
                Duplicate Role
              </button>
              <button 
                class="btn btn-danger"
                (click)="deleteRole(activeRole)"
                [disabled]="isDefaultRole(activeRole.roleId)">
                Delete Role
              </button>
            </div>
          </div>

          <!-- Permissions Grid -->
          <div class="permissions-section">
            <h3 class="permissions-title">Permissions</h3>
            <p class="permissions-subtitle">Configure what this role can access and modify</p>
            
            <div class="permissions-grid">
              <!-- POS Permissions -->
              <div class="permission-group">
                <h4 class="group-title">Point of Sale</h4>
                <div class="permission-items">
                  <div class="permission-item">
                    <label class="permission-label">
                      <input 
                        type="checkbox" 
                        [(ngModel)]="activeRole.permissions.canViewPOS"
                        (change)="updateRole(activeRole)">
                      <span class="checkmark"></span>
                      <div class="permission-text">
                        <span class="permission-name">View POS</span>
                        <span class="permission-desc">Access the point of sale interface</span>
                      </div>
                    </label>
                  </div>

                  <div class="permission-item">
                    <label class="permission-label">
                      <input 
                        type="checkbox" 
                        [(ngModel)]="activeRole.permissions.canMakePOS"
                        (change)="updateRole(activeRole)">
                      <span class="checkmark"></span>
                      <div class="permission-text">
                        <span class="permission-name">Make Transactions</span>
                        <span class="permission-desc">Process sales and transactions</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              <!-- Store Management -->
              <div class="permission-group">
                <h4 class="group-title">Store Management</h4>
                <div class="permission-items">
                  <div class="permission-item">
                    <label class="permission-label">
                      <input 
                        type="checkbox" 
                        [(ngModel)]="activeRole.permissions.canViewStore"
                        (change)="updateRole(activeRole)">
                      <span class="checkmark"></span>
                      <div class="permission-text">
                        <span class="permission-name">View Stores</span>
                        <span class="permission-desc">Access store information</span>
                      </div>
                    </label>
                  </div>

                  <div class="permission-item">
                    <label class="permission-label">
                      <input 
                        type="checkbox" 
                        [(ngModel)]="activeRole.permissions.canAddStore"
                        (change)="updateRole(activeRole)">
                      <span class="checkmark"></span>
                      <div class="permission-text">
                        <span class="permission-name">Add Stores</span>
                        <span class="permission-desc">Create new store locations</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

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
                      <span class="checkmark"></span>
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
                      <span class="checkmark"></span>
                      <div class="permission-text">
                        <span class="permission-name">Add Products</span>
                        <span class="permission-desc">Create and edit products</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              <!-- Inventory Management -->
              <div class="permission-group">
                <h4 class="group-title">Inventory</h4>
                <div class="permission-items">
                  <div class="permission-item">
                    <label class="permission-label">
                      <input 
                        type="checkbox" 
                        [(ngModel)]="activeRole.permissions.canViewInventory"
                        (change)="updateRole(activeRole)">
                      <span class="checkmark"></span>
                      <div class="permission-text">
                        <span class="permission-name">View Inventory</span>
                        <span class="permission-desc">Access inventory levels and reports</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              <!-- User Management -->
              <div class="permission-group">
                <h4 class="group-title">User Management</h4>
                <div class="permission-items">
                  <div class="permission-item">
                    <label class="permission-label">
                      <input 
                        type="checkbox" 
                        [(ngModel)]="activeRole.permissions.canAddUser"
                        (change)="updateRole(activeRole)">
                      <span class="checkmark"></span>
                      <div class="permission-text">
                        <span class="permission-name">Add Users</span>
                        <span class="permission-desc">Invite and create user accounts</span>
                      </div>
                    </label>
                  </div>

                  <div class="permission-item">
                    <label class="permission-label">
                      <input 
                        type="checkbox" 
                        [(ngModel)]="activeRole.permissions.canRemoveUsers"
                        (change)="updateRole(activeRole)">
                      <span class="checkmark"></span>
                      <div class="permission-text">
                        <span class="permission-name">Remove Users</span>
                        <span class="permission-desc">Deactivate user accounts</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <!-- Save Button -->
            <div class="save-section">
              <button 
                class="btn btn-primary save-btn"
                (click)="saveAllChanges()"
                [disabled]="isLoading">
                {{ isLoading ? 'Saving...' : 'Save Changes' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div class="empty-state" *ngIf="roles.length === 0 && !isLoading">
          <div class="empty-content">
            <h3>No Roles Found</h3>
            <p>No roles were found for your company. This could mean:</p>
            <ul style="text-align: left; max-width: 400px; margin: 1rem auto;">
              <li>No roles have been created yet for your company</li>
              <li>Your user account may not have a companyId or store access configured</li>
              <li>There might be a data loading issue</li>
            </ul>
            <p style="font-size: 0.9rem; color: #666; margin-top: 1rem;">
              Debug: Check the browser console for detailed information about user authentication and company data.
            </p>
            <div style="margin-top: 1.5rem;">
              <button class="btn btn-primary" (click)="addNewRole()">
                Create First Role
              </button>
              <button class="btn btn-secondary" (click)="loadRoles()" style="margin-left: 0.5rem;">
                Refresh Roles
              </button>
            </div>
            
            <!-- Debug Information -->
            <div class="debug-info" style="margin-top: 2rem; padding: 1rem; background: #f8f9fa; border-radius: 6px; border: 1px solid #dee2e6;">
              <details>
                <summary style="cursor: pointer; font-weight: 500; margin-bottom: 0.5rem;">Debug Information</summary>
                <div style="font-size: 0.875rem; color: #6c757d; text-align: left;">
                  <p><strong>Authentication Status:</strong> {{ authService.isAuthenticated() ? 'Authenticated' : 'Not Authenticated' }}</p>
                  <p><strong>Current User:</strong> {{ authService.currentUser()?.email || 'None' }}</p>
                  <p><strong>Company ID:</strong> {{ authService.currentUser()?.companyId || 'None' }}</p>
                  <p><strong>Store IDs:</strong> {{ authService.currentUser()?.storeIds?.join(', ') || 'None' }}</p>
                  <p><strong>Loading State:</strong> {{ isLoading ? 'Loading...' : 'Idle' }}</p>
                </div>
              </details>
            </div>
          </div>
        </div>

        <!-- Loading State -->
        <div class="loading-state" *ngIf="isLoading && roles.length === 0">
          <div class="loading-content">
            <div class="spinner"></div>
            <p>Loading roles...</p>
          </div>
        </div>
      </div>

      <!-- Add Role Modal -->
      <div class="modal-overlay" *ngIf="showAddRoleModal" (click)="cancelAddRole()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Add New Role</h3>
            <button class="close-btn" (click)="cancelAddRole()">×</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label for="roleName">Role Name</label>
              <input 
                type="text" 
                id="roleName"
                [(ngModel)]="newRoleId"
                placeholder="Enter role name..."
                class="form-input">
            </div>
            <p class="form-help">
              Role names will be converted to lowercase with underscores (e.g., "Store Manager" becomes "store_manager")
            </p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="cancelAddRole()">Cancel</button>
            <button 
              class="btn btn-primary" 
              (click)="createNewRole()"
              [disabled]="!newRoleId.trim() || isLoading">
              {{ isLoading ? 'Creating...' : 'Create Role' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .access-management {
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

    .tabs-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 1rem;
    }

    .tab-headers {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 2rem;
      flex-wrap: wrap;
    }

    .tab-header {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1rem 1.5rem;
      cursor: pointer;
      transition: all 0.2s;
      min-width: 160px;
      text-align: left;
    }

    .tab-header:hover {
      border-color: #667eea;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .tab-header.active {
      border-color: #667eea;
      background: #667eea;
      color: white;
    }

    .add-role-tab {
      border: 2px dashed #cbd5e0;
      background: transparent;
      color: #4a5568;
    }

    .add-role-tab:hover {
      border-color: #667eea;
      background: #f7fafc;
      color: #667eea;
    }

    .tab-content {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .tab-label {
      font-weight: 600;
      font-size: 1rem;
    }

    .tab-details {
      font-size: 0.875rem;
      opacity: 0.7;
    }

    .tab-content-area {
      background: white;
      border-radius: 12px;
      padding: 2rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      margin-bottom: 2rem;
    }

    .role-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #e2e8f0;
    }

    .role-title {
      font-size: 1.875rem;
      font-weight: 700;
      color: #1a202c;
      margin: 0;
    }

    .role-actions {
      display: flex;
      gap: 0.75rem;
    }

    .permissions-section {
      margin-top: 2rem;
    }

    .permissions-title {
      font-size: 1.5rem;
      font-weight: 600;
      color: #2d3748;
      margin: 0 0 0.5rem 0;
    }

    .permissions-subtitle {
      color: #718096;
      margin: 0 0 2rem 0;
      font-size: 0.95rem;
    }

    .permissions-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 2rem;
      margin-bottom: 2rem;
    }

    .permission-group {
      background: #f8fafc;
      border-radius: 8px;
      padding: 1.5rem;
      border: 1px solid #e2e8f0;
    }

    .group-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: #2d3748;
      margin: 0 0 1rem 0;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid #e2e8f0;
    }

    .permission-items {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .permission-item {
      background: white;
      border-radius: 6px;
      padding: 1rem;
      border: 1px solid #e2e8f0;
      transition: border-color 0.2s;
    }

    .permission-item:hover {
      border-color: #cbd5e0;
    }

    .permission-label {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      cursor: pointer;
      font-weight: 500;
    }

    .permission-label input[type="checkbox"] {
      width: 18px;
      height: 18px;
      margin: 0;
      cursor: pointer;
    }

    .permission-text {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .permission-name {
      font-weight: 500;
      color: #2d3748;
      font-size: 0.95rem;
    }

    .permission-desc {
      color: #718096;
      font-size: 0.875rem;
      line-height: 1.4;
    }

    .save-section {
      margin-top: 2rem;
      padding-top: 1.5rem;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: flex-end;
    }

    .save-btn {
      padding: 0.75rem 2rem;
      font-size: 1rem;
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
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-primary {
      background: #667eea;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #5a6fd8;
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

    .empty-state, .loading-state {
      text-align: center;
      padding: 4rem 2rem;
      color: #718096;
    }

    .empty-content h3, .loading-content p {
      margin-bottom: 1rem;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #e2e8f0;
      border-top-color: #667eea;
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
      max-width: 500px;
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
      margin-bottom: 1rem;
    }

    .form-group label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
      color: #2d3748;
    }

    .form-input {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 1rem;
      transition: border-color 0.2s;
    }

    .form-input:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .form-help {
      margin-top: 0.5rem;
      font-size: 0.875rem;
      color: #718096;
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
      .header {
        padding: 1.5rem 0;
      }

      .page-title {
        font-size: 2rem;
      }

      .tab-headers {
        flex-direction: column;
      }

      .tab-header {
        min-width: auto;
      }

      .role-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 1rem;
      }

      .role-actions {
        width: 100%;
        justify-content: flex-start;
      }

      .permissions-grid {
        grid-template-columns: 1fr;
        gap: 1.5rem;
      }
    }
  `]
})
export class AccessComponent implements OnInit {
  roles: RoleDefinition[] = [];
  activeTabIndex: number = 0;
  activeRole: RoleDefinition | null = null;
  isLoading: boolean = false;
  showAddRoleModal: boolean = false;
  newRoleId: string = '';

  constructor(
    private roleDefinitionService: RoleDefinitionService,
    private router: Router,
    private storeService: StoreService,
    public authService: AuthService
  ) {}

  ngOnInit() {
    console.log('AccessComponent: ngOnInit called');
    
    // Add immediate debug information
    console.log('AccessComponent: Checking authentication state...');
    console.log('AccessComponent: isAuthenticated:', this.authService.isAuthenticated());
    console.log('AccessComponent: currentUser:', this.authService.currentUser());
    console.log('AccessComponent: userRole:', this.authService.userRole());
    
    // Check if we can access the page at all
    if (!this.authService.isAuthenticated()) {
      console.error('AccessComponent: User not authenticated');
      return;
    }
    
    // Show a loading state immediately
    this.isLoading = true;
    
    // Initialize with a small delay to ensure auth is fully loaded
    setTimeout(() => {
      this.initializeComponent();
    }, 100);
  }

  async initializeComponent() {
    try {
      console.log('AccessComponent: Starting initialization...');
      
      // Show that we're working
      this.isLoading = true;
      
      // Wait for authentication to complete
      console.log('AccessComponent: Waiting for auth...');
      const user = await this.authService.waitForAuth();
      
      if (!user) {
        console.error('AccessComponent: No user after wait');
        this.displayError('Authentication required. Please log in again.');
        this.isLoading = false;
        return;
      }
      
      console.log('AccessComponent: User loaded:', user);
      
      // Debug current user state
      await this.debugCurrentUser();
      
      // Load roles with better error handling
      await this.loadRoles();
      
      console.log('AccessComponent: Initialization complete');
    } catch (error) {
      console.error('AccessComponent: Initialization failed:', error);
      this.displayError('Failed to initialize access management. Please try refreshing the page.');
      this.isLoading = false;
    }
  }

  async debugCurrentUser() {
    try {
      const currentUser = await this.authService.currentUser();
      console.log('Current user:', currentUser);
      console.log('Current user company ID:', currentUser?.companyId);
      console.log('Current user store IDs:', currentUser?.storeIds);
      
      // Also check user stores from store service
      if (currentUser?.companyId) {
        await this.storeService.loadStoresByCompany(currentUser.companyId);
        const userStores = this.storeService.getStoresByCompany(currentUser.companyId);
        console.log('User stores for company:', userStores);
      }
    } catch (error) {
      console.error('Error getting current user:', error);
    }
  }

  async loadRoles() {
    console.log('AccessComponent: loadRoles() called');
    this.isLoading = true;
    
    try {
      console.log('AccessComponent: Loading roles for current company...');
      
      // Get current user with company and store information
      const currentUser = await this.authService.waitForAuth();
      console.log('AccessComponent: Current user in loadRoles:', currentUser);
      
      if (!currentUser) {
        console.error('AccessComponent: No authenticated user found');
        this.displayError('No authenticated user found. Please log in again.');
        this.resetRoleState();
        return;
      }
      
      let companyId: string | null = null;
      
      // Method 1: Get companyId directly from user object
      if (currentUser.companyId) {
        companyId = currentUser.companyId;
        console.log('AccessComponent: Using companyId from user object:', companyId);
      }
      // Method 2: Get companyId from user's stores
      else if (currentUser.storeIds && currentUser.storeIds.length > 0) {
        console.log('AccessComponent: User storeIds found:', currentUser.storeIds);
        
        try {
          // Load stores by specific IDs to get company information
          await this.storeService.loadStores(currentUser.storeIds);
          const allStores = this.storeService.getStores();
          console.log('AccessComponent: All loaded stores:', allStores);
          
          // Find the first store that belongs to this user
          const userStore = allStores.find(store => store.id && currentUser.storeIds.includes(store.id));
          if (userStore) {
            companyId = userStore.companyId;
            console.log('AccessComponent: Using companyId from user store:', companyId, 'Store:', userStore.storeName);
          } else {
            console.warn('AccessComponent: No matching stores found for user store IDs');
          }
        } catch (storeError) {
          console.error('AccessComponent: Error loading stores:', storeError);
        }
      }
      
      if (!companyId) {
        console.error('AccessComponent: No company ID found for user');
        this.displayError('No company found for your account. Please contact your administrator.');
        this.resetRoleState();
        return;
      }
      
      console.log('AccessComponent: Loading role definitions with company ID:', companyId);
      
      // Load role definitions from Firestore
      try {
        await this.roleDefinitionService.loadRoleDefinitions();
        console.log('AccessComponent: Role definitions loaded from service');
      } catch (roleLoadError) {
        console.error('AccessComponent: Error loading role definitions:', roleLoadError);
        this.displayError('Failed to load role definitions from database.');
        this.resetRoleState();
        return;
      }
      
      // Get the filtered roles for display (filtered by company ID)
      this.roles = this.roleDefinitionService.getCompanyRoleDefinitions();
      
      console.log('AccessComponent: Loaded roles:', this.roles);
      console.log('AccessComponent: Number of roles found:', this.roles.length);
      
      if (this.roles.length > 0) {
        // Set the first role as active if current index is out of bounds
        if (this.activeTabIndex >= this.roles.length || this.activeTabIndex < 0) {
          this.activeTabIndex = 0;
        }
        this.activeRole = this.roles[this.activeTabIndex];
        console.log('AccessComponent: Active role set to:', this.activeRole?.roleId);
      } else {
        this.activeRole = null;
        this.activeTabIndex = -1;
        console.log('AccessComponent: No roles found for company ID:', companyId);
      }
    } catch (error) {
      console.error('AccessComponent: Error loading roles:', error);
      this.displayError('An unexpected error occurred while loading roles.');
      this.resetRoleState();
    } finally {
      this.isLoading = false;
    }
  }

  private resetRoleState() {
    this.roles = [];
    this.activeRole = null;
    this.activeTabIndex = -1;
  }

  private displayError(message: string) {
    // You can replace this with a proper toast/notification service
    console.error('AccessComponent Error:', message);
    // For now, we'll just log it, but you could show a user-friendly error message
  }

  getPermissionCount(permissions: RolePermissions): number {
    return Object.values(permissions).filter(Boolean).length;
  }

  setActiveTab(index: number) {
    this.activeTabIndex = index;
    this.activeRole = this.roles[index] || null;
  }

  addNewRole() {
    this.newRoleId = '';
    this.showAddRoleModal = true;
  }

  createNewRole() {
    if (!this.newRoleId.trim()) {
      return;
    }

    const roleId = this.newRoleId.toLowerCase().replace(/\s+/g, '_');
    
    // Check if role already exists
    if (this.roles.some(role => role.roleId === roleId)) {
      alert('A role with this name already exists.');
      return;
    }

    this.isLoading = true;
    
    const newRole: Omit<RoleDefinition, 'id' | 'createdAt' | 'updatedAt' | 'companyId'> = {
      roleId: roleId,
      permissions: {
        canViewPOS: false,
        canAddStore: false,
        canAddProducts: false,
        canViewProducts: false,
        canViewStore: false,
        canViewInventory: false,
        canRemoveUsers: false,
        canAddUser: false,
        canMakePOS: false
      }
    };

    this.roleDefinitionService.createRoleDefinition(newRole).then(async () => {
      // Refresh data from Firestore
      await this.roleDefinitionService.loadRoleDefinitions();
      this.loadRoles();
      this.showAddRoleModal = false;
      this.newRoleId = '';
      // Set the new role as active
      setTimeout(() => {
        const newIndex = this.roles.findIndex(role => role.roleId === roleId);
        if (newIndex !== -1) {
          this.setActiveTab(newIndex);
        }
      }, 100);
    }).catch(error => {
      console.error('Error creating role:', error);
      this.isLoading = false;
      alert('Error creating role. Please try again.');
    });
  }

  cancelAddRole() {
    this.showAddRoleModal = false;
    this.newRoleId = '';
  }

  async updateRole(role: RoleDefinition) {
    try {
      await this.roleDefinitionService.updateRoleDefinition(role.id!, role);
      // Refresh data from Firestore
      await this.roleDefinitionService.loadRoleDefinitions();
      this.loadRoles();
    } catch (error) {
      console.error('Error updating role:', error);
      // Reload to revert changes
      await this.roleDefinitionService.loadRoleDefinitions();
      this.loadRoles();
    }
  }

  async saveAllChanges() {
    if (!this.activeRole) return;

    this.isLoading = true;
    
    try {
      await this.roleDefinitionService.updateRoleDefinition(this.activeRole.id!, this.activeRole);
      // Refresh data from Firestore
      await this.roleDefinitionService.loadRoleDefinitions();
      this.loadRoles();
      this.isLoading = false;
      // Show success feedback
    } catch (error) {
      console.error('Error saving changes:', error);
      this.isLoading = false;
      alert('Error saving changes. Please try again.');
      // Reload to revert changes
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
      alert('Default roles cannot be deleted.');
      return;
    }

    if (confirm(`Are you sure you want to delete the "${role.roleId}" role?`)) {
      this.isLoading = true;
      
      try {
        await this.roleDefinitionService.deleteRoleDefinition(role.id!);
        // Refresh data from Firestore
        await this.roleDefinitionService.loadRoleDefinitions();
        this.loadRoles();
        this.isLoading = false;
      } catch (error) {
        console.error('Error deleting role:', error);
        this.isLoading = false;
        alert('Error deleting role. Please try again.');
      }
    }
  }

  isDefaultRole(roleId: string): boolean {
    const defaultRoles = ['admin', 'manager', 'employee'];
    return defaultRoles.includes(roleId.toLowerCase());
  }
}
