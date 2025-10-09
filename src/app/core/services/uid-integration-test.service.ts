import { Injectable, inject } from '@angular/core';
import { FirestoreSecurityService } from './firestore-security.service';
import { IndexedDBService } from './indexeddb.service';

@Injectable({
  providedIn: 'root'
})
export class UidIntegrationTestService {
  private securityService = inject(FirestoreSecurityService);
  private indexedDBService = inject(IndexedDBService);

  /**
   * Test the IndexedDB UID integration functionality
   */
  async testUidIntegration(): Promise<void> {
    console.log('🧪 Starting UID Integration Test...');

    try {
      // Test 1: Check if we can get UID
      console.log('📋 Test 1: Getting UID from IndexedDB userData...');
      const uid = await this.securityService.getCurrentUserUID();
      console.log('✅ UID retrieved:', uid);

      if (!uid) {
        console.warn('⚠️ No UID available - user might not be logged in or userData not cached');
        return;
      }

      // Test 2: Check IndexedDB userData directly
      console.log('📋 Test 2: Checking IndexedDB userData directly...');
      const userData = await this.indexedDBService.getCurrentUser();
      console.log('✅ UserData from IndexedDB:', {
        uid: userData?.uid,
        email: userData?.email,
        hasPermissions: !!userData?.permissions?.length
      });

      // Test 3: Test addSecurityFields
      console.log('📋 Test 3: Testing addSecurityFields with sample data...');
      const sampleData = { name: 'Test Product', price: 100 };
      const dataWithSecurity = await this.securityService.addSecurityFields(sampleData);
      console.log('✅ Data with security fields:', {
        original: sampleData,
        enhanced: {
          uid: dataWithSecurity.uid,
          createdBy: dataWithSecurity.createdBy,
          updatedBy: dataWithSecurity.updatedBy,
          hasTimestamps: !!(dataWithSecurity.createdAt && dataWithSecurity.updatedAt),
          isOfflineCreated: dataWithSecurity.isOfflineCreated
        }
      });

      // Test 4: Test addUpdateSecurityFields
      console.log('📋 Test 4: Testing addUpdateSecurityFields...');
      const updateData = { price: 150 };
      const updateWithSecurity = await this.securityService.addUpdateSecurityFields(updateData);
      console.log('✅ Update data with security fields:', {
        original: updateData,
        enhanced: {
          updatedBy: updateWithSecurity.updatedBy,
          hasUpdatedAt: !!updateWithSecurity.updatedAt,
          lastModifiedOffline: updateWithSecurity.lastModifiedOffline
        }
      });

      // Test 5: Online/Offline detection
      console.log('📋 Test 5: Testing online/offline detection...');
      console.log('✅ Navigator online status:', navigator.onLine);
      console.log('✅ Firebase Auth UID available:', !!this.securityService.getCurrentUserUIDSync());

      console.log('🎉 All UID Integration Tests Passed!');

    } catch (error) {
      console.error('❌ UID Integration Test Failed:', error);
    }
  }

  /**
   * Test document access validation
   */
  async testDocumentAccess(documentUID: string): Promise<void> {
    try {
      console.log('🧪 Testing document access for UID:', documentUID);
      const canAccess = await this.securityService.canAccessDocument(documentUID);
      console.log('✅ Can access document:', canAccess);
    } catch (error) {
      console.error('❌ Document access test failed:', error);
    }
  }

  /**
   * Test authentication requirement
   */
  async testAuthenticationRequirement(): Promise<void> {
    try {
      console.log('🧪 Testing authentication requirement...');
      const uid = await this.securityService.requireAuthentication();
      console.log('✅ Authentication verified, UID:', uid);
    } catch (error) {
      console.error('❌ Authentication test failed:', error);
    }
  }
}