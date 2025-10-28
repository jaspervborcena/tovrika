# Favorites Field for Products

A lightweight schema addition to support the POS Favorites tab and quick filtering of frequently used items.

## Schema

- Interface: `Product` (in `src/app/interfaces/product.interface.ts`)
- New field:
  - `isFavorite?: boolean` — optional; defaults to `false` when missing.

## Service Mapping

- `ProductService.transformFirestoreDoc` coalesces `isFavorite` to `false` if undefined.
- Create/update operations in `ProductService` accept `isFavorite` and persist it via `OfflineDocumentService`.

## Product Management UI

- In the Add/Edit Product modal (`product-management.component.ts`):
  - Added a checkbox: "⭐ Mark as Favorite (show in POS Favorites tab)" bound to `formControlName="isFavorite"`.
  - Value is saved in both Create and Update flows.

## POS Integration

- POS Favorites tab filters products where `isFavorite === true`.
- If existing products lack the field, they won’t appear in Favorites until toggled on.

## Backward Compatibility

- Field is optional; no migration required.
- Existing products are treated as `isFavorite = false`.

## Notes

- Consider adding a star indicator in products table (optional).
- Future: bulk toggle via list view if needed.
