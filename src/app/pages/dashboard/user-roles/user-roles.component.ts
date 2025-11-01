import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserRoleService } from '../../../services/user-role.service';
import { RoleDefinitionService, RoleDefinition } from '../../../services/role-definition.service';
import { StoreService, Store } from '../../../services/store.service';
import { AuthService } from '../../../services/auth.service';
import { UserRole } from '../../../interfaces/user-role.interface';
import { ToastService } from '../../../shared/services/toast.service';

@Component({
  selector: 'app-user-roles',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="user-roles-management">
      <!-- Header -->
      <div class="header">
        <div class="header-content">
          <div class="header-text">
            <h1 class="page-title">User Role Management</h1>
            <p class="page-subtitle">Assign roles to users for your company and stores</p>
          </div>
          <div class="header-actions">
            <button class="btn btn-primary" (click)="openAddUserRoleModal()">
              Add User Role
            </button>
          </div>
        </div>
      </div>

      <!-- Search and Filters -->
      <div class="filters-section">
        <div class="search-container">
          <input 
            type="text" 
            [(ngModel)]="searchEmail"
            (input)="onSearchChange()"
            placeholder="Search by email or name..."
            class="search-input">
          <button class="btn btn-secondary" (click)="clearSearch()">
            Clear
          </button>
        </div>
      </div>

      <!-- User Roles Table -->
      <div class="table-container">
        <div class="table-header">
          <h3>User Roles ({{ filteredUserRoles.length }})</h3>
          <button 
            class="btn-icon-action" 
            (click)="refreshUserRoles()"
            title="Refresh user roles"
            aria-label="Refresh user roles">
            🔄
          </button>
        </div>

        <div class="table-wrapper" *ngIf="filteredUserRoles.length > 0">
          <table class="user-roles-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Role</th>
                <th>Store</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let userRole of filteredUserRoles">
                <td class="email-cell">{{ getUserEmail(userRole) }}</td>
                <td class="user-id-cell">{{ getDisplayName(userRole.userId) }}</td>
                <td class="role-cell">
                  <span class="role-badge" [class]="'role-' + userRole.roleId">
                    {{ userRole.roleId | titlecase }}
                  </span>
                </td>
                <td class="store-cell">{{ getStoreName(userRole.storeId) }}</td>
                <td class="date-cell">{{ userRole.createdAt | date:'short' }}</td>
                <td class="actions-cell">
                  <button 
                    class="btn-icon-action"
                    (click)="editUserRole(userRole)"
                    title="Edit user role"
                    aria-label="Edit user role">
                    ✏️
                  </button>
                  <button 
                    class="btn-icon-action"
                    (click)="deleteUserRole(userRole)"
                    title="Delete user role"
                    aria-label="Delete user role">
                    🗑️
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Empty State -->
        <div class="empty-state" *ngIf="filteredUserRoles.length === 0 && !isLoading">
          <div class="empty-content">
            <h3>No User Roles Found</h3>
            <p *ngIf="searchEmail">No user roles match your search criteria.</p>
            <p *ngIf="!searchEmail">No user roles have been assigned yet.</p>
            <button class="btn btn-primary" (click)="openAddUserRoleModal()">
              Add First User Role
            </button>
          </div>
        </div>

        <!-- Loading State -->
        <div class="loading-state" *ngIf="isLoading">
          <div class="loading-content">
            <div class="spinner"></div>
            <p>Loading user roles...</p>
          </div>
        </div>
        <!-- Delete Confirmation Modal -->
        <div class="modal-overlay" *ngIf="showDeleteModal" (click)="cancelDeleteUserRole()">
          <div class="modal" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>Confirm Delete</h3>
              <button class="close-btn" (click)="cancelDeleteUserRole()">×</button>
            </div>
            <div class="modal-body">
              <ng-container *ngIf="userRoleToDelete">
                <p>Are you sure you want to delete the role assignment for <b>{{ userRoleToDelete.email }}</b>?</p>
              </ng-container>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" (click)="cancelDeleteUserRole()">Cancel</button>
              <button class="btn btn-danger" (click)="confirmDeleteUserRole()">Delete</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Add/Edit User Role Modal -->
      <div class="modal-overlay" *ngIf="showUserRoleModal" (click)="cancelUserRoleModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editingUserRole ? 'Edit User Role' : 'Add User Role' }}</h3>
            <button class="close-btn" (click)="cancelUserRoleModal()">×</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label for="email">Email Address</label>
              <div style="display: flex; gap: 0.5rem; align-items: center;">
                <input 
                  type="email" 
                  id="email"
                  [(ngModel)]="searchUserEmail"
                  placeholder="user@example.com"
                  class="form-input"
                  [disabled]="!!editingUserRole">
                <button class="btn btn-secondary" (click)="findUserByEmail()" [disabled]="!searchUserEmail || !!editingUserRole">Find</button>
              </div>
              <div *ngIf="findUserError" style="color: #e53e3e; margin-top: 0.5rem; font-weight: 500;">{{ findUserError }}</div>
              <p class="form-help" *ngIf="!editingUserRole">
                Enter the user's email and click Find. The user's name and email will be auto-filled if found.
              </p>
              <div *ngIf="foundUser">
                <div><strong>Name:</strong> {{ foundUser.displayName }}</div>
                <div><strong>Email:</strong> {{ foundUser.email }}</div>
                <input type="hidden" [(ngModel)]="userRoleForm.userId" [value]="foundUser.uid">
                <input type="hidden" [(ngModel)]="userRoleForm.email" [value]="foundUser.email">
              </div>
            </div>

            <div class="form-group">
              <!-- User ID is now hidden and auto-filled after finding user by email -->
            </div>

            <div class="form-group">
              <label for="roleId">Role</label>
              <select 
                id="roleId"
                [(ngModel)]="userRoleForm.roleId"
                class="form-select"
                [disabled]="userRoleForm.roleId === 'cashier'">
                <option value="">Select a role</option>
                <option 
                  *ngFor="let role of availableRoles" 
                  [value]="role.roleId">
                  {{ role.roleId | titlecase }}
                </option>
              </select>
              <p class="form-help">
                Choose the role to assign to this user
              </p>
            </div>

            <div class="form-group">
              <label for="storeId">Store</label>
              <select 
                id="storeId"
                [(ngModel)]="userRoleForm.storeId"
                class="form-select">
                <option value="">Select a store</option>
                <option 
                  *ngFor="let store of availableStores" 
                  [value]="store.id">
                  {{ store.storeName }}
                </option>
              </select>
              <p class="form-help">
                Choose the store this user will have access to
              </p>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="cancelUserRoleModal()">Cancel</button>
            <button 
              class="btn btn-primary" 
              (click)="saveUserRole()"
              [disabled]="!isUserRoleFormValid() || isLoading">
              {{ isLoading ? 'Saving...' : (editingUserRole ? 'Update' : 'Create') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .user-roles-management {
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
      border-color: #4f46e5;
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
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

    .user-roles-table {
      width: 100%;
      border-collapse: collapse;
    }

    .user-roles-table th,
    .user-roles-table td {
      padding: 1rem;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }

    .user-roles-table th {
      background: #f8fafc;
      font-weight: 600;
      color: #2d3748;
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.025em;
    }

    .user-roles-table tbody tr:hover {
      background: #f8fafc;
    }

    .email-cell {
      font-weight: 500;
      color: #2d3748;
    }

    .user-id-cell {
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 0.875rem;
      color: #718096;
    }

    .role-badge {
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.025em;
    }

    .role-badge.role-admin {
      background: #fed7d7;
      color: #c53030;
    }

    .role-badge.role-manager {
      background: #bee3f8;
      color: #2b6cb0;
    }

    .role-badge.role-cashier {
      background: #c6f6d5;
      color: #2f855a;
    }

    .role-badge.role-employee {
      background: #e2e8f0;
      color: #4a5568;
    }

    .store-cell {
      color: #4a5568;
    }

    .date-cell {
      color: #718096;
      font-size: 0.875rem;
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
      background: #4f46e5;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #4338ca;
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

    /* Icon button style to match Product/Stores refresh */
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
      border-top-color: #4f46e5;
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
      margin-bottom: 1.5rem;
    }

    .form-group label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
      color: #2d3748;
    }

    .form-input,
    .form-select {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 1rem;
      transition: border-color 0.2s;
    }

    .form-input:focus,
    .form-select:focus {
      outline: none;
      border-color: #4f46e5;
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
    }

    .form-input:disabled,
    .form-select:disabled {
      background: #f7fafc;
      color: #a0aec0;
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

      .user-roles-table {
        min-width: 600px;
      }

      .modal {
        margin: 1rem;
        max-width: none;
        width: auto;
      }
    }
  `]
})
export class UserRolesComponent implements OnInit {
  showDeleteModal: boolean = false;
  userRoleToDelete: UserRole | null = null;
  findUserError: string = '';
  searchUserEmail: string = '';
  foundUser: any = null;
  async findUserByEmail() {
    if (!this.searchUserEmail) return;
    try {
      // Firestore query for user by email
      const { getFirestore, collection, query, where, getDocs } = await import('firebase/firestore');
      const firestore = getFirestore();
      const usersRef = collection(firestore, 'users');
      const q = query(usersRef, where('email', '==', this.searchUserEmail));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        const data = userDoc.data();
        this.foundUser = {
          uid: userDoc.id,
          email: data['email'],
          displayName: data['displayName'] || '',
        };
        this.userRoleForm.userId = this.foundUser.uid;
        this.userRoleForm.email = this.foundUser.email;
        this.findUserError = '';
      } else {
        this.foundUser = null;
  this.findUserError = 'Unable to find a user for this email.';
      }
    } catch (error) {
      this.foundUser = null;
      this.toastService.error('Error searching for user. Please try again.');
      console.error(error);
    }
  }
  userRoles: UserRole[] = [];
  filteredUserRoles: UserRole[] = [];
  availableRoles: RoleDefinition[] = [];
  availableStores: Store[] = [];
  // Cache user profiles by userId (displayName, email)
  userProfiles: Record<string, { displayName: string; email: string }> = {};
  
  searchEmail: string = '';
  isLoading: boolean = false;
  showUserRoleModal: boolean = false;
  editingUserRole: UserRole | null = null;

  userRoleForm: Partial<UserRole> = {
    email: '',
    userId: '',
    roleId: '',
    storeId: ''
  };

  constructor(
    private userRoleService: UserRoleService,
    private roleDefinitionService: RoleDefinitionService,
    private storeService: StoreService,
    private authService: AuthService,
    private toastService: ToastService
  ) {}

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    this.isLoading = true;
    
    try {
  // Load user roles
      await this.userRoleService.loadUserRoles();
      this.userRoles = this.userRoleService.getCompanyUserRoles();
      this.filteredUserRoles = [...this.userRoles];

  // Enrich with user profiles (names/emails)
  await this.loadUserProfilesForRoles(this.userRoles);

      // Load available roles
      await this.roleDefinitionService.loadRoleDefinitions();
      this.availableRoles = this.roleDefinitionService.getCompanyRoleDefinitions();

      // Load available stores for the company
      const currentPermission = this.authService.getCurrentPermission();
      if (currentPermission?.companyId) {
        await this.storeService.loadStoresByCompany(currentPermission.companyId);
      }
      this.availableStores = this.storeService.getStores();
      
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      this.isLoading = false;
    }
  }

  onSearchChange() {
    const term = (this.searchEmail || '').toLowerCase();
    if (!term) {
      this.filteredUserRoles = [...this.userRoles];
      return;
    }
    this.filteredUserRoles = this.userRoles.filter(ur => {
      const email = (this.getUserEmail(ur) || '').toLowerCase();
      const name = (this.getDisplayName(ur.userId) || '').toLowerCase();
      return email.includes(term) || name.includes(term);
    });
  }

  clearSearch() {
    this.searchEmail = '';
    this.filteredUserRoles = [...this.userRoles];
  }

  async refreshUserRoles() {
    await this.loadData();
  }

  openAddUserRoleModal() {
    this.editingUserRole = null;
    this.userRoleForm = {
      email: '',
      userId: '',
      roleId: '',
      storeId: ''
    };
    this.searchUserEmail = '';
    this.foundUser = null;
    this.showUserRoleModal = true;
  }

  editUserRole(userRole: UserRole) {
    this.editingUserRole = userRole;
    this.userRoleForm = {
      email: userRole.email,
      userId: userRole.userId,
      roleId: userRole.roleId,
      storeId: userRole.storeId
    };
    this.showUserRoleModal = true;
  }

  cancelUserRoleModal() {
    this.showUserRoleModal = false;
    this.editingUserRole = null;
    this.userRoleForm = {
      email: '',
      userId: '',
      roleId: '',
      storeId: ''
    };
  }

  isUserRoleFormValid(): boolean {
    return !!(
      this.userRoleForm.email?.trim() &&
      this.userRoleForm.userId?.trim() &&
      this.userRoleForm.roleId?.trim() &&
      this.userRoleForm.storeId?.trim()
    );
  }

  async saveUserRole() {
    if (!this.isUserRoleFormValid()) {
      return;
    }

    this.isLoading = true;

    try {
      if (this.editingUserRole) {
        // Update existing user role
        await this.userRoleService.updateUserRole(
          this.editingUserRole.id!, 
          this.userRoleForm as Partial<UserRole>
        );
      } else {
        // Create new user role
        await this.userRoleService.createUserRole(
          this.userRoleForm as Omit<UserRole, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>
        );
      }

      await this.loadData();
      this.cancelUserRoleModal();
    } catch (error) {
      console.error('Error saving user role:', error);
      this.toastService.error('Error saving user role. Please try again.');
    } finally {
      this.isLoading = false;
    }
  }

  async deleteUserRole(userRole: UserRole) {
    this.showDeleteModal = true;
    this.userRoleToDelete = userRole;
  }

  async confirmDeleteUserRole() {
    if (!this.userRoleToDelete) return;
    
    console.log('🔍 [UserRoles] Attempting to delete user role:', this.userRoleToDelete);
    console.log('🔍 [UserRoles] User role ID:', this.userRoleToDelete.id);
    console.log('🔍 [UserRoles] User role email:', this.userRoleToDelete.email);
    console.log('🔍 [UserRoles] User role roleId:', this.userRoleToDelete.roleId);
    
    this.isLoading = true;
    try {
      await this.userRoleService.deleteUserRole(this.userRoleToDelete.id!);
      console.log('🔍 [UserRoles] Successfully deleted user role');
      await this.loadData();
    } catch (error) {
      console.error('🔍 [UserRoles] Error deleting user role:', error);
      this.toastService.error(`Failed to delete user role: ${error}`);
    } finally {
      this.isLoading = false;
      this.showDeleteModal = false;
      this.userRoleToDelete = null;
    }
  }

  cancelDeleteUserRole() {
    this.showDeleteModal = false;
    this.userRoleToDelete = null;
  }

  getStoreName(storeId: string): string {
    const store = this.availableStores.find((s: Store) => s.id === storeId);
    return store?.storeName || 'Unknown Store';
  }

  // ===== User profile enrichment =====
  private async loadUserProfilesForRoles(userRoles: UserRole[]): Promise<void> {
    try {
      const uniqueIds = Array.from(new Set(userRoles.map(ur => ur.userId).filter(Boolean)));
      if (uniqueIds.length === 0) return;
      const { getFirestore, doc, getDoc } = await import('firebase/firestore');
      const db = getFirestore();
      const results = await Promise.all(uniqueIds.map(async (uid) => {
        try {
          const snap = await getDoc(doc(db, 'users', uid));
          if (snap.exists()) {
            const d = snap.data() as any;
            return { uid, displayName: d.displayName || '', email: d.email || '' };
          }
        } catch {}
        return { uid, displayName: '', email: '' };
      }));
      const map: Record<string, { displayName: string; email: string }> = {};
      results.forEach(r => { map[r.uid] = { displayName: r.displayName, email: r.email }; });
      this.userProfiles = map;
    } catch (e) {
      console.warn('Failed to load user profiles for roles', e);
    }
  }

  getDisplayName(userId: string): string {
    const name = this.userProfiles[userId]?.displayName;
    return name && name.trim() ? name : '(No name)';
  }

  getUserEmail(userRole: UserRole): string {
    const direct = userRole.email || '';
    if (direct && direct.trim()) return direct;
    const cached = this.userProfiles[userRole.userId]?.email || '';
    return cached && cached.trim() ? cached : '—';
  }
}
