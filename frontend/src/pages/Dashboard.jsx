import { Row, Col, Card, Button } from 'react-bootstrap';
import { useAuth } from '../contexts/useAuth';
import SuperAdminDashboard from './dashboards/SuperAdminDashboard';
import SchoolAdminDashboard from './dashboards/SchoolAdminDashboard';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const { user } = useAuth();

  // Redesigned dashboards render their own header.
  if (user?.role === 'super_admin') return <SuperAdminDashboard />;
  if (user?.role === 'school_admin') return <SchoolAdminDashboard />;

  return (
    <div>
      <div className="mb-4">
        <h1 className="h3 mb-2">Dashboard</h1>
        <p className="text-muted">
          Welcome back, <span className="fw-semibold">{user.first_name} {user.last_name}</span>
        </p>
      </div>
      {user.role === 'teacher' && <TeacherDashboard />}
      {user.role !== 'teacher' && <DefaultDashboard />}
    </div>
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