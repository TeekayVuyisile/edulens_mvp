import { Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import {
  LuActivity,
  LuCalendarDays,
  LuChartColumn,
  LuChevronRight,
  LuCircleCheck,
  LuClipboardCheck,
  LuSchool,
  LuUsers,
} from 'react-icons/lu';
import { useAuth } from '../../contexts/useAuth';
import { useApi, useDocumentTitle } from '../../hooks/useApi';
import { capsLevel, currentTerm, formatDate, gradeLabel, greeting, plural } from '../../lib/format';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import EmptyState from '../../components/ui/EmptyState';
import ProgressMeter from '../../components/ui/ProgressMeter';

const TeacherDashboard = () => {
  useDocumentTitle('Dashboard');
  const { user } = useAuth();
  const { data, error, reload } = useApi('/api/teacher/dashboard');
  const loading = !data;
  const summary = data?.summary;

  if (error && !data) {
    return (
      <EmptyState icon={LuActivity} title="Couldn’t load the dashboard" action={<Button onClick={reload}>Try again</Button>}>
        {error}
      </EmptyState>
    );
  }

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user.first_name}`}
        description={`Term ${currentTerm()}${user.school_name ? ` at ${user.school_name}` : ''}. Here’s what needs you today.`}
        actions={
          <Button as={Link} to="/teacher/assessments?status=to_mark">
            Mark assessments
          </Button>
        }
      />

      <div className="el-stat-grid">
        <StatCard label="My classes" value={summary?.classes} icon={LuSchool} tone="neutral" loading={loading} />
        <StatCard label="Learners" value={summary?.learners} icon={LuUsers} tone="success" loading={loading} />
        <StatCard
          label="To mark"
          value={summary?.to_mark}
          hint="Assessments with learners still unmarked"
          icon={LuClipboardCheck}
          tone="warning"
          loading={loading}
        />
        <StatCard
          label="Average mark"
          value={summary && (summary.average === null ? '—' : `${summary.average}%`)}
          hint={summary?.average != null && `CAPS level ${capsLevel(summary.average)}`}
          icon={LuChartColumn}
          loading={loading}
        />
      </div>

      <div className="el-split">
        <div className="el-stack">
          <section className="el-panel" aria-labelledby="to-mark-heading">
            <div className="el-panel__header">
              <div>
                <h2 id="to-mark-heading" className="el-panel__title">
                  Still to mark
                </h2>
                <p className="el-panel__subtitle">Pick up where you left off.</p>
              </div>
              <Button as={Link} to="/teacher/assessments?status=to_mark" size="sm" variant="light">
                See all
              </Button>
            </div>
            {!loading && data.toMark.length === 0 ? (
              <EmptyState compact icon={LuCircleCheck} title="All marked">
                Every learner has a mark for every assessment. Nice work.
              </EmptyState>
            ) : (
              <ul className="el-list">
                {(data?.toMark ?? []).map((a) => (
                  <li key={a.assessment_id}>
                    <Link to={`/teacher/assessments/${a.assessment_id}`} className="el-list-link">
                      <span className="min-w-0">
                        <span className="el-cell-primary d-block">{a.assessment_name}</span>
                        <span className="el-cell-secondary">
                          {[a.class_name, a.subject_name, a.scheduled_date && formatDate(a.scheduled_date)].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <span className="d-flex align-items-center gap-3">
                        <span className="el-cell-progress d-none d-sm-block">
                          <ProgressMeter value={a.marked_count} max={a.learner_count} label="marked" compact />
                        </span>
                        <LuChevronRight aria-hidden="true" className="flex-shrink-0" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="el-panel" aria-labelledby="classes-heading">
            <div className="el-panel__header">
              <h2 id="classes-heading" className="el-panel__title">
                My classes
              </h2>
            </div>
            {!loading && data.classes.length === 0 ? (
              <EmptyState compact icon={LuUsers} title="No classes yet">
                Your school admin assigns you to classes. They’ll appear here.
              </EmptyState>
            ) : (
              <ul className="el-list">
                {(data?.classes ?? []).map((c) => (
                  <li key={c.class_id}>
                    <Link to={`/teacher/classes/${c.class_id}`} className="el-list-link">
                      <span className="min-w-0">
                        <span className="el-cell-primary d-block">{c.class_name}</span>
                        <span className="el-cell-secondary">
                          {gradeLabel(c.grade_level)} · {plural(c.learner_count, 'learner')}
                          {c.is_primary ? ' · Class teacher' : ''}
                        </span>
                      </span>
                      <span className="d-flex align-items-center gap-3">
                        <span className="tabular-nums fw-semibold">{c.average === null ? '—' : `${c.average}%`}</span>
                        <LuChevronRight aria-hidden="true" className="flex-shrink-0" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="el-panel" aria-labelledby="upcoming-heading">
          <div className="el-panel__header">
            <div>
              <h2 id="upcoming-heading" className="el-panel__title">
                Coming up
              </h2>
              <p className="el-panel__subtitle">Assessments scheduled from today.</p>
            </div>
          </div>
          {!loading && data.upcoming.length === 0 ? (
            <EmptyState compact icon={LuCalendarDays} title="Nothing scheduled">
              Give an assessment a date and it shows up here.
            </EmptyState>
          ) : (
            <ul className="el-list">
              {(data?.upcoming ?? []).map((a) => (
                <li key={a.assessment_id}>
                  <Link to={`/teacher/assessments/${a.assessment_id}`} className="el-list-link">
                    <span className="min-w-0">
                      <span className="el-cell-primary d-block">{a.assessment_name}</span>
                      <span className="el-cell-secondary">{[a.class_name, a.subject_name].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className="el-chip">{formatDate(a.scheduled_date)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
};

export default TeacherDashboard;
