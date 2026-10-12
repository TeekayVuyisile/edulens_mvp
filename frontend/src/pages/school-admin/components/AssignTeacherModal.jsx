import { useId, useState } from 'react';
import { Button, Form, Modal, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useMutation } from '../../../hooks/useMutation';
import FormAlert from '../../../components/ui/FormAlert';

/** Adds a teacher to a class as its class teacher or as a support teacher. */
const AssignTeacherModal = ({ klass, teachers, onClose, onSaved }) => {
  const titleId = useId();
  const assigned = new Set(klass.teachers.map((t) => t.user_id));
  const available = teachers.filter((t) => !assigned.has(t.user_id));
  const classTeacher = klass.teachers.find((t) => t.is_primary);
  const [teacherId, setTeacherId] = useState(available[0]?.user_id ?? '');
  const [isPrimary, setIsPrimary] = useState(!classTeacher);
  const save = useMutation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await save.run('post', `/api/school-admin/classes/${klass.class_id}/teachers`, {
      teacher_id: teacherId,
      is_primary: isPrimary,
    });
    if (result.ok) onSaved(result.message);
  };

  return (
    <Modal aria-labelledby={titleId} show onHide={onClose} centered backdrop={save.pending ? 'static' : true}>
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title id={titleId} as="h2" className="h5 mb-0">
            Assign a teacher to {klass.class_name}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <FormAlert variant="danger">{save.error}</FormAlert>
          {available.length === 0 ? (
            <p className="mb-0 text-body-secondary">
              Every active teacher is already assigned to this class.{' '}
              <Link to="/school-admin/teachers">Invite another teacher</Link>.
            </p>
          ) : (
            <>
              <Form.Group controlId="assign-teacher" className="mb-3">
                <Form.Label>Teacher</Form.Label>
                <Form.Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} autoFocus>
                  {available.map((t) => (
                    <option key={t.user_id} value={t.user_id}>
                      {t.first_name} {t.last_name}
                      {t.last_login ? '' : ' (invite pending)'}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
              <fieldset>
                <legend className="form-label">Role in this class</legend>
                <Form.Check
                  type="radio"
                  id="role-primary"
                  name="role"
                  label="Class teacher"
                  checked={isPrimary}
                  onChange={() => setIsPrimary(true)}
                />
                <Form.Check
                  type="radio"
                  id="role-support"
                  name="role"
                  label="Support teacher"
                  checked={!isPrimary}
                  onChange={() => setIsPrimary(false)}
                />
                <Form.Text className="text-body-secondary">
                  {isPrimary && classTeacher
                    ? `${classTeacher.first_name} ${classTeacher.last_name} will become a support teacher.`
                    : 'Every teacher in a class can see its learners and record marks.'}
                </Form.Text>
              </fieldset>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.pending || !teacherId}>
            {save.pending && <Spinner size="sm" className="me-2" aria-hidden="true" />}
            Assign teacher
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default AssignTeacherModal;
