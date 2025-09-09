# 🏪 Modern POS System

A comprehensive Point of Sale (POS) system built with Angular 19 and Firebase, designed for multi-store retail operations with advanced features and mobile-responsive design.

## 🚀 Features

### Core Functionality
- ✅ **Multi-Store Management** - Manage multiple stores and branches
- ✅ **Product Catalog** - Comprehensive product management with inventory tracking
- ✅ **Cart & Checkout** - Intuitive shopping cart with VAT calculations
- ✅ **Professional Receipt System** - BIR-compliant receipt printing with thermal printer support and payment method indicators
- ✅ **Multi-Printer Support** - USB thermal printers, network printers, and browser printing
- ✅ **Transaction Management** - Automatic transaction saving with audit trail
- ✅ **User Management** - Role-based access control (Admin, Manager, Cashier)
- ✅ **Advanced Order Management** - Automatic order display, refresh functionality, and item-level actions (return, damage, refund, cancel)
- ✅ **Receipt Enhancement** - Payment method indicators (Cash/Charge circles) and direct receipt access from orders
- ✅ **Responsive Design** - Desktop and mobile-optimized interface

### Advanced Features
- 🔐 **Authentication & Authorization** - Firebase-powered secure login
- 💾 **Cloud Sync** - Real-time data synchronization
- 📱 **Mobile POS** - Dedicated mobile interface for cashiers
- 🧾 **VAT Management** - Automated VAT calculations and exemptions
- 📊 **Analytics Ready** - Built-in analytics infrastructure
- 🎯 **Customer View** - Customer-facing display capabilities
- 🔄 **Offline Support** - Service worker implementation for offline operation

### Business Compliance
- 🇵🇭 **BIR Compliance** - Philippine tax requirements with dynamic invoice types
- 🧾 **Professional Receipts** - Sales invoice template with store branding
- �️ **Thermal Printer Support** - ESC/POS commands for receipt printers
- �📋 **Store Settings** - Configurable store parameters and BIR information
- 🏢 **Company Management** - Multi-company support
- 📄 **Receipt Customization** - Branded receipts with company details

## 🖨️ Receipt & Printing System

### Receipt Features
- **Professional Sales Invoice Template** - Clean, business-appropriate layout
- **Dynamic Invoice Types** - Configurable from store settings (Sales Invoice, Official Receipt, etc.)
- **BIR Compliance Fields** - Automatic inclusion of BIR Permit No, MIN, Serial Numbers
- **Customer Information** - Conditional display of customer details for business transactions
- **Real-time Preview** - Modal preview before printing with print options

### Printer Support
- **USB Thermal Printers** - Direct connection via Web Serial API (Chrome/Edge)
- **Network Thermal Printers** - IP-based printing through backend API
- **Browser Printing** - Fallback option for standard printers
- **ESC/POS Commands** - Industry-standard thermal printer commands
- **Print Service Architecture** - Modular design with automatic fallbacks

### Usage
```typescript
// Print receipt with preferred printer type
await printService.printReceipt(receiptData, 'thermal');

// Available printer types: 'thermal' | 'network' | 'browser'
```

## 🛠️ Technology Stack

### Frontend
- **Angular 19** - Latest Angular framework with standalone components
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **Angular Material** - Material Design components
- **RxJS** - Reactive programming

### Backend & Services
- **Firebase** - Backend-as-a-Service
  - Firestore - NoSQL database
  - Authentication - User management
  - Hosting - Application deployment
- **Angular Fire** - Firebase integration

### Development Tools
- **Angular CLI** - Development tooling
- **PostCSS** - CSS processing
- **Jasmine & Karma** - Testing framework

## 📁 Project Structure

```
src/
├── app/
│   ├── core/                    # Core services and utilities
│   │   └── services/
│   ├── guards/                  # Route guards (auth, onboarding)
│   ├── interfaces/              # TypeScript interfaces
│   │   ├── product.interface.ts
│   │   ├── cart.interface.ts
│   │   ├── pos.interface.ts
│   │   └── ...
│   ├── layouts/                 # Layout components
│   │   ├── dashboard/
│   │   └── main-layout/
│   ├── pages/                   # Page components
│   │   ├── auth/               # Authentication pages
│   │   ├── dashboard/          # Main dashboard
│   │   │   ├── pos/           # POS system
│   │   │   │   ├── mobile/    # Mobile POS interface
│   │   │   │   └── receipt/   # Receipt component & templates
│   │   │   ├── inventory/     # Inventory management
│   │   │   ├── stores/        # Store management
│   │   │   └── ...
│   │   └── features/          # Feature modules
│   ├── services/              # Business logic services
│   │   ├── auth.service.ts
│   │   ├── pos.service.ts
│   │   ├── product.service.ts
│   │   ├── print.service.ts   # Receipt printing service
│   │   ├── transaction.service.ts
│   │   └── ...
│   └── shared/               # Shared components and utilities
│       ├── components/
│       └── ui/
└── environments/             # Environment configurations
```

## 🚦 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Firebase project setup

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd POS
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Firebase**
   - Create a Firebase project
   - Enable Firestore and Authentication
   - Update `src/environments/environment.ts` with your Firebase config

4. **Start development server**
   ```bash
   npm start
   # or
   ng serve
   ```

5. **Access the application**
   - Open http://localhost:4200 in your browser

### Build for Production
```bash
npm run build
# Output will be in the dist/ directory
```

## 🔧 Configuration

### Firebase Setup
```typescript
// src/environments/environment.ts
export const environment = {
  production: false,
  firebase: {
    apiKey: "your-api-key",
    authDomain: "your-auth-domain",
    projectId: "your-project-id",
    storageBucket: "your-storage-bucket",
    messagingSenderId: "your-sender-id",
    appId: "your-app-id"
  }
};
```

### Environment Variables
- `environment.ts` - Development configuration
- `environment.prod.ts` - Production configuration

## 📱 Mobile Support

The POS system includes dedicated mobile components optimized for mobile browsers:
- **Mobile POS Interface** - Fully responsive design optimized for tablets and phones
- **Collapsible Navigation** - Smart toggle system to hide/show navigation controls (store, invoice, categories, customer, access)
- **Floating Action Button (FAB) Cart** - Intuitive floating cart with real-time item counter and total display
- **Mobile Cart Modal** - Full-screen cart management with smooth animations and comprehensive controls
- **Touch-friendly UI** - Large buttons (44px minimum) and gesture support
- **Mobile Browser Compatibility** - Tested and optimized for Chrome Mobile, Safari iOS
- **Horizontal Scrolling Tabs** - Smooth scrolling for category and access navigation
- **Focused Search Experience** - Prioritized product search and selection interface
- **Mobile-Specific Optimizations** - Webkit scrolling, tap highlights, and viewport handling
- **Receipt Modal Integration** - Same receipt functionality as desktop with mobile-friendly controls

## 🏗️ Architecture

### Service Layer
- **AuthService** - User authentication and authorization
- **PosService** - Core POS functionality and cart management
- **ProductService** - Product catalog operations
- **StoreService** - Multi-store management
- **OrderService** - Order processing, history, and advanced management with automatic loading and refresh capabilities
- **PrintService** - Receipt printing and thermal printer integration
- **TransactionService** - Transaction persistence and audit trail
- **PosSharedService** - Shared state management between POS components

### State Management
- Angular Signals for reactive state management
- Computed properties for derived state
- Service-based state sharing between components

### Data Models
- TypeScript interfaces for type safety
- Firestore document models
- BIR-compliant data structures

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run tests with coverage
npm run test:coverage

# Run e2e tests
npm run e2e
```

## 📈 Performance

### Optimization Features
- Lazy loading for route modules
- OnPush change detection strategy
- Image optimization
- Service worker for caching
- Tree-shaking for smaller bundles

### Mobile Performance
- Touch optimizations
- Efficient scrolling
- Minimal bundle size
- Fast startup time

## 🔒 Security

### Authentication
- Firebase Authentication integration
- JWT token management
- Role-based access control
- Session management

### Authorization
- Route guards
- Component-level permissions
- Service-level security

## 🌐 Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge
- Mobile browsers (iOS Safari, Chrome Mobile)

## 📋 Available Scripts

```bash
npm start          # Start development server
npm run build      # Build for production
npm run test       # Run unit tests
npm run lint       # Lint code
npm run e2e        # Run e2e tests
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is proprietary software. All rights reserved.

## 📋 Changelog

### Latest Updates (September 2025)

#### � Advanced Order Management System (September 10, 2025)
- **Automatic Order Display** - Orders tab now automatically displays top 20 most recent orders on load
- **Order Refresh Functionality** - Added manual refresh button to reload order list with real-time debugging
- **Enhanced Receipt System** - Integrated payment method indicators (Cash/Charge) with professional circle design
- **Item-Level Order Actions** - Added individual item action buttons for returns, damage reports, refunds, and cancellations
- **Receipt Opening from Orders** - Direct access to formatted receipts from order details modal
- **Advanced Order Details Modal** - Comprehensive order information with item-by-item action capabilities
- **Confirmation Dialogs** - User-friendly confirmation prompts for all item actions to prevent accidental operations
- **Visual Payment Indicators** - Professional Cash/Charge circles positioned above customer information in receipts
- **Color-Coded Action Buttons** - Intuitive button styling for different actions (green for returns, red for damage, etc.)
- **Enhanced Debugging System** - Comprehensive console logging for order loading diagnostics and troubleshooting

#### �🚀 Mobile POS Advanced UX Update (September 9, 2025)
- **Collapsible Navigation System** - Added smart navigation toggle to hide/show store, invoice, categories, customer, and access controls
- **Floating Action Button (FAB) Cart** - Implemented floating cart button with pulse animations and item counter for better mobile UX
- **Mobile Cart Modal Component** - Created dedicated full-screen cart modal with comprehensive cart management features
- **Enhanced Mobile Layout** - Fixed header overlap issues and improved mobile content positioning
- **Navigation Toggle UI** - Added intuitive toggle button with visual feedback and control hints
- **Focused Product Search** - Optimized mobile interface to prioritize product search and selection
- **Cart Visibility Enhancement** - FAB shows real-time item count and total amount with smooth animations
- **Mobile-First UX** - Streamlined interface that collapses controls when not needed, focusing on core POS functionality

#### 🧾 Receipt System & Thermal Printer Integration (September 8, 2025)
- **Professional Receipt Component** - Created comprehensive receipt modal with sales invoice template
- **Thermal Printer Support** - Added ESC/POS command generation for thermal printers
- **Multi-Printer Integration** - Support for USB thermal printers, network printers, and browser printing
- **BIR Compliance Enhanced** - Dynamic invoice type from store data with BIR permit, MIN, and serial numbers
- **Transaction Persistence** - Automatic transaction saving to database before printing
- **Print Service Architecture** - Modular print service with fallback mechanisms
- **Professional Styling** - Clean receipt layout with proper business formatting

#### 📱 Mobile POS Improvements (September 8, 2025)
- **Responsive Design Overhaul** - Fixed mobile Chrome browser compatibility issues
- **Vertical Scrolling** - Added vertical scroll bars for categories and access tabs
- **Cart Layout Optimization** - Eliminated large blank spaces in cart items and summary sections
- **Touch-Friendly Interface** - Improved button sizes and touch targets for mobile devices
- **Mobile-Specific CSS** - Added webkit optimizations and mobile browser fixes
- **Receipt Integration** - Added receipt modal functionality to mobile POS interface

#### 🎯 POS Layout Optimization (September 8, 2025)
- **Category Panel Redesign** - Removed forced scrolling from categories panel, now displays all categories naturally
- **Product Grid Enhancement** - Optimized product display with improved height constraints for complete row visibility
- **Layout Flexibility** - Changed main container from fixed height to flexible min-height for better content accommodation
- **Grid Display Fix** - Resolved issue where second row of products was being cut off or partially hidden
- **Responsive Improvements** - Enhanced overall layout flow without conflicting scroll areas
- **Mobile/Desktop Sync** - Continued work on synchronizing mobile and desktop POS interfaces

#### 🔧 Bug Fixes & Improvements
- **Authentication Persistence** - Fixed authentication state not being reflected on home page after login
- **Component Stability** - Reverted POS component to stable working state to resolve loading issues
- **UI Consistency** - Updated company profile styling to match products page header design
- **Navigation Enhancement** - Added dashboard icon to POS header for improved navigation flow

#### 🎨 UI/UX Enhancements
- **Home Component** - Enhanced with authentication-aware interface and dynamic content
- **Company Profile** - Updated with gradient header and conditional "Add Company" button
- **Header Component** - Added dashboard navigation icon for POS interfaces
- **Responsive Design** - Improved mobile and desktop layout consistency

#### 🛠️ Technical Improvements
- **Angular Signals** - Implemented reactive state management for authentication
- **Code Quality** - Improved TypeScript interfaces and component structure
- **Error Handling** - Enhanced error handling and user feedback
- **Performance** - Optimized component rendering and state updates

#### 🏪 POS System
- **Cart Management** - Stable cart functionality with VAT calculations
- **Product Display** - Multiple view modes (list, grid, promos, bestsellers)
- **Order Processing** - Reliable order completion and tracking
- **Mobile Support** - Dedicated mobile POS interface maintained

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

## 🚧 Roadmap

### Completed ✅
- Multi-store POS system
- Mobile responsive design with touch optimizations and collapsible navigation
- Floating Action Button (FAB) cart system for mobile devices
- Mobile cart modal with comprehensive cart management
- Firebase integration with real-time sync
- User authentication and role-based access
- Product management and inventory tracking
- Order processing and transaction persistence
- Advanced order management with automatic display and refresh functionality
- Item-level order actions (return, damage, refund, cancel) with confirmation dialogs
- BIR compliance with professional receipt system
- Payment method indicators in receipts (Cash/Charge circles)
- Enhanced order details modal with receipt opening capabilities
- Thermal printer integration (USB, Network, Browser)
- Receipt modal with print preview
- Advanced mobile POS interface with focused search experience

### In Progress 🔄
- Advanced inventory management
- Comprehensive reporting dashboard
- Customer management system
- Payment integrations (multiple providers)

### Planned 📋
- Barcode scanning integration
- Advanced analytics and insights
- Multi-language support
- API integrations for third-party services
- Cloud backups and data export
- Kitchen display system (for restaurants)
- Loyalty program integration

---

**Built with ❤️ using Angular & Firebase**
