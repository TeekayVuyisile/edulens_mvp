import { useState } from 'react';
import { Button, Form, Table } from 'react-bootstrap';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LuClipboardList, LuFileUp, LuPlus, LuUserPlus, LuUsers } from 'react-icons/lu';
import { useApi, useDocumentTitle } from '../../hooks/useApi';
import { ageFrom, ASSESSMENT_TYPES, capsLevel, CAPS_LEVELS, formatDate, gradeLabel, plural, TERMS } from '../../lib/format';
import PageHeader from '../../components/ui/PageHeader';
import FilterTabs from '../../components/ui/FilterTabs';
import EmptyState from '../../components/ui/EmptyState';
import StatusBadge from '../../components/ui/StatusBadge';
import RowActions from '../../components/ui/RowActions';
import ProgressMeter from '../../components/ui/ProgressMeter';
import CapacityMeter from '../../components/ui/CapacityMeter';
import FullPageLoader from '../../components/ui/FullPageLoader';
import LearnerFormModal from '../../components/learners/LearnerFormModal';
import ImportLearnersModal from '../../components/learners/ImportLearnersModal';
import AssessmentFormModal from './components/AssessmentFormModal';

const TABS = ['learners', 'marks', 'assessments'];

const Percent = ({ value }) =>
  value === null || value === undefined ? (
    <span className="el-cell-secondary">—</span>
  ) : (
    <span className={value < 50 ? 'el-marksheet__cell--low' : undefined} title={CAPS_LEVELS[capsLevel(value)]}>
      {Math.round(value)}%
    </span>
  );

const LearnersTab = ({ learners, klass, onAdd }) => {
  const navigate = useNavigate();
  if (learners.length === 0) {
    return (
      <EmptyState
        compact
        icon={LuUsers}
        title="No learners yet"
        action={klass.is_active && <Button size="sm" onClick={onAdd}>Add a learner</Button>}
      >
        Add your learners one by one, or import the class register.
      </EmptyState>
    );
  }
  return (
    <div className="el-table-wrap">
      <Table className="el-table">
        <thead>
          <tr>
            <th scope="col">Learner</th>
            <th scope="col" className="d-none d-sm-table-cell">Age</th>
            <th scope="col" className="d-none d-md-table-cell">Guardian</th>
            <th scope="col" className="text-end">Average</th>
          </tr>
        </thead>
        <tbody>
          {learners.map((l) => (
            <tr key={l.learner_id} className="is-clickable" onClick={() => navigate(`/teacher/learners/${l.learner_id}`)}>
              <td>
                <Link to={`/teacher/learners/${l.learner_id}`} className="el-cell-primary text-reset" onClick={(e) => e.stopPropagation()}>
                  {l.last_name}, {l.first_name}
                </Link>
                {l.has_special_needs && (
                  <span className="el-support-dot" title="Needs learning support">
                    <span className="visually-hidden"> (needs learning support)</span>
                  </span>
                )}
              </td>
              <td className="d-none d-sm-table-cell tabular-nums">{ageFrom(l.date_of_birth) ?? '—'}</td>
              <td className="d-none d-md-table-cell">
                <div>{l.guardian_name || '—'}</div>
                {l.guardian_phone && <div className="el-cell-secondary">{l.guardian_phone}</div>}
              </td>
              <td className="text-end tabular-nums">
                {l.average === null ? <span className="el-cell-secondary">No marks</span> : `${l.average}% · L${capsLevel(l.average)}`}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
};

const MarksheetTab = ({ classId }) => {
  const [term, setTerm] = useState('');
  const { data, loading } = useApi(`/api/teacher/classes/${classId}/marksheet`, { term: term || undefined });

  return (
    <>
      <div className="el-toolbar">
        <Form.Select aria-label="Term" value={term} onChange={(e) => setTerm(e.target.value)}>
          <option value="">Whole year</option>
          {TERMS.map((t) => (
            <option key={t} value={t}>
              Term {t}
            </option>
          ))}
        </Form.Select>
        <span className="el-cell-secondary">Percentages; below 50% in bold red. Scroll sideways for more assessments.</span>
      </div>
      {loading && !data ? (
        <div className="el-panel__body">
          <div className="el-chart-placeholder" />
        </div>
      ) : data.assessments.length === 0 || data.learners.length === 0 ? (
        <EmptyState compact icon={LuClipboardList} title={data.learners.length === 0 ? 'No learners yet' : 'No assessments for this term'}>
          The marksheet fills in as you create assessments and enter marks.
        </EmptyState>
      ) : (
        <div className="el-marksheet">
          <Table className="el-table mb-0" size="sm">
            <thead>
              <tr>
                <th scope="col" className="el-marksheet__name">Learner</th>
                {data.assessments.map((a) => (
                  <th key={a.assessment_id} scope="col" className="el-marksheet__col el-marksheet__cell">
                    <Link to={`/teacher/assessments/${a.assessment_id}`}>{a.assessment_name}</Link>
                    <div className="el-cell-secondary fw-normal">{a.subject_name ?? ASSESSMENT_TYPES[a.assessment_type]}</div>
                  </th>
                ))}
                <th scope="col" className="el-marksheet__cell">Average</th>
              </tr>
            </thead>
            <tbody>
              {data.learners.map((l) => (
                <tr key={l.learner_id}>
                  <th scope="row" className="el-marksheet__name fw-semibold">
                    <Link to={`/teacher/learners/${l.learner_id}`} className="text-reset">
                      {l.last_name}, {l.first_name}
                    </Link>
                  </th>
                  {data.assessments.map((a) => (
                    <td key={a.assessment_id} className="el-marksheet__cell">
                      <Percent value={l.marks[a.assessment_id]} />
                    </td>
                  ))}
                  <td className="el-marksheet__cell fw-bold">
                    <Percent value={l.average} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </>
  );
};

const AssessmentsTab = ({ classId, onCreate, canCreate }) => {
  const { data, loading } = useApi('/api/teacher/assessments', { class_id: classId });
  const assessments = data?.assessments ?? [];
  if (loading && !data) return <div className="el-panel__body text-body-secondary">Loading…</div>;
  if (assessments.length === 0) {
    return (
      <EmptyState compact icon={LuClipboardList} title="No assessments yet" action={canCreate && <Button size="sm" onClick={onCreate}>Create one</Button>}>
        Create a test or task for this class, then enter marks.
      </EmptyState>
    );
  }
  return (
    <ul className="el-list">
      {assessments.map((a) => (
        <li key={a.assessment_id}>
          <Link to={`/teacher/assessments/${a.assessment_id}`} className="el-list-link">
            <span className="min-w-0">
              <span className="el-cell-primary d-block">{a.assessment_name}</span>
              <span className="el-cell-secondary">
                {[a.subject_name, `Term ${a.term_number}`, a.scheduled_date && formatDate(a.scheduled_date)].filter(Boolean).join(' · ')}
              </span>
            </span>
            <span className="d-flex align-items-center gap-3">
              <span className="d-none d-sm-block el-cell-progress">
                <ProgressMeter value={a.marked_count} max={a.learner_count} label="marked" compact />
              </span>
              <span className="tabular-nums fw-semibold">{a.average === null ? '—' : `${a.average}%`}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
};

const ClassDetail = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'learners';
  const { data, loading, error, reload } = useApi(`/api/teacher/classes/${classId}`);
  const classesQuery = useApi('/api/teacher/classes');
  useDocumentTitle(data?.class.class_name ?? 'Class');
  const [dialog, setDialog] = useState(null); // 'learner' | 'import' | 'assessment'

  if (loading && !data) return <FullPageLoader label="Loading class…" />;
  if (error && !data) {
    return (
      <EmptyState icon={LuUsers} title="Couldn’t load this class" action={<Button onClick={reload}>Try again</Button>}>
        {error}
      </EmptyState>
    );
  }

  const { class: klass, learners } = data;
  const teacherNames = klass.teachers.map((t) => `${t.first_name} ${t.last_name}${t.is_primary ? ' (class teacher)' : ''}`);
  const done = (message) => {
    setDialog(null);
    toast.success(message);
    reload();
  };

  return (
    <>
      <PageHeader
        back={{ to: '/teacher/classes', label: 'My classes' }}
        eyebrow={`${gradeLabel(klass.grade_level)} · ${klass.academic_year} · ${klass.is_primary ? 'You’re the class teacher' : 'Support teacher'}`}
        title={
          <span className="d-inline-flex flex-wrap align-items-center gap-3">
            {klass.class_name}
            {!klass.is_active && <StatusBadge status="inactive" label="Past class" />}
          </span>
        }
        description={`Teachers: ${teacherNames.join(', ')}`}
        actions={
          klass.is_active && (
            <>
              <Button onClick={() => setDialog('assessment')} className="d-inline-flex align-items-center gap-2">
                <LuPlus aria-hidden="true" /> New assessment
              </Button>
              <RowActions
                label={`Add learners to ${klass.class_name}`}
                items={[
                  { label: 'Add a learner', icon: LuUserPlus, onClick: () => setDialog('learner') },
                  { label: 'Import the class register', icon: LuFileUp, onClick: () => setDialog('import') },
                ]}
              />
            </>
          )
        }
      />

      <div className="el-split">
        <section className="el-panel" aria-label={`${klass.class_name} details`}>
          <div className="el-toolbar">
            <FilterTabs
              label="Show"
              value={tab}
              onChange={(value) => setSearchParams(value === 'learners' ? {} : { tab: value }, { replace: true })}
              options={[
                { value: 'learners', label: 'Learners', count: learners.length },
                { value: 'marks', label: 'Marksheet' },
                { value: 'assessments', label: 'Assessments' },
              ]}
            />
          </div>
          {tab === 'learners' && <LearnersTab learners={learners} klass={klass} onAdd={() => setDialog('learner')} />}
          {tab === 'marks' && <MarksheetTab classId={klass.class_id} />}
          {tab === 'assessments' && (
            <AssessmentsTab classId={klass.class_id} canCreate={klass.is_active} onCreate={() => setDialog('assessment')} />
          )}
        </section>

        <section className="el-panel" aria-labelledby="class-size-heading">
          <div className="el-panel__header">
            <h2 id="class-size-heading" className="el-panel__title">
              Class size
            </h2>
          </div>
          <div className="el-panel__body d-grid gap-3">
            <CapacityMeter count={klass.learner_count} capacity={klass.max_capacity} />
            <p className="el-cell-secondary mb-0">
              {(() => {
                const flagged = learners.filter((l) => l.has_special_needs).length;
                return flagged ? `${plural(flagged, 'learner')} flagged for learning support.` : 'No learners flagged for learning support.';
              })()}{' '}
              Your school admin moves learners between classes.
            </p>
          </div>
        </section>
      </div>

      {dialog === 'learner' && (
        <LearnerFormModal
          apiBase="/api/teacher"
          createUrl={`/api/teacher/classes/${klass.class_id}/learners`}
          title={`Add a learner to ${klass.class_name}`}
          onClose={() => setDialog(null)}
          onSaved={(_, message) => done(message)}
        />
      )}
      {dialog === 'import' && (
        <ImportLearnersModal
          url={`/api/teacher/classes/${klass.class_id}/learners/import`}
          className={klass.class_name}
          onClose={() => setDialog(null)}
          onImported={done}
        />
      )}
      {dialog === 'assessment' && (
        <AssessmentFormModal
          classes={classesQuery.data?.classes ?? [klass]}
          defaultClassId={klass.class_id}
          onClose={() => setDialog(null)}
          onSaved={(saved, message) => {
            toast.success(message);
            navigate(`/teacher/assessments/${saved.assessment_id}`);
          }}
        />
      )}
    </>
  );
};

export default ClassDetail;
