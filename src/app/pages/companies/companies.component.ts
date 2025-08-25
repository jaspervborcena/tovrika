import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { NewCompaniesComponent } from './new-companies/new-companies.component';
import { ButtonComponent } from '../../shared/ui/button.component';
import { ModalComponent } from '../../shared/ui/modal.component';
import { CompanyService } from '../../services/company.service';
import { AuthService } from '../../services/auth.service';
import { Company, Store, Branch, BusinessType } from '../../interfaces/company.interface';
import { Router } from '@angular/router';
@Component({
  selector: 'app-companies',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonComponent,
    ModalComponent,
    NewCompaniesComponent
  ],
 templateUrl: './companies.component.html',
  styleUrls: ['./companies.component.css']
})
export class CompaniesComponent implements OnInit {
  private fb = inject(FormBuilder);
  private companyService = inject(CompanyService);
  private authService = inject(AuthService);
  private router = inject(Router);

  companies = signal<Company[]>([]);
  isModalOpen = signal(false);
  isDeleteModalOpen = signal(false);
  isLoading = signal(false);
  editingCompany = signal<Company | null>(null);
  companyToDelete = signal<Company | null>(null);

  companyForm = this.fb.group({
    name: ['', [Validators.required]],
    address: ['', [Validators.required]],
    plan: ['basic', [Validators.required]],
    stores: this.fb.array([this.createStoreFormGroup()]),
    currency: ['USD', [Validators.required]],
    timezone: ['UTC', [Validators.required]]
  });

  private createStoreFormGroup() {
    return this.fb.group({
      storeName: ['', [Validators.required]],
      address: ['', [Validators.required]],
      branches: this.fb.array([this.createBranchFormGroup()]) // Initialize with one branch
    });
  }

  private createBranchFormGroup() {
    return this.fb.group({
      branchName: ['', [Validators.required]],
      address: ['', [Validators.required]]
    });
  }

  ngOnInit() {
    this.loadCompanies();
  }
goToDashboard(company: Company): void {
  // Example: navigate to dashboard route with company ID
  this.router.navigate(['/dashboard', company.id]);
}

  private async loadCompanies() {
    const companies = this.companyService.companies();
    // Transform to match the new interface
    this.companies.set(companies.map(company => ({
      ...company,
      slug: company.id || '',
      ownerUid: '',
      plan: 'basic',
      stores: []
    })));
  }

  getBranches(store: Store): Branch[] {
    return store.branches || [];
  }

  openCreateModal() {
    this.editingCompany.set(null);
    this.companyForm.reset({
      currency: 'USD',
      timezone: 'UTC'
    });
    this.isModalOpen.set(true);
  }

  openEditModal(company: Company) {
    this.editingCompany.set(company);
    this.companyForm.patchValue({
      name: company.name,
      address: company.address,
      currency: company.settings?.currency || 'USD',
      timezone: company.settings?.timezone || 'UTC'
    });
    this.isModalOpen.set(true);
  }

  confirmDelete(company: Company) {
    this.companyToDelete.set(company);
    this.isDeleteModalOpen.set(true);
  }

  async saveCompany() {
    if (this.companyForm.valid) {
      this.isLoading.set(true);
      try {
        const formValue = this.companyForm.value;
        const user = this.authService.getCurrentUser();

        const stores = this.getStoresFromForm();

        const companyData: Omit<Company, 'id' | 'createdAt' | 'updatedAt'> = {
          name: formValue.name!,
          slug: this.generateSlug(formValue.name!),
          ownerUid: user?.uid || '',
          plan: formValue.plan! as 'basic' | 'pro' | 'enterprise',
          address: formValue.address!,
          onboardingStatus: {
            profileCompleted: true,
            storesCreated: stores.length > 0,
            productsAdded: false,
            firstSaleCompleted: false,
            currentStep: stores.length > 0 ? 'product_setup' : 'store_creation'
          },
          settings: {
            currency: formValue.currency!,
            timezone: formValue.timezone!,
            enableMultiStore: true,
            defaultBusinessType: 'retail'
          },
          stores
        };

        const currentEditingCompany = this.editingCompany();
        if (currentEditingCompany?.id) {
          await this.companyService.updateCompany(currentEditingCompany.id, companyData);
        } else {
          await this.companyService.createCompany(companyData);
        }

        await this.loadCompanies();
        this.closeModal();
      } catch (error) {
        console.error('Error saving company:', error);
      } finally {
        this.isLoading.set(false);
      }
    }
  }

  private getStoresFromForm(): Store[] {
    const storesFormArray = this.companyForm.get('stores') as FormArray;
    return storesFormArray.controls.map(control => {
      const store = control.value;
      return {
        storeName: store.storeName || '',
        address: store.address || '',
        companyId: '', // Will be set by the service
        createdAt: new Date(),
        businessType: 'retail' as BusinessType,
        isActive: true,
        settings: {
          currency: 'USD',
          timezone: 'America/New_York',
          taxRate: 0.08,
          enableInventoryTracking: true,
          enableCustomerView: true,
          receiptSettings: {
            header: 'Welcome to ' + (store.storeName || 'Our Store'),
            footer: 'Thank you for your business!',
            showTax: true,
            showDiscount: true
          }
        },
        branches: store.branches?.map((branch: any) => ({
          branchName: branch.branchName || '',
          address: branch.address || '',
          companyId: '', // Will be set by the service
          storeId: '', // Will be set by the service
          createdAt: new Date()
        })) || []
      };
    });
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  async deleteCompany() {
    const companyToDelete = this.companyToDelete();
    if (companyToDelete?.id) {
      this.isLoading.set(true);
      try {
        await this.companyService.deleteCompany(companyToDelete.id);
        await this.loadCompanies();
        this.closeDeleteModal();
      } catch (error) {
        console.error('Error deleting company:', error);
      } finally {
        this.isLoading.set(false);
      }
    }
  }

  closeModal() {
    this.isModalOpen.set(false);
    this.editingCompany.set(null);
    this.companyForm.reset({
      plan: 'basic',
      currency: 'USD',
      timezone: 'UTC'
    });
  }

  closeDeleteModal() {
    this.isDeleteModalOpen.set(false);
    this.companyToDelete.set(null);
  }

  async onCompanySave(company: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>) {
    try {
      this.isLoading.set(true);
      if (this.editingCompany()?.id) {
        await this.companyService.updateCompany(this.editingCompany()!.id!, company);
      } else {
        await this.companyService.createCompany(company);
      }
      await this.loadCompanies();
      this.closeModal();
    } catch (error) {
      console.error('Error saving company:', error);
    } finally {
      this.isLoading.set(false);
    }
  }
}
