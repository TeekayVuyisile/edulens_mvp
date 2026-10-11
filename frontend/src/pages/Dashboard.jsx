import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Button, Spinner, Table, Badge, ProgressBar } from 'react-bootstrap';
import { useAuth } from '../contexts/useAuth';
import { Link } from 'react-router-dom';
import axios from 'axios';

const Dashboard = () => {
  const { user } = useAuth();

  const getDashboardContent = () => {
    if (!user) {
      return <DefaultDashboard />;
    }
    
    switch (user.role) {
      case 'super_admin':
        return <SuperAdminDashboard />;
      case 'school_admin':
        return <SchoolAdminDashboard />;
      case 'teacher':
        return <TeacherDashboard />;
      case 'learner':
        return <LearnerDashboard />;
      default:
        return <DefaultDashboard />;
    }
  };

  return (
    <div>
      <div className="mb-4">
        <h1 className="h3 mb-2">Dashboard</h1>
        {user && (
          <p className="text-muted">
            Welcome back, <span className="fw-semibold">{user.first_name} {user.last_name}</span>
          </p>
        )}
      </div>
      
      {getDashboardContent()}
    </div>
  );
};

const SuperAdminDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user?.role === 'super_admin') {
      fetchStats();
    }
  }, [user]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/super-admin/statistics');
      if (response.data.status === 'success') {
        setData(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch super admin stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="primary" />
        <p className="mt-2 text-muted">Loading dashboard data...</p>
      </div>
    );
  }

  const stats = [
    { title: 'Total Schools', value: data?.summary?.totalSchools || 0, icon: 'building', color: 'primary', link: '/super-admin/schools' },
    { title: 'Total Admins', value: data?.summary?.totalAdmins || 0, icon: 'person-badge', color: 'info', link: '/super-admin/users?role=school_admin' },
    { title: 'Total Teachers', value: data?.summary?.totalTeachers || 0, icon: 'mortarboard', color: 'success', link: '/super-admin/users?role=teacher' },
    { title: 'Total Learners', value: data?.summary?.totalLearners || 0, icon: 'people', color: 'warning', link: '/super-admin/users?role=learner' },
  ];

  return (
    <>
      {/* Stats Cards */}
      <Row className="g-3 mb-4">
        {stats.map((stat, index) => (
          <Col key={index} xs={12} sm={6} lg={3}>
            <Card className="border-0 shadow-sm h-100">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <h6 className="text-muted mb-2 small text-uppercase fw-bold">{stat.title}</h6>
                    <h2 className="fw-bold mb-0">{stat.value.toLocaleString()}</h2>
                  </div>
                  <div className={`bg-${stat.color}-subtle p-3 rounded`}>
                    <i className={`bi bi-${stat.icon} fs-4 text-${stat.color}`}></i>
                  </div>
                </div>
                <Button 
                  as={Link} 
                  to={stat.link} 
                  variant="link" 
                  className="p-0 mt-3 text-decoration-none small"
                >
                  View Details <i className="bi bi-arrow-right ms-1"></i>
                </Button>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      <Row className="g-4">
        {/* Recent Activity */}
        <Col lg={8}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Header className="bg-white border-0 py-3">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">Recent Platform Activity</h5>
                <Button variant="outline-primary" size="sm" onClick={fetchStats} disabled={loading}>
                  {loading ? <Spinner size="sm" animation="border" /> : <i className="bi bi-arrow-clockwise"></i>}
                </Button>
              </div>
            </Card.Header>
            <Card.Body className="p-0">
              <div className="table-responsive">
                <Table hover className="align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th className="ps-4">Action</th>
                      <th>User</th>
                      <th>School</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.recentActivity?.length > 0 ? (
                      data.recentActivity.map((activity, index) => (
                        <tr key={index}>
                          <td className="ps-4">
                            <div className="d-flex align-items-center">
                              <div className="bg-light rounded-circle p-2 me-3">
                                <i className={`bi bi-${getActivityIcon(activity.action_type)} text-primary`}></i>
                              </div>
                              <div>
                                <div className="fw-bold small">{formatActivityType(activity.action_type)}</div>
                                <div className="text-muted extra-small">{activity.action_type}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="small fw-semibold">{activity.first_name} {activity.last_name}</div>
                            <div className="text-muted extra-small">{activity.email}</div>
                          </td>
                          <td className="small">{activity.school_name || <span className="text-muted">N/A</span>}</td>
                          <td className="small text-muted">
                            {formatRelativeTime(activity.created_at)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="text-center py-5 text-muted">No recent activity recorded</td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Distribution & Growth */}
        <Col lg={4}>
          <Card className="border-0 shadow-sm mb-4">
            <Card.Body>
              <h5 className="mb-4">Learner Distribution</h5>
              {data?.gradeDistribution?.length > 0 ? (
                data.gradeDistribution.map((item, index) => (
                  <div key={index} className="mb-3">
                    <div className="d-flex justify-content-between mb-1 small">
                      <span>Grade {item.grade}</span>
                      <span className="fw-bold">{item.count}</span>
                    </div>
                    <ProgressBar 
                      now={(item.count / data.summary.totalLearners) * 100} 
                      variant={getGradeVariant(item.grade)} 
                      style={{height: '6px'}}
                    />
                  </div>
                ))
              ) : (
                <p className="text-center text-muted py-3">No data available</p>
              )}
            </Card.Body>
          </Card>

          <Card className="border-0 shadow-sm">
            <Card.Body>
              <h5 className="mb-4">Quick Insights</h5>
              <div className="d-flex align-items-center mb-4">
                <div className="bg-primary-subtle p-3 rounded me-3 text-center" style={{width: '60px'}}>
                  <h4 className="mb-0 fw-bold">{data?.summary?.activeUsers24h}</h4>
                </div>
                <div>
                  <h6 className="mb-0 fw-bold">Active Users</h6>
                  <small className="text-muted">In the last 24 hours</small>
                </div>
              </div>
              
              <div className="alert alert-info border-0 mb-0">
                <div className="d-flex">
                  <i className="bi bi-info-circle-fill me-2 mt-1"></i>
                  <div className="small">
                    <strong>Growth Note:</strong> 
                    {data?.growth?.length > 0 ? 
                      ` You added ${data.growth[data.growth.length - 1].count} schools this month.` : 
                      ' No new schools added recently.'}
                  </div>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  );
};

// Helper components & functions
const getActivityIcon = (type) => {
  const icons = {
    'LOGIN': 'box-arrow-in-right',
    'USER_CREATED': 'person-plus',
    'SCHOOL_CREATED': 'plus-square',
    'CURRICULUM_ASSIGNED': 'book',
    'ASSESSMENT_CREATED': 'clipboard-plus',
    'GRADES_SUBMITTED': 'check2-circle',
    'WORKSHEET_GENERATED': 'magic',
    'LEARNER_CREATED': 'person-plus-fill'
  };
  return icons[type] || 'activity';
};

const formatActivityType = (type) => {
  return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
};

const formatRelativeTime = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMinutes = Math.floor((now - date) / 60000);
  
  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
  return date.toLocaleDateString();
};

const getGradeVariant = (grade) => {
  const variants = { 'R': 'secondary', '1': 'success', '2': 'primary', '3': 'info' };
  return variants[grade] || 'dark';
};

const SchoolAdminDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/school-admin/dashboard');
      if (response.data.status === 'success') {
        setData(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch school admin dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="primary" />
        <p className="mt-2 text-muted">Loading school data...</p>
      </div>
    );
  }

  const stats = [
    { title: 'Total Teachers', value: data?.summary?.totalTeachers || 0, icon: 'person-badge', color: 'primary', link: '/school-admin/teachers' },
    { title: 'Total Learners', value: data?.summary?.totalLearners || 0, icon: 'people', color: 'success', link: '/school-admin/learners' },
    { title: 'Active Classes', value: data?.summary?.activeClasses || 0, icon: 'collection', color: 'info', link: '/school-admin/classes' },
    { title: 'Avg. Performance', value: `${data?.summary?.averagePerformance || 0}%`, icon: 'graph-up', color: 'warning', link: '/school-admin/reports' },
  ];

  return (
    <>
      <Row className="g-3 mb-4">
        {stats.map((stat, index) => (
          <Col key={index} xs={12} sm={6} lg={3}>
            <Card className="border-0 shadow-sm h-100">
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
                {stat.link && (
                  <Button as={Link} to={stat.link} variant="link" className="p-0 mt-3 text-decoration-none small">
                    Manage <i className="bi bi-arrow-right ms-1"></i>
                  </Button>
                )}
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      <Row className="g-4">
        {/* Recent Activity */}
        <Col lg={7}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Header className="bg-white border-0 py-3 d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Recent School Activity</h5>
              <Button variant="link" size="sm" onClick={fetchData} className="text-decoration-none">
                <i className="bi bi-arrow-clockwise me-1"></i> Refresh
              </Button>
            </Card.Header>
            <Card.Body className="p-0">
              <div className="table-responsive">
                <Table hover className="align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th className="ps-4">Activity</th>
                      <th>User</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.recentActivity?.length > 0 ? (
                      data.recentActivity.map((activity, index) => (
                        <tr key={index}>
                          <td className="ps-4">
                            <div className="fw-semibold small">{formatActivityType(activity.action_type)}</div>
                            <div className="text-muted extra-small">{activity.action_type}</div>
                          </td>
                          <td>
                            <div className="small">{activity.first_name} {activity.last_name}</div>
                            <Badge bg="light" text="dark" className="extra-small border">
                              {activity.role === 'teacher' ? 'Teacher' : 'Staff'}
                            </Badge>
                          </td>
                          <td className="small text-muted">{formatRelativeTime(activity.created_at)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="3" className="text-center py-5 text-muted">No recent activity</td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>
        </Col>
        
        {/* Recently Created Classes */}
        <Col lg={5}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Header className="bg-white border-0 py-3">
              <h5 className="mb-0">Recently Added Classes</h5>
            </Card.Header>
            <Card.Body className="p-0">
              <div className="list-group list-group-flush">
                {data?.recentClasses?.length > 0 ? (
                  data.recentClasses.map((cls, index) => (
                    <div key={index} className="list-group-item border-0 px-4 py-3">
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <h6 className="mb-1">{cls.class_name}</h6>
                          <div className="text-muted small">
                            Grade {cls.grade_level} • {cls.student_count} Students
                          </div>
                        </div>
                        <div className="text-end text-muted small">
                          {cls.teacher_name || 'Unassigned'}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-5 text-muted">No classes created recently</div>
                )}
              </div>
              <div className="p-3 border-top text-center">
                <Button as={Link} to="/school-admin/classes" variant="link" className="text-decoration-none small">
                  View All Classes <i className="bi bi-arrow-right ms-1"></i>
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  );
};

const TeacherDashboard = () => {
  const classes = [
    { name: 'Grade 1 - A', learners: 30, subject: 'Mathematics' },
    { name: 'Grade 2 - B', learners: 28, subject: 'English' },
    { name: 'Grade R - Lions', learners: 25, subject: 'Life Skills' },
  ];

  const upcomingAssessments = [
    { title: 'Math Quiz', class: 'Grade 1 - A', date: 'Tomorrow' },
    { title: 'English Test', class: 'Grade 2 - B', date: 'In 3 days' },
    { title: 'Project Review', class: 'Grade R - Lions', date: 'Next week' },
  ];

  return (
    <>
      <Row className="g-3 mb-4">
        <Col xs={12} sm={6} lg={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <h6 className="text-muted mb-2">My Classes</h6>
                  <h2 className="fw-bold mb-0">3</h2>
                </div>
                <div className="bg-primary-subtle p-3 rounded">
                  <i className="bi bi-collection fs-4 text-primary"></i>
                </div>
              </div>
              <Button as={Link} to="/teacher/classes" variant="link" className="p-0 mt-2 text-decoration-none">
                View all <i className="bi bi-arrow-right ms-1"></i>
              </Button>
            </Card.Body>
          </Card>
        </Col>
        
        <Col xs={12} sm={6} lg={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <h6 className="text-muted mb-2">Total Learners</h6>
                  <h2 className="fw-bold mb-0">83</h2>
                </div>
                <div className="bg-success-subtle p-3 rounded">
                  <i className="bi bi-people fs-4 text-success"></i>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        
        <Col xs={12} sm={6} lg={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <h6 className="text-muted mb-2">Pending Grading</h6>
                  <h2 className="fw-bold mb-0">12</h2>
                </div>
                <div className="bg-warning-subtle p-3 rounded">
                  <i className="bi bi-clipboard-check fs-4 text-warning"></i>
                </div>
              </div>
              <Button as={Link} to="/teacher/grading" variant="link" className="p-0 mt-2 text-decoration-none">
                Grade now <i className="bi bi-arrow-right ms-1"></i>
              </Button>
            </Card.Body>
          </Card>
        </Col>
        
        <Col xs={12} sm={6} lg={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <h6 className="text-muted mb-2">Worksheets</h6>
                  <h2 className="fw-bold mb-0">8</h2>
                </div>
                <div className="bg-info-subtle p-3 rounded">
                  <i className="bi bi-file-earmark-text fs-4 text-info"></i>
                </div>
              </div>
              <Button as={Link} to="/teacher/worksheets" variant="link" className="p-0 mt-2 text-decoration-none">
                Generate <i className="bi bi-arrow-right ms-1"></i>
              </Button>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-4">
        <Col lg={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <Card.Title className="mb-0">My Classes</Card.Title>
                <Button as={Link} to="/teacher/classes" variant="outline-primary" size="sm">
                  View All
                </Button>
              </div>
              <div className="list-group list-group-flush">
                {classes.map((cls, index) => (
                  <div key={index} className="list-group-item border-0 px-0 py-2">
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <h6 className="mb-1">{cls.name}</h6>
                        <small className="text-muted">
                          {cls.learners} learners • {cls.subject}
                        </small>
                      </div>
                      <Button as={Link} to={`/teacher/classes/${index}`} variant="outline-primary" size="sm">
                        View
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card.Body>
          </Card>
        </Col>
        
        <Col lg={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <Card.Title className="mb-0">Upcoming Assessments</Card.Title>
                <Button as={Link} to="/teacher/assessments" variant="outline-primary" size="sm">
                  View All
                </Button>
              </div>
              <div className="list-group list-group-flush">
                {upcomingAssessments.map((assessment, index) => (
                  <div key={index} className="list-group-item border-0 px-0 py-2">
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <h6 className="mb-1">{assessment.title}</h6>
                        <small className="text-muted">
                          {assessment.class} • Due: {assessment.date}
                        </small>
                      </div>
                      <Button variant="outline-success" size="sm">
                        Prepare
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  );
};

const LearnerDashboard = () => {
  return (
    <Row className="g-4">
      <Col lg={8}>
        <Card className="border-0 shadow-sm">
          <Card.Body>
            <Card.Title className="mb-3">My Performance</Card.Title>
            <div className="text-center py-5">
              <i className="bi bi-graph-up-arrow fs-1 text-primary"></i>
              <p className="text-muted mt-2">Your performance overview will be displayed here</p>
            </div>
          </Card.Body>
        </Card>
      </Col>
      
      <Col lg={4}>
        <Card className="border-0 shadow-sm">
          <Card.Body>
            <Card.Title className="mb-3">Recent Grades</Card.Title>
            <div className="list-group list-group-flush">
              {[1, 2, 3].map((item) => (
                <div key={item} className="list-group-item border-0 px-0 py-2">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <h6 className="mb-1">Mathematics Test</h6>
                      <small className="text-muted">Grade: 85% (A)</small>
                    </div>
                    <span className="badge bg-success">Excellent</span>
                  </div>
                </div>
              ))}
            </div>
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
};

const DefaultDashboard = () => {
  return (
    <Card className="border-0 shadow-sm">
      <Card.Body className="text-center py-5">
        <i className="bi bi-speedometer2 fs-1 text-muted mb-3"></i>
        <h4>Welcome to Edulens LMS</h4>
        <p className="text-muted">Your dashboard content will appear here based on your role.</p>
      </Card.Body>
    </Card>
  );
};

export default Dashboard;