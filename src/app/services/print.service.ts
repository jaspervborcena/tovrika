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

  constructor() { }

  /**
   * 🎯 SMART PRINT: Main method - handles Bluetooth connection and printing
   * Auto-connects on first use, reuses connection for subsequent prints
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
      
      // Check if Web Bluetooth is supported
      if (!navigator.bluetooth) {
        console.warn('⚠️ Web Bluetooth not supported, falling back to browser print');
        this.printBrowserReceipt(receiptData);
        return;
      }

      // If not connected, attempt to connect
      if (!this.isConnected) {
        console.log('📱 Bluetooth printer not connected, attempting connection...');
        const connected = await this.connectToBluetoothPrinter();
        
        if (!connected) {
          console.warn('❌ Bluetooth connection failed, falling back to browser print');
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
      console.log('🔄 Falling back to browser print...');
      this.printBrowserReceipt(receiptData);
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
   * 📄 Generate ESC/POS commands for thermal printer
   */
  private generateESCPOSCommands(receiptData: any): string {
    let commands = '';
    
    // Initialize printer
    commands += '\x1B\x40'; // ESC @ - Initialize
    
    // Store header (centered, bold)
    commands += '\x1B\x61\x01'; // Center align
    commands += '\x1B\x45\x01'; // Bold on
    commands += (receiptData?.storeInfo?.storeName || 'Store Name') + '\n';
    commands += '\x1B\x45\x00'; // Bold off
    
    // Store details
    commands += (receiptData?.storeInfo?.address || 'Store Address') + '\n';
    commands += `Tel: ${receiptData?.storeInfo?.phone || 'N/A'} | Email: ${receiptData?.storeInfo?.email || 'N/A'}\n`;
    commands += `TIN: ${receiptData?.storeInfo?.tin || 'N/A'}\n`;
    
    // BIR Information
    if (receiptData?.storeInfo?.birPermitNo) {
      commands += `BIR Permit No: ${receiptData.storeInfo.birPermitNo}\n`;
    }
    if (receiptData?.storeInfo?.inclusiveSerialNumber) {
      commands += `Serial Number: ${receiptData.storeInfo.inclusiveSerialNumber}\n`;
    }
    if (receiptData?.storeInfo?.minNumber) {
      commands += `MIN: ${receiptData.storeInfo.minNumber}\n`;
    }
    
    commands += `Invoice #: ${receiptData?.invoiceNumber || 'Auto-generated'}\n`;
    
    // Invoice Type (centered, bold)
    commands += '\x1B\x45\x01'; // Bold on
    commands += (receiptData?.storeInfo?.invoiceType || 'SALES INVOICE') + '\n';
    commands += '\x1B\x45\x00'; // Bold off
    commands += '\x1B\x61\x00'; // Left align
    
    commands += '--------------------------------\n';
    
    // Payment Method Indicators
    const isCashSale = receiptData?.paymentMethod === 'cash' || !receiptData?.paymentMethod;
    const isChargeSale = receiptData?.paymentMethod === 'charge' || receiptData?.paymentMethod === 'credit';
    commands += `Cash: ${isCashSale ? '[X]' : '[ ]'}  Charge: ${isChargeSale ? '[X]' : '[ ]'}\n`;
    
    commands += '--------------------------------\n';
    
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
    
    commands += '--------------------------------\n';
    
    // Date and Cashier
    commands += `Cashier: ${receiptData?.cashier || 'N/A'}\n`;
    commands += `Date: ${new Date(receiptData?.receiptDate || new Date()).toLocaleString()}\n`;
    
    commands += '--------------------------------\n';
    
    // Items header
    commands += 'SKU      Qty  Amount    Total\n';
    commands += '--------------------------------\n';
    
    if (receiptData?.items) {
      receiptData.items.forEach((item: any) => {
        const sku = (item.skuId || item.productId || 'N/A').substring(0, 8).padEnd(8);
        const qty = (item.quantity || 1).toString().padStart(3);
        const unitType = item.unitType && item.unitType !== 'N/A' ? ` ${item.unitType}` : '';
        const amount = (item.sellingPrice || item.price || 0).toFixed(2).padStart(7);
        const total = (item.total || 0).toFixed(2).padStart(8);
        
        // Product name (full line)
        commands += `${(item.productName || item.name || 'Item').substring(0, 32)}\n`;
        // SKU, qty, amount, total
        commands += `${sku} ${qty}${unitType.substring(0, 3)} ${amount} ${total}\n`;
      });
    }
    
    commands += '--------------------------------\n';
    
    // Totals
    commands += `Subtotal: ${(receiptData?.subtotal || 0).toFixed(2).padStart(20)}\n`;
    
    if (receiptData?.vatAmount && receiptData.vatAmount > 0) {
      commands += `VAT (12%): ${receiptData.vatAmount.toFixed(2).padStart(19)}\n`;
    }
    if (receiptData?.discount && receiptData.discount > 0) {
      commands += `Discount: ${receiptData.discount.toFixed(2).padStart(20)}\n`;
    }
    
    commands += '================================\n';
    commands += '\x1B\x45\x01'; // Bold on
    commands += `TOTAL: ${(receiptData?.totalAmount || receiptData?.netAmount || 0).toFixed(2).padStart(23)}\n`;
    commands += '\x1B\x45\x00'; // Bold off
    commands += '================================\n';
    
    commands += '\x1B\x61\x01'; // Center align
    commands += 'Thank you for your purchase!\n';
    commands += 'Please come again\n';
    commands += '\x1B\x61\x00'; // Left align
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
   * Generate ESC/POS commands for thermal printers
   */
  generateEscPosCommands(receiptData: any): string {
    let commands = '';
    
    // ESC/POS Command Constants
    const ESC = '\x1B';
    const GS = '\x1D';
    
    // Initialize printer
    commands += ESC + '@'; // Initialize
    commands += ESC + 'a' + '\x01'; // Center alignment
    
    // Store name (large, bold)
    commands += ESC + '!' + '\x30'; // Double height and width
    commands += (receiptData?.storeInfo?.storeName || 'STORE NAME') + '\n';
    commands += ESC + '!' + '\x00'; // Reset to normal
    
    // Store info
    commands += (receiptData?.storeInfo?.address || '') + '\n';
    commands += `Tel: ${receiptData?.storeInfo?.phone || 'N/A'} | Email: ${receiptData?.storeInfo?.email || 'N/A'}\n`;
    commands += `TIN: ${receiptData?.storeInfo?.tin || 'N/A'}\n`;
    
    // BIR Information
    if (receiptData?.storeInfo?.birPermitNo) {
      commands += `BIR Permit No: ${receiptData.storeInfo.birPermitNo}\n`;
    }
    if (receiptData?.storeInfo?.inclusiveSerialNumber) {
      commands += `Serial Number: ${receiptData.storeInfo.inclusiveSerialNumber}\n`;
    }
    if (receiptData?.storeInfo?.minNumber) {
      commands += `MIN: ${receiptData.storeInfo.minNumber}\n`;
    }
    
    commands += `Invoice #: ${receiptData?.invoiceNumber || 'N/A'}\n`;
    
    // Invoice Type (centered, bold)
    commands += ESC + 'a' + '\x01'; // Center
    commands += ESC + 'E' + '\x01'; // Bold on
    commands += (receiptData?.storeInfo?.invoiceType || 'SALES INVOICE') + '\n';
    commands += ESC + 'E' + '\x00'; // Bold off
    
    // Line separator
    commands += ESC + 'a' + '\x00'; // Left align
    commands += '--------------------------------\n';
    
    // Customer info
    if (receiptData?.customerName) {
      commands += ESC + 'E' + '\x01'; // Bold on
      commands += 'SOLD TO:\n';
      commands += ESC + 'E' + '\x00'; // Bold off
      commands += `Customer: ${receiptData.customerName}\n`;
      if (receiptData?.customerAddress) {
        commands += `Address: ${receiptData.customerAddress}\n`;
      }
      if (receiptData?.customerTin) {
        commands += `TIN: ${receiptData.customerTin}\n`;
      }
      commands += '--------------------------------\n';
    }
    
    // Date and Cashier
    commands += `Date: ${new Date(receiptData?.receiptDate).toLocaleDateString()}\n`;
    commands += `Cashier: ${receiptData?.cashier || 'N/A'}\n`;
    commands += '--------------------------------\n';
    
    // Items
    receiptData?.items?.forEach((item: any) => {
      commands += `${item.productName}\n`;
      commands += `  ${item.quantity} x ${item.sellingPrice.toFixed(2)}`;
      commands += `${' '.repeat(Math.max(1, 20 - item.total.toFixed(2).length))}${item.total.toFixed(2)}\n`;
    });
    
    commands += '--------------------------------\n';
    
    // Totals
    commands += `Subtotal:${' '.repeat(15)}${receiptData?.subtotal?.toFixed(2) || '0.00'}\n`;
    if (receiptData?.vatAmount > 0) {
      commands += `VAT (12%):${' '.repeat(14)}${receiptData.vatAmount.toFixed(2)}\n`;
    }
    if (receiptData?.discount > 0) {
      commands += `Discount:${' '.repeat(15)}${receiptData.discount.toFixed(2)}\n`;
    }
    
    commands += '================================\n';
    commands += ESC + 'E' + '\x01'; // Bold on
    commands += `TOTAL:${' '.repeat(18)}${receiptData?.totalAmount?.toFixed(2) || '0.00'}\n`;
    commands += ESC + 'E' + '\x00'; // Bold off
    commands += '================================\n';
    
    // Thank you message
    commands += ESC + 'a' + '\x01'; // Center
    commands += '\nThank you for your purchase!\n';
    commands += 'Please come again\n\n';
    
    // Cut paper
    commands += GS + 'V' + '\x42' + '\x00'; // Partial cut
    
    return commands;
  }

  /**
   * Send to thermal printer via Web Serial API (for USB printers)
   */
  async printToThermalPrinter(receiptData: any): Promise<void> {
    try {
      // Check if Web Serial API is supported
      if (!('serial' in navigator)) {
        throw new Error('Web Serial API not supported. Use Chrome/Edge with HTTPS.');
      }

      // Request port
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 9600 });

      const escPosCommands = this.generateEscPosCommands(receiptData);
      const encoder = new TextEncoder();
      const data = encoder.encode(escPosCommands);

      const writer = port.writable.getWriter();
      await writer.write(data);
      writer.releaseLock();
      await port.close();

      console.log('Receipt sent to thermal printer successfully');
    } catch (error) {
      console.error('Thermal printer error:', error);
      // Fallback to browser print
      this.printBrowserReceipt(receiptData);
    }
  }

  /**
   * Send to network printer (for IP-based thermal printers)
   */
  async printToNetworkPrinter(receiptData: any, printerIp: string = '192.168.1.100'): Promise<void> {
    try {
      const escPosCommands = this.generateEscPosCommands(receiptData);
      
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
      // Fallback to browser print
      this.printBrowserReceipt(receiptData);
    }
  }

  /**
   * Main print method - tries thermal printer first, falls back to browser
   */
  async printReceipt(receiptData: any, printerType: 'thermal' | 'network' | 'browser' = 'thermal'): Promise<void> {
    console.log('Printing receipt:', receiptData);

    switch (printerType) {
      case 'thermal':
        await this.printToThermalPrinter(receiptData);
        break;
      case 'network':
        await this.printToNetworkPrinter(receiptData);
        break;
      case 'browser':
      default:
        this.printBrowserReceipt(receiptData);
        break;
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
