import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

export interface LogEntry {
  severity: 'DEBUG' | 'INFO' | 'NOTICE' | 'WARNING' | 'ERROR' | 'CRITICAL';
  message: string;
  component: string;
  action: string;
  userId?: string;
  storeId?: string;
  metadata?: Record<string, any>;
  timestamp?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CloudLoggingService {
  private authService = inject(AuthService);
  private http = inject(HttpClient);
  
  // Google Cloud Logging configuration
  private readonly PROJECT_ID = environment.cloudLogging?.projectId || 'jasperpos-1dfd5';
  private readonly LOG_NAME = environment.cloudLogging?.logName || 'pos-application-logs';
  private readonly LOGGING_API_URL = `https://logging.googleapis.com/v2/projects/${this.PROJECT_ID}/logs/${this.LOG_NAME}/entries:write`;
  private readonly LOGGING_ENABLED = environment.cloudLogging?.enabled ?? true;
  
  // Local storage for offline support
  private readonly OFFLINE_LOGS_KEY = environment.cloudLogging?.offlineStorageKey || 'pos_offline_logs';
  private readonly MAX_OFFLINE_LOGS = environment.cloudLogging?.maxOfflineLogs || 1000;
  private isOnline = navigator.onLine;

  constructor() {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.sendOfflineLogs();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  /**
   * Log an event - main logging method
   */
  async logEvent(entry: Omit<LogEntry, 'userId' | 'timestamp'>): Promise<void> {
    try {
      // Skip if logging is disabled
      if (!this.LOGGING_ENABLED) {
        console.log(`🚫 [LOGGING DISABLED] ${entry.component} - ${entry.action}: ${entry.message}`);
        return;
      }

      const currentUser = this.authService.currentUser();
      const enrichedEntry: LogEntry = {
        ...entry,
        userId: currentUser?.uid || 'anonymous',
        timestamp: new Date().toISOString()
      };

      console.log(`🌐 [${entry.severity}] ${entry.component} - ${entry.action}: ${entry.message}`, entry.metadata);

      if (this.isOnline) {
        await this.sendToCloudLogging(enrichedEntry);
      } else {
        this.storeOfflineLog(enrichedEntry);
      }
    } catch (error) {
      console.error('❌ Failed to log event:', error);
      // Fallback to storing offline
      this.storeOfflineLog(entry as LogEntry);
    }
  }

  /**
   * Product Management specific logging methods
   */
  async logProductCreated(productId: string, productName: string, storeId: string, metadata?: any): Promise<void> {
    await this.logEvent({
      severity: 'INFO',
      component: 'ProductManagement',
      action: 'CREATE_PRODUCT',
      message: `Product created: ${productName}`,
      storeId,
      metadata: { productId, productName, ...metadata }
    });
  }

  async logProductUpdated(productId: string, productName: string, storeId: string, changes?: any): Promise<void> {
    await this.logEvent({
      severity: 'INFO',
      component: 'ProductManagement',
      action: 'UPDATE_PRODUCT',
      message: `Product updated: ${productName}`,
      storeId,
      metadata: { productId, productName, changes }
    });
  }

  async logProductDeleted(productId: string, productName: string, storeId: string): Promise<void> {
    await this.logEvent({
      severity: 'WARNING',
      component: 'ProductManagement',
      action: 'DELETE_PRODUCT',
      message: `Product deleted: ${productName}`,
      storeId,
      metadata: { productId, productName }
    });
  }

  async logProductImageUpload(productId: string, imageUrl: string, storeId: string, fileSize?: number): Promise<void> {
    await this.logEvent({
      severity: 'INFO',
      component: 'ProductManagement',
      action: 'UPLOAD_IMAGE',
      message: `Product image uploaded for product: ${productId}`,
      storeId,
      metadata: { productId, imageUrl, fileSize }
    });
  }

  async logProductError(productId: string, action: string, error: string, storeId: string): Promise<void> {
    await this.logEvent({
      severity: 'ERROR',
      component: 'ProductManagement',
      action: `ERROR_${action.toUpperCase()}`,
      message: `Product operation failed: ${error}`,
      storeId,
      metadata: { productId, action, error }
    });
  }

  /**
   * Generic logging methods for other components
   */
  async logInfo(component: string, action: string, message: string, metadata?: any): Promise<void> {
    await this.logEvent({ severity: 'INFO', component, action, message, metadata });
  }

  async logWarning(component: string, action: string, message: string, metadata?: any): Promise<void> {
    await this.logEvent({ severity: 'WARNING', component, action, message, metadata });
  }

  async logError(component: string, action: string, message: string, metadata?: any): Promise<void> {
    await this.logEvent({ severity: 'ERROR', component, action, message, metadata });
  }

  /**
   * Send log entry to Google Cloud Logging
   */
  private async sendToCloudLogging(entry: LogEntry): Promise<void> {
    try {
      const idToken = await this.authService.getFirebaseIdToken();
      if (!idToken) {
        throw new Error('No authentication token available');
      }

      const logPayload = {
        entries: [
          {
            severity: entry.severity,
            textPayload: entry.message,
            labels: {
              component: entry.component,
              action: entry.action,
              userId: entry.userId || 'anonymous',
              storeId: entry.storeId || 'unknown'
            },
            jsonPayload: entry.metadata || {},
            timestamp: entry.timestamp
          }
        ]
      };

      const response = await this.http.post(this.LOGGING_API_URL, logPayload, {
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        }
      }).toPromise();

      console.log('✅ Log sent to Google Cloud Logging');
    } catch (error) {
      console.error('❌ Failed to send log to Google Cloud Logging:', error);
      // Store offline as fallback
      this.storeOfflineLog(entry);
    }
  }

  /**
   * Store log offline for later sync
   */
  private storeOfflineLog(entry: LogEntry): void {
    try {
      const offlineLogs = this.getOfflineLogs();
      
      // Limit offline logs to prevent storage overflow
      if (offlineLogs.length >= this.MAX_OFFLINE_LOGS) {
        offlineLogs.shift(); // Remove oldest log
      }
      
      offlineLogs.push(entry);
      localStorage.setItem(this.OFFLINE_LOGS_KEY, JSON.stringify(offlineLogs));
      console.log('📱 Log stored offline, will sync when online');
    } catch (error) {
      console.error('❌ Failed to store offline log:', error);
    }
  }

  /**
   * Get offline logs from localStorage
   */
  private getOfflineLogs(): LogEntry[] {
    try {
      const logs = localStorage.getItem(this.OFFLINE_LOGS_KEY);
      return logs ? JSON.parse(logs) : [];
    } catch (error) {
      console.error('❌ Failed to retrieve offline logs:', error);
      return [];
    }
  }

  /**
   * Send stored offline logs when back online
   */
  private async sendOfflineLogs(): Promise<void> {
    const offlineLogs = this.getOfflineLogs();
    if (offlineLogs.length === 0) return;

    console.log(`🔄 Syncing ${offlineLogs.length} offline logs...`);

    for (const log of offlineLogs) {
      try {
        await this.sendToCloudLogging(log);
      } catch (error) {
        console.error('❌ Failed to sync offline log:', error);
        // Keep the log for next attempt
        return;
      }
    }

    // Clear offline logs after successful sync
    localStorage.removeItem(this.OFFLINE_LOGS_KEY);
    console.log('✅ All offline logs synced successfully');
  }

  /**
   * Get logs count for monitoring
   */
  getOfflineLogsCount(): number {
    return this.getOfflineLogs().length;
  }

  /**
   * Clear all offline logs (admin function)
   */
  clearOfflineLogs(): void {
    localStorage.removeItem(this.OFFLINE_LOGS_KEY);
    console.log('🧹 Offline logs cleared');
  }
}