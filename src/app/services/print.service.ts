import { Injectable, inject } from '@angular/core';
import { IndexedDBService } from '../core/services/indexeddb.service';

// Web Bluetooth API types (simplified)
declare const navigator: any;

// Printer configuration interface (matches print-setup component)
export interface PrinterConfig {
  id: string;
  name: string;
  connectionType: 'bluetooth' | 'wifi' | 'usb' | 'none';
  paperSize: '58mm' | '80mm' | '127mm';
  status: 'active' | 'inactive';
  isDefault: boolean;
  lastConnected?: string;
  createdAt: string;
  updatedAt: string;
}

// Paper size configuration
export interface PaperSizeConfig {
  width: string;        // CSS width (e.g., '58mm', '80mm', '127mm')
  maxWidth: string;     // CSS max-width in pixels
  receiptWidth: number; // Character width for ESC/POS
  fontSize: string;     // Base font size
  lineChars: number;    // Characters per line for formatting
}

@Injectable({
  providedIn: 'root'
})
export class PrintService {
  private indexedDBService = inject(IndexedDBService);
  
  // Bluetooth printer connection state
  private bluetoothDevice: any = null;
  private bluetoothCharacteristic: any = null;
  private isConnected = false;
  
  // USB printer connection state
  private usbPort: any = null;
  private usbConnected = false;
  
  // Current printer configuration (loaded from IndexedDB)
  private currentPrinterConfig: PrinterConfig | null = null;
  
  // Paper size configurations
  private readonly paperSizeConfigs: Record<string, PaperSizeConfig> = {
    '58mm': {
      width: '58mm',
      maxWidth: '210px',
      receiptWidth: 32,
      fontSize: '11px',
      lineChars: 32
    },
    '80mm': {
      width: '80mm',
      maxWidth: '300px',
      receiptWidth: 48,
      fontSize: '12px',
      lineChars: 48
    },
    '127mm': {
      width: '127mm',
      maxWidth: '480px',
      receiptWidth: 64,
      fontSize: '13px',
      lineChars: 64
    }
  };

  constructor() {
    // Load printer config on service initialization
    this.loadPrinterConfig();
  }
  
  /**
   * 🔧 Load default printer configuration from IndexedDB
   */
  async loadPrinterConfig(): Promise<PrinterConfig | null> {
    try {
      const printers = await this.indexedDBService.getSetting('printerConfigs') as PrinterConfig[] | null;
      if (printers && Array.isArray(printers) && printers.length > 0) {
        // Find default printer or first active printer
        const defaultPrinter = printers.find(p => p.isDefault && p.status === 'active');
        const activePrinter = printers.find(p => p.status === 'active');
        this.currentPrinterConfig = defaultPrinter || activePrinter || printers[0];
        console.log('🖨️ Loaded printer config:', this.currentPrinterConfig);
        return this.currentPrinterConfig;
      }
      console.log('⚠️ No printer configuration found in IndexedDB');
      return null;
    } catch (error) {
      console.error('Failed to load printer config:', error);
      return null;
    }
  }
  
  /**
   * 📄 Get current paper size configuration
   */
  getPaperSizeConfig(paperSize?: string): PaperSizeConfig {
    const size = paperSize || this.currentPrinterConfig?.paperSize || '58mm';
    return this.paperSizeConfigs[size] || this.paperSizeConfigs['58mm'];
  }
  
  /**
   * 🔌 Get current printer connection type
   */
  getConnectionType(): 'bluetooth' | 'wifi' | 'usb' | 'none' {
    return this.currentPrinterConfig?.connectionType || 'none';
  }
  
  /**
   * 🖨️ Get current printer config
   */
  getCurrentPrinterConfig(): PrinterConfig | null {
    return this.currentPrinterConfig;
  }
  
  /**
   * 🔄 Refresh printer config from IndexedDB
   */
  async refreshPrinterConfig(): Promise<PrinterConfig | null> {
    return this.loadPrinterConfig();
  }

  /**
   * 🎯 DIRECT HARDWARE PRINT: Bypasses browser dialog when hardware printers are available
   * USB: NO FALLBACK - Direct thermal printing only (no browser dialog)
   * Bluetooth: Has fallback to browser print if connection fails
   */
  async printReceiptDirect(receiptData: any): Promise<{ success: boolean; method: string; message: string }> {
    try {
      console.log('🎯 Starting direct hardware print...');
      
      // 🔥 PRIORITY 1: Try USB printer first (if Web Serial API is supported)
      if ('serial' in navigator) {
        try {
          console.log('🔌 USB printing supported - attempting direct USB print...');
          await this.printToThermalPrinter(receiptData);
          return {
            success: true,
            method: 'USB',
            message: 'Receipt printed successfully via USB thermal printer'
          };
        } catch (usbError: any) {
          console.log('⚠️ USB printing failed:', usbError.message);
          
          // If no port was selected or connection failed, force port selection dialog
          if (usbError.message.includes('No USB printer selected') || 
              usbError.message.includes('Port selection failed') ||
              !this.usbPort) {
            try {
              console.log('🔄 Retrying with port selection dialog...');
              // Force new port selection
              this.usbPort = null;
              this.usbConnected = false;
              await this.printToThermalPrinter(receiptData);
              return {
                success: true,
                method: 'USB',
                message: 'Receipt printed successfully via USB thermal printer'
              };
            } catch (retryError: any) {
              console.error('❌ USB retry failed:', retryError.message);
              // If user cancelled, return that message
              if (retryError.message.includes('No USB printer selected')) {
                return {
                  success: false,
                  method: 'USB',
                  message: 'Print cancelled. Please select your USB printer to continue.'
                };
              }
            }
          }
          
          // Continue to try Bluetooth
          console.log('🔄 Trying Bluetooth printer...');
        }
      }
      
      // 🔥 PRIORITY 2: Try Bluetooth printer
      if (navigator.bluetooth) {
        const hasBluetoothPrinters = await this.checkBluetoothPrintersAvailable();
        if (hasBluetoothPrinters || this.isConnected) {
          try {
            console.log('📱 Bluetooth available - attempting direct print');
            await this.printReceiptSmart(receiptData);
            return {
              success: true,
              method: 'Bluetooth',
              message: 'Receipt printed successfully via Bluetooth printer'
            };
          } catch (btError: any) {
            console.error(`❌ Bluetooth printing failed: ${btError.message}`);
          }
        }
      }
      
      // No hardware printers available
      console.error('❌ No hardware printers available');
      return {
        success: false,
        method: 'None',
        message: 'No hardware printers found. Please connect a USB or Bluetooth thermal printer.'
      };
      
    } catch (error: any) {
      console.error('❌ Direct print failed:', error);
      return {
        success: false,
        method: 'Failed',
        message: error.message || 'Print operation failed'
      };
    }
  }

  /**
   * 🚀 SMART PRINT: Auto-detects printer type and connection method
   * Priority: 1) USB/Cable printers (Web Serial) 2) Bluetooth 3) Browser print fallback
   */
  async printReceiptSmart(receiptData: any): Promise<void> {
    try {
      console.log('🖨️ Starting smart print process...');
      console.log('📄 Receipt data received:', {
        hasData: !!receiptData,
        orderId: receiptData?.orderId,
        invoiceNumber: receiptData?.invoiceNumber,
        itemsCount: receiptData?.items?.length || 0
      });
      
      // 🔥 PRIORITY 1: Try USB/Cable printer first (Web Serial API)
      if ('serial' in navigator) {
        // Test USB connection first
        const usbTest = await this.testUSBConnection();
        console.log('🧪 USB Connection Test:', usbTest);
        
        try {
          console.log('🔌 USB/Cable printer support detected, trying USB connection...');
          await this.printToThermalPrinter(receiptData);
          console.log('✅ USB/Cable print completed successfully');
          return;
        } catch (usbError: any) {
          console.log('⚠️ USB/Cable printer error:', usbError.message);
          
          // If user cancelled port selection, don't try Bluetooth
          if (usbError.message.includes('cancelled') || usbError.message.includes('No port selected')) {
            throw new Error('Print cancelled. Please select your USB printer port or use a Bluetooth printer.');
          }
          
          console.log('🔄 USB failed, trying Bluetooth printer...');
        }
      } else {
        console.log('⚠️ USB printing not supported in this browser, trying Bluetooth...');
      }

      // 🔥 PRIORITY 2: Try Bluetooth printer
      // Check if Web Bluetooth is supported
      if (!navigator.bluetooth) {
        console.error('❌ Bluetooth not supported in this browser');
        throw new Error('Bluetooth not supported. Please use a browser that supports Web Bluetooth API.');
      }

      // Check existing Bluetooth connection
      if (this.isConnected && this.bluetoothDevice && this.bluetoothDevice.gatt.connected) {
        console.log('✅ Already connected to Bluetooth printer:', this.bluetoothDevice.name);
        console.log('🖨️ Printing directly via existing Bluetooth connection...');
        await this.printViaBluetoothESCPOS(receiptData);
        console.log('✅ Bluetooth print completed successfully');
        return;
      }

      // Reset connection state if device got disconnected
      if (this.bluetoothDevice && !this.bluetoothDevice.gatt.connected) {
        console.log('📱 Bluetooth device disconnected, resetting connection state...');
        this.isConnected = false;
        this.bluetoothCharacteristic = null;
      }

      // Check if Bluetooth printers are available before attempting connection
      const hasBluetoothPrinters = await this.checkBluetoothPrintersAvailable();
      if (!hasBluetoothPrinters) {
        console.error('❌ No Bluetooth printers found');
        throw new Error('No Bluetooth printers found. Please pair a Bluetooth thermal printer first.');
      }

      // Try to connect to Bluetooth printer
      if (!this.isConnected) {
        console.log('📱 Attempting Bluetooth printer connection...');
        const connected = await this.connectToBluetoothPrinter();
        
        if (!connected) {
          console.error('❌ Bluetooth connection failed');
          throw new Error('Failed to connect to Bluetooth printer. Please check printer is on and paired.');
        }
      }

      // Print via Bluetooth
      console.log('🖨️ Printing via Bluetooth...');
      await this.printViaBluetoothESCPOS(receiptData);
      console.log('✅ Bluetooth print completed successfully');

    } catch (error) {
      console.error('❌ Print error:', error);
      
      // Reset connection on error
      this.isConnected = false;
      this.bluetoothCharacteristic = null;
      
      // Show error message
      console.error('❌ Print error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unable to print receipt. Please check your printer connection.';
      alert(`Print Error: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 🔍 Check if hardware printers (USB or Bluetooth) are connected and ready
   */
  async isHardwarePrinterAvailable(): Promise<{ hasHardware: boolean; type: string; details: any }> {
    let result = { hasHardware: false, type: 'none', details: {} };
    
    // Check USB printers first (highest priority)
    if ('serial' in navigator) {
      try {
        const ports = await (navigator as any).serial.getPorts();
        if (ports.length > 0) {
          // Check if any port is a connected thermal printer
          for (const port of ports) {
            if (port.readable && !port.readable.locked) {
              result = { 
                hasHardware: true, 
                type: 'USB', 
                details: { 
                  portsAvailable: ports.length,
                  connected: true,
                  ready: true
                }
              };
              console.log('🔌 USB thermal printer detected and ready');
              break;
            }
          }
        }
      } catch (error) {
        console.log('🔍 USB printer check failed:', error);
      }
    }
    
    // Check Bluetooth printers if no USB found
    if (!result.hasHardware) {
      const bluetoothResult = await this.checkBluetoothPrintersAvailable();
      if (bluetoothResult) {
        // Check if we're already connected to a Bluetooth printer
        const isBluetoothReady = this.isConnected && 
                                 this.bluetoothDevice && 
                                 this.bluetoothDevice.gatt?.connected;
        
        result = { 
          hasHardware: true, 
          type: 'Bluetooth', 
          details: { 
            devicesAvailable: true,
            connected: isBluetoothReady,
            ready: isBluetoothReady
          }
        };
        console.log('📱 Bluetooth thermal printer detected', isBluetoothReady ? '(connected)' : '(available)');
      }
    }
    
    console.log('🔍 Hardware printer availability check:', result);
    return result;
  }

  /**
   * 🔍 Check if Bluetooth printers are available
   */
  private async checkBluetoothPrintersAvailable(): Promise<boolean> {
    try {
      if (!navigator.bluetooth) {
        return false;
      }

      // Check if any Bluetooth devices were previously paired
      const devices = await navigator.bluetooth.getDevices();
      return devices.length > 0;
    } catch (error) {
      console.log('🔍 Bluetooth printer check failed:', error);
      return false;
    }
  }

  /**
   * 📱 Connect to Bluetooth thermal printer
   */
  private async connectToBluetoothPrinter(): Promise<boolean> {
    try {
      console.log('🔍 Scanning for Bluetooth printers...');
      
      // Request Bluetooth device - use broader search for thermal printers
      this.bluetoothDevice = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb',
          '0000110e-0000-1000-8000-00805f9b34fb',
          '00001101-0000-1000-8000-00805f9b34fb',
          '0000180f-0000-1000-8000-00805f9b34fb',
          '49535343-fe7d-4ae5-8fa9-9fafd205e455'
        ]
      });

      console.log('📱 Found device:', this.bluetoothDevice.name);

      // Connect to GATT server
      const server = await this.bluetoothDevice.gatt!.connect();
      console.log('🔗 Connected to GATT server');

      // Try to find a suitable service
      let service = null;
      let characteristic = null;

      try {
        service = await server.getPrimaryService('49535343-fe7d-4ae5-8fa9-9fafd205e455');
        characteristic = await service.getCharacteristic('49535343-1e4d-4bd9-ba61-23c647249616');
      } catch (e1) {
        try {
          service = await server.getPrimaryService('00001101-0000-1000-8000-00805f9b34fb');
          const characteristics = await service.getCharacteristics();
          characteristic = characteristics[0];
        } catch (e2) {
          try {
            service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
            characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
          } catch (e3) {
            throw new Error('No compatible service found for thermal printer');
          }
        }
      }

      this.bluetoothCharacteristic = characteristic;
      this.isConnected = true;
      console.log('✅ Bluetooth printer connected successfully');
      return true;

    } catch (error) {
      console.error('❌ Bluetooth connection failed:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * 🖨️ Print via Bluetooth using ESC/POS commands
   */
  private async printViaBluetoothESCPOS(receiptData: any): Promise<void> {
    if (!this.bluetoothCharacteristic) {
      throw new Error('Bluetooth characteristic not available');
    }

    // Generate ESC/POS commands
    const escposCommands = this.generateESCPOSCommands(receiptData);
    
    // Convert string to Uint8Array for Bluetooth transmission
    const encoder = new TextEncoder();
    const data = encoder.encode(escposCommands);
    
    // Send to printer in chunks
    const chunkSize = 512;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      await this.bluetoothCharacteristic.writeValue(chunk);
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  /**
   * 🧪 Test USB printer connectivity
   */
  async testUSBConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      if (!('serial' in navigator)) {
        return { success: false, message: 'Web Serial API not supported in this browser' };
      }

      const ports = await (navigator as any).serial.getPorts();
      if (ports.length === 0) {
        return { success: false, message: 'No USB printers have been granted permission' };
      }

      return {
        success: true,
        message: 'USB printer connection available',
        details: { portsCount: ports.length }
      };
    } catch (error: any) {
      return { 
        success: false, 
        message: `USB test failed: ${error.message}`
      };
    }
  }

  /**
   * Send to thermal printer via Web Serial API (for USB printers)
   */
  async printToThermalPrinter(receiptData: any): Promise<void> {
    try {
      console.log('🔌 Starting USB thermal printer process...');
      
      if (!('serial' in navigator)) {
        throw new Error('Web Serial API not supported');
      }

      let port = this.usbPort;

      // ✅ OPTIMIZED: Skip printer lookup if already connected
      if (this.usbConnected && port && port.readable && !port.readable.locked) {
        console.log('✅ Using existing USB connection - skipping printer lookup');
      } else {
        // Need to find or request a port
        console.log('🔍 USB not connected, searching for printer...');
        
        if (!port || !port.readable) {
          const ports = await (navigator as any).serial.getPorts();
          
          if (ports.length > 0) {
            port = ports[0];
            console.log('📱 Found previously authorized USB printer');
          } else {
            // No authorized ports - ALWAYS show port selection dialog
            console.log('🔍 No authorized printers found, opening port selection dialog...');
            try {
              port = await (navigator as any).serial.requestPort();
              console.log('✅ User selected USB port');
            } catch (error: any) {
              if (error.name === 'NotFoundError') {
                throw new Error('No USB printer selected. Please select your printer from the list.');
              }
              throw new Error(`Port selection failed: ${error.message}`);
            }
          }
          
          this.usbPort = port;
        }

        if (!port.readable || port.readable.locked) {
          console.log('🔌 Opening USB port connection...');
          await port.open({ 
            baudRate: 9600,
            dataBits: 8,
            stopBits: 1,
            parity: 'none',
            flowControl: 'none'
          });
        }
      }

      const escPosCommands = this.generateESCPOSCommands(receiptData);
      const encoder = new TextEncoder();
      const data = encoder.encode(escPosCommands);

      if (!port.writable) {
        throw new Error('USB port is not writable');
      }

      // Check if stream is already locked
      if (port.writable.locked) {
        console.log('⚠️ Port writable stream is locked, waiting...');
        // Wait a bit for previous operation to complete
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // If still locked, force close and reopen port
        if (port.writable.locked) {
          console.log('🔄 Forcing port reset...');
          try {
            await port.close();
            await new Promise(resolve => setTimeout(resolve, 200));
            await port.open({ 
              baudRate: 9600,
              dataBits: 8,
              stopBits: 1,
              parity: 'none',
              flowControl: 'none'
            });
          } catch (resetError) {
            console.error('❌ Port reset failed:', resetError);
          }
        }
      }

      // Use try-finally to ensure writer is always released
      let writer;
      try {
        writer = port.writable.getWriter();
        await writer.write(data);
        console.log('✅ Data written to USB printer');
      } finally {
        if (writer) {
          try {
            writer.releaseLock();
            console.log('✅ Writer lock released');
          } catch (releaseError) {
            console.warn('⚠️ Error releasing writer lock:', releaseError);
          }
        }
      }

      this.usbConnected = true;
      console.log('✅ Receipt sent to USB thermal printer successfully');

    } catch (error: any) {
      console.error('❌ USB thermal printer error:', error);
      this.usbPort = null;
      this.usbConnected = false;
      throw error;
    }
  }

  /**
   * 📄 Generate ESC/POS commands for thermal printer (optimized for Xprinter)
   * Made public to allow components to generate ESC/POS content for preview
   * Updated: Support multiple paper sizes (58mm, 80mm, 127mm)
   */
  generateESCPOSCommands(receiptData: any): string {
    let commands = '';
    
    // Get paper size configuration
    const paperSize = receiptData?._paperSize || this.currentPrinterConfig?.paperSize || '58mm';
    const paperConfig = this.getPaperSizeConfig(paperSize);
    const lineChars = paperConfig.lineChars;
    
    console.log(`📄 Generating ESC/POS for ${paperSize} paper (${lineChars} chars/line)`);
    
    // Generate separator line based on paper width
    const separatorLine = '-'.repeat(lineChars) + '\n';
    const doubleSeparatorLine = '='.repeat(lineChars) + '\n';
    
    // Initialize printer with better quality settings
    commands += '\x1B\x40'; // Initialize
    commands += '\x1D\x21\x00'; // Normal font size (not condensed)
    commands += '\x1B\x4D\x00'; // Font A (clearer than Font B)
    commands += '\x1B\x7B\x32'; // Increase print density for darker text
    
    // Store header - CENTERED and LARGER
    commands += '\x1B\x61\x01'; // Center alignment
    commands += '\x1D\x21\x11'; // Double height and width for store name
    commands += '\x1B\x45\x01'; // Bold on
    commands += (receiptData?.storeInfo?.storeName || 'Store Name') + '\n';
    commands += '\x1B\x45\x00'; // Bold off
    commands += '\x1D\x21\x00'; // Back to normal size
    
    // Store details - CENTERED with normal font
    commands += (receiptData?.storeInfo?.address || 'Store Address') + '\n';
    commands += `Tel: ${receiptData?.storeInfo?.phone || 'N/A'}\n`;
    commands += `Email: ${receiptData?.storeInfo?.email || 'N/A'}\n`;
    commands += `TIN: ${receiptData?.storeInfo?.tin || 'N/A'}\n`;
    
    // BIR Information
    if (receiptData?.storeInfo?.birPermitNo) {
      commands += `BIR: ${receiptData.storeInfo.birPermitNo}\n`;
    }
    if (receiptData?.storeInfo?.inclusiveSerialNumber) {
      commands += `SN: ${receiptData.storeInfo.inclusiveSerialNumber}\n`;
    }
    if (receiptData?.storeInfo?.minNumber) {
      commands += `MIN: ${receiptData.storeInfo.minNumber}\n`;
    }
    
    commands += `Invoice #: ${receiptData?.invoiceNumber || 'Auto-generated'}\n`;
    
    // Invoice Type (centered, bold, slightly larger)
    commands += '\x1D\x21\x01'; // Double height for invoice type
    commands += '\x1B\x45\x01'; // Bold on
    commands += (receiptData?.storeInfo?.invoiceType || 'SALES INVOICE') + '\n';
    commands += '\x1B\x45\x00'; // Bold off
    commands += '\x1D\x21\x00'; // Back to normal size
    commands += '\x1B\x61\x00'; // Left alignment for rest
    
    commands += separatorLine;
    
    // Payment Method with filled/empty circles (Cash by default, both can be selected)
    const isCashSale = receiptData?.isCashSale !== false; // Default to true unless explicitly false
    const isChargeSale = receiptData?.isChargeSale === true; // Only true if explicitly set
    commands += '\x1B\x45\x01'; // Bold for payment method
    commands += `Cash: ${isCashSale ? '\u25CF' : '\u25CB'}   Charge: ${isChargeSale ? '\u25CF' : '\u25CB'}\n`;
    commands += '\x1B\x45\x00'; // Bold off
    
    commands += separatorLine;
    
    // Customer info - BOLD for sold to
    commands += '\x1B\x45\x01'; // Bold on
    const customerName = receiptData?.customerName || 'Walk-in Customer';
    commands += `SOLD TO: ${customerName}\n`;
    commands += '\x1B\x45\x00'; // Bold off
    
    if (receiptData?.customerName && receiptData.customerName !== 'Walk-in Customer') {
      if (receiptData?.customerAddress && receiptData?.customerAddress !== 'N/A') {
        commands += `Address: ${receiptData.customerAddress}\n`;
      }
      if (receiptData?.customerTin && receiptData?.customerTin !== 'N/A') {
        commands += `TIN: ${receiptData.customerTin}\n`;
      }
    }
    
    commands += separatorLine;
    
    // Date and Cashier - BOLD
    commands += '\x1B\x45\x01'; // Bold on
    commands += `Cashier: ${receiptData?.cashier || 'N/A'}\n`;
    const date = new Date(receiptData?.receiptDate || new Date());
    commands += `${date.toLocaleDateString()} ${date.toLocaleTimeString()}\n`;
    commands += '\x1B\x45\x00'; // Bold off
    
    commands += separatorLine;
    
    // Items header - BOLD and clearer (adapt to paper width)
    commands += '\x1B\x45\x01'; // Bold on
    // Dynamic header based on paper size
    const qtyColWidth = 4;
    const totalColWidth = 10;
    const productColWidth = lineChars - qtyColWidth - totalColWidth - 2; // -2 for spaces
    const itemsHeader = 'Qty'.padEnd(qtyColWidth) + 'Product Name'.padEnd(productColWidth) + 'Total'.padStart(totalColWidth);
    commands += itemsHeader + '\n';
    commands += '\x1B\x45\x00'; // Bold off
    commands += separatorLine;
    
    if (receiptData?.items) {
      receiptData.items.forEach((item: any) => {
        const qty = (item.quantity || 1).toString();
        const unitType = item.unitType && item.unitType !== 'N/A' ? ` ${item.unitType.substring(0, 2)}` : '';
        const total = (item.total || 0).toFixed(2);
        
        // Dynamic formatting based on paper width
        const qtyWithUnit = `${qty}${unitType}`;
        const qtyPadded = qtyWithUnit.padEnd(qtyColWidth);
        
        // Product name - limited to fit paper width
        const maxProductNameLength = productColWidth - 1;
        const productName = (item.productName || item.name || 'Item').substring(0, maxProductNameLength);
        const productPadded = productName.padEnd(maxProductNameLength);
        
        // Total - right aligned
        const totalPadded = total.padStart(totalColWidth);
        
        // Make item lines slightly bolder
        commands += '\x1B\x45\x01'; // Bold on for item
        commands += `${qtyPadded} ${productPadded} ${totalPadded}\n`;
        commands += '\x1B\x45\x00'; // Bold off

        // SKU on separate indented line (show SKU after product name)
        const skuLine = `    SKU: ${item.skuId || item.productId || ''}`;
        commands += `${skuLine}\n`;

        // Unit price on separate line, indented
        const unitPrice = (item.sellingPrice || item.price || 0).toFixed(2);
        commands += `    @ ${unitPrice} each\n`;
      });
    }
    
    commands += separatorLine;
    
    // Totals - Right aligned with dynamic width and BOLD amounts
    const receiptWidth = lineChars; // Use dynamic width based on paper size
    
    // Subtotal - always show (BOLD)
    commands += '\x1B\x45\x01'; // Bold on
    const subtotalAmt = (receiptData?.subtotal || 0).toFixed(2);
    const subtotalLine = `Subtotal: ${subtotalAmt}`;
    const subtotalSpaces = ' '.repeat(receiptWidth - subtotalLine.length);
    commands += `${subtotalSpaces}${subtotalLine}\n`;
    commands += '\x1B\x45\x00'; // Bold off
    
    // VAT (12%) - always show (BOLD)
    commands += '\x1B\x45\x01'; // Bold on
    const vatAmt = (receiptData?.vatAmount || 0).toFixed(2);
    const vatLine = `VAT (12%): ${vatAmt}`;
    const vatSpaces = ' '.repeat(receiptWidth - vatLine.length);
    commands += `${vatSpaces}${vatLine}\n`;
    commands += '\x1B\x45\x00'; // Bold off
    
    // VAT Exempt - always show (BOLD)
    commands += '\x1B\x45\x01'; // Bold on
    const vatExemptAmt = (receiptData?.vatExempt || 0).toFixed(2);
    const vatExemptLine = `VAT Exempt: ${vatExemptAmt}`;
    const vatExemptSpaces = ' '.repeat(Math.max(0, receiptWidth - vatExemptLine.length));
    commands += `${vatExemptSpaces}${vatExemptLine}\n`;
    commands += '\x1B\x45\x00'; // Bold off
    
    // Discount - always show (BOLD)
    commands += '\x1B\x45\x01'; // Bold on
    const discountAmt2 = (receiptData?.discount || 0).toFixed(2);
    const discountLine = `Discount: ${discountAmt2}`;
    const discountSpaces = ' '.repeat(Math.max(0, receiptWidth - discountLine.length));
    commands += `${discountSpaces}${discountLine}\n`;
    commands += '\x1B\x45\x00'; // Bold off
    
    commands += doubleSeparatorLine;
    // Total - DOUBLE SIZE and BOLD
    commands += '\x1D\x21\x11'; // Double height and width
    commands += '\x1B\x45\x01'; // Bold on
    const totalAmt = (receiptData?.totalAmount || receiptData?.netAmount || 0).toFixed(2);
    const totalLine = `TOTAL: ${totalAmt}`;
    const totalSpaces = ' '.repeat(Math.max(0, Math.floor(receiptWidth / 2) - totalLine.length));
    commands += `${totalSpaces}${totalLine}\n`;
    commands += '\x1B\x45\x00'; // Bold off
    commands += '\x1D\x21\x00'; // Back to normal size
    commands += doubleSeparatorLine;
    
    // Discount Information (for PWD/Senior/Special Discounts)
    if (receiptData?.orderDiscount) {
      commands += '\n';
      commands += 'DISCOUNT INFORMATION\n';
      commands += separatorLine;
      
      let discountType = receiptData.orderDiscount.type;
      if (receiptData.orderDiscount.customType) {
        discountType += ` (${receiptData.orderDiscount.customType})`;
      }
      commands += `${discountType} Discount\n`;
      
      if (receiptData.orderDiscount.exemptionId) {
        commands += `ID: ${receiptData.orderDiscount.exemptionId}\n`;
      }
      
      if (receiptData.orderDiscount.customerName) {
        commands += `Customer: ${receiptData.orderDiscount.customerName}\n`;
      }
      
      const discountAmt = (receiptData?.discount || 0).toFixed(2);
      commands += `Discount Amount: ${discountAmt}\n`;
      
      // Signature line for PWD/Senior discounts
      if (receiptData.orderDiscount.type === 'PWD' || receiptData.orderDiscount.type === 'SENIOR') {
        commands += '\n';
        commands += 'Customer Signature:\n';
        if (receiptData.orderDiscount.signature) {
          commands += `${receiptData.orderDiscount.signature}\n`;
        } else {
          commands += '_________________________\n';
        }
      }
      commands += doubleSeparatorLine;
    }
    
    // Validity Notice - CENTERED
    if (receiptData?.validityNotice) {
      commands += '\x1B\x61\x01'; // Center alignment
      commands += '\n';
      commands += receiptData.validityNotice + '\n';
      commands += '\x1B\x61\x00'; // Reset alignment
      commands += '\n';
    }
    
    // Thank you message - CENTERED for Xprinter
    commands += '\x1B\x61\x01'; // Center alignment
    commands += 'Thank you for your purchase!\n';
    commands += 'Please come again\n';
    commands += '\x1B\x61\x00'; // Reset alignment
    commands += '\n\n\n\n'; // Extra feed for complete printing
    commands += '\x1D\x56\x41'; // Cut paper
    
    return commands;
  }

  /**
   * 🖨️ Print receipt using browser's window.print() - Universal printer support
   * Now supports dynamic paper sizes from printer configuration
   * Uses iframe to avoid showing about:blank popup
   */
  printBrowserReceipt(receiptData: any): void {
    console.log('🖨️ Opening browser print dialog...');
    
    // Get paper size configuration
    const paperSize = receiptData?._paperSize || this.currentPrinterConfig?.paperSize || '58mm';
    const paperConfig = this.getPaperSizeConfig(paperSize);
    
    const printContent = this.generatePrintableReceipt(receiptData, paperConfig);
    
    // Create iframe for printing (no popup window)
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    
    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) {
      console.error('❌ Unable to create print iframe');
      alert('Print Error: Unable to open print dialog. Please try again.');
      return;
    }
    
    iframeDoc.open();
    iframeDoc.write(`
      <html>
        <head>
          <title>Receipt - ${receiptData?.invoiceNumber || 'Invoice'}</title>
          <style>
            @media print {
              body { margin: 0 !important; }
              @page { 
                margin: 3mm; 
                size: ${paperConfig.width} auto; /* Dynamic paper size */
              }
            }
            body { 
              font-family: 'Courier New', monospace; 
              font-size: ${paperConfig.fontSize}; 
              margin: 0; 
              padding: 3px;
              width: 100%;
              max-width: ${paperConfig.maxWidth}; /* Dynamic based on paper size */
              line-height: 1.3;
            }
            .center { 
              text-align: center !important; 
              width: 100%;
              display: block;
            }
            .left { text-align: left; }
            .right { text-align: right; }
            .bold { font-weight: bold; }
            .small { font-size: 9px; }
            .line { 
              border-bottom: 1px solid #000; 
              margin: 3px 0; 
              width: 100%; 
            }
            .dashed-line {
              border-bottom: 1px dashed #000;
              margin: 3px 0;
              width: 100%;
            }
            .header-section {
              text-align: center !important;
              margin-bottom: 10px;
            }
            .footer-section {
              text-align: center !important;
              margin-top: 15px;
              font-weight: bold;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin: 2px 0;
              font-size: ${paperConfig.fontSize};
            }
            td, th { 
              padding: 1px 2px; 
              vertical-align: top;
            }
            th { 
              font-weight: bold; 
              text-align: left;
              border-bottom: 1px solid #000;
            }
            .item-row td {
              border-bottom: none;
            }
            .price-row {
              font-size: 9px;
              color: #666;
            }
            .no-break {
              page-break-inside: avoid;
            }
          </style>
        </head>
        <body>${printContent}</body>
      </html>
    `);
    iframeDoc.close();
    
    // Wait for content to load, then print
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        console.log('✅ Print dialog opened');
        
        // Remove iframe after printing
        setTimeout(() => {
          document.body.removeChild(iframe);
          console.log('🧹 Print iframe cleaned up');
        }, 1000);
      } catch (error) {
        console.error('❌ Print error:', error);
        document.body.removeChild(iframe);
        alert('Print Error: Unable to open print dialog. Please try again.');
      }
    }, 500);
  }

  /**
   * 🖨️ Direct print without dialog - Auto-prints to default/last used printer
   * Perfect for mobile devices with paired Bluetooth printers
   */
  printDirectMobile(receiptData: any): void {
    console.log('🖨️ Starting direct mobile print (no dialog)...');
    
    // Get paper size configuration
    const paperSize = receiptData?._paperSize || this.currentPrinterConfig?.paperSize || '58mm';
    const paperConfig = this.getPaperSizeConfig(paperSize);
    
    const printContent = this.generatePrintableReceipt(receiptData, paperConfig);
    
    // Create iframe for silent printing
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    
    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) {
      console.error('❌ Unable to create print iframe');
      // Fallback to dialog version
      this.printBrowserReceipt(receiptData);
      return;
    }
    
    iframeDoc.open();
    iframeDoc.write(`
      <html>
        <head>
          <title>Receipt - ${receiptData?.invoiceNumber || 'Invoice'}</title>
          <style>
            @media print {
              body { margin: 0 !important; }
              @page { 
                margin: 3mm; 
                size: ${paperConfig.width} auto; /* Dynamic paper size */
              }
            }
            body { 
              font-family: 'Courier New', monospace; 
              font-size: ${paperConfig.fontSize}; 
              margin: 0; 
              padding: 3px;
              width: 100%;
              max-width: ${paperConfig.maxWidth}; /* Dynamic based on paper size */
              line-height: 1.3;
            }
            .center { 
              text-align: center !important; 
              width: 100%;
              display: block;
            }
            .left { text-align: left; }
            .right { text-align: right; }
            .bold { font-weight: bold; }
            .small { font-size: 9px; }
            .line { 
              border-bottom: 1px solid #000; 
              margin: 3px 0; 
              width: 100%; 
            }
            .dashed-line {
              border-bottom: 1px dashed #000;
              margin: 3px 0;
              width: 100%;
            }
            .header-section {
              text-align: center !important;
              margin-bottom: 10px;
            }
            .footer-section {
              text-align: center !important;
              margin-top: 15px;
              font-weight: bold;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin: 2px 0;
              font-size: 10px;
            }
            td, th { 
              padding: 1px 2px; 
              vertical-align: top;
            }
            th { 
              font-weight: bold; 
              text-align: left;
              border-bottom: 1px solid #000;
            }
            .item-row td {
              border-bottom: none;
            }
            .price-row {
              font-size: 9px;
              color: #666;
            }
            .no-break {
              page-break-inside: avoid;
            }
          </style>
        </head>
        <body>${printContent}</body>
      </html>
    `);
    iframeDoc.close();
    
    // Wait for content to load, then print
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        console.log('✅ Direct print command sent');
        
        // Remove iframe after printing
        setTimeout(() => {
          document.body.removeChild(iframe);
          console.log('🧹 Print iframe cleaned up');
        }, 1000);
      } catch (error) {
        console.error('❌ Direct print error:', error);
        document.body.removeChild(iframe);
        // Fallback to dialog version
        this.printBrowserReceipt(receiptData);
      }
    }, 500);
  }

  /**
   * 🖨️ MOBILE ESC/POS: Direct print to paired Bluetooth printer without dialog
   * Reuses existing connection or connects to previously paired device
   */
  async printMobileESCPOS(receiptData: any): Promise<void> {
    try {
      console.log('🖨️ Starting mobile ESC/POS print...');
      
      // Check if Web Bluetooth is supported
      if (!navigator.bluetooth) {
        console.log('⚠️ Bluetooth not supported on this device');
        throw new Error('Bluetooth not supported. Please use a device with Bluetooth capability.');
      }

      // 🔥 STRATEGY 1: Use existing connection if available
      if (this.isConnected && this.bluetoothDevice && this.bluetoothDevice.gatt.connected) {
        console.log('✅ Using existing Bluetooth connection:', this.bluetoothDevice.name);
        await this.printViaBluetoothESCPOS(receiptData);
        console.log('✅ ESC/POS print completed via existing connection');
        return;
      }

      // 🔥 STRATEGY 2: Try to reconnect to previously paired device
      console.log('🔄 Checking for previously paired Bluetooth devices...');
      
      try {
        // Get previously authorized devices (no dialog)
        const devices = await navigator.bluetooth.getDevices();
        console.log(`📱 Found ${devices.length} previously paired device(s)`);
        
        if (devices.length > 0) {
          // Try to connect to the first paired device (most recent)
          for (const device of devices) {
            try {
              console.log(`🔌 Attempting to reconnect to: ${device.name || 'Unknown Device'}`);
              this.bluetoothDevice = device;
              
              // Connect to GATT server
              const server = await device.gatt!.connect();
              console.log('🔗 Connected to GATT server');

              // Try to find a suitable service
              let service = null;
              let characteristic = null;

              try {
                service = await server.getPrimaryService('49535343-fe7d-4ae5-8fa9-9fafd205e455');
                characteristic = await service.getCharacteristic('49535343-1e4d-4bd9-ba61-23c647249616');
              } catch (e1) {
                try {
                  service = await server.getPrimaryService('00001101-0000-1000-8000-00805f9b34fb');
                  const characteristics = await service.getCharacteristics();
                  characteristic = characteristics[0];
                } catch (e2) {
                  try {
                    service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
                    characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
                  } catch (e3) {
                    console.log('⚠️ No compatible service found on this device, trying next...');
                    continue;
                  }
                }
              }

              this.bluetoothCharacteristic = characteristic;
              this.isConnected = true;
              console.log('✅ Reconnected to paired printer successfully');
              
              // Print immediately
              await this.printViaBluetoothESCPOS(receiptData);
              console.log('✅ ESC/POS print completed via auto-reconnect');
              return;
              
            } catch (reconnectError) {
              console.log(`⚠️ Failed to reconnect to ${device.name}:`, reconnectError);
              continue; // Try next device
            }
          }
        }
      } catch (getDevicesError) {
        console.log('⚠️ getDevices() not supported or failed:', getDevicesError);
      }

      // 🔥 STRATEGY 3: Manual connection (shows device picker - only if auto-reconnect failed)
      console.log('📱 No paired device available, requesting manual connection...');
      const connected = await this.connectToBluetoothPrinter();
      
      if (!connected) {
        throw new Error('Failed to connect to Bluetooth printer');
      }

      // Print via Bluetooth
      await this.printViaBluetoothESCPOS(receiptData);
      console.log('✅ ESC/POS print completed via manual connection');

    } catch (error) {
      console.error('❌ Mobile ESC/POS print error:', error);
      throw error;
    }
  }

  /**
   * 🖨️ MOBILE PRINT: Direct ESC/POS print using new window (not iframe)
   * Opens print dialog with ESC/POS formatted for thermal printer
   * Print preview shows ONLY the receipt content, not the parent page
   * Now supports dynamic paper sizes
   */
  printMobileThermal(receiptData: any): void {
    console.log('🖨️ Starting mobile ESC/POS print...');
    
    // Get paper size configuration
    const paperSize = receiptData?._paperSize || this.currentPrinterConfig?.paperSize || '58mm';
    const paperConfig = this.getPaperSizeConfig(paperSize);
    
    // Generate ESC/POS commands
    const escposCommands = this.generateESCPOSCommands(receiptData);
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) {
      alert('Print Error: Popup blocked. Please allow popups for this site to print receipts.');
      return;
    }
    
    // Write ESC/POS content wrapped in pre tag
    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt - ${receiptData?.invoiceNumber || 'Invoice'}</title>
          <style>
            @media print {
              body { margin: 0 !important; }
              @page { 
                margin: 3mm; 
                size: ${paperConfig.width} auto;
              }
            }
            body { 
              font-family: 'Courier New', monospace; 
              font-size: ${paperConfig.fontSize}; 
              margin: 0; 
              padding: 3px;
              width: 100%;
              max-width: ${paperConfig.maxWidth};
              line-height: 1.2;
            }
            pre {
              margin: 0;
              padding: 0;
              font-family: 'Courier New', monospace;
              font-size: ${paperConfig.fontSize};
              white-space: pre-wrap;
              word-wrap: break-word;
            }
          </style>
        </head>
        <body><pre>${escposCommands}</pre></body>
      </html>
    `);
    
    printWindow.document.close();
    
    // Wait for content to load, then trigger print dialog
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      console.log('✅ ESC/POS print dialog opened');
    }, 500);
  }

  /**
   * Generate HTML content for browser printing
   * Now supports dynamic paper sizes
   */
  private generatePrintableReceipt(receiptData: any, paperConfig?: PaperSizeConfig): string {
    // Use provided config or get from current printer config
    const config = paperConfig || this.getPaperSizeConfig();
    
    // Get customer display name (same logic as preview)
    const getCustomerDisplayName = () => {
      if (!receiptData?.customerName || receiptData.customerName === 'Walk-in Customer') {
        return receiptData?.customerName || 'Walk-in Customer';
      }
      return receiptData.customerName;
    };

    // Check if has customer details (same logic as preview)
    const hasCustomerDetails = () => {
      return receiptData?.customerName && 
             receiptData.customerName !== 'Walk-in Customer' &&
             (receiptData?.customerAddress && receiptData.customerAddress !== 'N/A') ||
             (receiptData?.customerTin && receiptData.customerTin !== 'N/A');
    };

    let html = `
      <div class="header-section">
        <div class="bold" style="font-size: 14px;">${receiptData?.storeInfo?.storeName || 'Store Name'}</div>
        <div>${receiptData?.storeInfo?.address || 'Store Address'}</div>
        <div>Tel: ${receiptData?.storeInfo?.phone || 'N/A'}</div>
        <div>Email: ${receiptData?.storeInfo?.email || 'N/A'}</div>
        <div>TIN: ${receiptData?.storeInfo?.tin || 'N/A'}</div>
    `;

    // BIR Information (matching preview)
    if (receiptData?.storeInfo?.birPermitNo) {
      html += `        <div><strong>BIR Permit No:</strong> ${receiptData.storeInfo.birPermitNo}</div>`;
    }
    if (receiptData?.storeInfo?.inclusiveSerialNumber) {
      html += `        <div><strong>Serial Number:</strong> ${receiptData.storeInfo.inclusiveSerialNumber}</div>`;
    }
    if (receiptData?.storeInfo?.minNumber) {
      html += `        <div><strong>MIN:</strong> ${receiptData.storeInfo.minNumber}</div>`;
    }

    html += `
        <div><strong>Invoice #: ${receiptData?.invoiceNumber || 'Auto-generated'}</strong></div>
        <div class="bold">${receiptData?.storeInfo?.invoiceType || 'SALES INVOICE'}</div>
      </div>
      
      <div class="line"></div>
    `;

    // Payment Method Indicators (Cash by default, both can be selected)
    const isCashSale = receiptData?.isCashSale !== false; // Default to true unless explicitly false
    const isChargeSale = receiptData?.isChargeSale === true; // Only true if explicitly set
    
    html += `
      <div style="margin: 10px 0;">
        <div style="display: flex; justify-content: center; gap: 20px;">
          <div style="display: flex; align-items: center; gap: 5px;">
            <span>Cash</span>
            <div style="width: 12px; height: 12px; border: 1px solid #000; border-radius: 50%; ${isCashSale ? 'background-color: #000;' : ''}"></div>
          </div>
          <div style="display: flex; align-items: center; gap: 5px;">
            <span>Charge</span>
            <div style="width: 12px; height: 12px; border: 1px solid #000; border-radius: 50%; ${isChargeSale ? 'background-color: #000;' : ''}"></div>
          </div>
        </div>
      </div>
    `;

    // Sold To Section (matching preview)
    html += `
      <div class="line"></div>
      <div class="bold">SOLD TO: ${getCustomerDisplayName()}</div>
    `;

    if (hasCustomerDetails()) {
      if (receiptData?.customerAddress && receiptData?.customerAddress !== 'N/A') {
        html += `<div><strong>Address:</strong> ${receiptData.customerAddress}</div>`;
      }
      if (receiptData?.customerTin && receiptData?.customerTin !== 'N/A') {
        html += `<div><strong>TIN:</strong> ${receiptData.customerTin}</div>`;
      }
    }

    // Cashier and Date (matching preview)
    html += `
      <div class="line"></div>
      <div><strong>Cashier:</strong> ${receiptData?.cashier || 'N/A'}</div>
      <div><strong>Date:</strong> ${new Date(receiptData?.receiptDate || new Date()).toLocaleString()}</div>
      <div class="line"></div>
      
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th style="text-align: left; padding: 4px 2px; border-bottom: 1px solid #000;">Product</th>
            <th style="text-align: center; padding: 4px 2px; border-bottom: 1px solid #000;">Qty</th>
            <th style="text-align: right; padding: 4px 2px; border-bottom: 1px solid #000;">Amount</th>
            <th style="text-align: right; padding: 4px 2px; border-bottom: 1px solid #000;">Total</th>
          </tr>
        </thead>
        <tbody>
    `;

    // Items (matching preview format with SKU)
    receiptData?.items?.forEach((item: any) => {
      const qty = item.quantity || 1;
      const unitType = item.unitType && item.unitType !== 'N/A' ? ` ${item.unitType}` : '';
      const qtyDisplay = `${qty}${unitType}`;
      
      html += `
        <tr>
          <td style="padding: 4px 2px; vertical-align: top;">
            <div style="font-weight: bold;">${item.productName || item.name}</div>
            <div style="font-size: 10px; color: #666;">${item.skuId || item.productId || 'N/A'}</div>
          </td>
          <td style="padding: 4px 2px; text-align: center; vertical-align: top;">${qtyDisplay}</td>
          <td style="padding: 4px 2px; text-align: right; vertical-align: top;">₱${(item.sellingPrice || item.price || 0).toFixed(2)}</td>
          <td style="padding: 4px 2px; text-align: right; vertical-align: top;">₱${(item.total || 0).toFixed(2)}</td>
        </tr>
      `;
    });

    html += `
        </tbody>
      </table>
      <div class="line"></div>
      
      <table style="width: 100%;">
        <tr><td>Subtotal:</td><td class="right">₱${(receiptData?.subtotal || 0).toFixed(2)}</td></tr>
        <tr><td>VAT (12%):</td><td class="right">₱${(receiptData?.vatAmount || 0).toFixed(2)}</td></tr>
        <tr><td>VAT Exempt:</td><td class="right">₱${(receiptData?.vatExempt || 0).toFixed(2)}</td></tr>
        <tr><td>Discount:</td><td class="right">₱${(receiptData?.discount || 0).toFixed(2)}</td></tr>
    `;

    html += `
        <tr style="border-top: 1px solid #000; font-weight: bold;">
          <td style="padding-top: 5px;"><strong>TOTAL:</strong></td>
          <td class="right" style="padding-top: 5px;"><strong>₱${(receiptData?.totalAmount || receiptData?.netAmount || 0).toFixed(2)}</strong></td>
        </tr>
      </table>`;

    // Discount Information Section (for PWD/Senior/Special Discounts)
    if (receiptData?.orderDiscount) {
      html += `
        <div class="line"></div>
        <div style="margin: 10px 0;">
          <h4 style="margin: 5px 0; font-size: 14px;">Discount Information</h4>
      `;
      
      let discountType = receiptData.orderDiscount.type;
      if (receiptData.orderDiscount.customType) {
        discountType += ` (${receiptData.orderDiscount.customType})`;
      }
      html += `<div><strong>${discountType} Discount</strong></div>`;
      
      if (receiptData.orderDiscount.exemptionId) {
        html += `<div>ID: ${receiptData.orderDiscount.exemptionId}</div>`;
      }
      
      if (receiptData.orderDiscount.customerName) {
        html += `<div>Customer: ${receiptData.orderDiscount.customerName}</div>`;
      }
      
      const discountAmt = (receiptData?.discount || 0).toFixed(2);
      html += `<div>Discount Amount: ₱${discountAmt}</div>`;
      
      // Signature section for PWD/Senior discounts
      if (receiptData.orderDiscount.type === 'PWD' || receiptData.orderDiscount.type === 'SENIOR') {
        html += `
          <div style="margin-top: 15px;">
            <div style="margin-bottom: 5px;"><strong>Customer Signature:</strong></div>
        `;
        if (receiptData.orderDiscount.signature) {
          html += `<div>${receiptData.orderDiscount.signature}</div>`;
        } else {
          html += `<div style="border-bottom: 1px solid #000; width: 200px; height: 20px;">&nbsp;</div>`;
        }
        html += `</div>`;
      }
      html += `</div>`;
    }

    // Validity Notice
    if (receiptData?.validityNotice) {
      html += `
        <div style="text-align: center; margin-top: 15px; font-size: 10px; border-top: 1px dashed #ccc; padding-top: 10px;">
          <div>${receiptData.validityNotice}</div>
        </div>
      `;
    }

    html += `
      <div class="footer-section no-break">
        <div>Thank you for your purchase!</div>
        <div>Please come again</div>
        <br>
        <div style="margin-top: 10px;">&nbsp;</div>
      </div>
    `;

    return html;
  }
}
