import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Button, Table, Form, Alert, Spinner,
  Row, Col, Modal, Badge, ProgressBar, Container
} from 'react-bootstrap';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import Layout from '../../components/common/Layout';

const AssessmentGradebook = () => {
  const { assessmentId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState(null);
  const [gradebook, setGradebook] = useState([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkScores, setBulkScores] = useState({});
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  useEffect(() => {
    fetchGradebook();
  }, [assessmentId]);

  const fetchGradebook = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/teacher/assessments/${assessmentId}/gradebook`);
      console.log('Gradebook response:', response.data);
      
      if (response.data.status === 'success') {
        setAssessment(response.data.data.assessment);
        setGradebook(response.data.data.gradebook || []);
        
        // Initialize bulk scores from existing grades
        const scores = {};
        const gradebookData = response.data.data.gradebook || [];
        gradebookData.forEach(item => {
          if (item.marks_obtained !== null && item.marks_obtained !== undefined) {
            scores[item.learner_id] = item.marks_obtained.toString();
          } else {
            scores[item.learner_id] = '';
          }
        });
        setBulkScores(scores);
        setValidationErrors({});
      } else {
        toast.error('Failed to fetch gradebook data');
      }
    } catch (error) {
      console.error('Error fetching gradebook:', error);
      toast.error(error.response?.data?.message || 'Failed to fetch gradebook');
      navigate('/teacher/assessments');
    } finally {
      setLoading(false);
    }
  };

  const validateMark = (mark, maxMarks) => {
    const numMark = parseFloat(mark);
    if (isNaN(numMark)) return 'Please enter a valid number';
    if (numMark < 0) return 'Marks cannot be negative';
    if (numMark > maxMarks) return `Marks cannot exceed ${maxMarks}`;
    return null;
  };

  const handleGradeChange = (learnerId, marks) => {
    // Clear previous error for this learner
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[learnerId];
      return newErrors;
    });

    // Validate the mark
    if (marks !== '' && assessment) {
      const error = validateMark(marks, assessment.total_marks);
      if (error) {
        setValidationErrors(prev => ({ ...prev, [learnerId]: error }));
        return;
      }
    }

    const updatedGrades = gradebook.map(item => {
      if (item.learner_id === learnerId) {
        const numMarks = marks === '' ? null : parseFloat(marks);
        const percentage = assessment && numMarks !== null 
          ? (numMarks / assessment.total_marks * 100).toFixed(1)
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
    setGradebook(updatedGrades);
  };

  const handleSaveGrades = async () => {
    // Validate all marks before saving
    const errors = {};
    gradebook.forEach(item => {
      if (item.marks_obtained !== null && item.marks_obtained !== undefined) {
        const error = validateMark(item.marks_obtained, assessment.total_marks);
        if (error) {
          errors[item.learner_id] = error;
        }
      }
    });

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      toast.error('Please fix validation errors before saving');
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

      console.log('Saving grades:', grades);

      if (grades.length === 0) {
        toast.error('No grades to save');
        return;
      }

      await axios.post(`/api/teacher/assessments/${assessmentId}/bulk-grade`, { grades });
      toast.success(`Grades saved for ${grades.length} learner${grades.length !== 1 ? 's' : ''}`);
      fetchGradebook(); // Refresh data
    } catch (error) {
      console.error('Error saving grades:', error);
      toast.error(error.response?.data?.message || 'Failed to save grades');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkGradeSubmit = async () => {
    // Validate bulk scores
    const errors = {};
    Object.entries(bulkScores).forEach(([learnerId, score]) => {
      if (score !== '') {
        const error = validateMark(score, assessment.total_marks);
        if (error) {
          errors[learnerId] = error;
        }
      }
    });

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      toast.error('Please fix validation errors before saving');
      return;
    }

    setSaving(true);
    try {
      const grades = Object.entries(bulkScores)
        .filter(([learnerId, score]) => score !== '')
        .map(([learnerId, score]) => ({
          learner_id: learnerId,
          marks_obtained: parseFloat(score),
          teacher_feedback: ''
        }));

      if (grades.length === 0) {
        toast.error('Please enter scores for at least one learner');
        return;
      }

      await axios.post(`/api/teacher/assessments/${assessmentId}/bulk-grade`, { grades });
      toast.success(`Grades saved for ${grades.length} learner${grades.length !== 1 ? 's' : ''}`);
      setShowBulkModal(false);
      fetchGradebook();
    } catch (error) {
      console.error('Error bulk grading:', error);
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

  if (loading) {
    return (
      <Layout>
        <Container className="py-5">
          <div className="text-center">
            <Spinner animation="border" variant="primary" />
            <p className="mt-2">Loading gradebook...</p>
          </div>
        </Container>
      </Layout>
    );
  }

  if (!assessment) {
    return (
      <Layout>
        <Container className="py-5">
          <Alert variant="danger">
            <Alert.Heading>Assessment not found</Alert.Heading>
            <p>The assessment you're trying to access does not exist or you don't have permission to view it.</p>
            <Button variant="primary" onClick={() => navigate('/teacher/assessments')}>
              Back to Assessments
            </Button>
          </Alert>
        </Container>
      </Layout>
    );
  }

  const gradedCount = gradebook.filter(item => item.is_graded).length;
  const totalCount = gradebook.length;
  const completionPercentage = totalCount > 0 ? (gradedCount / totalCount * 100) : 0;

  return (
    <Layout>
      <Container fluid className="py-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h1 className="h3 mb-2">Gradebook: {assessment.assessment_name}</h1>
            <p className="text-muted">
              {assessment.class_name} • Term {assessment.term_number} • Total Marks: {assessment.total_marks}
              {assessment.subject_name && ` • ${assessment.subject_name}`}
            </p>
          </div>
          <div className="d-flex gap-2">
            <Button variant="outline-secondary" onClick={() => navigate('/teacher/assessments')}>
              <i className="bi bi-arrow-left me-2"></i>
              Back to Assessments
            </Button>
            <Button variant="primary" onClick={() => setShowBulkModal(true)}>
              <i className="bi bi-pencil-square me-2"></i>
              Quick Grade All
            </Button>
          </div>
        </div>

        <Card className="border-0 shadow-sm mb-4">
          <Card.Body>
            <div className="mb-4">
              <Row className="g-3">
                <Col md={4}>
                  <div className="text-center p-3 border rounded bg-light">
                    <div className="h2 mb-0 text-primary">{totalCount}</div>
                    <small className="text-muted">Total Learners</small>
                  </div>
                </Col>
                <Col md={4}>
                  <div className="text-center p-3 border rounded bg-light">
                    <div className="h2 mb-0 text-success">{gradedCount}</div>
                    <small className="text-muted">Graded</small>
                  </div>
                </Col>
                <Col md={4}>
                  <div className="text-center p-3 border rounded bg-light">
                    <div className="h2 mb-0 text-info">{Math.round(completionPercentage)}%</div>
                    <small className="text-muted">Completion</small>
                  </div>
                </Col>
              </Row>
              <div className="mt-3">
                <ProgressBar
                  now={completionPercentage}
                  variant={completionPercentage === 100 ? 'success' : completionPercentage > 50 ? 'info' : 'warning'}
                  label={`${Math.round(completionPercentage)}%`}
                  style={{ height: '10px' }}
                />
              </div>
            </div>

            {gradebook.length === 0 ? (
              <Alert variant="warning" className="text-center py-4">
                <i className="bi bi-people display-4 text-muted mb-3"></i>
                <h4>No Learners Found</h4>
                <p className="text-muted">There are no learners in this class or there was an error fetching learners.</p>
                <Button variant="primary" onClick={fetchGradebook}>
                  <i className="bi bi-arrow-clockwise me-2"></i>
                  Refresh Data
                </Button>
              </Alert>
            ) : (
              <>
                <div className="table-responsive">
                  <Table hover className="align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>#</th>
                        <th>Learner</th>
                        <th>Marks Obtained / {assessment.total_marks}</th>
                        <th>Percentage</th>
                        <th>Grade</th>
                        <th>Status</th>
                        <th>Feedback</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gradebook.map((item, index) => {
                        const percentage = item.marks_obtained !== null && item.marks_obtained !== undefined
                          ? (item.marks_obtained / assessment.total_marks * 100).toFixed(1)
                          : null;
                        
                        const hasError = validationErrors[item.learner_id];
                        
                        return (
                          <tr key={item.learner_id} className={hasError ? 'table-warning' : ''}>
                            <td className="text-muted">{index + 1}</td>
                            <td>
                              <div>
                                <strong>{item.first_name} {item.last_name}</strong>
                                <div className="text-muted small">{item.email}</div>
                              </div>
                            </td>
                            <td>
                              <div style={{ maxWidth: '150px' }}>
                                <Form.Control
                                  type="number"
                                  value={item.marks_obtained !== null && item.marks_obtained !== undefined ? item.marks_obtained : ''}
                                  onChange={(e) => handleGradeChange(item.learner_id, e.target.value)}
                                  min="0"
                                  max={assessment.total_marks}
                                  step="0.5"
                                  isInvalid={!!hasError}
                                  placeholder="Enter marks"
                                />
                                {hasError && (
                                  <Form.Control.Feedback type="invalid" className="d-block">
                                    <small>{hasError}</small>
                                  </Form.Control.Feedback>
                                )}
                              </div>
                            </td>
                            <td>
                              {percentage ? (
                                <Badge bg={getGradeColor(percentage)} className="px-3 py-2">
                                  {percentage}%
                                </Badge>
                              ) : (
                                <span className="text-muted">-</span>
                              )}
                            </td>
                            <td>
                              {percentage ? (
                                <Badge bg="dark" className="px-3 py-2" style={{ fontSize: '0.9rem' }}>
                                  {calculateGradeLetter(percentage)}
                                </Badge>
                              ) : (
                                <span className="text-muted">-</span>
                              )}
                            </td>
                            <td>
                              <Badge bg={item.is_graded ? 'success' : 'warning'} className="px-3 py-2">
                                {item.is_graded ? 'Graded' : 'Pending'}
                              </Badge>
                              {item.graded_at && (
                                <div className="text-muted small mt-1">
                                  <i className="bi bi-calendar me-1"></i>
                                  {new Date(item.graded_at).toLocaleDateString()}
                                </div>
                              )}
                            </td>
                            <td>
                              <Form.Control
                                as="textarea"
                                rows={2}
                                value={item.teacher_feedback || ''}
                                onChange={(e) => {
                                  const updated = gradebook.map(g => 
                                    g.learner_id === item.learner_id 
                                      ? { ...g, teacher_feedback: e.target.value }
                                      : g
                                  );
                                  setGradebook(updated);
                                }}
                                placeholder="Add constructive feedback..."
                                style={{ fontSize: '0.9rem', minWidth: '200px' }}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>

                <div className="d-flex justify-content-between align-items-center mt-4 pt-3 border-top">
                  <div>
                    <Button
                      variant="outline-secondary"
                      onClick={() => navigate('/teacher/assessments')}
                      className="me-2"
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="outline-primary"
                      onClick={fetchGradebook}
                    >
                      <i className="bi bi-arrow-clockwise me-2"></i>
                      Refresh
                    </Button>
                  </div>
                  <div>
                    <Button
                      variant="primary"
                      onClick={handleSaveGrades}
                      disabled={saving}
                      size="lg"
                    >
                      {saving ? (
                        <>
                          <Spinner size="sm" animation="border" className="me-2" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-save me-2"></i>
                          Save All Grades
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </Card.Body>
        </Card>

        {/* Bulk Grading Modal */}
        <Modal show={showBulkModal} onHide={() => setShowBulkModal(false)} size="lg" centered>
          <Modal.Header closeButton className="bg-primary text-white">
            <Modal.Title>
              <i className="bi bi-pencil-square me-2"></i>
              Quick Grade All Learners
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Alert variant="info" className="mb-3">
              <i className="bi bi-lightbulb me-2"></i>
              Enter marks for all learners quickly. Leave blank for learners you don't want to grade yet.
              <br />
              <strong>Maximum marks:</strong> {assessment.total_marks}
            </Alert>
            
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
                      <th>Marks (0-{assessment.total_marks})</th>
                      <th>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gradebook.map((item, index) => {
                      const error = validationErrors[item.learner_id];
                      return (
                        <tr key={item.learner_id} className={error ? 'table-warning' : ''}>
                          <td className="text-muted">{index + 1}</td>
                          <td>
                            {item.first_name} {item.last_name}
                            <div className="text-muted small">{item.email}</div>
                          </td>
                          <td>
                            <Form.Control
                              type="number"
                              size="sm"
                              value={bulkScores[item.learner_id] || ''}
                              onChange={(e) => {
                                const newScores = {
                                  ...bulkScores,
                                  [item.learner_id]: e.target.value
                                };
                                setBulkScores(newScores);
                                
                                // Validate on change
                                if (e.target.value !== '') {
                                  const validationError = validateMark(e.target.value, assessment.total_marks);
                                  if (validationError) {
                                    setValidationErrors(prev => ({
                                      ...prev,
                                      [item.learner_id]: validationError
                                    }));
                                  } else {
                                    setValidationErrors(prev => {
                                      const newErrors = { ...prev };
                                      delete newErrors[item.learner_id];
                                      return newErrors;
                                    });
                                  }
                                }
                              }}
                              min="0"
                              max={assessment.total_marks}
                              step="0.5"
                              style={{ width: '120px' }}
                              placeholder="Enter marks"
                              isInvalid={!!error}
                            />
                          </td>
                          <td>
                            {error && (
                              <small className="text-danger">{error}</small>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => {
              setShowBulkModal(false);
              setValidationErrors({});
            }}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleBulkGradeSubmit} disabled={saving || gradebook.length === 0}>
              {saving ? (
                <>
                  <Spinner size="sm" animation="border" className="me-2" />
                  Saving...
                </>
              ) : (
                'Save Grades'
              )}
            </Button>
          </Modal.Footer>
        </Modal>
      </Container>
    </Layout>
  );
};

export default AssessmentGradebook;