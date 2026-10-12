import { useId, useState } from 'react';
import { Button, Col, Form, Modal, Row, Spinner } from 'react-bootstrap';
import { useApi } from '../../../hooks/useApi';
import { useMutation } from '../../../hooks/useMutation';
import { ASSESSMENT_TYPES, currentTerm, gradeLabel, TERMS } from '../../../lib/format';
import FormAlert from '../../../components/ui/FormAlert';

/**
 * Creates an assessment (no `assessment`) or edits one. Subjects and topics
 * come from the chosen class's curriculum. `classes` are the teacher's active classes.
 */
const AssessmentFormModal = ({ assessment, classes = [], defaultClassId, onClose, onSaved }) => {
  const titleId = useId();
  const editing = Boolean(assessment);
  const [form, setForm] = useState({
    class_id: assessment?.class_id ?? defaultClassId ?? classes[0]?.class_id ?? '',
    assessment_name: assessment?.assessment_name ?? '',
    assessment_type: assessment?.assessment_type ?? 'test',
    subject_id: assessment?.subject_id ?? '',
    topic_id: assessment?.topic_id ?? '',
    total_marks: assessment ? String(Number(assessment.total_marks)) : '',
    term_number: assessment?.term_number ?? currentTerm(),
    scheduled_date: assessment?.scheduled_date ?? new Date().toLocaleDateString('en-CA'),
    description: assessment?.description ?? '',
  });
  const save = useMutation();
  const options = useApi(form.class_id ? '/api/teacher/assessments/options' : null, { class_id: form.class_id });
  const subjects = options.data?.subjects ?? [];
  const topics = subjects.find((s) => s.subject_id === form.subject_id)?.topics ?? [];

  const set = (changes) => setForm((current) => ({ ...current, ...changes }));
  const field = (name) => ({
    value: form[name],
    onChange: (e) => set({ [name]: e.target.value }),
    isInvalid: Boolean(save.fieldErrors[name]),
  });
  const error = (name) => <Form.Control.Feedback type="invalid">{save.fieldErrors[name]}</Form.Control.Feedback>;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const body = {
      ...form,
      total_marks: form.total_marks === '' ? '' : Number(form.total_marks),
      subject_id: form.subject_id || null,
      topic_id: form.topic_id || null,
      scheduled_date: form.scheduled_date || null,
    };
    const result = editing
      ? await save.run('put', `/api/teacher/assessments/${assessment.assessment_id}`, (({ class_id: _c, ...rest }) => rest)(body))
      : await save.run('post', '/api/teacher/assessments', body);
    if (result.ok) onSaved(result.data.assessment, result.message);
  };

  const selectedClass = classes.find((c) => c.class_id === form.class_id) ?? options.data?.class;

  return (
    <Modal aria-labelledby={titleId} show onHide={onClose} centered size="lg" backdrop={save.pending ? 'static' : true}>
      <Form onSubmit={handleSubmit} noValidate>
        <Modal.Header closeButton>
          <Modal.Title id={titleId} as="h2" className="h5 mb-0">
            {editing ? `Edit ${assessment.assessment_name}` : 'New assessment'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <FormAlert variant="danger">{save.error}</FormAlert>
          <Row className="g-3">
            {!editing && (
              <Col sm={6}>
                <Form.Group controlId="assessment-class">
                  <Form.Label>Class</Form.Label>
                  <Form.Select
                    {...field('class_id')}
                    onChange={(e) => set({ class_id: e.target.value, subject_id: '', topic_id: '' })}
                    required
                  >
                    {classes.map((c) => (
                      <option key={c.class_id} value={c.class_id}>
                        {c.class_name} · {gradeLabel(c.grade_level)}
                      </option>
                    ))}
                  </Form.Select>
                  {error('class_id')}
                </Form.Group>
              </Col>
            )}
            <Col sm={editing ? 12 : 6}>
              <Form.Group controlId="assessment-name">
                <Form.Label>Name</Form.Label>
                <Form.Control {...field('assessment_name')} placeholder="e.g. Counting to 100" autoFocus required />
                {error('assessment_name')}
              </Form.Group>
            </Col>
            <Col sm={6}>
              <Form.Group controlId="assessment-subject">
                <Form.Label>Subject</Form.Label>
                <Form.Select
                  {...field('subject_id')}
                  onChange={(e) => set({ subject_id: e.target.value, topic_id: '' })}
                  disabled={options.loading && !options.data}
                >
                  <option value="">{subjects.length ? 'Choose a subject' : 'No subject'}</option>
                  {subjects.map((s) => (
                    <option key={s.subject_id} value={s.subject_id}>
                      {s.subject_name}
                    </option>
                  ))}
                </Form.Select>
                {error('subject_id')}
                {options.data && subjects.length === 0 && (
                  <Form.Text className="text-body-secondary">
                    No curriculum is assigned to {selectedClass ? gradeLabel(selectedClass.grade_level) : 'this grade'} yet. You
                    can still create the assessment.
                  </Form.Text>
                )}
              </Form.Group>
            </Col>
            <Col sm={6}>
              <Form.Group controlId="assessment-topic">
                <Form.Label>
                  Topic <span className="text-body-secondary fw-normal">(optional)</span>
                </Form.Label>
                <Form.Select {...field('topic_id')} disabled={topics.length === 0}>
                  <option value="">{topics.length ? 'Choose a topic' : 'No topics'}</option>
                  {topics.map((t) => (
                    <option key={t.topic_id} value={t.topic_id}>
                      {t.topic_name}
                    </option>
                  ))}
                </Form.Select>
                {error('topic_id')}
              </Form.Group>
            </Col>
            <Col xs={6} sm={4}>
              <Form.Group controlId="assessment-type">
                <Form.Label>Type</Form.Label>
                <Form.Select {...field('assessment_type')}>
                  {Object.entries(ASSESSMENT_TYPES).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Form.Select>
                {error('assessment_type')}
              </Form.Group>
            </Col>
            <Col xs={6} sm={4}>
              <Form.Group controlId="assessment-total">
                <Form.Label>Total marks</Form.Label>
                <Form.Control {...field('total_marks')} type="number" inputMode="decimal" min={1} step="0.5" required />
                {error('total_marks')}
              </Form.Group>
            </Col>
            <Col xs={6} sm={4}>
              <Form.Group controlId="assessment-term">
                <Form.Label>Term</Form.Label>
                <Form.Select {...field('term_number')}>
                  {TERMS.map((t) => (
                    <option key={t} value={t}>
                      Term {t}
                    </option>
                  ))}
                </Form.Select>
                {error('term_number')}
              </Form.Group>
            </Col>
            <Col xs={6} sm={4}>
              <Form.Group controlId="assessment-date">
                <Form.Label>Date</Form.Label>
                <Form.Control {...field('scheduled_date')} type="date" />
                {error('scheduled_date')}
              </Form.Group>
            </Col>
            <Col xs={12}>
              <Form.Group controlId="assessment-description">
                <Form.Label>
                  Notes <span className="text-body-secondary fw-normal">(optional)</span>
                </Form.Label>
                <Form.Control {...field('description')} as="textarea" rows={2} placeholder="What it covers, or how to run it" />
                {error('description')}
              </Form.Group>
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.pending || (!editing && !form.class_id)}>
            {save.pending && <Spinner size="sm" className="me-2" aria-hidden="true" />}
            {editing ? 'Save changes' : 'Create assessment'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default AssessmentFormModal;
