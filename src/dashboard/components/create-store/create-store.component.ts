import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CompanySetupService, Company, Store, Branch } from '../../services/companySetup.service';

@Component({
  selector: 'app-store',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './create-store.component.html',
  styleUrls: ['./create-store.component.css']
})
export class CreateStoreComponent {
  companyForm: FormGroup;
  isSubmitting = false;

  constructor(
    private fb: FormBuilder,
    private companySetupService: CompanySetupService
  ) {
    this.companyForm = this.fb.group({
      companyName: ['', Validators.required],
      stores: this.fb.array([this.createStore()])
    });
  }

  get stores(): FormArray {
    return this.companyForm.get('stores') as FormArray;
  }

  createStore(): FormGroup {
    return this.fb.group({
      storeName: ['', Validators.required],
      address: [''],
      branches: this.fb.array([this.createBranch()])
    });
  }

  createBranch(): FormGroup {
    return this.fb.group({
      branchName: ['', Validators.required],
      address: ['']
    });
  }

  getBranches(storeIndex: number): FormArray {
    return this.stores.at(storeIndex).get('branches') as FormArray;
  }

  addStore() {
    this.stores.push(this.createStore());
  }

  removeStore(index: number) {
    if (this.stores.length > 1) {
      this.stores.removeAt(index);
    }
  }

  addBranch(storeIndex: number) {
    this.getBranches(storeIndex).push(this.createBranch());
  }

  removeBranch(storeIndex: number, branchIndex: number) {
    const branches = this.getBranches(storeIndex);
    if (branches.length > 1) {
      branches.removeAt(branchIndex);
    }
  }

  async submitForm() {
    if (this.companyForm.valid) {
      await this.saveCompany();
    } else {
      this.companyForm.markAllAsTouched();
    }
  }

  async saveCompany() {
    try {
      if (this.isSubmitting) return;
      
      if (!this.companyForm.valid) {
        this.companyForm.markAllAsTouched();
        return;
      }

      this.isSubmitting = true;

      const formValue = this.companyForm.value;

      // Transform the form data to match the Company interface
      const company: Company = {
        name: formValue.companyName.trim(),
        slug: formValue.companyName.toLowerCase().trim().replace(/\s+/g, '-'),
        ownerUid: 'uid_brew_owner', // TODO: Get this from AuthService
        plan: 'pro',
        createdAt: new Date(),
        logoUrl: '',
        stores: formValue.stores.map((store: any) => ({
          storeName: store.storeName.trim(),
          address: store.address?.trim() || '',
          branches: store.branches.map((branch: any) => ({
            branchName: branch.branchName.trim(),
            address: branch.address?.trim() || ''
          }))
        }))
      };

      const result = await this.companySetupService.addCompanySetup(company);
      
      if (result === 'success') {
        console.log('✅ Company setup completed successfully');
        // Reset form and create a new empty store and branch
        this.companyForm.reset();
        this.stores.clear();
        this.addStore();
      } else if (result === 'exists') {
        alert('A company with this name already exists. Please choose a different name.');
      } else if (result === 'permission-denied') {
        alert('You do not have permission to create a company. Please contact support.');
      } else {
        alert('An error occurred while creating the company. Please try again.');
        console.error('Error creating company:', result);
      }
    } catch (error) {
      alert('An unexpected error occurred. Please try again.');
      console.error('Error saving company:', error);
    } finally {
      this.isSubmitting = false;
    }
  }

}
