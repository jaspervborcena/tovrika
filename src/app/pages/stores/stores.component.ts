import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonComponent } from '../../shared/ui/button.component';
import { TableComponent } from '../../shared/ui/table.component';
import { ModalComponent } from '../../shared/ui/modal.component';
import { StoreService } from '../../services/store.service';
import { CompanySetupService } from '../../services/companySetup.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-stores',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonComponent,
    TableComponent,
    ModalComponent
  ],
  template: `
    <div class="py-6">
      <div class="flex justify-between items-center">
        <h1 class="text-2xl font-semibold text-gray-900">Stores</h1>
        <ui-button (click)="openCreateModal()">Add Store</ui-button>
      </div>

      <!-- Stores Table -->
      <div class="mt-8">
        <ui-table
          [columns]="columns"
          [data]="stores"
          (onEdit)="openEditModal($event)"
          (onDelete)="confirmDelete($event)"
        ></ui-table>
      </div>

      <!-- Create/Edit Modal -->
      <ui-modal
        [isOpen]="isModalOpen"
        [title]="editingStore ? 'Edit Store' : 'Create Store'"
        [saveLabel]="editingStore ? 'Update' : 'Create'"
        [loading]="isLoading"
        (onClose)="closeModal()"
        (onSave)="saveStore()"
      >
        <form [formGroup]="storeForm" class="space-y-4">
          <div *ngIf="isAdmin">
            <label for="companyId" class="block text-sm font-medium text-gray-700">Company</label>
            <select
              id="companyId"
              formControlName="companyId"
              class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            >
              <option value="">Select Company</option>
              <option *ngFor="let company of companies" [value]="company.id">
                {{ company.name }}
              </option>
            </select>
            <div
              *ngIf="storeForm.get('companyId')?.invalid && storeForm.get('companyId')?.touched"
              class="text-red-500 text-sm mt-1"
            >
              Company is required
            </div>
          </div>

          <div>
            <label for="name" class="block text-sm font-medium text-gray-700">Store Name</label>
            <input
              type="text"
              id="name"
              formControlName="name"
              class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            />
            <div
              *ngIf="storeForm.get('name')?.invalid && storeForm.get('name')?.touched"
              class="text-red-500 text-sm mt-1"
            >
              Store name is required
            </div>
          </div>

          <div>
            <label for="location" class="block text-sm font-medium text-gray-700">Location</label>
            <input
              type="text"
              id="location"
              formControlName="location"
              class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            />
            <div
              *ngIf="storeForm.get('location')?.invalid && storeForm.get('location')?.touched"
              class="text-red-500 text-sm mt-1"
            >
              Location is required
            </div>
          </div>

          <div>
            <label for="phone" class="block text-sm font-medium text-gray-700">Phone</label>
            <input
              type="tel"
              id="phone"
              formControlName="phone"
              class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            />
            <div
              *ngIf="storeForm.get('phone')?.invalid && storeForm.get('phone')?.touched"
              class="text-red-500 text-sm mt-1"
            >
              Phone number is required
            </div>
          </div>

          <div>
            <label for="manager" class="block text-sm font-medium text-gray-700">Manager</label>
            <input
              type="text"
              id="manager"
              formControlName="manager"
              class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            />
          </div>
        </form>
      </ui-modal>

      <!-- Delete Confirmation Modal -->
      <ui-modal
        [isOpen]="isDeleteModalOpen"
        title="Delete Store"
        saveLabel="Delete"
        [loading]="isLoading"
        (onClose)="closeDeleteModal()"
        (onSave)="deleteStore()"
      >
        <p class="text-sm text-gray-500">
          Are you sure you want to delete this store? This action cannot be undone.
        </p>
      </ui-modal>
    </div>
  `
})
export class StoresComponent implements OnInit {
  private fb = inject(FormBuilder);
  private storeService = inject(StoreService);
  private companyService = inject(CompanySetupService);
  private authService = inject(AuthService);

  stores: any[] = [];
  companies: any[] = [];
  isModalOpen = false;
  isDeleteModalOpen = false;
  isLoading = false;
  editingStore: any = null;
  storeToDelete: any = null;
  isAdmin = false;
  userCompanyId: string | null = null;

  columns = [
    { key: 'name', label: 'Store Name' },
    { key: 'location', label: 'Location' },
    { key: 'phone', label: 'Phone' },
    { key: 'manager', label: 'Manager' },
    { 
      key: 'createdAt', 
      label: 'Created At',
      format: (value: Date) => value.toLocaleDateString()
    }
  ];

  storeForm = this.fb.group({
    companyId: ['', this.isAdmin ? [Validators.required] : []],
    name: ['', [Validators.required]],
    location: ['', [Validators.required]],
    phone: ['', [Validators.required]],
    manager: ['']
  });

  ngOnInit() {
    this.setupUser();
    this.loadData();
  }

  private setupUser() {
    const user = this.authService.currentUser();
    this.isAdmin = (user?.roleId || user?.role) === 'admin';
    this.userCompanyId = user?.companyId || null;
  }

  private async loadData() {
    if (this.isAdmin) {
      this.companies = this.companyService.companies();
    }
    if (this.userCompanyId) {
      await this.storeService.loadStores(this.userCompanyId);
      this.stores = this.storeService.stores();
    }
  }

  openCreateModal() {
    this.editingStore = null;
    this.storeForm.reset({
      companyId: this.userCompanyId || ''
    });
    this.isModalOpen = true;
  }

  openEditModal(store: any) {
    this.editingStore = store;
    this.storeForm.patchValue({
      companyId: store.companyId,
      name: store.name,
      location: store.location,
      phone: store.phone,
      manager: store.manager
    });
    this.isModalOpen = true;
  }

  confirmDelete(store: any) {
    this.storeToDelete = store;
    this.isDeleteModalOpen = true;
  }

  async saveStore() {
    if (this.storeForm.valid) {
      this.isLoading = true;
      try {
        const formValue = this.storeForm.value;
        const storeData = {
          name: formValue.name!,
          address: {
            street: formValue.location || '',
            city: '',
            state: '',
            zipCode: '',
            country: ''
          },
          phone: formValue.phone || undefined,
          companyId: this.userCompanyId!,
          status: 'active' as const
        };

        if (this.editingStore) {
          // Convert to new Store interface format for update
          const updateData = {
            storeName: storeData.name,
            address: `${storeData.address.street}, ${storeData.address.city}, ${storeData.address.state} ${storeData.address.zipCode}`,
            phoneNumber: storeData.phone || '',
            status: storeData.status
          };
          await this.storeService.updateStore(
            this.editingStore.id,
            updateData
          );
        } else {
          // Convert to new Store interface format
          const newStoreData = {
            companyId: storeData.companyId,
            storeName: storeData.name,
            storeCode: 'AUTO-' + Date.now(), // Auto-generated
            storeType: 'General', // Default
            address: `${storeData.address.street}, ${storeData.address.city}, ${storeData.address.state} ${storeData.address.zipCode}`,
            phoneNumber: storeData.phone || '',
            email: '',
            managerName: '',
            status: storeData.status
          };
          await this.storeService.createStore(newStoreData);
        }

        this.closeModal();
        this.loadData();
      } catch (error) {
        console.error('Error saving store:', error);
      } finally {
        this.isLoading = false;
      }
    }
  }

  async deleteStore() {
    if (this.storeToDelete) {
      this.isLoading = true;
      try {
        await this.storeService.deleteStore(
          this.storeToDelete.id
        );
        this.closeDeleteModal();
        this.loadData();
      } catch (error) {
        console.error('Error deleting store:', error);
      } finally {
        this.isLoading = false;
      }
    }
  }

  closeModal() {
    this.isModalOpen = false;
    this.editingStore = null;
    this.storeForm.reset();
  }

  closeDeleteModal() {
    this.isDeleteModalOpen = false;
    this.storeToDelete = null;
  }
}
