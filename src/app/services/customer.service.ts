import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, query, where, getDocs, orderBy, limit } from '@angular/fire/firestore';
import { Customer, CustomerFormData } from '../interfaces/customer.interface';
import { FirestoreSecurityService } from '../core/services/firestore-security.service';
import { OfflineDocumentService } from '../core/services/offline-document.service';

@Injectable({
  providedIn: 'root'
})
export class CustomerService {
  private firestore = inject(Firestore);
  private securityService = inject(FirestoreSecurityService);
  private offlineDocService = inject(OfflineDocumentService);

  /**
   * Generate next customer ID
   */
  async generateCustomerId(companyId: string): Promise<string> {
    try {
      const customersRef = collection(this.firestore, 'customers');
      const q = query(
        customersRef,
        where('companyId', '==', companyId),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return 'CUST-2025-000001';
      }
      
      const lastCustomer = snapshot.docs[0].data() as Customer;
      const lastId = lastCustomer.customerId;
      const lastNumber = parseInt(lastId.split('-')[2]);
      const nextNumber = lastNumber + 1;
      
      return `CUST-2025-${nextNumber.toString().padStart(6, '0')}`;
    } catch (error) {
      console.error('Error generating customer ID:', error);
      return `CUST-2025-${Date.now().toString().slice(-6)}`;
    }
  }

  /**
   * Parse full name into first and last name
   */
  private parseFullName(fullName: string): { firstName: string; lastName: string } {
    const nameParts = fullName.trim().split(' ');
    if (nameParts.length === 1) {
      return { firstName: nameParts[0], lastName: '' };
    }
    
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');
    return { firstName, lastName };
  }

  /**
   * Save customer from POS form data
   */
  async saveCustomerFromPOS(
    customerData: CustomerFormData,
    companyId: string,
    storeId: string
  ): Promise<Customer | null> {
    try {
      // Skip if no meaningful customer data
      if (!customerData.soldTo?.trim() && !customerData.tin?.trim() && !customerData.businessAddress?.trim()) {
        return null;
      }

      const customerId = await this.generateCustomerId(companyId);
      const { firstName, lastName } = this.parseFullName(customerData.soldTo || 'Walk-in Customer');
      
      // Add security fields to customer data
      const customerWithSecurity = await this.securityService.addSecurityFields({
        companyId,
        storeId,
        customerId,
        firstName,
        lastName,
        fullName: customerData.soldTo || 'Walk-in Customer',
        email: customerData.email,
        contactNumber: customerData.contactNumber,
        address: customerData.businessAddress,
        tin: customerData.tin,
        isSeniorCitizen: customerData.isSeniorCitizen || false,
        isPWD: customerData.isPWD || false,
        exemptionId: customerData.exemptionId,
        country: 'Philippines' // Default for now
      });

      // 🔥 OFFLINE-SAFE: Use OfflineDocumentService for pre-generated IDs
      const documentId = await this.offlineDocService.createDocument('customers', customerWithSecurity);
      
      console.log('✅ Customer saved successfully with pre-generated ID:', documentId, navigator.onLine ? '(online)' : '(offline)');
      return { ...customerWithSecurity, id: documentId };
    } catch (error) {
      console.error('❌ Error saving customer:', error);
      return null;
    }
  }

  /**
   * Search customers by name or ID
   */
  async searchCustomers(companyId: string, storeId: string, searchTerm: string): Promise<Customer[]> {
    try {
      const customersRef = collection(this.firestore, 'customers');
      const q = query(
        customersRef,
        where('companyId', '==', companyId),
        where('storeId', '==', storeId),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      
      const snapshot = await getDocs(q);
      const customers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Customer[];
      
      // Filter by search term on client side (Firestore doesn't support full-text search)
      if (searchTerm.trim()) {
        const searchLower = searchTerm.toLowerCase();
        return customers.filter(customer => 
          customer.fullName.toLowerCase().includes(searchLower) ||
          customer.customerId.toLowerCase().includes(searchLower) ||
          customer.email?.toLowerCase().includes(searchLower) ||
          customer.contactNumber?.includes(searchTerm)
        );
      }
      
      return customers;
    } catch (error) {
      console.error('❌ Error searching customers:', error);
      return [];
    }
  }

  /**
   * Get customer by ID
   */
  async getCustomerById(customerId: string): Promise<Customer | null> {
    try {
      const customersRef = collection(this.firestore, 'customers');
      const q = query(customersRef, where('customerId', '==', customerId), limit(1));
      
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        return null;
      }
      
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() } as Customer;
    } catch (error) {
      console.error('❌ Error getting customer:', error);
      return null;
    }
  }
}
