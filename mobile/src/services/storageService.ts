import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../config/firebase';

const toBlob = async (uri: string): Promise<Blob> => {
  const response = await fetch(uri);
  return await response.blob();
};

const sanitizeFileName = (name: string): string => {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
};

export const storageService = {
  async uploadChirpImage(uri: string, userId: string): Promise<string> {
    const blob = await toBlob(uri);
    const path = `chirp-images/${userId}/${Date.now()}_${sanitizeFileName(
      uri.split('/').pop() || 'image.jpg'
    )}`;
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, blob);
    return await getDownloadURL(snapshot.ref);
  },

  async uploadProfilePicture(uri: string, userId: string): Promise<string> {
    const blob = await toBlob(uri);
    const path = `profile-pictures/${userId}/${Date.now()}_${sanitizeFileName(
      uri.split('/').pop() || 'profile.jpg'
    )}`;
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, blob);
    return await getDownloadURL(snapshot.ref);
  },

  async uploadCoverPhoto(uri: string, userId: string): Promise<string> {
    const blob = await toBlob(uri);
    const path = `cover-photos/${userId}/${Date.now()}_${sanitizeFileName(
      uri.split('/').pop() || 'cover.jpg'
    )}`;
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, blob);
    return await getDownloadURL(snapshot.ref);
  },

  async deleteImage(imageUrl: string): Promise<void> {
    try {
      // Extract path from full URL
      const urlObj = new URL(imageUrl);
      const path = decodeURIComponent(urlObj.pathname.split('/o/')[1]?.split('?')[0] || '');
      if (!path) {
        console.warn('[storageService] Could not extract path from URL:', imageUrl);
        return;
      }
      const storageRef = ref(storage, path);
      const { deleteObject } = await import('firebase/storage');
      await deleteObject(storageRef);
    } catch (error) {
      console.error('[storageService] Error deleting image:', error);
      throw error;
    }
  },
};


