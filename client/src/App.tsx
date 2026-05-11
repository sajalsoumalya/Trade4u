import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { firebaseConfig } from './lib/firebase';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Market from './pages/Market';
import Analysis from './pages/Analysis';
import Trading from './pages/Trading';
import Settings from './pages/Settings';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Inject auth into window for Login component
(window as any).firebaseAuth = auth;

// Layout
function Layout({ children, user }: { children: React.ReactNode; user: any }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen bg-background">
      <aside className={`${sidebarOpen ? 'w-60' : 'w-16'} bg-surface border-r border-[#2A2A2A] flex flex-col transition-all`}>
        <div className="p-4 border-b border-[#2A2A2A]">
          <h1 className="text-xl font-bold text-primary">Trade4u</h1>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          <a href="/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#2A2A2A] text-gray-300 hover:text-white">
            <span>📊</span>
            {sidebarOpen && <span>Dashboard</span>}
          </a>
          <a href="/market" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#2A2A2A] text-gray-300 hover:text-white">
            <span>📈</span>
            {sidebarOpen && <span>Market</span>}
          </a>
          <a href="/analysis" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#2A2A2A] text-gray-300 hover:text-white">
            <span>🤖</span>
            {sidebarOpen && <span>Analysis</span>}
          </a>
          <a href="/trading" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#2A2A2A] text-gray-300 hover:text-white">
            <span>💱</span>
            {sidebarOpen && <span>Trading</span>}
          </a>
          <a href="/settings" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#2A2A2A] text-gray-300 hover:text-white">
            <span>⚙️</span>
            {sidebarOpen && <span>Settings</span>}
          </a>
        </nav>

        <div className="p-4 border-t border-[#2A2A2A]">
          <button onClick={() => auth.signOut()} className="text-sm text-gray-400 hover:text-white">
            {sidebarOpen ? 'Logout' : '⬅️'}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <header className="h-14 bg-surface border-b border-[#2A2A2A] flex items-center justify-between px-4">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-400 hover:text-white text-xl">☰</button>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">{user ? (user.displayName || user.email) : 'Demo User'}</span>
            {user?.photoURL && <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full" />}
          </div>
        </header>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}

// Check for demo mode (sync check at module level)
const isDemoMode = () => {
  try {
    return localStorage.getItem('demoMode') === 'true';
  } catch {
    return false;
  }
};

function App() {
  const [user, setUser] = useState<any>(null);
  const [initializing, setInitializing] = useState(true);
  // Initialize demoMode synchronously from localStorage
  const [demoMode] = useState(isDemoMode);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      console.log('Auth state changed:', u ? u.email : 'null');
      setUser(u);
      setInitializing(false);
    });
    return () => unsubscribe();
  }, []);

  console.log('App state:', { initializing, user: user?.email, demoMode });

  if (initializing) {
    return <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-white">Loading...</div>;
  }

  const isAuthenticated = user || demoMode;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Login />} />
        <Route path="/dashboard" element={isAuthenticated ? <Layout user={user}><Dashboard /></Layout> : <Navigate to="/login" />} />
        <Route path="/market" element={isAuthenticated ? <Layout user={user}><Market /></Layout> : <Navigate to="/login" />} />
        <Route path="/analysis" element={isAuthenticated ? <Layout user={user}><Analysis /></Layout> : <Navigate to="/login" />} />
        <Route path="/trading" element={isAuthenticated ? <Layout user={user}><Trading /></Layout> : <Navigate to="/login" />} />
        <Route path="/settings" element={isAuthenticated ? <Layout user={user}><Settings /></Layout> : <Navigate to="/login" />} />
        <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;