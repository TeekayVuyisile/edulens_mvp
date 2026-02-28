import React, { useState, useEffect } from 'react';
import { 
  Card, Button, Table, Form, Row, Col, Badge, 
  Spinner, Alert, Modal, ProgressBar, Container 
} from 'react-bootstrap';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { Link } from 'react-router-dom';
import Layout from '../../components/common/Layout';
import { FaEdit, FaEye, FaFileExport, FaChartLine, FaSync } from 'react-icons/fa';

const Grading = () => {
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const [gradebook, setGradebook] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState('');
  const [bulkMarks, setBulkMarks] = useState({});
  const [stats, setStats] = useState({
    pending: 0,
    total: 0,
    averageCompletion: 0
  });

  useEffect(() => {
    fetchAssessments();
  }, []);

  const fetchAssessments = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/teacher/assessments');
      const assessmentsData = response.data.data.assessments || [];
      setAssessments(assessmentsData);
      
      // Calculate statistics
      const pendingAssessments = assessmentsData.filter(a => {
        const submissions = a.submissions || 0;
        const graded = a.graded || 0;
        return graded < submissions;
      });
      
      const totalAssessments = assessmentsData.length;
      const totalCompletion = assessmentsData.reduce((sum, a) => {
        const submissions = a.submissions || 1;
        const graded = a.graded || 0;
        return sum + (graded / submissions * 100);
      }, 0);
      
      setStats({
        pending: pendingAssessments.length,
        total: totalAssessments,
        averageCompletion: totalAssessments > 0 ? totalCompletion / totalAssessments : 0
      });
      
    } catch (error) {
      console.error('Error fetching assessments:', error);
      toast.error('Failed to fetch assessments');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAssessment = async (assessment) => {
    try {
      setSelectedAssessment(assessment);
      const response = await axios.get(`/api/teacher/assessments/${assessment.assessment_id}/gradebook`);
      
      if (response.data.status === 'success') {
        setGradebook(response.data.data.gradebook || []);
        
        // Initialize bulk marks
        const marks = {};
        response.data.data.gradebook.forEach(item => {
          marks[item.learner_id] = item.marks_obtained || '';
        });
        setBulkMarks(marks);
      } else {
        toast.error('Failed to fetch gradebook');
      }
    } catch (error) {
      console.error('Error fetching gradebook:', error);
      toast.error('Failed to fetch gradebook');
    }
  };

  const handleGradeChange = (learnerId, marks) => {
    const updatedGradebook = gradebook.map(item => {
      if (item.learner_id === learnerId) {
        const numMarks = marks === '' ? null : parseFloat(marks);
        const percentage = selectedAssessment && numMarks !== null 
          ? (numMarks / selectedAssessment.total_marks * 100).toFixed(1)
          : null;
        
        return {
          ...item,
          marks_obtained: numMarks,
          percentage: percentage,
          is_graded: numMarks !== null
        };
      }
      return item;
    });
    setGradebook(updatedGradebook);
  };

  const handleFeedbackChange = (learnerId, feedback) => {
    const updatedGradebook = gradebook.map(item => {
      if (item.learner_id === learnerId) {
        return { ...item, teacher_feedback: feedback };
      }
      return item;
    });
    setGradebook(updatedGradebook);
  };

  const validateGrade = (marks) => {
    if (!selectedAssessment) return null;
    
    const numMarks = parseFloat(marks);
    if (isNaN(numMarks)) return 'Enter a valid number';
    if (numMarks < 0) return 'Cannot be negative';
    if (numMarks > selectedAssessment.total_marks) return `Max: ${selectedAssessment.total_marks}`;
    return null;
  };

  const handleSaveGrades = async () => {
    if (!selectedAssessment) return;
    
    // Validate all grades before saving
    const errors = [];
    gradebook.forEach(item => {
      if (item.marks_obtained !== null && item.marks_obtained !== undefined) {
        const error = validateGrade(item.marks_obtained);
        if (error) {
          errors.push(`${item.first_name} ${item.last_name}: ${error}`);
        }
      }
    });
    
    if (errors.length > 0) {
      toast.error(`Validation errors:\n${errors.join('\n')}`);
      return;
    }
    
    setSaving(true);
    try {
      const grades = gradebook
        .filter(item => item.marks_obtained !== null && item.marks_obtained !== undefined)
        .map(item => ({
          learner_id: item.learner_id,
          marks_obtained: parseFloat(item.marks_obtained),
          teacher_feedback: item.teacher_feedback || ''
        }));
      
      if (grades.length === 0) {
        toast.error('No grades to save');
        return;
      }
      
      await axios.post(`/api/teacher/assessments/${selectedAssessment.assessment_id}/bulk-grade`, { grades });
      toast.success(`Grades saved for ${grades.length} learner${grades.length !== 1 ? 's' : ''}`);
      
      // Refresh data
      fetchAssessments();
      if (selectedAssessment) {
        handleSelectAssessment(selectedAssessment);
      }
    } catch (error) {
      console.error('Error saving grades:', error);
      toast.error(error.response?.data?.message || 'Failed to save grades');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkGradeAll = () => {
    setShowBulkModal(true);
  };

  const handleBulkGradeSubmit = async () => {
    if (!selectedAssessment) return;
    
    // Validate all bulk marks
    const errors = [];
    Object.entries(bulkMarks).forEach(([learnerId, marks]) => {
      if (marks !== '') {
        const error = validateGrade(marks);
        if (error) {
          const learner = gradebook.find(g => g.learner_id === learnerId);
          if (learner) {
            errors.push(`${learner.first_name} ${learner.last_name}: ${error}`);
          }
        }
      }
    });
    
    if (errors.length > 0) {
      toast.error(`Validation errors:\n${errors.join('\n')}`);
      return;
    }
    
    setSaving(true);
    try {
      const grades = Object.entries(bulkMarks)
        .filter(([learnerId, marks]) => marks !== '')
        .map(([learnerId, marks]) => ({
          learner_id: learnerId,
          marks_obtained: parseFloat(marks),
          teacher_feedback: bulkFeedback || ''
        }));
      
      if (grades.length === 0) {
        toast.error('Please enter marks for at least one learner');
        return;
      }
      
      await axios.post(`/api/teacher/assessments/${selectedAssessment.assessment_id}/bulk-grade`, { grades });
      toast.success(`Grades saved for ${grades.length} learner${grades.length !== 1 ? 's' : ''}`);
      
      // Refresh data and close modal
      setShowBulkModal(false);
      fetchAssessments();
      handleSelectAssessment(selectedAssessment);
      setBulkFeedback('');
    } catch (error) {
      console.error('Error in bulk grading:', error);
      toast.error(error.response?.data?.message || 'Failed to save grades');
    } finally {
      setSaving(false);
    }
  };

  const calculateGradeLetter = (percentage) => {
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B';
    if (percentage >= 60) return 'C';
    if (percentage >= 50) return 'D';
    return 'F';
  };

  const getGradeColor = (percentage) => {
    if (percentage >= 80) return 'success';
    if (percentage >= 60) return 'info';
    if (percentage >= 50) return 'warning';
    return 'danger';
  };

  const getAssessmentColor = (assessment) => {
    const submissions = assessment.submissions || 0;
    const graded = assessment.graded || 0;
    const completion = submissions > 0 ? (graded / submissions * 100) : 0;
    
    if (completion === 100) return 'success';
    if (completion >= 50) return 'warning';
    return 'danger';
  };

  const pendingAssessments = assessments.filter(a => {
    const submissions = a.submissions || 0;
    const graded = a.graded || 0;
    return graded < submissions;
  });

  const completedAssessments = assessments.filter(a => {
    const submissions = a.submissions || 0;
    const graded = a.graded || 0;
    return graded >= submissions && graded > 0;
  });

  return (
    <Layout>
      <Container fluid className="py-4">
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h1 className="h3 mb-2">Assessment Grading</h1>
            <p className="text-muted">Grade assessments and provide feedback to learners</p>
          </div>
          <div className="d-flex gap-2">
            <Button variant="outline-primary" onClick={fetchAssessments} disabled={loading}>
              <FaSync className={`me-2 ${loading ? 'spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <Row className="g-3 mb-4">
          <Col md={4}>
            <Card className="border-0 shadow-sm h-100">
              <Card.Body className="text-center">
                <div className="h1 text-primary mb-2">{stats.pending}</div>
                <h6 className="text-muted mb-0">Pending Assessments</h6>
                <small className="text-muted">
                  {stats.total} total assessments
                </small>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="border-0 shadow-sm h-100">
              <Card.Body className="text-center">
                <div className="h1 text-warning mb-2">
                  {Math.round(stats.averageCompletion)}%
                </div>
                <h6 className="text-muted mb-0">Average Completion</h6>
                <ProgressBar 
                  now={stats.averageCompletion} 
                  variant={stats.averageCompletion >= 80 ? 'success' : 'warning'}
                  className="mt-2"
                  style={{ height: '6px' }}
                />
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="border-0 shadow-sm h-100">
              <Card.Body className="text-center">
                <div className="h1 text-success mb-2">{completedAssessments.length}</div>
                <h6 className="text-muted mb-0">Completed Grading</h6>
                <small className="text-muted">
                  Ready for review
                </small>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <Row className="g-4">
          {/* Main Grading Panel */}
          <Col lg={selectedAssessment ? 7 : 12}>
            <Card className="border-0 shadow-sm h-100">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <div>
                    <h5 className="mb-1">Assessments Requiring Grading</h5>
                    <p className="text-muted small mb-0">
                      Select an assessment to start grading
                    </p>
                  </div>
                  <Badge bg="warning" className="px-3 py-2">
                    {pendingAssessments.length} pending
                  </Badge>
                </div>

                {loading ? (
                  <div className="text-center py-5">
                    <Spinner animation="border" variant="primary" />
                    <p className="mt-2">Loading assessments...</p>
                  </div>
                ) : pendingAssessments.length === 0 ? (
                  <Alert variant="success" className="text-center py-4">
                    <i className="bi bi-clipboard-check display-4 text-success mb-3"></i>
                    <h4>All Caught Up!</h4>
                    <p className="text-muted">No assessments pending grading. Well done!</p>
                    <Button 
                      variant="outline-success" 
                      onClick={fetchAssessments}
                      className="mt-2"
                    >
                      <FaSync className="me-2" />
                      Refresh List
                    </Button>
                  </Alert>
                ) : (
                  <div className="table-responsive">
                    <Table hover className="align-middle">
                      <thead className="table-light">
                        <tr>
                          <th>#</th>
                          <th>Assessment Details</th>
                          <th>Class</th>
                          <th>Progress</th>
                          <th>Due Date</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingAssessments.map((assessment, index) => {
                          const submissions = assessment.submissions || 0;
                          const graded = assessment.graded || 0;
                          const completion = submissions > 0 ? (graded / submissions * 100) : 0;
                          
                          return (
                            <tr key={assessment.assessment_id}>
                              <td className="text-muted">{index + 1}</td>
                              <td>
                                <div>
                                  <strong className="d-block">{assessment.assessment_name}</strong>
                                  <div className="text-muted small">
                                    <Badge bg="secondary" className="me-2">
                                      {assessment.assessment_type}
                                    </Badge>
                                    {assessment.subject_name || 'General'}
                                    {assessment.total_marks && ` • ${assessment.total_marks} marks`}
                                  </div>
                                </div>
                              </td>
                              <td>
                                <Badge bg="info">
                                  {assessment.class_name} (Grade {assessment.grade_level})
                                </Badge>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="me-3" style={{ width: '80px' }}>
                                    <ProgressBar 
                                      now={completion} 
                                      variant={getAssessmentColor(assessment)}
                                      style={{ height: '8px' }}
                                    />
                                  </div>
                                  <div>
                                    <div className="small">
                                      <strong>{graded}/{submissions}</strong>
                                    </div>
                                    <div className="text-muted small">
                                      {Math.round(completion)}% complete
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td>
                                {assessment.due_date ? (
                                  <div className="small">
                                    {new Date(assessment.due_date).toLocaleDateString()}
                                    {new Date(assessment.due_date) < new Date() && (
                                      <Badge bg="danger" className="ms-2" size="sm">
                                        Overdue
                                      </Badge>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted small">No due date</span>
                                )}
                              </td>
                              <td>
                                <div className="d-flex gap-2">
                                  <Button
                                    size="sm"
                                    variant={selectedAssessment?.assessment_id === assessment.assessment_id ? 'primary' : 'outline-primary'}
                                    onClick={() => handleSelectAssessment(assessment)}
                                  >
                                    <FaEdit className="me-1" />
                                    {selectedAssessment?.assessment_id === assessment.assessment_id ? 'Selected' : 'Grade'}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline-secondary"
                                    as={Link}
                                    to={`/teacher/assessments/${assessment.assessment_id}/gradebook`}
                                  >
                                    <FaEye className="me-1" />
                                    View
                                  </Button>
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
          </Col>

          {/* Grading Sidebar */}
          {selectedAssessment && (
            <Col lg={5}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Body className="d-flex flex-column">
                  {/* Header */}
                  <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom">
                    <div>
                      <h5 className="mb-1">Grading Panel</h5>
                      <p className="text-muted small mb-0">
                        {selectedAssessment.class_name} • Term {selectedAssessment.term_number}
                      </p>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline-secondary"
                      onClick={() => setSelectedAssessment(null)}
                    >
                      <i className="bi bi-x-lg"></i>
                    </Button>
                  </div>

                  {/* Assessment Info */}
                  <div className="mb-4">
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <div>
                        <h6 className="mb-1">{selectedAssessment.assessment_name}</h6>
                        <div className="text-muted small">
                          <Badge bg="info" className="me-2">
                            {selectedAssessment.assessment_type}
                          </Badge>
                          {selectedAssessment.subject_name || 'General'}
                        </div>
                      </div>
                      <Badge bg="primary" className="px-3 py-2">
                        {selectedAssessment.total_marks} marks
                      </Badge>
                    </div>
                    
                    <div className="bg-light p-3 rounded mb-3">
                      <Row>
                        <Col>
                          <div className="text-center">
                            <div className="h4 mb-0">{gradebook.length}</div>
                            <small className="text-muted">Learners</small>
                          </div>
                        </Col>
                        <Col>
                          <div className="text-center">
                            <div className="h4 mb-0 text-success">
                              {gradebook.filter(g => g.is_graded).length}
                            </div>
                            <small className="text-muted">Graded</small>
                          </div>
                        </Col>
                        <Col>
                          <div className="text-center">
                            <div className="h4 mb-0 text-warning">
                              {gradebook.filter(g => !g.is_graded).length}
                            </div>
                            <small className="text-muted">Pending</small>
                          </div>
                        </Col>
                      </Row>
                    </div>
                  </div>

                  {/* Quick Grade Button */}
                  <div className="mb-4">
                    <Button 
                      variant="primary" 
                      className="w-100 mb-3"
                      onClick={handleBulkGradeAll}
                      disabled={gradebook.length === 0}
                    >
                      <FaEdit className="me-2" />
                      Quick Grade All Learners
                    </Button>
                    
                    <div className="d-grid gap-2">
                      <Button 
                        variant="outline-primary"
                        as={Link}
                        to={`/teacher/assessments/${selectedAssessment.assessment_id}/gradebook`}
                      >
                        <FaChartLine className="me-2" />
                        Open Full Gradebook
                      </Button>
                      <Button variant="outline-secondary">
                        <FaFileExport className="me-2" />
                        Export Grades
                      </Button>
                    </div>
                  </div>

                  {/* Quick Grading Table */}
                  {gradebook.length > 0 && (
                    <>
                      <div className="mb-3">
                        <h6 className="mb-3">Quick Entry</h6>
                        <div className="table-responsive" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                          <Table size="sm" className="mb-0">
                            <thead className="bg-light sticky-top">
                              <tr>
                                <th>Learner</th>
                                <th style={{ width: '100px' }}>Marks</th>
                                <th style={{ width: '70px' }}>Grade</th>
                              </tr>
                            </thead>
                            <tbody>
                              {gradebook.map((item) => {
                                const percentage = item.marks_obtained !== null && item.marks_obtained !== undefined
                                  ? (item.marks_obtained / selectedAssessment.total_marks * 100).toFixed(1)
                                  : null;
                                
                                return (
                                  <tr key={item.learner_id}>
                                    <td>
                                      <div className="small">
                                        {item.first_name} {item.last_name.charAt(0)}.
                                      </div>
                                    </td>
                                    <td>
                                      <Form.Control
                                        type="number"
                                        size="sm"
                                        value={item.marks_obtained !== null && item.marks_obtained !== undefined ? item.marks_obtained : ''}
                                        onChange={(e) => handleGradeChange(item.learner_id, e.target.value)}
                                        min="0"
                                        max={selectedAssessment.total_marks}
                                        step="0.5"
                                        placeholder="0"
                                      />
                                    </td>
                                    <td>
                                      {percentage ? (
                                        <Badge 
                                          bg={getGradeColor(percentage)} 
                                          className="px-2"
                                        >
                                          {calculateGradeLetter(percentage)}
                                        </Badge>
                                      ) : (
                                        <span className="text-muted">-</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </Table>
                        </div>
                      </div>

                      {/* Save Button */}
                      <div className="mt-auto pt-3 border-top">
                        <Button 
                          variant="success" 
                          className="w-100"
                          onClick={handleSaveGrades}
                          disabled={saving || gradebook.length === 0}
                          size="lg"
                        >
                          {saving ? (
                            <>
                              <Spinner size="sm" animation="border" className="me-2" />
                              Saving...
                            </>
                          ) : (
                            'Save All Grades'
                          )}
                        </Button>
                      </div>
                    </>
                  )}

                  {gradebook.length === 0 && (
                    <Alert variant="warning" className="text-center mt-4">
                      <i className="bi bi-people display-4 text-muted mb-3"></i>
                      <p>No learners found in this class.</p>
                    </Alert>
                  )}
                </Card.Body>
              </Card>
            </Col>
          )}
        </Row>

        {/* Recently Graded Assessments */}
        {!selectedAssessment && completedAssessments.length > 0 && (
          <Card className="border-0 shadow-sm mt-4">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                  <h5 className="mb-1">Recently Graded</h5>
                  <p className="text-muted small mb-0">Assessments you've recently completed grading</p>
                </div>
                <Button variant="outline-primary" size="sm" as={Link} to="/teacher/assessments">
                  View All
                </Button>
              </div>
              
              <div className="table-responsive">
                <Table hover>
                  <thead className="table-light">
                    <tr>
                      <th>Assessment</th>
                      <th>Class</th>
                      <th>Average Score</th>
                      <th>Completed On</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedAssessments.slice(0, 5).map((assessment) => {
                      const submissions = assessment.submissions || 1;
                      const graded = assessment.graded || 0;
                      const completionPercentage = (graded / submissions * 100);
                      
                      return (
                        <tr key={assessment.assessment_id}>
                          <td>
                            <div>
                              <strong>{assessment.assessment_name}</strong>
                              <div className="text-muted small">
                                <Badge bg="secondary" className="me-2">
                                  {assessment.assessment_type}
                                </Badge>
                                {assessment.subject_name || 'General'}
                              </div>
                            </div>
                          </td>
                          <td>
                            <Badge bg="info">
                              {assessment.class_name}
                            </Badge>
                          </td>
                          <td>
                            <div className="d-flex align-items-center">
                              <ProgressBar 
                                now={completionPercentage} 
                                variant={completionPercentage >= 80 ? 'success' : 'warning'}
                                style={{ width: '60px', height: '8px' }}
                                className="me-2"
                              />
                              <span className="small">{Math.round(completionPercentage)}%</span>
                            </div>
                          </td>
                          <td>
                            <div className="small">
                              {new Date().toLocaleDateString()}
                            </div>
                          </td>
                          <td>
                            <div className="d-flex gap-2">
                              <Button
                                size="sm"
                                variant="outline-primary"
                                as={Link}
                                to={`/teacher/assessments/${assessment.assessment_id}/gradebook`}
                              >
                                <FaEye className="me-1" />
                                View
                              </Button>
                              <Button
                                size="sm"
                                variant="outline-success"
                                onClick={() => handleSelectAssessment(assessment)}
                              >
                                <FaEdit className="me-1" />
                                Regrade
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>
        )}

        {/* Bulk Grading Modal */}
        <Modal show={showBulkModal} onHide={() => setShowBulkModal(false)} size="lg" centered>
          <Modal.Header closeButton className="bg-primary text-white">
            <Modal.Title>
              <FaEdit className="me-2" />
              Quick Grade All Learners
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Alert variant="info" className="mb-3">
              <i className="bi bi-lightbulb me-2"></i>
              Enter marks for all learners at once. Blank fields will be skipped.
            </Alert>
            
            <Form.Group className="mb-4">
              <Form.Label>Bulk Feedback (Optional)</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={bulkFeedback}
                onChange={(e) => setBulkFeedback(e.target.value)}
                placeholder="This feedback will be applied to all learners..."
              />
              <Form.Text className="text-muted">
                Enter feedback that applies to all learners. Individual feedback can be added in the full gradebook.
              </Form.Text>
            </Form.Group>
            
            {selectedAssessment && (
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 className="mb-0">Learner Marks</h6>
                  <Badge bg="light" text="dark">
                    Max: {selectedAssessment.total_marks} marks
                  </Badge>
                </div>
                
                {gradebook.length === 0 ? (
                  <Alert variant="warning" className="text-center py-4">
                    <i className="bi bi-people display-4 text-muted mb-3"></i>
                    <p>No learners found to grade.</p>
                  </Alert>
                ) : (
                  <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    <Table size="sm" className="mb-0">
                      <thead className="sticky-top bg-white">
                        <tr>
                          <th>#</th>
                          <th>Learner Name</th>
                          <th>Marks (0-{selectedAssessment.total_marks})</th>
                          <th>Current Grade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gradebook.map((item, index) => {
                          const currentMarks = bulkMarks[item.learner_id] || '';
                          const currentPercentage = currentMarks !== '' 
                            ? (parseFloat(currentMarks) / selectedAssessment.total_marks * 100).toFixed(1)
                            : null;
                          
                          return (
                            <tr key={item.learner_id}>
                              <td className="text-muted">{index + 1}</td>
                              <td>
                                <div>
                                  {item.first_name} {item.last_name}
                                </div>
                                <div className="text-muted small">{item.email}</div>
                              </td>
                              <td>
                                <Form.Control
                                  type="number"
                                  size="sm"
                                  value={currentMarks}
                                  onChange={(e) => setBulkMarks({
                                    ...bulkMarks,
                                    [item.learner_id]: e.target.value
                                  })}
                                  min="0"
                                  max={selectedAssessment.total_marks}
                                  step="0.5"
                                  style={{ width: '120px' }}
                                  placeholder="Enter marks"
                                />
                              </td>
                              <td>
                                {currentPercentage ? (
                                  <Badge bg={getGradeColor(currentPercentage)} className="px-2">
                                    {calculateGradeLetter(currentPercentage)} ({currentPercentage}%)
                                  </Badge>
                                ) : (
                                  <span className="text-muted">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  </div>
                )}
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setShowBulkModal(false)}>
              Cancel
            </Button>
            <Button 
              variant="primary" 
              onClick={handleBulkGradeSubmit}
              disabled={saving || gradebook.length === 0}
            >
              {saving ? (
                <>
                  <Spinner size="sm" animation="border" className="me-2" />
                  Saving...
                </>
              ) : (
                'Save All Grades'
              )}
            </Button>
          </Modal.Footer>
        </Modal>
      </Container>
    </Layout>
  );
};

export default Grading;