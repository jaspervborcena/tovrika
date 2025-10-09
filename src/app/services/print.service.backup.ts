// BACKUP: Window.print() version of PrintService
// Created: October 9, 2025
// This version uses browser's window.print() for universal printer compatibility

import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PrintServiceBackup {

  constructor() { }

  /**
   * 🖨️ Simple print using browser's window.print() - works with any connected printer
   */
  async printReceiptSmart(receiptData: any): Promise<void> {
    try {
      console.log('🖨️ Starting browser print process...');
      console.log('📄 Receipt data received:', {
        hasData: !!receiptData,
        orderId: receiptData?.orderId,
        invoiceNumber: receiptData?.invoiceNumber,
        itemsCount: receiptData?.items?.length || 0
      });
      
      // Use browser's print dialog - works with any printer (USB, Bluetooth, Network)
      this.printBrowserReceipt(receiptData);
      console.log('✅ Print dialog opened successfully');
      
    } catch (error) {
      console.error('❌ Print error:', error);
      alert(`Print Error: ${error instanceof Error ? error.message : 'Unable to print receipt. Please check your printer connection.'}`);
      throw error;
    }
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
   * Generate HTML content for browser printing - BACKUP VERSION
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