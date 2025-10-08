## App Header Component Integration Guide

### Overview
The `AppHeaderComponent` provides a centralized header with professional network status indicators that can be used across all pages in your POS system.

### Features
- **Network Status Colors**: 
  - 🟢 Online (Emerald-500 #10B981)
  - 🔴 Offline (Red-600 #DC2626) 
  - 🟡 Syncing (Amber-500 #F59E0B)
- **Professional Status Banner**: Shows contextual messages during offline/syncing states
- **Slot-based Content**: Flexible content projection for different pages
- **Responsive Design**: Mobile-optimized with adaptive layouts

### Basic Usage

```typescript
// In your component
import { AppHeaderComponent } from '../../../shared/components/app-header/app-header.component';

@Component({
  standalone: true,
  imports: [AppHeaderComponent, /* other imports */],
  template: `
    <app-header>
      <div header-left>
        <app-logo size="md" [showText]="true"></app-logo>
        <span class="text-gray-600 ml-4">Dashboard</span>
      </div>
      
      <div header-right>
        <button class="btn btn-primary">Actions</button>
      </div>
    </app-header>
    
    <!-- Your page content -->
    <main class="p-4">
      <!-- Content here -->
    </main>
  `
})
```

### Content Projection Slots

#### Left Side (`header-left`)
For logos, breadcrumbs, and page titles:
```html
<div header-left>
  <app-logo size="md" [showText]="true"></app-logo>
  <nav class="breadcrumb ml-4">
    <span>Dashboard</span> / <span>Sales</span>
  </nav>
</div>
```

#### Right Side (`header-right`) 
For actions, user menu, notifications:
```html
<div header-right>
  <button class="header-btn" title="Notifications">
    <svg><!-- notification icon --></svg>
    <span class="notification-badge">3</span>
  </button>
  
  <div class="user-menu">
    <!-- User dropdown -->
  </div>
</div>
```

### Replacing Existing Headers

#### Before (Dashboard Component)
```html
<header [class]="headerClass()" 
        [style.background]="isOnline() ? null : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'">
  <!-- Complex header logic -->
</header>
```

#### After (Using AppHeaderComponent)
```html
<app-header>
  <div header-left>
    <app-logo size="md" [showText]="true" theme="light" background="white"></app-logo>
    <div class="breadcrumb ml-4">
      <span class="breadcrumb-item">Dashboard</span>
    </div>
  </div>
  
  <div header-right>
    <!-- Move all header-actions here -->
    <button class="header-btn" title="Notifications">
      <!-- notification content -->
    </button>
    <!-- user menu -->
  </div>
</app-header>
```

### Network Status Integration

The component automatically:
- Detects network changes
- Shows appropriate status colors  
- Displays contextual banners for offline/syncing states
- Handles reconnection with 2-second sync animation

### Mobile Responsiveness

The header automatically adapts for mobile:
- Hides status text on small screens
- Collapses middle content
- Maintains essential branding and actions

### Styling Classes Available

```css
/* Status indicator colors */
.bg-emerald-500  /* Online */
.bg-red-600      /* Offline */ 
.bg-amber-500    /* Syncing */

/* Professional header styling */
.bg-white.shadow-md.border-b /* Header container */
.text-emerald-600            /* Online text */
.text-red-600               /* Offline text */
.text-amber-500             /* Syncing text */
```

### Implementation Steps

1. **Import the component** in your page components
2. **Replace existing headers** with `<app-header>` tags
3. **Project content** using `header-left` and `header-right` slots
4. **Remove custom network status logic** (handled automatically)
5. **Test network changes** to verify status updates

### Benefits

- ✅ Consistent UI across all pages
- ✅ Automatic network status management
- ✅ Professional status indicators
- ✅ Mobile-responsive design
- ✅ Reduced code duplication
- ✅ Centralized header logic