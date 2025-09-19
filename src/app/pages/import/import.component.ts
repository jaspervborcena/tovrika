import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { doc, setDoc, collection } from 'firebase/firestore';
import { db } from '../../firebase.config';
import { ToastService } from '../../shared/services/toast.service';
import { ErrorMessages } from '../../shared/enums/notification-messages.enum';

interface FirestoreDocument {
  fields: {
    [key: string]: {
      stringValue?: string;
      timestampValue?: string;
      numberValue?: number;
      booleanValue?: boolean;
    };
  };
}

@Component({
  selector: 'app-import',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="import-container">
      <div class="import-card">
        <!-- Header -->
        <div class="header">
          <div class="header-content">
            <h1 class="page-title">🔧 Data Import Utility</h1>
            <p class="page-subtitle">Import predefined data from JSON files into Firestore</p>
          </div>
        </div>

        <!-- Import Section -->
        <div class="import-section">
          <div class="upload-area" 
               [class.dragover]="isDragOver"
               (dragover)="onDragOver($event)"
               (dragleave)="onDragLeave($event)"
               (drop)="onDrop($event)">
            
            <div class="upload-content">
              <div class="upload-icon">📁</div>
              <h3>Drop JSON file here or click to browse</h3>
              <p>Supports Firestore document format with fields structure</p>
              
              <input 
                type="file" 
                #fileInput 
                accept=".json"
                (change)="onFileSelected($event)"
                style="display: none;">
              
              <button 
                type="button" 
                class="btn btn-primary" 
                (click)="fileInput.click()"
                [disabled]="isProcessing">
                Select JSON File
              </button>
            </div>
          </div>

          <!-- File Info -->
          <div *ngIf="selectedFile" class="file-info">
            <div class="file-details">
              <h4>📄 Selected File</h4>
              <p><strong>Name:</strong> {{ selectedFile.name }}</p>
              <p><strong>Size:</strong> {{ formatFileSize(selectedFile.size) }}</p>
              <p><strong>Type:</strong> {{ selectedFile.type || 'application/json' }}</p>
            </div>
          </div>

          <!-- Preview -->
          <div *ngIf="parsedData.length > 0" class="preview-section">
            <h4>📋 Preview ({{ parsedData.length }} documents)</h4>
            <div class="preview-list">
              <div *ngFor="let doc of parsedData.slice(0, 3); let i = index" class="preview-item">
                <h5>Document {{ i + 1 }}</h5>
                <pre>{{ formatDocumentPreview(doc) }}</pre>
              </div>
              <div *ngIf="parsedData.length > 3" class="more-docs">
                ... and {{ parsedData.length - 3 }} more documents
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div *ngIf="parsedData.length > 0" class="actions-section">
            <div class="collection-input">
              <label for="collection">Target Collection:</label>
              <input 
                type="text" 
                id="collection"
                [(ngModel)]="targetCollection"
                class="form-input"
                placeholder="Enter collection name (e.g., predefinedTypes)">
            </div>

            <div class="action-buttons">
              <button 
                type="button" 
                class="btn btn-success" 
                (click)="importData()"
                [disabled]="isProcessing || !targetCollection.trim()">
                <span *ngIf="!isProcessing">🚀 Import {{ parsedData.length }} Documents</span>
                <span *ngIf="isProcessing">⏳ Importing... {{ importProgress }}/{{ parsedData.length }}</span>
              </button>
              
              <button 
                type="button" 
                class="btn btn-secondary" 
                (click)="clearData()"
                [disabled]="isProcessing">
                🗑️ Clear
              </button>
            </div>
          </div>

          <!-- Progress -->
          <div *ngIf="isProcessing" class="progress-section">
            <div class="progress-bar">
              <div class="progress-fill" [style.width.%]="progressPercentage"></div>
            </div>
            <p class="progress-text">{{ importProgress }}/{{ parsedData.length }} documents imported</p>
          </div>

          <!-- Results -->
          <div *ngIf="importResults.length > 0" class="results-section">
            <h4>📊 Import Results</h4>
            <div class="results-summary">
              <div class="result-stat success">
                <span class="stat-value">{{ successCount }}</span>
                <span class="stat-label">Successful</span>
              </div>
              <div class="result-stat error">
                <span class="stat-value">{{ errorCount }}</span>
                <span class="stat-label">Failed</span>
              </div>
            </div>
            
            <div *ngIf="errorCount > 0" class="error-details">
              <h5>❌ Errors:</h5>
              <div *ngFor="let result of importResults" class="error-item">
                <div *ngIf="result.error">
                  <strong>Document {{ result.index + 1 }}:</strong> {{ result.error }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Navigation -->
        <div class="navigation-section">
          <button 
            type="button" 
            class="btn btn-outline" 
            (click)="goBack()">
            ← Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .import-container {
      min-height: 100vh;
      background: #f8fafc;
      padding: 2rem 1rem;
    }

    .import-card {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }

    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 2rem;
      text-align: center;
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

    .import-section {
      padding: 2rem;
    }

    .upload-area {
      border: 2px dashed #cbd5e0;
      border-radius: 12px;
      padding: 3rem 2rem;
      text-align: center;
      background: #f8fafc;
      transition: all 0.3s ease;
      cursor: pointer;
    }

    .upload-area:hover,
    .upload-area.dragover {
      border-color: #667eea;
      background: #f0f4ff;
      transform: translateY(-2px);
    }

    .upload-content h3 {
      color: #2d3748;
      margin: 1rem 0 0.5rem 0;
    }

    .upload-content p {
      color: #718096;
      margin: 0 0 2rem 0;
    }

    .upload-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }

    .file-info {
      background: #f0f4ff;
      border-radius: 8px;
      padding: 1.5rem;
      margin: 2rem 0;
      border-left: 4px solid #667eea;
    }

    .file-info h4 {
      margin: 0 0 1rem 0;
      color: #2d3748;
    }

    .file-info p {
      margin: 0.5rem 0;
      color: #4a5568;
    }

    .preview-section {
      margin: 2rem 0;
      padding: 1.5rem;
      background: #f8fafc;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }

    .preview-section h4 {
      margin: 0 0 1rem 0;
      color: #2d3748;
    }

    .preview-item {
      background: white;
      border-radius: 6px;
      padding: 1rem;
      margin: 1rem 0;
      border: 1px solid #e2e8f0;
    }

    .preview-item h5 {
      margin: 0 0 0.5rem 0;
      color: #4a5568;
      font-size: 0.9rem;
    }

    .preview-item pre {
      background: #f7fafc;
      padding: 1rem;
      border-radius: 4px;
      font-size: 0.85rem;
      overflow-x: auto;
      margin: 0;
      color: #2d3748;
    }

    .more-docs {
      text-align: center;
      color: #718096;
      font-style: italic;
      padding: 1rem;
    }

    .actions-section {
      margin: 2rem 0;
      padding: 1.5rem;
      background: #f0f4ff;
      border-radius: 8px;
      border: 1px solid #c3dafe;
    }

    .collection-input {
      margin-bottom: 1.5rem;
    }

    .collection-input label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 600;
      color: #2d3748;
    }

    .form-input {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 1rem;
      transition: border-color 0.2s;
    }

    .form-input:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .action-buttons {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .progress-section {
      margin: 2rem 0;
      padding: 1.5rem;
      background: #fff5f5;
      border-radius: 8px;
      border: 1px solid #fed7d7;
    }

    .progress-bar {
      width: 100%;
      height: 8px;
      background: #e2e8f0;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 1rem;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #667eea, #764ba2);
      transition: width 0.3s ease;
    }

    .progress-text {
      text-align: center;
      color: #2d3748;
      font-weight: 500;
      margin: 0;
    }

    .results-section {
      margin: 2rem 0;
      padding: 1.5rem;
      background: #f0fff4;
      border-radius: 8px;
      border: 1px solid #c6f6d5;
    }

    .results-section h4 {
      margin: 0 0 1rem 0;
      color: #2d3748;
    }

    .results-summary {
      display: flex;
      gap: 2rem;
      margin-bottom: 1.5rem;
    }

    .result-stat {
      text-align: center;
      padding: 1rem;
      border-radius: 8px;
      min-width: 100px;
    }

    .result-stat.success {
      background: #f0fff4;
      border: 1px solid #9ae6b4;
    }

    .result-stat.error {
      background: #fff5f5;
      border: 1px solid #feb2b2;
    }

    .stat-value {
      display: block;
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
    }

    .stat-label {
      font-size: 0.875rem;
      color: #4a5568;
    }

    .error-details {
      background: white;
      border-radius: 6px;
      padding: 1rem;
      border: 1px solid #e2e8f0;
    }

    .error-details h5 {
      margin: 0 0 1rem 0;
      color: #e53e3e;
    }

    .error-item {
      padding: 0.5rem 0;
      border-bottom: 1px solid #f7fafc;
      font-size: 0.9rem;
      color: #2d3748;
    }

    .navigation-section {
      padding: 1.5rem 2rem;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
    }

    .btn {
      border: none;
      border-radius: 6px;
      padding: 0.75rem 1.5rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      text-decoration: none;
      font-size: 1rem;
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-primary {
      background: #667eea;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #5a6fd8;
      transform: translateY(-1px);
    }

    .btn-success {
      background: #48bb78;
      color: white;
    }

    .btn-success:hover:not(:disabled) {
      background: #38a169;
      transform: translateY(-1px);
    }

    .btn-secondary {
      background: #e2e8f0;
      color: #4a5568;
    }

    .btn-secondary:hover:not(:disabled) {
      background: #cbd5e0;
    }

    .btn-outline {
      background: transparent;
      color: #667eea;
      border: 1px solid #667eea;
    }

    .btn-outline:hover {
      background: #667eea;
      color: white;
    }

    @media (max-width: 768px) {
      .import-container {
        padding: 1rem;
      }

      .header {
        padding: 1.5rem;
      }

      .page-title {
        font-size: 2rem;
      }

      .import-section {
        padding: 1.5rem;
      }

      .upload-area {
        padding: 2rem 1rem;
      }

      .action-buttons {
        flex-direction: column;
      }

      .results-summary {
        flex-direction: column;
        gap: 1rem;
      }
    }
  `]
})
export class ImportComponent {
  private router = inject(Router);
  private toastService = inject(ToastService);

  selectedFile: File | null = null;
  parsedData: FirestoreDocument[] = [];
  targetCollection = 'predefinedTypes';
  isProcessing = false;
  isDragOver = false;
  importProgress = 0;
  importResults: Array<{index: number, success: boolean, error?: string}> = [];

  get progressPercentage(): number {
    return this.parsedData.length > 0 ? (this.importProgress / this.parsedData.length) * 100 : 0;
  }

  get successCount(): number {
    return this.importResults.filter(r => r.success).length;
  }

  get errorCount(): number {
    return this.importResults.filter(r => !r.success).length;
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processFile(files[0]);
    }
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.processFile(file);
    }
  }

  private processFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.json')) {
      this.toastService.error('Please select a JSON file');
      return;
    }

    this.selectedFile = file;
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        
        // Handle single document or array of documents
        if (Array.isArray(data)) {
          this.parsedData = data;
        } else {
          this.parsedData = [data];
        }

        // Validate data structure
        this.validateDocuments();
        
        this.toastService.success(`Successfully parsed ${this.parsedData.length} documents`);
      } catch (error) {
        this.toastService.error('Invalid JSON file format');
        console.error('JSON parse error:', error);
      }
    };

    reader.readAsText(file);
  }

  private validateDocuments() {
    for (let i = 0; i < this.parsedData.length; i++) {
      const doc = this.parsedData[i];
      if (!doc.fields || typeof doc.fields !== 'object') {
        throw new Error(`Document ${i + 1} is missing 'fields' property`);
      }
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatDocumentPreview(doc: FirestoreDocument): string {
    const preview: any = {};
    Object.keys(doc.fields).forEach(key => {
      const field = doc.fields[key];
      if (field.stringValue) preview[key] = field.stringValue;
      else if (field.timestampValue) preview[key] = field.timestampValue;
      else if (field.numberValue) preview[key] = field.numberValue;
      else if (field.booleanValue !== undefined) preview[key] = field.booleanValue;
    });
    return JSON.stringify(preview, null, 2);
  }

  async importData() {
    if (!this.targetCollection.trim()) {
      this.toastService.error('Please enter a target collection name');
      return;
    }

    this.isProcessing = true;
    this.importProgress = 0;
    this.importResults = [];

    try {
      for (let i = 0; i < this.parsedData.length; i++) {
        const document = this.parsedData[i];
        
        try {
          // Convert Firestore format to plain object
          const plainData = this.convertFirestoreToPlainObject(document);
          
          // Generate meaningful document ID
          const docId = this.generateDocumentId(plainData, i);
          
          // Save to Firestore
          const docRef = doc(collection(db, this.targetCollection), docId);
          await setDoc(docRef, plainData);
          
          this.importResults.push({ index: i, success: true });
          this.importProgress++;
          
          // Small delay to prevent overwhelming Firestore
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`Error importing document ${i + 1}:`, error);
          this.importResults.push({ 
            index: i, 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          this.importProgress++;
        }
      }

      const successCount = this.successCount;
      const errorCount = this.errorCount;
      
      if (errorCount === 0) {
        this.toastService.success(`🎉 Successfully imported all ${successCount} documents!`);
      } else if (successCount > 0) {
        this.toastService.warning(`⚠️ Imported ${successCount} documents with ${errorCount} errors`);
      } else {
        this.toastService.error(`❌ Failed to import all documents`);
      }

    } catch (error) {
      console.error('Import process error:', error);
      this.toastService.error(ErrorMessages.GENERIC_ERROR);
    } finally {
      this.isProcessing = false;
    }
  }

  private convertFirestoreToPlainObject(firestoreDoc: FirestoreDocument): any {
    const plainObject: any = {};
    
    Object.keys(firestoreDoc.fields).forEach(key => {
      const field = firestoreDoc.fields[key];
      
      if (field.stringValue !== undefined) {
        plainObject[key] = field.stringValue;
      } else if (field.timestampValue !== undefined) {
        plainObject[key] = new Date(field.timestampValue);
      } else if (field.numberValue !== undefined) {
        plainObject[key] = field.numberValue;
      } else if (field.booleanValue !== undefined) {
        plainObject[key] = field.booleanValue;
      } else {
        // Handle other field types if needed
        plainObject[key] = field;
      }
    });
    
    return plainObject;
  }

  private generateDocumentId(data: any, index: number): string {
    // If the document already has an ID, use it
    if (data.id) {
      return data.id;
    }

    // Try to generate meaningful ID based on common fields
    if (data.typeId) {
      return data.typeId; // For predefined types like "store_barbershop"
    }
    
    if (data.storeId && data.typeCategory && data.typeLabel) {
      // Create ID from store, category, and label
      const cleanLabel = data.typeLabel.toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
      return `${data.storeId}_${data.typeCategory}_${cleanLabel}`;
    }
    
    if (data.name) {
      // Use name field if available
      const cleanName = data.name.toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
      return cleanName;
    }
    
    if (data.productName) {
      // For products
      const cleanName = data.productName.toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
      return `product_${cleanName}`;
    }
    
    if (data.categoryName || data.category) {
      // For categories
      const catName = data.categoryName || data.category;
      const cleanName = catName.toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
      return `category_${cleanName}`;
    }
    
    // If no meaningful field found, use collection name with index
    return `${this.targetCollection}_${String(index + 1).padStart(3, '0')}`;
  }

  clearData() {
    this.selectedFile = null;
    this.parsedData = [];
    this.importResults = [];
    this.importProgress = 0;
    this.toastService.info('Data cleared');
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}