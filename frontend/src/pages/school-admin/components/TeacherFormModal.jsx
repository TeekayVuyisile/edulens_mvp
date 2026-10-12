import { useId, useState } from 'react';
import { Button, Col, Form, Modal, Row, Spinner } from 'react-bootstrap';
import { useMutation } from '../../../hooks/useMutation';
import FormAlert from '../../../components/ui/FormAlert';

/**
 * Invites a teacher (no `teacher`) or edits one. Calls onSaved(data, message);
 * after an invite, data is { teacher, invite } so the caller can show the link.
 */
const TeacherFormModal = ({ teacher, onClose, onSaved }) => {
  const titleId = useId();
  const editing = Boolean(teacher);
  const [form, setForm] = useState({
    first_name: teacher?.first_name ?? '',
    last_name: teacher?.last_name ?? '',
    email: teacher?.email ?? '',
    phone: teacher?.phone ?? '',
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
    const result = editing
      ? await save.run('put', `/api/school-admin/teachers/${teacher.user_id}`, form)
      : await save.run('post', '/api/school-admin/teachers', form);
    if (result.ok) onSaved(result.data, result.message);
  };

  return (
    <Modal aria-labelledby={titleId} show onHide={onClose} centered backdrop={save.pending ? 'static' : true}>
      <Form onSubmit={handleSubmit} noValidate>
        <Modal.Header closeButton>
          <Modal.Title id={titleId} as="h2" className="h5 mb-0">
            {editing ? `Edit ${teacher.first_name} ${teacher.last_name}` : 'Invite a teacher'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {!editing && (
            <p className="text-body-secondary">
              They’ll get a link to choose their own password. You can also share the link on WhatsApp.
            </p>
          )}
          <FormAlert variant="danger">{save.error}</FormAlert>
          <Row className="g-3">
            <Col sm={6}>
              <Form.Group controlId="teacher-first">
                <Form.Label>First name</Form.Label>
                <Form.Control {...field('first_name')} autoComplete="off" autoFocus required />
                {error('first_name')}
              </Form.Group>
            </Col>
            <Col sm={6}>
              <Form.Group controlId="teacher-last">
                <Form.Label>Last name</Form.Label>
                <Form.Control {...field('last_name')} autoComplete="off" required />
                {error('last_name')}
              </Form.Group>
            </Col>
            <Col xs={12}>
              <Form.Group controlId="teacher-email">
                <Form.Label>Email address</Form.Label>
                <Form.Control {...field('email')} type="email" autoComplete="off" required />
                {error('email')}
              </Form.Group>
            </Col>
            <Col xs={12}>
              <Form.Group controlId="teacher-phone">
                <Form.Label>
                  Mobile number <span className="text-body-secondary fw-normal">(optional)</span>
                </Form.Label>
                <Form.Control {...field('phone')} type="tel" inputMode="tel" autoComplete="off" />
                {error('phone')}
              </Form.Group>
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.pending}>
            {save.pending && <Spinner size="sm" className="me-2" aria-hidden="true" />}
            {editing ? 'Save changes' : 'Send invitation'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default TeacherFormModal;
