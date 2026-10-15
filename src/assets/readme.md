# Tovrika Modern POS System

An enterprise-grade **Point of Sale (POS) system** built with Angular 19 and Firebase, featuring advanced multi-tenant security, offline-first architecture, subscription management, and seamless online/offline operations for retail businesses.

## 🎯 Core Features

### 💼 Business Operations
- **Multi-Store Management** - Manage multiple stores and branches with complete data isolation
- **Subscription Management** - Flexible subscription plans with billing tracking and payment processing
- **Product Catalog** - Comprehensive product management with inventory tracking and UID security
- **Cart & Checkout** - Intuitive shopping cart with VAT calculations and secure transactions
- **Transaction Management** - Automatic transaction saving with complete audit trail
- **Advanced Order Management** - Real-time order processing with item-level actions (return, damage, refund, cancel, unpaid, recovered)
- **Order Tracking & Status** - Track orders through complete lifecycle including unpaid status and recovery tracking
- **Sales Analytics Dashboard** - Comprehensive reporting with date filtering and store selection
- **Customer Management** - Complete customer database with transaction history
- **Billing History** - Track all subscription payments and transactions per store

### 💳 Subscription & Billing
- **Multi-Tier Subscription Plans** - Freemium (trial), Standard, Premium, and Enterprise tiers
- **Flexible Billing Cycles** - Monthly, quarterly, and yearly subscription options
- **Payment Method Support** - Debit card, Credit card, and PayPal integration
- **Promo Code System** - Discount codes with automatic validation and application
- **Subscription Dashboard** - Manage all store subscriptions with advanced filtering
- **Billing History Tracking** - Complete payment records with CSV export

### 🧾 Receipt & Printing System
- **Professional Receipt System** - BIR-compliant receipt printing with thermal printer support
- **Multi-Printer Support** - USB thermal printers, network printers, and browser printing
- **Payment Method Indicators** - Cash/Charge circles on receipts
- **Thermal Printer Integration** - ESC/POS commands for receipt printers

### 🇵🇭 BIR Compliance & Device Management
- **BIR-Compliant Receipts** - Sales invoice template meeting Philippine tax requirements
- **Device Registration** - BIR-compliant device/terminal registration system
- **VAT Management** - Automated VAT calculations and exemptions
- **Invoice Series Tracking** - Sequential numbering with locked BIR fields after approval
- **Receipt Numbering** - Sequential invoice numbering with store-specific prefixes

### 👥 User Management & Security
- **Role-Based Access Control** - Creator, Store Manager, Cashier roles with specific permissions
- **User Authentication** - Hybrid online/offline authentication system
- **Permission Management** - Granular permissions for different user roles
- **Secure User Sessions** - Complete session management with offline support

## 🔐 Advanced Security & Architecture

### 🛡️ Multi-Tenant Data Security
- **Enterprise-Level Data Isolation** - Each user can only access their own data via UID-based security
- **Firestore Security Rules** - Database-level protection preventing unauthorized cross-tenant access
- **Automatic UID Injection** - All documents automatically include user UID from Firebase Auth or SQLite cache
- **Secure Offline Operations** - Full security even when operating offline using cached credentials

### 🔄 Offline-First Architecture
- **Complete Offline POS** - Full point-of-sale functionality without internet connectivity
- **SQLite Integration** - App-managed offline data via `sql.js`, persisted in `localStorage`
- **Smart Data Sync** - Automatic synchronization when connectivity returns
- **Firestore Persistence** - Firebase SDK browser persistence is separate from the app-managed SQLite cache

## 🛠️ Technology Stack

### **Frontend Technologies**
- **Angular 19** - Latest Angular framework with standalone components and signals
- **TypeScript** - Type-safe development with enhanced IDE support
- **Tailwind CSS** - Utility-first CSS framework for rapid UI development
- **Angular Signals** - Modern reactive state management with signal(), computed(), and effect() for state and UI reactivity
- **RxJS** - Observable library for HTTP operations, async flows, stream processing, and interceptor handling

### **Backend & Database**
- **Firebase** - Google's comprehensive app development platform
- **Firestore** - NoSQL document database with real-time synchronization
- **Firebase Auth** - Secure user authentication and authorization

### **Offline & Local Storage**
- **SQLite (`sql.js`)** - App-managed local database for offline data storage
- **Web Crypto API** - Secure cryptographic operations for password hashing
- **Firestore Persistence** - Automatic offline queuing and sync

### **Hardware Integration**
- **ESC/POS Thermal Printers** - Direct thermal printer communication
- **USB Printer Support** - Direct connection to USB thermal printers
- **Network Printer Support** - WiFi and Ethernet printer connectivity

## 🚀 Quick Start

### Installation & Setup
```bash
# Clone the repository
git clone [repository-url]
cd tovrika-pos

# Install dependencies
npm install

# Start development server
npm start

# Access the application at http://localhost:4200
```

### Firebase Configuration
1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com)
2. Enable Firestore Database and Authentication
3. Update `src/environments/environment.ts` with your Firebase configuration
4. Deploy the Firestore security rules from `firestore.rules`

## 📊 App Structure

```
src/app/
├── pages/                      # Page components
│   ├── auth/                   # Authentication pages
│   ├── dashboard/              # Main dashboard with POS
│   ├── inventory/              # Inventory management
│   └── versions/               # Version notes page
├── services/                   # Business logic services
├── core/services/             # Core system services
├── shared/                    # Shared components
└── interfaces/               # TypeScript interfaces
```

## 📱 Key Interfaces

- **Desktop POS** - Full POS interface at `/pos`
- **Mobile POS** - Mobile-optimized interface at `/pos/mobile`
- **Dashboard** - Analytics and management at `/dashboard`
- **Inventory** - Stock tracking at `/dashboard/inventory`
- **Version Notes** - Changelog and README at `/versions`

## 📚 Documentation

- **Root README.md** - Complete project documentation
- **docs/** folder - Extended implementation guides (35+ files)
- **firestore.rules** - Security rules and access control
- **Version Notes Page** - Latest changelog and updates

## 🎯 For Business Users

- ✅ **Complete Offline Operations** - Never lose sales due to internet outages
- ✅ **Flexible Subscription Plans** - Choose the right plan for your business size
- ✅ **Multi-Store Management** - Manage multiple locations from one system
- ✅ **BIR Compliance** - Meet Philippine tax requirements automatically
- ✅ **Professional Receipts** - Branded, professional-looking receipts
- ✅ **Comprehensive Analytics** - Make data-driven business decisions

## 🔧 Development & Technical Setup

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn package manager
- Git for version control
- Firebase account for backend services

### Installation & Development

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start Development Server**
   ```bash
   npm start
   ```
   The app will be available at `http://localhost:4200`

3. **Build for Development**
   ```bash
   npm run build:dev
   ```

4. **Build for Production**
   ```bash
   npm run build:prod
   ```

### Configuration

#### Tailwind CSS
Custom POS color palette configured in `tailwind.config.js`:
- Primary: Indigo (brand color)
- Secondary: Cyan (accent)
- Additional: Green, Red, Slate for UI states

#### TypeScript & Angular Configuration
- TypeScript strict mode enabled
- Angular 19 with standalone components
- Signals for reactive state management
- PostCSS with Tailwind and Autoprefixer

#### Environment Setup
- **Development**: `src/environments/environment.ts`
- **Production**: `src/environments/environment.prod.ts`
- Firebase configuration in environment files
- API endpoints and feature flags

### Firebase Setup

1. **Create Firebase Project**
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Create a new project named `tovrika-pos`

2. **Enable Services**
   - Enable Firestore Database (create database in production mode)
   - Enable Firebase Authentication (Email/Password)
   - Enable Cloud Storage (for receipts and documents)

3. **Get Credentials**
   - Copy Firebase config from project settings
   - Update `src/environments/environment.ts` with your config

4. **Deploy Security Rules**
   ```bash
   firebase deploy --only firestore:rules
   ```
   - Use rules from `firestore.rules` file
   - Ensures multi-tenant data isolation via UID

### Build & Deployment

#### Local Development Testing
```bash
# Watch mode for development
npm run watch

# Run with specific proxy config
npm start -- --proxy-config proxy.conf.dev.json
```

#### Production Build
```bash
# Build optimized production bundle
npm run build:prod

# Output is in dist/pos-system folder
```

#### Deployment Options

**Firebase Hosting** (Recommended)
```bash
npm run build:prod
firebase login
firebase deploy
```

**Other Hosting Platforms**
- Netlify: Deploy the `dist/pos-system` folder
- Vercel: Connect GitHub repository for auto-deploy
- AWS S3 + CloudFront: Upload dist folder to S3
- Docker Container: Containerize the built app

#### Mobile Build (Capacitor)
```bash
# Build for Android
npm run android:build

# Build for iOS
npm run ios:build

# Open in IDE
npm run android:open
npm run ios:open
```

### Debugging & Monitoring

- **Development Logs**: Check browser console (F12)
- **Firestore Emulator**: Use Firebase emulator suite for local testing
- **Performance**: Check Chrome DevTools for bundle analysis
- **Error Tracking**: Implement Firebase Crashlytics in production

### Scripts Summary

```bash
npm start              # Start dev server (port 4200)
npm run build:dev      # Build for development
npm run build:prod     # Build optimized production
npm run watch          # Watch mode for development
npm test              # Run unit tests
npm run build:analyze # Analyze bundle size
npm run android:build # Build for Android
npm run ios:build     # Build for iOS
npm run cap:sync      # Sync Capacitor config
```

## 🏪 Hardware Integration

### Thermal Printer Setup
1. Connect USB thermal printer to device
2. Install printer driver if needed
3. Access printer settings in POS settings page
4. Configure ESC/POS commands for your printer model

### Barcode Scanner
- USB barcode scanners work automatically
- Compatible with most POS barcode scanners
- Configure scanner input mode (QR, EAN, etc.)

## 🔐 Security Deployment

### Pre-Deployment Checklist
- [ ] Firestore security rules deployed
- [ ] Firebase authentication configured
- [ ] CORS headers properly set
- [ ] SSL certificate installed (HTTPS)
- [ ] Environment variables secured
- [ ] Error tracking configured
- [ ] Backup strategy in place

### Production Best Practices
- Use strong Firebase credentials
- Enable two-factor authentication on Firebase account
- Monitor Firestore costs and usage
- Set up billing alerts
- Regular backup of Firestore data
- Monitor application performance
- Keep dependencies updated

## 📞 Support & Resources

### Documentation
- Full README in repository root
- Extended docs in `docs/` folder (35+ files)
- Firestore rules in `firestore.rules`
- Component source in `src/app/`

### Common Issues

**Port Already in Use**
```bash
# Change port
ng serve --port 4201
```

**Firebase Connection Error**
- Check Firebase config in environment
- Verify Firestore security rules
- Check internet connectivity
- Review Firebase console for errors

**Offline Mode Not Working**
- Check browser `localStorage` availability
- Verify the `sql.js` WebAssembly asset loads successfully
- Reset the app-managed cache only if needed by removing `tovrika_sqlite_database` from localStorage
- Restart browser and app

## 🚀 Next Steps

1. Install and configure Firebase
2. Deploy Firestore security rules
3. Run development server
4. Test multi-store functionality
5. Configure thermal printers
6. Deploy to production environment
