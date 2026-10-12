import { useId, useState } from 'react';
import { Button, Col, Form, Modal, Row, Spinner } from 'react-bootstrap';
import { useMutation } from '../../../hooks/useMutation';
import FormAlert from '../../../components/ui/FormAlert';

/**
 * Invites a staff member. With `school`, invites a school admin to that school;
 * otherwise the role and school are chosen here (schools = active schools).
 * Calls onInvited({ user, invite }) so the caller can show the link.
 */
const InviteStaffModal = ({ show, school, schools = [], onClose, onInvited }) => {
  const titleId = useId();
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    role: 'school_admin',
    school_id: school?.school_id ?? '',
  });
  const save = useMutation();

  const set = (name) => (e) => setForm((current) => ({ ...current, [name]: e.target.value }));
  const field = (name) => ({ value: form[name], onChange: set(name), isInvalid: Boolean(save.fieldErrors[name]) });
  const error = (name) =>
    save.fieldErrors[name] && <Form.Control.Feedback type="invalid">{save.fieldErrors[name]}</Form.Control.Feedback>;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { role, school_id, ...person } = form;
    const result = school
      ? await save.run('post', `/api/super-admin/schools/${school.school_id}/admins`, person)
      : await save.run('post', '/api/super-admin/users', { ...person, role, school_id });
    if (result.ok) onInvited(result.data, result.message);
  };

  return (
    <Modal aria-labelledby={titleId} show={show} onHide={onClose} centered backdrop={save.pending ? 'static' : true}>
      <Form onSubmit={handleSubmit} noValidate>
        <Modal.Header closeButton>
          <Modal.Title id={titleId} as="h2" className="h5 mb-0">
            {school ? `Invite an administrator to ${school.school_name}` : 'Invite staff'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-body-secondary">
            They’ll get a link to choose their own password. Nobody else ever sees it.
          </p>
          <FormAlert variant="danger">{save.error}</FormAlert>
          <Row className="g-3">
            <Col sm={6}>
              <Form.Group controlId="invite-first">
                <Form.Label>First name</Form.Label>
                <Form.Control {...field('first_name')} autoComplete="off" autoFocus required />
                {error('first_name')}
              </Form.Group>
            </Col>
            <Col sm={6}>
              <Form.Group controlId="invite-last">
                <Form.Label>Last name</Form.Label>
                <Form.Control {...field('last_name')} autoComplete="off" required />
                {error('last_name')}
              </Form.Group>
            </Col>
            <Col xs={12}>
              <Form.Group controlId="invite-email">
                <Form.Label>Email address</Form.Label>
                <Form.Control {...field('email')} type="email" autoComplete="off" required />
                {error('email')}
              </Form.Group>
            </Col>
            <Col xs={12}>
              <Form.Group controlId="invite-phone">
                <Form.Label>
                  Mobile number <span className="text-body-secondary fw-normal">(optional)</span>
                </Form.Label>
                <Form.Control {...field('phone')} type="tel" inputMode="tel" autoComplete="off" />
                {error('phone')}
              </Form.Group>
            </Col>
            {!school && (
              <>
                <Col sm={6}>
                  <Form.Group controlId="invite-role">
                    <Form.Label>Role</Form.Label>
                    <Form.Select {...field('role')}>
                      <option value="school_admin">School Admin</option>
                      <option value="teacher">Teacher</option>
                    </Form.Select>
                    {error('role')}
                  </Form.Group>
                </Col>
                <Col sm={6}>
                  <Form.Group controlId="invite-school">
                    <Form.Label>School</Form.Label>
                    <Form.Select {...field('school_id')} required>
                      <option value="">Choose a school</option>
                      {schools.map((s) => (
                        <option key={s.school_id} value={s.school_id}>
                          {s.school_name}
                        </option>
                      ))}
                    </Form.Select>
                    {error('school_id')}
                  </Form.Group>
                </Col>
              </>
            )}
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={save.pending}>
            {save.pending && <Spinner size="sm" className="me-2" aria-hidden="true" />}
            Send invitation
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default InviteStaffModal;
