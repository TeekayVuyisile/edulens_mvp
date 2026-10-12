import { useState } from 'react';
import { Button, Table } from 'react-bootstrap';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LuClipboardList, LuPencil, LuSchool } from 'react-icons/lu';
import { useApi, useDocumentTitle } from '../../hooks/useApi';
import { formatDate, formatMarks, fullName, gradeLabel } from '../../lib/format';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import FullPageLoader from '../../components/ui/FullPageLoader';
import LearnerFormModal from '../../components/learners/LearnerFormModal';
import {
  ClassHistoryPanel,
  DetailsPanel,
  GuardianPanel,
  LevelPill,
  SubjectMarksPanel,
  SupportPanel,
} from '../../components/learners/LearnerPanels';

const LearnerProfile = () => {
  const { learnerId } = useParams();
  const { data, loading, error, reload } = useApi(`/api/teacher/learners/${learnerId}`);
  useDocumentTitle(data ? fullName(data.learner) : 'Learner');
  const [editing, setEditing] = useState(false);

  if (loading && !data) return <FullPageLoader label="Loading learner…" />;
  if (error && !data) {
    return (
      <EmptyState icon={LuSchool} title="Couldn’t load this learner" action={<Button onClick={reload}>Try again</Button>}>
        {error}
      </EmptyState>
    );
  }

  const { learner, history, performance, marks } = data;

  return (
    <>
      <PageHeader
        back={learner.current_class_id && { to: `/teacher/classes/${learner.current_class_id}`, label: learner.class_name }}
        eyebrow={learner.admission_number && <span className="font-monospace">{learner.admission_number}</span>}
        title={fullName(learner)}
        description={learner.class_name && `${learner.class_name} · ${gradeLabel(learner.grade_level)} · ${learner.academic_year}`}
        actions={
          <Button variant="light" onClick={() => setEditing(true)} className="d-inline-flex align-items-center gap-2">
            <LuPencil aria-hidden="true" /> Edit details
          </Button>
        }
      />

      <div className="el-split">
        <div className="el-stack">
          <SubjectMarksPanel learner={learner} performance={performance} />

          <section className="el-panel" aria-labelledby="all-marks-heading">
            <div className="el-panel__header">
              <div>
                <h2 id="all-marks-heading" className="el-panel__title">
                  All marks
                </h2>
                <p className="el-panel__subtitle">Newest first, with your comments.</p>
              </div>
            </div>
            {marks.length === 0 ? (
              <EmptyState compact icon={LuClipboardList} title="No marks yet" />
            ) : (
              <div className="el-table-wrap">
                <Table className="el-table">
                  <thead>
                    <tr>
                      <th scope="col">Assessment</th>
                      <th scope="col" className="text-end d-none d-sm-table-cell">Mark</th>
                      <th scope="col" className="text-end">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marks.map((m) => (
                      <tr key={m.assessment_id}>
                        <td>
                          <Link to={`/teacher/assessments/${m.assessment_id}`} className="el-cell-primary">
                            {m.assessment_name}
                          </Link>
                          <div className="el-cell-secondary">
                            {[m.subject_name, `Term ${m.term_number}`, m.scheduled_date && formatDate(m.scheduled_date)]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                          {m.teacher_feedback && <div className="el-mark-comment">“{m.teacher_feedback}”</div>}
                        </td>
                        <td className="text-end tabular-nums d-none d-sm-table-cell text-nowrap">
                          {formatMarks(m.marks_obtained)} / {formatMarks(m.total_marks)}
                        </td>
                        <td className="text-end text-nowrap">
                          <span className="tabular-nums fw-semibold me-2">{Math.round(m.percentage)}%</span>
                          <LevelPill percentage={m.percentage} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </section>

          <ClassHistoryPanel learner={learner} history={history} />
        </div>

        <div className="el-stack">
          <GuardianPanel learner={learner} onEdit={() => setEditing(true)} />
          <SupportPanel learner={learner} />
          <DetailsPanel learner={learner} />
        </div>
      </div>

      {editing && (
        <LearnerFormModal
          learner={learner}
          apiBase="/api/teacher"
          onClose={() => setEditing(false)}
          onSaved={(_, message) => {
            setEditing(false);
            toast.success(message);
            reload();
          }}
        />
      )}
    </>
  );
};

export default LearnerProfile;
