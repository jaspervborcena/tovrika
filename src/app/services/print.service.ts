import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PrintService {

  constructor() { }

  /**
   * Print receipt using browser's print functionality (for testing/backup)
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
            body { 
              font-family: 'Courier New', monospace; 
              font-size: 12px; 
              margin: 0; 
              padding: 10px;
              width: 250px;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .line { border-bottom: 1px solid #000; margin: 5px 0; }
            table { width: 100%; border-collapse: collapse; }
            td { padding: 2px 0; }
            .right { text-align: right; }
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
    let html = `
      <div class="center">
        <div class="bold" style="font-size: 16px;">${receiptData?.storeInfo?.storeName || 'STORE NAME'}</div>
        <div>${receiptData?.storeInfo?.address || ''}</div>
        <div>Tel: ${receiptData?.storeInfo?.phone || 'N/A'} | Email: ${receiptData?.storeInfo?.email || 'N/A'}</div>
        <div>TIN: ${receiptData?.storeInfo?.tin || 'N/A'}</div>
    `;

    // BIR Information
    if (receiptData?.storeInfo?.birPermitNo) {
      html += `<div>BIR Permit No: ${receiptData.storeInfo.birPermitNo}</div>`;
    }
    if (receiptData?.storeInfo?.inclusiveSerialNumber) {
      html += `<div>Serial Number: ${receiptData.storeInfo.inclusiveSerialNumber}</div>`;
    }
    if (receiptData?.storeInfo?.minNumber) {
      html += `<div>MIN: ${receiptData.storeInfo.minNumber}</div>`;
    }

    html += `
        <div>Invoice #: ${receiptData?.invoiceNumber || 'N/A'}</div>
        <div class="bold">${receiptData?.storeInfo?.invoiceType || 'SALES INVOICE'}</div>
      </div>
      
      <div class="line"></div>
    `;

    // Customer info
    if (receiptData?.customerName) {
      html += `
        <div class="bold">SOLD TO:</div>
        <div>Customer: ${receiptData.customerName}</div>
      `;
      if (receiptData?.customerAddress) {
        html += `<div>Address: ${receiptData.customerAddress}</div>`;
      }
      if (receiptData?.customerTin) {
        html += `<div>TIN: ${receiptData.customerTin}</div>`;
      }
      html += '<div class="line"></div>';
    }

    html += `
      <div>Date: ${new Date(receiptData?.receiptDate).toLocaleDateString()}</div>
      <div>Cashier: ${receiptData?.cashier || 'N/A'}</div>
      <div class="line"></div>
      
      <table>
    `;

    // Items
    receiptData?.items?.forEach((item: any) => {
      html += `
        <tr>
          <td colspan="3">${item.productName}</td>
        </tr>
        <tr>
          <td>${item.quantity} x ${item.sellingPrice.toFixed(2)}</td>
          <td></td>
          <td class="right">${item.total.toFixed(2)}</td>
        </tr>
      `;
    });

    html += `
      </table>
      <div class="line"></div>
      
      <table>
        <tr><td>Subtotal:</td><td class="right">${receiptData?.subtotal?.toFixed(2) || '0.00'}</td></tr>
    `;

    if (receiptData?.vatAmount > 0) {
      html += `<tr><td>VAT (12%):</td><td class="right">${receiptData.vatAmount.toFixed(2)}</td></tr>`;
    }
    if (receiptData?.discount > 0) {
      html += `<tr><td>Discount:</td><td class="right">${receiptData.discount.toFixed(2)}</td></tr>`;
    }

    html += `
        <tr class="bold"><td>TOTAL:</td><td class="right">${receiptData?.totalAmount?.toFixed(2) || '0.00'}</td></tr>
      </table>
      
      <div class="center" style="margin-top: 20px;">
        <div>Thank you for your purchase!</div>
        <div>Please come again</div>
      </div>
    `;

    return html;
  }
}
