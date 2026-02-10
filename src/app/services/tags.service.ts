import { Injectable } from '@angular/core';
import { 
  Firestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  where,
  orderBy,
  Timestamp 
} from '@angular/fire/firestore';
import { AuthService } from './auth.service';

export interface ProductTag {
  id?: string;
  tagId: string;
  group: string;
  label: string;
  value: string;
  isActive: boolean;
  storeId: string;
  companyId?: string;
  createdAt: Date | Timestamp;
  createdBy: string;
  updatedAt?: Date | Timestamp;
  updatedBy?: string;
}

@Injectable({
  providedIn: 'root'
})
export class TagsService {
  private firestore: Firestore;
  private authService: AuthService;

  constructor(firestore: Firestore, authService: AuthService) {
    this.firestore = firestore;
    this.authService = authService;
  }

  async createTag(tag: Omit<ProductTag, 'id' | 'createdAt' | 'createdBy'>): Promise<string> {
    const currentUser = this.authService.getCurrentUser();
    const currentPermission = this.authService.getCurrentPermission();
    
    const newTag: Omit<ProductTag, 'id'> = {
      ...tag,
      companyId: currentPermission?.companyId || '',
      createdAt: Timestamp.now(),
      createdBy: currentUser?.uid || ''
    };

    try {
      const docRef = await addDoc(collection(this.firestore, 'productTags'), newTag);
      return docRef.id;
    } catch (error) {
      console.error('❌ Failed to create tag:', error);
      // Firestore's native offline persistence handles this automatically
      throw error;
    }
  }

  async updateTag(tagId: string, updates: Partial<ProductTag>): Promise<void> {
    const currentUser = this.authService.getCurrentUser();
    
    const updateData = {
      ...updates,
      updatedAt: Timestamp.now(),
      updatedBy: currentUser?.uid || ''
    };

    try {
      await updateDoc(doc(this.firestore, 'productTags', tagId), updateData);
    } catch (error) {
      console.error('❌ Failed to update tag:', error);
      // Firestore's native offline persistence handles this automatically
      throw error;
    }
  }

  async deleteTag(tagId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'productTags', tagId));
  }

  async getTagsByStore(storeId: string, includeInactive: boolean = false): Promise<ProductTag[]> {
    try {
      let q;
      
      if (includeInactive) {
        // Get all tags regardless of active status
        q = query(
          collection(this.firestore, 'productTags'),
          where('storeId', '==', storeId),
          orderBy('group'),
          orderBy('createdAt', 'asc')
        );
      } else {
        // Get only active tags
        q = query(
          collection(this.firestore, 'productTags'),
          where('storeId', '==', storeId),
          where('isActive', '==', true),
          orderBy('group'),
          orderBy('createdAt', 'asc')
        );
      }

      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        console.log('⚠️ No productTags found for storeId:', storeId);
        // Try a simpler query without orderBy to test
        console.log('🏷️ Attempting fallback query without orderBy...');
        const fallbackQuery = query(
          collection(this.firestore, 'productTags'),
          where('storeId', '==', storeId)
        );
        const fallbackSnapshot = await getDocs(fallbackQuery);
        console.log('🏷️ Fallback query results:', fallbackSnapshot.docs.length, 'tags');
        
        if (fallbackSnapshot.empty) {
          console.log('⚠️ No productTags found even with basic query. Checking if collection exists...');
          const allTagsQuery = collection(this.firestore, 'productTags');
          const allTagsSnapshot = await getDocs(allTagsQuery);
          console.log('🏷️ Total productTags in collection:', allTagsSnapshot.docs.length);
          if (allTagsSnapshot.docs.length > 0) {
            console.log('🏷️ Sample tag document:', allTagsSnapshot.docs[0].data());
          }
        }
        
        return fallbackSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data()['createdAt']?.toDate?.() || doc.data()['createdAt'],
          updatedAt: doc.data()['updatedAt']?.toDate?.() || doc.data()['updatedAt']
        })) as ProductTag[];
      }
      
      const results = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data()['createdAt']?.toDate?.() || doc.data()['createdAt'],
        updatedAt: doc.data()['updatedAt']?.toDate?.() || doc.data()['updatedAt']
      })) as ProductTag[];
      
      return results;
    } catch (error) {
      console.error('❌ Error in getTagsByStore:', error);
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        storeId,
        includeInactive
      });
      return [];
    }
  }

  async getAllTagGroups(storeId: string, includeInactive: boolean = false): Promise<string[]> {
    const tags = await this.getTagsByStore(storeId, includeInactive);
    const groups = new Set(tags.map(tag => tag.group));
    return Array.from(groups).sort();
  }

  generateTagId(group: string, value: string): string {
    return `${group}_${value}`.toLowerCase().replace(/\s+/g, '_');
  }
}
