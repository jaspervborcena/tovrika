import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { ContentLayoutComponent } from '../../shared/components/content-layout/content-layout.component';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-account-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderComponent, ContentLayoutComponent],
  templateUrl: './account-settings.component.html',
  styleUrls: ['./account-settings.component.css']
})
export class AccountSettingsComponent implements OnInit {
  private authService = inject(AuthService);
  
  currentUser = this.authService.currentUser;
  isAddingPermission = false;
  isSaving = false;
  newPermission = {
    companyId: '',
    roleId: '',
    storeId: ''
  };

  ngOnInit() {
    // User data is already loaded via AuthService
  }

  addPermission() {
    this.isAddingPermission = true;
    this.newPermission = {
      companyId: '',
      roleId: '',
      storeId: ''
    };
  }

  cancelAddPermission() {
    this.isAddingPermission = false;
    this.newPermission = {
      companyId: '',
      roleId: '',
      storeId: ''
    };
  }

  async saveNewPermission() {
    if (!this.newPermission.companyId || !this.newPermission.roleId) {
      alert('Company ID and Role ID are required!');
      return;
    }

    const user = this.currentUser();
    if (!user) return;

    try {
      this.isSaving = true;
      
      const updatedPermissions = [...(user.permissions || []), this.newPermission];
      
      await this.authService.updateUserData({
        permissions: updatedPermissions
      });

      alert('Permission added successfully!');
      this.isAddingPermission = false;
      this.newPermission = {
        companyId: '',
        roleId: '',
        storeId: ''
      };
    } catch (error) {
      console.error('Error adding permission:', error);
      alert('Failed to add permission. Please try again.');
    } finally {
      this.isSaving = false;
    }
  }

  async deletePermission(index: number) {
    if (!confirm('Are you sure you want to delete this permission?')) return;

    const user = this.currentUser();
    if (!user || !user.permissions) return;

    const updatedPermissions = user.permissions.filter((_, i) => i !== index);
    
    try {
      await this.authService.updateUserData({
        permissions: updatedPermissions
      });
      alert('Permission deleted successfully!');
    } catch (error) {
      console.error('Error deleting permission:', error);
      alert('Failed to delete permission. Please try again.');
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
