import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OfflineDocumentService } from '../core/services/offline-document.service';

@Component({
  selector: 'app-offline-test',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="p-4 bg-gray-100 rounded-lg">
      <h2 class="text-xl font-bold mb-4">🔥 Offline Document Creation Test</h2>
      
      <div class="space-y-4">
        <div>
          <button 
            (click)="testOfflineDocumentCreation()" 
            class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            [disabled]="isLoading"
          >
            {{ isLoading ? 'Testing...' : 'Test Document Creation' }}
          </button>
        </div>

        <div class="p-3 bg-white rounded border">
          <h3 class="font-semibold">Network Status:</h3>
          <p [class]="navigator.onLine ? 'text-green-600' : 'text-red-600'">
            {{ navigator.onLine ? '🌐 Online' : '📱 Offline' }}
          </p>
        </div>

        <div class="p-3 bg-white rounded border" *ngIf="testResults.length > 0">
          <h3 class="font-semibold mb-2">Test Results:</h3>
          <div *ngFor="let result of testResults" class="mb-2 p-2 rounded" 
               [class]="result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'">
            <div class="font-mono text-sm">
              <strong>{{ result.collection }}</strong>: 
              {{ result.success ? '✅' : '❌' }} 
              {{ result.documentId || result.error }}
            </div>
            <div class="text-xs opacity-75">{{ result.mode }} | {{ result.timestamp }}</div>
          </div>
        </div>

        <div class="p-3 bg-white rounded border">
          <h3 class="font-semibold mb-2">Pending Documents:</h3>
          <button 
            (click)="checkPendingDocuments()" 
            class="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
          >
            Check Pending ({{ pendingCount }})
          </button>
          
          <button 
            (click)="syncDocuments()" 
            class="ml-2 px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
            [disabled]="!navigator.onLine"
          >
            Sync to Firestore
          </button>
          
          <button 
            (click)="clearPending()" 
            class="ml-2 px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
          >
            Clear All
          </button>
        </div>

        <div class="p-3 bg-yellow-50 border border-yellow-200 rounded" *ngIf="syncResult">
          <h4 class="font-semibold text-yellow-800">Sync Result:</h4>
          <p class="text-yellow-700">{{ syncResult }}</p>
        </div>
      </div>
    </div>
  `
})
export class OfflineTestComponent {
  private offlineDocService = inject(OfflineDocumentService);

  isLoading = false;
  testResults: any[] = [];
  pendingCount = 0;
  syncResult = '';
  navigator = navigator; // Make navigator available in template

  async testOfflineDocumentCreation() {
    this.isLoading = true;
    this.testResults = [];

    const testCases = [
      { collection: 'products', data: { name: 'Test Product', price: 100, category: 'test' } },
      { collection: 'customers', data: { name: 'Test Customer', email: 'test@example.com' } },
      { collection: 'orders', data: { total: 150, status: 'pending', items: [] } }
    ];

    for (const testCase of testCases) {
      try {
        const documentId = await this.offlineDocService.createDocument(testCase.collection, testCase.data);
        
        this.testResults.push({
          collection: testCase.collection,
          success: true,
          documentId,
          mode: navigator.onLine ? 'Online' : 'Offline',
          timestamp: new Date().toLocaleTimeString()
        });
        
      } catch (error) {
        this.testResults.push({
          collection: testCase.collection,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          mode: navigator.onLine ? 'Online' : 'Offline',
          timestamp: new Date().toLocaleTimeString()
        });
      }
    }

    this.checkPendingDocuments();
    this.isLoading = false;
  }

  checkPendingDocuments() {
    const pending = this.offlineDocService.getPendingDocuments();
    this.pendingCount = pending.filter(doc => !doc.synced).length;
    console.log('📋 Pending documents:', pending);
  }

  async syncDocuments() {
    if (!navigator.onLine) {
      this.syncResult = 'Cannot sync - device is offline';
      return;
    }

    try {
      const result = await this.offlineDocService.syncOfflineDocuments();
      this.syncResult = `Synced: ${result.synced}, Failed: ${result.failed}`;
      this.checkPendingDocuments();
    } catch (error) {
      this.syncResult = `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  clearPending() {
    this.offlineDocService.clearPendingDocuments();
    this.checkPendingDocuments();
    this.syncResult = 'All pending documents cleared';
  }
}