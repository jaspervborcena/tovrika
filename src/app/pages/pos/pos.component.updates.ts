// Add these imports to the existing imports in pos.component.ts
import { OfflineService } from '../../services/offline.service';

// Add to the component class
export class PosComponent implements OnInit {
  // ... existing code ...

  private offlineService = inject(OfflineService);
  connectionStatus = computed(() => this.offlineService.getConnectionStatus());

  // Add to the template, just below the Current Sale header
  template: `
    <!-- Add this after the Cart Header -->
    <div *ngIf="!connectionStatus().isOnline" class="bg-yellow-50 p-4">
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-yellow-800">
            Offline Mode
          </h3>
          <div class="mt-2 text-sm text-yellow-700">
            <p>
              Working offline. Transactions will be synced when connection is restored.
              {{ connectionStatus().pendingTransactions }} transaction(s) pending sync.
            </p>
          </div>
        </div>
      </div>
    </div>
  `

  // Update the processPayment method
  async processPayment() {
    if (!this.selectedPaymentMethod) {
      // Show error message
      return;
    }

    if (this.selectedPaymentMethod.id === 'cash' && this.amountTendered() < this.total()) {
      // Show error message
      return;
    }

    this.isProcessing = true;
    try {
      const user = this.authService.getCurrentUser();
      if (!user) throw new Error('User not found');

      const transaction = {
        companyId: user.companyId!,
        storeId: user.storeId!,
        branchId: user.branchId!,
        cashierId: user.uid,
        items: this.cart().map(item => ({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          tax: item.tax
        })),
        subtotal: this.subtotal(),
        tax: this.tax(),
        total: this.total(),
        paymentMethod: this.selectedPaymentMethod.id,
        amountTendered: this.amountTendered(),
        change: this.change(),
        status: 'completed' as const
      };

      await this.transactionService.createTransaction(transaction);
      
      // Show success message
      this.cart.set([]);
      this.closePaymentModal();
    } catch (error) {
      console.error('Error processing payment:', error);
      // Show error message
    } finally {
      this.isProcessing = false;
    }
  }
}
