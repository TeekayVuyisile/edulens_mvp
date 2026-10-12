import { useMemo, useState } from 'react';
import { Alert, Button, Form, Spinner, Table } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LuCalendarCheck, LuCircleCheck, LuGraduationCap, LuPlus, LuTriangleAlert } from 'react-icons/lu';
import { useApi, useDocumentTitle } from '../../hooks/useApi';
import { useMutation } from '../../hooks/useMutation';
import { formatDate, gradeLabel, plural } from '../../lib/format';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import EmptyState from '../../components/ui/EmptyState';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import FullPageLoader from '../../components/ui/FullPageLoader';

const NEXT_GRADE = { R: '1', 1: '2', 2: '3', 3: null };

const OUTCOME_LABELS = {
  promote: 'Promote',
  repeat: 'Repeat the grade',
  graduate: 'Finish Foundation Phase',
  leave: 'Left the school',
};

const outcomesFor = (grade) => (NEXT_GRADE[grade] ? ['promote', 'repeat', 'leave'] : ['graduate', 'repeat', 'leave']);

/** The grade a learner from `grade` joins next year for `outcome` (null: no class). */
const targetGrade = (grade, outcome) => (outcome === 'repeat' ? grade : outcome === 'promote' ? NEXT_GRADE[grade] : null);

const SUMMARY_LABELS = { promote: 'promoted', repeat: 'repeating', graduate: 'finished Grade 3', leave: 'left' };

const YearEnd = () => {
  useDocumentTitle('Year end');
  const { data, loading, error, reload } = useApi('/api/school-admin/year-end');
  const [decisions, setDecisions] = useState({}); // learner_id → { outcome, class_id }
  const [syncedData, setSyncedData] = useState(null);
  const [copyTeachers, setCopyTeachers] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const mutate = useMutation();

  // Start from the suggested outcome for each class whenever fresh data arrives.
  if (data && data !== syncedData) {
    setSyncedData(data);
    setDecisions(
      Object.fromEntries(
        data.classes.flatMap((klass) =>
          klass.learners.map((l) => [l.learner_id, { outcome: klass.suggestion.outcome, class_id: klass.suggestion.class_id ?? '' }])
        )
      )
    );
  }

  const nextClasses = useMemo(() => data?.nextClasses ?? [], [data]);

  // Places taken in each of next year's classes by these decisions.
  const adding = useMemo(() => {
    const counts = {};
    for (const d of Object.values(decisions)) if (d.class_id) counts[d.class_id] = (counts[d.class_id] ?? 0) + 1;
    return counts;
  }, [decisions]);

  if (loading && !data) return <FullPageLoader label="Loading year end…" />;
  if (error && !data) {
    return (
      <EmptyState icon={LuCalendarCheck} title="Couldn’t load year end" action={<Button onClick={reload}>Try again</Button>}>
        {error}
      </EmptyState>
    );
  }

  const { fromYear, toYear, rollover, classes } = data;
  const learnerCount = classes.reduce((n, c) => n + c.learners.length, 0);

  // ---- Already closed --------------------------------------------------------
  if (rollover) {
    const s = rollover.summary;
    return (
      <>
        <PageHeader title="Year end" description={`${fromYear} was closed on ${formatDate(rollover.completed_at)} by ${rollover.completed_by_first_name ?? 'an admin'} ${rollover.completed_by_last_name ?? ''}.`} />
        <div className="el-stat-grid">
          <StatCard label="Promoted" value={s.promote} icon={LuCircleCheck} tone="success" />
          <StatCard label="Repeating" value={s.repeat} tone="warning" />
          <StatCard label="Finished Grade 3" value={s.graduate} icon={LuGraduationCap} />
          <StatCard label="Left" value={s.leave} tone="neutral" />
        </div>
        <section className="el-panel">
          <EmptyState icon={LuCalendarCheck} title={`${toYear} is under way`} action={<Button as={Link} to="/school-admin/classes">Go to {toYear} classes</Button>}>
            {s.unplaced > 0
              ? `${plural(s.unplaced, 'learner')} still need a ${toYear} class — find them under Learners, “Not in a class”.`
              : `Every learner who stayed is in a ${toYear} class. Their ${fromYear} marks are kept, read-only.`}
          </EmptyState>
        </section>
      </>
    );
  }

  if (classes.length === 0) {
    return (
      <>
        <PageHeader title="Year end" />
        <section className="el-panel">
          <EmptyState icon={LuCalendarCheck} title={`No ${fromYear} classes to close`} action={<Button as={Link} to="/school-admin/classes">Go to classes</Button>}>
            Year end moves the learners in this year’s classes on to next year.
          </EmptyState>
        </section>
      </>
    );
  }

  // ---- Decisions -------------------------------------------------------------
  const set = (learnerId, changes) => setDecisions((current) => ({ ...current, [learnerId]: { ...current[learnerId], ...changes } }));

  const optionsFor = (grade, outcome) => nextClasses.filter((c) => c.grade_level === targetGrade(grade, outcome));

  // Choosing an outcome also picks a sensible class for it.
  const chooseOutcome = (klass, learnerId, outcome) => {
    const options = optionsFor(klass.grade_level, outcome);
    const sameName = outcome === 'repeat' ? klass.class_name : klass.class_name.replace(klass.grade_level, NEXT_GRADE[klass.grade_level] ?? '');
    const pick = options.find((c) => c.class_name.toLowerCase() === sameName.toLowerCase()) ?? options[0];
    set(learnerId, { outcome, class_id: pick?.class_id ?? '' });
  };

  const applyToClass = (klass, changes) =>
    setDecisions((current) => {
      const next = { ...current };
      for (const l of klass.learners) next[l.learner_id] = { ...next[l.learner_id], ...changes };
      return next;
    });

  const totals = Object.values(decisions).reduce(
    (acc, d) => ({ ...acc, [d.outcome]: (acc[d.outcome] ?? 0) + 1 }),
    { promote: 0, repeat: 0, graduate: 0, leave: 0 }
  );
  const unplaced = Object.values(decisions).filter((d) => ['promote', 'repeat'].includes(d.outcome) && !d.class_id).length;
  const overfull = nextClasses.filter((c) => c.learner_count + (adding[c.class_id] ?? 0) > c.max_capacity);
  const neededGrades = [...new Set(classes.map((c) => NEXT_GRADE[c.grade_level]).filter(Boolean))];
  const missingGrades = neededGrades.filter((g) => !nextClasses.some((c) => c.grade_level === g));

  const createClasses = async () => {
    const result = await mutate.run('post', '/api/school-admin/year-end/next-classes', { from_year: fromYear, copy_teachers: copyTeachers });
    if (result.ok) {
      toast.success(result.message);
      reload();
    } else toast.error(result.message);
  };

  const closeYear = async () => {
    const result = await mutate.run('post', '/api/school-admin/year-end/complete', {
      from_year: fromYear,
      decisions: Object.entries(decisions).map(([learnerId, d]) => ({
        learner_id: learnerId,
        outcome: d.outcome,
        class_id: ['promote', 'repeat'].includes(d.outcome) && d.class_id ? d.class_id : null,
      })),
    });
    if (result.ok) {
      toast.success(result.message);
      reload();
    }
    return result.ok ? result : { ok: false, message: result.response?.data?.problems?.join(' · ') ?? result.message };
  };

  return (
    <>
      <PageHeader
        title={`Close ${fromYear}`}
        description={`Decide what happens to each of your ${plural(learnerCount, 'learner')} and move them into ${toYear}. Nothing changes until you confirm at the bottom.`}
      />

      <section className="el-panel mb-4" aria-labelledby="step-1">
        <div className="el-panel__header">
          <div>
            <h2 id="step-1" className="el-panel__title">
              1. {toYear} classes
            </h2>
            <p className="el-panel__subtitle">
              {nextClasses.length
                ? `${plural(nextClasses.length, 'class', 'classes')} ready for ${toYear}.`
                : `Promoted learners need ${toYear} classes to go into.`}
            </p>
          </div>
        </div>
        <div className="el-panel__body d-grid gap-3">
          {missingGrades.length > 0 && (
            <Alert variant="warning" className="mb-0 d-flex gap-2">
              <LuTriangleAlert aria-hidden="true" className="flex-shrink-0 mt-1" />
              <span>
                There’s no {missingGrades.map(gradeLabel).join(' or ')} class for {toYear} yet, so learners moving up can’t be
                placed. Create the classes below, or learners will start {toYear} without a class.
              </span>
            </Alert>
          )}
          {nextClasses.length > 0 && (
            <div className="d-flex flex-wrap gap-2">
              {nextClasses.map((c) => (
                <span key={c.class_id} className="el-chip">
                  {c.class_name} · {c.learner_count + (adding[c.class_id] ?? 0)}/{c.max_capacity}
                </span>
              ))}
            </div>
          )}
          <div className="d-flex flex-wrap align-items-center gap-3">
            <Button onClick={createClasses} disabled={mutate.pending} className="d-inline-flex align-items-center gap-2">
              {mutate.pending ? <Spinner size="sm" aria-hidden="true" /> : <LuPlus aria-hidden="true" />}
              Copy {fromYear}’s classes into {toYear}
            </Button>
            <Form.Check
              type="checkbox"
              id="copy-teachers"
              label="Keep the same teachers"
              checked={copyTeachers}
              onChange={(e) => setCopyTeachers(e.target.checked)}
              className="mb-0"
            />
          </div>
          <p className="el-cell-secondary mb-0">
            Same names, grades and sizes. Classes that already exist are skipped; you can rename or add classes on the{' '}
            <Link to="/school-admin/classes">Classes</Link> page.
          </p>
        </div>
      </section>

      <h2 className="el-grade-section__title">2. Each learner</h2>
      <p className="text-body-secondary">
        Learners averaging below 40% are flagged to discuss with their teacher; the decision is yours.
      </p>

      {classes.map((klass) => {
        const outcomes = outcomesFor(klass.grade_level);
        return (
          <section key={klass.class_id} className="el-panel mb-3" aria-labelledby={`ye-${klass.class_id}`}>
            <div className="el-panel__header">
              <div>
                <h3 id={`ye-${klass.class_id}`} className="el-panel__title">
                  {klass.class_name}
                </h3>
                <p className="el-panel__subtitle">
                  {gradeLabel(klass.grade_level)} · {plural(klass.learners.length, 'learner')}
                </p>
              </div>
              {klass.learners.length > 0 && (
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <span className="el-cell-secondary">Whole class:</span>
                  <Form.Select
                    size="sm"
                    aria-label={`Outcome for everyone in ${klass.class_name}`}
                    value=""
                    onChange={(e) => {
                      const outcome = e.target.value;
                      const target = optionsFor(klass.grade_level, outcome)[0]?.class_id ?? '';
                      applyToClass(klass, { outcome, class_id: target });
                    }}
                    className="w-auto"
                  >
                    <option value="" disabled>
                      Set everyone to…
                    </option>
                    {outcomes.map((o) => (
                      <option key={o} value={o}>
                        {OUTCOME_LABELS[o]}
                      </option>
                    ))}
                  </Form.Select>
                </div>
              )}
            </div>
            {klass.learners.length === 0 ? (
              <p className="el-panel__body text-body-secondary mb-0">No learners in this class.</p>
            ) : (
              <div className="el-table-wrap">
                <Table className="el-table el-year-end-table">
                  <thead>
                    <tr>
                      <th scope="col">Learner</th>
                      <th scope="col">Outcome</th>
                      <th scope="col">{toYear} class</th>
                    </tr>
                  </thead>
                  <tbody>
                    {klass.learners.map((l) => {
                      const d = decisions[l.learner_id] ?? { outcome: klass.suggestion.outcome, class_id: '' };
                      const options = optionsFor(klass.grade_level, d.outcome);
                      const name = `${l.first_name} ${l.last_name}`;
                      return (
                        <tr key={l.learner_id}>
                          <td>
                            <div className="el-cell-primary">
                              {l.last_name}, {l.first_name}
                            </div>
                            <div className="el-cell-secondary">
                              {l.average === null ? 'No marks' : `Average ${l.average}%`}
                              {l.needs_review && (
                                <span className="el-level el-level--2 ms-2">Discuss repeating</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <Form.Select
                              size="sm"
                              aria-label={`Outcome for ${name}`}
                              value={d.outcome}
                              onChange={(e) => chooseOutcome(klass, l.learner_id, e.target.value)}
                            >
                              {outcomes.map((o) => (
                                <option key={o} value={o}>
                                  {OUTCOME_LABELS[o]}
                                </option>
                              ))}
                            </Form.Select>
                          </td>
                          <td>
                            {targetGrade(klass.grade_level, d.outcome) && options.length === 0 ? (
                              <span className="el-cell-secondary">
                                No {gradeLabel(targetGrade(klass.grade_level, d.outcome))} class yet
                              </span>
                            ) : targetGrade(klass.grade_level, d.outcome) ? (
                              <Form.Select
                                size="sm"
                                aria-label={`${toYear} class for ${name}`}
                                value={d.class_id}
                                onChange={(e) => set(l.learner_id, { class_id: e.target.value })}
                                isInvalid={!d.class_id}
                              >
                                <option value="">No class yet</option>
                                {options.map((c) => (
                                  <option key={c.class_id} value={c.class_id}>
                                    {c.class_name}
                                  </option>
                                ))}
                              </Form.Select>
                            ) : (
                              <span className="el-cell-secondary">Leaves the register</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            )}
          </section>
        );
      })}

      <div className="el-save-bar" role="region" aria-label="Year-end summary">
        <span className="el-save-bar__text">
          {Object.entries(totals)
            .filter(([, n]) => n > 0)
            .map(([outcome, n]) => `${n} ${SUMMARY_LABELS[outcome]}`)
            .join(' · ')}
          {unplaced > 0 && <span className="text-warning-emphasis"> · {unplaced} without a {toYear} class</span>}
          {overfull.length > 0 && <span className="text-danger"> · {overfull.map((c) => c.class_name).join(', ')} over capacity</span>}
        </span>
        <Button onClick={() => setConfirming(true)} disabled={overfull.length > 0} className="d-inline-flex align-items-center gap-2">
          <LuCalendarCheck aria-hidden="true" /> Close {fromYear}
        </Button>
      </div>

      <ConfirmDialog
        show={confirming}
        title={`Close ${fromYear} and start ${toYear}?`}
        confirmLabel={`Close ${fromYear}`}
        variant="primary"
        onConfirm={closeYear}
        onClose={() => setConfirming(false)}
      >
        <p>
          {Object.entries(totals)
            .filter(([, n]) => n > 0)
            .map(([outcome, n]) => `${plural(n, 'learner')} ${SUMMARY_LABELS[outcome]}`)
            .join(', ')}
          .
        </p>
        <p className="mb-0">
          All {fromYear} classes close and become read-only for teachers. Marks and class history are kept. This can’t be
          undone from the app.
          {unplaced > 0 && ` ${plural(unplaced, 'learner')} will start ${toYear} without a class.`}
        </p>
      </ConfirmDialog>
    </>
  );
};

export default YearEnd;
