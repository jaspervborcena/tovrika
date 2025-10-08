import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class ChunkErrorService {
  private hasReloaded = false;

  constructor(private router: Router) {
    this.setupChunkErrorHandler();
  }

  private setupChunkErrorHandler(): void {
    // Handle chunk loading errors globally
    window.addEventListener('error', (event) => {
      const error = event.error || event;
      
      // Check if it's a chunk loading error
      if (this.isChunkLoadError(error) || this.isChunkLoadError(event)) {
        console.warn('🔄 Chunk loading error detected, attempting recovery...', error);
        this.handleChunkError();
      }
    });

    // Handle unhandled promise rejections (for dynamic imports)
    window.addEventListener('unhandledrejection', (event) => {
      if (this.isChunkLoadError(event.reason)) {
        console.warn('🔄 Dynamic import chunk error detected, attempting recovery...', event.reason);
        event.preventDefault(); // Prevent the error from showing to user
        this.handleChunkError();
      }
    });
  }

  private isChunkLoadError(error: any): boolean {
    if (!error) return false;
    
    const message = error.message || error.toString() || '';
    const stack = error.stack || '';
    
    // Check for various chunk loading error patterns
    return (
      message.includes('Failed to fetch dynamically imported module') ||
      message.includes('Loading chunk') ||
      message.includes('Loading CSS chunk') ||
      message.includes('ChunkLoadError') ||
      stack.includes('chunk') ||
      (error.name === 'ChunkLoadError')
    );
  }

  private handleChunkError(): void {
    if (this.hasReloaded) {
      console.error('❌ Chunk error persists after reload. Manual intervention needed.');
      this.showUserFriendlyError();
      return;
    }

    console.log('🔄 Attempting to recover from chunk loading error...');
    
    // Mark that we've attempted a reload
    this.hasReloaded = true;
    
    // Clear potential cached chunks and reload
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      }).finally(() => {
        this.performReload();
      });
    } else {
      this.performReload();
    }
  }

  private performReload(): void {
    // Add a small delay to avoid immediate reload loops
    setTimeout(() => {
      console.log('🔄 Reloading application to fetch latest chunks...');
      window.location.reload();
    }, 100);
  }

  private showUserFriendlyError(): void {
    // Show user-friendly error message
    const message = `
      The application needs to be refreshed to load the latest updates.
      Please refresh your browser (Ctrl+F5 or Cmd+Shift+R) to continue.
    `;
    
    if (confirm(message + '\n\nWould you like to refresh now?')) {
      window.location.reload();
    }
  }

  // Public method to manually trigger chunk error recovery
  public recoverFromChunkError(): void {
    this.hasReloaded = false; // Reset the flag
    this.handleChunkError();
  }
}