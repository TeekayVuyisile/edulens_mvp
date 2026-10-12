import { useState } from 'react';
import { Button } from 'react-bootstrap';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  LuArrowRightLeft,
  LuChartColumn,
  LuHistory,
  LuLogOut,
  LuMail,
  LuMessageCircle,
  LuPencil,
  LuPhone,
  LuSchool,
  LuTrash2,
  LuUndo2,
} from 'react-icons/lu';
import { useApi, useDocumentTitle } from '../../hooks/useApi';
import { useMutation } from '../../hooks/useMutation';
import {
  ageFrom,
  CAPS_LEVELS,
  capsLevel,
  formatDate,
  fullName,
  gradeLabel,
  isCurrentLearner,
  learnerStatus,
  whatsappLink,
} from '../../lib/format';
import './school-admin.css';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';
import RowActions from '../../components/ui/RowActions';
import FullPageLoader from '../../components/ui/FullPageLoader';
import LearnerFormModal from './components/LearnerFormModal';
import MoveLearnerModal from './components/MoveLearnerModal';
import LearnerStatusDialogs from './components/LearnerStatusDialogs';

const LearnerDetail = () => {
  const { learnerId } = useParams();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useApi(`/api/school-admin/learners/${learnerId}`);
  const classesQuery = useApi('/api/school-admin/classes');
  useDocumentTitle(data ? fullName(data.learner) : 'Learner');

  const [dialog, setDialog] = useState(null);
  const mutate = useMutation();
  const close = () => setDialog(null);

  if (loading && !data) return <FullPageLoader label="Loading learner…" />;
  if (error && !data) {
    return (
      <EmptyState icon={LuSchool} title="Couldn’t load this learner" action={<Button onClick={reload}>Try again</Button>}>
        {error}
      </EmptyState>
    );
  }

  const { learner, history, performance } = data;
  const current = isCurrentLearner(learner);
  const age = ageFrom(learner.date_of_birth);
  const whatsapp = whatsappLink(learner.guardian_phone);

  const afterChange = (message, type) => {
    close();
    toast.success(message);
    if (type === 'delete') navigate('/school-admin/learners', { replace: true });
    else reload();
  };

  return (
    <>
      <PageHeader
        back={{ to: '/school-admin/learners', label: 'All learners' }}
        eyebrow={learner.admission_number && <span className="font-monospace">{learner.admission_number}</span>}
        title={
          <span className="d-inline-flex flex-wrap align-items-center gap-3">
            {fullName(learner)}
            <StatusBadge status={learnerStatus(learner)} label={learnerStatus(learner) === 'active' ? 'At school' : undefined} />
          </span>
        }
        description={
          learner.class_name ? (
            <>
              <Link to={`/school-admin/classes/${learner.current_class_id}`}>{learner.class_name}</Link> ·{' '}
              {gradeLabel(learner.grade_level)} · {learner.academic_year}
              {learner.teacher_first_name && ` · ${learner.teacher_first_name} ${learner.teacher_last_name}`}
            </>
          ) : current ? (
            'Not in a class yet'
          ) : (
            'No longer at the school'
          )
        }
        actions={
          <>
            <Button variant="light" onClick={() => setDialog({ type: 'edit' })} className="d-inline-flex align-items-center gap-2">
              <LuPencil aria-hidden="true" /> Edit
            </Button>
            {current && (
              <Button onClick={() => setDialog({ type: 'move' })} className="d-inline-flex align-items-center gap-2">
                <LuArrowRightLeft aria-hidden="true" /> {learner.current_class_id ? 'Move class' : 'Place in a class'}
              </Button>
            )}
            <RowActions
              label={`More actions for ${fullName(learner)}`}
              items={[
                current
                  ? { label: 'Mark as left school', icon: LuLogOut, onClick: () => setDialog({ type: 'leave', learner }) }
                  : { label: 'Return to school', icon: LuUndo2, onClick: () => setDialog({ type: 'return', learner }) },
                null,
                { label: 'Delete', icon: LuTrash2, danger: true, onClick: () => setDialog({ type: 'delete', learner }) },
              ]}
            />
          </>
        }
      />

      <div className="el-split">
        <div className="el-stack">
          <section className="el-panel" aria-labelledby="marks-heading">
            <div className="el-panel__header">
              <div>
                <h2 id="marks-heading" className="el-panel__title">
                  Marks by subject
                </h2>
                <p className="el-panel__subtitle">Average of all marked assessments, with the CAPS achievement level.</p>
              </div>
            </div>
            {performance.length === 0 ? (
              <EmptyState compact icon={LuChartColumn} title="No marks yet">
                Marks appear here once {learner.first_name}’s teacher records an assessment.
              </EmptyState>
            ) : (
              <ul className="el-list">
                {performance.map((subject) => {
                  const level = capsLevel(subject.average);
                  return (
                    <li key={subject.subject_name}>
                      <div className="min-w-0">
                        <div className="el-cell-primary">{subject.subject_name}</div>
                        <div className="el-cell-secondary">
                          {subject.assessments} assessment{subject.assessments === 1 ? '' : 's'}
                        </div>
                      </div>
                      <div className="d-flex align-items-center gap-3">
                        <span className={`el-level el-level--${level}`} title={CAPS_LEVELS[level]}>
                          Level {level}
                        </span>
                        <span className="el-cell-primary tabular-nums el-percent">{subject.average}%</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="el-panel" aria-labelledby="history-heading">
            <div className="el-panel__header">
              <div>
                <h2 id="history-heading" className="el-panel__title">
                  Class history
                </h2>
                <p className="el-panel__subtitle">Every class {learner.first_name} has been in.</p>
              </div>
            </div>
            {history.length === 0 ? (
              <EmptyState compact icon={LuHistory} title="Not placed in a class yet" />
            ) : (
              <ol className="el-feed">
                {history.map((h) => (
                  <li key={h.history_id} className="el-feed__item">
                    <span className="el-feed__dot" aria-hidden="true" />
                    <div className="min-w-0">
                      <div>
                        <span className="fw-semibold">{h.class_name}</span>{' '}
                        <span className="text-body-secondary">
                          {gradeLabel(h.grade_level)} · {h.academic_year}
                        </span>
                      </div>
                      <div className="el-cell-secondary">
                        {formatDate(h.enrolled_date)} – {h.completed_date ? formatDate(h.completed_date) : 'now'}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <div className="el-stack">
          <section className="el-panel" aria-labelledby="details-heading">
            <div className="el-panel__header">
              <h2 id="details-heading" className="el-panel__title">
                Details
              </h2>
            </div>
            <div className="el-panel__body">
              <dl className="el-details">
                <dt>Born</dt>
                <dd>
                  {formatDate(learner.date_of_birth)}
                  {age !== null && <span className="text-body-secondary"> · {age} years old</span>}
                </dd>
                <dt>Gender</dt>
                <dd>{learner.gender || '—'}</dd>
                <dt>Admission no.</dt>
                <dd>{learner.admission_number || '—'}</dd>
                <dt>Enrolled</dt>
                <dd>{formatDate(learner.enrollment_date)}</dd>
              </dl>
            </div>
          </section>

          <section className="el-panel" aria-labelledby="guardian-heading">
            <div className="el-panel__header">
              <h2 id="guardian-heading" className="el-panel__title">
                Parent or guardian
              </h2>
            </div>
            <div className="el-panel__body">
              {learner.guardian_name || learner.guardian_phone || learner.guardian_email ? (
                <>
                  <p className="el-cell-primary mb-2">{learner.guardian_name || 'Name not recorded'}</p>
                  <div className="d-flex flex-wrap gap-2">
                    {learner.guardian_phone && (
                      <Button
                        as="a"
                        href={`tel:${learner.guardian_phone}`}
                        size="sm"
                        variant="light"
                        className="d-inline-flex align-items-center gap-2"
                      >
                        <LuPhone aria-hidden="true" /> {learner.guardian_phone}
                      </Button>
                    )}
                    {whatsapp && (
                      <Button
                        as="a"
                        href={whatsapp}
                        target="_blank"
                        rel="noreferrer"
                        size="sm"
                        variant="light"
                        className="d-inline-flex align-items-center gap-2"
                      >
                        <LuMessageCircle aria-hidden="true" /> WhatsApp
                      </Button>
                    )}
                    {learner.guardian_email && (
                      <Button
                        as="a"
                        href={`mailto:${learner.guardian_email}`}
                        size="sm"
                        variant="light"
                        className="d-inline-flex align-items-center gap-2 text-truncate mw-100"
                      >
                        <LuMail aria-hidden="true" /> {learner.guardian_email}
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-body-secondary mb-0">
                  No contact details yet.{' '}
                  <Button variant="link" className="p-0 align-baseline" onClick={() => setDialog({ type: 'edit' })}>
                    Add them
                  </Button>
                </p>
              )}
            </div>
          </section>

          <section className="el-panel" aria-labelledby="support-heading">
            <div className="el-panel__header">
              <h2 id="support-heading" className="el-panel__title">
                Support and health
              </h2>
              {learner.has_special_needs && <StatusBadge status="attention" label="Needs support" />}
            </div>
            <div className="el-panel__body">
              <dl className="el-details">
                <dt>Learning support</dt>
                <dd>{learner.has_special_needs ? learner.special_needs_notes || 'Yes (no notes)' : 'None recorded'}</dd>
                <dt>Medical</dt>
                <dd>{learner.medical_notes || 'None recorded'}</dd>
              </dl>
            </div>
          </section>
        </div>
      </div>

      {dialog?.type === 'edit' && (
        <LearnerFormModal learner={learner} onClose={close} onSaved={(_, message) => afterChange(message)} />
      )}
      {dialog?.type === 'move' && (
        <MoveLearnerModal
          learner={learner}
          classes={classesQuery.data?.classes ?? []}
          onClose={close}
          onSaved={(_, message) => afterChange(message)}
        />
      )}
      <LearnerStatusDialogs dialog={dialog} mutate={mutate} onClose={close} onDone={afterChange} />
    </>
  );
};

export default LearnerDetail;
