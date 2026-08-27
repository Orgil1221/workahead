import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import './styles/theme.css';
import './mathKeyboardSetup.js';

document.documentElement.dataset.theme = localStorage.getItem('wa_theme') || 'light';
try {
  const auroraSaved = localStorage.getItem('aurora');
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.dataset.aurora = auroraSaved !== null ? (auroraSaved === 'true' ? 'on' : 'off') : (prefersReduced ? 'off' : 'on');
} catch { document.documentElement.dataset.aurora = 'on'; }

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
