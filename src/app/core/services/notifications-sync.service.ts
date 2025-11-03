import { Injectable, inject } from '@angular/core';
import { Firestore, collection, query, where, onSnapshot, Timestamp } from '@angular/fire/firestore';
import { IndexedDBService } from './indexeddb.service';
import { AuthService } from '../../services/auth.service';

@Injectable({ providedIn: 'root' })
export class NotificationsSyncService {
  private firestore = inject(Firestore);
  private indexedDb = inject(IndexedDBService);
  // Lazily resolve auth to avoid potential circular DI
  private authService = inject(AuthService);

  private unsubscribe: (() => void) | null = null;

  constructor() {}

  /**
   * Start listening to Firestore notifications for a specific store.
   * This will persist notifications to IndexedDB (best-effort).
   */
  startListening(storeId: string): void {
    try {
      const notificationsRef = collection(this.firestore as any, 'notifications');
      const q = query(notificationsRef, where('storeId', '==', storeId));

      // Detach any previous listener
      if (this.unsubscribe) {
        try { this.unsubscribe(); } catch (e) {}
        this.unsubscribe = null;
      }

      const unsubscribeFn = onSnapshot(q as any, (snapshot: any) => {
        snapshot.docChanges().forEach((change: any) => {
          try {
            const doc = change.doc;
            const data = doc.data();
            const record = {
              id: doc.id,
              type: data.type || 'user',
              title: data.title || '',
              message: data.message || '',
              storeId: data.storeId || storeId,
              createdAt: data.createdAt || Timestamp.fromDate(new Date()),
              read: !!data.read || false,
              metadata: data.metadata || null
            };

            // Persist to IndexedDB (best-effort)
            this.indexedDb.saveNotification(record).catch((e) => {
              console.warn('NotificationsSyncService: Failed to save notification to IndexedDB', e);
            });
          } catch (err) {
            console.warn('NotificationsSyncService: Error processing notification change', err);
          }
        });
      }, (err: any) => {
        console.warn('NotificationsSyncService: onSnapshot error', err);
      });

      this.unsubscribe = () => unsubscribeFn();
    } catch (error) {
      console.error('NotificationsSyncService: startListening failed', error);
    }
  }

  stopListening(): void {
    if (this.unsubscribe) {
      try { this.unsubscribe(); } catch (e) {}
      this.unsubscribe = null;
    }
  }

  async getUnreadCount(storeId?: string): Promise<number> {
    try {
      return await this.indexedDb.getUnreadNotificationsCount(storeId);
    } catch (e) {
      console.warn('NotificationsSyncService: getUnreadCount failed', e);
      return 0;
    }
  }

  async markAsRead(notificationId: string): Promise<void> {
    try {
      await this.indexedDb.markNotificationRead(notificationId);
    } catch (e) {
      console.warn('NotificationsSyncService: markAsRead failed', e);
    }
  }

  async getNotificationsForStore(storeId: string) {
    try {
      return await this.indexedDb.getNotificationsByStore(storeId);
    } catch (e) {
      console.warn('NotificationsSyncService: getNotificationsForStore failed', e);
      return [];
    }
  }
}
