import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonComponent } from '../../shared/ui/button.component';
import { TableComponent } from '../../shared/ui/table.component';
import { ModalComponent } from '../../shared/ui/modal.component';
import { ProductService } from '../../services/product.service';
import { Product, ProductType } from '../../interfaces/product.interface';
import { CompanySetupService, Company } from '../../services/companySetup.service';
import { AuthService } from '../../services/auth.service';
import { computed } from '@angular/core';

@Component({
  selector: 'app-products',
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
        <h1 class="text-2xl font-semibold text-gray-900">Products</h1>
        <ui-button (click)="openCreateModal()">Add Product</ui-button>
      </div>

      <!-- Products Table -->
      <div class="mt-8">
        <ui-table
          [columns]="columns"
          [data]="products"
          (onEdit)="openEditModal($event)"
          (onDelete)="confirmDelete($event)"
        ></ui-table>
      </div>

      <!-- Create/Edit Modal -->
      <ui-modal
        [isOpen]="isModalOpen"
        [title]="editingProduct ? 'Edit Product' : 'Create Product'"
        [saveLabel]="editingProduct ? 'Update' : 'Create'"
        [loading]="isLoading"
        (onClose)="closeModal()"
        (onSave)="saveProduct()"
      >
        <form [formGroup]="productForm" class="space-y-4">
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
          </div>

          <div>
            <label for="name" class="block text-sm font-medium text-gray-700">Product Name</label>
            <input
              type="text"
              id="name"
              formControlName="name"
              class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            />
          </div>

          <div>
            <label for="sku" class="block text-sm font-medium text-gray-700">SKU</label>
            <input
              type="text"
              id="sku"
              formControlName="sku"
              class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            />
          </div>

          <div>
            <label for="description" class="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              id="description"
              rows="3"
              formControlName="description"
              class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            ></textarea>
          </div>

          <div>
            <label for="category" class="block text-sm font-medium text-gray-700">Category</label>
            <select
              id="category"
              formControlName="category"
              class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            >
              <option value="">Select Category</option>
              <option *ngFor="let category of categories" [value]="category">
                {{ category }}
              </option>
            </select>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="price" class="block text-sm font-medium text-gray-700">Price</label>
              <input
                type="number"
                id="price"
                formControlName="price"
                min="0"
                step="0.01"
                class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              />
            </div>

            <div>
              <label for="cost" class="block text-sm font-medium text-gray-700">Cost</label>
              <input
                type="number"
                id="cost"
                formControlName="cost"
                min="0"
                step="0.01"
                class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="taxRate" class="block text-sm font-medium text-gray-700">Tax Rate (%)</label>
              <input
                type="number"
                id="taxRate"
                formControlName="taxRate"
                min="0"
                max="100"
                step="0.01"
                class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700">Stock Tracking</label>
              <div class="mt-2">
                <label class="inline-flex items-center">
                  <input
                    type="checkbox"
                    formControlName="stockTracking"
                    class="rounded border-gray-300 text-primary-600 shadow-sm focus:border-primary-300 focus:ring focus:ring-primary-200 focus:ring-opacity-50"
                  />
                  <span class="ml-2">Enable stock tracking</span>
                </label>
              </div>
            </div>
          </div>
        </form>
      </ui-modal>

      <!-- Delete Confirmation Modal -->
      <ui-modal
        [isOpen]="isDeleteModalOpen"
        title="Delete Product"
        saveLabel="Delete"
        [loading]="isLoading"
        (onClose)="closeDeleteModal()"
        (onSave)="deleteProduct()"
      >
        <p class="text-sm text-gray-500">
          Are you sure you want to delete this product? This action cannot be undone.
        </p>
      </ui-modal>
    </div>
  `
})
export class ProductsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private productService = inject(ProductService);
  private companyService = inject(CompanySetupService);
  private authService = inject(AuthService);

  products: Product[] = [];
  companies: { id: string; name: string; }[] = [];
  isModalOpen = false;
  isDeleteModalOpen = false;
  isLoading = false;
  editingProduct: Product | null = null;
  productToDelete: Product | null = null;
  isAdmin = false;
  userCompanyId: string | null = null;

  categories = [
    'Electronics',
    'Clothing',
    'Food & Beverage',
    'Home & Garden',
    'Sports & Outdoors',
    'Books',
    'Other'
  ];

  columns = [
    { key: 'name', label: 'Product Name' },
    { key: 'sku', label: 'SKU' },
    { key: 'category', label: 'Category' },
    { 
      key: 'price', 
      label: 'Price',
      format: (value: number) => `$${value.toFixed(2)}`
    },
    { 
      key: 'stockTracking', 
      label: 'Stock Tracking',
      format: (value: boolean) => value ? 'Yes' : 'No'
    }
  ];

  productForm = this.fb.group({
    companyId: ['', this.isAdmin ? [Validators.required] : []],
    name: ['', [Validators.required]],
    sku: ['', [Validators.required]],
    description: [''],
    category: ['', [Validators.required]],
    price: [0, [Validators.required, Validators.min(0)]],
    cost: [0, [Validators.required, Validators.min(0)]],
    taxRate: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
    stockTracking: [false]
  });

  ngOnInit() {
    this.setupUser();
    this.loadData();
  }

  private getCurrentStoreId(): string {
    // For now, return a default store ID
    // In a real app, you'd get this from user context or store selection
    return 'default-store-id';
  }

  private setupUser() {
    const user = this.authService.currentUser();
    this.isAdmin = (user?.roleId || user?.role) === 'admin';
    this.userCompanyId = user?.companyId || null;
  }

  private async loadData() {
    if (this.isAdmin) {
      this.companies = this.companyService.companies().map(company => ({
        id: company.id!,
        name: company.name
      }));
    }
    if (this.userCompanyId) {
      await this.productService.loadProducts(this.userCompanyId);
      this.products = this.productService.getProducts();
    }
  }

  openCreateModal() {
    this.editingProduct = null;
    this.productForm.reset({
      companyId: this.userCompanyId || '',
      price: 0,
      cost: 0,
      taxRate: 0,
      stockTracking: false
    });
    this.isModalOpen = true;
  }

  openEditModal(product: any) {
    this.editingProduct = product;
    this.productForm.patchValue({
      companyId: product.companyId,
      name: product.name,
      sku: product.sku,
      description: product.description,
      category: product.category,
      price: product.price,
      cost: product.cost,
      taxRate: product.taxRate,
      stockTracking: product.stockTracking
    });
    this.isModalOpen = true;
  }

  confirmDelete(product: any) {
    this.productToDelete = product;
    this.isDeleteModalOpen = true;
  }

  async saveProduct() {
    if (this.productForm.valid) {
      this.isLoading = true;
      try {
        const formValue = this.productForm.value;
        const storeId = this.getCurrentStoreId(); // Get from user context or default
        const productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> = {
          companyId: this.userCompanyId!,
          storeId: storeId,
          name: formValue.name!,
          sku: formValue.sku!,
          description: formValue.description || '',
          category: formValue.category!,
          price: formValue.price!,
          status: 'active' as const,
          productType: 'product' as ProductType, // Default physical product
          inventorySettings: {
            trackInventory: true,
            stockQuantity: 0, // Initialize with 0, can be updated later
            lowStockAlert: 10,
            unit: 'pieces'
          },
          businessTypeSettings: {
            taxable: true,
            taxRate: 0.08
          }
        };

        if (this.editingProduct) {
          await this.productService.updateProduct(
            this.userCompanyId!,
            this.editingProduct.id!,
            productData
          );
        } else {
          await this.productService.createProduct(productData);
        }

        this.closeModal();
        this.loadData();
      } catch (error) {
        console.error('Error saving product:', error);
      } finally {
        this.isLoading = false;
      }
    }
  }

  async deleteProduct() {
    if (this.productToDelete && this.userCompanyId) {
      this.isLoading = true;
      try {
        await this.productService.deleteProduct(
          this.userCompanyId,
          this.productToDelete.id!
        );
        this.closeDeleteModal();
        this.loadData();
      } catch (error) {
        console.error('Error deleting product:', error);
      } finally {
        this.isLoading = false;
      }
    }
  }

  closeModal() {
    this.isModalOpen = false;
    this.editingProduct = null;
    this.productForm.reset();
  }

  closeDeleteModal() {
    this.isDeleteModalOpen = false;
    this.productToDelete = null;
  }
}
