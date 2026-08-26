import { useState } from 'react';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';

/**
 * The five-tier rating the portfolio manager emits, most bullish first.
 * Emerald and red are reserved for the ends of this scale — they carry
 * direction here, so they are not used decoratively anywhere on this page.
 */
// Bar lengths are explicit pixels, not w-full / w-4/5 / w-1/2: those resolve
// against the row's width and then clamp to the same max, so every tier came
// out identical and the shape of the scale disappeared.
const TIERS = [
  { label: 'BUY', color: '#10b981', bar: 92 },
  { label: 'OVERWEIGHT', color: '#34d399', bar: 68 },
  { label: 'HOLD', color: '#6b7280', bar: 40 },
  { label: 'UNDERWEIGHT', color: '#f87171', bar: 68 },
  { label: 'SELL', color: '#ef4444', bar: 92 },
];

// Where the marker settles. Hold is the honest modal answer for a desk that
// only takes a position when the argument is decisive.
const SETTLES_ON = 2;

// The desk, in the order a decision moves through it.
const DESK = [
  'market', 'sentiment', 'news', 'fundamentals',
  'bull', 'bear', 'research lead',
  'trader',
  'aggressive', 'conservative', 'neutral',
  'portfolio',
];

/**
 * Firebase reports failures as codes wrapped in prose ("Firebase: Error
 * (auth/invalid-credential).") which tells the person nothing they can act on.
 * Say what happened and what to do about it.
 */
function readableAuthError(e: any): string {
  const code = String(e?.code || '');
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return "That email and password don't match. Check both and try again.";
    case 'auth/invalid-email':
      return "That doesn't look like an email address.";
    case 'auth/email-already-in-use':
      return 'An account already exists with that email. Sign in instead.';
    case 'auth/weak-password':
      return 'Use at least 6 characters for the password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a minute, then try again.';
    case 'auth/network-request-failed':
      return "Can't reach the authentication server. Check your connection.";
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google window. Allow pop-ups for this site.';
    default:
      return e?.message || 'Sign in failed. Try again.';
  }
}

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const auth = (window as any).firebaseAuth;

  const handleGoogle = async () => {
    if (!auth) {
      setError('Authentication is not configured on this deployment. Set VITE_FIREBASE_API_KEY and redeploy.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e: any) {
      // Closing the Google window is a decision, not a failure.
      if (e?.code !== 'auth/popup-closed-by-user' && e?.code !== 'auth/cancelled-popup-request') {
        setError(readableAuthError(e));
      }
    }
    setLoading(false);
  };

  const handleEmailAuth = async () => {
    if (!auth) {
      setError('Authentication is not configured on this deployment. Set VITE_FIREBASE_API_KEY and redeploy.');
      return;
    }
    if (!email || !password) {
      setError('Enter your email and password.');
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
      setError(readableAuthError(e));
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* ---------------------------------------------------------------- */}
      {/* Left: what this thing is, shown rather than claimed             */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative hidden lg:flex flex-col justify-between overflow-hidden border-r border-border/60 px-14 py-12">
        <div className="pointer-events-none absolute inset-0 bg-hero-pattern opacity-[0.35]" />
        {/* Deliberation reads violet; the rating scale owns emerald and red. */}
        <div className="pointer-events-none absolute -left-32 top-1/3 h-[28rem] w-[28rem] rounded-full bg-accent/10 blur-[120px]" />

        <div className="relative flex items-center gap-2.5">
          <span className="h-5 w-[3px] rounded-full bg-primary" />
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-muted">
            Trade4u
          </span>
        </div>

        <div className="relative">
          <p className="mb-6 font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-accent-light">
            Multi-agent trading desk
          </p>

          <h1 className="max-w-xl text-[2.75rem] font-extrabold leading-[1.06] tracking-[-0.03em] text-white">
            Twelve agents argue.
            <br />
            <span className="font-mono text-[2.1rem] font-medium tracking-[-0.02em] text-muted">
              One rating comes out.
            </span>
          </h1>

          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-gray-400">
            Analysts, a bull and a bear, and a three-way risk committee debate every
            position before it is taken. Paper money, so the argument costs you nothing.
          </p>

          {/* Signature: the actual output scale. */}
          <div className="mt-11 max-w-sm">
            <div className="flex flex-col gap-[7px]">
              {TIERS.map((tier, i) => {
                const active = i === SETTLES_ON;
                return (
                  <div
                    key={tier.label}
                    className="tier-row relative flex h-5 items-center gap-3.5 pl-5"
                    style={{ animationDelay: `${0.55 + i * 0.07}s` }}
                  >
                    {/* The marker lives in the active row, so it lands aligned
                        without anyone having to know the row pitch. Its
                        keyframe travels from above in its own height. */}
                    {active && (
                      <span
                        className="ladder-marker absolute left-0 top-[3px] h-[14px] w-[3px] rounded-full bg-white"
                        aria-hidden="true"
                      />
                    )}
                    <span
                      className="h-[6px] rounded-full"
                      style={{
                        width: `${tier.bar}px`,
                        backgroundColor: tier.color,
                        opacity: active ? 1 : 0.28,
                      }}
                    />
                    <span
                      className="font-mono text-[10.5px] font-medium tracking-[0.16em]"
                      style={{ color: active ? '#fff' : '#6b7280' }}
                    >
                      {tier.label}
                    </span>
                    {active && (
                      <span className="font-mono text-[10px] tracking-[0.1em] text-muted">
                        ← most names, most days
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <p className="relative max-w-lg font-mono text-[10.5px] leading-[1.9] tracking-[0.08em] text-gray-600">
          {DESK.join('  ·  ')}
        </p>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Right: the only job on this page                                */}
      {/* ---------------------------------------------------------------- */}
      <section className="flex min-h-screen items-center justify-center px-6 py-12 lg:min-h-0">
        <div className="w-full max-w-[22rem]">
          {/* Mobile only: the left panel is gone, so name the product here. */}
          <div className="mb-10 flex items-center gap-2.5 lg:hidden">
            <span className="h-5 w-[3px] rounded-full bg-primary" />
            <span className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-muted">
              Trade4u
            </span>
          </div>

          <h2 className="text-[1.6rem] font-bold tracking-[-0.02em] text-white">
            {isLogin ? 'Sign in' : 'Create an account'}
          </h2>
          <p className="mt-1.5 text-sm text-gray-500">
            {isLogin
              ? 'Pick up where your bots left off.'
              : 'You start with $100,000 in paper money.'}
          </p>

          <button
            onClick={handleGoogle}
            disabled={loading}
            className="mt-8 flex w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-surface py-3 text-sm font-medium text-white transition-colors hover:border-gray-600 hover:bg-surface-hover disabled:opacity-50"
          >
            <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.96 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.96 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>

          <div className="my-7 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-600">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleEmailAuth();
            }}
            className="space-y-4"
          >
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-gray-500"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="w-full rounded-xl border border-border bg-surface px-3.5 py-3 text-sm text-white transition-colors placeholder:text-gray-600 hover:border-gray-600 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-gray-500"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  className="w-full rounded-xl border border-border bg-surface px-3.5 py-3 pr-11 text-sm text-white transition-colors placeholder:text-gray-600 hover:border-gray-600 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 transition-colors hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-secondary/25 bg-secondary/10 px-3.5 py-2.5 text-[13px] leading-snug text-secondary-light"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-background transition-all hover:bg-primary-light disabled:opacity-50"
            >
              {loading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-background/30 border-t-background" />
              ) : (
                <>
                  {isLogin ? 'Sign in' : 'Create account'}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-[13px] text-gray-500">
            {isLogin ? 'No account yet? ' : 'Already have one? '}
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="font-medium text-primary transition-colors hover:text-primary-light"
            >
              {isLogin ? 'Create one' : 'Sign in instead'}
            </button>
          </p>

          <p className="mt-10 text-center text-[11px] leading-relaxed text-gray-600">
            Paper trading only. For research, not financial advice.
          </p>
        </div>
      </section>
    </div>
  );
}
