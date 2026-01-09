import { Injectable } from '@angular/core';
import { BleClient, BleDevice } from '@capacitor-community/bluetooth-le';
import { Capacitor } from '@capacitor/core';

@Injectable({
  providedIn: 'root'
})
export class ThermalPrinterService {
  private connectedDevice: BleDevice | null = null;
  private writeCharacteristic: string | null = null;
  private serviceUuid: string | null = null;
  private isInitialized = false;

  // ESC/POS Commands
  private readonly ESC = 0x1B;
  private readonly GS = 0x1D;

  constructor() {
    console.log('≡ƒû¿∩╕Å Thermal Printer Service initialized');
  }

  /**
   * Initialize BLE and request permissions
   */
  async initialize(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      console.log('ΓÜá∩╕Å Not on native platform, thermal printing not available');
      return false;
    }

    try {
      await BleClient.initialize();
      this.isInitialized = true;
      console.log('Γ£à BLE initialized');
      return true;
    } catch (error) {
      console.error('Γ¥î BLE initialization failed:', error);
      return false;
    }
  }

  /**
   * Scan and connect to a Bluetooth thermal printer
   */
  async connectToPrinter(): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        const initialized = await this.initialize();
        if (!initialized) {
          throw new Error('Failed to initialize Bluetooth LE');
        }
      }

      // Check if Bluetooth is enabled
      const enabled = await BleClient.isEnabled();
      if (!enabled) {
        throw new Error('Please enable Bluetooth and try again');
      }

      console.log('≡ƒöì Scanning for printers...');
      
      // Request device from user
      const device = await BleClient.requestDevice({
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb'] // Common printer service
      });

      console.log('≡ƒö╡ Connecting to:', device.name || device.deviceId);

      // Connect to device
      await BleClient.connect(device.deviceId, (deviceId) => {
        console.log('ΓÜá∩╕Å Device disconnected:', deviceId);
        if (this.connectedDevice?.deviceId === deviceId) {
          this.connectedDevice = null;
          this.writeCharacteristic = null;
          this.serviceUuid = null;
        }
      });

      // Discover services and characteristics
      const services = await BleClient.getServices(device.deviceId);
      console.log(`≡ƒôï Found ${services.length} services`);

      // Find writable characteristic
      for (const service of services) {
        for (const char of service.characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            this.serviceUuid = service.uuid;
            this.writeCharacteristic = char.uuid;
            break;
          }
        }
        if (this.writeCharacteristic) break;
      }

      if (!this.writeCharacteristic || !this.serviceUuid) {
        throw new Error('Could not find printer write characteristic');
      }

      this.connectedDevice = device;
      console.log('Γ£à Connected to printer successfully');
      return true;

    } catch (error: any) {
      console.error('Γ¥î Connection failed:', error);
      
      let errorMsg = `Connection Error:\n${error.message || error}`;
      
      if (error.message?.includes('User cancelled')) {
        errorMsg = 'You cancelled device selection.\n\nPlease select your Bluetooth printer to continue.';
      } else if (error.message?.includes('Bluetooth')) {
        errorMsg = `Bluetooth Error:\n${error.message}`;
      } else {
        errorMsg = `Connection failed:\n${error.message || error}\n\nMake sure:\nΓÇó Printer is turned ON\nΓÇó Printer is nearby\nΓÇó Bluetooth is enabled`;
      }
      
      throw new Error(errorMsg);
    }
  }

  /**
   * Check if printer is connected
   */
  isConnected(): boolean {
    return this.connectedDevice !== null && this.writeCharacteristic !== null;
  }

  /**
   * Disconnect from printer
   */
  async disconnect(): Promise<void> {
    if (this.connectedDevice) {
      try {
        await BleClient.disconnect(this.connectedDevice.deviceId);
        console.log('Γ£à Disconnected from printer');
      } catch (error) {
        console.error('Γ¥î Disconnect error:', error);
      }
      this.connectedDevice = null;
      this.writeCharacteristic = null;
      this.serviceUuid = null;
    }
  }

  /**
   * Print receipt data
   */
  async printReceipt(receiptData: any): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Printer not connected. Please connect to your printer first.');
    }

    try {
      const escposData = this.generateESCPOS(receiptData);
      console.log('≡ƒôñ ESC/POS data length:', escposData.length, 'bytes');
      
      await this.sendToPrinter(escposData);
      
      console.log('Γ£à Receipt printed successfully');
      
    } catch (error: any) {
      console.error('Γ¥î Print failed:', error);
      const errorMsg = `Print Error:\n${error.message || error}\n\nStack: ${error.stack || 'No stack'}`;
      throw new Error('Printing failed. Please check printer connection.');
    }
  }

  /**
   * Send raw data to printer
   */
  private async sendToPrinter(data: Uint8Array): Promise<void> {
    if (!this.connectedDevice || !this.serviceUuid || !this.writeCharacteristic) {
      throw new Error('Printer not connected');
    }

    console.log('≡ƒôñ Sending data to printer...');
    console.log(`≡ƒôè Total bytes: ${data.length}`);


    try {
      // Some printers work better with smaller chunks
      const chunkSize = 20; // Very small chunks for compatibility
      let totalSent = 0;

      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, Math.min(i + chunkSize, data.length));
        const dataView = new DataView(chunk.buffer);
        

        try {
          await BleClient.write(
            this.connectedDevice.deviceId,
            this.serviceUuid,
            this.writeCharacteristic,
            dataView
          );
          
          totalSent += chunk.length;
        } catch (chunkError: any) {
          const errorMsg = `Chunk ${Math.floor(i / chunkSize) + 1} failed:\n${chunkError.message || chunkError}`;
          console.error(errorMsg);
          throw chunkError;
        }
        
        // Longer delay to ensure printer processes each chunk
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`Γ£à Successfully sent ${totalSent} bytes to printer`);
      
      // Wait for printer to finish
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error: any) {
      console.error('Γ¥î Send error:', error);

      throw error;
    }
  }

  /**
   * Generate ESC/POS commands for receipt
   */
  private generateESCPOS(receiptData: any): Uint8Array {
    const commands: number[] = [];


    // Initialize printer - ESC @
    commands.push(0x1B, 0x40);
    
    // Center align - ESC a 1
    commands.push(0x1B, 0x61, 0x01);
    
    // Double size - GS ! 0x11
    commands.push(0x1D, 0x21, 0x11);
    
    // Store name
    const storeName = receiptData.storeInfo?.storeName || 'STORE NAME';
    for (let i = 0; i < storeName.length; i++) {
      commands.push(storeName.charCodeAt(i));
    }
    commands.push(0x0A, 0x0A); // LF LF
    
    // Normal size - GS ! 0
    commands.push(0x1D, 0x21, 0x00);
    
    // Store address
    if (receiptData.storeInfo?.address) {
      const addr = String(receiptData.storeInfo.address);
      for (let i = 0; i < addr.length; i++) {
        commands.push(addr.charCodeAt(i));
      }
      commands.push(0x0A);
    }
    
    // Store phone
    if (receiptData.storeInfo?.phone) {
      const phone = `Tel: ${receiptData.storeInfo.phone}`;
      for (let i = 0; i < phone.length; i++) {
        commands.push(phone.charCodeAt(i));
      }
      commands.push(0x0A);
    }
    
    // Store TIN
    if (receiptData.storeInfo?.tin) {
      const tin = `TIN: ${receiptData.storeInfo.tin}`;
      for (let i = 0; i < tin.length; i++) {
        commands.push(tin.charCodeAt(i));
      }
      commands.push(0x0A);
    }
    
    commands.push(0x0A);
    
    // Left align - ESC a 0
    commands.push(0x1B, 0x61, 0x00);
    
    // Separator
    const sep = '--------------------------------';
    for (let i = 0; i < sep.length; i++) {
      commands.push(sep.charCodeAt(i));
    }
    commands.push(0x0A);
    
    // Invoice
    const inv = `Invoice: ${receiptData.invoiceNumber || 'N/A'}`;
    for (let i = 0; i < inv.length; i++) {
      commands.push(inv.charCodeAt(i));
    }
    commands.push(0x0A);
    
    // Date
    const dt = `Date: ${receiptData.receiptDate || new Date().toLocaleString()}`;
    for (let i = 0; i < dt.length; i++) {
      commands.push(dt.charCodeAt(i));
    }
    commands.push(0x0A);
    
    // Cashier
    if (receiptData.cashier || receiptData.user) {
      const cash = `Cashier: ${receiptData.cashier || receiptData.user}`;
      for (let i = 0; i < cash.length; i++) {
        commands.push(cash.charCodeAt(i));
      }
      commands.push(0x0A);
    }
    
    // Customer
    if (receiptData.customer || receiptData.customerName) {
      const cust = `Customer: ${receiptData.customer || receiptData.customerName}`;
      for (let i = 0; i < cust.length; i++) {
        commands.push(cust.charCodeAt(i));
      }
      commands.push(0x0A);
    }
    
    // Separator
    for (let i = 0; i < sep.length; i++) {
      commands.push(sep.charCodeAt(i));
    }
    commands.push(0x0A);
    
    // Items header
    const hdr = 'ITEM           QTY    PRICE';
    for (let i = 0; i < hdr.length; i++) {
      commands.push(hdr.charCodeAt(i));
    }
    commands.push(0x0A);
    
    for (let i = 0; i < sep.length; i++) {
      commands.push(sep.charCodeAt(i));
    }
    commands.push(0x0A);
    
    // Items
    if (receiptData.items && Array.isArray(receiptData.items)) {

      for (const item of receiptData.items) {
        let name = String(item.name || item.productName || 'Item');
        if (name.length > 15) name = name.substring(0, 15);
        else name = name.padEnd(15);
        
        const qty = String(item.quantity || item.qty || 1).padStart(4);
        const price = String(Number(item.total || item.price || 0).toFixed(2)).padStart(8);
        
        const line = `${name} ${qty} ${price}`;
        for (let i = 0; i < line.length; i++) {
          commands.push(line.charCodeAt(i));
        }
        commands.push(0x0A);
      }
    }
    
    // Separator
    for (let i = 0; i < sep.length; i++) {
      commands.push(sep.charCodeAt(i));
    }
    commands.push(0x0A);
    
    // Subtotal
    const subtotalVal = Number(receiptData.subtotal || receiptData.subTotal || 0).toFixed(2);
    const subLine = `Subtotal:`.padEnd(24) + subtotalVal.padStart(8);
    for (let i = 0; i < subLine.length; i++) {
      commands.push(subLine.charCodeAt(i));
    }
    commands.push(0x0A);
    
    // Discount
    if (receiptData.discount && Number(receiptData.discount) > 0) {
      const discVal = Number(receiptData.discount).toFixed(2);
      const discLine = `Discount:`.padEnd(24) + discVal.padStart(8);
      for (let i = 0; i < discLine.length; i++) {
        commands.push(discLine.charCodeAt(i));
      }
      commands.push(0x0A);
    }
    
    // VAT
    if (receiptData.vatAmount && Number(receiptData.vatAmount) > 0) {
      const vatVal = Number(receiptData.vatAmount).toFixed(2);
      const vatLine = `VAT:`.padEnd(24) + vatVal.padStart(8);
      for (let i = 0; i < vatLine.length; i++) {
        commands.push(vatLine.charCodeAt(i));
      }
      commands.push(0x0A);
    }
    
    // Separator
    for (let i = 0; i < sep.length; i++) {
      commands.push(sep.charCodeAt(i));
    }
    commands.push(0x0A);
    
    // Total - Double size
    commands.push(0x1D, 0x21, 0x11);
    const totalVal = Number(receiptData.totalAmount || 0).toFixed(2);
    const totLine = `TOTAL: ${totalVal}`;
    for (let i = 0; i < totLine.length; i++) {
      commands.push(totLine.charCodeAt(i));
    }
    commands.push(0x0A);
    commands.push(0x1D, 0x21, 0x00); // Normal size
    
    // Separator
    for (let i = 0; i < sep.length; i++) {
      commands.push(sep.charCodeAt(i));
    }
    commands.push(0x0A);
    
    // Payment
    const payMethod = receiptData.paymentMethod || receiptData.payment || 'Cash';
    const payLine = `Payment: ${payMethod}`;
    for (let i = 0; i < payLine.length; i++) {
      commands.push(payLine.charCodeAt(i));
    }
    commands.push(0x0A);
    
    // Amount paid
    if (receiptData.amountPaid || receiptData.paid) {
      const paid = `Paid: ${Number(receiptData.amountPaid || receiptData.paid).toFixed(2)}`;
      for (let i = 0; i < paid.length; i++) {
        commands.push(paid.charCodeAt(i));
      }
      commands.push(0x0A);
    }
    
    // Change
    if (receiptData.change && Number(receiptData.change) > 0) {
      const chg = `Change: ${Number(receiptData.change).toFixed(2)}`;
      for (let i = 0; i < chg.length; i++) {
        commands.push(chg.charCodeAt(i));
      }
      commands.push(0x0A);
    }
    
    commands.push(0x0A, 0x0A);
    
    // Center align
    commands.push(0x1B, 0x61, 0x01);
    
    // Thank you
    const thanks = 'Thank you for your purchase!';
    for (let i = 0; i < thanks.length; i++) {
      commands.push(thanks.charCodeAt(i));
    }
    commands.push(0x0A);
    
    // Footer
    if (receiptData.footer || receiptData.footerMessage) {
      const footer = String(receiptData.footer || receiptData.footerMessage);
      for (let i = 0; i < footer.length; i++) {
        commands.push(footer.charCodeAt(i));
      }
      commands.push(0x0A);
    }
    
    commands.push(0x0A, 0x0A, 0x0A);
    
    // Cut paper - GS V 0
    commands.push(0x1D, 0x56, 0x00);

    const result = new Uint8Array(commands);
    console.log(`Γ£à Generated ${result.length} bytes of ESC/POS data`);
    
    return result;
  }

  /**
   * Get connected printer info
   */
  getConnectedPrinter(): string | null {
    return this.connectedDevice ? (this.connectedDevice.name || this.connectedDevice.deviceId) : null;
  }

  /**
   * Print a test receipt to verify printer functionality
   */
  async printTestReceipt(): Promise<void> {
    const testData = {
      storeName: 'TEST STORE',
      storeAddress: '123 Test Street',
      storeContact: 'Tel: 123-456-7890',
      invoiceNumber: 'TEST-001',
      date: new Date().toLocaleString(),
      cashier: 'Test User',
      items: [
        { name: 'Test Item 1', quantity: 2, price: 10.00, total: 20.00 },
        { name: 'Test Item 2', quantity: 1, price: 15.50, total: 15.50 },
        { name: 'Test Item 3', quantity: 3, price: 5.00, total: 15.00 }
      ],
      subtotal: 50.50,
      discount: 5.00,
      tax: 4.55,
      total: 50.05,
      paymentMethod: 'Cash',
      amountPaid: 60.00,
      change: 9.95
    };

    console.log('≡ƒº¬ Printing test receipt...');
    await this.printReceipt(testData);
  }
}
