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
- ✅ **Sales Analytics Dashboard** - Comprehensive sales summary with date filtering, store selection, and order details
- ✅ **Standalone POS Interface** - Dedicated cashier interface accessible directly at `/pos` without dashboard navigation
- ✅ **Receipt Enhancement** - Payment method indicators (Cash/Charge circles) and direct receipt access from orders
- ✅ **Professional UI Design** - Gradient headers, professional buttons, and consistent styling across all components
- ✅ **Walk-in Customer System** - Standardized default customer handling for transactions without specific customer information
- ✅ **Responsive Design** - Desktop and mobile-optimized interface

### Advanced Features
- 🔐 **Hybrid Authentication System** - Online/offline authentication with seamless fallback
- 💾 **Cloud Sync** - Real-time data synchronization with offline capabilities
- 📱 **Mobile POS** - Dedicated mobile interface for cashiers
- 🧾 **VAT Management** - Automated VAT calculations and exemptions
- 📊 **Analytics Ready** - Built-in analytics infrastructure
- 🎯 **Customer View** - Customer-facing display capabilities
- 🔄 **Advanced Offline Support** - Complete offline authentication and data persistence
- 🔒 **Secure Offline Credentials** - SHA-256 hashed password storage with salt encryption
- 💿 **IndexedDB Integration** - Local database for offline data and session management

### Business Compliance
- 🇵🇭 **BIR Compliance** - Philippine tax requirements with dynamic invoice types
- 🧾 **Professional Receipts** - Sales invoice template with store branding
- �️ **Thermal Printer Support** - ESC/POS commands for receipt printers
- �📋 **Store Settings** - Configurable store parameters and BIR information
- 🏢 **Company Management** - Multi-company support
- 📄 **Receipt Customization** - Branded receipts with company details

## � Offline Authentication System

### Hybrid Authentication Architecture
The POS system features a sophisticated offline authentication system that provides seamless operation even without internet connectivity, ensuring business continuity for retail operations.

### Key Features
- **🌐 Online-First Approach** - Attempts Firebase authentication first, with automatic offline fallback
- **🔒 Secure Credential Storage** - SHA-256 password hashing with random salt generation
- **💾 Local Session Management** - IndexedDB-based storage for encrypted user credentials
- **⏰ Configurable Session Duration** - 1 day default, 30 days with "Remember Me" option
- **🔄 Seamless Fallback** - Automatic detection and switching between online/offline modes
- **📱 Network State Awareness** - Real-time network connectivity monitoring
- **🛡️ Policy Agreement Integration** - Offline users maintain policy compliance state
- **🚫 Selective Online Requirements** - In offline mode, data is stored locally and syncs to cloud when online. Registration and password reset require internet connection

### Security Architecture
```typescript
// Password Security
- SHA-256 hashing algorithm
- Cryptographically secure random salt generation (16 bytes)
- Web Crypto API for secure operations
- No plaintext password storage

// Session Management  
- Email-to-UID mapping for efficient user lookup
- Encrypted credential storage in IndexedDB
- Automatic session expiry and cleanup
- "Remember Me" extends session to 30 days
```

### Authentication Flow
1. **Initial Setup** - User logs in online, credentials are hashed and stored locally
2. **Subsequent Logins** - System attempts online authentication first
3. **Offline Detection** - Automatic fallback to local credential validation
4. **Session Restoration** - User session and permissions restored from local storage
5. **Policy Compliance** - Offline users maintain policy agreement status

### Implementation Benefits
- ✅ **Business Continuity** - POS operations continue during internet outages
- ✅ **Enhanced Security** - Industry-standard password hashing and encryption
- ✅ **User Experience** - Seamless authentication regardless of connectivity
- ✅ **Retail Focused** - Designed specifically for point-of-sale environments
- ✅ **Enterprise Ready** - Scalable architecture for multi-store operations

### Usage Scenarios
- **Primary Use Case** - Login/logout functionality during internet downtime
- **Store Operations** - Cashier authentication at opening/closing times
- **Network Reliability** - Backup authentication for unstable connections
- **Mobile POS** - Tablet-based POS systems with intermittent connectivity

## �🖨️ Receipt & Printing System

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

### Frontend Framework
- **Angular 19** - Latest Angular framework with standalone components and signals
- **TypeScript 5.5+** - Type-safe development with strict mode
- **Angular Signals** - Reactive state management for modern Angular applications
- **Standalone Components** - Component architecture without NgModules
- **Angular Router** - Client-side routing with guards and lazy loading

### Styling & UI
- **Tailwind CSS 3.4+** - Utility-first CSS framework with custom configuration
- **PostCSS** - Advanced CSS processing with autoprefixer
- **Custom CSS** - Professional gradient designs and responsive layouts
- **CSS Grid & Flexbox** - Modern layout systems for responsive design
- **Web Fonts** - Inter font family for professional typography

### State Management & Reactivity
- **Angular Signals** - Modern reactive state management
- **RxJS 7.8+** - Reactive programming for async operations
- **Computed Properties** - Derived state with automatic dependency tracking
- **Service-based State** - Centralized state management through services

### Backend & Database
- **Firebase v10+** - Backend-as-a-Service platform
  - **Firestore** - NoSQL document database with real-time sync
  - **Firebase Auth** - User authentication and session management
  - **Firebase Hosting** - Static web app hosting with CDN
  - **Security Rules** - Database-level security and access control
- **AngularFire v17+** - Official Angular library for Firebase integration

### Offline & Local Storage
- **IndexedDB API** - Browser database for offline data persistence
- **Web Crypto API** - Secure password hashing with SHA-256 and salt
- **Local Storage** - Browser storage for user preferences
- **Service Workers** - Background sync and caching strategies
- **Network Detection API** - Online/offline state management

### Authentication & Security
- **Firebase Authentication** - OAuth providers and email/password authentication
- **Offline Authentication** - Hybrid system with secure local credential storage
- **Role-Based Access Control (RBAC)** - User permissions and authorization
- **Route Guards** - Component-level access control
- **Password Security** - SHA-256 hashing with random salt generation
- **Session Management** - Configurable session duration and "Remember Me" functionality

### Printing & Hardware Integration
- **Web Serial API** - USB thermal printer communication
- **Web Bluetooth API** - Bluetooth thermal printer support
- **ESC/POS Commands** - Industry-standard thermal printer protocol
- **Network Printing** - IP-based printer communication
- **Browser Print API** - Fallback printing for standard printers

### Development Tools & Build
- **Angular CLI 19** - Command-line interface for Angular development
- **Webpack 5** - Module bundler with tree-shaking and code splitting
- **esbuild** - Fast JavaScript bundler for development
- **TypeScript Compiler** - Advanced type checking and compilation
- **ESLint** - Code quality and style enforcement
- **Prettier** - Code formatting and consistency

### Testing & Quality Assurance
- **Jasmine** - Behavior-driven development testing framework
- **Karma** - Test runner for unit tests
- **Protractor/Cypress** - End-to-end testing capabilities
- **Angular Testing Utilities** - Component and service testing tools
- **Code Coverage** - Test coverage reporting and analysis

### Performance & Optimization
- **Lazy Loading** - Route-based code splitting for faster initial load
- **OnPush Change Detection** - Optimized change detection strategy
- **Tree Shaking** - Dead code elimination for smaller bundles
- **Service Worker Caching** - Offline-first caching strategies
- **Image Optimization** - Responsive images and lazy loading
- **Bundle Analysis** - Webpack bundle analyzer for optimization insights

### Development Environment & DevOps
- **Node.js 18+** - JavaScript runtime environment
- **npm/yarn** - Package management and dependency resolution
- **Git** - Version control with branching strategies
- **VS Code** - Recommended IDE with Angular extensions
- **Chrome DevTools** - Debugging and performance profiling
- **Firebase CLI** - Deployment and project management tools

### Browser APIs & Web Standards
- **Fetch API** - Modern HTTP client for API communication
- **IntersectionObserver API** - Efficient scroll-based interactions
- **ResizeObserver API** - Responsive component behavior
- **Web Components** - Custom elements and shadow DOM
- **Progressive Web App (PWA)** - App-like experience with service workers
- **Responsive Design** - Mobile-first responsive web design principles

### Business Logic & Domain
- **Multi-tenant Architecture** - Support for multiple companies and stores
- **BIR Compliance** - Philippine tax regulation compliance
- **VAT Calculations** - Automated tax computation and exemptions
- **Inventory Management** - Real-time stock tracking and updates
- **Transaction Processing** - Secure payment and order processing
- **Receipt Generation** - Professional invoice templates and printing

### Integration & External Services
- **RESTful APIs** - Standard HTTP API integration patterns
- **Real-time Sync** - Firestore real-time listeners for live data updates
- **Cloud Functions** - Serverless backend logic (planned)
- **Payment Gateways** - Third-party payment processor integration (planned)
- **Barcode/QR Scanner** - Product identification and inventory management (planned)

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
│   │   │   ├── sales/         # Sales analytics
│   │   │   │   └── sales-summary/ # Sales summary component
│   │   │   ├── inventory/     # Inventory management
│   │   │   ├── stores/        # Store management
│   │   │   ├── products/      # Product management
│   │   │   ├── access/        # Access management
│   │   │   ├── company-profile/ # Company profile management
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

## � Sales Analytics & Reporting

### Sales Summary Dashboard
- **Date Range Filtering** - Custom date selection for sales analysis
- **Multi-Store Analytics** - Store-specific sales data with automatic store selection
- **Real-time Data Loading** - Live sales data from Firestore orders collection
- **Order Details View** - Detailed transaction information with invoice numbers
- **Professional Interface** - Gradient headers and consistent UI design
- **Refresh Functionality** - Manual data refresh with professional button styling
- **Empty State Handling** - Professional empty states with action buttons
- **Store Name Display** - Uppercase store names in headers for brand consistency

### Customer Management
- **Walk-in Customer System** - Standardized default for transactions without specific customers
- **Customer Information Display** - Conditional customer details in receipts and orders
- **Business Transaction Support** - TIN and address fields for business customers

### Navigation & UX
- **Standalone POS Route** - Direct `/pos` access for cashier-focused experience
- **Custom Active States** - URL-based navigation tracking with gradient backgrounds
- **Professional Styling** - Consistent button and header design across all components
- **Responsive Design** - Mobile and desktop optimized interfaces

## �📱 Mobile Support

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
- **AuthService** - Hybrid authentication system with online/offline capabilities, secure credential storage, and session management
- **OfflineStorageService** - IndexedDB management for offline data persistence and user session storage
- **IndexedDBService** - Low-level database operations for offline functionality and data synchronization
- **NetworkService** - Network connectivity monitoring and online/offline state management
- **PosService** - Core POS functionality and cart management
- **ProductService** - Product catalog operations
- **StoreService** - Multi-store management
- **OrderService** - Order processing, history, sales analytics, and advanced management with automatic loading and refresh capabilities
- **PrintService** - Receipt printing and thermal printer integration
- **TransactionService** - Transaction persistence and audit trail
- **PosSharedService** - Shared state management between POS components
- **CompanyService** - Company profile and settings management
- **UserRoleService** - User role and permission management
- **CustomerService** - Customer information and Walk-in Customer handling

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

### Latest Updates (October 2025)

#### 🔄 Offline Authentication System Implementation (October 8, 2025)
- **Hybrid Authentication Architecture** - Seamless online/offline authentication with automatic fallback mechanisms
- **Secure Credential Storage** - SHA-256 password hashing with cryptographically secure salt generation using Web Crypto API
- **IndexedDB Integration** - Local database storage for encrypted user credentials and session management
- **Session Management** - Configurable session duration (1 day default, 30 days with "Remember Me" functionality)
- **Network State Detection** - Real-time connectivity monitoring with smart authentication routing
- **Policy Agreement Integration** - Offline users maintain policy compliance state and agreement status
- **Enhanced AuthService** - Complete rewrite with offline capabilities while maintaining Firebase compatibility
- **Login Component Enhancement** - Offline status indicators and improved user feedback systems
- **Security Best Practices** - Industry-standard encryption, secure random salt generation, and session expiry management
- **Business Continuity Focus** - Designed specifically for retail POS environments with intermittent connectivity
- **Selective Online Requirements** - Offline mode stores data locally with cloud sync when online. Registration and password reset require internet, login/logout work offline
- **Comprehensive Error Handling** - Robust error management with user-friendly messaging and automatic recovery
- **Performance Optimization** - Efficient credential lookup and validation with minimal overhead
- **Enterprise Architecture** - Scalable design supporting multi-store and multi-user environments

### Previous Updates (September 2025)

#### 📊 Sales Analytics & Navigation Enhancement (September 26, 2025)
- **Sales Summary Dashboard** - Comprehensive sales analytics component with date range filtering and order details
- **Store Selection Integration** - Dynamic store dropdown with single store auto-display and multi-store selection
- **Professional Header Design** - Standardized gradient headers across all dashboard components
- **Standalone POS Navigation** - POS now routes to `/pos` directly without dashboard sidebar for focused cashier experience
- **Custom Navigation System** - Implemented URL-based active state tracking replacing Angular RouterLinkActive for precise navigation
- **Professional Button Styling** - Enhanced refresh and action buttons with gradient backgrounds and smooth animations
- **Walk-in Customer Default** - Standardized "Walk-in Customer" as default for all transactions without specific customer names
- **Invoice Number Display** - Added invoice number visibility in sales summaries with view details functionality
- **Empty State Improvements** - Professional empty states with refresh buttons across product and sales components
- **Sidebar Active States** - Gradient background active states for all navigation items including POS
- **Sales Data Integration** - Real-time sales data loading from Firestore orders collection with date filtering
- **Header Consistency** - Uniform header design pattern with gradient backgrounds and store name display
- **Navigation UX** - Smooth transitions and visual feedback for all navigation interactions

#### 🔧 Advanced Order Management System (September 10, 2025)
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
- **Offline Authentication System** - Complete hybrid authentication with secure credential storage and session management
- **IndexedDB Integration** - Local database for offline data persistence and synchronization
- **Network State Management** - Real-time connectivity monitoring with smart fallback mechanisms
- **Security Architecture** - SHA-256 password hashing, salt encryption, and secure session management
- Multi-store POS system with standalone cashier interface
- Sales analytics dashboard with date filtering and store selection
- Professional UI design with gradient headers and styled buttons
- Walk-in Customer system with standardized default handling
- Custom navigation system with URL-based active state tracking
- Mobile responsive design with touch optimizations and collapsible navigation
- Floating Action Button (FAB) cart system for mobile devices
- Mobile cart modal with comprehensive cart management
- Firebase integration with real-time sync and offline capabilities
- User authentication and role-based access with offline support
- Product management and inventory tracking with professional empty states
- Order processing and transaction persistence
- Advanced order management with automatic display and refresh functionality
- Item-level order actions (return, damage, refund, cancel) with confirmation dialogs
- BIR compliance with professional receipt system
- Payment method indicators in receipts (Cash/Charge circles)
- Enhanced order details modal with receipt opening capabilities
- Thermal printer integration (USB, Network, Browser)
- Receipt modal with print preview
- Advanced mobile POS interface with focused search experience
- Sales summary component with real-time order data and invoice number display

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
