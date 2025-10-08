import { inject, Injectable } from '@angular/core';
import { Router, NavigationError } from '@angular/router';
import { ChunkErrorService } from './chunk-error.service';

@Injectable({
  providedIn: 'root'
})
export class RouterErrorService {
  private router = inject(Router);
  private chunkErrorService = inject(ChunkErrorService);

  constructor() {
    this.setupRouterErrorHandler();
  }

  private setupRouterErrorHandler(): void {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationError) {
        const error = event.error;
        
        // Check if it's a chunk loading error during navigation
        if (this.isChunkError(error)) {
          console.warn('🧭 Router chunk loading error detected:', error);
          
          // Prevent the navigation error from breaking the app
          event.url && this.handleRouterChunkError(event.url);
        }
      }
    });
  }

  private isChunkError(error: any): boolean {
    if (!error) return false;
    
    const message = error.message || error.toString() || '';
    return (
      message.includes('Failed to fetch dynamically imported module') ||
      message.includes('Loading chunk') ||
      message.includes('ChunkLoadError') ||
      error.name === 'ChunkLoadError'
    );
  }

  private handleRouterChunkError(failedUrl: string): void {
    console.log('🧭 Handling router chunk error for URL:', failedUrl);
    
    // Try to recover using the chunk error service
    this.chunkErrorService.recoverFromChunkError();
  }
}