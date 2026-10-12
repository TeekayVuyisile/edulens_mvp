import { useState } from 'react';
import { Button, Form, Table } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { LuChartColumn, LuCircleCheck, LuClipboardList, LuTrendingUp, LuUsers, LuLifeBuoy } from 'react-icons/lu';
import { useApi, useDocumentTitle } from '../../hooks/useApi';
import { CAPS_LEVELS, CLASS_GRADES, capsLevel, gradeLabel } from '../../lib/format';
import './school-admin.css';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import EmptyState from '../../components/ui/EmptyState';
import FullPageLoader from '../../components/ui/FullPageLoader';
import { BarsChart } from '../../components/charts/Charts';

const percent = (value) => (value === null || value === undefined ? '—' : `${value}%`);

const Reports = () => {
  useDocumentTitle('Reports');
  const [filters, setFilters] = useState({ year: '', grade: '', term: '' });
  const { data, loading, error, reload } = useApi('/api/school-admin/reports/performance', {
    year: filters.year || undefined,
    grade: filters.grade || undefined,
    term: filters.term || undefined,
  });
  const set = (name) => (e) => setFilters((current) => ({ ...current, [name]: e.target.value }));

  if (loading && !data) return <FullPageLoader label="Loading reports…" />;
  if (error && !data) {
    return (
      <EmptyState icon={LuChartColumn} title="Couldn’t load reports" action={<Button onClick={reload}>Try again</Button>}>
        {error}
      </EmptyState>
    );
  }

  const { summary, levels, classes, subjects, needsSupport } = data;
  const hasMarks = summary.marks > 0;
  // Every level 7 → 1 in order, so the shape of the distribution is honest.
  const levelData = [7, 6, 5, 4, 3, 2, 1].map((level) => ({
    level: `L${level}`,
    marks: levels.find((l) => l.level === level)?.marks ?? 0,
  }));
  const atLeastAdequate = levels.filter((l) => l.level >= 4).reduce((n, l) => n + l.marks, 0);

  return (
    <>
      <PageHeader
        title="Reports"
        description="How learners are doing, from the marks teachers record. Levels follow the CAPS 7-point scale."
      />

      <section className="el-panel mb-4" aria-label="Report filters">
        <div className="el-toolbar border-0">
          <Form.Select aria-label="Year" value={filters.year || data.year} onChange={set('year')}>
            {data.years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Form.Select>
          <Form.Select aria-label="Grade" value={filters.grade} onChange={set('grade')}>
            <option value="">All grades</option>
            {CLASS_GRADES.map((g) => (
              <option key={g} value={g}>
                {gradeLabel(g)}
              </option>
            ))}
          </Form.Select>
          <Form.Select aria-label="Term" value={filters.term} onChange={set('term')}>
            <option value="">Whole year</option>
            {['1', '2', '3', '4'].map((t) => (
              <option key={t} value={t}>
                Term {t}
              </option>
            ))}
          </Form.Select>
        </div>
      </section>

      <div className="el-stat-grid">
        <StatCard label="Average mark" value={percent(summary.average)} hint={hasMarks && `CAPS level ${capsLevel(summary.average)}`} icon={LuTrendingUp} />
        <StatCard
          label="At level 4 or above"
          value={hasMarks ? `${Math.round((atLeastAdequate / summary.marks) * 100)}%` : '—'}
          hint="Of all marks (50% and up)"
          icon={LuCircleCheck}
          tone="success"
        />
        <StatCard label="Learners assessed" value={summary.learners_assessed} icon={LuUsers} tone="neutral" />
        <StatCard
          label="Need support"
          value={needsSupport.length}
          hint="Average below 50%"
          icon={LuLifeBuoy}
          tone="warning"
        />
      </div>

      {!hasMarks ? (
        <section className="el-panel">
          <EmptyState icon={LuClipboardList} title="No marks for this selection yet">
            Reports fill in as teachers record assessments. Try another year, grade or term.
          </EmptyState>
        </section>
      ) : (
        <div className="el-split">
          <div className="el-stack">
            <section className="el-panel" aria-labelledby="classes-heading">
              <div className="el-panel__header">
                <div>
                  <h2 id="classes-heading" className="el-panel__title">
                    Classes
                  </h2>
                  <p className="el-panel__subtitle">Average mark per class and how many marks were below 50%.</p>
                </div>
              </div>
              <div className="el-table-wrap">
                <Table className="el-table">
                  <thead>
                    <tr>
                      <th scope="col">Class</th>
                      <th scope="col" className="d-none d-md-table-cell">Class teacher</th>
                      <th scope="col" className="text-end d-none d-sm-table-cell">Assessments</th>
                      <th scope="col" className="text-end">Average</th>
                      <th scope="col" className="text-end d-none d-sm-table-cell">Below 50%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classes.map((c) => (
                      <tr key={c.class_id}>
                        <td>
                          <Link to={`/school-admin/classes/${c.class_id}`} className="el-cell-primary">
                            {c.class_name}
                          </Link>
                          <div className="el-cell-secondary">{gradeLabel(c.grade_level)}</div>
                        </td>
                        <td className="d-none d-md-table-cell">
                          {c.teacher_first_name ? `${c.teacher_first_name} ${c.teacher_last_name}` : '—'}
                        </td>
                        <td className="text-end tabular-nums d-none d-sm-table-cell">{c.assessments}</td>
                        <td className="text-end tabular-nums" title={CAPS_LEVELS[capsLevel(c.average)]}>
                          <span className="fw-semibold">{percent(c.average)}</span>
                          <span className="el-cell-secondary"> · L{capsLevel(c.average)}</span>
                        </td>
                        <td className="text-end tabular-nums d-none d-sm-table-cell">{c.marks_below_50}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </section>

            <section className="el-panel" aria-labelledby="levels-heading">
              <div className="el-panel__header">
                <div>
                  <h2 id="levels-heading" className="el-panel__title">
                    Achievement levels
                  </h2>
                  <p className="el-panel__subtitle">
                    Marks per CAPS level, from Outstanding (L7, 80%+) to Not achieved (L1, below 30%).
                  </p>
                </div>
              </div>
              <div className="el-panel__body">
                <BarsChart data={levelData} xKey="level" yKey="marks" label="Marks per achievement level" unit="marks" />
              </div>
            </section>

            <section className="el-panel" aria-labelledby="subjects-heading">
              <div className="el-panel__header">
                <h2 id="subjects-heading" className="el-panel__title">
                  Subjects
                </h2>
              </div>
              <ul className="el-list">
                {subjects.map((s) => (
                  <li key={s.subject_name}>
                    <div>
                      <div className="el-cell-primary">{s.subject_name}</div>
                      <div className="el-cell-secondary">
                        {s.assessments} assessment{s.assessments === 1 ? '' : 's'}
                      </div>
                    </div>
                    <span className="d-flex align-items-center gap-3">
                      <span className={`el-level el-level--${capsLevel(s.average)}`} title={CAPS_LEVELS[capsLevel(s.average)]}>
                        Level {capsLevel(s.average)}
                      </span>
                      <span className="el-cell-primary tabular-nums el-percent">{percent(s.average)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className="el-panel" aria-labelledby="support-heading">
            <div className="el-panel__header">
              <div>
                <h2 id="support-heading" className="el-panel__title">
                  Learners who need support
                </h2>
                <p className="el-panel__subtitle">Average below 50%, lowest first.</p>
              </div>
            </div>
            {needsSupport.length === 0 ? (
              <EmptyState compact icon={LuCircleCheck} title="Nobody is below 50%" />
            ) : (
              <ul className="el-list">
                {needsSupport.map((l) => (
                  <li key={l.learner_id}>
                    <Link to={`/school-admin/learners/${l.learner_id}`} className="el-list-link">
                      <span className="min-w-0">
                        <span className="el-cell-primary d-block">
                          {l.first_name} {l.last_name}
                        </span>
                        <span className="el-cell-secondary">
                          {l.class_name ?? 'Not in a class'} · {l.marks} mark{l.marks === 1 ? '' : 's'}
                        </span>
                      </span>
                      <span className="el-cell-primary tabular-nums">{percent(l.average)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  );
};

export default Reports;
