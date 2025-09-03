import { Component, OnInit, computed, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { Product, ProductInventory } from '../../../interfaces/product.interface';
import { ProductService } from '../../../services/product.service';
import { StoreService } from '../../../services/store.service';
import { Store } from '../../../interfaces/store.interface';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-product-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  styles: [`
    .products-management {
      padding: 0;
      min-height: 100vh;
      background: #f8fafc;
    }

    .header {
      background: linear-gradient(135deg, #059669 0%, #10b981 100%);
      color: white;
      padding: 2rem 0;
      margin-bottom: 2rem;
    }

    .header-content {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .page-title {
      font-size: 2.5rem;
      font-weight: 700;
      margin: 0 0 0.5rem 0;
    }

    .page-subtitle {
      font-size: 1.1rem;
      opacity: 0.9;
      margin: 0;
    }

    .header-actions {
      display: flex;
      gap: 0.75rem;
    }

    .filters-section {
      max-width: 1200px;
      margin: 0 auto 2rem auto;
      padding: 0 1rem;
    }

    .search-container {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      max-width: 500px;
    }

    .search-input {
      flex: 1;
      padding: 0.75rem;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 1rem;
    }

    .search-input:focus {
      outline: none;
      border-color: #059669;
      box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.1);
    }

    .table-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 1rem;
    }

    .table-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }

    .table-header h3 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 600;
      color: #2d3748;
    }

    .table-wrapper {
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .products-table {
      width: 100%;
      border-collapse: collapse;
    }

    .products-table th,
    .products-table td {
      padding: 1rem;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }

    .products-table th {
      background: #f8fafc;
      font-weight: 600;
      color: #2d3748;
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.025em;
    }

    .products-table tbody tr:hover {
      background: #f8fafc;
    }

    .product-name-cell {
      font-weight: 500;
      color: #2d3748;
    }

    .product-sku-cell {
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 0.875rem;
      color: #059669;
      font-weight: 600;
    }

    .product-category-cell {
      color: #4a5568;
    }

    .product-stock-cell {
      color: #718096;
    }

    .product-price-cell {
      font-weight: 500;
      color: #2d3748;
    }

    .status-badge {
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.025em;
    }

    .status-badge.status-active {
      background: #c6f6d5;
      color: #2f855a;
    }

    .status-badge.status-inactive {
      background: #fed7d7;
      color: #c53030;
    }

    .stock-badge {
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .stock-high {
      background: #c6f6d5;
      color: #2f855a;
    }

    .stock-medium {
      background: #faf089;
      color: #d69e2e;
    }

    .stock-low {
      background: #fed7d7;
      color: #c53030;
    }

    .actions-cell {
      display: flex;
      gap: 0.5rem;
    }

    .btn {
      border: none;
      border-radius: 6px;
      padding: 0.5rem 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      text-decoration: none;
      font-size: 0.875rem;
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-primary {
      background: #059669;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #047857;
    }

    .btn-secondary {
      background: #e2e8f0;
      color: #4a5568;
    }

    .btn-secondary:hover:not(:disabled) {
      background: #cbd5e0;
    }

    .btn-danger {
      background: #f56565;
      color: white;
    }

    .btn-danger:hover:not(:disabled) {
      background: #e53e3e;
    }

    .btn-sm {
      padding: 0.25rem 0.5rem;
      font-size: 0.75rem;
    }

    .empty-state, .loading-state {
      text-align: center;
      padding: 4rem 2rem;
      color: #718096;
      background: white;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .empty-content h3, .loading-content p {
      margin-bottom: 1rem;
      color: #2d3748;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #e2e8f0;
      border-top-color: #059669;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 1rem;
    }

    .modal {
      background: white;
      border-radius: 12px;
      max-width: 600px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.5rem;
      border-bottom: 1px solid #e2e8f0;
    }

    .modal-header h3 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
      color: #2d3748;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: #718096;
      padding: 0.25rem;
      line-height: 1;
    }

    .close-btn:hover {
      color: #4a5568;
    }

    .modal-body {
      padding: 1.5rem;
    }

    .form-group {
      margin-bottom: 1.5rem;
    }

    .form-group label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
      color: #2d3748;
    }

    .form-input,
    .form-select,
    .form-textarea {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 1rem;
      transition: border-color 0.2s;
    }

    .form-input:focus,
    .form-select:focus,
    .form-textarea:focus {
      outline: none;
      border-color: #059669;
      box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.1);
    }

    .form-textarea {
      resize: vertical;
      min-height: 80px;
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      cursor: pointer;
      font-weight: normal;
    }

    .checkbox-input {
      margin-right: 0.5rem;
      width: auto;
    }

    .checkbox-text {
      font-size: 1rem;
      color: #2d3748;
    }

    .inventory-section {
      margin-top: 1.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid #e2e8f0;
    }

    .inventory-section h4 {
      margin: 0 0 1rem 0;
      font-size: 1.125rem;
      font-weight: 600;
      color: #1f2937;
    }

    .error-message {
      margin-top: 0.5rem;
      font-size: 0.875rem;
      color: #f56565;
    }

    .modal-footer {
      display: flex;
      gap: 0.75rem;
      justify-content: flex-end;
      padding: 1.5rem;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
    }

    .filters-row {
      display: flex;
      gap: 1rem;
      margin-bottom: 1rem;
      flex-wrap: wrap;
    }

    .filter-group {
      flex: 1;
      min-width: 200px;
    }

    .filter-group label {
      display: block;
      margin-bottom: 0.25rem;
      font-weight: 500;
      color: #4a5568;
      font-size: 0.875rem;
    }

    .filter-select {
      width: 100%;
      padding: 0.5rem;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 0.875rem;
      transition: border-color 0.2s;
    }

    .filter-select:focus {
      outline: none;
      border-color: #059669;
      box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.1);
    }

    @media (max-width: 768px) {
      .header-content {
        flex-direction: column;
        align-items: flex-start;
      }

      .page-title {
        font-size: 2rem;
      }

      .search-container {
        max-width: 100%;
      }

      .table-wrapper {
        overflow-x: auto;
      }

      .products-table {
        min-width: 800px;
      }

      .modal {
        margin: 1rem;
        max-width: none;
        width: auto;
      }

      .filters-row {
        flex-direction: column;
      }
    }
  `],
  template: `
    <div class="products-management">
      <!-- Header -->
      <div class="header">
        <div class="header-content">
          <div class="header-text">
            <h1 class="page-title">Product Management</h1>
            <p class="page-subtitle">Manage your company products and inventory</p>
          </div>
          <div class="header-actions">
            <button class="btn btn-primary" (click)="openAddModal()" style="background: #007bff !important; color: white !important; padding: 8px 16px !important;">
              Add New Product
            </button>
          </div>
        </div>
      </div>

      <!-- Search and Filters -->
      <div class="filters-section">
        <div class="search-container">
          <input 
            type="text" 
            [(ngModel)]="searchTerm"
            (input)="filterProducts()"
            placeholder="Search products by name, SKU, or category..."
            class="search-input">
          <button class="btn btn-secondary" (click)="clearSearch()">
            Clear
          </button>
        </div>
        <div class="filters-row">
          <div class="filter-group">
            <label>Category</label>
            <select 
              [(ngModel)]="selectedCategory"
              (change)="filterProducts()"
              class="filter-select">
              <option value="">All Categories</option>
              <option *ngFor="let category of categories()" [value]="category">{{ category }}</option>
            </select>
          </div>
          <div class="filter-group">
            <label>Store</label>
            <select 
              [(ngModel)]="selectedStore"
              (change)="filterProducts()"
              class="filter-select">
              <option value="">All Stores</option>
              <option *ngFor="let store of stores()" [value]="store.id">{{ store.storeName }}</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Products Table -->
      <div class="table-container">
        <div class="table-header">
          <h3>Products ({{ filteredProducts().length }})</h3>
          <button class="btn btn-secondary" (click)="refreshProducts()">
            Refresh
          </button>
        </div>

      <div class="table-wrapper" *ngIf="filteredProducts().length > 0">
          <table class="products-table">
            <thead>
              <tr>
                <th>Product Name</th>
                <th>SKU ID</th>
                <th>Category</th>
                <th>Stock</th>
                <th>Price</th>
                <th>Store</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let product of filteredProducts()">
                <td class="product-name-cell">
                  <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <img *ngIf="product.imageUrl" [src]="product.imageUrl" [alt]="product.productName" style="width: 40px; height: 40px; border-radius: 6px; object-fit: cover;">
                    <div *ngIf="!product.imageUrl" style="width: 40px; height: 40px; border-radius: 6px; background: #f3f4f6; display: flex; align-items: center; justify-content: center;">
                      <svg style="width: 20px; height: 20px; color: #9ca3af;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2h4a1 1 0 110 2h-1v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6H3a1 1 0 110-2h4z"></path>
                      </svg>
                    </div>
                    <div>
                      <div style="font-weight: 500; color: #2d3748;">{{ product.productName }}</div>
                      <div *ngIf="product.barcodeId" style="font-size: 0.75rem; color: #718096;">{{ product.barcodeId }}</div>
                    </div>
                  </div>
                </td>
                <td class="product-sku-cell">{{ product.skuId }}</td>
                <td class="product-category-cell">{{ product.category }}</td>
                <td class="product-stock-cell">
                  <span class="stock-badge" [class]="getStockBadgeClass(product.totalStock)">
                    {{ product.totalStock }}
                  </span>
                </td>
                <td class="product-price-cell">\${{ displayPrice(product).toFixed(2) }}</td>
                <td class="product-store-cell">{{ getStoreName(product.storeId) }}</td>
                <td class="status-cell">
                  <span class="status-badge" [class]="'status-' + (product.status || 'active')">
                    {{ (product.status || 'active') | titlecase }}
                  </span>
                </td>
                  <td class="actions-cell">
                  <button 
                    class="btn btn-sm btn-secondary"
                    (click)="openEditModal(product)">
                    Edit
                  </button>
                  <button 
                    *ngIf="product.isMultipleInventory"
                    class="btn btn-sm btn-secondary"
                    (click)="openInventoryModal(product)">
                    Inventory
                  </button>
                  <button 
                    class="btn btn-sm btn-danger"
                    (click)="deleteProduct(product)">
                    Delete
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Empty State -->
        <div class="empty-state" *ngIf="filteredProducts().length === 0 && !loading">
          <div class="empty-content">
            <h3>No Products Found</h3>
            <p *ngIf="searchTerm">No products match your search criteria.</p>
            <p *ngIf="!searchTerm">No products have been created yet.</p>
            <button class="btn btn-primary" (click)="openAddModal()">
              Add Your First Product
            </button>
          </div>
        </div>

        <!-- Loading State -->
        <div class="loading-state" *ngIf="loading">
          <div class="loading-content">
            <div class="spinner"></div>
            <p>Loading products...</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Product Modal -->
  <div class="modal-overlay" 
     *ngIf="showModal" 
     style="position: fixed !important; z-index: 9999 !important; background: rgba(0, 0, 0, 0.8) !important;">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>{{ isEditMode ? 'Edit Product' : 'Add New Product' }}</h3>
          <button class="close-btn" (click)="closeModal()">×</button>
        </div>
        <div class="modal-body">
          <form [formGroup]="productForm" (ngSubmit)="submitProduct()">
            <div class="form-group">
              <label for="productName">Product Name *</label>
              <input
                type="text"
                id="productName"
                formControlName="productName"
                class="form-input"
                placeholder="Enter product name">
              <div class="error-message" *ngIf="productForm.get('productName')?.invalid && productForm.get('productName')?.touched">
                Product name is required
              </div>
            </div>

            <div class="form-group">
              <label for="skuId">SKU ID *</label>
              <input
                type="text"
                id="skuId"
                formControlName="skuId"
                class="form-input"
                placeholder="Enter SKU ID">
              <div class="error-message" *ngIf="productForm.get('skuId')?.invalid && productForm.get('skuId')?.touched">
                SKU ID is required
              </div>
            </div>

            <div class="form-group">
              <label for="category">Category *</label>
              <input
                type="text"
                id="category"
                formControlName="category"
                class="form-input"
                placeholder="Enter category">
              <div class="error-message" *ngIf="productForm.get('category')?.invalid && productForm.get('category')?.touched">
                Category is required
              </div>
            </div>

            <div class="form-group">
              <label for="totalStock">Total Stock</label>
              <input
                type="number"
                id="totalStock"
                formControlName="totalStock"
                class="form-input"
                placeholder="0"
                [readonly]="productForm.get('totalStock')?.disabled">
            </div>

            <div class="form-group">
              <label for="sellingPrice">Selling Price *</label>
              <input
                type="number"
                id="sellingPrice"
                step="0.01"
                formControlName="sellingPrice"
                class="form-input"
                placeholder="0.00"
                [readonly]="productForm.get('sellingPrice')?.disabled">
              <div class="error-message" *ngIf="productForm.get('sellingPrice')?.invalid && productForm.get('sellingPrice')?.touched">
                Selling price is required
              </div>
            </div>

            <div class="form-group">
              <label for="storeId">Store *</label>
              <select
                id="storeId"
                formControlName="storeId"
                class="form-select">
                <option value="">Select Store</option>
                <option *ngFor="let store of stores()" [value]="store.id">{{ store.storeName }}</option>
              </select>
              <div class="error-message" *ngIf="productForm.get('storeId')?.invalid && productForm.get('storeId')?.touched">
                Store selection is required
              </div>
            </div>

            <div class="form-group">
              <label for="barcodeId">Barcode ID</label>
              <input
                type="text"
                id="barcodeId"
                formControlName="barcodeId"
                class="form-input"
                placeholder="Enter barcode ID">
            </div>

            <div class="form-group">
              <label for="qrCode">QR Code</label>
              <input
                type="text"
                id="qrCode"
                formControlName="qrCode"
                class="form-input"
                placeholder="Enter QR code">
            </div>

            <div class="form-group">
              <label for="imageUrl">Image URL</label>
              <div style="display:flex; gap:0.5rem; align-items:center;">
                <input
                  type="url"
                  id="imageUrl"
                  formControlName="imageUrl"
                  class="form-input"
                  placeholder="Enter image URL">
                <button type="button" class="btn btn-sm btn-secondary" (click)="triggerImageUpload()">
                  <svg style="width:16px;height:16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7h4l3-3h4l3 3h4v11a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"></path></svg>
                  <span *ngIf="!productForm.get('imageUrl')?.value"> Upload Image</span>
                  <span *ngIf="productForm.get('imageUrl')?.value"> Replace Image</span>
                </button>
                <input id="hiddenImageFile" type="file" accept="image/*" style="display:none" (change)="onImageFileChange($event)" />
              </div>
            </div>

            <div class="form-group">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  formControlName="isMultipleInventory"
                  class="checkbox-input">
                <span class="checkbox-text">Enable Multiple Inventory Batches</span>
              </label>
            </div>

            <!-- Inventory section: only visible when isMultipleInventory is checked -->
            <div *ngIf="productForm.get('isMultipleInventory')?.value" class="inventory-section">
              <h4 *ngIf="!isEditMode">Initial Inventory</h4>
              <ng-container *ngIf="!isEditMode">
                <div class="form-group">
                  <label for="initialBatchId">Batch ID</label>
                  <input
                    type="text"
                    id="initialBatchId"
                    formControlName="initialBatchId"
                    class="form-input"
                    placeholder="Enter batch ID">
                </div>
                <div class="form-group">
                  <label for="initialQuantity">Quantity</label>
                  <input
                    type="number"
                    id="initialQuantity"
                    formControlName="initialQuantity"
                    class="form-input"
                    placeholder="0">
                </div>
                <div class="form-group">
                  <label for="initialUnitPrice">Unit Price</label>
                  <input
                    type="number"
                    id="initialUnitPrice"
                    step="0.01"
                    formControlName="initialUnitPrice"
                    class="form-input"
                    placeholder="0.00">
                </div>
                <div class="form-group">
                  <label for="initialReceivedAt">Received Date</label>
                  <input
                    type="date"
                    id="initialReceivedAt"
                    formControlName="initialReceivedAt"
                    class="form-input">
                </div>
              </ng-container>

              <ng-container *ngIf="isEditMode">
                <h4 style="margin:0 0 1rem 0;">Current Inventory</h4>
                <div style="display:flex; gap:0.5rem; align-items:center; margin-bottom:0.75rem;">
                  <div style="flex:1">
                    <small style="color:#6b7280;">Add a new batch below — new batches are added on top and only one batch can be active.</small>
                  </div>
                  <button class="btn btn-sm btn-primary" (click)="showAddBatchFromInventory()">＋ Add Batch</button>
                </div>

                <!-- Inline add batch form -->
                <form [formGroup]="inventoryForm" (ngSubmit)="addInventoryBatch()" style="display:flex; gap:0.5rem; margin-bottom:1rem; align-items:center;">
                  <input id="batchId" type="text" formControlName="batchId" class="form-input" placeholder="Batch ID" style="flex:1" />
                  <input type="number" formControlName="quantity" class="form-input" placeholder="Quantity" style="width:100px" />
                  <input type="number" formControlName="unitPrice" step="0.01" class="form-input" placeholder="Unit Price" style="width:120px" />
                  <input type="date" formControlName="receivedAt" class="form-input" style="width:160px" />
                  <button type="submit" class="btn btn-primary" [disabled]="inventoryForm.invalid">Add</button>
                </form>

                <!-- Current batches table (same as inventory modal) -->
                <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;" *ngIf="selectedProduct?.inventory?.length">
                  <table style="width:100%; border-collapse:collapse;">
                    <thead style="background:#f8fafc;"><tr>
                      <th style="padding:0.5rem">Batch ID</th>
                      <th style="padding:0.5rem">Quantity</th>
                      <th style="padding:0.5rem">Unit Price</th>
                      <th style="padding:0.5rem">Received</th>
                      <th style="padding:0.5rem">Active</th>
                      <th style="padding:0.5rem">Actions</th>
                    </tr></thead>
                    <tbody>
                      <tr *ngFor="let b of selectedProduct?.inventory">
                        <td style="padding:0.5rem">{{ b.batchId }}</td>
                        <td style="padding:0.5rem">{{ b.quantity }}</td>
                        <td style="padding:0.5rem">\${{ b.unitPrice.toFixed(2) }}</td>
                        <td style="padding:0.5rem">{{ b.receivedAt | date }}</td>
                        <td style="padding:0.5rem">
                          <input type="checkbox" [checked]="b.status === 'active'" [disabled]="(b.quantity || 0) <= 0" (change)="setActiveBatch(b.batchId, $any($event.target).checked)" />
                        </td>
                        <td style="padding:0.5rem"><button class="btn btn-sm btn-danger" (click)="removeInventoryBatch(b.batchId)">Remove</button></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div *ngIf="!selectedProduct?.inventory?.length" style="padding:1rem; color:#6b7280;">No inventory batches found for this product.</div>
              </ng-container>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" (click)="closeModal()">Cancel</button>
          <button 
            class="btn btn-primary" 
            (click)="submitProduct()"
            [disabled]="productForm.invalid || loading">
            {{ loading ? 'Saving...' : (isEditMode ? 'Update Product' : 'Create Product') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Inventory Modal -->
  <div class="modal-overlay" 
     *ngIf="showInventoryModal" 
     style="position: fixed !important; z-index: 9999 !important; background: rgba(0, 0, 0, 0.8) !important;">
      <div class="modal" (click)="$event.stopPropagation()" style="max-width: 800px;">
        <div class="modal-header">
          <div>
            <h3>Inventory Management</h3>
            <p style="margin: 0.25rem 0 0 0; font-size: 0.875rem; color: #6b7280;">{{ selectedProduct?.productName }} ({{ selectedProduct?.skuId }})</p>
          </div>
          <button class="close-btn" (click)="closeInventoryModal()">×</button>
        </div>
        <div class="modal-body">
          <!-- Add Inventory Batch -->
          <div style="background: #f8fafc; padding: 1.5rem; border-radius: 8px; margin-bottom: 1.5rem;">
            <h4 style="margin: 0 0 1rem 0; font-size: 1.125rem; font-weight: 600;">Add New Batch</h4>
            <form [formGroup]="inventoryForm" (ngSubmit)="addInventoryBatch()">
              <div class="form-group">
                <label for="batchId">Batch ID *</label>
                <input
                  type="text"
                  id="batchId"
                  formControlName="batchId"
                  class="form-input"
                  placeholder="Enter batch ID">
                <div class="error-message" *ngIf="inventoryForm.get('batchId')?.invalid && inventoryForm.get('batchId')?.touched">
                  Batch ID is required
                </div>
              </div>
              <div class="form-group">
                <label for="quantity">Quantity *</label>
                <input
                  type="number"
                  id="quantity"
                  formControlName="quantity"
                  class="form-input"
                  placeholder="0">
                <div class="error-message" *ngIf="inventoryForm.get('quantity')?.invalid && inventoryForm.get('quantity')?.touched">
                  Quantity is required
                </div>
              </div>
              <div class="form-group">
                <label for="unitPrice">Unit Price *</label>
                <input
                  type="number"
                  id="unitPrice"
                  step="0.01"
                  formControlName="unitPrice"
                  class="form-input"
                  placeholder="0.00">
                <div class="error-message" *ngIf="inventoryForm.get('unitPrice')?.invalid && inventoryForm.get('unitPrice')?.touched">
                  Unit price is required
                </div>
              </div>
              <div class="form-group">
                <label for="receivedAt">Received Date *</label>
                <input
                  type="date"
                  id="receivedAt"
                  formControlName="receivedAt"
                  class="form-input">
                <div class="error-message" *ngIf="inventoryForm.get('receivedAt')?.invalid && inventoryForm.get('receivedAt')?.touched">
                  Received date is required
                </div>
              </div>
              <button
                type="submit"
                class="btn btn-primary"
                [disabled]="inventoryForm.invalid">
                Add Batch
              </button>
            </form>
          </div>

          <!-- Inventory Batches Table -->
          <div style="margin-top: 1.5rem;" *ngIf="selectedProduct?.isMultipleInventory">
            <h4 style="margin: 0 0 1rem 0; font-size: 1.125rem; font-weight: 600;">Current Inventory Batches</h4>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
              <h4 style="margin:0; font-size:1rem; font-weight:600;">Current Inventory Batches</h4>
              <button class="btn btn-sm btn-primary" (click)="showAddBatchFromInventory()">＋ Add Batch</button>
            </div>
            <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;" *ngIf="selectedProduct?.inventory?.length">
              <table style="width: 100%; border-collapse: collapse;">
                <thead style="background: #f8fafc;">
                  <tr>
                    <th style="padding: 0.75rem 1rem; text-align: left; font-size: 0.75rem; font-weight: 500; color: #6b7280; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">Batch ID</th>
                    <th style="padding: 0.75rem 1rem; text-align: left; font-size: 0.75rem; font-weight: 500; color: #6b7280; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">Quantity</th>
                    <th style="padding: 0.75rem 1rem; text-align: left; font-size: 0.75rem; font-weight: 500; color: #6b7280; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">Unit Price</th>
                    <th style="padding: 0.75rem 1rem; text-align: left; font-size: 0.75rem; font-weight: 500; color: #6b7280; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">Received Date</th>
                    <th style="padding: 0.75rem 1rem; text-align: left; font-size: 0.75rem; font-weight: 500; color: #6b7280; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">Status</th>
                    <th style="padding: 0.75rem 1rem; text-align: left; font-size: 0.75rem; font-weight: 500; color: #6b7280; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let batch of selectedProduct?.inventory" style="border-bottom: 1px solid #f3f4f6;">
                    <td style="padding: 0.875rem 1rem; font-size: 0.875rem; color: #1f2937;">{{ batch.batchId }}</td>
                    <td style="padding: 0.875rem 1rem; font-size: 0.875rem; color: #1f2937;">{{ batch.quantity }}</td>
                    <td style="padding: 0.875rem 1rem; font-size: 0.875rem; color: #1f2937;">\${{ batch.unitPrice.toFixed(2) }}</td>
                    <td style="padding: 0.875rem 1rem; font-size: 0.875rem; color: #1f2937;">{{ batch.receivedAt | date }}</td>
                    <td style="padding: 0.875rem 1rem; font-size: 0.875rem; color: #1f2937;">
                      <label style="display:flex; align-items:center; gap:0.5rem;">
                        <input type="checkbox" [checked]="batch.status === 'active'" [disabled]="(batch.quantity || 0) <= 0" (change)="setActiveBatch(batch.batchId, $any($event.target).checked)" />
                        <span>{{ batch.status | titlecase }}</span>
                      </label>
                    </td>
                    <td style="padding: 0.875rem 1rem; font-size: 0.875rem; color: #1f2937;">
                      <button
                        class="btn btn-sm btn-danger"
                        (click)="removeInventoryBatch(batch.batchId)">
                        Remove
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div *ngIf="!selectedProduct?.inventory?.length" style="padding: 2rem; text-align: center; color: #6b7280; background: white; border: 1px solid #e2e8f0; border-radius: 8px;">
              <p style="margin: 0;">No inventory batches found</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class ProductManagementComponent implements OnInit {
  // Signals
  readonly products = computed(() => this.productService.getProducts());
  readonly stores = computed(() => this.storeService.getStores());
  readonly categories = computed(() => this.productService.getCategories());

  // State
  searchTerm = '';
  selectedCategory = '';
  selectedStore = '';
  filteredProducts = signal<Product[]>([]);
  
  // Modal state
  showModal = false;
  showInventoryModal = false;
  isEditMode = false;
  loading = false;
  selectedProduct: Product | null = null;

  // Forms
  productForm: FormGroup;
  inventoryForm: FormGroup;

  constructor(
    public productService: ProductService,
    private storeService: StoreService,
    private authService: AuthService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.productForm = this.createProductForm();
    this.inventoryForm = this.createInventoryForm();
    // subscribe once to isMultipleInventory changes to toggle related controls
    const isMultiCtrl = this.productForm.get('isMultipleInventory');
    if (isMultiCtrl) {
      isMultiCtrl.valueChanges.subscribe(v => this.toggleControlsForInventory(v));
    }
  }

  async ngOnInit(): Promise<void> {
    try {
      const user = this.authService.getCurrentUser();
      if (user?.companyId) {
        await this.storeService.loadStoresByCompany(user.companyId);
        await this.productService.loadProducts(user.companyId);
      } else {
        await this.storeService.loadStoresByCompany(''); // This might need better handling
        await this.productService.loadProducts();
      }
      this.filterProducts();
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  private createProductForm(): FormGroup {
    return this.fb.group({
      productName: ['', Validators.required],
      skuId: ['', Validators.required],
      category: ['', Validators.required],
  totalStock: [0, [Validators.min(0)]],
  sellingPrice: [0, [Validators.required, Validators.min(0)]],
      storeId: ['', Validators.required],
      barcodeId: [''],
      qrCode: [''],
      imageUrl: [''],
      isMultipleInventory: [false],
      // Initial inventory fields (for new products)
      initialBatchId: [''],
      initialQuantity: [0, Validators.min(0)],
      initialUnitPrice: [0, Validators.min(0)],
      initialReceivedAt: [new Date().toISOString().split('T')[0]]
    });
  }

  private createInventoryForm(): FormGroup {
    return this.fb.group({
      batchId: ['', Validators.required],
      quantity: [0, [Validators.required, Validators.min(1)]],
      unitPrice: [0, [Validators.required, Validators.min(0)]],
      receivedAt: [new Date().toISOString().split('T')[0], Validators.required]
    });
  }

  filterProducts(): void {
    let filtered = this.products();

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(product =>
        product.productName.toLowerCase().includes(term) ||
        product.skuId.toLowerCase().includes(term) ||
        product.category.toLowerCase().includes(term) ||
        product.barcodeId?.toLowerCase().includes(term)
      );
    }

    if (this.selectedCategory) {
      filtered = filtered.filter(product => product.category === this.selectedCategory);
    }

    if (this.selectedStore) {
      filtered = filtered.filter(product => product.storeId === this.selectedStore);
    }

    this.filteredProducts.set(filtered);
  }

  openAddModal(): void {
    console.log('openAddModal called');
    this.isEditMode = false;
    this.selectedProduct = null;
    this.productForm.reset({
  initialReceivedAt: new Date().toISOString().split('T')[0],
  isMultipleInventory: false,
  initialBatchId: '',
  initialQuantity: 0,
  initialUnitPrice: 0
    });
    // set totalStock from initial fields if provided
    const initialQty = this.productForm.get('initialQuantity')?.value || 0;
    this.productForm.get('totalStock')?.setValue(initialQty);
    // apply control enabling/disabling based on isMultipleInventory
    this.toggleControlsForInventory(this.productForm.get('isMultipleInventory')?.value);
    this.showModal = true;
    console.log('showModal set to:', this.showModal);
    this.cdr.detectChanges();
  }

  openEditModal(product: Product): void {
    this.isEditMode = true;
    this.selectedProduct = product;
    this.productForm.patchValue(product);
    // compute totalStock from product.inventory active batches
    const total = (product.inventory || []).reduce((s, b) => s + ((b.status === 'active') ? (b.quantity || 0) : 0), 0);
    this.productForm.get('totalStock')?.setValue(total);
    // set sellingPrice to active batch unitPrice if multiple inventory
    if (product.isMultipleInventory) {
      const active = (product.inventory || []).find(b => b.status === 'active');
      if (active) this.productForm.get('sellingPrice')?.setValue(active.unitPrice || 0);
    }
    this.toggleControlsForInventory(product.isMultipleInventory);
    this.showModal = true;
  }

  toggleControlsForInventory(isMultiple: boolean) {
    if (isMultiple) {
      this.productForm.get('totalStock')?.disable({ emitEvent: false });
      this.productForm.get('sellingPrice')?.disable({ emitEvent: false });
    } else {
      this.productForm.get('totalStock')?.enable({ emitEvent: false });
      this.productForm.get('sellingPrice')?.enable({ emitEvent: false });
    }
  }

  openInventoryModal(product: Product): void {
    this.selectedProduct = product;
    this.inventoryForm.reset();
    this.inventoryForm.patchValue({
      receivedAt: new Date().toISOString().split('T')[0]
    });
    this.showInventoryModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedProduct = null;
    this.productForm.reset();
  }

  closeInventoryModal(): void {
    this.showInventoryModal = false;
    this.selectedProduct = null;
    this.inventoryForm.reset();
  }

  async submitProduct(): Promise<void> {
    if (this.productForm.invalid) return;

    this.loading = true;
    try {
      const formValue = this.productForm.value;
      // normalize sellingPrice to avoid undefined being written to Firestore
      const computedSellingPrice = formValue.isMultipleInventory
        ? (formValue.initialUnitPrice || (this.selectedProduct ? (this.selectedProduct.inventory || []).find((b: any) => b.status === 'active')?.unitPrice : 0) || 0)
        : (formValue.sellingPrice ?? 0);

      if (this.isEditMode && this.selectedProduct) {
        // Update existing product
        const updates: Partial<Product> = {
          productName: formValue.productName,
          skuId: formValue.skuId,
          category: formValue.category,
          sellingPrice: computedSellingPrice,
          storeId: formValue.storeId,
          barcodeId: formValue.barcodeId,
          qrCode: formValue.qrCode,
          imageUrl: formValue.imageUrl,
          isMultipleInventory: formValue.isMultipleInventory
        };

        // compute totalStock for multiple inventory from active batches
        if (formValue.isMultipleInventory && this.selectedProduct?.inventory) {
          const total = this.selectedProduct.inventory.reduce((s, b) => s + ((b.status === 'active') ? (b.quantity || 0) : 0), 0);
          updates.totalStock = total;
        } else {
          updates.totalStock = formValue.totalStock || 0;
        }

        await this.productService.updateProduct(this.selectedProduct.id!, updates);
        } else {
        // Create new product
        let inventory: ProductInventory[] = [];
        let totalStock = 0;
        if (formValue.isMultipleInventory) {
          const initialInventory: ProductInventory = {
            batchId: formValue.initialBatchId || `BATCH-${Date.now()}`,
            quantity: formValue.initialQuantity || 0,
            unitPrice: formValue.initialUnitPrice || 0,
            receivedAt: new Date(formValue.initialReceivedAt),
            status: 'active'
          };
          inventory = [initialInventory];
          totalStock = initialInventory.quantity;
        } else {
          // single inventory: use totalStock from form
          totalStock = formValue.totalStock || 0;
        }

        const newProduct: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> = {
          productName: formValue.productName,
          skuId: formValue.skuId,
          category: formValue.category,
          sellingPrice: computedSellingPrice,
          companyId: '', // Will be set by service
          storeId: formValue.storeId,
          isMultipleInventory: formValue.isMultipleInventory,
          barcodeId: formValue.barcodeId,
          qrCode: formValue.qrCode,
          imageUrl: formValue.imageUrl,
          inventory,
          totalStock,
          
          // Tax and Discount Fields with defaults
          isVatApplicable: false,
          vatRate: 0,
          hasDiscount: false,
          discountType: 'percentage',
          discountValue: 0,
          
          status: 'active'
        };

        await this.productService.createProduct(newProduct);
      }

      this.closeModal();
      this.filterProducts();
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Error saving product. Please try again.');
    } finally {
      this.loading = false;
    }
  }

  async addInventoryBatch(): Promise<void> {
    if (this.inventoryForm.invalid || !this.selectedProduct) return;

    try {
      const formValue = this.inventoryForm.value;
      const newBatch: ProductInventory = {
        batchId: formValue.batchId,
        quantity: formValue.quantity,
        unitPrice: formValue.unitPrice,
        receivedAt: new Date(formValue.receivedAt),
        status: 'active'
      };

      await this.productService.addInventoryBatch(this.selectedProduct.id!, newBatch);
      this.inventoryForm.reset();
      this.inventoryForm.patchValue({
        receivedAt: new Date().toISOString().split('T')[0]
      });
      
      // Refresh the selected product
      this.selectedProduct = this.productService.getProduct(this.selectedProduct.id!) || null;
    } catch (error) {
      console.error('Error adding inventory batch:', error);
      alert('Error adding inventory batch. Please try again.');
    }
  }

  async removeInventoryBatch(batchId: string): Promise<void> {
    if (!this.selectedProduct || !confirm('Are you sure you want to remove this inventory batch?')) return;

    try {
      await this.productService.removeInventoryBatch(this.selectedProduct.id!, batchId);
      // Refresh the selected product
      this.selectedProduct = this.productService.getProduct(this.selectedProduct.id!) || null;
    } catch (error) {
      console.error('Error removing inventory batch:', error);
      alert('Error removing inventory batch. Please try again.');
    }
  }

  showAddBatchFromInventory(): void {
    // open the inventory add section by focusing the batch form — we reuse inventoryForm
    // scroll into view or focus the first input (best-effort)
    setTimeout(() => {
      const el = document.getElementById('batchId');
      el?.focus();
    }, 100);
  }

  async setActiveBatch(batchId: string, active: boolean): Promise<void> {
    if (!this.selectedProduct) return;
    try {
      const product = this.productService.getProduct(this.selectedProduct.id!);
      if (!product) return;

      const updatedInventory = product.inventory.map(inv => ({
        ...inv,
        status: inv.batchId === batchId ? (active ? 'active' : 'inactive') : (active ? 'inactive' : inv.status)
      }));

      // Enforce only one active batch: if active=true set others inactive
      if (active) {
        for (const inv of updatedInventory) {
          if (inv.batchId !== batchId) inv.status = 'inactive';
        }
      }

      // compute totalStock from active batches only
      const totalStock = updatedInventory.reduce((s, b) => s + ((b.status === 'active') ? (b.quantity || 0) : 0), 0);

      await this.productService.updateProduct(product.id!, { inventory: updatedInventory, totalStock });
      // refresh selectedProduct
      this.selectedProduct = this.productService.getProduct(product.id!) || null;
    } catch (err) {
      console.error(err);
      alert('Failed to set active batch');
    }
  }

  triggerImageUpload(): void {
    const el = document.getElementById('hiddenImageFile') as HTMLInputElement | null;
    el?.click();
  }

  async onImageFileChange(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    try {
      const compressed = await this.compressImage(file, 1024 * 1024);
      const url = await this.uploadFileToStorage(compressed);
      this.productForm.get('imageUrl')?.setValue(url);
    } catch (err) {
      console.error(err);
      alert('Image compression or upload failed. Please upload a smaller image.');
    }
  }

  async compressImage(file: File, maxBytes: number): Promise<File> {
    const img = await this.loadImage(URL.createObjectURL(file));
    const targetInches = 2;
    const dpi = 96;
    const targetPx = Math.round(targetInches * dpi);

    const canvas = document.createElement('canvas');
    canvas.width = targetPx;
    canvas.height = targetPx;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    for (let q = 0.9; q >= 0.4; q -= 0.1) {
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', q));
      if (!blob) continue;
      if (blob.size <= maxBytes) return new File([blob], file.name, { type: 'image/jpeg' });
    }

    canvas.width = Math.round(targetPx / 1.5);
    canvas.height = Math.round(targetPx / 1.5);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.7));
    if (!blob) throw new Error('Compression failed');
    if (blob.size > maxBytes) throw new Error('Too large');
    return new File([blob], file.name, { type: 'image/jpeg' });
  }

  loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = src;
    });
  }

  async uploadFileToStorage(file: File): Promise<string> {
    // use firebase storage via firebase.config (getStorage/app already available in other components)
    // dynamic import to avoid top-level SDK usage here
    const { getStorage, ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
  const { app } = await import('../../../firebase.config');
    const storage = getStorage(app);
    const storageRef = ref(storage, `products/${Date.now()}_${file.name}`);
    const snap = await uploadBytes(storageRef, file);
    const url = await getDownloadURL(snap.ref);
    return url;
  }

  async deleteProduct(product: Product): Promise<void> {
    if (!confirm(`Are you sure you want to delete "${product.productName}"?`)) return;

    try {
      await this.productService.deleteProduct(product.id!);
      this.filterProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Error deleting product. Please try again.');
    }
  }

  // Utility methods
  clearSearch(): void {
    this.searchTerm = '';
    this.selectedCategory = '';
    this.selectedStore = '';
    this.filterProducts();
  }

  async refreshProducts(): Promise<void> {
    try {
      this.loading = true;
      await this.productService.loadProducts();
      this.filterProducts();
    } catch (error) {
      console.error('Error refreshing products:', error);
    } finally {
      this.loading = false;
    }
  }

  getStoreName(storeId: string): string {
    const store = this.stores().find(s => s.id === storeId);
    return store?.storeName || 'Unknown Store';
  }

  getStockBadgeClass(stock: number): string {
    if (stock <= 5) return 'px-2 py-1 text-xs rounded-full bg-red-100 text-red-800';
    if (stock <= 10) return 'px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-800';
    return 'px-2 py-1 text-xs rounded-full bg-green-100 text-green-800';
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'active':
        return 'px-2 py-1 text-xs rounded-full bg-green-100 text-green-800';
      case 'inactive':
        return 'px-2 py-1 text-xs rounded-full bg-red-100 text-red-800';
      case 'expired':
        return 'px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800';
      default:
        return 'px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800';
    }
  }

  displayPrice(product: Product): number {
    if (product.isMultipleInventory && product.inventory && product.inventory.length) {
      const active = product.inventory.find(b => b.status === 'active');
      if (active) return active.unitPrice || product.sellingPrice;
    }
    return product.sellingPrice;
  }
}
