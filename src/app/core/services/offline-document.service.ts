import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, doc, setDoc, deleteDoc, DocumentReference } from '@angular/fire/firestore';
import { IndexedDBService } from './indexeddb.service';
import { FirestoreSecurityService } from './firestore-security.service';
import { LoggerService } from './logger.service';
import { logFirestore } from '../utils/firestore-logger';
import { applyCreateTimestamps, applyUpdateTimestamp } from '../utils/firestore-timestamps';
import { serverTimestamp } from 'firebase/firestore';

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
      console.log('🔄 OfflineDocumentService.createDocument starting for:', collectionName);
      console.log('📦 Input data:', data);
      
      // Add security fields (works online/offline with IndexedDB)
      let secureData;
      try {
        secureData = await this.securityService.addSecurityFields(data);
        console.log('✅ Security fields added successfully');
      } catch (securityError) {
        console.error('❌ Failed to add security fields:', securityError);
        throw new Error(`Authentication failed: ${securityError instanceof Error ? securityError.message : 'Unknown auth error'}`);
      }
      
      // Ensure create timestamps are applied. Use serverTimestamp when online; fallback to ISO when offline.
      const timestampedData = applyCreateTimestamps(secureData, navigator.onLine as boolean);
      console.log('⏰ Timestamps applied, final data:', timestampedData);

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
          await this.createOnlineDocumentWithId(collectionName, documentId, timestampedData);
          return documentId;
        });
        const durationMs = Math.round((performance.now?.() ?? Date.now()) - start);
      } else {
        // OFFLINE: Generate temp ID, store locally for later sync
        documentId = this.generateTempDocumentId(collectionName);
  await this.createOfflineDocument(collectionName, documentId, timestampedData);
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
    this.logger.info('Online creation failed, falling back to offline mode', { area: collectionName });
  const secureData = await this.securityService.addSecurityFields(data);
  const timestampedData = applyCreateTimestamps(secureData, false);
    const tempId = this.generateTempDocumentId(collectionName);
  await this.createOfflineDocument(collectionName, tempId, timestampedData);
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
  this.logger.debug('Creating document online', { area: collectionName });
      // Ensure server timestamps for create when writing online
  const toWrite = this.cleanForFirestore(applyCreateTimestamps(data, true));
      const collectionRef = collection(this.firestore, collectionName);
      const start = performance.now?.() ?? Date.now();
      const docRef = await addDoc(collectionRef, toWrite);
      const durationMs = Math.round((performance.now?.() ?? Date.now()) - start);
      this.logger.dbSuccess('Firestore add succeeded', {
        api: 'firestore.add',
        area: collectionName,
        collectionPath: collectionName,
        docId: docRef.id,
        durationMs,
        payload: data
      });
      this.logger.info('Online document created', { area: collectionName, payload: { docId: docRef.id } });
      return docRef.id;
    } catch (error) {
      this.logger.error('Online document creation failed', { area: collectionName }, error);
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
  this.logger.debug('Creating document online with pre-generated ID', { area: collectionName, payload: { docId: documentId } });
      const docRef = doc(this.firestore, collectionName, documentId);
      const start = performance.now?.() ?? Date.now();
  const toWrite = this.cleanForFirestore(applyCreateTimestamps(data, true));
  await setDoc(docRef, toWrite);
      const durationMs = Math.round((performance.now?.() ?? Date.now()) - start);
      this.logger.dbSuccess('Firestore set succeeded', {
        api: 'firestore.set',
        area: collectionName,
        collectionPath: collectionName,
        docId: documentId,
        durationMs,
        payload: data
      });
      this.logger.info('Online document created with pre-generated ID', { area: collectionName, payload: { docId: documentId } });
    } catch (error) {
      this.logger.error('Online document creation with ID failed', { area: collectionName, payload: { docId: documentId } }, error);
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
  this.logger.debug('Creating document offline with ID', { area: collectionName, payload: { docId: documentId } });
      
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
      
      this.logger.info('Offline document created', { area: collectionName, payload: { docId: documentId } });
    } catch (error) {
      this.logger.error('Offline document creation failed', { area: collectionName, payload: { docId: documentId } }, error);
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
  this.logger.debug('Storing offline document', { area: offlineDoc.collectionName, payload: { docId: offlineDoc.id } });
    
    try {
      // Store in IndexedDB using existing service
      // For now, we'll use a simple localStorage approach as fallback
      // TODO: Extend IndexedDBService with pendingDocuments object store
      
      const pendingDocs = this.getPendingDocumentsFromStorage();
      pendingDocs.push(offlineDoc);
      localStorage.setItem('pendingDocuments', JSON.stringify(pendingDocs));
      
      this.logger.dbSuccess('Offline document stored locally', { api: 'offline.store', area: offlineDoc.collectionName, collectionPath: offlineDoc.collectionName, docId: offlineDoc.id, payload: offlineDoc.data });
    } catch (error) {
      this.logger.error('Failed to store offline document', { area: offlineDoc.collectionName, payload: { docId: offlineDoc.id } }, error);
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
      this.logger.error('Failed to get pending documents', { area: 'offline' }, error);
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
      // Ensure updatedAt is set to server timestamp when online
      const timestampedUpdates = applyUpdateTimestamp(secureUpdates, navigator.onLine as boolean);

      if (navigator.onLine && !this.isTempId(documentId)) {
        // ONLINE: Update real document using setDoc with merge
        await this.updateOnlineDocumentWithId(collectionName, documentId, timestampedUpdates);
      } else {
        // OFFLINE: Store update for later sync
        await this.updateOfflineDocument(collectionName, documentId, timestampedUpdates);
      }
    } catch (error) {
      this.logger.error('Document update failed', { area: collectionName, payload: { docId: documentId } }, error);
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
      this.logger.error('Failed to get pending deletes', { area: 'offline' }, error);
      return [];
    }
  }

  /**
   * Update document online with Firebase (legacy - using updateDoc)
   */
  private async updateOnlineDocument(collectionName: string, documentId: string, updates: any): Promise<void> {
    try {
      this.logger.debug('Updating document online', { area: collectionName, payload: { docId: documentId } });
      const docRef = doc(this.firestore, collectionName, documentId);
      const start = performance.now?.() ?? Date.now();
      await setDoc(docRef, this.cleanForFirestore(updates), { merge: true });
      const durationMs = Math.round((performance.now?.() ?? Date.now()) - start);
      this.logger.dbSuccess('Firestore update (merge) succeeded', {
        api: 'firestore.update',
        area: collectionName,
        collectionPath: collectionName,
        docId: documentId,
        durationMs,
        payload: updates
      });
      this.logger.info('Online document updated', { area: collectionName, payload: { docId: documentId } });
    } catch (error) {
      this.logger.error('Online document update failed', { area: collectionName, payload: { docId: documentId } }, error);
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
      this.logger.debug('Updating document online with ID', { area: collectionName, payload: { docId: documentId } });
      const docRef = doc(this.firestore, collectionName, documentId);
      const start = performance.now?.() ?? Date.now();
      await setDoc(docRef, this.cleanForFirestore(updates), { merge: true });
      const durationMs = Math.round((performance.now?.() ?? Date.now()) - start);
      this.logger.dbSuccess('Firestore update (merge) succeeded', {
        api: 'firestore.update',
        area: collectionName,
        collectionPath: collectionName,
        docId: documentId,
        durationMs,
        payload: updates
      });
      this.logger.info('Online document updated with ID', { area: collectionName, payload: { docId: documentId } });
    } catch (error) {
      this.logger.error('Online document update with ID failed', { area: collectionName, payload: { docId: documentId } }, error);
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
  this.logger.debug('Updating document offline', { area: collectionName, payload: { docId: documentId } });
    
    try {
      const pendingDocs = this.getPendingDocumentsFromStorage();
      const docIndex = pendingDocs.findIndex(doc => doc.id === documentId && doc.collectionName === collectionName);
      
      if (docIndex >= 0) {
        // Ensure offline updates contain an ISO updatedAt so UI can show recency
        pendingDocs[docIndex].data = { ...pendingDocs[docIndex].data, ...updates };
        localStorage.setItem('pendingDocuments', JSON.stringify(pendingDocs));
        this.logger.dbSuccess('Queued offline document update', {
          api: 'offline.queue.update',
          area: collectionName,
          collectionPath: collectionName,
          docId: documentId,
          payload: updates
        });
      } else {
        this.logger.warn('Offline document not found for update', { area: collectionName, payload: { docId: documentId } });
      }
    } catch (error) {
      this.logger.error('Failed to update offline document', { area: collectionName, payload: { docId: documentId } }, error);
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
      this.logger.info('Cannot sync - still offline', { area: 'offline' });
      return { synced: 0, failed: 0 };
    }

    this.logger.info('Starting offline document sync', { area: 'offline' });
    
  let synced = 0;
  let failed = 0;

    try {
  const pendingDocs = this.getPendingDocumentsFromStorage();
  const unsyncedDocs = pendingDocs.filter(doc => !doc.synced);

      for (const offlineDoc of unsyncedDocs) {
        try {
          this.logger.debug('Syncing document', { area: offlineDoc.collectionName, payload: { tempId: offlineDoc.tempId } });
          
          // When syncing offline-created documents, replace client timestamps with server timestamps
          try {
            (offlineDoc.data as any)['createdAt'] = serverTimestamp() as any;
            (offlineDoc.data as any)['updatedAt'] = serverTimestamp() as any;
          } catch {}
          // Create document online with real Firestore ID
          const realDocId = await this.createOnlineDocument(offlineDoc.collectionName, offlineDoc.data);
          
          // Mark as synced
          offlineDoc.synced = true;
          offlineDoc.id = realDocId; // Update with real ID
          
          synced++;
          this.logger.info('Document synced', { area: offlineDoc.collectionName, payload: { tempId: offlineDoc.tempId, realId: realDocId } });
        } catch (error) {
          this.logger.error('Failed to sync document', { area: offlineDoc.collectionName, payload: { tempId: offlineDoc.tempId } }, error);
          failed++;
        }
      }

      // Update storage with synced documents
      localStorage.setItem('pendingDocuments', JSON.stringify(pendingDocs));

      // Process pending deletes
      const pendingDeletes = this.getPendingDeletesFromStorage();
      const remainingDeletes: Array<{ id: string; collectionName: string; createdAt: string }> = [];
      for (const del of pendingDeletes) {
        try {
          const ref = doc(this.firestore, del.collectionName, del.id);
          const start = performance.now?.() ?? Date.now();
          await deleteDoc(ref);
          const durationMs = Math.round((performance.now?.() ?? Date.now()) - start);
          this.logger.dbSuccess('Synced offline delete', {
            api: 'firestore.delete',
            area: del.collectionName,
            collectionPath: del.collectionName,
            docId: del.id,
            durationMs
          });
          synced++;
        } catch (error) {
          this.logger.dbFailure('Failed to sync offline delete', {
            api: 'firestore.delete',
            area: del.collectionName,
            collectionPath: del.collectionName,
            docId: del.id
          }, error);
          remainingDeletes.push(del);
          failed++;
        }
      }
      localStorage.setItem('pendingDeletes', JSON.stringify(remainingDeletes));
      
    } catch (error) {
      this.logger.error('Sync process failed', { area: 'offline' }, error);
    }

    this.logger.info('Sync completed', { area: 'offline', payload: { synced, failed } });
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
    this.logger.info('All pending documents cleared', { area: 'offline' });
  }

  /**
   * Remove undefined values from an object recursively.
   * Preserve Date and Firestore sentinel values.
   */
  private cleanForFirestore<T = any>(obj: T): T {
    try {
      if (obj === null || obj === undefined) return obj;
      if (Array.isArray(obj)) return obj.map((v: any) => this.cleanForFirestore(v)) as any;
      if (obj instanceof Date) return obj as any;
      if (typeof obj !== 'object') return obj;
      const out: any = {};
      for (const [k, v] of Object.entries(obj as any)) {
        if (v === undefined) continue; // skip undefined
        // Keep serverTimestamp sentinel (it's an object without toJSON)
        if (v && typeof v === 'object' && !(v instanceof Date)) {
          out[k] = this.cleanForFirestore(v);
        } else {
          out[k] = v;
        }
      }
      return out as T;
    } catch (e) {
      return obj;
    }
  }
}