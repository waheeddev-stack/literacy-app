import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './styles/tokens.css';
import './styles/global.css';

try { const t = localStorage.getItem('elp_theme'); document.documentElement.dataset.theme = t || 'light'; } catch { /* ignore */ }

// Runtime API URL: public/config.json lets hosting point at any server without a rebuild.
async function boot() {
  try {
    const r = await fetch('/config.json', { cache: 'no-store' });
    if (r.ok) { const c = await r.json().catch(() => ({})); if (c.apiUrl) window.__API_URL = c.apiUrl; }
  } catch { /* use VITE_API_URL / dev proxy */ }

  // Imported after config so the API client reads the right base URL.
  const { AuthProvider } = await import('./hooks/useAuth.jsx');
  const { default: AppRoutes } = await import('./routes/AppRoutes.jsx');
  const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: (n, e) => !e.status && n < 2, refetchOnWindowFocus: false } } });
  createRoot(document.getElementById('root')).render(
    <StrictMode><QueryClientProvider client={qc}><BrowserRouter><AuthProvider><AppRoutes /></AuthProvider></BrowserRouter></QueryClientProvider></StrictMode>
  );
}
boot();
