import React, { useState, useEffect } from 'react';
import { Table, Button, Card, Form, InputGroup, Modal, Row, Col, Badge, Dropdown } from 'react-bootstrap';
import { toast } from 'react-hot-toast';
import axios from 'axios';

const Teachers = () => {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
  });

  useEffect(() => {
    fetchTeachers();
  }, []);

  const fetchTeachers = async () => {
    try {
      const response = await axios.get('/api/school-admin/teachers');
      setTeachers(response.data.data.users || []);
    } catch (error) {
      toast.error('Failed to fetch teachers');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/school-admin/teachers', formData);
      toast.success('Teacher created successfully');
      setShowModal(false);
      fetchTeachers();
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create teacher');
    }
  };

  const handleImport = async (e) => {
    e.preventDefault();
    // Handle CSV import
    setShowImportModal(false);
    toast.success('Import started');
  };

  const resetForm = () => {
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
    });
  };

  const toggleTeacherStatus = async (teacherId, currentStatus) => {
    try {
      await axios.patch(`/api/school-admin/teachers/${teacherId}/toggle-active`, {
        is_active: !currentStatus
      });
      toast.success(`Teacher ${currentStatus ? 'deactivated' : 'activated'}`);
      fetchTeachers();
    } catch (error) {
      toast.error('Failed to update teacher status');
    }
  };

  const filteredTeachers = teachers.filter(teacher =>
    `${teacher.first_name} ${teacher.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    teacher.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 mb-2">Teachers Management</h1>
          <p className="text-muted">Manage all teachers in your school</p>
        </div>
        <div className="d-flex gap-2">
          <Dropdown>
            <Dropdown.Toggle variant="outline-primary">
              <i className="bi bi-upload me-2"></i>
              Import
            </Dropdown.Toggle>
            <Dropdown.Menu>
              <Dropdown.Item onClick={() => setShowImportModal(true)}>
                <i className="bi bi-file-earmark-excel me-2"></i>
                Import from CSV/Excel
              </Dropdown.Item>
              <Dropdown.Item>
                <i className="bi bi-clipboard me-2"></i>
                Copy Template
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
          <Button variant="primary" onClick={() => setShowModal(true)}>
            <i className="bi bi-plus-circle me-2"></i>
            Add Teacher
          </Button>
        </div>
      </div>

      <Card className="border-0 shadow-sm mb-4">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div className="w-100 me-3">
              <InputGroup>
                <InputGroup.Text>
                  <i className="bi bi-search"></i>
                </InputGroup.Text>
                <Form.Control
                  placeholder="Search teachers by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </InputGroup>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover className="mb-0">
                <thead>
                  <tr>
                    <th>Teacher</th>
                    <th>Contact</th>
                    <th>Classes</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTeachers.map((teacher) => (
                    <tr key={teacher.user_id}>
                      <td>
                        <div className="d-flex align-items-center">
                          <div className="bg-primary-subtle p-2 rounded me-3">
                            <i className="bi bi-person-badge text-primary"></i>
                          </div>
                          <div>
                            <strong>{teacher.first_name} {teacher.last_name}</strong>
                            <div className="text-muted small">ID: {teacher.user_id?.substring(0, 8)}...</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div>{teacher.email}</div>
                        <div className="text-muted small">{teacher.phone || 'No phone'}</div>
                      </td>
                      <td>
                        <Badge bg="info">3 Classes</Badge>
                      </td>
                      <td>
                        <Badge bg={teacher.is_active ? 'success' : 'secondary'}>
                          {teacher.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td>
                        <div className="d-flex gap-2">
                          <Button size="sm" variant="outline-primary">
                            <i className="bi bi-eye"></i>
                          </Button>
                          <Button size="sm" variant="outline-warning">
                            <i className="bi bi-pencil"></i>
                          </Button>
                          <Button 
                            size="sm" 
                            variant={teacher.is_active ? 'outline-warning' : 'outline-success'}
                            onClick={() => toggleTeacherStatus(teacher.user_id, teacher.is_active)}
                          >
                            <i className={`bi bi-power ${teacher.is_active ? '' : 'text-success'}`}></i>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Add Teacher Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Form onSubmit={handleSubmit}>
          <Modal.Header closeButton>
            <Modal.Title>Add New Teacher</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Row className="g-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>First Name *</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Last Name *</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group>
                  <Form.Label>Email Address *</Form.Label>
                  <Form.Control
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group>
                  <Form.Label>Phone Number</Form.Label>
                  <Form.Control
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Add Teacher
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Import Modal */}
      <Modal show={showImportModal} onHide={() => setShowImportModal(false)}>
        <Form onSubmit={handleImport}>
          <Modal.Header closeButton>
            <Modal.Title>Import Teachers</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p className="text-muted mb-3">
              Upload a CSV or Excel file with teacher information. 
              <a href="#" className="ms-1">Download template</a>
            </p>
            <Form.Group>
              <Form.Label>Select File</Form.Label>
              <Form.Control type="file" accept=".csv,.xlsx,.xls" />
              <Form.Text className="text-muted">
                Supported formats: CSV, Excel (.xlsx, .xls)
              </Form.Text>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowImportModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Import Teachers
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default Teachers;