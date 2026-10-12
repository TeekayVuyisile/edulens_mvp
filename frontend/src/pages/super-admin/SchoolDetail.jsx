import { useState } from 'react';
import { Button } from 'react-bootstrap';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  LuBookOpen,
  LuChartColumn,
  LuClipboardList,
  LuPencil,
  LuPlus,
  LuPower,
  LuSchool,
  LuSend,
  LuTrash2,
  LuUserPlus,
  LuUsers,
} from 'react-icons/lu';
import { useApi, useDocumentTitle } from '../../hooks/useApi';
import { useMutation } from '../../hooks/useMutation';
import { accountStatus, formatDate, gradeLabel, initials, timeAgo } from '../../lib/format';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import StatusBadge from '../../components/ui/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import ShareLinkDialog from '../../components/ui/ShareLinkDialog';
import FullPageLoader from '../../components/ui/FullPageLoader';
import SchoolFormModal from './components/SchoolFormModal';
import InviteStaffModal from './components/InviteStaffModal';
import AssignCurriculumModal from './components/AssignCurriculumModal';

const SchoolDetail = () => {
  const { schoolId } = useParams();
  const { data, loading, error, reload } = useApi(`/api/super-admin/schools/${schoolId}`);
  useDocumentTitle(data?.school.school_name ?? 'School');

  const [dialog, setDialog] = useState(null); // 'edit' | 'invite' | 'assign' | 'status' | { unassign }
  const [shareLink, setShareLink] = useState(null);
  const mutate = useMutation();
  const close = () => setDialog(null);

  if (loading && !data) return <FullPageLoader label="Loading school…" />;
  if (error && !data) {
    return (
      <EmptyState icon={LuSchool} title="Couldn’t load this school" action={<Button onClick={reload}>Try again</Button>}>
        {error}
      </EmptyState>
    );
  }

  const { school, admins, curricula, stats } = data;

  const sendLink = async (admin) => {
    const result = await mutate.run('post', `/api/super-admin/users/${admin.user_id}/account-link`);
    if (result.ok) setShareLink({ link: result.data, person: admin });
    else toast.error(result.message);
  };

  const toggleStatus = async () => {
    const result = await mutate.run('patch', `/api/super-admin/schools/${school.school_id}/status`, {
      is_active: !school.is_active,
    });
    if (result.ok) {
      toast.success(result.message);
      reload();
    }
    return result;
  };

  const unassign = async () => {
    const result = await mutate.run(
      'delete',
      `/api/super-admin/schools/${school.school_id}/curricula/${dialog.unassign.assignment_id}`
    );
    if (result.ok) {
      toast.success(result.message);
      reload();
    }
    return result;
  };

  return (
    <>
      <PageHeader
        back={{ to: '/super-admin/schools', label: 'All schools' }}
        eyebrow={<span className="font-monospace">{school.school_code}</span>}
        title={
          <span className="d-inline-flex flex-wrap align-items-center gap-3">
            {school.school_name}
            <StatusBadge status={school.is_active ? 'active' : 'inactive'} />
          </span>
        }
        description={[school.city, school.province].filter(Boolean).join(', ') || undefined}
        actions={
          <>
            <Button variant="light" onClick={() => setDialog('edit')} className="d-inline-flex align-items-center gap-2">
              <LuPencil aria-hidden="true" /> Edit
            </Button>
            <Button
              variant={school.is_active ? 'outline-danger' : 'primary'}
              onClick={() => setDialog('status')}
              className="d-inline-flex align-items-center gap-2"
            >
              <LuPower aria-hidden="true" /> {school.is_active ? 'Deactivate' : 'Reactivate'}
            </Button>
          </>
        }
      />

      <div className="el-stat-grid">
        <StatCard label="Teachers" value={school.teacher_count} icon={LuUsers} />
        <StatCard label="Learners" value={school.learner_count} icon={LuSchool} tone="success" />
        <StatCard label="Classes" value={school.class_count} icon={LuClipboardList} tone="neutral" />
        <StatCard
          label="Average mark this year"
          value={stats.averageScore === null ? '—' : `${stats.averageScore}%`}
          hint={`${stats.assessmentsThisYear} assessments`}
          icon={LuChartColumn}
          tone="warning"
        />
      </div>

      <div className="el-split">
        <div className="el-stack">
          <section className="el-panel" aria-labelledby="admins-heading">
            <div className="el-panel__header">
              <div>
                <h2 id="admins-heading" className="el-panel__title">
                  School administrators
                </h2>
                <p className="el-panel__subtitle">They manage teachers, classes and learners for this school.</p>
              </div>
              {school.is_active && (
                <Button size="sm" onClick={() => setDialog('invite')} className="d-inline-flex align-items-center gap-2">
                  <LuUserPlus aria-hidden="true" /> Invite
                </Button>
              )}
            </div>
            {admins.length === 0 ? (
              <EmptyState
                compact
                icon={LuUserPlus}
                title="No administrator yet"
                action={
                  school.is_active && (
                    <Button size="sm" onClick={() => setDialog('invite')}>
                      Invite an administrator
                    </Button>
                  )
                }
              >
                The school can’t be set up until someone runs it.
              </EmptyState>
            ) : (
              <ul className="el-list">
                {admins.map((admin) => {
                  const status = accountStatus(admin);
                  return (
                    <li key={admin.user_id}>
                      <div className="el-person">
                        <span className="el-avatar el-avatar--sm" aria-hidden="true">
                          {initials(admin.first_name, admin.last_name)}
                        </span>
                        <div className="el-person__text">
                          <div className="el-cell-primary">
                            {admin.first_name} {admin.last_name}
                          </div>
                          <div className="el-cell-secondary text-truncate">
                            {admin.email}
                            {status === 'active' && ` · Last signed in ${timeAgo(admin.last_login)}`}
                          </div>
                        </div>
                      </div>
                      <div className="d-flex align-items-center gap-2 flex-shrink-0">
                        <StatusBadge status={status} />
                        {admin.is_active && (
                          <Button
                            size="sm"
                            variant="light"
                            onClick={() => sendLink(admin)}
                            disabled={mutate.pending}
                            className="d-inline-flex align-items-center gap-1"
                            aria-label={`${status === 'pending' ? 'Resend invitation to' : 'Send password reset link to'} ${admin.first_name}`}
                          >
                            <LuSend aria-hidden="true" />
                            <span className="d-none d-md-inline">{status === 'pending' ? 'Resend invite' : 'Reset link'}</span>
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="el-panel" aria-labelledby="curricula-heading">
            <div className="el-panel__header">
              <div>
                <h2 id="curricula-heading" className="el-panel__title">
                  Curricula
                </h2>
                <p className="el-panel__subtitle">What this school teaches, per grade and year.</p>
              </div>
              <Button size="sm" onClick={() => setDialog('assign')} className="d-inline-flex align-items-center gap-2">
                <LuPlus aria-hidden="true" /> Assign
              </Button>
            </div>
            {curricula.length === 0 ? (
              <EmptyState compact icon={LuBookOpen} title="No curriculum assigned">
                Teachers pick subjects and topics from the school’s curricula when they create assessments.
              </EmptyState>
            ) : (
              <ul className="el-list">
                {curricula.map((a) => (
                  <li key={a.assignment_id}>
                    <div>
                      <div className="el-cell-primary">{a.curriculum_name}</div>
                      <div className="el-cell-secondary">
                        {gradeLabel(a.grade_level)} · {a.academic_year}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="light"
                      className="text-danger"
                      onClick={() => setDialog({ unassign: a })}
                      aria-label={`Remove ${a.curriculum_name} for ${gradeLabel(a.grade_level)} ${a.academic_year}`}
                    >
                      <LuTrash2 aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="el-panel" aria-labelledby="contact-heading">
          <div className="el-panel__header">
            <h2 id="contact-heading" className="el-panel__title">
              Contact details
            </h2>
          </div>
          <div className="el-panel__body">
            <dl className="el-details">
              <dt>Email</dt>
              <dd>
                <a href={`mailto:${school.contact_email}`}>{school.contact_email}</a>
              </dd>
              <dt>Phone</dt>
              <dd>{school.contact_phone ? <a href={`tel:${school.contact_phone}`}>{school.contact_phone}</a> : '—'}</dd>
              <dt>Address</dt>
              <dd>{[school.address, school.city, school.province, school.country].filter(Boolean).join(', ') || '—'}</dd>
              <dt>Added</dt>
              <dd>{formatDate(school.created_at)}</dd>
            </dl>
          </div>
        </section>
      </div>

      {dialog === 'edit' && (
        <SchoolFormModal
          show
          school={school}
          onClose={close}
          onSaved={(_, message) => {
            close();
            toast.success(message);
            reload();
          }}
        />
      )}
      {dialog === 'invite' && (
        <InviteStaffModal
          show
          school={school}
          onClose={close}
          onInvited={({ user, invite }) => {
            close();
            setShareLink({ link: { ...invite, kind: 'invite' }, person: user });
            reload();
          }}
        />
      )}
      {dialog === 'assign' && (
        <AssignCurriculumModal
          show
          school={school}
          onClose={close}
          onAssigned={(message) => {
            close();
            toast.success(message);
            reload();
          }}
        />
      )}

      <ConfirmDialog
        show={dialog === 'status'}
        title={school.is_active ? `Deactivate ${school.school_name}?` : `Reactivate ${school.school_name}?`}
        confirmLabel={school.is_active ? 'Deactivate' : 'Reactivate'}
        variant={school.is_active ? 'danger' : 'primary'}
        onConfirm={toggleStatus}
        onClose={close}
      >
        {school.is_active
          ? 'Its administrators and teachers won’t be able to sign in until you reactivate it. No data is deleted.'
          : 'Its staff will be able to sign in again.'}
      </ConfirmDialog>

      <ConfirmDialog
        show={Boolean(dialog?.unassign)}
        title="Remove this curriculum?"
        confirmLabel="Remove"
        onConfirm={unassign}
        onClose={close}
      >
        {dialog?.unassign &&
          `${dialog.unassign.curriculum_name} will no longer be available to ${gradeLabel(dialog.unassign.grade_level)} in ${dialog.unassign.academic_year}. Existing assessments are kept.`}
      </ConfirmDialog>

      <ShareLinkDialog link={shareLink?.link} person={shareLink?.person} onClose={() => setShareLink(null)} />
    </>
  );
};

export default SchoolDetail;
