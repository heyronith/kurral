# Platform Accounts Troubleshooting Guide

## Issue: "Invalid Credentials" When Signing In

### Common Causes & Solutions

#### 1. **Email Mismatch** ⚠️ MOST COMMON

**Problem:** The email in your `.env` file doesn't match the email used when creating the account.

**Check:**
- Accounts were created with: `platform@kurral.app` and `news@kurral.app`
- Your `.env` might have: `platform@kural.app` (missing 'r')

**Solution:**
```bash
# Update .env file to match the actual emails:
KURAL_PLATFORM_EMAIL=platform@kurral.app
KURAL_NEWS_EMAIL=news@kurral.app
```

#### 2. **Password Copy/Paste Issues** ⚠️ VERY COMMON

**Problem:** Special characters in passwords can get mangled when copying from terminal.

**Common Issues:**
- `*` might become `*` or `×`
- `#` might become `#` or `♯`
- `@` might become `@` or `@`
- `^` might become `^` or `ˆ`
- Hidden spaces at the end

**Solution:**
1. **Use the verification script:**
   ```bash
   npm run verify:platform
   ```
   This will test if the passwords work.

2. **If passwords don't work, reset them:**
   ```bash
   npm run verify:platform --reset-passwords
   ```
   This sends password reset emails (if email addresses are real).

3. **Or manually set simpler passwords:**
   ```bash
   # Add to .env with simpler passwords
   KURAL_PLATFORM_PASSWORD=SimplePassword123!
   KURAL_NEWS_PASSWORD=AnotherPassword456!
   
   # Then recreate accounts
   npm run create:platform
   ```

#### 3. **Email Verification Required**

**Problem:** Firebase might require email verification before sign-in.

**Check:**
```bash
npm run verify:platform
```

Look for: `Email Verified: No`

**Solution:**
- If emails are real (`@kurral.app` domain), check inbox for verification email
- If emails are not real, you need to either:
  1. Use real email addresses you control
  2. Disable email verification in Firebase Console
  3. Use Firebase Admin SDK to mark emails as verified

#### 4. **Account Disabled**

**Problem:** Account might be disabled in Firebase Console.

**Check:**
```bash
npm run verify:platform
```

Look for: `Disabled: Yes`

**Solution:**
- Go to Firebase Console → Authentication → Users
- Find the account and enable it

## Step-by-Step Fix

### Step 1: Verify Current State

```bash
npm run verify:platform
```

This will tell you:
- ✅ If accounts can sign in
- ❌ What the specific error is
- Email verification status
- Account disabled status

### Step 2: Fix Email Mismatch

Update your `.env` file to match the actual emails:

```env
# Make sure these match what was used during account creation
KURAL_PLATFORM_EMAIL=platform@kurral.app
KURAL_NEWS_EMAIL=news@kurral.app
```

### Step 3: Fix Password Issues

**Option A: Use Verification Script**
```bash
# Test current passwords
npm run verify:platform

# If they fail, reset passwords
npm run verify:platform --reset-passwords
```

**Option B: Set New Simple Passwords**
```env
# Add to .env with simpler passwords (no special characters that might get mangled)
KURAL_PLATFORM_PASSWORD=KuralPlatform2024!
KURAL_NEWS_PASSWORD=KuralNews2024!
```

Then recreate:
```bash
npm run create:platform
```

**Option C: Use Firebase Console**
1. Go to Firebase Console → Authentication → Users
2. Find the account
3. Click "Reset Password"
4. Enter new password
5. Update `.env` file

### Step 4: Verify Fix

```bash
npm run verify:platform
```

Should show: `✅ Sign in successful!`

## Quick Fix Commands

### Check What's Wrong
```bash
npm run verify:platform
```

### Reset Passwords (if emails are real)
```bash
npm run verify:platform --reset-passwords
```

### Recreate with New Passwords
```bash
# 1. Update .env with new passwords
# 2. Run:
npm run create:platform
```

### Test Sign-In in App
1. Go to login page
2. Use email: `platform@kurral.app` or `news@kurral.app`
3. Use password from `.env` file (copy carefully!)

## Password Best Practices

For platform accounts, use passwords that:
- ✅ Are long (20+ characters)
- ✅ Have uppercase, lowercase, numbers
- ✅ Have minimal special characters (to avoid copy/paste issues)
- ✅ Are stored in `.env` file
- ✅ Are stored in password manager

**Recommended Format:**
```
KuralPlatform2024Secure!
KuralNews2024Secure!
```

## Email Address Considerations

### If Using Fake Emails (`@kurral.app`)

**Limitations:**
- ❌ Can't receive password reset emails
- ❌ Can't receive verification emails
- ⚠️ Might be blocked by Firebase if domain doesn't exist

**Solutions:**
1. **Use real email addresses you control:**
   ```env
   KURAL_PLATFORM_EMAIL=platform@yourdomain.com
   KURAL_NEWS_EMAIL=news@yourdomain.com
   ```

2. **Or disable email verification in Firebase Console:**
   - Firebase Console → Authentication → Settings
   - Disable "Email link (passwordless sign-in)"
   - This might not help if emails are completely invalid

3. **Or use Firebase Admin SDK to verify emails programmatically**

### If Using Real Emails

✅ Can receive password reset emails  
✅ Can receive verification emails  
✅ Full Firebase functionality

## Current Account Status

Based on your terminal output:

**Kural Account:**
- Email: `platform@kurral.app`
- User ID: `xQyeQdCpekfcPs0YpLYyHBL42XH2`
- Password: `yQX*T6fR#Mt2e6H@0VPC#COAWXBCjZ9h`

**Kural News Account:**
- Email: `news@kurral.app`
- User ID: `dT5q0UfDStSph96NbW4Dr5JWcOy1`
- Password: `8q%s2pQsmfBf@5MvLW^kgpCXHCn5wGKw`

**Your .env has:**
- `platform@kural.app` ❌ (missing 'r' - should be `kurral.app`)
- `news@kural.app` ❌ (missing 'r' - should be `kurral.app`)

**Fix:** Update `.env` to use `kurral.app` (with double 'r')

## Still Having Issues?

1. **Run verification:**
   ```bash
   npm run verify:platform
   ```

2. **Check Firebase Console:**
   - Go to Firebase Console → Authentication → Users
   - Verify accounts exist
   - Check if they're disabled
   - Check email verification status

3. **Try simpler passwords:**
   - Update `.env` with simple passwords
   - Recreate accounts: `npm run create:platform`

4. **Use real email addresses:**
   - Update `.env` with real emails you control
   - Recreate accounts: `npm run create:platform`
   - Verify emails in inbox

---

**Quick Command Reference:**
- `npm run create:platform` - Create/update platform accounts
- `npm run verify:platform` - Verify accounts can sign in
- `npm run verify:platform --reset-passwords` - Send password reset emails

