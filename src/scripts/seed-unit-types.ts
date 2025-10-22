/**
 * Utility script to seed unit types into predefinedTypes collection
 * 
 * Usage in browser console:
 * 1. Navigate to your app
 * 2. Open browser console (F12)
 * 3. Copy and paste this script
 * 4. Call: seedUnitTypes()
 * 
 * Or use the service directly in your component:
 * await this.predefinedTypesService.seedUnitTypes();
 */

// Additional unit types you can add
const ADDITIONAL_UNIT_TYPES = [
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
  { value: 'capsules', label: 'Capsules', description: 'Encapsulated items' }
];

/**
 * Console function to seed default unit types
 */
declare global {
  interface Window {
    seedUnitTypes: () => Promise<void>;
    addCustomUnitType: (value: string, label: string, description?: string) => Promise<void>;
    listUnitTypes: () => Promise<void>;
  }
}

// Make functions available globally for console use
if (typeof window !== 'undefined') {
  window.seedUnitTypes = async () => {
    console.log('🌱 Seeding unit types...');
    try {
      // You would need to inject the service here
      console.log('ℹ️ Please use the component method or service directly');
      console.log('Example: await this.predefinedTypesService.seedUnitTypes()');
    } catch (error) {
      console.error('❌ Error:', error);
    }
  };

  window.addCustomUnitType = async (value: string, label: string, description?: string) => {
    console.log(`🔧 Adding custom unit type: ${label}`);
    try {
      // You would need to inject the service here
      console.log('ℹ️ Please use the component method');
      console.log(`Example: await this.addNewUnitType('${value}', '${label}', '${description}')`);
    } catch (error) {
      console.error('❌ Error:', error);
    }
  };

  window.listUnitTypes = async () => {
    console.log('📋 Available additional unit types you can add:');
    ADDITIONAL_UNIT_TYPES.forEach(unit => {
      console.log(`  ${unit.value}: ${unit.label} (${unit.description})`);
    });
  };
}

export { ADDITIONAL_UNIT_TYPES };