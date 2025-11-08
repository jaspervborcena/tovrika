import { Component, inject } from '@angular/core';
import { Firestore, collection, query, where, getDocs, limit } from '@angular/fire/firestore';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-firestore-test',
  standalone: true,
  template: `
    <div style="padding: 20px; font-family: monospace;">
      <h2>🧪 Firestore Products Test</h2>
      <button (click)="runTest()" [disabled]="testing">
        {{ testing ? 'Testing...' : 'Run Test' }}
      </button>
      <div style="margin-top: 20px;">
        <pre>{{ testResults }}</pre>
      </div>
    </div>
  `
})
export class FirestoreTestComponent {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  
  testing = false;
  testResults = '';

  private log(message: string) {
    console.log(message);
    this.testResults += new Date().toLocaleTimeString() + ': ' + message + '\n';
  }

  async runTest() {
    this.testing = true;
    this.testResults = '';
    
    try {
      this.log('🚀 Starting Firestore test...');
      
      // Check authentication
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) {
        this.log('❌ No user authenticated');
        return;
      }
      
      this.log('✅ User authenticated: ' + currentUser.email);
      
      // Test 1: Check if products collection exists
      this.log('\n📊 Test 1: Basic products collection access');
      const productsRef = collection(this.firestore, 'products');
      const basicQuery = query(productsRef, limit(5));
      const basicSnapshot = await getDocs(basicQuery);
      
      this.log('📦 Total products found: ' + basicSnapshot.size);
      
      if (basicSnapshot.empty) {
        this.log('❌ Products collection is empty!');
        return;
      }
      
      // Test 2: Analyze product structure
      this.log('\n🔍 Test 2: Analyzing product structure');
      const companies = new Set<string>();
      const stores = new Set<string>();
      const statuses = new Set<string>();
      
      basicSnapshot.docs.forEach(doc => {
        const data = doc.data();
        this.log('📋 Sample product: ' + JSON.stringify({
          id: doc.id,
          productName: data['productName'],
          companyId: data['companyId'],
          storeId: data['storeId'],
          status: data['status']
        }, null, 2));
        
        if (data['companyId']) companies.add(data['companyId']);
        if (data['storeId']) stores.add(data['storeId']);
        if (data['status']) statuses.add(data['status']);
      });
      
      this.log('\n📈 Data Summary:');
      this.log('🏢 Companies found: ' + Array.from(companies).join(', '));
      this.log('🏪 Stores found: ' + Array.from(stores).join(', '));
      this.log('📊 Statuses found: ' + Array.from(statuses).join(', '));
      
      // Test 3: Try the ProductService query pattern
      this.log('\n🎯 Test 3: ProductService query simulation');
      
      // Get user's company (simulate the ProductService logic)
      const userCompany = await this.authService.waitForAuth();
      this.log('👤 User company data: ' + JSON.stringify(userCompany, null, 2));
      
      // Get current permission to extract companyId
      const currentPermission = this.authService.getCurrentPermission();
      const companyId = currentPermission?.companyId || userCompany?.currentCompanyId;
      
      if (companyId) {
        // Try query with just companyId and status
        const companyQuery = query(
          productsRef,
          where('companyId', '==', companyId),
          where('status', '==', 'active'),
          limit(10)
        );
        
        const companySnapshot = await getDocs(companyQuery);
        this.log('📦 Query results for company ' + companyId + ': ' + companySnapshot.size + ' documents');
        
        companySnapshot.docs.forEach(doc => {
          const data = doc.data();
          this.log('  📦 ' + data['productName'] + ' (Store: ' + data['storeId'] + ')');
        });
        
        // If we have stores, try with a specific storeId
        if (stores.size > 0) {
          const firstStore = Array.from(stores)[0];
          this.log('\n🏪 Testing with store: ' + firstStore);
          
          const storeQuery = query(
            productsRef,
            where('companyId', '==', companyId),
            where('storeId', '==', firstStore),
            where('status', '==', 'active'),
            limit(10)
          );
          
          const storeSnapshot = await getDocs(storeQuery);
          this.log('🎯 Products for company+store query: ' + storeSnapshot.size);
          
          if (storeSnapshot.empty) {
            this.log('❌ No products found with ProductService query pattern!');
            this.log('💡 This is likely why products are not loading');
          } else {
            this.log('✅ ProductService query pattern works!');
          }
        }
      }
      
    } catch (error) {
      this.log('❌ Error: ' + error);
      console.error('Test error:', error);
    } finally {
      this.testing = false;
    }
  }
}