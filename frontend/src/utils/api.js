/* utils/api.js — API helpers for Retail AI */

export const API_BASE = 'http://localhost:8000';
const BASE = API_BASE;
export default BASE;

/* Named export for Jobs.jsx compatibility */
export const api = {
  get: async (path) => {
    const res = await fetch(`${BASE}${path}`, { headers: _headers() });
    if (!res.ok) throw new Error(res.statusText);
    return res.json();
  },
  post: async (path, body) => {
    const isForm = body instanceof FormData;
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: isForm ? _authHeader() : { ..._headers(), 'Content-Type': 'application/json' },
      body: isForm ? body : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(res.statusText);
    return res.json();
  },
  delete: async (path) => {
    const res = await fetch(`${BASE}${path}`, { method: 'DELETE', headers: _headers() });
    if (!res.ok) throw new Error(res.statusText);
    return res.json();
  },
};

function _authHeader() {
  const token = localStorage.getItem('retail_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function _headers() {
  return { 'Content-Type': 'application/json', ..._authHeader() };
}

/**
 * authFetch — raw fetch with JWT header auto-attached.
 * Use for SSE streams, blob downloads, multipart.
 */
export async function authFetch(url, options = {}) {
  const token = localStorage.getItem('retail_token');
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    localStorage.removeItem('retail_token');
    localStorage.removeItem('retail_user');
    localStorage.removeItem('retail_company');
    window.dispatchEvent(new CustomEvent('retail:unauthorized'));
  }
  return res;
}
