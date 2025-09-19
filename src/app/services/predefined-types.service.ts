import { Injectable } from '@angular/core';
import { collection, query, where, getDocs, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../firebase.config';

export interface PredefinedType {
  id: string;
  storeId: string;
  typeId: string;
  typeCategory: string;
  typeLabel: string;
  typeDescription: string;
  createdAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class PredefinedTypesService {

  constructor() { }

  /**
   * Get predefined types by store ID and category
   * @param storeId - Store ID to filter by (e.g., 'global')
   * @param typeCategory - Type category to filter by (e.g., 'storeType')
   */
  async getPredefinedTypes(storeId: string = 'global', typeCategory?: string): Promise<PredefinedType[]> {
    try {
      const predefinedTypesRef = collection(db, 'predefinedTypes');
      
      // Build query with filters
      let q = query(predefinedTypesRef, where('storeId', '==', storeId));
      
      if (typeCategory) {
        q = query(predefinedTypesRef, 
          where('storeId', '==', storeId),
          where('typeCategory', '==', typeCategory)
        );
      }

      const querySnapshot: QuerySnapshot<DocumentData> = await getDocs(q);
      
      const types: PredefinedType[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        types.push({
          id: doc.id,
          storeId: data['storeId'],
          typeId: data['typeId'],
          typeCategory: data['typeCategory'],
          typeLabel: data['typeLabel'],
          typeDescription: data['typeDescription'],
          createdAt: data['createdAt']?.toDate() || new Date()
        });
      });

      // Sort by typeLabel for consistent ordering
      return types.sort((a, b) => a.typeLabel.localeCompare(b.typeLabel));

    } catch (error) {
      console.error('Error fetching predefined types:', error);
      throw error;
    }
  }

  /**
   * Get store types specifically (storeId='global', typeCategory='storeType')
   */
  async getStoreTypes(): Promise<PredefinedType[]> {
    return this.getPredefinedTypes('global', 'storeType');
  }

  /**
   * Get all categories for a specific store
   */
  async getCategories(storeId: string = 'global'): Promise<string[]> {
    try {
      const types = await this.getPredefinedTypes(storeId);
      const categories = [...new Set(types.map(type => type.typeCategory))];
      return categories.sort();
    } catch (error) {
      console.error('Error fetching categories:', error);
      return [];
    }
  }

  /**
   * Get predefined type by ID
   */
  async getPredefinedTypeById(typeId: string, storeId: string = 'global'): Promise<PredefinedType | null> {
    try {
      const types = await this.getPredefinedTypes(storeId);
      return types.find(type => type.typeId === typeId) || null;
    } catch (error) {
      console.error('Error fetching predefined type by ID:', error);
      return null;
    }
  }
}