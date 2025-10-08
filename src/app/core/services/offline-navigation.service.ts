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
    '/dashboard'      // Dashboard main page (if already loaded)
  ];

  // Define offline fallback routes for problematic routes
  private offlineFallbackRoutes: { [key: string]: string } = {
    '/dashboard/products': '/pos',                    // Products → POS (more relevant offline)
    '/dashboard/overview': '/pos',                    // Overview → POS  
    '/dashboard/stores': '/pos',                      // Stores → POS
    '/dashboard/branches': '/pos',                    // Branches → POS
    '/dashboard/access': '/dashboard',                // Access → Dashboard main
    '/dashboard/user-roles': '/dashboard',            // User roles → Dashboard main
    '/dashboard/invoice-setup': '/pos',               // Invoice setup → POS
    '/dashboard/inventory': '/pos',                   // Inventory → POS
    '/dashboard/sales/summary': '/pos',               // Sales → POS
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

      // We're offline - check if route is safe
      const isRouteSafe = this.offlineSafeRoutes.includes(route);
      
      if (isRouteSafe) {
        console.log(`🧭 OfflineNavigation: Offline safe route - navigating to ${route}`);
        await this.router.navigate([route]);
        return true;
      }

      // Route is not safe offline - find fallback
      const fallbackRoute = this.offlineFallbackRoutes[route] || '/pos';
      console.log(`🧭 OfflineNavigation: Offline unsafe route ${route} - redirecting to ${fallbackRoute}`);
      
      if (showWarning) {
        // Show a user-friendly message about offline limitation
        console.warn(`🧭 OfflineNavigation: Feature "${route}" requires internet connection. Redirecting to ${fallbackRoute}`);
        // You could show a toast notification here if needed
      }
      
      await this.router.navigate([fallbackRoute]);
      return false; // Indicates fallback was used
      
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