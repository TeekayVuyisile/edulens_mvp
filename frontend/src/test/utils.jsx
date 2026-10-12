import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { AxiosError } from 'axios';
import http from '../lib/http';
import { AuthProvider } from '../contexts/AuthContext';
import { AppRoutes } from '../App';

export const TEACHER = {
  user_id: 'u-teacher',
  email: 'thandi@school.co.za',
  first_name: 'Thandi',
  last_name: 'Nkosi',
  role: 'teacher',
};

/** A failed response for mockApi routes. */
export const fail = (status, message) => ({ __fail: true, status, data: { status: 'error', message } });

const originalAdapter = http.defaults.adapter;

/**
 * Replaces the network with a route table such as
 *   { 'GET /api/auth/profile': {...body}, 'POST /api/auth/login': fail(401, 'Invalid credentials') }
 * Requests still run through the real axios interceptors (token header, 401 handling).
 * Returns the list of requests made, as { method, url, body, headers }.
 */
export const mockApi = (routes = {}) => {
  const requests = [];

  http.defaults.adapter = async (config) => {
    const method = config.method.toUpperCase();
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
    requests.push({ method, url: config.url, body, headers: config.headers });

    const key = Object.keys(routes).find((route) => {
      const [m, path] = route.split(' ');
      return m === method && config.url.split('?')[0] === path;
    });
    const result = key ? routes[key] : fail(404, `No mock for ${method} ${config.url}`);
    const response = {
      data: result?.__fail ? result.data : result,
      status: result?.__fail ? result.status : 200,
      statusText: '',
      headers: {},
      config,
    };

    if (result?.__fail) {
      throw new AxiosError(result.data.message, AxiosError.ERR_BAD_REQUEST, config, {}, response);
    }
    return response;
  };

  return requests;
};

export const restoreApi = () => {
  http.defaults.adapter = originalAdapter;
};

/** Renders the real route table at `path`. Animations are switched off. */
export const renderApp = (path = '/') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <MotionConfig reducedMotion="always">
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MotionConfig>
    </MemoryRouter>
  );
