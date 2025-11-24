# Firebase Storage Setup Instructions

## Issue
You're experiencing CORS errors when trying to upload images. This is because Firebase Storage needs to be enabled and configured in your Firebase project.

## Steps to Fix

### 1. Enable Firebase Storage
1. Go to [Firebase Console](https://console.firebase.google.com/project/chirp-web-7e581/storage)
2. Click on "Storage" in the left sidebar
3. Click "Get Started"
4. Choose "Start in production mode" (more secure, requires explicit rules)
5. Select a location for your storage bucket (choose the same region as your Firestore if possible)
6. Click "Done"

### 2. Deploy Storage Rules
✅ **Storage rules have been deployed!** The rules are configured for production mode with:

```bash
firebase deploy --only storage
```

Or deploy everything:
```bash
firebase deploy
```

### 3. Rules Configuration (Production Mode)
The storage rules file (`storage.rules`) is configured with the following permissions:
- **Read**: All authenticated users can view chirp images (needed for displaying posts)
- **Create**: Users can only upload to their own folder (`chirp-images/{userId}/`)
- **Update**: Users can only update their own images
- **Delete**: Users can only delete their own images
- **File size limit**: 5MB maximum
- **File type**: Images only
- **Default**: All other paths are denied (production security)

### 4. Test Upload
✅ **Storage is now configured!** Try uploading an image again. The CORS errors should be resolved.

## Troubleshooting

If you still see CORS errors after enabling Storage:
1. Make sure you're logged in (authentication is required)
2. Check that the storage rules were deployed successfully
3. Verify your Firebase project has Storage enabled in the console
4. Clear your browser cache and try again

## Rules File Location
The storage rules are in: `storage.rules`

You can view and edit them there, then redeploy with:
```bash
firebase deploy --only storage
```

