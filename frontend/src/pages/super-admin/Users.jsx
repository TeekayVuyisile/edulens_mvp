import { useState } from 'react';
import { Button, Form, Table } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LuPencil, LuPower, LuSend, LuUserPlus, LuUsers } from 'react-icons/lu';
import { useApi, useDebouncedValue, useDocumentTitle } from '../../hooks/useApi';
import { useMutation } from '../../hooks/useMutation';
import { accountStatus, capitalize, initials, timeAgo } from '../../lib/format';
import { ROLE_LABELS } from '../../config/navigation';
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
import InviteStaffModal from './components/InviteStaffModal';
import EditUserModal from './components/EditUserModal';

const PAGE_SIZE = 20;

const Users = () => {
  useDocumentTitle('Users');
  const [status, setStatus] = useState('all');
  const [role, setRole] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search.trim());

  const { data, loading, error, reload } = useApi('/api/super-admin/users', {
    status: status === 'all' ? undefined : status,
    role: role || undefined,
    school_id: schoolId || undefined,
    search: debouncedSearch || undefined,
    page,
    limit: PAGE_SIZE,
  });
  const schoolsQuery = useApi('/api/super-admin/schools', { status: 'active', limit: 100 });
  const activeSchools = schoolsQuery.data?.schools ?? [];

  const [dialog, setDialog] = useState(null); // { type: 'invite' | 'edit' | 'status', user? }
  const [shareLink, setShareLink] = useState(null);
  const mutate = useMutation();
  const close = () => setDialog(null);

  const filtered = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  const sendLink = async (user) => {
    const result = await mutate.run('post', `/api/super-admin/users/${user.user_id}/account-link`);
    if (result.ok) setShareLink({ link: result.data, person: user });
    else toast.error(result.message);
  };

  const confirmStatus = async () => {
    const { user } = dialog;
    const result = await mutate.run('patch', `/api/super-admin/users/${user.user_id}/status`, {
      is_active: !user.is_active,
    });
    if (result.ok) {
      toast.success(result.message);
      reload();
    }
    return result;
  };

  const users = data?.users ?? [];
  const counts = data?.counts;
  const filtering = Boolean(debouncedSearch || role || schoolId || status !== 'all');

  return (
    <>
      <PageHeader
        title="Users"
        description="School administrators and teachers across all schools."
        actions={
          <Button onClick={() => setDialog({ type: 'invite' })} className="d-inline-flex align-items-center gap-2">
            <LuUserPlus aria-hidden="true" /> Invite staff
          </Button>
        }
      />

      <section className="el-panel" aria-label="Users">
        <div className="el-toolbar">
          <FilterTabs
            label="Filter by account status"
            value={status}
            onChange={filtered(setStatus)}
            options={[
              { value: 'all', label: 'All', count: counts?.all },
              { value: 'active', label: 'Active', count: counts?.active },
              { value: 'pending', label: 'Invite pending', count: counts?.pending },
              { value: 'inactive', label: 'Inactive', count: counts?.inactive },
            ]}
          />
        </div>
        <div className="el-toolbar">
          <SearchInput
            value={search}
            onChange={filtered(setSearch)}
            placeholder="Search by name or email"
            label="Search users"
          />
          <Form.Select
            aria-label="Filter by role"
            value={role}
            onChange={(e) => filtered(setRole)(e.target.value)}
          >
            <option value="">All roles</option>
            <option value="school_admin">School Admins</option>
            <option value="teacher">Teachers</option>
          </Form.Select>
          <Form.Select
            aria-label="Filter by school"
            value={schoolId}
            onChange={(e) => filtered(setSchoolId)(e.target.value)}
          >
            <option value="">All schools</option>
            {activeSchools.map((s) => (
              <option key={s.school_id} value={s.school_id}>
                {s.school_name}
              </option>
            ))}
          </Form.Select>
        </div>

        {error && !data ? (
          <EmptyState icon={LuUsers} title="Couldn’t load users" action={<Button onClick={reload}>Try again</Button>}>
            {error}
          </EmptyState>
        ) : (
          <div className="el-table-wrap">
            <Table className="el-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col" className="d-none d-md-table-cell">Role</th>
                  <th scope="col" className="d-none d-md-table-cell">School</th>
                  <th scope="col" className="d-none d-sm-table-cell">Status</th>
                  <th scope="col" className="d-none d-lg-table-cell">Last signed in</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              {loading && !data ? (
                <TableSkeleton rows={6} columns={6} />
              ) : (
                <tbody>
                  {users.map((user) => {
                    const accountState = accountStatus(user);
                    return (
                      <tr key={user.user_id}>
                        <td>
                          <div className="el-person">
                            <span className="el-avatar el-avatar--sm d-none d-sm-inline-flex" aria-hidden="true">
                              {initials(user.first_name, user.last_name)}
                            </span>
                            <div className="el-person__text">
                              <div className="el-cell-primary">
                                {user.first_name} {user.last_name}
                              </div>
                              <div className="el-cell-secondary text-truncate">{user.email}</div>
                              <div className="el-cell-secondary d-md-none">
                                {ROLE_LABELS[user.role]} · {user.school_name}
                              </div>
                              <div className="d-sm-none mt-1">
                                <StatusBadge status={accountState} />
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="d-none d-md-table-cell">
                          <span className="el-chip">{ROLE_LABELS[user.role]}</span>
                        </td>
                        <td className="d-none d-md-table-cell">
                          {user.school_id ? (
                            <Link to={`/super-admin/schools/${user.school_id}`}>{user.school_name}</Link>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="d-none d-sm-table-cell">
                          <StatusBadge status={accountState} />
                        </td>
                        <td className="text-nowrap d-none d-lg-table-cell">{user.last_login ? capitalize(timeAgo(user.last_login)) : 'Never'}</td>
                        <td className="el-cell-actions">
                          <RowActions
                            label={`Actions for ${user.first_name} ${user.last_name}`}
                            items={[
                              { label: 'Edit details', icon: LuPencil, onClick: () => setDialog({ type: 'edit', user }) },
                              {
                                label: accountState === 'pending' ? 'Resend invitation' : 'Send password reset link',
                                icon: LuSend,
                                onClick: () => sendLink(user),
                                hidden: !user.is_active,
                              },
                              null,
                              {
                                label: user.is_active ? 'Deactivate' : 'Reactivate',
                                icon: LuPower,
                                danger: user.is_active,
                                onClick: () => setDialog({ type: 'status', user }),
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

        {data && users.length === 0 && (
          <EmptyState
            icon={LuUsers}
            title={filtering ? 'No users match' : 'No staff yet'}
            action={!filtering && <Button onClick={() => setDialog({ type: 'invite' })}>Invite staff</Button>}
          >
            {filtering
              ? 'Try a different search or filter.'
              : 'Invite a school administrator from a school’s page, or invite staff here.'}
          </EmptyState>
        )}

        {data && (
          <Pagination page={page} limit={PAGE_SIZE} total={data.pagination.total} onChange={setPage} noun="users" />
        )}
      </section>

      {dialog?.type === 'invite' && (
        <InviteStaffModal
          show
          schools={activeSchools}
          onClose={close}
          onInvited={({ user, invite }) => {
            close();
            setShareLink({ link: { ...invite, kind: 'invite' }, person: user });
            reload();
          }}
        />
      )}

      {dialog?.type === 'edit' && (
        <EditUserModal
          user={dialog.user}
          schools={activeSchools}
          onClose={close}
          onSaved={(message) => {
            close();
            toast.success(message);
            reload();
          }}
        />
      )}

      <ConfirmDialog
        show={dialog?.type === 'status'}
        title={
          dialog?.user &&
          `${dialog.user.is_active ? 'Deactivate' : 'Reactivate'} ${dialog.user.first_name} ${dialog.user.last_name}?`
        }
        confirmLabel={dialog?.user?.is_active ? 'Deactivate' : 'Reactivate'}
        variant={dialog?.user?.is_active ? 'danger' : 'primary'}
        onConfirm={confirmStatus}
        onClose={close}
      >
        {dialog?.user?.is_active
          ? 'They’ll be signed out straight away and won’t be able to sign in. Their classes and records stay as they are.'
          : 'They’ll be able to sign in again.'}
      </ConfirmDialog>

      <ShareLinkDialog link={shareLink?.link} person={shareLink?.person} onClose={() => setShareLink(null)} />
    </>
  );
};

export default Users;
