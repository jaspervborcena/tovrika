# Print Quality Improvements for Mobile Receipt

## Issue Resolved
Print output was appearing blurry, low ink, or unclear on thermal printer.

## Changes Made

### 1. **Font Settings Improved**
**Before:**
```
\x1B\x21\x01  // Small font
\x1B\x4D\x01  // Font B (smaller, less clear)
\x0F          // Condensed printing
```

**After:**
```
\x1D\x21\x00  // Normal font size (not condensed)
\x1B\x4D\x00  // Font A (clearer, more readable)
\x1B\x7B\x32  // Increased print density for darker text
```

### 2. **Store Name - Larger & Bolder**
```
\x1D\x21\x11  // Double height AND double width
\x1B\x45\x01  // Bold
```
Makes store name very prominent and easy to read.

### 3. **Invoice Type - Enhanced**
```
\x1D\x21\x01  // Double height
\x1B\x45\x01  // Bold
```
"SALES INVOICE" text is now larger and bolder.

### 4. **Important Sections - Bold**
Now using bold (`\x1B\x45\x01`) for:
- ✅ Payment method (Cash/Charge)
- ✅ SOLD TO section
- ✅ Cashier and date
- ✅ Items header
- ✅ Each item line
- ✅ All totals (Subtotal, VAT, Discount)

### 5. **Total Amount - Extra Large**
```
\x1D\x21\x11  // Double height AND double width
\x1B\x45\x01  // Bold
```
The final total is now DOUBLE SIZE and BOLD for maximum visibility.

### 6. **Preview Display Enhanced**
Updated CSS for better preview:
```css
font-size: 12px;        // Increased from 11px
line-height: 1.3;       // Increased from 1.2
font-weight: 500;       // Medium weight for clarity
letter-spacing: 0.3px;  // Better character spacing
```

## ESC/POS Command Reference

| Command | Effect |
|---------|--------|
| `\x1B\x40` | Initialize printer |
| `\x1D\x21\x00` | Normal size |
| `\x1D\x21\x01` | Double height |
| `\x1D\x21\x11` | Double height & width |
| `\x1B\x45\x01` | Bold ON |
| `\x1B\x45\x00` | Bold OFF |
| `\x1B\x4D\x00` | Font A (clear) |
| `\x1B\x4D\x01` | Font B (smaller) |
| `\x1B\x7B\x32` | Increase print density |
| `\x1B\x61\x01` | Center alignment |
| `\x1B\x61\x00` | Left alignment |

## Print Density
Added `\x1B\x7B\x32` command to increase print density, which:
- Makes text darker
- Improves readability
- Reduces "faded" appearance
- Better for aging thermal paper

## Visual Hierarchy

### Before (Small & Light):
```
Store Name
Address
--------------------------------
Item 1                     10.00
Item 2                     20.00
--------------------------------
TOTAL:                     30.00
```

### After (Clear & Bold):
```
🔲🔲 STORE NAME 🔲🔲  (Double size, bold)
Address
--------------------------------
💪 Cash: ● Charge: ○  (Bold)
💪 SOLD TO: Customer  (Bold)
--------------------------------
💪 Cashier: John Doe  (Bold)
💪 01/12/2025 10:30 AM  (Bold)
--------------------------------
💪 Qty Product Name    Total  (Bold header)
💪 1   Item 1          10.00  (Bold items)
💪 2   Item 2          20.00  (Bold items)
--------------------------------
💪 Subtotal:           30.00  (Bold)
💪 VAT (12%):           3.60  (Bold)
💪 Discount:            0.00  (Bold)
================================
🔲🔲 TOTAL: 33.60 🔲🔲  (DOUBLE SIZE, BOLD)
================================
```

## Testing Checklist

- [x] Increased font size from small to normal
- [x] Changed from Font B to Font A (clearer)
- [x] Added print density command for darker text
- [x] Made store name double size and bold
- [x] Made invoice type larger and bold
- [x] Made payment method bold
- [x] Made sold to section bold
- [x] Made cashier/date bold
- [x] Made item lines bold
- [x] Made all totals bold
- [x] Made final TOTAL double size and bold
- [x] Updated preview display font size

## Expected Results

### Print Quality:
- ✅ Text is darker and more legible
- ✅ Important information stands out (bold)
- ✅ Store name and total are very prominent
- ✅ Less "faded" or "light" appearance
- ✅ Better readability at arm's length

### Receipt Appearance:
- 📝 Professional and clear
- 📝 Easy to identify key information
- 📝 Good visual hierarchy
- 📝 Suitable for business use

## If Still Blurry

### Printer-Side Adjustments:
1. **Check Thermal Paper Quality**
   - Use high-quality thermal paper
   - Avoid old or faded paper
   - Check expiration date on paper roll

2. **Clean Print Head**
   - Use thermal printer cleaning card
   - Or isopropyl alcohol (90%+) with lint-free cloth
   - Gently wipe print head

3. **Adjust Print Density (if supported)**
   - Some printers have hardware density adjustment
   - Check printer manual or settings

4. **Check Printer Driver Settings**
   - Some printers have density/darkness settings
   - Adjust in Bluetooth printer settings on Android

5. **Battery Level**
   - Low battery can cause faded prints
   - Fully charge printer

## Additional ESC/POS Commands Available

If needed, we can add:
```
\x1B\x7B\x64  // Even higher density (experiment carefully)
\x1D\x21\x22  // Quadruple height & double width
\x1B\x21\x30  // Emphasized + double height
```

## Files Modified
- `src/app/services/print.service.ts` - ESC/POS commands
- `src/app/pages/dashboard/pos/mobile/mobile-receipt-preview.component.ts` - Preview styling
