import { useState } from 'react';
import { Button } from 'react-bootstrap';
import { useParams } from 'react-router-dom';
import { LuChartColumn, LuHeart, LuMail, LuMessageSquareQuote, LuPhone } from 'react-icons/lu';
import { useApi, useDocumentTitle } from '../../hooks/useApi';
import { CAPS_LEVELS, formatDate, fullName, gradeLabel, TERMS } from '../../lib/format';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import FilterTabs from '../../components/ui/FilterTabs';
import FullPageLoader from '../../components/ui/FullPageLoader';
import { LevelPill } from '../../components/learners/LearnerPanels';

/** What a parent sees for one child: averages per subject, every mark with the teacher's comment, and how to reach the school. */
const ChildProgress = () => {
  const { learnerId } = useParams();
  const { data, loading, error, reload } = useApi(`/api/parent/children/${learnerId}`);
  useDocumentTitle(data ? fullName(data.child) : 'My child');
  const [term, setTerm] = useState('all');

  if (loading && !data) return <FullPageLoader label="Loading…" />;
  if (error && !data) {
    return (
      <EmptyState icon={LuHeart} title="Couldn’t load this page" action={<Button onClick={reload}>Try again</Button>}>
        {error}
      </EmptyState>
    );
  }

  const { child, subjects, marks } = data;
  const terms = TERMS.filter((t) => marks.some((m) => m.term_number === t));
  const shown = term === 'all' ? marks : marks.filter((m) => m.term_number === term);

  return (
    <>
      <PageHeader
        back={{ to: '/dashboard', label: 'My children' }}
        eyebrow={child.school_name}
        title={fullName(child)}
        description={
          child.class_name
            ? `${child.class_name} · ${gradeLabel(child.grade_level)} · ${child.academic_year}${child.teacher_first_name ? ` · Class teacher: ${child.teacher_first_name} ${child.teacher_last_name}` : ''}`
            : 'Not in a class yet'
        }
      />

      <div className="el-split">
        <div className="el-stack">
          <section className="el-panel" aria-labelledby="subjects-heading">
            <div className="el-panel__header">
              <div>
                <h2 id="subjects-heading" className="el-panel__title">
                  How {child.first_name} is doing
                </h2>
                <p className="el-panel__subtitle">Average mark in each subject this year and before.</p>
              </div>
            </div>
            {subjects.length === 0 ? (
              <EmptyState compact icon={LuChartColumn} title="No marks yet">
                Marks appear here once {child.first_name}’s teacher records a test or task.
              </EmptyState>
            ) : (
              <ul className="el-list">
                {subjects.map((s) => (
                  <li key={s.subject_name}>
                    <div>
                      <div className="el-cell-primary">{s.subject_name}</div>
                      <div className="el-cell-secondary">
                        {s.assessments} mark{s.assessments === 1 ? '' : 's'}
                      </div>
                    </div>
                    <span className="d-flex align-items-center gap-3">
                      <LevelPill percentage={s.average} />
                      <span className="el-cell-primary tabular-nums el-percent">{s.average}%</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="el-panel" aria-labelledby="marks-heading">
            <div className="el-panel__header">
              <div>
                <h2 id="marks-heading" className="el-panel__title">
                  Marks and comments
                </h2>
                <p className="el-panel__subtitle">Newest first, with what the teacher said.</p>
              </div>
            </div>
            {terms.length > 1 && (
              <div className="el-toolbar">
                <FilterTabs
                  label="Term"
                  value={term}
                  onChange={setTerm}
                  options={[{ value: 'all', label: 'All' }, ...terms.map((t) => ({ value: t, label: `Term ${t}` }))]}
                />
              </div>
            )}
            {shown.length === 0 ? (
              <EmptyState compact icon={LuChartColumn} title="Nothing marked yet" />
            ) : (
              <ul className="el-list">
                {shown.map((m) => (
                  <li key={m.assessment_id} className="align-items-start">
                    <div className="min-w-0">
                      <div className="el-cell-primary">{m.assessment_name}</div>
                      <div className="el-cell-secondary">
                        {[m.subject_name, `Term ${m.term_number}`, m.scheduled_date && formatDate(m.scheduled_date)]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                      {m.teacher_feedback && (
                        <p className="el-parent-comment">
                          <LuMessageSquareQuote aria-hidden="true" /> {m.teacher_feedback}
                        </p>
                      )}
                    </div>
                    <span className="d-flex align-items-center gap-2 flex-shrink-0">
                      <span className="fw-semibold tabular-nums">{Math.round(m.percentage)}%</span>
                      <LevelPill percentage={m.percentage} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="el-stack">
          <section className="el-panel" aria-labelledby="levels-heading">
            <div className="el-panel__header">
              <h2 id="levels-heading" className="el-panel__title">
                What the levels mean
              </h2>
            </div>
            <div className="el-panel__body">
              <p className="el-cell-secondary">
                South African schools report Foundation Phase results on a 7-level scale (CAPS). Level 4 and above means
                your child has achieved what the grade expects.
              </p>
              <ul className="el-levels-legend">
                {[7, 6, 5, 4, 3, 2, 1].map((level) => (
                  <li key={level}>
                    <span className={`el-level el-level--${level}`}>Level {level}</span> {CAPS_LEVELS[level]}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="el-panel" aria-labelledby="contact-heading">
            <div className="el-panel__header">
              <h2 id="contact-heading" className="el-panel__title">
                Contact the school
              </h2>
            </div>
            <div className="el-panel__body d-grid gap-2">
              <p className="el-cell-secondary mb-1">Questions about {child.first_name}’s progress? Contact {child.school_name}.</p>
              {child.school_phone && (
                <Button as="a" href={`tel:${child.school_phone}`} variant="light" size="sm" className="d-inline-flex align-items-center gap-2">
                  <LuPhone aria-hidden="true" /> {child.school_phone}
                </Button>
              )}
              {child.school_email && (
                <Button as="a" href={`mailto:${child.school_email}`} variant="light" size="sm" className="d-inline-flex align-items-center gap-2 text-truncate">
                  <LuMail aria-hidden="true" /> {child.school_email}
                </Button>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
};

export default ChildProgress;
