import React, { useState, useEffect } from 'react';
import { Table, Button, Card, Form, InputGroup, Modal, Row, Col, Badge } from 'react-bootstrap';
import { toast } from 'react-hot-toast';
import axios from 'axios';

const Classes = () => {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    class_name: '',
    grade_level: '',
    academic_year: new Date().getFullYear(),
    primary_teacher_id: '',
    max_capacity: 30,
  });

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      const response = await axios.get('/api/school-admin/classes');
      setClasses(response.data.data.classes || []);
    } catch (error) {
      toast.error('Failed to fetch classes');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/school-admin/classes', formData);
      toast.success('Class created successfully');
      setShowModal(false);
      fetchClasses();
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create class');
    }
  };

  const resetForm = () => {
    setFormData({
      class_name: '',
      grade_level: '',
      academic_year: new Date().getFullYear(),
      primary_teacher_id: '',
      max_capacity: 30,
    });
  };

  const filteredClasses = classes.filter(cls =>
    cls.class_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cls.grade_level.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 mb-2">Classes Management</h1>
          <p className="text-muted">Manage all classes in your school</p>
        </div>
        <Button variant="primary" onClick={() => setShowModal(true)}>
          <i className="bi bi-plus-circle me-2"></i>
          Add Class
        </Button>
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
                  placeholder="Search classes by name or grade..."
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
                    <th>Class Name</th>
                    <th>Grade Level</th>
                    <th>Teacher</th>
                    <th>Learners</th>
                    <th>Academic Year</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClasses.map((cls) => (
                    <tr key={cls.class_id}>
                      <td>
                        <div className="d-flex align-items-center">
                          <div className="bg-info-subtle p-2 rounded me-3">
                            <i className="bi bi-collection text-info"></i>
                          </div>
                          <div>
                            <strong>{cls.class_name}</strong>
                            <div className="text-muted small">Capacity: {cls.current_enrollment || 0}/{cls.max_capacity || 30}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <Badge bg="primary">Grade {cls.grade_level}</Badge>
                      </td>
                      <td>
                        {cls.primary_teacher ? (
                          <div>
                            <div>{cls.primary_teacher.first_name} {cls.primary_teacher.last_name}</div>
                            <div className="text-muted small">{cls.primary_teacher.email}</div>
                          </div>
                        ) : (
                          <span className="text-muted">No teacher assigned</span>
                        )}
                      </td>
                      <td>
                        <div className="d-flex align-items-center">
                          <span className="fw-bold me-2">{cls.learner_count || 0}</span>
                          <div className="progress flex-grow-1" style={{ height: '6px' }}>
                            <div 
                              className="progress-bar" 
                              role="progressbar" 
                              style={{ 
                                width: `${((cls.learner_count || 0) / (cls.max_capacity || 30)) * 100}%` 
                              }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td>{cls.academic_year}</td>
                      <td>
                        <Badge bg={cls.is_active ? 'success' : 'secondary'}>
                          {cls.is_active ? 'Active' : 'Inactive'}
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

      {/* Add Class Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Form onSubmit={handleSubmit}>
          <Modal.Header closeButton>
            <Modal.Title>Create New Class</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Row className="g-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Class Name *</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="e.g., Grade 1 - A"
                    value={formData.class_name}
                    onChange={(e) => setFormData({...formData, class_name: e.target.value})}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Grade Level *</Form.Label>
                  <Form.Select
                    value={formData.grade_level}
                    onChange={(e) => setFormData({...formData, grade_level: e.target.value})}
                    required
                  >
                    <option value="">Select grade</option>
                    <option value="R">Grade R</option>
                    <option value="1">Grade 1</option>
                    <option value="2">Grade 2</option>
                    <option value="3">Grade 3</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Academic Year *</Form.Label>
                  <Form.Control
                    type="number"
                    value={formData.academic_year}
                    onChange={(e) => setFormData({...formData, academic_year: e.target.value})}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Max Capacity</Form.Label>
                  <Form.Control
                    type="number"
                    value={formData.max_capacity}
                    onChange={(e) => setFormData({...formData, max_capacity: e.target.value})}
                    min="1"
                    max="40"
                  />
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group>
                  <Form.Label>Primary Teacher (Optional)</Form.Label>
                  <Form.Select
                    value={formData.primary_teacher_id}
                    onChange={(e) => setFormData({...formData, primary_teacher_id: e.target.value})}
                  >
                    <option value="">Select teacher</option>
                    <option value="1">John Smith</option>
                    <option value="2">Sarah Johnson</option>
                    <option value="3">Michael Brown</option>
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
              Create Class
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default Classes;