import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { fullName } from '../../../lib/format';

/**
 * Confirmations for "left school", "return to school" and "delete".
 * dialog: { type: 'leave' | 'return' | 'delete', learner } (other types are ignored)
 * onDone(message, type) runs after the change succeeds.
 */
const LearnerStatusDialogs = ({ dialog, mutate, onClose, onDone }) => {
  const learner = dialog?.learner;
  const name = fullName(learner);
  const url = learner && `/api/school-admin/learners/${learner.learner_id}`;

  const run = (type, request) => async () => {
    const result = await request();
    if (result.ok) onDone(result.message, type);
    return result;
  };

  return (
    <>
      <ConfirmDialog
        show={dialog?.type === 'leave'}
        title={`Has ${name} left the school?`}
        confirmLabel="Mark as left"
        onConfirm={run('leave', () => mutate.run('patch', `${url}/status`, { academic_status: 'inactive' }))}
        onClose={onClose}
      >
        They’ll be taken out of their class and moved to the “Left” list. Their record and marks are kept, and you can
        bring them back if they return.
      </ConfirmDialog>

      <ConfirmDialog
        show={dialog?.type === 'return'}
        title={`Bring ${name} back to school?`}
        confirmLabel="Return to school"
        variant="primary"
        onConfirm={run('return', () => mutate.run('patch', `${url}/status`, { academic_status: 'active' }))}
        onClose={onClose}
      >
        They’ll be back on the register, without a class. Place them in a class next.
      </ConfirmDialog>

      <ConfirmDialog
        show={dialog?.type === 'delete'}
        title={`Delete ${name}?`}
        confirmLabel="Delete permanently"
        onConfirm={run('delete', () => mutate.run('delete', url))}
        onClose={onClose}
      >
        Only delete learners added by mistake. Learners with marks can’t be deleted; mark them as having left instead.
      </ConfirmDialog>
    </>
  );
};

export default LearnerStatusDialogs;
