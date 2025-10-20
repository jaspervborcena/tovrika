# Unit Types Implementation Guide

## Overview
Unit types are now stored in the `predefinedTypes` Firestore collection with `typeCategory: 'unitType'` instead of being hardcoded. This provides flexibility to add new unit types without code changes.

## Database Structure
```typescript
// predefinedTypes collection document
{
  id: "auto-generated-doc-id",
  storeId: "global",           // Global for all stores
  typeId: "pieces",            // The value used in forms
  typeCategory: "unitType",    // Category to identify unit types
  typeLabel: "Pieces",         // Display label
  typeDescription: "Individual items or units", // Description
  createdAt: Date
}
```

## Automatic Setup
The system automatically:
1. **Loads unit types** from `predefinedTypes` collection on component init
2. **Seeds default unit types** if none exist in the database
3. **Falls back to hardcoded types** if database fails

## Default Unit Types Included
- **pieces** - Individual items or units
- **kg** - Weight in kilograms  
- **grams** - Weight in grams
- **liters** - Volume in liters
- **ml** - Volume in milliliters
- **meters** - Length in meters
- **cm** - Length in centimeters
- **boxes** - Packaged in boxes
- **packs** - Packaged in packs
- **bottles** - Bottled items
- **cans** - Canned items
- **units** - Generic units

## Adding New Unit Types

### Method 1: Using the Component Method
```typescript
// In your component, call:
await this.addNewUnitType('cubic_meters', 'Cubic Meters', 'Volume in cubic meters');
```

### Method 2: Using the Service Directly
```typescript
// Inject PredefinedTypesService and call:
await this.predefinedTypesService.addUnitType('pounds', 'Pounds', 'Weight in pounds');
```

### Method 3: Browser Console (for testing)
1. Open your app in browser
2. Open Developer Console (F12)
3. Run:
```javascript
// List available additional unit types
window.listUnitTypes();

// Add a custom unit type (replace with your component reference)
await yourComponent.addNewUnitType('gallons', 'Gallons', 'Volume in gallons');
```

## Usage in Forms
The dropdown automatically displays all unit types from the database:

```html
<select formControlName="unitType">
  <option *ngFor="let unit of unitTypes" [value]="unit.value">{{ unit.label }}</option>
</select>
```

## Additional Unit Types Available
See `src/scripts/seed-unit-types.ts` for a comprehensive list of additional unit types you can add, including:
- Weight: pounds, ounces
- Volume: gallons, quarts, pints  
- Length: inches, feet, yards
- Packaging: dozens, gross, pairs, sets, rolls, sheets, tubes, bags
- Medical: vials, ampoules, tablets, capsules

## Database Seeding
To manually seed all default unit types:
```typescript
await this.predefinedTypesService.seedUnitTypes();
```

This will only add unit types if none exist in the database (prevents duplicates).

## Error Handling
- If database fails, falls back to basic hardcoded unit types
- Console logs provide clear feedback on loading/seeding operations
- Toast notifications inform users of successful additions

## Benefits
1. **No code deployment** needed to add new unit types
2. **Centralized management** via database
3. **Consistent across all stores** (global scope)
4. **Automatic fallback** ensures reliability
5. **Easy extension** for future needs