import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, doc, setDoc, deleteDoc, DocumentReference } from '@angular/fire/firestore';
import { IndexedDBService } from './indexeddb.service';
import { FirestoreSecurityService } from './firestore-security.service';
import { LoggerService } from './logger.service';
import { logFirestore } from '../utils/firestore-logger';

export interface OfflineDocument {
  id: string;
  collectionName: string;
  data: any;
  isOffline: boolean;
  tempId?: string;
  synced: boolean;
  createdAt: Date;
  uid: string;
  operation?: 'create' | 'update' | 'delete';
}

@Injectable({
  providedIn: 'root'
})
export class OfflineDocumentService {
  private firestore = inject(Firestore);
  private indexedDBService = inject(IndexedDBService);
  private securityService = inject(FirestoreSecurityService);
  private logger = inject(LoggerService);

  /**
   * Create document with offline/online hybrid approach - ALWAYS pre-generate ID
   * @param collectionName - Firestore collection name
   * @param data - Document data
   * @returns Promise<string> - Document ID (real or temporary)
   */
  async createDocument(collectionName: string, data: any): Promise<string> {
    try {
      // Add security fields (works online/offline with IndexedDB)
      const secureData = await this.securityService.addSecurityFields(data);

      // 🔥 NEW APPROACH: Always generate ID first, then create document
      let documentId: string;
      
      if (navigator.onLine) {
        // ONLINE: Generate real Firestore-compatible ID, then use setDoc()
        documentId = this.generateFirestoreCompatibleId();
        const start = performance.now?.() ?? Date.now();
        await logFirestore(this.logger, {
          api: 'firestore.add',
          area: collectionName,
          collectionPath: collectionName,
          docId: documentId
        }, secureData, async () => {
          await this.createOnlineDocumentWithId(collectionName, documentId, secureData);
          return documentId;
        });
        const durationMs = Math.round((performance.now?.() ?? Date.now()) - start);
      } else {
        // OFFLINE: Generate temp ID, store locally for later sync
        documentId = this.generateTempDocumentId(collectionName);
        await this.createOfflineDocument(collectionName, documentId, secureData);
        // Log offline queue success as a separate event for visibility
        this.logger.dbSuccess('Queued offline document creation', {
          api: 'offline.queue.add',
          area: collectionName,
          collectionPath: collectionName,
          docId: documentId,
          payload: secureData
        });
      }

      return documentId;
      
    } catch (error) {
      // Log Firestore creation failure
      this.logger.dbFailure('Create document failed', {
        api: 'firestore.add',
        area: collectionName,
        collectionPath: collectionName,
        payload: data
      }, error);
      
      // Fallback: If online creation fails, try offline
      if (navigator.onLine) {
        console.log('🔄 Online creation failed, falling back to offline mode...');
        const secureData = await this.securityService.addSecurityFields(data);
        const tempId = this.generateTempDocumentId(collectionName);
        await this.createOfflineDocument(collectionName, tempId, secureData);
        this.logger.dbSuccess('Queued offline document after online failure', {
          api: 'offline.queue.add',
          area: collectionName,
          collectionPath: collectionName,
          docId: tempId,
          payload: secureData
        });
        return tempId;
      }
      
      throw error;
    }
  }

  /**
   * Create document online with Firebase (legacy - using addDoc)
   */
  private async createOnlineDocument(collectionName: string, data: any): Promise<string> {
    try {
      console.log('🌐 Creating document online:', collectionName);
      const collectionRef = collection(this.firestore, collectionName);
      const start = performance.now?.() ?? Date.now();
      const docRef = await addDoc(collectionRef, data);
      const durationMs = Math.round((performance.now?.() ?? Date.now()) - start);
      this.logger.dbSuccess('Firestore add succeeded', {
        api: 'firestore.add',
        area: collectionName,
        collectionPath: collectionName,
        docId: docRef.id,
        durationMs,
        payload: data
      });
      console.log('✅ Online document created with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Online document creation failed:', error);
      this.logger.dbFailure('Firestore add failed', {
        api: 'firestore.add',
        area: collectionName,
        collectionPath: collectionName,
        payload: data
      }, error);
      throw error;
    }
  }

  /**
   * Create document online with pre-generated ID using setDoc
   */
  private async createOnlineDocumentWithId(collectionName: string, documentId: string, data: any): Promise<void> {
    try {
      console.log('🌐 Creating document online with pre-generated ID:', documentId);
      const docRef = doc(this.firestore, collectionName, documentId);
      const start = performance.now?.() ?? Date.now();
      await setDoc(docRef, data);
      const durationMs = Math.round((performance.now?.() ?? Date.now()) - start);
      this.logger.dbSuccess('Firestore set succeeded', {
        api: 'firestore.set',
        area: collectionName,
        collectionPath: collectionName,
        docId: documentId,
        durationMs,
        payload: data
      });
      console.log('✅ Online document created with pre-generated ID:', documentId);
    } catch (error) {
      console.error('❌ Online document creation with ID failed:', error);
      this.logger.dbFailure('Firestore set failed', {
        api: 'firestore.set',
        area: collectionName,
        collectionPath: collectionName,
        docId: documentId,
        payload: data
      }, error);
      throw error;
    }
  }

  /**
   * Create document offline with pre-generated ID
   */
  private async createOfflineDocument(collectionName: string, documentId: string, data: any): Promise<void> {
    try {
      console.log('📱 Creating document offline with ID:', documentId);
      
      // Create offline document record with pre-generated ID
      const offlineDoc: OfflineDocument = {
        id: documentId,
        collectionName,
        data,
        isOffline: true,
        tempId: documentId, // Same as ID for offline docs
        synced: false,
        createdAt: new Date(),
        uid: data.uid || 'unknown'
      };

      // Store in IndexedDB for later sync
      await this.storeOfflineDocument(offlineDoc);
      
      console.log('✅ Offline document created with ID:', documentId);
    } catch (error) {
      console.error('❌ Offline document creation failed:', error);
      throw error;
    }
  }

  /**
   * Generate Firestore-compatible document ID (online mode)
   */
  private generateFirestoreCompatibleId(): string {
    // Generate a Firestore-compatible 20-character ID
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 20; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Generate unique temporary document ID (offline mode)
   */
  private generateTempDocumentId(collectionName: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `temp_${collectionName}_${timestamp}_${random}`;
  }

  /**
   * Store offline document in IndexedDB
   */
  private async storeOfflineDocument(offlineDoc: OfflineDocument): Promise<void> {
    console.log('📦 Storing offline document:', offlineDoc.id);
    
    try {
      // Store in IndexedDB using existing service
      // For now, we'll use a simple localStorage approach as fallback
      // TODO: Extend IndexedDBService with pendingDocuments object store
      
      const pendingDocs = this.getPendingDocumentsFromStorage();
      pendingDocs.push(offlineDoc);
      localStorage.setItem('pendingDocuments', JSON.stringify(pendingDocs));
      
      console.log('✅ Offline document stored successfully');
    } catch (error) {
      console.error('❌ Failed to store offline document:', error);
      throw error;
    }
  }

  /**
   * Get pending documents from localStorage (temporary solution)
   */
  private getPendingDocumentsFromStorage(): OfflineDocument[] {
    try {
      const stored = localStorage.getItem('pendingDocuments');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('❌ Failed to get pending documents:', error);
      return [];
    }
  }

  /**
   * Update document with offline/online hybrid approach
   * @param collectionName - Firestore collection name
   * @param documentId - Document ID (real or temporary)
   * @param updates - Update data
   */
  async updateDocument(collectionName: string, documentId: string, updates: any): Promise<void> {
    try {
      // Add update security fields
      const secureUpdates = await this.securityService.addUpdateSecurityFields(updates);

      if (navigator.onLine && !this.isTempId(documentId)) {
        // ONLINE: Update real document using setDoc with merge
        await this.updateOnlineDocumentWithId(collectionName, documentId, secureUpdates);
      } else {
        // OFFLINE: Store update for later sync
        await this.updateOfflineDocument(collectionName, documentId, secureUpdates);
      }
    } catch (error) {
      console.error('❌ Document update failed:', error);
      throw error;
    }
  }

  /**
   * Delete document with online/offline handling
   */
  async deleteDocument(collectionName: string, documentId: string): Promise<void> {
    try {
      if (this.isTempId(documentId)) {
        // Remove from pending offline documents if exists
        const pendingDocs = this.getPendingDocumentsFromStorage();
        const next = pendingDocs.filter(d => !(d.id === documentId && d.collectionName === collectionName));
        localStorage.setItem('pendingDocuments', JSON.stringify(next));
        this.logger.dbSuccess('Removed pending offline document (delete temp)', {
          api: 'offline.queue.delete',
          area: collectionName,
          collectionPath: collectionName,
          docId: documentId
        });
        return;
      }

      if (navigator.onLine) {
        // Online delete
        const ref = doc(this.firestore, collectionName, documentId);
        await logFirestore(this.logger, {
          api: 'firestore.delete',
          area: collectionName,
          collectionPath: collectionName,
          docId: documentId
        }, { id: documentId }, async () => {
          await deleteDoc(ref);
          return true;
        });
        return;
      }

      // Offline real ID: queue for later processing
      const pendingDeletes = this.getPendingDeletesFromStorage();
      pendingDeletes.push({ id: documentId, collectionName, createdAt: new Date().toISOString() });
      localStorage.setItem('pendingDeletes', JSON.stringify(pendingDeletes));
      this.logger.dbSuccess('Queued offline delete', {
        api: 'offline.queue.delete',
        area: collectionName,
        collectionPath: collectionName,
        docId: documentId
      });
    } catch (error) {
      this.logger.dbFailure('Delete document failed', {
        api: 'firestore.delete',
        area: collectionName,
        collectionPath: collectionName,
        docId: documentId
      }, error);
      throw error;
    }
  }

  private getPendingDeletesFromStorage(): Array<{ id: string; collectionName: string; createdAt: string }> {
    try {
      const stored = localStorage.getItem('pendingDeletes');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('❌ Failed to get pending deletes:', error);
      return [];
    }
  }

  /**
   * Update document online with Firebase (legacy - using updateDoc)
   */
  private async updateOnlineDocument(collectionName: string, documentId: string, updates: any): Promise<void> {
    try {
      console.log('🌐 Updating document online:', documentId);
      const docRef = doc(this.firestore, collectionName, documentId);
      const start = performance.now?.() ?? Date.now();
      await setDoc(docRef, updates, { merge: true });
      const durationMs = Math.round((performance.now?.() ?? Date.now()) - start);
      this.logger.dbSuccess('Firestore update (merge) succeeded', {
        api: 'firestore.update',
        area: collectionName,
        collectionPath: collectionName,
        docId: documentId,
        durationMs,
        payload: updates
      });
      console.log('✅ Online document updated:', documentId);
    } catch (error) {
      console.error('❌ Online document update failed:', error);
      this.logger.dbFailure('Firestore update (merge) failed', {
        api: 'firestore.update',
        area: collectionName,
        collectionPath: collectionName,
        docId: documentId,
        payload: updates
      }, error);
      throw error;
    }
  }

  /**
   * Update document online with pre-generated ID using setDoc with merge
   */
  private async updateOnlineDocumentWithId(collectionName: string, documentId: string, updates: any): Promise<void> {
    try {
      console.log('🌐 Updating document online with ID:', documentId);
      const docRef = doc(this.firestore, collectionName, documentId);
      const start = performance.now?.() ?? Date.now();
      await setDoc(docRef, updates, { merge: true });
      const durationMs = Math.round((performance.now?.() ?? Date.now()) - start);
      this.logger.dbSuccess('Firestore update (merge) succeeded', {
        api: 'firestore.update',
        area: collectionName,
        collectionPath: collectionName,
        docId: documentId,
        durationMs,
        payload: updates
      });
      console.log('✅ Online document updated with ID:', documentId);
    } catch (error) {
      console.error('❌ Online document update with ID failed:', error);
      this.logger.dbFailure('Firestore update (merge) failed', {
        api: 'firestore.update',
        area: collectionName,
        collectionPath: collectionName,
        docId: documentId,
        payload: updates
      }, error);
      throw error;
    }
  }

  /**
   * Update document offline
   */
  private async updateOfflineDocument(collectionName: string, documentId: string, updates: any): Promise<void> {
    console.log('📱 Updating document offline:', documentId);
    
    try {
      const pendingDocs = this.getPendingDocumentsFromStorage();
      const docIndex = pendingDocs.findIndex(doc => doc.id === documentId && doc.collectionName === collectionName);
      
      if (docIndex >= 0) {
        // Update existing offline document
        pendingDocs[docIndex].data = { ...pendingDocs[docIndex].data, ...updates };
        localStorage.setItem('pendingDocuments', JSON.stringify(pendingDocs));
        console.log('✅ Offline document updated:', documentId);
        this.logger.dbSuccess('Queued offline document update', {
          api: 'offline.queue.update',
          area: collectionName,
          collectionPath: collectionName,
          docId: documentId,
          payload: updates
        });
      } else {
        console.warn('⚠️ Offline document not found for update:', documentId);
      }
    } catch (error) {
      console.error('❌ Failed to update offline document:', error);
      this.logger.dbFailure('Queued offline document update failed', {
        api: 'offline.queue.update',
        area: collectionName,
        collectionPath: collectionName,
        docId: documentId,
        payload: updates
      }, error);
      throw error;
    }
  }

  /**
   * Check if document ID is temporary
   */
  private isTempId(documentId: string): boolean {
    return documentId.startsWith('temp_');
  }

  /**
   * Sync pending offline documents when online
   */
  async syncOfflineDocuments(): Promise<{ synced: number; failed: number }> {
    if (!navigator.onLine) {
      console.log('📱 Cannot sync - still offline');
      return { synced: 0, failed: 0 };
    }

    console.log('🔄 Starting offline document sync...');
    
    let synced = 0;
    let failed = 0;

    try {
      const pendingDocs = this.getPendingDocumentsFromStorage();
      const unsyncedDocs = pendingDocs.filter(doc => !doc.synced);

      for (const offlineDoc of unsyncedDocs) {
        try {
          console.log('🔄 Syncing document:', offlineDoc.id);
          
          // Create document online with real Firestore ID
          const realDocId = await this.createOnlineDocument(offlineDoc.collectionName, offlineDoc.data);
          
          // Mark as synced
          offlineDoc.synced = true;
          offlineDoc.id = realDocId; // Update with real ID
          
          synced++;
          console.log('✅ Document synced:', offlineDoc.tempId, '→', realDocId);
        } catch (error) {
          console.error('❌ Failed to sync document:', offlineDoc.id, error);
          failed++;
        }
      }

      // Update storage with synced documents
      localStorage.setItem('pendingDocuments', JSON.stringify(pendingDocs));
      
    } catch (error) {
      console.error('❌ Sync process failed:', error);
    }

    console.log(`✅ Sync completed: ${synced} synced, ${failed} failed`);
    return { synced, failed };
  }

  /**
   * Get document ID status (real vs temporary)
   */
  getDocumentStatus(documentId: string): { isTemp: boolean; needsSync: boolean } {
    const isTemp = this.isTempId(documentId);
    return {
      isTemp,
      needsSync: isTemp && navigator.onLine
    };
  }

  /**
   * Get all pending offline documents (for debugging)
   */
  getPendingDocuments(): OfflineDocument[] {
    return this.getPendingDocumentsFromStorage();
  }

  /**
   * Clear all pending documents (for testing)
   */
  clearPendingDocuments(): void {
    localStorage.removeItem('pendingDocuments');
    console.log('🗑️ All pending documents cleared');
  }
}