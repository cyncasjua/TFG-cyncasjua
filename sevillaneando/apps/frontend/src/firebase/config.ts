import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || ''
};

console.log('Firebase Config:', firebaseConfig);

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const storage = getStorage(app);
