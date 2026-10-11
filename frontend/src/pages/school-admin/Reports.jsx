import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Row, Col, Form, Table, Badge, Dropdown, ProgressBar, Spinner } from 'react-bootstrap';
import { Bar, Line, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, ArcElement } from 'chart.js';
import { toast } from 'react-hot-toast';
import axios from 'axios';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const Reports = () => {
  const [loading, setLoading] = useState(true);
  const [gradeLevel, setGradeLevel] = useState('all');
  const [term, setTerm] = useState('all');
  
  // Data states
  const [performanceData, setPerformanceData] = useState(null);
  const [worksheetData, setWorksheetData] = useState(null);

  useEffect(() => {
    fetchReportData();
  }, [gradeLevel, term]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      const [perfRes, wsRes] = await Promise.all([
        axios.get('/api/school-admin/reports/performance', {
          params: { grade_level: gradeLevel, term_number: term }
        }),
        axios.get('/api/school-admin/reports/worksheets')
      ]);

      if (perfRes.data.status === 'success') {
        setPerformanceData(perfRes.data.data);
      }
      if (wsRes.data.status === 'success') {
        setWorksheetData(wsRes.data.data);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  // Prepare Chart Data
  const gradeBarData = useMemo(() => {
    if (!performanceData?.class_performance) return { labels: [], datasets: [] };
    
    // Group by grade
    const grades = ['R', '1', '2', '3'];
    const data = grades.map(g => {
      const classes = performanceData.class_performance.filter(c => c.grade_level === g);
      if (classes.length === 0) return 0;
      return classes.reduce((acc, c) => acc + parseFloat(c.average_score), 0) / classes.length;
    });

    return {
      labels: ['Grade R', 'Grade 1', 'Grade 2', 'Grade 3'],
      datasets: [
        {
          label: 'Average Score (%)',
          data: data,
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1,
        },
      ],
    };
  }, [performanceData]);

  const subjectPieData = useMemo(() => {
    if (!performanceData?.subject_performance) return { labels: [], datasets: [] };
    
    return {
      labels: performanceData.subject_performance.map(s => s.subject_name),
      datasets: [
        {
          label: 'Subject Performance',
          data: performanceData.subject_performance.map(s => s.average_score),
          backgroundColor: [
            'rgba(255, 99, 132, 0.6)',
            'rgba(54, 162, 235, 0.6)',
            'rgba(75, 192, 192, 0.6)',
            'rgba(255, 205, 86, 0.6)',
            'rgba(153, 102, 255, 0.6)',
          ],
          borderWidth: 1,
        },
      ],
    };
  }, [performanceData]);

  const handleDownloadPDF = () => {
    // Hide non-printable elements and trigger print
    window.print();
  };

  const statistics = [
    { title: 'Total Learners', value: performanceData?.summary?.total_learners || 0, color: 'primary', icon: 'people' },
    { title: 'Average Score', value: `${performanceData?.summary?.average_score || 0}%`, color: 'success', icon: 'graph-up' },
    { title: 'Distinctions', value: performanceData?.summary?.distinctions_count || 0, color: 'info', icon: 'award' },
    { title: 'Assessments', value: performanceData?.summary?.total_assessments || 0, color: 'warning', icon: 'clipboard' },
  ];

  if (loading && !performanceData) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="primary" />
        <p className="mt-3 text-muted">Generating real-time reports...</p>
      </div>
    );
  }

  return (
    <div className="reports-container">
      {/* Styles for PDF/Print */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .navbar, .sidebar, .btn, .dropdown, .filters-card { display: none !important; }
          .container-fluid { padding: 0 !important; margin: 0 !important; width: 100% !important; }
          .card { border: 1px solid #dee2e6 !important; box-shadow: none !important; break-inside: avoid; }
          body { background: white !important; }
          .h3 { font-size: 24pt !important; margin-bottom: 20px !important; }
          .print-header { display: block !important; margin-bottom: 30px; text-align: center; }
          .row { margin: 0 !important; }
          .col-lg-8, .col-lg-4, .col-md-4, .col-lg-6 { width: 100% !important; flex: 0 0 100% !important; max-width: 100% !important; }
        }
        .print-header { display: none; }
      `}} />

      <div className="print-header">
        <h1>Edulens LMS - School Performance Report</h1>
        <p className="text-muted">Generated on {new Date().toLocaleDateString()}</p>
        <hr />
      </div>

      <div className="d-flex justify-content-between align-items-center mb-4 d-print-none">
        <div>
          <h1 className="h3 mb-2">Analytics & Reports</h1>
          <p className="text-muted">Comprehensive insights from school data</p>
        </div>
        <Button variant="primary" onClick={handleDownloadPDF}>
          <i className="bi bi-file-pdf me-2"></i>
          Download as PDF
        </Button>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm mb-4 filters-card d-print-none">
        <Card.Body>
          <Row className="g-3">
            <Col md={4}>
              <Form.Group>
                <Form.Label>Grade Level</Form.Label>
                <Form.Select value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)}>
                  <option value="all">All Grades</option>
                  <option value="R">Grade R</option>
                  <option value="1">Grade 1</option>
                  <option value="2">Grade 2</option>
                  <option value="3">Grade 3</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>Term</Form.Label>
                <Form.Select value={term} onChange={(e) => setTerm(e.target.value)}>
                  <option value="all">Full Academic Year</option>
                  <option value="1">Term 1</option>
                  <option value="2">Term 2</option>
                  <option value="3">Term 3</option>
                  <option value="4">Term 4</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4} className="d-flex align-items-end">
              <Button variant="outline-secondary" className="w-100" onClick={fetchReportData}>
                <i className="bi bi-arrow-clockwise me-2"></i> Refresh Data
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Statistics Cards */}
      <Row className="g-3 mb-4">
        {statistics.map((stat, index) => (
          <Col key={index} xs={12} sm={6} lg={3}>
            <Card className="border-0 shadow-sm">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <h6 className="text-muted mb-2 small text-uppercase fw-bold">{stat.title}</h6>
                    <h2 className="fw-bold mb-0">{stat.value}</h2>
                  </div>
                  <div className={`bg-${stat.color}-subtle p-3 rounded`}>
                    <i className={`bi bi-${stat.icon} fs-4 text-${stat.color}`}></i>
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Charts */}
      <Row className="g-4 mb-4">
        <Col lg={8}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <Card.Title className="mb-4">Grade Level Performance</Card.Title>
              <div style={{ height: '300px' }}>
                <Bar 
                  data={gradeBarData} 
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true, max: 100 } }
                  }} 
                />
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={4}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <Card.Title className="mb-4">Subject Averages</Card.Title>
              <div style={{ height: '300px' }}>
                <Pie data={subjectPieData} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Top Classes Table */}
      <Card className="border-0 shadow-sm mb-4">
        <Card.Body>
          <Card.Title className="mb-4">Class Performance Breakdown</Card.Title>
          <div className="table-responsive">
            <Table hover className="align-middle">
              <thead className="table-light">
                <tr>
                  <th>Class Name</th>
                  <th>Grade</th>
                  <th>Teacher</th>
                  <th>Avg Score</th>
                  <th>Pass Rate</th>
                  <th>Distinctions</th>
                </tr>
              </thead>
              <tbody>
                {performanceData?.class_performance?.map((cls, index) => {
                  const totalGraded = parseInt(cls.pass_count) + parseInt(cls.fail_count);
                  const passRate = totalGraded > 0 ? Math.round((parseInt(cls.pass_count) + parseInt(cls.distinction_count)) / cls.total_learners * 100) : 0;
                  
                  return (
                    <tr key={index}>
                      <td><strong>{cls.class_name}</strong></td>
                      <td><Badge bg="info">Grade {cls.grade_level}</Badge></td>
                      <td>{cls.teacher_name || 'N/A'}</td>
                      <td>
                        <div className="d-flex align-items-center">
                          <span className="me-2 fw-bold">{cls.average_score}%</span>
                          <div className="flex-grow-1" style={{ minWidth: '100px' }}>
                            <ProgressBar 
                              now={cls.average_score} 
                              variant={cls.average_score >= 80 ? 'success' : cls.average_score >= 60 ? 'primary' : 'warning'}
                              style={{ height: '6px' }}
                            />
                          </div>
                        </div>
                      </td>
                      <td>{passRate}%</td>
                      <td><Badge bg="success" pill>{cls.distinction_count}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>

      {/* Worksheet Usage */}
      <Row className="g-4 mb-4">
        <Col md={12}>
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <Card.Title className="mb-4">AI Worksheet Generation Statistics</Card.Title>
              <Row className="text-center">
                <Col md={3} className="border-end">
                  <div className="h2 fw-bold mb-0">{worksheetData?.summary?.total_worksheets || 0}</div>
                  <div className="text-muted small">Total Generated</div>
                </Col>
                <Col md={3} className="border-end">
                  <div className="h2 fw-bold text-success mb-0">{worksheetData?.summary?.completed || 0}</div>
                  <div className="text-muted small">Success Rate</div>
                </Col>
                <Col md={3} className="border-end">
                  <div className="h2 fw-bold text-primary mb-0">{worksheetData?.summary?.teachers_active || 0}</div>
                  <div className="text-muted small">Active Teachers</div>
                </Col>
                <Col md={3}>
                  <div className="h2 fw-bold text-info mb-0">
                    {worksheetData?.summary?.last_generated ? new Date(worksheetData.summary.last_generated).toLocaleDateString() : 'N/A'}
                  </div>
                  <div className="text-muted small">Last Activity</div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Areas Needing Attention */}
      <Card className="border-0 shadow-sm">
        <Card.Body>
          <Card.Title className="mb-4 text-danger">Subjects Requiring Attention (Below 60%)</Card.Title>
          <div className="table-responsive">
            <Table hover>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Avg Score</th>
                  <th>Learners Assessed</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {performanceData?.subject_performance?.filter(s => s.average_score < 60).length === 0 ? (
                  <tr><td colSpan="4" className="text-center text-muted py-3">No subjects currently below threshold. Great job!</td></tr>
                ) : (
                  performanceData?.subject_performance?.filter(s => s.average_score < 60).map((subj, index) => (
                    <tr key={index}>
                      <td><strong>{subj.subject_name}</strong></td>
                      <td className="text-danger fw-bold">{subj.average_score}%</td>
                      <td>{subj.learners_assessed}</td>
                      <td><Badge bg="danger">Critical Focus</Badge></td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
};

export default Reports;