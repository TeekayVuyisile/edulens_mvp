import React, { useState } from 'react';
import { Form, Button, Card, Container, Row, Col, Alert } from 'react-bootstrap';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const { resetPassword } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    
    setLoading(true);
    setError('');
    setMessage('');

    const result = await resetPassword(token, formData.password);
    
    if (result.success) {
      setMessage('Password reset successfully! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  if (!token) {
    return (
      <div className="min-vh-100 d-flex align-items-center bg-light">
        <Container>
          <Row className="justify-content-center">
            <Col xs={12} md={8} lg={6} xl={5}>
              <Alert variant="danger" className="text-center">
                Invalid or missing reset token. Please request a new password reset link.
              </Alert>
              <div className="text-center mt-3">
                <Link to="/forgot-password" className="btn btn-primary">
                  Request New Reset Link
                </Link>
              </div>
            </Col>
          </Row>
        </Container>
      </div>
    );
  }

  return (
    <div className="min-vh-100 d-flex align-items-center bg-light">
      <Container>
        <Row className="justify-content-center">
          <Col xs={12} md={8} lg={6} xl={5}>
            <div className="text-center mb-4">
              <h1 className="text-primary fw-bold">
                <i className="bi bi-mortarboard-fill me-2"></i>
                Edulens LMS
              </h1>
            </div>
            
            <Card className="shadow-sm border-0">
              <Card.Body className="p-4 p-md-5">
                <h2 className="text-center mb-4">Reset Your Password</h2>
                <p className="text-center text-muted mb-4">
                  Enter your new password below.
                </p>
                
                {message && (
                  <Alert variant="success" className="text-center">
                    <i className="bi bi-check-circle-fill me-2"></i>
                    {message}
                  </Alert>
                )}
                
                {error && (
                  <Alert variant="danger" className="text-center">
                    <i className="bi bi-exclamation-triangle-fill me-2"></i>
                    {error}
                  </Alert>
                )}
                
                <Form onSubmit={handleSubmit}>
                  <Form.Group className="mb-3">
                    <Form.Label>New Password</Form.Label>
                    <Form.Control
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Enter new password"
                      required
                      size="lg"
                    />
                    <Form.Text className="text-muted">
                      Must be at least 6 characters long.
                    </Form.Text>
                  </Form.Group>

                  <Form.Group className="mb-4">
                    <Form.Label>Confirm New Password</Form.Label>
                    <Form.Control
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="Confirm new password"
                      required
                      size="lg"
                    />
                  </Form.Group>

                  <Button
                    variant="primary"
                    type="submit"
                    size="lg"
                    className="w-100 mb-3"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Resetting...
                      </>
                    ) : (
                      'Reset Password'
                    )}
                  </Button>
                </Form>

                <div className="text-center mt-4">
                  <Link to="/login" className="text-decoration-none">
                    <i className="bi bi-arrow-left me-2"></i>
                    Back to Login
                  </Link>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default ResetPassword;