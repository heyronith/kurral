#!/bin/bash

# React Native Development Environment Verification Script
# This script checks if all required tools are installed and configured

echo "🔍 Verifying React Native Development Environment..."
echo ""

ERRORS=0
WARNINGS=0

# Check Node.js
echo -n "✓ Checking Node.js... "
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✅ Installed ($NODE_VERSION)"
else
    echo "❌ Not installed"
    ERRORS=$((ERRORS + 1))
fi

# Check npm
echo -n "✓ Checking npm... "
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo "✅ Installed ($NPM_VERSION)"
else
    echo "❌ Not installed"
    ERRORS=$((ERRORS + 1))
fi

# Check Watchman
echo -n "✓ Checking Watchman... "
if command -v watchman &> /dev/null; then
    WATCHMAN_VERSION=$(watchman --version)
    echo "✅ Installed ($WATCHMAN_VERSION)"
else
    echo "❌ Not installed (run: brew install watchman)"
    ERRORS=$((ERRORS + 1))
fi

# Check CocoaPods
echo -n "✓ Checking CocoaPods... "
if command -v pod &> /dev/null; then
    POD_VERSION=$(pod --version)
    echo "✅ Installed ($POD_VERSION)"
else
    echo "⚠️  Not installed (run: sudo gem install cocoapods)"
    WARNINGS=$((WARNINGS + 1))
fi

# Check Xcode
echo -n "✓ Checking Xcode... "
if command -v xcodebuild &> /dev/null; then
    XCODE_VERSION=$(xcodebuild -version 2>&1 | head -1)
    echo "✅ Installed ($XCODE_VERSION)"
else
    echo "❌ Not installed"
    ERRORS=$((ERRORS + 1))
fi

# Check xcode-select
echo -n "✓ Checking Xcode Command Line Tools... "
if xcode-select -p &> /dev/null; then
    XCODE_PATH=$(xcode-select -p)
    echo "✅ Configured ($XCODE_PATH)"
else
    echo "❌ Not configured (run: xcode-select --install)"
    ERRORS=$((ERRORS + 1))
fi

# Check Homebrew
echo -n "✓ Checking Homebrew... "
if command -v brew &> /dev/null; then
    echo "✅ Installed"
else
    echo "⚠️  Not installed (recommended but not required)"
    WARNINGS=$((WARNINGS + 1))
fi

# Check Expo CLI availability
echo -n "✓ Checking Expo CLI (via npx)... "
if npx expo --version &> /dev/null 2>&1; then
    echo "✅ Available (will install on first use)"
else
    echo "⚠️  Will be installed on first use (this is normal)"
    WARNINGS=$((WARNINGS + 1))
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo "✅ All checks passed! You're ready to start React Native development."
    echo ""
    echo "Next steps:"
    echo "  1. Create mobile folder: mkdir -p mobile && cd mobile"
    echo "  2. Initialize project: npx create-expo-app@latest . --template blank-typescript"
    echo "  3. Start development: npm start"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo "⚠️  Setup complete with $WARNINGS warning(s)."
    echo "You can proceed, but consider fixing the warnings above."
    exit 0
else
    echo "❌ Setup incomplete. Please fix $ERRORS error(s) and $WARNINGS warning(s) above."
    exit 1
fi

