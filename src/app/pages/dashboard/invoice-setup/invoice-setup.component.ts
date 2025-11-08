import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoreService } from '../../../services/store.service';
import { InvoiceService } from '../../../services/invoice.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-invoice-setup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="invoice-setup-container">
      <div class="setup-header">
        <h2>🧾 Invoice Number Management</h2>
        <p>Initialize and manage invoice numbers for your stores</p>
      </div>

      <div class="setup-content">
        <!-- Store List with Invoice Status -->
        <div class="stores-section">
          <h3>Stores Invoice Status</h3>
          <div class="stores-list" *ngIf="stores.length > 0">
            <div class="store-card" *ngFor="let store of stores">
              <div class="store-info">
                <h4>{{ store.storeName }}</h4>
                <p class="store-code">{{ store.id }}</p>
                <div class="invoice-status">
                  <span class="label">Current Invoice:</span>
                  <span class="invoice-number" [class.not-set]="!store.invoiceNo">
                    {{ store.invoiceNo || 'Not Set' }}
                  </span>
                </div>
              </div>
              <div class="store-actions">
                <button 
                  *ngIf="!store.invoiceNo" 
                  (click)="initializeStore(store.id!)"
                  [disabled]="isProcessing"
                  class="init-btn">
                  Initialize
                </button>
                <button 
                  (click)="previewNextInvoice(store.id!)"
                  class="preview-btn">
                  Preview Next
                </button>
                <button
                  (click)="openBirModal(store)"
                  class="view-bir-btn">
                  View BIR
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- BIR Compliance View-Only Modal -->
        <div *ngIf="showBirModal()" class="bir-modal-overlay" (click)="closeBirModal()">
          <div class="bir-modal-content" (click)="$event.stopPropagation()">
            <div class="bir-modal-header">
              <h3>BIR Compliance (View Only)</h3>
              <button class="bir-close-btn" (click)="closeBirModal()">×</button>
            </div>
            <div class="bir-modal-body">
              <div *ngIf="birModalData">
                <h4>{{ birModalData.storeName || birModalData.id }}</h4>
                <pre style="white-space:pre-wrap">{{ birModalData.birDetails | json }}</pre>
              </div>
              <div *ngIf="!birModalData">
                <p>No BIR data available for this store.</p>
              </div>
            </div>
            <div class="bir-modal-footer">
              <button class="init-all-btn" (click)="closeBirModal()">Close</button>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="actions-section">
          <button 
            (click)="initializeAllStores()"
            [disabled]="isProcessing"
            class="init-all-btn">
            {{ isProcessing ? 'Processing...' : 'Initialize All Missing' }}
          </button>
          
          <button 
            (click)="testInvoiceTransaction()"
            [disabled]="isProcessing || !selectedStoreId"
            class="test-btn">
            🧪 Test Transaction
          </button>
        </div>

        <!-- Test Results -->
        <div class="results-section" *ngIf="testResults.length > 0">
          <h3>Test Results</h3>
          <div class="test-result" *ngFor="let result of testResults">
            <pre>{{ result | json }}</pre>
          </div>
        </div>

        <!-- Store Selection for Testing -->
        <div class="store-selector" *ngIf="stores.length > 0">
          <label>Select Store for Testing:</label>
          <select [(ngModel)]="selectedStoreId" class="store-select">
            <option value="">Select a store...</option>
            <option *ngFor="let store of stores" [value]="store.id">
              {{ store.storeName }}
            </option>
          </select>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .invoice-setup-container {
      padding: 20px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .setup-header {
      text-align: center;
      margin-bottom: 30px;
    }

    .setup-header h2 {
      color: #2563eb;
      margin-bottom: 10px;
    }

    .stores-section {
      margin-bottom: 30px;
    }

    .stores-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
    }

    .store-card {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 20px;
      background: white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .store-info h4 {
      margin: 0 0 5px 0;
      color: #1f2937;
    }

    .store-code {
      color: #6b7280;
      font-size: 0.9rem;
      margin: 0 0 15px 0;
    }

    .invoice-status {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 15px;
    }

    .label {
      font-weight: 500;
      color: #374151;
    }

    .invoice-number {
      padding: 4px 8px;
      border-radius: 4px;
      background: #dcfce7;
      color: #166534;
      font-family: monospace;
    }

    .invoice-number.not-set {
      background: #fee2e2;
      color: #dc2626;
    }

    .store-actions {
      display: flex;
      gap: 10px;
    }

    .init-btn, .preview-btn {
      padding: 6px 12px;
      border-radius: 4px;
      border: none;
      cursor: pointer;
      font-size: 0.875rem;
    }

    .init-btn {
      background: #2563eb;
      color: white;
    }

    .preview-btn {
      background: #f3f4f6;
      color: #374151;
    }

    .actions-section {
      display: flex;
      gap: 15px;
      margin-bottom: 30px;
    }

    .init-all-btn, .test-btn {
      padding: 12px 24px;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      font-weight: 500;
    }

    .init-all-btn {
      background: #059669;
      color: white;
    }

    .test-btn {
      background: #dc2626;
      color: white;
    }

    .store-selector {
      margin-bottom: 20px;
    }

    .store-select {
      padding: 8px 12px;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      margin-left: 10px;
    }

    .results-section {
      background: #f9fafb;
      padding: 20px;
      border-radius: 8px;
    }

    .test-result {
      background: white;
      padding: 15px;
      border-radius: 4px;
      margin-bottom: 10px;
    }

    .test-result pre {
      margin: 0;
      font-size: 0.875rem;
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Reused order-items table styles (patterned after Sales Summary) */
    .order-items-table-wrapper {
      overflow: auto;
      max-height: 44vh; /* allow modal/dialog scrolling */
      border: 1px solid #e8eef6;
      border-radius: 8px;
      background: white;
      padding: 8px;
      margin-top: 12px;
    }

    .order-items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
      table-layout: auto;
    }

    .order-items-table thead th {
      background: #f7fafc;
      padding: 10px 12px;
      text-align: left;
      font-weight: 600;
      color: #4a5568;
      font-size: 12px;
      text-transform: uppercase;
      border-bottom: 1px solid #e2e8f0;
    }

    .order-items-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #f1f5f9;
      color: #2d3748;
      vertical-align: middle;
    }

    .order-items-table .mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', 'Courier New', monospace;
      font-size: 13px;
      color: #2b6cb0;
    }

    /* BIR View-Only Modal styles (patterned after Sales Summary modal) */
    .bir-modal-overlay {
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
      padding: 20px;
    }

    .bir-modal-content {
      background: white;
      border-radius: 12px;
      max-width: 720px;
      width: 100%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      position: relative;
      display: flex;
      flex-direction: column;
    }

    .bir-modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 18px 20px;
      border-bottom: 1px solid #e2e8f0;
    }

    .bir-modal-header h3 {
      margin: 0;
      color: #2d3748;
      font-size: 18px;
      font-weight: 700;
    }

    .bir-close-btn {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #718096;
      padding: 4px;
      line-height: 1;
    }

    .bir-close-btn:hover {
      color: #4a5568;
      transform: scale(1.05);
    }

    .bir-modal-body {
      padding: 18px 20px;
      color: #374151;
    }

    .bir-modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 16px 20px;
      border-top: 1px solid #e2e8f0;
      background: #fafafa;
      border-bottom-left-radius: 12px;
      border-bottom-right-radius: 12px;
    }

    .view-bir-btn {
      padding: 6px 10px;
      border-radius: 6px;
      border: 1px solid #d1d5db;
      background: white;
      cursor: pointer;
    }

    .view-bir-btn:hover {
      background: #f3f4f6;
    }
  `]
})
export class InvoiceSetupComponent implements OnInit {
  private storeService = inject(StoreService);
  private invoiceService = inject(InvoiceService);
  private authService = inject(AuthService);

  stores: any[] = [];
  isProcessing = false;
  testResults: any[] = [];
  selectedStoreId = '';
  // BIR modal state
  showBirModal = signal(false);
  birModalData: any = null;

  async ngOnInit() {
    await this.loadStores();
  }

  async loadStores() {
    try {
      const currentPermission = this.authService.getCurrentPermission();
      if (currentPermission?.companyId) {
        await this.storeService.loadStoresByCompany(currentPermission.companyId);
        this.stores = this.storeService.getStores();
      }
    } catch (error) {
      console.error('Error loading stores:', error);
    }
  }

  async initializeStore(storeId: string) {
    try {
      this.isProcessing = true;
      await this.storeService.initializeInvoiceNoForStore(storeId);
      await this.loadStores(); // Refresh the list
      console.log('✅ Store initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing store:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  async initializeAllStores() {
    try {
      this.isProcessing = true;
      const currentUser = this.authService.getCurrentUser();
      const currentPermission = this.authService.getCurrentPermission();
      
      if (currentPermission?.companyId) {
        await this.invoiceService.initializeInvoiceNumbers(currentPermission.companyId);
        await this.loadStores(); // Refresh the list
        console.log('✅ All stores initialized successfully');
      }
    } catch (error) {
      console.error('❌ Error initializing all stores:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  async previewNextInvoice(storeId: string) {
    try {
      const nextInvoice = await this.invoiceService.getNextInvoiceNumberPreview(storeId);
      const store = this.stores.find(s => s.id === storeId);
      
      this.testResults.unshift({
        action: 'Preview Next Invoice',
        store: store?.storeName || 'Unknown',
        currentInvoice: store?.invoiceNo || 'Not set',
        nextInvoice: nextInvoice,
        timestamp: new Date().toLocaleString()
      });
    } catch (error) {
      console.error('Error previewing next invoice:', error);
    }
  }

  async testInvoiceTransaction() {
    if (!this.selectedStoreId) return;
    
    try {
      this.isProcessing = true;
      
      // Create test order data
      const testOrderData = {
        companyId: this.authService.getCurrentPermission()?.companyId || 'test-company',
        assignedCashierId: this.authService.getCurrentUser()?.uid || 'test-user',
        status: 'paid',
        cashSale: true,
        soldTo: 'Test Customer',
        tin: '',
        businessAddress: '',
        date: new Date(),
        vatableSales: 100,
        vatAmount: 12,
        zeroRatedSales: 0,
        vatExemptAmount: 0,
        discountAmount: 0,
        grossAmount: 100,
        netAmount: 112,
        totalAmount: 112,
        items: [
          {
            productId: 'test-product',
            productName: 'Test Product',
            quantity: 1,
            price: 100,
            total: 100,
            vat: 12,
            discount: 0,
            isVatExempt: false
          }
        ],
        atpOrOcn: 'TEST-OCN-001',
        birPermitNo: 'TEST-PERMIT-001',
        inclusiveSerialNumber: '000001-000999',
        message: 'Test transaction'
      };

      // Test the invoice transaction
      const result = await this.invoiceService.processInvoiceTransaction({
        storeId: this.selectedStoreId,
        orderData: testOrderData,
        customerInfo: { soldTo: 'Test Customer' }
      });

      this.testResults.unshift({
        action: 'Test Invoice Transaction',
        store: this.stores.find(s => s.id === this.selectedStoreId)?.storeName || 'Unknown',
        result: result,
        timestamp: new Date().toLocaleString()
      });

      // Refresh stores to see updated invoice numbers
      await this.loadStores();
      
    } catch (error) {
      console.error('❌ Test transaction failed:', error);
      this.testResults.unshift({
        action: 'Test Transaction Failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toLocaleString()
      });
    } finally {
      this.isProcessing = false;
    }
  }

  // Open/view-only BIR modal for a store
  openBirModal(store: any) {
    this.birModalData = store || null;
    this.showBirModal.set(true);
  }

  closeBirModal() {
    this.showBirModal.set(false);
    this.birModalData = null;
  }
}