// Firebase Authentication service
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
} from 'firebase/auth';
import { auth } from './firebase';
import { userService } from './firestore';
import type { User } from '../types';

// Convert Firebase Auth user to app User
export const createAppUserFromFirebase = async (firebaseUser: FirebaseUser): Promise<User> => {
  // Check if user document exists in Firestore
  let appUser = await userService.getUser(firebaseUser.uid);
  
  if (!appUser) {
    // Create user document if it doesn't exist (using Firebase Auth UID)
    const displayName = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User';
    const handle = firebaseUser.email?.split('@')[0] || `user${firebaseUser.uid.slice(0, 8)}`;
    
    appUser = await userService.createUser({
      name: displayName,
      handle: handle,
      email: firebaseUser.email || undefined,
      following: [],
      onboardingCompleted: false,
    }, firebaseUser.uid);
  }
  
  return appUser;
};

// Auth service
export const authService = {
  // Sign in with email and password
  async signInWithEmail(email: string, password: string): Promise<User> {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return createAppUserFromFirebase(userCredential.user);
  },

  // Sign up with email and password
  async signUpWithEmail(email: string, password: string, name: string, handle: string): Promise<User> {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Create user document in Firestore (using Firebase Auth UID)
    const appUser = await userService.createUser({
      name,
      handle,
      email,
      following: [],
      onboardingCompleted: false,
    }, userCredential.user.uid);
    
    return appUser;
  },

  // Sign in with Google
  async signInWithGoogle(): Promise<User> {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    return createAppUserFromFirebase(userCredential.user);
  },

  // Sign out
  async signOut(): Promise<void> {
    await signOut(auth);
  },

  // Get current Firebase Auth user
  getCurrentFirebaseUser(): FirebaseUser | null {
    return auth.currentUser;
  },

  // Send password reset email
  async sendPasswordResetEmail(email: string): Promise<void> {
    await firebaseSendPasswordResetEmail(auth, email);
  },

  // Subscribe to auth state changes
  onAuthStateChanged(callback: (user: User | null) => void): () => void {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const appUser = await createAppUserFromFirebase(firebaseUser);
          callback(appUser);
        } catch (error) {
          console.error('Error loading user:', error);
          callback(null);
        }
      } else {
        callback(null);
      }
    });
  },
};

