// Firebase Storage service for image uploads
import { ref, uploadBytes, getDownloadURL, UploadResult, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

/**
 * Upload an image file to Firebase Storage for chirp posts
 * @param file - The image file to upload
 * @param userId - The user ID to organize files by user
 * @returns Promise with the download URL of the uploaded image
 */
export async function uploadImage(file: File, userId: string): Promise<string> {
  try {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image');
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new Error('Image size must be less than 5MB');
    }

    // Create a unique filename with timestamp
    // Sanitize filename to remove special characters that might cause issues
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const filename = `${userId}/${timestamp}_${sanitizedFileName}`;
    const storageRef = ref(storage, `chirp-images/${filename}`);

    // Upload the file
    const snapshot: UploadResult = await uploadBytes(storageRef, file);
    
    // Get the download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return downloadURL;
  } catch (error: any) {
    console.error('Error uploading image:', error);
    
    // Provide more helpful error messages
    if (error?.code === 'storage/unauthorized') {
      throw new Error('You do not have permission to upload images. Please check Firebase Storage rules.');
    } else if (error?.code === 'storage/canceled') {
      throw new Error('Upload was canceled.');
    } else if (error?.code === 'storage/unknown') {
      throw new Error('An unknown error occurred. Please ensure Firebase Storage is enabled in your project.');
    } else if (error?.message?.includes('CORS')) {
      throw new Error('CORS error: Please ensure Firebase Storage is enabled and rules are deployed.');
    }
    
    throw error;
  }
}

/**
 * Upload a profile picture to Firebase Storage
 * @param file - The image file to upload
 * @param userId - The user ID to organize files by user
 * @returns Promise with the download URL of the uploaded image
 */
export async function uploadProfilePicture(file: File, userId: string): Promise<string> {
  try {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image');
    }

    // Validate file size (max 2MB for profile pictures)
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      throw new Error('Profile picture must be less than 2MB');
    }

    // Create a unique filename with timestamp
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const filename = `${userId}/profile_${timestamp}_${sanitizedFileName}`;
    const storageRef = ref(storage, `profile-images/${filename}`);

    // Upload the file
    const snapshot: UploadResult = await uploadBytes(storageRef, file);
    
    // Get the download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return downloadURL;
  } catch (error: any) {
    console.error('Error uploading profile picture:', error);
    
    if (error?.code === 'storage/unauthorized') {
      throw new Error('You do not have permission to upload images. Please check Firebase Storage rules.');
    } else if (error?.code === 'storage/canceled') {
      throw new Error('Upload was canceled.');
    } else if (error?.code === 'storage/unknown') {
      throw new Error('An unknown error occurred. Please ensure Firebase Storage is enabled in your project.');
    }
    
    throw error;
  }
}

/**
 * Upload a cover photo to Firebase Storage
 * @param file - The image file to upload
 * @param userId - The user ID to organize files by user
 * @returns Promise with the download URL of the uploaded image
 */
export async function uploadCoverPhoto(file: File, userId: string): Promise<string> {
  try {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image');
    }

    // Validate file size (max 3MB for cover photos)
    const maxSize = 3 * 1024 * 1024; // 3MB
    if (file.size > maxSize) {
      throw new Error('Cover photo must be less than 3MB');
    }

    // Create a unique filename with timestamp
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const filename = `${userId}/cover_${timestamp}_${sanitizedFileName}`;
    const storageRef = ref(storage, `profile-images/${filename}`);

    // Upload the file
    const snapshot: UploadResult = await uploadBytes(storageRef, file);
    
    // Get the download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return downloadURL;
  } catch (error: any) {
    console.error('Error uploading cover photo:', error);
    
    if (error?.code === 'storage/unauthorized') {
      throw new Error('You do not have permission to upload images. Please check Firebase Storage rules.');
    } else if (error?.code === 'storage/canceled') {
      throw new Error('Upload was canceled.');
    } else if (error?.code === 'storage/unknown') {
      throw new Error('An unknown error occurred. Please ensure Firebase Storage is enabled in your project.');
    }
    
    throw error;
  }
}

/**
 * Delete an image from Firebase Storage by URL
 * @param imageUrl - The URL of the image to delete
 */
export async function deleteImage(imageUrl: string): Promise<void> {
  try {
    // Extract the file path from the URL
    // Firebase Storage URLs have the format: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}?alt=media&token={token}
    const url = new URL(imageUrl);
    const pathMatch = url.pathname.match(/\/o\/(.+?)\?/);
    if (!pathMatch) {
      throw new Error('Invalid image URL format');
    }
    
    // Decode the path (URL encoded)
    const encodedPath = pathMatch[1];
    const decodedPath = decodeURIComponent(encodedPath.replace(/%2F/g, '/'));
    
    const storageRef = ref(storage, decodedPath);
    await deleteObject(storageRef);
  } catch (error: any) {
    // Don't throw error if file doesn't exist (404)
    if (error?.code === 'storage/object-not-found') {
      console.warn('Image not found in storage (may have been deleted already):', imageUrl);
      return;
    }
    console.error('Error deleting image:', error);
    throw error;
  }
}

