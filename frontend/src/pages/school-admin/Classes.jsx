import React, { useState, useEffect } from 'react';
import { 
  Table, Button, Card, Form, InputGroup, Modal, 
  Row, Col, Badge, Tabs, Tab, Alert, Spinner,
  ProgressBar, Dropdown, ListGroup, Accordion
} from 'react-bootstrap';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  Legend, ResponsiveContainer, LineChart, Line 
} from 'recharts';

const Classes = () => {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignTeacherModal, setShowAssignTeacherModal] = useState(false);
  const [showAssignLearnerModal, setShowAssignLearnerModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('current');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState(new Date().getFullYear());
  const [selectedClass, setSelectedClass] = useState(null);
  const [academicYears, setAcademicYears] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [availableLearners, setAvailableLearners] = useState([]);
  const [classDetails, setClassDetails] = useState(null);
  const [classLearners, setClassLearners] = useState([]);
  const [classTeachers, setClassTeachers] = useState([]);
  const [classCurriculum, setClassCurriculum] = useState([]);
  const [classAnalytics, setClassAnalytics] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [academicYearToArchive, setAcademicYearToArchive] = useState('');
  
  // Form states
  const [createFormData, setCreateFormData] = useState({
    class_name: '',
    grade_level: 'R',
    academic_year: new Date().getFullYear(),
    primary_teacher_id: '',
    max_capacity: 30
  });

  const [editFormData, setEditFormData] = useState({
    class_name: '',
    grade_level: '',
    academic_year: '',
    max_capacity: 30
  });

  const [assignTeacherData, setAssignTeacherData] = useState({
    teacher_id: '',
    is_primary: false
  });

  const [assignLearnerData, setAssignLearnerData] = useState({
    learner_id: ''
  });

  useEffect(() => {
    fetchClasses();
    fetchAcademicYears();
    fetchTeachers();
  }, [selectedAcademicYear]);

  const fetchClasses = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/school-admin/classes', {
        params: { academic_year: selectedAcademicYear }
      });
      setClasses(response.data.data.classes || []);
    } catch (error) {
      console.error('Fetch classes error:', error);
      toast.error('Failed to fetch classes');
    } finally {
      setLoading(false);
    }
  };

  const fetchAcademicYears = async () => {
    try {
      const response = await axios.get('/api/school-admin/academic-years');
      setAcademicYears(response.data.data.academic_years || []);
    } catch (error) {
      console.error('Fetch academic years error:', error);
      toast.error('Failed to fetch academic years');
    }
  };

  const fetchTeachers = async () => {
    try {
      const response = await axios.get('/api/school-admin/teachers/list');
      setTeachers(response.data.data.teachers || []);
    } catch (error) {
      console.error('Fetch teachers error:', error);
      toast.error('Failed to fetch teachers');
    }
  };

  const fetchAvailableLearners = async (classId) => {
    try {
      const response = await axios.get(`/api/school-admin/classes/${classId}/available-learners`);
      setAvailableLearners(response.data.data.learners || []);
    } catch (error) {
      console.error('Fetch available learners error:', error);
      toast.error('Failed to fetch available learners');
    }
  };

  const fetchClassDetails = async (classId) => {
    setViewLoading(true);
    try {
      // Fetch all class details in parallel
      const [
        classResponse,
        learnersResponse,
        teachersResponse,
        curriculumResponse,
        analyticsResponse
      ] = await Promise.all([
        axios.get(`/api/school-admin/classes/${classId}`),
        axios.get(`/api/school-admin/classes/${classId}/learners`),
        axios.get(`/api/school-admin/classes/${classId}/teachers`),
        axios.get(`/api/school-admin/classes/${classId}/curriculum`),
        axios.get(`/api/school-admin/classes/${classId}/analytics`)
      ]);

      setClassDetails(classResponse.data.data.class);
      setClassLearners(learnersResponse.data.data.learners || []);
      setClassTeachers(teachersResponse.data.data.teachers || []);
      setClassCurriculum(curriculumResponse.data.data.curriculum || []);
      setClassAnalytics(analyticsResponse.data.data);
      setSelectedClass(classId);
      setShowViewModal(true);
    } catch (error) {
      console.error('Fetch class details error:', error);
      toast.error('Failed to fetch class details');
    } finally {
      setViewLoading(false);
    }
  };

  const handleCreateClass = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/school-admin/classes', createFormData);
      toast.success('Class created successfully');
      setShowCreateModal(false);
      resetCreateForm();
      fetchClasses();
    } catch (error) {
      console.error('Create class error:', error.response?.data || error);
      toast.error(error.response?.data?.message || 'Failed to create class');
    }
  };

  const handleEditClass = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`/api/school-admin/classes/${selectedClass}`, editFormData);
      toast.success('Class updated successfully');
      setShowEditModal(false);
      resetEditForm();
      fetchClasses();
      if (showViewModal) {
        fetchClassDetails(selectedClass);
      }
    } catch (error) {
      console.error('Update class error:', error);
      toast.error(error.response?.data?.message || 'Failed to update class');
    }
  };

  const handleAssignTeacher = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`/api/school-admin/classes/${selectedClass}/assign-teacher`, assignTeacherData);
      toast.success('Teacher assigned successfully');
      setShowAssignTeacherModal(false);
      resetAssignTeacherForm();
      fetchClassDetails(selectedClass);
    } catch (error) {
      console.error('Assign teacher error:', error);
      toast.error(error.response?.data?.message || 'Failed to assign teacher');
    }
  };

  const handleAssignLearner = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`/api/school-admin/classes/${selectedClass}/assign-learner`, assignLearnerData);
      toast.success('Learner assigned to class successfully');
      setShowAssignLearnerModal(false);
      resetAssignLearnerForm();
      fetchClassDetails(selectedClass);
      fetchAvailableLearners(selectedClass);
    } catch (error) {
      console.error('Assign learner error:', error);
      toast.error(error.response?.data?.message || 'Failed to assign learner to class');
    }
  };

  const handleRemoveTeacher = async (teacherId) => {
    if (window.confirm('Are you sure you want to remove this teacher from the class?')) {
      try {
        await axios.delete(`/api/school-admin/classes/${selectedClass}/teachers/${teacherId}`);
        toast.success('Teacher removed successfully');
        fetchClassDetails(selectedClass);
      } catch (error) {
        console.error('Remove teacher error:', error);
        toast.error(error.response?.data?.message || 'Failed to remove teacher');
      }
    }
  };

  const handleRemoveLearner = async (learnerId, learnerName) => {
    if (window.confirm(`Are you sure you want to remove ${learnerName} from this class?`)) {
      try {
        await axios.delete(`/api/school-admin/classes/${selectedClass}/learners/${learnerId}`);
        toast.success('Learner removed from class successfully');
        fetchClassDetails(selectedClass);
        fetchAvailableLearners(selectedClass);
      } catch (error) {
        console.error('Remove learner error:', error);
        toast.error(error.response?.data?.message || 'Failed to remove learner from class');
      }
    }
  };

  const handleArchiveAcademicYear = async () => {
    try {
      await axios.post(`/api/school-admin/academic-years/${academicYearToArchive}/archive`);
      toast.success(`Academic year ${academicYearToArchive} archived successfully`);
      setShowArchiveModal(false);
      setAcademicYearToArchive('');
      fetchAcademicYears();
      fetchClasses();
    } catch (error) {
      console.error('Archive academic year error:', error);
      toast.error(error.response?.data?.message || 'Failed to archive academic year');
    }
  };

  const toggleClassStatus = async (classId, currentStatus) => {
    try {
      await axios.patch(`/api/school-admin/classes/${classId}/toggle-status`, {
        is_active: !currentStatus
      });
      
      toast.success(`Class ${currentStatus ? 'deactivated' : 'activated'} successfully`);
      fetchClasses();
      // Refresh class details if viewing
      if (showViewModal && selectedClass === classId) {
        fetchClassDetails(classId);
      }
    } catch (error) {
      console.error('Toggle class status error:', error);
      toast.error(error.response?.data?.message || 'Failed to update class status');
    }
  };

  const resetCreateForm = () => {
    setCreateFormData({
      class_name: '',
      grade_level: 'R',
      academic_year: new Date().getFullYear(),
      primary_teacher_id: '',
      max_capacity: 30
    });
  };

  const resetEditForm = () => {
    setEditFormData({
      class_name: '',
      grade_level: '',
      academic_year: '',
      max_capacity: 30
    });
    setSelectedClass(null);
  };

  const resetAssignTeacherForm = () => {
    setAssignTeacherData({
      teacher_id: '',
      is_primary: false
    });
  };

  const resetAssignLearnerForm = () => {
    setAssignLearnerData({
      learner_id: ''
    });
  };

  const openEditModal = (cls) => {
    setSelectedClass(cls.class_id);
    setEditFormData({
      class_name: cls.class_name,
      grade_level: cls.grade_level,
      academic_year: cls.academic_year,
      max_capacity: cls.max_capacity || 30
    });
    setShowEditModal(true);
  };

  const openAssignTeacherModal = () => {
    setShowAssignTeacherModal(true);
  };

  const openAssignLearnerModal = async () => {
    await fetchAvailableLearners(selectedClass);
    setShowAssignLearnerModal(true);
  };

  const getGradeDisplay = (gradeLevel) => {
    const grades = {
      'R': 'Grade R (Reception)',
      '1': 'Grade 1',
      '2': 'Grade 2',
      '3': 'Grade 3'
    };
    return grades[gradeLevel] || `Grade ${gradeLevel}`;
  };

  const getPerformanceColor = (percentage) => {
    if (percentage >= 80) return 'success';
    if (percentage >= 60) return 'info';
    if (percentage >= 50) return 'warning';
    return 'danger';
  };

  const filteredClasses = classes.filter(cls => {
    const matchesSearch = 
      cls.class_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cls.grade_level.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cls.primary_teacher_name && cls.primary_teacher_name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesTab = 
      activeTab === 'all' ||
      (activeTab === 'current' && cls.is_active && cls.academic_year === new Date().getFullYear()) ||
      (activeTab === 'active' && cls.is_active) ||
      (activeTab === 'inactive' && !cls.is_active);
    
    return matchesSearch && matchesTab;
  });

  const currentYearClasses = classes.filter(c => c.academic_year === new Date().getFullYear());
  const activeClasses = classes.filter(c => c.is_active);
  const inactiveClasses = classes.filter(c => !c.is_active);

  // Prepare data for charts
  const prepareTermPerformanceData = () => {
    if (!classAnalytics?.term_performance) return [];
    return classAnalytics.term_performance.map(term => ({
      term: `Term ${term.term_number}`,
      averageScore: parseFloat(term.class_average) || 0,
      assessments: term.total_assessments || 0,
      learners: term.learners_assessed || 0
    }));
  };

  const prepareSubjectPerformanceData = () => {
    if (!classAnalytics?.subject_performance) return [];
    return classAnalytics.subject_performance.map(subject => ({
      subject: subject.subject_name,
      averageScore: parseFloat(subject.average_score) || 0,
      assessments: subject.total_assessments || 0
    }));
  };

  const prepareLearnerPerformanceData = () => {
    if (!classAnalytics?.learner_performance) return [];
    return classAnalytics.learner_performance.map(learner => ({
      name: `${learner.first_name} ${learner.last_name.substring(0, 1)}.`,
      score: parseFloat(learner.average_percentage) || 0,
      topics: learner.topics_covered || 0
    })).sort((a, b) => b.score - a.score).slice(0, 10);
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 mb-2">Classes Management</h1>
          <p className="text-muted">Manage all classes in your school</p>
        </div>
        <div className="d-flex gap-2">
          <Button variant="outline-primary" onClick={() => setShowArchiveModal(true)}>
            <i className="bi bi-archive me-2"></i>
            Archive Year
          </Button>
          <Button variant="primary" onClick={() => setShowCreateModal(true)}>
            <i className="bi bi-plus-circle me-2"></i>
            Add Class
          </Button>
        </div>
      </div>

      {/* Academic Year Selector */}
      <Card className="border-0 shadow-sm mb-4">
        <Card.Body>
          <Row className="align-items-center">
            <Col md={6}>
              <h6 className="mb-2">Academic Year</h6>
              <div className="d-flex align-items-center">
                <Form.Select 
                  value={selectedAcademicYear}
                  onChange={(e) => setSelectedAcademicYear(parseInt(e.target.value))}
                  className="me-3"
                  style={{ width: '150px' }}
                >
                  {academicYears.map(year => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </Form.Select>
                <Badge bg="info" className="me-2">
                  <i className="bi bi-calendar me-1"></i>
                  Current: {new Date().getFullYear()}
                </Badge>
                <Badge bg="secondary">
                  {classes.length} {classes.length === 1 ? 'class' : 'classes'}
                </Badge>
              </div>
            </Col>
            <Col md={6} className="text-end">
              <div className="text-muted small">
                <i className="bi bi-info-circle me-1"></i>
                South African academic year runs from January to December
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Statistics Cards */}
      <Row className="g-3 mb-4">
        <Col xs={12} md={6} lg={3}>
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="text-muted mb-2">Total Classes</h6>
                  <h2 className="fw-bold mb-0">{classes.length}</h2>
                </div>
                <div className="bg-primary-subtle p-3 rounded">
                  <i className="bi bi-collection fs-4 text-primary"></i>
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
                  <h6 className="text-muted mb-2">Total Learners</h6>
                  <h2 className="fw-bold mb-0">
                    {classes.reduce((sum, cls) => sum + (cls.current_enrollment || 0), 0)}
                  </h2>
                </div>
                <div className="bg-success-subtle p-3 rounded">
                  <i className="bi bi-people fs-4 text-success"></i>
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
                  <h6 className="text-muted mb-2">Avg. Class Size</h6>
                  <h2 className="fw-bold mb-0">
                    {classes.length > 0 
                      ? Math.round(classes.reduce((sum, cls) => sum + (cls.current_enrollment || 0), 0) / classes.length)
                      : 0}
                  </h2>
                </div>
                <div className="bg-warning-subtle p-3 rounded">
                  <i className="bi bi-person-lines-fill fs-4 text-warning"></i>
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
                  <h6 className="text-muted mb-2">Without Teacher</h6>
                  <h2 className="fw-bold mb-0">
                    {classes.filter(c => !c.primary_teacher_id).length}
                  </h2>
                </div>
                <div className="bg-danger-subtle p-3 rounded">
                  <i className="bi bi-person-x fs-4 text-danger"></i>
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
            <Tab eventKey="current" title="Current Year">
              <Badge bg="primary" className="ms-2">{currentYearClasses.length}</Badge>
            </Tab>
            <Tab eventKey="active" title="All Active">
              <Badge bg="success" className="ms-2">{activeClasses.length}</Badge>
            </Tab>
            <Tab eventKey="inactive" title="Inactive">
              <Badge bg="secondary" className="ms-2">{inactiveClasses.length}</Badge>
            </Tab>
            <Tab eventKey="all" title="All Classes">
              <Badge bg="info" className="ms-2">{classes.length}</Badge>
            </Tab>
          </Tabs>

          <Row className="g-3 mb-3">
            <Col md={8}>
              <InputGroup>
                <InputGroup.Text>
                  <i className="bi bi-search"></i>
                </InputGroup.Text>
                <Form.Control
                  placeholder="Search classes by name, grade, or teacher..."
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
            </Col>
          </Row>

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
                    <th>Class Details</th>
                    <th>Grade Level</th>
                    <th>Teacher</th>
                    <th>Learners</th>
                    <th>Performance</th>
                    <th>Status</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClasses.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-4">
                        <div className="text-muted">
                          <i className="bi bi-collection fs-1 mb-3 d-block"></i>
                          No classes found
                          {searchTerm && ` matching "${searchTerm}"`}
                          {selectedAcademicYear !== new Date().getFullYear() && 
                            ` for academic year ${selectedAcademicYear}`}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredClasses.map((cls) => (
                      <tr key={cls.class_id}>
                        <td>
                          <div className="d-flex align-items-center">
                            <div className="bg-primary-subtle p-2 rounded me-3">
                              <i className="bi bi-collection text-primary"></i>
                            </div>
                            <div>
                              <strong>{cls.class_name}</strong>
                              <div className="text-muted small">
                                Year: {cls.academic_year}
                                {cls.academic_year !== new Date().getFullYear() && (
                                  <Badge bg="secondary" className="ms-2">Archived</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <Badge bg="primary">{getGradeDisplay(cls.grade_level)}</Badge>
                        </td>
                        <td>
                          {cls.primary_teacher_name ? (
                            <div>
                              <div>{cls.primary_teacher_name}</div>
                              <div className="text-muted small">{cls.primary_teacher_email}</div>
                            </div>
                          ) : (
                            <span className="text-muted">No teacher assigned</span>
                          )}
                        </td>
                        <td>
                          <div className="d-flex align-items-center">
                            <span className="fw-bold me-2">{cls.current_enrollment || 0}</span>
                            <div className="flex-grow-1">
                              <ProgressBar 
                                now={((cls.current_enrollment || 0) / (cls.max_capacity || 30)) * 100} 
                                style={{ height: '6px' }}
                                variant={
                                  ((cls.current_enrollment || 0) / (cls.max_capacity || 30)) * 100 >= 90 ? 'danger' :
                                  ((cls.current_enrollment || 0) / (cls.max_capacity || 30)) * 100 >= 75 ? 'warning' : 'success'
                                }
                              />
                              <div className="text-muted small mt-1">
                                Capacity: {cls.current_enrollment || 0}/{cls.max_capacity || 30}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          {cls.average_score && cls.average_score > 0 ? (
                            <div>
                              <Badge bg={getPerformanceColor(cls.average_score)}>
                                {cls.average_score.toFixed(1)}%
                              </Badge>
                              <div className="text-muted small mt-1">
                                {cls.assessments_count || 0} assessments
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted">No data</span>
                          )}
                        </td>
                        <td>
                          <Badge bg={cls.is_active ? 'success' : 'secondary'}>
                            {cls.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td>
                          <div className="d-flex flex-wrap gap-2 justify-content-center">
                            <Button 
                              size="sm" 
                              variant="outline-primary" 
                              title="View Details"
                              onClick={() => fetchClassDetails(cls.class_id)}
                              disabled={viewLoading && selectedClass === cls.class_id}
                            >
                              {viewLoading && selectedClass === cls.class_id ? (
                                <Spinner size="sm" />
                              ) : (
                                <i className="bi bi-eye"></i>
                              )}
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline-warning"
                              title="Edit"
                              onClick={() => openEditModal(cls)}
                            >
                              <i className="bi bi-pencil"></i>
                            </Button>
                            <Button 
                              size="sm" 
                              variant={cls.is_active ? 'outline-warning' : 'outline-success'}
                              title={cls.is_active ? 'Deactivate' : 'Activate'}
                              onClick={() => toggleClassStatus(cls.class_id, cls.is_active)}
                            >
                              <i className={`bi bi-power ${cls.is_active ? '' : 'text-success'}`}></i>
                            </Button>
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

      {/* Create Class Modal */}
      <Modal show={showCreateModal} onHide={() => { setShowCreateModal(false); resetCreateForm(); }} size="lg">
        <Form onSubmit={handleCreateClass}>
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
                    placeholder="e.g., Grade 1 - A, Grade R - Lions"
                    value={createFormData.class_name}
                    onChange={(e) => setCreateFormData({...createFormData, class_name: e.target.value})}
                    required
                  />
                  <Form.Text className="text-muted">
                    Use descriptive names for easy identification
                  </Form.Text>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Grade Level *</Form.Label>
                  <Form.Select
                    value={createFormData.grade_level}
                    onChange={(e) => setCreateFormData({...createFormData, grade_level: e.target.value})}
                    required
                  >
                    <option value="R">Grade R (Reception)</option>
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
                    value={createFormData.academic_year}
                    onChange={(e) => setCreateFormData({...createFormData, academic_year: parseInt(e.target.value)})}
                    required
                    min="2020"
                    max="2030"
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Max Capacity</Form.Label>
                  <Form.Control
                    type="number"
                    value={createFormData.max_capacity}
                    onChange={(e) => setCreateFormData({...createFormData, max_capacity: parseInt(e.target.value)})}
                    min="1"
                    max="40"
                  />
                  <Form.Text className="text-muted">
                    Recommended: 30 for primary grades
                  </Form.Text>
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group>
                  <Form.Label>Primary Teacher (Optional)</Form.Label>
                  <Form.Select
                    value={createFormData.primary_teacher_id}
                    onChange={(e) => setCreateFormData({...createFormData, primary_teacher_id: e.target.value || null})}
                  >
                    <option value="">Select teacher (optional)</option>
                    {teachers.map((teacher) => (
                      <option key={teacher.user_id} value={teacher.user_id}>
                        {teacher.full_name} ({teacher.assigned_classes_count || 0} classes)
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Text className="text-muted">
                    Can be assigned later
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => { setShowCreateModal(false); resetCreateForm(); }}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Create Class
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* View Class Details Modal */}
      <Modal show={showViewModal} onHide={() => setShowViewModal(false)} size="xl" centered>
        {viewLoading ? (
          <div className="text-center py-5">
            <Spinner animation="border" role="status">
              <span className="visually-hidden">Loading...</span>
            </Spinner>
          </div>
        ) : classDetails && (
          <>
            <Modal.Header closeButton className="border-0 pb-0">
              <div className="w-100">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div>
                    <Modal.Title>
                      {classDetails.class_name}
                      <Badge bg="primary" className="ms-2">
                        {getGradeDisplay(classDetails.grade_level)}
                      </Badge>
                    </Modal.Title>
                    <p className="text-muted mb-0">
                      Academic Year: {classDetails.academic_year} | 
                      Capacity: {classDetails.current_enrollment || 0}/{classDetails.max_capacity || 30}
                    </p>
                  </div>
                  <div className="d-flex gap-2">
                    <Button 
                      variant="outline-warning" 
                      size="sm"
                      onClick={() => {
                        setShowViewModal(false);
                        openEditModal(classDetails);
                      }}
                    >
                      <i className="bi bi-pencil me-1"></i>
                      Edit
                    </Button>
                    <Button 
                      variant="outline-primary" 
                      size="sm"
                      onClick={openAssignTeacherModal}
                    >
                      <i className="bi bi-person-plus me-1"></i>
                      Assign Teacher
                    </Button>
                    <Button 
                      variant="outline-success" 
                      size="sm"
                      onClick={openAssignLearnerModal}
                      disabled={classDetails.current_enrollment >= classDetails.max_capacity}
                    >
                      <i className="bi bi-person-add me-1"></i>
                      Assign Learner
                    </Button>
                  </div>
                </div>
                <Tabs defaultActiveKey="overview" className="border-bottom-0">
                  <Tab eventKey="overview" title="Overview">
                    <div className="pt-3">
                      <Row className="g-3">
                        <Col md={3}>
                          <Card className="border-0 shadow-sm h-100">
                            <Card.Body className="text-center">
                              <h1 className="display-6 mb-2">{classLearners.length}</h1>
                              <p className="text-muted mb-0">Learners</p>
                              <div className="text-muted small">
                                Capacity: {classDetails.current_enrollment || 0}/{classDetails.max_capacity || 30}
                              </div>
                            </Card.Body>
                          </Card>
                        </Col>
                        <Col md={3}>
                          <Card className="border-0 shadow-sm h-100">
                            <Card.Body className="text-center">
                              <h1 className="display-6 mb-2">{classTeachers.length}</h1>
                              <p className="text-muted mb-0">Teachers</p>
                              <div className="text-muted small">
                                {classDetails.primary_teacher_id ? 'Primary assigned' : 'No primary teacher'}
                              </div>
                            </Card.Body>
                          </Card>
                        </Col>
                        <Col md={3}>
                          <Card className="border-0 shadow-sm h-100">
                            <Card.Body className="text-center">
                              <h1 className="display-6 mb-2">{classCurriculum.length}</h1>
                              <p className="text-muted mb-0">Subjects</p>
                              <div className="text-muted small">
                                Curriculum: {classCurriculum[0]?.curriculum_name || 'Not assigned'}
                              </div>
                            </Card.Body>
                          </Card>
                        </Col>
                        <Col md={3}>
                          <Card className="border-0 shadow-sm h-100">
                            <Card.Body className="text-center">
                              <h1 className="display-6 mb-2">
                                {classAnalytics?.class_info?.average_score ? 
                                  `${classAnalytics.class_info.average_score.toFixed(1)}%` : 'N/A'}
                              </h1>
                              <p className="text-muted mb-0">Average Score</p>
                              <div className="text-muted small">
                                Based on assessments
                              </div>
                            </Card.Body>
                          </Card>
                        </Col>
                      </Row>
                    </div>
                  </Tab>
                  <Tab eventKey="learners" title={`Learners (${classLearners.length})`}>
                    <div className="pt-3">
                      {classLearners.length === 0 ? (
                        <Alert variant="info">
                          <i className="bi bi-info-circle me-2"></i>
                          No learners assigned to this class yet.
                          <div className="mt-2">
                            <Button 
                              variant="outline-success" 
                              size="sm"
                              onClick={openAssignLearnerModal}
                            >
                              <i className="bi bi-person-add me-1"></i>
                              Assign Learners
                            </Button>
                          </div>
                        </Alert>
                      ) : (
                        <>
                          <div className="d-flex justify-content-between align-items-center mb-3">
                            <div>
                              <h6 className="mb-0">Class Learners</h6>
                              <p className="text-muted small mb-0">
                                {classLearners.length} learners in this class
                              </p>
                            </div>
                            <Button 
                              variant="outline-success" 
                              size="sm"
                              onClick={openAssignLearnerModal}
                              disabled={classDetails.current_enrollment >= classDetails.max_capacity}
                            >
                              <i className="bi bi-person-add me-1"></i>
                              Add More Learners
                            </Button>
                          </div>
                          <div className="table-responsive">
                            <Table hover>
                              <thead>
                                <tr>
                                  <th>Learner</th>
                                  <th>Guardian</th>
                                  <th>Performance</th>
                                  <th>Topics Covered</th>
                                  <th>Assessments</th>
                                  <th>Status</th>
                                  <th>Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {classLearners.map(learner => (
                                  <tr key={learner.learner_id}>
                                    <td>
                                      <div>
                                        <strong>{learner.first_name} {learner.last_name}</strong>
                                        <div className="text-muted small">{learner.email}</div>
                                      </div>
                                    </td>
                                    <td>
                                      {learner.guardian_name ? (
                                        <div>
                                          <div>{learner.guardian_name}</div>
                                          <div className="text-muted small">{learner.guardian_email}</div>
                                        </div>
                                      ) : (
                                        <span className="text-muted">No guardian info</span>
                                      )}
                                    </td>
                                    <td>
                                      {learner.overall_percentage ? (
                                        <Badge bg={getPerformanceColor(learner.overall_percentage)}>
                                          {learner.overall_percentage.toFixed(1)}%
                                        </Badge>
                                      ) : (
                                        <span className="text-muted">No data</span>
                                      )}
                                    </td>
                                    <td>
                                      {learner.topic_mastery_percentage ? (
                                        <ProgressBar 
                                          now={learner.topic_mastery_percentage} 
                                          label={`${learner.topic_mastery_percentage}%`}
                                          variant={getPerformanceColor(learner.topic_mastery_percentage)}
                                          style={{ width: '100px' }}
                                        />
                                      ) : (
                                        <span className="text-muted">Not assessed</span>
                                      )}
                                    </td>
                                    <td>
                                      {learner.assessments_completed !== undefined ? (
                                        <div>
                                          {learner.assessments_completed}/{learner.assessments_total}
                                          <div className="text-muted small">
                                            {learner.assessments_total > 0 
                                              ? Math.round((learner.assessments_completed / learner.assessments_total) * 100)
                                              : 0}% completed
                                          </div>
                                        </div>
                                      ) : (
                                        <span className="text-muted">No assessments</span>
                                      )}
                                    </td>
                                    <td>
                                      <Badge bg={learner.academic_status === 'active' ? 'success' : 'warning'}>
                                        {learner.academic_status}
                                      </Badge>
                                    </td>
                                    <td>
                                      <Button 
                                        size="sm" 
                                        variant="outline-danger"
                                        onClick={() => handleRemoveLearner(
                                          learner.learner_id, 
                                          `${learner.first_name} ${learner.last_name}`
                                        )}
                                      >
                                        <i className="bi bi-x-lg"></i>
                                      </Button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </Table>
                          </div>
                        </>
                      )}
                    </div>
                  </Tab>
                  <Tab eventKey="teachers" title={`Teachers (${classTeachers.length})`}>
                    <div className="pt-3">
                      {classTeachers.length === 0 ? (
                        <Alert variant="info">
                          <i className="bi bi-info-circle me-2"></i>
                          No teachers assigned to this class yet.
                          <div className="mt-2">
                            <Button 
                              variant="outline-primary" 
                              size="sm"
                              onClick={openAssignTeacherModal}
                            >
                              <i className="bi bi-person-plus me-1"></i>
                              Assign Teacher
                            </Button>
                          </div>
                        </Alert>
                      ) : (
                        <>
                          <ListGroup>
                            {classTeachers.map(teacher => (
                              <ListGroup.Item key={teacher.assignment_id} className="d-flex justify-content-between align-items-center">
                                <div>
                                  <h6 className="mb-1">
                                    {teacher.first_name} {teacher.last_name}
                                    {teacher.is_primary && (
                                      <Badge bg="primary" className="ms-2">Primary</Badge>
                                    )}
                                  </h6>
                                  <p className="text-muted mb-0 small">
                                    {teacher.email} | {teacher.phone || 'No phone'}
                                  </p>
                                  <div className="text-muted small">
                                    Assigned on: {new Date(teacher.assigned_at).toLocaleDateString()}
                                  </div>
                                </div>
                                <Button 
                                  size="sm" 
                                  variant="outline-danger"
                                  onClick={() => handleRemoveTeacher(teacher.teacher_id)}
                                >
                                  <i className="bi bi-x-lg"></i>
                                </Button>
                              </ListGroup.Item>
                            ))}
                          </ListGroup>
                          <div className="mt-3">
                            <Button variant="outline-primary" onClick={openAssignTeacherModal}>
                              <i className="bi bi-person-plus me-2"></i>
                              Assign Another Teacher
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  </Tab>
                  <Tab eventKey="curriculum" title={`Curriculum (${classCurriculum.length})`}>
                    <div className="pt-3">
                      {classCurriculum.length === 0 ? (
                        <Alert variant="info">
                          <i className="bi bi-info-circle me-2"></i>
                          No curriculum assigned to this class. Contact super admin.
                        </Alert>
                      ) : (
                        <Accordion>
                          {classCurriculum.map((subject, index) => (
                            <Accordion.Item key={subject.subject_code || index} eventKey={index.toString()}>
                              <Accordion.Header>
                                <div className="d-flex align-items-center w-100">
                                  <div>
                                    <strong>{subject.subject_name}</strong>
                                    <div className="text-muted small ms-2">
                                      Code: {subject.subject_code}
                                    </div>
                                  </div>
                                  <Badge bg="info" className="ms-auto me-3">
                                    {subject.topics?.length || 0} topics
                                  </Badge>
                                </div>
                              </Accordion.Header>
                              <Accordion.Body>
                                <div className="mb-3">
                                  <strong>Curriculum:</strong> {subject.curriculum_name}
                                </div>
                                {subject.topics && subject.topics.length > 0 ? (
                                  <Table size="sm">
                                    <thead>
                                      <tr>
                                        <th>Topic</th>
                                        <th>Code</th>
                                        <th>Learning Objectives</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {subject.topics.map(topic => (
                                        <tr key={topic.topic_id}>
                                          <td>
                                            <strong>{topic.topic_name}</strong>
                                            <div className="text-muted small">{topic.description}</div>
                                          </td>
                                          <td>{topic.topic_code}</td>
                                          <td>{topic.learning_objectives}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </Table>
                                ) : (
                                  <Alert variant="light" className="mb-0">
                                    No topics defined for this subject
                                  </Alert>
                                )}
                              </Accordion.Body>
                            </Accordion.Item>
                          ))}
                        </Accordion>
                      )}
                    </div>
                  </Tab>
                  <Tab eventKey="analytics" title="Analytics">
                    <div className="pt-3">
                      {classAnalytics ? (
                        <>
                          <Row className="g-3 mb-4">
                            <Col md={6}>
                              <Card className="border-0 shadow-sm h-100">
                                <Card.Body>
                                  <h6 className="text-muted mb-3">Term Performance</h6>
                                  <ResponsiveContainer width="100%" height={300}>
                                    <LineChart data={prepareTermPerformanceData()}>
                                      <CartesianGrid strokeDasharray="3 3" />
                                      <XAxis dataKey="term" />
                                      <YAxis domain={[0, 100]} />
                                      <RechartsTooltip />
                                      <Legend />
                                      <Line 
                                        type="monotone" 
                                        dataKey="averageScore" 
                                        stroke="#8884d8" 
                                        name="Average Score (%)"
                                        strokeWidth={2}
                                      />
                                    </LineChart>
                                  </ResponsiveContainer>
                                </Card.Body>
                              </Card>
                            </Col>
                            <Col md={6}>
                              <Card className="border-0 shadow-sm h-100">
                                <Card.Body>
                                  <h6 className="text-muted mb-3">Subject Performance</h6>
                                  <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={prepareSubjectPerformanceData()}>
                                      <CartesianGrid strokeDasharray="3 3" />
                                      <XAxis dataKey="subject" angle={-45} textAnchor="end" height={60} />
                                      <YAxis domain={[0, 100]} />
                                      <RechartsTooltip />
                                      <Legend />
                                      <Bar dataKey="averageScore" fill="#8884d8" name="Average Score (%)" />
                                    </BarChart>
                                  </ResponsiveContainer>
                                </Card.Body>
                              </Card>
                            </Col>
                          </Row>
                          {classAnalytics.learner_performance && classAnalytics.learner_performance.length > 0 && (
                            <Row className="g-3">
                              <Col md={12}>
                                <Card className="border-0 shadow-sm">
                                  <Card.Body>
                                    <h6 className="text-muted mb-3">Top Learners by Performance</h6>
                                    <ResponsiveContainer width="100%" height={400}>
                                      <BarChart 
                                        data={prepareLearnerPerformanceData()}
                                        layout="vertical"
                                      >
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis type="number" domain={[0, 100]} />
                                        <YAxis type="category" dataKey="name" width={100} />
                                        <RechartsTooltip />
                                        <Legend />
                                        <Bar dataKey="score" fill="#82ca9d" name="Average Score (%)" />
                                      </BarChart>
                                    </ResponsiveContainer>
                                  </Card.Body>
                                </Card>
                              </Col>
                            </Row>
                          )}
                        </>
                      ) : (
                        <Alert variant="info">
                          <i className="bi bi-info-circle me-2"></i>
                          No analytics data available for this class yet.
                        </Alert>
                      )}
                    </div>
                  </Tab>
                </Tabs>
              </div>
            </Modal.Header>
            <Modal.Footer className="border-0">
              <Button variant="secondary" onClick={() => setShowViewModal(false)}>
                Close
              </Button>
            </Modal.Footer>
          </>
        )}
      </Modal>

      {/* Edit Class Modal */}
      <Modal show={showEditModal} onHide={() => { setShowEditModal(false); resetEditForm(); }}>
        <Form onSubmit={handleEditClass}>
          <Modal.Header closeButton>
            <Modal.Title>Edit Class</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Row className="g-3">
              <Col md={12}>
                <Form.Group>
                  <Form.Label>Class Name *</Form.Label>
                  <Form.Control
                    type="text"
                    value={editFormData.class_name}
                    onChange={(e) => setEditFormData({...editFormData, class_name: e.target.value})}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Grade Level *</Form.Label>
                  <Form.Select
                    value={editFormData.grade_level}
                    onChange={(e) => setEditFormData({...editFormData, grade_level: e.target.value})}
                    required
                    disabled={classDetails?.current_enrollment > 0}
                  >
                    <option value="R">Grade R (Reception)</option>
                    <option value="1">Grade 1</option>
                    <option value="2">Grade 2</option>
                    <option value="3">Grade 3</option>
                  </Form.Select>
                  {classDetails?.current_enrollment > 0 && (
                    <Form.Text className="text-muted">
                      Cannot change grade level when learners are enrolled
                    </Form.Text>
                  )}
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Max Capacity</Form.Label>
                  <Form.Control
                    type="number"
                    value={editFormData.max_capacity}
                    onChange={(e) => setEditFormData({...editFormData, max_capacity: parseInt(e.target.value)})}
                    min={classDetails?.current_enrollment || 1}
                    max="40"
                  />
                  <Form.Text className="text-muted">
                    Cannot set below current enrollment ({classDetails?.current_enrollment || 0})
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => { setShowEditModal(false); resetEditForm(); }}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save Changes
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Assign Teacher Modal */}
      <Modal show={showAssignTeacherModal} onHide={() => { setShowAssignTeacherModal(false); resetAssignTeacherForm(); }}>
        <Form onSubmit={handleAssignTeacher}>
          <Modal.Header closeButton>
            <Modal.Title>Assign Teacher to Class</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Select Teacher *</Form.Label>
              <Form.Select
                value={assignTeacherData.teacher_id}
                onChange={(e) => setAssignTeacherData({...assignTeacherData, teacher_id: e.target.value})}
                required
              >
                <option value="">Select teacher</option>
                {teachers
                  .filter(teacher => !classTeachers.find(t => t.teacher_id === teacher.user_id))
                  .map((teacher) => (
                    <option key={teacher.user_id} value={teacher.user_id}>
                      {teacher.full_name} 
                      {teacher.assigned_classes_count > 0 && 
                        ` (${teacher.assigned_classes_count} other classes)`}
                    </option>
                  ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                label="Set as primary teacher"
                checked={assignTeacherData.is_primary}
                onChange={(e) => setAssignTeacherData({...assignTeacherData, is_primary: e.target.checked})}
              />
              <Form.Text className="text-muted">
                Primary teachers receive notifications and are shown as main contact
              </Form.Text>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => { setShowAssignTeacherModal(false); resetAssignTeacherForm(); }}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Assign Teacher
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Assign Learner Modal */}
      <Modal show={showAssignLearnerModal} onHide={() => { setShowAssignLearnerModal(false); resetAssignLearnerForm(); }} size="lg">
        <Form onSubmit={handleAssignLearner}>
          <Modal.Header closeButton>
            <Modal.Title>Assign Learner to Class</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Alert variant="info" className="mb-4">
              <i className="bi bi-info-circle me-2"></i>
              You can only assign learners who are not already in a class for this academic year.
              Learners from previous years or different grades can be promoted or repeated into this class.
            </Alert>
            
            <Form.Group className="mb-3">
              <Form.Label>Select Learner *</Form.Label>
              <Form.Select
                value={assignLearnerData.learner_id}
                onChange={(e) => setAssignLearnerData({...assignLearnerData, learner_id: e.target.value})}
                required
              >
                <option value="">Select learner</option>
                {availableLearners.map((learner) => (
                  <option key={learner.learner_id} value={learner.learner_id}>
                    {learner.first_name} {learner.last_name}
                    {learner.current_class && ` (Currently in ${learner.current_class} - Grade ${learner.current_grade})`}
                    {!learner.current_class && ' (Not assigned to any class)'}
                  </option>
                ))}
              </Form.Select>
              <Form.Text className="text-muted">
                {availableLearners.length} learners available for assignment
              </Form.Text>
            </Form.Group>

            {availableLearners.length === 0 && (
              <Alert variant="warning">
                <i className="bi bi-exclamation-triangle me-2"></i>
                No learners available for assignment. All active learners are already assigned to classes for this academic year.
              </Alert>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => { setShowAssignLearnerModal(false); resetAssignLearnerForm(); }}>
              Cancel
            </Button>
            <Button 
              variant="primary" 
              type="submit"
              disabled={!assignLearnerData.learner_id || classDetails?.current_enrollment >= classDetails?.max_capacity}
            >
              Assign Learner
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Archive Academic Year Modal */}
      <Modal show={showArchiveModal} onHide={() => setShowArchiveModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Archive Academic Year</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="warning" className="mb-4">
            <i className="bi bi-exclamation-triangle me-2"></i>
            <strong>Important:</strong> Archiving an academic year will:
            <ul className="mb-0 mt-2">
              <li>Mark all classes for that year as inactive</li>
              <li>Graduate all Grade 3 learners</li>
              <li>Preserve all data for historical records</li>
              <li>Cannot be undone automatically</li>
            </ul>
          </Alert>
          
          <Form.Group>
            <Form.Label>Select Academic Year to Archive *</Form.Label>
            <Form.Select
              value={academicYearToArchive}
              onChange={(e) => setAcademicYearToArchive(e.target.value)}
              required
            >
              <option value="">Select year</option>
              {academicYears
                .filter(year => year < new Date().getFullYear())
                .map(year => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
            </Form.Select>
            <Form.Text className="text-muted">
              Only years before the current year can be archived
            </Form.Text>
          </Form.Group>

          {academicYearToArchive && (
            <Card className="mt-3">
              <Card.Body>
                <h6 className="text-muted mb-3">Year {academicYearToArchive} Summary:</h6>
                <Row>
                  <Col md={6}>
                    <p className="mb-1">
                      <strong>Active Classes:</strong> {
                        classes.filter(c => c.academic_year === parseInt(academicYearToArchive) && c.is_active).length
                      }
                    </p>
                    <p className="mb-1">
                      <strong>Grade 3 Learners:</strong> {
                        classes
                          .filter(c => c.academic_year === parseInt(academicYearToArchive) && c.grade_level === '3')
                          .reduce((sum, c) => sum + (c.current_enrollment || 0), 0)
                      }
                    </p>
                  </Col>
                  <Col md={6}>
                    <p className="mb-1">
                      <strong>Total Learners:</strong> {
                        classes
                          .filter(c => c.academic_year === parseInt(academicYearToArchive))
                          .reduce((sum, c) => sum + (c.current_enrollment || 0), 0)
                      }
                    </p>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowArchiveModal(false)}>
            Cancel
          </Button>
          <Button 
            variant="warning" 
            onClick={handleArchiveAcademicYear}
            disabled={!academicYearToArchive || parseInt(academicYearToArchive) >= new Date().getFullYear()}
          >
            <i className="bi bi-archive me-2"></i>
            Archive Year
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Classes;