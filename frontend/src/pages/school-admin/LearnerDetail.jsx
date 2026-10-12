import { useState } from 'react';
import { Button } from 'react-bootstrap';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LuArrowRightLeft, LuLogOut, LuPencil, LuSchool, LuTrash2, LuUndo2 } from 'react-icons/lu';
import { useApi, useDocumentTitle } from '../../hooks/useApi';
import { useMutation } from '../../hooks/useMutation';
import { fullName, gradeLabel, isCurrentLearner, learnerStatus } from '../../lib/format';
import {
  ClassHistoryPanel,
  DetailsPanel,
  GuardianPanel,
  SubjectMarksPanel,
  SupportPanel,
} from '../../components/learners/LearnerPanels';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';
import RowActions from '../../components/ui/RowActions';
import FullPageLoader from '../../components/ui/FullPageLoader';
import LearnerFormModal from '../../components/learners/LearnerFormModal';
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
          <SubjectMarksPanel learner={learner} performance={performance} />
          <ClassHistoryPanel learner={learner} history={history} />
        </div>
        <div className="el-stack">
          <DetailsPanel learner={learner} />
          <GuardianPanel learner={learner} onEdit={() => setDialog({ type: 'edit' })} />
          <SupportPanel learner={learner} />
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
