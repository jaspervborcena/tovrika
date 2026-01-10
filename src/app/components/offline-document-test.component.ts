import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { inject } from '@angular/core';
import { OfflineDocumentService } from '../core/services/offline-document.service';
import { ProductService } from '../services/product.service';
import { AuthService } from '../services/auth.service';
import { ProductStatus } from '../interfaces/product.interface';

@Component({
  selector: 'app-offline-document-test',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="p-6 bg-white shadow-md rounded-lg">
      <h2 class="text-2xl font-bold mb-4">🔥 Offline Document Creation Test</h2>
      
      <div class="mb-4">
        <strong>Connection Status:</strong> 
        <span [class]="isOnline ? 'text-green-600' : 'text-red-600'">
          {{ isOnline ? '🌐 Online' : '📱 Offline' }}
        </span>
      </div>

      <div class="space-y-4">
        <button 
          (click)="createTestProduct()" 
          class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
          Create Test Product (ID Pre-Generated)
        </button>

        <button 
          (click)="showPendingDocuments()" 
          class="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600">
          Show Pending Documents
        </button>

        <button 
          (click)="syncDocuments()" 
          class="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          [disabled]="!isOnline">
          Sync Offline Documents
        </button>

        <button 
          (click)="clearPending()" 
          class="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">
          Clear Pending Documents
        </button>

        <button 
          (click)="toggleOfflineMode()" 
          class="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600">
          {{ isOnline ? 'Simulate Offline' : 'Simulate Online' }}
        </button>
      </div>

      <div class="mt-6" *ngIf="testResults.length > 0">
        <h3 class="text-lg font-semibold mb-2">Test Results:</h3>
        <div class="space-y-2">
          <div *ngFor="let result of testResults" 
               class="p-3 rounded border-l-4"
               [class.border-green-500]="result.success"
               [class.border-red-500]="!result.success"
               [class.bg-green-50]="result.success"
               [class.bg-red-50]="!result.success">
            <strong>{{ result.action }}:</strong> {{ result.message }}
            <div *ngIf="result.documentId" class="text-sm text-gray-600">
              Document ID: {{ result.documentId }}
            </div>
          </div>
        </div>
      </div>

      <div class="mt-6" *ngIf="pendingDocs.length > 0">
        <h3 class="text-lg font-semibold mb-2">Pending Documents ({{ pendingDocs.length }}):</h3>
        <div class="space-y-2">
          <div *ngFor="let doc of pendingDocs" class="p-2 bg-gray-100 rounded">
            <div><strong>ID:</strong> {{ doc.id }}</div>
            <div><strong>Collection:</strong> {{ doc.collectionName }}</div>
            <div><strong>Synced:</strong> {{ doc.synced ? '✅' : '⏳' }}</div>
            <div><strong>Created:</strong> {{ doc.createdAt | date:'short' }}</div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class OfflineDocumentTestComponent {
  private offlineDocService = inject(OfflineDocumentService);
  private productService = inject(ProductService);
  private authService = inject(AuthService);

  isOnline = navigator.onLine;
  testResults: any[] = [];
  pendingDocs: any[] = [];
  
  constructor() {
    // Listen for online/offline events
    window.addEventListener('online', () => this.isOnline = true);
    window.addEventListener('offline', () => this.isOnline = false);
  }

  async createTestProduct() {
    try {
      // Get current user for UID
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const testProduct = {
        uid: currentUser.uid,  // Add UID for security rules
        productName: `Test Product ${Date.now()}`,
        description: 'Test product created with pre-generated ID',
        skuId: `SKU-${Date.now()}`,
        unitType: 'pieces' as const,
        category: 'Test',
        totalStock: 100,
        sellingPrice: 25.99,
        originalPrice: 25.99,
        costPrice: 20,
        companyId: 'test-company-id', // Required field
        storeId: 'test-store-id',
        barcodeId: `BAR-${Date.now()}`,
        imageUrl: '',
        inventory: [],
        isVatApplicable: false,
        vatRate: 0,
        hasDiscount: false,
        discountType: 'percentage' as const,
        discountValue: 0,
        status: ProductStatus.Active
      };

      const documentId = await this.productService.createProduct(testProduct);
      
      this.testResults.unshift({
        action: 'Create Product',
        message: `Product created successfully ${this.isOnline ? 'online' : 'offline'}`,
        documentId,
        success: true,
        timestamp: new Date()
      });

    } catch (error) {
      this.testResults.unshift({
        action: 'Create Product',
        message: `Failed: ${error}`,
        success: false,
        timestamp: new Date()
      });
    }
  }

  showPendingDocuments() {
    this.pendingDocs = this.offlineDocService.getPendingDocuments();
    this.testResults.unshift({
      action: 'Show Pending',
      message: `Found ${this.pendingDocs.length} pending documents`,
      success: true,
      timestamp: new Date()
    });
  }

  async syncDocuments() {
    if (!this.isOnline) {
      this.testResults.unshift({
        action: 'Sync Documents',
        message: 'Cannot sync while offline',
        success: false,
        timestamp: new Date()
      });
      return;
    }

    try {
      const result = await this.offlineDocService.syncOfflineDocuments();
      this.testResults.unshift({
        action: 'Sync Documents',
        message: `Synced ${result.synced} documents, ${result.failed} failed`,
        success: result.failed === 0,
        timestamp: new Date()
      });
      
      // Refresh pending documents
      this.showPendingDocuments();
      
    } catch (error) {
      this.testResults.unshift({
        action: 'Sync Documents',
        message: `Sync failed: ${error}`,
        success: false,
        timestamp: new Date()
      });
    }
  }

  clearPending() {
    this.offlineDocService.clearPendingDocuments();
    this.pendingDocs = [];
    this.testResults.unshift({
      action: 'Clear Pending',
      message: 'All pending documents cleared',
      success: true,
      timestamp: new Date()
    });
  }

  toggleOfflineMode() {
    // Simulate online/offline mode by overriding navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: !this.isOnline
    });
    this.isOnline = !this.isOnline;
    
    this.testResults.unshift({
      action: 'Toggle Mode',
      message: `Switched to ${this.isOnline ? 'online' : 'offline'} mode (simulated)`,
      success: true,
      timestamp: new Date()
    });
  }
}