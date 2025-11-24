# Debugging Reach Suggestions

## The Issue
You're seeing "Using default settings based on topic" which means the AI fallback is being used instead of actual AI suggestions.

## Steps to Debug

### 1. Verify API Key is Loaded
Open browser console (F12) and check the logs when you type in composer. You should see:
```
[Composer] ReachAgent available: true/false
[Composer] BaseAgent available: true/false
[Composer] API Key in env: true/false
```

### 2. Restart Dev Server
**IMPORTANT**: After changing `.env` file, you MUST restart the dev server:
1. Stop server (Ctrl+C)
2. Run `npm run dev` again
3. Refresh browser

### 3. Check Console for Errors
Look for:
- `[ReachAgent] Error generating suggestion:` - Shows the actual error
- Network errors in Network tab
- CORS or API errors

### 4. Verify API Key Format
Your API key should look like: `AIzaSy...` (starts with AIza)
Make sure there are:
- No quotes around it
- No extra spaces
- No `your_gemini_api_key_here` placeholder

### 5. Test API Key Directly
If API key is invalid, you'll see errors like:
- `API key not valid`
- `PERMISSION_DENIED`
- `Invalid API key`

## Quick Fix Checklist

- [ ] API key set in `.env` file (no placeholder)
- [ ] Dev server restarted after changing `.env`
- [ ] Browser refreshed (hard refresh: Cmd+Shift+R / Ctrl+Shift+R)
- [ ] Check browser console for errors
- [ ] API key starts with `AIzaSy`

## Next Steps

After restarting and checking console, try typing in composer again. The console logs will tell us exactly what's happening.

