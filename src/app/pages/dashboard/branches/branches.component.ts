import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { ModalComponent } from '../../../shared/ui/modal.component';
import { AuthService } from '../../../services/auth.service';
import { Branch } from '../../../interfaces/branch.interface';
import { Store } from '../../../interfaces/store.interface';

@Component({
  selector: 'app-branches',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ButtonComponent, ModalComponent],
  template: `
    <div class="px-4 sm:px-6 lg:px-8">
      <div class="sm:flex sm:items-center">
        <div class="sm:flex-auto">
          <h1 class="text-xl font-semibold text-gray-900">Branches</h1>
          <p class="mt-2 text-sm text-gray-700">
            Manage branches for your stores
          </p>
        </div>
        <div class="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <ui-button (click)="openModal()" variant="primary">
            Add Branch
          </ui-button>
        </div>
      </div>

      <!-- Branch List -->
      <div class="mt-8 overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
        <table class="min-w-full divide-y divide-gray-300">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Name</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Store</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Address</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            @for (branch of branches(); track branch.id) {
              <tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {{ branch.name }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  Store Name <!-- TODO: Get store name -->
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ branch.address.street }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span [class]="branch.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'" 
                        class="inline-flex px-2 text-xs font-semibold rounded-full">
                    {{ branch.isActive ? 'Active' : 'Inactive' }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button (click)="editBranch(branch)" class="text-indigo-600 hover:text-indigo-900 mr-3">
                    Edit
                  </button>
                  <button (click)="deleteBranch(branch)" class="text-red-600 hover:text-red-900">
                    Delete
                  </button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500">
                  No branches found. Create your first branch to get started.
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Modal for Create/Edit -->
      <ui-modal [isOpen]="isModalOpen()" (close)="closeModal()" title="Branch Details">
        <form [formGroup]="branchForm" (ngSubmit)="saveBranch()">
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700">Branch Name</label>
              <input type="text" formControlName="name" 
                     class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3">
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700">Store</label>
              <select formControlName="storeId" 
                      class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3">
                <option value="">Select a store</option>
                @for (store of stores(); track store.id) {
                  <option [value]="store.id">{{ store.storeName }}</option>
                }
              </select>
            </div>

            <div class="space-y-3">
              <label class="block text-sm font-medium text-gray-700">Address</label>
              <div class="grid grid-cols-1 gap-3">
                <input type="text" formControlName="street" placeholder="Street Address"
                       class="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3">
                <div class="grid grid-cols-2 gap-3">
                  <input type="text" formControlName="city" placeholder="City"
                         class="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3">
                  <input type="text" formControlName="state" placeholder="State"
                         class="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3">
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <input type="text" formControlName="zipCode" placeholder="ZIP Code"
                         class="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3">
                  <input type="text" formControlName="country" placeholder="Country"
                         class="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3">
                </div>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700">Business Type</label>
              <select formControlName="businessType" 
                      class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3">
                <option value="retail">Retail</option>
                <option value="restaurant">Restaurant</option>
                <option value="service">Service</option>
                <option value="convenience_store">Convenience Store</option>
                <option value="car_wash">Car Wash</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div class="mt-6 flex justify-end space-x-3">
            <ui-button type="button" (click)="closeModal()" variant="secondary">
              Cancel
            </ui-button>
            <ui-button type="submit" variant="primary" [disabled]="!branchForm.valid || isLoading()">
              {{ editingBranch() ? 'Update' : 'Create' }} Branch
            </ui-button>
          </div>
        </form>
      </ui-modal>
    </div>
  `
})
export class BranchesComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);

  // Signals
  protected branches = signal<Branch[]>([]);
  protected stores = signal<Store[]>([]);
  protected isModalOpen = signal(false);
  protected isLoading = signal(false);
  protected editingBranch = signal<Branch | null>(null);

  // Form
  protected branchForm = this.fb.group({
    name: ['', [Validators.required]],
    storeId: ['', [Validators.required]],
    street: ['', [Validators.required]],
    city: ['', [Validators.required]],
    state: ['', [Validators.required]],
    zipCode: ['', [Validators.required]],
    country: ['', [Validators.required]],
    businessType: ['retail', [Validators.required]]
  });

  ngOnInit() {
    this.loadData();
  }

  private async loadData() {
    // TODO: Load branches from service
    // For now, show empty state
  }

  protected openModal() {
    this.isModalOpen.set(true);
    this.branchForm.reset({
      businessType: 'retail'
    });
  }

  protected closeModal() {
    this.isModalOpen.set(false);
    this.editingBranch.set(null);
    this.branchForm.reset();
  }

  protected editBranch(branch: Branch) {
    this.editingBranch.set(branch);
    this.branchForm.patchValue({
      name: branch.name,
      storeId: branch.storeId,
      street: branch.address.street,
      city: branch.address.city,
      state: branch.address.state,
      zipCode: branch.address.zipCode,
      country: branch.address.country,
      businessType: branch.businessType
    });
    this.isModalOpen.set(true);
  }

  protected deleteBranch(branch: Branch) {
    if (confirm(`Are you sure you want to delete "${branch.name}"?`)) {
      // TODO: Implement delete functionality
    }
  }

  protected async saveBranch() {
    if (!this.branchForm.valid) return;

    this.isLoading.set(true);
    try {
      // TODO: Implement save functionality
      this.closeModal();
    } catch (error) {
      console.error('Error saving branch:', error);
    } finally {
      this.isLoading.set(false);
    }
  }
}
