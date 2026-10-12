import { Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { LuChevronRight, LuHeart } from 'react-icons/lu';
import { useAuth } from '../../contexts/useAuth';
import { useApi, useDocumentTitle } from '../../hooks/useApi';
import { gradeLabel, greeting, initials, timeAgo } from '../../lib/format';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import { LevelPill } from '../../components/learners/LearnerPanels';

/** A parent's home: one card per child, linking to their progress. */
const ParentDashboard = () => {
  useDocumentTitle('My children');
  const { user } = useAuth();
  const { data, error, reload } = useApi('/api/parent/children');
  const children = data?.children ?? [];

  if (error && !data) {
    return (
      <EmptyState icon={LuHeart} title="Couldn’t load your children" action={<Button onClick={reload}>Try again</Button>}>
        {error}
      </EmptyState>
    );
  }

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user.first_name}`}
        description="See how your children are doing at school: their marks, and what their teachers say."
      />

      {!data ? (
        <div className="el-chart-placeholder" />
      ) : children.length === 0 ? (
        <section className="el-panel">
          <EmptyState icon={LuHeart} title="No children linked yet">
            Your child’s school links your account to your child. If you think this is a mistake, please contact the school.
          </EmptyState>
        </section>
      ) : (
        <div className="el-worksheet-cards">
          {children.map((child) => (
            <Link key={child.learner_id} to={`/parent/children/${child.learner_id}`} className="el-worksheet-card el-child-card">
              <span className="d-flex align-items-center gap-3">
                <span className="el-avatar" aria-hidden="true">
                  {initials(child.first_name, child.last_name)}
                </span>
                <span className="min-w-0">
                  <span className="el-cell-primary d-block fs-6">
                    {child.first_name} {child.last_name}
                  </span>
                  <span className="el-cell-secondary">{child.school_name}</span>
                </span>
              </span>
              <span className="el-cell-secondary">
                {child.class_name ? `${child.class_name} · ${gradeLabel(child.grade_level)}` : 'Not in a class yet'}
                {child.teacher_first_name && ` · ${child.teacher_first_name} ${child.teacher_last_name}`}
              </span>
              <span className="d-flex align-items-center justify-content-between gap-2 mt-auto">
                {child.average === null ? (
                  <span className="el-cell-secondary">No marks yet</span>
                ) : (
                  <span className="d-flex align-items-center gap-2">
                    <span className="fw-bold tabular-nums">{child.average}%</span>
                    <LevelPill percentage={child.average} />
                  </span>
                )}
                <span className="el-cell-secondary d-inline-flex align-items-center gap-1">
                  {child.last_marked_at ? `Marked ${timeAgo(child.last_marked_at)}` : 'View'}
                  <LuChevronRight aria-hidden="true" />
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
};

export default ParentDashboard;
