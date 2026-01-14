import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, query, where, orderBy, getDocs, doc, updateDoc, Timestamp } from '@angular/fire/firestore';
import { AuthService } from '../../../services/auth.service';
import { SubscriptionService } from '../../../services/subscription.service';
import { StoreService } from '../../../services/store.service';
import { ToastService } from '../../../shared/services/toast.service';
import { SubscriptionRequest } from '../../../interfaces/subscription-request.interface';
import { Router } from '@angular/router';

interface SubscriptionRequestWithStore extends SubscriptionRequest {
  storeName?: string;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
})
export class AdminComponent implements OnInit {
  private readonly firestore = inject(Firestore);
  private readonly authService = inject(AuthService);
  private readonly subscriptionService = inject(SubscriptionService);
  private readonly storeService = inject(StoreService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  // State
  requests = signal<SubscriptionRequestWithStore[]>([]);
  loading = signal(false);
  searchTerm = signal('');
  filterStatus = signal<'all' | 'pending' | 'active' | 'closed'>('all');
  filterTier = signal<'all' | 'freemium' | 'standard' | 'premium' | 'enterprise'>('all');

  // Computed
  filteredRequests = computed(() => {
    let filtered = this.requests();

    // Exclude closed requests by default
    filtered = filtered.filter(req => req.status !== 'closed');

    // Filter by search term
    const search = this.searchTerm().toLowerCase();
    if (search) {
      filtered = filtered.filter(req =>
        req.companyName.toLowerCase().includes(search) ||
        req.ownerEmail.toLowerCase().includes(search) ||
        req.storeName?.toLowerCase().includes(search) ||
        req.requestedTier.toLowerCase().includes(search)
      );
    }

    // Filter by status
    const status = this.filterStatus();
    if (status !== 'all') {
      filtered = filtered.filter(req => req.status === status);
    }

    // Filter by tier
    const tier = this.filterTier();
    if (tier !== 'all') {
      filtered = filtered.filter(req => req.requestedTier === tier);
    }

    return filtered;
  });

  // Stats
  totalRequests = computed(() => this.requests().filter(r => r.status !== 'closed').length);
  pendingRequests = computed(() => this.requests().filter(r => r.status === 'pending').length);
  approvedRequests = computed(() => this.requests().filter(r => r.status === 'active').length);
  rejectedRequests = computed(() => this.requests().filter(r => r.status === 'closed').length);

  async ngOnInit() {
    // Check if user has admin role
    const userRole = this.authService.userRole();
    if (userRole !== 'admin') {
      this.toast.error('Access denied. Admin role required.');
      this.router.navigate(['/dashboard']);
      return;
    }

    await this.loadSubscriptionRequests();
  }

  async loadSubscriptionRequests() {
    this.loading.set(true);
    try {
      const requestsRef = collection(this.firestore, 'subscriptionRequests');
      const q = query(requestsRef, orderBy('requestedAt', 'desc'));
      const snapshot = await getDocs(q);

      const requestsData: SubscriptionRequestWithStore[] = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          const toDate = (v: any) => v?.toDate?.() || (v instanceof Date ? v : null);

          // Get store name if storeId exists in companyId field (or fetch from stores)
          let storeName = 'N/A';
          if (data['companyId']) {
            try {
              const stores = await this.storeService.getStoresByCompany(data['companyId']);
              if (stores.length > 0) {
                storeName = stores[0].storeName; // Get first store or match by subscriptionId
              }
            } catch (error) {
              console.warn('Could not fetch store name:', error);
            }
          }

          return {
            id: docSnap.id,
            companyId: data['companyId'] || '',
            companyName: data['companyName'] || '',
            ownerEmail: data['ownerEmail'] || '',
            contactPhone: data['contactPhone'] || '',
            requestedAt: toDate(data['requestedAt']),
            requestedTier: data['requestedTier'] || 'standard',
            notes: data['notes'] || '',
            status: data['status'] || 'pending',
            reviewedAt: toDate(data['reviewedAt']),
            reviewedBy: data['reviewedBy'],
            rejectionReason: data['rejectionReason'],
            subscriptionId: data['subscriptionId'],
            durationMonths: data['durationMonths'],
            paymentMethod: data['paymentMethod'],
            paymentReference: data['paymentReference'],
            amountPaid: data['amountPaid'],
            paymentReceiptUrl: data['paymentReceiptUrl'],
            storeName
          } as SubscriptionRequestWithStore;
        })
      );

      this.requests.set(requestsData);
      console.log('📋 Loaded subscription requests:', requestsData.length);
    } catch (error) {
      console.error('❌ Error loading subscription requests:', error);
      this.toast.error('Failed to load subscription requests');
    } finally {
      this.loading.set(false);
    }
  }

  async approveRequest(request: SubscriptionRequestWithStore) {
    if (!request.id) {
      this.toast.error('Invalid request data');
      return;
    }

    const confirmed = confirm(
      `Approve subscription request?\n\n` +
      `Company: ${request.companyName}\n` +
      `Tier: ${request.requestedTier.toUpperCase()}\n` +
      `Amount: ₱${request.amountPaid || 0}`
    );
    if (!confirmed) return;

    this.loading.set(true);
    try {
      const user = this.authService.getCurrentUser();
      if (!user) throw new Error('User not authenticated');

      // 1. If subscriptionId exists, update that subscription; otherwise create a new one
      if (request.subscriptionId) {
        await this.subscriptionService.updateSubscription(request.subscriptionId, {
          status: 'active'
        } as any);
      } else if (request.companyId) {
        // Create a new subscription for this company
        const stores = await this.storeService.getStoresByCompany(request.companyId);
        if (stores.length > 0) {
          const store = stores[0];
          const durationMonths = request.durationMonths || 1;
          const startDate = new Date();
          const endDate = new Date();
          endDate.setMonth(endDate.getMonth() + durationMonths);
          
          const user = this.authService.getCurrentUser();
          await this.subscriptionService.createSubscription({
            subscriptionId: `sub_${Date.now()}`,
            companyId: request.companyId,
            storeId: store.id!,
            uid: user?.uid || '',
            planType: request.requestedTier,
            status: 'active',
            startDate,
            endDate,
            amountPaid: request.amountPaid || 0,
            paymentMethod: request.paymentMethod || 'bank_transfer',
            paymentReference: request.paymentReference || ''
          });
          
          // Update store subscription end date
          await this.storeService.updateStore(store.id!, {
            subscriptionEndDate: endDate as any
          });
        }
      }

      // 2. Update subscription request status
      const requestRef = doc(this.firestore, 'subscriptionRequests', request.id);
      await updateDoc(requestRef, {
        status: 'active',
        reviewedAt: Timestamp.now(),
        reviewedBy: user.uid
      });

      // 3. Update store subscription end date if we can find the store (for existing subscriptions)
      if (request.companyId && request.subscriptionId) {
        try {
          const stores = await this.storeService.getStoresByCompany(request.companyId);
          if (stores.length > 0) {
            const subscription = await this.subscriptionService.getSubscriptionForStore(
              request.companyId,
              stores[0].id!
            );
            if (subscription?.data.endDate) {
              await this.storeService.updateStore(stores[0].id!, {
                subscriptionEndDate: subscription.data.endDate as any
              });
            }
          }
        } catch (error) {
          console.warn('Could not update store subscription end date:', error);
        }
      }

      this.toast.success('✅ Subscription request approved successfully!');
      await this.loadSubscriptionRequests();
    } catch (error) {
      console.error('❌ Error approving request:', error);
      this.toast.error('Failed to approve request. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  async rejectRequest(request: SubscriptionRequestWithStore) {
    if (!request.id) {
      this.toast.error('Invalid request data');
      return;
    }

    const reason = prompt(
      `Close subscription request for ${request.companyName}?\n\n` +
      `Please provide a reason (optional):`
    );
    if (reason === null) return; // User clicked cancel

    this.loading.set(true);
    try {
      const user = this.authService.getCurrentUser();
      if (!user) throw new Error('User not authenticated');

      // Update subscription request status to closed
      const requestRef = doc(this.firestore, 'subscriptionRequests', request.id);
      const updateData: any = {
        status: 'closed',
        reviewedAt: Timestamp.now(),
        reviewedBy: user.uid
      };
      
      if (reason && reason.trim()) {
        updateData.rejectionReason = reason.trim();
      }
      
      await updateDoc(requestRef, updateData);

      this.toast.success('✅ Subscription request closed.');
      await this.loadSubscriptionRequests();
    } catch (error) {
      console.error('❌ Error closing request:', error);
      this.toast.error('Failed to close request. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  viewReceipt(receiptUrl?: string) {
    if (!receiptUrl) {
      this.toast.error('No receipt available');
      return;
    }
    window.open(receiptUrl, '_blank');
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

  clearSearch() {
    this.searchTerm.set('');
  }

  refreshRequests() {
    this.loadSubscriptionRequests();
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'pending':
        return 'badge-warning';
      case 'active':
        return 'badge-success';
      case 'closed':
        return 'badge-danger';
      default:
        return 'badge-secondary';
    }
  }

  getTierBadgeClass(tier: string): string {
    switch (tier) {
      case 'freemium':
        return 'badge-info';
      case 'standard':
        return 'badge-primary';
      case 'premium':
        return 'badge-premium';
      case 'enterprise':
        return 'badge-enterprise';
      default:
        return 'badge-secondary';
    }
  }

  formatDate(date: Date | null): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatCurrency(amount: number | undefined): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount || 0);
  }
}
