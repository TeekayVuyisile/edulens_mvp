import { useMemo, useState } from 'react';
import { Alert, Button, Col, Form, Row, Spinner } from 'react-bootstrap';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LuEye, LuPencil, LuRefreshCw, LuSave, LuSparkles } from 'react-icons/lu';
import { useApi, useDocumentTitle } from '../../hooks/useApi';
import { useMutation } from '../../hooks/useMutation';
import { CLASS_GRADES, gradeLabel, timeAgo } from '../../lib/format';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import FormAlert from '../../components/ui/FormAlert';
import FilterTabs from '../../components/ui/FilterTabs';
import WorksheetDocument from '../../components/worksheets/WorksheetDocument';
import { QUESTION_TYPE_LABELS } from '../../components/worksheets/questionTypes';

const LANGUAGES = ['English', 'Afrikaans', 'isiZulu', 'isiXhosa', 'Sepedi', 'Setswana', 'Sesotho'];
const DIFFICULTIES = { easy: 'Easy', medium: 'Medium', hard: 'Challenging', mixed: 'Mixed' };
const GENERATION_TIMEOUT = 90_000;

const WorksheetCreate = () => {
  useDocumentTitle('New worksheet');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestId = searchParams.get('request');
  const options = useApi('/api/teacher/worksheets/options');
  const recent = useApi('/api/teacher/worksheets/requests');
  const opened = useApi(requestId ? `/api/teacher/worksheets/requests/${requestId}` : null);

  const [form, setForm] = useState(null);
  const [draft, setDraft] = useState(null); // edited worksheet content
  const [syncedRequest, setSyncedRequest] = useState(null);
  const [mode, setMode] = useState('preview');
  const [showAnswers, setShowAnswers] = useState(false);
  const [saveProblem, setSaveProblem] = useState(null);
  const generate = useMutation();
  const save = useMutation();

  // Defaults once the options arrive: the teacher's first grade.
  if (options.data && !form) {
    setForm({
      grade_level: options.data.grades[0] ?? '1',
      subject_id: '',
      topic_id: '',
      difficulty: 'easy',
      number_of_questions: 8,
      question_types: ['multiple_choice', 'fill_in_blank', 'short_answer'],
      language: 'English',
      specific_instructions: '',
    });
  }

  // A freshly generated (or reopened) worksheet becomes the editable draft.
  const request = opened.data?.request ?? null;
  if (request !== syncedRequest) {
    setSyncedRequest(request);
    setDraft(request?.content ?? null);
    setMode('preview');
  }

  const subjects = useMemo(
    () => (options.data?.subjects ?? []).filter((s) => form && (s.grade_level === form.grade_level || s.grade_level === 'R-3')),
    [options.data, form]
  );
  const topics = subjects.find((s) => s.subject_id === form?.subject_id)?.topics ?? [];

  if (!form) {
    return options.error ? (
      <EmptyState icon={LuSparkles} title="Couldn’t load the worksheet maker" action={<Button onClick={options.reload}>Try again</Button>}>
        {options.error}
      </EmptyState>
    ) : (
      <div className="text-center text-body-secondary py-5">
        <Spinner size="sm" className="me-2" aria-hidden="true" /> Loading…
      </div>
    );
  }

  const ai = options.data.ai;
  const set = (changes) => setForm((current) => ({ ...current, ...changes }));
  const toggleType = (type) =>
    set({
      question_types: form.question_types.includes(type)
        ? form.question_types.filter((t) => t !== type)
        : [...form.question_types, type],
    });
  const fieldError = (name) => generate.fieldErrors[name] && <Form.Text className="text-danger d-block">{generate.fieldErrors[name]}</Form.Text>;

  const runGenerate = async (e) => {
    e?.preventDefault();
    const result = await generate.run(
      'post',
      '/api/teacher/worksheets/generate',
      { ...form, topic_id: form.topic_id || null, specific_instructions: form.specific_instructions.trim() || null },
      { timeout: GENERATION_TIMEOUT }
    );
    if (result.ok) {
      setSearchParams({ request: result.data.request.request_id }, { replace: true });
      recent.reload();
      options.reload();
      // On narrow screens the preview is below the form; bring it into view.
      if (window.matchMedia?.('(max-width: 1199.98px)').matches) {
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        setTimeout(() => document.getElementById('ws-preview-heading')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' }), 300);
      }
    }
  };

  const saveToLibrary = async () => {
    setSaveProblem(null);
    const result = await save.run('post', '/api/teacher/worksheets/library', { request_id: request.request_id, worksheet: draft });
    if (!result.ok) setSaveProblem(result.response?.data?.problems?.join(' · ') ?? result.message);
    if (result.ok) {
      toast.success(result.message);
      navigate(`/teacher/worksheets/${result.data.worksheet.worksheet_id}`);
    } else if (result.response?.data?.worksheet_id) {
      navigate(`/teacher/worksheets/${result.response.data.worksheet_id}`);
    }
  };

  const limitReached = ai.usedToday >= ai.dailyLimit;

  return (
    <>
      <PageHeader
        back={{ to: '/teacher/worksheets', label: 'Worksheets' }}
        title="New worksheet"
        description="Choose what to practise. The AI writes a printable worksheet with an answer key, and you check it before saving."
      />

      <div className="el-split el-split--form">
        <div className="el-stack el-no-print">
          <section className="el-panel" aria-labelledby="ws-form-heading">
            <div className="el-panel__header">
              <h2 id="ws-form-heading" className="el-panel__title">
                What to practise
              </h2>
              {ai.configured && (
                <span className="el-cell-secondary" title={`${ai.provider} · ${ai.model}`}>
                  {ai.usedToday} of {ai.dailyLimit} today
                </span>
              )}
            </div>
            <Form className="el-panel__body" onSubmit={runGenerate} noValidate>
              {!ai.configured && (
                <Alert variant="warning">AI worksheets aren’t set up on this server yet. Ask your administrator to add a Groq or OpenAI API key.</Alert>
              )}
              {options.data.subjects.length === 0 && (
                <Alert variant="info">Your school has no curriculum assigned yet, so there are no subjects to choose from.</Alert>
              )}
              <FormAlert variant="danger">{generate.error}</FormAlert>
              <Row className="g-3">
                <Col xs={6}>
                  <Form.Group controlId="ws-grade">
                    <Form.Label>Grade</Form.Label>
                    <Form.Select value={form.grade_level} onChange={(e) => set({ grade_level: e.target.value, subject_id: '', topic_id: '' })}>
                      {CLASS_GRADES.map((g) => (
                        <option key={g} value={g}>
                          {gradeLabel(g)}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col xs={6}>
                  <Form.Group controlId="ws-language">
                    <Form.Label>Language</Form.Label>
                    <Form.Select value={form.language} onChange={(e) => set({ language: e.target.value })}>
                      {LANGUAGES.map((l) => (
                        <option key={l}>{l}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col xs={12}>
                  <Form.Group controlId="ws-subject">
                    <Form.Label>Subject</Form.Label>
                    <Form.Select
                      value={form.subject_id}
                      onChange={(e) => set({ subject_id: e.target.value, topic_id: '' })}
                      isInvalid={Boolean(generate.fieldErrors.subject_id)}
                    >
                      <option value="">{subjects.length ? 'Choose a subject' : `No subjects for ${gradeLabel(form.grade_level)}`}</option>
                      {subjects.map((s) => (
                        <option key={s.subject_id} value={s.subject_id}>
                          {s.subject_name}
                        </option>
                      ))}
                    </Form.Select>
                    {fieldError('subject_id')}
                  </Form.Group>
                </Col>
                <Col xs={12}>
                  <Form.Group controlId="ws-topic">
                    <Form.Label>
                      Topic <span className="text-body-secondary fw-normal">(optional)</span>
                    </Form.Label>
                    <Form.Select value={form.topic_id} onChange={(e) => set({ topic_id: e.target.value })} disabled={topics.length === 0}>
                      <option value="">{topics.length ? 'Any topic in the subject' : 'No topics'}</option>
                      {topics.map((t) => (
                        <option key={t.topic_id} value={t.topic_id}>
                          {t.topic_name}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col xs={6}>
                  <Form.Group controlId="ws-difficulty">
                    <Form.Label>Difficulty</Form.Label>
                    <Form.Select value={form.difficulty} onChange={(e) => set({ difficulty: e.target.value })}>
                      {Object.entries(DIFFICULTIES).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col xs={6}>
                  <Form.Group controlId="ws-count">
                    <Form.Label>Questions</Form.Label>
                    <Form.Control
                      type="number"
                      inputMode="numeric"
                      min={3}
                      max={20}
                      value={form.number_of_questions}
                      onChange={(e) => set({ number_of_questions: Number(e.target.value) })}
                      isInvalid={Boolean(generate.fieldErrors.number_of_questions)}
                    />
                    {fieldError('number_of_questions')}
                  </Form.Group>
                </Col>
                <Col xs={12}>
                  <fieldset>
                    <legend className="form-label">Kinds of questions</legend>
                    <div className="d-flex flex-wrap column-gap-3">
                      {Object.entries(QUESTION_TYPE_LABELS).map(([type, label]) => (
                        <Form.Check
                          key={type}
                          type="checkbox"
                          id={`ws-type-${type}`}
                          label={label}
                          checked={form.question_types.includes(type)}
                          onChange={() => toggleType(type)}
                        />
                      ))}
                    </div>
                    {fieldError('question_types')}
                  </fieldset>
                </Col>
                <Col xs={12}>
                  <Form.Group controlId="ws-instructions">
                    <Form.Label>
                      Anything else? <span className="text-body-secondary fw-normal">(optional)</span>
                    </Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      maxLength={500}
                      value={form.specific_instructions}
                      onChange={(e) => set({ specific_instructions: e.target.value })}
                      placeholder="e.g. Use a spaza shop theme, numbers up to 20"
                    />
                    <Form.Text className="text-body-secondary">{500 - form.specific_instructions.length} characters left</Form.Text>
                  </Form.Group>
                </Col>
              </Row>
              <Button
                type="submit"
                className="w-100 mt-3 d-inline-flex align-items-center justify-content-center gap-2"
                disabled={generate.pending || !ai.configured || limitReached || !form.subject_id || form.question_types.length === 0}
              >
                {generate.pending ? <Spinner size="sm" aria-hidden="true" /> : <LuSparkles aria-hidden="true" />}
                {generate.pending ? 'Writing your worksheet…' : 'Create worksheet'}
              </Button>
              {generate.pending && (
                <p className="el-cell-secondary text-center mt-2 mb-0" aria-live="polite">
                  This usually takes 10–30 seconds.
                </p>
              )}
              {limitReached && <p className="el-cell-secondary text-center mt-2 mb-0">You’ve reached today’s limit.</p>}
            </Form>
          </section>

          {recent.data?.requests.length > 0 && (
            <section className="el-panel" aria-labelledby="ws-recent-heading">
              <div className="el-panel__header">
                <h2 id="ws-recent-heading" className="el-panel__title">
                  Recently made
                </h2>
              </div>
              <ul className="el-list">
                {recent.data.requests.slice(0, 5).map((r) => (
                  <li key={r.request_id}>
                    {r.status === 'completed' ? (
                      <Link to={`/teacher/worksheets/new?request=${r.request_id}`} className="el-list-link">
                        <span className="min-w-0">
                          <span className="el-cell-primary d-block text-truncate">{r.title}</span>
                          <span className="el-cell-secondary">
                            {[r.subject_name, gradeLabel(r.grade_level), timeAgo(r.created_at)].join(' · ')}
                            {r.saved && ' · saved'}
                          </span>
                        </span>
                      </Link>
                    ) : (
                      <span className="el-cell-secondary">
                        {r.subject_name} · {r.status === 'failed' ? 'didn’t work' : r.status} · {timeAgo(r.created_at)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <section className="el-panel" aria-labelledby="ws-preview-heading">
          <div className="el-panel__header el-no-print">
            <h2 id="ws-preview-heading" className="el-panel__title">
              {request ? 'Check it' : 'Preview'}
            </h2>
            {request && draft && (
              <div className="d-flex flex-wrap align-items-center gap-2">
                <FilterTabs
                  label="Mode"
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: 'preview', label: 'Preview' },
                    { value: 'edit', label: 'Edit' },
                  ]}
                />
                {mode === 'preview' && (
                  <Form.Check
                    type="switch"
                    id="ws-answers"
                    label="Answers"
                    checked={showAnswers}
                    onChange={(e) => setShowAnswers(e.target.checked)}
                    className="mb-0"
                  />
                )}
              </div>
            )}
          </div>
          <div className="el-panel__body">
            {!request || !draft ? (
              <EmptyState compact icon={mode === 'edit' ? LuPencil : LuEye} title={opened.loading ? 'Opening…' : 'Your worksheet appears here'}>
                You can edit the questions before you save it to the library.
              </EmptyState>
            ) : (
              <>
                <FormAlert variant="danger">{saveProblem}</FormAlert>
                <WorksheetDocument
                  worksheet={draft}
                  meta={request}
                  showAnswers={showAnswers}
                  onChange={mode === 'edit' ? setDraft : undefined}
                />
                <div className="d-flex flex-wrap gap-2 justify-content-end mt-3 el-no-print">
                  <Button variant="light" onClick={runGenerate} disabled={generate.pending} className="d-inline-flex align-items-center gap-2">
                    <LuRefreshCw aria-hidden="true" /> Make another
                  </Button>
                  {request.saved_worksheet_id ? (
                    <Button as={Link} to={`/teacher/worksheets/${request.saved_worksheet_id}`}>
                      Open in library
                    </Button>
                  ) : (
                    <Button onClick={saveToLibrary} disabled={save.pending} className="d-inline-flex align-items-center gap-2">
                      {save.pending ? <Spinner size="sm" aria-hidden="true" /> : <LuSave aria-hidden="true" />} Save to library
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </>
  );
};

export default WorksheetCreate;
