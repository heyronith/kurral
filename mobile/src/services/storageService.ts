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
};


