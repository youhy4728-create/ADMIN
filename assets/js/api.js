const API_BASE = 'https://mrmomd-production.up.railway.app/api';

const AdminAuth = {
  getAccessToken: () => localStorage.getItem('mfx_admin_access'),
  getRefreshToken: () => localStorage.getItem('mfx_admin_refresh'),
  getUser: () => JSON.parse(localStorage.getItem('mfx_admin_user') || 'null'),
  setSession: ({ accessToken, refreshToken, user }) => {
    localStorage.setItem('mfx_admin_access', accessToken);
    if (refreshToken) localStorage.setItem('mfx_admin_refresh', refreshToken);
    if (user) localStorage.setItem('mfx_admin_user', JSON.stringify(user));
  },
  clear: () => {
    localStorage.removeItem('mfx_admin_access');
    localStorage.removeItem('mfx_admin_refresh');
    localStorage.removeItem('mfx_admin_user');
  },
  isLoggedIn: () => !!localStorage.getItem('mfx_admin_access')
};

async function apiRequest(path, { method = 'GET', body, isForm = false, retry = true } = {}) {
  const headers = {};
  const token = AdminAuth.getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!isForm) headers['Content-Type'] = 'application/json';

  const res = await fetch(API_BASE + path, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined
  });

  if (res.status === 401 && retry && AdminAuth.getRefreshToken()) {
    const refreshed = await tryRefresh();
    if (refreshed) return apiRequest(path, { method, body, isForm, retry: false });
  }

  if (res.headers.get('content-type')?.includes('application/json')) {
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Request failed');
    return data.data;
  }
  if (!res.ok) throw new Error('Request failed');
  return res; // for file downloads (excel/pdf export)
}

async function tryRefresh() {
  try {
    const res = await fetch(API_BASE + '/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: AdminAuth.getRefreshToken() })
    });
    const data = await res.json();
    if (!data.ok) return false;
    AdminAuth.setSession({ accessToken: data.data.accessToken });
    return true;
  } catch (e) { return false; }
}

const api = {
  get: (path) => apiRequest(path),
  post: (path, body) => apiRequest(path, { method: 'POST', body }),
  patch: (path, body) => apiRequest(path, { method: 'PATCH', body }),
  del: (path) => apiRequest(path, { method: 'DELETE' }),
  upload: (path, formData) => apiRequest(path, { method: 'POST', body: formData, isForm: true })
};
