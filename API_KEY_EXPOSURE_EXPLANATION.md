# Why Your API Key Is Exposed (Even in .env)

## The Problem

In **Vite**, any environment variable that starts with `VITE_` gets:
1. ✅ Read from `.env` file during build
2. ❌ **Bundled into your JavaScript bundle**
3. ❌ **Sent to every user's browser**
4. ❌ **Visible in DevTools → Sources → Your bundle.js**

## What This Means

When you write:
```typescript
const API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
```

Vite replaces this at build time with:
```javascript
const API_KEY = "sk-proj-abc123..."; // Your actual key!
```

This gets bundled into your JavaScript, and anyone can:
1. Open your website
2. Press F12 → Sources
3. Find your bundle.js
4. Search for "sk-proj"
5. Copy your API key
6. Use it to make unlimited API calls on your credit card

## The Solution

Move API calls to a **serverless function** (backend) where:
- ✅ Environment variables stay on the server
- ✅ Never sent to the browser
- ✅ Can add rate limiting
- ✅ Can add authentication

## Current vs Fixed Architecture

### ❌ CURRENT (INSECURE)
```
Browser → Direct OpenAI API call with exposed key
         (Key visible in JavaScript bundle)
```

### ✅ FIXED (SECURE)
```
Browser → Your Serverless Function → OpenAI API
         (Key stays on server, never exposed)
```
