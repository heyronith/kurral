# Production Setup Guide for Value Pipeline API

## Overview
The value pipeline now uses a server-side API endpoint (`/api/process-chirp-value`) that works in both development and production for iOS and Android.

## Production Configuration

### 1. Vercel Deployment
The API endpoint (`/api/process-chirp-value.js`) is automatically deployed with your Vercel deployment. Ensure:
- ✅ Your Vercel project is connected to your repository
- ✅ Environment variables are set in Vercel Dashboard (if needed)
- ✅ The API endpoint is accessible at `https://your-app.vercel.app/api/process-chirp-value`

### 2. Mobile App Configuration

#### Option A: Using EAS Build (Recommended)
Set environment variables in EAS:

```bash
# Set API base URL (replace with your Vercel URL)
eas secret:create --scope project --name EXPO_PUBLIC_API_BASE_URL --value https://your-app.vercel.app

# Or if using OpenAI proxy URL, set that instead
eas secret:create --scope project --name EXPO_PUBLIC_OPENAI_PROXY_URL --value https://your-app.vercel.app/api/openai-proxy
```

The app will automatically derive the API base URL from the OpenAI proxy URL if `EXPO_PUBLIC_API_BASE_URL` is not set.

#### Option B: Using app.config.js
Update `mobile/app.config.js` to hardcode production URLs:

```javascript
extra: {
  // ... other config ...
  EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL || 'https://your-app.vercel.app',
  EXPO_PUBLIC_OPENAI_PROXY_URL: process.env.EXPO_PUBLIC_OPENAI_PROXY_URL || 'https://your-app.vercel.app/api/openai-proxy',
}
```

#### Option C: Using app.json (Static)
For static configuration, update `mobile/app.json`:

```json
{
  "expo": {
    "extra": {
      "EXPO_PUBLIC_API_BASE_URL": "https://your-app.vercel.app",
      "EXPO_PUBLIC_OPENAI_PROXY_URL": "https://your-app.vercel.app/api/openai-proxy"
    }
  }
}
```

### 3. Build Commands

#### iOS Production Build
```bash
cd mobile
eas build --platform ios --profile production
```

#### Android Production Build
```bash
cd mobile
eas build --platform android --profile production
```

### 4. Testing Production Builds

Before releasing, test that the API endpoint works:

1. **Test API Endpoint Directly:**
   ```bash
   curl -X POST https://your-app.vercel.app/api/process-chirp-value \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_FIREBASE_ID_TOKEN" \
     -d '{"chirp": {"id": "test", "text": "test", "authorId": "test"}, "options": {}}'
   ```

2. **Test in Development Build:**
   - Set `EXPO_PUBLIC_API_BASE_URL` in your `.env` file
   - Run `expo start` and test the app
   - Check console logs for API calls

3. **Test in Production Build:**
   - Build with EAS using production profile
   - Install on device/simulator
   - Test creating a chirp and verify value pipeline runs

## Troubleshooting

### Issue: "API base URL is not configured"
**Solution:** Ensure `EXPO_PUBLIC_API_BASE_URL` or `EXPO_PUBLIC_OPENAI_PROXY_URL` is set in:
- EAS secrets (for EAS builds)
- `app.config.js` (for local builds)
- `.env` file (for development)

### Issue: "Failed to import valuePipelineService" (Server Error)
**Solution:** 
- Ensure Vercel has access to `src/webapp/lib/services/valuePipelineService.js`
- Check Vercel build logs for import errors
- Verify the file exists and exports `processChirpValue` function

### Issue: "Unauthorized" Error
**Solution:**
- Ensure Firebase authentication is working
- Check that Firebase ID token is being sent in Authorization header
- Verify Firebase project configuration matches between mobile and webapp

### Issue: API Calls Fail in Production
**Solution:**
- Check network connectivity on device
- Verify API URL is correct (no typos, correct protocol https://)
- Check Vercel function logs for errors
- Ensure CORS is configured correctly (should be handled by Vercel)

## Environment Variables Summary

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `EXPO_PUBLIC_API_BASE_URL` | No* | Base URL for API endpoints | `https://your-app.vercel.app` |
| `EXPO_PUBLIC_OPENAI_PROXY_URL` | No* | OpenAI proxy URL (used as fallback) | `https://your-app.vercel.app/api/openai-proxy` |

*At least one must be set. If `EXPO_PUBLIC_API_BASE_URL` is not set, the app will derive it from `EXPO_PUBLIC_OPENAI_PROXY_URL`.

## Production Checklist

- [ ] Vercel deployment is live and accessible
- [ ] API endpoint `/api/process-chirp-value` responds correctly
- [ ] Environment variables set in EAS or app.config.js
- [ ] Tested iOS production build
- [ ] Tested Android production build
- [ ] Firebase authentication works in production
- [ ] Value pipeline processes chirps correctly
- [ ] Error handling works (network failures, API errors)
- [ ] Rate limiting doesn't block legitimate users

