import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
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
  Menu
} from 'lucide-react';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Trading from './pages/Trading';
import SettingsPage from './pages/Settings';

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
  { href: '/settings', label: 'Settings', icon: Settings },
];

function Sidebar({ isOpen, setIsOpen }: { isOpen: boolean; setIsOpen: (open: boolean) => void }) {
  const location = useLocation();
  return (
    <aside className={`fixed top-0 left-0 h-full z-50 flex flex-col bg-surface border-r border-border/50 transition-all duration-300 ${isOpen ? 'w-56' : 'w-16'}`}>
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-3 overflow-hidden">
          {isOpen && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20 flex-shrink-0">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-lg font-bold text-white">Trade4u</h1>
            </div>
          )}
        </div>
        <button onClick={() => setIsOpen(false)} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white">
          <ChevronLeft className="w-3 h-3" />
        </button>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;
          return (
            <a key={item.href} href={item.href} className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isActive ? 'bg-primary/10 text-primary' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
              {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full" />}
              <Icon className="w-4 h-4 flex-shrink-0" />
              {isOpen && <span className="text-sm font-medium">{item.label}</span>}
            </a>
          );
        })}
      </nav>
      <div className="p-2 border-t border-border/50">
        <button onClick={() => auth?.signOut()} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all">
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {isOpen && <span className="text-sm font-medium">Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}

function Header({ user }: { user: any }) {
  return (
    <header className="h-14 bg-surface/50 backdrop-blur-xl border-b border-border/50 flex items-center justify-between px-5 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        {user?.photoURL ? (
          <img src={user.photoURL} alt="" className="w-8 h-8 rounded-lg ring-2 ring-primary/20" />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
        )}
        <div>
          <p className="text-sm font-semibold text-white">{user?.displayName || 'Trader'}</p>
          <p className="text-xs text-muted">{user?.email || 'paper@trade4u.app'}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20">
          <span className="text-xs font-medium text-primary">Paper Trading</span>
        </div>
      </div>
    </header>
  );
}

function Layout({ children, user }: { children: React.ReactNode; user: any }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  return (
    <div className="min-h-screen bg-background">
      {sidebarOpen ? <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} /> : (
        <button onClick={() => setSidebarOpen(true)} className="fixed top-3 left-3 z-50 w-10 h-10 rounded-lg bg-surface border border-border/50 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5">
          <Menu className="w-4 h-4" />
        </button>
      )}
      <main className={`transition-all duration-300 ${sidebarOpen ? 'ml-56' : 'ml-16'}`}>
        <Header user={user} />
        <div className="p-5">{children}</div>
      </main>
    </div>
  );
}

function App() {
  const [user, setUser] = useState<any>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    if (!auth) { setInitializing(false); return; }
    const unsubscribe = onAuthStateChanged(auth, (u) => { setUser(u); setInitializing(false); });
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

  const demoMode = localStorage.getItem('demoMode') === 'true';
  const isAuthenticated = user || demoMode;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Login />} />
        <Route path="/dashboard" element={isAuthenticated ? <Layout user={user}><Dashboard /></Layout> : <Navigate to="/login" />} />
        <Route path="/trading" element={isAuthenticated ? <Layout user={user}><Trading /></Layout> : <Navigate to="/login" />} />
        <Route path="/settings" element={isAuthenticated ? <Layout user={user}><SettingsPage /></Layout> : <Navigate to="/login" />} />
        <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
