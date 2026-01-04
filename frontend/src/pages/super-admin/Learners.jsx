import React, { useState, useEffect } from 'react';
import { Table, Button, Card, Form, InputGroup, Modal, Row, Col, Badge, Dropdown } from 'react-bootstrap';
import { toast } from 'react-hot-toast';
import axios from 'axios';

const Learners = () => {
  const [learners, setLearners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    gender: '',
    current_class_id: '',
    guardian_name: '',
    guardian_email: '',
    guardian_phone: '',
  });

  useEffect(() => {
    fetchLearners();
  }, []);

  const fetchLearners = async () => {
    try {
      const response = await axios.get('/api/school-admin/learners');
      setLearners(response.data.data.learners || []);
    } catch (error) {
      toast.error('Failed to fetch learners');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/school-admin/learners', formData);
      toast.success('Learner created successfully');
      setShowModal(false);
      fetchLearners();
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create learner');
    }
  };

  const resetForm = () => {
    setFormData({
      first_name: '',
      last_name: '',
      date_of_birth: '',
      gender: '',
      current_class_id: '',
      guardian_name: '',
      guardian_email: '',
      guardian_phone: '',
    });
  };

  const filteredLearners = learners.filter(learner =>
    `${learner.first_name} ${learner.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    learner.guardian_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 mb-2">Learners Management</h1>
          <p className="text-muted">Manage all learners in your school</p>
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
            Add Learner
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
                  placeholder="Search learners by name or guardian..."
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
                    <th>Learner</th>
                    <th>Date of Birth</th>
                    <th>Class</th>
                    <th>Guardian</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLearners.map((learner) => (
                    <tr key={learner.learner_id}>
                      <td>
                        <div className="d-flex align-items-center">
                          <div className="bg-success-subtle p-2 rounded me-3">
                            <i className="bi bi-person text-success"></i>
                          </div>
                          <div>
                            <strong>{learner.first_name} {learner.last_name}</strong>
                            <div className="text-muted small">{learner.gender}</div>
                          </div>
                        </div>
                      </td>
                      <td>{learner.date_of_birth}</td>
                      <td>
                        <Badge bg="info">{learner.class_name || 'Not assigned'}</Badge>
                      </td>
                      <td>
                        <div>{learner.guardian_name}</div>
                        <div className="text-muted small">{learner.guardian_phone}</div>
                      </td>
                      <td>
                        <Badge bg={learner.academic_status === 'active' ? 'success' : 'warning'}>
                          {learner.academic_status}
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

      {/* Add Learner Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Form onSubmit={handleSubmit}>
          <Modal.Header closeButton>
            <Modal.Title>Add New Learner</Modal.Title>
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
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Date of Birth *</Form.Label>
                  <Form.Control
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => setFormData({...formData, date_of_birth: e.target.value})}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Gender</Form.Label>
                  <Form.Select
                    value={formData.gender}
                    onChange={(e) => setFormData({...formData, gender: e.target.value})}
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={12}>
                <hr />
                <h6 className="mb-3">Guardian Information</h6>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Guardian Name</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.guardian_name}
                    onChange={(e) => setFormData({...formData, guardian_name: e.target.value})}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Guardian Email</Form.Label>
                  <Form.Control
                    type="email"
                    value={formData.guardian_email}
                    onChange={(e) => setFormData({...formData, guardian_email: e.target.value})}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Guardian Phone</Form.Label>
                  <Form.Control
                    type="tel"
                    value={formData.guardian_phone}
                    onChange={(e) => setFormData({...formData, guardian_phone: e.target.value})}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Class Assignment</Form.Label>
                  <Form.Select
                    value={formData.current_class_id}
                    onChange={(e) => setFormData({...formData, current_class_id: e.target.value})}
                  >
                    <option value="">Select class</option>
                    <option value="1">Grade 1 - A</option>
                    <option value="2">Grade 1 - B</option>
                    <option value="3">Grade 2 - A</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Add Learner
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Import Modal */}
      <Modal show={showImportModal} onHide={() => setShowImportModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Import Learners</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted mb-3">
            Upload a CSV or Excel file with learner information.
          </p>
          <Form.Group>
            <Form.Label>Select File</Form.Label>
            <Form.Control type="file" accept=".csv,.xlsx,.xls" />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowImportModal(false)}>
            Cancel
          </Button>
          <Button variant="primary">Import Learners</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Learners;