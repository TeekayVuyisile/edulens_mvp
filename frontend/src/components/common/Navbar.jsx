import React from 'react';
import { Navbar, Nav, Container, Dropdown } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-hot-toast';

const CustomNavbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Navbar bg="white" expand="lg" className="shadow-sm border-bottom">
      <Container fluid>
        <Navbar.Brand as={Link} to="/dashboard" className="fw-bold text-primary">
          <i className="bi bi-mortarboard-fill me-2"></i>
          Edulens LMS
        </Navbar.Brand>
        
        <Nav className="ms-auto align-items-center">
          {user && (
            <>
              <div className="d-none d-md-block me-3">
                <span className="text-muted">Welcome,</span>
                <span className="ms-1 fw-semibold">
                  {user.first_name} {user.last_name}
                </span>
                <span className="badge bg-primary ms-2">
                  {user.role?.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              
              <Dropdown align="end">
                <Dropdown.Toggle variant="light" className="d-flex align-items-center">
                  <div className="me-2">
                    <div className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center" 
                         style={{ width: '32px', height: '32px' }}>
                      {user.first_name?.[0]}{user.last_name?.[0]}
                    </div>
                  </div>
                 
                </Dropdown.Toggle>

                <Dropdown.Menu>
                  <Dropdown.Item as={Link} to="/profile">
                    <i className="bi bi-person me-2"></i>
                    Profile
                  </Dropdown.Item>
                  <Dropdown.Item as={Link} to="/settings">
                    <i className="bi bi-gear me-2"></i>
                    Settings
                  </Dropdown.Item>
                  <Dropdown.Divider />
                  <Dropdown.Item onClick={handleLogout} className="text-danger">
                    <i className="bi bi-box-arrow-right me-2"></i>
                    Logout
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </>
          )}
        </Nav>
      </Container>
    </Navbar>
  );
};

export default CustomNavbar;