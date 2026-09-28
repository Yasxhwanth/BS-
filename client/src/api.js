import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// Attach JWT token to every request
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('aip_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Auto-logout on 401
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('aip_token');
      localStorage.removeItem('aip_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ─── Auth ───────────────────────────────
export const login    = (data) => api.post('/auth/login', data);
export const register = (data) => api.post('/auth/register', data);
export const getMe    = ()     => api.get('/auth/me');

// ─── Ontology ───────────────────────────
export const getOntology    = ()     => api.get('/ontology');
export const saveOntology   = (data) => api.post('/ontology/save', data);
export const exportOntology = ()     => api.get('/ontology/export');

// ─── Alerts ─────────────────────────────
export const getAlerts       = (params) => api.get('/alerts', { params });
export const acknowledgeAlert = (id)    => api.patch(`/alerts/${id}/acknowledge`);
export const resolveAlert     = (id)    => api.patch(`/alerts/${id}/resolve`);

// ─── Analytics ──────────────────────────
export const getDashboard    = ()   => api.get('/analytics/dashboard');
export const predictNode     = (id) => api.get(`/analytics/predict/${id}`);

// ─── Chat ───────────────────────────────
export const sendChat        = (data) => api.post('/chat', data);
export const getChatHistory  = (id)   => api.get(`/chat/history/${id}`);

// ─── Data Import & Template ─────────────
export const uploadExcelData = (formData) => api.post('/upload/excel', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
});
export const resetDemoData   = () => api.post('/data/reset-demo');

export default api;
