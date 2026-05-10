import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

// Pages
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Market from './pages/Market';
import Analysis from './pages/Analysis';
import Trading from './pages/Trading';
import Settings from './pages/Settings';

// Layout
function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-60' : 'w-16'} bg-surface border-r border-border flex flex-col transition-all`}>
        <div className="p-4 border-b border-border">
          <h1 className="text-xl font-bold text-primary">Trade4u</h1>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          <a href="/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface text-gray-300 hover:text-white">
            <span>📊</span>
            {sidebarOpen && <span>Dashboard</span>}
          </a>
          <a href="/market" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface text-gray-300 hover:text-white">
            <span>📈</span>
            {sidebarOpen && <span>Market</span>}
          </a>
          <a href="/analysis" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface text-gray-300 hover:text-white">
            <span>🤖</span>
            {sidebarOpen && <span>Analysis</span>}
          </a>
          <a href="/trading" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface text-gray-300 hover:text-white">
            <span>💱</span>
            {sidebarOpen && <span>Trading</span>}
          </a>
          <a href="/settings" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface text-gray-300 hover:text-white">
            <span>⚙️</span>
            {sidebarOpen && <span>Settings</span>}
          </a>
          <a href="/login" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface text-gray-300 hover:text-white">
            <span>🔓</span>
            {sidebarOpen && <span>Login</span>}
          </a>
        </nav>

        <div className="p-4 border-t border-border">
          <span className="text-sm text-gray-400">Demo Mode</span>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <header className="h-14 bg-surface border-b border-border flex items-center justify-between px-4">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-400 hover:text-white">
            ☰
          </button>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">Trade4u Demo</span>
          </div>
        </header>
        <div className="p-4">{children}</div>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
        <Route path="/market" element={<Layout><Market /></Layout>} />
        <Route path="/analysis" element={<Layout><Analysis /></Layout>} />
        <Route path="/trading" element={<Layout><Trading /></Layout>} />
        <Route path="/settings" element={<Layout><Settings /></Layout>} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;