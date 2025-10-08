import { Injectable, inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { IndexedDBService } from './indexeddb.service';

@Injectable({
  providedIn: 'root'
})
export class FirestoreSecurityService {
  private auth = inject(Auth);
  private indexedDBService = inject(IndexedDBService);

  /**
   * Get the current authenticated user's UID from Firebase Auth or IndexedDB
   * @returns Promise<string | null> - The user's UID or null if not authenticated
   */
  async getCurrentUserUID(): Promise<string | null> {
    // First try Firebase Auth (online)
    const currentUser = this.auth.currentUser;
    if (currentUser?.uid) {
      return currentUser.uid;
    }

    // Fallback to IndexedDB (offline/cached)
    try {
      const offlineUser = await this.indexedDBService.getCurrentUser();
      return offlineUser?.uid || null;
    } catch (error) {
      console.error('❌ Error getting UID from IndexedDB:', error);
      return null;
    }
  }

  /**
   * Get the current authenticated user's UID synchronously (only from Firebase Auth)
   * @returns string | null - The user's UID or null if not authenticated
   */
  getCurrentUserUIDSync(): string | null {
    const currentUser = this.auth.currentUser;
    return currentUser ? currentUser.uid : null;
  }

  /**
   * Add standard security fields to any document data (with IndexedDB support)
   * @param data - The document data to enhance
   * @returns Enhanced data with security fields
   */
  async addSecurityFields<T extends Record<string, any>>(data: T): Promise<T & {
    uid: string;
    createdAt: Date;
    updatedAt: Date;
    createdBy?: string;
    updatedBy?: string;
    isOfflineCreated?: boolean;
  }> {
    const uid = await this.getCurrentUserUID();
    
    if (!uid) {
      throw new Error('User must be authenticated to perform this operation (online or offline)');
    }

    const isOnline = navigator.onLine && this.getCurrentUserUIDSync();
    
    return {
      ...data,
      uid,
      createdBy: uid,
      updatedBy: uid,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...((!isOnline) && { isOfflineCreated: true })
    };
  }

  /**
   * Add update security fields (for update operations, with IndexedDB support)
   * @param data - The document data to enhance
   * @returns Enhanced data with update fields
   */
  async addUpdateSecurityFields<T extends Record<string, any>>(data: T): Promise<T & {
    updatedAt: Date;
    updatedBy?: string;
    lastModifiedOffline?: boolean;
  }> {
    const uid = await this.getCurrentUserUID();
    const isOnline = navigator.onLine && this.getCurrentUserUIDSync();
    
    return {
      ...data,
      updatedAt: new Date(),
      ...(uid && { updatedBy: uid }),
      ...((!isOnline) && { lastModifiedOffline: true })
    };
  }

  /**
   * Validate that the current user can access a document (with IndexedDB support)
   * @param documentUID - The UID associated with the document
   * @returns Promise<boolean> - True if user can access, false otherwise
   */
  async canAccessDocument(documentUID: string): Promise<boolean> {
    const currentUID = await this.getCurrentUserUID();
    return currentUID === documentUID;
  }

  /**
   * Ensure user is authenticated before proceeding (with IndexedDB support)
   * @throws Error if user is not authenticated
   */
  async requireAuthentication(): Promise<string> {
    const uid = await this.getCurrentUserUID();
    
    if (!uid) {
      throw new Error('Authentication required. Please log in to continue.');
    }
    
    return uid;
  }
}