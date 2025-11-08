import { Component, OnInit, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
// import { NetworkService } from '../../../core/services/network.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <header class="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-3 shadow-lg">
      <div class="flex items-center justify-between">
        <!-- Left: Title and breadcrumb -->
        <div class="flex items-center space-x-4">
          <ng-content select="[slot=title]"></ng-content>
        </div>
        
        <!-- Center: Store/Company info -->
        <div class="flex-1 text-center">
          <ng-content select="[slot=center]"></ng-content>
        </div>
        
        <!-- Right: Status and actions -->
        <div class="flex items-center space-x-4">
          <!-- Network Status Indicator -->
          <div class="flex items-center bg-black/10 rounded-full px-3 py-1 space-x-2">
            <div 
              class="w-3 h-3 rounded-full transition-all duration-300"
              [ngClass]="getStatusIndicatorClass()">
            </div>
            <span class="text-sm font-medium">
              {{ getStatusText() }}
            </span>
          </div>
          
          <!-- Actions -->
          <ng-content select="[slot=actions]"></ng-content>
        </div>
      </div>
      
      <!-- Status Banner (only shows for offline/syncing) -->
      <div 
        *ngIf="shouldShowBanner()" 
        class="mt-2 rounded-lg px-3 py-2 text-sm transition-all duration-300"
        [ngClass]="getBannerClass()">
        <div class="flex items-center space-x-2">
          <svg 
            class="w-4 h-4"
            [ngClass]="getBannerIconColor()"
            fill="currentColor" 
            viewBox="0 0 20 20">
            <path *ngIf="networkStatus() === 'offline'" 
                  fill-rule="evenodd" 
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" 
                  clip-rule="evenodd"/>
            <path *ngIf="networkStatus() === 'syncing'" 
                  fill-rule="evenodd" 
                  d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" 
                  clip-rule="evenodd"/>
          </svg>
          <span [ngClass]="getBannerTextColor()">
            {{ getBannerMessage() }}
          </span>
        </div>
      </div>
    </header>
  `,
  styles: [`
    /* Mobile responsiveness */
    @media (max-width: 768px) {
      .status-text {
        display: none;
      }
      
      header .flex-1 {
        display: none;
      }
      
      .px-4 {
        padding-left: 1rem;
        padding-right: 1rem;
      }
    }
    
    /* Animation for status changes */
    .status-indicator {
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
  `]
})
export class AppHeaderComponent implements OnInit, OnDestroy {
  // NetworkService not needed here; using navigator events directly
  networkStatus = signal<'online' | 'offline' | 'syncing'>('online');
  private listeners: (() => void)[] = [];

  ngOnInit() {
    // Check initial network status
    this.networkStatus.set(navigator.onLine ? 'online' : 'offline');
    
    // Listen to network status changes
    const onlineListener = () => this.handleOnline();
    const offlineListener = () => this.handleOffline();
    
    window.addEventListener('online', onlineListener);
    window.addEventListener('offline', offlineListener);
    
    // Store listeners for cleanup
    this.listeners.push(
      () => window.removeEventListener('online', onlineListener),
      () => window.removeEventListener('offline', offlineListener)
    );
  }

  ngOnDestroy() {
    // Clean up event listeners
    this.listeners.forEach(cleanup => cleanup());
  }

  private handleOnline() {
    this.networkStatus.set('syncing');
    
    // Show syncing for 2 seconds, then switch to online
    setTimeout(() => {
      this.networkStatus.set('online');
    }, 2000);
  }

  private handleOffline() {
    this.networkStatus.set('offline');
  }

  getStatusIndicatorClass(): string {
    const status = this.networkStatus();
    if (status === 'online') {
      return 'bg-emerald-400 animate-pulse';      // 🟢 Professional green
    } else if (status === 'offline') {
      return 'bg-red-500 animate-pulse';         // 🔴 Clear warning red  
    } else if (status === 'syncing') {
      return 'bg-amber-400 animate-pulse';        // 🟡 Processing yellow
    }
    return 'bg-emerald-400 animate-pulse'; // Default to online
  }

  getStatusText(): string {
    const status = this.networkStatus();
    if (status === 'online') {
      return 'Online';
    } else if (status === 'offline') {
      return 'Offline Mode';
    } else if (status === 'syncing') {
      return 'Syncing...';
    }
    return 'Online'; // Default
  }

  shouldShowBanner(): boolean {
    // Only show banner for offline and syncing states
    return this.networkStatus() !== 'online';
  }

  getBannerClass(): string {
    const status = this.networkStatus();
    if (status === 'offline') {
      return 'bg-red-500/20 border border-red-400/30';
    } else if (status === 'syncing') {
      return 'bg-amber-500/20 border border-amber-400/30';
    }
    return '';
  }

  getBannerIconColor(): string {
    const status = this.networkStatus();
    if (status === 'offline') {
      return 'text-red-300';
    } else if (status === 'syncing') {
      return 'text-amber-300';
    }
    return '';
  }

  getBannerTextColor(): string {
    const status = this.networkStatus();
    if (status === 'offline') {
      return 'text-red-100';
    } else if (status === 'syncing') {
      return 'text-amber-100';
    }
    return '';
  }

  getBannerMessage(): string {
    const status = this.networkStatus();
    if (status === 'offline') {
      return 'You\'re working offline. Changes will sync when connection is restored.';
    } else if (status === 'syncing') {
      return 'Syncing your data with the cloud...';
    }
    return '';
  }
}