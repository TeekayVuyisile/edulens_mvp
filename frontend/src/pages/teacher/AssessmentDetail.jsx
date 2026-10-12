import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Form, Spinner, Table } from 'react-bootstrap';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { LuClipboardList, LuPencil, LuTrash2 } from 'react-icons/lu';
import { useApi, useDocumentTitle } from '../../hooks/useApi';
import { useMutation } from '../../hooks/useMutation';
import { ASSESSMENT_TYPES, CAPS_LEVELS, capsLevel, formatDate, formatMarks, plural } from '../../lib/format';
import { DURATION, EASE_OUT } from '../../lib/motion';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import EmptyState from '../../components/ui/EmptyState';
import RowActions from '../../components/ui/RowActions';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import FullPageLoader from '../../components/ui/FullPageLoader';
import AssessmentFormModal from './components/AssessmentFormModal';
import ResourcesPanel from './components/ResourcesPanel';

/** Draft value for a saved mark: marks as typed text, feedback as text. */
const toDraft = (row) => ({ marks: formatMarks(row.marks_obtained), feedback: row.teacher_feedback ?? '' });

/** Error text for a typed mark, or null when it's fine (blank means "no mark"). */
const markError = (text, total) => {
  if (text.trim() === '') return null;
  const value = Number(text.replace(',', '.'));
  if (!Number.isFinite(value)) return 'Enter a number';
  if (value < 0) return 'Can’t be negative';
  if (value > total) return `Out of ${total}`;
  return null;
};

const MarkCell = ({ percentage }) =>
  percentage === null ? (
    <span className="el-cell-secondary">—</span>
  ) : (
    <span className="text-nowrap" title={CAPS_LEVELS[capsLevel(percentage)]}>
      <span className="tabular-nums fw-semibold">{Math.round(percentage * 10) / 10}%</span>{' '}
      <span className={`el-level el-level--${capsLevel(percentage)}`}>L{capsLevel(percentage)}</span>
    </span>
  );

const AssessmentDetail = () => {
  const { assessmentId } = useParams();
  const navigate = useNavigate();
  const details = useApi(`/api/teacher/assessments/${assessmentId}`);
  const sheet = useApi(`/api/teacher/assessments/${assessmentId}/marks`);
  const classesQuery = useApi('/api/teacher/classes');
  const assessment = sheet.data?.assessment ?? details.data?.assessment;
  useDocumentTitle(assessment?.assessment_name ?? 'Assessment');

  const [drafts, setDrafts] = useState({}); // learner_id → { marks, feedback }, only for rows being edited
  const [dialog, setDialog] = useState(null); // 'edit' | 'delete'
  const save = useMutation();
  const inputs = useRef([]);

  // When fresh marks arrive from the server (first load, or after saving), edits start over.
  const rows = useMemo(() => sheet.data?.marks ?? [], [sheet.data]);
  const [syncedRows, setSyncedRows] = useState(rows);
  if (rows !== syncedRows) {
    setSyncedRows(rows);
    setDrafts({});
  }
  const draftFor = (row) => drafts[row.learner_id] ?? toDraft(row);

  const total = Number(assessment?.total_marks ?? 0);
  const changed = rows.filter((row) => {
    const draft = drafts[row.learner_id];
    if (!draft) return false;
    const saved = toDraft(row);
    return draft.marks.trim() !== saved.marks || draft.feedback.trim() !== saved.feedback.trim();
  });
  // Only marks being changed must be valid (an old out-of-range mark is shown, not blocking).
  const invalid = changed.filter((row) => markError(draftFor(row).marks, total));
  const dirty = changed.length > 0;

  // Don't lose typed marks: the browser asks before the tab is closed or reloaded.
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  if ((details.loading && !details.data) || (sheet.loading && !sheet.data)) return <FullPageLoader label="Loading assessment…" />;
  if ((details.error && !details.data) || (sheet.error && !sheet.data)) {
    return (
      <EmptyState
        icon={LuClipboardList}
        title="Couldn’t load this assessment"
        action={
          <Button
            onClick={() => {
              details.reload();
              sheet.reload();
            }}
          >
            Try again
          </Button>
        }
      >
        {details.error ?? sheet.error}
      </EmptyState>
    );
  }

  const editable = assessment.class_is_active;
  const setDraft = (row, changes) =>
    setDrafts((current) => ({ ...current, [row.learner_id]: { ...(current[row.learner_id] ?? toDraft(row)), ...changes } }));

  const livePercentage = (row) => {
    const text = draftFor(row).marks;
    if (text.trim() === '' || markError(text, total)) return null;
    return (Number(text.replace(',', '.')) / total) * 100;
  };

  const marked = rows.filter((r) => r.percentage !== null);
  const percentages = marked.map((r) => r.percentage);
  const best = percentages.length ? Math.max(...percentages) : null;
  const worst = percentages.length ? Math.min(...percentages) : null;

  const saveMarks = async () => {
    if (invalid.length > 0) {
      inputs.current[rows.indexOf(invalid[0])]?.focus();
      return;
    }
    const result = await save.run('put', `/api/teacher/assessments/${assessmentId}/marks`, {
      marks: changed.map((row) => {
        const draft = drafts[row.learner_id];
        return {
          learner_id: row.learner_id,
          marks_obtained: draft.marks.trim() === '' ? null : Number(draft.marks.replace(',', '.')),
          teacher_feedback: draft.feedback.trim() || null,
        };
      }),
    });
    if (result.ok) {
      toast.success(result.message);
      sheet.reload();
      details.reload();
    } else {
      toast.error(result.message);
    }
  };

  const discard = () => setDrafts({});

  const nextOnEnter = (index) => (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const next = inputs.current[index + 1];
    if (next) next.focus();
    else saveMarks();
  };

  const deleteAssessment = async () => {
    const result = await save.run('delete', `/api/teacher/assessments/${assessmentId}`);
    if (result.ok) {
      toast.success(result.message);
      navigate('/teacher/assessments', { replace: true });
    }
    return result;
  };

  return (
    <>
      <PageHeader
        back={{ to: '/teacher/assessments', label: 'All assessments' }}
        eyebrow={[assessment.class_name, assessment.subject_name, ASSESSMENT_TYPES[assessment.assessment_type], `Term ${assessment.term_number}`]
          .filter(Boolean)
          .join(' · ')}
        title={assessment.assessment_name}
        description={[
          `Out of ${formatMarks(assessment.total_marks)}`,
          assessment.scheduled_date && formatDate(assessment.scheduled_date),
          assessment.topic_name,
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={
          editable && (
            <>
              <Button variant="light" onClick={() => setDialog('edit')} className="d-inline-flex align-items-center gap-2">
                <LuPencil aria-hidden="true" /> Edit
              </Button>
              <RowActions
                label={`More actions for ${assessment.assessment_name}`}
                items={[{ label: 'Delete assessment', icon: LuTrash2, danger: true, onClick: () => setDialog('delete') }]}
              />
            </>
          )
        }
      />

      {!editable && (
        <Alert variant="info">
          {assessment.class_name} is no longer active, so these marks are read-only.
        </Alert>
      )}

      <div className="el-stat-grid">
        <StatCard label="Marked" value={`${assessment.marked_count} / ${assessment.learner_count}`} hint="Learners in the class" tone="neutral" />
        <StatCard
          label="Class average"
          value={assessment.average === null ? '—' : `${assessment.average}%`}
          hint={assessment.average !== null && `CAPS level ${capsLevel(assessment.average)}`}
        />
        <StatCard label="Highest" value={best === null ? '—' : `${Math.round(best * 10) / 10}%`} tone="success" />
        <StatCard label="Lowest" value={worst === null ? '—' : `${Math.round(worst * 10) / 10}%`} tone="warning" />
      </div>

      <div className="el-split">
        <section className="el-panel" aria-labelledby="marks-heading">
          <div className="el-panel__header">
            <div>
              <h2 id="marks-heading" className="el-panel__title">
                Marks
              </h2>
              <p className="el-panel__subtitle">
                {editable
                  ? `Type each learner’s mark out of ${formatMarks(total)}. Press Enter for the next learner; leave blank if not done yet.`
                  : 'Marks recorded for this assessment.'}
              </p>
            </div>
          </div>
          {assessment.description && <p className="el-panel__note">{assessment.description}</p>}

          {rows.length === 0 ? (
            <EmptyState compact icon={LuClipboardList} title="No learners in this class yet">
              Learners appear here once they’re added to {assessment.class_name}.{' '}
              <Link to={`/teacher/classes/${assessment.class_id}`}>Go to the class</Link>
            </EmptyState>
          ) : (
            <div className="el-table-wrap">
              <Table className="el-table el-marks-table">
                <thead>
                  <tr>
                    <th scope="col">Learner</th>
                    <th scope="col" className="el-marks-table__input-col">
                      Mark <span className="fw-normal">/ {formatMarks(total)}</span>
                    </th>
                    <th scope="col">Result</th>
                    <th scope="col" className="d-none d-lg-table-cell">Comment</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const draft = draftFor(row);
                    const problem = markError(draft.marks, total);
                    const isChanged = changed.includes(row);
                    const comment = (
                      <Form.Control
                        size="sm"
                        value={draft.feedback}
                        onChange={(e) => setDraft(row, { feedback: e.target.value })}
                        placeholder="Optional comment"
                        aria-label={`Comment for ${row.first_name} ${row.last_name}`}
                        disabled={!editable}
                        maxLength={1000}
                      />
                    );
                    return (
                      <tr key={row.learner_id} className={isChanged ? 'is-changed' : undefined}>
                        <td>
                          <div className="el-cell-primary">
                            {row.last_name}, {row.first_name}
                            {row.has_special_needs && (
                              <span className="el-support-dot" title="Needs learning support">
                                <span className="visually-hidden"> (needs learning support)</span>
                              </span>
                            )}
                          </div>
                          {!row.in_class && <div className="el-cell-secondary">No longer in this class</div>}
                          <div className="d-lg-none mt-2">{comment}</div>
                        </td>
                        <td className="el-marks-table__input-col">
                          <Form.Control
                            ref={(el) => {
                              inputs.current[index] = el;
                            }}
                            value={draft.marks}
                            onChange={(e) => setDraft(row, { marks: e.target.value })}
                            onKeyDown={nextOnEnter(index)}
                            onFocus={(e) => e.target.select()}
                            inputMode="decimal"
                            enterKeyHint={index === rows.length - 1 ? 'done' : 'next'}
                            isInvalid={Boolean(problem)}
                            aria-invalid={Boolean(problem)}
                            aria-label={`Mark for ${row.first_name} ${row.last_name}, out of ${formatMarks(total)}`}
                            aria-describedby={problem ? `mark-error-${row.learner_id}` : undefined}
                            disabled={!editable}
                            className="tabular-nums el-mark-input"
                          />
                          {problem && (
                            <Form.Control.Feedback type="invalid" id={`mark-error-${row.learner_id}`}>
                              {problem}
                            </Form.Control.Feedback>
                          )}
                        </td>
                        <td>
                          <MarkCell percentage={livePercentage(row)} />
                        </td>
                        <td className="d-none d-lg-table-cell">{comment}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          )}
        </section>

        <ResourcesPanel assessment={assessment} resources={details.data?.resources ?? []} editable={editable} onChange={details.reload} />
      </div>

      <AnimatePresence>
        {dirty && editable && (
          <motion.div
            className="el-save-bar"
            role="region"
            aria-label="Unsaved marks"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE_OUT } }}
            exit={{ opacity: 0, y: 16, transition: { duration: DURATION.fast } }}
          >
            <span className="el-save-bar__text" aria-live="polite">
              {plural(changed.length, 'unsaved change')}
              {invalid.length > 0 && ` · ${plural(invalid.length, 'mark')} to fix`}
            </span>
            <span className="d-flex gap-2">
              <Button variant="light" onClick={discard} disabled={save.pending}>
                Discard
              </Button>
              <Button onClick={saveMarks} disabled={save.pending}>
                {save.pending && <Spinner size="sm" className="me-2" aria-hidden="true" />}
                Save marks
              </Button>
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {dialog === 'edit' && (
        <AssessmentFormModal
          assessment={assessment}
          classes={classesQuery.data?.classes ?? []}
          onClose={() => setDialog(null)}
          onSaved={(_, message) => {
            setDialog(null);
            toast.success(message);
            details.reload();
            sheet.reload();
          }}
        />
      )}

      <ConfirmDialog
        show={dialog === 'delete'}
        title={`Delete ${assessment.assessment_name}?`}
        confirmLabel="Delete assessment"
        onConfirm={deleteAssessment}
        onClose={() => setDialog(null)}
      >
        {assessment.marked_count > 0
          ? `The ${assessment.marked_count} marks already entered and any attached resources will be deleted too. This can’t be undone.`
          : 'Any attached resources will be deleted too. This can’t be undone.'}
      </ConfirmDialog>

    </>
  );
};

export default AssessmentDetail;
