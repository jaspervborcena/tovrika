import { Injectable } from '@angular/core';

// Web Bluetooth API types (simplified)
declare const navigator: any;

@Injectable({
  providedIn: 'root'
})
export class PrintService {
  
  // Bluetooth printer connection state
  private bluetoothDevice: any = null;
  private bluetoothCharacteristic: any = null;
  private isConnected = false;
  
  // USB printer connection state
  private usbPort: any = null;
  private usbConnected = false;

  constructor() { }

  /**
   * 🚀 SMART PRINT: Auto-detects printer type and connection method
   * Priority: 1) USB/Cable printers (Web Serial) 2) Bluetooth 3) Browser print
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
          
          // Check if we have USB printers available - if yes, try system print dialog as fallback
          const hasUsbPrinters = await this.checkUSBPrintersAvailable();
          if (hasUsbPrinters) {
            console.log('🔄 USB direct connection failed, trying system print dialog...');
            try {
              this.printBrowserReceipt(receiptData);
              console.log('✅ Fallback to system print dialog successful');
              return;
            } catch (printError) {
              console.error('💥 Both USB direct and system print failed:', printError);
              throw new Error('❌ USB printer detected but connection failed. System print dialog also failed. Please check browser console for detailed error information.');
            }
          }
          
          console.log('🔄 No USB printers found, trying Bluetooth printer...');
        }
      } else {
        console.log('⚠️ USB printing not supported in this browser, trying Bluetooth...');
      }

      // 🔥 PRIORITY 2: Try Bluetooth printer
      // Check if Web Bluetooth is supported
      if (!navigator.bluetooth) {
        throw new Error('Neither USB nor Bluetooth printer support detected. Please connect a USB printer or use a Bluetooth-compatible browser.');
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
        console.log('⚠️ No Bluetooth printers found');
        throw new Error('❌ No printers available. Please connect a USB printer or pair a Bluetooth printer.');
      }

      // Try to connect to Bluetooth printer
      if (!this.isConnected) {
        console.log('📱 Attempting Bluetooth printer connection...');
        const connected = await this.connectToBluetoothPrinter();
        
        if (!connected) {
          throw new Error('❌ Bluetooth printer connection failed. Please check your Bluetooth printer is powered on and paired.');
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
      
      // Show user-friendly error instead of browser print fallback
      alert(`Print Error: ${error instanceof Error ? error.message : 'Unable to print receipt. Please check your printer connection.'}`);
      throw error;
    }
  }

  /**
   * � Check if USB printers are available
   */
  private async checkUSBPrintersAvailable(): Promise<boolean> {
    try {
      if (!('serial' in navigator)) {
        return false;
      }

      // Check if any USB ports were previously granted
      const ports = await (navigator as any).serial.getPorts();
      if (ports.length > 0) {
        console.log('✅ USB printer ports available:', ports.length);
        return true;
      }
      return false;
    } catch (error) {
      console.log('🔍 USB printer check failed:', error);
      return false;
    }
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
   * �📱 Connect to Bluetooth thermal printer
   */
  private async connectToBluetoothPrinter(): Promise<boolean> {
    try {
      console.log('🔍 Scanning for Bluetooth printers...');
      
      // Request Bluetooth device - use broader search for thermal printers
      this.bluetoothDevice = await navigator.bluetooth.requestDevice({
        // Don't use filters initially - let user choose from available devices
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb', // Custom service
          '0000110e-0000-1000-8000-00805f9b34fb', // Audio/Video Remote Control
          '00001101-0000-1000-8000-00805f9b34fb', // Serial Port Profile
          '0000180f-0000-1000-8000-00805f9b34fb', // Battery Service
          '49535343-fe7d-4ae5-8fa9-9fafd205e455'  // Common thermal printer service
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
        // Try common thermal printer service first
        service = await server.getPrimaryService('49535343-fe7d-4ae5-8fa9-9fafd205e455');
        characteristic = await service.getCharacteristic('49535343-1e4d-4bd9-ba61-23c647249616');
      } catch (e1) {
        try {
          // Try Serial Port Profile
          service = await server.getPrimaryService('00001101-0000-1000-8000-00805f9b34fb');
          const characteristics = await service.getCharacteristics();
          characteristic = characteristics[0]; // Use first available
        } catch (e2) {
          try {
            // Try custom service
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
    
    // Send to printer in chunks (some printers have buffer limits)
    const chunkSize = 512;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      await this.bluetoothCharacteristic.writeValue(chunk);
      
      // Small delay between chunks
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  /**
   * 📄 Generate ESC/POS commands for 58mm thermal printer
   * Optimized for small paper width with condensed fonts
   */
  private generateESCPOSCommands(receiptData: any): string {
    let commands = '';
    
    // Initialize printer with smaller font and natural alignment
    commands += '\x1B\x40'; // ESC @ - Initialize (resets all settings)
    commands += '\x1B\x21\x01'; // ESC ! - Small font size with compressed printing
    commands += '\x1B\x4D\x01'; // ESC M - Select font B (smaller)
    commands += '\x0F'; // SI - Select condensed printing
    commands += '\x1B\x20\x00'; // ESC SP - Set character spacing to 0 (compact)
    commands += '\x1B\x33\x10'; // ESC 3 - Set line spacing to minimal
    
    // Store header (natural alignment like SOLD TO)
    commands += '\x1B\x45\x01'; // Bold on
    commands += (receiptData?.storeInfo?.storeName || 'Store Name') + '\n';
    commands += '\x1B\x45\x00'; // Bold off
    
    // Store details (natural alignment)
    commands += (receiptData?.storeInfo?.address || 'Store Address') + '\n';
    commands += `Tel: ${receiptData?.storeInfo?.phone || 'N/A'}\n`;
    commands += `Email: ${receiptData?.storeInfo?.email || 'N/A'}\n`;
    commands += `TIN: ${receiptData?.storeInfo?.tin || 'N/A'}\n`;
    
    // BIR Information (condensed)
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
    
    // Invoice Type (natural alignment, bold)
    commands += '\x1B\x45\x01'; // Bold on
    commands += (receiptData?.storeInfo?.invoiceType || 'SALES INVOICE') + '\n';
    commands += '\x1B\x45\x00'; // Bold off
    
    commands += '--------------------------------------------------\n'; // 50 chars
    
    // Payment Method Indicators (natural alignment)
    const isCashSale = receiptData?.paymentMethod === 'cash' || !receiptData?.paymentMethod;
    const isChargeSale = receiptData?.paymentMethod === 'charge' || receiptData?.paymentMethod === 'credit';
    commands += `Cash: ${isCashSale ? '[X]' : '[ ]'}   Charge: ${isChargeSale ? '[X]' : '[ ]'}\n`;
    
    commands += '--------------------------------------------------\n';
    
    // Customer info
    const getCustomerDisplayName = () => {
      if (!receiptData?.customerName || receiptData.customerName === 'Walk-in Customer') {
        return receiptData?.customerName || 'Walk-in Customer';
      }
      return receiptData.customerName;
    };
    
    commands += `SOLD TO: ${getCustomerDisplayName()}\n`;
    
    if (receiptData?.customerName && receiptData.customerName !== 'Walk-in Customer') {
      if (receiptData?.customerAddress && receiptData?.customerAddress !== 'N/A') {
        commands += `Address: ${receiptData.customerAddress}\n`;
      }
      if (receiptData?.customerTin && receiptData?.customerTin !== 'N/A') {
        commands += `TIN: ${receiptData.customerTin}\n`;
      }
    }
    
    commands += '--------------------------------------------------\n';
    
    // Date and Cashier (compact)
    commands += `Cashier: ${receiptData?.cashier || 'N/A'}\n`;
    const date = new Date(receiptData?.receiptDate || new Date());
    commands += `${date.toLocaleDateString()} ${date.toLocaleTimeString()}\n`;
    
    commands += '--------------------------------------------------\n';
    
    // Items header (smaller font spacing)
    commands += 'Item                            Qty     Total\n';
    commands += '--------------------------------------------------\n';
    
    if (receiptData?.items) {
      receiptData.items.forEach((item: any) => {
        const qty = (item.quantity || 1).toString();
        const unitType = item.unitType && item.unitType !== 'N/A' ? ` ${item.unitType.substring(0, 2)}` : '';
        const total = (item.total || 0).toFixed(2);
        
        // Product name (max 32 chars with smaller font)
        const productName = (item.productName || item.name || 'Item').substring(0, 32);
        
        // Better spacing calculation for left-aligned Qty with smaller font
        const qtyWithUnit = `${qty}${unitType}`;
        const qtyPadded = qtyWithUnit.padEnd(5); // Fixed width for Qty column
        const totalPadded = total.padStart(8); // Right-align total
        
        // Calculate spaces between product name and qty
        const spacesNeeded = 32 - productName.length;
        const spaces = ' '.repeat(Math.max(1, spacesNeeded));
        
        // Single line: Name + spaces + Qty + Total
        commands += `${productName}${spaces} ${qtyPadded} ${totalPadded}\n`;
        
        // Price per unit on next line
        const unitPrice = (item.sellingPrice || item.price || 0).toFixed(2);
        commands += `  @ ${unitPrice} each\n`;
      });
    }
    
    commands += '--------------------------------------------------\n';
    
    // Totals (properly aligned within 50 chars)
    const subtotalAmt = (receiptData?.subtotal || 0).toFixed(2);
    const subtotalSpaces = ' '.repeat(50 - 9 - subtotalAmt.length); // 'Subtotal:' = 9 chars
    commands += `Subtotal:${subtotalSpaces}${subtotalAmt}\n`;
    
    if (receiptData?.vatAmount && receiptData.vatAmount > 0) {
      const vatAmt = receiptData.vatAmount.toFixed(2);
      const vatSpaces = ' '.repeat(50 - 9 - vatAmt.length); // 'VAT(12%):' = 9 chars
      commands += `VAT(12%):${vatSpaces}${vatAmt}\n`;
    }
    if (receiptData?.discount && receiptData.discount > 0) {
      const discountAmt = receiptData.discount.toFixed(2);
      const discountSpaces = ' '.repeat(50 - 9 - discountAmt.length); // 'Discount:' = 9 chars
      commands += `Discount:${discountSpaces}${discountAmt}\n`;
    }
    
    commands += '==================================================\n'; // 50 chars
    commands += '\x1B\x45\x01'; // Bold on
    const totalAmt = (receiptData?.totalAmount || receiptData?.netAmount || 0).toFixed(2);
    const totalSpaces = ' '.repeat(50 - 6 - totalAmt.length); // 'TOTAL:' = 6 chars
    commands += `TOTAL:${totalSpaces}${totalAmt}\n`;
    commands += '\x1B\x45\x00'; // Bold off
    commands += '==================================================\n';
    
    // Thank you message (natural alignment like header and SOLD TO)
    commands += 'Thank you for your purchase!\n';
    commands += 'Please come again\n';
    commands += '\n\n\n'; // Feed paper
    commands += '\x1D\x56\x41'; // Cut paper
    
    return commands;
  }

  /**
   * 🔌 Disconnect from Bluetooth printer
   */
  async disconnectBluetoothPrinter(): Promise<void> {
    try {
      if (this.bluetoothDevice && this.bluetoothDevice.gatt.connected) {
        await this.bluetoothDevice.gatt.disconnect();
      }
      this.bluetoothDevice = null;
      this.bluetoothCharacteristic = null;
      this.isConnected = false;
      console.log('📱 Bluetooth printer disconnected');
    } catch (error) {
      console.error('❌ Error disconnecting:', error);
    }
  }

  /**
   * 📊 Get connection status
   */
  getConnectionStatus(): { connected: boolean; deviceName?: string } {
    return {
      connected: this.isConnected,
      deviceName: this.bluetoothDevice?.name || undefined
    };
  }

  /**
   * Print receipt using browser's print functionality (FALLBACK)
   */
  printBrowserReceipt(receiptData: any): void {
    // Create a new window for printing
    const printWindow = window.open('', '_blank', 'width=300,height=600');
    if (!printWindow) return;

    const printContent = this.generatePrintableReceipt(receiptData);
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt</title>
          <style>
            @media print {
              body { margin: 0 !important; }
              @page { margin: 0; }
            }
            body { 
              font-family: 'Courier New', monospace; 
              font-size: 12px; 
              margin: 0; 
              padding: 5px;
              width: 300px;
              line-height: 1.3;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .line { 
              border-bottom: 1px solid #000; 
              margin: 8px 0; 
              width: 100%; 
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin: 5px 0;
            }
            td, th { 
              padding: 2px 4px; 
              vertical-align: top;
            }
            .right { text-align: right; }
            th { 
              font-weight: bold; 
              text-align: left;
            }
            th:nth-child(2), th:nth-child(3), th:nth-child(4) {
              text-align: center;
            }
            th:nth-child(3), th:nth-child(4) {
              text-align: right;
            }
          </style>
        </head>
        <body>${printContent}</body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
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

      const port = ports[0];
      const testResult = {
        success: true,
        message: 'USB printer connection available',
        details: {
          portsCount: ports.length,
          portInfo: port.getInfo ? port.getInfo() : 'Port info not available',
          readable: !!port.readable,
          writable: !!port.writable
        }
      };

      console.log('🧪 USB Connection Test Result:', testResult);
      return testResult;
    } catch (error: any) {
      return { 
        success: false, 
        message: `USB test failed: ${error.message}`,
        details: { error: error.name, code: error.code }
      };
    }
  }

  /**
   * Send to thermal printer via Web Serial API (for USB printers)
   * Enhanced with detailed diagnostics and error handling
   */
  async printToThermalPrinter(receiptData: any): Promise<void> {
    try {
      console.log('🔌 Starting USB thermal printer process...');
      
      // Check if Web Serial API is supported
      if (!('serial' in navigator)) {
        throw new Error('Web Serial API not supported. Use Chrome/Edge with HTTPS.');
      }

      let port = this.usbPort;

      // If no existing connection or connection is closed, request new port
      if (!port || !port.readable) {
        console.log('🔌 No existing USB connection, checking available ports...');
        
        // Check if any ports are already available (previously granted)
        const ports = await (navigator as any).serial.getPorts();
        console.log('🔍 Available USB ports:', ports.length);
        
        if (ports.length > 0) {
          console.log('✅ Using previously granted USB port:', ports[0]);
          port = ports[0]; // Use the first available port
        } else {
          console.log('📱 No granted ports found, requesting new USB port access...');
          console.log('💡 Please select your thermal printer from the dialog');
          port = await (navigator as any).serial.requestPort();
          console.log('✅ USB port selected:', port);
        }
        
        this.usbPort = port;
      } else {
        console.log('✅ Using existing USB port connection');
      }

      // Detailed port opening with better error handling
      console.log('🔌 Port readable status:', !!port.readable);
      console.log('🔒 Port locked status:', port.readable ? port.readable.locked : 'N/A');
      
      if (!port.readable || port.readable.locked) {
        console.log('🔓 Opening USB port with baudRate: 9600...');
        await port.open({ 
          baudRate: 9600,
          dataBits: 8,
          stopBits: 1,
          parity: 'none',
          flowControl: 'none'
        });
        console.log('✅ USB port opened successfully');
        console.log('📊 Port info:', {
          readable: !!port.readable,
          writable: !!port.writable,
          signals: port.getSignals ? await port.getSignals() : 'Not available'
        });
      }

      // Generate ESC/POS commands
      console.log('🧾 Generating ESC/POS commands for receipt...');
      const escPosCommands = this.generateESCPOSCommands(receiptData);
      console.log('📝 Generated commands length:', escPosCommands.length, 'characters');
      
      const encoder = new TextEncoder();
      const data = encoder.encode(escPosCommands);
      console.log('💾 Encoded data size:', data.length, 'bytes');

      // Write to printer
      console.log('✍️ Writing data to USB printer...');
      if (!port.writable) {
        throw new Error('USB port is not writable. Port may be disconnected.');
      }

      const writer = port.writable.getWriter();
      console.log('📤 Sending data to printer...');
      await writer.write(data);
      writer.releaseLock();
      console.log('📤 Data sent successfully, writer released');

      // Don't close the port - keep it open for next print
      this.usbConnected = true;
      console.log('✅ Receipt sent to USB thermal printer successfully');

    } catch (error: any) {
      console.error('❌ USB thermal printer error details:', {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack?.split('\n')[0] // Just first line of stack
      });
      
      // Reset connection on error
      this.usbPort = null;
      this.usbConnected = false;
      
      // Handle specific error cases with detailed guidance
      if (error.name === 'NotFoundError' || error.message.includes('No port selected')) {
        throw new Error('🚫 USB printer port selection was cancelled. Please select your thermal printer from the list to continue.');
      } else if (error.name === 'NetworkError' || error.message.includes('device not found')) {
        throw new Error('🔌 USB printer disconnected. Please check your USB cable connection and ensure the printer is powered on.');
      } else if (error.name === 'InvalidStateError' || error.message.includes('already open')) {
        throw new Error('🔒 USB printer port is busy. Please wait a moment and try printing again.');
      } else if (error.name === 'NotAllowedError' || error.message.includes('permission')) {
        throw new Error('🛡️ USB printer access denied. Please grant permission to access the USB port and try again.');
      } else if (error.message.includes('not writable')) {
        throw new Error('📝 Cannot write to USB printer. Please check if another application is using the printer.');
      } else {
        throw new Error(`🔧 USB printer connection issue: ${error.message}. Try unplugging and reconnecting your USB printer.`);
      }
    }
  }

  /**
   * Send to network printer (for IP-based thermal printers)
   */
  async printToNetworkPrinter(receiptData: any, printerIp: string = '192.168.1.100'): Promise<void> {
    try {
      const escPosCommands = this.generateESCPOSCommands(receiptData);
      
      // Send to your backend API that handles network printing
      const response = await fetch('/api/print', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          printerIp: printerIp,
          data: escPosCommands,
          receiptData: receiptData
        })
      });

      if (!response.ok) {
        throw new Error('Network printer request failed');
      }

      console.log('Receipt sent to network printer successfully');
    } catch (error) {
      console.error('Network printer error:', error);
      throw error; // Let the calling method handle the error
    }
  }

  /**
   * Legacy print method - use printReceiptSmart() instead for better auto-detection
   */
  async printReceipt(receiptData: any, printerType: 'thermal' | 'network' = 'thermal'): Promise<void> {
    console.log('Printing receipt via legacy method:', receiptData);

    switch (printerType) {
      case 'thermal':
        await this.printToThermalPrinter(receiptData);
        break;
      case 'network':
        await this.printToNetworkPrinter(receiptData);
        break;
      default:
        throw new Error('Invalid printer type. Use "thermal" or "network".');
    }
  }

  /**
   * Generate HTML content for browser printing
   */
  private generatePrintableReceipt(receiptData: any): string {
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
      <div class="center">
        <div class="bold" style="font-size: 16px;">${receiptData?.storeInfo?.storeName || 'Store Name'}</div>
        <div>${receiptData?.storeInfo?.address || 'Store Address'}</div>
        <div>Tel: ${receiptData?.storeInfo?.phone || 'N/A'} | Email: ${receiptData?.storeInfo?.email || 'N/A'}</div>
        <div>TIN: ${receiptData?.storeInfo?.tin || 'N/A'}</div>
    `;

    // BIR Information (matching preview)
    if (receiptData?.storeInfo?.birPermitNo) {
      html += `<div><strong>BIR Permit No:</strong> ${receiptData.storeInfo.birPermitNo}</div>`;
    }
    if (receiptData?.storeInfo?.inclusiveSerialNumber) {
      html += `<div><strong>Serial Number:</strong> ${receiptData.storeInfo.inclusiveSerialNumber}</div>`;
    }
    if (receiptData?.storeInfo?.minNumber) {
      html += `<div><strong>MIN:</strong> ${receiptData.storeInfo.minNumber}</div>`;
    }

    html += `
        <div><strong>Invoice #: ${receiptData?.invoiceNumber || 'Auto-generated'}</strong></div>
        <div class="bold">${receiptData?.storeInfo?.invoiceType || 'SALES INVOICE'}</div>
      </div>
      
      <div class="line"></div>
    `;

    // Payment Method Indicators (matching preview)
    const isCashSale = receiptData?.paymentMethod === 'cash' || !receiptData?.paymentMethod;
    const isChargeSale = receiptData?.paymentMethod === 'charge' || receiptData?.paymentMethod === 'credit';
    
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
            <th style="text-align: left; padding: 4px 2px; border-bottom: 1px solid #000;">SKU</th>
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
            <div style="font-size: 10px; color: #666;">${item.skuId || item.productId || 'N/A'}</div>
            <div style="font-weight: bold;">${item.productName || item.name}</div>
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
    `;

    if (receiptData?.vatAmount && receiptData.vatAmount > 0) {
      html += `<tr><td>VAT (12%):</td><td class="right">₱${receiptData.vatAmount.toFixed(2)}</td></tr>`;
    }
    if (receiptData?.discount && receiptData.discount > 0) {
      html += `<tr><td>Discount:</td><td class="right">-₱${receiptData.discount.toFixed(2)}</td></tr>`;
    }

    html += `
        <tr style="border-top: 1px solid #000; font-weight: bold;">
          <td style="padding-top: 5px;"><strong>TOTAL:</strong></td>
          <td class="right" style="padding-top: 5px;"><strong>₱${(receiptData?.totalAmount || receiptData?.netAmount || 0).toFixed(2)}</strong></td>
        </tr>
      </table>
      
      <div class="center" style="margin-top: 20px;">
        <div>Thank you for your purchase!</div>
        <div>Please come again</div>
      </div>
    `;

    return html;
  }
}
