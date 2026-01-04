# Mobile App Setup Guide - Quick Reference

## ✅ Verification

Run the verification script to check your setup:

```bash
./verify-rn-setup.sh
```

## 🚀 Quick Start

### Step 1: Create Mobile App Folder

```bash
cd /Users/ronny/Desktop/Dumbfeed
mkdir -p mobile
cd mobile
```

### Step 2: Initialize React Native Project

**Option A: Expo (Recommended - Easier to start)**

```bash
npx create-expo-app@latest . --template blank-typescript
```

**Option B: React Native CLI (More control)**

```bash
npx react-native@latest init KuralMobile --directory . --template react-native-template-typescript
```

### Step 3: Install Dependencies

```bash
npm install
```

### Step 4: Start Development Server

```bash
# Start Metro bundler
npm start

# In another terminal, run iOS simulator
npm run ios
# OR press 'i' in the Metro bundler terminal
```

## 📱 Running the App

### iOS Simulator

```bash
cd mobile
npm run ios
```

**First time setup:**
- Make sure iOS Simulator is available (comes with Xcode)
- Open Simulator: `open -a Simulator`

### Physical Device (iOS)

1. Install Expo Go app from App Store
2. Run `npm start` in mobile folder
3. Scan QR code with Expo Go app

## 🔧 Development Workflow

1. **Start Metro Bundler:**
   ```bash
   cd mobile
   npm start
   ```

2. **Make changes:**
   - Edit files in `mobile/src/`
   - Changes hot-reload automatically
   - Press `r` in Metro terminal to reload
   - Press `Cmd+R` in Simulator to reload

3. **Stop server:**
   - Press `Ctrl+C` in Metro terminal

## 🐛 Troubleshooting

### Metro Bundler Port Already in Use

```bash
lsof -ti:8081 | xargs kill -9
```

### Clear Cache and Restart

```bash
npm start -- --reset-cache
```

### iOS Build Issues

```bash
cd mobile/ios
pod install
cd ..
npm run ios
```

### Reinstall Dependencies

```bash
cd mobile
rm -rf node_modules
npm install
```

## 📚 Next Steps

1. ✅ Verify setup with `./verify-rn-setup.sh`
2. ✅ Create and initialize mobile folder
3. ✅ Test running app in iOS Simulator
4. ✅ Proceed to Phase 0: Foundation & Setup (see MOBILE_APP_DEVELOPMENT_PLAN.md)

## 📖 Full Documentation

See `MOBILE_APP_DEVELOPMENT_PLAN.md` for:
- Complete development plan
- Phase-by-phase implementation guide
- Tech stack details
- Code reusability breakdown

