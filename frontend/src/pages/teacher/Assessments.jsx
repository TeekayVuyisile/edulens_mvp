import { useState } from 'react';
import { Button, Form, Table } from 'react-bootstrap';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LuClipboardCheck, LuClipboardList, LuPencil, LuPlus, LuTrash2 } from 'react-icons/lu';
import { useApi, useDebouncedValue, useDocumentTitle } from '../../hooks/useApi';
import { useMutation } from '../../hooks/useMutation';
import { ASSESSMENT_TYPES, capsLevel, formatDate, TERMS } from '../../lib/format';
import PageHeader from '../../components/ui/PageHeader';
import FilterTabs from '../../components/ui/FilterTabs';
import SearchInput from '../../components/ui/SearchInput';
import EmptyState from '../../components/ui/EmptyState';
import RowActions from '../../components/ui/RowActions';
import TableSkeleton from '../../components/ui/TableSkeleton';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import ProgressMeter from '../../components/ui/ProgressMeter';
import AssessmentFormModal from './components/AssessmentFormModal';

const STATUSES = ['all', 'to_mark', 'marked'];

const Assessments = () => {
  useDocumentTitle('Assessments');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const status = STATUSES.includes(searchParams.get('status')) ? searchParams.get('status') : 'all';
  const classId = searchParams.get('class') ?? '';
  const [term, setTerm] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim());

  const { data, loading, error, reload } = useApi('/api/teacher/assessments', {
    status: status === 'all' ? undefined : status,
    class_id: classId || undefined,
    term: term || undefined,
    search: debouncedSearch || undefined,
  });
  const classesQuery = useApi('/api/teacher/classes');
  const classes = classesQuery.data?.classes ?? [];

  const [dialog, setDialog] = useState(null); // { type: 'form' | 'delete', assessment? }
  const mutate = useMutation();
  const close = () => setDialog(null);

  const setParam = (name, value, fallback) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === fallback) next.delete(name);
    else next.set(name, value);
    setSearchParams(next, { replace: true });
  };

  const confirmDelete = async () => {
    const result = await mutate.run('delete', `/api/teacher/assessments/${dialog.assessment.assessment_id}`);
    if (result.ok) {
      toast.success(result.message);
      reload();
    }
    return result;
  };

  const assessments = data?.assessments ?? [];
  const filtering = Boolean(debouncedSearch || classId || term || status !== 'all');

  return (
    <>
      <PageHeader
        title="Assessments"
        description="Tests, quizzes and tasks for your classes, and how far you are with marking them."
        actions={
          <Button
            onClick={() => setDialog({ type: 'form' })}
            disabled={classes.length === 0}
            className="d-inline-flex align-items-center gap-2"
          >
            <LuPlus aria-hidden="true" /> New assessment
          </Button>
        }
      />

      <section className="el-panel" aria-label="Assessments">
        <div className="el-toolbar">
          <FilterTabs
            label="Filter by marking"
            value={status}
            onChange={(value) => setParam('status', value, 'all')}
            options={[
              { value: 'all', label: 'All' },
              { value: 'to_mark', label: 'To mark' },
              { value: 'marked', label: 'Marked' },
            ]}
          />
        </div>
        <div className="el-toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name or subject" label="Search assessments" />
          <Form.Select aria-label="Class" value={classId} onChange={(e) => setParam('class', e.target.value)}>
            <option value="">All my classes</option>
            {classes.map((c) => (
              <option key={c.class_id} value={c.class_id}>
                {c.class_name}
              </option>
            ))}
          </Form.Select>
          <Form.Select aria-label="Term" value={term} onChange={(e) => setTerm(e.target.value)}>
            <option value="">All terms</option>
            {TERMS.map((t) => (
              <option key={t} value={t}>
                Term {t}
              </option>
            ))}
          </Form.Select>
        </div>

        {error && !data ? (
          <EmptyState icon={LuClipboardList} title="Couldn’t load assessments" action={<Button onClick={reload}>Try again</Button>}>
            {error}
          </EmptyState>
        ) : (
          <div className="el-table-wrap">
            <Table className="el-table">
              <thead>
                <tr>
                  <th scope="col">Assessment</th>
                  <th scope="col" className="d-none d-md-table-cell">Class</th>
                  <th scope="col" className="d-none d-lg-table-cell">Date</th>
                  <th scope="col" className="d-none d-sm-table-cell">Marked</th>
                  <th scope="col" className="text-end d-none d-md-table-cell">Average</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              {loading && !data ? (
                <TableSkeleton rows={6} columns={6} />
              ) : (
                <tbody>
                  {assessments.map((a) => {
                    const open = () => navigate(`/teacher/assessments/${a.assessment_id}`);
                    const done = a.learner_count > 0 && a.marked_count >= a.learner_count;
                    return (
                      <tr key={a.assessment_id} className="is-clickable" onClick={open}>
                        <td>
                          <div className="el-cell-primary">{a.assessment_name}</div>
                          <div className="el-cell-secondary">
                            {[a.subject_name, ASSESSMENT_TYPES[a.assessment_type], `Term ${a.term_number}`].filter(Boolean).join(' · ')}
                          </div>
                          <div className="el-cell-secondary d-md-none">
                            {a.class_name}
                            <span className="d-sm-none">
                              {' '}
                              · {a.marked_count} of {a.learner_count} marked
                            </span>
                          </div>
                        </td>
                        <td className="d-none d-md-table-cell">{a.class_name}</td>
                        <td className="d-none d-lg-table-cell text-nowrap">{a.scheduled_date ? formatDate(a.scheduled_date) : '—'}</td>
                        <td className="d-none d-sm-table-cell el-cell-progress">
                          <ProgressMeter value={a.marked_count} max={a.learner_count} label={done ? 'Done' : 'marked'} compact />
                        </td>
                        <td className="text-end tabular-nums d-none d-md-table-cell">
                          {a.average === null ? (
                            <span className="el-cell-secondary">—</span>
                          ) : (
                            <>
                              <span className="fw-semibold">{a.average}%</span>
                              <span className="el-cell-secondary"> · L{capsLevel(a.average)}</span>
                            </>
                          )}
                        </td>
                        <td className="el-cell-actions">
                          <RowActions
                            label={`Actions for ${a.assessment_name}`}
                            items={[
                              { label: done ? 'View marks' : 'Enter marks', icon: LuClipboardCheck, onClick: open },
                              { label: 'Edit details', icon: LuPencil, onClick: () => setDialog({ type: 'form', assessment: a }), hidden: !a.class_is_active },
                              null,
                              { label: 'Delete', icon: LuTrash2, danger: true, onClick: () => setDialog({ type: 'delete', assessment: a }), hidden: !a.class_is_active },
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

        {data && assessments.length === 0 && (
          <EmptyState
            icon={status === 'to_mark' ? LuClipboardCheck : LuClipboardList}
            title={status === 'to_mark' && !debouncedSearch ? 'Nothing left to mark' : filtering ? 'No assessments match' : 'No assessments yet'}
            action={
              !filtering &&
              classes.length > 0 && <Button onClick={() => setDialog({ type: 'form' })}>Create your first assessment</Button>
            }
          >
            {status === 'to_mark' && !debouncedSearch
              ? 'Every learner has a mark for every assessment.'
              : filtering
                ? 'Try a different search or filter.'
                : classes.length === 0
                  ? 'You’ll be able to create assessments once your school admin gives you a class.'
                  : 'Create a test or task, then enter each learner’s marks.'}
          </EmptyState>
        )}
      </section>

      {dialog?.type === 'form' && (
        <AssessmentFormModal
          assessment={dialog.assessment}
          classes={classes}
          defaultClassId={classId || undefined}
          onClose={close}
          onSaved={(saved, message) => {
            close();
            toast.success(message);
            if (dialog.assessment) reload();
            else navigate(`/teacher/assessments/${saved.assessment_id}`);
          }}
        />
      )}

      <ConfirmDialog
        show={dialog?.type === 'delete'}
        title={dialog?.assessment && `Delete ${dialog.assessment.assessment_name}?`}
        confirmLabel="Delete assessment"
        onConfirm={confirmDelete}
        onClose={close}
      >
        {dialog?.assessment?.marked_count > 0
          ? `The ${dialog.assessment.marked_count} marks already entered will be deleted too. This can’t be undone.`
          : 'This can’t be undone.'}
      </ConfirmDialog>
    </>
  );
};

export default Assessments;
