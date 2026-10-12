import { useState } from 'react';
import { Button, Table } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  LuArrowRightLeft,
  LuClipboardList,
  LuEye,
  LuPencil,
  LuPower,
  LuStar,
  LuTrash2,
  LuUserMinus,
  LuUserPlus,
  LuUsers,
} from 'react-icons/lu';
import { useApi, useDocumentTitle } from '../../hooks/useApi';
import { useMutation } from '../../hooks/useMutation';
import { ageFrom, CAPS_LEVELS, capsLevel, fullName, gradeLabel, initials, plural } from '../../lib/format';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';
import RowActions from '../../components/ui/RowActions';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import CapacityMeter from '../../components/ui/CapacityMeter';
import FullPageLoader from '../../components/ui/FullPageLoader';
import ClassFormModal from './components/ClassFormModal';
import AssignTeacherModal from './components/AssignTeacherModal';
import AddLearnersModal from './components/AddLearnersModal';
import MoveLearnerModal from './components/MoveLearnerModal';

const ClassDetail = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useApi(`/api/school-admin/classes/${classId}`);
  useDocumentTitle(data?.class.class_name ?? 'Class');

  // { type: 'edit' | 'assign' | 'add' | 'move' | 'remove' | 'unassign' | 'status' | 'delete', learner?, teacher? }
  const [dialog, setDialog] = useState(null);
  const teachersQuery = useApi(dialog?.type === 'assign' ? '/api/school-admin/teachers' : null, { limit: 100 });
  const classesQuery = useApi(dialog?.type === 'move' ? '/api/school-admin/classes' : null);
  const mutate = useMutation();
  const close = () => setDialog(null);

  if (loading && !data) return <FullPageLoader label="Loading class…" />;
  if (error && !data) {
    return (
      <EmptyState icon={LuClipboardList} title="Couldn’t load this class" action={<Button onClick={reload}>Try again</Button>}>
        {error}
      </EmptyState>
    );
  }

  const { class: klass, learners } = data;
  const base = `/api/school-admin/classes/${klass.class_id}`;
  const full = klass.learner_count >= klass.max_capacity;

  const done = (message) => {
    close();
    toast.success(message);
    reload();
  };

  const confirm = (request, after = done) => async () => {
    const result = await request();
    if (result.ok) after(result.message);
    return result;
  };

  const makeClassTeacher = async (teacher) => {
    const result = await mutate.run('post', `${base}/teachers`, { teacher_id: teacher.user_id, is_primary: true });
    if (result.ok) done(result.message);
    else toast.error(result.message);
  };

  return (
    <>
      <PageHeader
        back={{ to: '/school-admin/classes', label: 'All classes' }}
        eyebrow={`${gradeLabel(klass.grade_level)} · ${klass.academic_year}`}
        title={
          <span className="d-inline-flex flex-wrap align-items-center gap-3">
            {klass.class_name}
            {!klass.is_active && <StatusBadge status="inactive" />}
            {klass.is_active && full && <StatusBadge status="full" />}
          </span>
        }
        actions={
          <>
            <Button variant="light" onClick={() => setDialog({ type: 'edit' })} className="d-inline-flex align-items-center gap-2">
              <LuPencil aria-hidden="true" /> Edit
            </Button>
            {klass.is_active && (
              <Button
                onClick={() => setDialog({ type: 'add' })}
                disabled={full}
                className="d-inline-flex align-items-center gap-2"
              >
                <LuUserPlus aria-hidden="true" /> Add learners
              </Button>
            )}
            <RowActions
              label={`More actions for ${klass.class_name}`}
              items={[
                {
                  label: klass.is_active ? 'Deactivate class' : 'Reactivate class',
                  icon: LuPower,
                  onClick: () => setDialog({ type: 'status' }),
                },
                null,
                { label: 'Delete class', icon: LuTrash2, danger: true, onClick: () => setDialog({ type: 'delete' }) },
              ]}
            />
          </>
        }
      />

      <div className="el-split">
        <section className="el-panel" aria-labelledby="learners-heading">
          <div className="el-panel__header">
            <div>
              <h2 id="learners-heading" className="el-panel__title">
                Learners
              </h2>
              <p className="el-panel__subtitle">{plural(learners.length, 'learner')} in this class.</p>
            </div>
          </div>
          {learners.length === 0 ? (
            <EmptyState
              compact
              icon={LuUsers}
              title="No learners yet"
              action={
                klass.is_active && (
                  <Button size="sm" onClick={() => setDialog({ type: 'add' })}>
                    Add learners
                  </Button>
                )
              }
            >
              Add learners who aren’t in a class yet, or move them from another class.
            </EmptyState>
          ) : (
            <div className="el-table-wrap">
              <Table className="el-table">
                <thead>
                  <tr>
                    <th scope="col">Learner</th>
                    <th scope="col" className="d-none d-sm-table-cell">Age</th>
                    <th scope="col" className="d-none d-lg-table-cell">Guardian</th>
                    <th scope="col" className="text-end">Average</th>
                    <th scope="col">
                      <span className="visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {learners.map((learner) => {
                    const open = () => navigate(`/school-admin/learners/${learner.learner_id}`);
                    return (
                      <tr key={learner.learner_id} className="is-clickable" onClick={open}>
                        <td>
                          <div className="el-cell-primary">
                            {learner.last_name}, {learner.first_name}
                            {learner.has_special_needs && (
                              <span className="el-support-dot" title="Needs learning support">
                                <span className="visually-hidden"> (needs learning support)</span>
                              </span>
                            )}
                          </div>
                          {learner.admission_number && (
                            <div className="el-cell-secondary font-monospace">{learner.admission_number}</div>
                          )}
                        </td>
                        <td className="d-none d-sm-table-cell tabular-nums">{ageFrom(learner.date_of_birth) ?? '—'}</td>
                        <td className="d-none d-lg-table-cell">
                          <div>{learner.guardian_name || '—'}</div>
                          {learner.guardian_phone && <div className="el-cell-secondary">{learner.guardian_phone}</div>}
                        </td>
                        <td className="text-end text-nowrap">
                          {learner.average === null ? (
                            <span className="el-cell-secondary">No marks</span>
                          ) : (
                            <span title={CAPS_LEVELS[capsLevel(learner.average)]}>
                              <span className="tabular-nums fw-semibold">{learner.average}%</span>
                              <span className="el-cell-secondary d-none d-md-inline"> · L{capsLevel(learner.average)}</span>
                            </span>
                          )}
                        </td>
                        <td className="el-cell-actions">
                          <RowActions
                            label={`Actions for ${fullName(learner)}`}
                            items={[
                              { label: 'View record', icon: LuEye, onClick: open },
                              {
                                label: 'Move to another class',
                                icon: LuArrowRightLeft,
                                onClick: () => setDialog({ type: 'move', learner: { ...learner, current_class_id: klass.class_id } }),
                              },
                              null,
                              { label: 'Take out of class', icon: LuUserMinus, danger: true, onClick: () => setDialog({ type: 'remove', learner }) },
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          )}
        </section>

        <div className="el-stack">
          <section className="el-panel" aria-labelledby="teachers-heading">
            <div className="el-panel__header">
              <div>
                <h2 id="teachers-heading" className="el-panel__title">
                  Teachers
                </h2>
                <p className="el-panel__subtitle">They see these learners and record their marks.</p>
              </div>
              {klass.is_active && (
                <Button size="sm" onClick={() => setDialog({ type: 'assign' })} className="d-inline-flex align-items-center gap-2">
                  <LuUserPlus aria-hidden="true" /> Assign
                </Button>
              )}
            </div>
            {klass.teachers.length === 0 ? (
              <EmptyState
                compact
                icon={LuUsers}
                title="No teacher yet"
                action={
                  klass.is_active && (
                    <Button size="sm" onClick={() => setDialog({ type: 'assign' })}>
                      Assign a class teacher
                    </Button>
                  )
                }
              >
                A class needs a teacher before marks can be recorded.
              </EmptyState>
            ) : (
              <ul className="el-list">
                {klass.teachers.map((teacher) => (
                  <li key={teacher.user_id}>
                    <div className="el-person">
                      <span className="el-avatar el-avatar--sm" aria-hidden="true">
                        {initials(teacher.first_name, teacher.last_name)}
                      </span>
                      <div className="el-person__text">
                        <div className="el-cell-primary">
                          {teacher.first_name} {teacher.last_name}
                        </div>
                        <div className="el-cell-secondary">
                          {teacher.is_primary ? 'Class teacher' : 'Support teacher'}
                          {!teacher.is_active && ' · deactivated'}
                        </div>
                      </div>
                    </div>
                    <RowActions
                      label={`Actions for ${teacher.first_name} ${teacher.last_name}`}
                      items={[
                        {
                          label: 'Make class teacher',
                          icon: LuStar,
                          onClick: () => makeClassTeacher(teacher),
                          hidden: teacher.is_primary || !teacher.is_active,
                        },
                        { label: 'Remove from class', icon: LuUserMinus, danger: true, onClick: () => setDialog({ type: 'unassign', teacher }) },
                      ]}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="el-panel" aria-labelledby="capacity-heading">
            <div className="el-panel__header">
              <h2 id="capacity-heading" className="el-panel__title">
                Places
              </h2>
              <Button size="sm" variant="light" onClick={() => setDialog({ type: 'edit' })}>
                Change
              </Button>
            </div>
            <div className="el-panel__body">
              <CapacityMeter count={klass.learner_count} capacity={klass.max_capacity} />
            </div>
          </section>
        </div>
      </div>

      {dialog?.type === 'edit' && (
        <ClassFormModal klass={klass} onClose={close} onSaved={(_, message) => done(message)} />
      )}
      {dialog?.type === 'assign' && teachersQuery.data && (
        <AssignTeacherModal
          klass={klass}
          teachers={teachersQuery.data.teachers.filter((t) => t.is_active)}
          onClose={close}
          onSaved={done}
        />
      )}
      {dialog?.type === 'add' && <AddLearnersModal klass={klass} onClose={close} onSaved={done} />}
      {dialog?.type === 'move' && classesQuery.data && (
        <MoveLearnerModal
          learner={dialog.learner}
          classes={classesQuery.data.classes}
          onClose={close}
          onSaved={(_, message) => done(message)}
        />
      )}

      <ConfirmDialog
        show={dialog?.type === 'remove'}
        title={dialog?.learner && `Take ${fullName(dialog.learner)} out of ${klass.class_name}?`}
        confirmLabel="Take out of class"
        onConfirm={confirm(() => mutate.run('delete', `${base}/learners/${dialog.learner.learner_id}`))}
        onClose={close}
      >
        They stay on the register without a class, and keep their marks. Place them in another class from the Learners
        page.
      </ConfirmDialog>

      <ConfirmDialog
        show={dialog?.type === 'unassign'}
        title={dialog?.teacher && `Remove ${dialog.teacher.first_name} ${dialog.teacher.last_name} from ${klass.class_name}?`}
        confirmLabel="Remove"
        onConfirm={confirm(() => mutate.run('delete', `${base}/teachers/${dialog.teacher.user_id}`))}
        onClose={close}
      >
        They’ll no longer see this class. Marks they already recorded are kept.
      </ConfirmDialog>

      <ConfirmDialog
        show={dialog?.type === 'status'}
        title={`${klass.is_active ? 'Deactivate' : 'Reactivate'} ${klass.class_name}?`}
        confirmLabel={klass.is_active ? 'Deactivate' : 'Reactivate'}
        variant={klass.is_active ? 'danger' : 'primary'}
        onConfirm={confirm(() => mutate.run('patch', `${base}/status`, { is_active: !klass.is_active }))}
        onClose={close}
      >
        {klass.is_active
          ? 'Inactive classes are hidden from teachers and from new placements. A class must be empty first.'
          : 'The class becomes available for learners and teachers again.'}
      </ConfirmDialog>

      <ConfirmDialog
        show={dialog?.type === 'delete'}
        title={`Delete ${klass.class_name}?`}
        confirmLabel="Delete permanently"
        onConfirm={confirm(
          () => mutate.run('delete', base),
          (message) => {
            toast.success(message);
            navigate('/school-admin/classes', { replace: true });
          }
        )}
        onClose={close}
      >
        Only delete a class created by mistake. Classes that have had learners or assessments can only be deactivated.
      </ConfirmDialog>
    </>
  );
};

export default ClassDetail;
