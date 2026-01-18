import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, query, where, limit, getDocs, doc, updateDoc } from '@angular/fire/firestore';
import { Store } from '../../../interfaces/store.interface';
import { StoreService } from '../../../services/store.service';
import { AuthService } from '../../../services/auth.service';
import { BillingHistoryModalComponent } from './billing-history-modal.component';
import { UpgradeSubscriptionModalComponent } from './upgrade-subscription-modal.component';
import { Subscription as SubscriptionDoc } from '../../../interfaces/subscription.interface';
import { SubscriptionService } from '../../../services/subscription.service';

@Component({
  selector: 'app-subscriptions',
  standalone: true,
  imports: [CommonModule, FormsModule, BillingHistoryModalComponent, UpgradeSubscriptionModalComponent],
  templateUrl: './subscriptions.component.html',
  styleUrls: ['./subscriptions.component.css']
})
export class SubscriptionsComponent implements OnInit {
  private storeService = inject(StoreService);
  private authService = inject(AuthService);
  private subscriptionService = inject(SubscriptionService);
  private firestore = inject(Firestore);

  // Billing History Modal State
  billingHistoryModalOpen = signal(false);
  selectedStore = signal<Store | null>(null);

  // Upgrade Modal State
  upgradeModalOpen = signal(false);
  upgradeStore = signal<Store | null>(null);

  stores = signal<Store[]>([]);
  subscriptionsMap = signal<Record<string, SubscriptionDoc>>({});
  loading = signal(false);
  searchTerm = signal('');
  filterStatus = signal<'all' | 'active' | 'inactive' | 'expired' | 'cancelled' | 'pending'>('all');
  filterTier = signal<'all' | 'freemium' | 'standard' | 'premium'>('all');

  // Computed filtered stores
  filteredStores = computed(() => {
    let filtered = this.stores();
    
    // Filter by search term
    const search = this.searchTerm().toLowerCase();
    if (search) {
      filtered = filtered.filter(store => 
        store.storeName.toLowerCase().includes(search) ||
        (store.id && store.id.toLowerCase().includes(search))
      );
    }

    // Filter by subscription status (derived)
    const status = this.filterStatus();
    if (status !== 'all') {
      filtered = filtered.filter(store => this.getStoreStatus(store) === status);
    }

    // Filter by subscription tier (derived)
    const tier = this.filterTier();
    if (tier !== 'all') {
      filtered = filtered.filter(store => this.getStoreTier(store) === tier);
    }

    return filtered;
  });

  // Stats
  totalStores = computed(() => this.stores().length);
  activeSubscriptions = computed(() => 
    this.stores().filter(s => this.getStoreStatus(s) === 'active').length
  );
  totalRevenue = computed(() => 
    this.stores().reduce((sum, s) => {
      const sub = this.getLatestSub(s);
      return sum + (sub?.amountPaid || 0);
    }, 0)
  );

  ngOnInit() {
    this.loadStores();
  }

  async loadStores() {
    this.loading.set(true);
    try {
      const permission = this.authService.getCurrentPermission();
      if (!permission?.companyId) {
        console.error('No company ID found');
        return;
      }

      const storesData = await this.storeService.getStoresByCompany(permission.companyId);
      this.stores.set(storesData);

      // Load latest subscription for each store
      const entries = await Promise.all(
        storesData.map(async (s) => {
          try {
            const latest = await this.subscriptionService.getSubscriptionForStore(permission.companyId!, s.id!);
            return { storeId: s.id!, sub: latest?.data || null } as { storeId: string; sub: SubscriptionDoc | null };
          } catch {
            return { storeId: s.id!, sub: null } as { storeId: string; sub: SubscriptionDoc | null };
          }
        })
      );
      const map: Record<string, SubscriptionDoc> = {};
      entries.forEach(({ storeId, sub }) => { if (sub) map[storeId] = sub; });
      this.subscriptionsMap.set(map);
    } catch (error) {
      console.error('Error loading stores:', error);
    } finally {
      this.loading.set(false);
    }
  }

  onSearchChange(value: string) {
    this.searchTerm.set(value);
  }

  onFilterStatusChange(value: string) {
    this.filterStatus.set(value as any);
  }

  onFilterTierChange(value: string) {
    this.filterTier.set(value as any);
  }

  getStatusBadgeClass(status: string): string {
    const baseClasses = 'px-3 py-1 rounded-full text-xs font-medium';
    switch (status) {
      case 'active':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'pending':
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case 'inactive':
        return `${baseClasses} bg-gray-100 text-gray-800`;
      case 'expired':
        return `${baseClasses} bg-red-100 text-red-800`;
      case 'cancelled':
        return `${baseClasses} bg-orange-100 text-orange-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  }

  getTierBadgeClass(tier: string): string {
    const baseClasses = 'px-3 py-1 rounded-full text-xs font-semibold';
    switch (tier) {
      case 'freemium':
        return `${baseClasses} bg-blue-100 text-blue-800`;
      case 'standard':
        return `${baseClasses} bg-purple-100 text-purple-800`;
      case 'premium':
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case 'enterprise':
        return `${baseClasses} bg-indigo-100 text-indigo-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  }

  formatDate(date: Date | null): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount || 0);
  }

  isExpiringSoon(expiresAt: Date | null): boolean {
    if (!expiresAt) return false;
    const daysUntilExpiry = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  }

  getDaysUntilExpiry(expiresAt: Date | null): number {
    if (!expiresAt) return 0;
    return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  viewStoreDetails(store: Store) {
    console.log('View store details:', store);
    // TODO: Navigate to store details or open modal
  }

  upgradeSubscription(store: Store) {
    this.upgradeStore.set(store);
    this.upgradeModalOpen.set(true);
  }

  renewSubscription(store: Store) {
    console.log('Renew subscription for store:', store);
    // TODO: Open renewal modal
  }

  exportToCSV() {
    const csvData = this.filteredStores().map(store => {
      const sub = this.getLatestSub(store);
      return {
        'Store Name': store.storeName,
        'Store ID': store.id || '',
        'Tier': this.getStoreTier(store),
        'Status': this.getStoreStatus(store),
        'Subscribed At': this.formatDate(sub?.startDate as any),
        'Expires At': this.formatDate(this.getExpiresAt(store) as any),
        'Amount Paid': sub?.amountPaid || 0,
        'Promo Code': sub?.promoCode || '',
        'Referral Code': sub?.referralCode || ''
      } as Record<string, any>;
    });

    // Convert to CSV string
    const headers = Object.keys(csvData[0] || {});
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => headers.map(h => `"${row[h as keyof typeof row]}"`).join(','))
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subscriptions_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  }

  // Billing History Modal Methods
  openBillingHistory(store: Store) {
    this.selectedStore.set(store);
    this.billingHistoryModalOpen.set(true);
  }

  closeBillingHistoryModal() {
    this.billingHistoryModalOpen.set(false);
    this.selectedStore.set(null);
  }

  // Upgrade Modal Methods
  closeUpgradeModal() {
    this.upgradeModalOpen.set(false);
    this.upgradeStore.set(null);
  }
  onUpgradeCompleted() {
    // Reload stores to reflect updated subscription denormalization
    this.loadStores();
  }

  async approveSubscription(store: Store) {
    const sub = this.getLatestSub(store);
    if (!sub || !sub.id) {
      alert('No subscription found to approve');
      return;
    }

    const confirmed = confirm(`Approve subscription upgrade for ${store.storeName}?\n\nThis will activate the ${sub.planType.toUpperCase()} plan.`);
    if (!confirmed) return;

    try {
      this.loading.set(true);
      
      // Update subscription status to active
      await this.subscriptionService.updateSubscription(sub.id, {
        status: 'active'
      } as any);

      // Update store subscription end date
      if (sub.endDate) {
        await this.storeService.updateStore(store.id!, { 
          subscriptionEndDate: sub.endDate as any 
        });
      }

      // Update subscription request status if exists
      await this.updateSubscriptionRequestStatus(sub.id, 'approved');

      alert('✅ Subscription approved successfully!');
      await this.loadStores();
    } catch (error) {
      console.error('Error approving subscription:', error);
      alert('❌ Failed to approve subscription. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  async rejectSubscription(store: Store) {
    const sub = this.getLatestSub(store);
    if (!sub || !sub.id) {
      alert('No subscription found to reject');
      return;
    }

    const reason = prompt(`Reject subscription upgrade for ${store.storeName}?\n\nPlease provide a rejection reason:`);
    if (!reason || !reason.trim()) return;

    try {
      this.loading.set(true);
      
      // Update subscription status to rejected/cancelled
      await this.subscriptionService.updateSubscription(sub.id, {
        status: 'cancelled'
      } as any);

      // Update subscription request status if exists
      await this.updateSubscriptionRequestStatus(sub.id, 'rejected', reason);

      alert('❌ Subscription rejected.');
      await this.loadStores();
    } catch (error) {
      console.error('Error rejecting subscription:', error);
      alert('❌ Failed to reject subscription. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  private async updateSubscriptionRequestStatus(subscriptionId: string, status: 'approved' | 'rejected', rejectionReason?: string): Promise<void> {
    try {
      const user = this.authService.getCurrentUser();
      if (!user) return;

      // Query for subscription request with this subscriptionId
      const requestsRef = collection(this.firestore, 'subscriptionRequests');
      const q = query(requestsRef, where('subscriptionId', '==', subscriptionId), limit(1));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const requestDoc = snapshot.docs[0];
        const updateData: any = {
          status,
          reviewedAt: new Date(),
          reviewedBy: user.uid
        };
        
        if (rejectionReason) {
          updateData.rejectionReason = rejectionReason;
        }

        await updateDoc(doc(this.firestore, 'subscriptionRequests', requestDoc.id), updateData);
        console.log('✅ Subscription request updated:', status);
      }
    } catch (error) {
      console.error('⚠️ Failed to update subscription request:', error);
      // Don't throw - this is a secondary operation
    }
  }

  // ===== Derived subscription helpers =====

  private getLatestSub(store: Store): SubscriptionDoc | undefined {
    if (!store?.id) return undefined;
    return this.subscriptionsMap()[store.id];
  }

  getStoreTier(store: Store): string {
    // If you want to store tier in the store doc, add a field and use it here
    // For now, fallback to subscription doc
    const sub = this.getLatestSub(store);
    return (sub?.planType as string) || 'freemium';
  }

  getStoreStatus(store: Store): 'active' | 'inactive' | 'expired' | 'cancelled' | 'pending' {
    // Prefer store.status and store.subscriptionEndDate if present
    const now = Date.now();
    if (store.subscriptionEndDate) {
      const endMs = new Date(store.subscriptionEndDate).getTime();
      if (endMs < now) return 'expired';
      if (store.status === 'active') return 'active';
      // 'pending' and 'cancelled' are not valid Store.status values
      return store.status as any;
    }
    // Fallback to subscription doc logic
    const sub = this.getLatestSub(store);
    if (!sub) return 'inactive';
    if (sub.status === 'pending') return 'pending';
    const endMs = sub.endDate ? new Date(sub.endDate).getTime() : 0;
    if (sub.status === 'cancelled') return 'cancelled';
    if (endMs && endMs < now) return 'expired';
    return 'active';
  }

  getSubscribedAt(store: Store): Date | null {
    // No reliable field in store doc, fallback to subscription doc
    const sub = this.getLatestSub(store);
    return (sub?.startDate as any) || null;
  }

  getExpiresAt(store: Store): Date | null {
    // Prefer store.subscriptionEndDate if present
    if (store.subscriptionEndDate) return new Date(store.subscriptionEndDate);
    const sub = this.getLatestSub(store);
    return (sub?.endDate as any) || null;
  }

  getAmountPaid(store: Store): number {
    const sub = this.getLatestSub(store);
    return sub?.amountPaid || 0;
  }

  getPromoCode(store: Store): string {
    const sub = this.getLatestSub(store);
    return sub?.promoCode || '';
  }

  getReferralCode(store: Store): string {
    const sub = this.getLatestSub(store);
    return sub?.referralCode || '';
  }
}
