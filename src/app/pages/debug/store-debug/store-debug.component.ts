import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StoreService } from '../../../services/store.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-store-debug',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="padding: 20px; background: #f0f0f0; margin: 20px;">
      <h3>Store Debug Component</h3>
      <button (click)="loadStoresTest()" style="padding: 10px; margin: 5px; background: #007bff; color: white; border: none;">
        Test Load Stores
      </button>
      <button (click)="checkCurrentState()" style="padding: 10px; margin: 5px; background: #28a745; color: white; border: none;">
        Check Current State
      </button>
      
      <div style="margin-top: 20px;">
        <h4>Current User:</h4>
        <pre>{{ userInfo | json }}</pre>
        
        <h4>Stores from Service:</h4>
        <pre>{{ storeInfo | json }}</pre>
        
        <h4>Debug Log:</h4>
        <div style="max-height: 300px; overflow-y: auto; background: #333; color: #00ff00; padding: 10px; font-family: monospace;">
          <div *ngFor="let log of debugLogs">{{ log }}</div>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class StoreDebugComponent {
  userInfo: any = {};
  storeInfo: any = {};
  debugLogs: string[] = [];

  constructor(
    private storeService: StoreService,
    private authService: AuthService
  ) {
    this.checkCurrentState();
  }

  log(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    this.debugLogs.push(`[${timestamp}] ${message}`);
    console.log(message);
    
    // Keep only last 50 logs
    if (this.debugLogs.length > 50) {
      this.debugLogs = this.debugLogs.slice(-50);
    }
  }

  checkCurrentState() {
    try {
      this.userInfo = this.authService.getCurrentUser();
      this.storeInfo = {
        totalStores: this.storeService.getStores().length,
        stores: this.storeService.getStores().map(s => ({
          id: s.id,
          name: s.storeName,
          companyId: s.companyId
        })),
        debugStatus: (this.storeService as any).debugStoreStatus()
      };
      
      this.log(`Current state - User: ${this.userInfo?.companyId || 'No user'}, Stores: ${this.storeInfo.totalStores}`);
    } catch (e) {
      this.log(`Error checking state: ${e}`);
    }
  }

  async loadStoresTest() {
    try {
      const user = this.authService.getCurrentUser();
      const companyId = user?.companyId;
      
      this.log(`Starting store load test for company: ${companyId}`);
      
      if (!companyId) {
        this.log('ERROR: No company ID found');
        return;
      }
      
      this.log('Calling storeService.loadStores...');
      await this.storeService.loadStores(companyId);
      this.log('Store loading completed');
      
      // Check results
      setTimeout(() => {
        this.checkCurrentState();
        this.log(`After load: Found ${this.storeService.getStores().length} stores`);
      }, 500);
      
    } catch (error) {
      this.log(`ERROR loading stores: ${error}`);
    }
  }
}
