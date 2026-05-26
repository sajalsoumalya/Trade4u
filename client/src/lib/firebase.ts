// Firebase Configuration
// Runtime config injected by server — falls back to env vars, then demo keys
let firebaseConfig: Record<string, string> = {};

try {
  const injected = document.getElementById('firebase-config')?.textContent;
  if (injected) {
    const parsed = JSON.parse(injected);
    if (parsed.apiKey) firebaseConfig = parsed;
  }
} catch {}

if (!firebaseConfig.apiKey) {
  firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDemoKey',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'sajalsoumalya.firebaseapp.com',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'sajalsoumalya',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'sajalsoumalya.appspot.com',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '000000000000',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:00000000000000000000000000000000',
  };
}

// API base URL
export const API_BASE = '/api';

// Get auth headers
export const getAuthHeaders = () => {
  const token = localStorage.getItem('firebaseToken') || '';
  const uid = localStorage.getItem('userUid') || '';
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-UID': uid
  };
};

export { firebaseConfig };