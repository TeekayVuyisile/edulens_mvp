import { describe, it, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { tokenStore } from '../lib/http';
import { mockApi, renderApp, SCHOOL_ADMIN } from './utils';

const PARENT = { user_id: 'u-parent', email: 'zanele@example.com', first_name: 'Zanele', last_name: 'Dlamini', role: 'parent' };

const CHILD = {
  learner_id: 'l-1',
  first_name: 'Amahle',
  last_name: 'Dlamini',
  school_name: 'Galeshewe Primary',
  school_phone: '053 123 4567',
  school_email: 'office@galeshewe.co.za',
  class_name: 'Grade 2A',
  grade_level: '2',
  academic_year: 2026,
  teacher_first_name: 'Naledi',
  teacher_last_name: 'Khumalo',
  average: 72.5,
  last_marked_at: null,
};

const mark = (id, term, extra = {}) => ({
  assessment_id: id,
  assessment_name: `Test ${id}`,
  subject_name: 'Mathematics',
  term_number: term,
  scheduled_date: null,
  percentage: 70,
  teacher_feedback: null,
  ...extra,
});

const signIn = (user, routes) => {
  tokenStore.set('token');
  return mockApi({ 'GET /api/auth/profile': { status: 'success', data: { user } }, ...routes });
};

describe('Parent portal', () => {
  it("shows each child with their class teacher and average, and only the parent's menu", async () => {
    signIn(PARENT, { 'GET /api/parent/children': { status: 'success', data: { children: [CHILD] } } });

    renderApp('/dashboard');

    const card = await screen.findByRole('link', { name: /Amahle Dlamini/ });
    expect(card).toHaveAttribute('href', '/parent/children/l-1');
    expect(within(card).getByText(/Grade 2A · Grade 2 · Naledi Khumalo/)).toBeInTheDocument();
    expect(within(card).getByText('Level 6')).toBeInTheDocument();
    const nav = screen.getAllByRole('navigation', { name: 'Main navigation' })[0];
    expect(within(nav).getAllByRole('link').map((l) => l.textContent)).toEqual(['My children']);
  });

  it("shows marks with the teacher's comments, filtered by term", async () => {
    const user = userEvent.setup();
    signIn(PARENT, {
      'GET /api/parent/children/l-1': {
        status: 'success',
        data: {
          child: CHILD,
          subjects: [{ subject_name: 'Mathematics', assessments: 2, average: 72.5 }],
          marks: [mark('a', '2', { teacher_feedback: 'Counts confidently to 100' }), mark('b', '1')],
        },
      },
    });

    renderApp('/parent/children/l-1');

    expect(await screen.findByText('Counts confidently to 100')).toBeInTheDocument();
    expect(screen.getByText('What the levels mean')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Term 1' }));
    expect(screen.queryByText('Test a')).not.toBeInTheDocument();
    expect(screen.getByText('Test b')).toBeInTheDocument();
  });

  it('keeps parents out of staff pages', async () => {
    signIn(PARENT, {});

    renderApp('/teacher/assessments');

    expect(await screen.findByRole('heading', { name: /don’t have access|not authorised|unauthori/i })).toBeInTheDocument();
  });
});

describe('Inviting a parent (school admin)', () => {
  it('prefills from the learner record and shows the invitation link to share', async () => {
    const user = userEvent.setup();
    const requests = signIn(SCHOOL_ADMIN, {
      'GET /api/school-admin/learners/l-1': {
        status: 'success',
        data: {
          learner: {
            ...CHILD,
            current_class_id: 'c-1',
            academic_status: 'active',
            date_of_birth: '2019-03-01',
            guardian_name: 'Zanele Dlamini',
            guardian_email: 'zanele@example.com',
          },
          history: [],
          performance: [],
        },
      },
      'GET /api/school-admin/classes': { status: 'success', data: { classes: [], years: [2026], year: 2026 } },
      'GET /api/school-admin/learners/l-1/guardians': { status: 'success', data: { guardians: [] } },
      'POST /api/school-admin/learners/l-1/guardians': ({ body }) => ({
        status: 'success',
        message: 'Invited',
        data: {
          guardian: { user_id: 'u-parent', ...body },
          invite: { link: 'http://localhost/reset-password?token=abc&invite=1', emailSent: false, expiresIn: '7 days' },
        },
      }),
    });

    renderApp('/school-admin/learners/l-1');
    await user.click(await screen.findByRole('button', { name: /^Invite$/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Invite a parent to follow Amahle' });
    expect(within(dialog).getByLabelText('Email address')).toHaveValue('zanele@example.com');
    expect(within(dialog).getByLabelText('First name')).toHaveValue('Zanele');
    await user.selectOptions(within(dialog).getByLabelText(/Relationship/), 'Mother');
    await user.click(within(dialog).getByRole('button', { name: 'Send invitation' }));

    expect(await screen.findByRole('dialog', { name: 'Invitation ready' })).toBeInTheDocument();
    await waitFor(() => expect(requests.some((r) => r.method === 'POST')).toBe(true));
    expect(requests.find((r) => r.method === 'POST').body).toEqual({
      email: 'zanele@example.com',
      first_name: 'Zanele',
      last_name: 'Dlamini',
      relationship: 'Mother',
    });
  });
});
