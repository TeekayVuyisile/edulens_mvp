import { useId, useState } from 'react';
import { Button, Col, Form, Modal, Row, Spinner } from 'react-bootstrap';
import { useMutation } from '../../../hooks/useMutation';
import { CLASS_GRADES, gradeLabel } from '../../../lib/format';
import FormAlert from '../../../components/ui/FormAlert';

/**
 * Creates a class (no `klass`) or edits one. When creating, a class teacher can
 * be chosen from `teachers` (active teachers at the school).
 */
const ClassFormModal = ({ klass, teachers = [], defaultYear, onClose, onSaved }) => {
  const titleId = useId();
  const editing = Boolean(klass);
  const [form, setForm] = useState({
    class_name: klass?.class_name ?? '',
    grade_level: klass?.grade_level ?? '1',
    academic_year: String(klass?.academic_year ?? defaultYear ?? new Date().getFullYear()),
    max_capacity: String(klass?.max_capacity ?? 30),
    teacher_id: '',
  });
  const save = useMutation();

  const field = (name) => ({
    value: form[name],
    onChange: (e) => setForm((current) => ({ ...current, [name]: e.target.value })),
    isInvalid: Boolean(save.fieldErrors[name]),
  });
  const error = (name) => <Form.Control.Feedback type="invalid">{save.fieldErrors[name]}</Form.Control.Feedback>;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const body = {
      class_name: form.class_name,
      grade_level: form.grade_level,
      academic_year: Number(form.academic_year),
      max_capacity: Number(form.max_capacity),
    };
    const result = editing
      ? await save.run('put', `/api/school-admin/classes/${klass.class_id}`, body)
      : await save.run('post', '/api/school-admin/classes', { ...body, teacher_id: form.teacher_id || null });
    if (result.ok) onSaved(result.data.class, result.message);
  };

  return (
    <Modal aria-labelledby={titleId} show onHide={onClose} centered backdrop={save.pending ? 'static' : true}>
      <Form onSubmit={handleSubmit} noValidate>
        <Modal.Header closeButton>
          <Modal.Title id={titleId} as="h2" className="h5 mb-0">
            {editing ? `Edit ${klass.class_name}` : 'Create a class'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <FormAlert variant="danger">{save.error}</FormAlert>
          <Row className="g-3">
            <Col xs={12}>
              <Form.Group controlId="class-name">
                <Form.Label>Class name</Form.Label>
                <Form.Control {...field('class_name')} placeholder="e.g. Grade 1A or Grade R Sunflowers" autoFocus required />
                {error('class_name')}
              </Form.Group>
            </Col>
            <Col sm={4}>
              <Form.Group controlId="class-grade">
                <Form.Label>Grade</Form.Label>
                <Form.Select {...field('grade_level')}>
                  {CLASS_GRADES.map((g) => (
                    <option key={g} value={g}>
                      {gradeLabel(g)}
                    </option>
                  ))}
                </Form.Select>
                {error('grade_level')}
              </Form.Group>
            </Col>
            <Col xs={6} sm={4}>
              <Form.Group controlId="class-year">
                <Form.Label>Year</Form.Label>
                <Form.Control {...field('academic_year')} type="number" inputMode="numeric" min={2000} max={2100} required />
                {error('academic_year')}
              </Form.Group>
            </Col>
            <Col xs={6} sm={4}>
              <Form.Group controlId="class-capacity">
                <Form.Label>Places</Form.Label>
                <Form.Control {...field('max_capacity')} type="number" inputMode="numeric" min={1} max={60} required />
                {error('max_capacity')}
              </Form.Group>
            </Col>
            {!editing && (
              <Col xs={12}>
                <Form.Group controlId="class-teacher">
                  <Form.Label>
                    Class teacher <span className="text-body-secondary fw-normal">(optional)</span>
                  </Form.Label>
                  <Form.Select {...field('teacher_id')}>
                    <option value="">Choose later</option>
                    {teachers.map((t) => (
                      <option key={t.user_id} value={t.user_id}>
                        {t.first_name} {t.last_name}
                      </option>
                    ))}
                  </Form.Select>
                  {error('teacher_id')}
                </Form.Group>
              </Col>
            )}
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.pending}>
            {save.pending && <Spinner size="sm" className="me-2" aria-hidden="true" />}
            {editing ? 'Save changes' : 'Create class'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default ClassFormModal;
