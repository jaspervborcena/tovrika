import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NetworkService } from './network.service';

@Injectable({
  providedIn: 'root'
})
export class OfflineNavigationService {
  private router = inject(Router);
  private networkService = inject(NetworkService);

  // Define which routes are safe for offline use
  private offlineSafeRoutes = [
    '/pos',           // POS is essential and should work offline
    '/login',         // Login should always work
    '/help',          // Help pages are useful offline
    '/dashboard',     // Dashboard main page (if already loaded)
    '/dashboard/overview', // Overview should be available offline when snapshot exists
    '/dashboard/sales/summary' // Sales summary should be available offline when snapshot exists
  ];

  // Define offline fallback routes for problematic routes
  private offlineFallbackRoutes: { [key: string]: string } = {
    '/dashboard/products': '/pos',                    // Products → POS (more relevant offline)
    '/dashboard/stores': '/pos',                      // Stores → POS
    '/dashboard/branches': '/pos',                    // Branches → POS
    '/dashboard/access': '/dashboard',                // Access → Dashboard main
    '/dashboard/user-roles': '/dashboard',            // User roles → Dashboard main
    '/dashboard/invoice-setup': '/pos',               // Invoice setup → POS
    '/dashboard/inventory': '/pos',                   // Inventory → POS
    // '/dashboard/sales/summary' handled as offline-safe now
    '/notifications': '/dashboard',                   // Notifications → Dashboard main
  };

  /**
   * Navigate safely with offline protection
   * @param route - The route to navigate to
   * @param showWarning - Whether to show offline warning (default: true)
   */
  async navigateSafely(route: string, showWarning: boolean = true): Promise<boolean> {
    try {
      console.log(`🧭 OfflineNavigation: Attempting navigation to ${route}`);
      
      // Check if we're online - if so, navigate normally
      if (this.networkService.isOnline()) {
        console.log(`🧭 OfflineNavigation: Online - navigating to ${route}`);
        await this.router.navigate([route]);
        return true;
      }

      // We're offline - allow navigation but mark the navigation state as offline.
      // This avoids blocking the user from visiting pages they haven't cached yet
      // while enabling components to detect offline state and use IndexedDB fallbacks.
      try {
        console.log(`🧭 OfflineNavigation: Offline - navigating to ${route} with offline state`);
        await this.router.navigate([route], { state: { offline: true } });
        if (showWarning) {
          console.warn(`🧭 OfflineNavigation: You are offline. Some features on ${route} may be limited.`);
        }
        return true;
      } catch (navErr) {
        console.warn(`🧭 OfflineNavigation: Navigation to ${route} failed while offline, attempting fallback`, navErr);
        const fallbackRoute = this.offlineFallbackRoutes[route] || '/pos';
        await this.router.navigate([fallbackRoute]);
        return false;
      }
      
    } catch (error) {
      console.error(`🧭 OfflineNavigation: Navigation failed for ${route}:`, error);
      
      // Ultimate fallback - go to POS which should be most stable
      try {
        console.log(`🧭 OfflineNavigation: Using ultimate fallback - navigating to /pos`);
        await this.router.navigate(['/pos']);
        return false;
      } catch (fallbackError) {
        console.error(`🧭 OfflineNavigation: Even fallback failed:`, fallbackError);
        // Last resort - reload to login
        window.location.href = '/login';
        return false;
      }
    }
  }

  /**
   * Check if a route is safe for offline use
   */
  isRouteSafeOffline(route: string): boolean {
    return this.offlineSafeRoutes.includes(route);
  }

  /**
   * Get the offline fallback route for a given route
   */
  getOfflineFallback(route: string): string {
    return this.offlineFallbackRoutes[route] || '/pos';
  }

  /**
   * Add a route to the offline safe list (useful for testing)
   */
  addOfflineSafeRoute(route: string): void {
    if (!this.offlineSafeRoutes.includes(route)) {
      this.offlineSafeRoutes.push(route);
    }
  }

  /**
   * Set a fallback route for a specific route
   */
  setOfflineFallback(route: string, fallback: string): void {
    this.offlineFallbackRoutes[route] = fallback;
  }
}