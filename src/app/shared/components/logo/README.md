# Tovrika Logo Component

## Overview
The `LogoComponent` is a centralized, reusable component for displaying the official Tovrika logo throughout the application. It provides consistent branding and multiple configuration options.

## Usage

### Basic Usage
```html
<app-logo></app-logo>
```

### Advanced Usage
```html
<app-logo 
  size="lg" 
  [showText]="true" 
  theme="primary"
  alignment="center"
  [clickable]="true"
  companyName="Tovrika">
</app-logo>
```

## Props

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl' \| 'custom'` | `'md'` | Size of the logo |
| `variant` | `'full' \| 'icon' \| 'text'` | `'full'` | Logo variant (currently only 'full' is implemented) |
| `theme` | `'light' \| 'dark' \| 'primary'` | `'light'` | Color theme for the text |
| `alignment` | `'start' \| 'center' \| 'end'` | `'start'` | Alignment of the logo container |
| `showText` | `boolean` | `true` | Whether to show the company name text |
| `clickable` | `boolean` | `false` | Whether the logo should have hover effects |
| `companyName` | `string` | `'Tovrika'` | Company name to display |
| `customWidth` | `string` | `''` | Custom width (use with size="custom") |
| `customHeight` | `string` | `''` | Custom height (use with size="custom") |
| `responsive` | `boolean` | `true` | Whether to enable responsive behavior |
| `background` | `'none' \| 'white' \| 'light' \| 'rounded' \| 'circle'` | `'white'` | Background style for the logo image |

## Size Options

### Predefined Sizes
- **sm**: 24x24px
- **md**: 32x32px (default)
- **lg**: 48x48px
- **xl**: 64x64px
- **custom**: Use customWidth and customHeight props

### Text Sizes (matches logo sizes)
- **sm**: 0.875rem (14px)
- **md**: 1rem (16px)
- **lg**: 1.25rem (20px)
- **xl**: 1.5rem (24px)

## Theme Options

### Text Themes
- **light**: Dark text (#1a202c) - for light backgrounds
- **dark**: White text (#ffffff) - for dark backgrounds  
- **primary**: Primary brand color (#667eea)

### Background Options
- **none**: No background (transparent)
- **white**: White background with subtle shadow and padding
- **light**: Light gray background with border
- **rounded**: White background with rounded corners and shadow
- **circle**: Circular white background with shadow

> **Note**: For transparent logos, use `background="white"` or `background="rounded"` for better visibility.

## Examples

### Header Logo
```html
<app-logo 
  size="md" 
  [showText]="true" 
  theme="light" 
  background="white"
  [clickable]="true">
</app-logo>
```

### Login Page Logo
```html
<app-logo 
  size="lg" 
  [showText]="false" 
  theme="primary" 
  alignment="center"
  background="rounded">
</app-logo>
```

### Small Navigation Logo
```html
<app-logo 
  size="sm" 
  [showText]="false" 
  background="light"
  [clickable]="true">
</app-logo>
```

### Transparent Logo (No Background)
```html
<app-logo 
  size="md" 
  [showText]="true" 
  background="none">
</app-logo>
```

### Circular Logo
```html
<app-logo 
  size="lg" 
  [showText]="false" 
  background="circle" 
  alignment="center">
</app-logo>
```

### Custom Size Logo
```html
<app-logo 
  size="custom" 
  customWidth="100px" 
  customHeight="100px" 
  [showText]="true" 
  theme="primary">
</app-logo>
```

## Responsive Behavior

When `responsive="true"` (default), the logo automatically scales down on mobile devices:
- lg → md size on mobile
- xl → lg size on mobile
- Text sizes scale down accordingly

## Asset Requirements

The component expects the logo image to be located at:
```
/assets/tovrika_logo.png
```

Make sure this file exists in your assets folder.

## Styling

The component includes built-in styles for:
- Hover effects (when clickable=true)
- Responsive scaling
- Theme-based text coloring
- Smooth transitions

## Integration

The LogoComponent is already integrated into:
- ✅ Header component
- ✅ Login page
- ✅ Register page

To add to other components:
1. Import LogoComponent
2. Add to component imports array
3. Use `<app-logo>` in template