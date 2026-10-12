import { useState } from 'react';
import { Button, Form, Spinner } from 'react-bootstrap';
import { Link, useSearchParams } from 'react-router-dom';
import { LuArrowLeft, LuCircleCheck, LuLink2Off } from 'react-icons/lu';
import { useAuth } from '../../contexts/useAuth';
import AuthLayout from '../../components/auth/AuthLayout';
import FormAlert from '../../components/ui/FormAlert';
import PasswordField from '../../components/ui/PasswordField';
import { PASSWORD_MIN_LENGTH, validatePasswords } from '../../lib/passwords';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { resetPassword } = useAuth();
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setForm((current) => ({ ...current, [e.target.name]: e.target.value }));
    setFieldErrors((current) => ({ ...current, [e.target.name]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validatePasswords(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    setError(null);
    const result = await resetPassword(token, form.password);
    setSubmitting(false);
    if (result.ok) setDone(true);
    else setError(result.message);
  };

  if (!token) {
    return (
      <AuthLayout title="This link isn’t valid">
        <div className="el-success-state el-success-state--warning">
          <span className="el-success-state__icon">
            <LuLink2Off size={26} aria-hidden="true" />
          </span>
          <p>The reset link is incomplete. Request a new one and use the latest email we send you.</p>
          <Link to="/forgot-password" className="btn btn-primary w-100">
            Request a new link
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout title="Password updated">
        <div className="el-success-state">
          <span className="el-success-state__icon">
            <LuCircleCheck size={26} aria-hidden="true" />
          </span>
          <p>Your password has been changed and you’ve been signed out on other devices.</p>
          <Link to="/login" className="btn btn-primary btn-lg w-100">
            Sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="Pick something you haven’t used before."
      footer={
        <Link to="/login" className="d-inline-flex align-items-center gap-1 fw-semibold">
          <LuArrowLeft aria-hidden="true" /> Back to sign in
        </Link>
      }
    >
      <FormAlert variant="danger">
        {error && (
          <>
            {error}{' '}
            <Link to="/forgot-password" className="alert-link">
              Request a new link
            </Link>
          </>
        )}
      </FormAlert>
      <Form onSubmit={handleSubmit} noValidate>
        <PasswordField
          label="New password"
          name="password"
          value={form.password}
          onChange={handleChange}
          autoComplete="new-password"
          hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
          error={fieldErrors.password}
          autoFocus
        />
        <PasswordField
          label="Confirm new password"
          name="confirm"
          value={form.confirm}
          onChange={handleChange}
          autoComplete="new-password"
          error={fieldErrors.confirm}
        />
        <Button type="submit" variant="primary" size="lg" className="w-100 mt-2" disabled={submitting}>
          {submitting ? (
            <>
              <Spinner size="sm" className="me-2" aria-hidden="true" />
              Updating password…
            </>
          ) : (
            'Update password'
          )}
        </Button>
      </Form>
    </AuthLayout>
  );
};

export default ResetPassword;
