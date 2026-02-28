import React, { useState, useEffect } from 'react';
import {
  Card, Button, Table, Badge, Form, Modal, Row, Col,
  Dropdown, InputGroup, Alert, Spinner, ProgressBar,
  ListGroup, Tabs, Tab
} from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { FaTrash, FaEdit, FaEye, FaUpload, FaFilePdf, FaFileImage, FaFileVideo, FaFileAudio } from 'react-icons/fa';

const Assessments = () => {
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showResourcesModal, setShowResourcesModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterType, setFilterType] = useState('');
  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const [assessmentData, setAssessmentData] = useState({
    classes: [],
    curricula: [],
    topicsBySubject: {}
  });
  const [resources, setResources] = useState([]);
  const [uploadingResource, setUploadingResource] = useState(false);
  const navigate = useNavigate();

  // Form data for creating assessment
  const [formData, setFormData] = useState({
    class_id: '',
    assessment_name: '',
    assessment_type: 'quiz',
    curriculum_id: '',
    subject_id: '',
    topic_id: '',
    total_marks: 20,
    passing_marks: 10,
    term_number: '1',
    due_date: '',
    scheduled_date: '',
    description: '',
  });

  // Filtered subjects based on selected class
  const [filteredSubjects, setFilteredSubjects] = useState([]);
  const [filteredTopics, setFilteredTopics] = useState([]);

  useEffect(() => {
    fetchAssessments();
    fetchAssessmentData();
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

  const fetchAssessmentData = async () => {
    try {
      const response = await axios.get('/api/teacher/assessment-data');
      console.log('Assessment Data:', response.data.data);
      setAssessmentData(response.data.data);
    } catch (error) {
      console.error('Failed to fetch assessment data:', error);
      toast.error('Failed to load assessment data');
    }
  };

  const fetchAssessmentResources = async (assessmentId) => {
    try {
      const response = await axios.get(`/api/teacher/assessments/${assessmentId}`);
      setResources(response.data.data.resources || []);
    } catch (error) {
      toast.error('Failed to fetch resources');
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      // Add academic year to form data
      const assessmentWithYear = {
        ...formData,
        academic_year: new Date().getFullYear()
      };
      
      console.log('Submitting assessment:', assessmentWithYear);
      await axios.post('/api/teacher/assessments', assessmentWithYear);
      toast.success('Assessment created successfully');
      setShowCreateModal(false);
      fetchAssessments();
      resetForm();
    } catch (error) {
      console.error('Create assessment error:', error);
      toast.error(error.response?.data?.message || 'Failed to create assessment');
    }
  };

  const handleDeleteAssessment = async () => {
    if (!selectedAssessment) return;
    
    try {
      await axios.delete(`/api/teacher/assessments/${selectedAssessment.assessment_id}`);
      toast.success('Assessment deleted successfully');
      setShowDeleteModal(false);
      setSelectedAssessment(null);
      fetchAssessments();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete assessment');
    }
  };

  const handleResourceUpload = async (e, assessmentId) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('resource', file);

    setUploadingResource(true);
    try {
      await axios.post(`/api/teacher/assessments/${assessmentId}/resources`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      toast.success('Resource uploaded successfully');
      fetchAssessmentResources(assessmentId);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to upload resource');
    } finally {
      setUploadingResource(false);
    }
  };

  const handleDeleteResource = async (resourceId) => {
    if (!selectedAssessment) return;
    
    if (!window.confirm('Are you sure you want to delete this resource?')) return;
    
    try {
      await axios.delete(`/api/teacher/assessments/${selectedAssessment.assessment_id}/resources/${resourceId}`);
      toast.success('Resource deleted successfully');
      fetchAssessmentResources(selectedAssessment.assessment_id);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete resource');
    }
  };

  const resetForm = () => {
    setFormData({
      class_id: '',
      assessment_name: '',
      assessment_type: 'quiz',
      curriculum_id: '',
      subject_id: '',
      topic_id: '',
      total_marks: 20,
      passing_marks: 10,
      term_number: '1',
      due_date: '',
      scheduled_date: '',
      description: '',
    });
    setFilteredSubjects([]);
    setFilteredTopics([]);
  };

  const handleClassChange = (classId) => {
    setFormData({ 
      ...formData, 
      class_id: classId, 
      subject_id: '', 
      topic_id: '', 
      curriculum_id: '' 
    });
    
    // Find the class to get grade level
    const selectedClass = assessmentData.classes.find(c => c.class_id === classId);
    if (selectedClass && assessmentData.curricula) {
      const gradeLevel = selectedClass.grade_level;
      console.log('Selected grade level:', gradeLevel);
      
      // Get all subjects that match this grade level
      const subjectsForGrade = [];
      
      assessmentData.curricula.forEach(curriculum => {
        // Check if this curriculum is assigned to this grade level
        if (curriculum.assigned_grade === gradeLevel || 
            curriculum.assigned_grade === 'R-3' ||
            curriculum.assigned_grade.includes(gradeLevel)) {
          
          console.log('Curriculum matches:', curriculum.curriculum_name, 'for grade', gradeLevel);
          
          // Add all subjects from this curriculum
          curriculum.subjects.forEach(subject => {
            subjectsForGrade.push({
              subject_id: subject.subject_id,
              subject_name: subject.subject_name,
              curriculum_id: curriculum.curriculum_id
            });
          });
        }
      });
      
      setFilteredSubjects(subjectsForGrade);
      setFilteredTopics([]);
      console.log('Filtered subjects for grade', gradeLevel, ':', subjectsForGrade);
    }
  };

  const handleSubjectChange = (subjectId) => {
    // Find the selected subject to get its curriculum_id
    const selectedSubject = filteredSubjects.find(s => s.subject_id === subjectId);
    
    if (selectedSubject) {
      setFormData(prev => ({
        ...prev,
        subject_id: subjectId,
        topic_id: '',
        curriculum_id: selectedSubject.curriculum_id
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        subject_id: subjectId,
        topic_id: ''
      }));
    }
    
    const topics = assessmentData.topics_by_subject[subjectId] || [];
    setFilteredTopics(topics);
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

  const getResourceIcon = (type) => {
    switch(type) {
      case 'pdf': return <FaFilePdf className="text-danger me-2" />;
      case 'image': return <FaFileImage className="text-success me-2" />;
      case 'video': return <FaFileVideo className="text-primary me-2" />;
      case 'audio': return <FaFileAudio className="text-warning me-2" />;
      default: return <FaFilePdf className="text-secondary me-2" />;
    }
  };

  const getCurrentAcademicYear = () => {
    return new Date().getFullYear(); // Returns 2026
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 mb-2">Assessments</h1>
          <p className="text-muted">Create and manage assessments for your classes</p>
        </div>
        <Button variant="primary" onClick={() => setShowCreateModal(true)}>
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
                {assessmentData.classes.map(cls => (
                  <option key={cls.class_id} value={cls.class_id}>
                    {cls.class_name} (Grade {cls.grade_level})
                  </option>
                ))}
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
              <Spinner animation="border" variant="primary" />
              <p className="mt-2">Loading assessments...</p>
            </div>
          ) : filteredAssessments.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-clipboard display-1 text-muted mb-3"></i>
              <h4>No Assessments Found</h4>
              <p className="text-muted">Create your first assessment to get started.</p>
              <Button variant="primary" onClick={() => setShowCreateModal(true)}>
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
                    <th>Progress</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssessments.map((assessment) => {
                    const totalLearners = assessment.submissions || 0;
                    const gradedLearners = assessment.graded || 0;
                    const progress = totalLearners > 0 ? (gradedLearners / totalLearners) * 100 : 0;
                    
                    return (
                      <tr key={assessment.assessment_id}>
                        <td>
                          <div>
                            <strong>{assessment.assessment_name}</strong>
                            <div className="text-muted small">
                              Term {assessment.term_number} • {assessment.total_marks} marks
                              {assessment.curriculum_name && ` • ${assessment.curriculum_name}`}
                            </div>
                          </div>
                        </td>
                        <td>
                          <Badge bg="info">
                            {assessment.class_name} (Grade {assessment.grade_level})
                          </Badge>
                        </td>
                        <td>
                          <div>{assessment.subject_name || 'General'}</div>
                          {assessment.topic_name && (
                            <div className="text-muted small">{assessment.topic_name}</div>
                          )}
                        </td>
                        <td>
                          <Badge bg={getTypeBadge(assessment.assessment_type)}>
                            {assessment.assessment_type}
                          </Badge>
                        </td>
                        <td>
                          {assessment.due_date ? (
                            new Date(assessment.due_date).toLocaleDateString()
                          ) : (
                            'No due date'
                          )}
                          {assessment.scheduled_date && (
                            <div className="text-muted small">
                              Scheduled: {new Date(assessment.scheduled_date).toLocaleDateString()}
                            </div>
                          )}
                        </td>
                        <td>
                          <div className="d-flex align-items-center">
                            <div className="me-2" style={{ width: '60px' }}>
                              <ProgressBar
                                now={progress}
                                variant={progress === 100 ? 'success' : progress > 50 ? 'info' : 'warning'}
                                label={`${Math.round(progress)}%`}
                              />
                            </div>
                            <small className="text-muted">
                              {gradedLearners}/{totalLearners}
                            </small>
                          </div>
                        </td>
                        <td>
                          <div className="d-flex gap-2">
                            <Button
                              size="sm"
                              variant="outline-primary"
                              onClick={() => navigate(`/teacher/assessments/${assessment.assessment_id}/gradebook`)}
                            >
                              <i className="bi bi-clipboard-check me-1"></i>
                              Grade
                            </Button>
                            <Dropdown>
                              <Dropdown.Toggle size="sm" variant="outline-secondary">
                                <i className="bi bi-three-dots"></i>
                              </Dropdown.Toggle>
                              <Dropdown.Menu>
                                <Dropdown.Item
                                  onClick={() => {
                                    setSelectedAssessment(assessment);
                                    setShowViewModal(true);
                                  }}
                                >
                                  <FaEye className="me-2" />
                                  View Details
                                </Dropdown.Item>
                                <Dropdown.Item
                                  onClick={() => {
                                    setSelectedAssessment(assessment);
                                    setShowResourcesModal(true);
                                    fetchAssessmentResources(assessment.assessment_id);
                                  }}
                                >
                                  <FaUpload className="me-2" />
                                  Manage Resources
                                </Dropdown.Item>
                                <Dropdown.Item
                                  onClick={() => navigate(`/teacher/assessments/${assessment.assessment_id}/edit`)}
                                >
                                  <FaEdit className="me-2" />
                                  Edit
                                </Dropdown.Item>
                                <Dropdown.Divider />
                                <Dropdown.Item
                                  className="text-danger"
                                  onClick={() => {
                                    setSelectedAssessment(assessment);
                                    setShowDeleteModal(true);
                                  }}
                                >
                                  <FaTrash className="me-2" />
                                  Delete
                                </Dropdown.Item>
                              </Dropdown.Menu>
                            </Dropdown>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Create Assessment Modal */}
      <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)} size="lg">
        <Form onSubmit={handleCreateSubmit}>
          <Modal.Header closeButton>
            <Modal.Title>Create New Assessment</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Tabs defaultActiveKey="basic" className="mb-3">
              <Tab eventKey="basic" title="Basic Info">
                <Row className="g-3 mt-2">
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
                        onChange={(e) => handleClassChange(e.target.value)}
                        required
                      >
                        <option value="">Select class</option>
                        {assessmentData.classes.map(cls => (
                          <option key={cls.class_id} value={cls.class_id}>
                            {cls.class_name} (Grade {cls.grade_level}) - {cls.learner_count} learners
                          </option>
                        ))}
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
                      <Form.Label>Academic Year</Form.Label>
                      <Form.Control
                        type="text"
                        value={getCurrentAcademicYear()}
                        readOnly
                        disabled
                      />
                      <Form.Text className="text-muted">
                        Assessment will be created for the current academic year
                      </Form.Text>
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
                        max="1000"
                        required
                      />
                    </Form.Group>
                  </Col>
                </Row>
              </Tab>
              
              <Tab eventKey="curriculum" title="Curriculum Alignment">
                <Row className="g-3 mt-2">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Subject</Form.Label>
                      <Form.Select
                        value={formData.subject_id}
                        onChange={(e) => handleSubjectChange(e.target.value)}
                        disabled={!formData.class_id}
                      >
                        <option value="">Select subject (optional)</option>
                        {filteredSubjects.map(subject => (
                          <option key={subject.subject_id} value={subject.subject_id}>
                            {subject.subject_name}
                          </option>
                        ))}
                      </Form.Select>
                      <Form.Text className="text-muted">
                        {formData.class_id ? 'Subjects available for the selected class' : 'Select a class first'}
                      </Form.Text>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Topic</Form.Label>
                      <Form.Select
                        value={formData.topic_id}
                        onChange={(e) => setFormData({...formData, topic_id: e.target.value})}
                        disabled={!formData.subject_id}
                      >
                        <option value="">Select topic (optional)</option>
                        {filteredTopics.map(topic => (
                          <option key={topic.topic_id} value={topic.topic_id}>
                            {topic.topic_name}
                          </option>
                        ))}
                      </Form.Select>
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
                        max={formData.total_marks}
                        placeholder={`0-${formData.total_marks}`}
                      />
                    </Form.Group>
                  </Col>
                </Row>
              </Tab>
              
              <Tab eventKey="schedule" title="Schedule & Description">
                <Row className="g-3 mt-2">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Due Date</Form.Label>
                      <Form.Control
                        type="date"
                        value={formData.due_date}
                        onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                        min={new Date().toISOString().split('T')[0]}
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
                      <Form.Label>Description & Instructions</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={4}
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                        placeholder="Enter assessment description, instructions, and any important notes for learners..."
                      />
                    </Form.Group>
                  </Col>
                </Row>
              </Tab>
            </Tabs>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Create Assessment
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Delete Assessment</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedAssessment && (
            <Alert variant="warning">
              <Alert.Heading>Are you sure?</Alert.Heading>
              <p>
                You are about to delete the assessment <strong>"{selectedAssessment.assessment_name}"</strong>.
                This action cannot be undone.
              </p>
              <p className="mb-0">
                This will also delete all grades and resources associated with this assessment.
              </p>
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDeleteAssessment}>
            Delete Assessment
          </Button>
        </Modal.Footer>
      </Modal>

      {/* View Assessment Modal */}
      <Modal show={showViewModal} onHide={() => setShowViewModal(false)} size="lg">
        {selectedAssessment && (
          <>
            <Modal.Header closeButton>
              <Modal.Title>{selectedAssessment.assessment_name}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Row>
                <Col md={6}>
                  <div className="mb-3">
                    <h6>Assessment Details</h6>
                    <p><strong>Type:</strong> <Badge bg={getTypeBadge(selectedAssessment.assessment_type)}>
                      {selectedAssessment.assessment_type}
                    </Badge></p>
                    <p><strong>Class:</strong> {selectedAssessment.class_name} (Grade {selectedAssessment.grade_level})</p>
                    <p><strong>Term:</strong> {selectedAssessment.term_number}</p>
                    <p><strong>Total Marks:</strong> {selectedAssessment.total_marks}</p>
                    {selectedAssessment.passing_marks && (
                      <p><strong>Passing Marks:</strong> {selectedAssessment.passing_marks}</p>
                    )}
                  </div>
                </Col>
                <Col md={6}>
                  <div className="mb-3">
                    <h6>Curriculum Alignment</h6>
                    {selectedAssessment.subject_name ? (
                      <>
                        <p><strong>Subject:</strong> {selectedAssessment.subject_name}</p>
                        {selectedAssessment.topic_name && (
                          <p><strong>Topic:</strong> {selectedAssessment.topic_name}</p>
                        )}
                        {selectedAssessment.curriculum_name && (
                          <p><strong>Curriculum:</strong> {selectedAssessment.curriculum_name}</p>
                        )}
                      </>
                    ) : (
                      <p className="text-muted">No curriculum alignment specified</p>
                    )}
                  </div>
                </Col>
              </Row>
              
              {selectedAssessment.description && (
                <div className="mb-3">
                  <h6>Description</h6>
                  <p>{selectedAssessment.description}</p>
                </div>
              )}
              
              <div className="mb-3">
                <h6>Schedule</h6>
                <Row>
                  <Col md={6}>
                    <p>
                      <strong>Due Date:</strong>{' '}
                      {selectedAssessment.due_date ? (
                        new Date(selectedAssessment.due_date).toLocaleDateString()
                      ) : (
                        'Not set'
                      )}
                    </p>
                  </Col>
                  <Col md={6}>
                    <p>
                      <strong>Scheduled Date:</strong>{' '}
                      {selectedAssessment.scheduled_date ? (
                        new Date(selectedAssessment.scheduled_date).toLocaleDateString()
                      ) : (
                        'Not set'
                      )}
                    </p>
                  </Col>
                </Row>
              </div>
              
              <div className="mb-3">
                <h6>Statistics</h6>
                <Row>
                  <Col md={4}>
                    <div className="text-center">
                      <div className="h4">{selectedAssessment.submissions || 0}</div>
                      <small className="text-muted">Total Learners</small>
                    </div>
                  </Col>
                  <Col md={4}>
                    <div className="text-center">
                      <div className="h4">{selectedAssessment.graded || 0}</div>
                      <small className="text-muted">Graded</small>
                    </div>
                  </Col>
                  <Col md={4}>
                    <div className="text-center">
                      <div className="h4">
                        {selectedAssessment.submissions ? 
                          Math.round((selectedAssessment.graded || 0) / selectedAssessment.submissions * 100) : 0}%
                      </div>
                      <small className="text-muted">Completion</small>
                    </div>
                  </Col>
                </Row>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="primary"
                onClick={() => {
                  setShowViewModal(false);
                  navigate(`/teacher/assessments/${selectedAssessment.assessment_id}/gradebook`);
                }}
              >
                Grade Assessment
              </Button>
              <Button variant="secondary" onClick={() => setShowViewModal(false)}>
                Close
              </Button>
            </Modal.Footer>
          </>
        )}
      </Modal>

      {/* Manage Resources Modal */}
      <Modal show={showResourcesModal} onHide={() => setShowResourcesModal(false)} size="lg">
        {selectedAssessment && (
          <>
            <Modal.Header closeButton>
              <Modal.Title>
                Manage Resources: {selectedAssessment.assessment_name}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Alert variant="info" className="mb-3">
                <i className="bi bi-info-circle me-2"></i>
                Upload resources like PDFs, images, videos, or audio files to help learners complete this assessment.
              </Alert>
              
              {/* Upload Section */}
              <div className="mb-4">
                <Form.Group>
                  <Form.Label>Upload New Resource</Form.Label>
                  <Form.Control
                    type="file"
                    onChange={(e) => handleResourceUpload(e, selectedAssessment.assessment_id)}
                    disabled={uploadingResource}
                  />
                  <Form.Text className="text-muted">
                    Supported files: PDF, DOC, Images, Videos, Audio (Max 50MB)
                  </Form.Text>
                </Form.Group>
                {uploadingResource && (
                  <div className="mt-2">
                    <Spinner size="sm" animation="border" className="me-2" />
                    Uploading...
                  </div>
                )}
              </div>
              
              {/* Resources List */}
              <div>
                <h6>Existing Resources</h6>
                {resources.length === 0 ? (
                  <Alert variant="light" className="text-center py-4">
                    <i className="bi bi-inbox display-4 text-muted mb-3"></i>
                    <p>No resources uploaded yet.</p>
                    <p className="text-muted small">Upload your first resource above.</p>
                  </Alert>
                ) : (
                  <ListGroup>
                    {resources.map(resource => (
                      <ListGroup.Item key={resource.resource_id} className="d-flex justify-content-between align-items-center">
                        <div>
                          {getResourceIcon(resource.resource_type)}
                          <strong>{resource.resource_name}</strong>
                          <Badge bg="light" text="dark" className="ms-2">
                            {resource.resource_type}
                          </Badge>
                          <div className="text-muted small">
                            Uploaded: {new Date(resource.uploaded_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div>
                          <Button
                            size="sm"
                            variant="outline-primary"
                            href={resource.resource_url}
                            target="_blank"
                            className="me-2"
                          >
                            View
                          </Button>
                          <Button
                            size="sm"
                            variant="outline-danger"
                            onClick={() => handleDeleteResource(resource.resource_id)}
                          >
                            <FaTrash />
                          </Button>
                        </div>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                )}
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowResourcesModal(false)}>
                Close
              </Button>
            </Modal.Footer>
          </>
        )}
      </Modal>
    </div>
  );
};

export default Assessments;