# Vercel Deployment Setup for Kurral

## Domain Configuration
- **Main App**: `kurral.online` (root `/`)
- **Landing Page**: `kurral.online/lp`

## Step 1: Deploy to Vercel

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel
   ```
   - Follow the prompts
   - When asked about linking to existing project, choose "No" for first deployment
   - When asked about production deployment, choose "Yes"

4. **Link to your project** (if you already have a Vercel project):
   ```bash
   vercel link
   ```

## Step 2: Configure Environment Variables

Go to your Vercel project dashboard: https://vercel.com/dashboard

1. Navigate to: **Settings** → **Environment Variables**

2. Add the following environment variables:

### Required Firebase Variables:
```
VITE_FIREBASE_API_KEY=your_firebase_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### Optional AI Variables (if using AI features):
```
VITE_OPENAI_API_KEY=your_openai_api_key_here
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

3. **Important**: 
   - Set each variable for **Production**, **Preview**, and **Development** environments
   - Click "Save" after adding each variable

## Step 3: Configure Custom Domain

1. Go to: **Settings** → **Domains**

2. Add your domain: `kurral.online`

3. Follow Vercel's DNS configuration instructions:
   - Add the required DNS records to your domain provider
   - Wait for DNS propagation (can take up to 24 hours, usually much faster)

4. Once verified, Vercel will automatically:
   - Issue SSL certificates
   - Configure HTTPS
   - Set up the domain

## Step 4: Build Settings (Already Configured)

The `vercel.json` file is already configured with:
- Build command: `npm run build`
- Output directory: `dist`
- Framework: Vite
- Proper routing for SPA

## Step 5: Redeploy After Adding Environment Variables

After adding environment variables, trigger a new deployment:

```bash
vercel --prod
```

Or redeploy from the Vercel dashboard:
- Go to **Deployments** tab
- Click the three dots on the latest deployment
- Select **Redeploy**

## Routing Structure

- `/` → Redirects to `/app` (main application)
- `/lp` → Landing page
- `/app` → Main application (requires authentication)
- `/login` → Login page
- `/signup` → Signup page
- All other routes → Handled by React Router

## Troubleshooting

### Build Fails
- Check that all environment variables are set
- Verify Node.js version (Vercel uses Node 18.x by default)
- Check build logs in Vercel dashboard

### Environment Variables Not Working
- Make sure variables start with `VITE_` (required for Vite)
- Redeploy after adding new variables
- Check that variables are set for the correct environment (Production/Preview/Development)

### Routing Issues
- The `vercel.json` rewrites all routes to `index.html` for SPA routing
- If routes don't work, check browser console for errors

## Security Notes

✅ **DO NOT** commit `.env` files to git
✅ **DO** use Vercel's environment variables for all secrets
✅ **DO** regenerate API keys if they were ever exposed in git history
✅ **DO** use different keys for development and production if possible

## Next Steps

1. Add environment variables in Vercel dashboard
2. Deploy to Vercel
3. Configure custom domain
4. Test the deployment
5. Set up monitoring and analytics (optional)

