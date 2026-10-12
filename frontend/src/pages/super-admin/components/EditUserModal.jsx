import { useId, useState } from 'react';
import { Button, Col, Form, Modal, Row, Spinner } from 'react-bootstrap';
import { useMutation } from '../../../hooks/useMutation';
import FormAlert from '../../../components/ui/FormAlert';

/** Edits a staff member's name, contact details and school. */
const EditUserModal = ({ user, schools, onClose, onSaved }) => {
  const titleId = useId();
  const [form, setForm] = useState({
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    phone: user.phone ?? '',
    school_id: user.school_id ?? '',
  });
  const save = useMutation();
  // The list holds active schools; keep the person's current school selectable even if it isn't.
  const schoolOptions = schools.some((s) => s.school_id === user.school_id)
    ? schools
    : [{ school_id: user.school_id, school_name: `${user.school_name} (inactive)` }, ...schools];

  const field = (name) => ({
    value: form[name],
    onChange: (e) => setForm({ ...form, [name]: e.target.value }),
    isInvalid: Boolean(save.fieldErrors[name]),
  });
  const error = (name) => <Form.Control.Feedback type="invalid">{save.fieldErrors[name]}</Form.Control.Feedback>;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await save.run('put', `/api/super-admin/users/${user.user_id}`, form);
    if (result.ok) onSaved(result.message);
  };

  return (
    <Modal aria-labelledby={titleId} show onHide={onClose} centered>
      <Form onSubmit={handleSubmit} noValidate>
        <Modal.Header closeButton>
          <Modal.Title id={titleId} as="h2" className="h5 mb-0">
            Edit {user.first_name} {user.last_name}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <FormAlert variant="danger">{save.error}</FormAlert>
          <Row className="g-3">
            <Col sm={6}>
              <Form.Group controlId="edit-first">
                <Form.Label>First name</Form.Label>
                <Form.Control {...field('first_name')} required />
                {error('first_name')}
              </Form.Group>
            </Col>
            <Col sm={6}>
              <Form.Group controlId="edit-last">
                <Form.Label>Last name</Form.Label>
                <Form.Control {...field('last_name')} required />
                {error('last_name')}
              </Form.Group>
            </Col>
            <Col xs={12}>
              <Form.Group controlId="edit-email">
                <Form.Label>Email address</Form.Label>
                <Form.Control {...field('email')} type="email" required />
                {error('email')}
              </Form.Group>
            </Col>
            <Col xs={12}>
              <Form.Group controlId="edit-phone">
                <Form.Label>
                  Mobile number <span className="text-body-secondary fw-normal">(optional)</span>
                </Form.Label>
                <Form.Control {...field('phone')} type="tel" inputMode="tel" />
                {error('phone')}
              </Form.Group>
            </Col>
            <Col xs={12}>
              <Form.Group controlId="edit-school">
                <Form.Label>School</Form.Label>
                <Form.Select {...field('school_id')}>
                  {schoolOptions.map((s) => (
                    <option key={s.school_id} value={s.school_id}>
                      {s.school_name}
                    </option>
                  ))}
                </Form.Select>
                {error('school_id')}
                {form.school_id !== user.school_id && (
                  <Form.Text className="text-body-secondary">
                    Moving someone to another school removes them from their current school’s screens.
                  </Form.Text>
                )}
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
            Save changes
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default EditUserModal;
