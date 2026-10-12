import { useId, useState } from 'react';
import { Button, Modal, Spinner } from 'react-bootstrap';
import FormAlert from './FormAlert';

/**
 * Asks before an action with consequences. onConfirm may return a promise
 * resolving to { ok, message }; the dialog stays open and shows the message
 * when ok is false (e.g. "deactivate it instead").
 */
const ConfirmDialog = ({
  show,
  title,
  children,
  confirmLabel = 'Confirm',
  variant = 'danger',
  onConfirm,
  onClose,
}) => {
  const titleId = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  const handleConfirm = async () => {
    setPending(true);
    setError(null);
    const result = await onConfirm();
    setPending(false);
    if (result && result.ok === false) setError(result.message);
    else onClose();
  };

  const handleClose = () => {
    if (pending) return;
    setError(null);
    onClose();
  };

  return (
    <Modal aria-labelledby={titleId} show={show} onHide={handleClose} centered>
      <Modal.Header closeButton>
        <Modal.Title id={titleId} as="h2" className="h5 mb-0">
          {title}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <FormAlert variant="danger">{error}</FormAlert>
        <div className="text-body-secondary">{children}</div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="light" onClick={handleClose} disabled={pending}>
          Cancel
        </Button>
        <Button variant={variant} onClick={handleConfirm} disabled={pending}>
          {pending && <Spinner size="sm" className="me-2" aria-hidden="true" />}
          {confirmLabel}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ConfirmDialog;
