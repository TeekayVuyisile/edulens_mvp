import { useState } from 'react';
import { Button, Form, Table } from 'react-bootstrap';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  LuArrowRightLeft,
  LuEye,
  LuFileUp,
  LuLogOut,
  LuPencil,
  LuSchool,
  LuTrash2,
  LuUndo2,
  LuUserPlus,
} from 'react-icons/lu';
import { useApi, useDebouncedValue, useDocumentTitle } from '../../hooks/useApi';
import { useMutation } from '../../hooks/useMutation';
import { ageFrom, CLASS_GRADES, fullName, gradeLabel, isCurrentLearner, learnerStatus } from '../../lib/format';
import './school-admin.css';
import PageHeader from '../../components/ui/PageHeader';
import FilterTabs from '../../components/ui/FilterTabs';
import SearchInput from '../../components/ui/SearchInput';
import StatusBadge from '../../components/ui/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';
import Pagination from '../../components/ui/Pagination';
import RowActions from '../../components/ui/RowActions';
import TableSkeleton from '../../components/ui/TableSkeleton';
import LearnerFormModal from './components/LearnerFormModal';
import MoveLearnerModal from './components/MoveLearnerModal';
import ImportLearnersModal from './components/ImportLearnersModal';
import LearnerStatusDialogs from './components/LearnerStatusDialogs';

const PAGE_SIZE = 25;
const STATUSES = ['current', 'unplaced', 'left', 'all'];

const Learners = () => {
  useDocumentTitle('Learners');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const status = STATUSES.includes(searchParams.get('status')) ? searchParams.get('status') : 'current';
  const [grade, setGrade] = useState('');
  const [classId, setClassId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search.trim());

  const { data, loading, error, reload } = useApi('/api/school-admin/learners', {
    status,
    grade: grade || undefined,
    class_id: classId || undefined,
    search: debouncedSearch || undefined,
    page,
    limit: PAGE_SIZE,
  });
  const classesQuery = useApi('/api/school-admin/classes');
  const classes = classesQuery.data?.classes ?? [];

  const [dialog, setDialog] = useState(null); // { type: 'add' | 'edit' | 'move' | 'import' | 'leave' | 'return' | 'delete', learner? }
  const mutate = useMutation();
  const close = () => setDialog(null);

  const filtered = (setter) => (value) => {
    setter(value);
    setPage(1);
  };
  const changeStatus = (value) => {
    setSearchParams(value === 'current' ? {} : { status: value }, { replace: true });
    setPage(1);
  };

  const afterChange = (message) => {
    close();
    toast.success(message);
    reload();
    classesQuery.reload();
  };

  const learners = data?.learners ?? [];
  const counts = data?.counts;
  const filtering = Boolean(debouncedSearch || grade || classId || status !== 'current');

  return (
    <>
      <PageHeader
        title="Learners"
        description="Your school’s register. Learners don’t sign in; their teachers and guardians see their progress."
        actions={
          <>
            <Button
              variant="light"
              onClick={() => setDialog({ type: 'import' })}
              className="d-inline-flex align-items-center gap-2"
            >
              <LuFileUp aria-hidden="true" /> Import
            </Button>
            <Button onClick={() => setDialog({ type: 'add' })} className="d-inline-flex align-items-center gap-2">
              <LuUserPlus aria-hidden="true" /> Add learner
            </Button>
          </>
        }
      />

      <section className="el-panel" aria-label="Learners">
        <div className="el-toolbar">
          <FilterTabs
            label="Filter learners"
            value={status}
            onChange={changeStatus}
            options={[
              { value: 'current', label: 'At school', count: counts?.current },
              { value: 'unplaced', label: 'Not in a class', count: counts?.unplaced },
              { value: 'left', label: 'Left', count: counts?.left },
              { value: 'all', label: 'All', count: counts?.all },
            ]}
          />
        </div>
        <div className="el-toolbar">
          <SearchInput
            value={search}
            onChange={filtered(setSearch)}
            placeholder="Search name, number or guardian"
            label="Search learners"
          />
          <Form.Select aria-label="Filter by grade" value={grade} onChange={(e) => filtered(setGrade)(e.target.value)}>
            <option value="">All grades</option>
            {CLASS_GRADES.map((g) => (
              <option key={g} value={g}>
                {gradeLabel(g)}
              </option>
            ))}
          </Form.Select>
          <Form.Select aria-label="Filter by class" value={classId} onChange={(e) => filtered(setClassId)(e.target.value)}>
            <option value="">All classes</option>
            {classes
              .filter((c) => !grade || c.grade_level === grade)
              .map((c) => (
                <option key={c.class_id} value={c.class_id}>
                  {c.class_name}
                </option>
              ))}
          </Form.Select>
        </div>

        {error && !data ? (
          <EmptyState icon={LuSchool} title="Couldn’t load learners" action={<Button onClick={reload}>Try again</Button>}>
            {error}
          </EmptyState>
        ) : (
          <div className="el-table-wrap">
            <Table className="el-table">
              <thead>
                <tr>
                  <th scope="col">Learner</th>
                  <th scope="col" className="d-none d-md-table-cell">Class</th>
                  <th scope="col" className="d-none d-lg-table-cell">Age</th>
                  <th scope="col" className="d-none d-lg-table-cell">Guardian</th>
                  <th scope="col" className="d-none d-sm-table-cell">Status</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              {loading && !data ? (
                <TableSkeleton rows={8} columns={6} />
              ) : (
                <tbody>
                  {learners.map((learner) => {
                    const state = learnerStatus(learner);
                    const current = isCurrentLearner(learner);
                    const open = () => navigate(`/school-admin/learners/${learner.learner_id}`);
                    return (
                      <tr key={learner.learner_id} className="is-clickable" onClick={open}>
                        <td>
                          <div className="el-cell-primary">
                            {learner.last_name}, {learner.first_name}
                          </div>
                          <div className="el-cell-secondary">
                            {learner.admission_number ? <span className="font-monospace">{learner.admission_number}</span> : 'No admission number'}
                            {learner.class_name && <span className="d-md-none"> · {learner.class_name}</span>}
                          </div>
                          {state !== 'active' && (
                            <div className="d-sm-none mt-1">
                              <StatusBadge status={state} />
                            </div>
                          )}
                        </td>
                        <td className="d-none d-md-table-cell">
                          {learner.class_name ? (
                            <>
                              <div>{learner.class_name}</div>
                              <div className="el-cell-secondary">{gradeLabel(learner.grade_level)}</div>
                            </>
                          ) : (
                            <span className="el-cell-secondary">—</span>
                          )}
                        </td>
                        <td className="d-none d-lg-table-cell tabular-nums">{ageFrom(learner.date_of_birth) ?? '—'}</td>
                        <td className="d-none d-lg-table-cell">
                          {learner.guardian_name || learner.guardian_phone ? (
                            <>
                              <div>{learner.guardian_name || '—'}</div>
                              <div className="el-cell-secondary">{learner.guardian_phone}</div>
                            </>
                          ) : (
                            <span className="el-cell-secondary">Not recorded</span>
                          )}
                        </td>
                        <td className="d-none d-sm-table-cell">
                          <StatusBadge status={state} label={state === 'active' ? 'In a class' : undefined} />
                        </td>
                        <td className="el-cell-actions">
                          <RowActions
                            label={`Actions for ${fullName(learner)}`}
                            items={[
                              { label: 'View record', icon: LuEye, onClick: open },
                              { label: 'Edit details', icon: LuPencil, onClick: () => setDialog({ type: 'edit', learner }) },
                              {
                                label: learner.current_class_id ? 'Move to another class' : 'Place in a class',
                                icon: LuArrowRightLeft,
                                onClick: () => setDialog({ type: 'move', learner }),
                                hidden: !current,
                              },
                              null,
                              current
                                ? { label: 'Mark as left school', icon: LuLogOut, onClick: () => setDialog({ type: 'leave', learner }) }
                                : { label: 'Return to school', icon: LuUndo2, onClick: () => setDialog({ type: 'return', learner }) },
                              { label: 'Delete', icon: LuTrash2, danger: true, onClick: () => setDialog({ type: 'delete', learner }) },
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

        {data && learners.length === 0 && (
          <EmptyState
            icon={LuSchool}
            title={filtering ? 'No learners match' : 'No learners yet'}
            action={
              !filtering && (
                <div className="d-flex flex-wrap justify-content-center gap-2">
                  <Button variant="light" onClick={() => setDialog({ type: 'import' })}>
                    Import from a spreadsheet
                  </Button>
                  <Button onClick={() => setDialog({ type: 'add' })}>Add a learner</Button>
                </div>
              )
            }
          >
            {filtering
              ? status === 'unplaced'
                ? 'Everyone at school is in a class.'
                : 'Try a different search or filter.'
              : 'Add learners one by one, or import your class register from Excel or CSV.'}
          </EmptyState>
        )}

        {data && (
          <Pagination page={page} limit={PAGE_SIZE} total={data.pagination.total} onChange={setPage} noun="learners" />
        )}
      </section>

      {(dialog?.type === 'add' || dialog?.type === 'edit') && (
        <LearnerFormModal
          learner={dialog.learner}
          classes={classes}
          onClose={close}
          onSaved={(_, message) => afterChange(message)}
        />
      )}
      {dialog?.type === 'move' && (
        <MoveLearnerModal learner={dialog.learner} classes={classes} onClose={close} onSaved={(_, message) => afterChange(message)} />
      )}
      {dialog?.type === 'import' && <ImportLearnersModal onClose={close} onImported={afterChange} />}

      <LearnerStatusDialogs dialog={dialog} mutate={mutate} onClose={close} onDone={afterChange} />
    </>
  );
};

export default Learners;
