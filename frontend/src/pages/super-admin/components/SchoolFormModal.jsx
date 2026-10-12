import { useId, useState } from 'react';
import { Button, Col, Form, Modal, Row, Spinner } from 'react-bootstrap';
import { useMutation } from '../../../hooks/useMutation';
import { PROVINCES } from '../../../lib/format';
import FormAlert from '../../../components/ui/FormAlert';

const EMPTY = {
  school_name: '',
  contact_email: '',
  contact_phone: '',
  address: '',
  city: '',
  province: '',
  country: 'South Africa',
};

const fromSchool = (school) =>
  Object.fromEntries(Object.keys(EMPTY).map((key) => [key, school?.[key] ?? EMPTY[key]]));

/** Create a school (school = null) or edit one. Calls onSaved(school) on success. */
const SchoolFormModal = ({ show, school, onClose, onSaved }) => {
  const titleId = useId();
  const editing = Boolean(school);
  const [form, setForm] = useState(() => fromSchool(school));
  const save = useMutation();

  const set = (field) => (e) => setForm((current) => ({ ...current, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = editing
      ? await save.run('put', `/api/super-admin/schools/${school.school_id}`, form)
      : await save.run('post', '/api/super-admin/schools', form);
    if (result.ok) onSaved(result.data.school, result.message);
  };

  const field = (name) => ({
    value: form[name],
    onChange: set(name),
    isInvalid: Boolean(save.fieldErrors[name]),
  });

  const error = (name) =>
    save.fieldErrors[name] && <Form.Control.Feedback type="invalid">{save.fieldErrors[name]}</Form.Control.Feedback>;

  return (
    <Modal aria-labelledby={titleId} show={show} onHide={onClose} size="lg" centered backdrop={save.pending ? 'static' : true}>
      <Form onSubmit={handleSubmit} noValidate>
        <Modal.Header closeButton>
          <Modal.Title id={titleId} as="h2" className="h5 mb-0">
            {editing ? `Edit ${school.school_name}` : 'Add a school'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <FormAlert variant="danger">{save.error}</FormAlert>
          <Row className="g-3">
            <Col xs={12}>
              <Form.Group controlId="school-name">
                <Form.Label>School name</Form.Label>
                <Form.Control {...field('school_name')} required autoFocus placeholder="e.g. Galeshewe Primary School" />
                {error('school_name')}
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group controlId="school-email">
                <Form.Label>Contact email</Form.Label>
                <Form.Control {...field('contact_email')} type="email" autoComplete="email" required />
                {error('contact_email')}
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group controlId="school-phone">
                <Form.Label>
                  Contact phone <span className="text-body-secondary fw-normal">(optional)</span>
                </Form.Label>
                <Form.Control {...field('contact_phone')} type="tel" autoComplete="tel" inputMode="tel" />
                {error('contact_phone')}
              </Form.Group>
            </Col>
            <Col xs={12}>
              <Form.Group controlId="school-address">
                <Form.Label>
                  Street address <span className="text-body-secondary fw-normal">(optional)</span>
                </Form.Label>
                <Form.Control {...field('address')} autoComplete="street-address" />
                {error('address')}
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group controlId="school-city">
                <Form.Label>City or town</Form.Label>
                <Form.Control {...field('city')} autoComplete="address-level2" />
                {error('city')}
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group controlId="school-province">
                <Form.Label>Province</Form.Label>
                <Form.Select {...field('province')}>
                  <option value="">Choose a province</option>
                  {PROVINCES.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </Form.Select>
                {error('province')}
              </Form.Group>
            </Col>
          </Row>
          {!editing && (
            <p className="small text-body-secondary mt-3 mb-0">
              A school code is generated from the name. You can invite the school’s administrator next.
            </p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={save.pending}>
            {save.pending && <Spinner size="sm" className="me-2" aria-hidden="true" />}
            {editing ? 'Save changes' : 'Add school'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default SchoolFormModal;
