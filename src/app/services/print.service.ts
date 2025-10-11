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
   * 🎯 DIRECT HARDWARE PRINT: Bypasses browser dialog when hardware printers are available
   * This method checks for connected hardware first and prints directly if found
   */
  async printReceiptDirect(receiptData: any): Promise<{ success: boolean; method: string; message: string }> {
    try {
      console.log('🎯 Starting direct hardware print...');
      
      // Check for available hardware printers
      const hardwareCheck = await this.isHardwarePrinterAvailable();
      
      if (hardwareCheck.hasHardware) {
        console.log(`🖨️ Hardware printer detected (${hardwareCheck.type}), printing directly...`);
        
        try {
          // Print using the smart method (will use hardware automatically)
          await this.printReceiptSmart(receiptData);
          
          return {
            success: true,
            method: hardwareCheck.type,
            message: `Receipt printed successfully via ${hardwareCheck.type} printer`
          };
          
        } catch (hardwareError: any) {
          console.log(`❌ ${hardwareCheck.type} printing failed:`, hardwareError.message);
          
          // If hardware print fails, fall back to browser print
          console.log('🔄 Hardware failed, falling back to browser print...');
          this.printBrowserReceipt(receiptData);
          
          return {
            success: true,
            method: 'Browser',
            message: `${hardwareCheck.type} printer failed, used browser print instead`
          };
        }
      } else {
        // No hardware available, use browser print directly
        console.log('🖨️ No hardware printers detected, using browser print...');
        this.printBrowserReceipt(receiptData);
        
        return {
          success: true,
          method: 'Browser',
          message: 'No hardware printers found, used browser print'
        };
      }
      
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
        console.log('⚠️ Bluetooth not supported, falling back to browser print...');
        this.printBrowserReceipt(receiptData);
        return;
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
        console.log('⚠️ No Bluetooth printers found, falling back to browser print...');
        this.printBrowserReceipt(receiptData);
        return;
      }

      // Try to connect to Bluetooth printer
      if (!this.isConnected) {
        console.log('📱 Attempting Bluetooth printer connection...');
        const connected = await this.connectToBluetoothPrinter();
        
        if (!connected) {
          console.log('❌ Bluetooth connection failed, falling back to browser print...');
          this.printBrowserReceipt(receiptData);
          return;
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
      
      // Fallback to browser print on any error
      console.log('🔄 Error occurred, falling back to browser print...');
      try {
        this.printBrowserReceipt(receiptData);
      } catch (fallbackError) {
        alert(`Print Error: ${error instanceof Error ? error.message : 'Unable to print receipt. Please check your printer connection.'}`);
        throw error;
      }
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

      if (!port || !port.readable) {
        const ports = await (navigator as any).serial.getPorts();
        
        if (ports.length > 0) {
          port = ports[0];
        } else {
          port = await (navigator as any).serial.requestPort();
        }
        
        this.usbPort = port;
      }

      if (!port.readable || port.readable.locked) {
        await port.open({ 
          baudRate: 9600,
          dataBits: 8,
          stopBits: 1,
          parity: 'none',
          flowControl: 'none'
        });
      }

      const escPosCommands = this.generateESCPOSCommands(receiptData);
      const encoder = new TextEncoder();
      const data = encoder.encode(escPosCommands);

      if (!port.writable) {
        throw new Error('USB port is not writable');
      }

      const writer = port.writable.getWriter();
      await writer.write(data);
      writer.releaseLock();

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
   */
  private generateESCPOSCommands(receiptData: any): string {
    let commands = '';
    
    // Initialize printer
    commands += '\x1B\x40'; // Initialize
    commands += '\x1B\x21\x01'; // Small font
    commands += '\x1B\x4D\x01'; // Font B
    commands += '\x0F'; // Condensed printing
    
    // Store header - CENTERED for Xprinter
    commands += '\x1B\x61\x01'; // Center alignment
    commands += '\x1B\x45\x01'; // Bold on
    commands += (receiptData?.storeInfo?.storeName || 'Store Name') + '\n';
    commands += '\x1B\x45\x00'; // Bold off
    
    // Store details - CENTERED
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
    
    // Invoice Type (centered, bold)
    commands += '\x1B\x45\x01'; // Bold on
    commands += (receiptData?.storeInfo?.invoiceType || 'SALES INVOICE') + '\n';
    commands += '\x1B\x45\x00'; // Bold off
    commands += '\x1B\x61\x00'; // Left alignment for rest
    
    commands += '--------------------------------\n';
    
    // Payment Method with filled/empty circles (Cash by default, both can be selected)
    const isCashSale = receiptData?.isCashSale !== false; // Default to true unless explicitly false
    const isChargeSale = receiptData?.isChargeSale === true; // Only true if explicitly set
    commands += `Cash: ${isCashSale ? '\u25CF' : '\u25CB'}   Charge: ${isChargeSale ? '\u25CF' : '\u25CB'}\n`;
    
    commands += '--------------------------------\n';
    
    // Customer info
    const customerName = receiptData?.customerName || 'Walk-in Customer';
    commands += `SOLD TO: ${customerName}\n`;
    
    if (receiptData?.customerName && receiptData.customerName !== 'Walk-in Customer') {
      if (receiptData?.customerAddress && receiptData?.customerAddress !== 'N/A') {
        commands += `Address: ${receiptData.customerAddress}\n`;
      }
      if (receiptData?.customerTin && receiptData?.customerTin !== 'N/A') {
        commands += `TIN: ${receiptData.customerTin}\n`;
      }
    }
    
    commands += '--------------------------------------------------\n';
    
    // Date and Cashier
    commands += `Cashier: ${receiptData?.cashier || 'N/A'}\n`;
    const date = new Date(receiptData?.receiptDate || new Date());
    commands += `${date.toLocaleDateString()} ${date.toLocaleTimeString()}\n`;
    
    commands += '--------------------------------------------------\n';
    
    // Items header - Optimized for 58mm printer
    commands += 'Qty Product Name             Total\n';
    commands += '--------------------------------\n';
    
    if (receiptData?.items) {
      receiptData.items.forEach((item: any) => {
        const qty = (item.quantity || 1).toString();
        const unitType = item.unitType && item.unitType !== 'N/A' ? ` ${item.unitType.substring(0, 2)}` : '';
        const total = (item.total || 0).toFixed(2);
        
        // Optimize for 58mm: Qty first, then product name, then total
        const qtyWithUnit = `${qty}${unitType}`;
        const qtyPadded = qtyWithUnit.padEnd(3); // 3 chars for quantity
        
        // Product name - limited to fit 58mm width
        const maxProductNameLength = 20; // Reduced for 58mm
        const productName = (item.productName || item.name || 'Item').substring(0, maxProductNameLength);
        const productPadded = productName.padEnd(maxProductNameLength);
        
        // Total - right aligned
        const totalPadded = total.padStart(7); // 7 chars for amount
        
        commands += `${qtyPadded} ${productPadded} ${totalPadded}\n`;
        
        // Unit price on separate line, indented
        const unitPrice = (item.sellingPrice || item.price || 0).toFixed(2);
        commands += `    @ ${unitPrice} each\n`;
      });
    }
    
    commands += '--------------------------------\n';
    
    // Totals - Right aligned for 58mm printer (show ALL fields like receipt display)
    const receiptWidth = 32; // 58mm printer width
    
    // Subtotal - always show
    const subtotalAmt = (receiptData?.subtotal || 0).toFixed(2);
    const subtotalLine = `Subtotal: ${subtotalAmt}`;
    const subtotalSpaces = ' '.repeat(receiptWidth - subtotalLine.length);
    commands += `${subtotalSpaces}${subtotalLine}\n`;
    
    // VAT (12%) - always show (even if 0.00)
    const vatAmt = (receiptData?.vatAmount || 0).toFixed(2);
    const vatLine = `VAT (12%): ${vatAmt}`;
    const vatSpaces = ' '.repeat(receiptWidth - vatLine.length);
    commands += `${vatSpaces}${vatLine}\n`;
    
    // VAT Exempt - always show (even if 0.00)
    const vatExemptAmt = (receiptData?.vatExempt || 0).toFixed(2);
    const vatExemptLine = `VAT Exempt: ${vatExemptAmt}`;
    const vatExemptSpaces = ' '.repeat(receiptWidth - vatExemptLine.length);
    commands += `${vatExemptSpaces}${vatExemptLine}\n`;
    
    // Discount - always show (even if 0.00)
    const discountAmt = (receiptData?.discount || 0).toFixed(2);
    const discountLine = `Discount: ${discountAmt}`;
    const discountSpaces = ' '.repeat(receiptWidth - discountLine.length);
    commands += `${discountSpaces}${discountLine}\n`;
    
    commands += '================================\n';
    commands += '\x1B\x45\x01'; // Bold on
    const totalAmt = (receiptData?.totalAmount || receiptData?.netAmount || 0).toFixed(2);
    const totalLine = `TOTAL: ${totalAmt}`;
    const totalSpaces = ' '.repeat(receiptWidth - totalLine.length);
    commands += `${totalSpaces}${totalLine}\n`;
    commands += '\x1B\x45\x00'; // Bold off
    commands += '================================\n';
    
    // Discount Information (for PWD/Senior/Special Discounts)
    if (receiptData?.orderDiscount) {
      commands += '\n';
      commands += 'DISCOUNT INFORMATION\n';
      commands += '--------------------------------\n';
      
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
      commands += '================================\n';
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
   */
  printBrowserReceipt(receiptData: any): void {
    console.log('🖨️ Opening browser print dialog...');
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) {
      alert('Print Error: Popup blocked. Please allow popups for this site to print receipts.');
      return;
    }

    const printContent = this.generatePrintableReceipt(receiptData);
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt - ${receiptData?.invoiceNumber || 'Invoice'}</title>
          <style>
            @media print {
              body { margin: 0 !important; }
              @page { 
                margin: 3mm; 
                size: 58mm auto; /* Optimized for 58mm thermal paper */
              }
            }
            body { 
              font-family: 'Courier New', monospace; 
              font-size: 11px; 
              margin: 0; 
              padding: 3px;
              width: 100%;
              max-width: 210px; /* ~58mm in pixels */
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
        <body onload="window.print(); window.close();">${printContent}</body>
      </html>
    `);
    
    printWindow.document.close();
  }

  /**
   * 🖨️ Direct print without dialog - Auto-prints to default/last used printer
   * Perfect for mobile devices with paired Bluetooth printers
   */
  printDirectMobile(receiptData: any): void {
    console.log('🖨️ Starting direct mobile print (no dialog)...');
    
    const printContent = this.generatePrintableReceipt(receiptData);
    
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
                size: 58mm auto; /* Optimized for 58mm thermal paper */
              }
            }
            body { 
              font-family: 'Courier New', monospace; 
              font-size: 11px; 
              margin: 0; 
              padding: 3px;
              width: 100%;
              max-width: 210px; /* ~58mm in pixels */
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
   * 🖨️ RAWBT PRINT: Show print preview for RawBT app to handle
   * RawBT automatically handles the Bluetooth connection to thermal printer
   * Just open the content and RawBT will show print preview
   */
  printRawBT(receiptData: any): void {
    console.log('🖨️ Generating ESC/POS for RawBT...');
    
    // Generate ESC/POS commands
    const escposCommands = this.generateESCPOSCommands(receiptData);
    
    // Create a blob with the ESC/POS content
    const blob = new Blob([escposCommands], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    // Open in new window - RawBT will intercept and show print preview
    const printWindow = window.open(url, '_blank');
    
    if (!printWindow) {
      alert('Print Error: Popup blocked. Please allow popups for this site to print with RawBT.');
      return;
    }
    
    console.log('✅ ESC/POS content sent to RawBT');
    
    // Clean up the URL after a delay
    setTimeout(() => {
      URL.revokeObjectURL(url);
      console.log('🧹 Cleaned up blob URL');
    }, 5000);
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
