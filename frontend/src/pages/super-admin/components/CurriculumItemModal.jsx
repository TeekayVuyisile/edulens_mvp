import { useId, useState } from 'react';
import { Button, Form, Modal, Spinner } from 'react-bootstrap';
import { useMutation } from '../../../hooks/useMutation';
import { GRADE_OPTIONS, gradeLabel } from '../../../lib/format';
import FormAlert from '../../../components/ui/FormAlert';

// Fields per level of the curriculum hierarchy.
const FIELDS = {
  curriculum: [
    { name: 'curriculum_name', label: 'Name', required: true, placeholder: 'e.g. CAPS' },
    { name: 'description', label: 'Description', textarea: true },
  ],
  subject: [
    { name: 'subject_name', label: 'Subject name', required: true, placeholder: 'e.g. Mathematics' },
    { name: 'grade_level', label: 'Grade', grade: true },
    { name: 'subject_code', label: 'Subject code', placeholder: 'e.g. CAPS-MATH-1' },
    { name: 'description', label: 'Description', textarea: true },
  ],
  topic: [
    { name: 'topic_name', label: 'Topic name', required: true, placeholder: 'e.g. Counting to 100' },
    { name: 'topic_code', label: 'Topic code' },
    {
      name: 'learning_objectives',
      label: 'Learning objectives',
      textarea: true,
      hint: 'Used to guide AI worksheet generation.',
    },
    { name: 'description', label: 'Description', textarea: true },
  ],
};

const NOUN = { curriculum: 'curriculum', subject: 'subject', topic: 'topic' };

/**
 * Add or edit a curriculum, subject or topic.
 * mode: { kind, item? (edit), parent? ({ id, name } for adds) }
 */
const CurriculumItemModal = ({ mode, onClose, onSaved }) => {
  const titleId = useId();
  const { kind, item, parent } = mode;
  const fields = FIELDS[kind];
  const [form, setForm] = useState(() =>
    Object.fromEntries(fields.map((f) => [f.name, item?.[f.name] ?? (f.grade ? 'R-3' : '')]))
  );
  const save = useMutation();

  const endpoints = {
    curriculum: item ? `/api/super-admin/curricula/${item.curriculum_id}` : '/api/super-admin/curricula',
    subject: item ? `/api/super-admin/subjects/${item.subject_id}` : `/api/super-admin/curricula/${parent?.id}/subjects`,
    topic: item ? `/api/super-admin/topics/${item.topic_id}` : `/api/super-admin/subjects/${parent?.id}/topics`,
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await save.run(item ? 'put' : 'post', endpoints[kind], form);
    if (result.ok) onSaved(result.message);
  };

  return (
    <Modal aria-labelledby={titleId} show onHide={onClose} centered>
      <Form onSubmit={handleSubmit} noValidate>
        <Modal.Header closeButton>
          <Modal.Title id={titleId} as="h2" className="h5 mb-0">
            {item ? `Edit ${NOUN[kind]}` : `Add a ${NOUN[kind]}`}
            {parent && <div className="small fw-normal text-body-secondary mt-1">in {parent.name}</div>}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <FormAlert variant="danger">{save.error}</FormAlert>
          {fields.map((f, index) => (
            <Form.Group key={f.name} className="mb-3" controlId={`item-${f.name}`}>
              <Form.Label>
                {f.label}
                {!f.required && !f.grade && <span className="text-body-secondary fw-normal"> (optional)</span>}
              </Form.Label>
              {f.grade ? (
                <Form.Select
                  value={form[f.name]}
                  onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                  isInvalid={Boolean(save.fieldErrors[f.name])}
                >
                  {GRADE_OPTIONS.map((g) => (
                    <option key={g} value={g}>
                      {gradeLabel(g)}
                    </option>
                  ))}
                </Form.Select>
              ) : (
                <Form.Control
                  as={f.textarea ? 'textarea' : 'input'}
                  rows={f.textarea ? 3 : undefined}
                  value={form[f.name]}
                  onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                  placeholder={f.placeholder}
                  isInvalid={Boolean(save.fieldErrors[f.name])}
                  required={f.required}
                  autoFocus={index === 0}
                />
              )}
              {f.hint && !save.fieldErrors[f.name] && <Form.Text className="text-body-secondary">{f.hint}</Form.Text>}
              <Form.Control.Feedback type="invalid">{save.fieldErrors[f.name]}</Form.Control.Feedback>
            </Form.Group>
          ))}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={save.pending}>
            {save.pending && <Spinner size="sm" className="me-2" aria-hidden="true" />}
            {item ? 'Save changes' : `Add ${NOUN[kind]}`}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default CurriculumItemModal;
