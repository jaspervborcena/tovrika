import { Injectable, signal, computed } from '@angular/core';
import { fromEvent, merge, of } from 'rxjs';
import { map, startWith, distinctUntilChanged } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class NetworkService {
  // Signal for online status
  private _isOnline = signal<boolean>(navigator.onLine);
  
  // Computed signal for offline status
  readonly isOffline = computed(() => !this._isOnline());
  
  // Public getter for online status
  readonly isOnline = computed(() => this._isOnline());

  // Connection quality indicator
  private _connectionQuality = signal<'good' | 'poor' | 'offline'>('good');
  readonly connectionQuality = computed(() => this._connectionQuality());

  // Last online timestamp
  private _lastOnlineAt = signal<Date | null>(new Date());
  readonly lastOnlineAt = computed(() => this._lastOnlineAt());

  constructor() {
    this.initializeNetworkMonitoring();
    this.startConnectionQualityTest();
  }

  /**
   * Initialize network monitoring with browser events
   */
  private initializeNetworkMonitoring(): void {
    // Listen to browser online/offline events
    const online$ = fromEvent(window, 'online').pipe(map(() => true));
    const offline$ = fromEvent(window, 'offline').pipe(map(() => false));
    
    // Combine events and start with current status
    const networkStatus$ = merge(online$, offline$).pipe(
      startWith(navigator.onLine),
      distinctUntilChanged()
    );

    // Subscribe to network status changes
    networkStatus$.subscribe(isOnline => {
      this._isOnline.set(isOnline);
      
      if (isOnline) {
        this._lastOnlineAt.set(new Date());
        this._connectionQuality.set('good');
        console.log('📡 Network: ONLINE');
        this.onConnectionRestored();
      } else {
        this._connectionQuality.set('offline');
        console.log('📡 Network: OFFLINE');
        this.onConnectionLost();
      }
    });
  }

  /**
   * Test connection quality periodically
   */
  private startConnectionQualityTest(): void {
    setInterval(() => {
      if (this._isOnline()) {
        this.testConnectionQuality();
      }
    }, 30000); // Test every 30 seconds
  }

  /**
   * Test connection quality using fetch with timeout
   */
  private async testConnectionQuality(): Promise<void> {
    try {
      const startTime = Date.now();
      
      // Try to fetch a small resource with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      await fetch('/assets/favicon.ico?' + Date.now(), {
        method: 'HEAD',
        cache: 'no-cache',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;
      
      // Determine connection quality based on response time
      if (responseTime < 1000) {
        this._connectionQuality.set('good');
      } else if (responseTime < 3000) {
        this._connectionQuality.set('poor');
      } else {
        this._connectionQuality.set('poor');
      }
      
    } catch (error) {
      // If fetch fails, we're probably offline
      this._connectionQuality.set('offline');
      this._isOnline.set(false);
    }
  }

  /**
   * Force check online status
   */
  async checkOnlineStatus(): Promise<boolean> {
    if (!navigator.onLine) {
      this._isOnline.set(false);
      return false;
    }

    try {
      // Try to fetch a small resource to confirm connectivity
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      await fetch('/assets/favicon.ico?' + Date.now(), {
        method: 'HEAD',
        cache: 'no-cache',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      this._isOnline.set(true);
      this._lastOnlineAt.set(new Date());
      return true;
    } catch (error) {
      this._isOnline.set(false);
      return false;
    }
  }

  /**
   * Wait for online connection
   */
  async waitForOnline(timeoutMs: number = 10000): Promise<boolean> {
    if (this._isOnline()) {
      return true;
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false);
      }, timeoutMs);

      const checkInterval = setInterval(async () => {
        const isOnline = await this.checkOnlineStatus();
        if (isOnline) {
          clearTimeout(timeout);
          clearInterval(checkInterval);
          resolve(true);
        }
      }, 1000);
    });
  }

  /**
   * Get offline duration in milliseconds
   */
  getOfflineDuration(): number {
    if (this._isOnline()) {
      return 0;
    }
    
    const lastOnline = this._lastOnlineAt();
    if (!lastOnline) {
      return 0;
    }
    
    return Date.now() - lastOnline.getTime();
  }

  /**
   * Get human-readable offline duration
   */
  getOfflineDurationString(): string {
    if (this._isOnline()) {
      return 'Online';
    }

    const duration = this.getOfflineDuration();
    const minutes = Math.floor(duration / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `Offline for ${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `Offline for ${minutes}m`;
    } else {
      return `Offline for ${Math.floor(duration / 1000)}s`;
    }
  }

  /**
   * Called when connection is restored
   */
  private onConnectionRestored(): void {
    // Emit event for other services to handle sync
    window.dispatchEvent(new CustomEvent('network-restored'));
  }

  /**
   * Called when connection is lost
   */
  private onConnectionLost(): void {
    // Emit event for other services to handle offline mode
    window.dispatchEvent(new CustomEvent('network-lost'));
  }

  /**
   * Get network information (if available)
   */
  getNetworkInfo(): {
    type?: string;
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
  } {
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;
    
    if (connection) {
      return {
        type: connection.type,
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt
      };
    }
    
    return {};
  }

  /**
   * Check if we should use offline mode for POS operations
   */
  shouldUseOfflineMode(): boolean {
    // Use offline mode if:
    // 1. Actually offline
    // 2. Poor connection quality for more than 10 seconds
    // 3. Recent network instability
    
    if (!this._isOnline()) {
      return true;
    }
    
    if (this._connectionQuality() === 'poor') {
      // If poor connection for more than 10 seconds, go offline
      const offlineDuration = this.getOfflineDuration();
      return offlineDuration > 10000;
    }
    
    return false;
  }

  /**
   * Register for network events
   */
  onNetworkChange(callback: (isOnline: boolean) => void): () => void {
    const handler = (event: Event) => {
      callback(event.type === 'online');
    };

    window.addEventListener('online', handler);
    window.addEventListener('offline', handler);
    window.addEventListener('network-restored', () => callback(true));
    window.addEventListener('network-lost', () => callback(false));

    // Return cleanup function
    return () => {
      window.removeEventListener('online', handler);
      window.removeEventListener('offline', handler);
      window.removeEventListener('network-restored', () => callback(true));
      window.removeEventListener('network-lost', () => callback(false));
    };
  }
}