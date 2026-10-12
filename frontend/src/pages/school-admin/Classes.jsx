import { useMemo, useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { LuClipboardList, LuPlus, LuTriangleAlert, LuUser } from 'react-icons/lu';
import { useApi, useDocumentTitle } from '../../hooks/useApi';
import { CLASS_GRADES, gradeLabel, plural } from '../../lib/format';
import { fadeUpItem, staggerContainer } from '../../lib/motion';
import './school-admin.css';
import PageHeader from '../../components/ui/PageHeader';
import FilterTabs from '../../components/ui/FilterTabs';
import EmptyState from '../../components/ui/EmptyState';
import StatusBadge from '../../components/ui/StatusBadge';
import CapacityMeter from '../../components/ui/CapacityMeter';
import FullPageLoader from '../../components/ui/FullPageLoader';
import ClassFormModal from './components/ClassFormModal';

const ClassCard = ({ klass }) => {
  const classTeacher = klass.teachers.find((t) => t.is_primary);
  const support = klass.teachers.length - (classTeacher ? 1 : 0);
  return (
    <Link to={`/school-admin/classes/${klass.class_id}`} className="el-class-card card-interactive">
      <div className="el-class-card__head">
        <span className="el-class-card__name">{klass.class_name}</span>
        {!klass.is_active && <StatusBadge status="inactive" />}
      </div>
      <div className="el-class-card__teacher">
        {classTeacher ? (
          <>
            <LuUser aria-hidden="true" />
            <span className="text-truncate">
              {classTeacher.first_name} {classTeacher.last_name}
              {support > 0 && <span className="text-body-secondary"> +{support}</span>}
            </span>
          </>
        ) : (
          <span className="el-class-card__warning">
            <LuTriangleAlert aria-hidden="true" /> No class teacher
          </span>
        )}
      </div>
      <CapacityMeter count={klass.learner_count} capacity={klass.max_capacity} />
    </Link>
  );
};

const Classes = () => {
  useDocumentTitle('Classes');
  const navigate = useNavigate();
  const [year, setYear] = useState(null);
  const [grade, setGrade] = useState('all');
  const [showInactive, setShowInactive] = useState(false);
  const [creating, setCreating] = useState(false);

  const { data, loading, error, reload } = useApi('/api/school-admin/classes', {
    year: year ?? undefined,
    status: showInactive ? 'all' : 'active',
  });
  const teachersQuery = useApi(creating ? '/api/school-admin/teachers' : null, { limit: 100 });
  const activeTeachers = (teachersQuery.data?.teachers ?? []).filter((t) => t.is_active);

  const classes = useMemo(() => data?.classes ?? [], [data]);
  const byGrade = useMemo(
    () =>
      CLASS_GRADES.map((g) => ({ grade: g, classes: classes.filter((c) => c.grade_level === g) })).filter(
        (group) => group.classes.length > 0 && (grade === 'all' || group.grade === grade)
      ),
    [classes, grade]
  );

  if (loading && !data) return <FullPageLoader label="Loading classes…" />;

  const shownYear = data?.year ?? new Date().getFullYear();
  const learners = classes.reduce((n, c) => n + c.learner_count, 0);
  const places = classes.reduce((n, c) => n + c.max_capacity, 0);

  return (
    <>
      <PageHeader
        title="Classes"
        description={
          data && classes.length > 0
            ? `${plural(classes.length, 'class', 'classes')} in ${shownYear} · ${learners} of ${places} places taken`
            : 'Group learners into classes and give each class its teachers.'
        }
        actions={
          <Button onClick={() => setCreating(true)} className="d-inline-flex align-items-center gap-2">
            <LuPlus aria-hidden="true" /> Create class
          </Button>
        }
      />

      <section className="el-panel mb-4" aria-label="Filter classes">
        <div className="el-toolbar border-0">
          <FilterTabs
            label="Filter by grade"
            value={grade}
            onChange={setGrade}
            options={[
              { value: 'all', label: 'All grades', count: classes.length },
              ...CLASS_GRADES.map((g) => ({
                value: g,
                label: gradeLabel(g),
                count: classes.filter((c) => c.grade_level === g).length,
              })),
            ]}
          />
          <Form.Select aria-label="Year" value={shownYear} onChange={(e) => setYear(Number(e.target.value))}>
            {(data?.years ?? [shownYear]).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Form.Select>
          <Form.Check
            type="switch"
            id="show-inactive-classes"
            label="Show inactive"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="mb-0"
          />
        </div>
      </section>

      {error && !data ? (
        <EmptyState icon={LuClipboardList} title="Couldn’t load classes" action={<Button onClick={reload}>Try again</Button>}>
          {error}
        </EmptyState>
      ) : classes.length === 0 ? (
        <section className="el-panel">
          <EmptyState
            icon={LuClipboardList}
            title={`No classes for ${shownYear} yet`}
            action={<Button onClick={() => setCreating(true)}>Create the first class</Button>}
          >
            Create a class for each group of learners, such as “Grade 1A”, then assign its class teacher.
          </EmptyState>
        </section>
      ) : (
        byGrade.map((group) => (
          <section key={group.grade} className="el-grade-section" aria-labelledby={`grade-${group.grade}`}>
            <h2 id={`grade-${group.grade}`} className="el-grade-section__title">
              {gradeLabel(group.grade)}
              <span className="el-grade-section__count">{plural(group.classes.length, 'class', 'classes')}</span>
            </h2>
            <motion.div className="el-class-grid" variants={staggerContainer()} initial="initial" animate="animate">
              {group.classes.map((klass, index) => (
                <motion.div key={klass.class_id} variants={index < 8 ? fadeUpItem : undefined}>
                  <ClassCard klass={klass} />
                </motion.div>
              ))}
            </motion.div>
          </section>
        ))
      )}

      {creating && (
        <ClassFormModal
          teachers={activeTeachers}
          defaultYear={shownYear}
          onClose={() => setCreating(false)}
          onSaved={(saved, message) => {
            setCreating(false);
            toast.success(message);
            navigate(`/school-admin/classes/${saved.class_id}`);
          }}
        />
      )}
    </>
  );
};

export default Classes;
