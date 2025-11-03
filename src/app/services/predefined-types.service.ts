import { Injectable } from '@angular/core';
import { collection, query, where, getDocs, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../firebase.config';
import { OfflineDocumentService } from '../core/services/offline-document.service';

export interface PredefinedType {
  id: string;
  storeId: string;
  typeId: string;
  typeCategory: string;
  typeLabel: string;
  typeDescription: string;
  createdAt: Date;
}

export interface UnitTypeOption {
  value: string;
  label: string;
  description?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PredefinedTypesService {

  constructor(private offlineDocService: OfflineDocumentService) { }

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
   * Get unit types specifically (storeId='global', typeCategory='unitType')
   */
  async getUnitTypes(): Promise<UnitTypeOption[]> {
    try {
      const types = await this.getPredefinedTypes('global', 'unitType');
      return types.map(type => ({
        value: type.typeId,
        label: type.typeLabel,
        description: type.typeDescription
      }));
    } catch (error) {
      console.error('Error fetching unit types:', error);
      // Fallback to hardcoded types if predefined types fail
      return this.getDefaultUnitTypes();
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

  /**
   * Get default unit types as fallback
   */
  private getDefaultUnitTypes(): UnitTypeOption[] {
    return [
      { value: 'pieces', label: 'Pieces', description: 'Individual items or units' },
      { value: 'kg', label: 'Kilograms', description: 'Weight in kilograms' },
      { value: 'grams', label: 'Grams', description: 'Weight in grams' },
      { value: 'liters', label: 'Liters', description: 'Volume in liters' },
      { value: 'ml', label: 'Milliliters', description: 'Volume in milliliters' },
      { value: 'meters', label: 'Meters', description: 'Length in meters' },
      { value: 'cm', label: 'Centimeters', description: 'Length in centimeters' },
      { value: 'boxes', label: 'Boxes', description: 'Packaged in boxes' },
      { value: 'packs', label: 'Packs', description: 'Packaged in packs' },
      { value: 'bottles', label: 'Bottles', description: 'Bottled items' },
      { value: 'cans', label: 'Cans', description: 'Canned items' },
      { value: 'units', label: 'Units', description: 'Generic units' },
      { value: 'N/A', label: 'N/A', description: 'Not Applicable' }
    ];
  }

  /**
   * Get comprehensive unit types including additional ones
   */
  private getComprehensiveUnitTypes(): UnitTypeOption[] {
    return [
      // Basic default unit types
      ...this.getDefaultUnitTypes(),
      // Additional unit types
      { value: 'pounds', label: 'Pounds', description: 'Weight in pounds' },
      { value: 'ounces', label: 'Ounces', description: 'Weight in ounces' },
      { value: 'gallons', label: 'Gallons', description: 'Volume in gallons' },
      { value: 'quarts', label: 'Quarts', description: 'Volume in quarts' },
      { value: 'pints', label: 'Pints', description: 'Volume in pints' },
      { value: 'inches', label: 'Inches', description: 'Length in inches' },
      { value: 'feet', label: 'Feet', description: 'Length in feet' },
      { value: 'yards', label: 'Yards', description: 'Length in yards' },
      { value: 'dozens', label: 'Dozens', description: 'Twelve units' },
      { value: 'gross', label: 'Gross', description: '144 units (12 dozens)' },
      { value: 'pairs', label: 'Pairs', description: 'Two matching items' },
      { value: 'sets', label: 'Sets', description: 'Complete collections' },
      { value: 'rolls', label: 'Rolls', description: 'Rolled items' },
      { value: 'sheets', label: 'Sheets', description: 'Flat items' },
      { value: 'tubes', label: 'Tubes', description: 'Cylindrical containers' },
      { value: 'bags', label: 'Bags', description: 'Items in bags' },
      { value: 'sachets', label: 'Sachets', description: 'Small packets' },
      { value: 'vials', label: 'Vials', description: 'Small bottles' },
      { value: 'ampoules', label: 'Ampoules', description: 'Sealed glass capsules' },
      { value: 'tablets', label: 'Tablets', description: 'Pill form items' },
      { value: 'capsules', label: 'Capsules', description: 'Encapsulated items' },
      { value: 'tons', label: 'Tons', description: 'Weight in tons' },
      { value: 'bales', label: 'Bales', description: 'Large compressed bundles' },
      { value: 'reams', label: 'Reams', description: 'Paper quantity (500 sheets)' },
      { value: 'cartons', label: 'Cartons', description: 'Cardboard containers' }
    ];
  }

  /**
   * Seed default unit types into predefinedTypes collection
   * Call this method once to populate the database with basic unit types
   */
  async seedUnitTypes(): Promise<void> {
    await this.seedUnitTypesToFirestore(false);
  }

  /**
   * Seed comprehensive unit types into predefinedTypes collection
   * Call this method to populate the database with all available unit types
   */
  async seedComprehensiveUnitTypes(): Promise<void> {
    await this.seedUnitTypesToFirestore(true);
  }

  /**
   * Internal method to seed unit types to Firestore
   * @param comprehensive - If true, seeds all unit types; if false, only basic ones
   */
  private async seedUnitTypesToFirestore(comprehensive: boolean = false): Promise<void> {
    try {
      const typeSet = comprehensive ? 'comprehensive' : 'basic';
      console.log(`🌱 Seeding ${typeSet} unit types into predefinedTypes collection...`);
      
      const unitTypesToSeed = comprehensive ? this.getComprehensiveUnitTypes() : this.getDefaultUnitTypes();
      const predefinedTypesRef = collection(db, 'predefinedTypes');
      
      // Check if unit types already exist
      const existingTypes = await this.getPredefinedTypes('global', 'unitType');
      if (existingTypes.length > 0) {
        console.log(`✅ Unit types already exist in database (${existingTypes.length} found). Skipping seed.`);
        return;
      }
      
      // Add each unit type to predefinedTypes collection
      let seedCount = 0;
      for (const unitType of unitTypesToSeed) {
        const docData = {
          storeId: 'global',
          typeId: unitType.value,
          typeCategory: 'unitType',
          typeLabel: unitType.label,
          typeDescription: unitType.description || unitType.label,
          createdAt: new Date()
        };
        
  await this.offlineDocService.createDocument('predefinedTypes', docData);
        seedCount++;
        console.log(`✅ Added unit type: ${unitType.label}`);
      }
      
      console.log(`🎉 ${typeSet} unit types seeded successfully! (${seedCount} types added)`);
    } catch (error) {
      console.error('❌ Error seeding unit types:', error);
      throw error;
    }
  }

  /**
   * Add missing unit types to existing collection
   * This will add any unit types that don't already exist
   */
  async addMissingUnitTypes(comprehensive: boolean = false): Promise<void> {
    try {
      const typeSet = comprehensive ? 'comprehensive' : 'basic';
      console.log(`🔄 Adding missing ${typeSet} unit types to predefinedTypes collection...`);
      
      const targetUnitTypes = comprehensive ? this.getComprehensiveUnitTypes() : this.getDefaultUnitTypes();
      const existingTypes = await this.getPredefinedTypes('global', 'unitType');
      const existingTypeIds = new Set(existingTypes.map(type => type.typeId));
      
      const missingTypes = targetUnitTypes.filter(unitType => !existingTypeIds.has(unitType.value));
      
      if (missingTypes.length === 0) {
        console.log(`✅ All ${typeSet} unit types already exist in database.`);
        return;
      }
      
      const predefinedTypesRef = collection(db, 'predefinedTypes');
      let addedCount = 0;
      
      for (const unitType of missingTypes) {
        const docData = {
          storeId: 'global',
          typeId: unitType.value,
          typeCategory: 'unitType',
          typeLabel: unitType.label,
          typeDescription: unitType.description || unitType.label,
          createdAt: new Date()
        };
        
  await this.offlineDocService.createDocument('predefinedTypes', docData);
        addedCount++;
        console.log(`✅ Added missing unit type: ${unitType.label}`);
      }
      
      console.log(`🎉 Added ${addedCount} missing unit types to database!`);
    } catch (error) {
      console.error('❌ Error adding missing unit types:', error);
      throw error;
    }
  }

  /**
   * Add a new unit type to predefinedTypes collection
   */
  async addUnitType(value: string, label: string, description?: string): Promise<void> {
    try {
      const predefinedTypesRef = collection(db, 'predefinedTypes');
      
      const docData = {
        storeId: 'global',
        typeId: value,
        typeCategory: 'unitType',
        typeLabel: label,
        typeDescription: description || label,
        createdAt: new Date()
      };
      
  await this.offlineDocService.createDocument('predefinedTypes', docData);
      console.log(`✅ Added new unit type: ${label}`);
    } catch (error) {
      console.error('❌ Error adding unit type:', error);
      throw error;
    }
  }
}