import { Injectable, inject } from '@angular/core';
import { SqliteStorageService } from '../core/services/sqlite-storage.service';
import { generateESCPOSCommands, encodeEscposStringToBytes } from './escpos-utils';

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
export class PrintServiceWeb {
  private sqliteService = inject(SqliteStorageService);
  
  // Bluetooth printer connection state
  private bluetoothDevice: any = null;
  private bluetoothCharacteristic: any = null;
  private isConnected = false;
  
  // USB printer connection state
  private usbPort: any = null;
  private usbConnected = false;
  
  // Current printer configuration (loaded from SQLite)
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
   * ≡ƒöº Load default printer configuration from SQLite
   */
  async loadPrinterConfig(): Promise<PrinterConfig | null> {
    try {
      const printers = await this.sqliteService.getSetting('printerConfigs') as PrinterConfig[] | null;
      if (printers && Array.isArray(printers) && printers.length > 0) {
        // Find default printer or first active printer
        const defaultPrinter = printers.find(p => p.isDefault && p.status === 'active');
        const activePrinter = printers.find(p => p.status === 'active');
        this.currentPrinterConfig = defaultPrinter || activePrinter || printers[0];
        return this.currentPrinterConfig;
      }
      return null;
    } catch (error) {
      console.error('Failed to load printer config:', error);
      return null;
    }
  }
  
  /**
   * ≡ƒôä Get current paper size configuration
   */
  getPaperSizeConfig(paperSize?: string): PaperSizeConfig {
    const size = paperSize || this.currentPrinterConfig?.paperSize || '58mm';
    return this.paperSizeConfigs[size] || this.paperSizeConfigs['58mm'];
  }
  
  /**
   * ≡ƒöî Get current printer connection type
   */
  getConnectionType(): 'bluetooth' | 'wifi' | 'usb' | 'none' {
    return this.currentPrinterConfig?.connectionType || 'none';
  }
  
  /**
   * ≡ƒû¿∩╕Å Get current printer config
   */
  getCurrentPrinterConfig(): PrinterConfig | null {
    return this.currentPrinterConfig;
  }
  
  /**
   * ≡ƒöä Refresh printer config from SQLite
   */
  async refreshPrinterConfig(): Promise<PrinterConfig | null> {
    return this.loadPrinterConfig();
  }

  /**
   * ≡ƒÄ» DIRECT HARDWARE PRINT: Bypasses browser dialog when hardware printers are available
   * USB: NO FALLBACK - Direct thermal printing only (no browser dialog)
   * Bluetooth: Has fallback to browser print if connection fails
   */
  async printReceiptDirect(receiptData: any): Promise<{ success: boolean; method: string; message: string }> {
    try {
      console.log('≡ƒÄ» Starting direct hardware print...');
      
      // ≡ƒöÑ PRIORITY 1: Try USB printer first (if Web Serial API is supported)
      if ('serial' in navigator) {
        try {
          console.log('≡ƒöî USB printing supported - attempting direct USB print...');
          await this.printToThermalPrinter(receiptData);
          return {
            success: true,
            method: 'USB',
            message: 'Receipt printed successfully via USB thermal printer'
          };
        } catch (usbError: any) {
          console.log('ΓÜá∩╕Å USB printing failed:', usbError.message);
          
          // If no port was selected or connection failed, force port selection dialog
          if (usbError.message.includes('No USB printer selected') || 
              usbError.message.includes('Port selection failed') ||
              !this.usbPort) {
            try {
              console.log('≡ƒöä Retrying with port selection dialog...');
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
              console.error('Γ¥î USB retry failed:', retryError.message);
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
          console.log('≡ƒöä Trying Bluetooth printer...');
        }
      }
      
      // ≡ƒöÑ PRIORITY 2: Try Bluetooth printer
      if (navigator.bluetooth) {
        console.log('≡ƒöì Checking Bluetooth availability...');
        const hasBluetoothPrinters = await this.checkBluetoothPrintersAvailable();
        console.log('≡ƒöì Bluetooth check result:', hasBluetoothPrinters, 'Already connected:', this.isConnected);
        
        if (hasBluetoothPrinters || this.isConnected) {
          try {
            console.log('≡ƒô▒ Opening browser print dialog for Bluetooth and other printers...');
            await this.printReceiptSmart(receiptData);
            console.log('Γ£à Print dialog opened successfully');
            return {
              success: true,
              method: 'Browser Print',
              message: 'Print dialog opened successfully. Please select your printer.'
            };
          } catch (btError: any) {
            console.error(`Γ¥î Bluetooth printing failed:`, btError);
            console.error(`Γ¥î Error message: ${btError.message}`);
            console.error(`Γ¥î Error stack:`, btError.stack);
          }
        } else {
          console.log('ΓÜá∩╕Å No Bluetooth printers available or connected');
        }
      } else {
        console.log('Γ¥î Web Bluetooth API not available');
      }
      
      // No hardware printers available
      console.error('Γ¥î No hardware printers available');
      return {
        success: false,
        method: 'None',
        message: 'No hardware printers found. Please connect a USB or Bluetooth thermal printer.'
      };
      
    } catch (error: any) {
      console.error('Γ¥î Direct print failed:', error);
      return {
        success: false,
        method: 'Failed',
        message: error.message || 'Print operation failed'
      };
    }
  }

  /**
   * ≡ƒÜÇ SMART PRINT: Auto-detects printer type and connection method
   * Priority: 1) USB/Cable printers (Web Serial) 2) Bluetooth (via browser print) 3) Browser print fallback
   */
  async printReceiptSmart(receiptData: any): Promise<void> {
    try {
      console.log('≡ƒû¿∩╕Å Starting smart print process...');
      
      // ≡ƒöÑ PRIORITY 1: Try USB/Cable printer first (Web Serial API)
      if ('serial' in navigator) {
        try {
          console.log('≡ƒöî USB/Cable printer support detected, trying USB connection...');
          await this.printToThermalPrinter(receiptData);
          console.log('Γ£à USB/Cable print completed successfully');
          return;
        } catch (usbError: any) {
          console.log('ΓÜá∩╕Å USB/Cable printer error:', usbError.message);
          
          // If user cancelled port selection, don't try Bluetooth
          if (usbError.message.includes('cancelled') || usbError.message.includes('No port selected')) {
            throw new Error('Print cancelled. Please select your USB printer port or use a Bluetooth printer.');
          }
          
          console.log('≡ƒöä USB failed, trying Bluetooth printer...');
        }
      } else {
        console.log('ΓÜá∩╕Å USB printing not supported in this browser, trying Bluetooth...');
      }

      // ≡ƒöÑ PRIORITY 2: Bluetooth printer via browser print (mobile-friendly)
      // Use the same approach as mobile preview - show ESC/POS formatted content and use window.print()
      console.log('≡ƒô▒ Opening browser print dialog (supports all printers including Bluetooth)...');
      this.printMobileThermal(receiptData);
      console.log('Γ£à Print dialog opened successfully');

    } catch (error) {
      console.error('Γ¥î Print error:', error);
      
      // Show error message
      console.error('Γ¥î Print error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unable to print receipt. Please check your printer connection.';
      alert(`Print Error: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * ≡ƒöì Check if hardware printers (USB or Bluetooth) are connected and ready
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
              console.log('≡ƒöî USB thermal printer detected and ready');
              break;
            }
          }
        }
      } catch (error) {
        console.log('≡ƒöì USB printer check failed:', error);
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
      }
    }
    
    return result;
  }

  /**
   * ≡ƒöì Check if Bluetooth printers are available
   */
  private async checkBluetoothPrintersAvailable(): Promise<boolean> {
    try {
      if (!navigator.bluetooth) {
        return false;
      }

      // Check if getDevices is supported (newer API)
      if (typeof navigator.bluetooth.getDevices === 'function') {
        const devices = await navigator.bluetooth.getDevices();
        return devices.length > 0;
      }
      
      // If getDevices not available, assume Bluetooth is available
      // (will trigger connection dialog on first use)
      return true;
    } catch (error) {
      console.log('≡ƒöì Bluetooth printer check failed:', error);
      return false;
    }
  }

  /**
   * ≡ƒô▒ Connect to Bluetooth thermal printer
   */
  private async connectToBluetoothPrinter(): Promise<boolean> {
    try {
      console.log('≡ƒöì Scanning for Bluetooth printers...');
      
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

      console.log('≡ƒô▒ Found device:', this.bluetoothDevice.name);

      // Connect to GATT server
      const server = await this.bluetoothDevice.gatt!.connect();
      console.log('≡ƒöù Connected to GATT server');

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
      console.log('Γ£à Bluetooth printer connected successfully');
      return true;

    } catch (error) {
      console.error('Γ¥î Bluetooth connection failed:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * ≡ƒû¿∩╕Å Print via Bluetooth using ESC/POS commands
   */
  private async printViaBluetoothESCPOS(receiptData: any): Promise<void> {
    if (!this.bluetoothCharacteristic) {
      throw new Error('Bluetooth characteristic not available');
    }

    // Generate ESC/POS commands
    const escposCommands = this.generateESCPOSCommands(receiptData);
    
    // Convert string to Uint8Array for Bluetooth transmission
    const data = encodeEscposStringToBytes(escposCommands);
    
    // Check characteristic properties
    const properties = this.bluetoothCharacteristic.properties;
    
    // Send to printer in chunks
    const chunkSize = 512;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      
      try {
        // Try writeValueWithoutResponse first (faster, works for most thermal printers)
        if (properties.writeWithoutResponse) {
          await this.bluetoothCharacteristic.writeValueWithoutResponse(chunk);
        } else if (properties.write) {
          // Fall back to writeValue (with response)
          await this.bluetoothCharacteristic.writeValue(chunk);
        } else {
          throw new Error('Characteristic does not support write operations');
        }
      } catch (writeError: any) {
        console.error(`Γ¥î Chunk ${i / chunkSize + 1} write failed:`, writeError);
        throw new Error(`Bluetooth write failed: ${writeError.message}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    console.log('Γ£à All data sent to Bluetooth printer');
  }

  /**
   * ≡ƒº¬ Test USB printer connectivity
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
      console.log('≡ƒöî Starting USB thermal printer process...');
      
      if (!('serial' in navigator)) {
        throw new Error('Web Serial API not supported');
      }

      let port = this.usbPort;

      // Γ£à OPTIMIZED: Skip printer lookup if already connected
      if (this.usbConnected && port && port.readable && !port.readable.locked) {
        console.log('Γ£à Using existing USB connection - skipping printer lookup');
      } else {
        // Need to find or request a port
        console.log('≡ƒöì USB not connected, searching for printer...');
        
        if (!port || !port.readable) {
          const ports = await (navigator as any).serial.getPorts();
          
          if (ports.length > 0) {
            port = ports[0];
            console.log('≡ƒô▒ Found previously authorized USB printer');
          } else {
            // No authorized ports - ALWAYS show port selection dialog
            console.log('≡ƒöì No authorized printers found, opening port selection dialog...');
            try {
              port = await (navigator as any).serial.requestPort();
              console.log('Γ£à User selected USB port');
            } catch (error: any) {
              if (error.name === 'NotFoundError') {
                throw new Error('No USB printer selected. Please select your printer from the list.');
              }
              throw new Error(`Port selection failed: ${error.message}`);
            }
          }
          
          this.usbPort = port;
        }

        // Only open if port is not already open
        if (!port.readable) {
          console.log('≡ƒöî Opening USB port connection...');
          await port.open({ 
            baudRate: 9600,
            dataBits: 8,
            stopBits: 1,
            parity: 'none',
            flowControl: 'none'
          });
        } else {
          console.log('Γ£à Port already open, reusing connection');
        }
      }

      const escPosCommands = this.generateESCPOSCommands(receiptData);
      const data = encodeEscposStringToBytes(escPosCommands);

      if (!port.writable) {
        throw new Error('USB port is not writable');
      }

      // Wait for stream to be unlocked (max 2 seconds)
      let attempts = 0;
      while (port.writable.locked && attempts < 20) {
        console.log(`ΓÅ│ Waiting for stream to unlock (attempt ${attempts + 1}/20)...`);
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (port.writable.locked) {
        console.error('Γ¥î Stream still locked after waiting, resetting port...');
        // Force close and clear connection
        try {
          await port.close();
          this.usbPort = null;
          this.usbConnected = false;
        } catch (closeError) {
          console.error('Γ¥î Error closing port:', closeError);
        }
        throw new Error('USB port stream is locked. Please try printing again.');
      }

      // Use try-finally to ensure writer is always released
      let writer;
      try {
        writer = port.writable.getWriter();
        await writer.write(data);
        console.log('Γ£à Data written to USB printer');
      } finally {
        if (writer) {
          try {
            writer.releaseLock();
            console.log('Γ£à Writer lock released');
          } catch (releaseError) {
            console.warn('ΓÜá∩╕Å Error releasing writer lock:', releaseError);
          }
        }
      }

      this.usbConnected = true;
      console.log('Γ£à Receipt sent to USB thermal printer successfully');

    } catch (error: any) {
      console.error('Γ¥î USB thermal printer error:', error);
      this.usbPort = null;
      this.usbConnected = false;
      throw error;
    }
  }

  /**
   * ≡ƒôä Generate ESC/POS commands for thermal printer (using shared utility)
   * Made public to allow components to generate ESC/POS content for preview
   * Updated: Support multiple paper sizes (58mm, 80mm, 127mm)
   * Cash drawer command is automatically appended at the end
   */
  generateESCPOSCommands(receiptData: any): string {
    // Get paper size configuration
    const paperSize = receiptData?._paperSize || this.currentPrinterConfig?.paperSize || '58mm';
    const paperConfig = this.getPaperSizeConfig(paperSize);
    
    // Use shared utility function from escpos-utils
    return generateESCPOSCommands(receiptData, paperConfig);
  }

  /**
   * ≡ƒû¿∩╕Å Print receipt using browser's window.print() - Universal printer support
   * Now supports dynamic paper sizes from printer configuration
   * Uses iframe to avoid showing about:blank popup
   */
  printBrowserReceipt(receiptData: any): void {
    console.log('≡ƒû¿∩╕Å Opening browser print dialog...');
    
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
      console.error('Γ¥î Unable to create print iframe');
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
        console.log('Γ£à Print dialog opened');
        
        // Remove iframe after printing
        setTimeout(() => {
          document.body.removeChild(iframe);
          console.log('≡ƒº╣ Print iframe cleaned up');
        }, 1000);
      } catch (error) {
        console.error('Γ¥î Print error:', error);
        document.body.removeChild(iframe);
        alert('Print Error: Unable to open print dialog. Please try again.');
      }
    }, 500);
  }

  /**
   * ≡ƒû¿∩╕Å Direct print without dialog - Auto-prints to default/last used printer
   * Perfect for mobile devices with paired Bluetooth printers
   */
  printDirectMobile(receiptData: any): void {
    console.log('≡ƒû¿∩╕Å Starting direct mobile print (no dialog)...');
    
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
      console.error('Γ¥î Unable to create print iframe');
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
        console.log('Γ£à Direct print command sent');
        
        // Remove iframe after printing
        setTimeout(() => {
          document.body.removeChild(iframe);
          console.log('≡ƒº╣ Print iframe cleaned up');
        }, 1000);
      } catch (error) {
        console.error('Γ¥î Direct print error:', error);
        document.body.removeChild(iframe);
        // Fallback to dialog version
        this.printBrowserReceipt(receiptData);
      }
    }, 500);
  }

  /**
   * ≡ƒû¿∩╕Å MOBILE ESC/POS: Direct print to paired Bluetooth printer without dialog
   * Reuses existing connection or connects to previously paired device
   */
  async printMobileESCPOS(receiptData: any): Promise<void> {
    try {
      console.log('≡ƒû¿∩╕Å Starting mobile ESC/POS print...');
      
      // Check if Web Bluetooth is supported
      if (!navigator.bluetooth) {
        console.log('ΓÜá∩╕Å Bluetooth not supported on this device');
        throw new Error('Bluetooth not supported. Please use a device with Bluetooth capability.');
      }

      // ≡ƒöÑ STRATEGY 1: Use existing connection if available
      if (this.isConnected && this.bluetoothDevice && this.bluetoothDevice.gatt.connected) {
        console.log('Γ£à Using existing Bluetooth connection:', this.bluetoothDevice.name);
        await this.printViaBluetoothESCPOS(receiptData);
        console.log('Γ£à ESC/POS print completed via existing connection');
        return;
      }

      // ≡ƒöÑ STRATEGY 2: Try to reconnect to previously paired device
      console.log('≡ƒöä Checking for previously paired Bluetooth devices...');
      
      try {
        // Get previously authorized devices (no dialog)
        const devices = await navigator.bluetooth.getDevices();
        console.log(`≡ƒô▒ Found ${devices.length} previously paired device(s)`);
        
        if (devices.length > 0) {
          // Try to connect to the first paired device (most recent)
          for (const device of devices) {
            try {
              console.log(`≡ƒöî Attempting to reconnect to: ${device.name || 'Unknown Device'}`);
              this.bluetoothDevice = device;
              
              // Connect to GATT server
              const server = await device.gatt!.connect();
              console.log('≡ƒöù Connected to GATT server');

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
                    console.log('ΓÜá∩╕Å No compatible service found on this device, trying next...');
                    continue;
                  }
                }
              }

              this.bluetoothCharacteristic = characteristic;
              this.isConnected = true;
              console.log('Γ£à Reconnected to paired printer successfully');
              
              // Print immediately
              await this.printViaBluetoothESCPOS(receiptData);
              console.log('Γ£à ESC/POS print completed via auto-reconnect');
              return;
              
            } catch (reconnectError) {
              console.log(`ΓÜá∩╕Å Failed to reconnect to ${device.name}:`, reconnectError);
              continue; // Try next device
            }
          }
        }
      } catch (getDevicesError) {
        console.log('ΓÜá∩╕Å getDevices() not supported or failed:', getDevicesError);
      }

      // ≡ƒöÑ STRATEGY 3: Manual connection (shows device picker - only if auto-reconnect failed)
      console.log('≡ƒô▒ No paired device available, requesting manual connection...');
      const connected = await this.connectToBluetoothPrinter();
      
      if (!connected) {
        throw new Error('Failed to connect to Bluetooth printer');
      }

      // Print via Bluetooth
      await this.printViaBluetoothESCPOS(receiptData);
      console.log('Γ£à ESC/POS print completed via manual connection');

    } catch (error) {
      console.error('Γ¥î Mobile ESC/POS print error:', error);
      throw error;
    }
  }

  /**
   * ≡ƒû¿∩╕Å MOBILE PRINT: Direct ESC/POS print using new window (not iframe)
   * Opens print dialog with ESC/POS formatted for thermal printer
   * Print preview shows ONLY the receipt content, not the parent page
   * Now supports dynamic paper sizes
   */
  printMobileThermal(receiptData: any): void {
    console.log('≡ƒû¿∩╕Å Starting mobile thermal print...');
    
    // Get paper size configuration
    const paperSize = receiptData?._paperSize || this.currentPrinterConfig?.paperSize || '58mm';
    const paperConfig = this.getPaperSizeConfig(paperSize);
    
    // Generate HTML receipt instead of ESC/POS to avoid control character display issues
    const htmlContent = this.generatePrintableReceipt(receiptData, paperConfig);
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) {
      alert('Print Error: Popup blocked. Please allow popups for this site to print receipts.');
      return;
    }
    
    // Write HTML content with thermal printer styling
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
              padding: 5px;
              width: 100%;
              max-width: ${paperConfig.maxWidth};
              line-height: 1.3;
            }
            .header-section { text-align: center; margin-bottom: 10px; }
            .bold { font-weight: bold; }
            .line { border-top: 1px dashed #000; margin: 5px 0; }
            table { width: 100%; border-collapse: collapse; font-size: ${paperConfig.fontSize}; }
            td { padding: 2px 0; }
            .right { text-align: right; }
            .footer-section { text-align: center; margin-top: 10px; }
            .no-break { page-break-inside: avoid; }
          </style>
        </head>
        <body>${htmlContent}</body>
      </html>
    `);
    
    printWindow.document.close();
    
    // Wait for content to load, then trigger print dialog
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      console.log('Γ£à ESC/POS print dialog opened');
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

    let branchName = '';
    if (receiptData?.storeInfo?.branchName && receiptData.storeInfo.branchName.trim() !== '') {
      branchName = receiptData.storeInfo.branchName;
    } else if (receiptData?.order?.branchName && receiptData.order.branchName.trim() !== '') {
      branchName = receiptData.order.branchName;
    } else if (receiptData?.branchName && receiptData.branchName.trim() !== '') {
      branchName = receiptData.branchName;
    }

    let html = `
      <div class="header-section">
        <div class="bold" style="font-size: 18px; font-weight: 900;">${receiptData?.storeInfo?.storeName || 'Store Name'}</div>
${branchName ? `        <div class="bold">Branch</div>\n        <div>${branchName}</div>\n` : ''}
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

    // Payment Method (single-line display)
    const isCashSale = receiptData?.isCashSale !== false; // Default to true unless explicitly false
    const isChargeSale = receiptData?.isChargeSale === true; // Only true if explicitly set
    const paymentMethod = isCashSale ? 'Cash' : (isChargeSale ? 'Charge' : 'N/A');

    html += `
      <div style="margin: 10px 0;">
        <div><strong>Payment:</strong> ${paymentMethod}</div>
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
          <td style="padding: 4px 2px; text-align: right; vertical-align: top;">${(item.sellingPrice || item.price || 0).toFixed(2)}</td>
          <td style="padding: 4px 2px; text-align: right; vertical-align: top;">${(item.total || 0).toFixed(2)}</td>
        </tr>
      `;
    });

    html += `
        </tbody>
      </table>
      <div class="line"></div>
      
      <table style="width: 100%;">
        <tr><td>Subtotal:</td><td class="right">${(receiptData?.subtotal || 0).toFixed(2)}</td></tr>
        <tr><td>VAT (12%):</td><td class="right">${(receiptData?.vatAmount || 0).toFixed(2)}</td></tr>
        <tr><td>VAT Exempt:</td><td class="right">${(receiptData?.vatExempt || 0).toFixed(2)}</td></tr>
        <tr><td>Discount:</td><td class="right">${(receiptData?.discount || 0).toFixed(2)}</td></tr>
    `;

    html += `
        <tr style="border-top: 1px solid #000; font-weight: bold;">
          <td style="padding-top: 5px;"><strong>TOTAL:</strong></td>
          <td class="right" style="padding-top: 5px;"><strong>${(receiptData?.totalAmount || receiptData?.netAmount || 0).toFixed(2)}</strong></td>
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
      html += `<div>Discount Amount: Γé▒${discountAmt}</div>`;
      
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
        <div>Please come again.</div>
        <br>
        <div style="margin-top: 10px;">&nbsp;</div>
      </div>
    `;

    return html;
  }
}
