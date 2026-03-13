// API Configuration
const API_BASE = 'http://localhost:3001/api';

// Token Management
const TokenService = {
  getAccessToken: () => localStorage.getItem('accessToken'),
  getRefreshToken: () => localStorage.getItem('refreshToken'),
  setTokens: (access, refresh) => {
    localStorage.setItem('accessToken', access);
    localStorage.setItem('refreshToken', refresh);
  },
  clearTokens: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  },
  getUser: () => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
  },
  setUser: (user) => localStorage.setItem('user', JSON.stringify(user))
};

// HTTP Client with auto token refresh
const http = {
  async request(method, endpoint, data = null, retry = true) {
    const headers = { 'Content-Type': 'application/json' };
    const token = TokenService.getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const config = { method, headers };
    if (data) config.body = JSON.stringify(data);

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, config);
      const json = await res.json();

      if (res.status === 401 && json.code === 'TOKEN_EXPIRED' && retry) {
        const refreshed = await http.refreshToken();
        if (refreshed) return http.request(method, endpoint, data, false);
        else { TokenService.clearTokens(); window.location.href = 'index.html'; return null; }
      }

      return { ok: res.ok, status: res.status, data: json };
    } catch (err) {
      console.error('Network error:', err);
      return { ok: false, status: 0, data: { success: false, message: 'Network error. Is the backend running?' } };
    }
  },

  async refreshToken() {
    const refreshToken = TokenService.getRefreshToken();
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });
      const json = await res.json();
      if (res.ok && json.data) {
        TokenService.setTokens(json.data.accessToken, json.data.refreshToken);
        return true;
      }
      return false;
    } catch { return false; }
  },

  get: (endpoint) => http.request('GET', endpoint),
  post: (endpoint, data) => http.request('POST', endpoint, data),
  put: (endpoint, data) => http.request('PUT', endpoint, data),
  delete: (endpoint) => http.request('DELETE', endpoint)
};

// Auth API
const AuthAPI = {
  register: (data) => http.post('/auth/register', data),
  login: (data) => http.post('/auth/login', data),
  logout: () => http.post('/auth/logout', { refreshToken: TokenService.getRefreshToken() }),
  getProfile: () => http.get('/auth/profile'),
  updateProfile: (data) => http.put('/auth/profile', data)
};

// Tasks API
const TasksAPI = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return http.get(`/tasks${query ? '?' + query : ''}`);
  },
  getById: (id) => http.get(`/tasks/${id}`),
  create: (data) => http.post('/tasks', data),
  update: (id, data) => http.put(`/tasks/${id}`, data),
  delete: (id) => http.delete(`/tasks/${id}`)
};

// Projects API
const ProjectsAPI = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return http.get(`/projects${query ? '?' + query : ''}`);
  },
  getById: (id) => http.get(`/projects/${id}`),
  create: (data) => http.post('/projects', data),
  update: (id, data) => http.put(`/projects/${id}`, data),
  delete: (id) => http.delete(`/projects/${id}`)
};
