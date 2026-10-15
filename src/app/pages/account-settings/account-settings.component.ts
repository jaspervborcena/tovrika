import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { ContentLayoutComponent } from '../../shared/components/content-layout/content-layout.component';
import { ConfirmationDialogComponent, ConfirmationDialogData } from '../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { AuthService, User } from '../../services/auth.service';
import { SqliteStorageService } from '../../core/services/sqlite-storage.service';
import { CompanyService } from '../../services/company.service';
import { environment } from '../../../environments/environment';

interface PermissionDisplay {
  companyId: string;
  companyName: string;
  roleId: string;
  storeId?: string;
  storeName?: string;
}

@Component({
  selector: 'app-account-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderComponent, ContentLayoutComponent, ConfirmationDialogComponent],
  templateUrl: './account-settings.component.html',
  styleUrls: ['./account-settings.component.css']
})
export class AccountSettingsComponent implements OnInit {
  private authService = inject(AuthService);
  private sqliteService = inject(SqliteStorageService);
  private companyService = inject(CompanyService);
  
  // App version from environment
  readonly appVersion = environment.version;
  
  currentUser = this.authService.currentUser;
  isSaving = false;
  isEditingPin = false;
  editedPin = '';
  pinError = '';
  
  permissionsDisplay = signal<PermissionDisplay[]>([]);

  // Confirmation dialog signals
  private isConfirmationDialogVisibleSignal = signal<boolean>(false);
  readonly isConfirmationDialogVisible = () => this.isConfirmationDialogVisibleSignal();
  private confirmationDialogDataSignal = signal<ConfirmationDialogData | null>(null);
  readonly confirmationDialogData = () => this.confirmationDialogDataSignal();


  async ngOnInit() {
    // Load permission details with company and store names
    const user = this.currentUser();
    console.log('👤 Account Settings - Current User:', user);
    console.log('📧 User Email:', user?.email);
    console.log('👨 User Display Name:', user?.displayName);
    console.log('🔑 User Permissions:', user?.permissions);
    console.log('🔢 User Code:', user?.userCode);
    console.log('🔐 User PIN:', user?.pin);
    await this.loadPermissionDetails();
  }

  async loadPermissionDetails() {
    const user = this.currentUser();
    console.log('🔍 Loading permission details for user:', user?.email);
    console.log('📋 User permissions:', user?.permissions);
    
    if (!user?.permissions) {
      console.warn('⚠️ No permissions found for user');
      return;
    }

    const permissionsWithDetails: PermissionDisplay[] = [];

    for (const permission of user.permissions) {
      console.log('🔄 Processing permission:', permission);
      
      try {
        // Fetch company details via CompanyService (will persist snapshot to SQLite)
        console.log('🏢 Fetching company via CompanyService:', permission.companyId);
        const company = await this.companyService.getCompanyById(permission.companyId);
        console.log('🏢 Company data (from CompanyService):', company);
        const companyName = company?.name || permission.companyId;
        console.log('🏢 Company name:', companyName);

        // Fetch store name from SQLite if storeId exists
        let storeName: string | undefined;
        if (permission.storeId) {
          console.log('🏪 Fetching store from SQLite:', permission.storeId);
          try {
            const store = await this.sqliteService.getStoreById(permission.storeId);
            console.log('🏪 Store data:', store);
            if (store) {
              storeName = store.storeName;
              console.log('🏪 Store name:', storeName);
            } else {
              console.warn('⚠️ Store not found in SQLite:', permission.storeId);
              storeName = 'Store not found';
            }
          } catch (sqliteError) {
            console.error('❌ Failed to fetch store from SQLite:', sqliteError);
            storeName = 'Error loading store';
            // Continue with the flow instead of breaking
          }
        }

        const permissionDisplay = {
          companyId: permission.companyId,
          companyName,
          roleId: permission.roleId,
          storeId: permission.storeId,
          storeName
        };
        
        console.log('✅ Permission display object:', permissionDisplay);
        permissionsWithDetails.push(permissionDisplay);
      } catch (error) {
        console.error('❌ Error loading permission details:', error);
        const fallbackPermission = {
          companyId: permission.companyId,
          companyName: permission.companyId,
          roleId: permission.roleId,
          storeId: permission.storeId,
          storeName: permission.storeId
        };
        console.log('📝 Using fallback permission:', fallbackPermission);
        permissionsWithDetails.push(fallbackPermission);
      }
    }

    console.log('🎯 Final permissions display array:', permissionsWithDetails);
    this.permissionsDisplay.set(permissionsWithDetails);
  }

  // PIN editing methods
  startEditingPin() {
    this.isEditingPin = true;
    this.editedPin = this.currentUser()?.pin || '';
    this.pinError = '';
  }

  cancelEditingPin() {
    this.isEditingPin = false;
    this.editedPin = '';
    this.pinError = '';
  }

  validatePin(value: string): boolean {
    // Only allow digits
    if (!/^\d*$/.test(value)) {
      this.pinError = 'PIN must contain only numbers';
      return false;
    }

    // Check length (must be exactly 6 digits)
    if (value.length > 0 && value.length !== 6) {
      this.pinError = 'PIN must be exactly 6 digits';
      return false;
    }

    this.pinError = '';
    return true;
  }

  onPinInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = input.value;

    // Remove any non-digit characters
    const cleanedValue = value.replace(/\D/g, '');

    // Limit to 6 digits
    if (cleanedValue.length > 6) {
      this.editedPin = cleanedValue.slice(0, 6);
      input.value = this.editedPin;
    } else {
      this.editedPin = cleanedValue;
    }

    this.validatePin(this.editedPin);
  }

  async savePin() {
    if (!this.validatePin(this.editedPin)) {
      return;
    }

    if (this.editedPin.length !== 6 && this.editedPin.length !== 0) {
      this.pinError = 'PIN must be exactly 6 digits or empty';
      return;
    }

    try {
      this.isSaving = true;
      
      // Update user data with the new PIN
      const updates: Partial<User> = {
        pin: this.editedPin || undefined
      };
      
      await this.authService.updateUserData(updates);
      
      this.isEditingPin = false;
      this.pinError = '';
      // Show standard confirmation dialog instead of alert
      try {
        await this.showConfirmationDialog({
          title: 'PIN Updated',
          message: 'PIN updated successfully!',
          confirmText: 'OK',
          type: 'info'
        });
      } catch (e) {
        // ignore
      }
    } catch (error: any) {
      console.error('Error updating PIN:', error);
      this.pinError = error?.message || 'Failed to update PIN. Please try again.';
      alert(this.pinError);
    } finally {
      this.isSaving = false;
    }
  }

  // Confirmation dialog helpers (pattern used elsewhere in app)
  showConfirmationDialog(data: ConfirmationDialogData): Promise<boolean> {
    return new Promise((resolve) => {
      this.confirmationDialogDataSignal.set(data);
      this.isConfirmationDialogVisibleSignal.set(true);
      (this as any)._confirmationResolve = resolve;
    });
  }

  onConfirmationConfirmed(): void {
    this.isConfirmationDialogVisibleSignal.set(false);
    this.confirmationDialogDataSignal.set(null);
    if ((this as any)._confirmationResolve) {
      (this as any)._confirmationResolve(true);
      (this as any)._confirmationResolve = null;
    }
  }

  onConfirmationCancelled(): void {
    this.isConfirmationDialogVisibleSignal.set(false);
    this.confirmationDialogDataSignal.set(null);
    if ((this as any)._confirmationResolve) {
      (this as any)._confirmationResolve(false);
      (this as any)._confirmationResolve = null;
    }
  }

  formatDate(date: Date | undefined): string {
    if (!date) return 'N/A';
    
    const d = date instanceof Date ? date : new Date(date);
    
    // Format: "September 17, 2025 at 12:19:03 PM UTC+8"
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'Asia/Manila',
      timeZoneName: 'short'
    };
    
    return d.toLocaleString('en-US', options);
  }
}
