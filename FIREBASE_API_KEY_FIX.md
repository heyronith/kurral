# Fixing Firebase API Key Expired Error

## Problem
You're seeing: `Firebase: Error (auth/api-key-expired.-please-renew-the-api-key.)`

This means your Firebase API key in the environment variables has expired and needs to be renewed.

## Solution: Get a New API Key from Firebase Console

### Step 1: Go to Firebase Console
1. Open [Firebase Console](https://console.firebase.google.com/)
2. Select your project (check `.firebaserc` file for project ID)

### Step 2: Get Your Firebase Config
1. In Firebase Console, click the **gear icon** ⚙️ next to "Project Overview"
2. Select **Project settings**
3. Scroll down to **Your apps** section
4. If you have a web app, click on it. If not, click **Add app** → **Web** (</> icon)
5. You'll see your Firebase configuration object like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

### Step 3: Update Your Local Environment File

Your environment file is located at: `env/.env`

Update the following variables with the new values from Firebase Console:

```env
VITE_FIREBASE_API_KEY=AIzaSy... (new API key from Firebase)
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

### Step 4: Restart Your Dev Server

After updating the `.env` file:
1. Stop your dev server (Ctrl+C)
2. Restart it: `npm run dev`

### Step 5: Rebuild (if using production build)

If you're using a production build:
```bash
npm run build
```

## Alternative: Regenerate API Key (if needed)

If you need to regenerate the API key entirely:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Navigate to **APIs & Services** → **Credentials**
4. Find your Firebase Web API Key
5. Click on it to edit
6. You can either:
   - **Regenerate** the key (creates a new one, old one stops working)
   - **Restrict** the key to specific APIs/domains for security

## Important Notes

⚠️ **Security**: The API key is exposed in the browser (it's a public key). Firebase security rules protect your data, not the API key itself.

✅ **Best Practice**: 
- Use API key restrictions in Google Cloud Console
- Restrict by HTTP referrer (your domain)
- Restrict by API (only enable Firebase APIs you need)

## Verify It's Working

After updating, check the browser console. You should see:
```
[Firebase] Successfully initialized
[Firebase] Services initialized
```

If you still see errors, double-check:
1. All environment variables are set correctly
2. No typos in the API key
3. The API key matches the project ID
4. You've restarted the dev server after changes

