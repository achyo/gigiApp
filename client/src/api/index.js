import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// ── Request: attach access token ──────────────────────────────────────────
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('access_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// ── Response: auto-refresh on 401 ────────────────────────────────────────
let _refreshing = false;
let _queue = [];

api.interceptors.response.use(
  res => res,
  async err => {
    const orig = err.config;
    if (err.response?.status !== 401 || orig._retry) return Promise.reject(err);
    const code = err.response?.data?.error?.code;
    if (code !== 'TOKEN_EXPIRED') {
      // Token invalid or revoked — force logout
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/login';
      return Promise.reject(err);
    }
    if (_refreshing) {
      return new Promise((resolve, reject) => {
        _queue.push({ resolve, reject });
      }).then(token => {
        orig.headers.Authorization = `Bearer ${token}`;
        return api(orig);
      });
    }
    _refreshing = true;
    orig._retry = true;
    try {
      const refresh_token = localStorage.getItem('refresh_token');
      const { data } = await axios.post('/api/auth/refresh', { refresh_token });
      const newToken = data.data.access_token;
      localStorage.setItem('access_token', newToken);
      orig.headers.Authorization = `Bearer ${newToken}`;
      _queue.forEach(p => p.resolve(newToken));
      _queue = [];
      return api(orig);
    } catch (e) {
      _queue.forEach(p => p.reject(e));
      _queue = [];
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/login';
      return Promise.reject(e);
    } finally {
      _refreshing = false;
    }
  }
);

export default api;

// ── Typed helpers ─────────────────────────────────────────────────────────
export const authApi = {
  login:          (email, password) => api.post('/auth/login', { email, password }),
  logout:         (refresh_token)   => api.post('/auth/logout', { refresh_token }),
  changePassword: (current_password, new_password) => api.post('/auth/change-password', { current_password, new_password }),
};

export const usersApi = {
  list:              (params) => api.get('/users', { params }),
  create:            (data)  => api.post('/users', data),
  delete:            (id)    => api.delete(`/users/${id}`),
  update:            (id, d) => api.patch(`/users/${id}`, d),
  preferences:       (id)    => api.get(`/users/${id}/preferences`),
  updatePreferences: (id, d) => api.patch(`/users/${id}/preferences`, d),
};

export const specialistsApi = {
  list:            ()              => api.get('/specialists'),
  update:          (id, d)         => api.patch(`/specialists/${id}`, d),
  clients:         (id)            => api.get(`/specialists/${id}/clients`),
  studentProgress: (specialistId)  => api.get('/specialists/me/student-progress', {
    params: specialistId ? { specialist_id: specialistId } : undefined,
  }),
};

export const clientsApi = {
  list:   (params)  => api.get('/clients', { params }),
  create: (data)    => api.post('/clients', data),
  update: (id, d)   => api.patch(`/clients/${id}`, d),
  delete: (id)      => api.delete(`/clients/${id}`),
};

export const categoriesApi = {
  list:   (params) => api.get('/categories', { params }),
  create: (data)   => api.post('/categories', data),
  update: (id, d)  => api.patch(`/categories/${id}`, d),
  delete: (id)     => api.delete(`/categories/${id}`),
};

export const objectsApi = {
  list:          (params)      => api.get('/objects', { params }),
  get:           (id)          => api.get(`/objects/${id}`),
  create:        (data)        => api.post('/objects', data),
  update:        (id, d)       => api.patch(`/objects/${id}`, d),
  delete:        (id)          => api.delete(`/objects/${id}`),
  getRepresentations: (id)     => api.get(`/objects/${id}/representations`),
  uploadRepresentation: (id, formData) => api.post(`/objects/${id}/representations`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  setModel3d: (id, level, model_3d_url) => api.post(`/objects/${id}/representations`,
    { level, model_3d_url }, { headers: { 'Content-Type': 'application/json' } }),
  deleteRepresentation: (id, level) => api.delete(`/objects/${id}/representations/${level}`),
};

export const activitiesApi = {
  list:   (params) => api.get('/activities', { params }),
  get:    (id)     => api.get(`/activities/${id}`),
  create: (data)   => api.post('/activities', data),
  update: (id, d)  => api.patch(`/activities/${id}`, d),
  delete: (id)     => api.delete(`/activities/${id}`),
};

export const assignmentsApi = {
  list:        (params)  => api.get('/assignments', { params }),
  forClient:   (clientId)=> api.get(`/assignments/client/${clientId}`),
  progress:    (id)      => api.get(`/assignments/${id}/progress`),
  create:      (data)    => api.post('/assignments', data),
  bulk:        (data)    => api.post('/assignments/bulk', data),
  toggle:      (id, on)  => api.patch(`/assignments/${id}`, { is_active: on }),
  complete:    (id)      => api.post(`/assignments/${id}/complete`),
};

export const groupsApi = {
  list:   ()        => api.get('/groups'),
  create: (data)    => api.post('/groups', data),
  update: (id, d)   => api.patch(`/groups/${id}`, d),
  delete: (id)      => api.delete(`/groups/${id}`),
};

export const gameApi = {
  session: (assignmentId)    => api.get(`/game/session/${assignmentId}`),
  progress: (data)           => api.post('/game/progress', data),
  result:  (data)            => api.post('/game/result', data),
  updateStepComment: (id, comment) => api.patch(`/game/step-progress/${id}/comment`, { comment }),
};

export const colorProfilesApi = {
  list:       ()        => api.get('/color-profiles'),
  create:     (data)    => api.post('/color-profiles', data),
  update:     (id, d)   => api.patch(`/color-profiles/${id}`, d),
  setDefault: (id)      => api.patch(`/color-profiles/${id}/set-default`),
  delete:     (id)      => api.delete(`/color-profiles/${id}`),
};

export const subscriptionsApi = {
  activate: (data) => api.post('/subscriptions', data),
  status:   (entityType, entityId) => api.get(`/subscriptions/status/${entityType}/${entityId}`),
};

export const adminApi = {
  stats:           ()           => api.get('/admin/stats'),
  pendingApprovals: ()          => api.get('/admin/pending-approvals'),
  approve:         (type, id)   => api.patch(`/admin/approve/${type}/${id}`),
  reject:          (type, id, note) => api.patch(`/admin/reject/${type}/${id}`, { note }),
};
