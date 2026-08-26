import { BrowserRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import React, { useEffect, useState, Suspense, lazy } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { firebaseConfig } from './lib/firebase';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Settings,
  ChevronLeft,
  LogOut,
  TrendingUp,
  User,
  Menu,
  X,
  BarChart3
} from 'lucide-react';

import { ToastProvider } from './components/Toast';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Trading = lazy(() => import('./pages/Trading'));
const Analysis = lazy(() => import('./pages/Analysis'));
const SettingsPage = lazy(() => import('./pages/Settings'));

const PageLoader = () => (
  <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
    <div className="relative w-16 h-16">
      <div className="absolute inset-0 rounded-full border-4 border-primary/10" />
      <div className="absolute inset-0 rounded-full border-4 border-t-primary animate-spin" />
    </div>
    <p className="text-sm font-medium text-muted animate-pulse">Loading interface...</p>
  </div>
);

let auth: any = null;
try {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
} catch (e) {
  console.warn('Firebase init skipped. Demo mode active.');
}
(window as any).firebaseAuth = auth;

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/trading', label: 'Trading', icon: ArrowLeftRight },
  { href: '/analysis', label: 'Analysis', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

function Sidebar({
  collapsed,
  setCollapsed,
  mobileOpen,
  closeMobile,
}: {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobileOpen: boolean;
  closeMobile: () => void;
}) {
  const location = useLocation();
  return (
    <aside
      className={`fixed top-0 left-0 h-full z-50 flex flex-col bg-surface border-r border-border/50 transition-all duration-300
        w-56 ${collapsed ? 'md:w-16' : 'md:w-56'}
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
    >
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20 flex-shrink-0">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          {/* Collapsing only hides labels from md up: the mobile drawer is full
              width, so it always keeps them. */}
          <h1 className={`text-lg font-bold text-white whitespace-nowrap ${collapsed ? 'md:hidden' : ''}`}>
            Trade4u
          </h1>
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden md:flex w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 items-center justify-center text-gray-400 hover:text-white flex-shrink-0"
        >
          <ChevronLeft className={`w-3 h-3 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
        </button>
        <button
          onClick={closeMobile}
          aria-label="Close menu"
          className="md:hidden w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white flex-shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              to={item.href}
              title={item.label}
              className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isActive ? 'bg-primary/10 text-primary' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full" />}
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className={`text-sm font-medium whitespace-nowrap ${collapsed ? 'md:hidden' : ''}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
      <div className="p-2 border-t border-border/50">
        <button
          onClick={() => auth?.signOut()}
          title="Sign Out"
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <span className={`text-sm font-medium whitespace-nowrap ${collapsed ? 'md:hidden' : ''}`}>
            Sign Out
          </span>
        </button>
      </div>
    </aside>
  );
}

function Header({ user, onOpenMenu }: { user: any; onOpenMenu: () => void }) {
  return (
    <header className="h-14 bg-surface/50 backdrop-blur-xl border-b border-border/50 flex items-center justify-between px-4 sm:px-5 sticky top-0 z-30">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMenu}
          aria-label="Open menu"
          className="md:hidden w-9 h-9 -ml-1 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white flex-shrink-0"
        >
          <Menu className="w-4 h-4" />
        </button>
        {user?.photoURL ? (
          <img src={user.photoURL} alt="" className="w-8 h-8 rounded-lg ring-2 ring-primary/20 flex-shrink-0" />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-white" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{user?.displayName || 'Trader'}</p>
          <p className="text-xs text-muted truncate">{user?.email || 'paper@trade4u.app'}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20">
          <span className="text-xs font-medium text-primary whitespace-nowrap">Paper Trading</span>
        </div>
      </div>
    </header>
  );
}

function Layout({ children, user }: { children: React.ReactNode; user: any }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Close the drawer after navigating, so it doesn't cover the page just opened.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        closeMobile={() => setMobileOpen(false)}
      />
      {/* Offset the content only from md up; on mobile the sidebar overlays it. */}
      <main className={`transition-all duration-300 ${collapsed ? 'md:ml-16' : 'md:ml-56'}`}>
        <Header user={user} onOpenMenu={() => setMobileOpen(true)} />
        <div className="p-4 sm:p-5">{children}</div>
      </main>
    </div>
  );
}

function App() {
  const [user, setUser] = useState<any>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    if (!auth) { setInitializing(false); return; }
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          const token = await u.getIdToken();
          localStorage.setItem('firebaseToken', token);
          localStorage.setItem('userUid', u.uid);
        } catch (err) {
          console.error('Failed to retrieve Firebase ID token:', err);
        }
      } else {
        localStorage.removeItem('firebaseToken');
        localStorage.removeItem('userUid');
      }
      setUser(u);
      setInitializing(false);
    });
    return () => unsubscribe();
  }, []);

  if (initializing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/30">
          <TrendingUp className="w-6 h-6 text-white" />
        </div>
      </div>
    );
  }

  // Signing in is the only way through. The previous demo-mode escape hatch
  // read a localStorage flag, which anyone could set by hand to skip auth
  // entirely; it went away with the button that set it.
  const isAuthenticated = !!user;

  return (
    <BrowserRouter>
      <ToastProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Login />} />
            <Route path="/dashboard" element={isAuthenticated ? <Layout user={user}><Dashboard /></Layout> : <Navigate to="/login" />} />
            <Route path="/trading" element={isAuthenticated ? <Layout user={user}><Trading /></Layout> : <Navigate to="/login" />} />
            <Route path="/analysis" element={isAuthenticated ? <Layout user={user}><Analysis /></Layout> : <Navigate to="/login" />} />
            <Route path="/settings" element={isAuthenticated ? <Layout user={user}><SettingsPage /></Layout> : <Navigate to="/login" />} />
            <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} />} />
          </Routes>
        </Suspense>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
