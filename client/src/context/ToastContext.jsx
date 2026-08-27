import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null);
  const toast = useCallback((text) => {
    setMsg(text);
    setTimeout(() => setMsg(null), 2600);
  }, []);
  return (
    <ToastContext.Provider value={toast}>
      {children}
      {msg && <div className="toast">{msg}</div>}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
