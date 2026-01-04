import React, { useState, useEffect, useRef } from 'react';
import { 
  Table, Button, Card, Form, InputGroup, Modal, 
  Row, Col, Badge, Dropdown, Alert, Spinner, 
  Pagination, Tooltip, OverlayTrigger, Tabs, Tab 
} from 'react-bootstrap';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import * as XLSX from 'xlsx';

const Learners = () => {
  const [learners, setLearners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignClassModal, setShowAssignClassModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [currentLearner, setCurrentLearner] = useState(null);
  const [classes, setClasses] = useState([]);
  const [availableClasses, setAvailableClasses] = useState([]);
  const [learnerPerformance, setLearnerPerformance] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [formErrors, setFormErrors] = useState({});
  const [activeTab, setActiveTab] = useState('active');
  const [filterClass, setFilterClass] = useState('');
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    gender: '',
    current_class_id: '',
    guardian_name: '',
    guardian_email: '',
    guardian_phone: '',
    has_special_needs: false,
    special_needs_notes: '',
    medical_notes: ''
  });

  const [editFormData, setEditFormData] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    gender: '',
    guardian_name: '',
    guardian_email: '',
    guardian_phone: '',
    has_special_needs: false,
    special_needs_notes: '',
    medical_notes: '',
    academic_status: 'active'
  });

  const [classAssignment, setClassAssignment] = useState({
    class_id: '',
    academic_year: new Date().getFullYear()
  });

  const [progressForm, setProgressForm] = useState({
    action: 'promote',
    next_class_id: '',
    notes: ''
  });

  // Calculate max date for date of birth (minimum 4 years old)
  const calculateMaxDate = () => {
    const today = new Date();
    const minDate = new Date();
    minDate.setFullYear(today.getFullYear() - 4);
    return minDate.toISOString().split('T')[0];
  };

  // Calculate min date for date of birth (maximum 10 years old for Grade 3)
  const calculateMinDate = () => {
    const today = new Date();
    const maxDate = new Date();
    maxDate.setFullYear(today.getFullYear() - 10);
    return maxDate.toISOString().split('T')[0];
  };

  useEffect(() => {
    fetchLearners();
    fetchClasses();
  }, [currentPage, activeTab, filterClass]);

  const fetchLearners = async () => {
    try {
      setLoading(true);
      let url = `/api/school-admin/learners?page=${currentPage}&limit=20`;
      
      if (searchTerm) {
        url += `&search=${searchTerm}`;
      }
      if (activeTab) {
        url += `&status=${activeTab}`;
      }
      if (filterClass) {
        url += `&class_id=${filterClass}`;
      }

      const response = await axios.get(url);
      setLearners(response.data.data.learners || []);
      setTotalPages(response.data.data.totalPages || 1);
    } catch (error) {
      console.error('Fetch learners error:', error);
      if (error.response?.status === 400) {
        toast.error('Invalid request parameters');
      } else {
        toast.error('Failed to fetch learners');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchClasses = async () => {
    try {
      const currentYear = new Date().getFullYear();
      const response = await axios.get(`/api/school-admin/classes?academic_year=${currentYear}`);
      setClasses(response.data.data.classes || []);
    } catch (error) {
      console.error('Fetch classes error:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = {};

    // Validation
    if (!formData.first_name.trim()) errors.first_name = 'First name is required';
    if (!formData.last_name.trim()) errors.last_name = 'Last name is required';
    if (!formData.date_of_birth) {
      errors.date_of_birth = 'Date of birth is required';
    } else {
      const dob = new Date(formData.date_of_birth);
      const today = new Date();
      const age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      
      // Adjust age if birthday hasn't occurred this year
      const adjustedAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate()) ? age - 1 : age;
      
      if (adjustedAge < 4) {
        errors.date_of_birth = 'Learner must be at least 4 years old for Grade R';
      }
      if (adjustedAge > 10) {
        errors.date_of_birth = 'Learner is too old for Grade R-3 system (maximum age: 10)';
      }
    }

    // Email validation if provided
    if (formData.guardian_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.guardian_email)) {
      errors.guardian_email = 'Invalid email format';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      // Prepare payload - ensure current_class_id is null if empty string
      const payload = {
        ...formData,
        current_class_id: formData.current_class_id || null
      };

      await axios.post('/api/school-admin/learners', payload);
      toast.success('Learner created successfully');
      setShowModal(false);
      resetForm();
      fetchLearners();
    } catch (error) {
      console.error('Create learner error:', error);
      const errorMsg = error.response?.data?.message || 'Failed to create learner';
      toast.error(errorMsg);
      
      if (error.response?.data?.errors) {
        setFormErrors(error.response.data.errors);
      }
    }
  };

  const handleImport = async (e) => {
    e.preventDefault();
    
    if (!importFile) {
      toast.error('Please select a file to import');
      return;
    }

    setImporting(true);
    const importFormData = new FormData();
    importFormData.append('file', importFile);

    try {
      const response = await axios.post('/api/school-admin/learners/bulk-import', importFormData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      const { data } = response.data;
      
      if (data.summary.failed > 0) {
        toast.success(
          `Import completed with ${data.summary.success} successful and ${data.summary.failed} failed`,
          { duration: 5000 }
        );
        
        // Show errors if any
        if (data.summary.errors && data.summary.errors.length > 0) {
          console.log('Import errors:', data.summary.errors);
        }
      } else {
        toast.success(`Successfully imported ${data.summary.success} learners`);
      }

      setShowImportModal(false);
      setImportFile(null);
      fetchLearners();
    } catch (error) {
      console.error('Import error:', error);
      toast.error(error.response?.data?.message || 'Failed to import learners');
    } finally {
      setImporting(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImportFile(file);
    }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet(csvTemplate);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Learners Template');
    
    // Generate Excel file
    XLSX.writeFile(wb, 'learners_import_template.xlsx');
    
    toast.success('Template downloaded successfully');
  };

  const viewLearnerDetails = async (learner) => {
    try {
      setCurrentLearner(learner);
      
      // Fetch learner performance data if available
      try {
        const response = await axios.get(`/api/school-admin/learners/${learner.learner_id}/performance`);
        setLearnerPerformance(response.data.data);
      } catch (error) {
        console.error('Fetch performance error:', error);
        setLearnerPerformance(null);
      }
      
      setShowDetailsModal(true);
    } catch (error) {
      toast.error('Failed to fetch learner details');
    }
  };

  const editLearner = (learner) => {
    setCurrentLearner(learner);
    setEditFormData({
      first_name: learner.first_name,
      last_name: learner.last_name,
      date_of_birth: learner.date_of_birth,
      gender: learner.gender || '',
      guardian_name: learner.guardian_name || '',
      guardian_email: learner.guardian_email || '',
      guardian_phone: learner.guardian_phone || '',
      has_special_needs: learner.has_special_needs || false,
      special_needs_notes: learner.special_needs_notes || '',
      medical_notes: learner.medical_notes || '',
      academic_status: learner.academic_status || 'active'
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    
    try {
      await axios.put(`/api/school-admin/learners/${currentLearner.learner_id}`, editFormData);
      toast.success('Learner updated successfully');
      setShowEditModal(false);
      fetchLearners();
    } catch (error) {
      console.error('Update learner error:', error);
      toast.error(error.response?.data?.message || 'Failed to update learner');
    }
  };

  const assignClassToLearner = (learner) => {
    setCurrentLearner(learner);
    setClassAssignment({
      class_id: learner.current_class_id || '',
      academic_year: new Date().getFullYear()
    });
    setShowAssignClassModal(true);
  };

  const handleClassAssignment = async (e) => {
    e.preventDefault();
    
    if (!classAssignment.class_id) {
      toast.error('Please select a class');
      return;
    }

    try {
      await axios.post(`/api/school-admin/classes/${classAssignment.class_id}/assign-learner`, {
        learner_id: currentLearner.learner_id
      });
      toast.success('Learner assigned to class successfully');
      setShowAssignClassModal(false);
      fetchLearners();
    } catch (error) {
      console.error('Assign class error:', error);
      toast.error(error.response?.data?.message || 'Failed to assign learner to class');
    }
  };

  const updateLearnerProgress = (learner) => {
    setCurrentLearner(learner);
    setProgressForm({
      action: 'promote',
      next_class_id: '',
      notes: ''
    });
    setShowProgressModal(true);
  };

  const handleProgressSubmit = async (e) => {
    e.preventDefault();
    
    try {
      await axios.post(`/api/school-admin/learners/${currentLearner.learner_id}/progress`, progressForm);
      toast.success(`Learner ${progressForm.action === 'promote' ? 'promoted' : 'marked to repeat'} successfully`);
      setShowProgressModal(false);
      fetchLearners();
    } catch (error) {
      console.error('Update progress error:', error);
      toast.error(error.response?.data?.message || 'Failed to update learner progress');
    }
  };

  const toggleLearnerStatus = async (learnerId, currentStatus) => {
    const action = currentStatus === 'active' ? 'archive' : 'activate';
    if (!window.confirm(`Are you sure you want to ${action} this learner?`)) {
      return;
    }

    try {
      await axios.patch(`/api/school-admin/learners/${learnerId}/status`, {
        academic_status: currentStatus === 'active' ? 'archived' : 'active'
      });
      toast.success(`Learner ${action}ed successfully`);
      fetchLearners();
    } catch (error) {
      console.error('Toggle status error:', error);
      toast.error('Failed to update learner status');
    }
  };

  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return 0;
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    
    return age;
  };

  const getGradeLevel = (dateOfBirth) => {
    const age = calculateAge(dateOfBirth);
    
    if (age >= 4 && age <= 5) return 'Grade R';
    if (age >= 6 && age <= 7) return 'Grade 1';
    if (age >= 7 && age <= 8) return 'Grade 2';
    if (age >= 8 && age <= 9) return 'Grade 3';
    return 'Unknown';
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
      has_special_needs: false,
      special_needs_notes: '',
      medical_notes: ''
    });
    setFormErrors({});
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <Badge bg="success">Active</Badge>;
      case 'archived':
        return <Badge bg="secondary">Archived</Badge>;
      case 'graduated':
        return <Badge bg="info">Graduated</Badge>;
      case 'repeated':
        return <Badge bg="warning" text="dark">Repeated</Badge>;
      case 'inactive':
        return <Badge bg="danger">Inactive</Badge>;
      default:
        return <Badge bg="secondary">{status}</Badge>;
    }
  };

  // CSV template structure
  const csvTemplate = [
    {
      'first_name': 'John',
      'last_name': 'Doe',
      'date_of_birth': '2018-05-15',
      'gender': 'Male',
      'guardian_name': 'Jane Doe',
      'guardian_email': 'jane.doe@email.com',
      'guardian_phone': '0123456789',
      'current_class_id': ''
    }
  ];

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 mb-2">Learners Management</h1>
          <p className="text-muted">Manage all learners from Grade R to Grade 3</p>
        </div>
        <div className="d-flex gap-2">
          <Dropdown>
            <Dropdown.Toggle variant="outline-primary">
              <i className="bi bi-upload me-2"></i>
              Import
            </Dropdown.Toggle>
            <Dropdown.Menu>
              <Dropdown.Item 
                onClick={() => {
                  setShowImportModal(true);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
              >
                <i className="bi bi-file-earmark-excel me-2"></i>
                Import from CSV/Excel
              </Dropdown.Item>
              <Dropdown.Item onClick={downloadTemplate}>
                <i className="bi bi-download me-2"></i>
                Download Template
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
          <Button 
            variant="primary" 
            onClick={() => {
              setShowModal(true);
              resetForm();
            }}
          >
            <i className="bi bi-plus-circle me-2"></i>
            Add Learner
          </Button>
        </div>
      </div>

      <Card className="border-0 shadow-sm mb-4">
        <Card.Body>
          <Tabs
            activeKey={activeTab}
            onSelect={(k) => setActiveTab(k)}
            className="mb-3"
          >
            <Tab eventKey="active" title="Active Learners">
              {/* Active learners content */}
            </Tab>
            <Tab eventKey="archived" title="Archived">
              {/* Archived learners content */}
            </Tab>
            <Tab eventKey="graduated" title="Graduated">
              {/* Graduated learners content */}
            </Tab>
            <Tab eventKey="repeated" title="Repeated">
              {/* Repeated learners content */}
            </Tab>
          </Tabs>

          <div className="d-flex justify-content-between align-items-center mb-3">
            <div className="w-100 me-3">
              <InputGroup>
                <InputGroup.Text>
                  <i className="bi bi-search"></i>
                </InputGroup.Text>
                <Form.Control
                  placeholder="Search learners by name, guardian, or contact..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      fetchLearners();
                    }
                  }}
                />
                <Button 
                  variant="outline-secondary" 
                  onClick={fetchLearners}
                >
                  Search
                </Button>
                {searchTerm && (
                  <Button 
                    variant="link" 
                    onClick={() => {
                      setSearchTerm('');
                      fetchLearners();
                    }}
                  >
                    Clear
                  </Button>
                )}
              </InputGroup>
            </div>
            <div className="ms-3" style={{ minWidth: '200px' }}>
              <Form.Select
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
              >
                <option value="">All Classes</option>
                {classes
                  .filter(c => c.is_active)
                  .map((cls) => (
                    <option key={cls.class_id} value={cls.class_id}>
                      {cls.class_name} (Grade {cls.grade_level})
                    </option>
                  ))}
              </Form.Select>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <Table hover className="mb-0">
                  <thead>
                    <tr>
                      <th>Learner</th>
                      <th>Age/Grade</th>
                      <th>Class</th>
                      <th>Guardian</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {learners.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center py-4">
                          <div className="text-muted">
                            <i className="bi bi-people display-6"></i>
                            <p className="mt-2">No learners found</p>
                            {searchTerm && (
                              <Button 
                                variant="link" 
                                onClick={() => setSearchTerm('')}
                              >
                                Clear search
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      learners.map((learner) => (
                        <tr key={learner.learner_id}>
                          <td>
                            <div className="d-flex align-items-center">
                              <div className="bg-success-subtle p-2 rounded me-3">
                                <i className="bi bi-person text-success"></i>
                              </div>
                              <div>
                                <strong>{learner.first_name} {learner.last_name}</strong>
                                <div className="text-muted small">
                                  {learner.gender} • {formatDate(learner.date_of_birth)}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div>
                              <Badge bg="info">
                                {calculateAge(learner.date_of_birth)} yrs
                              </Badge>
                              <div className="text-muted small mt-1">
                                {getGradeLevel(learner.date_of_birth)}
                              </div>
                            </div>
                          </td>
                          <td>
                            {learner.class_name ? (
                              <Badge bg="primary">{learner.class_name}</Badge>
                            ) : (
                              <Badge bg="secondary">Not assigned</Badge>
                            )}
                            <div className="text-muted small mt-1">
                              Grade {learner.grade_level || 'N/A'}
                            </div>
                          </td>
                          <td>
                            <div>
                              <strong>{learner.guardian_name || 'No guardian'}</strong>
                              <div className="text-muted small">
                                {learner.guardian_email || 'No email'}
                              </div>
                              <div className="text-muted small">
                                {learner.guardian_phone || 'No phone'}
                              </div>
                            </div>
                          </td>
                          <td>
                            {getStatusBadge(learner.academic_status)}
                          </td>
                          <td>
                            <div className="d-flex gap-1">
                              <OverlayTrigger placement="top" overlay={<Tooltip>View Details</Tooltip>}>
                                <Button 
                                  size="sm" 
                                  variant="outline-primary"
                                  onClick={() => viewLearnerDetails(learner)}
                                >
                                  <i className="bi bi-eye"></i>
                                </Button>
                              </OverlayTrigger>
                              
                              <OverlayTrigger placement="top" overlay={<Tooltip>Edit</Tooltip>}>
                                <Button 
                                  size="sm" 
                                  variant="outline-warning"
                                  onClick={() => editLearner(learner)}
                                >
                                  <i className="bi bi-pencil"></i>
                                </Button>
                              </OverlayTrigger>

                              {learner.academic_status === 'active' && (
                                <>
                                  <OverlayTrigger placement="top" overlay={<Tooltip>Assign Class</Tooltip>}>
                                    <Button 
                                      size="sm" 
                                      variant="outline-info"
                                      onClick={() => assignClassToLearner(learner)}
                                    >
                                      <i className="bi bi-building"></i>
                                    </Button>
                                  </OverlayTrigger>

                                  <OverlayTrigger placement="top" overlay={<Tooltip>Progress</Tooltip>}>
                                    <Button 
                                      size="sm" 
                                      variant="outline-success"
                                      onClick={() => updateLearnerProgress(learner)}
                                    >
                                      <i className="bi bi-arrow-up-right"></i>
                                    </Button>
                                  </OverlayTrigger>
                                </>
                              )}
                              
                              <OverlayTrigger 
                                placement="top" 
                                overlay={
                                  <Tooltip>
                                    {learner.academic_status === 'active' ? 'Archive' : 'Activate'}
                                  </Tooltip>
                                }
                              >
                                <Button 
                                  size="sm" 
                                  variant={learner.academic_status === 'active' ? 'outline-danger' : 'outline-success'}
                                  onClick={() => toggleLearnerStatus(learner.learner_id, learner.academic_status)}
                                >
                                  <i className={`bi bi-${learner.academic_status === 'active' ? 'archive' : 'check-circle'} ${learner.academic_status === 'active' ? '' : 'text-success'}`}></i>
                                </Button>
                              </OverlayTrigger>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
              </div>
              
              {totalPages > 1 && (
                <div className="d-flex justify-content-center mt-3">
                  <Pagination>
                    <Pagination.Prev 
                      disabled={currentPage === 1} 
                      onClick={() => setCurrentPage(currentPage - 1)}
                    />
                    {[...Array(totalPages)].map((_, index) => (
                      <Pagination.Item
                        key={index + 1}
                        active={index + 1 === currentPage}
                        onClick={() => setCurrentPage(index + 1)}
                      >
                        {index + 1}
                      </Pagination.Item>
                    ))}
                    <Pagination.Next 
                      disabled={currentPage === totalPages} 
                      onClick={() => setCurrentPage(currentPage + 1)}
                    />
                  </Pagination>
                </div>
              )}
            </>
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
                    onChange={(e) => {
                      setFormData({...formData, first_name: e.target.value});
                      setFormErrors({...formErrors, first_name: ''});
                    }}
                    isInvalid={!!formErrors.first_name}
                    required
                  />
                  <Form.Control.Feedback type="invalid">
                    {formErrors.first_name}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Last Name *</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => {
                      setFormData({...formData, last_name: e.target.value});
                      setFormErrors({...formErrors, last_name: ''});
                    }}
                    isInvalid={!!formErrors.last_name}
                    required
                  />
                  <Form.Control.Feedback type="invalid">
                    {formErrors.last_name}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Date of Birth *</Form.Label>
                  <Form.Control
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => {
                      setFormData({...formData, date_of_birth: e.target.value});
                      setFormErrors({...formErrors, date_of_birth: ''});
                    }}
                    max={calculateMaxDate()}
                    min={calculateMinDate()}
                    isInvalid={!!formErrors.date_of_birth}
                    required
                  />
                  <Form.Control.Feedback type="invalid">
                    {formErrors.date_of_birth}
                  </Form.Control.Feedback>
                  <Form.Text className="text-muted">
                    Must be between 4 and 10 years old for Grade R-3
                  </Form.Text>
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
                    <option value="Prefer not to say">Prefer not to say</option>
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
                    onChange={(e) => {
                      setFormData({...formData, guardian_email: e.target.value});
                      setFormErrors({...formErrors, guardian_email: ''});
                    }}
                    isInvalid={!!formErrors.guardian_email}
                  />
                  <Form.Control.Feedback type="invalid">
                    {formErrors.guardian_email}
                  </Form.Control.Feedback>
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
                    <option value="">Select class (optional)</option>
                    {classes
                      .filter(c => c.is_active)
                      .map((cls) => (
                        <option key={cls.class_id} value={cls.class_id}>
                          {cls.class_name} (Grade {cls.grade_level})
                        </option>
                      ))}
                  </Form.Select>
                  <Form.Text className="text-muted">
                    Can be assigned later
                  </Form.Text>
                </Form.Group>
              </Col>

              <Col md={12}>
                <hr />
                <h6 className="mb-3">Additional Information</h6>
              </Col>

              <Col md={12}>
                <Form.Group>
                  <Form.Check
                    type="switch"
                    id="has_special_needs"
                    label="Has Special Educational Needs"
                    checked={formData.has_special_needs}
                    onChange={(e) => setFormData({...formData, has_special_needs: e.target.checked})}
                  />
                </Form.Group>
              </Col>

              {formData.has_special_needs && (
                <Col md={12}>
                  <Form.Group>
                    <Form.Label>Special Needs Notes</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={formData.special_needs_notes}
                      onChange={(e) => setFormData({...formData, special_needs_notes: e.target.value})}
                      placeholder="Describe any special educational needs, accommodations, or support required..."
                    />
                  </Form.Group>
                </Col>
              )}

              <Col md={12}>
                <Form.Group>
                  <Form.Label>Medical Notes</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={formData.medical_notes}
                    onChange={(e) => setFormData({...formData, medical_notes: e.target.value})}
                    placeholder="Any medical conditions, allergies, or health concerns..."
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
              Add Learner
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Import Modal */}
      <Modal show={showImportModal} onHide={() => setShowImportModal(false)} size="lg">
        <Form onSubmit={handleImport}>
          <Modal.Header closeButton>
            <Modal.Title>Import Learners</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Alert variant="info">
              <i className="bi bi-info-circle me-2"></i>
              <strong>Required format:</strong> CSV or Excel file with columns: 
              first_name, last_name, date_of_birth (YYYY-MM-DD), gender, guardian_name, 
              guardian_email, guardian_phone, current_class_id (optional)
            </Alert>
            
            <Alert variant="warning">
              <i className="bi bi-exclamation-triangle me-2"></i>
              <strong>Important:</strong> 
              <ul className="mb-0 mt-2">
                <li>Date of birth must be between 4 and 10 years ago</li>
                <li>Class assignment is optional and can be done later</li>
                <li>Email addresses should be unique</li>
              </ul>
            </Alert>
            
            <Form.Group>
              <Form.Label>Select File *</Form.Label>
              <Form.Control 
                type="file" 
                accept=".csv,.xlsx,.xls" 
                onChange={handleFileChange}
                ref={fileInputRef}
                required
              />
              <Form.Text className="text-muted">
                Max file size: 10MB. Supported formats: CSV, Excel (.xlsx, .xls)
              </Form.Text>
            </Form.Group>
            
            {importFile && (
              <Alert variant="success" className="mt-3">
                <i className="bi bi-check-circle me-2"></i>
                File selected: <strong>{importFile.name}</strong> ({Math.round(importFile.size / 1024)} KB)
              </Alert>
            )}

            <div className="mt-4">
              <h6>Sample Data Format:</h6>
              <div className="table-responsive">
                <Table size="sm" bordered>
                  <thead>
                    <tr>
                      <th>first_name</th>
                      <th>last_name</th>
                      <th>date_of_birth</th>
                      <th>gender</th>
                      <th>guardian_name</th>
                      <th>guardian_email</th>
                      <th>guardian_phone</th>
                      <th>current_class_id</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>John</td>
                      <td>Doe</td>
                      <td>2018-05-15</td>
                      <td>Male</td>
                      <td>Jane Doe</td>
                      <td>jane.doe@email.com</td>
                      <td>0123456789</td>
                      <td>(Optional)</td>
                    </tr>
                  </tbody>
                </Table>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button 
              variant="secondary" 
              onClick={() => setShowImportModal(false)}
              disabled={importing}
            >
              Cancel
            </Button>
            <Button 
              variant="primary" 
              type="submit"
              disabled={!importFile || importing}
            >
              {importing ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Importing...
                </>
              ) : (
                'Import Learners'
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Learner Details Modal */}
      <Modal show={showDetailsModal} onHide={() => setShowDetailsModal(false)} size="xl">
        <Modal.Header closeButton>
          <Modal.Title>Learner Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {currentLearner && (
            <Row>
              <Col md={4} className="text-center">
                <div className="bg-success-subtle p-4 rounded-circle d-inline-flex mb-3">
                  <i className="bi bi-person text-success" style={{fontSize: '3rem'}}></i>
                </div>
                <h4>{currentLearner.first_name} {currentLearner.last_name}</h4>
                <p className="text-muted">Learner ID: {currentLearner.learner_id}</p>
                
                <div className="mt-4">
                  {getStatusBadge(currentLearner.academic_status)}
                  <div className="mt-2">
                    <Badge bg="info" className="me-1">
                      Age: {calculateAge(currentLearner.date_of_birth)}
                    </Badge>
                    <Badge bg="info">
                      {getGradeLevel(currentLearner.date_of_birth)}
                    </Badge>
                  </div>
                </div>
              </Col>
              
              <Col md={8}>
                <Tabs defaultActiveKey="personal" className="mb-3">
                  <Tab eventKey="personal" title="Personal Information">
                    <Table borderless size="sm">
                      <tbody>
                        <tr>
                          <td style={{width: '30%'}}><strong>Full Name:</strong></td>
                          <td>{currentLearner.first_name} {currentLearner.last_name}</td>
                        </tr>
                        <tr>
                          <td><strong>Date of Birth:</strong></td>
                          <td>{formatDate(currentLearner.date_of_birth)}</td>
                        </tr>
                        <tr>
                          <td><strong>Gender:</strong></td>
                          <td>{currentLearner.gender || 'Not specified'}</td>
                        </tr>
                        <tr>
                          <td><strong>Current Class:</strong></td>
                          <td>
                            {currentLearner.class_name ? (
                              <Badge bg="primary">{currentLearner.class_name} (Grade {currentLearner.grade_level})</Badge>
                            ) : (
                              <Badge bg="secondary">Not assigned</Badge>
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td><strong>Academic Status:</strong></td>
                          <td>{getStatusBadge(currentLearner.academic_status)}</td>
                        </tr>
                        <tr>
                          <td><strong>Enrollment Date:</strong></td>
                          <td>{formatDate(currentLearner.enrollment_date)}</td>
                        </tr>
                      </tbody>
                    </Table>

                    <h6 className="mt-4">Guardian Information</h6>
                    <Table borderless size="sm">
                      <tbody>
                        <tr>
                          <td style={{width: '30%'}}><strong>Guardian Name:</strong></td>
                          <td>{currentLearner.guardian_name || 'Not provided'}</td>
                        </tr>
                        <tr>
                          <td><strong>Guardian Email:</strong></td>
                          <td>{currentLearner.guardian_email || 'Not provided'}</td>
                        </tr>
                        <tr>
                          <td><strong>Guardian Phone:</strong></td>
                          <td>{currentLearner.guardian_phone || 'Not provided'}</td>
                        </tr>
                      </tbody>
                    </Table>

                    {currentLearner.has_special_needs && (
                      <>
                        <h6 className="mt-4">Special Educational Needs</h6>
                        <Alert variant="info">
                          {currentLearner.special_needs_notes || 'No specific notes provided.'}
                        </Alert>
                      </>
                    )}

                    {currentLearner.medical_notes && (
                      <>
                        <h6 className="mt-4">Medical Information</h6>
                        <Alert variant="warning">
                          {currentLearner.medical_notes}
                        </Alert>
                      </>
                    )}
                  </Tab>

                  <Tab eventKey="academic" title="Academic Performance">
                    {learnerPerformance ? (
                      <>
                        <div className="mb-4">
                          <h6>Overall Performance</h6>
                          <Row>
                            <Col md={4}>
                              <Card className="text-center">
                                <Card.Body>
                                  <h1 className="display-6">{learnerPerformance.average_percentage || 0}%</h1>
                                  <Card.Text>Average Score</Card.Text>
                                </Card.Body>
                              </Card>
                            </Col>
                            <Col md={4}>
                              <Card className="text-center">
                                <Card.Body>
                                  <h1 className="display-6">{learnerPerformance.completed_assessments || 0}</h1>
                                  <Card.Text>Assessments Completed</Card.Text>
                                </Card.Body>
                              </Card>
                            </Col>
                            <Col md={4}>
                              <Card className="text-center">
                                <Card.Body>
                                  <h1 className="display-6">{learnerPerformance.topics_covered || 0}</h1>
                                  <Card.Text>Topics Covered</Card.Text>
                                </Card.Body>
                              </Card>
                            </Col>
                          </Row>
                        </div>

                        {learnerPerformance.recent_assessments && learnerPerformance.recent_assessments.length > 0 && (
                          <>
                            <h6>Recent Assessments</h6>
                            <Table hover size="sm">
                              <thead>
                                <tr>
                                  <th>Subject</th>
                                  <th>Assessment</th>
                                  <th>Score</th>
                                  <th>Date</th>
                                </tr>
                              </thead>
                              <tbody>
                                {learnerPerformance.recent_assessments.map((assessment, index) => (
                                  <tr key={index}>
                                    <td>{assessment.subject_name}</td>
                                    <td>{assessment.assessment_name}</td>
                                    <td>
                                      <Badge bg={assessment.percentage >= 50 ? 'success' : 'danger'}>
                                        {assessment.percentage}%
                                      </Badge>
                                    </td>
                                    <td>{formatDate(assessment.scheduled_date)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </Table>
                          </>
                        )}
                      </>
                    ) : (
                      <Alert variant="info">
                        No academic performance data available yet.
                      </Alert>
                    )}
                  </Tab>

                  <Tab eventKey="history" title="Class History">
                    {learnerPerformance?.class_history && learnerPerformance.class_history.length > 0 ? (
                      <Table hover size="sm">
                        <thead>
                          <tr>
                            <th>Academic Year</th>
                            <th>Class</th>
                            <th>Grade Level</th>
                            <th>Status</th>
                            <th>Duration</th>
                          </tr>
                        </thead>
                        <tbody>
                          {learnerPerformance.class_history.map((history, index) => (
                            <tr key={index}>
                              <td>{history.academic_year}</td>
                              <td>{history.class_name}</td>
                              <td>Grade {history.grade_level}</td>
                              <td>{getStatusBadge(history.status)}</td>
                              <td>
                                {formatDate(history.enrolled_date)} - {history.completed_date ? formatDate(history.completed_date) : 'Present'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    ) : (
                      <Alert variant="info">
                        No class history available.
                      </Alert>
                    )}
                  </Tab>
                </Tabs>
              </Col>
            </Row>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDetailsModal(false)}>
            Close
          </Button>
          {currentLearner && (
            <Button 
              variant="primary"
              onClick={() => {
                setShowDetailsModal(false);
                editLearner(currentLearner);
              }}
            >
              Edit Learner
            </Button>
          )}
        </Modal.Footer>
      </Modal>

      {/* Edit Learner Modal */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} size="lg">
        <Form onSubmit={handleEditSubmit}>
          <Modal.Header closeButton>
            <Modal.Title>Edit Learner</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Row className="g-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>First Name *</Form.Label>
                  <Form.Control
                    type="text"
                    value={editFormData.first_name}
                    onChange={(e) => setEditFormData({...editFormData, first_name: e.target.value})}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Last Name *</Form.Label>
                  <Form.Control
                    type="text"
                    value={editFormData.last_name}
                    onChange={(e) => setEditFormData({...editFormData, last_name: e.target.value})}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Date of Birth *</Form.Label>
                  <Form.Control
                    type="date"
                    value={editFormData.date_of_birth}
                    onChange={(e) => setEditFormData({...editFormData, date_of_birth: e.target.value})}
                    max={calculateMaxDate()}
                    min={calculateMinDate()}
                    required
                  />
                  <Form.Text className="text-muted">
                    Must be between 4 and 10 years old
                  </Form.Text>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Gender</Form.Label>
                  <Form.Select
                    value={editFormData.gender}
                    onChange={(e) => setEditFormData({...editFormData, gender: e.target.value})}
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
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
                    value={editFormData.guardian_name}
                    onChange={(e) => setEditFormData({...editFormData, guardian_name: e.target.value})}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Guardian Email</Form.Label>
                  <Form.Control
                    type="email"
                    value={editFormData.guardian_email}
                    onChange={(e) => setEditFormData({...editFormData, guardian_email: e.target.value})}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Guardian Phone</Form.Label>
                  <Form.Control
                    type="tel"
                    value={editFormData.guardian_phone}
                    onChange={(e) => setEditFormData({...editFormData, guardian_phone: e.target.value})}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Academic Status</Form.Label>
                  <Form.Select
                    value={editFormData.academic_status}
                    onChange={(e) => setEditFormData({...editFormData, academic_status: e.target.value})}
                  >
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                    <option value="graduated">Graduated</option>
                    <option value="repeated">Repeated</option>
                    <option value="inactive">Inactive</option>
                  </Form.Select>
                </Form.Group>
              </Col>

              <Col md={12}>
                <hr />
                <h6 className="mb-3">Additional Information</h6>
              </Col>

              <Col md={12}>
                <Form.Group>
                  <Form.Check
                    type="switch"
                    id="edit_has_special_needs"
                    label="Has Special Educational Needs"
                    checked={editFormData.has_special_needs}
                    onChange={(e) => setEditFormData({...editFormData, has_special_needs: e.target.checked})}
                  />
                </Form.Group>
              </Col>

              {editFormData.has_special_needs && (
                <Col md={12}>
                  <Form.Group>
                    <Form.Label>Special Needs Notes</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={editFormData.special_needs_notes}
                      onChange={(e) => setEditFormData({...editFormData, special_needs_notes: e.target.value})}
                    />
                  </Form.Group>
                </Col>
              )}

              <Col md={12}>
                <Form.Group>
                  <Form.Label>Medical Notes</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={editFormData.medical_notes}
                    onChange={(e) => setEditFormData({...editFormData, medical_notes: e.target.value})}
                  />
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save Changes
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Assign Class Modal */}
      <Modal show={showAssignClassModal} onHide={() => setShowAssignClassModal(false)}>
        <Form onSubmit={handleClassAssignment}>
          <Modal.Header closeButton>
            <Modal.Title>
              Assign Class to {currentLearner?.first_name} {currentLearner?.last_name}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Alert variant="info">
              <i className="bi bi-info-circle me-2"></i>
              Assigning a new class will automatically archive the previous class assignment.
            </Alert>
            
            <Form.Group className="mb-3">
              <Form.Label>Select Class *</Form.Label>
              <Form.Select
                value={classAssignment.class_id}
                onChange={(e) => setClassAssignment({...classAssignment, class_id: e.target.value})}
                required
              >
                <option value="">Select class</option>
                {classes
                  .filter(c => c.is_active)
                  .map((cls) => (
                    <option key={cls.class_id} value={cls.class_id}>
                      {cls.class_name} - Grade {cls.grade_level} ({cls.academic_year})
                    </option>
                  ))}
              </Form.Select>
            </Form.Group>

            <Form.Group>
              <Form.Label>Academic Year</Form.Label>
              <Form.Control
                type="number"
                value={classAssignment.academic_year}
                onChange={(e) => setClassAssignment({...classAssignment, academic_year: e.target.value})}
                min="2000"
                max="2100"
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowAssignClassModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Assign Class
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Update Progress Modal */}
      <Modal show={showProgressModal} onHide={() => setShowProgressModal(false)}>
        <Form onSubmit={handleProgressSubmit}>
          <Modal.Header closeButton>
            <Modal.Title>
              Update Academic Progress for {currentLearner?.first_name} {currentLearner?.last_name}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Alert variant="warning">
              <i className="bi bi-exclamation-triangle me-2"></i>
              This action will affect the learner's academic record. Please proceed with caution.
            </Alert>
            
            <Form.Group className="mb-3">
              <Form.Label>Action *</Form.Label>
              <Form.Select
                value={progressForm.action}
                onChange={(e) => setProgressForm({...progressForm, action: e.target.value})}
                required
              >
                <option value="promote">Promote to Next Grade</option>
                <option value="repeat">Repeat Current Grade</option>
              </Form.Select>
            </Form.Group>

            {progressForm.action === 'promote' && (
              <Form.Group className="mb-3">
                <Form.Label>Next Class *</Form.Label>
                <Form.Select
                  value={progressForm.next_class_id}
                  onChange={(e) => setProgressForm({...progressForm, next_class_id: e.target.value})}
                  required={progressForm.action === 'promote'}
                >
                  <option value="">Select next class</option>
                  {classes
                    .filter(c => c.is_active)
                    .map((cls) => (
                      <option key={cls.class_id} value={cls.class_id}>
                        {cls.class_name} - Grade {cls.grade_level}
                      </option>
                    ))}
                </Form.Select>
                <Form.Text className="text-muted">
                  Select the class for the next academic year
                </Form.Text>
              </Form.Group>
            )}

            <Form.Group>
              <Form.Label>Notes</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={progressForm.notes}
                onChange={(e) => setProgressForm({...progressForm, notes: e.target.value})}
                placeholder="Add any notes or comments about this progress update..."
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowProgressModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Update Progress
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default Learners;