import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import http, { tokenStore } from '../lib/http';
import { fail, mockApi, renderApp, TEACHER } from './utils';

const PROFILE = { 'GET /api/auth/profile': { status: 'success', data: { user: TEACHER } } };

const signedInAsTeacher = (extraRoutes = {}) => {
  tokenStore.set('teacher-token');
  return mockApi({ ...PROFILE, ...extraRoutes });
};

describe('session', () => {
  it('sends a visitor without a session to the sign-in page', async () => {
    mockApi();

    renderApp('/teacher/classes');

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('restores a stored session, sending the token with the request', async () => {
    const requests = signedInAsTeacher();

    renderApp('/unauthorized');

    expect(await screen.findByRole('heading', { name: /don’t have access/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /account menu/i })).toHaveTextContent('Thandi Nkosi');
    expect(requests[0].headers.Authorization).toBe('Bearer teacher-token');
  });

  it('drops an expired session and says why on the sign-in page', async () => {
    tokenStore.set('expired-token');
    mockApi({ 'GET /api/auth/profile': fail(401, 'Session expired. Please sign in again.') });

    renderApp('/dashboard');

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByText('Session expired. Please sign in again.')).toBeInTheDocument();
    expect(tokenStore.get()).toBeNull();
  });

  it('keeps the token when the server is unreachable', async () => {
    tokenStore.set('teacher-token');
    mockApi();
    http.defaults.adapter = async () => {
      throw Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' });
    };

    renderApp('/dashboard');

    expect(await screen.findByText(/cannot reach the server/i)).toBeInTheDocument();
    expect(tokenStore.get()).toBe('teacher-token');
  });
});

describe('role guard', () => {
  it('shows the 403 page when a teacher opens a super admin page', async () => {
    signedInAsTeacher();

    renderApp('/super-admin/schools');

    expect(await screen.findByText('403')).toBeInTheDocument();
  });

  it('lists only the teacher’s sections in the navigation', async () => {
    signedInAsTeacher();

    renderApp('/unauthorized');

    const [nav] = await screen.findAllByRole('navigation', { name: 'Main navigation' });
    const labels = [...nav.querySelectorAll('a')].map((a) => a.textContent);
    expect(labels).toEqual(['Dashboard', 'My classes', 'Assessments', 'Worksheets']);
  });

  it('sends a signed-in user away from the sign-in page', async () => {
    signedInAsTeacher();

    renderApp('/login');

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument());
  });
});

describe('sign in', () => {
  it('signs in and continues to the page the user asked for', async () => {
    const user = userEvent.setup();
    const requests = mockApi({
      'POST /api/auth/login': { status: 'success', data: { token: 'new-token', user: TEACHER } },
    });

    renderApp('/unauthorized');
    await user.type(await screen.findByLabelText('Email address'), 'thandi@school.co.za');
    await user.type(screen.getByLabelText('Password'), 'Password123!');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('403')).toBeInTheDocument();
    expect(requests.at(-1)).toMatchObject({
      method: 'POST',
      url: '/api/auth/login',
      body: { email: 'thandi@school.co.za', password: 'Password123!' },
    });
    expect(tokenStore.get()).toBe('new-token');
  });

  it('shows the server’s message inline when sign-in fails', async () => {
    const user = userEvent.setup();
    mockApi({ 'POST /api/auth/login': fail(401, 'Invalid credentials') });

    renderApp('/login');
    await user.type(screen.getByLabelText('Email address'), 'thandi@school.co.za');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
    expect(tokenStore.get()).toBeNull();
  });

  it('lets the user reveal the password they typed', async () => {
    const user = userEvent.setup();
    mockApi();

    renderApp('/login');
    const password = screen.getByLabelText('Password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));

    expect(password).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('signs out from the account menu', async () => {
    const user = userEvent.setup();
    signedInAsTeacher({ 'POST /api/auth/logout': { status: 'success' } });

    renderApp('/unauthorized');
    await user.click(await screen.findByRole('button', { name: /account menu/i }));
    await user.click(await screen.findByRole('button', { name: /sign out/i }));

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(tokenStore.get()).toBeNull();
  });
});

describe('password reset', () => {
  it('confirms the request without saying whether the account exists', async () => {
    const user = userEvent.setup();
    const requests = mockApi({ 'POST /api/auth/forgot-password': { status: 'success', message: 'ok' } });

    renderApp('/forgot-password');
    await user.type(screen.getByLabelText('Email address'), 'someone@school.co.za');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    expect(screen.getByText(/if an account exists for/i)).toBeInTheDocument();
    expect(requests.at(-1).body).toEqual({ email: 'someone@school.co.za' });
  });

  it('explains a reset link without a token', () => {
    mockApi();

    renderApp('/reset-password');

    expect(screen.getByRole('heading', { name: /isn’t valid/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute('href', '/forgot-password');
  });

  it('checks length and confirmation before calling the server', async () => {
    const user = userEvent.setup();
    const requests = mockApi();

    renderApp('/reset-password?token=abc');
    await user.type(screen.getByLabelText('New password'), 'short');
    await user.type(screen.getByLabelText('Confirm new password'), 'different');
    await user.click(screen.getByRole('button', { name: 'Update password' }));

    expect(screen.getByText('Use at least 8 characters.')).toBeInTheDocument();
    expect(screen.getByText('Passwords don’t match.')).toBeInTheDocument();
    expect(requests).toHaveLength(0);
  });

  it('resets the password with the token from the link', async () => {
    const user = userEvent.setup();
    const requests = mockApi({ 'POST /api/auth/reset-password': { status: 'success', message: 'done' } });

    renderApp('/reset-password?token=abc123');
    await user.type(screen.getByLabelText('New password'), 'BrandNewPass1');
    await user.type(screen.getByLabelText('Confirm new password'), 'BrandNewPass1');
    await user.click(screen.getByRole('button', { name: 'Update password' }));

    expect(await screen.findByRole('heading', { name: 'Password updated' })).toBeInTheDocument();
    expect(requests.at(-1).body).toEqual({ token: 'abc123', password: 'BrandNewPass1' });
  });

  it('offers a new link when the token is rejected', async () => {
    const user = userEvent.setup();
    mockApi({ 'POST /api/auth/reset-password': fail(400, 'Invalid or expired reset token') });

    renderApp('/reset-password?token=old');
    await user.type(screen.getByLabelText('New password'), 'BrandNewPass1');
    await user.type(screen.getByLabelText('Confirm new password'), 'BrandNewPass1');
    await user.click(screen.getByRole('button', { name: 'Update password' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Invalid or expired reset token');
    expect(screen.getByRole('link', { name: 'Request a new link' })).toBeInTheDocument();
  });
});
