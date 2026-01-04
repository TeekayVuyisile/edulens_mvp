import React, { useState, useEffect } from 'react';
import { 
  Table, Button, Card, Form, InputGroup, Modal, 
  Row, Col, Badge, Tabs, Tab, Alert, Spinner 
} from 'react-bootstrap';
import { toast } from 'react-hot-toast';
import axios from 'axios';

const Schools = () => {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [formData, setFormData] = useState({
    school_name: '',
    contact_email: '',
    contact_phone: '',
    address: '',
    city: '',
    province: '',
    country: 'South Africa',
  });
  const [adminFormData, setAdminFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    password: '',
    confirm_password: '',
  });
  const [assignData, setAssignData] = useState({
    curriculum_id: '',
    grade_level: 'R',
    academic_year: new Date().getFullYear(),
  });
  const [schoolDetails, setSchoolDetails] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  useEffect(() => {
    fetchSchools();
    fetchCurricula();
  }, []);

  const [curricula, setCurricula] = useState([]);

  const fetchSchools = async () => {
    try {
      const response = await axios.get('/api/super-admin/schools');
      setSchools(response.data.data.schools || []);
    } catch (error) {
      console.error('Fetch schools error:', error);
      toast.error('Failed to fetch schools');
    } finally {
      setLoading(false);
    }
  };

  const fetchCurricula = async () => {
    try {
      const response = await axios.get('/api/super-admin/curricula');
      setCurricula(response.data.data.curricula || []);
    } catch (error) {
      console.error('Fetch curricula error:', error);
      toast.error('Failed to fetch curricula');
    }
  };

  const fetchSchoolDetails = async (schoolId) => {
    setViewLoading(true);
    try {
      const response = await axios.get(`/api/super-admin/schools/${schoolId}`);
      setSchoolDetails(response.data.data);
      setShowViewModal(true);
    } catch (error) {
      console.error('Fetch school details error:', error);
      toast.error('Failed to fetch school details');
    } finally {
      setViewLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('/api/super-admin/schools', formData);
      toast.success('School created successfully');
      setShowModal(false);
      // Set selected school for admin creation
      const newSchool = response.data.data.school;
      setSelectedSchool(newSchool.school_id);
      // Reset form and show admin modal
      resetForm();
      setAdminFormData({
        email: '',
        first_name: '',
        last_name: '',
        phone: '',
        password: '',
        confirm_password: '',
      });
      setShowAdminModal(true);
      fetchSchools();
    } catch (error) {
      console.error('Create school error:', error);
      toast.error(error.response?.data?.message || 'Failed to create school');
    }
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    
    // Validation
    if (adminFormData.password !== adminFormData.confirm_password) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (adminFormData.password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }
    
    try {
      await axios.post(`/api/super-admin/schools/${selectedSchool}/admin`, {
        email: adminFormData.email,
        password: adminFormData.password,
        first_name: adminFormData.first_name,
        last_name: adminFormData.last_name,
        phone: adminFormData.phone || '',
      });
      
      toast.success('School admin account created successfully');
      setShowAdminModal(false);
      resetAdminForm();
      // Refresh schools to update admin status
      fetchSchools();
    } catch (error) {
      console.error('Create admin error:', error.response?.data || error);
      toast.error(error.response?.data?.message || 'Failed to create admin account');
    }
  };

  const handleAssignCurriculum = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`/api/super-admin/schools/${selectedSchool}/curricula`, {
        ...assignData,
        assigned_by: JSON.parse(localStorage.getItem('user'))?.userId // Get current user ID
      });
      toast.success('Curriculum assigned successfully');
      setShowAssignModal(false);
      resetAssignForm();
    } catch (error) {
      console.error('Assign curriculum error:', error);
      toast.error(error.response?.data?.message || 'Failed to assign curriculum');
    }
  };

  const handleDeleteSchool = async (schoolId) => {
    if (window.confirm('Are you sure you want to delete this school? This action cannot be undone.')) {
      try {
        await axios.delete(`/api/super-admin/schools/${schoolId}`);
        toast.success('School deleted successfully');
        fetchSchools();
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to delete school');
      }
    }
  };

  const handleEditSchool = (schoolId) => {
    const school = schools.find(s => s.school_id === schoolId);
    if (school) {
      setFormData({
        school_name: school.school_name,
        contact_email: school.contact_email,
        contact_phone: school.contact_phone || '',
        address: school.address || '',
        city: school.city || '',
        province: school.province || '',
        country: school.country || 'South Africa',
      });
      setSelectedSchool(schoolId);
      setShowModal(true);
    }
  };

  const handleUpdateSchool = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`/api/super-admin/schools/${selectedSchool}`, formData);
      toast.success('School updated successfully');
      setShowModal(false);
      fetchSchools();
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update school');
    }
  };

  const resetForm = () => {
    setFormData({
      school_name: '',
      contact_email: '',
      contact_phone: '',
      address: '',
      city: '',
      province: '',
      country: 'South Africa',
    });
    setSelectedSchool(null);
  };

  const resetAdminForm = () => {
    setAdminFormData({
      email: '',
      first_name: '',
      last_name: '',
      phone: '',
      password: '',
      confirm_password: '',
    });
    setSelectedSchool(null);
  };

  const resetAssignForm = () => {
    setAssignData({
      curriculum_id: '',
      grade_level: 'R',
      academic_year: new Date().getFullYear(),
    });
  };

  const toggleSchoolStatus = async (schoolId, currentStatus) => {
    try {
      await axios.patch(`/api/super-admin/schools/${schoolId}/toggle-active`, {
        action: currentStatus ? 'deactivate' : 'activate'
      });
      toast.success(`School ${currentStatus ? 'deactivated' : 'activated'} successfully`);
      fetchSchools();
    } catch (error) {
      console.error('Toggle status error:', error);
      toast.error(error.response?.data?.message || 'Failed to update school status');
    }
  };

  const filteredSchools = schools.filter(school => {
    const matchesSearch = 
      (school.school_name && school.school_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (school.school_code && school.school_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (school.city && school.city.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesTab = 
      activeTab === 'all' ||
      (activeTab === 'active' && school.is_active) ||
      (activeTab === 'inactive' && !school.is_active);
    
    return matchesSearch && matchesTab;
  });

  const activeSchools = schools.filter(s => s.is_active);
  const inactiveSchools = schools.filter(s => !s.is_active);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 mb-2">Schools Management</h1>
          <p className="text-muted">Manage all schools on the platform</p>
        </div>
        <Button variant="primary" onClick={() => setShowModal(true)}>
          <i className="bi bi-plus-circle me-2"></i>
          Add New School
        </Button>
      </div>

      {/* Statistics Cards */}
      <Row className="g-3 mb-4">
        <Col xs={12} md={6} lg={3}>
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="text-muted mb-2">Total Schools</h6>
                  <h2 className="fw-bold mb-0">{schools.length}</h2>
                </div>
                <div className="bg-primary-subtle p-3 rounded">
                  <i className="bi bi-building fs-4 text-primary"></i>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={12} md={6} lg={3}>
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="text-muted mb-2">Active Schools</h6>
                  <h2 className="fw-bold mb-0">{activeSchools.length}</h2>
                </div>
                <div className="bg-success-subtle p-3 rounded">
                  <i className="bi bi-check-circle fs-4 text-success"></i>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={12} md={6} lg={3}>
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="text-muted mb-2">Inactive Schools</h6>
                  <h2 className="fw-bold mb-0">{inactiveSchools.length}</h2>
                </div>
                <div className="bg-secondary-subtle p-3 rounded">
                  <i className="bi bi-x-circle fs-4 text-secondary"></i>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={12} md={6} lg={3}>
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="text-muted mb-2">Without Admin</h6>
                  <h2 className="fw-bold mb-0">
                    {schools.filter(s => !s.has_admin).length}
                  </h2>
                </div>
                <div className="bg-warning-subtle p-3 rounded">
                  <i className="bi bi-person-x fs-4 text-warning"></i>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="border-0 shadow-sm mb-4">
        <Card.Body>
          <Tabs
            activeKey={activeTab}
            onSelect={(k) => setActiveTab(k)}
            className="mb-3"
          >
            <Tab eventKey="all" title="All Schools">
              <Badge bg="secondary" className="ms-2">{schools.length}</Badge>
            </Tab>
            <Tab eventKey="active" title="Active">
              <Badge bg="success" className="ms-2">
                {activeSchools.length}
              </Badge>
            </Tab>
            <Tab eventKey="inactive" title="Inactive">
              <Badge bg="secondary" className="ms-2">
                {inactiveSchools.length}
              </Badge>
            </Tab>
          </Tabs>

          <div className="d-flex justify-content-between align-items-center mb-3">
            <div className="w-100 me-3">
              <InputGroup>
                <InputGroup.Text>
                  <i className="bi bi-search"></i>
                </InputGroup.Text>
                <Form.Control
                  placeholder="Search schools by name, code, or city..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <Button 
                    variant="outline-secondary" 
                    onClick={() => setSearchTerm('')}
                  >
                    <i className="bi bi-x"></i>
                  </Button>
                )}
              </InputGroup>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" role="status" className="text-primary">
                <span className="visually-hidden">Loading...</span>
              </Spinner>
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover className="mb-0">
                <thead>
                  <tr>
                    <th>School Details</th>
                    <th>Location</th>
                    <th>Contact</th>
                    <th>Status</th>
                    <th>Admin</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSchools.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-4">
                        <div className="text-muted">
                          <i className="bi bi-building fs-1 mb-3 d-block"></i>
                          No schools found
                          {searchTerm && ` matching "${searchTerm}"`}
                          {activeTab !== 'all' && ` in ${activeTab} schools`}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredSchools.map((school) => (
                      <tr key={school.school_id}>
                        <td>
                          <div className="d-flex align-items-center">
                            <div className="bg-primary-subtle p-2 rounded me-3">
                              <i className="bi bi-building text-primary"></i>
                            </div>
                            <div>
                              <strong>{school.school_name}</strong>
                              <div className="text-muted small">
                                Code: {school.school_code}
                                <div>{school.address}</div>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div>
                            <div>{school.city}</div>
                            <div className="text-muted small">{school.province}</div>
                          </div>
                        </td>
                        <td>
                          <div>{school.contact_email}</div>
                          <div className="text-muted small">{school.contact_phone || 'N/A'}</div>
                        </td>
                        <td>
                          <Badge bg={school.is_active ? 'success' : 'secondary'}>
                            {school.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                          <div className="text-muted small mt-1">
                            Created: {new Date(school.created_at).toLocaleDateString()}
                          </div>
                        </td>
                        <td>
                          {school.has_admin ? (
                            <Badge bg="success">
                              <i className="bi bi-check-circle me-1"></i>
                              Has Admin
                            </Badge>
                          ) : (
                            <Badge bg="warning">
                              <i className="bi bi-exclamation-triangle me-1"></i>
                              No Admin
                            </Badge>
                          )}
                        </td>
                        <td>
                          <div className="d-flex flex-column gap-2">
                            <div className="d-flex gap-2">
                              <Button 
                                size="sm" 
                                variant="outline-primary" 
                                title="View"
                                onClick={() => fetchSchoolDetails(school.school_id)}
                                disabled={viewLoading}
                              >
                                {viewLoading && selectedSchool === school.school_id ? (
                                  <Spinner size="sm" />
                                ) : (
                                  <i className="bi bi-eye"></i>
                                )}
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline-warning"
                                onClick={() => handleEditSchool(school.school_id)}
                                title="Edit"
                              >
                                <i className="bi bi-pencil"></i>
                              </Button>
                              <Button 
                                size="sm" 
                                variant={school.is_active ? 'outline-warning' : 'outline-success'}
                                onClick={() => toggleSchoolStatus(school.school_id, school.is_active)}
                                title={school.is_active ? 'Deactivate' : 'Activate'}
                              >
                                <i className={`bi bi-power ${school.is_active ? '' : 'text-success'}`}></i>
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline-danger"
                                onClick={() => handleDeleteSchool(school.school_id)}
                                title="Delete"
                              >
                                <i className="bi bi-trash"></i>
                              </Button>
                            </div>
                            <div className="d-flex gap-2 flex-wrap">
                              {!school.has_admin && (
                                <Button 
                                  size="sm" 
                                  variant="outline-info"
                                  onClick={() => {
                                    setSelectedSchool(school.school_id);
                                    setShowAdminModal(true);
                                  }}
                                >
                                  <i className="bi bi-person-plus me-1"></i>
                                  Create Admin
                                </Button>
                              )}
                              <Button 
                                size="sm" 
                                variant="outline-secondary"
                                onClick={() => {
                                  setSelectedSchool(school.school_id);
                                  setShowAssignModal(true);
                                }}
                              >
                                <i className="bi bi-book me-1"></i>
                                Assign Curriculum
                              </Button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Add/Edit School Modal */}
      <Modal show={showModal} onHide={() => { setShowModal(false); resetForm(); }} size="lg">
        <Form onSubmit={selectedSchool ? handleUpdateSchool : handleSubmit}>
          <Modal.Header closeButton>
            <Modal.Title>{selectedSchool ? 'Edit School' : 'Add New School'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Row>
              <Col md={6} className="mb-3">
                <Form.Label>School Name *</Form.Label>
                <Form.Control
                  type="text"
                  value={formData.school_name}
                  onChange={(e) => setFormData({...formData, school_name: e.target.value})}
                  required
                />
              </Col>
              <Col md={6} className="mb-3">
                <Form.Label>Contact Email *</Form.Label>
                <Form.Control
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({...formData, contact_email: e.target.value})}
                  required
                />
              </Col>
            </Row>
            <Row>
              <Col md={6} className="mb-3">
                <Form.Label>Contact Phone</Form.Label>
                <Form.Control
                  type="tel"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({...formData, contact_phone: e.target.value})}
                />
              </Col>
              <Col md={6} className="mb-3">
                <Form.Label>City</Form.Label>
                <Form.Control
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({...formData, city: e.target.value})}
                />
              </Col>
            </Row>
            <Row>
              <Col md={6} className="mb-3">
                <Form.Label>Province</Form.Label>
                <Form.Control
                  type="text"
                  value={formData.province}
                  onChange={(e) => setFormData({...formData, province: e.target.value})}
                />
              </Col>
              <Col md={6} className="mb-3">
                <Form.Label>Country</Form.Label>
                <Form.Control
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData({...formData, country: e.target.value})}
                />
              </Col>
            </Row>
            <Row>
              <Col md={12} className="mb-3">
                <Form.Label>Address</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                />
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => { setShowModal(false); resetForm(); }}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              {selectedSchool ? 'Update School' : 'Create School'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* View School Details Modal */}
      <Modal show={showViewModal} onHide={() => setShowViewModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>School Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {viewLoading ? (
            <div className="text-center py-4">
              <Spinner animation="border" role="status">
                <span className="visually-hidden">Loading...</span>
              </Spinner>
            </div>
          ) : schoolDetails ? (
            <div>
              <Row className="mb-3">
                <Col md={8}>
                  <h4>{schoolDetails.school.school_name}</h4>
                  <p className="text-muted mb-0">Code: {schoolDetails.school.school_code}</p>
                </Col>
                <Col md={4} className="text-end">
                  <Badge bg={schoolDetails.school.is_active ? 'success' : 'secondary'}>
                    {schoolDetails.school.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </Col>
              </Row>
              
              <Row className="mb-3">
                <Col md={6}>
                  <h6 className="text-muted">Contact Information</h6>
                  <p className="mb-1">
                    <i className="bi bi-envelope me-2"></i>
                    {schoolDetails.school.contact_email}
                  </p>
                  <p className="mb-1">
                    <i className="bi bi-telephone me-2"></i>
                    {schoolDetails.school.contact_phone || 'N/A'}
                  </p>
                </Col>
                <Col md={6}>
                  <h6 className="text-muted">Location</h6>
                  <p className="mb-1">{schoolDetails.school.address}</p>
                  <p className="mb-1">
                    {schoolDetails.school.city}, {schoolDetails.school.province}
                  </p>
                  <p className="mb-1">{schoolDetails.school.country}</p>
                </Col>
              </Row>
              
              <hr />
              
              <h6 className="text-muted mb-3">School Admin</h6>
              {schoolDetails.admin ? (
                <Card className="mb-3">
                  <Card.Body>
                    <Row>
                      <Col md={8}>
                        <h6>{schoolDetails.admin.first_name} {schoolDetails.admin.last_name}</h6>
                        <p className="mb-1 text-muted">{schoolDetails.admin.email}</p>
                        <p className="mb-0 text-muted">{schoolDetails.admin.phone}</p>
                      </Col>
                      <Col md={4} className="text-end">
                        <Badge bg="success">Admin Account Active</Badge>
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>
              ) : (
                <Alert variant="warning">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  No admin account assigned to this school
                </Alert>
              )}
              
              <hr />
              
              <div className="text-muted small">
                <p className="mb-1">
                  <strong>Created:</strong> {new Date(schoolDetails.school.created_at).toLocaleString()}
                </p>
                <p className="mb-0">
                  <strong>Last Updated:</strong> {new Date(schoolDetails.school.updated_at).toLocaleString()}
                </p>
              </div>
            </div>
          ) : (
            <Alert variant="danger">Failed to load school details</Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowViewModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Create Admin Modal */}
      <Modal show={showAdminModal} onHide={() => { setShowAdminModal(false); resetAdminForm(); }}>
        <Form onSubmit={handleCreateAdmin}>
          <Modal.Header closeButton>
            <Modal.Title>Create School Admin Account</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Alert variant="info" className="mb-3">
              <i className="bi bi-info-circle me-2"></i>
              Create an admin account for this school. The admin will manage teachers, learners, and classes.
            </Alert>
            <Form.Group className="mb-3">
              <Form.Label>Email Address *</Form.Label>
              <Form.Control
                type="email"
                value={adminFormData.email}
                onChange={(e) => setAdminFormData({...adminFormData, email: e.target.value})}
                required
                placeholder="admin@school.edu"
              />
            </Form.Group>
            <Row className="mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>First Name *</Form.Label>
                  <Form.Control
                    type="text"
                    value={adminFormData.first_name}
                    onChange={(e) => setAdminFormData({...adminFormData, first_name: e.target.value})}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Last Name *</Form.Label>
                  <Form.Control
                    type="text"
                    value={adminFormData.last_name}
                    onChange={(e) => setAdminFormData({...adminFormData, last_name: e.target.value})}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
            <Form.Group className="mb-3">
              <Form.Label>Phone Number</Form.Label>
              <Form.Control
                type="tel"
                value={adminFormData.phone}
                onChange={(e) => setAdminFormData({...adminFormData, phone: e.target.value})}
              />
            </Form.Group>
            <Row className="mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Password *</Form.Label>
                  <Form.Control
                    type="password"
                    value={adminFormData.password}
                    onChange={(e) => setAdminFormData({...adminFormData, password: e.target.value})}
                    required
                    minLength={6}
                  />
                  <Form.Text className="text-muted">
                    Minimum 6 characters
                  </Form.Text>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Confirm Password *</Form.Label>
                  <Form.Control
                    type="password"
                    value={adminFormData.confirm_password}
                    onChange={(e) => setAdminFormData({...adminFormData, confirm_password: e.target.value})}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => { setShowAdminModal(false); resetAdminForm(); }}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Create Admin Account
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Assign Curriculum Modal */}
      <Modal show={showAssignModal} onHide={() => { setShowAssignModal(false); resetAssignForm(); }}>
        <Form onSubmit={handleAssignCurriculum}>
          <Modal.Header closeButton>
            <Modal.Title>Assign Curriculum to School</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Select Curriculum *</Form.Label>
              <Form.Select
                value={assignData.curriculum_id}
                onChange={(e) => setAssignData({...assignData, curriculum_id: e.target.value})}
                required
              >
                <option value="">Choose curriculum...</option>
                {curricula.map((curriculum) => (
                  <option key={curriculum.curriculum_id} value={curriculum.curriculum_id}>
                    {curriculum.curriculum_name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Grade Level *</Form.Label>
              <Form.Select
                value={assignData.grade_level}
                onChange={(e) => setAssignData({...assignData, grade_level: e.target.value})}
                required
              >
                <option value="R">Grade R</option>
                <option value="1">Grade 1</option>
                <option value="2">Grade 2</option>
                <option value="3">Grade 3</option>
                <option value="R-3">Grade R-3 (All)</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Academic Year *</Form.Label>
              <Form.Control
                type="number"
                value={assignData.academic_year}
                onChange={(e) => setAssignData({...assignData, academic_year: e.target.value})}
                required
                min="2020"
                max="2030"
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => { setShowAssignModal(false); resetAssignForm(); }}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Assign Curriculum
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default Schools;