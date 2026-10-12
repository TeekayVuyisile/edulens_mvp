import { useId, useState } from 'react';
import { Button, Form, Modal, Spinner } from 'react-bootstrap';
import { useMutation } from '../../../hooks/useMutation';
import { gradeLabel } from '../../../lib/format';
import FormAlert from '../../../components/ui/FormAlert';

/** Puts a learner in another class, or takes them out of their class. */
const MoveLearnerModal = ({ learner, classes, onClose, onSaved }) => {
  const titleId = useId();
  const [classId, setClassId] = useState(learner.current_class_id ?? '');
  const save = useMutation();
  const unchanged = classId === (learner.current_class_id ?? '');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await save.run('patch', `/api/school-admin/learners/${learner.learner_id}/class`, {
      class_id: classId || null,
    });
    if (result.ok) onSaved(result.data.learner, result.message);
  };

  return (
    <Modal aria-labelledby={titleId} show onHide={onClose} centered backdrop={save.pending ? 'static' : true}>
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title id={titleId} as="h2" className="h5 mb-0">
            Move {learner.first_name} {learner.last_name}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <FormAlert variant="danger">{save.error}</FormAlert>
          <Form.Group controlId="move-class">
            <Form.Label>Class</Form.Label>
            <Form.Select value={classId} onChange={(e) => setClassId(e.target.value)} autoFocus>
              <option value="">Not in a class</option>
              {classes.map((c) => {
                const current = c.class_id === learner.current_class_id;
                const full = !current && c.learner_count >= c.max_capacity;
                return (
                  <option key={c.class_id} value={c.class_id} disabled={full}>
                    {c.class_name} · {gradeLabel(c.grade_level)}
                    {current ? ' (current class)' : full ? ' (full)' : ` (${c.max_capacity - c.learner_count} places)`}
                  </option>
                );
              })}
            </Form.Select>
            <Form.Text className="text-body-secondary">
              Their marks stay with them, and the move is recorded in their class history.
            </Form.Text>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.pending || unchanged}>
            {save.pending && <Spinner size="sm" className="me-2" aria-hidden="true" />}
            {classId ? 'Move learner' : 'Take out of class'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default MoveLearnerModal;
