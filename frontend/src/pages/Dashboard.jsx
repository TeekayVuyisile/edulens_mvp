import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Button } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
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
  const [stats, setStats] = useState({
    totalSchools: 0,
    totalAdmins: 0,
    totalTeachers: 0,
    totalLearners: 0,
    activeSessions: 0,
    recentActivity: []
  });
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
      // First try the dedicated statistics endpoint
      const response = await axios.get('/api/super-admin/statistics');
      setStats(response.data.data);
    } catch (error) {
      console.error('Failed to fetch stats from /statistics:', error);
      
      // Fallback: Fetch data from other endpoints
      try {
        const [schoolsRes, usersRes] = await Promise.all([
          axios.get('/api/super-admin/schools'),
          axios.get('/api/super-admin/users')
        ]);
        
        const schools = schoolsRes.data.data?.schools || [];
        const users = usersRes.data.data?.users || [];
        
        setStats({
          totalSchools: schools.length,
          totalAdmins: users.filter(u => u.role === 'school_admin').length,
          totalTeachers: users.filter(u => u.role === 'teacher').length,
          totalLearners: users.filter(u => u.role === 'learner').length,
          activeSessions: 0,
          recentActivity: []
        });
      } catch (fallbackError) {
        console.error('Failed to fetch fallback stats:', fallbackError);
      }
    } finally {
      setLoading(false);
    }
  };

  // Define the stats array for mapping
  const superAdminStats = [
    { 
      title: 'Total Schools', 
      value: stats.totalSchools || 0, 
      icon: 'building', 
      color: 'primary', 
      link: '/super-admin/schools' 
    },
    { 
      title: 'School Admins', 
      value: stats.totalAdmins || 0, 
      icon: 'person-badge', 
      color: 'info', 
      link: '/super-admin/users' 
    },
    { 
      title: 'Total Teachers', 
      value: stats.totalTeachers || 0, 
      icon: 'person-check', 
      color: 'success', 
      link: '/super-admin/users' 
    },
    { 
      title: 'Active Sessions', 
      value: stats.activeSessions || 0, 
      icon: 'people', 
      color: 'warning' 
    },
  ];

  return (
    <>
      <Row className="g-3 mb-4">
        {loading ? (
          // Loading skeleton
          superAdminStats.map((_, index) => (
            <Col key={index} xs={12} sm={6} lg={3}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <div className="placeholder-glow">
                        <div className="placeholder col-4 mb-2"></div>
                        <h2 className="placeholder-glow">
                          <span className="placeholder col-6"></span>
                        </h2>
                      </div>
                    </div>
                    <div className="bg-light p-3 rounded">
                      <div className="placeholder" style={{width: '24px', height: '24px'}}></div>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          ))
        ) : (
          // Actual stats
          superAdminStats.map((stat, index) => (
            <Col key={index} xs={12} sm={6} lg={3}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <h6 className="text-muted mb-2">{stat.title}</h6>
                      <h2 className="fw-bold mb-0">{stat.value}</h2>
                    </div>
                    <div className={`bg-${stat.color}-subtle p-3 rounded`}>
                      <i className={`bi bi-${stat.icon} fs-4 text-${stat.color}`}></i>
                    </div>
                  </div>
                  {stat.link && (
                    <Button 
                      as={Link} 
                      to={stat.link} 
                      variant="link" 
                      className="p-0 mt-2 text-decoration-none"
                    >
                      View details <i className="bi bi-arrow-right ms-1"></i>
                    </Button>
                  )}
                </Card.Body>
              </Card>
            </Col>
          ))
        )}
      </Row>

      <Row className="g-4">
        <Col lg={8}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <Card.Title className="mb-0">Recent Activity</Card.Title>
                <Button 
                  variant="outline-secondary" 
                  size="sm"
                  onClick={fetchStats}
                  disabled={loading}
                >
                  <i className="bi bi-arrow-clockwise me-1"></i>
                  Refresh
                </Button>
              </div>
              
              {loading ? (
                <div className="py-3">
                  {[1, 2, 3, 4, 5].map((item) => (
                    <div key={item} className="d-flex align-items-center mb-3">
                      <div className="placeholder-glow">
                        <span className="placeholder rounded-circle" style={{width: '40px', height: '40px'}}></span>
                      </div>
                      <div className="ms-3 flex-grow-1">
                        <div className="placeholder-glow">
                          <span className="placeholder col-6"></span>
                          <span className="placeholder col-4 d-block mt-1"></span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="list-group list-group-flush">
                  {stats.recentActivity && stats.recentActivity.length > 0 ? (
                    stats.recentActivity.map((activity, index) => (
                      <div key={index} className="list-group-item border-0 px-0 py-2">
                        <div className="d-flex align-items-center">
                          <div className="flex-shrink-0">
                            <div className="bg-light rounded-circle p-2">
                              <i className={`bi bi-${getActivityIcon(activity.action_type)} text-primary`}></i>
                            </div>
                          </div>
                          <div className="flex-grow-1 ms-3">
                            <h6 className="mb-0">{formatActivity(activity.action_type)}</h6>
                            <small className="text-muted">{activity.email}</small>
                          </div>
                          <small className="text-muted">
                            {new Date(activity.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </small>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4">
                      <i className="bi bi-activity fs-1 text-muted mb-2"></i>
                      <p className="text-muted">No recent activity</p>
                    </div>
                  )}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
        
        <Col lg={4}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <Card.Title className="mb-3">Quick Actions</Card.Title>
              <div className="d-grid gap-2">
                <Button as={Link} to="/super-admin/schools" variant="primary">
                  <i className="bi bi-building me-2"></i>
                  Manage Schools
                </Button>
                <Button as={Link} to="/super-admin/users" variant="outline-primary">
                  <i className="bi bi-person-plus me-2"></i>
                  Manage Users
                </Button>
                <Button as={Link} to="/super-admin/curricula" variant="outline-secondary">
                  <i className="bi bi-book me-2"></i>
                  Manage Curricula
                </Button>
                <Button 
                  variant="outline-info"
                  onClick={fetchStats}
                  disabled={loading}
                >
                  <i className="bi bi-arrow-clockwise me-2"></i>
                  {loading ? 'Refreshing...' : 'Refresh Data'}
                </Button>
              </div>
              
              {/* System Status */}
              <div className="mt-4 pt-3 border-top">
                <h6 className="mb-3">System Status</h6>
                <div className="d-flex align-items-center mb-2">
                  <i className="bi bi-check-circle-fill text-success me-2"></i>
                  <span>All systems operational</span>
                </div>
                <div className="d-flex align-items-center">
                  <i className="bi bi-database text-primary me-2"></i>
                  <span>{stats.totalSchools} schools active</span>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  );
};

// Helper functions for SuperAdminDashboard
const getActivityIcon = (actionType) => {
  const icons = {
    'login': 'box-arrow-in-right',
    'logout': 'box-arrow-right',
    'create': 'plus-circle',
    'update': 'pencil',
    'delete': 'trash',
    'view': 'eye'
  };
  return icons[actionType] || 'activity';
};

const formatActivity = (actionType) => {
  const actions = {
    'login': 'User logged in',
    'logout': 'User logged out',
    'create': 'New item created',
    'update': 'Item updated',
    'delete': 'Item deleted',
    'view': 'Item viewed'
  };
  return actions[actionType] || 'Activity performed';
};

const SchoolAdminDashboard = () => {
  const stats = [
    { 
      title: 'Total Teachers', 
      value: '24', 
      icon: 'person-badge', 
      color: 'primary', 
      link: '/school-admin/teachers' 
    },
    { 
      title: 'Total Learners', 
      value: '480', 
      icon: 'people', 
      color: 'success', 
      link: '/school-admin/learners' 
    },
    { 
      title: 'Active Classes', 
      value: '16', 
      icon: 'collection', 
      color: 'info', 
      link: '/school-admin/classes' 
    },
    { 
      title: 'Avg. Performance', 
      value: '78%', 
      icon: 'graph-up', 
      color: 'warning' 
    },
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
                    <h6 className="text-muted mb-2">{stat.title}</h6>
                    <h2 className="fw-bold mb-0">{stat.value}</h2>
                  </div>
                  <div className={`bg-${stat.color}-subtle p-3 rounded`}>
                    <i className={`bi bi-${stat.icon} fs-4 text-${stat.color}`}></i>
                  </div>
                </div>
                {stat.link && (
                  <Button as={Link} to={stat.link} variant="link" className="p-0 mt-2 text-decoration-none">
                    View details <i className="bi bi-arrow-right ms-1"></i>
                  </Button>
                )}
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      <Row className="g-4">
        <Col lg={8}>
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <Card.Title className="mb-3">Performance Overview</Card.Title>
              <div className="text-center py-5">
                <i className="bi bi-bar-chart fs-1 text-muted"></i>
                <p className="text-muted mt-2">Performance chart will be displayed here</p>
              </div>
            </Card.Body>
          </Card>
        </Col>
        
        <Col lg={4}>
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <Card.Title className="mb-3">Recent Registrations</Card.Title>
              <div className="list-group list-group-flush">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="list-group-item border-0 px-0 py-2">
                    <div className="d-flex align-items-center">
                      <div className="flex-shrink-0">
                        <div className="bg-light rounded-circle p-2">
                          <i className="bi bi-person-plus text-success"></i>
                        </div>
                      </div>
                      <div className="flex-grow-1 ms-3">
                        <h6 className="mb-0">New teacher joined</h6>
                        <small className="text-muted">Mr. John Smith</small>
                      </div>
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