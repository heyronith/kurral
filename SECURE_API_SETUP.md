# Secure API Key Setup Guide

## ✅ What We Fixed

Your OpenAI API key was being exposed in the browser JavaScript bundle. Now it's secure on the server.

## 🔧 Setup Instructions

### Step 1: Add API Key to Vercel Environment Variables

**Option A: Via Vercel Dashboard (Recommended)**

1. Go to your Vercel project dashboard
2. Click **Settings** → **Environment Variables**
3. Add a new variable:
   - **Name:** `OPENAI_API_KEY`
   - **Value:** Your OpenAI API key (starts with `sk-...`)
   - **Environment:** Select all (Production, Preview, Development)
4. Click **Save**

**Option B: Via Vercel CLI**

```bash
# Install Vercel CLI if you haven't
npm i -g vercel

# Add the environment variable
vercel env add OPENAI_API_KEY

# When prompted, paste your OpenAI API key
# Select all environments (production, preview, development)
```

### Step 2: Remove Old Environment Variable (Optional but Recommended)

Since we're no longer using `VITE_OPENAI_API_KEY` in the client, you can remove it:

1. Remove from `.env` file (if you have one)
2. Remove from Vercel environment variables (if it exists)
3. This prevents confusion

### Step 3: Deploy

```bash
# Deploy to Vercel
vercel --prod

# Or push to your main branch (if auto-deploy is enabled)
git push origin main
```

### Step 4: Test

1. Open your deployed app
2. Try creating a post (should trigger fact-checking)
3. Check browser console - should see `[BaseAgent] Calling OpenAI API (via proxy)`
4. If you see errors, check Vercel function logs

## 🔍 How to Verify It's Working

### Check 1: API Key Not in Bundle

1. Open your deployed site
2. Press F12 → Sources
3. Search for "sk-" in your JavaScript files
4. **Should find nothing** ✅

### Check 2: Proxy Function Works

1. Open browser DevTools → Network tab
2. Create a post
3. Look for request to `/api/openai-proxy`
4. Should return 200 OK ✅

### Check 3: Check Vercel Logs

```bash
# View function logs
vercel logs --follow

# Or check in Vercel dashboard:
# Project → Functions → openai-proxy → Logs
```

## 🚨 Troubleshooting

### Error: "Server configuration error"

**Problem:** `OPENAI_API_KEY` not set in Vercel

**Fix:**
1. Go to Vercel dashboard → Settings → Environment Variables
2. Add `OPENAI_API_KEY` with your OpenAI key
3. Redeploy

### Error: "Failed to proxy request"

**Problem:** Network issue or OpenAI API down

**Fix:**
1. Check Vercel function logs
2. Verify OpenAI API status: https://status.openai.com
3. Check your OpenAI account has credits

### Error: CORS issues

**Problem:** Proxy endpoint not accessible

**Fix:**
- Make sure `vercel.json` has the rewrite rule for `/api/*`
- Redeploy if you just added it

## 📝 What Changed

### Before (INSECURE):
```typescript
// Client-side code
const API_KEY = import.meta.env.VITE_OPENAI_API_KEY; // ❌ Exposed!
const openai = new OpenAI({ apiKey: API_KEY });
```

### After (SECURE):
```typescript
// Client-side code
fetch('/api/openai-proxy', { ... }); // ✅ No key exposed!

// Server-side code (api/openai-proxy.js)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // ✅ Secure!
```

## 🎯 Next Steps

1. ✅ Set `OPENAI_API_KEY` in Vercel
2. ✅ Deploy
3. ✅ Test
4. ✅ Remove `VITE_OPENAI_API_KEY` from client code (optional cleanup)

## 💡 Additional Security (Optional)

You can add rate limiting to the proxy:

```javascript
// In api/openai-proxy.js, add before the handler:
const rateLimitMap = new Map();

export default async function handler(req, res) {
  // Simple rate limiting by IP
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const maxRequests = 10; // per minute
  
  // ... rate limiting logic ...
}
```

But for beta, the current setup is sufficient!
