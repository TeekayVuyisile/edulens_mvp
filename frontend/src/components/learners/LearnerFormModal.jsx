import { useId, useState } from 'react';
import { Button, Col, Form, Modal, Row, Spinner } from 'react-bootstrap';
import { useMutation } from '../../hooks/useMutation';
import { GENDERS, gradeLabel } from '../../lib/format';
import FormAlert from '../ui/FormAlert';

// Foundation Phase learners are 3–12 (the API checks the same range).
const isoDaysAgo = (years) => {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  return date.toISOString().slice(0, 10);
};

const blank = {
  first_name: '',
  last_name: '',
  date_of_birth: '',
  gender: '',
  admission_number: '',
  class_id: '',
  guardian_name: '',
  guardian_phone: '',
  guardian_email: '',
  has_special_needs: false,
  special_needs_notes: '',
  medical_notes: '',
};

/**
 * Adds a learner (no `learner`) or edits one. When adding, `classes` lists the
 * classes they can be placed in (omit it when `createUrl` already fixes the class);
 * moving an existing learner has its own dialog.
 * apiBase: '/api/school-admin' or '/api/teacher' (whose learners/:id the edit goes to).
 */
const LearnerFormModal = ({
  learner,
  classes = [],
  defaultClassId = '',
  apiBase = '/api/school-admin',
  createUrl = `${apiBase}/learners`,
  title,
  onClose,
  onSaved,
}) => {
  const titleId = useId();
  const editing = Boolean(learner);
  const [form, setForm] = useState(() =>
    editing
      ? Object.fromEntries(Object.keys(blank).map((key) => [key, learner[key] ?? blank[key]]))
      : { ...blank, class_id: defaultClassId }
  );
  const save = useMutation();

  const set = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  const field = (name) => ({
    value: form[name],
    onChange: (e) => set(name, e.target.value),
    isInvalid: Boolean(save.fieldErrors[name]),
  });
  const error = (name) => <Form.Control.Feedback type="invalid">{save.fieldErrors[name]}</Form.Control.Feedback>;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { class_id: classId, ...details } = form;
    const result = editing
      ? await save.run('put', `${apiBase}/learners/${learner.learner_id}`, details)
      : await save.run('post', createUrl, { ...details, class_id: classId || null });
    if (result.ok) onSaved(result.data.learner, result.message);
  };

  return (
    <Modal aria-labelledby={titleId} show onHide={onClose} centered size="lg" backdrop={save.pending ? 'static' : true}>
      <Form onSubmit={handleSubmit} noValidate>
        <Modal.Header closeButton>
          <Modal.Title id={titleId} as="h2" className="h5 mb-0">
            {title ?? (editing ? `Edit ${learner.first_name} ${learner.last_name}` : 'Add a learner')}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <FormAlert variant="danger">{save.error}</FormAlert>

          <fieldset className="el-fieldset">
            <legend className="el-fieldset__legend">Learner</legend>
            <Row className="g-3">
              <Col sm={6}>
                <Form.Group controlId="learner-first">
                  <Form.Label>First name</Form.Label>
                  <Form.Control {...field('first_name')} autoComplete="off" autoFocus required />
                  {error('first_name')}
                </Form.Group>
              </Col>
              <Col sm={6}>
                <Form.Group controlId="learner-last">
                  <Form.Label>Last name</Form.Label>
                  <Form.Control {...field('last_name')} autoComplete="off" required />
                  {error('last_name')}
                </Form.Group>
              </Col>
              <Col sm={6}>
                <Form.Group controlId="learner-dob">
                  <Form.Label>Date of birth</Form.Label>
                  <Form.Control {...field('date_of_birth')} type="date" min={isoDaysAgo(12)} max={isoDaysAgo(3)} required />
                  {error('date_of_birth')}
                </Form.Group>
              </Col>
              <Col sm={6}>
                <Form.Group controlId="learner-gender">
                  <Form.Label>
                    Gender <span className="text-body-secondary fw-normal">(optional)</span>
                  </Form.Label>
                  <Form.Select {...field('gender')}>
                    <option value="">Not specified</option>
                    {GENDERS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </Form.Select>
                  {error('gender')}
                </Form.Group>
              </Col>
              <Col sm={6}>
                <Form.Group controlId="learner-admission">
                  <Form.Label>
                    Admission number <span className="text-body-secondary fw-normal">(optional)</span>
                  </Form.Label>
                  <Form.Control {...field('admission_number')} autoComplete="off" />
                  {error('admission_number')}
                </Form.Group>
              </Col>
              {!editing && classes.length > 0 && (
                <Col sm={6}>
                  <Form.Group controlId="learner-class">
                    <Form.Label>Class</Form.Label>
                    <Form.Select {...field('class_id')}>
                      <option value="">Place in a class later</option>
                      {classes.map((c) => {
                        const full = c.learner_count >= c.max_capacity;
                        return (
                          <option key={c.class_id} value={c.class_id} disabled={full}>
                            {c.class_name} · {gradeLabel(c.grade_level)}
                            {full ? ' (full)' : ` (${c.max_capacity - c.learner_count} places)`}
                          </option>
                        );
                      })}
                    </Form.Select>
                    {error('class_id')}
                  </Form.Group>
                </Col>
              )}
            </Row>
          </fieldset>

          <fieldset className="el-fieldset">
            <legend className="el-fieldset__legend">Parent or guardian</legend>
            <Row className="g-3">
              <Col xs={12}>
                <Form.Group controlId="learner-guardian">
                  <Form.Label>Name</Form.Label>
                  <Form.Control {...field('guardian_name')} autoComplete="off" />
                  {error('guardian_name')}
                </Form.Group>
              </Col>
              <Col sm={6}>
                <Form.Group controlId="learner-guardian-phone">
                  <Form.Label>Mobile number</Form.Label>
                  <Form.Control {...field('guardian_phone')} type="tel" inputMode="tel" autoComplete="off" />
                  {error('guardian_phone')}
                </Form.Group>
              </Col>
              <Col sm={6}>
                <Form.Group controlId="learner-guardian-email">
                  <Form.Label>Email address</Form.Label>
                  <Form.Control {...field('guardian_email')} type="email" autoComplete="off" />
                  {error('guardian_email')}
                </Form.Group>
              </Col>
            </Row>
          </fieldset>

          <fieldset className="el-fieldset mb-0">
            <legend className="el-fieldset__legend">Support and health</legend>
            <Form.Check
              type="switch"
              id="learner-support"
              label="Needs extra learning support"
              checked={Boolean(form.has_special_needs)}
              onChange={(e) => set('has_special_needs', e.target.checked)}
              className="mb-3"
            />
            <Row className="g-3">
              {form.has_special_needs && (
                <Col xs={12}>
                  <Form.Group controlId="learner-support-notes">
                    <Form.Label>Support notes</Form.Label>
                    <Form.Control {...field('special_needs_notes')} as="textarea" rows={2} />
                    {error('special_needs_notes')}
                  </Form.Group>
                </Col>
              )}
              <Col xs={12}>
                <Form.Group controlId="learner-medical">
                  <Form.Label>
                    Medical notes <span className="text-body-secondary fw-normal">(allergies, chronic conditions)</span>
                  </Form.Label>
                  <Form.Control {...field('medical_notes')} as="textarea" rows={2} />
                  {error('medical_notes')}
                </Form.Group>
              </Col>
            </Row>
          </fieldset>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.pending}>
            {save.pending && <Spinner size="sm" className="me-2" aria-hidden="true" />}
            {editing ? 'Save changes' : 'Add learner'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default LearnerFormModal;
