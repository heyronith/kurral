# 🔧 OpenAI Proxy Setup Fix

## ❓ Why do we use a Proxy?

**Safety & Security.**
If you put your OpenAI API key directly in your frontend code (React/Javascript), it is sent to every user's browser. Anyone can:
1. Right-click → "Inspect Element" or "View Source"
2. Find your API key (starts with `sk-...`)
3. Use your key for their own apps, draining your bank account or credits.

**The Solution:**
We use a **Proxy** (a small server function running on Vercel).
1. Your frontend talks to the Proxy (no key needed).
2. The Proxy adds the API key (stored securely in Vercel).
3. The Proxy talks to OpenAI.
4. OpenAI responds to the Proxy.
5. The Proxy sends the answer back to your frontend.

This way, the key never leaves Vercel's secure servers.

## ❌ Current Error

You're seeing this error:
```
POST https://www.mykural.app/api/openai-proxy 500 (Internal Server Error)
[BaseAgent] OpenAI error: Error: Server error: OpenAI proxy is not configured. Please contact support.
```
OR
```
Failed to proxy request to OpenAI API
```

## ✅ Root Cause

The `OPENAI_API_KEY` environment variable is **not set** in your Vercel deployment.

## 🚀 Quick Fix (5 minutes)

### Step 1: Get Your OpenAI API Key
- Go to https://platform.openai.com/api-keys
- Copy your API key (starts with `sk-...`)
- If you don't have one, create a new secret key

### Step 2: Add to Vercel
1. Go to https://vercel.com/dashboard
2. Select your project (`Dumbfeed` or `mykural`)
3. Click **Settings** → **Environment Variables**
4. Click **Add New**
5. Fill in:
   - **Name:** `OPENAI_API_KEY`
   - **Value:** `sk-...` (paste your key)
   - **Environment:** Select all three:
     - ✅ Production
     - ✅ Preview  
     - ✅ Development
6. Click **Save**

### Step 3: Redeploy
1. Go to **Deployments** tab
2. Click the **⋯** menu on the latest deployment
3. Click **Redeploy**
4. Wait for deployment to complete (~2-3 minutes)

### Step 4: Verify
Run this command to check if it's working:
```bash
node scripts/verify-openai-proxy-setup.js https://www.mykural.app
```

Or visit in browser:
```
https://www.mykural.app/api/openai-proxy-health
```

You should see:
```json
{
  "status": "configured",
  "message": "OpenAI API key is configured"
}
```

## 🧪 Test the Fix

1. Go to your deployed app: https://www.mykural.app
2. Try onboarding a user (Step 2)
3. Check browser console - should see:
   ```
   [BaseAgent] Calling OpenAI API (via proxy) with model: gpt-4o-mini
   [BaseAgent] OpenAI response received, length: XXX
   ```
4. No more 500 errors! ✅

## 🔍 Troubleshooting

### Still seeing 500 error after setup?
1. **Check Vercel logs:**
   - Vercel Dashboard → Your Project → Functions → `openai-proxy` → Logs
   - Look for `[openai-proxy] OPENAI_API_KEY not found`

2. **Verify environment variable:**
   - Settings → Environment Variables
   - Make sure `OPENAI_API_KEY` exists
   - Make sure it's enabled for **Production** environment

3. **Check deployment:**
   - Make sure you redeployed AFTER adding the env var
   - Environment variables only apply to NEW deployments

4. **Test health endpoint:**
   ```bash
   curl https://www.mykural.app/api/openai-proxy-health
   ```

### Error: "Method not allowed" on health check?
- The health endpoint should accept GET requests
- If you see 405, the file might not be deployed yet
- Redeploy and try again

## 📝 What Changed

I've improved the error messages to be more helpful:
- ✅ Better error messages that explain the issue
- ✅ Health check endpoint: `/api/openai-proxy-health`
- ✅ Verification script: `scripts/verify-openai-proxy-setup.js`
- ✅ **Improved Proxy Code:** Now handles non-JSON errors from OpenAI more gracefully.

## 🎯 Next Steps After Fix

Once the proxy is working:
1. Test onboarding flow end-to-end
2. Check that interests are being extracted correctly
3. Monitor Vercel function logs for any issues

---

**Need help?** Check Vercel function logs or run the verification script.
