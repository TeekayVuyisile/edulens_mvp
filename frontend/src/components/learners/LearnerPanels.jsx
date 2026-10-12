import { Button } from 'react-bootstrap';
import { LuChartColumn, LuHistory, LuMail, LuMessageCircle, LuPhone } from 'react-icons/lu';
import { ageFrom, CAPS_LEVELS, capsLevel, formatDate, gradeLabel, whatsappLink } from '../../lib/format';
import EmptyState from '../ui/EmptyState';
import StatusBadge from '../ui/StatusBadge';

// Panels for a learner's record, shared by the School Admin and Teacher pages.

const Panel = ({ id, title, subtitle, badge, children }) => (
  <section className="el-panel" aria-labelledby={id}>
    <div className="el-panel__header">
      <div>
        <h2 id={id} className="el-panel__title">
          {title}
        </h2>
        {subtitle && <p className="el-panel__subtitle">{subtitle}</p>}
      </div>
      {badge}
    </div>
    {children}
  </section>
);

export const LevelPill = ({ percentage }) => {
  const level = capsLevel(percentage);
  return (
    <span className={`el-level el-level--${level}`} title={CAPS_LEVELS[level]}>
      Level {level}
    </span>
  );
};

export const SubjectMarksPanel = ({ learner, performance }) => (
  <Panel id="marks-heading" title="Marks by subject" subtitle="Average of all marked assessments, with the CAPS achievement level.">
    {performance.length === 0 ? (
      <EmptyState compact icon={LuChartColumn} title="No marks yet">
        Marks appear here once {learner.first_name}’s teacher records an assessment.
      </EmptyState>
    ) : (
      <ul className="el-list">
        {performance.map((subject) => (
          <li key={subject.subject_name}>
            <div className="min-w-0">
              <div className="el-cell-primary">{subject.subject_name}</div>
              <div className="el-cell-secondary">
                {subject.assessments} assessment{subject.assessments === 1 ? '' : 's'}
              </div>
            </div>
            <div className="d-flex align-items-center gap-3">
              <LevelPill percentage={subject.average} />
              <span className="el-cell-primary tabular-nums el-percent">{subject.average}%</span>
            </div>
          </li>
        ))}
      </ul>
    )}
  </Panel>
);

export const ClassHistoryPanel = ({ learner, history }) => (
  <Panel id="history-heading" title="Class history" subtitle={`Every class ${learner.first_name} has been in.`}>
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
  </Panel>
);

export const DetailsPanel = ({ learner }) => {
  const age = ageFrom(learner.date_of_birth);
  return (
    <Panel id="details-heading" title="Details">
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
    </Panel>
  );
};

export const GuardianPanel = ({ learner, onEdit }) => {
  const whatsapp = whatsappLink(learner.guardian_phone);
  const hasContact = learner.guardian_name || learner.guardian_phone || learner.guardian_email;
  return (
    <Panel id="guardian-heading" title="Parent or guardian">
      <div className="el-panel__body">
        {hasContact ? (
          <>
            <p className="el-cell-primary mb-2">{learner.guardian_name || 'Name not recorded'}</p>
            <div className="d-flex flex-wrap gap-2">
              {learner.guardian_phone && (
                <Button as="a" href={`tel:${learner.guardian_phone}`} size="sm" variant="light" className="d-inline-flex align-items-center gap-2">
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
            {onEdit && (
              <Button variant="link" className="p-0 align-baseline" onClick={onEdit}>
                Add them
              </Button>
            )}
          </p>
        )}
      </div>
    </Panel>
  );
};

export const SupportPanel = ({ learner }) => (
  <Panel
    id="support-heading"
    title="Support and health"
    badge={learner.has_special_needs && <StatusBadge status="attention" label="Needs support" />}
  >
    <div className="el-panel__body">
      <dl className="el-details">
        <dt>Learning support</dt>
        <dd>{learner.has_special_needs ? learner.special_needs_notes || 'Yes (no notes)' : 'None recorded'}</dd>
        <dt>Medical</dt>
        <dd>{learner.medical_notes || 'None recorded'}</dd>
      </dl>
    </div>
  </Panel>
);
