import { useState } from 'react';
import { Button, Form, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { LuArrowLeft, LuMailCheck } from 'react-icons/lu';
import { useAuth } from '../../contexts/useAuth';
import AuthLayout from '../../components/auth/AuthLayout';
import FormAlert from '../../components/ui/FormAlert';

const BackToSignIn = () => (
  <Link to="/login" className="d-inline-flex align-items-center gap-1 fw-semibold">
    <LuArrowLeft aria-hidden="true" /> Back to sign in
  </Link>
);

const ForgotPassword = () => {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [sentTo, setSentTo] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await forgotPassword(email);
    setSubmitting(false);
    if (result.ok) setSentTo(email);
    else setError(result.message);
  };

  if (sentTo) {
    return (
      <AuthLayout title="Check your email" footer={<BackToSignIn />}>
        <div className="el-success-state">
          <span className="el-success-state__icon">
            <LuMailCheck size={26} aria-hidden="true" />
          </span>
          <p className="mb-2">
            If an account exists for <strong className="text-break">{sentTo}</strong>, we’ve sent a link to reset
            the password. It expires in 1 hour.
          </p>
          <p className="small text-body-secondary mb-0">
            Nothing arrived? Check your spam folder, or{' '}
            <button type="button" className="btn btn-link btn-sm p-0 align-baseline" onClick={() => setSentTo(null)}>
              try again
            </button>
            .
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter the email address you sign in with and we’ll send you a reset link."
      footer={<BackToSignIn />}
    >
      <FormAlert variant="danger">{error}</FormAlert>
      <Form onSubmit={handleSubmit}>
        <Form.Group className="mb-4" controlId="forgot-email">
          <Form.Label>Email address</Form.Label>
          <Form.Control
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            placeholder="you@school.co.za"
            required
            autoFocus
          />
        </Form.Group>
        <Button type="submit" variant="primary" size="lg" className="w-100" disabled={submitting}>
          {submitting ? (
            <>
              <Spinner size="sm" className="me-2" aria-hidden="true" />
              Sending link…
            </>
          ) : (
            'Send reset link'
          )}
        </Button>
      </Form>
    </AuthLayout>
  );
};

export default ForgotPassword;
