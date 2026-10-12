import { useState } from 'react';
import { Button, Table } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LuBuilding2, LuEye, LuPencil, LuPlus, LuPower, LuTrash2, LuUserPlus } from 'react-icons/lu';
import { useApi, useDebouncedValue, useDocumentTitle } from '../../hooks/useApi';
import { useMutation } from '../../hooks/useMutation';
import { plural } from '../../lib/format';
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
import SchoolFormModal from './components/SchoolFormModal';
import InviteStaffModal from './components/InviteStaffModal';

const PAGE_SIZE = 20;

const Schools = () => {
  useDocumentTitle('Schools');
  const navigate = useNavigate();
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search.trim());

  const { data, loading, error, reload } = useApi('/api/super-admin/schools', {
    status: status === 'all' ? undefined : status,
    search: debouncedSearch || undefined,
    page,
    limit: PAGE_SIZE,
  });

  // Dialogs: { type: 'form' | 'invite' | 'status' | 'delete', school }
  const [dialog, setDialog] = useState(null);
  const [shareLink, setShareLink] = useState(null);
  const mutate = useMutation();
  const close = () => setDialog(null);

  const counts = data?.counts;
  const schools = data?.schools ?? [];

  const changeFilter = (value) => {
    setStatus(value);
    setPage(1);
  };

  const changeSearch = (value) => {
    setSearch(value);
    setPage(1);
  };

  const confirmStatus = async () => {
    const { school } = dialog;
    const result = await mutate.run('patch', `/api/super-admin/schools/${school.school_id}/status`, {
      is_active: !school.is_active,
    });
    if (result.ok) {
      toast.success(result.message);
      reload();
    }
    return result;
  };

  const confirmDelete = async () => {
    const result = await mutate.run('delete', `/api/super-admin/schools/${dialog.school.school_id}`);
    if (result.ok) {
      toast.success(result.message);
      reload();
    }
    return result;
  };

  return (
    <>
      <PageHeader
        title="Schools"
        description="Every school on Edulens, who runs it, and whether it can sign in."
        actions={
          <Button onClick={() => setDialog({ type: 'form' })} className="d-inline-flex align-items-center gap-2">
            <LuPlus aria-hidden="true" /> Add school
          </Button>
        }
      />

      <section className="el-panel" aria-label="Schools">
        <div className="el-toolbar">
          <FilterTabs
            label="Filter schools"
            value={status}
            onChange={changeFilter}
            options={[
              { value: 'all', label: 'All', count: counts?.all },
              { value: 'active', label: 'Active', count: counts?.active },
              { value: 'no_admin', label: 'No admin', count: counts?.no_admin },
              { value: 'inactive', label: 'Inactive', count: counts?.inactive },
            ]}
          />
          <SearchInput
            value={search}
            onChange={changeSearch}
            placeholder="Search by name, code or town"
            label="Search schools"
          />
        </div>

        {error && !data ? (
          <EmptyState icon={LuBuilding2} title="Couldn’t load schools" action={<Button onClick={reload}>Try again</Button>}>
            {error}
          </EmptyState>
        ) : (
          <div className="el-table-wrap">
            <Table className="el-table" hover={false}>
              <thead>
                <tr>
                  <th scope="col">School</th>
                  <th scope="col" className="d-none d-md-table-cell">Location</th>
                  <th scope="col" className="d-none d-sm-table-cell">Administrator</th>
                  <th scope="col" className="text-end d-none d-lg-table-cell">Teachers</th>
                  <th scope="col" className="text-end d-none d-lg-table-cell">Learners</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              {loading && !data ? (
                <TableSkeleton rows={6} columns={7} />
              ) : (
                <tbody>
                  {schools.map((school) => (
                    <tr
                      key={school.school_id}
                      className="is-clickable"
                      onClick={() => navigate(`/super-admin/schools/${school.school_id}`)}
                    >
                      <td>
                        <div className="el-cell-primary">{school.school_name}</div>
                        <div className="el-cell-secondary">
                          <span className="font-monospace">{school.school_code}</span>
                          {school.city && <span className="d-md-none"> · {school.city}</span>}
                        </div>
                        {school.admin_count === 0 && (
                          <div className="d-sm-none mt-1">
                            <StatusBadge status="attention" label="No admin yet" />
                          </div>
                        )}
                      </td>
                      <td className="d-none d-md-table-cell">
                        <div>{school.city || '—'}</div>
                        <div className="el-cell-secondary">{school.province}</div>
                      </td>
                      <td className="d-none d-sm-table-cell">
                        {school.admin_count > 0 ? (
                          <span>{plural(school.admin_count, 'admin')}</span>
                        ) : (
                          <StatusBadge status="attention" label="No admin yet" />
                        )}
                      </td>
                      <td className="text-end tabular-nums d-none d-lg-table-cell">{school.teacher_count}</td>
                      <td className="text-end tabular-nums d-none d-lg-table-cell">{school.learner_count}</td>
                      <td>
                        <StatusBadge status={school.is_active ? 'active' : 'inactive'} />
                      </td>
                      <td className="el-cell-actions">
                        <RowActions
                          label={`Actions for ${school.school_name}`}
                          items={[
                            {
                              label: 'View details',
                              icon: LuEye,
                              onClick: () => navigate(`/super-admin/schools/${school.school_id}`),
                            },
                            { label: 'Edit details', icon: LuPencil, onClick: () => setDialog({ type: 'form', school }) },
                            {
                              label: 'Invite administrator',
                              icon: LuUserPlus,
                              onClick: () => setDialog({ type: 'invite', school }),
                              hidden: !school.is_active,
                            },
                            null,
                            {
                              label: school.is_active ? 'Deactivate' : 'Reactivate',
                              icon: LuPower,
                              onClick: () => setDialog({ type: 'status', school }),
                            },
                            {
                              label: 'Delete',
                              icon: LuTrash2,
                              danger: true,
                              onClick: () => setDialog({ type: 'delete', school }),
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              )}
            </Table>
          </div>
        )}

        {data && schools.length === 0 && (
          <EmptyState
            icon={LuBuilding2}
            title={debouncedSearch || status !== 'all' ? 'No schools match' : 'No schools yet'}
            action={
              !debouncedSearch &&
              status === 'all' && (
                <Button onClick={() => setDialog({ type: 'form' })}>Add the first school</Button>
              )
            }
          >
            {debouncedSearch || status !== 'all'
              ? 'Try a different search or filter.'
              : 'Add a school, then invite its administrator to get it started.'}
          </EmptyState>
        )}

        {data && (
          <Pagination
            page={page}
            limit={PAGE_SIZE}
            total={data.pagination.total}
            onChange={setPage}
            noun="schools"
          />
        )}
      </section>

      {dialog?.type === 'form' && (
        <SchoolFormModal
          show
          school={dialog.school}
          onClose={close}
          onSaved={(saved, message) => {
            close();
            toast.success(message);
            if (dialog.school) reload();
            else navigate(`/super-admin/schools/${saved.school_id}`);
          }}
        />
      )}

      {dialog?.type === 'invite' && (
        <InviteStaffModal
          show
          school={dialog.school}
          onClose={close}
          onInvited={({ user, invite }) => {
            close();
            setShareLink({ link: { ...invite, kind: 'invite' }, person: user });
            reload();
          }}
        />
      )}

      <ConfirmDialog
        show={dialog?.type === 'status'}
        title={dialog?.school?.is_active ? `Deactivate ${dialog?.school?.school_name}?` : `Reactivate ${dialog?.school?.school_name}?`}
        confirmLabel={dialog?.school?.is_active ? 'Deactivate' : 'Reactivate'}
        variant={dialog?.school?.is_active ? 'danger' : 'primary'}
        onConfirm={confirmStatus}
        onClose={close}
      >
        {dialog?.school?.is_active
          ? 'Its administrators and teachers won’t be able to sign in until you reactivate it. No data is deleted.'
          : 'Its staff will be able to sign in again.'}
      </ConfirmDialog>

      <ConfirmDialog
        show={dialog?.type === 'delete'}
        title={`Delete ${dialog?.school?.school_name}?`}
        confirmLabel="Delete school"
        onConfirm={confirmDelete}
        onClose={close}
      >
        This can’t be undone. Only schools with no staff, classes or learners can be deleted; otherwise,
        deactivate the school instead.
      </ConfirmDialog>

      <ShareLinkDialog link={shareLink?.link} person={shareLink?.person} onClose={() => setShareLink(null)} />
    </>
  );
};

export default Schools;
