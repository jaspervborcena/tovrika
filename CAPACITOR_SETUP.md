# Tovrika POS - Mobile App Setup (Capacitor)

This guide explains how to build and run the Tovrika POS system as a native Android and iOS app using Capacitor.

## Prerequisites

### For Android
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Android Studio](https://developer.android.com/studio)
- Java Development Kit (JDK) 17
- Android SDK (API level 33 or higher)

### For iOS (Mac only)
- [Xcode](https://developer.apple.com/xcode/) (latest version)
- CocoaPods (`sudo gem install cocoapods`)
- Mac computer running macOS

## Initial Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Install Capacitor CLI globally (optional)**
   ```bash
   npm install -g @capacitor/cli
   ```

3. **Add Android platform**
   ```bash
   npm run cap:add:android
   ```

4. **Add iOS platform** (Mac only)
   ```bash
   npm run cap:add:ios
   ```

## Building for Android

### Development Build
```bash
# Build the web app and sync to Android
npm run android:build

# Open Android Studio
npm run android:open
```

Or run both commands together:
```bash
npm run android:run
```

### Run in Android Studio
1. Wait for Gradle sync to complete
2. Select a device/emulator
3. Click the "Run" button (green play icon)

### Generate APK/AAB
In Android Studio:
1. Go to **Build > Build Bundle(s) / APK(s)**
2. Select **Build APK** for testing or **Build Bundle(s)** for Play Store

## Building for iOS

### Development Build (Mac only)
```bash
# Build the web app and sync to iOS
npm run ios:build

# Open Xcode
npm run ios:open
```

Or run both commands together:
```bash
npm run ios:run
```

### Run in Xcode
1. Wait for dependencies to install
2. Select a simulator or connected device
3. Click the "Run" button (play icon)

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run android:build` | Build web app and sync to Android |
| `npm run android:open` | Open project in Android Studio |
| `npm run android:run` | Build and open Android Studio |
| `npm run ios:build` | Build web app and sync to iOS |
| `npm run ios:open` | Open project in Xcode |
| `npm run ios:run` | Build and open Xcode |
| `npm run cap:sync` | Sync web code to all platforms |
| `npm run cap:update` | Update Capacitor dependencies |

## Syncing Changes

After making changes to your web code:

```bash
# Sync to all platforms
npm run cap:sync

# Or sync to specific platform
npx cap sync android
npx cap sync ios
```

## Capacitor Plugins

The following Capacitor plugins are included:

- **@capacitor/core** - Core functionality
- **@capacitor/app** - App lifecycle events
- **@capacitor/splash-screen** - Native splash screen
- **@capacitor/status-bar** - Status bar styling

### Adding More Plugins

```bash
npm install @capacitor/[plugin-name]
npx cap sync
```

Popular plugins:
- `@capacitor/camera` - Camera access
- `@capacitor/filesystem` - File system access
- `@capacitor/network` - Network status
- `@capacitor/push-notifications` - Push notifications
- `@capacitor/share` - Native share dialog

## Configuration

Edit `capacitor.config.ts` to customize:
- App ID: `com.tovrika.pos`
- App Name: `Tovrika POS`
- Web directory: `dist/pos-system/browser`
- Plugin configurations

## Troubleshooting

### Android

**Gradle Build Failed**
```bash
cd android
./gradlew clean
cd ..
npm run android:build
```

**SDK/JDK Issues**
- Open Android Studio
- Go to **File > Project Structure**
- Set JDK to version 17
- Set Android SDK to API 33+

### iOS

**CocoaPods Error**
```bash
cd ios/App
pod repo update
pod install
cd ../..
npm run ios:build
```

**Code Signing Issues**
- Open Xcode
- Select project > Signing & Capabilities
- Select your team
- Enable "Automatically manage signing"

## Firebase Configuration

For mobile apps, ensure Firebase is configured:

1. **Android**: Place `google-services.json` in `android/app/`
2. **iOS**: Place `GoogleService-Info.plist` in `ios/App/App/`

Download these files from Firebase Console:
- Project Settings > Your apps > Download config file

## App Icons & Splash Screen

### Generate Assets
Use [Capacitor Asset Generator](https://github.com/ionic-team/capacitor-assets):

```bash
npm install -g @capacitor/assets
```

Place your icon and splash:
- `resources/icon.png` (1024x1024)
- `resources/splash.png` (2732x2732)

Generate assets:
```bash
npx capacitor-assets generate
```

## Production Build

### Android (Play Store)
1. Build signed bundle in Android Studio
2. Go to **Build > Generate Signed Bundle / APK**
3. Select **Android App Bundle**
4. Create/select keystore
5. Upload to Google Play Console

### iOS (App Store)
1. Archive in Xcode: **Product > Archive**
2. Select archive and click **Distribute App**
3. Follow App Store distribution wizard
4. Upload to App Store Connect

## Live Reload (Development)

For faster development, use live reload:

```bash
# Start dev server
npm start

# In capacitor.config.ts, add:
server: {
  url: 'http://192.168.x.x:4200',
  cleartext: true
}

# Sync and open
npm run android:open
```

Replace `192.168.x.x` with your computer's IP address.

## Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Android Studio Guide](https://developer.android.com/studio/intro)
- [Xcode Guide](https://developer.apple.com/xcode/)
- [Firebase Setup](https://firebase.google.com/docs/android/setup)
