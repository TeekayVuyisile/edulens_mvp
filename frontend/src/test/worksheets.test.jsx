import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { tokenStore } from '../lib/http';
import WorksheetDocument from '../components/worksheets/WorksheetDocument';
import { mockApi, renderApp, TEACHER } from './utils';

const CONTENT = {
  title: 'Counting to 20',
  instructions: 'Answer every question.',
  teacher_notes: 'Practises counting.',
  questions: [
    { type: 'multiple_choice', prompt: 'What comes after 7?', options: ['6', '8', '9'], pairs: [], answer: '8', marks: 1 },
    { type: 'fill_in_blank', prompt: '10, 11, ___, 13', options: [], pairs: [], answer: '12', marks: 1 },
    {
      type: 'matching',
      prompt: 'Match the numbers',
      options: [],
      pairs: [
        { left: 'two', right: '2' },
        { left: 'three', right: '3' },
        { left: 'four', right: '4' },
      ],
      answer: 'two-2, three-3, four-4',
      marks: 3,
    },
  ],
};

const OPTIONS = {
  status: 'success',
  data: {
    subjects: [{ subject_id: 'sub-1', subject_name: 'Mathematics', grade_level: '1', topics: [{ topic_id: 'top-1', topic_name: 'Counting' }] }],
    grades: ['1'],
    ai: { configured: true, dailyLimit: 30, usedToday: 2 },
  },
};

const REQUEST = {
  request_id: 'req-1',
  status: 'completed',
  subject_name: 'Mathematics',
  topic_name: 'Counting',
  grade_level: '1',
  content: CONTENT,
  saved_worksheet_id: null,
};

const asTeacher = (routes) => {
  tokenStore.set('teacher-token');
  return mockApi({ 'GET /api/auth/profile': { status: 'success', data: { user: TEACHER } }, ...routes });
};

describe('WorksheetDocument', () => {
  it('renders blanks, rotates matching answers and keys them correctly', () => {
    render(<WorksheetDocument worksheet={CONTENT} meta={{ subject_name: 'Mathematics', grade_level: '1' }} showAnswers />);

    expect(screen.getByLabelText('blank')).toBeInTheDocument();
    expect(screen.getByText(/Total:\s*\/\s*5/)).toBeInTheDocument(); // 1 + 1 + 3 marks
    // Right column is 3, 4, 2, so "two" (1) matches C, "three" (2) A, "four" (3) B.
    expect(screen.getByText('1 – C, 2 – A, 3 – B')).toBeInTheDocument();
  });

  it('shows text from the AI as text, never as HTML', () => {
    const sneaky = { ...CONTENT, title: '<img src=x onerror="alert(1)">', questions: [CONTENT.questions[0]] };
    const { container } = render(<WorksheetDocument worksheet={sneaky} />);

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('<img src=x onerror="alert(1)">')).toBeInTheDocument();
  });
});

describe('Making a worksheet', () => {
  it('generates with the chosen options, lets the teacher edit, and saves the edited version', async () => {
    const user = userEvent.setup();
    const saved = [];
    const requests = asTeacher({
      'GET /api/teacher/worksheets/options': OPTIONS,
      'GET /api/teacher/worksheets/requests': { status: 'success', data: { requests: [] } },
      'POST /api/teacher/worksheets/generate': { status: 'success', message: 'Ready', data: { request: REQUEST } },
      'GET /api/teacher/worksheets/requests/req-1': { status: 'success', data: { request: REQUEST } },
      'POST /api/teacher/worksheets/library': ({ body }) => {
        saved.push(body);
        return { status: 'success', message: 'Saved', data: { worksheet: { worksheet_id: 'ws-1' } } };
      },
      'GET /api/teacher/worksheets/library/ws-1': {
        status: 'success',
        data: { worksheet: { worksheet_id: 'ws-1', worksheet_title: 'Counting fun', teacher_id: TEACHER.user_id, content: CONTENT, grade_level: '1' } },
      },
    });

    renderApp('/teacher/worksheets/new');
    expect(await screen.findByText('2 of 30 today')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Subject'), 'sub-1');
    await user.selectOptions(screen.getByLabelText(/Topic/), 'top-1');
    await user.selectOptions(screen.getByLabelText('Language'), 'isiZulu');
    await user.click(screen.getByRole('checkbox', { name: 'Matching' }));
    await user.click(screen.getByRole('button', { name: 'Create worksheet' }));

    expect(await screen.findByRole('article', { name: 'Counting to 20' })).toBeInTheDocument();
    const generateCall = requests.find((r) => r.url === '/api/teacher/worksheets/generate');
    expect(generateCall.body).toMatchObject({
      subject_id: 'sub-1',
      topic_id: 'top-1',
      grade_level: '1',
      language: 'isiZulu',
      question_types: ['multiple_choice', 'fill_in_blank', 'short_answer', 'matching'],
    });

    await user.click(screen.getByRole('tab', { name: 'Edit' }));
    const title = screen.getByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'Counting fun');
    await user.click(screen.getByRole('button', { name: /Save to library/ }));

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]).toMatchObject({ request_id: 'req-1', worksheet: { title: 'Counting fun' } });
    expect(await screen.findByRole('heading', { name: 'Counting fun' })).toBeInTheDocument();
  });

  it('explains when AI isn’t set up', async () => {
    asTeacher({
      'GET /api/teacher/worksheets/options': { ...OPTIONS, data: { ...OPTIONS.data, ai: { configured: false, dailyLimit: 30, usedToday: 0 } } },
      'GET /api/teacher/worksheets/requests': { status: 'success', data: { requests: [] } },
    });

    renderApp('/teacher/worksheets/new');

    expect(await screen.findByText(/aren’t set up on this server yet/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create worksheet' })).toBeDisabled();
  });
});

describe('Worksheet library', () => {
  it("lists the school's worksheets and can narrow to the teacher's own", async () => {
    const user = userEvent.setup();
    const requests = asTeacher({
      'GET /api/teacher/worksheets/library': {
        status: 'success',
        data: {
          worksheets: [
            {
              worksheet_id: 'ws-1', worksheet_title: 'Counting fun', subject_name: 'Mathematics', grade_level: '1',
              language: 'English', question_count: 8, teacher_first_name: 'Thandi', teacher_last_name: 'Nkosi',
              created_at: '2026-10-01T08:00:00Z',
            },
          ],
        },
      },
    });

    renderApp('/teacher/worksheets');

    const card = await screen.findByRole('link', { name: /Counting fun/ });
    expect(within(card).getByText(/8 questions · Thandi Nkosi/)).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Mine' }));
    await waitFor(() => expect(requests.at(-1).params).toMatchObject({ mine: 'true' }));
  });
});
