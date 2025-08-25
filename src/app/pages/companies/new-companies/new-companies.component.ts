import { Component, OnInit, inject, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalComponent } from '../../../shared/ui/modal.component';
import { NewCompanyService } from '../../../services/new-company.service';
import { Company, Store, Branch } from '../../../interfaces/company.interface';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-new-companies',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ModalComponent
  ],
  templateUrl: './new-companies.component.html',
  styleUrls: ['./new-companies.component.css']
})
export class NewCompaniesComponent implements OnInit {
  @Input() isOpen = false;
  @Input() company: Company | null = null;
  @Output() save = new EventEmitter<Omit<Company, 'id' | 'createdAt' | 'updatedAt'>>();
  @Output() close = new EventEmitter<void>();
  private fb = inject(FormBuilder);
  private companyService = inject(NewCompanyService);
  private authService = inject(AuthService);

  companies: Company[] = [];
  isModalOpen = false;
  isDeleteModalOpen = false;
  isLoading = false;
  editingCompany: Company | null = null;
  companyToDelete: Company | null = null;

  companyForm = this.fb.group({
    name: ['', [Validators.required]],
    address: ['', [Validators.required]],
    plan: ['basic', [Validators.required]],
    stores: this.fb.array([])
  });

  get storeFormArray() {
    return this.companyForm.get('stores') as FormArray;
  }

  ngOnInit() {
    this.loadCompanies();
  }

  private async loadCompanies() {
    await this.companyService.loadCompanies();
    this.companies = this.companyService.companies();
  }

  createStoreFormGroup() {
    return this.fb.group({
      storeName: ['', Validators.required],
      branches: this.fb.array([this.createBranchFormGroup()])
    });
  }

  createBranchFormGroup() {
    return this.fb.group({
      branchName: ['', Validators.required],
      address: ['', Validators.required]
    });
  }

  addStore() {
    const storeForm = this.createStoreFormGroup();
    this.storeFormArray.push(storeForm);
  }

  removeStore(index: number) {
    this.storeFormArray.removeAt(index);
  }

  getStoreControls(storeIndex: number) {
    return (this.storeFormArray.at(storeIndex).get('stores') as FormArray).controls;
  }
  addBranch(storeIndex: number) {
    const branchForm = this.createBranchFormGroup();
    (this.storeFormArray.at(storeIndex).get('branches') as FormArray).push(branchForm);
  }

  removeBranch(storeIndex: number, branchIndex: number) {
    (this.storeFormArray.at(storeIndex).get('branches') as FormArray).removeAt(branchIndex);
  }

  getBranchControls(storeIndex: number) {
    return (this.storeFormArray.at(storeIndex).get('branches') as FormArray).controls;
  }

  getBranches(store: Store): Branch[] {
    return store.branches || [];
  }

  openCreateModal() {
    this.editingCompany = null;
    this.companyForm.reset({
      plan: 'basic'
    });
    while (this.storeFormArray.length) {
      this.storeFormArray.removeAt(0);
    }
    this.addStore(); // Add one store by default
    this.isModalOpen = true;
  }

  openEditModal(company: Company) {
    this.editingCompany = company;
    this.companyForm.patchValue({
      name: company.name,
      address: company.address || '',
      plan: company.plan
    });

    // Reset stores array
    while (this.storeFormArray.length) {
      this.storeFormArray.removeAt(0);
    }

    // Add existing stores and branches
    company.stores?.forEach((store: Store) => {
      const storeForm = this.createStoreFormGroup();
      storeForm.patchValue({
        storeName: store.storeName,
      });

      store.branches?.forEach((branch: Branch) => {
        const branchForm = this.createBranchFormGroup();
        branchForm.patchValue({
          branchName: branch.branchName,
          address: branch.address
        });
        (storeForm.get('branches') as FormArray).push(branchForm);
      });

      this.storeFormArray.push(storeForm);
    });

    this.isModalOpen = true;
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  async saveCompany() {
    if (this.companyForm.valid) {
      this.isLoading = true;
      try {
        const formValue = this.companyForm.value;
        const user = this.authService.getCurrentUser();

        // 1. Save or update company first
        const storesData = this.storeFormArray.value.map((store: any) => ({
          storeName: store.storeName || '',
          address: store.address || '',
          branches: store.branches || []
        }));

        const companyData: Omit<Company, 'id' | 'createdAt' | 'updatedAt'> = {
          name: formValue.name || '',
          slug: this.generateSlug(formValue.name || ''),
          ownerUid: user?.uid || '',
          plan: (formValue.plan || 'basic') as 'basic' | 'pro' | 'enterprise',
          onboardingStatus: {
            profileCompleted: true,
            storesCreated: storesData.length > 0,
            productsAdded: false,
            firstSaleCompleted: false,
            currentStep: storesData.length > 0 ? 'product_setup' : 'store_creation'
          },
          settings: {
            currency: 'USD',
            timezone: 'America/New_York',
            enableMultiStore: true,
            defaultBusinessType: 'retail'
          },
          stores: storesData
        };
        
        // Only add logoUrl if it exists
        if (this.company?.logoUrl) {
          companyData.logoUrl = this.company.logoUrl;
        }

        let companyId: string;
        if (this.editingCompany?.id) {
          companyId = this.editingCompany.id;
          await this.companyService.updateCompany(companyId, companyData);
        } else {
          companyId = await this.companyService.createCompany(companyData);
        }

        // The stores and branches are now handled by the company service

        this.closeModal();
        this.save.emit(companyData); // Pass the company data to the parent
      } catch (error) {
        console.error('Error saving company:', error);
      } finally {
        this.isLoading = false;
      }
    }
  }

  confirmDelete(company: Company) {
    this.companyToDelete = company;
    this.isDeleteModalOpen = true;
  }

  async deleteCompany() {
    if (this.companyToDelete?.id) {
      this.isLoading = true;
      try {
        await this.companyService.deleteCompany(this.companyToDelete.id);
        this.closeDeleteModal();
      } catch (error) {
        console.error('Error deleting company:', error);
      } finally {
        this.isLoading = false;
      }
    }
  }

  closeModal() {
    this.isModalOpen = false;
    this.editingCompany = null;
    this.companyForm.reset();
  }

  closeDeleteModal() {
    this.isDeleteModalOpen = false;
    this.companyToDelete = null;
  }
}
