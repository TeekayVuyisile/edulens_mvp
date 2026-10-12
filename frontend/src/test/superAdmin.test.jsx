import { describe, it, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { tokenStore } from '../lib/http';
import { fail, mockApi, renderApp, SUPER_ADMIN } from './utils';

const SCHOOL_A = {
  school_id: 'school-a',
  school_name: 'Galeshewe Primary',
  school_code: 'GP1234',
  city: 'Kimberley',
  province: 'Northern Cape',
  contact_email: 'office@galeshewe.co.za',
  admin_count: 1,
  teacher_count: 12,
  learner_count: 340,
  class_count: 10,
  is_active: true,
  created_at: '2026-01-10T08:00:00Z',
};
const SCHOOL_B = { ...SCHOOL_A, school_id: 'school-b', school_name: 'Roodepan Junior', school_code: 'RJ5678', admin_count: 0 };

const schoolsResponse = (schools) => ({
  status: 'success',
  data: {
    schools,
    counts: { all: 2, active: 2, inactive: 0, no_admin: 1 },
    pagination: { page: 1, limit: 20, total: schools.length, totalPages: 1 },
  },
});

const asSuperAdmin = (routes = {}) => {
  tokenStore.set('super-token');
  return mockApi({
    'GET /api/auth/profile': { status: 'success', data: { user: SUPER_ADMIN } },
    ...routes,
  });
};

describe('Schools list', () => {
  it('lists schools and flags those without an administrator', async () => {
    asSuperAdmin({ 'GET /api/super-admin/schools': schoolsResponse([SCHOOL_A, SCHOOL_B]) });

    renderApp('/super-admin/schools');

    const rowB = (await screen.findByText('Roodepan Junior')).closest('tr');
    // Rendered once for phones and once for wider screens (CSS shows one).
    expect(within(rowB).getAllByText('No admin yet').length).toBeGreaterThan(0);
    expect(within(screen.getByText('Galeshewe Primary').closest('tr')).getByText('1 admin')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /No admin\s*1/ })).toBeInTheDocument();
  });

  it('asks the server for the chosen filter', async () => {
    const user = userEvent.setup();
    const requests = asSuperAdmin({
      'GET /api/super-admin/schools': ({ params }) =>
        schoolsResponse(params.status === 'no_admin' ? [SCHOOL_B] : [SCHOOL_A, SCHOOL_B]),
    });

    renderApp('/super-admin/schools');
    await screen.findByText('Galeshewe Primary');
    await user.click(screen.getByRole('tab', { name: /No admin/ }));

    await waitFor(() => expect(screen.queryByText('Galeshewe Primary')).not.toBeInTheDocument());
    expect(requests.at(-1).params).toMatchObject({ status: 'no_admin', page: 1 });
    expect(screen.getByRole('tab', { name: /No admin/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('adds a school and shows server validation next to the field', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    const requests = asSuperAdmin({
      'GET /api/super-admin/schools': schoolsResponse([SCHOOL_A]),
      'POST /api/super-admin/schools': () => {
        attempts += 1;
        return attempts === 1
          ? fail(400, 'Validation failed', { errors: [{ path: 'contact_email', msg: 'Enter a valid email address' }] })
          : { status: 'success', message: 'Added', data: { school: { ...SCHOOL_A, school_id: 'new-school' } } };
      },
      'GET /api/super-admin/schools/new-school': {
        status: 'success',
        data: { school: SCHOOL_A, admins: [], curricula: [], stats: { assessmentsThisYear: 0, averageScore: null } },
      },
    });

    renderApp('/super-admin/schools');
    await user.click(await screen.findByRole('button', { name: /add school/i }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('School name'), 'Galeshewe Primary');
    await user.type(within(dialog).getByLabelText('Contact email'), 'bad');
    await user.click(within(dialog).getByRole('button', { name: 'Add school' }));

    expect(await within(dialog).findByText('Enter a valid email address')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Contact email')).toHaveClass('is-invalid');

    await user.clear(within(dialog).getByLabelText('Contact email'));
    await user.type(within(dialog).getByLabelText('Contact email'), 'office@galeshewe.co.za');
    await user.click(within(dialog).getByRole('button', { name: 'Add school' }));

    // A new school opens on its detail page, ready to invite an administrator.
    expect(await screen.findByText('No administrator yet')).toBeInTheDocument();
    expect(requests.find((r) => r.method === 'POST').body).toMatchObject({
      school_name: 'Galeshewe Primary',
      country: 'South Africa',
    });
  });
});

describe('School detail', () => {
  const detail = (admins = []) => ({
    status: 'success',
    data: {
      school: { ...SCHOOL_A, admin_count: admins.length },
      admins,
      curricula: [
        {
          assignment_id: 'as-1',
          curriculum_name: 'CAPS',
          grade_level: 'R-3',
          academic_year: 2026,
        },
      ],
      stats: { assessmentsThisYear: 14, averageScore: 67.5 },
    },
  });

  it('shows stats, curricula and the invitation link after inviting an admin', async () => {
    const user = userEvent.setup();
    const requests = asSuperAdmin({
      'GET /api/super-admin/schools/school-a': detail(),
      'POST /api/super-admin/schools/school-a/admins': {
        status: 'success',
        data: {
          user: { user_id: 'new', first_name: 'Ayanda', last_name: 'Dlamini', email: 'ayanda@galeshewe.co.za' },
          invite: { link: 'http://localhost:5173/reset-password?token=abc&invite=1', emailSent: false, expiresIn: '7 days' },
        },
      },
    });

    renderApp('/super-admin/schools/school-a');
    expect(await screen.findByText('67.5%')).toBeInTheDocument();
    expect(screen.getByText('All grades (R–3) · 2026')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Invite an administrator' }));
    const form = await screen.findByRole('dialog');
    await user.type(within(form).getByLabelText('First name'), 'Ayanda');
    await user.type(within(form).getByLabelText('Last name'), 'Dlamini');
    await user.type(within(form).getByLabelText('Email address'), 'ayanda@galeshewe.co.za');
    await user.click(within(form).getByRole('button', { name: 'Send invitation' }));

    const share = await screen.findByRole('dialog', { name: 'Invitation ready' });
    expect(within(share).getByDisplayValue('http://localhost:5173/reset-password?token=abc&invite=1')).toBeInTheDocument();
    expect(within(share).getByText(/email isn’t set up/i)).toBeInTheDocument();
    expect(within(share).getByRole('link', { name: /whatsapp/i }).getAttribute('href')).toContain('wa.me');
    expect(requests.find((r) => r.method === 'POST').body).toEqual({
      first_name: 'Ayanda',
      last_name: 'Dlamini',
      email: 'ayanda@galeshewe.co.za',
      phone: '',
    });
  });

  it('shows a pending invitation and can resend it', async () => {
    const user = userEvent.setup();
    asSuperAdmin({
      'GET /api/super-admin/schools/school-a': detail([
        { user_id: 'adm', first_name: 'Ayanda', last_name: 'Dlamini', email: 'a@g.co.za', is_active: true, last_login: null },
      ]),
      'POST /api/super-admin/users/adm/account-link': {
        status: 'success',
        data: { link: 'http://x/reset-password?token=def&invite=1', emailSent: true, expiresIn: '7 days', kind: 'invite' },
      },
    });

    renderApp('/super-admin/schools/school-a');
    expect(await screen.findByText('Invite pending')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Resend invitation to Ayanda' }));

    const share = await screen.findByRole('dialog', { name: 'Invitation ready' });
    expect(within(share).getByText(/we emailed this link to a@g.co.za/i)).toBeInTheDocument();
  });

  it('explains why a school with data can’t be deleted', async () => {
    const user = userEvent.setup();
    asSuperAdmin({
      'GET /api/super-admin/schools': schoolsResponse([SCHOOL_A]),
      'DELETE /api/super-admin/schools/school-a': fail(
        409,
        'This school already has staff, classes or learners, so it can’t be deleted. Deactivate it instead.'
      ),
    });

    renderApp('/super-admin/schools');
    await user.click(await screen.findByRole('button', { name: 'Actions for Galeshewe Primary' }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    const confirm = await screen.findByRole('dialog', { name: /delete galeshewe primary/i });
    await user.click(within(confirm).getByRole('button', { name: 'Delete school' }));

    expect(await within(confirm).findByRole('alert')).toHaveTextContent(/deactivate it instead/i);
  });
});

describe('Curricula', () => {
  const tree = {
    status: 'success',
    data: {
      curricula: [
        {
          curriculum_id: 'caps',
          curriculum_name: 'CAPS',
          description: 'South African curriculum',
          is_active: true,
          school_assignment_count: 3,
          subjects: [
            {
              subject_id: 'maths-1',
              subject_name: 'Mathematics',
              grade_level: '1',
              is_active: true,
              topics: [{ topic_id: 't1', topic_name: 'Counting', learning_objectives: 'Count to 100', is_active: true }],
            },
          ],
        },
      ],
    },
  };

  it('shows subjects by grade and reveals topics on demand', async () => {
    const user = userEvent.setup();
    asSuperAdmin({ 'GET /api/super-admin/curricula': tree });

    renderApp('/super-admin/curricula');
    expect(await screen.findByRole('heading', { name: 'Grade 1' })).toBeInTheDocument();
    expect(screen.queryByText('Counting')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^mathematics/i, expanded: false }));

    expect(await screen.findByText('Counting')).toBeInTheDocument();
    expect(screen.getByText('Count to 100')).toBeInTheDocument();
  });

  it('archives a topic after confirming', async () => {
    const user = userEvent.setup();
    const requests = asSuperAdmin({
      'GET /api/super-admin/curricula': tree,
      'PATCH /api/super-admin/topics/t1/status': { status: 'success', message: 'Topic archived', data: {} },
    });

    renderApp('/super-admin/curricula');
    await user.click(await screen.findByRole('button', { name: /^mathematics/i }));
    await user.click(await screen.findByRole('button', { name: 'Actions for Counting' }));
    await user.click(await screen.findByRole('button', { name: 'Archive' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Archive' }));

    await waitFor(() =>
      expect(requests.find((r) => r.method === 'PATCH')).toMatchObject({
        url: '/api/super-admin/topics/t1/status',
        body: { is_active: false },
      })
    );
  });
});

describe('Super admin dashboard', () => {
  it('summarises the platform and links schools that need an admin', async () => {
    asSuperAdmin({
      'GET /api/super-admin/statistics': {
        status: 'success',
        data: {
          summary: {
            schools: 5,
            active_schools: 4,
            school_admins: 4,
            teachers: 31,
            learners: 812,
            classes: 28,
            pending_invites: 2,
            active_last_7_days: 19,
          },
          growth: [{ month: '2026-09', schools: 1, learners: 40 }],
          learnersByGrade: [{ grade: 'R', learners: 200 }],
          recentActivity: [
            { id: 1, description: 'Added a school', actor: 'Zanele Khumalo', school_name: null, created_at: new Date().toISOString() },
          ],
          attention: { schoolsWithoutAdmin: [{ school_id: 'school-b', school_name: 'Roodepan Junior', created_at: '2026-10-01' }] },
        },
      },
    });

    renderApp('/dashboard');

    expect(await screen.findByRole('heading', { name: /zanele/i })).toBeInTheDocument();
    expect(await screen.findByText('812')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /roodepan junior/i })).toHaveAttribute('href', '/super-admin/schools/school-b');
    expect(screen.getByText('added a school')).toBeInTheDocument();
  });
});
