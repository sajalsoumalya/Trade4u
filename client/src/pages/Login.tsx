import { useNavigate } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary mb-2">Trade4u</h1>
          <p className="text-gray-400">AI-Powered Trading Platform</p>
        </div>

        <div className="card text-center">
          <p className="mb-6 text-gray-300">
            Welcome to the Trade4u trading platform.
            Run AI-powered analysis and track your paper trades.
          </p>

          <button
            onClick={() => navigate('/dashboard')}
            className="btn-primary w-full"
          >
            Enter Demo
          </button>
        </div>
      </div>
    </div>
  );
}