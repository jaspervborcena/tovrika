import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { ModalComponent } from '../../../shared/ui/modal.component';
import { StoreService } from '../../../services/store.service';
import { CompanyService } from '../../../services/company.service';
import { Store } from '../../../interfaces/store.interface';

@Component({
  selector: 'app-stores',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ButtonComponent, ModalComponent],
  template: `
    <div class="py-6">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center">
          <h2 class="text-2xl font-semibold text-gray-900">Stores</h2>
          <ui-button
            variant="primary"
            (click)="openNewStoreModal()">
            Add Store
          </ui-button>
        </div>

        <!-- Stores Grid -->
        <div class="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          @for (store of stores(); track store.id) {
            <div class="bg-white overflow-hidden shadow rounded-lg divide-y divide-gray-200">
              <div class="px-4 py-5 sm:p-6">
                <div class="flex items-center justify-between">
                  <h3 class="text-lg font-medium text-gray-900">{{ store.name }}</h3>
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                        [class.bg-green-100]="store.status === 'active'"
                        [class.text-green-800]="store.status === 'active'"
                        [class.bg-red-100]="store.status === 'inactive'"
                        [class.text-red-800]="store.status === 'inactive'">
                    {{ store.status }}
                  </span>
                </div>
                <p class="mt-1 text-sm text-gray-500">{{ store.address }}</p>
                
                <!-- Store Details -->
                <div class="mt-4 space-y-2">
                  <div class="flex justify-between text-sm">
                    <span class="text-gray-500">Tax Rate</span>
                    <span class="font-medium">{{ store.taxRate || 0 }}%</span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="text-gray-500">Last Updated</span>
                    <span class="font-medium">{{ store.updatedAt | date:'short' }}</span>
                  </div>
                </div>
              </div>
              
              <!-- Actions -->
              <div class="px-4 py-4 sm:px-6 flex justify-end space-x-3">
                <ui-button
                  variant="secondary"
                  (click)="editStore(store)">
                  Edit
                </ui-button>
              </div>
            </div>
          }
        </div>

        <!-- Empty State -->
        @if (stores().length === 0) {
          <div class="text-center mt-6">
            <svg class="icon-lg text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
            </svg>
            <h3 class="mt-2 text-sm font-medium text-gray-900">No stores</h3>
            <p class="mt-1 text-sm text-gray-500">Get started by creating a new store.</p>
            <div class="mt-6">
              <ui-button
                variant="primary"
                (click)="openNewStoreModal()">
                Add Store
              </ui-button>
            </div>
          </div>
        }
      </div>

      <!-- Store Modal -->
      @if (showModal()) {
        <ui-modal
          [title]="editingStore() ? 'Edit Store' : 'New Store'"
          (close)="closeModal()">
          <form [formGroup]="storeForm" (ngSubmit)="saveStore()">
            <div class="space-y-4">
              <div>
                <label for="name" class="block text-sm font-medium text-gray-700">Store Name</label>
                <input type="text"
                       id="name"
                       formControlName="name"
                       class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
              </div>
              
              <!-- Address Fields -->
              <div class="space-y-4">
                <label class="block text-sm font-medium text-gray-700">Address</label>
                <div>
                  <label for="street" class="block text-sm text-gray-500">Street</label>
                  <input type="text"
                         id="street"
                         formControlName="street"
                         class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label for="city" class="block text-sm text-gray-500">City</label>
                    <input type="text"
                           id="city"
                           formControlName="city"
                           class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                  </div>
                  <div>
                    <label for="state" class="block text-sm text-gray-500">State</label>
                    <input type="text"
                           id="state"
                           formControlName="state"
                           class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label for="zipCode" class="block text-sm text-gray-500">ZIP Code</label>
                    <input type="text"
                           id="zipCode"
                           formControlName="zipCode"
                           class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                  </div>
                  <div>
                    <label for="country" class="block text-sm text-gray-500">Country</label>
                    <input type="text"
                           id="country"
                           formControlName="country"
                           class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                  </div>
                </div>
              </div>

              <!-- Contact Info -->
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label for="phone" class="block text-sm font-medium text-gray-700">Phone</label>
                  <input type="tel"
                         id="phone"
                         formControlName="phone"
                         class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                </div>
                <div>
                  <label for="email" class="block text-sm font-medium text-gray-700">Email</label>
                  <input type="email"
                         id="email"
                         formControlName="email"
                         class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                </div>
              </div>

              <!-- Status and Tax Rate -->
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label for="status" class="block text-sm font-medium text-gray-700">Status</label>
                  <select id="status"
                          formControlName="status"
                          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label for="taxRate" class="block text-sm font-medium text-gray-700">Tax Rate (%)</label>
                  <input type="number"
                         id="taxRate"
                         formControlName="taxRate"
                         min="0"
                         max="100"
                         step="0.01"
                         class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                </div>
              </div>
            </div>

            <div class="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
              <ui-button
                type="submit"
                variant="primary">
                {{ editingStore() ? 'Update' : 'Create' }}
              </ui-button>
              <ui-button
                type="button"
                variant="secondary"
                (click)="closeModal()">
                Cancel
              </ui-button>
            </div>
          </form>
        </ui-modal>
      }
    </div>
  `
})
export class StoresComponent implements OnInit {
  private storeService = inject(StoreService);
  private companyService = inject(CompanyService);
  private fb = inject(FormBuilder);

  async ngOnInit() {
    await this.storeService.loadStores();
  }

  // State
  protected showModal = signal(false);
  protected editingStore = signal<Store | null>(null);
  protected storeForm = this.fb.group({
    name: ['', Validators.required],
    address: this.fb.group({
      street: ['', Validators.required],
      city: ['', Validators.required],
      state: ['', Validators.required],
      zipCode: ['', Validators.required],
      country: ['', Validators.required],
    }),
    phone: [''],
    email: ['', Validators.email],
    status: ['active', Validators.required],
    taxRate: [0],
    settings: this.fb.group({
      currency: ['USD', Validators.required],
      timezone: ['UTC', Validators.required],
      printerSettings: this.fb.group({
        receiptHeader: [''],
        receiptFooter: [''],
        printerName: ['']
      })
    })
  });

  // Computed values
  protected stores = computed(() => this.storeService.stores());

  protected openNewStoreModal() {
    this.editingStore.set(null);
    this.storeForm.reset({
      name: '',
      address: {
        street: '',
        city: '',
        state: '',
        zipCode: '',
        country: '',
      },
      phone: '',
      email: '',
      status: 'active',
      taxRate: 0,
      settings: {
        currency: 'USD',
        timezone: 'UTC',
        printerSettings: {
          receiptHeader: '',
          receiptFooter: '',
          printerName: ''
        }
      }
    });
    this.showModal.set(true);
  }

  protected editStore(store: Store) {
    this.editingStore.set(store);
    this.storeForm.patchValue({
      name: store.name,
      ...store.address,
      phone: store.phone,
      email: store.email,
      status: store.status,
      taxRate: store.taxRate,
      settings: store.settings
    });
    this.showModal.set(true);
  }

  protected async saveStore() {
    if (this.storeForm.valid) {
      try {
        const formValue = this.storeForm.value;
        const storeData: Omit<Store, 'id' | 'createdAt' | 'updatedAt' | 'companyId'> = {
          name: formValue.name!,
          address: {
            street: formValue.address!.street!,
            city: formValue.address!.city!,
            state: formValue.address!.state!,
            zipCode: formValue.address!.zipCode!,
            country: formValue.address!.country!
          },
          phone: formValue.phone || undefined,
          email: formValue.email || undefined,
          status: formValue.status as 'active' | 'inactive',
          taxRate: formValue.taxRate || undefined,
          settings: {
            currency: formValue.settings?.currency || 'USD',
            timezone: formValue.settings?.timezone || 'UTC',
            printerSettings: formValue.settings?.printerSettings ? {
              receiptHeader: formValue.settings.printerSettings.receiptHeader || undefined,
              receiptFooter: formValue.settings.printerSettings.receiptFooter || undefined,
              printerName: formValue.settings.printerSettings.printerName || undefined
            } : undefined
          }
        };

        if (this.editingStore()) {
          const store = this.editingStore()!;
          await this.storeService.updateStore(store.companyId, store.id, storeData);
        } else {
          const company = await this.companyService.getActiveCompany();
          if (!company) {
            throw new Error('No active company found');
          }

          if (!company.id) {
            throw new Error('Invalid company ID');
          }

          await this.storeService.createStore({
            ...storeData,
            companyId: company.id
          });
        }
        this.closeModal();
        await this.storeService.loadStores();
      } catch (error) {
        console.error('Error saving store:', error);
        // TODO: Show error message
      }
    }
  }

  protected viewMode = signal<'grid' | 'list'>('grid');

  protected closeModal() {
    this.showModal.set(false);
    this.editingStore.set(null);
    this.storeForm.reset();
  }
}
