import { useId, useState } from 'react';
import { Button, Form, Modal, Spinner } from 'react-bootstrap';
import { useApi } from '../../../hooks/useApi';
import { useMutation } from '../../../hooks/useMutation';
import { GRADE_OPTIONS, gradeLabel } from '../../../lib/format';
import FormAlert from '../../../components/ui/FormAlert';

const thisYear = new Date().getFullYear();

/** Assigns an active curriculum to a school for one grade and year. */
const AssignCurriculumModal = ({ show, school, onClose, onAssigned }) => {
  const titleId = useId();
  const { data, loading } = useApi(show ? '/api/super-admin/curricula' : null);
  const [form, setForm] = useState({ curriculum_id: '', grade_level: 'R-3', academic_year: thisYear });
  const save = useMutation();

  const set = (name) => (e) => setForm((current) => ({ ...current, [name]: e.target.value }));
  const error = (name) =>
    save.fieldErrors[name] && <Form.Control.Feedback type="invalid">{save.fieldErrors[name]}</Form.Control.Feedback>;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await save.run('post', `/api/super-admin/schools/${school.school_id}/curricula`, {
      ...form,
      academic_year: Number(form.academic_year),
    });
    if (result.ok) onAssigned(result.message);
  };

  return (
    <Modal aria-labelledby={titleId} show={show} onHide={onClose} centered>
      <Form onSubmit={handleSubmit} noValidate>
        <Modal.Header closeButton>
          <Modal.Title id={titleId} as="h2" className="h5 mb-0">
            Assign a curriculum
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <FormAlert variant="danger">{save.error}</FormAlert>
          <Form.Group className="mb-3" controlId="assign-curriculum">
            <Form.Label>Curriculum</Form.Label>
            <Form.Select
              value={form.curriculum_id}
              onChange={set('curriculum_id')}
              isInvalid={Boolean(save.fieldErrors.curriculum_id)}
              disabled={loading}
              required
            >
              <option value="">{loading ? 'Loading curricula…' : 'Choose a curriculum'}</option>
              {data?.curricula.map((c) => (
                <option key={c.curriculum_id} value={c.curriculum_id}>
                  {c.curriculum_name}
                </option>
              ))}
            </Form.Select>
            {error('curriculum_id')}
          </Form.Group>
          <div className="d-flex gap-3">
            <Form.Group className="flex-fill" controlId="assign-grade">
              <Form.Label>Grade</Form.Label>
              <Form.Select value={form.grade_level} onChange={set('grade_level')}>
                {GRADE_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {gradeLabel(g)}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="flex-fill" controlId="assign-year">
              <Form.Label>Academic year</Form.Label>
              <Form.Select
                value={form.academic_year}
                onChange={set('academic_year')}
                isInvalid={Boolean(save.fieldErrors.academic_year)}
              >
                {[thisYear - 1, thisYear, thisYear + 1].map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </Form.Select>
              {error('academic_year')}
            </Form.Group>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={save.pending || !form.curriculum_id}>
            {save.pending && <Spinner size="sm" className="me-2" aria-hidden="true" />}
            Assign
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default AssignCurriculumModal;
