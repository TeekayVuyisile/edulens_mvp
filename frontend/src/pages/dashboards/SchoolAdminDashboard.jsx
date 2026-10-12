import { Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import {
  LuActivity,
  LuChartColumn,
  LuChevronRight,
  LuCircleCheck,
  LuClipboardList,
  LuSchool,
  LuUserPlus,
  LuUsers,
} from 'react-icons/lu';
import { useAuth } from '../../contexts/useAuth';
import { useApi, useDocumentTitle } from '../../hooks/useApi';
import { gradeLabel, greeting, plural, timeAgo } from '../../lib/format';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import EmptyState from '../../components/ui/EmptyState';
import ActivityFeed from '../../components/ui/ActivityFeed';
import CapacityMeter from '../../components/ui/CapacityMeter';
import StatusBadge from '../../components/ui/StatusBadge';
import { BarsChart } from '../../components/charts/Charts';

/** Attention items, most urgent first. Each links to where it gets fixed. */
const attentionItems = (attention) => [
  ...attention.classesWithoutTeacher.map((c) => ({
    key: `teacher-${c.class_id}`,
    to: `/school-admin/classes/${c.class_id}`,
    title: `${c.class_name} has no class teacher`,
    detail: 'Assign one so they can record marks.',
  })),
  ...(attention.unplacedLearners > 0
    ? [
        {
          key: 'unplaced',
          to: '/school-admin/learners?status=unplaced',
          title: `${plural(attention.unplacedLearners, 'learner')} not in a class`,
          detail: 'Place them so their teachers can see them.',
        },
      ]
    : []),
  ...attention.fullClasses.map((c) => ({
    key: `full-${c.class_id}`,
    to: `/school-admin/classes/${c.class_id}`,
    title: `${c.class_name} is full`,
    detail: `${c.learner_count} of ${c.max_capacity} places taken.`,
  })),
  ...attention.pendingTeachers.map((t) => ({
    key: `pending-${t.user_id}`,
    to: '/school-admin/teachers?status=pending',
    title: `${t.first_name} ${t.last_name} hasn’t signed in yet`,
    detail: `Invited ${timeAgo(t.created_at)}. Resend the invitation if it got lost.`,
  })),
];

const SchoolAdminDashboard = () => {
  useDocumentTitle('Dashboard');
  const { user } = useAuth();
  const { data, error, reload } = useApi('/api/school-admin/dashboard');
  const loading = !data;
  const summary = data?.summary;

  if (error && !data) {
    return (
      <EmptyState icon={LuActivity} title="Couldn’t load the dashboard" action={<Button onClick={reload}>Try again</Button>}>
        {error}
      </EmptyState>
    );
  }

  const todo = data ? attentionItems(data.attention) : [];

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user.first_name}`}
        description={user.school_name ? `Here’s how ${user.school_name} is doing.` : 'Here’s how your school is doing.'}
        actions={
          <>
            <Button as={Link} to="/school-admin/learners" variant="light" className="d-inline-flex align-items-center gap-2">
              <LuUserPlus aria-hidden="true" /> Add learners
            </Button>
            <Button as={Link} to="/school-admin/classes">
              Manage classes
            </Button>
          </>
        }
      />

      <div className="el-stat-grid">
        <StatCard
          label="Learners"
          value={summary?.learners?.toLocaleString('en-ZA')}
          hint={summary && (summary.unplaced_learners ? `${summary.unplaced_learners} not in a class` : 'All in a class')}
          icon={LuSchool}
          tone="success"
          loading={loading}
        />
        <StatCard
          label="Teachers"
          value={summary?.teachers}
          hint={summary && (summary.pending_teachers ? `${summary.pending_teachers} invite${summary.pending_teachers === 1 ? '' : 's'} pending` : 'All signed in')}
          icon={LuUsers}
          loading={loading}
        />
        <StatCard
          label={`Classes in ${data?.year ?? new Date().getFullYear()}`}
          value={summary?.classes}
          hint={
            data &&
            (data.attention.classesWithoutTeacher.length
              ? `${data.attention.classesWithoutTeacher.length} without a class teacher`
              : 'All have a class teacher')
          }
          icon={LuClipboardList}
          tone="neutral"
          loading={loading}
        />
        <StatCard
          label="Average mark"
          value={summary && (summary.average_mark === null ? '—' : `${summary.average_mark}%`)}
          hint="This year, all classes"
          icon={LuChartColumn}
          tone="warning"
          loading={loading}
        />
      </div>

      <div className="el-split">
        <div className="el-stack">
          <section className="el-panel" aria-labelledby="classes-heading">
            <div className="el-panel__header">
              <div>
                <h2 id="classes-heading" className="el-panel__title">
                  Classes at a glance
                </h2>
                <p className="el-panel__subtitle">Class teachers and how full each class is.</p>
              </div>
              <Button as={Link} to="/school-admin/classes" size="sm" variant="light">
                All classes
              </Button>
            </div>
            {!loading && data.classes.length === 0 ? (
              <EmptyState
                compact
                icon={LuClipboardList}
                title={`No classes for ${data.year} yet`}
                action={
                  <Button as={Link} to="/school-admin/classes" size="sm">
                    Create classes
                  </Button>
                }
              >
                Create a class for each group of learners, then assign their teacher.
              </EmptyState>
            ) : (
              <ul className="el-list">
                {(data?.classes ?? []).map((c) => (
                  <li key={c.class_id}>
                    <Link to={`/school-admin/classes/${c.class_id}`} className="el-list-link">
                      <span className="min-w-0">
                        <span className="el-cell-primary d-block">{c.class_name}</span>
                        <span className="el-cell-secondary">
                          {gradeLabel(c.grade_level)} ·{' '}
                          {c.teacher_first_name ? `${c.teacher_first_name} ${c.teacher_last_name}` : 'No class teacher'}
                        </span>
                      </span>
                      <span className="d-flex align-items-center gap-3">
                        <CapacityMeter count={c.learner_count} capacity={c.max_capacity} compact />
                        <LuChevronRight aria-hidden="true" className="flex-shrink-0" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="el-panel" aria-labelledby="grades-heading">
            <div className="el-panel__header">
              <div>
                <h2 id="grades-heading" className="el-panel__title">
                  Learners by grade
                </h2>
                <p className="el-panel__subtitle">Learners currently in a class.</p>
              </div>
            </div>
            <div className="el-panel__body">
              {loading ? (
                <div className="el-chart-placeholder" />
              ) : data.learnersByGrade.length === 0 ? (
                <EmptyState compact icon={LuChartColumn} title="No learners in classes yet">
                  Numbers appear once learners are placed in classes.
                </EmptyState>
              ) : (
                <BarsChart
                  data={data.learnersByGrade}
                  xKey="grade"
                  yKey="learners"
                  label="Learners per grade"
                  unit="learners"
                  formatX={gradeLabel}
                />
              )}
            </div>
          </section>
        </div>

        <div className="el-stack">
          <section className="el-panel" aria-labelledby="attention-heading">
            <div className="el-panel__header">
              <div>
                <h2 id="attention-heading" className="el-panel__title">
                  Needs attention
                </h2>
                <p className="el-panel__subtitle">Things to sort out so teachers can get on with teaching.</p>
              </div>
              {todo.length > 0 && <StatusBadge status="attention" label={plural(todo.length, 'item')} />}
            </div>
            {!loading && todo.length === 0 ? (
              <EmptyState compact icon={LuCircleCheck} title="All set">
                Every class has a teacher and every learner has a class.
              </EmptyState>
            ) : (
              <ul className="el-list">
                {todo.slice(0, 6).map((item) => (
                  <li key={item.key}>
                    <Link to={item.to} className="el-list-link">
                      <span className="min-w-0">
                        <span className="el-cell-primary d-block">{item.title}</span>
                        <span className="el-cell-secondary">{item.detail}</span>
                      </span>
                      <LuChevronRight aria-hidden="true" className="flex-shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="el-panel" aria-labelledby="activity-heading">
            <div className="el-panel__header">
              <h2 id="activity-heading" className="el-panel__title">
                Recent activity
              </h2>
            </div>
            <ActivityFeed items={data?.recentActivity} emptyText="Changes made by you and your teachers show up here." />
          </section>
        </div>
      </div>
    </>
  );
};

export default SchoolAdminDashboard;
