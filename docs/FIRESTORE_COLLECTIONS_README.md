# Firestore Collections and Payload Examples

This reference inventories Firestore collection paths referenced by the Angular app, Cloud Functions, and `firestore.rules`. Firestore is schemaless: the JSON below shows representative document shapes based on the current interfaces and write paths, not a complete or server-enforced schema. Optional fields are omitted where practical.

## Reading the examples

- `<...>` values are placeholders. Replace them with real IDs or values.
- Date strings stand in for Firestore `Timestamp` values (or JavaScript `Date` values converted by the SDK); they are not stored as JSON strings in Firestore.
- A document ID is normally the Firestore document ID and is not repeated in the payload unless the application explicitly stores the same ID as a field.
- App code sometimes adds `uid`, `createdBy`, `updatedBy`, sync, or offline fields through shared helpers. The exact fields can therefore vary by write path and legacy document.
- Collection names are case-sensitive. “Active code” means a collection/path is referenced by current app or Cloud Function code; it does not assert that a production database currently contains documents.

## Active app and Cloud Function collections

### Company, store, and access

#### `companies`

Company profiles.

```json
{
  "name": "Example Coffee Co.",
  "slug": "example-coffee",
  "uid": "<uid>",
  "ownerUid": "<uid>",
  "createdAt": "2026-11-16T12:00:00.000Z",
  "updatedAt": "2026-11-16T12:00:00.000Z",
  "email": "owner@example.test",
  "address": "Example address"
}
```

#### `stores`

Store profile, tax/invoice details, and subscription summary fields.

```json
{
  "storeName": "Downtown",
  "storeType": "restaurant",
  "branchName": "Main",
  "address": "Example address",
  "phoneNumber": "+630000000000",
  "email": "store@example.test",
  "companyId": "<companyId>",
  "uid": "<uid>",
  "status": "active",
  "isBirAccredited": false,
  "birDetails": {
    "birPermitNo": "",
    "atpOrOcn": "",
    "inclusiveSerialNumber": "",
    "serialNumber": "",
    "minNumber": "",
    "invoiceType": "",
    "invoiceNumber": "",
    "permitDateIssued": "2026-11-16T12:00:00.000Z",
    "validityNotice": ""
  },
  "tinNumber": "",
  "subscriptionPopupShown": false,
  "createdAt": "2026-11-16T12:00:00.000Z"
}
```

#### `branches`

Branch profile and operating/POS settings.

```json
{
  "uid": "<uid>",
  "companyId": "<companyId>",
  "storeId": "<storeId>",
  "name": "Main Branch",
  "address": {
    "street": "1 Example St",
    "city": "Manila",
    "state": "Metro Manila",
    "zipCode": "1000",
    "country": "Philippines"
  },
  "businessType": "restaurant",
  "isActive": true,
  "assignedUsers": ["<uid>"],
  "settings": {
    "operatingHours": [
      { "dayOfWeek": 1, "isOpen": true, "openTime": "09:00", "closeTime": "18:00" }
    ],
    "contactInfo": { "phone": "+630000000000", "email": "branch@example.test" },
    "posSettings": {
      "enableCustomerDisplay": false,
      "requireSignature": false,
      "allowDiscounts": true,
      "maxDiscountPercent": 20
    }
  },
  "createdAt": "2026-11-16T12:00:00.000Z",
  "updatedAt": "2026-11-16T12:00:00.000Z"
}
```

#### `users`

Application user profile (separate from the Firebase Authentication account).

```json
{
  "uid": "<uid>",
  "email": "user@example.test",
  "displayName": "Example User",
  "status": "active",
  "roleId": "cashier",
  "permissions": [
    { "companyId": "<companyId>", "storeId": "<storeId>", "roleId": "cashier" }
  ],
  "currentCompanyId": "<companyId>",
  "createdAt": "2026-11-16T12:00:00.000Z",
  "updatedAt": "2026-11-16T12:00:00.000Z"
}
```

#### `userRoles`

User-to-role assignment for a company/store. Current rules require `uid` on create; include it even where older helper paths may omit it.

```json
{
  "uid": "<uid>",
  "userId": "<uid>",
  "email": "user@example.test",
  "roleId": "cashier",
  "companyId": "<companyId>",
  "storeId": "<storeId>",
  "createdAt": "2026-11-16T12:00:00.000Z",
  "updatedAt": "2026-11-16T12:00:00.000Z"
}
```

#### `roleDefinition`

Custom role and its permission flags.

```json
{
  "uid": "<uid>",
  "roleId": "supervisor",
  "companyId": "<companyId>",
  "storeId": "<storeId>",
  "permissions": {
    "canViewPOS": true,
    "canAddStore": false,
    "canAddProducts": false,
    "canViewProducts": true,
    "canViewStore": true,
    "canViewInventory": true,
    "canRemoveUsers": false,
    "canAddUser": false,
    "canMakePOS": true,
    "canViewCompanyProfile": true,
    "canEditCompanyProfile": false,
    "canAddCompanyProfile": false,
    "canViewOverview": true
  },
  "createdAt": "2026-11-16T12:00:00.000Z",
  "updatedAt": "2026-11-16T12:00:00.000Z"
}
```

#### `accessRequests`

Requests to join a store using its store code.

```json
{
  "uid": "<uid>",
  "createdBy": "<uid>",
  "email": "user@example.test",
  "requestedRole": "cashier",
  "storeCode": "TOV00ABCD",
  "storeId": "<storeId>",
  "status": "pending",
  "createdAt": "2026-11-16T12:00:00.000Z",
  "updatedAt": "2026-11-16T12:00:00.000Z"
}
```

### Products and inventory

#### `products`

Product catalog and current stock/price summary. Stock-tracked products use FIFO batches in `productInventory`.

```json
{
  "uid": "<uid>",
  "companyId": "<companyId>",
  "storeId": "<storeId>",
  "productName": "Cinnamon Latte",
  "skuId": "LATTE-001",
  "unitType": "pieces",
  "category": "Drinks",
  "totalStock": 24,
  "costPrice": 55,
  "originalPrice": 100,
  "sellingPrice": 110,
  "isStockTracked": true,
  "isVatApplicable": true,
  "vatRate": 12,
  "hasDiscount": false,
  "discountType": "percentage",
  "discountValue": 0,
  "status": "active",
  "createdAt": "2026-11-16T12:00:00.000Z",
  "updatedAt": "2026-11-16T12:00:00.000Z"
}
```

#### `productInventory`

FIFO stock batches. Batch documents also carry ownership, sync, and audit fields in many write paths.

```json
{
  "uid": "<uid>",
  "productId": "<productId>",
  "productName": "Cinnamon Latte",
  "companyId": "<companyId>",
  "storeId": "<storeId>",
  "batchId": "<batchId>",
  "batchNumber": 1,
  "quantity": 24,
  "initialQuantity": 24,
  "totalDeducted": 0,
  "unitPrice": 100,
  "sellingPrice": 110,
  "costPrice": 55,
  "receivedAt": "2026-11-16T12:00:00.000Z",
  "status": "active",
  "isVatApplicable": true,
  "vatRate": 12,
  "hasDiscount": false,
  "discountType": "percentage",
  "discountValue": 0,
  "syncStatus": "SYNCED",
  "isOffline": false,
  "createdAt": "2026-11-16T12:00:00.000Z",
  "updatedAt": "2026-11-16T12:00:00.000Z"
}
```

#### `inventoryTracking`

Inventory movement/audit ledger. Sale snapshots may have `stockMovement: false`; actual FIFO deductions reference the batch.

```json
{
  "eventType": "sale",
  "productId": "<productId>",
  "productName": "Cinnamon Latte",
  "companyId": "<companyId>",
  "storeId": "<storeId>",
  "orderId": "<orderId>",
  "invoiceNumber": "<invoiceNumber>",
  "saleTrackingId": "<ordersSellingTracking document ID>",
  "saleLineIndex": 0,
  "batchId": "<batchId>",
  "refId": "<batchId>",
  "quantity": 1,
  "stockMovement": true,
  "costPrice": 55,
  "createdAt": "2026-11-16T12:00:00.000Z",
  "deductedAt": "2026-11-16T12:00:00.000Z",
  "createdBy": "<uid>",
  "deductedBy": "<uid>"
}
```

#### `ordersSellingTracking`

Sale-line and inventory status tracking. Initial-stock audit rows use `eventType: "INITIAL_STOCK"` and `status: "initial_stock"` rather than representing a sale.

```json
{
  "uid": "<uid>",
  "companyId": "<companyId>",
  "storeId": "<storeId>",
  "orderId": "<orderId>",
  "invoiceNumber": "<invoiceNumber>",
  "itemIndex": 0,
  "productId": "<productId>",
  "itemCode": "LATTE-001",
  "productName": "Cinnamon Latte",
  "skuId": "LATTE-001",
  "status": "completed",
  "isStockTracked": true,
  "quantity": 1,
  "cost": 55,
  "price": 110,
  "total": 110,
  "createdBy": "<uid>",
  "createdAt": "2026-11-16T12:00:00.000Z"
}
```

#### `inventorySaleLocks`

Idempotency record for a processed sale line. The document ID is composed from the order ID, line index, product ID, and item code.

```json
{
  "orderId": "<orderId>",
  "itemIndex": 0,
  "productId": "<productId>",
  "itemCode": "LATTE-001",
  "quantity": 1,
  "trackingId": "<ordersSellingTracking document ID>",
  "createdAt": "2026-11-16T12:00:00.000Z",
  "createdBy": "<uid>"
}
```

#### `inventoryDeductionReversals`

Audit record created when a previous batch deduction is reversed.

```json
{
  "orderId": "<orderId>",
  "batchId": "<batchId>",
  "productId": "<productId>",
  "quantity": 1,
  "reversedAt": "2026-11-16T12:00:00.000Z",
  "reversedBy": "<uid>"
}
```

#### `productSkuReservations`

Reservation documents prevent duplicate SKU creation for a store. The document ID is generated from the store and normalized SKU.

```json
{
  "createdAt": "2026-11-16T12:00:00.000Z"
}
```

### Orders and customers

#### `orders`

Invoice/order summary. Line items are normally saved separately in `orderDetails`.

```json
{
  "uid": "<uid>",
  "companyId": "<companyId>",
  "storeId": "<storeId>",
  "assignedCashierId": "<uid>",
  "invoiceNumber": "<invoiceNumber>",
  "status": "completed",
  "inventoryStatus": "pending",
  "createdAt": "2026-11-16T12:00:00.000Z",
  "atpOrOcn": "",
  "birPermitNo": "",
  "inclusiveSerialNumber": "",
  "message": "Thank you for your purchase",
  "vatAmount": 11.79,
  "vatExemptAmount": 0,
  "discountAmount": 0,
  "grossAmount": 110,
  "netAmount": 110,
  "totalAmount": 110,
  "customerInfo": {
    "uid": "<uid>",
    "customerId": "",
    "fullName": "Walk-in Customer",
    "address": "Philippines",
    "tin": ""
  },
  "payments": {
    "amountTendered": 110,
    "changeAmount": 0,
    "paymentDescription": "Cash Payment",
    "paymentType": "Cash"
  },
  "statusTags": ["completed"]
}
```

#### `orderDetails`

Order line batches (the invoice writer splits large item arrays into batches). `items` contain product, quantity, pricing, VAT, discount, and batch deduction data.

```json
{
  "uid": "<uid>",
  "orderId": "<orderId>",
  "companyId": "<companyId>",
  "storeId": "<storeId>",
  "batchNumber": 1,
  "status": "completed",
  "isOffline": false,
  "syncStatus": "SYNCED",
  "createdBy": "<uid>",
  "updatedBy": "<uid>",
  "items": [
    {
      "productId": "<productId>",
      "itemCode": "LATTE-001",
      "productName": "Cinnamon Latte",
      "quantity": 1,
      "price": 110,
      "total": 110,
      "discount": 0,
      "isVatExempt": false,
      "vat": 11.79,
      "batchDeductions": [],
      "syncStatus": "SYNCED"
    }
  ],
  "subtotal": 98.21,
  "taxAmount": 11.79,
  "discountAmount": 0,
  "totalAmount": 110,
  "createdAt": "2026-11-16T12:00:00.000Z",
  "updatedAt": "2026-11-16T12:00:00.000Z"
}
```

#### `customers`

Customer records created from POS customer information.

```json
{
  "uid": "<uid>",
  "companyId": "<companyId>",
  "storeId": "<storeId>",
  "customerId": "CUST-2026-000001",
  "firstName": "Example",
  "lastName": "Customer",
  "fullName": "Example Customer",
  "email": "customer@example.test",
  "contactNumber": "+630000000000",
  "country": "Philippines",
  "isSeniorCitizen": false,
  "isPWD": false,
  "pointsBalance": 0,
  "createdAt": "2026-11-16T12:00:00.000Z"
}
```

### Configuration and supporting records

#### `categories`

Store-specific product category.

```json
{
  "uid": "<uid>",
  "companyId": "<companyId>",
  "storeId": "<storeId>",
  "categoryId": "drinks",
  "categoryLabel": "Drinks",
  "categoryDescription": "Beverages",
  "categoryGroup": "menu",
  "isActive": true,
  "sortOrder": 1,
  "createdAt": "2026-11-16T12:00:00.000Z",
  "updatedAt": "2026-11-16T12:00:00.000Z"
}
```

#### `productTags`

Product variant/differentiation tag.

```json
{
  "tagId": "size-large",
  "group": "size",
  "label": "Large",
  "value": "large",
  "isActive": true,
  "storeId": "<storeId>",
  "companyId": "<companyId>",
  "uid": "<uid>",
  "createdBy": "<uid>",
  "createdAt": "2026-11-16T12:00:00.000Z"
}
```

The `productTags` rule requires creates to include the authenticated user's UID and creator ID. Note that the global catch-all in `firestore.rules` also grants authenticated users access to unmatched documents, so it must be narrowed separately if creator-only writes are required. After changing Firestore rules, deploy them with `firebase deploy --only firestore:rules`; deploying hosting does not publish rule changes.

#### `predefinedTypes`

Shared or store-specific lookup value used for things such as store types and unit types.

```json
{
  "storeId": "global",
  "typeId": "store_restaurant",
  "typeCategory": "storeType",
  "typeLabel": "Restaurant",
  "typeDescription": "Food and beverage establishment",
  "createdAt": "2026-11-16T12:00:00.000Z"
}
```

#### `devices`

POS terminal and invoice/BIR configuration.

```json
{
  "uid": "<uid>",
  "companyId": "<companyId>",
  "storeId": "<storeId>",
  "deviceLabel": "Front Counter",
  "terminalId": "POS-01",
  "invoicePrefix": "INV",
  "invoiceSeriesStart": 1,
  "invoiceSeriesEnd": 999999,
  "currentInvoiceNumber": 1,
  "serialNumber": "",
  "minNumber": "",
  "birPermitNo": "",
  "atpOrOcn": "",
  "permitDateIssued": "2026-11-16T12:00:00.000Z",
  "vatRegistrationType": "VAT-registered",
  "vatRate": 12,
  "receiptType": "invoice",
  "validityNotice": "",
  "status": "pending",
  "createdAt": "2026-11-16T12:00:00.000Z"
}
```

#### `notifications`

The app has both a richer notification interface and a lightweight store-notification record; fields depend on the producer.

```json
{
  "uid": "<uid>",
  "type": "user",
  "title": "Low stock",
  "message": "Cinnamon Latte is running low.",
  "storeId": "<storeId>",
  "createdAt": "2026-11-16T12:00:00.000Z",
  "read": false,
  "metadata": {
    "productId": "<productId>"
  }
}
```

The richer notification form includes recipient and action metadata:

```json
{
  "uid": "<uid>",
  "title": "Low stock",
  "message": "Cinnamon Latte is running low.",
  "type": "warning",
  "category": "low_stock_alert",
  "recipientType": "store",
  "recipientId": "<storeId>",
  "companyId": "<companyId>",
  "storeId": "<storeId>",
  "createdAt": "2026-11-16T12:00:00.000Z",
  "read": false,
  "priority": "normal",
  "actionType": "restock_product",
  "actionData": {
    "entityId": "<productId>",
    "entityType": "product",
    "url": "/dashboard/inventory",
    "buttonText": "Restock"
  }
}
```

#### `expenseLogs`

Store expense record.

```json
{
  "storeId": "<storeId>",
  "createdBy": "<uid>",
  "createdAt": "2026-11-16T12:00:00.000Z",
  "category": "supplies",
  "description": "Receipt paper",
  "amount": 25000,
  "currency": "PHP",
  "paymentMethod": "cash",
  "paymentDate": "2026-11-16T12:00:00.000Z",
  "tags": ["operations"]
}
```

#### `coupons`

Subscription coupon looked up by `couponCode`.

```json
{
  "couponCode": "WELCOME30",
  "status": "active",
  "validUntil": "2026-12-31T23:59:59.000Z",
  "maxRedemptions": 100,
  "redemptionsUsed": 0,
  "durationDays": 30,
  "description": "30-day subscription offer",
  "appliesTo": {
    "plan": "standard",
    "product": "subscription",
    "discountType": "percentage",
    "discountValue": 100
  },
  "restrictions": {
    "newUsersOnly": true,
    "region": "PH"
  }
}
```

### Subscription, billing, and reconciliation

#### `subscriptions`

Active or trial subscription tied to a company and store. `SubscriptionService` writes the `features` object; the Maya checkout activation path currently creates subscription records without that field.

```json
{
  "subscriptionId": "<subscriptionId>",
  "companyId": "<companyId>",
  "storeId": "<storeId>",
  "uid": "<uid>",
  "planType": "standard",
  "status": "active",
  "startDate": "2026-11-16T12:00:00.000Z",
  "endDate": "2027-11-16T12:00:00.000Z",
  "isTrial": false,
  "features": {
    "maxStores": 1,
    "maxDevicesPerStore": 2,
    "maxProducts": 1000,
    "maxUsers": 5,
    "transactionLimit": 10000,
    "cloudSync": true,
    "birCompliance": true,
    "crmEnabled": false,
    "loyaltyEnabled": false,
    "apiAccess": false,
    "whiteLabel": false
  },
  "paymentMethod": "paymaya",
  "paymentReference": "<paymentReference>",
  "amountPaid": 12000,
  "currency": "PHP",
  "createdAt": "2026-11-16T12:00:00.000Z",
  "updatedAt": "2026-11-16T12:00:00.000Z"
}
```

#### `subscriptionRequests`

Subscription upgrade request, including optional payment and review metadata.

```json
{
  "companyId": "<companyId>",
  "companyName": "Example Coffee Co.",
  "storeId": "<storeId>",
  "storeName": "Downtown",
  "uid": "<uid>",
  "ownerEmail": "owner@example.test",
  "contactPhone": "+630000000000",
  "requestedAt": "2026-11-16T12:00:00.000Z",
  "requestedTier": "standard",
  "notes": "",
  "status": "pending",
  "paymentMethod": "paymaya",
  "currency": "PHP"
}
```

#### `companyBillingHistory`

Payment history record for a company/store.

```json
{
  "companyId": "<companyId>",
  "storeId": "<storeId>",
  "tier": "standard",
  "cycle": "yearly",
  "durationMonths": 12,
  "amount": 12000,
  "discountPercent": 0,
  "finalAmount": 12000,
  "paymentMethod": "paymaya",
  "paidAt": "2026-11-16T12:00:00.000Z",
  "createdAt": "2026-11-16T12:00:00.000Z",
  "updatedAt": "2026-11-16T12:00:00.000Z"
}
```

#### `mayaCheckouts`

Cloud Function checkout state. The document ID is the checkout ID returned by Maya.

```json
{
  "uid": "<uid>",
  "companyId": "<companyId>",
  "storeId": "<storeId>",
  "tier": "standard",
  "durationMonths": 12,
  "amount": 12000,
  "currency": "PHP",
  "email": "owner@example.test",
  "payerName": "Example User",
  "checkoutId": "<checkoutId>",
  "requestReferenceNumber": "<reference>",
  "status": "PENDING",
  "createdAt": "2026-11-16T12:00:00.000Z",
  "updatedAt": "2026-11-16T12:00:00.000Z"
}
```

#### `reconciliationAuditLog`

Audit trail for an inventory reconciliation action in the client.

```json
{
  "orderId": "<orderId>",
  "invoiceNumber": "<invoiceNumber>",
  "storeId": "<storeId>",
  "performedBy": "<uid>",
  "performedByName": "Example User",
  "performedAt": "2026-11-16T12:00:00.000Z",
  "action": "inventory_reprocess",
  "beforeState": {
    "inventoryProcessed": false,
    "needsReconciliation": true
  },
  "afterState": {
    "inventoryProcessed": true,
    "needsReconciliation": false
  },
  "success": true
}
```

## Nested collection paths

#### `companies/{companyId}/stores/{storeId}/branches/{branchId}/transactions/{transactionId}`

Legacy branch transaction record. This nested collection is also queried as a Firestore collection group named `transactions`.

```json
{
  "transactionNumber": "261116-0001",
  "companyId": "<companyId>",
  "storeId": "<storeId>",
  "branchId": "<branchId>",
  "cashierId": "<uid>",
  "items": [
    {
      "productId": "<productId>",
      "name": "Cinnamon Latte",
      "quantity": 1,
      "price": 110,
      "tax": 11.79
    }
  ],
  "subtotal": 98.21,
  "tax": 11.79,
  "total": 110,
  "paymentMethod": "cash",
  "amountTendered": 110,
  "change": 0,
  "status": "completed",
  "createdAt": "2026-11-16T12:00:00.000Z",
  "updatedAt": "2026-11-16T12:00:00.000Z"
}
```

#### `companies/{companyId}/stores/{storeId}/branches/{branchId}/inventory/{productId}`

Legacy branch stock summary, separate from the FIFO `productInventory` batches.

```json
{
  "productId": "<productId>",
  "companyId": "<companyId>",
  "storeId": "<storeId>",
  "branchId": "<branchId>",
  "quantity": 24,
  "minStock": 10,
  "maxStock": 100,
  "lastRestocked": "2026-11-16T12:00:00.000Z",
  "updatedAt": "2026-11-16T12:00:00.000Z"
}
```

## Names present in rules or types without a verified active writer

The following paths appear in `firestore.rules`, or in a type/comment, but no current app or Cloud Function write path was found during this inventory. These may be legacy, externally seeded, or server-managed. Do not treat them as active schemas without confirming their owning process.

| Collection | Evidence / note |
| --- | --- |
| `productInventoryEntries` | Firestore rule and TypeScript interface exist; current FIFO writes use `productInventory`. Interface-derived example: `{"uid":"<uid>","productId":"<productId>","companyId":"<companyId>","storeId":"<storeId>","batchId":"<batchId>","quantity":24,"unitPrice":100,"receivedAt":"2026-11-16T12:00:00.000Z","status":"active"}` |
| `reconciliationLog` | Firestore rule and reconciliation log types exist; no current writer found in `functions/src`. The type includes `companyId`, `date`, `status`, and optional processed items/error. |
| `permissions` | Firestore rule only; no standalone collection writer/type found. User permissions are also stored in the `users` document's `permissions` array. |
| `systemConfig` | Firestore rule only; no canonical payload found. |
| `invoices` | Firestore rule only; current invoice flow writes invoice summaries to `orders` and line batches to `orderDetails`. |
| `invoiceNumbers` | Firestore rule only; current invoice generation updates invoice fields on `stores` and checks `orders`. |
| `counters` | Firestore rule only; no canonical payload found. |
| `roledefinition` | Lowercase path appears in rules only. Active app code uses `roleDefinition`. Firestore collection names are case-sensitive, so these are distinct paths. |
| `test` | A connection probe in `CategoryService`; no document payload is written. Not an application data collection. |

`offline_documents`, cached products, and cached user data belong to the app-managed SQLite/local-storage layer, not Firestore collections. Firebase Authentication users are also separate from Firestore's `users` collection.

## Source references

- Data interfaces: `src/app/interfaces/`
- App collection access: `src/app/services/` and `src/app/core/services/`
- Maya checkout and subscription writes: `functions/src/maya.ts`
- Firestore access rules: `firestore.rules`
