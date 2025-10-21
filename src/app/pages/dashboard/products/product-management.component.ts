import { Component, OnInit, computed, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Product, ProductInventory } from '../../../interfaces/product.interface';
import { ProductInventoryEntry } from '../../../interfaces/product-inventory-entry.interface';
import { ProductService } from '../../../services/product.service';
import { StoreService } from '../../../services/store.service';

import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../shared/services/toast.service';
import { ErrorMessages } from '../../../shared/enums';
import { CategoryService, ProductCategory } from '../../../services/category.service';
import { InventoryDataService } from '../../../services/inventory-data.service';
import { PredefinedTypesService, UnitTypeOption, PredefinedType } from '../../../services/predefined-types.service';
import { ConfirmationDialogComponent, ConfirmationDialogData } from '../../../shared/components/confirmation-dialog/confirmation-dialog.component';

@Component({
  selector: 'app-product-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ConfirmationDialogComponent],
  styles: [
    `
    .products-management { 
      padding: 0; 
      min-height: 100vh; 
      background: #f8fafc; 
    }

    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .btn-secondary {
      background: #e2e8f0;
      color: #4a5568;
    }

    .btn-secondary:hover:not(:disabled) {
      background: #cbd5e0;
      transform: translateY(-1px);
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

    .filters-section {
      max-width: 1200px;
      margin: 0 auto 2rem auto;
      padding: 0 1rem;
    }

    .search-container {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      max-width: 100%;
      flex-wrap: wrap;
    }

    .search-input {
      flex: 1;
      min-width: 200px;
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

    .filter-select {
      padding: 0.75rem;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 1rem;
      background: white;
      min-width: 150px;
    }

    .filter-select:focus {
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
      color: #4a5568;
      font-weight: 500;
    }

    .product-price-cell {
      color: #2d3748;
      font-weight: 600;
    }

    .product-store-cell {
      color: #718096;
    }

    .actions-cell {
      text-align: center;
    }

    .action-buttons {
      display: flex;
      gap: 0.5rem;
      justify-content: center;
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

    /* Tab Navigation Styles */
    .tab-navigation {
      display: flex;
      gap: 0;
      background: white;
      border-radius: 12px;
      padding: 0.5rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      margin-bottom: 1.5rem;
    }

    .tab-button {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.875rem 1.5rem;
      background: transparent;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.9rem;
      color: #6b7280;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .tab-button:hover {
      background: #f3f4f6;
      color: #374151;
    }

    .tab-button.active {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
    }

    .tab-icon {
      width: 1.25rem;
      height: 1.25rem;
    }

    /* Search Section */
    .search-section {
      margin-bottom: 1.5rem;
    }

    .search-section .search-input {
      width: 100%;
      padding: 0.75rem 1rem;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-size: 0.875rem;
      color: #374151;
      background: white;
      transition: all 0.2s ease;
    }

    .search-section .search-input:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    /* Tab Content */
    .tab-content {
      min-height: 300px;
    }

    /* Inventory Table Styles */
    .inventory-table-container {
      background: white;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
    }

    .inventory-table {
      width: 100%;
      border-collapse: collapse;
    }

    .inventory-table th,
    .inventory-table td {
      padding: 0.875rem 1rem;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }

    .inventory-table th {
      background: #f8fafc;
      font-weight: 600;
      color: #374151;
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.025em;
    }

    .inventory-row {
      cursor: pointer;
      transition: background-color 0.2s ease;
    }

    .inventory-row:hover {
      background: #f8fafc;
    }

    .batch-id-cell {
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 0.875rem;
      color: #059669;
      font-weight: 600;
    }

    .quantity-cell {
      font-weight: 500;
      color: #374151;
    }

    .price-cell {
      font-weight: 600;
      color: #059669;
    }

    .date-cell {
      color: #6b7280;
      font-size: 0.875rem;
    }

    .status-cell .status-badge {
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

    /* Empty Inventory State */
    .empty-inventory {
      text-align: center;
      padding: 3rem 1.5rem;
      color: #6b7280;
    }

    .empty-content {
      max-width: 300px;
      margin: 0 auto;
    }

    .empty-icon {
      width: 3rem;
      height: 3rem;
      margin: 0 auto 1rem auto;
      color: #9ca3af;
    }

    .empty-content h3 {
      margin: 0 0 0.5rem 0;
      font-size: 1.125rem;
      font-weight: 600;
      color: #374151;
    }

    .empty-content p {
      margin: 0 0 1.5rem 0;
      font-size: 0.875rem;
      color: #6b7280;
    }

    /* Form Card Styles */
    .form-card {
      background: white;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
    }

    .form-header {
      padding: 1.5rem;
      border-bottom: 1px solid #e2e8f0;
      background: #f8fafc;
    }

    .form-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: #374151;
      margin: 0 0 0.5rem 0;
    }

    .form-subtitle {
      color: #6b7280;
      font-size: 0.875rem;
      margin: 0;
    }

    .inventory-form {
      padding: 1.5rem;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
      margin-bottom: 2rem;
    }

    @media (max-width: 768px) {
      .form-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 480px) {
      .form-grid {
        grid-template-columns: 1fr;
      }
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 1rem;
      padding-top: 1rem;
      border-top: 1px solid #e2e8f0;
    }

    .loading-spinner {
      width: 1rem;
      height: 1rem;
      border: 2px solid transparent;
      border-top-color: currentColor;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-right: 0.5rem;
    }

    /* Batch ID Display */
    .batch-id-display {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 0.75rem 1rem;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 0.875rem;
      color: #059669;
      font-weight: 600;
      letter-spacing: 0.025em;
    }

    .modal-overlay {
      position: fixed !important;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9000 !important;
      backdrop-filter: blur(2px);
      padding: 1rem;
    }

    .inventory-modal-overlay {
      z-index: 8000 !important;
    }

    .modal {
      background: white;
      border-radius: 12px;
      width: 90%;
      max-width: 600px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    }

    .modal.store-modal { 
      background: #fff; 
      border-radius: 12px; 
    }

    .modal-header { 
      padding: 1.5rem 2rem;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 12px 12px 0 0;
    }

    .modal-header h3 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
      color: white;
    }

    .close-btn { 
      background: rgba(255, 255, 255, 0.2);
      border: none;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      font-size: 1.5rem;
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      line-height: 1;
    }

    .close-btn:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: scale(1.1);
    }

    .modal-body { 
      padding: 2rem;
      overflow-y: auto;
      flex: 1;
    }

    .form-section {
      margin-bottom: 2rem;
      padding: 1.5rem;
      background: #f9fafb;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }

    .form-section:last-child {
      margin-bottom: 0;
    }

    .section-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 1rem;
      font-weight: 600;
      color: #374151;
      margin: 0 0 1rem 0;
      padding-bottom: 0.75rem;
      border-bottom: 2px solid #e5e7eb;
    }

    .section-title span:first-child {
      font-size: 1.25rem;
    }

    .form-group {
      margin-bottom: 1rem;
    }

    .form-group:last-child {
      margin-bottom: 0;
    }

    .form-group label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
      color: #6b7280;
      font-size: 0.875rem;
    }

    .form-input,
    .form-select,
    .form-textarea {
      width: 100%;
      max-width: 100%;
      padding: 0.75rem 1rem;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 500;
      color: #1f2937;
      background: white;
      transition: all 0.2s ease;
      box-sizing: border-box;
    }

    .form-input:focus,
    .form-select:focus,
    .form-textarea:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .error-message {
      margin-top: 0.5rem;
      font-size: 0.875rem;
      color: #ef4444;
      font-weight: 500;
    }

    .modal-footer {
      padding: 1.5rem 2rem;
      border-top: 1px solid #e5e7eb;
      display: flex;
      justify-content: flex-end;
      gap: 1rem;
      background: #f9fafb;
      border-radius: 0 0 12px 12px;
    }

    .modal-footer .btn {
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      border: none;
    }

    .modal-footer .btn-secondary {
      background: #f1f5f9;
      color: #64748b;
      border: 1px solid #e2e8f0;
    }

    .modal-footer .btn-secondary:hover {
      background: #e2e8f0;
      transform: translateY(-1px);
    }

    .modal-footer .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
    }

    .modal-footer .btn-primary:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .modal-footer .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    /* Ensure confirmation dialog appears above modals */
    ::ng-deep app-confirmation-dialog {
      z-index: 99999 !important;
    }

    ::ng-deep app-confirmation-dialog .modal-overlay {
      z-index: 99999 !important;
    }

    ::ng-deep app-confirmation-dialog .modal {
      z-index: 100000 !important;
    }

    @media (max-width: 768px) {
      .modal {
        width: 95%;
        max-height: 95vh;
      }

      .modal-header {
        padding: 1rem 1.5rem;
      }

      .modal-body {
        padding: 1rem;
      }

      .form-section {
        padding: 1rem;
      }

      .modal-footer {
        padding: 1rem 1.5rem;
      }
    }
    `
  ],
  template: `
    <div class="products-management">
      <!-- Header -->
      <div class="header">
        <div class="header-content">
          <div class="header-text">
            <h1 class="page-title">Product Management</h1>
            <p class="page-subtitle">Manage your product catalog and inventory</p>
          </div>
          <div class="header-actions">
            <button class="btn btn-primary" (click)="openAddModal()">📦 Add New Product</button>
          </div>
        </div>
      </div>

      <!-- Search and Filters -->
      <div class="filters-section">
        <div class="search-container">
          <input 
            type="text" 
            [(ngModel)]="searchTerm"
            (ngModelChange)="filterProducts()"
            placeholder="Search products by name, SKU, or category..."
            class="search-input">
          <select 
            [(ngModel)]="selectedCategory" 
            (change)="filterProducts()" 
            class="filter-select">
            <option value="">All Categories</option>
            <option *ngFor="let category of categories()" [value]="category">{{ category }}</option>
          </select>
          <select 
            [(ngModel)]="selectedStore" 
            (change)="filterProducts()" 
            class="filter-select">
            <option value="">All Stores</option>
            <option *ngFor="let store of stores()" [value]="store.id">{{ store.storeName }}</option>
          </select>
          <button class="btn btn-secondary" (click)="clearSearch()">Clear</button>
        </div>
      </div>

      <!-- Products Table -->
      <div class="table-container">
        <div class="table-header">
          <h3>Products ({{ filteredProducts().length }})</h3>
          <button class="btn btn-secondary" (click)="refreshProducts()">Refresh</button>
        </div>

        <div class="table-wrapper" *ngIf="filteredProducts().length > 0">
          <table class="products-table">
            <thead>
              <tr>
                <th>Product Name</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Stock</th>
                <th>Price</th>
                <th>Store</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let product of filteredProducts()">
                <td class="product-name-cell">{{ product.productName }}</td>
                <td class="product-sku-cell">{{ product.skuId }}</td>
                <td class="product-category-cell">{{ product.category }}</td>
                <td class="product-stock-cell">{{ product.totalStock }}</td>
                <td class="product-price-cell">\${{ displayPrice(product).toFixed(2) }}</td>
                <td class="product-store-cell">{{ getStoreName(product.storeId) }}</td>
                <td class="actions-cell">
                  <div class="action-buttons">
                    <button class="btn btn-sm btn-secondary" (click)="openEditModal(product)">Edit</button>
                    <button class="btn btn-sm btn-secondary" (click)="openInventoryModal(product)">Inventory</button>
                    <button class="btn btn-sm btn-danger" (click)="deleteProduct(product)">Delete</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Empty State -->
        <div class="empty-state" *ngIf="filteredProducts().length === 0 && !loading">
          <div class="empty-content">
            <h3>No products found</h3>
            <p *ngIf="searchTerm">No products match your search criteria.</p>
            <p *ngIf="!searchTerm">No products have been added yet.</p>
            <button class="btn btn-primary" (click)="openAddModal()" *ngIf="!searchTerm">📦 Add Your First Product</button>
            <button class="btn btn-secondary" (click)="clearSearch()" *ngIf="searchTerm">Clear Search</button>
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

      <!-- Add/Edit Product Modal -->
      <div class="modal-overlay" 
           *ngIf="showModal" 
           (click)="closeModal()"
           style="position: fixed !important; z-index: 9999 !important; background: rgba(0, 0, 0, 0.8) !important;">
        <div class="modal store-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ isEditMode ? '✏️ Edit Product' : '📦 Add New Product' }}</h3>
            <button class="close-btn" (click)="closeModal()">×</button>
          </div>
          <div class="modal-body">
            <form [formGroup]="productForm" (ngSubmit)="submitProduct()">
              <!-- Basic Information Section -->
              <div class="form-section">
                <h4 class="section-title">
                  <span>📋</span>
                  <span>Basic Information</span>
                </h4>
                
                <div class="form-group">
                  <label for="category">Category</label>
                  <div class="category-input-wrapper" style="display: flex; gap: 8px; align-items: center;">
                    <select 
                      id="category"
                      formControlName="category"
                      class="form-input"
                      style="flex: 1;">
                      <option value="">Select Category</option>
                      <option *ngFor="let category of categories()" [value]="category">{{ category }}</option>
                    </select>
                    <button 
                      type="button" 
                      class="btn btn-sm btn-outline-primary"
                      (click)="openAddCategoryModal()"
                      title="Add new category">
                      <i class="fas fa-plus"></i>
                    </button>
                  </div>
                  <div class="error-message" *ngIf="productForm.get('category')?.invalid && productForm.get('category')?.touched">
                    Category is required
                  </div>
                </div>

                <div class="form-group">
                  <label for="skuId">SKU ID</label>
                  <input 
                    type="text" 
                    id="skuId"
                    formControlName="skuId"
                    placeholder="Enter SKU identifier"
                    class="form-input">
                  <div class="error-message" *ngIf="productForm.get('skuId')?.invalid && productForm.get('skuId')?.touched">
                    SKU ID is required
                  </div>
                </div>

                <div class="form-group">
                  <label for="productCode">Product Code</label>
                  <input 
                    type="text" 
                    id="productCode"
                    formControlName="productCode"
                    placeholder="Enter product code (optional)"
                    class="form-input">
                </div>

                <div class="form-group">
                  <label for="barcodeId">Barcode ID</label>
                  <input 
                    type="text" 
                    id="barcodeId"
                    formControlName="barcodeId"
                    placeholder="Enter barcode identifier (optional)"
                    class="form-input">
                </div>

                <div class="form-group">
                  <label for="productName">Product Name</label>
                  <input 
                    type="text" 
                    id="productName"
                    formControlName="productName"
                    placeholder="Enter product name"
                    class="form-input">
                  <div class="error-message" *ngIf="productForm.get('productName')?.invalid && productForm.get('productName')?.touched">
                    Product name is required
                  </div>
                </div>

                <div class="form-group">
                  <label for="unitType">Unit Type</label>
                  <select 
                    id="unitType"
                    formControlName="unitType"
                    class="form-input">
                    <option *ngFor="let unit of unitTypes" [value]="unit.value">{{ unit.label }}</option>
                  </select>
                  <div class="error-message" *ngIf="productForm.get('unitType')?.invalid && productForm.get('unitType')?.touched">
                    Unit type is required
                  </div>
                </div>

                <!-- Product Image Upload -->
                <div class="form-group">
                  <label for="productImage">Product Image</label>
                  <div class="image-upload-section" style="display: flex; align-items: center; gap: 12px;">
                    <div class="image-preview" style="width: 80px; height: 80px; border: 2px dashed #ddd; border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                      <img 
                        *ngIf="productForm.get('imageUrl')?.value" 
                        [src]="productForm.get('imageUrl')?.value" 
                        alt="Product preview"
                        style="width: 100%; height: 100%; object-fit: cover;">
                      <i *ngIf="!productForm.get('imageUrl')?.value" class="fas fa-image" style="color: #ccc; font-size: 24px;"></i>
                    </div>
                    <button 
                      type="button" 
                      class="btn btn-outline-primary"
                      (click)="triggerImageUpload()"
                      [disabled]="loading">
                      <i *ngIf="!loading" class="fas fa-camera"></i>
                      <i *ngIf="loading" class="fas fa-spinner fa-spin"></i>
                      {{ loading ? 'Uploading...' : 'Upload Image' }}
                    </button>
                    <button 
                      *ngIf="productForm.get('imageUrl')?.value"
                      type="button" 
                      class="btn btn-outline-danger"
                      (click)="productForm.get('imageUrl')?.setValue('')">
                      <i class="fas fa-trash"></i> Remove
                    </button>
                  </div>
                  <input 
                    type="file" 
                    id="hiddenImageFile" 
                    accept="image/*" 
                    (change)="onImageFileChange($event)"
                    style="display: none;">
                </div>

                <div class="form-group">
                  <label for="description">Description</label>
                  <textarea 
                    id="description"
                    formControlName="description"
                    placeholder="Enter product description (optional)"
                    class="form-input"
                    rows="3"></textarea>
                </div>
              </div>

              <!-- Pricing & Inventory Section -->
              <div class="form-section">
                <h4 class="section-title">
                  <span>💲</span>
                  <span>Pricing & Inventory</span>
                </h4>
                
                <div class="form-group">
                  <label for="totalStock">Total Stock</label>
                  <input 
                    type="text" 
                    id="totalStock"
                    [value]="selectedProduct?.totalStock || 0"
                    placeholder="0"
                    class="form-input"
                    readonly
                    style="background-color: #f8f9fa; color: #6c757d;">
                  <small class="text-muted">Calculated from all inventory batches</small>
                </div>

                <div class="form-group">
                  <label for="sellingPrice">Selling Price</label>
                  <input 
                    type="text" 
                    id="sellingPrice"
                    [value]="selectedProduct?.sellingPrice || 0"
                    placeholder="0.00"
                    class="form-input"
                    readonly
                    style="background-color: #f8f9fa; color: #6c757d;">
                  <small class="text-muted">Price from most recent inventory batch</small>
                </div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeModal()">Cancel</button>
            <button 
              class="btn btn-primary" 
              (click)="submitProduct()"
              [disabled]="!productForm.valid || loading">
              {{ loading ? 'Saving...' : (isEditMode ? 'Update Product' : 'Create Product') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Inventory Modal -->
      <div class="modal-overlay inventory-modal-overlay" *ngIf="showInventoryModal">
        <div class="modal store-modal" (click)="$event.stopPropagation()" style="max-width:800px;">
          <div class="modal-header">
            <h3>📦 Inventory Management - {{ selectedProduct?.productName }}</h3>
            <button class="close-btn" (click)="closeInventoryModal()">×</button>
          </div>
          <div class="modal-body">
            <!-- Tab Navigation -->
            <div class="tab-navigation">
              <button 
                class="tab-button"
                [class.active]="inventoryTab === 'list'"
                (click)="inventoryTab='list'">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="tab-icon">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                Inventory List
              </button>
              <button 
                class="tab-button"
                [class.active]="inventoryTab === 'edit'"
                (click)="switchToEditTab()">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="tab-icon">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Edit
              </button>
            </div>

            <!-- Search Bar (only show on list tab) -->
            <div class="search-section" *ngIf="inventoryTab === 'list'">
              <input 
                type="text" 
                class="search-input" 
                placeholder="Search by batch ID or product details..." 
                [(ngModel)]="inventorySearch" 
                (ngModelChange)="filterInventory()" />
            </div>

            <!-- List Tab Content -->
            <div class="tab-content" *ngIf="inventoryTab==='list'">
              <div class="inventory-table-container" *ngIf="filteredInventory && filteredInventory.length>0">
                <table class="inventory-table">
                  <thead>
                    <tr>
                      <th>Batch ID</th>
                      <th>Quantity</th>
                      <th>Unit Price</th>
                      <th>Received Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let batch of filteredInventory; let i = index" (click)="openEditBatch(batch)" class="inventory-row">
                      <td class="batch-id-cell">{{ batch.batchId }}</td>
                      <td class="quantity-cell">{{ batch.quantity }}</td>
                      <td class="price-cell">\${{ batch.unitPrice.toFixed(2) }}</td>
                      <td class="date-cell">{{ batch.receivedAt | date:'short' }}</td>
                      <td class="status-cell">
                        <span class="status-badge" [class]="'status-' + batch.status">
                          {{ batch.status | titlecase }}
                        </span>
                      </td>
                      <td class="actions-cell">
                        <!-- Edit button only for the most recent (first) item -->
                        <button 
                          *ngIf="i === 0"
                          class="btn btn-sm btn-primary me-2" 
                          (click)="$event.stopPropagation(); openEditBatch(batch)"
                          title="Edit quantity and price">
                          ✏️ Edit
                        </button>
                        <!-- Remove button only for the most recent (first) item -->
                        <button 
                          *ngIf="i === 0 && batch.id"
                          class="btn btn-sm btn-danger" 
                          (click)="$event.stopPropagation(); removeInventoryBatch(batch.batchId, batch.id!)"
                          title="Remove batch">
                          🗑️ Remove
                        </button>
                        <!-- Show disabled state for older items -->
                        <span *ngIf="i > 0" class="text-muted small">
                          (Previous batch)
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <div class="empty-inventory" *ngIf="!filteredInventory || filteredInventory.length===0">
                <div class="empty-content">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="empty-icon">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <h3>No inventory batches found</h3>
                  <p>This product doesn't have any inventory batches yet.</p>
                  <button class="btn btn-primary" (click)="switchToEditTab()">
                    Add New Batch
                  </button>
                </div>
              </div>
            </div>

            <!-- Add/Edit Tab Content -->
            <div class="tab-content" *ngIf="inventoryTab==='edit'">
              <div class="form-card">
                <div class="form-header">
                  <h4 class="form-title">{{ isEditingBatch ? 'Edit Batch' : 'Add New Batch' }}</h4>
                  <p class="form-subtitle">{{ isEditingBatch ? 'Update inventory batch details' : 'Add new inventory to your product stock' }}</p>
                </div>
                
                <form [formGroup]="inventoryForm" (ngSubmit)="saveBatch()" class="inventory-form">
                  <div class="form-grid">
                    <div class="form-group">
                      <label for="quantity" class="form-label">Quantity *</label>
                      <input 
                        type="number" 
                        id="quantity"
                        class="form-input" 
                        formControlName="quantity" 
                        placeholder="0"
                        min="1"
                        [class.error]="inventoryForm.get('quantity')?.invalid && inventoryForm.get('quantity')?.touched" />
                      <div class="error-message" *ngIf="inventoryForm.get('quantity')?.invalid && inventoryForm.get('quantity')?.touched">
                        Quantity must be at least 1
                      </div>
                    </div>
                    
                    <div class="form-group">
                      <label for="costPrice" class="form-label">Cost Price</label>
                      <input 
                        type="number" 
                        id="costPrice"
                        step="0.01" 
                        class="form-input" 
                        formControlName="costPrice" 
                        placeholder="0.00"
                        min="0" />
                    </div>
                    
                    <div class="form-group">
                      <label for="unitPrice" class="form-label">Unit Price *</label>
                      <input 
                        type="number" 
                        id="unitPrice"
                        step="0.01" 
                        class="form-input" 
                        formControlName="unitPrice" 
                        placeholder="0.00"
                        min="0"
                        [class.error]="inventoryForm.get('unitPrice')?.invalid && inventoryForm.get('unitPrice')?.touched" />
                      <div class="error-message" *ngIf="inventoryForm.get('unitPrice')?.invalid && inventoryForm.get('unitPrice')?.touched">
                        Unit price is required
                      </div>
                    </div>
                    
                    <div class="form-group">
                      <label for="receivedAt" class="form-label">Received Date *</label>
                      <input 
                        type="date" 
                        id="receivedAt"
                        class="form-input" 
                        formControlName="receivedAt"
                        [class.error]="inventoryForm.get('receivedAt')?.invalid && inventoryForm.get('receivedAt')?.touched" />
                      <div class="error-message" *ngIf="inventoryForm.get('receivedAt')?.invalid && inventoryForm.get('receivedAt')?.touched">
                        Received date is required
                      </div>
                    </div>
                  </div>
                  
                  <div class="form-actions">
                    <button type="button" class="btn btn-secondary" (click)="cancelEdit()">
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      class="btn btn-primary" 
                      [disabled]="inventoryForm.invalid || loading">
                      <span *ngIf="loading" class="loading-spinner"></span>
                      {{ loading ? 'Saving...' : 'Save' }}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Confirmation dialog placeholder -->
      <app-confirmation-dialog 
        *ngIf="showDeleteConfirmation() && deleteConfirmationData()" 
        [dialogData]="deleteConfirmationData()!" 
        (confirmed)="onDeleteConfirmed()" 
        (cancelled)="closeDeleteConfirmation()">
      </app-confirmation-dialog>
    </div>
  `
})
export class ProductManagementComponent implements OnInit {
  // Signals
  readonly products = computed(() => this.productService.getProducts());
  readonly stores = computed(() => this.storeService.getStores());
  readonly categories = computed(() => this.categoryService.getCategoryLabels());

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
  // Inventory UI state
  inventoryTab: 'list' | 'edit' = 'list';
  inventorySearch = '';
  filteredInventory: ProductInventoryEntry[] | null = null;
  private currentBatches: ProductInventoryEntry[] = [];
  private editingBatchDocId: string | null = null;
  isEditingBatch = false;
  editingBatchOriginalId: string | null = null;
  generatedBatchId = '';

  // Confirmation dialog state
  showDeleteConfirmation = signal<boolean>(false);
  deleteConfirmationData = signal<ConfirmationDialogData | null>(null);
  productToDelete: Product | null = null;
  pendingBatchId: string | null = null;
  pendingBatchDocId: string | null = null;
  pendingNewBatchConfirmation: ((value: boolean) => void) | null = null;

  // Modal mode management
  modalMode: 'product' | 'category' = 'product';
  get isProductMode(): boolean { return this.modalMode === 'product'; }
  get isCategoryMode(): boolean { return this.modalMode === 'category'; }
  get modalTitle(): string { 
    return this.modalMode === 'product' ? 'Add New Product' : 'Add New Category';
  }

  // Forms
  productForm: FormGroup;
  inventoryForm: FormGroup;
  categoryForm: FormGroup;
  
  // Unit types from predefined types
  unitTypes: UnitTypeOption[] = []; // Will be loaded from predefinedTypes

  constructor(
    public productService: ProductService,
    private storeService: StoreService,
    private authService: AuthService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private toastService: ToastService,
    private categoryService: CategoryService,
    private inventoryDataService: InventoryDataService,
    private predefinedTypesService: PredefinedTypesService
  ) {
    this.productForm = this.createProductForm();
    this.inventoryForm = this.createInventoryForm();
    this.categoryForm = this.createCategoryForm();
    
    // Subscribe to initial quantity changes to update total stock for new products
    const initialQuantityCtrl = this.productForm.get('initialQuantity');
    if (initialQuantityCtrl) {
      initialQuantityCtrl.valueChanges.subscribe(quantity => {
        if (!this.selectedProduct) {
          // For new products, update total stock
          this.productForm.get('totalStock')?.setValue(quantity || 0, { emitEvent: false });
        }
      });
    }
  }

  async ngOnInit(): Promise<void> {
    try {
      const currentPermission = this.authService.getCurrentPermission();
      if (currentPermission?.companyId) {
        await this.storeService.loadStoresByCompany(currentPermission.companyId);
        await this.productService.loadProducts(currentPermission.companyId);
        await this.loadCategories(); // Load categories from CategoryService
      } else {
        // Creator account, no companyId or stores yet, allow empty arrays for onboarding
        this.storeService['storesSignal']?.set([]); // Use bracket notation to bypass private
        if (this.productService['products'] && typeof this.productService['products'].set === 'function') {
          this.productService['products'].set([]);
        }
      }
      
      // Load unit types from predefined types
      await this.loadUnitTypes();
      
      this.filterProducts();
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  private createProductForm(): FormGroup {
    return this.fb.group({
      productName: ['', Validators.required],
      description: [''],
      skuId: ['', Validators.required],
      productCode: [''],
      barcodeId: [''],
      unitType: ['pieces', Validators.required],
      // Default to 'General' so the form is valid even if categories haven't loaded yet
      category: ['General', Validators.required],
      imageUrl: [''],
      // Tax and Discount Fields
      isVatApplicable: [true],
      vatRate: [12.0, [Validators.min(0), Validators.max(100)]],
      hasDiscount: [true],
      discountType: ['percentage'],
      discountValue: [10.0, [Validators.min(0)]],
      // Initial inventory fields (for new products)
      initialBatchId: [''],
      initialQuantity: [0, Validators.min(0)],
      initialUnitPrice: [0, Validators.min(0)],
      initialCostPrice: [0, Validators.min(0)],
      initialReceivedAt: [new Date().toISOString().split('T')[0]],
      initialExpiryDate: [''],
      initialSupplier: ['']
    });
  }

  private createInventoryForm(): FormGroup {
    return this.fb.group({
      quantity: [0, [Validators.required, Validators.min(1)]],
      unitPrice: [0, [Validators.required, Validators.min(0)]],
      costPrice: [0, [Validators.required, Validators.min(0)]],
      receivedAt: [new Date().toISOString().split('T')[0], Validators.required],
      expiryDate: [''],
      supplier: ['']
    });
  }

  /**
   * Generates a batch ID using the format: 25MMDD######
   * Where 25 = year 2025, MM = month, DD = day, ###### = 6 random digits
   */
  private generateBatchId(): string {
    const now = new Date();
    const year = '25'; // 2025 as 25
    const month = String(now.getMonth() + 1).padStart(2, '0'); // 01-12
    const day = String(now.getDate()).padStart(2, '0'); // 01-31
    
    // Generate 6 random digits
    const randomSuffix = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    
    return `${year}${month}${day}${randomSuffix}`;
  }

  private createCategoryForm(): FormGroup {
    return this.fb.group({
      categoryLabel: ['', Validators.required],
      categoryDescription: [''],
      categoryGroup: ['General'] // Default to 'General'
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
    // Ensure required defaults after reset
    this.productForm.patchValue({
      unitType: 'pieces',
      category: 'General'
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
    
    // Use denormalized totalStock from product (no longer calculate from embedded inventory)
    this.productForm.get('totalStock')?.setValue(product.totalStock || 0);
    
    // Set selling price from product summary (denormalized)
    this.productForm.get('sellingPrice')?.setValue(product.sellingPrice || 0);
    
    // Always enable inventory controls since we removed isMultipleInventory
    this.toggleControlsForInventory(true);
    this.showModal = true;
  }

  toggleControlsForInventory(isMultiple: boolean) {
    if (isMultiple) {
      this.productForm.get('totalStock')?.disable({ emitEvent: false });
      this.productForm.get('sellingPrice')?.disable({ emitEvent: false });
      // Calculate total stock from inventory when switching to multiple inventory mode
      this.updateTotalStockFromInventory();
    } else {
      this.productForm.get('totalStock')?.enable({ emitEvent: false });
      this.productForm.get('sellingPrice')?.enable({ emitEvent: false });
    }
  }

  updateTotalStockFromInventory() {
    if (this.selectedProduct) {
      // For existing product, use denormalized totalStock summary
      this.productForm.get('totalStock')?.setValue(this.selectedProduct.totalStock || 0, { emitEvent: false });
    } else {
      // For new product, use initial inventory values
      const initialQuantity = this.productForm.get('initialQuantity')?.value || 0;
      this.productForm.get('totalStock')?.setValue(initialQuantity, { emitEvent: false });
    }
  }

  switchToEditTab(): void {
    this.inventoryTab = 'edit';
    this.generatedBatchId = this.generateBatchId(); // Generate new ID when switching to edit tab
    this.isEditingBatch = false; // Ensure it's in add mode, not edit mode
    this.editingBatchOriginalId = null;
    this.editingBatchDocId = null;
    
    // Reset form for new batch
    this.inventoryForm.reset();
    this.inventoryForm.patchValue({
      receivedAt: new Date().toISOString().split('T')[0]
    });
  }

  async openInventoryModal(product: Product): Promise<void> {
    this.selectedProduct = product;
    this.inventoryForm.reset();
    this.inventoryForm.patchValue({
      receivedAt: new Date().toISOString().split('T')[0]
    });
    this.generatedBatchId = this.generateBatchId();
    this.inventoryTab = 'list';
    this.inventorySearch = '';
    try {
      this.currentBatches = await this.inventoryDataService.listBatches(product.id!);
      this.filteredInventory = this.currentBatches.slice();
    } catch (e) {
      console.error('Failed to load inventory batches:', e);
      this.filteredInventory = [];
    }
    this.isEditingBatch = false;
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
      const rawFormValue = this.productForm.value;
      
      // Clean undefined values before processing
      const formValue = this.cleanFormData(rawFormValue);
      console.log('🔍 Raw form value:', rawFormValue);
      console.log('🔍 Cleaned form value:', formValue);
      console.log('🔍 Category from form:', formValue.category);
      
      // Get storeId and companyId from current permission since Store section was removed
      const currentUser = this.authService.currentUser();
      const currentPermission = this.authService.getCurrentPermission();
      const companyId = currentPermission?.companyId || 
                       currentUser?.currentCompanyId || 
                       currentUser?.permissions?.[0]?.companyId || '';
      const storeId = currentPermission?.storeId || 
                     currentUser?.permissions?.[0]?.storeId || '';
      
      console.log('🔍 Company ID:', companyId);
      console.log('🔍 Store ID:', storeId);
      
      // Validate required fields
      if (!companyId) {
        throw new Error('Company ID is required but not found in user permissions');
      }
      if (!storeId) {
        throw new Error('Store ID is required but not found in user permissions');
      }
      
      console.log('🔍 Will save category?', !!(formValue.category && storeId));
      
      if (formValue.category && storeId) {
        console.log('🚀 Attempting to save category:', formValue.category, 'for store:', storeId);
        console.log('🔍 CategoryService debug before save:');
        this.categoryService.debugCategoryStatus();
        await this.categoryService.ensureCategoryExists(formValue.category, storeId);
        console.log('✅ Category save completed');
        console.log('🔍 CategoryService debug after save:');
        this.categoryService.debugCategoryStatus();
      }
      
      // normalize sellingPrice to avoid undefined being written to Firestore
      // Calculate selling price from active batch or form value
      const computedSellingPrice = formValue.initialUnitPrice || 
        (this.selectedProduct ? (this.selectedProduct.sellingPrice || 0) : 0) || 
        formValue.sellingPrice || 0;

      if (this.isEditMode && this.selectedProduct) {
        // Update existing product
        const updates: Partial<Product> = {
          productName: formValue.productName,
          description: formValue.description,
          skuId: formValue.skuId,
          productCode: formValue.productCode,
          unitType: formValue.unitType,
          category: formValue.category,
          sellingPrice: computedSellingPrice,
          storeId: storeId,  // Use storeId from permission
          barcodeId: formValue.barcodeId,
          imageUrl: formValue.imageUrl,
          // Tax and Discount Fields
          isVatApplicable: formValue.isVatApplicable || false,
          vatRate: formValue.vatRate || 0,
          hasDiscount: formValue.hasDiscount || false,
          discountType: formValue.discountType || 'percentage',
          discountValue: formValue.discountValue || 0
        };

        // Use denormalized totalStock from product for existing items
        updates.totalStock = this.selectedProduct.totalStock || 0;

        await this.productService.updateProduct(this.selectedProduct.id!, updates);
        } else {
        // Create new product (no embedded inventory)
        const hasInitial = !!(formValue.initialQuantity && formValue.initialQuantity > 0);
        const initialBatch = hasInitial ? {
          batchId: formValue.initialBatchId || `BATCH-${Date.now()}`,
          quantity: Number(formValue.initialQuantity || 0),
          unitPrice: Number(formValue.initialUnitPrice || 0),
          costPrice: Number(formValue.initialCostPrice || 0),
          receivedAt: new Date(formValue.initialReceivedAt),
          expiryDate: formValue.initialExpiryDate ? new Date(formValue.initialExpiryDate) : undefined,
          supplier: formValue.initialSupplier || undefined,
          status: 'active' as const
        } : null;

        // Get current user for UID
        const currentUser = this.authService.getCurrentUser();
        if (!currentUser) {
          throw new Error('User not authenticated');
        }

        const newProduct: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> = {
          uid: currentUser.uid,  // Add UID for security rules
          productName: formValue.productName,
          description: formValue.description,
          skuId: formValue.skuId,
          productCode: formValue.productCode,
          unitType: formValue.unitType,
          category: formValue.category,
          sellingPrice: computedSellingPrice,
          companyId: '', // Will be set by service
          storeId: storeId,  // Use storeId from permission
          barcodeId: formValue.barcodeId,
          imageUrl: formValue.imageUrl,
          inventory: [],
          totalStock: hasInitial ? Number(formValue.initialQuantity || 0) : Number(formValue.totalStock || 0),
          
          // Tax and Discount Fields from form
          isVatApplicable: formValue.isVatApplicable || false,
          vatRate: formValue.vatRate || 0,
          hasDiscount: formValue.hasDiscount || false,
          discountType: formValue.discountType || 'percentage',
          discountValue: formValue.discountValue || 0,
          
          status: 'active'
        };

        const productId = await this.productService.createProduct(newProduct);
        // If initial batch exists, create it in separate collection and recompute summary
        if (hasInitial && productId) {
          await this.inventoryDataService.addBatch(productId, {
            batchId: initialBatch!.batchId,
            quantity: initialBatch!.quantity,
            unitPrice: initialBatch!.unitPrice,
            costPrice: initialBatch!.costPrice,
            receivedAt: initialBatch!.receivedAt,
            expiryDate: initialBatch!.expiryDate,
            supplier: initialBatch!.supplier,
            status: 'active',
            unitType: formValue.unitType || 'pieces',
            companyId: companyId,
            storeId: storeId,
            productId: productId
          });
        }
      }

      this.closeModal();
      this.filterProducts();
    } catch (error) {
      console.error('Error saving product:', error);
      this.toastService.error('Error saving product. Please try again.');
    } finally {
      this.loading = false;
    }
  }

  async addInventoryBatch(): Promise<void> {
    // Deprecated: use saveBatch which handles add & update in the tabbed modal
    return this.saveBatch();
  }

  async removeInventoryBatch(batchId: string, batchDocId: string): Promise<void> {
    if (!this.selectedProduct) return;

    console.log('removeInventoryBatch called for batch:', batchId, batchDocId);

    // Reset everything first
    this.showDeleteConfirmation.set(false);
    this.deleteConfirmationData.set(null);
    this.productToDelete = null;
    this.pendingBatchId = null;
    this.pendingBatchDocId = null;
    
    // Set the data immediately
    this.deleteConfirmationData.set({
      title: 'Remove Inventory Batch',
      message: 'Are you sure you want to remove this inventory batch? This action cannot be undone.',
      confirmText: 'Remove',
      cancelText: 'Cancel',
      type: 'danger'
    });
    
    // Store the batchId and docId for use in confirmation
    this.pendingBatchId = batchId;
    this.pendingBatchDocId = batchDocId;
    
    // Show the dialog immediately
    this.showDeleteConfirmation.set(true);
    
    console.log('Dialog state:', {
      showDeleteConfirmation: this.showDeleteConfirmation(),
      deleteConfirmationData: this.deleteConfirmationData(),
      pendingBatchId: this.pendingBatchId,
      pendingBatchDocId: this.pendingBatchDocId
    });
  }

  async performBatchRemoval(): Promise<void> {
    if (!this.selectedProduct || !this.pendingBatchId || !this.pendingBatchDocId) return;

    try {
      await this.inventoryDataService.removeBatch(this.selectedProduct.id!, this.pendingBatchDocId);
      // Refresh collections
      this.currentBatches = await this.inventoryDataService.listBatches(this.selectedProduct.id!);
      this.filteredInventory = this.currentBatches.slice();
      this.selectedProduct = this.productService.getProduct(this.selectedProduct.id!) || null;
    } catch (error) {
      console.error('Error removing inventory batch:', error);
      this.toastService.error(ErrorMessages.INVENTORY_BATCH_REMOVE_ERROR);
    } finally {
      this.pendingBatchId = null;
      this.pendingBatchDocId = null;
    }
  }

  filterInventory(): void {
    if (!this.selectedProduct) { this.filteredInventory = []; return; }
    const term = (this.inventorySearch || '').toLowerCase();
    const list = this.currentBatches || [];
    if (!term) { this.filteredInventory = list.slice(); return; }
    this.filteredInventory = list.filter(b => (b.batchId || '').toLowerCase().includes(term));
  }

  openEditBatch(batch: ProductInventoryEntry): void {
    if (!this.selectedProduct) return;
    const isLatestBatch = this.currentBatches.length > 0 && this.currentBatches[0].batchId === batch.batchId;
    
    if (!isLatestBatch) {
      this.toastService.error('You can only edit the most recent inventory batch.');
      return;
    }
    
    this.inventoryTab = 'edit';
    this.isEditingBatch = true;
    this.editingBatchOriginalId = batch.batchId || null;
    this.editingBatchDocId = batch.id || null;
    this.inventoryForm.patchValue({
      batchId: batch.batchId,
      quantity: batch.quantity,
      unitPrice: batch.unitPrice,
      costPrice: batch.costPrice || 0,
      receivedAt: batch.receivedAt ? new Date(batch.receivedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      expiryDate: batch.expiryDate ? new Date(batch.expiryDate).toISOString().split('T')[0] : '',
      supplier: batch.supplier || ''
    });
  }

  cancelEdit(): void {
    this.isEditingBatch = false;
    this.inventoryForm.reset();
    this.inventoryForm.patchValue({ receivedAt: new Date().toISOString().split('T')[0] });
    this.generatedBatchId = this.generateBatchId(); // Generate new ID when canceling
    this.inventoryTab = 'list';
    this.editingBatchOriginalId = null;
  }

  async saveBatch(): Promise<void> {
    if (this.inventoryForm.invalid || !this.selectedProduct) return;
    
    this.loading = true;
    
    const formValue = this.inventoryForm.value;
    
    try {
      if (this.isEditingBatch && this.editingBatchOriginalId) {
        // Edit existing batch (only quantity and price allowed)
        if (!this.editingBatchDocId) throw new Error('Missing batch document ID');
        await this.inventoryDataService.updateBatch(this.selectedProduct.id!, this.editingBatchDocId, {
          quantity: Number(formValue.quantity),
          unitPrice: Number(formValue.unitPrice),
          costPrice: Number(formValue.costPrice || 0),
          receivedAt: new Date(formValue.receivedAt),
          expiryDate: formValue.expiryDate ? new Date(formValue.expiryDate) : undefined,
          supplier: formValue.supplier || undefined,
          status: 'active',
          unitType: this.selectedProduct?.unitType || 'pieces'
        });
      } else {
        // Add new batch - check if previous batch has remaining stock
        const latest = this.currentBatches[0];
        if (latest && latest.quantity > 0) {
          const confirmed = await this.confirmNewBatchWithExistingStock();
          if (!confirmed) {
            this.loading = false;
            return;
          }
        }
        await this.inventoryDataService.addBatch(this.selectedProduct.id!, {
          batchId: this.generatedBatchId,
          quantity: Number(formValue.quantity),
          unitPrice: Number(formValue.unitPrice),
          costPrice: Number(formValue.costPrice || 0),
          receivedAt: new Date(formValue.receivedAt),
          expiryDate: formValue.expiryDate ? new Date(formValue.expiryDate) : undefined,
          supplier: formValue.supplier || undefined,
          status: 'active',
          unitType: this.selectedProduct?.unitType || 'pieces',
          companyId: this.selectedProduct.companyId,
          storeId: this.selectedProduct.storeId,
          productId: this.selectedProduct.id!
        });
      }

      // Refresh state and generate new batch ID for next entry
      this.currentBatches = await this.inventoryDataService.listBatches(this.selectedProduct.id!);
      this.filteredInventory = this.currentBatches.slice();
      this.selectedProduct = this.productService.getProduct(this.selectedProduct.id!) || null;
      this.inventoryForm.reset();
      this.inventoryForm.patchValue({ receivedAt: new Date().toISOString().split('T')[0] });
      this.generatedBatchId = this.generateBatchId();
      this.isEditingBatch = false;
      this.inventoryTab = 'list';
      this.editingBatchOriginalId = null;
      this.editingBatchDocId = null;
    } catch (err: any) {
      console.error('Error saving batch:', err);
      
      let errorMessage = 'Error saving inventory batch.';
      if (err?.message) {
        errorMessage += ` Details: ${err.message}`;
      }
      
      this.toastService.error(errorMessage);
    } finally {
      this.loading = false;
    }
  }

  private async confirmNewBatchWithExistingStock(): Promise<boolean> {
    return new Promise((resolve) => {
      // Use the existing confirmation dialog system
      this.deleteConfirmationData.set({
        title: 'Existing Stock Detected',
        message: 'You still have some stock in the previous batch that is not sold. Would you like to add another entry with a new price?',
        confirmText: 'Add New Batch',
        cancelText: 'Cancel'
      });
      
      // Set a flag to indicate this is for new batch confirmation
      this.pendingNewBatchConfirmation = resolve;
      this.showDeleteConfirmation.set(true);
    });
  }



  showAddBatchFromInventory(): void {
    // open the inventory add section by focusing the batch form — we reuse inventoryForm
    // scroll into view or focus the first input (best-effort)
    setTimeout(() => {
      const el = document.getElementById('batchId');
      el?.focus();
    }, 100);
  }

  triggerImageUpload(): void {
    const el = document.getElementById('hiddenImageFile') as HTMLInputElement | null;
    el?.click();
  }

  async onImageFileChange(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    
    const file = input.files[0];
    console.log('📸 Starting image upload process:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });
    
    try {
      // Show loading state
      this.loading = true;
      this.toastService.info('Compressing and uploading image...');
      
      // Compress the image
      console.log('🔄 Compressing image...');
      const compressed = await this.compressImage(file, 1024 * 1024); // 1MB max
      console.log('✅ Image compressed:', {
        originalSize: file.size,
        compressedSize: compressed.size,
        compression: Math.round((1 - compressed.size / file.size) * 100) + '%'
      });
      
      // Upload to Firebase Storage
      console.log('☁️ Uploading to Firebase Storage...');
      const url = await this.uploadFileToStorage(compressed);
      console.log('✅ Image uploaded successfully:', url);
      
      // Set the URL in the form
      this.productForm.get('imageUrl')?.setValue(url);
      this.toastService.success('Image uploaded successfully!');
      
    } catch (err: any) {
      console.error('❌ Image upload error:', err);
      this.toastService.error(`Image upload failed: ${err.message || 'Unknown error'}`);
    } finally {
      this.loading = false;
      // Clear the file input so the same file can be selected again if needed
      input.value = '';
    }
  }

  async compressImage(file: File, maxBytes: number): Promise<File> {
    console.log('🔄 Starting image compression:', {
      inputType: file.type,
      inputSize: file.size,
      maxBytes
    });
    
    const img = await this.loadImage(URL.createObjectURL(file));
    console.log('📐 Original image dimensions:', {
      width: img.width,
      height: img.height
    });
    
    // Calculate target size (2 inches at 96 DPI = 192px)
    const targetInches = 2;
    const dpi = 96;
    const targetPx = Math.round(targetInches * dpi);

    const canvas = document.createElement('canvas');
    canvas.width = targetPx;
    canvas.height = targetPx;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not supported');
    
    // Fill with white background for PNG transparency
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw image maintaining aspect ratio
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Try different quality levels to achieve target size
    for (let q = 0.9; q >= 0.4; q -= 0.1) {
      const blob = await new Promise<Blob | null>((res) => 
        canvas.toBlob(res, 'image/jpeg', q)
      );
      if (!blob) continue;
      
      console.log(`🔍 Quality ${q}: ${blob.size} bytes`);
      if (blob.size <= maxBytes) {
        const compressedFile = new File([blob], file.name.replace(/\.(png|webp|gif)$/i, '.jpg'), { 
          type: 'image/jpeg' 
        });
        console.log('✅ Compression successful:', {
          finalSize: compressedFile.size,
          quality: q
        });
        return compressedFile;
      }
    }

    // If still too large, reduce dimensions further
    console.log('⚠️ Still too large, reducing dimensions...');
    canvas.width = Math.round(targetPx / 1.5);
    canvas.height = Math.round(targetPx / 1.5);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    
    const blob = await new Promise<Blob | null>((res) => 
      canvas.toBlob(res, 'image/jpeg', 0.7)
    );
    if (!blob) throw new Error('Image compression failed');
    if (blob.size > maxBytes) throw new Error(`Image still too large: ${blob.size} bytes (max: ${maxBytes})`);
    
    const finalFile = new File([blob], file.name.replace(/\.(png|webp|gif)$/i, '.jpg'), { 
      type: 'image/jpeg' 
    });
    console.log('✅ Final compression:', {
      finalSize: finalFile.size
    });
    return finalFile;
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
    try {
      console.log('☁️ Starting Firebase Storage upload...');
      
      // Dynamic import to avoid top-level SDK usage
      const { getStorage, ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
      const { app } = await import('../../../firebase.config');
      
      const storage = getStorage(app);
      const fileName = `products/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, fileName);
      
      console.log('📤 Uploading file:', {
        fileName,
        fileSize: file.size,
        fileType: file.type
      });
      
      const snapshot = await uploadBytes(storageRef, file);
      console.log('✅ Upload complete, getting download URL...');
      
      const downloadURL = await getDownloadURL(snapshot.ref);
      console.log('✅ Download URL obtained:', downloadURL);
      
      return downloadURL;
    } catch (error: any) {
      console.error('❌ Firebase Storage upload error:', error);
      throw new Error(`Upload failed: ${error.message || 'Unknown error'}`);
    }
  }

  async deleteProduct(product: Product): Promise<void> {
    // Set up confirmation dialog
    this.productToDelete = product;
    this.deleteConfirmationData.set({
      title: 'Delete Product',
      message: `Are you sure you want to delete "${product.productName}"? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger'
    });
    this.showDeleteConfirmation.set(true);
  }

  // Handle confirmation dialog response
  async onDeleteConfirmed(): Promise<void> {
    if (this.productToDelete) {
      // Handle product deletion
      try {
        await this.productService.deleteProduct(this.productToDelete.id!);
        this.filterProducts();
        this.toastService.success(`Product "${this.productToDelete.productName}" deleted successfully`);
      } catch (error) {
        console.error('Error deleting product:', error);
        this.toastService.error(ErrorMessages.PRODUCT_DELETE_ERROR);
      }
    } else if (this.pendingBatchId && this.pendingBatchDocId) {
      // Handle batch removal
      await this.performBatchRemoval();
    } else if (this.pendingNewBatchConfirmation) {
      // Handle new batch confirmation
      this.pendingNewBatchConfirmation(true);
    }
    
    this.closeDeleteConfirmation();
  }

  closeDeleteConfirmation(): void {
    this.showDeleteConfirmation.set(false);
    this.deleteConfirmationData.set(null);
    this.productToDelete = null;
    this.pendingBatchId = null;
    this.pendingBatchDocId = null;
    // Handle cancellation of new batch confirmation
    if (this.pendingNewBatchConfirmation) {
      this.pendingNewBatchConfirmation(false);
      this.pendingNewBatchConfirmation = null;
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

  getComputedTotalStock(): number {
    return this.selectedProduct?.totalStock || 0;
  }

  getComputedSellingPrice(): number {
    return this.selectedProduct?.sellingPrice || 0;
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
    return product.sellingPrice;
  }

  // Category Autocomplete Properties and Methods
  filteredCategories: string[] = [];
  showCategorySuggestions = false;

  async loadCategories(): Promise<void> {
    try {
      const currentPermission = this.authService.getCurrentPermission();
      
      // Get storeId from the product form if available, or use current permission's storeId
      const storeId = this.productForm.value.storeId || currentPermission?.storeId;
      
      if (storeId) {
        console.log('🔍 Loading categories for store:', storeId);
        await this.categoryService.loadCategoriesByStore(storeId);
        console.log('✅ Categories loaded:', this.categories().length);
      } else {
        console.log('❌ No storeId available for loading categories');
      }
    } catch (error) {
      console.error('❌ Error loading categories:', error);
    }
  }

  async loadUnitTypes(): Promise<void> {
    try {
      console.log('🔍 Loading unit types from predefined types...');
      this.unitTypes = await this.predefinedTypesService.getUnitTypes();
      console.log('✅ Unit types loaded:', this.unitTypes.length);
      
      // If no unit types found in database, seed them
      if (this.unitTypes.length === 0) {
        console.log('🌱 No unit types found, seeding default unit types...');
        await this.predefinedTypesService.seedUnitTypes();
        this.unitTypes = await this.predefinedTypesService.getUnitTypes();
        console.log('✅ Unit types seeded and loaded:', this.unitTypes.length);
      }
    } catch (error) {
      console.error('❌ Error loading unit types:', error);
      // Fallback to default unit types
      this.unitTypes = [
        { value: 'pieces', label: 'Pieces' },
        { value: 'kg', label: 'Kilograms' },
        { value: 'liters', label: 'Liters' },
        { value: 'boxes', label: 'Boxes' }
      ];
    }
  }

  // Utility method to seed comprehensive unit types (can be called from browser console)
  async seedComprehensiveUnitTypes(): Promise<void> {
    try {
      console.log('🌱 Seeding comprehensive unit types...');
      await this.predefinedTypesService.seedComprehensiveUnitTypes();
      await this.loadUnitTypes();
      console.log('✅ Comprehensive unit types seeded successfully!');
    } catch (error) {
      console.error('❌ Error seeding comprehensive unit types:', error);
    }
  }

  onCategoryInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.toLowerCase();
    
    console.log('🔍 Category input value:', value);
    
    if (value.length > 0) {
      const categoriesArray = this.categories(); // Get current value from computed signal
      console.log('🔍 Available categories:', categoriesArray);
      this.filteredCategories = categoriesArray.filter((category: string) => 
        category.toLowerCase().includes(value)
      );
      console.log('🔍 Filtered categories:', this.filteredCategories);
      this.showCategorySuggestions = this.filteredCategories.length > 0;
    } else {
      this.showCategorySuggestions = false;
    }
  }

  selectCategory(category: string): void {
    this.productForm.patchValue({ category });
    this.showCategorySuggestions = false;
  }

  hideCategorySuggestions(): void {
    // Add a small delay to allow for click events on suggestions
    setTimeout(() => {
      this.showCategorySuggestions = false;
    }, 200);
  }

  async openAddCategoryModal(): Promise<void> {
    this.switchToCategoryMode();
  }

  // Modal transition methods
  switchToProductMode(): void {
    this.modalMode = 'product';
    this.categoryForm.reset({
      categoryLabel: '',
      categoryDescription: '',
      categoryGroup: ''
    });
  }

  switchToCategoryMode(): void {
    this.modalMode = 'category';
    this.categoryForm.reset({
      categoryLabel: '',
      categoryDescription: '',
      categoryGroup: 'General'
    });
  }

  cancelCategoryCreation(): void {
    this.switchToProductMode();
  }

  async saveCategory(): Promise<void> {
    console.log('🔍 saveCategory called');
    console.log('🔍 Category form valid?', this.categoryForm.valid);
    console.log('🔍 Category form value:', this.categoryForm.value);
    console.log('🔍 Category form errors:', this.categoryForm.errors);
    
    if (this.categoryForm.invalid) {
      console.log('❌ Category form is invalid, returning early');
      // Mark all fields as touched to show validation errors
      Object.keys(this.categoryForm.controls).forEach(key => {
        this.categoryForm.get(key)?.markAsTouched();
      });
      return;
    }

    try {
      this.loading = true;
      const formValue = this.categoryForm.value;
      
      console.log('🔍 Form value:', formValue);
      
      // Create category object matching ProductCategory interface
      const currentUser = this.authService.currentUser();
      const currentPermission = this.authService.getCurrentPermission();
      console.log('🔍 Current user data:', currentUser);
      console.log('🔍 Current permission data:', currentPermission);
      
      const companyId = currentPermission?.companyId || 
                       currentUser?.currentCompanyId || 
                       currentUser?.permissions?.[0]?.companyId || '';
      
      console.log('🔍 Extracted company ID:', companyId);
      
      if (!companyId) {
        throw new Error('No company ID found. User must be associated with a company to create categories.');
      }
      
      // Get storeId from the product form if available, otherwise fallback to current permission
      const storeId = this.productForm.value.storeId || currentPermission?.storeId;
      console.log('🔍 Store ID from product form:', storeId);
      
      const categoryData: Omit<ProductCategory, 'id' | 'createdAt' | 'updatedAt'> = {
        categoryId: `cat_${Date.now()}`,
        categoryLabel: formValue.categoryLabel,
        categoryDescription: formValue.categoryDescription || formValue.categoryLabel,
        categoryGroup: formValue.categoryGroup || 'General',
        isActive: true,
        sortOrder: 0,
        companyId: companyId,
        storeId: storeId
      };
      
      console.log('🔍 Creating category with data:', categoryData);
      await this.categoryService.createCategory(categoryData);
      await this.loadCategories(); // Refresh categories list
      
      // Set the new category in the product form and switch back to product mode
      this.productForm.patchValue({ category: formValue.categoryLabel });
      this.switchToProductMode();
      
      this.toastService.success('Category added successfully!');
    } catch (error) {
      console.error('❌ Error adding category:', error);
      console.error('❌ Full error details:', JSON.stringify(error, null, 2));
      this.toastService.error('Failed to add category');
    } finally {
      this.loading = false;
    }
  }

  /**
   * Utility method to add a new unit type
   * Can be called from browser console: window['addUnitType']('cubic_meters', 'Cubic Meters', 'Volume in cubic meters')
   */
  async addNewUnitType(value: string, label: string, description?: string): Promise<void> {
    try {
      await this.predefinedTypesService.addUnitType(value, label, description);
      await this.loadUnitTypes(); // Refresh the list
      this.toastService.success(`Unit type "${label}" added successfully!`);
    } catch (error) {
      console.error('❌ Error adding unit type:', error);
      this.toastService.error('Failed to add unit type');
    }
  }

  /**
   * Clean form data by removing undefined values and converting empty strings to null where appropriate
   */
  private cleanFormData(formData: any): any {
    const cleaned: any = {};
    
    for (const [key, value] of Object.entries(formData)) {
      if (value === undefined) {
        // Skip undefined values entirely
        continue;
      } else if (value === '') {
        // Convert empty strings to null for optional fields
        if (key === 'description' || key === 'productCode' || key === 'barcodeId' || 
            key === 'imageUrl' || key === 'initialSupplier' || key === 'initialExpiryDate') {
          cleaned[key] = null;
        } else {
          cleaned[key] = value;
        }
      } else {
        cleaned[key] = value;
      }
    }
    
    return cleaned;
  }

}
