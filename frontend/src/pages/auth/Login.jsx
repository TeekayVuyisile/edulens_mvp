import { useState } from 'react';
import { Button, Form, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/useAuth';
import AuthLayout from '../../components/auth/AuthLayout';
import DemoSignIn from '../../components/auth/DemoSignIn';
import FormAlert from '../../components/ui/FormAlert';
import PasswordField from '../../components/ui/PasswordField';

const Login = () => {
  const { login, notice, dismissNotice } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setForm((current) => ({ ...current, [e.target.name]: e.target.value }));
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    dismissNotice();

    // On success PublicOnlyRoute moves on to the page the user originally asked for.
    const result = await login(form.email, form.password);
    if (result.ok) return;
    setError(result.message);
    setSubmitting(false);
  };

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Welcome back. Sign in with your school email address."
      footer={<>Don’t have an account? Your school administrator creates accounts for staff.</>}
    >
      <FormAlert variant="info">{!error && notice}</FormAlert>
      <FormAlert variant="danger">{error}</FormAlert>

      <DemoSignIn onError={setError} />

      <Form onSubmit={handleSubmit} noValidate={false}>
        <Form.Group className="mb-3" controlId="login-email">
          <Form.Label>Email address</Form.Label>
          <Form.Control
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            autoComplete="email"
            inputMode="email"
            placeholder="you@school.co.za"
            required
            autoFocus
          />
        </Form.Group>

        <PasswordField
          label="Password"
          value={form.password}
          onChange={handleChange}
          autoComplete="current-password"
          required
        />

        <div className="d-flex justify-content-end mb-4">
          <Link to="/forgot-password" className="small fw-semibold">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" variant="primary" size="lg" className="w-100" disabled={submitting}>
          {submitting ? (
            <>
              <Spinner size="sm" className="me-2" aria-hidden="true" />
              Signing in…
            </>
          ) : (
            'Sign in'
          )}
        </Button>
      </Form>
    </AuthLayout>
  );
};

export default Login;
