#!/bin/bash

# Deploy Firestore rules and indexes
# Make sure you're logged in: firebase login
# Make sure .firebaserc has your project ID

echo "🚀 Deploying Firestore rules and indexes..."

# Check if firebase-tools is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Installing..."
    npm install -g firebase-tools
fi

# Check if logged in
if ! firebase projects:list &> /dev/null; then
    echo "❌ Not logged in to Firebase. Please run: firebase login"
    exit 1
fi

# Deploy rules
echo "📝 Deploying Firestore rules..."
firebase deploy --only firestore:rules

# Deploy indexes
echo "📊 Deploying Firestore indexes..."
firebase deploy --only firestore:indexes

echo "✅ Firestore deployment complete!"

