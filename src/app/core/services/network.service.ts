import { Injectable, signal, computed } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class NetworkService {
  // Signal to track network status
  private isOnlineSignal = signal<boolean>(navigator.onLine);
  
  // Public readonly computed properties
  readonly isOnline = computed(() => this.isOnlineSignal());
  readonly isOffline = computed(() => !this.isOnlineSignal());
  
  constructor() {
    this.initNetworkListeners();
    this.startPeriodicConnectivityCheck();
  }

  private initNetworkListeners(): void {
    // Listen for browser online/offline events
    window.addEventListener('online', () => {
      console.log('Network: Browser detected online status');
      this.updateNetworkStatus(true);
    });

    window.addEventListener('offline', () => {
      console.log('Network: Browser detected offline status');
      this.updateNetworkStatus(false);
    });
  }

  private startPeriodicConnectivityCheck(): void {
    // Check connectivity every 30 seconds
    setInterval(() => {
      this.checkConnectivity();
    }, 30000);
  }

  private async checkConnectivity(): Promise<void> {
    try {
      // Try to fetch a small resource to verify actual connectivity
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch('/favicon.ico', {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-cache'
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        this.updateNetworkStatus(true);
      } else {
        this.updateNetworkStatus(false);
      }
    } catch (error) {
      console.log('Network: Connectivity check failed:', error);
      this.updateNetworkStatus(false);
    }
  }

  private updateNetworkStatus(isOnline: boolean): void {
    const currentStatus = this.isOnlineSignal();
    if (currentStatus !== isOnline) {
      console.log(`🌐 Network: Status changed from ${currentStatus ? 'ONLINE' : 'OFFLINE'} to ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
      this.isOnlineSignal.set(isOnline);
      
      // Log the current signal value after update
      setTimeout(() => {
        console.log(`🌐 Network: Signal value confirmed as: ${this.isOnlineSignal() ? 'ONLINE' : 'OFFLINE'}`);
      }, 100);
    } else {
      console.log(`🌐 Network: Status unchanged: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
    }
  }

  // Method to manually trigger connectivity check
  async checkNetworkStatus(): Promise<boolean> {
    await this.checkConnectivity();
    return this.isOnlineSignal();
  }

  // Method to manually set offline status for testing
  setOfflineMode(isOffline: boolean): void {
    console.log(`Network: Manually setting ${isOffline ? 'OFFLINE' : 'ONLINE'} mode`);
    this.updateNetworkStatus(!isOffline);
  }

  // Get current status for debugging
  getCurrentStatus(): boolean {
    return this.isOnlineSignal();
  }
}