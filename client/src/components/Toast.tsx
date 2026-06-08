import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { X, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';

interface ToastItem {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

interface ToastCtx {
  addToast: (type: ToastItem['type'], message: string) => void;
}

const ToastContext = createContext<ToastCtx>({ addToast: () => {} });
export const useToast = () => useContext(ToastContext);

let toastId = 0;

const icons = {
  success: <CheckCircle className="w-4 h-4 text-[#0ECB81]" />,
  error: <XCircle className="w-4 h-4 text-[#F6465D]" />,
  warning: <AlertTriangle className="w-4 h-4 text-[#F0B90B]" />,
  info: <Info className="w-4 h-4 text-[#848E9C]" />,
};

const colors = {
  success: 'border-[#0ECB81]/30 bg-[#0ECB81]/5',
  error: 'border-[#F6465D]/30 bg-[#F6465D]/5',
  warning: 'border-[#F0B90B]/30 bg-[#F0B90B]/5',
  info: 'border-[#848E9C]/30 bg-[#848E9C]/5',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((type: ToastItem['type'], message: string) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const remove = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
        {toasts.map(t => (
          <div key={t.id} className={`flex items-start gap-2 px-3 py-2.5 rounded-lg border ${colors[t.type]} bg-[#1E2329] shadow-lg animate-slide-up`}>
            {icons[t.type]}
            <p className="text-xs text-white flex-1">{t.message}</p>
            <button onClick={() => remove(t.id)} className="text-[#848E9C] hover:text-white"><X className="w-3 h-3" /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
