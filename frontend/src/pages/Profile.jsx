import React, { useState } from 'react';
import { Form, Button, Card, Row, Col, Tab, Nav } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';

const Profile = () => {
  const { user, updateProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    await updateProfile(formData);
    setLoading(false);
  };

  return (
    <div>
      <div className="mb-4">
        <h1 className="h3 mb-2">Profile Settings</h1>
        <p className="text-muted">Manage your account information and preferences</p>
      </div>

      <Tab.Container defaultActiveKey="profile">
        <Row>
          <Col lg={3} className="mb-4">
            <Card className="border-0 shadow-sm">
              <Card.Body className="p-3">
                <Nav variant="pills" className="flex-column">
                  <Nav.Item>
                    <Nav.Link eventKey="profile" className="d-flex align-items-center">
                      <i className="bi bi-person me-2"></i>
                      Personal Information
                    </Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link eventKey="security" className="d-flex align-items-center">
                      <i className="bi bi-shield me-2"></i>
                      Security
                    </Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link eventKey="preferences" className="d-flex align-items-center">
                      <i className="bi bi-gear me-2"></i>
                      Preferences
                    </Nav.Link>
                  </Nav.Item>
                </Nav>
              </Card.Body>
            </Card>
          </Col>

          <Col lg={9}>
            <Tab.Content>
              <Tab.Pane eventKey="profile">
                <Card className="border-0 shadow-sm">
                  <Card.Body className="p-4">
                    <div className="text-center mb-4">
                      <div className="position-relative d-inline-block">
                        <div className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center" 
                             style={{ width: '100px', height: '100px', fontSize: '2.5rem' }}>
                          {user?.first_name?.[0]}{user?.last_name?.[0]}
                        </div>
                        <button className="btn btn-light btn-sm position-absolute bottom-0 end-0 rounded-circle">
                          <i className="bi bi-camera"></i>
                        </button>
                      </div>
                      <h4 className="mt-3">{user?.first_name} {user?.last_name}</h4>
                      <p className="text-muted">{user?.email}</p>
                    </div>

                    <Form onSubmit={handleSubmit}>
                      <Row>
                        <Col md={6} className="mb-3">
                          <Form.Label>First Name</Form.Label>
                          <Form.Control
                            type="text"
                            name="first_name"
                            value={formData.first_name}
                            onChange={handleChange}
                            required
                          />
                        </Col>
                        <Col md={6} className="mb-3">
                          <Form.Label>Last Name</Form.Label>
                          <Form.Control
                            type="text"
                            name="last_name"
                            value={formData.last_name}
                            onChange={handleChange}
                            required
                          />
                        </Col>
                      </Row>

                      <Row>
                        <Col md={6} className="mb-3">
                          <Form.Label>Email Address</Form.Label>
                          <Form.Control
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                            disabled
                          />
                          <Form.Text className="text-muted">
                            Contact administrator to change email
                          </Form.Text>
                        </Col>
                        <Col md={6} className="mb-3">
                          <Form.Label>Phone Number</Form.Label>
                          <Form.Control
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            placeholder="Enter phone number"
                          />
                        </Col>
                      </Row>

                      <div className="d-flex justify-content-end mt-4">
                        <Button
                          variant="primary"
                          type="submit"
                          disabled={loading}
                        >
                          {loading ? 'Saving...' : 'Save Changes'}
                        </Button>
                      </div>
                    </Form>
                  </Card.Body>
                </Card>
              </Tab.Pane>

              <Tab.Pane eventKey="security">
                <Card className="border-0 shadow-sm">
                  <Card.Body className="p-4">
                    <h5 className="mb-4">Change Password</h5>
                    <Form>
                      <Form.Group className="mb-3">
                        <Form.Label>Current Password</Form.Label>
                        <Form.Control
                          type="password"
                          placeholder="Enter current password"
                        />
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Label>New Password</Form.Label>
                        <Form.Control
                          type="password"
                          placeholder="Enter new password"
                        />
                      </Form.Group>
                      <Form.Group className="mb-4">
                        <Form.Label>Confirm New Password</Form.Label>
                        <Form.Control
                          type="password"
                          placeholder="Confirm new password"
                        />
                      </Form.Group>
                      <Button variant="primary">
                        Update Password
                      </Button>
                    </Form>
                  </Card.Body>
                </Card>
              </Tab.Pane>

              <Tab.Pane eventKey="preferences">
                <Card className="border-0 shadow-sm">
                  <Card.Body className="p-4">
                    <h5 className="mb-4">Preferences</h5>
                    <Form>
                      <Form.Group className="mb-3">
                        <Form.Check
                          type="switch"
                          id="notifications-switch"
                          label="Enable email notifications"
                          defaultChecked
                        />
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Check
                          type="switch"
                          id="dark-mode-switch"
                          label="Dark mode"
                        />
                      </Form.Group>
                      <Form.Group className="mb-4">
                        <Form.Label>Language</Form.Label>
                        <Form.Select>
                          <option>English</option>
                          <option>Afrikaans</option>
                          <option>Zulu</option>
                        </Form.Select>
                      </Form.Group>
                      <Button variant="primary">
                        Save Preferences
                      </Button>
                    </Form>
                  </Card.Body>
                </Card>
              </Tab.Pane>
            </Tab.Content>
          </Col>
        </Row>
      </Tab.Container>
    </div>
  );
};

export default Profile;