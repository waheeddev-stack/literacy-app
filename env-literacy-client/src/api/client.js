// Axios instance: unwraps the { success, data, error, meta } envelope and refreshes expired access tokens once.
import axios from 'axios';

const BASE = (window.__API_URL || import.meta.env.VITE_API_URL || '').replace(/\/$/, '') + '/api/v1';
const KEY = 'elp_tokens';

export const tokens = {
  get() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } },
  set(t) { try { localStorage.setItem(KEY, JSON.stringify(t)); } catch { /* storage blocked */ } },
  clear() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } },
};

export const http = axios.create({ baseURL: BASE, timeout: 20000 });

http.interceptors.request.use(cfg => {
  const t = tokens.get();
  if (t?.access) cfg.headers.Authorization = `Bearer ${t.access}`;
  return cfg;
});

let refreshing = null;
async function refresh() {
  const t = tokens.get();
  if (!t?.refresh) throw new Error('no refresh token');
  refreshing ||= axios.post(`${BASE}/auth/refresh`, { refresh_token: t.refresh })
    .then(r => { const d = r.data.data; tokens.set({ access: d.access_token, refresh: d.refresh_token }); return d; })
    .finally(() => { refreshing = null; });
  return refreshing;
}

http.interceptors.response.use(r => r, async err => {
  const cfg = err.config;
  const code = err.response?.data?.error?.code;
  if (err.response?.status === 401 && !cfg._retry && !cfg.url.includes('/auth/') && tokens.get()?.refresh) {
    cfg._retry = true;
    try { await refresh(); return http(cfg); }
    catch { tokens.clear(); window.dispatchEvent(new Event('elp:logout')); }
  } else if (err.response?.status === 401 && code === 'UNAUTHENTICATED' && !cfg.url.includes('/auth/')) {
    tokens.clear(); window.dispatchEvent(new Event('elp:logout'));
  }
  const e = new Error(err.response?.data?.error?.message || (err.code === 'ECONNABORTED' ? 'The server took too long to answer' : err.response ? 'Something went wrong' : 'Cannot reach the server. Check your connection.'));
  e.status = err.response?.status; e.code = code; e.offline = !err.response;
  throw e;
});

const unwrap = r => r.data.data;
export const get = (url, params) => http.get(url, { params }).then(unwrap);
export const getPage = (url, params) => http.get(url, { params }).then(r => ({ data: r.data.data, meta: r.data.meta }));
export const post = (url, body) => http.post(url, body).then(unwrap);
export const patch = (url, body) => http.patch(url, body).then(unwrap);
export const del = (url) => http.delete(url).then(unwrap);
export const put = (url, body) => http.put(url, body).then(unwrap);

export async function download(url, params, fallbackName) {
  const r = await http.get(url, { params, responseType: 'blob' });
  const cd = r.headers['content-disposition'] || '';
  const name = /filename="([^"]+)"/.exec(cd)?.[1] || fallbackName;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(r.data); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
