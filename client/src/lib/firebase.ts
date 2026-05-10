// Firebase Configuration
// Replace these values with your Firebase project config

export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// API base URL
export const API_BASE = '/api';

// Get auth headers
export const getAuthHeaders = () => {
  const token = localStorage.getItem('firebaseToken');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-UID': localStorage.getItem('userUid')
  };
};