import { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogle = async () => {
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      // Note: This requires firebase auth to be initialized in App.tsx
      // For now, show a message
      setError('Google login not configured - use email/password');
    } catch (e: unknown) {
      setError((e as Error).message);
    }
    setLoading(false);
  };

  const handleEmail = async () => {
    setLoading(true);
    setError('');
    // Note: This requires firebase auth to be initialized
    setError('Email login not configured - use the deployed Streamlit app');
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary mb-2">Trade4u</h1>
          <p className="text-gray-400">AI-Powered Trading Platform</p>
        </div>

        <div className="card">
          <p className="text-center mb-4 text-gray-400">
            Please use the Streamlit web interface at:
            <br />
            <a href="https://trade4u.soumalya.in" className="text-primary hover:underline">
              https://trade4u.soumalya.in
            </a>
          </p>

          <p className="text-center text-sm text-gray-500">
            The React app is coming soon with full trading features.
          </p>
        </div>
      </div>
    </div>
  );
}