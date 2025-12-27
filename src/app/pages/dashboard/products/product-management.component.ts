import { Component, OnInit, computed, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Product, ProductInventory, ProductStatus } from '../../../interfaces/product.interface';
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
import { CreateTagModalComponent } from '../../../shared/components/create-tag-modal/create-tag-modal.component';
import { TagsService, ProductTag } from '../../../services/tags.service';
import { AppConstants } from '../../../shared/enums/app-constants.enum';

@Component({
  selector: 'app-product-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ConfirmationDialogComponent, CreateTagModalComponent],
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
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
    }

    .btn-primary:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(102, 126, 234, 0.45);
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
      overflow-x: auto;
      overflow-y: hidden;
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

    .product-tags-cell {
      max-width: 200px;
      padding: 0.5rem;
    }

    .tags-wrapper {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
      align-items: center;
    }

    .tag-badge {
      display: inline-block;
      color: #000000;
      font-size: 0.7rem;
      font-weight: 400;
      white-space: normal;
      word-wrap: break-word;
    }

    .no-tags {
      color: #a0aec0;
      font-size: 0.85rem;
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
      text-align: left;
      min-width: 320px;
      width: 320px;
      white-space: nowrap;
    }

    .product-img-cell {
      width: 56px;
      text-align: center;
    }

    .product-thumb {
      width: 40px;
      height: 40px;
      object-fit: cover;
      border-radius: 6px;
      border: 1px solid #e5e7eb;
      background: #f3f4f6;
    }

    /* Compact column widths to fit Actions */
    .products-table th:nth-child(7), /* Stock */
    .products-table td:nth-child(7) {
      width: 80px;
      text-align: center;
    }

    .products-table th:nth-child(8), /* Price */
    .products-table td:nth-child(8) {
      width: 100px;
      text-align: right;
    }

    .products-table th:nth-child(9), /* Status */
    .products-table td:nth-child(9) {
      width: 90px;
      text-align: center;
    }

    .action-buttons {
      display: flex;
      gap: 0.25rem;
      align-items: center;
      justify-content: flex-start;
      flex-wrap: nowrap;
      width: 100%;
    }

    /* Match Stores Management emoji action buttons */
    .btn-icon-action {
      padding: 0.4rem;
      border: 1px solid #d1d5db;
      background: white;
      border-radius: 0.375rem;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 1.1rem;
      line-height: 1;
      position: relative;
      flex-shrink: 0;
    }

    .btn-icon-action:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }

    .btn-icon-action[title]:hover::after {
      content: attr(title);
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      margin-bottom: 0.5rem;
      padding: 0.375rem 0.75rem;
      background: #1f2937;
      color: white;
      font-size: 0.75rem;
      border-radius: 0.375rem;
      white-space: nowrap;
      z-index: 10020; /* ensure tooltip overlays other UI inside modal */
      pointer-events: none;
    }

    .btn-icon-action[title]:hover::before {
      content: '';
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      margin-bottom: 0.25rem;
      border: 4px solid transparent;
      border-top-color: #1f2937;
      z-index: 10020;
      pointer-events: none;
    }

    /* Hover variants consistent with Stores Management */
    .btn-edit:hover {
      background: #eff6ff;
      border-color: #3b82f6;
    }

    .btn-bir:hover {
      background: #f0fdf4;
      border-color: #10b981;
    }

    .btn-devices:hover {
      background: #faf5ff;
      border-color: #8b5cf6;
    }

    .btn-icon-action.btn-danger:hover {
      background: #fef2f2;
      border-color: #ef4444;
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
      /* Keep header fixed; let rows scroll to prevent layout shift */
      max-height: 420px;
      overflow-y: auto;
      position: relative; /* create stacking context for tooltips */
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
      position: sticky;
      top: 0;
      z-index: 1;
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
      /* Ensure inventory modal appears above the product modal */
      z-index: 10001 !important;
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

    /* Tags Management Styles */
    .tags-grid {
      padding: 1.5rem;
    }

    .tag-group {
      margin-bottom: 1.5rem;
    }

    .tag-group-header {
      font-weight: 600;
      color: #2d3748;
      margin-bottom: 0.75rem;
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.025em;
    }

    .tag-items {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .tag-badge {
      display: inline-flex;
      align-items: center;
      padding: 0.375rem 0.75rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 500;
      transition: all 0.2s;
    }

    .tag-badge:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(102, 126, 234, 0.3);
    }

    .tag-badge.inactive {
      background: #cbd5e0;
      color: #718096;
    }

    /* Product Tags Display Styles */
    .tags-display {
      margin-top: 1rem;
    }

    .tab-headers-style {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: center;
    }

    .tag-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 9999px;
      font-size: 0.875rem;
      font-weight: 500;
    }

    .remove-tag-btn {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.25rem;
      line-height: 1;
      transition: all 0.2s;
    }

    .remove-tag-btn:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: scale(1.1);
    }

    .add-tag-btn {
      padding: 0.5rem 1rem;
      background: white;
      border: 2px dashed #667eea;
      color: #667eea;
      border-radius: 9999px;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .add-tag-btn:hover {
      background: #f0f4ff;
      border-color: #5568d3;
      transform: translateY(-1px);
    }

    .empty-tags-hint {
      margin-top: 0.5rem;
      font-size: 0.75rem;
      color: #9ca3af;
      font-style: italic;
    }

    .tags-selection-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 0.75rem;
      max-height: 300px;
      overflow-y: auto;
      padding: 0.5rem;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      background: #f9fafb;
    }

    .tag-radio-label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 0.875rem;
    }

    .tag-radio-label:hover {
      background: #f0f4ff;
      border-color: #667eea;
    }

    .tag-radio-label input[type="radio"],
    .tag-radio-label input[type="checkbox"] {
      cursor: pointer;
      width: 16px;
      height: 16px;
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

    /* VAT Notice Styles */
    .vat-notice {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      background: #fef3cd;
      border: 1px solid #ffeaa7;
      border-radius: 6px;
      margin-bottom: 1.5rem;
      color: #856404;
      font-size: 0.875rem;
    }

    .notice-icon {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }

    /* Inventory Summary Styles */
    .inventory-summary {
      background: #f8f9fa;
      border: 1px solid #e9ecef;
      border-radius: 8px;
      padding: 1.5rem;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .summary-item label {
      display: block;
      font-weight: 500;
      color: #495057;
      margin-bottom: 0.5rem;
    }

    .calculated-value {
      font-size: 1.125rem;
      font-weight: 600;
      color: #007bff;
      margin-bottom: 0.25rem;
    }

    .calculated-value small {
      display: block;
      font-size: 0.75rem;
      font-weight: 400;
      color: #6c757d;
    }

    /* New Product Inventory Styles */
    .new-product-inventory {
      border: 2px dashed #28a745;
      border-radius: 8px;
      padding: 1.5rem;
      background: #f8fff9;
    }

    .form-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 1rem;
    }

    /* Inventory Management Button */
    .inventory-actions {
      text-align: center;
    }

    .btn-inventory {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.5rem;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 6px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-inventory:hover {
      background: #0056b3;
      transform: translateY(-1px);
    }

    .btn-icon {
      width: 18px;
      height: 18px;
    }

    /* Unauthorized Message Styles */
    .unauthorized-message {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      padding: 1.5rem;
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      border-radius: 8px;
      color: #856404;
    }

    .warning-icon {
      width: 24px;
      height: 24px;
      flex-shrink: 0;
      color: #f0ad4e;
    }

    .unauthorized-message h5 {
      margin: 0 0 0.5rem 0;
      font-size: 1rem;
      font-weight: 600;
    }

    .unauthorized-message p {
      margin: 0;
      font-size: 0.875rem;
      line-height: 1.4;
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
            <button class="btn btn-primary" (click)="onCreateTag()">🏷️ Create New Tag</button>
          </div>
        </div>
      </div>

      <!-- Search and Filters -->
      <div class="filters-section">
        <div class="search-container">
          <input 
            type="text" 
            [(ngModel)]="searchTerm"
            placeholder="Search products by name, SKU, or category..."
            class="search-input">
          <select 
            [(ngModel)]="selectedCategory" 
            class="filter-select">
            <option value="">All Categories</option>
            <option *ngFor="let category of categories()" [value]="category">{{ category }}</option>
          </select>
          <select 
            [(ngModel)]="selectedStore" 
            (ngModelChange)="onSelectedStoreChange($event)"
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
          <button 
            class="btn-icon-action" 
            (click)="refreshProducts()" 
            title="Refresh products"
            aria-label="Refresh products">
            🔄
          </button>
        </div>

        <div class="table-wrapper" *ngIf="filteredProducts().length > 0">
          <table class="products-table">
            <thead>
              <tr>
                <th>Image</th>
                <th>Product Code</th>
                <th>Product Name</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Tags</th>
                <th>Stock</th>
                <th>Price</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let product of filteredProducts()">
                <td class="product-img-cell">
                  <img 
                    class="product-thumb"
                    [src]="product.imageUrl || 'assets/noimage.png'" 
                    [alt]="product.productName || 'Product image'" />
                </td>
                <td class="product-code-cell">{{ product.productCode || '-' }}</td>
                <td class="product-name-cell">{{ product.productName }}</td>
                <td class="product-sku-cell">{{ product.skuId }}</td>
                <td class="product-category-cell">{{ product.category }}</td>
                <td class="product-tags-cell">
                  <div class="tags-wrapper">
                    <span *ngFor="let tagLabel of product.tagLabels" class="tag-badge">
                      {{ tagLabel }}
                    </span>
                    <span *ngIf="!product.tagLabels || product.tagLabels.length === 0" class="no-tags">-</span>
                  </div>
                </td>
                <td class="product-stock-cell">{{ product.totalStock }}</td>
                <td class="product-price-cell">\${{ displayPrice(product).toFixed(2) }}</td>
                <td class="product-status-cell">
                  <span [class]="getStatusBadgeClass(product.status || ProductStatus.Inactive)">
                    {{ (product.status || ProductStatus.Inactive) | titlecase }}
                  </span>
                </td>
                <td class="actions-cell">
                  <div class="action-buttons">
                    <button 
                      class="btn-icon-action btn-bir" 
                      (click)="triggerRowImageUpload(product)"
                      title="Add product photo"
                      aria-label="Add product photo">
                      🖼️
                    </button>
                    <button 
                      class="btn-icon-action btn-edit" 
                      (click)="openEditModal(product)"
                      title="Edit product"
                      aria-label="Edit product">
                      ✏️
                    </button>
                    <button 
                      class="btn-icon-action btn-devices" 
                      (click)="openInventoryModal(product)"
                      title="Manage inventory"
                      aria-label="Manage inventory">
                      📦
                    </button>
                    <button 
                      class="btn-icon-action btn-primary" 
                      (click)="duplicateProduct(product)"
                      title="Duplicate product"
                      aria-label="Duplicate product">
                      📋
                    </button>
                    <button 
                      class="btn-icon-action btn-danger" 
                      (click)="deleteProduct(product)"
                      title="Delete product"
                      aria-label="Delete product">
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Show more pagination -->
        <div style="text-align:center; margin-top:12px;" *ngIf="hasMore">
          <button class="btn btn-primary" (click)="loadMoreProducts()" [disabled]="loadingMore">
            <span *ngIf="loadingMore" class="loading-spinner" style="width:1rem; height:1rem; border-top-color: #fff; margin-right:8px;"></span>
            {{ loadingMore ? 'Loading...' : 'Show more' }}
          </button>
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
            <h3>{{ isCategoryMode ? '➕ Add Category' : (isEditMode ? '✏️ Edit Product' : '📦 Add New Product') }}</h3>
            <button class="close-btn" (click)="closeModal()">×</button>
          </div>
          <div class="modal-body">
            <!-- Product Mode -->
            <ng-container *ngIf="isProductMode">
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
                      title="Add category"
                      aria-label="Add category"
                      style="display:inline-flex; align-items:center; justify-content:center; width:32px; height:32px; line-height:1;">
                      <span aria-hidden="true">➕</span>
                    </button>
                    <button 
                      type="button" 
                      class="btn btn-sm btn-outline-danger"
                      (click)="deleteSelectedCategory()"
                      [disabled]="!productForm.get('category')?.value"
                      title="Delete selected category"
                      aria-label="Delete selected category"
                      style="display:inline-flex; align-items:center; justify-content:center; width:32px; height:32px; line-height:1; margin-left:4px;">
                      <span aria-hidden="true">➖</span>
                    </button>
                  </div>
                  <div class="error-message" *ngIf="productForm.get('category')?.invalid && productForm.get('category')?.touched">
                    Category is required
                  </div>
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
                  <label for="productCode">Product Code</label>
                  <input 
                    type="text" 
                    id="productCode"
                    formControlName="productCode"
                    placeholder="Enter product code (optional)"
                    class="form-input">
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
                  <label for="barcodeId">Barcode ID</label>
                  <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <input 
                      type="text" 
                      id="barcodeId"
                      formControlName="barcodeId"
                      placeholder="Enter barcode identifier (optional)"
                      class="form-input"
                      style="flex: 1;">
                    <button 
                      type="button"
                      (click)="generateBarcode()"
                      class="btn btn-secondary"
                      style="white-space: nowrap; padding: 0.5rem 1rem;"
                      title="Generate unique CODE128 barcode">
                      Generate Barcode
                    </button>
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
                
                <div class="form-group">
                  <label for="status">Status</label>
                  <select id="status" formControlName="status" class="form-input">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
              </div>

              <!-- Tags Section -->
              <div class="form-section">
                <h4 class="section-title">
                  <span>🏷️</span>
                  <span>Product Tags</span>
                </h4>

                <div class="tags-display">
                  <div class="tab-headers-style">
                    <div *ngFor="let tagId of selectedTagIds()" class="tag-chip">
                      <span>{{ getTagLabel(tagId) }}</span>
                      <button 
                        type="button" 
                        class="remove-tag-btn"
                        (click)="removeTag(tagId)"
                        title="Remove tag">
                        ×
                      </button>
                    </div>
                    <button 
                      type="button" 
                      class="add-tag-btn"
                      (click)="openSelectTagModal()">
                      <span>+ Add Tags</span>
                    </button>
                  </div>
                  <div *ngIf="selectedTagIds().length === 0" class="empty-tags-hint">
                    No tags selected. Click "+ Add Tags" to select tags for this product.
                  </div>
                </div>
              </div>

              <!-- Image & Description Section (Section 2) -->
              <div class="form-section">
                <h4 class="section-title">
                  <span>🖼️</span>
                  <span>Image & Description</span>
                </h4>

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

                <!-- Favorites Toggle -->
                <div class="form-group" style="display:flex; align-items:center; gap:8px;">
                  <input 
                    type="checkbox" 
                    id="isFavorite"
                    formControlName="isFavorite"
                    style="width:16px; height:16px; cursor:pointer;"/>
                  <label for="isFavorite" style="margin:0; cursor:pointer;">
                    ⭐ Mark as Favorite (show in POS Favorites tab)
                  </label>
                </div>

                <!-- VAT notice removed from here and moved before new-product-inventory -->
              </div>

              <!-- Pricing & Inventory Section -->
              <div class="form-section">
                <h4 class="section-title">
                  <span>💲</span>
                  <span>Pricing & Inventory</span>
                </h4>

                <!-- Check if product has existing inventory -->
                <div *ngIf="hasExistingInventory(); else newProductInventory">
                  <!-- Existing Product - Show calculated values and manage button -->
                  <div class="inventory-summary">
                    <div class="summary-grid">
                      <div class="summary-item">
                        <label>Total Stock</label>
                        <div class="calculated-value">
                          {{ selectedProduct?.totalStock || 0 }}
                          <small>Calculated from all inventory batches</small>
                        </div>
                      </div>
                      
                      <div class="summary-item">
                        <label>Selling Price</label>
                        <div class="calculated-value">
                          ₱{{ (selectedProduct?.sellingPrice || 0) | number:'1.2-2' }}
                          <small>Price from most recent inventory batch</small>
                        </div>
                      </div>
                      <div class="summary-item">
                        <label>Original Price</label>
                        <div class="calculated-value">
                          ₱{{ (selectedProduct?.originalPrice || 0) | number:'1.2-2' }}
                          <small>Base/unit price (before VAT)</small>
                        </div>
                      </div>
                    </div>

                    <div class="inventory-actions" *ngIf="canManageInventory()">
                      <button 
                        type="button" 
                        class="btn btn-inventory" 
                        (click)="openInventoryManagement()">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="btn-icon">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
                        </svg>
                        Manage Inventory Batches
                      </button>
                    </div>
                  </div>
                </div>

                <!-- New Product - Enable direct entry for authorized roles -->
                <!-- Render the initial-inventory block for both Add and Edit modes so VAT controls are available in the same place -->
                <ng-template #newProductInventory>
                  <div class="new-product-inventory" *ngIf="canCreateInitialInventory(); else unauthorizedInventory">
                    <div class="form-row">
                      <div class="form-group">
                        <label for="totalStock">Total Stock</label>
                        <input 
                          type="number" 
                          id="totalStock"
                          [formControlName]="isEditMode ? 'totalStock' : 'initialQuantity'"
                          placeholder="Enter stock quantity"
                          class="form-input"
                          min="0">
                        <small class="text-muted">{{ isEditMode ? 'Current stock quantity' : 'Initial stock for this product' }}</small>
                      </div>

                      <div class="form-group">
                        <label for="costPrice">Cost Price</label>
                        <input 
                          type="number" 
                          id="costPrice"
                          [formControlName]="isEditMode ? 'costPrice' : 'initialCostPrice'"
                          placeholder="0.00"
                          class="form-input"
                          min="0"
                          step="0.01">
                        <small class="text-muted">Cost per unit</small>
                      </div>
                    </div>

                    <div class="form-row">
                      <div class="form-group">
                        <label for="originalPrice">Original Price</label>
                        <input
                          type="number"
                          id="originalPrice"
                          formControlName="originalPrice"
                          placeholder="0.00"
                          class="form-input"
                          min="0"
                          step="0.01">
                        <small class="text-muted">Base/unit price (Without Tax)</small>
                      </div>

                      <div class="form-group">
                        <label for="sellingPrice">Selling Price</label>
                        <input 
                          type="number" 
                          id="sellingPrice"
                          formControlName="sellingPrice"
                          placeholder="0.00"
                          class="form-input"
                          min="0"
                          step="0.01">
                        <small class="text-muted">Price per unit (With tax and discount)</small>
                      </div>

                     

                    </div>

                    <div class="form-row" style="margin-top:0.5rem;">
                      <div class="form-group">
                        <label>Inventory Value</label>
                        <div class="calculated-value">
                          ₱{{ ((productForm.get('sellingPrice')?.value || 0) * (productForm.get('totalStock')?.value || 0)) | number:'1.2-2' }}
                        </div>
                        <small class="text-muted">Selling Price × Total Stock</small>
                      </div>
                    </div>

                                    <!-- VAT controls: placed inside new-product-inventory for both Add/Edit -->
                                    <div class="form-row" style="margin-top:0.5rem;">
                                      <div class="form-group" style="display:flex; align-items:center; gap:8px;">
                                        <input
                                          type="checkbox"
                                          id="isVatApplicable"
                                          formControlName="isVatApplicable"
                                          style="width:16px; height:16px; cursor:pointer;" />
                                        <label for="isVatApplicable" style="margin:0; cursor:pointer; font-weight:600;">VAT applicable</label>
                                      </div>

                                      <div class="form-group">
                                        <label for="vatRate">VAT Rate (%) Default: {{ defaultVatRate }}%<</label>
                                        <input
                                          type="number"
                                          id="vatRate"
                                          formControlName="vatRate"
                                          placeholder="0.00"
                                          class="form-input"
                                          min="0"
                                          max="100"
                                          step="0.01"
                                          [disabled]="!productForm.get('isVatApplicable')?.value" />
                                      </div>
                                      
                                      <div class="form-group" style="display:flex; align-items:center; gap:8px;">
                                        <input
                                          type="checkbox"
                                          id="hasDiscount"
                                          formControlName="hasDiscount"
                                          style="width:16px; height:16px; cursor:pointer;" />
                                        <label for="hasDiscount" style="margin:0; cursor:pointer; font-weight:600;">Has Discount</label>
                                      </div>

                                      

                      

                                    </div>





                     <div class="form-row">
                      <div class="form-group">
                                        <label for="discountType">Discount Type</label>
                                        <select id="discountType" formControlName="discountType" class="form-input" [disabled]="!productForm.get('hasDiscount')?.value">
                                          <option value="percentage">Percentage</option>
                                          <option value="fixed">Fixed</option>
                                        </select>
                                        <small class="text-muted">Percentage or fixed amount</small>
                                      </div>

                     <div class="form-group">
                        <label for="discountValue">Discount</label>
                        <input
                          type="number"
                          id="discountValue"
                          formControlName="discountValue"
                          placeholder="0.00"
                          class="form-input"
                          min="0"
                          step="0.01"
                          [disabled]="!productForm.get('hasDiscount')?.value" />
                        <small class="text-muted">Value depends on discount type</small>
                      </div>
                    </div>
                      

                    <!-- Additional initial batch fields -->
                    <div class="form-row">
                      <div class="form-group">
                        <label for="batchId">Batch ID</label>
                        <input 
                          type="text" 
                          id="batchId"
                          formControlName="initialBatchId"
                          placeholder="AUTO-GENERATED"
                          class="form-input">
                        <small class="text-muted">Leave empty for auto-generation</small>
                      </div>

                      <div class="form-group">
                        <label for="supplier">Supplier (Optional)</label>
                        <input 
                          type="text" 
                          id="supplier"
                          formControlName="initialSupplier"
                          placeholder="Enter supplier name"
                          class="form-input">
                      </div>
                    </div>
                  </div>

                  <!-- Unauthorized message for cashiers -->
                  <ng-template #unauthorizedInventory>
                    <div class="unauthorized-message">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="warning-icon">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                      </svg>
                      <div>
                        <h5>Limited Access</h5>
                        <p>Only store managers and creators can set initial inventory. Contact your manager to create products with inventory.</p>
                      </div>
                    </div>
                  </ng-template>
                </ng-template>
              </div>
            </form>
            </ng-container>

            <!-- Category Mode -->
            <ng-container *ngIf="isCategoryMode">
              <form [formGroup]="categoryForm" (ngSubmit)="saveCategory()">
                <div class="form-section">
                  <h4 class="section-title">
                    <span>🏷️</span>
                    <span>New Category</span>
                  </h4>
                  <div class="form-group">
                    <label for="categoryLabel">Category Name</label>
                    <input id="categoryLabel" class="form-input" formControlName="categoryLabel" placeholder="e.g., Beverages" />
                    <div class="error-message" *ngIf="categoryForm.get('categoryLabel')?.invalid && categoryForm.get('categoryLabel')?.touched">
                      Category name is required
                    </div>
                  </div>
                  <div class="form-group">
                    <label for="categoryGroup">Group</label>
                    <input id="categoryGroup" class="form-input" formControlName="categoryGroup" placeholder="e.g., General" />
                  </div>
                  <div class="form-group">
                    <label for="categoryDescription">Description</label>
                    <textarea id="categoryDescription" class="form-input" rows="3" formControlName="categoryDescription" placeholder="Optional description"></textarea>
                  </div>
                </div>
                <div class="modal-footer" style="justify-content:flex-end; gap:8px;">
                  <button type="button" class="btn btn-secondary" (click)="cancelCategoryCreation()">Cancel</button>
                  <button type="submit" class="btn btn-primary" [disabled]="categoryForm.invalid || loading">Save Category</button>
                </div>
              </form>
            </ng-container>
          </div>
          <div class="modal-footer" *ngIf="isProductMode">
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
                Add
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
                      <th>Original Price</th>
                      <th>Selling Price</th>
                      <th>Received Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let batch of filteredInventory; let i = index; trackBy: trackByBatch" (click)="openEditBatch(batch)" class="inventory-row">
                      <td class="batch-id-cell">{{ batch.batchId }}</td>
                      <td class="quantity-cell">{{ batch.quantity }}</td>
                      <td class="price-cell">\${{ batch.unitPrice.toFixed(2) }}</td>
                      <td class="price-cell">\${{ (batch.sellingPrice ?? batch.unitPrice).toFixed(2) }}</td>
                      <td class="date-cell">{{ batch.receivedAt | date:'short' }}</td>
                      <td class="status-cell">
                        <span class="status-badge" [class]="'status-' + batch.status">
                          {{ batch.status | titlecase }}
                        </span>
                      </td>
                      <td class="actions-cell">
                        <!-- Actions for most recent (first) item displayed horizontally -->
                        <div *ngIf="i === 0" class="action-buttons">
                          <button 
                            class="btn-icon-action btn-edit" 
                            (click)="$event.stopPropagation(); openEditBatch(batch)"
                            title="Edit quantity and price"
                            aria-label="Edit quantity and price">
                            ✏️
                          </button>
                          <button 
                            *ngIf="batch.id"
                            class="btn-icon-action btn-danger" 
                            (click)="$event.stopPropagation(); removeInventoryBatch(batch.batchId, batch.id!)"
                            title="Remove batch"
                            aria-label="Remove batch">
                            🗑️
                          </button>
                        </div>
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
                  <h4 class="form-title">
                    {{ isEditingBatch ? 'Edit Batch' : 'Add New Batch' }}
                    <span *ngIf="isEditingBatch && editingBatchOriginalId" style="font-weight:500; color:#4b5563; margin-left:8px;">• {{ editingBatchOriginalId }}</span>
                  </h4>
                  <p class="form-subtitle">
                    {{ isEditingBatch 
                      ? ('Update inventory batch details' + (editingBatchOriginalId ? ' — ' + editingBatchOriginalId : ''))
                      : 'Add new inventory to your product stock' }}
                  </p>
                </div>
                
                <form [formGroup]="inventoryForm" (ngSubmit)="saveBatch()" class="inventory-form">
                  <div class="form-grid" style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; align-items:start;">
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
                      <label for="unitPrice" class="form-label">Original Price (Unit Price) *</label>
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
                        Original/unit price is required
                      </div>
                    </div>

                    <div class="form-group">
                      <label for="sellingPrice" class="form-label">Selling Price *</label>
                      <input 
                        type="number" 
                        id="sellingPrice"
                        step="0.01" 
                        class="form-input" 
                        formControlName="sellingPrice" 
                        placeholder="0.00"
                        min="0"
                        [class.error]="inventoryForm.get('sellingPrice')?.invalid && inventoryForm.get('sellingPrice')?.touched" />
                      <div class="error-message" *ngIf="inventoryForm.get('sellingPrice')?.invalid && inventoryForm.get('sellingPrice')?.touched">
                        Selling price is required
                      </div>
                      <small class="text-muted">Selling price may include VAT depending on product settings</small>
                    </div>
                    
                    
                    <div class="form-group" style="grid-column: 1 / -1;">
                      <label class="form-label">VAT</label>
                      <div style="display:flex; gap:8px; align-items:center;">
                        <input type="checkbox" id="isVatApplicable" formControlName="isVatApplicable" />
                        <label for="isVatApplicable" style="margin:0;">VAT applicable</label>
                        <input 
                          type="number" 
                          formControlName="vatRate" 
                          min="0" 
                          max="100" 
                          step="0.01" 
                          class="form-input" 
                          style="width:120px; margin-left:8px;"
                          [disabled]="!inventoryForm.get('isVatApplicable')?.value"
                          placeholder="12" />
                      </div>
                      <small class="text-muted">VAT Rate (%)</small>
                    </div>
                    
                    <div class="form-group" style="grid-column: 1 / -1;">
                      <label class="form-label">Discount</label>
                      <div style="display:flex; gap:8px; align-items:center;">
                        <input type="checkbox" id="hasDiscount" formControlName="hasDiscount" />
                        <label for="hasDiscount" style="margin:0;">Has Discount</label>
                        <select formControlName="discountType" class="form-input" [disabled]="!inventoryForm.get('hasDiscount')?.value" style="width:140px; margin-left:8px;">
                          <option value="percentage">Percentage</option>
                          <option value="fixed">Fixed</option>
                        </select>
                        <input type="number" formControlName="discountValue" step="0.01" min="0" class="form-input" [disabled]="!inventoryForm.get('hasDiscount')?.value" style="width:120px;" />
                      </div>
                      <small class="text-muted">Discount type & value</small>
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

      <!-- Select Tag Modal -->
      <div class="modal-overlay" *ngIf="showSelectTagModal()" (click)="closeSelectTagModal()" style="z-index: 100000 !important;">
        <div class="modal" (click)="$event.stopPropagation()" style="max-width: 500px;">
          <div class="modal-header">
            <h3>Select Tags</h3>
            <button class="close-btn" (click)="closeSelectTagModal()">×</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Group</label>
              <select class="form-input" [(ngModel)]="selectedTagGroup" (ngModelChange)="onTagGroupChange($event)">
                <option value="">Select a group</option>
                <option *ngFor="let group of tagGroups()" [value]="group">{{ group }}</option>
              </select>
            </div>

            <div class="form-group" *ngIf="selectedTagGroup">
              <label>Tags (Select one per group)</label>
              <div class="tags-selection-grid">
                <label *ngFor="let tag of getFilteredTags()" class="tag-radio-label">
                  <input 
                    type="radio" 
                    [name]="'tag-group-' + selectedTagGroup"
                    [checked]="isTagSelected(tag.tagId)"
                    (change)="selectSingleTag(tag.tagId)">
                  <span>{{ tag.label }}</span>
                </label>
              </div>
              <div *ngIf="getFilteredTags().length === 0" class="empty-state" style="padding: 1rem;">
                <p style="margin: 0; color: #9ca3af; font-size: 0.875rem;">No tags available in this group</p>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeSelectTagModal()">Cancel</button>
            <button class="btn btn-primary" (click)="saveSelectedTags()">Add Tags</button>
          </div>
        </div>
      </div>

      <!-- Create Tag Modal -->
      <app-create-tag-modal
        *ngIf="showCreateTagModal()"
        [storeId]="getCurrentStoreId()"
        (saved)="onTagSaved($event)"
        (cancelled)="onTagCancelled()"
      />

      <!-- Hidden file input for per-row Add Photo action -->
      <input 
        type="file" 
        id="hiddenRowImageFile" 
        accept="image/*" 
        (change)="onRowImageFileChange($event)"
        style="display: none;"/>
    </div>
  `
})
export class ProductManagementComponent implements OnInit {
  // Signals
  readonly products = computed(() => this.productService.getProducts());
  readonly stores = computed(() => this.storeService.getStores());
  readonly categories = computed(() => this.categoryService.getCategoryLabels());

  // Reactive filtered products - automatically updates when products change or filters change
  readonly filteredProducts = computed(() => {
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

    // Tag filtering with AND logic: product must have ALL selected tags
    if (this.activeTagFilters && this.activeTagFilters.length > 0) {
      filtered = filtered.filter(product => {
        // Product must have all selected tag IDs
        return this.activeTagFilters.every(filterTagId => 
          product.tags && product.tags.includes(filterTagId)
        );
      });
    }

    return filtered;
  });

  // State
  searchTerm = '';
  selectedCategory = '';
  selectedStore = '';
  activeTagFilters: string[] = []; // Active tag filter IDs for product list filtering
  // Pagination state for BigQuery products API
  pageSize = 50;
  currentPage = 1;
  hasMore = false;
  loadingMore = false;
  
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
  // Category deletion context
  private categoryToDeleteId: string | null = null;
  private categoryToDeleteLabel: string | null = null;
  // Row-level image upload context
  private pendingPhotoProduct: Product | null = null;

  // Tags management state
  showCreateTagModal = signal<boolean>(false);
  availableTags = signal<ProductTag[]>([]);
  tagGroups = signal<string[]>([]);
  
  // Select tag modal state
  showSelectTagModal = signal<boolean>(false);
  selectedTagGroup: string = '';
  selectedTagIds = signal<string[]>([]);
  tempSelectedTagIds: string[] = [];

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
  // expose enum to template
  readonly ProductStatus = ProductStatus;
  // expose default VAT rate from AppConstants
  readonly defaultVatRate: number = AppConstants.DEFAULT_VAT_RATE;

  constructor(
    public productService: ProductService,
    private storeService: StoreService,
    private authService: AuthService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private toastService: ToastService,
    private categoryService: CategoryService,
    private inventoryDataService: InventoryDataService,
    private predefinedTypesService: PredefinedTypesService,
    private tagsService: TagsService
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

    // Subscribe to VAT applicable checkbox changes to toggle vatRate
    const isVatCtrl = this.productForm.get('isVatApplicable');
    const vatRateCtrl = this.productForm.get('vatRate');

    // Product form: keep originalPrice and sellingPrice in sync for Add/Edit Product dialog
    const prodOrigCtrl = this.productForm.get('originalPrice');
    const prodSellCtrl = this.productForm.get('sellingPrice');
    const prodVatCtrl = this.productForm.get('isVatApplicable');
    const prodVatRateCtrl = this.productForm.get('vatRate');
    const prodHasDiscCtrl = this.productForm.get('hasDiscount');
    const prodDiscTypeCtrl = this.productForm.get('discountType');
    const prodDiscValueCtrl = this.productForm.get('discountValue');

    const recomputeProdSelling = () => {
      const orig = Number(prodOrigCtrl?.value || 0);
      const isVat = !!prodVatCtrl?.value;
      const vatRate = Number(prodVatRateCtrl?.value || 0);
      const hasDisc = !!prodHasDiscCtrl?.value;
      const discType = prodDiscTypeCtrl?.value || 'percentage';
      const discValue = Number(prodDiscValueCtrl?.value || 0);
      const selling = this.computeSellingFromOriginal(orig, isVat, vatRate, hasDisc, discType, discValue);
      prodSellCtrl?.setValue(Number(selling.toFixed(2)), { emitEvent: false });
    };

    const recomputeProdOriginal = () => {
      const selling = Number(prodSellCtrl?.value || 0);
      const isVat = !!prodVatCtrl?.value;
      const vatRate = Number(prodVatRateCtrl?.value || 0);
      const hasDisc = !!prodHasDiscCtrl?.value;
      const discType = prodDiscTypeCtrl?.value || 'percentage';
      const discValue = Number(prodDiscValueCtrl?.value || 0);
      const original = this.computeOriginalFromSelling(selling, isVat, vatRate, hasDisc, discType, discValue);
      prodOrigCtrl?.setValue(Number(original.toFixed(2)), { emitEvent: false });
    };

    prodOrigCtrl?.valueChanges.subscribe(() => recomputeProdSelling());
    prodSellCtrl?.valueChanges.subscribe(() => recomputeProdOriginal());
    prodVatCtrl?.valueChanges.subscribe(() => recomputeProdSelling());
    prodVatRateCtrl?.valueChanges.subscribe(() => recomputeProdSelling());
    prodHasDiscCtrl?.valueChanges.subscribe(() => recomputeProdSelling());
    prodDiscTypeCtrl?.valueChanges.subscribe(() => recomputeProdSelling());
    prodDiscValueCtrl?.valueChanges.subscribe(() => recomputeProdSelling());

    // Inventory form: keep unitPrice (originalPrice) and sellingPrice in sync according to VAT and discount rules
    const unitCtrl = this.inventoryForm.get('unitPrice');
    const sellCtrl = this.inventoryForm.get('sellingPrice');
    const vatCtrl = this.inventoryForm.get('isVatApplicable');
    const vatRateCtrlInv = this.inventoryForm.get('vatRate');
    const hasDiscCtrl = this.inventoryForm.get('hasDiscount');
    const discTypeCtrl = this.inventoryForm.get('discountType');
    const discValueCtrl = this.inventoryForm.get('discountValue');

    const recomputeSelling = () => {
      const orig = Number(unitCtrl?.value || 0);
      const isVat = !!vatCtrl?.value;
      const vatRate = Number(vatRateCtrlInv?.value || 0);
      const hasDisc = !!hasDiscCtrl?.value;
      const discType = discTypeCtrl?.value || 'percentage';
      const discValue = Number(discValueCtrl?.value || 0);
      const selling = this.computeSellingFromOriginal(orig, isVat, vatRate, hasDisc, discType, discValue);
      sellCtrl?.setValue(Number(selling.toFixed(2)), { emitEvent: false });
    };

    const recomputeOriginal = () => {
      const selling = Number(sellCtrl?.value || 0);
      const isVat = !!vatCtrl?.value;
      const vatRate = Number(vatRateCtrlInv?.value || 0);
      const hasDisc = !!hasDiscCtrl?.value;
      const discType = discTypeCtrl?.value || 'percentage';
      const discValue = Number(discValueCtrl?.value || 0);
      const original = this.computeOriginalFromSelling(selling, isVat, vatRate, hasDisc, discType, discValue);
      unitCtrl?.setValue(Number(original.toFixed(2)), { emitEvent: false });
    };

    // Wire subscriptions
    unitCtrl?.valueChanges.subscribe(() => {
      // Only recompute selling price if not in edit mode or if values are actually different
      // This prevents unwanted recalculation when editing batches where prices are intentionally equal
      if (!this.isEditingBatch) {
        recomputeSelling();
      }
    });
    sellCtrl?.valueChanges.subscribe(() => {
      // Only recompute original price if not in edit mode or if values are actually different
      // This prevents unwanted recalculation when editing batches where prices are intentionally equal
      if (!this.isEditingBatch) {
        recomputeOriginal();
      }
    });
    vatCtrl?.valueChanges.subscribe(() => {
      // VAT toggle affects both directions
      recomputeSelling();
    });
    vatRateCtrlInv?.valueChanges.subscribe(() => recomputeSelling());
    hasDiscCtrl?.valueChanges.subscribe(() => recomputeSelling());
    discTypeCtrl?.valueChanges.subscribe(() => recomputeSelling());
    discValueCtrl?.valueChanges.subscribe(() => recomputeSelling());
    if (isVatCtrl && vatRateCtrl) {
      isVatCtrl.valueChanges.subscribe((applies: boolean) => {
        try {
          if (applies) {
            // When enabled, restore default VAT rate and enable input so user can edit
            vatRateCtrl.enable({ emitEvent: false });
            vatRateCtrl.setValue(AppConstants.DEFAULT_VAT_RATE, { emitEvent: false });
          } else {
            // When disabled, set rate to 0 and disable input
            vatRateCtrl.setValue(0, { emitEvent: false });
            vatRateCtrl.disable({ emitEvent: false });
          }
        } catch (e) {
          // defensive: ignore errors during programmatic changes
        }
      });
    }
  }

  // Helpers for price sync: compute sellingPrice from originalPrice and vice-versa
  // selling = (original * (1 + vatRate/100)) - discountAmount
  // discountAmount depends on discountType: percentage -> (original*(1+vatRate/100)) * (discPct/100)
  private computeSellingFromOriginal(original: number, isVat: boolean, vatRate: number, hasDiscount: boolean, discountType: string, discountValue: number): number {
    const base = Number(original) || 0;
    const rate = isVat ? (Number(vatRate) || 0) : 0;
    const withVat = base * (1 + rate / 100);
    let discountAmount = 0;
    if (hasDiscount && discountValue) {
      if (discountType === 'percentage') {
        discountAmount = withVat * (Number(discountValue) / 100);
      } else {
        discountAmount = Number(discountValue) || 0;
      }
    }
    return Number((withVat - discountAmount));
  }

  private computeOriginalFromSelling(selling: number, isVat: boolean, vatRate: number, hasDiscount: boolean, discountType: string, discountValue: number): number {
    const sell = Number(selling) || 0;
    const rate = isVat ? (Number(vatRate) || 0) : 0;
    const disc = Number(discountValue) || 0;
    if (!hasDiscount || disc === 0) {
      // original * (1 + rate/100) = selling -> original = selling / (1+rate/100)
      const denom = (1 + rate / 100) || 1;
      return sell / denom;
    }

    if (discountType === 'percentage') {
      // selling = original * (1+rate/100) * (1 - disc/100)
      const denom = (1 + rate / 100) * (1 - disc / 100);
      if (denom === 0) return 0;
      return sell / denom;
    } else {
      // fixed discount: selling = original * (1+rate/100) - fixed -> original = (selling + fixed) / (1+rate/100)
      const denom = (1 + rate / 100) || 1;
      return (sell + disc) / denom;
    }
  }

  async ngOnInit(): Promise<void> {
    try {
      const currentPermission = this.authService.getCurrentPermission();
      if (currentPermission?.companyId) {
        await this.storeService.loadStoresByCompany(currentPermission.companyId);
        
        // Initialize products with real-time updates
        if (currentPermission.storeId) {
          await this.productService.initializeProducts(currentPermission.storeId);
          // Load tags for the current store
          await this.loadTags(currentPermission.storeId);
        } else {
          console.warn('No storeId available - cannot load products');
        }
        
        await this.loadCategories(); // Load categories from CategoryService
      } else {
        // Creator account, no companyId or stores yet, allow empty arrays for onboarding
        this.storeService['storesSignal']?.set([]); // Use bracket notation to bypass private
      }
      
      // Load unit types from predefined types
      await this.loadUnitTypes();
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  private async loadTags(storeId: string): Promise<void> {
    try {
      const tags = await this.tagsService.getTagsByStore(storeId);
      this.availableTags.set(tags);
      const groups = await this.tagsService.getAllTagGroups(storeId);
      this.tagGroups.set(groups);
    } catch (error) {
      console.error('Error loading tags:', error);
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
  // Product status: active by default
  status: [ProductStatus.Active],
  imageUrl: [''],
  // Favorites
  isFavorite: [false],
  // Tax and Discount Fields
  isVatApplicable: [true],
  vatRate: [AppConstants.DEFAULT_VAT_RATE, [Validators.min(0), Validators.max(100)]],
      hasDiscount: [true],
      discountType: ['percentage'],
      discountValue: [10.0, [Validators.min(0)]],
      // Initial inventory fields (for new products)
      initialBatchId: [''],
      initialQuantity: [0, Validators.min(0)],
      initialCostPrice: [0, Validators.min(0)],
      initialReceivedAt: [new Date().toISOString().split('T')[0]],
      initialExpiryDate: [''],
      initialSupplier: [''],
      // Denormalized editable summary fields (available when product has no separate inventory)
      totalStock: [0, Validators.min(0)],
      sellingPrice: [0, Validators.min(0)],
      originalPrice: [0, Validators.min(0)],
      // Cost Price (for edit mode when updating inventory)
      costPrice: [0, [Validators.min(0)]],
      // Product tags
      tags: [[]],
    });
  }

  private createInventoryForm(): FormGroup {
    return this.fb.group({
      quantity: [0, [Validators.required, Validators.min(1)]],
      unitPrice: [0, [Validators.required, Validators.min(0)]],
      // unitPrice represents the base/unit price (originalPrice)
      sellingPrice: [0, [Validators.required, Validators.min(0)]],
      costPrice: [0, [Validators.required, Validators.min(0)]],
      receivedAt: [new Date().toISOString().split('T')[0], Validators.required],
      expiryDate: [''],
      supplier: [''],
      // VAT & Discount for batch-level metadata
      isVatApplicable: [true],
      vatRate: [AppConstants.DEFAULT_VAT_RATE, [Validators.min(0), Validators.max(100)]],
      hasDiscount: [false],
      discountType: ['percentage'],
      discountValue: [0, [Validators.min(0)]]
    });
  }

  /**
   * Reload a specific product from Firestore to get updated values
   */
  private async reloadProductFromFirestore(productId: string): Promise<void> {
    try {
      // Force refresh products from Firestore to get updated values
      const permission = this.authService.getCurrentPermission();
      const storeId = this.selectedProduct?.storeId || permission?.storeId;

      if (storeId) {
        await this.productService.refreshProducts(storeId);
      }

      // Update selectedProduct from the refreshed cache
      this.selectedProduct = this.productService.getProduct(productId) || null;
    } catch (error) {
      console.error('Error reloading product from Firestore:', error);
    }
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

  // Note: filterProducts() method removed - filtering is now handled by the computed filteredProducts signal

  /**
   * Generate a unique UPC-A compatible barcode (12 digits)
   * Format: Timestamp-based + random digits to ensure uniqueness
   * Uses last 11 digits of timestamp + 1 check digit calculated via UPC-A algorithm
   */
  generateBarcode(): void {
    const now = new Date();
    
    // Get timestamp in milliseconds and convert to string
    const timestamp = now.getTime().toString();
    
    // Take last 11 digits of timestamp for uniqueness
    // This gives us ~317 years of unique values (from 1970)
    const timestampPart = timestamp.slice(-11);
    
    // Calculate UPC-A check digit (Luhn algorithm for UPC)
    const digits = timestampPart.split('').map(Number);
    let sum = 0;
    
    // UPC-A: multiply odd positions (1st, 3rd, 5th...) by 3, even by 1
    for (let i = 0; i < digits.length; i++) {
      sum += digits[i] * (i % 2 === 0 ? 3 : 1);
    }
    
    // Check digit makes the sum a multiple of 10
    const checkDigit = (10 - (sum % 10)) % 10;
    
    // Combine for 12-digit UPC-A barcode
    const barcode = timestampPart + checkDigit;
    
    // Set the barcode value
    this.productForm.patchValue({ barcodeId: barcode });
    
    console.log('🔢 Generated UPC-A barcode:', barcode, '(check digit:', checkDigit + ')');
  }

  openAddModal(): void {
    console.log('openAddModal called');
    this.isEditMode = false;
    this.selectedProduct = null;
    this.selectedTagIds.set([]); // Reset tags for new product
    this.productForm.reset({
      initialReceivedAt: new Date().toISOString().split('T')[0],
      isMultipleInventory: false,
      initialBatchId: '',
      initialQuantity: 0,
      vatRate: AppConstants.DEFAULT_VAT_RATE,
      // Preserve discount defaults when opening the Add Product modal
      hasDiscount: true,
      discountType: 'percentage',
      discountValue: 0
    });
    // Ensure required defaults after reset
    this.productForm.patchValue({
      unitType: 'pieces',
      category: 'General',
  status: ProductStatus.Active,
      isVatApplicable: true,
      vatRate: AppConstants.DEFAULT_VAT_RATE
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
    // Load product tags into signal
    this.selectedTagIds.set(product.tags || []);
    // Patch the form silently to avoid triggering valueChange subscriptions
    this.productForm.patchValue(product, { emitEvent: false });
    // Set costPrice to 0 initially (will be loaded from latest batch if available)
    this.productForm.get('costPrice')?.setValue(0, { emitEvent: false });
    // Ensure vatRate defaults to 12 if the product doesn't include it
    const currentVat = this.productForm.get('vatRate')?.value;
    if (currentVat === null || currentVat === undefined || currentVat === '') {
      this.productForm.get('vatRate')?.setValue(AppConstants.DEFAULT_VAT_RATE);
    }
    
    // Use denormalized totalStock from product (no longer calculate from embedded inventory)
    // Patch the denormalized summary controls if present
    if (this.productForm.get('totalStock')) {
      this.productForm.get('totalStock')?.setValue(product.totalStock || 0);
    }

    // Ensure the form fields reflect the authoritative product document values
    if (this.productForm.get('sellingPrice')) {
      this.productForm.get('sellingPrice')?.setValue(product.sellingPrice ?? 0, { emitEvent: false });
    }
    if (this.productForm.get('originalPrice')) {
      // Prefer stored originalPrice; if missing, derive from sellingPrice using VAT/discount
      const orig = product.originalPrice ?? null;
      if (orig !== null && orig !== undefined) {
        this.productForm.get('originalPrice')?.setValue(orig, { emitEvent: false });
      } else {
        // Derive original from sellingPrice if needed
        try {
          const isVat = !!product.isVatApplicable;
          const vatRate = Number(product.vatRate ?? AppConstants.DEFAULT_VAT_RATE);
          const hasDisc = !!product.hasDiscount;
          const discType = product.discountType ?? 'percentage';
          const discValue = Number(product.discountValue ?? 0);
          const computedOriginal = this.computeOriginalFromSelling(Number(product.sellingPrice || 0), isVat, vatRate, hasDisc, discType, discValue);
          this.productForm.get('originalPrice')?.setValue(Number(computedOriginal.toFixed(2)), { emitEvent: false });
        } catch (e) {
          this.productForm.get('originalPrice')?.setValue(product.originalPrice ?? 0, { emitEvent: false });
        }
      }
    }
    
    // Enable/disable summary controls depending on whether product uses separate inventory
    const hasInv = this.hasExistingInventory();
    this.toggleControlsForInventory(hasInv);
    
    // Load costPrice from latest batch if available
    if (product.id) {
      this.inventoryDataService.listBatches(product.id).then(batches => {
        if (batches.length > 0) {
          const latestBatch = batches[0]; // Batches are sorted by receivedAt desc
          this.productForm.get('costPrice')?.setValue(Number(latestBatch.costPrice || 0), { emitEvent: false });
        }
      }).catch(err => {
        console.error('Failed to load batches for costPrice:', err);
      });
    }
    
    this.showModal = true;
  }

  toggleControlsForInventory(isMultiple: boolean) {
    if (isMultiple) {
      this.productForm.get('totalStock')?.disable({ emitEvent: false });
      this.productForm.get('sellingPrice')?.disable({ emitEvent: false });
      this.productForm.get('originalPrice')?.disable({ emitEvent: false });
      // Calculate total stock from inventory when switching to multiple inventory mode
      this.updateTotalStockFromInventory();
    } else {
      this.productForm.get('totalStock')?.enable({ emitEvent: false });
      this.productForm.get('sellingPrice')?.enable({ emitEvent: false });
      this.productForm.get('originalPrice')?.enable({ emitEvent: false });
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

    // If there's already a selected batch for editing (from openEditBatch), preserve that
    // Otherwise treat the tab as "add new batch" and reset the form.
    const hasSelectedBatch = !!this.editingBatchOriginalId || !!this.editingBatchDocId;
    if (hasSelectedBatch) {
      // stay in edit mode for the selected batch
      this.isEditingBatch = true;
      // keep editingBatchOriginalId / editingBatchDocId as-is
    } else {
      // Ensure it's in add mode, not edit mode
      this.isEditingBatch = false;
      this.editingBatchOriginalId = null;
      this.editingBatchDocId = null;

      // Reset form for new batch
      this.inventoryForm.reset();
      this.inventoryForm.patchValue({
        receivedAt: new Date().toISOString().split('T')[0]
      });
    }
  }

  async openInventoryModal(product: Product): Promise<void> {
    // Close product modal if open to avoid conflicting UI/state
    this.showModal = false;
    this.selectedProduct = product;
    this.inventoryForm.reset();
    this.inventoryForm.patchValue({
      receivedAt: new Date().toISOString().split('T')[0]
    });
    this.generatedBatchId = this.generateBatchId();
    this.inventoryTab = 'list';
    this.inventorySearch = '';
    try {
      const batches = await this.inventoryDataService.listBatches(product.id!);
      this.setCurrentBatches(batches || []);
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

  async closeInventoryModal(): Promise<void> {
    // Close inventory modal and refresh product data so product list reflects changes
    const storeId = this.selectedProduct?.storeId || this.authService.getCurrentPermission()?.storeId || null;
    this.showInventoryModal = false;
    this.inventoryForm.reset();

    try {
      if (storeId) {
        // Refresh products for this store to update the product list
        await this.productService.refreshProducts(storeId);
      } else if (this.selectedProduct?.id) {
        // As a fallback, refresh the single product
        await this.productService.refreshProducts(this.selectedProduct.storeId || '');
      }
    } catch (e) {
      console.warn('Failed to refresh products after closing inventory modal:', e);
    } finally {
      // Clear selected product after refresh to preserve behavior
      this.selectedProduct = null;
      this.cdr.detectChanges();
    }
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
      
      // Get the values directly from the form (which already has VAT computed via valueChanges)
      const computedSellingPrice = Number(formValue.sellingPrice || 0);
      let computedOriginalPrice = Number(formValue.originalPrice || 0);
      
      console.log('💵 Price calculation debug:', {
        formOriginalPrice: formValue.originalPrice,
        formSellingPrice: formValue.sellingPrice,
        computedSellingPrice: computedSellingPrice,
        computedOriginalPrice: computedOriginalPrice,
        isEditMode: this.isEditMode
      });
      
      // If originalPrice is not set but sellingPrice is, calculate originalPrice (price before VAT)
      if (computedOriginalPrice === 0 && computedSellingPrice > 0) {
        const isVatApplicable = formValue.isVatApplicable ?? true;
        const vatRate = formValue.vatRate ?? AppConstants.DEFAULT_VAT_RATE;
        
        if (isVatApplicable && vatRate > 0) {
          // Original price is the base price (before VAT)
          // Selling price = original price + VAT
          // So: Original price = selling price / (1 + VAT rate)
          computedOriginalPrice = computedSellingPrice / (1 + vatRate / 100);
        } else {
          // No VAT, so selling price = original price
          computedOriginalPrice = computedSellingPrice;
        }
        
        console.log('💰 Derived originalPrice from sellingPrice:', {
          sellingPrice: computedSellingPrice,
          originalPrice: computedOriginalPrice,
          vatRate: vatRate,
          isVatApplicable: isVatApplicable,
          calculation: `${computedSellingPrice} / (1 + ${vatRate}/100) = ${computedOriginalPrice}`
        });
      }

      if (this.isEditMode && this.selectedProduct) {
        // Update existing product
        const updates: Partial<Product> = {
          productName: formValue.productName,
          description: formValue.description,
          skuId: formValue.skuId,
          productCode: formValue.productCode,
          unitType: formValue.unitType,
          category: formValue.category,
          // sellingPrice: for products with existing inventory, prefer the stored summary (cannot edit)
          sellingPrice: this.hasExistingInventory() ? (this.selectedProduct.sellingPrice || computedSellingPrice) : computedSellingPrice,
          // originalPrice: base/unit price stored alongside sellingPrice
          originalPrice: this.hasExistingInventory() ? (this.selectedProduct.originalPrice || computedOriginalPrice) : computedOriginalPrice,
          storeId: storeId,  // Use storeId from permission
          barcodeId: formValue.barcodeId,
          imageUrl: formValue.imageUrl,
          isFavorite: !!formValue.isFavorite,
          // Tax and Discount Fields
          isVatApplicable: formValue.isVatApplicable || false,
          vatRate: formValue.vatRate ?? AppConstants.DEFAULT_VAT_RATE,
          hasDiscount: (formValue.discountValue && Number(formValue.discountValue) > 0) ? (formValue.hasDiscount || false) : false,
          discountType: formValue.discountType || 'percentage',
          discountValue: Number(formValue.discountValue || 0),
          // Product tags
          tags: this.selectedTagIds(),
          tagLabels: this.getSelectedTagLabels()
        };

        console.log('📝 Updating product with tags:', {
          tags: this.selectedTagIds(),
          tagLabels: this.getSelectedTagLabels(),
          availableTags: this.availableTags().length
        });

        // totalStock: only allow editing when product has no separate inventory batches
        if (this.hasExistingInventory()) {
          updates.totalStock = this.selectedProduct.totalStock || 0;
        } else {
          updates.totalStock = Number(formValue.totalStock || 0);
        }

        await this.productService.updateProduct(this.selectedProduct.id!, updates);

        // If no inventory exists and user provided totalStock/costPrice, create an inventory entry
        const currentBatches = await this.inventoryDataService.listBatches(this.selectedProduct.id!);
        if (currentBatches.length === 0 && Number(formValue.totalStock || 0) > 0) {
          console.log('📦 No inventory exists for product, creating initial batch...');
          try {
            const currentPermission = this.authService.getCurrentPermission();
            if (!currentPermission) {
              throw new Error('No permission found');
            }
            const batchData = {
              batchId: this.generateBatchId(),
              quantity: Number(formValue.totalStock || 0),
              unitPrice: Number(formValue.originalPrice || computedOriginalPrice || 0),
              sellingPrice: Number(formValue.sellingPrice || computedSellingPrice || 0),
              costPrice: Number(formValue.costPrice || 0),
              receivedAt: new Date(),
              status: ProductStatus.Active,
              unitType: formValue.unitType || 'pieces',
              companyId: currentPermission.companyId,
              storeId: currentPermission.storeId || '',
              isVatApplicable: formValue.isVatApplicable || false,
              vatRate: formValue.vatRate ?? AppConstants.DEFAULT_VAT_RATE,
              hasDiscount: formValue.hasDiscount || false,
              discountType: formValue.discountType || 'percentage',
              discountValue: Number(formValue.discountValue || 0),
            };
            await this.inventoryDataService.addBatch(this.selectedProduct.id!, batchData);
            console.log('✅ Initial inventory batch created for edited product');
            // Refresh products to update cache
            await this.productService.refreshProducts(currentPermission.storeId || '');
          } catch (batchError) {
            console.error('❌ Failed to create inventory batch for edited product:', batchError);
            this.toastService.error('Product updated but failed to create inventory batch');
          }
        }
        
        } else {
        // Create new product (no embedded inventory)
        const hasInitial = !!(formValue.initialQuantity && formValue.initialQuantity > 0);
        const initialBatch = hasInitial ? {
          batchId: formValue.initialBatchId || this.generateBatchId(), // Use proper batch ID generator
          quantity: Number(formValue.initialQuantity || 0),
          unitPrice: Number(formValue.originalPrice || 0),
          costPrice: Number(formValue.initialCostPrice || 0),
          receivedAt: formValue.initialReceivedAt ? new Date(formValue.initialReceivedAt) : new Date(), // Default to now if not specified
          expiryDate: formValue.initialExpiryDate ? new Date(formValue.initialExpiryDate) : undefined,
          supplier: formValue.initialSupplier || undefined,
          status: ProductStatus.Active
        } : null;

        // Get current user for UID
        const currentUser = this.authService.getCurrentUser();
        console.log('🔍 Current user check:', currentUser ? { uid: currentUser.uid, email: currentUser.email } : 'NULL');
        if (!currentUser) {
          throw new Error('User not authenticated');
        }
        
        const currentPermission = this.authService.getCurrentPermission();
        console.log('🔍 Current permission check:', currentPermission ? { companyId: currentPermission.companyId, storeId: currentPermission.storeId } : 'NULL');

        const newProduct: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> = {
          uid: currentUser.uid,  // Required by Product interface
          productName: formValue.productName,
          description: formValue.description,
          skuId: formValue.skuId,
          productCode: formValue.productCode,
          unitType: formValue.unitType,
          category: formValue.category,
          sellingPrice: computedSellingPrice,
          originalPrice: computedOriginalPrice,
          companyId: '', // Will be set by service
          storeId: storeId,  // Use storeId from permission
          barcodeId: formValue.barcodeId,
          imageUrl: formValue.imageUrl,
          isFavorite: !!formValue.isFavorite,
          totalStock: hasInitial ? Number(formValue.initialQuantity || 0) : Number(formValue.totalStock || 0),
          
          // Tax and Discount Fields from form
          isVatApplicable: formValue.isVatApplicable || false,
          vatRate: formValue.vatRate ?? AppConstants.DEFAULT_VAT_RATE,
          hasDiscount: (formValue.discountValue && Number(formValue.discountValue) > 0) ? (formValue.hasDiscount || false) : false,
          discountType: formValue.discountType || 'percentage',
          discountValue: Number(formValue.discountValue || 0),
          
          // Product tags
          tags: this.selectedTagIds(),
          tagLabels: this.getSelectedTagLabels(),
          
          status: ProductStatus.Active
        };

        console.log('🚀 About to create product with data:', newProduct);
        console.log('📝 Creating product with tags:', {
          tags: this.selectedTagIds(),
          tagLabels: this.getSelectedTagLabels(),
          availableTags: this.availableTags().length
        });
        const productId = await this.productService.createProduct(newProduct);
        console.log('✅ Product created successfully with ID:', productId);
        
        // If initial batch exists, create it in separate collection and recompute summary
        if (hasInitial && productId) {
          console.log('🎯 Creating initial inventory batch for new product:', productId);
          console.log('📦 Initial batch data:', initialBatch);
          console.log('🔍 Form values for initial batch:', {
            initialQuantity: formValue.initialQuantity,
            originalPrice: formValue.originalPrice,
            initialCostPrice: formValue.initialCostPrice,
            hasInitial,
            productId
          });
          
          try {
            const batchData = {
              batchId: initialBatch!.batchId,
              quantity: initialBatch!.quantity,
              unitPrice: initialBatch!.unitPrice,
              sellingPrice: Number(formValue.originalPrice || computedSellingPrice || 0),
              costPrice: initialBatch!.costPrice,
              receivedAt: initialBatch!.receivedAt,
              expiryDate: initialBatch!.expiryDate,
              supplier: initialBatch!.supplier,
              status: ProductStatus.Active,
              unitType: formValue.unitType || 'pieces',
              // Preserve VAT metadata on the batch
              isVatApplicable: formValue.isVatApplicable || false,
              vatRate: formValue.vatRate ?? AppConstants.DEFAULT_VAT_RATE,
              companyId: companyId,
              storeId: storeId,
              productId: productId
            };
            console.log('📦 Final batch data being sent to addBatch:', batchData);
            
            await this.inventoryDataService.addBatch(productId, batchData);
            console.log('✅ Initial inventory batch created successfully');
          } catch (batchError) {
            console.error('❌ Failed to create initial inventory batch:', batchError);
            console.error('❌ Error details:', {
              message: batchError instanceof Error ? batchError.message : 'Unknown error',
              stack: batchError instanceof Error ? batchError.stack : undefined,
              batchData: initialBatch
            });
            throw batchError; // Re-throw to show error to user
          }
        } else {
          console.log('⚠️ Initial batch not created:', { hasInitial, productId, initialQuantity: formValue.initialQuantity });
          if (hasInitial && !productId) {
            console.warn('⚠️ Initial inventory requested but no productId returned');
          }
        }
      }

      this.closeModal();
    } catch (error) {
      console.error('Error saving product:', error);
      
      // Log the error
      const currentPermission = this.authService.getCurrentPermission();
      const storeId = currentPermission?.storeId || '';
      const action = this.isEditMode ? 'UPDATE' : 'CREATE';
      const productName = this.productForm.get('productName')?.value || 'Unknown Product';
      
      console.error('Product error:', {
        productId: this.selectedProduct?.id || 'new-product',
        action,
        error: error instanceof Error ? error.message : 'Unknown error',
        storeId
      });
      
      this.toastService.error('Error saving product. Please try again.');
    } finally {
      this.loading = false;
    }
  }

  // Delete the currently selected category from the dropdown
  async deleteSelectedCategory(): Promise<void> {
    const selectedLabel: string = this.productForm.get('category')?.value;
    if (!selectedLabel) {
      this.toastService.error('Please select a category to delete.');
      return;
    }

    const category = this.categoryService.getCategoryByLabel(selectedLabel);
    if (!category || !category.id) {
      this.toastService.error('Selected category not found.');
      return;
    }

    // Use standard confirmation dialog
    this.categoryToDeleteId = category.id;
    this.categoryToDeleteLabel = selectedLabel;
    this.deleteConfirmationData.set({
      title: 'Delete Category',
      message: `Delete category "${selectedLabel}"? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger'
    });
    this.showDeleteConfirmation.set(true);
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
    const batches = await this.inventoryDataService.listBatches(this.selectedProduct.id!);
    this.setCurrentBatches(batches || []);
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
    this.refreshFilteredInventory();
  }

  // Keep list stable and dedup by excluding removed entries; apply search term if present
  private refreshFilteredInventory(): void {
    const term = (this.inventorySearch || '').toLowerCase();
    const base = (this.currentBatches || []).filter(b => b.status !== 'removed');
    this.filteredInventory = !term
      ? base.slice()
      : base.filter(b => (b.batchId || '').toLowerCase().includes(term));
  }

  private setCurrentBatches(batches: ProductInventoryEntry[]): void {
    this.currentBatches = batches || [];
    this.sortCurrentBatchesIfNeeded();
    this.refreshFilteredInventory();
  }

  private sortCurrentBatchesIfNeeded(): void {
    if (!this.currentBatches || this.currentBatches.length <= 1) return;
    // Prefer sorting by batchId descending when batchId follows YYMMDD... pattern
    this.currentBatches.sort((a, b) => {
      const aId = (a.batchId || '').toString();
      const bId = (b.batchId || '').toString();
      // If both look numeric, compare as numbers to ensure proper order
      const aNum = Number(aId.replace(/[^0-9]/g, ''));
      const bNum = Number(bId.replace(/[^0-9]/g, ''));
      if (!isNaN(aNum) && !isNaN(bNum) && aNum !== 0 && bNum !== 0) {
        return bNum - aNum; // newest/bigger first
      }

      // Fallback to receivedAt date (newest first)
      const ta = this.asDate(a.receivedAt)?.getTime() ?? 0;
      const tb = this.asDate(b.receivedAt)?.getTime() ?? 0;
      return tb - ta;
    });
  }

  // --- Helpers to normalize Firestore Timestamp | number | string | Date to Date/input value ---
  private asDate(value: any): Date | null {
    try {
      if (!value) return null;
      // Firestore Timestamp: has toDate()
      if (typeof value === 'object' && value !== null && typeof value.toDate === 'function') {
        return value.toDate();
      }
      // If value is seconds/nanoseconds
      if (typeof value === 'object' && 'seconds' in value && typeof value.seconds === 'number') {
        return new Date((value.seconds as number) * 1000);
      }
      // If it's already a Date
      if (value instanceof Date) return value;
      // If it's a number (ms)
      if (typeof value === 'number') return new Date(value);
      // If it's a string
      if (typeof value === 'string') {
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : d;
      }
      return null;
    } catch {
      return null;
    }
  }

  private toDateInputValue(value: any, fallbackToday = true): string {
    const d = this.asDate(value) ?? (fallbackToday ? new Date() : null);
    if (!d) return '';
    // Format YYYY-MM-DD for input[type=date]
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // Stabilize ngFor rendering to avoid perceived row movement
  trackByBatch(index: number, batch: ProductInventoryEntry): string | number {
    return batch.id || batch.batchId || index;
  }

  openEditBatch(batch: ProductInventoryEntry): void {
    if (!this.selectedProduct) return;
    // Ensure batches are sorted so index 0 is the latest
    this.sortCurrentBatchesIfNeeded();

    const isLatestBatch = this.currentBatches.length > 0 && this.currentBatches[0].batchId === batch.batchId;

    if (!isLatestBatch) {
      this.toastService.error('You can only edit the most recent inventory batch.');
      return;
    }

    this.inventoryTab = 'edit';
    this.isEditingBatch = true;
    this.editingBatchOriginalId = batch.batchId || null;
    this.editingBatchDocId = batch.id || null;
    // Patch form values without emitting valueChanges to avoid triggering recompute subscriptions
    this.inventoryForm.patchValue({
      batchId: batch.batchId,
      quantity: Number(batch.quantity ?? 0),
      unitPrice: Number(batch.unitPrice ?? 0),
      sellingPrice: Number(batch.sellingPrice ?? batch.unitPrice ?? 0),
      costPrice: Number(batch.costPrice ?? 0),
      receivedAt: this.toDateInputValue(batch.receivedAt, true),
      expiryDate: batch.expiryDate ? this.toDateInputValue(batch.expiryDate, false) : '',
      supplier: batch.supplier || '',
      // VAT & Discount
      isVatApplicable: typeof batch.isVatApplicable === 'boolean' ? batch.isVatApplicable : true,
      vatRate: batch.vatRate ?? AppConstants.DEFAULT_VAT_RATE,
      hasDiscount: !!batch.hasDiscount,
      discountType: batch.discountType ?? 'percentage',
      discountValue: batch.discountValue ?? 0
    }, { emitEvent: false });

    try {
      // Ensure consistent values: if a batch.sellingPrice was stored, compute original (unitPrice) from it
      const storedSelling = batch.sellingPrice;
      const isVat = typeof batch.isVatApplicable === 'boolean' ? batch.isVatApplicable : true;
      const vatRate = batch.vatRate ?? AppConstants.DEFAULT_VAT_RATE;
      const hasDisc = !!batch.hasDiscount;
      const discType = batch.discountType ?? 'percentage';
      const discValue = Number(batch.discountValue ?? 0);

      if (storedSelling !== undefined && storedSelling !== null) {
        // Compute original/unit price from saved selling price and set both fields without emitting
        const computedOriginal = this.computeOriginalFromSelling(Number(storedSelling), isVat, Number(vatRate), hasDisc, discType, discValue);
        this.inventoryForm.get('unitPrice')?.setValue(Number(computedOriginal.toFixed(2)), { emitEvent: false });
        this.inventoryForm.get('sellingPrice')?.setValue(Number(Number(storedSelling).toFixed(2)), { emitEvent: false });
      } else {
        // No stored selling price: compute selling from unitPrice
        const unitVal = Number(batch.unitPrice ?? 0);
        const computedSelling = this.computeSellingFromOriginal(unitVal, isVat, Number(vatRate), hasDisc, discType, discValue);
        this.inventoryForm.get('unitPrice')?.setValue(Number(unitVal.toFixed(2)), { emitEvent: false });
        this.inventoryForm.get('sellingPrice')?.setValue(Number(computedSelling.toFixed(2)), { emitEvent: false });
      }

      // Now update validity and UI
      this.inventoryForm.updateValueAndValidity({ onlySelf: false, emitEvent: false });
      this.cdr.detectChanges();
      setTimeout(() => {
        const el = document.getElementById('quantity') as HTMLInputElement | null;
        el?.focus();
        el?.select();
      }, 0);
    } catch (e) { /* ignore */ }
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
          sellingPrice: Number(formValue.sellingPrice || formValue.unitPrice),
          costPrice: Number(formValue.costPrice || 0),
          receivedAt: new Date(formValue.receivedAt),
          expiryDate: formValue.expiryDate ? new Date(formValue.expiryDate) : undefined,
          supplier: formValue.supplier || undefined,
          status: ProductStatus.Active,
          unitType: this.selectedProduct?.unitType || 'pieces',
          // VAT & Discount metadata
          isVatApplicable: !!formValue.isVatApplicable,
          vatRate: Number(formValue.vatRate ?? AppConstants.DEFAULT_VAT_RATE),
          hasDiscount: (formValue.discountValue && Number(formValue.discountValue) > 0) ? !!formValue.hasDiscount : false,
          discountType: formValue.discountType || 'percentage',
          discountValue: Number(formValue.discountValue || 0)
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
          sellingPrice: Number(formValue.sellingPrice || formValue.unitPrice),
          costPrice: Number(formValue.costPrice || 0),
          receivedAt: new Date(formValue.receivedAt),
          expiryDate: formValue.expiryDate ? new Date(formValue.expiryDate) : undefined,
          supplier: formValue.supplier || undefined,
          status: ProductStatus.Active,
          unitType: this.selectedProduct?.unitType || 'pieces',
          // VAT & Discount metadata
          isVatApplicable: !!formValue.isVatApplicable,
          vatRate: Number(formValue.vatRate ?? AppConstants.DEFAULT_VAT_RATE),
          hasDiscount: (formValue.discountValue && Number(formValue.discountValue) > 0) ? !!formValue.hasDiscount : false,
          discountType: formValue.discountType || 'percentage',
          discountValue: Number(formValue.discountValue || 0),
          companyId: this.selectedProduct.companyId,
          storeId: this.selectedProduct.storeId,
          productId: this.selectedProduct.id!
        });
      }

    // Refresh state and generate new batch ID for next entry
    const batches = await this.inventoryDataService.listBatches(this.selectedProduct.id!);
    this.setCurrentBatches(batches || []);
    
    // Reload the specific product from Firestore to get updated totalStock and sellingPrice
    await this.reloadProductFromFirestore(this.selectedProduct.id!);
    
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
      
      // Log image upload
      const currentPermission = this.authService.getCurrentPermission();
      const storeId = currentPermission?.storeId || '';
      const productId = this.selectedProduct?.id || 'new-product';
      console.log('Image uploaded:', {
        productId,
        url,
        storeId,
        size: compressed.size
      });
      
      // Set the URL in the form
      this.productForm.get('imageUrl')?.setValue(url);
      this.toastService.success('Image uploaded successfully!');
      
    } catch (err: any) {
      console.error('❌ Image upload error:', err);
      
      // Log image upload error
      const currentPermission = this.authService.getCurrentPermission();
      const storeId = currentPermission?.storeId || '';
      const productId = this.selectedProduct?.id || 'new-product';
      console.error('Image upload error:', {
        productId,
        action: 'IMAGE_UPLOAD',
        error: err.message || 'Unknown error',
        storeId
      });
      
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
      console.log('☁️ Starting structured image upload...');
      
      // Get current store ID from permission
      const currentPermission = this.authService.getCurrentPermission();
      const storeId = currentPermission?.storeId || 'default-store';
      
      // Generate product ID if not available (for new products)
      const productId = this.selectedProduct?.id || `temp_${Date.now()}`;
      
      // Get file extension
      const extension = file.name.split('.').pop()?.toLowerCase() || 'png';
      
      // Create structured path: storeId/products/productId.extension
      const fileName = `${storeId}/products/${productId}.${extension}`;
      
      console.log('📤 Uploading file with structure:', {
        storeId,
        productId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        storagePath: fileName
      });
      
      // Dynamic import to avoid top-level SDK usage
      const { getStorage, ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
      const { app } = await import('../../../firebase.config');
      
      const storage = getStorage(app);
      const storageRef = ref(storage, fileName);
      
      // Upload with metadata
      const snapshot = await uploadBytes(storageRef, file, {
        contentType: file.type,
        customMetadata: {
          uploadedBy: this.authService.currentUser()?.uid || 'unknown',
          uploadedAt: new Date().toISOString(),
          storeId: storeId,
          productId: productId,
          imageType: 'product'
        }
      });
      
      console.log('✅ Upload complete, getting download URL...');
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      console.log('✅ Upload complete with structured path:', {
        downloadURL,
        fullPath: fileName,
        size: snapshot.metadata.size || 0
      });
      
      return downloadURL;
    } catch (error: any) {
      console.error('❌ Structured image upload error:', error);
      throw new Error(`Upload failed: ${error.message || 'Unknown error'}`);
    }
  }

    // ===== Per-row Add Photo actions =====
    triggerRowImageUpload(product: Product): void {
      this.pendingPhotoProduct = product;
      const el = document.getElementById('hiddenRowImageFile') as HTMLInputElement | null;
      el?.click();
    }

    async onRowImageFileChange(ev: Event): Promise<void> {
      const input = ev.target as HTMLInputElement;
      if (!input.files || input.files.length === 0) return;
      const file = input.files[0];

      if (!this.pendingPhotoProduct || !this.pendingPhotoProduct.id) {
        this.toastService.error('No product selected for image upload.');
        input.value = '';
        return;
      }

      const originalSelected = this.selectedProduct;
      try {
        this.loading = true;
        this.toastService.info('Compressing and uploading image...');

        // Temporarily set selectedProduct so uploadFileToStorage uses the correct productId
        this.selectedProduct = this.pendingPhotoProduct;
        const compressed = await this.compressImage(file, 1024 * 1024);
        const url = await this.uploadFileToStorage(compressed);

        await this.productService.updateProduct(this.pendingPhotoProduct.id!, { imageUrl: url });

        // Refresh list copy from service
        const updated = this.productService.getProduct(this.pendingPhotoProduct.id!);
        if (updated) {
          // No need to manually filter - computed signal handles this automatically
        }

        // Log upload
        const currentPermission = this.authService.getCurrentPermission();
        const storeId = currentPermission?.storeId || '';
        console.log('Product photo updated:', {
          productId: this.pendingPhotoProduct.id!,
          url,
          storeId,
          size: compressed.size
        });

        this.toastService.success('Product photo updated.');
      } catch (err: any) {
        console.error('❌ Row image upload error:', err);
        this.toastService.error(`Image upload failed: ${err?.message || 'Unknown error'}`);
      } finally {
        this.selectedProduct = originalSelected;
        this.pendingPhotoProduct = null;
        input.value = '';
        this.loading = false;
      }
    }

  duplicateProduct(product: Product): void {
    console.log('Duplicating product:', product.productName);
    this.isEditMode = false;
    this.selectedProduct = null;
    
    // Reset tags for duplicate
    this.selectedTagIds.set([]);
    
    // Copy product data but exclude specific fields
    const duplicateData = {
      ...product,
      // Clear identification fields
      productCode: '',
      skuId: '',
      barcodeId: '',
      // Clear tags
      tags: undefined,
      tagLabels: undefined,
      // Clear pricing & inventory fields
      initialReceivedAt: new Date().toISOString().split('T')[0],
      initialBatchId: '',
      initialQuantity: 0,
      totalStock: 0,
      // Don't set prices here - let form initialization handle them
      // Keep other fields like category, description, unit type, VAT settings, etc.
    };
    
    // Reset form and patch with duplicate data
    this.productForm.reset();
    // Remove price fields from duplicateData to let form defaults take over
    const { sellingPrice, originalPrice, ...dataWithoutPrices } = duplicateData;
    this.productForm.patchValue(dataWithoutPrices);
    
    // Ensure defaults are set
    this.productForm.patchValue({
      unitType: duplicateData.unitType || 'pieces',
      category: duplicateData.category || 'General',
      status: ProductStatus.Active,
      isVatApplicable: duplicateData.isVatApplicable ?? true,
      vatRate: duplicateData.vatRate ?? AppConstants.DEFAULT_VAT_RATE,
      hasDiscount: duplicateData.hasDiscount ?? true,
      discountType: duplicateData.discountType || 'percentage',
      discountValue: duplicateData.discountValue ?? 0
    });
    
    // Apply control enabling/disabling based on isMultipleInventory
    this.toggleControlsForInventory(this.productForm.get('isMultipleInventory')?.value);
    
    this.showModal = true;
    this.cdr.detectChanges();
    
    this.toastService.info(`Duplicating "${product.productName}" - Please update product details`);
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
        const productToDelete = this.productToDelete;
        await this.productService.deleteProduct(this.productToDelete.id!);
        
        // Log product deletion
        const currentPermission = this.authService.getCurrentPermission();
        const storeId = currentPermission?.storeId || '';
        console.log('Product deleted:', {
          productId: productToDelete.id!,
          productName: productToDelete.productName,
          storeId
        });
        
        // No need to manually filter - computed signal handles this automatically
        this.toastService.success(`Product "${this.productToDelete.productName}" deleted successfully`);
      } catch (error) {
        console.error('Error deleting product:', error);
        
        // Log the deletion error
        const currentPermission = this.authService.getCurrentPermission();
        const storeId = currentPermission?.storeId || '';
        console.error('Product deletion error:', {
          productId: this.productToDelete.id!,
          action: 'DELETE',
          error: error instanceof Error ? error.message : 'Unknown error',
          storeId
        });
        
        this.toastService.error(ErrorMessages.PRODUCT_DELETE_ERROR);
      }
    } else if (this.pendingBatchId && this.pendingBatchDocId) {
      // Handle batch removal
      await this.performBatchRemoval();
    } else if (this.categoryToDeleteId) {
      // Handle category deletion
      try {
        const label = this.categoryToDeleteLabel || '';
        await this.categoryService.deleteCategory(this.categoryToDeleteId);
        await this.loadCategories();
        if (this.productForm.get('category')?.value === label) {
          this.productForm.patchValue({ category: '' });
        }
        this.toastService.success(`Category "${label}" deleted successfully`);
      } catch (error) {
        console.error('Error deleting category:', error);
        this.toastService.error('Failed to delete category.');
      } finally {
        this.categoryToDeleteId = null;
        this.categoryToDeleteLabel = null;
      }
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
    this.categoryToDeleteId = null;
    this.categoryToDeleteLabel = null;
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
    // No need to manually filter - computed signal handles this automatically
  }

  onSelectedStoreChange(storeId: string): void {
    console.log('Store filter changed to:', storeId);
    this.selectedStore = storeId;
    // Try to initialize products for the selected store to ensure list is in sync
    if (storeId) {
      this.productService.initializeProducts(storeId).catch(err => {
        console.error('Failed to initialize products for store filter change:', err);
      });
    }
    // Force change detection to update filteredProducts UI
    try { this.cdr.detectChanges(); } catch {}
  }

  async refreshProducts(): Promise<void> {
    try {
      this.loading = true;
      
      // Get current permission to access storeId
      const currentPermission = this.authService.getCurrentPermission();
      if (currentPermission?.storeId) {
        // Force reload products from Firestore (real-time listener) so UI reflects latest product docs
        this.currentPage = 1;
        await this.productService.refreshProducts(currentPermission.storeId);
        // Update pagination state based on loaded products
        const count = this.productService.getProducts().length;
        this.hasMore = (count >= this.pageSize);
        // Ensure change detection updates the UI
        try { this.cdr.detectChanges(); } catch {}
      } else {
        console.warn('No storeId available - cannot refresh products from Firestore');
      }
      
      // No need to manually filter - computed signal handles this automatically
    } catch (error) {
      console.error('Error refreshing products:', error);
    } finally {
      this.loading = false;
    }
  }

  // Load next page of products - for real-time service, this is not needed 
  // since all products are loaded initially (limited to 100)
  async loadMoreProducts(): Promise<void> {
    try {
      this.loadingMore = true;
      // With real-time updates, we don't need pagination since we limit to 100 products
      // This method is kept for backward compatibility but essentially does nothing
      console.warn('loadMoreProducts() is deprecated with real-time service - all products are loaded initially');
      // No need to manually filter - computed signal handles this automatically
    } catch (err) {
      console.error('Error in loadMoreProducts:', err);
    } finally {
      this.loadingMore = false;
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
      case ProductStatus.Active:
        return 'px-2 py-1 text-xs rounded-full bg-green-100 text-green-800';
      case ProductStatus.Inactive:
        return 'px-2 py-1 text-xs rounded-full bg-red-100 text-red-800';
      case ProductStatus.Expired:
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

  // ===========================
  // Tag Management Methods
  // ===========================

  onCreateTag(): void {
    this.showCreateTagModal.set(true);
  }

  async onTagSaved(tag: any): Promise<void> {
    this.showCreateTagModal.set(false);
    const storeId = this.authService.getCurrentPermission()?.storeId;
    if (storeId) {
      await this.loadTags(storeId);
    }
    this.toastService.success('Tag created successfully');
  }

  onTagCancelled(): void {
    this.showCreateTagModal.set(false);
  }

  getTagsByGroup(group: string): any[] {
    return this.availableTags().filter(t => t.group === group);
  }

  getCurrentStoreId(): string {
    return this.authService.getCurrentPermission()?.storeId || '';
  }

  // ===========================
  // Select Tags Modal Methods
  // ===========================

  openSelectTagModal(): void {
    this.tempSelectedTagIds = [...this.selectedTagIds()];
    this.selectedTagGroup = '';
    this.showSelectTagModal.set(true);
  }

  closeSelectTagModal(): void {
    this.showSelectTagModal.set(false);
    this.selectedTagGroup = '';
    this.tempSelectedTagIds = [];
  }

  onTagGroupChange(group: string): void {
    this.selectedTagGroup = group;
  }

  getFilteredTags(): ProductTag[] {
    if (!this.selectedTagGroup) return [];
    return this.availableTags().filter(t => 
      t.group === this.selectedTagGroup && t.isActive
    );
  }

  isTagSelected(tagId: string): boolean {
    return this.tempSelectedTagIds.includes(tagId);
  }

  toggleTagSelection(tagId: string): void {
    const index = this.tempSelectedTagIds.indexOf(tagId);
    if (index > -1) {
      this.tempSelectedTagIds.splice(index, 1);
    } else {
      this.tempSelectedTagIds.push(tagId);
    }
  }

  // New method for single tag selection per group
  selectSingleTag(tagId: string): void {
    const selectedTag = this.availableTags().find(t => t.tagId === tagId);
    if (!selectedTag) return;

    // Remove any existing tag from the same group
    this.tempSelectedTagIds = this.tempSelectedTagIds.filter(existingTagId => {
      const existingTag = this.availableTags().find(t => t.tagId === existingTagId);
      return existingTag?.group !== selectedTag.group;
    });

    // Add the new tag
    this.tempSelectedTagIds.push(tagId);
  }

  // Check if the current group already has a tag selected
  isGroupAlreadySelected(): boolean {
    if (!this.selectedTagGroup) return false;
    if (this.tempSelectedTagIds.length === 0) return false;
    
    return this.tempSelectedTagIds.some(tagId => {
      const tag = this.availableTags().find(t => t.tagId === tagId);
      return tag?.group === this.selectedTagGroup;
    });
  }

  saveSelectedTags(): void {
    // Validate: each group should have at most one tag
    const groupsMap = new Map<string, string[]>();
    for (const tagId of this.tempSelectedTagIds) {
      const tag = this.availableTags().find(t => t.tagId === tagId);
      if (tag) {
        if (!groupsMap.has(tag.group)) {
          groupsMap.set(tag.group, []);
        }
        groupsMap.get(tag.group)!.push(tagId);
      }
    }

    // Check for duplicates in any group
    for (const [group, tags] of groupsMap.entries()) {
      if (tags.length > 1) {
        this.toastService.error(`Cannot save: Multiple tags selected from group "${group}". Please select only one tag per group.`);
        return;
      }
    }

    // Update selected tags (replacing, not merging)
    this.selectedTagIds.set([...this.tempSelectedTagIds]);
    this.closeSelectTagModal();
  }

  removeTag(tagId: string): void {
    const currentTags = this.selectedTagIds();
    this.selectedTagIds.set(currentTags.filter(id => id !== tagId));
  }

  getTagLabel(tagId: string): string {
    const tag = this.availableTags().find(t => t.tagId === tagId);
    return tag ? tag.label : tagId;
  }

  getSelectedTagLabels(): string[] {
    return this.selectedTagIds().map(tagId => this.getTagLabel(tagId));
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

  // ===== INVENTORY MANAGEMENT METHODS =====

  /**
   * Check if the current product has existing inventory batches
   * Only returns true if the product has actual inventory batch entries,
   * not just a totalStock value (which can be edited directly)
   */
  hasExistingInventory(): boolean {
    if (!this.selectedProduct?.id) {
      return false; // New product, no existing inventory
    }
    
    // Only check if product has inventory batch entries
    // totalStock without batches should still be editable
    return (this.currentBatches && this.currentBatches.length > 0);
  }

  /**
   * Check if current user can manage inventory (not cashier)
   */
  canManageInventory(): boolean {
    const userRole = this.authService.userRole();
    return userRole !== 'cashier';
  }

  /**
   * Check if current user can create initial inventory (creator, store_manager)
   */
  canCreateInitialInventory(): boolean {
    const userRole = this.authService.userRole();
    return userRole === 'creator' || userRole === 'store_manager';
  }

  /**
   * Open inventory management dialog
   */
  openInventoryManagement(): void {
    if (!this.selectedProduct?.id) {
      this.toastService.error('Please save the product first before managing inventory.');
      return;
    }
    
    // Close the product Edit/Add modal (if open) and open inventory modal so we don't have conflicting forms
    this.showModal = false;
    // Set the selected product and open inventory modal
    this.showInventoryModal = true;
    this.inventoryTab = 'list';
    
    // Load current inventory batches
    this.loadProductInventory(this.selectedProduct.id);
  }

  /**
   * Load product inventory batches
   */
  private async loadProductInventory(productId: string): Promise<void> {
    try {
      this.loading = true;
      
    // Load inventory entries for this product using the existing method
    const inventoryEntries = await this.inventoryDataService.listBatches(productId);
    this.setCurrentBatches(inventoryEntries || []);
      
      console.log(`Loaded ${this.currentBatches.length} inventory batches for product ${productId}`);
    } catch (error) {
      console.error('Error loading product inventory:', error);
      this.toastService.error('Failed to load product inventory');
      this.currentBatches = [];
      this.filteredInventory = [];
    } finally {
      this.loading = false;
    }
  }

}
