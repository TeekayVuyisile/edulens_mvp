import React, { useState } from 'react';
import { Form, Button, Card, Container, Row, Col, Alert } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const { forgotPassword } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    const result = await forgotPassword(email);
    
    if (result.success) {
      setMessage('If an account exists with this email, you will receive password reset instructions.');
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

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
                <h2 className="text-center mb-4">Forgot Password</h2>
                <p className="text-center text-muted mb-4">
                  Enter your email address and we'll send you instructions to reset your password.
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
                  <Form.Group className="mb-4">
                    <Form.Label>Email Address</Form.Label>
                    <Form.Control
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
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
                        Sending...
                      </>
                    ) : (
                      'Send Reset Instructions'
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

            <div className="text-center mt-4">
              <p className="text-muted small">
                Need help? Contact your school administrator.
              </p>
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default ForgotPassword;