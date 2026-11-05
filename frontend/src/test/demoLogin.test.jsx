import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { tokenStore } from '../lib/http';
import { mockApi, renderApp, SCHOOL_ADMIN, TEACHER } from './utils';

const DEMO = {
  status: 'success',
  data: {
    enabled: true,
    accounts: [
      { key: 'school_admin', role: 'school_admin', name: 'Lindiwe Mokoena', description: 'Classes and reports' },
      { key: 'teacher', role: 'teacher', name: 'Thandi Nkosi', description: 'Marks entry' },
      { key: 'parent', role: 'parent', name: 'Zanele Dlamini', description: 'Two children' },
    ],
  },
};

describe('demo sign-in', () => {
  it('signs in with one click, keeps the normal form, and says it’s a demo', async () => {
    const user = userEvent.setup();
    const requests = mockApi({
      'GET /api/auth/demo': DEMO,
      'POST /api/auth/demo-login': {
        status: 'success',
        data: { token: 'demo-token', user: { ...TEACHER, is_demo: true } },
      },
    });

    renderApp('/login');

    const teacher = await screen.findByRole('button', { name: 'Sign in as the demo teacher, Thandi Nkosi' });
    expect(teacher).toHaveAccessibleDescription('Marks entry');
    expect(screen.getByRole('button', { name: /demo school admin/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    await user.click(teacher);

    expect(await screen.findByText('Demo account.')).toBeInTheDocument();
    expect(requests.find((r) => r.url === '/api/auth/demo-login').body).toEqual({ account: 'teacher' });
    expect(tokenStore.get()).toBe('demo-token');

    await user.click(screen.getByRole('button', { name: 'Try another role' }));
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(tokenStore.get()).toBeNull();
  });

  it('switching roles from a deep page opens the new role’s dashboard', async () => {
    const user = userEvent.setup();
    tokenStore.set('teacher-token');
    const requests = mockApi({
      'GET /api/auth/profile': { status: 'success', data: { user: { ...TEACHER, is_demo: true } } },
      'GET /api/teacher/worksheets/library': { status: 'success', data: { worksheets: [] } },
      'GET /api/auth/demo': DEMO,
      'POST /api/auth/demo-login': {
        status: 'success',
        data: { token: 'admin-token', user: { ...SCHOOL_ADMIN, is_demo: true } },
      },
    });

    renderApp('/teacher/worksheets');
    await user.click(await screen.findByRole('button', { name: 'Try another role' }));
    await user.click(await screen.findByRole('button', { name: /demo school admin/ }));

    await waitFor(() => expect(requests.some((r) => r.url === '/api/school-admin/dashboard')).toBe(true));
    expect(screen.queryByText(/don’t have access/)).toBeNull();
  });

  it('shows only the normal form when the server has no demo', async () => {
    mockApi({ 'GET /api/auth/demo': { status: 'success', data: { enabled: false, accounts: [] } } });

    renderApp('/login');

    expect(await screen.findByLabelText('Email address')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Explore the demo')).toBeNull());
  });

  it('shows no banner for a real account', async () => {
    tokenStore.set('teacher-token');
    mockApi({ 'GET /api/auth/profile': { status: 'success', data: { user: TEACHER } } });

    renderApp('/profile');

    expect(await screen.findByRole('button', { name: /account menu/i })).toBeInTheDocument();
    expect(screen.queryByText('Demo account.')).toBeNull();
  });
});
