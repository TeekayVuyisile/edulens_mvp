import { useMemo, useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  LuArchive,
  LuArchiveRestore,
  LuBookOpen,
  LuChevronRight,
  LuLayers,
  LuPencil,
  LuPlus,
  LuTrash2,
} from 'react-icons/lu';
import { useApi, useDocumentTitle } from '../../hooks/useApi';
import { useMutation } from '../../hooks/useMutation';
import { gradeLabel, plural } from '../../lib/format';
import { reveal } from '../../lib/motion';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import StatusBadge from '../../components/ui/StatusBadge';
import RowActions from '../../components/ui/RowActions';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import FullPageLoader from '../../components/ui/FullPageLoader';
import CurriculumItemModal from './components/CurriculumItemModal';
import './curricula.css';

const ID = { curriculum: 'curriculum_id', subject: 'subject_id', topic: 'topic_id' };
const NAME = { curriculum: 'curriculum_name', subject: 'subject_name', topic: 'topic_name' };
const PATH = { curriculum: 'curricula', subject: 'subjects', topic: 'topics' };

const topicCount = (curriculum) => curriculum.subjects.reduce((n, s) => n + s.topics.length, 0);

const Curricula = () => {
  useDocumentTitle('Curricula');
  const [showArchived, setShowArchived] = useState(false);
  const { data, loading, error, reload } = useApi('/api/super-admin/curricula', {
    include_archived: showArchived ? 'true' : undefined,
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const [openSubjects, setOpenSubjects] = useState(() => new Set());
  const [modal, setModal] = useState(null); // { kind, item?, parent? }
  const [confirm, setConfirm] = useState(null); // { action: 'archive' | 'restore' | 'delete', kind, item }
  const mutate = useMutation();

  const curricula = useMemo(() => data?.curricula ?? [], [data]);
  const selected =
    curricula.find((c) => c.curriculum_id === searchParams.get('curriculum')) ?? curricula[0] ?? null;

  // Subjects grouped by grade, in grade order (the API already sorts them).
  const grades = useMemo(() => {
    const groups = new Map();
    for (const subject of selected?.subjects ?? []) {
      if (!groups.has(subject.grade_level)) groups.set(subject.grade_level, []);
      groups.get(subject.grade_level).push(subject);
    }
    return [...groups.entries()];
  }, [selected]);

  const select = (curriculumId) => {
    setSearchParams({ curriculum: curriculumId }, { replace: true });
    // On narrow screens the detail panel sits below the list; bring it into view.
    if (window.matchMedia?.('(max-width: 991.98px)').matches) {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      requestAnimationFrame(() =>
        document
          .getElementById('curriculum-title')
          ?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
      );
    }
  };

  const toggleSubject = (subjectId) =>
    setOpenSubjects((current) => {
      const next = new Set(current);
      if (next.has(subjectId)) next.delete(subjectId);
      else next.add(subjectId);
      return next;
    });

  const afterSave = (message) => {
    setModal(null);
    toast.success(message);
    reload();
  };

  const runConfirm = async () => {
    const { action, kind, item } = confirm;
    const url = `/api/super-admin/${PATH[kind]}/${item[ID[kind]]}`;
    const result =
      action === 'delete'
        ? await mutate.run('delete', url)
        : await mutate.run('patch', `${url}/status`, { is_active: action === 'restore' });
    if (result.ok) {
      toast.success(result.message);
      reload();
    }
    return result;
  };

  const itemActions = (kind, item) => [
    { label: 'Edit', icon: LuPencil, onClick: () => setModal({ kind, item }) },
    item.is_active
      ? { label: 'Archive', icon: LuArchive, onClick: () => setConfirm({ action: 'archive', kind, item }) }
      : { label: 'Restore', icon: LuArchiveRestore, onClick: () => setConfirm({ action: 'restore', kind, item }) },
    null,
    { label: 'Delete', icon: LuTrash2, danger: true, onClick: () => setConfirm({ action: 'delete', kind, item }) },
  ];

  if (loading && !data) return <FullPageLoader label="Loading curricula…" />;

  return (
    <>
      <PageHeader
        title="Curricula"
        description="The curricula, subjects and topics that schools teach and teachers assess against."
        actions={
          <Button onClick={() => setModal({ kind: 'curriculum' })} className="d-inline-flex align-items-center gap-2">
            <LuPlus aria-hidden="true" /> Add curriculum
          </Button>
        }
      />

      {error && !data ? (
        <EmptyState icon={LuBookOpen} title="Couldn’t load curricula" action={<Button onClick={reload}>Try again</Button>}>
          {error}
        </EmptyState>
      ) : (
        <div className="el-curricula">
          <aside className="el-panel el-curricula__list" aria-label="Curricula">
            <div className="el-panel__header">
              <h2 className="el-panel__title">{plural(curricula.length, 'curriculum', 'curricula')}</h2>
              <Form.Check
                type="switch"
                id="show-archived"
                label="Show archived"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="small mb-0"
              />
            </div>
            {curricula.length === 0 ? (
              <EmptyState compact icon={LuBookOpen} title="No curricula yet">
                Start with the curriculum your schools follow, such as CAPS.
              </EmptyState>
            ) : (
              <ul className="el-list el-curricula__items">
                {curricula.map((c) => (
                  <li key={c.curriculum_id}>
                    <button
                      type="button"
                      className={`el-curricula__item ${selected?.curriculum_id === c.curriculum_id ? 'is-selected' : ''}`}
                      onClick={() => select(c.curriculum_id)}
                      aria-current={selected?.curriculum_id === c.curriculum_id ? 'true' : undefined}
                    >
                      <span className="d-flex align-items-center justify-content-between gap-2">
                        <span className="el-cell-primary">{c.curriculum_name}</span>
                        {!c.is_active && <StatusBadge status="archived" />}
                      </span>
                      <span className="el-cell-secondary">
                        {plural(c.subjects.length, 'subject')} · {plural(topicCount(c), 'topic')} ·{' '}
                        {plural(c.school_assignment_count, 'school')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          {selected && (
            <section className="el-panel" aria-labelledby="curriculum-title">
              <div className="el-panel__header">
                <div className="min-w-0">
                  <h2 id="curriculum-title" className="h5 mb-1 d-flex align-items-center gap-2 flex-wrap">
                    {selected.curriculum_name}
                    {!selected.is_active && <StatusBadge status="archived" />}
                  </h2>
                  <p className="el-panel__subtitle mb-0">
                    {selected.description || 'No description.'}
                  </p>
                </div>
                <div className="d-flex gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      setModal({ kind: 'subject', parent: { id: selected.curriculum_id, name: selected.curriculum_name } })
                    }
                    className="d-inline-flex align-items-center gap-2"
                  >
                    <LuPlus aria-hidden="true" /> Subject
                  </Button>
                  <RowActions label={`Actions for ${selected.curriculum_name}`} items={itemActions('curriculum', selected)} />
                </div>
              </div>

              {grades.length === 0 ? (
                <EmptyState
                  compact
                  icon={LuLayers}
                  title="No subjects yet"
                  action={
                    <Button
                      size="sm"
                      onClick={() =>
                        setModal({ kind: 'subject', parent: { id: selected.curriculum_id, name: selected.curriculum_name } })
                      }
                    >
                      Add a subject
                    </Button>
                  }
                >
                  Add subjects per grade, then the topics within each subject.
                </EmptyState>
              ) : (
                grades.map(([grade, subjects]) => (
                  <div key={grade} className="el-grade-group">
                    <h3 className="el-grade-group__title">{gradeLabel(grade)}</h3>
                    <ul className="el-list">
                      {subjects.map((subject) => {
                        const open = openSubjects.has(subject.subject_id);
                        return (
                          <li key={subject.subject_id} className="el-subject">
                            <div className="el-subject__row">
                              <button
                                type="button"
                                className="el-subject__toggle"
                                onClick={() => toggleSubject(subject.subject_id)}
                                aria-expanded={open}
                                aria-controls={`topics-${subject.subject_id}`}
                              >
                                <LuChevronRight
                                  className={`el-subject__chevron ${open ? 'is-open' : ''}`}
                                  aria-hidden="true"
                                />
                                <span>
                                  <span className="el-cell-primary">{subject.subject_name}</span>
                                  {subject.subject_code && (
                                    <span className="el-cell-secondary font-monospace ms-2">{subject.subject_code}</span>
                                  )}
                                  <span className="el-cell-secondary d-block">{plural(subject.topics.length, 'topic')}</span>
                                </span>
                              </button>
                              <div className="d-flex align-items-center gap-2">
                                {!subject.is_active && <StatusBadge status="archived" />}
                                <RowActions
                                  label={`Actions for ${subject.subject_name}`}
                                  items={itemActions('subject', subject)}
                                />
                              </div>
                            </div>
                            <AnimatePresence initial={false}>
                              {open && (
                                <motion.div {...reveal} className="overflow-hidden" id={`topics-${subject.subject_id}`}>
                                  <ul className="el-topics">
                                    {subject.topics.map((topic) => (
                                      <li key={topic.topic_id}>
                                        <div className="min-w-0">
                                          <div className="fw-semibold">
                                            {topic.topic_name}
                                            {!topic.is_active && (
                                              <span className="ms-2">
                                                <StatusBadge status="archived" />
                                              </span>
                                            )}
                                          </div>
                                          {topic.learning_objectives && (
                                            <div className="el-cell-secondary">{topic.learning_objectives}</div>
                                          )}
                                        </div>
                                        <RowActions label={`Actions for ${topic.topic_name}`} items={itemActions('topic', topic)} />
                                      </li>
                                    ))}
                                    <li>
                                      <Button
                                        size="sm"
                                        variant="link"
                                        className="px-0 d-inline-flex align-items-center gap-1"
                                        onClick={() =>
                                          setModal({
                                            kind: 'topic',
                                            parent: { id: subject.subject_id, name: subject.subject_name },
                                          })
                                        }
                                      >
                                        <LuPlus aria-hidden="true" /> Add topic
                                      </Button>
                                    </li>
                                  </ul>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
              )}
            </section>
          )}
        </div>
      )}

      {modal && <CurriculumItemModal mode={modal} onClose={() => setModal(null)} onSaved={afterSave} />}

      <ConfirmDialog
        show={Boolean(confirm)}
        title={
          confirm &&
          `${{ archive: 'Archive', restore: 'Restore', delete: 'Delete' }[confirm.action]} ${confirm.item[NAME[confirm.kind]]}?`
        }
        confirmLabel={confirm && { archive: 'Archive', restore: 'Restore', delete: 'Delete permanently' }[confirm.action]}
        variant={confirm?.action === 'restore' ? 'primary' : 'danger'}
        onConfirm={runConfirm}
        onClose={() => setConfirm(null)}
      >
        {confirm?.action === 'archive' &&
          'Archived items are hidden from teachers when they create new assessments and worksheets. Existing records keep working, and you can restore it at any time.'}
        {confirm?.action === 'restore' && 'It becomes available to teachers again.'}
        {confirm?.action === 'delete' &&
          `This permanently removes it${confirm.kind !== 'topic' ? ' and everything inside it' : ''}. Anything already used by assessments or worksheets can only be archived.`}
      </ConfirmDialog>
    </>
  );
};

export default Curricula;
