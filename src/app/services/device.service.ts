import { Injectable, signal, computed } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  getDoc,
  orderBy,
  Timestamp,
  writeBatch
} from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { Device } from '../interfaces/device.interface';

export type { Device } from '../interfaces/device.interface';

@Injectable({
  providedIn: 'root'
})
export class DeviceService {
  private readonly devicesSignal = signal<Device[]>([]);
  
  // Public computed values
  readonly devices = computed(() => this.devicesSignal());
  readonly totalDevices = computed(() => this.devicesSignal().length);
  readonly activeDevices = computed(() => 
    this.devicesSignal().filter(d => d.status === 'active')
  );
  readonly pendingDevices = computed(() => 
    this.devicesSignal().filter(d => d.status === 'pending')
  );

  constructor(
    private firestore: Firestore,
    private authService: AuthService
  ) {}

  /**
   * Create a new device (starts as 'pending' status)
   * Used when user submits BIR accreditation
   */
  async createDevice(deviceData: Omit<Device, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      console.log('🖥️ Creating new device:', deviceData);

      const device = {
        ...deviceData,
        status: deviceData.status || 'pending',
        isLocked: false,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      const devicesRef = collection(this.firestore, 'devices');
      const docRef = await addDoc(devicesRef, device);

      console.log('✅ Device created with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error creating device:', error);
      throw error;
    }
  }

  /**
   * Get all devices for a specific store
   */
  async getDevicesByStore(storeId: string): Promise<Device[]> {
    try {
      console.log('📱 Loading devices for store:', storeId);

      const devicesRef = collection(this.firestore, 'devices');
      const devicesQuery = query(
        devicesRef,
        where('storeId', '==', storeId),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(devicesQuery);
      const devices = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          storeId: data['storeId'],
          companyId: data['companyId'],
          deviceLabel: data['deviceLabel'],
          terminalId: data['terminalId'],
          invoicePrefix: data['invoicePrefix'],
          invoiceSeriesStart: data['invoiceSeriesStart'],
          invoiceSeriesEnd: data['invoiceSeriesEnd'],
          currentInvoiceNumber: data['currentInvoiceNumber'],
          serialNumber: data['serialNumber'],
          minNumber: data['minNumber'],
          birPermitNo: data['birPermitNo'],
          atpOrOcn: data['atpOrOcn'],
          permitDateIssued: data['permitDateIssued']?.toDate() || new Date(),
          vatRegistrationType: data['vatRegistrationType'] || 'Non-VAT',
          vatRate: data['vatRate'],
          receiptType: data['receiptType'] || '',
          validityNotice: data['validityNotice'] || '',
          status: data['status'] || 'pending',
          isLocked: data['isLocked'] || false,
          approvedBy: data['approvedBy'],
          approvedAt: data['approvedAt']?.toDate(),
          createdAt: data['createdAt']?.toDate() || new Date(),
          updatedAt: data['updatedAt']?.toDate() || new Date()
        } as Device;
      });

      this.devicesSignal.set(devices);
      console.log('✅ Loaded', devices.length, 'devices');
      return devices;
    } catch (error) {
      console.error('❌ Error loading devices:', error);
      throw error;
    }
  }

  /**
   * Get all devices for a company (across all stores)
   */
  async getDevicesByCompany(companyId: string): Promise<Device[]> {
    try {
      console.log('📱 Loading devices for company:', companyId);

      const devicesRef = collection(this.firestore, 'devices');
      const devicesQuery = query(
        devicesRef,
        where('companyId', '==', companyId),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(devicesQuery);
      const devices = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          storeId: data['storeId'],
          companyId: data['companyId'],
          deviceLabel: data['deviceLabel'],
          terminalId: data['terminalId'],
          invoicePrefix: data['invoicePrefix'],
          invoiceSeriesStart: data['invoiceSeriesStart'],
          invoiceSeriesEnd: data['invoiceSeriesEnd'],
          currentInvoiceNumber: data['currentInvoiceNumber'],
          serialNumber: data['serialNumber'],
          minNumber: data['minNumber'],
          birPermitNo: data['birPermitNo'],
          atpOrOcn: data['atpOrOcn'],
          permitDateIssued: data['permitDateIssued']?.toDate() || new Date(),
          vatRegistrationType: data['vatRegistrationType'] || 'Non-VAT',
          vatRate: data['vatRate'],
          receiptType: data['receiptType'] || '',
          validityNotice: data['validityNotice'] || '',
          status: data['status'] || 'pending',
          isLocked: data['isLocked'] || false,
          approvedBy: data['approvedBy'],
          approvedAt: data['approvedAt']?.toDate(),
          createdAt: data['createdAt']?.toDate() || new Date(),
          updatedAt: data['updatedAt']?.toDate() || new Date()
        } as Device;
      });

      console.log('✅ Loaded', devices.length, 'devices for company');
      return devices;
    } catch (error) {
      console.error('❌ Error loading company devices:', error);
      throw error;
    }
  }

  /**
   * Get a single device by ID
   */
  async getDeviceById(deviceId: string): Promise<Device | null> {
    try {
      const deviceRef = doc(this.firestore, 'devices', deviceId);
      const deviceDoc = await getDoc(deviceRef);

      if (!deviceDoc.exists()) {
        return null;
      }

      const data = deviceDoc.data();
      return {
        id: deviceDoc.id,
        storeId: data['storeId'],
        companyId: data['companyId'],
        deviceLabel: data['deviceLabel'],
        terminalId: data['terminalId'],
        invoicePrefix: data['invoicePrefix'],
        invoiceSeriesStart: data['invoiceSeriesStart'],
        invoiceSeriesEnd: data['invoiceSeriesEnd'],
        currentInvoiceNumber: data['currentInvoiceNumber'],
        serialNumber: data['serialNumber'],
        minNumber: data['minNumber'],
        birPermitNo: data['birPermitNo'],
        atpOrOcn: data['atpOrOcn'],
        permitDateIssued: data['permitDateIssued']?.toDate() || new Date(),
        vatRegistrationType: data['vatRegistrationType'] || 'Non-VAT',
        vatRate: data['vatRate'],
        receiptType: data['receiptType'] || '',
        validityNotice: data['validityNotice'] || '',
        status: data['status'] || 'pending',
        isLocked: data['isLocked'] || false,
        approvedBy: data['approvedBy'],
        approvedAt: data['approvedAt']?.toDate(),
        createdAt: data['createdAt']?.toDate() || new Date(),
        updatedAt: data['updatedAt']?.toDate() || new Date()
      } as Device;
    } catch (error) {
      console.error('❌ Error getting device:', error);
      return null;
    }
  }

  /**
   * Get device by terminal ID and store ID
   */
  async getDeviceByTerminalId(terminalId: string, storeId: string): Promise<Device | null> {
    try {
      console.log('🔍 Looking for device with terminalId:', terminalId, 'storeId:', storeId);

      const devicesRef = collection(this.firestore, 'devices');
      const deviceQuery = query(
        devicesRef,
        where('terminalId', '==', terminalId),
        where('storeId', '==', storeId),
        where('status', '==', 'active')
      );

      const querySnapshot = await getDocs(deviceQuery);
      
      if (querySnapshot.empty) {
        console.log('⚠️ No active device found for terminalId:', terminalId);
        return null;
      }

      const deviceDoc = querySnapshot.docs[0];
      const data = deviceDoc.data();
      
      return {
        id: deviceDoc.id,
        storeId: data['storeId'],
        companyId: data['companyId'],
        deviceLabel: data['deviceLabel'],
        terminalId: data['terminalId'],
        invoicePrefix: data['invoicePrefix'],
        invoiceSeriesStart: data['invoiceSeriesStart'],
        invoiceSeriesEnd: data['invoiceSeriesEnd'],
        currentInvoiceNumber: data['currentInvoiceNumber'],
        serialNumber: data['serialNumber'],
        minNumber: data['minNumber'],
        birPermitNo: data['birPermitNo'],
        atpOrOcn: data['atpOrOcn'],
        permitDateIssued: data['permitDateIssued']?.toDate() || new Date(),
        vatRegistrationType: data['vatRegistrationType'] || 'VAT-registered',
        vatRate: data['vatRate'] || 12.0,
        receiptType: data['receiptType'] || 'POS Receipt',
        validityNotice: data['validityNotice'] || 'This invoice/receipt shall be valid for five (5) years from the date of the permit to use.',
        status: data['status'] || 'pending',
        lastUsedAt: data['lastUsedAt']?.toDate(),
        isOnline: data['isOnline'],
        isLocked: data['isLocked'] || false,
        approvedBy: data['approvedBy'],
        approvedAt: data['approvedAt']?.toDate(),
        createdAt: data['createdAt']?.toDate() || new Date(),
        updatedAt: data['updatedAt']?.toDate() || new Date()
      } as Device;
    } catch (error) {
      console.error('❌ Error getting device by terminalId:', error);
      return null;
    }
  }

  /**
   * Update device status
   */
  async updateDeviceStatus(
    deviceId: string,
    status: 'pending' | 'active' | 'inactive' | 'maintenance'
  ): Promise<void> {
    try {
      console.log('🔄 Updating device status:', deviceId, '→', status);

      const deviceRef = doc(this.firestore, 'devices', deviceId);
      await updateDoc(deviceRef, {
        status,
        updatedAt: Timestamp.now()
      });

      console.log('✅ Device status updated');
    } catch (error) {
      console.error('❌ Error updating device status:', error);
      throw error;
    }
  }

  /**
   * Approve device (called by admin after BIR review)
   * Sets status to 'active' and locks the BIR fields
   */
  async approveDevice(deviceId: string, adminUid: string): Promise<void> {
    try {
      console.log('✅ Approving device:', deviceId, 'by admin:', adminUid);

      const deviceRef = doc(this.firestore, 'devices', deviceId);
      await updateDoc(deviceRef, {
        status: 'active',
        isLocked: true,
        approvedBy: adminUid,
        approvedAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      console.log('✅ Device approved and locked');
    } catch (error) {
      console.error('❌ Error approving device:', error);
      throw error;
    }
  }

  /**
   * Reject device (called by admin)
   * Sets status back to 'pending' and does not lock
   */
  async rejectDevice(deviceId: string): Promise<void> {
    try {
      console.log('❌ Rejecting device:', deviceId);

      const deviceRef = doc(this.firestore, 'devices', deviceId);
      await updateDoc(deviceRef, {
        status: 'pending',
        isLocked: false,
        updatedAt: Timestamp.now()
      });

      console.log('✅ Device rejected, user can resubmit');
    } catch (error) {
      console.error('❌ Error rejecting device:', error);
      throw error;
    }
  }

  /**
   * Lock device BIR fields (called after approval)
   * Prevents further editing of BIR compliance details
   */
  async lockDevice(deviceId: string): Promise<void> {
    try {
      console.log('🔒 Locking device:', deviceId);

      const deviceRef = doc(this.firestore, 'devices', deviceId);
      await updateDoc(deviceRef, {
        isLocked: true,
        updatedAt: Timestamp.now()
      });

      console.log('✅ Device locked');
    } catch (error) {
      console.error('❌ Error locking device:', error);
      throw error;
    }
  }

  /**
   * Update device details (only if not locked)
   */
  async updateDevice(
    deviceId: string,
    updates: Partial<Device>
  ): Promise<void> {
    try {
      // Check if device is locked
      const device = await this.getDeviceById(deviceId);
      if (device?.isLocked) {
        throw new Error('Cannot update locked device. BIR details are immutable after approval.');
      }

      console.log('📝 Updating device:', deviceId);

      const deviceRef = doc(this.firestore, 'devices', deviceId);
      await updateDoc(deviceRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });

      console.log('✅ Device updated');
    } catch (error) {
      console.error('❌ Error updating device:', error);
      throw error;
    }
  }

  /**
   * Get current invoice number for a device
   */
  async getDeviceInvoiceUsage(deviceId: string): Promise<{
    current: number;
    start: number;
    end: number;
    remaining: number;
    percentUsed: number;
  } | null> {
    try {
      const device = await this.getDeviceById(deviceId);
      if (!device) return null;

      const current = device.currentInvoiceNumber;
      const start = device.invoiceSeriesStart;
      const end = device.invoiceSeriesEnd;
      const total = end - start + 1;
      const used = current - start;
      const remaining = end - current;
      const percentUsed = (used / total) * 100;

      return {
        current,
        start,
        end,
        remaining,
        percentUsed: Math.round(percentUsed * 100) / 100
      };
    } catch (error) {
      console.error('❌ Error getting invoice usage:', error);
      return null;
    }
  }

  /**
   * Increment invoice number for a device
   * Called when a new invoice is generated
   */
  async incrementInvoiceNumber(deviceId: string): Promise<number> {
    try {
      const device = await this.getDeviceById(deviceId);
      if (!device) {
        throw new Error('Device not found');
      }

      const nextNumber = device.currentInvoiceNumber + 1;

      if (nextNumber > device.invoiceSeriesEnd) {
        throw new Error('Invoice series exhausted. Please request new BIR permit.');
      }

      const deviceRef = doc(this.firestore, 'devices', deviceId);
      await updateDoc(deviceRef, {
        currentInvoiceNumber: nextNumber,
        lastUsedAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      console.log('📝 Invoice number incremented to:', nextNumber);
      return nextNumber;
    } catch (error) {
      console.error('❌ Error incrementing invoice number:', error);
      throw error;
    }
  }

  /**
   * Get next invoice number for a device (formatted with prefix)
   */
  getFormattedInvoiceNumber(device: Device): string {
    const invoiceNumber = device.currentInvoiceNumber.toString().padStart(6, '0');
    return `${device.invoicePrefix}-${invoiceNumber}`;
  }

  /**
   * Check if device has available invoice numbers
   */
  async hasAvailableInvoices(deviceId: string): Promise<boolean> {
    try {
      const device = await this.getDeviceById(deviceId);
      if (!device) return false;

      return device.currentInvoiceNumber < device.invoiceSeriesEnd;
    } catch (error) {
      console.error('❌ Error checking invoice availability:', error);
      return false;
    }
  }

  /**
   * Delete a device (admin only, only if not locked)
   */
  async deleteDevice(deviceId: string): Promise<void> {
    try {
      const device = await this.getDeviceById(deviceId);
      if (device?.isLocked) {
        throw new Error('Cannot delete locked device. Contact Tovrika admin.');
      }

      console.log('🗑️ Deleting device:', deviceId);
      const deviceRef = doc(this.firestore, 'devices', deviceId);
      await deleteDoc(deviceRef);
      console.log('✅ Device deleted');
    } catch (error) {
      console.error('❌ Error deleting device:', error);
      throw error;
    }
  }

  /**
   * Clear local signal
   */
  clearDevices(): void {
    this.devicesSignal.set([]);
  }
}
