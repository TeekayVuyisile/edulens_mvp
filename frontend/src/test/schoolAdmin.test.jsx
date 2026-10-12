import { describe, it, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { tokenStore } from '../lib/http';
import { ageFrom, capsLevel, formatDate, whatsappLink } from '../lib/format';
import { fail, mockApi, renderApp, SCHOOL_ADMIN } from './utils';

const CLASS_1A = {
  class_id: 'class-1a',
  class_name: 'Grade 1A',
  grade_level: '1',
  academic_year: 2026,
  max_capacity: 30,
  learner_count: 29,
  is_active: true,
  teachers: [{ user_id: 't-1', first_name: 'Naledi', last_name: 'Dlamini', is_primary: true, is_active: true }],
};
const CLASS_RA = { ...CLASS_1A, class_id: 'class-ra', class_name: 'Grade RA', grade_level: 'R', learner_count: 5, teachers: [] };

const LEARNER = {
  learner_id: 'l-1',
  first_name: 'Amahle',
  last_name: 'Zulu',
  admission_number: '2026-001',
  date_of_birth: '2019-03-01',
  academic_status: 'active',
  current_class_id: 'class-1a',
  class_name: 'Grade 1A',
  grade_level: '1',
  guardian_name: 'Zanele Zulu',
  guardian_phone: '082 123 4567',
};
const UNPLACED = { ...LEARNER, learner_id: 'l-2', first_name: 'Sipho', last_name: 'Ndlovu', current_class_id: null, class_name: null };

const learnersResponse = (learners, counts = { all: 2, current: 2, unplaced: 1, left: 0 }) => ({
  status: 'success',
  data: { learners, counts, pagination: { page: 1, limit: 25, total: learners.length, totalPages: 1 } },
});
const classesResponse = { status: 'success', data: { classes: [CLASS_RA, CLASS_1A], year: 2026, years: [2026, 2025] } };

const asSchoolAdmin = (routes = {}) => {
  tokenStore.set('school-token');
  return mockApi({
    'GET /api/auth/profile': { status: 'success', data: { user: SCHOOL_ADMIN } },
    'GET /api/school-admin/classes': classesResponse,
    ...routes,
  });
};

describe('format helpers', () => {
  it('reads birthdays as local dates and works out ages', () => {
    expect(formatDate('2019-03-01')).toMatch(/1 Mar 2019/);
    expect(ageFrom('2019-03-01', new Date(2026, 1, 28))).toBe(6);
    expect(ageFrom('2019-03-01', new Date(2026, 2, 1))).toBe(7);
  });

  it('maps marks to CAPS levels and phone numbers to WhatsApp links', () => {
    expect([85, 75, 65, 55, 45, 35, 10].map(capsLevel)).toEqual([7, 6, 5, 4, 3, 2, 1]);
    expect(whatsappLink('082 123 4567')).toBe('https://wa.me/27821234567');
    expect(whatsappLink('n/a')).toBeNull();
  });
});

describe('School admin dashboard', () => {
  it('lists what needs attention with links to fix it', async () => {
    asSchoolAdmin({
      'GET /api/school-admin/dashboard': {
        status: 'success',
        data: {
          year: 2026,
          summary: { teachers: 4, pending_teachers: 1, learners: 120, unplaced_learners: 3, classes: 4, average_mark: 61.5 },
          learnersByGrade: [{ grade: '1', learners: 117 }],
          classes: [{ ...CLASS_RA, learner_count: 5, teacher_first_name: null }],
          attention: {
            classesWithoutTeacher: [{ ...CLASS_RA }],
            fullClasses: [],
            pendingTeachers: [],
            unplacedLearners: 3,
          },
          recentActivity: [],
        },
      },
    });

    renderApp('/dashboard');

    expect(await screen.findByText(/Good (morning|afternoon|evening), Lindiwe/)).toBeInTheDocument();
    expect(screen.getByText('Here’s how Galeshewe Primary is doing.')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Grade RA has no class teacher/ })).toHaveAttribute('href', '/school-admin/classes/class-ra');
    expect(screen.getByRole('link', { name: /3 learners not in a class/ })).toHaveAttribute(
      'href',
      '/school-admin/learners?status=unplaced'
    );
  });
});

describe('Learners', () => {
  it('opens on the filter given in the address and asks the server for it', async () => {
    const requests = asSchoolAdmin({ 'GET /api/school-admin/learners': learnersResponse([UNPLACED]) });

    renderApp('/school-admin/learners?status=unplaced');

    const row = (await screen.findByText('Ndlovu, Sipho')).closest('tr');
    expect(within(row).getAllByText('Not in a class').length).toBeGreaterThan(0);
    expect(screen.getByRole('tab', { name: /Not in a class/ })).toHaveAttribute('aria-selected', 'true');
    expect(requests.find((r) => r.url === '/api/school-admin/learners').params).toMatchObject({ status: 'unplaced' });
  });

  it('adds a learner, offering only classes with room', async () => {
    const user = userEvent.setup();
    const requests = asSchoolAdmin({
      'GET /api/school-admin/learners': learnersResponse([LEARNER]),
      'POST /api/school-admin/learners': ({ body }) =>
        body.date_of_birth
          ? { status: 'success', message: 'Lwazi Khumalo was added', data: { learner: { ...LEARNER, ...body } } }
          : fail(400, 'Validation failed', { errors: [{ path: 'date_of_birth', msg: 'Enter a valid date of birth' }] }),
    });

    renderApp('/school-admin/learners');
    await screen.findByText('Zulu, Amahle');
    await user.click(screen.getByRole('button', { name: /Add learner/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a learner' });
    await user.type(within(dialog).getByLabelText('First name'), 'Lwazi');
    await user.type(within(dialog).getByLabelText('Last name'), 'Khumalo');
    expect(within(dialog).getByRole('option', { name: /Grade 1A .*1 places/ })).not.toBeDisabled();
    await user.selectOptions(within(dialog).getByLabelText('Class'), 'class-ra');
    await user.click(within(dialog).getByRole('button', { name: 'Add learner' }));

    expect(await within(dialog).findByText('Enter a valid date of birth')).toBeInTheDocument();
    expect(requests.at(-1).body).toMatchObject({ first_name: 'Lwazi', class_id: 'class-ra' });
  });

  it('checks a spreadsheet first, explains bad rows, then imports the good ones', async () => {
    const user = userEvent.setup();
    const imports = [];
    asSchoolAdmin({
      'GET /api/school-admin/learners': learnersResponse([LEARNER]),
      'POST /api/school-admin/learners/import': ({ body }) => {
        const dryRun = body.get('dry_run') === 'true';
        imports.push({ dryRun, file: body.get('file').name });
        return dryRun
          ? {
              status: 'success',
              data: {
                summary: { total: 2, ready: 1, withErrors: 1 },
                unknownColumns: ['Notes'],
                rows: [
                  { line: 2, data: { first_name: 'Ayanda', last_name: 'Mthembu', date_of_birth: '2019-05-05' }, class_name: 'Grade 1A', errors: [] },
                  {
                    line: 3,
                    data: { first_name: 'Busi', last_name: 'Nkosi', date_of_birth: null },
                    class_name: null,
                    errors: [{ field: 'date_of_birth', message: '“someday” isn’t a date. Use YYYY-MM-DD or DD/MM/YYYY' }],
                  },
                ],
              },
            }
          : { status: 'success', message: '1 learner was imported; 1 row was skipped', data: { summary: { total: 2, ready: 1, withErrors: 1, imported: 1 }, rows: [] } };
      },
    });

    renderApp('/school-admin/learners');
    await screen.findByText('Zulu, Amahle');
    await user.click(screen.getByRole('button', { name: /Import/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Import learners' });
    const file = new File(['first_name,last_name\n'], 'register.csv', { type: 'text/csv' });
    await user.upload(dialog.querySelector('input[type="file"]'), file);

    expect(await within(dialog).findByText(/isn’t a date/)).toBeInTheDocument();
    expect(within(dialog).getByText('Ignored columns: Notes.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Import 1 learner' }));

    expect(await within(dialog).findByText('1 learner imported')).toBeInTheDocument();
    expect(imports).toEqual([
      { dryRun: true, file: 'register.csv' },
      { dryRun: false, file: 'register.csv' },
    ]);
  });
});

describe('Classes', () => {
  it('groups classes by grade and flags a class without a class teacher', async () => {
    asSchoolAdmin();

    renderApp('/school-admin/classes');

    expect(await screen.findByRole('heading', { name: /Grade R/ })).toBeInTheDocument();
    const card = screen.getByRole('link', { name: /Grade RA/ });
    expect(within(card).getByText('No class teacher')).toBeInTheDocument();
    expect(within(screen.getByRole('link', { name: /Grade 1A/ })).getByRole('meter')).toHaveAttribute('aria-valuenow', '29');
  });

  it('places learners without letting the class overfill', async () => {
    const user = userEvent.setup();
    const requests = asSchoolAdmin({
      'GET /api/school-admin/classes/class-1a': { status: 'success', data: { class: CLASS_1A, learners: [] } },
      'GET /api/school-admin/learners': learnersResponse([UNPLACED, { ...UNPLACED, learner_id: 'l-3', first_name: 'Thabo' }]),
      'POST /api/school-admin/classes/class-1a/learners': { status: 'success', message: '1 learner was added to Grade 1A', data: {} },
    });

    renderApp('/school-admin/classes/class-1a');
    await screen.findByRole('heading', { name: /Grade 1A/ });
    await user.click(screen.getAllByRole('button', { name: /Add learners/ })[0]);
    const dialog = await screen.findByRole('dialog', { name: 'Add learners to Grade 1A' });
    await user.click(await within(dialog).findByLabelText(/Ndlovu, Sipho/));

    // One place left: the other learner can't be ticked as well.
    expect(within(dialog).getByLabelText(/Ndlovu, Thabo/)).toBeDisabled();
    expect(within(dialog).getByText(/No places left/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Add 1 learner' }));

    await waitFor(() => expect(requests.some((r) => r.method === 'POST')).toBe(true));
    expect(requests.find((r) => r.method === 'POST').body).toEqual({ learner_ids: ['l-2'] });
  });
});

describe('Teachers', () => {
  it('invites a teacher and shows the link to share', async () => {
    const user = userEvent.setup();
    asSchoolAdmin({
      'GET /api/school-admin/teachers': {
        status: 'success',
        data: { teachers: [], counts: { all: 0, active: 0, pending: 0, inactive: 0 }, pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } },
      },
      'POST /api/school-admin/teachers': ({ body }) => ({
        status: 'success',
        message: 'Invited',
        data: {
          teacher: { user_id: 't-9', ...body },
          invite: { link: 'http://localhost/reset-password?token=abc&invite=1', emailSent: false, expiresIn: '7 days' },
        },
      }),
    });

    renderApp('/school-admin/teachers');
    await user.click(await screen.findByRole('button', { name: 'Invite your first teacher' }));
    const dialog = await screen.findByRole('dialog', { name: 'Invite a teacher' });
    await user.type(within(dialog).getByLabelText('First name'), 'Thandi');
    await user.type(within(dialog).getByLabelText('Last name'), 'Nkosi');
    await user.type(within(dialog).getByLabelText('Email address'), 'thandi@school.co.za');
    await user.click(within(dialog).getByRole('button', { name: 'Send invitation' }));

    expect(await screen.findByRole('dialog', { name: 'Invitation ready' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('http://localhost/reset-password?token=abc&invite=1')).toBeInTheDocument();
  });
});
