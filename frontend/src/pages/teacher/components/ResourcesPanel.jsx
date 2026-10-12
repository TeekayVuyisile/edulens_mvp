import { useRef, useState } from 'react';
import { Button, Form, Spinner } from 'react-bootstrap';
import toast from 'react-hot-toast';
import { LuDownload, LuExternalLink, LuFileText, LuImage, LuLink, LuPaperclip, LuTrash2 } from 'react-icons/lu';
import http, { errorMessage } from '../../../lib/http';
import { useMutation } from '../../../hooks/useMutation';
import EmptyState from '../../../components/ui/EmptyState';
import FormAlert from '../../../components/ui/FormAlert';

const ICONS = { link: LuLink, image: LuImage };

const fileSize = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/** Files and links attached to an assessment (worksheets, memos, songs). */
const ResourcesPanel = ({ assessment, resources, editable, onChange }) => {
  const base = `/api/teacher/assessments/${assessment.assessment_id}/resources`;
  const fileInput = useRef(null);
  const [addingLink, setAddingLink] = useState(false);
  const [link, setLink] = useState({ resource_name: '', resource_url: '' });
  const [downloading, setDownloading] = useState(null);
  const save = useMutation();

  const upload = async (file) => {
    if (!file) return;
    const body = new FormData();
    body.append('file', file);
    const result = await save.run('post', base, body);
    if (fileInput.current) fileInput.current.value = '';
    if (result.ok) {
      toast.success(result.message);
      onChange();
    }
  };

  const addLink = async (e) => {
    e.preventDefault();
    const result = await save.run('post', base, link);
    if (result.ok) {
      toast.success(result.message);
      setLink({ resource_name: '', resource_url: '' });
      setAddingLink(false);
      onChange();
    }
  };

  // Files are behind sign-in, so fetch them with the session and save the blob.
  const download = async (resource) => {
    setDownloading(resource.resource_id);
    try {
      const res = await http.get(`${base}/${resource.resource_id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      Object.assign(document.createElement('a'), { href: url, download: resource.resource_name }).click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setDownloading(null);
    }
  };

  const remove = async (resource) => {
    const result = await save.run('delete', `${base}/${resource.resource_id}`);
    if (result.ok) {
      toast.success(result.message);
      onChange();
    } else toast.error(result.message);
  };

  return (
    <section className="el-panel" aria-labelledby="resources-heading">
      <div className="el-panel__header">
        <div>
          <h2 id="resources-heading" className="el-panel__title">
            Resources
          </h2>
          <p className="el-panel__subtitle">Worksheets, memos and links for this assessment.</p>
        </div>
      </div>

      {resources.length === 0 ? (
        <EmptyState compact icon={LuPaperclip} title="Nothing attached">
          {editable ? 'Attach the worksheet or memo so it’s in one place.' : null}
        </EmptyState>
      ) : (
        <ul className="el-list">
          {resources.map((r) => {
            const Icon = ICONS[r.resource_type] ?? LuFileText;
            const isLink = r.resource_type === 'link';
            return (
              <li key={r.resource_id}>
                <div className="el-person">
                  <span className="el-resource-icon" aria-hidden="true">
                    <Icon />
                  </span>
                  <div className="el-person__text">
                    <div className="el-cell-primary text-truncate">{r.resource_name}</div>
                    <div className="el-cell-secondary">{isLink ? 'Link' : fileSize(r.file_size ?? 0)}</div>
                  </div>
                </div>
                <div className="d-flex gap-1 flex-shrink-0">
                  {isLink ? (
                    <Button
                      as="a"
                      href={r.resource_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      size="sm"
                      variant="light"
                      aria-label={`Open ${r.resource_name}`}
                    >
                      <LuExternalLink aria-hidden="true" />
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="light"
                      onClick={() => download(r)}
                      disabled={downloading === r.resource_id}
                      aria-label={`Download ${r.resource_name}`}
                    >
                      {downloading === r.resource_id ? <Spinner size="sm" aria-hidden="true" /> : <LuDownload aria-hidden="true" />}
                    </Button>
                  )}
                  {editable && (
                    <Button
                      size="sm"
                      variant="light"
                      className="text-danger"
                      onClick={() => remove(r)}
                      disabled={save.pending}
                      aria-label={`Remove ${r.resource_name}`}
                    >
                      <LuTrash2 aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editable && (
        <div className="el-panel__body border-top">
          <FormAlert variant="danger">{save.error}</FormAlert>
          {addingLink ? (
            <Form onSubmit={addLink} className="d-grid gap-2" noValidate>
              <Form.Group controlId="resource-url">
                <Form.Label className="small">Link</Form.Label>
                <Form.Control
                  type="url"
                  inputMode="url"
                  placeholder="https://"
                  value={link.resource_url}
                  onChange={(e) => setLink({ ...link, resource_url: e.target.value })}
                  isInvalid={Boolean(save.fieldErrors.resource_url)}
                  autoFocus
                  required
                />
                <Form.Control.Feedback type="invalid">{save.fieldErrors.resource_url}</Form.Control.Feedback>
              </Form.Group>
              <Form.Group controlId="resource-name">
                <Form.Label className="small">
                  Name <span className="text-body-secondary fw-normal">(optional)</span>
                </Form.Label>
                <Form.Control
                  value={link.resource_name}
                  onChange={(e) => setLink({ ...link, resource_name: e.target.value })}
                  placeholder="e.g. Counting song on YouTube"
                />
              </Form.Group>
              <div className="d-flex gap-2">
                <Button type="submit" size="sm" disabled={save.pending}>
                  Add link
                </Button>
                <Button size="sm" variant="light" onClick={() => setAddingLink(false)}>
                  Cancel
                </Button>
              </div>
            </Form>
          ) : (
            <div className="d-flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => fileInput.current?.click()}
                disabled={save.pending}
                className="d-inline-flex align-items-center gap-2"
              >
                {save.pending ? <Spinner size="sm" aria-hidden="true" /> : <LuPaperclip aria-hidden="true" />} Attach file
              </Button>
              <Button size="sm" variant="light" onClick={() => setAddingLink(true)} className="d-inline-flex align-items-center gap-2">
                <LuLink aria-hidden="true" /> Add link
              </Button>
              <input
                ref={fileInput}
                type="file"
                className="visually-hidden"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif,.webp"
                onChange={(e) => upload(e.target.files[0])}
                aria-label="Attach a file"
                tabIndex={-1}
              />
              <p className="el-cell-secondary w-100 mb-0">PDF, Word, PowerPoint or images, up to 5 MB.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default ResourcesPanel;
