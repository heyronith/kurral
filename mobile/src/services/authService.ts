import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail,
  User as FirebaseUser,
  updateProfile,
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { userService } from './userService';
import type { User } from '../types';

const toAppUser = async (firebaseUser: FirebaseUser): Promise<User> => {
  const existing = await userService.getUser(firebaseUser.uid);
  if (existing) return existing;

  const displayName =
    firebaseUser.displayName ||
    firebaseUser.email?.split('@')[0] ||
    'User';
  const handle =
    firebaseUser.email?.split('@')[0] ||
    `user${firebaseUser.uid.slice(0, 8)}`;

  const newUser: User = {
    id: firebaseUser.uid,
    name: displayName,
    handle,
    email: firebaseUser.email || undefined,
    following: [],
    createdAt: new Date(),
    onboardingCompleted: false,
  };

  await userService.createUser(newUser);
  return newUser;
};

export const authService = {
  async signUp(email: string, password: string, name: string, handle: string): Promise<User> {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    const appUser: User = {
      id: cred.user.uid,
      name,
      handle,
      email,
      following: [],
      createdAt: new Date(),
      onboardingCompleted: false,
    };
    await userService.createUser(appUser);
    return appUser;
  },

  async signIn(email: string, password: string): Promise<User> {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return toAppUser(cred.user);
  },

  async resetPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email);
  },

  async logout(): Promise<void> {
    await signOut(auth);
  },

  subscribe(callback: (user: User | null) => void): () => void {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        callback(null);
        return;
      }
      try {
        const user = await toAppUser(firebaseUser);
        callback(user);
      } catch (err) {
        console.error('[authService] Failed to load user', err);
        callback(null);
      }
    });
  },

  async signInWithGoogle(idToken: string): Promise<User> {
    const credential = GoogleAuthProvider.credential(idToken);
    const cred = await signInWithCredential(auth, credential);
    return toAppUser(cred.user);
  },
};

