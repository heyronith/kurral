# Platform Accounts Setup Guide

## Overview

This guide explains how to create and manage the official platform accounts: **Kural** and **Kural News**. These accounts are used for platform announcements, news updates, and official communications.

## Quick Start

### 1. Create Platform Accounts

Run the script to create both platform accounts:

```bash
npm run create:platform
```

This will:
- Create Firebase Auth accounts for both "Kural" and "Kural News"
- Create Firestore user documents with proper configuration
- Generate secure passwords (if not provided)
- Mark accounts as platform accounts with special flags

### 2. Save Credentials

The script will output credentials. **SAVE THESE SECURELY**:

```
✅ kural:
   User ID: abc123...
   Email: platform@kurral.app
   Password: [generated password]
   ⚠️  SAVE THIS PASSWORD SECURELY!

✅ kuralnews:
   User ID: def456...
   Email: news@kurral.app
   Password: [generated password]
   ⚠️  SAVE THIS PASSWORD SECURELY!
```

### 3. Store in Environment Variables (Recommended)

For production and automation, store passwords in environment variables:

```bash
# Add to .env file (or Vercel environment variables)
KURAL_PLATFORM_EMAIL=platform@kurral.app
KURAL_PLATFORM_PASSWORD=your-secure-password-here
KURAL_NEWS_EMAIL=news@kurral.app
KURAL_NEWS_PASSWORD=your-secure-password-here
```

Then run the script again - it will use the provided passwords instead of generating new ones.

## Account Details

### Kural (Main Platform Account)
- **Handle:** `@kural`
- **Email:** `platform@kurral.app` (configurable)
- **Purpose:** Platform announcements, updates, community highlights
- **Bio:** "Official Kural platform account. Updates, announcements, and community highlights."
- **Interests:** platform, announcements, community

### Kural News
- **Handle:** `@kuralnews`
- **Email:** `news@kurral.app` (configurable)
- **Purpose:** Curated news, updates, important information
- **Bio:** "Official Kural News account. Curated news, updates, and important information."
- **Interests:** news, updates, information

## Platform Account Features

Platform accounts are marked with special flags in Firestore:

```javascript
{
  isPlatformAccount: true,
  platformAccountType: 'main' | 'news',
  kurralScore: {
    score: 100, // High starting score
    // ... other components
  },
  onboardingCompleted: true,
  // ... other fields
}
```

## Production Viability

### ✅ **YES - This is Production-Ready**

**Why it's viable:**

1. **Idempotent Script**
   - Can run multiple times safely
   - Won't create duplicate accounts
   - Updates existing accounts if they exist

2. **Secure Password Generation**
   - Generates cryptographically secure passwords (32 characters)
   - Includes uppercase, lowercase, numbers, and special characters
   - Can use environment variables for fixed passwords

3. **Proper Account Setup**
   - Creates both Firebase Auth and Firestore documents
   - Sets up all required fields (kurralScore, forYouConfig, etc.)
   - Marks accounts as platform accounts for special handling

4. **Error Handling**
   - Handles existing accounts gracefully
   - Provides clear error messages
   - Validates Firebase configuration

5. **Production Best Practices**
   - Uses environment variables for configuration
   - Stores credentials securely
   - Can be automated in CI/CD
   - Follows existing codebase patterns

### Security Considerations

1. **Password Storage**
   - ✅ Store passwords in environment variables (not in code)
   - ✅ Use a password manager for manual access
   - ✅ Rotate passwords periodically
   - ✅ Never commit passwords to Git

2. **Access Control**
   - Platform accounts should have limited access
   - Consider using Firebase Custom Claims for special permissions
   - Monitor account activity

3. **Email Verification**
   - Set up email verification for platform accounts
   - Use dedicated email addresses (platform@kurral.app, news@kurral.app)
   - Configure email forwarding if needed

## Usage Examples

### Manual Account Creation

```bash
# Create accounts with auto-generated passwords
npm run create:platform

# Create accounts with custom passwords (via .env)
KURAL_PLATFORM_PASSWORD=my-secure-password-123 \
KURAL_NEWS_PASSWORD=another-secure-password-456 \
npm run create:platform
```

### Automated Setup (CI/CD)

```bash
# In your deployment script
export KURAL_PLATFORM_PASSWORD=$(openssl rand -base64 32)
export KURAL_NEWS_PASSWORD=$(openssl rand -base64 32)
npm run create:platform
```

### Updating Existing Accounts

The script is idempotent - running it again will:
- Keep existing Firebase Auth accounts
- Update Firestore documents with latest configuration
- Preserve existing data (posts, followers, etc.)

## Troubleshooting

### Error: "Email already in use"
- Account already exists
- Script will sign in and update the account
- If password is wrong, reset it in Firebase Console

### Error: "Missing Firebase environment variables"
- Ensure `.env` file has all required Firebase config
- Check: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`

### Error: "Cannot access existing account"
- Password may be incorrect
- Reset password in Firebase Console
- Or provide correct password via environment variable

## Next Steps

After creating platform accounts:

1. **Verify Accounts**
   - Sign in to both accounts in the app
   - Verify handles are correct (@kural, @kuralnews)
   - Check that platform account flags are set

2. **Set Up Profile Pictures**
   - Upload profile pictures for both accounts
   - Use official Kural branding

3. **Configure Automation** (Optional)
   - Set up automated posting for news account
   - Configure announcement workflows
   - Set up monitoring/alerts

4. **Document Access**
   - Document who has access to these accounts
   - Set up access rotation schedule
   - Create backup access procedures

## Script Output Example

```
🚀 Creating Platform Accounts
============================================================

📝 Creating platform account: Kural (@kural)
   Email: platform@kurral.app
   ✅ Firebase Auth account created (UID: abc123...)
   ✅ Created Firestore user document
   ✅ Platform account ready:
      - Name: Kural
      - Handle: @kural
      - Email: platform@kurral.app
      - Platform Account: Yes
      - Type: main
      - Onboarding: Completed

📝 Creating platform account: Kural News (@kuralnews)
   Email: news@kurral.app
   ✅ Firebase Auth account created (UID: def456...)
   ✅ Created Firestore user document
   ✅ Platform account ready:
      - Name: Kural News
      - Handle: @kuralnews
      - Email: news@kurral.app
      - Platform Account: Yes
      - Type: news
      - Onboarding: Completed

============================================================
📊 Summary:
============================================================

✅ kural:
   User ID: abc123...
   Email: platform@kurral.app
   Password: Xy9$mK2pL8qR4tW6vN1bC3dF5gH7jJ0
   ⚠️  SAVE THIS PASSWORD SECURELY!

✅ kuralnews:
   User ID: def456...
   Email: news@kurral.app
   Password: Zp2$nL9qM5rT8wV3xN6bD4fG8hK1jJ7
   ⚠️  SAVE THIS PASSWORD SECURELY!

📝 Next Steps:
   1. Save the passwords securely (use a password manager)
   2. Store credentials in environment variables for automation:
      KURAL_PLATFORM_PASSWORD=Xy9$mK2pL8qR4tW6vN1bC3dF5gH7jJ0
      KURAL_NEWS_PASSWORD=Zp2$nL9qM5rT8wV3xN6bD4fG8hK1jJ7
   3. These accounts can now be used for platform announcements
   4. Consider setting up automated posting for news account

✅ Platform account creation complete!
```

---

**Status:** ✅ Production-ready script available  
**Command:** `npm run create:platform`  
**Documentation:** This file

