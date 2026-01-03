import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { ContentLayoutComponent } from '../../shared/components/content-layout/content-layout.component';
import { IndexedDBService } from '../../core/services/indexeddb.service';
import { PrintService, PrinterConfig } from '../../services/print.service';

// Re-export PrinterConfig type for components that import from here
export type { PrinterConfig } from '../../services/print.service';

@Component({
  selector: 'app-print-setup',
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderComponent, ContentLayoutComponent],
  templateUrl: './print-setup.component.html',
  styleUrls: ['./print-setup.component.css']
})
export class PrintSetupComponent implements OnInit {
  private indexedDBService = inject(IndexedDBService);
  private printService = inject(PrintService);
  
  // Printer configurations
  printers = signal<PrinterConfig[]>([]);
  isLoading = signal<boolean>(false);
  isSaving = signal<boolean>(false);
  
  // Form state for adding/editing printer
  isAddingPrinter = signal<boolean>(false);
  editingPrinterId = signal<string | null>(null);
  
  // Form fields
  printerName = '';
  connectionType: 'bluetooth' | 'wifi' | 'usb' | 'none' = 'bluetooth';
  paperSize: '58mm' | '80mm' | '127mm' = '80mm';
  isDefault = false;
  
  // Options for dropdowns
  connectionTypes = [
    { value: 'bluetooth', label: 'Bluetooth', icon: '📶' },
    { value: 'wifi', label: 'Wi-Fi', icon: '📡' },
    { value: 'usb', label: 'USB Cable', icon: '🔌' },
    { value: 'none', label: 'Not Connected', icon: '❌' }
  ];
  
  paperSizes = [
    { value: '58mm', label: '58mm (2 inch)', description: 'Compact receipts' },
    { value: '80mm', label: '80mm (3 inch)', description: 'Standard receipts' },
    { value: '127mm', label: '127mm (5 inch)', description: 'Wide receipts' }
  ];

  async ngOnInit() {
    await this.loadPrinters();
  }

  async loadPrinters() {
    this.isLoading.set(true);
    try {
      const savedPrinters = await this.indexedDBService.getSetting('printerConfigs');
      if (savedPrinters && Array.isArray(savedPrinters)) {
        this.printers.set(savedPrinters);
      }
      console.log('🖨️ Loaded printers from IndexedDB:', this.printers());
    } catch (error) {
      console.error('Failed to load printers from IndexedDB:', error);
      // Try to continue with empty printers array instead of failing completely
      this.printers.set([]);
      
      // Show user-friendly error
      this.showNotification('Warning: Could not load saved printer settings. Starting with default configuration.', 'warning');
    } finally {
      this.isLoading.set(false);
    }
  }

  async savePrinters() {
    try {
      await this.indexedDBService.saveSetting('printerConfigs', this.printers());
      // Refresh the print service with the new config
      await this.printService.refreshPrinterConfig();
      console.log('💾 Printers saved to IndexedDB and print service updated');
      
      this.showNotification('Printer settings saved successfully!', 'success');
    } catch (error) {
      console.error('Failed to save printers to IndexedDB:', error);
      
      // Check if it's a storage quota error
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('quota') || errorMessage.includes('storage')) {
        this.showNotification('Failed to save: Storage quota exceeded. Please clear some data and try again.', 'error');
      } else {
        this.showNotification('Failed to save printer settings. Please try again.', 'error');
      }
    }
  }

  private showNotification(message: string, type: 'success' | 'warning' | 'error') {
    // Add a simple notification system
    console.log(`${type.toUpperCase()}: ${message}`);
    // You can integrate with your notification service here
  }

  startAddingPrinter() {
    this.resetForm();
    this.isAddingPrinter.set(true);
    this.editingPrinterId.set(null);
  }

  startEditingPrinter(printer: PrinterConfig) {
    this.printerName = printer.name;
    this.connectionType = printer.connectionType;
    this.paperSize = printer.paperSize;
    this.isDefault = printer.isDefault;
    this.editingPrinterId.set(printer.id);
    this.isAddingPrinter.set(true);
  }

  cancelForm() {
    this.resetForm();
    this.isAddingPrinter.set(false);
    this.editingPrinterId.set(null);
  }

  resetForm() {
    this.printerName = '';
    this.connectionType = 'bluetooth';
    this.paperSize = '80mm';
    this.isDefault = false;
  }

  async savePrinter() {
    if (!this.printerName.trim()) {
      return;
    }

    this.isSaving.set(true);
    try {
      const now = new Date().toISOString();
      const currentPrinters = [...this.printers()];
      
      // Determine status based on connection type
      const status: 'active' | 'inactive' = this.connectionType !== 'none' ? 'active' : 'inactive';
      
      if (this.editingPrinterId()) {
        // Update existing printer
        const index = currentPrinters.findIndex(p => p.id === this.editingPrinterId());
        if (index !== -1) {
          currentPrinters[index] = {
            ...currentPrinters[index],
            name: this.printerName.trim(),
            connectionType: this.connectionType,
            paperSize: this.paperSize,
            status,
            isDefault: this.isDefault,
            updatedAt: now,
            lastConnected: status === 'active' ? now : currentPrinters[index].lastConnected
          };
        }
      } else {
        // Add new printer
        const newPrinter: PrinterConfig = {
          id: `printer_${Date.now()}`,
          name: this.printerName.trim(),
          connectionType: this.connectionType,
          paperSize: this.paperSize,
          status,
          isDefault: this.isDefault,
          lastConnected: status === 'active' ? now : undefined,
          createdAt: now,
          updatedAt: now
        };
        currentPrinters.push(newPrinter);
      }
      
      // If this printer is set as default, unset others
      if (this.isDefault) {
        currentPrinters.forEach(p => {
          if (p.id !== (this.editingPrinterId() || currentPrinters[currentPrinters.length - 1].id)) {
            p.isDefault = false;
          }
        });
      }
      
      this.printers.set(currentPrinters);
      await this.savePrinters();
      
      this.cancelForm();
      console.log('✅ Printer saved successfully');
    } catch (error) {
      console.error('Failed to save printer:', error);
    } finally {
      this.isSaving.set(false);
    }
  }

  async deletePrinter(printerId: string) {
    if (!confirm('Are you sure you want to delete this printer?')) {
      return;
    }
    
    try {
      const currentPrinters = this.printers().filter(p => p.id !== printerId);
      this.printers.set(currentPrinters);
      await this.savePrinters();
      console.log('🗑️ Printer deleted');
    } catch (error) {
      console.error('Failed to delete printer:', error);
    }
  }

  async togglePrinterStatus(printer: PrinterConfig) {
    const currentPrinters = [...this.printers()];
    const index = currentPrinters.findIndex(p => p.id === printer.id);
    if (index !== -1) {
      const newStatus = printer.status === 'active' ? 'inactive' : 'active';
      currentPrinters[index] = {
        ...currentPrinters[index],
        status: newStatus,
        connectionType: newStatus === 'inactive' ? 'none' : currentPrinters[index].connectionType,
        updatedAt: new Date().toISOString(),
        lastConnected: newStatus === 'active' ? new Date().toISOString() : currentPrinters[index].lastConnected
      };
      this.printers.set(currentPrinters);
      await this.savePrinters();
    }
  }

  async setAsDefault(printerId: string) {
    const currentPrinters = [...this.printers()];
    currentPrinters.forEach(p => {
      p.isDefault = p.id === printerId;
    });
    this.printers.set(currentPrinters);
    await this.savePrinters();
  }

  getConnectionIcon(type: string): string {
    const conn = this.connectionTypes.find(c => c.value === type);
    return conn?.icon || '❓';
  }

  getConnectionLabel(type: string): string {
    const conn = this.connectionTypes.find(c => c.value === type);
    return conn?.label || type;
  }

  getPaperSizeLabel(size: string): string {
    const paper = this.paperSizes.find(p => p.value === size);
    return paper?.label || size;
  }
}
