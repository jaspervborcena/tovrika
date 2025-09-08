# 🏪 Modern POS System

A comprehensive Point of Sale (POS) system built with Angular 19 and Firebase, designed for multi-store retail operations with advanced features and mobile-responsive design.

## 🚀 Features

### Core Functionality
- ✅ **Multi-Store Management** - Manage multiple stores and branches
- ✅ **Product Catalog** - Comprehensive product management with inventory tracking
- ✅ **Cart & Checkout** - Intuitive shopping cart with VAT calculations
- ✅ **Receipt Generation** - BIR-compliant receipt printing
- ✅ **User Management** - Role-based access control (Admin, Manager, Cashier)
- ✅ **Order Management** - Order processing and tracking
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
- 🇵🇭 **BIR Compliance** - Philippine tax requirements
- 📋 **Store Settings** - Configurable store parameters
- 🏢 **Company Management** - Multi-company support
- 📄 **Receipt Customization** - Branded receipts with company details

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
│   │   │   ├── inventory/     # Inventory management
│   │   │   ├── stores/        # Store management
│   │   │   └── ...
│   │   └── features/          # Feature modules
│   ├── services/              # Business logic services
│   │   ├── auth.service.ts
│   │   ├── pos.service.ts
│   │   ├── product.service.ts
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

The POS system includes dedicated mobile components for optimal touch interaction:
- **Mobile POS Interface** - Optimized for tablets and phones
- **Touch-friendly UI** - Large buttons and gestures
- **Responsive Cart** - Flexible layout for different screen sizes
- **Custom Scrollbars** - Native mobile scrolling experience

## 🏗️ Architecture

### Service Layer
- **AuthService** - User authentication and authorization
- **PosService** - Core POS functionality and cart management
- **ProductService** - Product catalog operations
- **StoreService** - Multi-store management
- **OrderService** - Order processing and history

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
- Mobile responsive design
- Firebase integration
- User authentication
- Product management
- Order processing
- BIR compliance

### In Progress 🔄
- Inventory management
- Advanced reporting
- Customer management
- Payment integrations

### Planned 📋
- Barcode scanning
- Receipt printer integration
- Advanced analytics
- Multi-language support
- API integrations
- Cloud backups

---

**Built with ❤️ using Angular & Firebase**
