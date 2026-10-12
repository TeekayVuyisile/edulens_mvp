import { useState } from 'react';
import { Button, Table } from 'react-bootstrap';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LuPencil, LuPower, LuSend, LuUserPlus, LuUsers } from 'react-icons/lu';
import { useApi, useDebouncedValue, useDocumentTitle } from '../../hooks/useApi';
import { useMutation } from '../../hooks/useMutation';
import { accountStatus, capitalize, initials, timeAgo } from '../../lib/format';
import './school-admin.css';
import PageHeader from '../../components/ui/PageHeader';
import FilterTabs from '../../components/ui/FilterTabs';
import SearchInput from '../../components/ui/SearchInput';
import StatusBadge from '../../components/ui/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';
import Pagination from '../../components/ui/Pagination';
import RowActions from '../../components/ui/RowActions';
import TableSkeleton from '../../components/ui/TableSkeleton';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import ShareLinkDialog from '../../components/ui/ShareLinkDialog';
import TeacherFormModal from './components/TeacherFormModal';

const PAGE_SIZE = 20;
const STATUSES = ['all', 'active', 'pending', 'inactive'];

/** Chips for the classes a teacher teaches; the class they lead is marked. */
const ClassChips = ({ classes }) =>
  classes.length === 0 ? (
    <span className="el-cell-secondary">No classes yet</span>
  ) : (
    <span className="d-flex flex-wrap gap-1">
      {classes.map((c) => (
        <Link key={c.class_id} to={`/school-admin/classes/${c.class_id}`} className="el-chip el-chip--link">
          {c.class_name}
          {c.is_primary && <span className="visually-hidden"> (class teacher)</span>}
          {c.is_primary && <span className="el-chip__mark" aria-hidden="true" title="Class teacher" />}
        </Link>
      ))}
    </span>
  );

const Teachers = () => {
  useDocumentTitle('Teachers');
  const [searchParams, setSearchParams] = useSearchParams();
  const status = STATUSES.includes(searchParams.get('status')) ? searchParams.get('status') : 'all';
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search.trim());

  const { data, loading, error, reload } = useApi('/api/school-admin/teachers', {
    status: status === 'all' ? undefined : status,
    search: debouncedSearch || undefined,
    page,
    limit: PAGE_SIZE,
  });

  const [dialog, setDialog] = useState(null); // { type: 'form' | 'status', teacher? }
  const [shareLink, setShareLink] = useState(null);
  const mutate = useMutation();
  const close = () => setDialog(null);

  const changeStatus = (value) => {
    setSearchParams(value === 'all' ? {} : { status: value }, { replace: true });
    setPage(1);
  };

  const sendLink = async (teacher) => {
    const result = await mutate.run('post', `/api/school-admin/teachers/${teacher.user_id}/account-link`);
    if (result.ok) setShareLink({ link: result.data, person: teacher });
    else toast.error(result.message);
  };

  const confirmStatus = async () => {
    const { teacher } = dialog;
    const result = await mutate.run('patch', `/api/school-admin/teachers/${teacher.user_id}/status`, {
      is_active: !teacher.is_active,
    });
    if (result.ok) {
      toast.success(result.message);
      reload();
    }
    return result;
  };

  const teachers = data?.teachers ?? [];
  const counts = data?.counts;
  const filtering = Boolean(debouncedSearch || status !== 'all');

  return (
    <>
      <PageHeader
        title="Teachers"
        description="Invite your teachers, see which classes they teach, and manage their access."
        actions={
          <Button onClick={() => setDialog({ type: 'form' })} className="d-inline-flex align-items-center gap-2">
            <LuUserPlus aria-hidden="true" /> Invite teacher
          </Button>
        }
      />

      <section className="el-panel" aria-label="Teachers">
        <div className="el-toolbar">
          <FilterTabs
            label="Filter by account status"
            value={status}
            onChange={changeStatus}
            options={[
              { value: 'all', label: 'All', count: counts?.all },
              { value: 'active', label: 'Active', count: counts?.active },
              { value: 'pending', label: 'Invite pending', count: counts?.pending },
              { value: 'inactive', label: 'Inactive', count: counts?.inactive },
            ]}
          />
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Search by name or email"
            label="Search teachers"
          />
        </div>

        {error && !data ? (
          <EmptyState icon={LuUsers} title="Couldn’t load teachers" action={<Button onClick={reload}>Try again</Button>}>
            {error}
          </EmptyState>
        ) : (
          <div className="el-table-wrap">
            <Table className="el-table">
              <thead>
                <tr>
                  <th scope="col">Teacher</th>
                  <th scope="col" className="d-none d-md-table-cell">Classes</th>
                  <th scope="col" className="d-none d-sm-table-cell">Status</th>
                  <th scope="col" className="d-none d-lg-table-cell">Last signed in</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              {loading && !data ? (
                <TableSkeleton rows={5} columns={5} />
              ) : (
                <tbody>
                  {teachers.map((teacher) => {
                    const state = accountStatus(teacher);
                    return (
                      <tr key={teacher.user_id}>
                        <td>
                          <div className="el-person">
                            <span className="el-avatar el-avatar--sm d-none d-sm-inline-flex" aria-hidden="true">
                              {initials(teacher.first_name, teacher.last_name)}
                            </span>
                            <div className="el-person__text">
                              <div className="el-cell-primary">
                                {teacher.first_name} {teacher.last_name}
                              </div>
                              <div className="el-cell-secondary text-truncate">{teacher.email}</div>
                              <div className="d-md-none mt-1">
                                <ClassChips classes={teacher.classes} />
                              </div>
                              <div className="d-sm-none mt-1">
                                <StatusBadge status={state} />
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="d-none d-md-table-cell">
                          <ClassChips classes={teacher.classes} />
                        </td>
                        <td className="d-none d-sm-table-cell">
                          <StatusBadge status={state} />
                        </td>
                        <td className="text-nowrap d-none d-lg-table-cell">
                          {teacher.last_login ? capitalize(timeAgo(teacher.last_login)) : 'Never'}
                        </td>
                        <td className="el-cell-actions">
                          <RowActions
                            label={`Actions for ${teacher.first_name} ${teacher.last_name}`}
                            items={[
                              { label: 'Edit details', icon: LuPencil, onClick: () => setDialog({ type: 'form', teacher }) },
                              {
                                label: state === 'pending' ? 'Resend invitation' : 'Send password reset link',
                                icon: LuSend,
                                onClick: () => sendLink(teacher),
                                hidden: !teacher.is_active,
                              },
                              null,
                              {
                                label: teacher.is_active ? 'Deactivate' : 'Reactivate',
                                icon: LuPower,
                                danger: teacher.is_active,
                                onClick: () => setDialog({ type: 'status', teacher }),
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              )}
            </Table>
          </div>
        )}

        {data && teachers.length === 0 && (
          <EmptyState
            icon={LuUsers}
            title={filtering ? 'No teachers match' : 'No teachers yet'}
            action={!filtering && <Button onClick={() => setDialog({ type: 'form' })}>Invite your first teacher</Button>}
          >
            {filtering
              ? 'Try a different search or filter.'
              : 'Invite teachers by email. Once they’ve signed in, give them a class.'}
          </EmptyState>
        )}

        {data && (
          <Pagination page={page} limit={PAGE_SIZE} total={data.pagination.total} onChange={setPage} noun="teachers" />
        )}
      </section>

      {dialog?.type === 'form' && (
        <TeacherFormModal
          teacher={dialog.teacher}
          onClose={close}
          onSaved={(saved, message) => {
            close();
            if (saved.invite) setShareLink({ link: { ...saved.invite, kind: 'invite' }, person: saved.teacher });
            else toast.success(message);
            reload();
          }}
        />
      )}

      <ConfirmDialog
        show={dialog?.type === 'status'}
        title={
          dialog?.teacher &&
          `${dialog.teacher.is_active ? 'Deactivate' : 'Reactivate'} ${dialog.teacher.first_name} ${dialog.teacher.last_name}?`
        }
        confirmLabel={dialog?.teacher?.is_active ? 'Deactivate' : 'Reactivate'}
        variant={dialog?.teacher?.is_active ? 'danger' : 'primary'}
        onConfirm={confirmStatus}
        onClose={close}
      >
        {dialog?.teacher?.is_active
          ? 'They won’t be able to sign in. Their classes and the marks they recorded are kept, so you can reactivate them later.'
          : 'They’ll be able to sign in again and see their classes.'}
      </ConfirmDialog>

      <ShareLinkDialog link={shareLink?.link} person={shareLink?.person} onClose={() => setShareLink(null)} />
    </>
  );
};

export default Teachers;
