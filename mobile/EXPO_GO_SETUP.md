# Expo Go Setup - Clean Configuration

This mobile app is configured to work with **Expo Go** only (no development builds).

## What Was Removed

✅ **Development Build Dependencies:**
- `expo-dev-client` - Development build client
- `@react-native-firebase/*` - React Native Firebase packages (require native code)
- `expo-build-properties` - Build configuration plugin

✅ **Build Configuration Files:**
- `eas.json` - EAS Build configuration
- `BUILD_FIX_OPTIONS.md` - Build troubleshooting doc
- `cleanup-disk-space.sh` - Build cleanup script
- `GoogleService-Info.plist` - Firebase iOS config

✅ **Native Folders:**
- `ios/` - Native iOS project (development build only)
- `android/` - Native Android project (development build only)

✅ **Build Scripts:**
- `expo run:ios` - Development build command
- `expo run:android` - Development build command

## What Remains (Expo Go Compatible)

✅ **Core Dependencies:**
- `expo` - Expo SDK
- `firebase` - Firebase JavaScript SDK (works in Expo Go)
- `@react-navigation/*` - Navigation libraries (Expo Go compatible)
- `zustand` - State management
- `@react-native-async-storage/async-storage` - Storage (Expo Go compatible)
- `expo-image-picker` - Image picker (Expo Go compatible)

## Running the App

### Development (Expo Go)

```bash
# Start Expo development server
npm start

# Then:
# - Press 'i' to open iOS Simulator
# - Press 'a' to open Android Emulator
# - Scan QR code with Expo Go app on physical device
```

### Available Scripts

- `npm start` - Start Expo development server
- `npm run web` - Run in web browser

## Important Notes

⚠️ **Firebase:** Uses Firebase JavaScript SDK (`firebase` package), not React Native Firebase. This works in Expo Go but has some limitations compared to the native SDK.

⚠️ **Native Modules:** Cannot use any packages that require native code compilation. All dependencies must be Expo Go compatible.

⚠️ **No Native Builds:** Cannot create standalone builds or use TestFlight/Play Store distribution with this setup. To distribute, you'll need to switch to development builds later.

## When to Switch to Development Builds

If you need:
- React Native Firebase (better performance, offline support)
- Custom native modules
- Standalone app distribution (TestFlight, Play Store)
- Push notifications (FCM)

Then switch to Expo Development Builds (see MOBILE_APP_DEVELOPMENT_PLAN.md).

## Current Status

✅ Clean Expo Go setup
✅ All development build code removed
✅ Ready for Expo Go development

