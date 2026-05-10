// Firebase Configuration
// Runtime config injected by server
const firebaseConfig = JSON.parse(document.getElementById('firebase-config')?.textContent || '{}') || {
  apiKey: "AIzaSyDemoKey",
  authDomain: "sajalsoumalya.firebaseapp.com",
  projectId: "sajalsoumalya",
  storageBucket: "sajalsoumalya.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000000000"
};

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