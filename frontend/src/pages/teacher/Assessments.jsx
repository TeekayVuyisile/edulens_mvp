import React, { useState, useEffect } from 'react';
import { Card, Button, Table, Badge, Form, Modal, Row, Col, Dropdown, InputGroup } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import axios from 'axios';

const Assessments = () => {
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterType, setFilterType] = useState('');
  const [formData, setFormData] = useState({
    class_id: '',
    assessment_name: '',
    assessment_type: 'quiz',
    subject_id: '',
    topic_id: '',
    total_marks: 20,
    passing_marks: 10,
    term_number: '1',
    due_date: '',
    scheduled_date: '',
    description: '',
  });

  useEffect(() => {
    fetchAssessments();
  }, []);

  const fetchAssessments = async () => {
    try {
      const response = await axios.get('/api/teacher/assessments');
      setAssessments(response.data.data.assessments || []);
    } catch (error) {
      toast.error('Failed to fetch assessments');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/teacher/assessments', formData);
      toast.success('Assessment created successfully');
      setShowModal(false);
      fetchAssessments();
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create assessment');
    }
  };

  const resetForm = () => {
    setFormData({
      class_id: '',
      assessment_name: '',
      assessment_type: 'quiz',
      subject_id: '',
      topic_id: '',
      total_marks: 20,
      passing_marks: 10,
      term_number: '1',
      due_date: '',
      scheduled_date: '',
      description: '',
    });
  };

  const filteredAssessments = assessments.filter(assessment => {
    const matchesSearch = assessment.assessment_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         assessment.subject_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = !filterClass || assessment.class_id === filterClass;
    const matchesType = !filterType || assessment.assessment_type === filterType;
    return matchesSearch && matchesClass && matchesType;
  });

  const getTypeBadge = (type) => {
    const types = {
      'quiz': 'info',
      'test': 'warning',
      'project': 'success',
      'worksheet': 'primary',
      'assignment': 'secondary'
    };
    return types[type] || 'secondary';
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 mb-2">Assessments</h1>
          <p className="text-muted">Create and manage assessments for your classes</p>
        </div>
        <Button variant="primary" onClick={() => setShowModal(true)}>
          <i className="bi bi-plus-circle me-2"></i>
          Create Assessment
        </Button>
      </div>

      <Card className="border-0 shadow-sm mb-4">
        <Card.Body>
          <Row className="g-3 mb-4">
            <Col md={6}>
              <InputGroup>
                <InputGroup.Text>
                  <i className="bi bi-search"></i>
                </InputGroup.Text>
                <Form.Control
                  placeholder="Search assessments..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </InputGroup>
            </Col>
            <Col md={3}>
              <Form.Select value={filterClass} onChange={(e) => setFilterClass(e.target.value)}>
                <option value="">All Classes</option>
                <option value="1">Grade 1 - A</option>
                <option value="2">Grade 1 - B</option>
                <option value="3">Grade 2 - A</option>
              </Form.Select>
            </Col>
            <Col md={3}>
              <Form.Select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                <option value="">All Types</option>
                <option value="quiz">Quiz</option>
                <option value="test">Test</option>
                <option value="project">Project</option>
                <option value="worksheet">Worksheet</option>
                <option value="assignment">Assignment</option>
              </Form.Select>
            </Col>
          </Row>

          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : filteredAssessments.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-clipboard display-1 text-muted mb-3"></i>
              <h4>No Assessments Found</h4>
              <p className="text-muted">Create your first assessment to get started.</p>
              <Button variant="primary" onClick={() => setShowModal(true)}>
                Create Assessment
              </Button>
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover>
                <thead>
                  <tr>
                    <th>Assessment</th>
                    <th>Class</th>
                    <th>Subject</th>
                    <th>Type</th>
                    <th>Due Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssessments.map((assessment) => (
                    <tr key={assessment.assessment_id}>
                      <td>
                        <div>
                          <strong>{assessment.assessment_name}</strong>
                          <div className="text-muted small">
                            Term {assessment.term_number} • {assessment.total_marks} marks
                          </div>
                        </div>
                      </td>
                      <td>
                        <Badge bg="info">{assessment.class_name}</Badge>
                      </td>
                      <td>{assessment.subject_name || 'General'}</td>
                      <td>
                        <Badge bg={getTypeBadge(assessment.assessment_type)}>
                          {assessment.assessment_type}
                        </Badge>
                      </td>
                      <td>
                        {assessment.due_date || 'No due date'}
                        {assessment.scheduled_date && (
                          <div className="text-muted small">
                            Scheduled: {assessment.scheduled_date}
                          </div>
                        )}
                      </td>
                      <td>
                        <Badge bg={assessment.submissions === assessment.graded ? 'success' : 'warning'}>
                          {assessment.graded || 0}/{assessment.submissions || 0} graded
                        </Badge>
                      </td>
                      <td>
                        <div className="d-flex gap-2">
                          <Dropdown>
                            <Dropdown.Toggle size="sm" variant="outline-primary">
                              Actions
                            </Dropdown.Toggle>
                            <Dropdown.Menu>
                              <Dropdown.Item as={Link} to={`/teacher/assessments/${assessment.assessment_id}/gradebook`}>
                                <i className="bi bi-clipboard-check me-2"></i>
                                Grade
                              </Dropdown.Item>
                              <Dropdown.Item>
                                <i className="bi bi-eye me-2"></i>
                                View
                              </Dropdown.Item>
                              <Dropdown.Item>
                                <i className="bi bi-pencil me-2"></i>
                                Edit
                              </Dropdown.Item>
                              <Dropdown.Divider />
                              <Dropdown.Item className="text-danger">
                                <i className="bi bi-trash me-2"></i>
                                Delete
                              </Dropdown.Item>
                            </Dropdown.Menu>
                          </Dropdown>
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

      {/* Create Assessment Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Form onSubmit={handleSubmit}>
          <Modal.Header closeButton>
            <Modal.Title>Create New Assessment</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Row className="g-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Assessment Name *</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.assessment_name}
                    onChange={(e) => setFormData({...formData, assessment_name: e.target.value})}
                    placeholder="e.g., Mid-term Mathematics Test"
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Assessment Type *</Form.Label>
                  <Form.Select
                    value={formData.assessment_type}
                    onChange={(e) => setFormData({...formData, assessment_type: e.target.value})}
                    required
                  >
                    <option value="quiz">Quiz</option>
                    <option value="test">Test</option>
                    <option value="project">Project</option>
                    <option value="worksheet">Worksheet</option>
                    <option value="assignment">Assignment</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Class *</Form.Label>
                  <Form.Select
                    value={formData.class_id}
                    onChange={(e) => setFormData({...formData, class_id: e.target.value})}
                    required
                  >
                    <option value="">Select class</option>
                    <option value="1">Grade 1 - A</option>
                    <option value="2">Grade 1 - B</option>
                    <option value="3">Grade 2 - A</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Term *</Form.Label>
                  <Form.Select
                    value={formData.term_number}
                    onChange={(e) => setFormData({...formData, term_number: e.target.value})}
                    required
                  >
                    <option value="1">Term 1</option>
                    <option value="2">Term 2</option>
                    <option value="3">Term 3</option>
                    <option value="4">Term 4</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Subject</Form.Label>
                  <Form.Select
                    value={formData.subject_id}
                    onChange={(e) => setFormData({...formData, subject_id: e.target.value})}
                  >
                    <option value="">Select subject</option>
                    <option value="1">Mathematics</option>
                    <option value="2">English</option>
                    <option value="3">Life Skills</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Topic</Form.Label>
                  <Form.Select
                    value={formData.topic_id}
                    onChange={(e) => setFormData({...formData, topic_id: e.target.value})}
                  >
                    <option value="">Select topic</option>
                    <option value="1">Addition</option>
                    <option value="2">Subtraction</option>
                    <option value="3">Phonics</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Total Marks *</Form.Label>
                  <Form.Control
                    type="number"
                    value={formData.total_marks}
                    onChange={(e) => setFormData({...formData, total_marks: e.target.value})}
                    min="1"
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Passing Marks</Form.Label>
                  <Form.Control
                    type="number"
                    value={formData.passing_marks}
                    onChange={(e) => setFormData({...formData, passing_marks: e.target.value})}
                    min="0"
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Due Date</Form.Label>
                  <Form.Control
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Scheduled Date</Form.Label>
                  <Form.Control
                    type="date"
                    value={formData.scheduled_date}
                    onChange={(e) => setFormData({...formData, scheduled_date: e.target.value})}
                  />
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group>
                  <Form.Label>Description</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Enter assessment description and instructions..."
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
              Create Assessment
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default Assessments;