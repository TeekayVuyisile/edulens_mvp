import React, { useState, useEffect } from 'react';
import { Table, Button, Card, Form, InputGroup, Modal, Row, Col, Badge, Accordion, Alert } from 'react-bootstrap';
import { toast } from 'react-hot-toast';
import axios from 'axios';

const Curricula = () => {
  const [curricula, setCurricula] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedCurriculum, setSelectedCurriculum] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedItemType, setSelectedItemType] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    curriculum_name: '',
    description: '',
  });
  const [subjectFormData, setSubjectFormData] = useState({
    subject_name: '',
    subject_code: '',
    description: '',
    grade_level: 'R-3',
  });
  const [topicFormData, setTopicFormData] = useState({
    topic_name: '',
    topic_code: '',
    description: '',
    learning_objectives: '',
  });
  const [editFormData, setEditFormData] = useState({});

  useEffect(() => {
    fetchCurricula();
  }, []);

  const fetchCurricula = async () => {
    try {
      const response = await axios.get('/api/super-admin/curricula');
      setCurricula(response.data.data.curricula || []);
    } catch (error) {
      toast.error('Failed to fetch curricula');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/super-admin/curricula', formData);
      toast.success('Curriculum created successfully');
      setShowModal(false);
      fetchCurricula();
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create curriculum');
    }
  };

  const handleSubjectSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`/api/super-admin/curricula/${selectedCurriculum}/subjects`, subjectFormData);
      toast.success('Subject added successfully');
      setShowSubjectModal(false);
      fetchCurricula();
      resetSubjectForm();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add subject');
    }
  };

  const handleTopicSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`/api/super-admin/subjects/${selectedSubject}/topics`, topicFormData);
      toast.success('Topic added successfully');
      setShowTopicModal(false);
      fetchCurricula();
      resetTopicForm();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add topic');
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      let endpoint = '';
      let id = '';
      
      switch (selectedItemType) {
        case 'curriculum':
          endpoint = `/api/super-admin/curricula/${selectedItem}`;
          break;
        case 'subject':
          endpoint = `/api/super-admin/subjects/${selectedItem}`;
          break;
        case 'topic':
          endpoint = `/api/super-admin/topics/${selectedItem}`;
          break;
        default:
          return;
      }
      
      await axios.put(endpoint, editFormData);
      toast.success(`${selectedItemType.charAt(0).toUpperCase() + selectedItemType.slice(1)} updated successfully`);
      setShowEditModal(false);
      fetchCurricula();
      resetEditForm();
    } catch (error) {
      toast.error(error.response?.data?.message || `Failed to update ${selectedItemType}`);
    }
  };

  const handleDelete = async () => {
    try {
      let endpoint = '';
      
      switch (selectedItemType) {
        case 'curriculum':
          endpoint = `/api/super-admin/curricula/${selectedItem}`;
          break;
        case 'subject':
          endpoint = `/api/super-admin/subjects/${selectedItem}`;
          break;
        case 'topic':
          endpoint = `/api/super-admin/topics/${selectedItem}`;
          break;
        default:
          return;
      }
      
      await axios.delete(endpoint);
      toast.success(`${selectedItemType.charAt(0).toUpperCase() + selectedItemType.slice(1)} deleted successfully`);
      setShowDeleteModal(false);
      fetchCurricula();
      resetSelection();
    } catch (error) {
      toast.error(error.response?.data?.message || `Failed to delete ${selectedItemType}`);
    }
  };

  const resetForm = () => {
    setFormData({
      curriculum_name: '',
      description: '',
    });
  };

  const resetSubjectForm = () => {
    setSubjectFormData({
      subject_name: '',
      subject_code: '',
      description: '',
      grade_level: 'R-3',
    });
    setSelectedCurriculum(null);
  };

  const resetTopicForm = () => {
    setTopicFormData({
      topic_name: '',
      topic_code: '',
      description: '',
      learning_objectives: '',
    });
    setSelectedSubject(null);
  };

  const resetEditForm = () => {
    setEditFormData({});
    setSelectedItem(null);
    setSelectedItemType(null);
  };

  const resetSelection = () => {
    setSelectedItem(null);
    setSelectedItemType(null);
  };

  const handleEditClick = (item, type, data) => {
    setSelectedItem(item);
    setSelectedItemType(type);
    setEditFormData(data);
    setShowEditModal(true);
  };

  const handleDeleteClick = (item, type, name) => {
    setSelectedItem(item);
    setSelectedItemType(type);
    setShowDeleteModal(true);
  };

  const filteredCurricula = curricula.filter(curriculum =>
    curriculum.curriculum_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    curriculum.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 mb-2">Curricula Management</h1>
          <p className="text-muted">Define and manage available curricula, subjects, and topics</p>
        </div>
        <Button variant="primary" onClick={() => setShowModal(true)}>
          <i className="bi bi-plus-circle me-2"></i>
          Add Curriculum
        </Button>
      </div>

      {/* Statistics */}
      <Row className="g-3 mb-4">
        <Col xs={12} md={6} lg={3}>
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="text-muted mb-2">Total Curricula</h6>
                  <h2 className="fw-bold mb-0">{curricula.length}</h2>
                </div>
                <div className="bg-primary-subtle p-3 rounded">
                  <i className="bi bi-book fs-4 text-primary"></i>
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
                  <h6 className="text-muted mb-2">Total Subjects</h6>
                  <h2 className="fw-bold mb-0">
                    {curricula.reduce((total, curr) => total + (curr.subjects?.length || 0), 0)}
                  </h2>
                </div>
                <div className="bg-success-subtle p-3 rounded">
                  <i className="bi bi-journal-text fs-4 text-success"></i>
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
                  <h6 className="text-muted mb-2">Total Topics</h6>
                  <h2 className="fw-bold mb-0">
                    {curricula.reduce((total, curr) => 
                      total + (curr.subjects?.reduce((subTotal, sub) => 
                        subTotal + (sub.topics?.length || 0), 0) || 0), 0)}
                  </h2>
                </div>
                <div className="bg-info-subtle p-3 rounded">
                  <i className="bi bi-file-text fs-4 text-info"></i>
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
                  <h6 className="text-muted mb-2">Active Curricula</h6>
                  <h2 className="fw-bold mb-0">
                    {curricula.filter(c => c.is_active).length}
                  </h2>
                </div>
                <div className="bg-warning-subtle p-3 rounded">
                  <i className="bi bi-check-circle fs-4 text-warning"></i>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="border-0 shadow-sm mb-4">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div className="w-100 me-3">
              <InputGroup>
                <InputGroup.Text>
                  <i className="bi bi-search"></i>
                </InputGroup.Text>
                <Form.Control
                  placeholder="Search curricula..."
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
          ) : filteredCurricula.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-book display-1 text-muted mb-3"></i>
              <h4>No Curricula Found</h4>
              <p className="text-muted">Create your first curriculum to get started.</p>
              <Button variant="primary" onClick={() => setShowModal(true)}>
                Create Curriculum
              </Button>
            </div>
          ) : (
            <Accordion>
              {filteredCurricula.map((curriculum, index) => (
                <Accordion.Item key={curriculum.curriculum_id} eventKey={index.toString()}>
                  <Accordion.Header>
                    <div className="d-flex align-items-center w-100">
                      <div className="me-3">
                        <i className="bi bi-book text-primary"></i>
                      </div>
                      <div className="flex-grow-1">
                        <strong>{curriculum.curriculum_name}</strong>
                        <div className="text-muted small">{curriculum.description}</div>
                      </div>
                      <Badge bg="success" className="me-2">
                        {curriculum.subjects?.length || 0} Subjects
                      </Badge>
                      <Badge bg={curriculum.is_active ? 'success' : 'secondary'}>
                        {curriculum.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </Accordion.Header>
                  <Accordion.Body>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h6 className="mb-0">Subjects</h6>
                      <Button 
                        size="sm" 
                        variant="outline-primary"
                        onClick={() => {
                          setSelectedCurriculum(curriculum.curriculum_id);
                          setShowSubjectModal(true);
                        }}
                      >
                        <i className="bi bi-plus me-1"></i>
                        Add Subject
                      </Button>
                    </div>
                    
                    {curriculum.subjects && curriculum.subjects.length > 0 ? (
                      <div className="ms-4">
                        {curriculum.subjects.map((subject, sIndex) => (
                          <div key={subject.subject_id} className="mb-3">
                            <Card className="border">
                              <Card.Body>
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                  <div>
                                    <strong>{subject.subject_name}</strong>
                                    <div className="text-muted small">
                                      Code: {subject.subject_code} • Grade: {subject.grade_level}
                                      {subject.description && (
                                        <div>{subject.description}</div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="d-flex gap-2">
                                    <Button 
                                      size="sm" 
                                      variant="outline-success"
                                      onClick={() => {
                                        setSelectedSubject(subject.subject_id);
                                        setShowTopicModal(true);
                                      }}
                                    >
                                      <i className="bi bi-plus me-1"></i>
                                      Add Topic
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant="outline-warning"
                                      onClick={() => handleEditClick(
                                        subject.subject_id, 
                                        'subject',
                                        {
                                          subject_name: subject.subject_name,
                                          subject_code: subject.subject_code,
                                          description: subject.description,
                                          grade_level: subject.grade_level
                                        }
                                      )}
                                    >
                                      <i className="bi bi-pencil"></i>
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant="outline-danger"
                                      onClick={() => handleDeleteClick(
                                        subject.subject_id, 
                                        'subject',
                                        subject.subject_name
                                      )}
                                    >
                                      <i className="bi bi-trash"></i>
                                    </Button>
                                  </div>
                                </div>
                                
                                {subject.topics && subject.topics.length > 0 && (
                                  <div className="ms-3">
                                    <h6 className="small text-muted mb-2">Topics:</h6>
                                    <Row className="g-2">
                                      {subject.topics.map((topic) => (
                                        <Col key={topic.topic_id} xs={12} md={6} lg={4}>
                                          <Card className="border bg-light">
                                            <Card.Body className="p-3">
                                              <div className="d-flex justify-content-between align-items-start">
                                                <div>
                                                  <strong className="small">{topic.topic_name}</strong>
                                                  <div className="text-muted extra-small">
                                                    {topic.topic_code}
                                                    {topic.description && (
                                                      <div>{topic.description}</div>
                                                    )}
                                                  </div>
                                                </div>
                                                <div className="d-flex gap-1">
                                                  <Button 
                                                    size="sm" 
                                                    variant="outline-warning"
                                                    className="p-1"
                                                    onClick={() => handleEditClick(
                                                      topic.topic_id, 
                                                      'topic',
                                                      {
                                                        topic_name: topic.topic_name,
                                                        topic_code: topic.topic_code,
                                                        description: topic.description,
                                                        learning_objectives: topic.learning_objectives
                                                      }
                                                    )}
                                                  >
                                                    <i className="bi bi-pencil"></i>
                                                  </Button>
                                                  <Button 
                                                    size="sm" 
                                                    variant="outline-danger"
                                                    className="p-1"
                                                    onClick={() => handleDeleteClick(
                                                      topic.topic_id, 
                                                      'topic',
                                                      topic.topic_name
                                                    )}
                                                  >
                                                    <i className="bi bi-trash"></i>
                                                  </Button>
                                                </div>
                                              </div>
                                            </Card.Body>
                                          </Card>
                                        </Col>
                                      ))}
                                    </Row>
                                  </div>
                                )}
                              </Card.Body>
                            </Card>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-3">
                        <p className="text-muted">No subjects added yet.</p>
                      </div>
                    )}
                    
                    <div className="d-flex gap-2 mt-3">
                      <Button 
                        size="sm" 
                        variant="outline-warning"
                        onClick={() => handleEditClick(
                          curriculum.curriculum_id, 
                          'curriculum',
                          {
                            curriculum_name: curriculum.curriculum_name,
                            description: curriculum.description
                          }
                        )}
                      >
                        <i className="bi bi-pencil me-1"></i>
                        Edit Curriculum
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline-danger"
                        onClick={() => handleDeleteClick(
                          curriculum.curriculum_id, 
                          'curriculum',
                          curriculum.curriculum_name
                        )}
                      >
                        <i className="bi bi-trash me-1"></i>
                        Delete Curriculum
                      </Button>
                      <Button size="sm" variant="outline-secondary">
                        <i className="bi bi-eye me-1"></i>
                        View Details
                      </Button>
                    </div>
                  </Accordion.Body>
                </Accordion.Item>
              ))}
            </Accordion>
          )}
        </Card.Body>
      </Card>

      {/* Add Curriculum Modal */}
      <Modal show={showModal} onHide={() => { setShowModal(false); resetForm(); }}>
        <Form onSubmit={handleSubmit}>
          <Modal.Header closeButton>
            <Modal.Title>Add New Curriculum</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Curriculum Name *</Form.Label>
              <Form.Control
                type="text"
                value={formData.curriculum_name}
                onChange={(e) => setFormData({...formData, curriculum_name: e.target.value})}
                placeholder="e.g., CAPS, Cambridge"
                required
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Enter curriculum description..."
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => { setShowModal(false); resetForm(); }}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Create Curriculum
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Add Subject Modal */}
      <Modal show={showSubjectModal} onHide={() => { setShowSubjectModal(false); resetSubjectForm(); }}>
        <Form onSubmit={handleSubjectSubmit}>
          <Modal.Header closeButton>
            <Modal.Title>Add Subject to Curriculum</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Subject Name *</Form.Label>
              <Form.Control
                type="text"
                value={subjectFormData.subject_name}
                onChange={(e) => setSubjectFormData({...subjectFormData, subject_name: e.target.value})}
                placeholder="e.g., Mathematics, English Home Language"
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Subject Code</Form.Label>
              <Form.Control
                type="text"
                value={subjectFormData.subject_code}
                onChange={(e) => setSubjectFormData({...subjectFormData, subject_code: e.target.value})}
                placeholder="e.g., MATH, ENG-HL"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Grade Level</Form.Label>
              <Form.Select
                value={subjectFormData.grade_level}
                onChange={(e) => setSubjectFormData({...subjectFormData, grade_level: e.target.value})}
              >
                <option value="R-3">Grade R-3</option>
                <option value="R">Grade R Only</option>
                <option value="1">Grade 1 Only</option>
                <option value="2">Grade 2 Only</option>
                <option value="3">Grade 3 Only</option>
              </Form.Select>
            </Form.Group>
            <Form.Group>
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={subjectFormData.description}
                onChange={(e) => setSubjectFormData({...subjectFormData, description: e.target.value})}
                placeholder="Enter subject description..."
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => { setShowSubjectModal(false); resetSubjectForm(); }}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Add Subject
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Add Topic Modal */}
      <Modal show={showTopicModal} onHide={() => { setShowTopicModal(false); resetTopicForm(); }}>
        <Form onSubmit={handleTopicSubmit}>
          <Modal.Header closeButton>
            <Modal.Title>Add Topic to Subject</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Topic Name *</Form.Label>
              <Form.Control
                type="text"
                value={topicFormData.topic_name}
                onChange={(e) => setTopicFormData({...topicFormData, topic_name: e.target.value})}
                placeholder="e.g., Addition, Phonemic Awareness"
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Topic Code</Form.Label>
              <Form.Control
                type="text"
                value={topicFormData.topic_code}
                onChange={(e) => setTopicFormData({...topicFormData, topic_code: e.target.value})}
                placeholder="e.g., ADD-101, PHON-201"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Learning Objectives</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={topicFormData.learning_objectives}
                onChange={(e) => setTopicFormData({...topicFormData, learning_objectives: e.target.value})}
                placeholder="Enter learning objectives..."
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={topicFormData.description}
                onChange={(e) => setTopicFormData({...topicFormData, description: e.target.value})}
                placeholder="Enter topic description..."
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => { setShowTopicModal(false); resetTopicForm(); }}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Add Topic
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal show={showEditModal} onHide={() => { setShowEditModal(false); resetEditForm(); }}>
        <Form onSubmit={handleEditSubmit}>
          <Modal.Header closeButton>
            <Modal.Title>
              Edit {selectedItemType ? selectedItemType.charAt(0).toUpperCase() + selectedItemType.slice(1) : ''}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {selectedItemType === 'curriculum' && (
              <>
                <Form.Group className="mb-3">
                  <Form.Label>Curriculum Name *</Form.Label>
                  <Form.Control
                    type="text"
                    value={editFormData.curriculum_name || ''}
                    onChange={(e) => setEditFormData({...editFormData, curriculum_name: e.target.value})}
                    required
                  />
                </Form.Group>
                <Form.Group>
                  <Form.Label>Description</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={editFormData.description || ''}
                    onChange={(e) => setEditFormData({...editFormData, description: e.target.value})}
                  />
                </Form.Group>
              </>
            )}
            
            {selectedItemType === 'subject' && (
              <>
                <Form.Group className="mb-3">
                  <Form.Label>Subject Name *</Form.Label>
                  <Form.Control
                    type="text"
                    value={editFormData.subject_name || ''}
                    onChange={(e) => setEditFormData({...editFormData, subject_name: e.target.value})}
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Subject Code</Form.Label>
                  <Form.Control
                    type="text"
                    value={editFormData.subject_code || ''}
                    onChange={(e) => setEditFormData({...editFormData, subject_code: e.target.value})}
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Grade Level</Form.Label>
                  <Form.Select
                    value={editFormData.grade_level || 'R-3'}
                    onChange={(e) => setEditFormData({...editFormData, grade_level: e.target.value})}
                  >
                    <option value="R-3">Grade R-3</option>
                    <option value="R">Grade R Only</option>
                    <option value="1">Grade 1 Only</option>
                    <option value="2">Grade 2 Only</option>
                    <option value="3">Grade 3 Only</option>
                  </Form.Select>
                </Form.Group>
                <Form.Group>
                  <Form.Label>Description</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={editFormData.description || ''}
                    onChange={(e) => setEditFormData({...editFormData, description: e.target.value})}
                  />
                </Form.Group>
              </>
            )}
            
            {selectedItemType === 'topic' && (
              <>
                <Form.Group className="mb-3">
                  <Form.Label>Topic Name *</Form.Label>
                  <Form.Control
                    type="text"
                    value={editFormData.topic_name || ''}
                    onChange={(e) => setEditFormData({...editFormData, topic_name: e.target.value})}
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Topic Code</Form.Label>
                  <Form.Control
                    type="text"
                    value={editFormData.topic_code || ''}
                    onChange={(e) => setEditFormData({...editFormData, topic_code: e.target.value})}
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Learning Objectives</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={editFormData.learning_objectives || ''}
                    onChange={(e) => setEditFormData({...editFormData, learning_objectives: e.target.value})}
                  />
                </Form.Group>
                <Form.Group>
                  <Form.Label>Description</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={editFormData.description || ''}
                    onChange={(e) => setEditFormData({...editFormData, description: e.target.value})}
                  />
                </Form.Group>
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => { setShowEditModal(false); resetEditForm(); }}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Update
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={() => { setShowDeleteModal(false); resetSelection(); }}>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Delete</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="warning">
            <i className="bi bi-exclamation-triangle me-2"></i>
            Are you sure you want to delete this {selectedItemType}? This action cannot be undone.
          </Alert>
          <p className="text-muted">
            Note: This will only soft delete the item (set to inactive). It will not be removed from the database.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => { setShowDeleteModal(false); resetSelection(); }}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            Delete
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Curricula;