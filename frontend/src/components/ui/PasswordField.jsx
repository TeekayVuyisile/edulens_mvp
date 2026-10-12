import { useId, useState } from 'react';
import { Form } from 'react-bootstrap';
import { LuEye, LuEyeOff } from 'react-icons/lu';

/** Password input with a show/hide toggle and optional hint or error. */
const PasswordField = ({ label, value, onChange, name = 'password', autoComplete, error, hint, ...rest }) => {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;

  return (
    <Form.Group className="mb-3" controlId={id}>
      <Form.Label>{label}</Form.Label>
      <div className="el-password">
        <Form.Control
          type={visible ? 'text' : 'password'}
          name={name}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          isInvalid={Boolean(error)}
          aria-describedby={describedBy}
          {...rest}
        />
        <button
          type="button"
          className="el-password__toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
        >
          {visible ? <LuEyeOff size={18} aria-hidden="true" /> : <LuEye size={18} aria-hidden="true" />}
        </button>
      </div>
      {hint && !error && (
        <Form.Text id={`${id}-hint`} className="text-body-secondary">
          {hint}
        </Form.Text>
      )}
      {error && (
        <div id={`${id}-error`} className="invalid-feedback d-block">
          {error}
        </div>
      )}
    </Form.Group>
  );
};

export default PasswordField;
