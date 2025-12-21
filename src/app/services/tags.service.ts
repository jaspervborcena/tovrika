import { Injectable, inject } from '@angular/core';
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

    const docRef = await addDoc(collection(this.firestore, 'productTags'), newTag);
    return docRef.id;
  }

  async updateTag(tagId: string, updates: Partial<ProductTag>): Promise<void> {
    const currentUser = this.authService.getCurrentUser();
    
    const updateData = {
      ...updates,
      updatedAt: Timestamp.now(),
      updatedBy: currentUser?.uid || ''
    };

    await updateDoc(doc(this.firestore, 'productTags', tagId), updateData);
  }

  async deleteTag(tagId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'productTags', tagId));
  }

  async getTagsByStore(storeId: string, includeInactive: boolean = false): Promise<ProductTag[]> {
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
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data()['createdAt']?.toDate?.() || doc.data()['createdAt'],
      updatedAt: doc.data()['updatedAt']?.toDate?.() || doc.data()['updatedAt']
    })) as ProductTag[];
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
