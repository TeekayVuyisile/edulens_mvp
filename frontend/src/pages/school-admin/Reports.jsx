import React, { useState, useEffect } from 'react';
import { Card, Button, Row, Col, Form, Table, Badge, Dropdown, ProgressBar } from 'react-bootstrap';
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
  const [reportType, setReportType] = useState('performance');
  const [timeRange, setTimeRange] = useState('current_term');
  const [gradeLevel, setGradeLevel] = useState('all');

  useEffect(() => {
    fetchReportData();
  }, [reportType, timeRange, gradeLevel]);

  const fetchReportData = async () => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

  // Performance Chart Data
  const performanceData = {
    labels: ['Grade R', 'Grade 1', 'Grade 2', 'Grade 3'],
    datasets: [
      {
        label: 'Average Score (%)',
        data: [78, 82, 75, 85],
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      },
    ],
  };

  // Subject Performance Data
  const subjectData = {
    labels: ['Mathematics', 'English', 'Life Skills', 'FAL'],
    datasets: [
      {
        label: 'Subject Performance',
        data: [85, 78, 92, 70],
        backgroundColor: [
          'rgba(255, 99, 132, 0.5)',
          'rgba(54, 162, 235, 0.5)',
          'rgba(75, 192, 192, 0.5)',
          'rgba(255, 205, 86, 0.5)',
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(255, 205, 86, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  // Trend Data
  const trendData = {
    labels: ['Term 1', 'Term 2', 'Term 3', 'Term 4'],
    datasets: [
      {
        label: 'School Average',
        data: [72, 75, 78, 80],
        borderColor: 'rgba(54, 162, 235, 1)',
        backgroundColor: 'rgba(54, 162, 235, 0.1)',
        tension: 0.3,
      },
      {
        label: 'Top Class',
        data: [80, 82, 85, 88],
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.1)',
        tension: 0.3,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
    },
  };

  const statistics = [
    { title: 'Total Learners', value: '480', change: '+12', color: 'primary', icon: 'people' },
    { title: 'Average Score', value: '78.5%', change: '+2.3%', color: 'success', icon: 'graph-up' },
    { title: 'Attendance Rate', value: '94.2%', change: '+1.5%', color: 'info', icon: 'calendar-check' },
    { title: 'Assessments', value: '156', change: '+24', color: 'warning', icon: 'clipboard' },
  ];

  const topPerformers = [
    { name: 'Grade 2 - B', teacher: 'Ms. Johnson', score: 88, learners: 28 },
    { name: 'Grade 1 - A', teacher: 'Mr. Smith', score: 85, learners: 30 },
    { name: 'Grade 3 - A', teacher: 'Ms. Williams', score: 82, learners: 26 },
    { name: 'Grade R - Lions', teacher: 'Ms. Brown', score: 80, learners: 25 },
  ];

  const areasNeedingAttention = [
    { subject: 'First Additional Language', grade: 'Grade 2', score: 65, trend: 'down' },
    { subject: 'Mathematics', grade: 'Grade 1', score: 68, trend: 'stable' },
    { subject: 'Life Skills', grade: 'Grade 3', score: 70, trend: 'up' },
  ];

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 mb-2">Analytics & Reports</h1>
          <p className="text-muted">Comprehensive insights into school performance</p>
        </div>
        <Dropdown>
          <Dropdown.Toggle variant="outline-primary">
            <i className="bi bi-download me-2"></i>
            Export Report
          </Dropdown.Toggle>
          <Dropdown.Menu>
            <Dropdown.Item>
              <i className="bi bi-file-pdf me-2"></i>
              Export as PDF
            </Dropdown.Item>
            <Dropdown.Item>
              <i className="bi bi-file-excel me-2"></i>
              Export as Excel
            </Dropdown.Item>
            <Dropdown.Item>
              <i className="bi bi-printer me-2"></i>
              Print Report
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm mb-4">
        <Card.Body>
          <Row className="g-3">
            <Col md={4}>
              <Form.Group>
                <Form.Label>Report Type</Form.Label>
                <Form.Select value={reportType} onChange={(e) => setReportType(e.target.value)}>
                  <option value="performance">Performance Overview</option>
                  <option value="attendance">Attendance Report</option>
                  <option value="worksheets">Worksheet Usage</option>
                  <option value="teachers">Teacher Performance</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>Time Range</Form.Label>
                <Form.Select value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
                  <option value="current_term">Current Term</option>
                  <option value="last_term">Last Term</option>
                  <option value="academic_year">Academic Year</option>
                  <option value="custom">Custom Range</option>
                </Form.Select>
              </Form.Group>
            </Col>
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
                    <h6 className="text-muted mb-2">{stat.title}</h6>
                    <h2 className="fw-bold mb-0">{stat.value}</h2>
                    <div className={`small ${stat.change.startsWith('+') ? 'text-success' : 'text-danger'}`}>
                      <i className={`bi bi-arrow-${stat.change.startsWith('+') ? 'up' : 'down'}`}></i>
                      {stat.change} from last term
                    </div>
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
              <div className="d-flex justify-content-between align-items-center mb-3">
                <Card.Title className="mb-0">Performance Overview</Card.Title>
                <div className="small text-muted">By Grade Level</div>
              </div>
              <div style={{ height: '300px' }}>
                <Bar data={performanceData} options={chartOptions} />
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={4}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <Card.Title className="mb-3">Subject Distribution</Card.Title>
              <div style={{ height: '300px' }}>
                <Pie data={subjectData} options={chartOptions} />
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Trend Chart */}
      <Card className="border-0 shadow-sm mb-4">
        <Card.Body>
          <Card.Title className="mb-3">Performance Trends</Card.Title>
          <div style={{ height: '250px' }}>
            <Line data={trendData} options={chartOptions} />
          </div>
        </Card.Body>
      </Card>

      {/* Detailed Tables */}
      <Row className="g-4">
        <Col lg={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <Card.Title className="mb-0">Top Performing Classes</Card.Title>
                <Badge bg="success">Current Term</Badge>
              </div>
              <div className="table-responsive">
                <Table hover>
                  <thead>
                    <tr>
                      <th>Class</th>
                      <th>Teacher</th>
                      <th>Avg Score</th>
                      <th>Learners</th>
                      <th>Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topPerformers.map((classItem, index) => (
                      <tr key={index}>
                        <td>
                          <strong>{classItem.name}</strong>
                        </td>
                        <td>{classItem.teacher}</td>
                        <td>
                          <Badge bg="success">{classItem.score}%</Badge>
                        </td>
                        <td>{classItem.learners}</td>
                        <td>
                          <ProgressBar 
                            now={classItem.score} 
                            label={`${classItem.score}%`}
                            variant={classItem.score > 85 ? 'success' : classItem.score > 75 ? 'warning' : 'danger'}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <Card.Title className="mb-0">Areas Needing Attention</Card.Title>
                <Badge bg="warning">Requires Focus</Badge>
              </div>
              <div className="table-responsive">
                <Table hover>
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Grade</th>
                      <th>Avg Score</th>
                      <th>Trend</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {areasNeedingAttention.map((area, index) => (
                      <tr key={index}>
                        <td>
                          <strong>{area.subject}</strong>
                        </td>
                        <td>
                          <Badge bg="info">{area.grade}</Badge>
                        </td>
                        <td>
                          <Badge bg={area.score > 70 ? 'warning' : 'danger'}>
                            {area.score}%
                          </Badge>
                        </td>
                        <td>
                          <div className="d-flex align-items-center">
                            <i className={`bi bi-arrow-${area.trend} text-${area.trend === 'up' ? 'success' : area.trend === 'down' ? 'danger' : 'secondary'} me-1`}></i>
                            <span className={`text-${area.trend === 'up' ? 'success' : area.trend === 'down' ? 'danger' : 'secondary'}`}>
                              {area.trend}
                            </span>
                          </div>
                        </td>
                        <td>
                          <Button size="sm" variant="outline-primary">
                            View Details
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Quick Stats */}
      <Row className="g-4 mt-4">
        <Col md={4}>
          <Card className="border-0 shadow-sm">
            <Card.Body className="text-center">
              <i className="bi bi-people display-4 text-primary mb-3"></i>
              <h3>Class Distribution</h3>
              <div className="d-flex justify-content-around mt-3">
                <div>
                  <div className="fw-bold">Grade R</div>
                  <div className="text-muted">4 Classes</div>
                </div>
                <div>
                  <div className="fw-bold">Grade 1-3</div>
                  <div className="text-muted">12 Classes</div>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="border-0 shadow-sm">
            <Card.Body className="text-center">
              <i className="bi bi-file-earmark-text display-4 text-success mb-3"></i>
              <h3>Worksheet Usage</h3>
              <div className="d-flex justify-content-around mt-3">
                <div>
                  <div className="fw-bold">Generated</div>
                  <div className="text-muted">156</div>
                </div>
                <div>
                  <div className="fw-bold">This Month</div>
                  <div className="text-muted">24</div>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="border-0 shadow-sm">
            <Card.Body className="text-center">
              <i className="bi bi-award display-4 text-warning mb-3"></i>
              <h3>Achievements</h3>
              <div className="d-flex justify-content-around mt-3">
                <div>
                  <div className="fw-bold">Distinctions</div>
                  <div className="text-muted">128</div>
                </div>
                <div>
                  <div className="fw-bold">Improvements</div>
                  <div className="text-muted">+15%</div>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Reports;