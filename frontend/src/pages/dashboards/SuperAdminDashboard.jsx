import { Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import {
  LuActivity,
  LuBuilding2,
  LuChartColumn,
  LuChevronRight,
  LuCircleCheck,
  LuMailCheck,
  LuSchool,
  LuUsers,
} from 'react-icons/lu';
import { useAuth } from '../../contexts/useAuth';
import { useApi, useDocumentTitle } from '../../hooks/useApi';
import { gradeLabel, greeting, plural, timeAgo } from '../../lib/format';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import EmptyState from '../../components/ui/EmptyState';
import ActivityFeed from '../../components/ui/ActivityFeed';
import { BarsChart, TrendChart } from '../../components/charts/Charts';

const monthLabel = (yyyyMm) =>
  new Date(`${yyyyMm}-01T00:00:00`).toLocaleDateString('en-ZA', { month: 'short' });

const SuperAdminDashboard = () => {
  useDocumentTitle('Dashboard');
  const { user } = useAuth();
  const { data, error, reload } = useApi('/api/super-admin/statistics');
  const summary = data?.summary;
  const loading = !data;

  if (error && !data) {
    return (
      <EmptyState icon={LuActivity} title="Couldn’t load the dashboard" action={<Button onClick={reload}>Try again</Button>}>
        {error}
      </EmptyState>
    );
  }

  const newLearners = data?.growth.reduce((n, m) => n + m.learners, 0) ?? 0;
  const needsAdmin = data?.attention.schoolsWithoutAdmin ?? [];

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user.first_name}`}
        description="Here’s what’s happening across Edulens."
        actions={
          <Button as={Link} to="/super-admin/schools">
            Manage schools
          </Button>
        }
      />

      <div className="el-stat-grid">
        <StatCard
          label="Active schools"
          value={summary?.active_schools}
          hint={summary && `${summary.schools} in total`}
          icon={LuBuilding2}
          loading={loading}
        />
        <StatCard
          label="Teachers"
          value={summary?.teachers}
          hint={summary && plural(summary.school_admins, 'school admin')}
          icon={LuUsers}
          tone="neutral"
          loading={loading}
        />
        <StatCard
          label="Learners"
          value={summary?.learners?.toLocaleString('en-ZA')}
          hint={summary && plural(summary.classes, 'class', 'classes')}
          icon={LuSchool}
          tone="success"
          loading={loading}
        />
        <StatCard
          label="Invitations pending"
          value={summary?.pending_invites}
          hint={summary && `${summary.active_last_7_days} staff signed in this week`}
          icon={LuMailCheck}
          tone="warning"
          loading={loading}
        />
      </div>

      <div className="el-split">
        <div className="el-stack">
          <section className="el-panel" aria-labelledby="growth-heading">
            <div className="el-panel__header">
              <div>
                <h2 id="growth-heading" className="el-panel__title">
                  New learners
                </h2>
                <p className="el-panel__subtitle">
                  {loading ? 'Last 12 months' : `${newLearners.toLocaleString('en-ZA')} enrolled in the last 12 months`}
                </p>
              </div>
            </div>
            <div className="el-panel__body">
              {loading ? (
                <div className="el-chart-placeholder" />
              ) : (
                <TrendChart
                  data={data.growth}
                  xKey="month"
                  yKey="learners"
                  label="New learners per month"
                  unit="new learners"
                  formatX={monthLabel}
                />
              )}
            </div>
          </section>

          <section className="el-panel" aria-labelledby="grades-heading">
            <div className="el-panel__header">
              <div>
                <h2 id="grades-heading" className="el-panel__title">
                  Learners by grade
                </h2>
                <p className="el-panel__subtitle">Active learners in a class, across all schools.</p>
              </div>
            </div>
            <div className="el-panel__body">
              {loading ? (
                <div className="el-chart-placeholder" />
              ) : data.learnersByGrade.length === 0 ? (
                <EmptyState compact icon={LuChartColumn} title="No learners in classes yet">
                  Numbers appear once schools place learners in classes.
                </EmptyState>
              ) : (
                <BarsChart
                  data={data.learnersByGrade}
                  xKey="grade"
                  yKey="learners"
                  label="Active learners per grade"
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
                <p className="el-panel__subtitle">Active schools without an administrator.</p>
              </div>
            </div>
            {!loading && needsAdmin.length === 0 ? (
              <EmptyState compact icon={LuCircleCheck} title="All schools have an administrator" />
            ) : (
              <ul className="el-list">
                {needsAdmin.map((school) => (
                  <li key={school.school_id}>
                    <Link to={`/super-admin/schools/${school.school_id}`} className="el-list-link">
                      <span>
                        <span className="el-cell-primary d-block">{school.school_name}</span>
                        <span className="el-cell-secondary">Added {timeAgo(school.created_at)}</span>
                      </span>
                      <LuChevronRight aria-hidden="true" />
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
            <ActivityFeed items={data?.recentActivity} showSchool />
          </section>
        </div>
      </div>
    </>
  );
};

export default SuperAdminDashboard;
