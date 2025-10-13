import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Store, Subscription } from '../../../interfaces/store.interface';
import { StoreService } from '../../../services/store.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-subscriptions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './subscriptions.component.html',
  styleUrls: ['./subscriptions.component.css']
})
export class SubscriptionsComponent implements OnInit {
  private storeService = inject(StoreService);
  private authService = inject(AuthService);

  stores = signal<Store[]>([]);
  loading = signal(false);
  searchTerm = signal('');
  filterStatus = signal<'all' | 'active' | 'inactive' | 'expired' | 'cancelled'>('all');
  filterTier = signal<'all' | 'freemium' | 'standard' | 'premium'>('all');

  // Computed filtered stores
  filteredStores = computed(() => {
    let filtered = this.stores();
    
    // Filter by search term
    const search = this.searchTerm().toLowerCase();
    if (search) {
      filtered = filtered.filter(store => 
        store.storeName.toLowerCase().includes(search) ||
        store.storeCode.toLowerCase().includes(search)
      );
    }

    // Filter by subscription status
    const status = this.filterStatus();
    if (status !== 'all') {
      filtered = filtered.filter(store => store.subscription.status === status);
    }

    // Filter by subscription tier
    const tier = this.filterTier();
    if (tier !== 'all') {
      filtered = filtered.filter(store => store.subscription.tier === tier);
    }

    return filtered;
  });

  // Stats
  totalStores = computed(() => this.stores().length);
  activeSubscriptions = computed(() => 
    this.stores().filter(s => s.subscription.status === 'active').length
  );
  totalRevenue = computed(() => 
    this.stores().reduce((sum, s) => sum + (s.subscription.finalAmount || 0), 0)
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

  formatDate(date: Date): string {
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

  isExpiringSoon(expiresAt: Date): boolean {
    if (!expiresAt) return false;
    const daysUntilExpiry = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  }

  getDaysUntilExpiry(expiresAt: Date): number {
    if (!expiresAt) return 0;
    return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  viewStoreDetails(store: Store) {
    console.log('View store details:', store);
    // TODO: Navigate to store details or open modal
  }

  upgradeSubscription(store: Store) {
    console.log('Upgrade subscription for store:', store);
    // TODO: Open upgrade modal
  }

  renewSubscription(store: Store) {
    console.log('Renew subscription for store:', store);
    // TODO: Open renewal modal
  }

  exportToCSV() {
    const csvData = this.filteredStores().map(store => ({
      'Store Name': store.storeName,
      'Store Code': store.storeCode,
      'Tier': store.subscription.tier,
      'Status': store.subscription.status,
      'Subscribed At': this.formatDate(store.subscription.subscribedAt),
      'Expires At': this.formatDate(store.subscription.expiresAt),
      'Amount Paid': store.subscription.amountPaid,
      'Discount %': store.subscription.discountPercent,
      'Final Amount': store.subscription.finalAmount,
      'Promo Code': store.subscription.promoCode || '',
      'Referral Code': store.subscription.referralCodeUsed || ''
    }));

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
}
