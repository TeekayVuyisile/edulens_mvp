import { useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LuSchool, LuStar, LuUsers } from 'react-icons/lu';
import { useApi, useDocumentTitle } from '../../hooks/useApi';
import { capsLevel, gradeLabel, plural } from '../../lib/format';
import { fadeUpItem, staggerContainer } from '../../lib/motion';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import StatusBadge from '../../components/ui/StatusBadge';
import FullPageLoader from '../../components/ui/FullPageLoader';

const TeacherClassCard = ({ klass }) => (
  <Link to={`/teacher/classes/${klass.class_id}`} className="el-class-card card-interactive">
    <div className="el-class-card__head">
      <span>
        <span className="el-class-card__name d-block">{klass.class_name}</span>
        <span className="el-cell-secondary">
          {gradeLabel(klass.grade_level)} · {klass.academic_year}
        </span>
      </span>
      {klass.is_active ? (
        klass.is_primary && (
          <span className="el-chip" title="You’re the class teacher">
            <LuStar aria-hidden="true" /> Class teacher
          </span>
        )
      ) : (
        <StatusBadge status="inactive" label="Past class" />
      )}
    </div>
    <dl className="el-class-card__facts">
      <div>
        <dt>Learners</dt>
        <dd className="tabular-nums">{klass.learner_count}</dd>
      </div>
      <div>
        <dt>Assessments</dt>
        <dd className="tabular-nums">{klass.assessment_count}</dd>
      </div>
      <div>
        <dt>Average</dt>
        <dd className="tabular-nums">
          {klass.average === null ? '—' : (
            <>
              {klass.average}% <span className="el-cell-secondary">L{capsLevel(klass.average)}</span>
            </>
          )}
        </dd>
      </div>
    </dl>
  </Link>
);

const Classes = () => {
  useDocumentTitle('My classes');
  const [showPast, setShowPast] = useState(false);
  const { data, loading, error, reload } = useApi('/api/teacher/classes', { include_inactive: showPast ? 'true' : undefined });

  if (loading && !data) return <FullPageLoader label="Loading your classes…" />;

  const classes = data?.classes ?? [];
  const learners = classes.filter((c) => c.is_active).reduce((n, c) => n + c.learner_count, 0);

  return (
    <>
      <PageHeader
        title="My classes"
        description={
          classes.length > 0
            ? `${plural(classes.filter((c) => c.is_active).length, 'class', 'classes')} · ${plural(learners, 'learner')}`
            : 'The classes your school admin has given you.'
        }
        actions={
          <Form.Check
            type="switch"
            id="show-past-classes"
            label="Show past classes"
            checked={showPast}
            onChange={(e) => setShowPast(e.target.checked)}
            className="mb-0"
          />
        }
      />

      {error && !data ? (
        <EmptyState icon={LuSchool} title="Couldn’t load your classes" action={<Button onClick={reload}>Try again</Button>}>
          {error}
        </EmptyState>
      ) : classes.length === 0 ? (
        <section className="el-panel">
          <EmptyState icon={LuUsers} title="No classes yet">
            Your school admin assigns teachers to classes. Once you have a class, its learners and assessments appear here.
          </EmptyState>
        </section>
      ) : (
        <motion.div className="el-class-grid" variants={staggerContainer()} initial="initial" animate="animate">
          {classes.map((klass, index) => (
            <motion.div key={klass.class_id} variants={index < 8 ? fadeUpItem : undefined}>
              <TeacherClassCard klass={klass} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </>
  );
};

export default Classes;
