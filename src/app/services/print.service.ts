import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { PrintServiceAndroid } from './print.service.android';
import { PrintServiceWeb } from './print.service.web';

// Re-export shared types from web service (as it has the full interface definitions)
export type { PrinterConfig, PaperSizeConfig } from './print.service.web';

/**
 * Platform-aware Print Service Factory
 * Automatically selects Android or Web implementation based on runtime platform
 * 
 * - Android (Capacitor): Uses Capacitor Bluetooth LE for native thermal printing
 * - Web (Browser): Uses USB Serial and Web Bluetooth for thermal printing
 */
@Injectable({
  providedIn: 'root'
})
export class PrintService {
  private implementation: PrintServiceAndroid | PrintServiceWeb;

  constructor(
    private androidService: PrintServiceAndroid,
    private webService: PrintServiceWeb
  ) {
    // Select implementation based on platform
    if (Capacitor.isNativePlatform()) {
      console.log(' Using Android Print Service (Capacitor Bluetooth LE)');
      this.implementation = androidService;
    } else {
      console.log(' Using Web Print Service (USB + Web Bluetooth)');
      this.implementation = webService;
    }
  }

  // Delegate all methods to the selected implementation
  async printReceipt(receiptData: any): Promise<void> {
    // Android uses printReceiptDirect, Web may have different method
    if ('printReceiptDirect' in this.implementation) {
      const result = await (this.implementation as any).printReceiptDirect(receiptData);
      if (!result.success) {
        throw new Error(result.message);
      }
      return;
    }
    // Fallback to printReceiptSmart
    return (this.implementation as any).printReceiptSmart(receiptData);
  }

  async loadPrinterConfig() {
    return this.implementation.loadPrinterConfig();
  }

  getPaperSizeConfig(paperSize?: string) {
    return this.implementation.getPaperSizeConfig(paperSize);
  }

  getConnectionType() {
    return (this.implementation as any).getConnectionType?.() || 'none';
  }

  getCurrentPrinterConfig() {
    return (this.implementation as any).getCurrentPrinterConfig?.() || null;
  }

  async refreshPrinterConfig() {
    return (this.implementation as any).refreshPrinterConfig?.() || null;
  }

  async printReceiptDirect(receiptData: any) {
    if ('printReceiptDirect' in this.implementation) {
      return (this.implementation as any).printReceiptDirect(receiptData);
    }
    throw new Error('Direct printing not supported on this platform');
  }

  async printReceiptSmart(receiptData: any) {
    if ('printReceiptSmart' in this.implementation) {
      return (this.implementation as any).printReceiptSmart(receiptData);
    }
    throw new Error('Smart printing not supported on this platform');
  }

  async isHardwarePrinterAvailable() {
    if ('isHardwarePrinterAvailable' in this.implementation) {
      return (this.implementation as any).isHardwarePrinterAvailable();
    }
    return { hasHardware: false, type: 'none', details: null };
  }

  printBrowserReceipt(receiptData: any) {
    if ('printBrowserReceipt' in this.implementation) {
      return (this.implementation as any).printBrowserReceipt(receiptData);
    }
  }

  printMobileThermal(receiptData: any) {
    if ('printMobileThermal' in this.implementation) {
      return (this.implementation as any).printMobileThermal(receiptData);
    }
  }

  generateESCPOSCommands(receiptData: any): string {
    if ('generateESCPOSCommands' in this.implementation) {
      return (this.implementation as any).generateESCPOSCommands(receiptData);
    }
    return '';
  }
}
