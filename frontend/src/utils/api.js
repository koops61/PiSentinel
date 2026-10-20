// API client wrapper for PiSentinel backend

const TOKEN_KEY = 'pisentinel_token';

export const authStorage = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (token) => localStorage.setItem(TOKEN_KEY, token),
  removeToken: () => localStorage.removeItem(TOKEN_KEY)
};

export async function apiFetch(endpoint, options = {}) {
  const token = authStorage.getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers
  });

  if (response.status === 401) {
    // Session expired or unauthenticated
    authStorage.removeToken();
    window.dispatchEvent(new CustomEvent('pisentinel:unauthorized'));
    const errorData = await response.json().catch(() => ({ detail: 'Session expirée' }));
    throw new Error(errorData.detail || 'Non autorisé');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: `Erreur HTTP ${response.status}` }));
    throw new Error(errorData.detail || `Erreur serveur (${response.status})`);
  }

  return response.json();
}

export const api = {
  auth: {
    getConfig: () => apiFetch('/api/auth/config'),
    loginGoogle: (credential) => apiFetch('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential })
    }),
    loginLocal: (username, password) => apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    }),
    getMe: () => apiFetch('/api/auth/me'),
    logout: () => apiFetch('/api/auth/logout', { method: 'POST' })
  },
  system: {
    getStatus: () => apiFetch('/api/system/status'),
    getSummary: () => apiFetch('/api/system/summary')
  },
  ports: {
    getPorts: () => apiFetch('/api/ports'),
    getHardeningRules: () => apiFetch('/api/ports/hardening-rules')
  },
  tools: {
    getTools: () => apiFetch('/api/tools'),
    control: (toolId, action) => apiFetch(`/api/tools/${toolId}/control`, {
      method: 'POST',
      body: JSON.stringify({ action })
    }),
    install: (toolId) => apiFetch(`/api/tools/${toolId}/install`, {
      method: 'POST'
    })
  },
  attacks: {
    getAttacks: () => apiFetch('/api/attacks'),
    trigger: (ip, service) => apiFetch('/api/attacks/trigger', {
      method: 'POST',
      body: JSON.stringify({ ip, service })
    }),
    getBanned: () => apiFetch('/api/attacks/banned'),
    ban: (ip, reason) => apiFetch('/api/attacks/ban', {
      method: 'POST',
      body: JSON.stringify({ ip, reason })
    }),
    unban: (ip) => apiFetch(`/api/attacks/ban/${encodeURIComponent(ip)}`, {
      method: 'DELETE'
    })
  }
};
