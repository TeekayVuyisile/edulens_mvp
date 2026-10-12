import { useState } from 'react';
import { Button, Form, Spinner } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LuFileText, LuPencil, LuPrinter, LuTrash2 } from 'react-icons/lu';
import { useAuth } from '../../contexts/useAuth';
import { useApi, useDocumentTitle } from '../../hooks/useApi';
import { useMutation } from '../../hooks/useMutation';
import { formatDate, gradeLabel } from '../../lib/format';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import FormAlert from '../../components/ui/FormAlert';
import RowActions from '../../components/ui/RowActions';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import FullPageLoader from '../../components/ui/FullPageLoader';
import WorksheetDocument from '../../components/worksheets/WorksheetDocument';

const WorksheetDetail = () => {
  const { worksheetId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi(`/api/teacher/worksheets/library/${worksheetId}`);
  useDocumentTitle(data?.worksheet.worksheet_title ?? 'Worksheet');
  const [showAnswers, setShowAnswers] = useState(false);
  const [draft, setDraft] = useState(null); // set while editing
  const [problem, setProblem] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const mutate = useMutation();

  if (loading && !data) return <FullPageLoader label="Loading worksheet…" />;
  if (error && !data) {
    return (
      <EmptyState icon={LuFileText} title="Couldn’t load this worksheet" action={<Button onClick={reload}>Try again</Button>}>
        {error}
      </EmptyState>
    );
  }

  const { worksheet } = data;
  const mine = worksheet.teacher_id === user.user_id;

  const saveEdits = async () => {
    setProblem(null);
    const result = await mutate.run('put', `/api/teacher/worksheets/library/${worksheetId}`, { worksheet: draft });
    if (result.ok) {
      toast.success(result.message);
      setDraft(null);
      reload();
    } else setProblem(result.response?.data?.problems?.join(' · ') ?? result.message);
  };

  const print = (withAnswers) => {
    setShowAnswers(withAnswers);
    // Let React render the answer key (or remove it) before the print dialog opens.
    setTimeout(() => window.print(), 50);
  };

  return (
    <>
      <PageHeader
        back={{ to: '/teacher/worksheets', label: 'Worksheets' }}
        eyebrow={[worksheet.subject_name, worksheet.topic_name, gradeLabel(worksheet.grade_level)].filter(Boolean).join(' · ')}
        title={worksheet.worksheet_title}
        description={`By ${worksheet.teacher_first_name} ${worksheet.teacher_last_name} · ${formatDate(worksheet.created_at)} · ${worksheet.question_count} questions`}
        actions={
          draft ? (
            <>
              <Button variant="light" onClick={() => setDraft(null)} disabled={mutate.pending}>
                Cancel
              </Button>
              <Button onClick={saveEdits} disabled={mutate.pending}>
                {mutate.pending && <Spinner size="sm" className="me-2" aria-hidden="true" />}
                Save changes
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => print(false)} className="d-inline-flex align-items-center gap-2">
                <LuPrinter aria-hidden="true" /> Print
              </Button>
              <RowActions
                label={`More actions for ${worksheet.worksheet_title}`}
                items={[
                  { label: 'Print with answer key', icon: LuPrinter, onClick: () => print(true) },
                  { label: 'Edit questions', icon: LuPencil, onClick: () => setDraft(worksheet.content), hidden: !mine || !worksheet.content },
                  null,
                  { label: 'Delete', icon: LuTrash2, danger: true, onClick: () => setDeleting(true), hidden: !mine },
                ]}
              />
            </>
          )
        }
      />

      {!worksheet.content ? (
        <section className="el-panel">
          <EmptyState icon={LuFileText} title="Made with the old worksheet maker">
            This worksheet was saved before worksheets were stored safely and can’t be shown. Make a new one instead.
          </EmptyState>
        </section>
      ) : (
        <>
          <div className="d-flex justify-content-end mb-3 el-no-print">
            {!draft && (
              <Form.Check
                type="switch"
                id="show-answers"
                label="Show answer key"
                checked={showAnswers}
                onChange={(e) => setShowAnswers(e.target.checked)}
              />
            )}
          </div>
          <FormAlert variant="danger">{problem}</FormAlert>
          <WorksheetDocument
            worksheet={draft ?? worksheet.content}
            meta={worksheet}
            showAnswers={showAnswers}
            onChange={draft ? setDraft : undefined}
          />
        </>
      )}

      <ConfirmDialog
        show={deleting}
        title={`Delete ${worksheet.worksheet_title}?`}
        confirmLabel="Delete worksheet"
        onConfirm={async () => {
          const result = await mutate.run('delete', `/api/teacher/worksheets/library/${worksheetId}`);
          if (result.ok) {
            toast.success(result.message);
            navigate('/teacher/worksheets', { replace: true });
          }
          return result;
        }}
        onClose={() => setDeleting(false)}
      >
        It’s removed from the school’s library for everyone. This can’t be undone.
      </ConfirmDialog>
    </>
  );
};

export default WorksheetDetail;
