import { Injectable, signal, computed } from '@angular/core';
import { getFirestore, onSnapshot, doc, Unsubscribe } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class NetworkService {
  // Signal for online status (based on Firestore connection)
  private _isOnline = signal<boolean>(true); // Assume online initially
  
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

  // Firestore connection monitor
  private firestoreUnsubscribe?: Unsubscribe;
  private lastFirestoreSuccess: number = Date.now();
  private consecutiveErrors = 0;

  constructor() {
    this.initializeFirestoreConnectionMonitoring();
  }

  /**
   * Initialize Firestore connection monitoring
   * This is the SOURCE OF TRUTH for online/offline status
   */
  private initializeFirestoreConnectionMonitoring(): void {
    try {
      const firestore = getFirestore();
      
      // Create a lightweight connection test document
      // Monitor any document to detect Firestore connection state via metadata
      const connectionTestRef = doc(firestore, '_connection_test_', 'status');
      
      // Listen to Firestore connection state through snapshot listener
      // includeMetadataChanges allows us to detect when we're reading from cache vs server
      this.firestoreUnsubscribe = onSnapshot(
        connectionTestRef,
        { includeMetadataChanges: true },
        (snapshot) => {
          // Check if we're actually connected to Firestore server
          // fromCache = false means we got data from the server (connected)
          // fromCache = true means we're reading from cache only (offline)
          const isConnected = !snapshot.metadata.fromCache;
          
          console.log(`🔥 Firestore: ${isConnected ? 'CONNECTED to server' : 'Reading from CACHE (offline)'}`);
          
          if (isConnected) {
            // Successfully connected to Firestore server
            this.lastFirestoreSuccess = Date.now();
            this.consecutiveErrors = 0;
            
            if (!this._isOnline()) {
              console.log('✅ Firestore: Connection RESTORED');
              this._isOnline.set(true);
              this._lastOnlineAt.set(new Date());
              this._connectionQuality.set('good');
              this.onConnectionRestored();
            }
          } else {
            // Data is from cache only - we're offline
            console.log('📴 Firestore: Working from CACHE (offline detected)');
            
            if (this._isOnline()) {
              this._isOnline.set(false);
              this._connectionQuality.set('offline');
              this.onConnectionLost();
            }
          }
        },
        (error) => {
          // Error callback - Firestore connection failed
          console.log('❌ Firestore: Connection ERROR:', error.message);
          this.consecutiveErrors++;
          
          if (this._isOnline()) {
            this._isOnline.set(false);
            this._connectionQuality.set('offline');
            this.onConnectionLost();
          }
        }
      );
      
      // Also listen to browser online/offline events as additional signal
      window.addEventListener('offline', () => {
        console.log('📡 Browser: Detected offline event');
        if (this._isOnline()) {
          this._isOnline.set(false);
          this._connectionQuality.set('offline');
          this.onConnectionLost();
        }
      });
      
      window.addEventListener('online', () => {
        console.log('📡 Browser: Detected online event');
        // Don't immediately mark as online - let Firestore confirm via snapshot
        this.consecutiveErrors = 0;
      });
      
      // Monitor connection quality based on Firestore response times
      this.startConnectionQualityMonitoring();
      
    } catch (error) {
      console.error('Failed to initialize Firestore connection monitoring:', error);
      // Fallback to navigator.onLine if Firestore init fails
      this._isOnline.set(navigator.onLine);
    }
  }

  /**
   * Monitor connection quality based on Firestore response patterns
   */
  private startConnectionQualityMonitoring(): void {
    setInterval(() => {
      if (!this._isOnline()) {
        this._connectionQuality.set('offline');
        return;
      }
      
      const timeSinceLastSuccess = Date.now() - this.lastFirestoreSuccess;
      
      // Good: Recent successful Firestore operations
      if (timeSinceLastSuccess < 5000) {
        this._connectionQuality.set('good');
      }
      // Poor: Firestore responses are slow or stale
      else if (timeSinceLastSuccess < 15000) {
        this._connectionQuality.set('poor');
      }
      // Offline: No Firestore success for a while
      else {
        this._connectionQuality.set('offline');
        if (this._isOnline()) {
          console.log('🔥 Firestore: Marking offline due to inactivity');
          this._isOnline.set(false);
          this.onConnectionLost();
        }
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Force check online status using Firestore
   */
  async checkOnlineStatus(): Promise<boolean> {
    // Primary check: Is Firestore connection working?
    const firestoreOnline = this._isOnline() && this.consecutiveErrors === 0;
    
    // Secondary check: Browser network status
    const browserOnline = navigator.onLine;
    
    // Both must agree we're online
    const isOnline = firestoreOnline && browserOnline;
    
    if (!isOnline && this._isOnline()) {
      this._isOnline.set(false);
      this._connectionQuality.set('offline');
      this.onConnectionLost();
    }
    
    return isOnline;
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
    console.log('✅ Network: ONLINE (Firestore connected)');
    // Emit event for other services to handle sync
    window.dispatchEvent(new CustomEvent('network-restored'));
  }

  /**
   * Called when connection is lost
   */
  private onConnectionLost(): void {
    console.log('❌ Network: OFFLINE (Firestore disconnected)');
    // Emit event for other services to handle offline mode
    window.dispatchEvent(new CustomEvent('network-lost'));
  }

  /**
   * Cleanup Firestore listener
   */
  ngOnDestroy(): void {
    if (this.firestoreUnsubscribe) {
      this.firestoreUnsubscribe();
    }
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