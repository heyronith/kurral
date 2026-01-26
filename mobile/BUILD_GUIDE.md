# Building and Testing on Real Device - Production Guide

## Quick Summary

You have three build profiles configured in `eas.json`:
- **development**: For development testing with Expo Dev Client
- **preview**: For internal testing (recommended for real device testing)
- **production**: For App Store/Play Store submission

## Recommended Approach for Testing

For testing on a real device, use the **preview** build profile. It's easier to install than production builds.

## Step-by-Step Guide

### 1. Navigate to Mobile Directory

```bash
cd /Users/ronny/Desktop/Dumbfeed/mobile
```

### 2. Ensure You're Logged into EAS

```bash
eas login
```

If you're not logged in, it will prompt you to sign in with your Expo account.

### 3. Choose Your Build Profile

#### Option A: Preview Build (Recommended for Testing)

```bash
# For iOS
eas build --platform ios --profile preview

# For Android
eas build --platform android --profile preview

# For both platforms
eas build --platform all --profile preview
```

#### Option B: Production Build (For App Store Submission)

```bash
# For iOS
eas build --platform ios --profile production

# For Android
eas build --platform android --profile production
```

### 4. Follow the Build Prompts

The EAS CLI will ask you questions:
- **iOS**: 
  - If you want to configure credentials automatically (recommended: Yes)
  - If this is your first build, you may need to set up Apple Developer account
- **Android**:
  - If you want to use Google Play Store credentials (recommended: Yes for production, No for preview)

### 5. Wait for Build to Complete

Builds typically take 10-20 minutes. You'll see:
- Build progress in the terminal
- You can also check: https://expo.dev/accounts/[your-account]/builds

### 6. Install on Device

#### For iOS Preview Build:

1. After build completes, you'll get a URL or QR code
2. Open the URL on your iPhone (or scan QR code)
3. Install the build through TestFlight (if configured) or direct download
4. You may need to trust the developer certificate in iOS Settings

#### For Android Preview Build:

1. Download the `.apk` or `.aab` file from the build page
2. Enable "Install from Unknown Sources" on your Android device
3. Transfer the file to your device and install it
4. Or use the download link directly on your device

#### For Production Builds:

- **iOS**: Submit to App Store Connect via `eas submit --platform ios`
- **Android**: Submit to Google Play Console via `eas submit --platform android`

## Alternative: Local Development Build (Faster for Testing)

If you want to test quickly without waiting for cloud builds:

### Install Development Build Locally:

```bash
# For iOS (requires Xcode and Mac)
cd ios
pod install
cd ..
npx expo run:ios --device

# For Android (requires Android Studio)
npx expo run:android --device
```

Note: This requires:
- iOS: Xcode, Apple Developer account, device connected via USB
- Android: Android Studio, USB debugging enabled, device connected

## Troubleshooting

### Build Fails

1. Check error messages in terminal
2. Verify credentials are set up correctly
3. Check EAS build logs: https://expo.dev/accounts/[your-account]/builds

### Can't Install on Device

- **iOS**: 
  - Ensure device is registered in Apple Developer account
  - Check device UDID is added to provisioning profile
- **Android**:
  - Enable "Install from Unknown Sources"
  - Check device has sufficient storage

### Environment Variables

Make sure your `.env` file in the `mobile` directory has all required variables:
- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- etc.

## Next Steps After Testing

1. **Fix any issues** found during testing
2. **Create production build** when ready for submission:
   ```bash
   eas build --platform all --profile production
   ```
3. **Submit to stores**:
   ```bash
   eas submit --platform ios
   eas submit --platform android
   ```

## Useful Commands

```bash
# Check build status
eas build:list

# View build details
eas build:view [build-id]

# Cancel a running build
eas build:cancel [build-id]

# Update EAS CLI
npm install -g eas-cli@latest
```

## Additional Resources

- EAS Build Docs: https://docs.expo.dev/build/introduction/
- EAS Submit Docs: https://docs.expo.dev/submit/introduction/
- Expo Dashboard: https://expo.dev

