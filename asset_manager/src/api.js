// Small API client. PIN is kept on the phone after first login.
const PIN_KEY = 'am_pin';

const store = {
  get: (k) => {
    try { return localStorage.getItem(k); } catch { return null; }
  },
  set: (k, v) => {
    try { localStorage.setItem(k, v); } catch { /* storage full / private mode */ }
  },
  del: (k) => {
    try { localStorage.removeItem(k); } catch { /* ignore */ }
  },
};

export const getPin = () => store.get(PIN_KEY);
export const logout = () => store.del(PIN_KEY);

export async function login(pin) {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  });
  if (!res.ok) return false;
  store.set(PIN_KEY, pin);
  return true;
}

export class AuthError extends Error {}

async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-app-pin': getPin() || '' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    logout();
    throw new AuthError('unauthorized');
  }
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  return res.json();
}

// List with offline fallback: last good response is cached on the phone.
export async function list(resource) {
  const cacheKey = `am_cache_${resource}`;
  try {
    const rows = await request('GET', `/api/${resource}`);
    store.set(cacheKey, JSON.stringify(rows));
    return { rows, offline: false };
  } catch (e) {
    if (e instanceof AuthError) throw e;
    const cached = store.get(cacheKey);
    if (cached) return { rows: JSON.parse(cached), offline: true };
    throw e;
  }
}

export const create = (resource, data) => request('POST', `/api/${resource}`, data);
export const update = (resource, id, data) => request('PUT', `/api/${resource}/${id}`, data);
export const remove = (resource, id) => request('DELETE', `/api/${resource}/${id}`);
