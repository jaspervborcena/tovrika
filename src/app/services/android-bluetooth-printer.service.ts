import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { BluetoothLe, BleDevice } from '@capacitor-community/bluetooth-le';

/**
 * Android-specific Bluetooth thermal printer service
 * Handles ESC/POS commands for thermal receipt printers on Android
 */
@Injectable({
  providedIn: 'root'
})
export class AndroidBluetoothPrinterService {
  private connectedDevice: BleDevice | null = null;
  private isInitialized = false;
  
  // Printer service UUID (standard for most thermal printers)
  private readonly PRINTER_SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb';
  private readonly PRINTER_CHAR_UUID = '00002af1-0000-1000-8000-00805f9b34fb';

  constructor() {
    if (Capacitor.isNativePlatform()) {
      this.initialize();
    }
  }

  /**
   * Initialize Bluetooth LE
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      await BluetoothLe.initialize({ android: { scanMode: 'lowLatency' } });
      this.isInitialized = true;
      console.log('✅ Android Bluetooth initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Bluetooth:', error);
      throw error;
    }
  }

  /**
   * Check if running on Android native platform
   */
  isAndroidNative(): boolean {
    return Capacitor.getPlatform() === 'android';
  }

  /**
   * Scan for nearby Bluetooth printers
   */
  async scanForPrinters(timeoutMs: number = 5000): Promise<BleDevice[]> {
    if (!this.isAndroidNative()) {
      throw new Error('Not running on Android native platform');
    }

    await this.initialize();

    const devices: BleDevice[] = [];

    try {
      // Start scanning
      await BluetoothLe.requestLEScan(
        {
          allowDuplicates: false,
        },
        (result) => {
          if (result.device && result.device.name) {
            // Filter for printer devices (common names)
            const name = result.device.name.toLowerCase();
            if (
              name.includes('printer') ||
              name.includes('pos') ||
              name.includes('thermal') ||
              name.includes('mpt') ||
              name.includes('rpp') ||
              name.includes('xprinter')
            ) {
              devices.push(result.device);
            }
          }
        }
      );

      // Wait for scan duration
      await new Promise(resolve => setTimeout(resolve, timeoutMs));

      // Stop scanning
      await BluetoothLe.stopLEScan();

      console.log(`🔍 Found ${devices.length} printer(s)`);
      return devices;
    } catch (error) {
      console.error('❌ Error scanning for printers:', error);
      throw error;
    }
  }

  /**
   * Connect to a Bluetooth printer
   */
  async connectToPrinter(deviceId: string): Promise<void> {
    if (!this.isAndroidNative()) {
      throw new Error('Not running on Android native platform');
    }

    await this.initialize();

    try {
      // Connect to device
      await BluetoothLe.connect({ deviceId }, () => {
        console.log('⚠️ Printer disconnected');
        this.connectedDevice = null;
      });

      // Discover services
      await BluetoothLe.discoverServices({ deviceId });

      this.connectedDevice = { deviceId } as BleDevice;
      console.log('✅ Connected to printer:', deviceId);
    } catch (error) {
      console.error('❌ Failed to connect to printer:', error);
      throw error;
    }
  }

  /**
   * Disconnect from current printer
   */
  async disconnect(): Promise<void> {
    if (!this.connectedDevice) return;

    try {
      await BluetoothLe.disconnect({ deviceId: this.connectedDevice.deviceId });
      this.connectedDevice = null;
      console.log('✅ Disconnected from printer');
    } catch (error) {
      console.error('❌ Failed to disconnect:', error);
    }
  }

  /**
   * Check if printer is connected
   */
  isConnected(): boolean {
    return this.connectedDevice !== null;
  }

  /**
   * Print receipt data (ESC/POS format)
   */
  async print(escPosData: Uint8Array): Promise<void> {
    if (!this.connectedDevice) {
      throw new Error('No printer connected');
    }

    try {
      // Convert Uint8Array to base64 string for Capacitor plugin
      const base64Data = this.arrayBufferToBase64(escPosData);

      // Write to printer characteristic
      await BluetoothLe.write({
        deviceId: this.connectedDevice.deviceId,
        service: this.PRINTER_SERVICE_UUID,
        characteristic: this.PRINTER_CHAR_UUID,
        value: base64Data
      });

      console.log('✅ Print data sent successfully');
    } catch (error) {
      console.error('❌ Failed to print:', error);
      throw error;
    }
  }

  /**
   * Convert receipt HTML to ESC/POS commands
   */
  htmlToEscPos(html: string, paperWidth: number = 32): Uint8Array {
    const commands: number[] = [];

    // ESC/POS initialization
    commands.push(0x1B, 0x40); // Initialize printer
    commands.push(0x1B, 0x61, 0x01); // Center align

    // Parse HTML (simple text extraction for now)
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const text = tempDiv.textContent || '';

    // Split into lines and add to commands
    const lines = text.split('\n');
    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine) {
        // Add text
        for (let i = 0; i < trimmedLine.length; i++) {
          commands.push(trimmedLine.charCodeAt(i));
        }
        // Line feed
        commands.push(0x0A);
      }
    });

    // Cut paper
    commands.push(0x0A, 0x0A, 0x0A); // 3 line feeds
    commands.push(0x1D, 0x56, 0x01); // Partial cut

    return new Uint8Array(commands);
  }

  /**
   * Convert ArrayBuffer to Base64
   */
  private arrayBufferToBase64(buffer: Uint8Array): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Quick print method (scan, connect, print, disconnect)
   */
  async quickPrint(receiptHtml: string, paperWidth: number = 32): Promise<void> {
    try {
      // Scan for printers
      const printers = await this.scanForPrinters(3000);
      
      if (printers.length === 0) {
        throw new Error('No Bluetooth printers found');
      }

      // Connect to first printer found
      await this.connectToPrinter(printers[0].deviceId);

      // Convert HTML to ESC/POS
      const escPosData = this.htmlToEscPos(receiptHtml, paperWidth);

      // Print
      await this.print(escPosData);

      // Wait a bit for printing to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Disconnect
      await this.disconnect();

      console.log('✅ Quick print completed');
    } catch (error) {
      console.error('❌ Quick print failed:', error);
      throw error;
    }
  }
}
