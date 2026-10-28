import axios from 'axios';
import { API_ORIGIN, whenServerReady } from './serverStatus';

// Pages call the shared axios instance directly (axios.get('/api/...')), so the
// session logic lives in interceptors on that instance rather than in each page.

const TOKEN_KEY = 'token';

export const tokenStore = {
  get() {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      return token && token !== 'undefined' && token !== 'null' ? token : null;
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // Storage unavailable (private mode); the session lasts until reload.
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // ignore
    }
  },
};

axios.defaults.timeout = 15000;
// Pages use relative /api/... paths. In production the API is a separate service (the app is a
// static site), so VITE_API_URL points them at it; locally the Vite proxy handles /api.
if (API_ORIGIN) axios.defaults.baseURL = API_ORIGIN;

axios.interceptors.request.use(async (config) => {
  // Hold requests while a sleeping API wakes up, so the timeout only counts once it's awake.
  await whenServerReady();
  const token = tokenStore.get();
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Credential endpoints answer 401 for a wrong password; that is not an expired session.
const isCredentialRequest = (url = '') => /\/api\/auth\/(login|forgot-password|reset-password)/.test(url);

let onUnauthorized = null;

/** AuthProvider registers here to be told when the server rejects the session. */
export const setUnauthorizedHandler = (handler) => {
  onUnauthorized = handler;
};

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isCredentialRequest(error.config?.url) && onUnauthorized) {
      onUnauthorized(error.response.data?.message);
    }
    return Promise.reject(error);
  }
);

/** The server's message for a failed request, or a fallback. */
export const errorMessage = (error, fallback = 'Something went wrong. Please try again.') => {
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.code === 'ECONNABORTED' || error?.message === 'Network Error') {
    return 'Cannot reach the server. Check your connection and try again.';
  }
  return fallback;
};

export default axios;
