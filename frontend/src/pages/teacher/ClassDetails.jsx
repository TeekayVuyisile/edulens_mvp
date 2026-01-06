import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Card, Button, Row, Col, Badge, ProgressBar, Table, 
  Form, InputGroup, Tabs, Tab, Alert, Spinner, Modal,
  Dropdown, DropdownButton 
} from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';

const ClassDetails = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const [classDetails, setClassDetails] = useState(null);
  const [learners, setLearners] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [bulkGrades, setBulkGrades] = useState({});
  const [stats, setStats] = useState({
    performance: [],
    subjectPerformance: [],
    termPerformance: []
  });

  useEffect(() => {
    fetchClassDetails();
  }, [classId]);

  const fetchClassDetails = async () => {
    try {
      setLoading(true);
      const [classRes, learnersRes, assessmentsRes] = await Promise.all([
        axios.get(`/api/teacher/classes/${classId}`),
        axios.get(`/api/teacher/classes/${classId}/learners`),
        axios.get(`/api/teacher/classes/${classId}/assessments`)
      ]);

      setClassDetails(classRes.data.data.class);
      const learnersData = learnersRes.data.data.learners || [];
      setLearners(learnersData);
      const assessmentsData = assessmentsRes.data.data.assessments || [];
      setAssessments(assessmentsData);
      
      // Calculate statistics
      calculateStatistics(learnersData, assessmentsData);
      
    } catch (error) {
      toast.error('Failed to fetch class details');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStatistics = (learnersData, assessmentsData) => {
    // Calculate performance per learner (even if no assessments yet)
    const performanceData = learnersData.map(learner => {
      // Find assessments for this learner
      const learnerAssessments = assessmentsData.filter(a => 
        a.grades && a.grades.some(g => g.learner_id === learner.learner_id)
      );
      
      const totalScore = learnerAssessments.reduce((sum, a) => {
        const grade = a.grades.find(g => g.learner_id === learner.learner_id);
        return sum + (grade?.percentage || 0);
      }, 0);
      
      const averageScore = learnerAssessments.length > 0 ? totalScore / learnerAssessments.length : 0;
      
      return {
        name: `${learner.first_name} ${learner.last_name}`,
        learnerId: learner.learner_id,
        averageScore: parseFloat(averageScore.toFixed(2)),
        assessmentsCompleted: learnerAssessments.length,
        latestScore: learnerAssessments[0]?.grades?.find(g => g.learner_id === learner.learner_id)?.percentage || 0,
        // Add learner data for reference
        ...learner
      };
    }).sort((a, b) => b.averageScore - a.averageScore);

    // Calculate subject performance (only if we have assessments)
    const subjects = {};
    let subjectPerformance = [];
    
    if (assessmentsData.length > 0) {
      assessmentsData.forEach(assessment => {
        if (!subjects[assessment.subject_name]) {
          subjects[assessment.subject_name] = {
            totalScore: 0,
            count: 0,
            assessments: []
          };
        }
        
        if (assessment.grades && assessment.grades.length > 0) {
          const avgScore = assessment.grades.reduce((sum, g) => sum + (g.percentage || 0), 0) / assessment.grades.length;
          subjects[assessment.subject_name].totalScore += avgScore;
          subjects[assessment.subject_name].count++;
          subjects[assessment.subject_name].assessments.push({
            name: assessment.assessment_name,
            score: parseFloat(avgScore.toFixed(2))
          });
        }
      });

      subjectPerformance = Object.keys(subjects).map(subject => ({
        subject,
        averageScore: parseFloat((subjects[subject].totalScore / Math.max(subjects[subject].count, 1)).toFixed(2)),
        assessmentCount: subjects[subject].count
      }));
    }

    // Calculate term performance (only if we have assessments)
    const termData = {};
    let termPerformance = [];
    
    if (assessmentsData.length > 0) {
      assessmentsData.forEach(assessment => {
        if (!termData[assessment.term_number]) {
          termData[assessment.term_number] = {
            totalScore: 0,
            count: 0
          };
        }
        
        if (assessment.grades && assessment.grades.length > 0) {
          const avgScore = assessment.grades.reduce((sum, g) => sum + (g.percentage || 0), 0) / assessment.grades.length;
          termData[assessment.term_number].totalScore += avgScore;
          termData[assessment.term_number].count++;
        }
      });

      termPerformance = Object.keys(termData).map(term => ({
        term: `Term ${term}`,
        averageScore: parseFloat((termData[term].totalScore / Math.max(termData[term].count, 1)).toFixed(2)),
        assessmentCount: termData[term].count
      })).sort((a, b) => a.term.localeCompare(b.term));
    }

    setStats({
      performance: performanceData,
      subjectPerformance,
      termPerformance
    });
  };

  const handleBulkGrade = (assessment) => {
    setSelectedAssessment(assessment);
    
    // Initialize grades object
    const initialGrades = {};
    learners.forEach(learner => {
      const existingGrade = assessment.grades?.find(g => g.learner_id === learner.learner_id);
      initialGrades[learner.learner_id] = existingGrade?.marks_obtained || '';
    });
    
    setBulkGrades(initialGrades);
    setShowGradeModal(true);
  };

  const handleGradeChange = (learnerId, value) => {
    setBulkGrades(prev => ({
      ...prev,
      [learnerId]: value
    }));
  };

  const submitBulkGrades = async () => {
    try {
      const grades = Object.entries(bulkGrades).map(([learner_id, marks_obtained]) => ({
        learner_id,
        marks_obtained: parseFloat(marks_obtained),
        percentage: (parseFloat(marks_obtained) / selectedAssessment.total_marks) * 100
      }));

      await axios.post(`/api/teacher/assessments/${selectedAssessment.assessment_id}/bulk-grade`, {
        grades
      });

      toast.success('Grades submitted successfully');
      setShowGradeModal(false);
      fetchClassDetails(); // Refresh data
    } catch (error) {
      toast.error('Failed to submit grades');
      console.error('Error:', error);
    }
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  // Calculate age from date of birth
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

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="primary" />
        <p className="mt-3">Loading class details...</p>
      </div>
    );
  }

  if (!classDetails) {
    return (
      <Alert variant="warning">
        <Alert.Heading>Class not found</Alert.Heading>
        <p>The class you're looking for doesn't exist or you don't have access to it.</p>
        <Button as={Link} to="/teacher/classes" variant="primary">
          Back to Classes
        </Button>
      </Alert>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 mb-1">{classDetails.class_name}</h1>
          <p className="text-muted mb-0">
            Grade {classDetails.grade_level} • Academic Year {classDetails.academic_year} • 
            Term {classDetails.term_number}
          </p>
          <div className="mt-2">
            <Badge bg="primary" className="me-2">Primary Teacher</Badge>
            <Badge bg="success" className="me-2">{learners.length} Learners</Badge>
            <Badge bg="info">{assessments.length} Assessments</Badge>
          </div>
        </div>
        <div>
          <Button 
            as={Link} 
            to="/teacher/classes" 
            variant="outline-secondary" 
            className="me-2"
          >
            <i className="bi bi-arrow-left me-2"></i>
            Back to Classes
          </Button>
          <Button 
            as={Link} 
            to={`/teacher/assessments/create?class=${classId}`}
            variant="primary"
          >
            <i className="bi bi-plus-circle me-2"></i>
            New Assessment
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k)}
        className="mb-4"
      >
        <Tab eventKey="overview" title="Overview">
          <Row className="g-4">
            {/* Class Statistics */}
            <Col md={4}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Body>
                  <h5 className="card-title mb-4">Class Statistics</h5>
                  <div className="mb-3">
                    <div className="d-flex justify-content-between mb-2">
                      <span className="text-muted">Total Learners</span>
                      <strong>{learners.length}</strong>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                      <span className="text-muted">Capacity</span>
                      <strong>{learners.length}/{classDetails.max_capacity || 30}</strong>
                    </div>
                    <ProgressBar 
                      now={(learners.length / (classDetails.max_capacity || 30)) * 100} 
                      style={{ height: '8px' }}
                      className="mb-3"
                    />
                    
                    <div className="d-flex justify-content-between mb-2">
                      <span className="text-muted">Total Assessments</span>
                      <strong>{assessments.length}</strong>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                      <span className="text-muted">Graded</span>
                      <strong>{assessments.filter(a => a.grades && a.grades.length > 0).length}</strong>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            </Col>

            {/* Average Performance - Only show if we have assessments */}
            {stats.subjectPerformance.length > 0 ? (
              <Col md={8}>
                <Card className="border-0 shadow-sm">
                  <Card.Body>
                    <h5 className="card-title mb-4">Average Performance</h5>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={stats.subjectPerformance}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="subject" />
                        <YAxis domain={[0, 100]} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="averageScore" name="Average Score %" fill="#8884d8" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card.Body>
                </Card>
              </Col>
            ) : (
              <Col md={8}>
                <Card className="border-0 shadow-sm">
                  <Card.Body className="text-center py-5">
                    <i className="bi bi-graph-up text-muted display-4 mb-3"></i>
                    <h5>No Assessment Data Yet</h5>
                    <p className="text-muted mb-0">
                      Create assessments to see performance analytics
                    </p>
                  </Card.Body>
                </Card>
              </Col>
            )}

            {/* Term Performance - Only show if we have assessments */}
            {stats.termPerformance.length > 0 ? (
              <Col md={6}>
                <Card className="border-0 shadow-sm">
                  <Card.Body>
                    <h5 className="card-title mb-4">Term Performance</h5>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={stats.termPerformance}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="term" />
                        <YAxis domain={[0, 100]} />
                        <Tooltip />
                        <Line type="monotone" dataKey="averageScore" stroke="#82ca9d" name="Average Score %" />
                      </LineChart>
                    </ResponsiveContainer>
                  </Card.Body>
                </Card>
              </Col>
            ) : (
              <Col md={6}>
                <Card className="border-0 shadow-sm">
                  <Card.Body className="text-center py-5">
                    <i className="bi bi-calendar text-muted display-4 mb-3"></i>
                    <h5>No Term Data</h5>
                    <p className="text-muted mb-0">
                      Create assessments to track term performance
                    </p>
                  </Card.Body>
                </Card>
              </Col>
            )}

            {/* Performance Distribution - Only show if we have assessments */}
            {stats.performance.length > 0 && stats.performance.some(p => p.averageScore > 0) ? (
              <Col md={6}>
                <Card className="border-0 shadow-sm">
                  <Card.Body>
                    <h5 className="card-title mb-4">Performance Distribution</h5>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Excellent (80-100%)', value: stats.performance.filter(p => p.averageScore >= 80).length },
                            { name: 'Good (60-79%)', value: stats.performance.filter(p => p.averageScore >= 60 && p.averageScore < 80).length },
                            { name: 'Average (40-59%)', value: stats.performance.filter(p => p.averageScore >= 40 && p.averageScore < 60).length },
                            { name: 'Needs Improvement (<40%)', value: stats.performance.filter(p => p.averageScore < 40).length }
                          ]}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {COLORS.map((color, index) => (
                            <Cell key={`cell-${index}`} fill={color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </Card.Body>
                </Card>
              </Col>
            ) : (
              <Col md={6}>
                <Card className="border-0 shadow-sm">
                  <Card.Body className="text-center py-5">
                    <i className="bi bi-pie-chart text-muted display-4 mb-3"></i>
                    <h5>No Performance Data</h5>
                    <p className="text-muted mb-0">
                      Grade assessments to see performance distribution
                    </p>
                  </Card.Body>
                </Card>
              </Col>
            )}
          </Row>
        </Tab>

        <Tab eventKey="learners" title={`Learners (${learners.length})`}>
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-4">
                <h5 className="mb-0">Learner List</h5>
                <div className="d-flex gap-2">
                  <Button 
                    as={Link} 
                    to={`/teacher/classes/${classId}/add-learners`}
                    variant="outline-primary" 
                    size="sm"
                  >
                    <i className="bi bi-person-plus me-2"></i>
                    Add Learners
                  </Button>
                  {learners.length > 0 && (
                    <Button 
                      variant="outline-secondary" 
                      size="sm"
                      onClick={() => {
                        // Export learners as CSV
                        const csvContent = "data:text/csv;charset=utf-8," 
                          + ["Name,Email,Gender,Date of Birth,Age,Guardian,Status"]
                          .concat(learners.map(learner => 
                            `"${learner.first_name} ${learner.last_name}",${learner.email || ''},${learner.gender || ''},${learner.date_of_birth || ''},${calculateAge(learner.date_of_birth)},${learner.guardian_name || ''},${learner.academic_status || 'active'}`
                          ))
                          .join("\n");
                        
                        const encodedUri = encodeURI(csvContent);
                        const link = document.createElement("a");
                        link.setAttribute("href", encodedUri);
                        link.setAttribute("download", `${classDetails.class_name}_learners.csv`);
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                    >
                      <i className="bi bi-download me-2"></i>
                      Export CSV
                    </Button>
                  )}
                </div>
              </div>
              
              {learners.length === 0 ? (
                <div className="text-center py-5">
                  <i className="bi bi-people display-1 text-muted mb-3"></i>
                  <h4>No Learners Yet</h4>
                  <p className="text-muted mb-4">This class doesn't have any learners yet.</p>
                  <Button 
                    as={Link} 
                    to={`/teacher/classes/${classId}/add-learners`}
                    variant="primary"
                  >
                    <i className="bi bi-person-plus me-2"></i>
                    Add Your First Learner
                  </Button>
                </div>
              ) : (
                <div className="table-responsive">
                  <Table hover>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Gender</th>
                        <th>Date of Birth</th>
                        <th>Age</th>
                        <th>Average Score</th>
                        <th>Assessments</th>
                        <th>Guardian</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {learners.map((learner, index) => {
                        // Find performance data for this learner
                        const learnerPerformance = stats.performance.find(p => p.learnerId === learner.learner_id);
                        const averageScore = learnerPerformance?.averageScore || 0;
                        const assessmentsCompleted = learnerPerformance?.assessmentsCompleted || 0;
                        
                        return (
                          <tr key={learner.learner_id}>
                            <td>{index + 1}</td>
                            <td>
                              <div className="d-flex align-items-center">
                                <div className="bg-primary-subtle rounded-circle p-2 me-3">
                                  <i className="bi bi-person text-primary"></i>
                                </div>
                                <div>
                                  <strong>{learner.first_name} {learner.last_name}</strong>
                                  <div className="text-muted small">ID: {learner.learner_id.substring(0, 8)}</div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="small">{learner.email || 'No email'}</div>
                            </td>
                            <td>
                              {learner.gender ? (
                                <Badge bg="info">{learner.gender}</Badge>
                              ) : (
                                <span className="text-muted">N/A</span>
                              )}
                            </td>
                            <td>
                              <div className="small">{formatDate(learner.date_of_birth)}</div>
                            </td>
                            <td>
                              <Badge bg="secondary">
                                {calculateAge(learner.date_of_birth)} yrs
                              </Badge>
                            </td>
                            <td>
                              {assessmentsCompleted > 0 ? (
                                <Badge bg={averageScore >= 60 ? 'success' : averageScore >= 40 ? 'warning' : 'danger'}>
                                  {averageScore}%
                                </Badge>
                              ) : (
                                <Badge bg="secondary">No data</Badge>
                              )}
                            </td>
                            <td>
                              <div className="small">
                                <div>{assessmentsCompleted} completed</div>
                                {assessments.length > 0 && (
                                  <div className="text-muted">of {assessments.length} total</div>
                                )}
                              </div>
                            </td>
                            <td>
                              <div className="small">
                                <div>{learner.guardian_name || 'No guardian'}</div>
                                {learner.guardian_phone && (
                                  <div className="text-muted">{learner.guardian_phone}</div>
                                )}
                              </div>
                            </td>
                            <td>
                              <Badge bg={learner.academic_status === 'active' ? 'success' : 'secondary'}>
                                {learner.academic_status || 'active'}
                              </Badge>
                            </td>
                            <td>
                              <DropdownButton
                                size="sm"
                                variant="outline-secondary"
                                title="Actions"
                                align="end"
                              >
                                <Dropdown.Item as={Link} to={`/teacher/learners/${learner.learner_id}`}>
                                  <i className="bi bi-eye me-2"></i>
                                  View Profile
                                </Dropdown.Item>
                                <Dropdown.Item 
                                  onClick={() => {
                                    // Navigate to create assessment with this learner pre-selected
                                    navigate(`/teacher/assessments/create?class=${classId}&learner=${learner.learner_id}`);
                                  }}
                                >
                                  <i className="bi bi-clipboard-plus me-2"></i>
                                  Create Assessment
                                </Dropdown.Item>
                                <Dropdown.Divider />
                                <Dropdown.Item className="text-danger">
                                  <i className="bi bi-trash me-2"></i>
                                  Remove from Class
                                </Dropdown.Item>
                              </DropdownButton>
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
        </Tab>

        <Tab eventKey="assessments" title={`Assessments (${assessments.length})`}>
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-4">
                <h5 className="mb-0">Assessments</h5>
                <div>
                  <Button 
                    as={Link} 
                    to={`/teacher/worksheets/generate?class=${classId}`}
                    variant="outline-success" 
                    className="me-2"
                  >
                    <i className="bi bi-magic me-2"></i>
                    Generate Worksheet
                  </Button>
                  <Button 
                    as={Link} 
                    to={`/teacher/assessments/create?class=${classId}`}
                    variant="primary"
                  >
                    <i className="bi bi-plus-circle me-2"></i>
                    New Assessment
                  </Button>
                </div>
              </div>
              
              {assessments.length === 0 ? (
                <div className="text-center py-5">
                  <i className="bi bi-clipboard display-1 text-muted mb-3"></i>
                  <h4>No Assessments Yet</h4>
                  <p className="text-muted mb-4">Create your first assessment to start tracking learner progress.</p>
                  <Button 
                    as={Link} 
                    to={`/teacher/assessments/create?class=${classId}`}
                    variant="primary"
                  >
                    <i className="bi bi-plus-circle me-2"></i>
                    Create First Assessment
                  </Button>
                </div>
              ) : (
                <>
                  <div className="table-responsive">
                    <Table hover>
                      <thead>
                        <tr>
                          <th>Assessment</th>
                          <th>Type</th>
                          <th>Subject</th>
                          <th>Term</th>
                          <th>Date</th>
                          <th>Graded</th>
                          <th>Avg Score</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assessments.map(assessment => {
                          const gradedCount = assessment.grades?.filter(g => g.is_graded).length || 0;
                          const totalLearners = learners.length;
                          const avgScore = assessment.grades && assessment.grades.length > 0 
                            ? assessment.grades.reduce((sum, g) => sum + (g.percentage || 0), 0) / assessment.grades.length
                            : 0;
                          
                          return (
                            <tr key={assessment.assessment_id}>
                              <td>
                                <strong>{assessment.assessment_name}</strong>
                                <div className="text-muted small">{assessment.description}</div>
                              </td>
                              <td>
                                <Badge bg={
                                  assessment.assessment_type === 'test' ? 'danger' :
                                  assessment.assessment_type === 'quiz' ? 'info' :
                                  assessment.assessment_type === 'project' ? 'success' :
                                  assessment.assessment_type === 'worksheet' ? 'warning' : 'secondary'
                                }>
                                  {assessment.assessment_type}
                                </Badge>
                              </td>
                              <td>
                                {assessment.subject_name || 'No subject'}
                              </td>
                              <td>
                                <Badge bg="primary">Term {assessment.term_number}</Badge>
                              </td>
                              <td>
                                <div className="small">
                                  {new Date(assessment.scheduled_date).toLocaleDateString()}
                                </div>
                                {assessment.due_date && (
                                  <div className="text-muted small">
                                    Due: {new Date(assessment.due_date).toLocaleDateString()}
                                  </div>
                                )}
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="me-2">{gradedCount}/{totalLearners}</div>
                                  <ProgressBar 
                                    now={(gradedCount / Math.max(totalLearners, 1)) * 100} 
                                    style={{ width: '60px', height: '6px' }}
                                    variant={gradedCount === totalLearners ? 'success' : 'warning'}
                                  />
                                </div>
                              </td>
                              <td>
                                {gradedCount > 0 ? (
                                  <Badge bg={avgScore >= 60 ? 'success' : avgScore >= 40 ? 'warning' : 'danger'}>
                                    {avgScore.toFixed(1)}%
                                  </Badge>
                                ) : (
                                  <Badge bg="secondary">Not graded</Badge>
                                )}
                              </td>
                              <td>
                                <div className="btn-group" role="group">
                                  <Button 
                                    variant="outline-primary" 
                                    size="sm"
                                    as={Link}
                                    to={`/teacher/assessments/${assessment.assessment_id}/gradebook`}
                                  >
                                    <i className="bi bi-clipboard-check me-1"></i>
                                    Grade
                                  </Button>
                                  <Button 
                                    variant="outline-secondary" 
                                    size="sm"
                                    onClick={() => handleBulkGrade(assessment)}
                                    disabled={totalLearners === 0}
                                  >
                                    <i className="bi bi-check2-all me-1"></i>
                                    Bulk Grade
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  </div>
                  
                  <div className="mt-3">
                    <Alert variant="info" className="mb-0">
                      <i className="bi bi-info-circle me-2"></i>
                      <strong>Quick Grading:</strong> Use "Bulk Grade" to enter marks for all learners at once, or "Grade" to grade each learner individually with feedback.
                    </Alert>
                  </div>
                </>
              )}
            </Card.Body>
          </Card>
        </Tab>
      </Tabs>

      {/* Bulk Grade Modal */}
      <Modal show={showGradeModal} onHide={() => setShowGradeModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            Bulk Grade: {selectedAssessment?.assessment_name}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {learners.length === 0 ? (
            <Alert variant="warning">
              <i className="bi bi-exclamation-triangle me-2"></i>
              No learners in this class to grade. Please add learners first.
            </Alert>
          ) : (
            <>
              <Alert variant="info" className="mb-3">
                <i className="bi bi-info-circle me-2"></i>
                Enter marks for each learner. Percentage will be calculated automatically.
              </Alert>
              
              <div className="table-responsive">
                <Table>
                  <thead>
                    <tr>
                      <th>Learner</th>
                      <th>Marks Obtained</th>
                      <th>Out of</th>
                      <th>Percentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {learners.map(learner => {
                      const marks = bulkGrades[learner.learner_id] || '';
                      const percentage = marks && selectedAssessment?.total_marks
                        ? ((parseFloat(marks) / selectedAssessment.total_marks) * 100).toFixed(1)
                        : '';
                      
                      return (
                        <tr key={learner.learner_id}>
                          <td>
                            <div className="d-flex align-items-center">
                              <div className="bg-primary-subtle rounded-circle p-2 me-2">
                                <i className="bi bi-person text-primary"></i>
                              </div>
                              <div>
                                <strong>{learner.first_name} {learner.last_name}</strong>
                              </div>
                            </div>
                          </td>
                          <td>
                            <Form.Control
                              type="number"
                              value={marks}
                              onChange={(e) => handleGradeChange(learner.learner_id, e.target.value)}
                              placeholder="Enter marks"
                              min="0"
                              max={selectedAssessment?.total_marks}
                              step="0.5"
                            />
                          </td>
                          <td>{selectedAssessment?.total_marks}</td>
                          <td>
                            {percentage ? (
                              <Badge bg={parseFloat(percentage) >= 60 ? 'success' : parseFloat(percentage) >= 40 ? 'warning' : 'danger'}>
                                {percentage}%
                              </Badge>
                            ) : (
                              <span className="text-muted">--</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowGradeModal(false)}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={submitBulkGrades}
            disabled={learners.length === 0}
          >
            Submit All Grades
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ClassDetails;