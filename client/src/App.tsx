import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { firebaseConfig } from './lib/firebase';
import {
  LayoutDashboard,
  LineChart,
  Brain,
  ArrowLeftRight,
  Settings,
  ChevronLeft,
  LogOut,
  TrendingUp,
  User,
  Menu
} from 'lucide-react';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Market from './pages/Market';
import Analysis from './pages/Analysis';
import Trading from './pages/Trading';
import SettingsPage from './pages/Settings';

let auth: any = null;
try {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
} catch (e) {
  console.warn('Firebase init skipped (no valid API key). Demo mode will use local state.');
}
(window as any).firebaseAuth = auth;

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/market', label: 'Market', icon: LineChart },
  { href: '/analysis', label: 'AI Analysis', icon: Brain },
  { href: '/trading', label: 'Trading', icon: ArrowLeftRight },
  { href: '/settings', label: 'Settings', icon: Settings },
];

function Sidebar({
  isOpen,
  setIsOpen
}: {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}) {
  const location = useLocation();

  return (
    <aside
      className={`fixed top-0 left-0 h-full z-50 flex flex-col bg-gradient-to-b from-surface to-background border-r border-border/50 transition-all duration-300 ${
        isOpen ? 'w-64' : 'w-20'
      }`}
    >
      <div className="flex items-center justify-between p-5 border-b border-border/50">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20 flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          {isOpen && (
            <div className="animate-fade-in">
              <h1 className="text-xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                Trade4u
              </h1>
              <p className="text-xs text-muted">AI Trading Platform</p>
            </div>
          )}
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;
          return (
            <a
              key={item.href}
              href={item.href}
              className={`group relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-primary/20 to-transparent'
                  : 'hover:bg-white/5'
              }`}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-primary to-accent rounded-r-full" />
              )}
              <Icon
                className={`w-5 h-5 flex-shrink-0 transition-colors ${
                  isActive ? 'text-primary' : 'text-gray-500 group-hover:text-white'
                }`}
              />
              {isOpen && (
                <span
                  className={`font-medium transition-colors ${
                    isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'
                  }`}
                >
                  {item.label}
                </span>
              )}
            </a>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border/50">
        <button
          onClick={() => auth.signOut()}
          className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {isOpen && <span className="font-medium">Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}

function CollapsedSidebar({ setIsOpen }: { setIsOpen: (open: boolean) => void }) {
  const location = useLocation();

  return (
    <div className="fixed top-0 left-0 h-full w-20 z-40 flex flex-col bg-gradient-to-b from-surface to-background border-r border-border/50 py-4">
      <button
        onClick={() => setIsOpen(true)}
        className="w-12 h-12 mx-auto rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all"
      >
        <Menu className="w-5 h-5" />
      </button>

      <nav className="flex-1 mt-6 px-2 space-y-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;
          return (
            <a
              key={item.href}
              href={item.href}
              className={`group relative flex items-center justify-center w-14 h-14 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-primary/20 to-transparent'
                  : 'hover:bg-white/5'
              }`}
              title={item.label}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-primary to-accent rounded-r-full" />
              )}
              <Icon
                className={`w-5 h-5 transition-colors ${
                  isActive ? 'text-primary' : 'text-gray-500 group-hover:text-white'
                }`}
              />
            </a>
          );
        })}
      </nav>
    </div>
  );
}

function Header({ user }: { user: any }) {
  return (
    <header className="h-16 bg-surface/50 backdrop-blur-xl border-b border-border/50 flex items-center justify-between px-6 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt=""
              className="w-10 h-10 rounded-xl ring-2 ring-primary/20"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
          )}
          <div>
            <p className="font-semibold text-white">
              {user?.displayName || 'Demo User'}
            </p>
            <p className="text-xs text-muted">
              {user?.email || 'demo@trade4u.app'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
          <span className="text-xs font-medium text-primary">Paper Trading</span>
        </div>
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
      </div>
    </header>
  );
}

function Layout({ children, user }: { children: React.ReactNode; user: any }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-background">
      {sidebarOpen ? (
        <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      ) : (
        <CollapsedSidebar setIsOpen={setSidebarOpen} />
      )}

      <main
        className={`transition-all duration-300 ${
          sidebarOpen ? 'ml-64' : 'ml-20'
        }`}
      >
        <Header user={user} />
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}

function App() {
  const [user, setUser] = useState<any>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setInitializing(false);
    });
    return () => unsubscribe();
  }, []);

  if (initializing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-4 animate-float shadow-lg shadow-primary/30">
            <TrendingUp className="w-8 h-8 text-white" />
          </div>
          <div className="flex items-center gap-2 text-muted">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  const demoMode = localStorage.getItem('demoMode') === 'true';
  const isAuthenticated = user || demoMode;

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" />
            ) : (
              <Login />
            )
          }
        />
        <Route
          path="/dashboard"
          element={
            isAuthenticated ? (
              <Layout user={user}>
                <Dashboard />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/market"
          element={
            isAuthenticated ? (
              <Layout user={user}>
                <Market />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/analysis"
          element={
            isAuthenticated ? (
              <Layout user={user}>
                <Analysis />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/trading"
          element={
            isAuthenticated ? (
              <Layout user={user}>
                <Trading />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/settings"
          element={
            isAuthenticated ? (
              <Layout user={user}>
                <SettingsPage />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="*"
          element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;