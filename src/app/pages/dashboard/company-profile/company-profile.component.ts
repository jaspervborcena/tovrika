import { Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { CompanyService } from '../../../services/company.service';
import { Company } from '../../../interfaces/company.interface';

@Component({
  selector: 'app-company-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ButtonComponent],
  template: `
    <div class="py-6">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 class="text-2xl font-semibold text-gray-900">Company Profile</h2>
        
        <!-- Error Message -->
        @if (error()) {
          <div class="mt-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
            {{ error() }}
          </div>
        }

        <!-- Success Message -->
        @if (showSuccessMessage()) {
          <div class="mt-4 bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-md">
            Company profile updated successfully!
          </div>
        }

        <form [formGroup]="profileForm" (ngSubmit)="onSubmit()" class="mt-6 space-y-6">
          <div class="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            <!-- Company Name -->
            <div class="sm:col-span-4">
              <label for="name" class="block text-sm font-medium text-gray-700">Company Name</label>
              <div class="mt-1">
                <input type="text" 
                       id="name" 
                       formControlName="name"
                       [disabled]="loading()"
                       class="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md disabled:bg-gray-100 disabled:cursor-not-allowed">
              </div>
            </div>

            <!-- Logo URL -->
            <div class="sm:col-span-6">
              <label for="logoUrl" class="block text-sm font-medium text-gray-700">Logo URL</label>
              <div class="mt-1">
                <input type="text" 
                       id="logoUrl" 
                       formControlName="logoUrl"
                       [disabled]="loading()"
                       class="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md disabled:bg-gray-100 disabled:cursor-not-allowed">
              </div>
            </div>

            <!-- Email -->
            <div class="sm:col-span-4">
              <label for="email" class="block text-sm font-medium text-gray-700">Email</label>
              <div class="mt-1">
                <input type="email" 
                       id="email" 
                       formControlName="email"
                       [disabled]="loading()"
                       class="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md disabled:bg-gray-100 disabled:cursor-not-allowed">
              </div>
            </div>

            <!-- Phone -->
            <div class="sm:col-span-4">
              <label for="phone" class="block text-sm font-medium text-gray-700">Phone</label>
              <div class="mt-1">
                <input type="tel" 
                       id="phone" 
                       formControlName="phone"
                       [disabled]="loading()"
                       class="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md disabled:bg-gray-100 disabled:cursor-not-allowed">
              </div>
            </div>

            <!-- Address -->
            <div class="sm:col-span-6">
              <label for="address" class="block text-sm font-medium text-gray-700">Address</label>
              <div class="mt-1">
                <textarea id="address" 
                         formControlName="address"
                         [disabled]="loading()"
                         rows="3"
                         class="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md disabled:bg-gray-100 disabled:cursor-not-allowed"></textarea>
              </div>
            </div>

            <!-- Tax ID -->
            <div class="sm:col-span-4">
              <label for="taxId" class="block text-sm font-medium text-gray-700">Tax ID</label>
              <div class="mt-1">
                <input type="text" 
                       id="taxId" 
                       formControlName="taxId"
                       [disabled]="loading()"
                       class="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md disabled:bg-gray-100 disabled:cursor-not-allowed">
              </div>
            </div>

            <!-- Website -->
            <div class="sm:col-span-4">
              <label for="website" class="block text-sm font-medium text-gray-700">Website</label>
              <div class="mt-1">
                <input type="url" 
                       id="website" 
                       formControlName="website"
                       [disabled]="loading()"
                       class="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md disabled:bg-gray-100 disabled:cursor-not-allowed">
              </div>
            </div>
          </div>

          <div class="flex justify-end space-x-3">
            <ui-button
              type="button"
              variant="secondary"
              [disabled]="loading()"
              (click)="resetForm()">
              Reset
            </ui-button>
            <ui-button
              type="submit"
              variant="primary"
              [disabled]="loading() || profileForm.invalid">
              @if (loading()) {
                <svg class="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              } @else {
                Save Changes
              }
            </ui-button>
          </div>
        </form>
      </div>
    </div>
  `
})
export class CompanyProfileComponent {
  private fb = inject(FormBuilder);
  private companyService = inject(CompanyService);

  protected profileForm: FormGroup;
  protected loading = signal(false);
  protected error = signal<string | null>(null);
  protected showSuccessMessage = signal(false);

  // Computed value for the current company
  protected currentCompany = computed(() => this.companyService.companies()[0]);

  constructor() {
    this.profileForm = this.fb.group({
      name: ['', Validators.required],
      logoUrl: [''],
      phone: [''],
      address: [''],
      email: ['', [Validators.required, Validators.email]],
      taxId: [''],
      website: ['']
    });

    // Load companies and set up form subscription
    this.companyService.loadCompanies();
    
    // Update form when company changes
    effect(() => {
      const company = this.currentCompany();
      if (company) {
        this.profileForm.patchValue({
          name: company.name,
          logoUrl: company.logoUrl,
          phone: company.phone,
          address: company.address,
          email: company.email,
          taxId: company.taxId,
          website: company.website
        });
      }
    });
  }

  protected async onSubmit() {
    if (this.profileForm.valid) {
      try {
        this.loading.set(true);
        this.error.set(null);
        this.showSuccessMessage.set(false);
        
        const company = this.currentCompany();
        if (company) {
          // Prepare the update data to match Company interface
          const updateData: Partial<Company> = {
            name: this.profileForm.value.name,
            logoUrl: this.profileForm.value.logoUrl,
            email: this.profileForm.value.email,
            phone: this.profileForm.value.phone,
            address: this.profileForm.value.address,
            taxId: this.profileForm.value.taxId,
            website: this.profileForm.value.website,
            updatedAt: new Date()
          };

          await this.companyService.updateCompany(company.id!, updateData);
          
          // Show success message
          this.showSuccessMessage.set(true);
          
          // Hide success message after 3 seconds
          setTimeout(() => {
            this.showSuccessMessage.set(false);
          }, 3000);
          
          // Reload companies to refresh the view
          await this.companyService.loadCompanies();
        }
      } catch (error) {
        this.error.set('Failed to update company profile');
        console.error('Error updating company profile:', error);
      } finally {
        this.loading.set(false);
      }
    }
  }

  protected resetForm() {
    const company = this.currentCompany();
    if (company) {
      this.profileForm.patchValue({
        name: company.name,
        logoUrl: company.logoUrl,
        phone: company.phone,
        address: company.address,
        email: company.email,
        taxId: company.taxId,
        website: company.website
      });
    }
  }
}
