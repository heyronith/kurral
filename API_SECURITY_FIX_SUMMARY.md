# API Security Fix - Summary

## ✅ What Was Fixed

Your OpenAI API key was being **exposed in the browser JavaScript bundle**. Anyone could:
1. Open your website
2. Press F12 → Sources
3. Search for "sk-" in your JavaScript
4. Copy your API key
5. Use it to make unlimited API calls on your credit card

## 🔧 Changes Made

### 1. Created Secure Proxy (`/api/openai-proxy.js`)
- Serverless function that proxies OpenAI API calls
- API key stays on server, never sent to browser
- Handles all OpenAI endpoints (chat, embeddings, responses)

### 2. Updated `baseAgent.ts`
- Removed direct OpenAI client initialization
- Now calls `/api/openai-proxy` instead
- Same interface, secure implementation

### 3. Updated `factCheckAgent.ts`
- Removed direct `openai.responses.create()` call
- Now uses proxy for web search feature

### 4. Updated `embeddingService.ts`
- Removed direct `openai.embeddings.create()` call
- Now uses proxy for embeddings

## 📋 What You Need To Do

### Step 1: Add API Key to Vercel

**Via Dashboard:**
1. Go to https://vercel.com → Your Project → Settings → Environment Variables
2. Add: `OPENAI_API_KEY` = `your-key-here`
3. Select all environments (Production, Preview, Development)
4. Save

**Via CLI:**
```bash
vercel env add OPENAI_API_KEY
# Paste your key when prompted
# Select all environments
```

### Step 2: Deploy

```bash
vercel --prod
```

### Step 3: Test

1. Open your deployed site
2. Create a post (should trigger fact-checking)
3. Check browser console - should see `[BaseAgent] Calling OpenAI API (via proxy)`
4. Verify: Press F12 → Sources → Search for "sk-" → Should find nothing ✅

## 🔍 Verification Checklist

- [ ] `OPENAI_API_KEY` added to Vercel environment variables
- [ ] Deployed to Vercel
- [ ] Tested creating a post (fact-checking works)
- [ ] Verified API key NOT in browser bundle (search for "sk-" in Sources)
- [ ] Checked Vercel function logs (no errors)

## 📁 Files Changed

```
✅ Created:
   - api/openai-proxy.js (new serverless function)
   - API_KEY_EXPOSURE_EXPLANATION.md (explanation)
   - SECURE_API_SETUP.md (setup guide)
   - API_SECURITY_FIX_SUMMARY.md (this file)

✅ Modified:
   - src/webapp/lib/agents/baseAgent.ts (uses proxy now)
   - src/webapp/lib/services/factCheckAgent.ts (uses proxy now)
   - src/webapp/lib/services/embeddingService.ts (uses proxy now)
```

## 🚨 Important Notes

1. **Remove old key from client:** You can now remove `VITE_OPENAI_API_KEY` from your `.env` file (it's no longer used)

2. **The proxy handles:**
   - `/v1/chat/completions` (regular chat)
   - `/v1/embeddings` (embeddings)
   - `/v1/responses` (web search)

3. **Error handling:** If the proxy isn't configured, you'll see clear error messages

4. **Cost control:** You can add rate limiting to the proxy later if needed

## ✅ After Setup: You're Beta-Ready!

Once you've:
1. Added `OPENAI_API_KEY` to Vercel
2. Deployed
3. Verified it works

Your infrastructure is **secure and ready for beta testing**! 🎉
