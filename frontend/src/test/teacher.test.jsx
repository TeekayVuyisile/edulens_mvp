import { describe, it, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { tokenStore } from '../lib/http';
import { currentTerm } from '../lib/format';
import { mockApi, renderApp, TEACHER } from './utils';

const CLASS = {
  class_id: 'class-1a',
  class_name: 'Grade 1A',
  grade_level: '1',
  academic_year: 2026,
  max_capacity: 30,
  is_active: true,
  is_primary: true,
  learner_count: 2,
  assessment_count: 1,
  average: 62.5,
  teachers: [{ user_id: 'u-teacher', first_name: 'Thandi', last_name: 'Nkosi', is_primary: true, is_active: true }],
};

const ASSESSMENT = {
  assessment_id: 'as-1',
  assessment_name: 'Counting to 100',
  assessment_type: 'test',
  class_id: 'class-1a',
  class_name: 'Grade 1A',
  class_is_active: true,
  subject_name: 'Mathematics',
  term_number: '4',
  total_marks: '20.00',
  scheduled_date: '2026-10-05',
  learner_count: 2,
  marked_count: 1,
  average: 85,
};

const MARKS = [
  { learner_id: 'l-1', first_name: 'Anele', last_name: 'Adams', in_class: true, marks_obtained: 17, percentage: 85, teacher_feedback: null },
  { learner_id: 'l-2', first_name: 'Bongi', last_name: 'Zulu', in_class: true, marks_obtained: null, percentage: null, teacher_feedback: null },
];

const asTeacher = (routes = {}) => {
  tokenStore.set('teacher-token');
  return mockApi({
    'GET /api/auth/profile': { status: 'success', data: { user: { ...TEACHER, school_name: 'Galeshewe Primary' } } },
    'GET /api/teacher/classes': { status: 'success', data: { classes: [CLASS] } },
    ...routes,
  });
};

describe('Teacher dashboard', () => {
  it('leads with what still needs marking', async () => {
    asTeacher({
      'GET /api/teacher/dashboard': {
        status: 'success',
        data: {
          year: 2026,
          summary: { classes: 1, learners: 2, to_mark: 1, average: 62.5 },
          classes: [CLASS],
          toMark: [ASSESSMENT],
          upcoming: [],
        },
      },
    });

    renderApp('/dashboard');

    const link = await screen.findByRole('link', { name: /Counting to 100/ });
    expect(link).toHaveAttribute('href', '/teacher/assessments/as-1');
    expect(within(link).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByText(`Term ${currentTerm()} at Galeshewe Primary. Here’s what needs you today.`)).toBeInTheDocument();
  });
});

describe('Entering marks', () => {
  const marksRoutes = (onSave) => ({
    'GET /api/teacher/assessments/as-1': { status: 'success', data: { assessment: ASSESSMENT, resources: [] } },
    'GET /api/teacher/assessments/as-1/marks': { status: 'success', data: { assessment: ASSESSMENT, marks: MARKS } },
    'PUT /api/teacher/assessments/as-1/marks': ({ body }) => {
      onSave?.(body);
      return { status: 'success', message: '1 mark saved', data: {} };
    },
  });

  it('shows live results, moves on with Enter, and saves only what changed', async () => {
    const user = userEvent.setup();
    const saved = [];
    asTeacher(marksRoutes((body) => saved.push(body)));

    renderApp('/teacher/assessments/as-1');

    const bongi = await screen.findByLabelText('Mark for Bongi Zulu, out of 20');
    const anele = screen.getByLabelText('Mark for Anele Adams, out of 20');
    expect(anele).toHaveValue('17');

    await user.click(anele);
    await user.keyboard('{Enter}');
    expect(bongi).toHaveFocus();

    await user.type(bongi, '12');
    const row = bongi.closest('tr');
    expect(within(row).getByText('60%')).toBeInTheDocument();
    expect(within(row).getByText('L5')).toBeInTheDocument();
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save marks' }));

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]).toEqual({ marks: [{ learner_id: 'l-2', marks_obtained: 12, teacher_feedback: null }] });
  });

  it('flags a mark above the total and won’t send it', async () => {
    const user = userEvent.setup();
    const saved = [];
    asTeacher(marksRoutes((body) => saved.push(body)));

    renderApp('/teacher/assessments/as-1');
    const bongi = await screen.findByLabelText('Mark for Bongi Zulu, out of 20');
    await user.type(bongi, '25');

    expect(bongi).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Out of 20')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save marks' }));
    expect(saved).toHaveLength(0);
    expect(bongi).toHaveFocus();
  });

  it('is read-only for a past class', async () => {
    const past = { ...ASSESSMENT, class_is_active: false };
    asTeacher({
      'GET /api/teacher/assessments/as-1': { status: 'success', data: { assessment: past, resources: [] } },
      'GET /api/teacher/assessments/as-1/marks': { status: 'success', data: { assessment: past, marks: MARKS } },
    });

    renderApp('/teacher/assessments/as-1');

    expect(await screen.findByLabelText('Mark for Anele Adams, out of 20')).toBeDisabled();
    expect(screen.getByText(/no longer active, so these marks are read-only/)).toBeInTheDocument();
  });
});

describe('Creating an assessment', () => {
  it("offers the class's subjects and topics and defaults to the current term", async () => {
    const user = userEvent.setup();
    const requests = asTeacher({
      'GET /api/teacher/assessments': { status: 'success', data: { assessments: [] } },
      'GET /api/teacher/assessments/options': {
        status: 'success',
        data: {
          class: CLASS,
          subjects: [{ subject_id: 'sub-maths', subject_name: 'Mathematics', topics: [{ topic_id: 'top-1', topic_name: 'Counting' }] }],
        },
      },
      'POST /api/teacher/assessments': ({ body }) => ({
        status: 'success',
        message: 'Created',
        data: { assessment: { ...ASSESSMENT, ...body, assessment_id: 'as-new' } },
      }),
      'GET /api/teacher/assessments/as-new': { status: 'success', data: { assessment: ASSESSMENT, resources: [] } },
      'GET /api/teacher/assessments/as-new/marks': { status: 'success', data: { assessment: ASSESSMENT, marks: [] } },
    });

    renderApp('/teacher/assessments');
    await user.click(await screen.findByRole('button', { name: 'Create your first assessment' }));
    const dialog = await screen.findByRole('dialog', { name: 'New assessment' });
    expect(within(dialog).getByLabelText('Term')).toHaveValue(currentTerm());
    await user.type(within(dialog).getByLabelText('Name'), 'Shapes quiz');
    await user.selectOptions(await within(dialog).findByLabelText('Subject'), 'sub-maths');
    await user.selectOptions(within(dialog).getByLabelText(/Topic/), 'top-1');
    await user.type(within(dialog).getByLabelText('Total marks'), '10');
    await user.click(within(dialog).getByRole('button', { name: 'Create assessment' }));

    await waitFor(() => expect(requests.some((r) => r.method === 'POST')).toBe(true));
    expect(requests.find((r) => r.method === 'POST').body).toMatchObject({
      class_id: 'class-1a',
      assessment_name: 'Shapes quiz',
      subject_id: 'sub-maths',
      topic_id: 'top-1',
      total_marks: 10,
    });
    expect(await screen.findByRole('heading', { name: 'Counting to 100' })).toBeInTheDocument();
  });
});

describe('Class marksheet', () => {
  it('shows learners against assessments, flagging marks below 50%', async () => {
    asTeacher({
      'GET /api/teacher/classes/class-1a': { status: 'success', data: { class: CLASS, learners: [] } },
      'GET /api/teacher/classes/class-1a/marksheet': {
        status: 'success',
        data: {
          class: CLASS,
          assessments: [{ assessment_id: 'as-1', assessment_name: 'Counting to 100', assessment_type: 'test', subject_name: 'Mathematics' }],
          learners: [{ learner_id: 'l-1', first_name: 'Anele', last_name: 'Adams', marks: { 'as-1': 40 }, average: 40 }],
        },
      },
    });

    renderApp('/teacher/classes/class-1a?tab=marks');

    const row = (await screen.findByRole('rowheader', { name: 'Adams, Anele' })).closest('tr');
    const cells = within(row).getAllByText('40%');
    expect(cells).toHaveLength(2);
    expect(cells[0]).toHaveClass('el-marksheet__cell--low');
  });
});
