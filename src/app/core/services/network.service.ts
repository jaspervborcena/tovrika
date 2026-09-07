import { Injectable, signal, computed } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class NetworkService {
  private _isOnline = signal<boolean>(navigator.onLine);
  readonly isOffline = computed(() => !this._isOnline());
  readonly isOnline = computed(() => this._isOnline());

  private _connectionQuality = signal<'good' | 'poor' | 'offline'>(navigator.onLine ? 'good' : 'offline');
  readonly connectionQuality = computed(() => this._connectionQuality());

  private _lastOnlineAt = signal<Date | null>(navigator.onLine ? new Date() : null);
  readonly lastOnlineAt = computed(() => this._lastOnlineAt());

  constructor() {
    window.addEventListener('offline', this.handleOffline);
    window.addEventListener('online', this.handleOnline);
  }

  private handleOffline = (): void => {
    console.log('📡 Browser: Detected offline event');
    this.setOnlineState(false);
  };

  private handleOnline = (): void => {
    console.log('📡 Browser: Detected online event');
    this.setOnlineState(true);
  };

  private setOnlineState(isOnline: boolean): void {
    const wasOnline = this._isOnline();
    this._isOnline.set(isOnline);
    this._connectionQuality.set(isOnline ? 'good' : 'offline');

    if (isOnline) {
      this._lastOnlineAt.set(new Date());
      if (!wasOnline) this.onConnectionRestored();
    } else if (wasOnline) {
      this.onConnectionLost();
    }
  }

  setOfflineMode(isOffline: boolean): void {
    console.log(`🧪 Network: Manually setting ${isOffline ? 'OFFLINE' : 'ONLINE'} mode`);
    this.setOnlineState(!isOffline);
  }

  checkConnectivity(): void {
    this.setOnlineState(navigator.onLine);
  }

  getCurrentStatus(): boolean {
    return this._isOnline();
  }

  private onConnectionLost(): void {
    console.log('📴 Network: Connection lost');
  }

  private onConnectionRestored(): void {
    console.log('🌐 Network: Connection restored');
  }

  ngOnDestroy(): void {
    window.removeEventListener('offline', this.handleOffline);
    window.removeEventListener('online', this.handleOnline);
  }
}
