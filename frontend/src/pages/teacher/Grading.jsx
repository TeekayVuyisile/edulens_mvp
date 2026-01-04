import React, { useState, useEffect } from 'react';
import { Card, Button, Table, Form, Row, Col, InputGroup, Dropdown, ProgressBar, Badge } from 'react-bootstrap';
import { toast } from 'react-hot-toast';
import axios from 'axios';

const Grading = () => {
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const [gradebook, setGradebook] = useState([]);
  const [grading, setGrading] = useState(false);

  useEffect(() => {
    fetchPendingGrading();
  }, []);

  const fetchPendingGrading = async () => {
    try {
      const response = await axios.get('/api/teacher/assessments');
      setAssessments(response.data.data.assessments || []);
    } catch (error) {
      toast.error('Failed to fetch assessments');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAssessment = async (assessment) => {
    setSelectedAssessment(assessment);
    // Fetch gradebook for this assessment
    try {
      const response = await axios.get(`/api/teacher/assessments/${assessment.assessment_id}/gradebook`);
      setGradebook(response.data.data.gradebook || []);
    } catch (error) {
      toast.error('Failed to fetch gradebook');
    }
  };

  const handleBulkGrade = async () => {
    setGrading(true);
    try {
      await axios.post(`/api/teacher/assessments/${selectedAssessment.assessment_id}/bulk-grade`, {
        grades: gradebook.map(item => ({
          learner_id: item.learner_id,
          marks_obtained: item.marks_obtained || 0,
          percentage: ((item.marks_obtained || 0) / selectedAssessment.total_marks) * 100,
          grade_letter: getGradeLetter(((item.marks_obtained || 0) / selectedAssessment.total_marks) * 100),
          teacher_feedback: item.teacher_feedback || '',
        }))
      });
      toast.success('Grades submitted successfully');
      fetchPendingGrading();
      setSelectedAssessment(null);
    } catch (error) {
      toast.error('Failed to submit grades');
    } finally {
      setGrading(false);
    }
  };

  const getGradeLetter = (percentage) => {
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B';
    if (percentage >= 60) return 'C';
    if (percentage >= 50) return 'D';
    return 'F';
  };

  const updateGrade = (learnerId, field, value) => {
    setGradebook(prev => prev.map(item => 
      item.learner_id === learnerId 
        ? { ...item, [field]: value }
        : item
    ));
  };

  const pendingAssessments = assessments.filter(a => a.submissions !== a.graded);

  return (
    <div>
      <div className="mb-4">
        <h1 className="h3 mb-2">Assessment Grading</h1>
        <p className="text-muted">Grade assessments and provide feedback to learners</p>
      </div>

      <Row className="g-4">
        <Col lg={selectedAssessment ? 8 : 12}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-4">
                <h5 className="mb-0">Pending Grading</h5>
                <Badge bg="warning">
                  {pendingAssessments.length} assessments pending
                </Badge>
              </div>

              {loading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </div>
              ) : pendingAssessments.length === 0 ? (
                <div className="text-center py-5">
                  <i className="bi bi-clipboard-check display-1 text-muted mb-3"></i>
                  <h4>All Caught Up!</h4>
                  <p className="text-muted">No assessments pending grading.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <Table hover>
                    <thead>
                      <tr>
                        <th>Assessment</th>
                        <th>Class</th>
                        <th>Type</th>
                        <th>Submissions</th>
                        <th>Grading Progress</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingAssessments.map((assessment) => (
                        <tr key={assessment.assessment_id}>
                          <td>
                            <strong>{assessment.assessment_name}</strong>
                            <div className="text-muted small">
                              {assessment.subject_name} • {assessment.total_marks} marks
                            </div>
                          </td>
                          <td>
                            <Badge bg="info">{assessment.class_name}</Badge>
                          </td>
                          <td>
                            <Badge bg="secondary">{assessment.assessment_type}</Badge>
                          </td>
                          <td>
                            <div className="d-flex align-items-center">
                              <span className="fw-bold me-2">{assessment.graded || 0}/{assessment.submissions || 0}</span>
                            </div>
                          </td>
                          <td>
                            <div className="d-flex align-items-center">
                              <ProgressBar 
                                className="flex-grow-1 me-2"
                                now={((assessment.graded || 0) / (assessment.submissions || 1)) * 100} 
                                style={{ height: '6px' }}
                              />
                              <span className="small">
                                {Math.round(((assessment.graded || 0) / (assessment.submissions || 1)) * 100)}%
                              </span>
                            </div>
                          </td>
                          <td>
                            <Button 
                              size="sm" 
                              variant="primary"
                              onClick={() => handleSelectAssessment(assessment)}
                            >
                              <i className="bi bi-pencil me-1"></i>
                              Grade
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        {selectedAssessment && (
          <Col lg={4}>
            <Card className="border-0 shadow-sm h-100">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <h5 className="mb-0">Grade Assessment</h5>
                  <Button 
                    size="sm" 
                    variant="outline-secondary"
                    onClick={() => setSelectedAssessment(null)}
                  >
                    <i className="bi bi-x"></i>
                  </Button>
                </div>

                <div className="mb-4">
                  <h6>{selectedAssessment.assessment_name}</h6>
                  <p className="text-muted small mb-2">
                    {selectedAssessment.class_name} • {selectedAssessment.subject_name}
                  </p>
                  <div className="d-flex justify-content-between small">
                    <span>Total Marks: {selectedAssessment.total_marks}</span>
                    <span>Term: {selectedAssessment.term_number}</span>
                  </div>
                </div>

                <div className="table-responsive">
                  <Table size="sm" hover>
                    <thead>
                      <tr>
                        <th>Learner</th>
                        <th>Marks</th>
                        <th>Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gradebook.map((item) => (
                        <tr key={item.learner_id}>
                          <td>
                            <div className="small">
                              {item.first_name} {item.last_name}
                            </div>
                          </td>
                          <td style={{ width: '80px' }}>
                            <Form.Control
                              type="number"
                              size="sm"
                              value={item.marks_obtained || ''}
                              onChange={(e) => updateGrade(item.learner_id, 'marks_obtained', e.target.value)}
                              min="0"
                              max={selectedAssessment.total_marks}
                            />
                          </td>
                          <td style={{ width: '60px' }}>
                            {item.marks_obtained && (
                              <Badge bg={getGradeLetter((item.marks_obtained / selectedAssessment.total_marks) * 100) === 'F' ? 'danger' : 'success'}>
                                {getGradeLetter((item.marks_obtained / selectedAssessment.total_marks) * 100)}
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>

                <div className="mt-3">
                  <Form.Group className="mb-3">
                    <Form.Label>Bulk Feedback (Optional)</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      placeholder="Enter feedback for all learners..."
                    />
                  </Form.Group>
                  
                  <div className="d-grid gap-2">
                    <Button 
                      variant="primary" 
                      onClick={handleBulkGrade}
                      disabled={grading}
                    >
                      {grading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                          Submitting...
                        </>
                      ) : (
                        'Submit All Grades'
                      )}
                    </Button>
                    <Button variant="outline-secondary">
                      Download Grade Sheet
                    </Button>
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Col>
        )}
      </Row>

      {/* Completed Assessments */}
      {!selectedAssessment && (
        <Card className="border-0 shadow-sm mt-4">
          <Card.Body>
            <h5 className="mb-3">Recently Graded</h5>
            <div className="table-responsive">
              <Table hover size="sm">
                <thead>
                  <tr>
                    <th>Assessment</th>
                    <th>Class</th>
                    <th>Average Score</th>
                    <th>Completed</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assessments
                    .filter(a => a.graded > 0)
                    .slice(0, 5)
                    .map((assessment) => (
                      <tr key={assessment.assessment_id}>
                        <td>
                          <div className="small">
                            <strong>{assessment.assessment_name}</strong>
                            <div className="text-muted">{assessment.assessment_type}</div>
                          </div>
                        </td>
                        <td>
                          <Badge bg="info">{assessment.class_name}</Badge>
                        </td>
                        <td>
                          <Badge bg="success">75%</Badge>
                        </td>
                        <td>
                          <div className="small">
                            {new Date().toLocaleDateString()}
                          </div>
                        </td>
                        <td>
                          <Button size="sm" variant="outline-primary">
                            View Results
                          </Button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </Table>
            </div>
          </Card.Body>
        </Card>
      )}
    </div>
  );
};

export default Grading;