import React, { useState, useEffect, useRef } from 'react';
import { 
  Table, Button, Card, Form, InputGroup, Modal, 
  Row, Col, Badge, Dropdown, Alert, Spinner, 
  Pagination, Tooltip, OverlayTrigger 
} from 'react-bootstrap';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import * as XLSX from 'xlsx';

const Teachers = () => {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [currentTeacher, setCurrentTeacher] = useState(null);
  const [assignedClasses, setAssignedClasses] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [formErrors, setFormErrors] = useState({});
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: ''
  });

  const [editFormData, setEditFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    is_active: true
  });

  const [passwordFormData, setPasswordFormData] = useState({
    new_password: '',
    confirm_password: ''
  });

  // CSV template structure
  const csvTemplate = [
    {
      'email': 'teacher1@school.com',
      'first_name': 'John',
      'last_name': 'Doe',
      'phone': '0123456789'
    },
    {
      'email': 'teacher2@school.com',
      'first_name': 'Jane',
      'last_name': 'Smith',
      'phone': '0987654321'
    }
  ];

  useEffect(() => {
    fetchTeachers();
  }, [currentPage]);

  const fetchTeachers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/school-admin/teachers?page=${currentPage}&limit=20&search=${searchTerm}`);
      setTeachers(response.data.data.users || []);
      setTotalPages(response.data.data.totalPages || 1);
    } catch (error) {
      toast.error('Failed to fetch teachers');
      console.error('Fetch teachers error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = {};

    // Validation
    if (!formData.first_name.trim()) {
      errors.first_name = 'First name is required';
    }
    if (!formData.last_name.trim()) {
      errors.last_name = 'Last name is required';
    }
    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email format';
    }
    
    // Password validation for manual creation
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    if (formData.password !== formData.confirm_password) {
      errors.confirm_password = 'Passwords do not match';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      const payload = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password
      };

      await axios.post('/api/school-admin/teachers', payload);
      toast.success('Teacher created successfully');
      setShowModal(false);
      resetForm();
      fetchTeachers();
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Failed to create teacher';
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
      const response = await axios.post('/api/school-admin/teachers/bulk-import', importFormData, {
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
        toast.success(`Successfully imported ${data.summary.success} teachers`);
      }

      setShowImportModal(false);
      setImportFile(null);
      fetchTeachers();
    } catch (error) {
      console.error('Import error:', error);
      toast.error(error.response?.data?.message || 'Failed to import teachers');
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
    XLSX.utils.book_append_sheet(wb, ws, 'Teachers Template');
    
    // Generate Excel file
    XLSX.writeFile(wb, 'teachers_import_template.xlsx');
    
    toast.success('Template downloaded successfully');
  };

  const viewTeacherDetails = async (teacher) => {
    try {
      setCurrentTeacher(teacher);
      
      // Fetch assigned classes for this teacher
      const response = await axios.get(`/api/school-admin/teachers/${teacher.user_id}/classes`);
      setAssignedClasses(response.data.data.classes || []);
      
      setShowDetailsModal(true);
    } catch (error) {
      toast.error('Failed to fetch teacher details');
    }
  };

  const editTeacher = (teacher) => {
    setCurrentTeacher(teacher);
    setEditFormData({
      first_name: teacher.first_name,
      last_name: teacher.last_name,
      email: teacher.email,
      phone: teacher.phone || '',
      is_active: teacher.is_active
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    
    try {
      await axios.put(`/api/school-admin/teachers/${currentTeacher.user_id}`, editFormData);
      toast.success('Teacher updated successfully');
      setShowEditModal(false);
      fetchTeachers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update teacher');
    }
  };

  const changePassword = (teacher) => {
    setCurrentTeacher(teacher);
    setPasswordFormData({
      new_password: '',
      confirm_password: ''
    });
    setShowPasswordModal(true);
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    
    if (passwordFormData.new_password !== passwordFormData.confirm_password) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (passwordFormData.new_password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    try {
      await axios.patch(`/api/school-admin/teachers/${currentTeacher.user_id}/password`, {
        new_password: passwordFormData.new_password
      });
      toast.success('Password changed successfully');
      setShowPasswordModal(false);
      resetPasswordForm();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to change password');
    }
  };

  const toggleTeacherStatus = async (teacherId, currentStatus) => {
    if (!window.confirm(`Are you sure you want to ${currentStatus ? 'deactivate' : 'activate'} this teacher?`)) {
      return;
    }

    try {
      await axios.patch(`/api/school-admin/teachers/${teacherId}/toggle-active`, {
        is_active: !currentStatus
      });
      toast.success(`Teacher ${currentStatus ? 'deactivated' : 'activated'} successfully`);
      fetchTeachers();
    } catch (error) {
      toast.error('Failed to update teacher status');
    }
  };

  const resetForm = () => {
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      password: '',
      confirm_password: ''
    });
    setFormErrors({});
  };

  const resetPasswordForm = () => {
    setPasswordFormData({
      new_password: '',
      confirm_password: ''
    });
  };

  const filteredTeachers = teachers.filter(teacher =>
    `${teacher.first_name} ${teacher.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    teacher.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (teacher.phone && teacher.phone.includes(searchTerm))
  );

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadge = (isActive, lastLogin) => {
    if (!isActive) {
      return <Badge bg="secondary">Inactive</Badge>;
    }
    
    if (!lastLogin) {
      return <Badge bg="warning" text="dark">Never Logged In</Badge>;
    }
    
    return <Badge bg="success">Active</Badge>;
  };

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
                  placeholder="Search teachers by name, email, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      fetchTeachers();
                    }
                  }}
                />
                <Button 
                  variant="outline-secondary" 
                  onClick={fetchTeachers}
                >
                  Search
                </Button>
                {searchTerm && (
                  <Button 
                    variant="link" 
                    onClick={() => {
                      setSearchTerm('');
                      fetchTeachers();
                    }}
                  >
                    Clear
                  </Button>
                )}
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
            <>
              <div className="table-responsive">
                <Table hover className="mb-0">
                  <thead>
                    <tr>
                      <th>Teacher</th>
                      <th>Contact</th>
                      <th>Classes</th>
                      <th>Status</th>
                      <th>Last Login</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTeachers.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center py-4">
                          <div className="text-muted">
                            <i className="bi bi-people display-6"></i>
                            <p className="mt-2">No teachers found</p>
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
                      filteredTeachers.map((teacher) => (
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
                            <div>
                              <OverlayTrigger
                                placement="top"
                                overlay={<Tooltip>Click to copy</Tooltip>}
                              >
                                <span 
                                  className="text-primary cursor-pointer"
                                  onClick={() => {
                                    navigator.clipboard.writeText(teacher.email);
                                    toast.success('Email copied to clipboard');
                                  }}
                                >
                                  {teacher.email}
                                </span>
                              </OverlayTrigger>
                            </div>
                            <div className="text-muted small">
                              {teacher.phone || 'No phone'}
                            </div>
                          </td>
                          <td>
                            <Badge bg="info" className="me-1">
                              {teacher.assigned_classes_count || 0} Classes
                            </Badge>
                          </td>
                          <td>
                            {getStatusBadge(teacher.is_active, teacher.last_login)}
                          </td>
                          <td>
                            <small className="text-muted">
                              {formatDate(teacher.last_login)}
                            </small>
                          </td>
                          <td>
                            <div className="d-flex gap-1">
                              <OverlayTrigger placement="top" overlay={<Tooltip>View Details</Tooltip>}>
                                <Button 
                                  size="sm" 
                                  variant="outline-primary"
                                  onClick={() => viewTeacherDetails(teacher)}
                                >
                                  <i className="bi bi-eye"></i>
                                </Button>
                              </OverlayTrigger>
                              
                              <OverlayTrigger placement="top" overlay={<Tooltip>Edit</Tooltip>}>
                                <Button 
                                  size="sm" 
                                  variant="outline-warning"
                                  onClick={() => editTeacher(teacher)}
                                >
                                  <i className="bi bi-pencil"></i>
                                </Button>
                              </OverlayTrigger>
                              
                              <OverlayTrigger placement="top" overlay={<Tooltip>Change Password</Tooltip>}>
                                <Button 
                                  size="sm" 
                                  variant="outline-info"
                                  onClick={() => changePassword(teacher)}
                                >
                                  <i className="bi bi-key"></i>
                                </Button>
                              </OverlayTrigger>
                              
                              <OverlayTrigger 
                                placement="top" 
                                overlay={
                                  <Tooltip>
                                    {teacher.is_active ? 'Deactivate' : 'Activate'}
                                  </Tooltip>
                                }
                              >
                                <Button 
                                  size="sm" 
                                  variant={teacher.is_active ? 'outline-danger' : 'outline-success'}
                                  onClick={() => toggleTeacherStatus(teacher.user_id, teacher.is_active)}
                                >
                                  <i className={`bi bi-power ${teacher.is_active ? '' : 'text-success'}`}></i>
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

      {/* Add Teacher Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
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
              <Col md={12}>
                <Form.Group>
                  <Form.Label>Email Address *</Form.Label>
                  <Form.Control
                    type="email"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({...formData, email: e.target.value});
                      setFormErrors({...formErrors, email: ''});
                    }}
                    isInvalid={!!formErrors.email}
                    required
                  />
                  <Form.Control.Feedback type="invalid">
                    {formErrors.email}
                  </Form.Control.Feedback>
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
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Password *</Form.Label>
                  <Form.Control
                    type="password"
                    value={formData.password}
                    onChange={(e) => {
                      setFormData({...formData, password: e.target.value});
                      setFormErrors({...formErrors, password: ''});
                    }}
                    isInvalid={!!formErrors.password}
                    required
                  />
                  <Form.Control.Feedback type="invalid">
                    {formErrors.password}
                  </Form.Control.Feedback>
                  <Form.Text className="text-muted">
                    At least 6 characters
                  </Form.Text>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Confirm Password *</Form.Label>
                  <Form.Control
                    type="password"
                    value={formData.confirm_password}
                    onChange={(e) => {
                      setFormData({...formData, confirm_password: e.target.value});
                      setFormErrors({...formErrors, confirm_password: ''});
                    }}
                    isInvalid={!!formErrors.confirm_password}
                    required
                  />
                  <Form.Control.Feedback type="invalid">
                    {formErrors.confirm_password}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Create Teacher
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
            <Alert variant="info">
              <i className="bi bi-info-circle me-2"></i>
              <strong>Required format:</strong> CSV or Excel file with columns: email, first_name, last_name, phone (optional)
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
                'Import Teachers'
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Teacher Details Modal */}
      <Modal show={showDetailsModal} onHide={() => setShowDetailsModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Teacher Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {currentTeacher && (
            <Row>
              <Col md={4} className="text-center">
                <div className="bg-primary-subtle p-4 rounded-circle d-inline-flex mb-3">
                  <i className="bi bi-person-badge text-primary" style={{fontSize: '3rem'}}></i>
                </div>
                <h4>{currentTeacher.first_name} {currentTeacher.last_name}</h4>
                <p className="text-muted">Teacher ID: {currentTeacher.user_id}</p>
              </Col>
              <Col md={8}>
                <div className="mb-4">
                  <h5>Contact Information</h5>
                  <Table borderless size="sm">
                    <tbody>
                      <tr>
                        <td><strong>Email:</strong></td>
                        <td>{currentTeacher.email}</td>
                      </tr>
                      <tr>
                        <td><strong>Phone:</strong></td>
                        <td>{currentTeacher.phone || 'Not provided'}</td>
                      </tr>
                      <tr>
                        <td><strong>Status:</strong></td>
                        <td>
                          <Badge bg={currentTeacher.is_active ? 'success' : 'secondary'}>
                            {currentTeacher.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                      </tr>
                      <tr>
                        <td><strong>Last Login:</strong></td>
                        <td>{formatDate(currentTeacher.last_login)}</td>
                      </tr>
                      <tr>
                        <td><strong>Account Created:</strong></td>
                        <td>{formatDate(currentTeacher.created_at)}</td>
                      </tr>
                    </tbody>
                  </Table>
                </div>

                <div>
                  <h5>Assigned Classes</h5>
                  {assignedClasses.length === 0 ? (
                    <Alert variant="info">
                      This teacher is not assigned to any classes yet.
                    </Alert>
                  ) : (
                    <Table hover size="sm">
                      <thead>
                        <tr>
                          <th>Class</th>
                          <th>Grade Level</th>
                          <th>Academic Year</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assignedClasses.map((cls, index) => (
                          <tr key={index}>
                            <td>{cls.class_name}</td>
                            <td><Badge bg="info">Grade {cls.grade_level}</Badge></td>
                            <td>{cls.academic_year}</td>
                            <td>
                              <Badge bg={cls.is_active ? 'success' : 'secondary'}>
                                {cls.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  )}
                </div>
              </Col>
            </Row>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDetailsModal(false)}>
            Close
          </Button>
          {currentTeacher && (
            <Button 
              variant="primary"
              onClick={() => {
                setShowDetailsModal(false);
                editTeacher(currentTeacher);
              }}
            >
              Edit Teacher
            </Button>
          )}
        </Modal.Footer>
      </Modal>

      {/* Edit Teacher Modal */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)}>
        <Form onSubmit={handleEditSubmit}>
          <Modal.Header closeButton>
            <Modal.Title>Edit Teacher</Modal.Title>
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
              <Col md={12}>
                <Form.Group>
                  <Form.Label>Email Address *</Form.Label>
                  <Form.Control
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({...editFormData, email: e.target.value})}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group>
                  <Form.Label>Phone Number</Form.Label>
                  <Form.Control
                    type="tel"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({...editFormData, phone: e.target.value})}
                  />
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group>
                  <Form.Label>Account Status</Form.Label>
                  <Form.Check
                    type="switch"
                    id="is_active"
                    label={editFormData.is_active ? 'Active' : 'Inactive'}
                    checked={editFormData.is_active}
                    onChange={(e) => setEditFormData({...editFormData, is_active: e.target.checked})}
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

      {/* Change Password Modal */}
      <Modal show={showPasswordModal} onHide={() => setShowPasswordModal(false)}>
        <Form onSubmit={handlePasswordSubmit}>
          <Modal.Header closeButton>
            <Modal.Title>
              Change Password for {currentTeacher?.first_name} {currentTeacher?.last_name}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Alert variant="warning">
              <i className="bi bi-exclamation-triangle me-2"></i>
              Changing password will log the teacher out of all devices.
            </Alert>
            
            <Form.Group className="mb-3">
              <Form.Label>New Password *</Form.Label>
              <Form.Control
                type="password"
                value={passwordFormData.new_password}
                onChange={(e) => setPasswordFormData({...passwordFormData, new_password: e.target.value})}
                required
                minLength={6}
              />
              <Form.Text className="text-muted">
                Minimum 6 characters
              </Form.Text>
            </Form.Group>
            
            <Form.Group>
              <Form.Label>Confirm Password *</Form.Label>
              <Form.Control
                type="password"
                value={passwordFormData.confirm_password}
                onChange={(e) => setPasswordFormData({...passwordFormData, confirm_password: e.target.value})}
                required
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowPasswordModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Change Password
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default Teachers;