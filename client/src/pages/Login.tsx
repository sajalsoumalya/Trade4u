import { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { TrendingUp, Mail, Lock, ArrowRight, Sparkles, Shield, Zap, Eye, EyeOff, ChevronDown } from 'lucide-react';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const auth = (window as any).firebaseAuth;

  const handleGoogle = async () => {
    if (!auth) {
      setError('Firebase API key not configured. Use Demo Mode below or set VITE_FIREBASE_API_KEY in .env');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      console.log('Sign in successful, user:', result.user);
    } catch (e: any) {
      console.error('Sign in error:', e);
      setError(e.message);
    }
    setLoading(false);
  };

  const handleDemo = () => {
    localStorage.setItem('demoMode', 'true');
    if (!localStorage.getItem('userUid')) {
      localStorage.setItem('userUid', 'demo_' + Date.now().toString(36));
    }
    window.location.replace('/dashboard');
  };

  const handleEmailAuth = async () => {
    if (!auth || !email || !password) {
      setError('Please enter email and password');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (e: any) {
      console.error('Email auth error:', e);
      setError(e.message);
    }
    setLoading(false);
  };

  const features = [
    { icon: Sparkles, color: 'from-primary to-primary-light', shadow: 'shadow-primary/30', title: 'AI-Powered Analysis', desc: 'Multi-agent AI analyzes stocks in real-time' },
    { icon: Shield, color: 'from-accent to-accent-light', shadow: 'shadow-accent/30', title: 'Risk Management', desc: 'Built-in risk controls and portfolio protection' },
    { icon: Zap, color: 'from-info to-blue-400', shadow: 'shadow-info/30', title: 'Paper Trading', desc: 'Practice with $100k virtual money' },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* ============ LEFT HERO (desktop) / Collapsible (mobile) ============ */}
      <div className="lg:w-1/2 bg-gradient-to-br from-primary/20 via-background to-accent/20 relative overflow-hidden">
        <div className="absolute inset-0 bg-hero-pattern opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent lg:bg-gradient-to-t lg:from-background lg:via-transparent lg:to-transparent" />

        {/* Desktop hero content */}
        <div className="hidden lg:flex relative z-10 flex-col justify-center min-h-screen px-16">
          <div className="mb-12">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-2xl shadow-primary/30 mb-8 animate-float">
              <TrendingUp className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
                Trade Smarter
              </span>
            </h1>
            <p className="text-xl text-gray-400 max-w-md">
              AI-powered trading platform that analyzes markets, manages risks, and executes trades with precision.
            </p>
          </div>

          <div className="space-y-6">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color}/20 flex items-center justify-center`}>
                  <f.icon className={`w-6 h-6 ${f.color.replace('from-', 'text-').split(' ')[0]}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-white">{f.title}</h3>
                  <p className="text-sm text-gray-400">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent hidden lg:block" />
      </div>

      {/* ============ RIGHT: LOGIN FORM ============ */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 py-8 lg:py-12">
        <div className="w-full max-w-md animate-fade-in">

          {/* Mobile brand header */}
          <div className="lg:hidden text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/30">
              <TrendingUp className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">Trade4u</h1>
            <p className="text-gray-400 mt-1 text-sm">AI-Powered Trading Platform</p>
          </div>

          {/* Mobile feature cards (collapsible) */}
          <div className="lg:hidden mb-6">
            <button
              onClick={() => setShowFeatures(!showFeatures)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-surface border border-border text-gray-400 hover:text-white transition-colors"
            >
              <span className="text-sm font-medium">About Trade4u</span>
              <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${showFeatures ? 'rotate-180' : ''}`} />
            </button>
            <div className={`overflow-hidden transition-all duration-300 ${showFeatures ? 'max-h-80 mt-3' : 'max-h-0'}`}>
              <div className="space-y-3 px-1">
                {features.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface/50 border border-border/50">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${f.color}/20 flex items-center justify-center shrink-0`}>
                      <f.icon className={`w-5 h-5 ${f.color.replace('from-', 'text-').split(' ')[0]}`} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-white truncate">{f.title}</h3>
                      <p className="text-xs text-gray-400 truncate">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Form card */}
          <div className="lg:bg-surface/50 lg:border lg:border-border/50 lg:rounded-2xl lg:p-8 lg:backdrop-blur-sm">
            <div className="text-center lg:text-left mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">
                {isLogin ? 'Welcome back' : 'Create account'}
              </h2>
              <p className="text-gray-400 text-sm">
                {isLogin
                  ? 'Sign in to access your trading dashboard'
                  : 'Get started with your free trading account'}
              </p>
            </div>

            <button
              onClick={handleGoogle}
              disabled={loading}
              className="w-full py-3.5 sm:py-4 px-6 bg-white text-gray-900 font-semibold rounded-xl hover:bg-gray-100 transition-all duration-200 flex items-center justify-center gap-3 shadow-lg hover:shadow-xl active:scale-[0.98]"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.96 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.96 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="truncate">Continue with Google</span>
            </button>

            <div className="relative my-6 sm:my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-4 bg-background lg:bg-surface/0 text-sm text-gray-500">
                  or continue with email
                </span>
              </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleEmailAuth(); }} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input w-full pl-12"
                  autoComplete="email"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input w-full pl-12 pr-12"
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors p-1"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 sm:py-3 active:scale-[0.98]"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    {isLogin ? 'Sign In' : 'Create Account'}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <p className="text-center text-sm text-gray-400 mt-5">
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <button
                onClick={() => { setIsLogin(!isLogin); setError(''); }}
                className="text-primary hover:text-primary-light font-medium transition-colors"
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>

          {/* Demo mode button */}
          <button
            onClick={handleDemo}
            className="w-full mt-5 py-3.5 sm:py-4 px-6 bg-gradient-to-r from-surface to-surface-hover border border-border rounded-xl text-white font-medium hover:bg-surface-hover transition-all duration-200 flex items-center justify-center gap-2 group active:scale-[0.98]"
          >
            <span>Try Demo Mode</span>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-white group-hover:translate-x-1 transition-all" />
          </button>

          {/* Error */}
          {error && (
            <div className="mt-5 p-4 rounded-xl bg-secondary/10 border border-secondary/20 animate-scale-in">
              <p className="text-sm text-secondary text-center">{error}</p>
            </div>
          )}

          <p className="text-center text-xs text-gray-500 mt-6">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
