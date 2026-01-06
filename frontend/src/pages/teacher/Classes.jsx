import React, { useState, useEffect } from "react";
import {
  Card,
  Button,
  Row,
  Col,
  Badge,
  ProgressBar,
  Table,
  Form,
  InputGroup,
} from "react-bootstrap";
import { Link } from "react-router-dom";
import { toast } from "react-hot-toast";
import axios from "axios";

const TeacherClasses = () => {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      const response = await axios.get("/api/teacher/dashboard");
      setClasses(response.data.data.classes || []);
    } catch (error) {
      toast.error("Failed to fetch classes");
    } finally {
      setLoading(false);
    }
  };

  const filteredClasses = classes.filter(
    (cls) =>
      cls.class_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cls.grade_level.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="mb-4">
        <h1 className="h3 mb-2">My Classes</h1>
        <p className="text-muted">
          View and manage all classes assigned to you
        </p>
      </div>

      <Card className="border-0 shadow-sm mb-4">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div className="w-100 me-3">
              <InputGroup>
                <InputGroup.Text>
                  <i className="bi bi-search"></i>
                </InputGroup.Text>
                <Form.Control
                  placeholder="Search classes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </InputGroup>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : filteredClasses.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-collection display-1 text-muted mb-3"></i>
              <h4>No Classes Assigned</h4>
              <p className="text-muted">
                You haven't been assigned to any classes yet.
              </p>
            </div>
          ) : (
            <Row className="g-4">
              {filteredClasses.map((cls) => (
                <Col key={cls.class_id} xs={12} md={6} lg={4}>
                  <Card className="border h-100">
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-start mb-3">
                        <div>
                          <Badge bg="primary" className="mb-2">
                            Grade {cls.grade_level}
                          </Badge>
                          <h5 className="mb-1">{cls.class_name}</h5>
                          <p className="text-muted small mb-0">
                            Academic Year: {cls.academic_year}
                          </p>
                        </div>
                        <div className="bg-primary-subtle p-2 rounded">
                          <i className="bi bi-people-fill text-primary fs-4"></i>
                        </div>
                      </div>

                      <div className="mb-3">
                        <div className="d-flex justify-content-between small text-muted mb-1">
                          <span>Learners</span>
                          <span>
                            {cls.learner_count || 0}/{cls.max_capacity || 30}
                          </span>
                        </div>
                        <ProgressBar
                          now={
                            ((cls.learner_count || 0) /
                              (cls.max_capacity || 30)) *
                            100
                          }
                          style={{ height: "6px" }}
                        />
                      </div>

                      {cls.stats && (
                        <div className="mb-3">
                          <div className="row text-center">
                            <div className="col-4">
                              <div className="fw-bold">
                                {cls.stats.totalAssessments || 0}
                              </div>
                              <div className="text-muted small">
                                Assessments
                              </div>
                            </div>
                            <div className="col-4">
                              <div className="fw-bold">
                                {cls.stats.averageScore || 0}%
                              </div>
                              <div className="text-muted small">Avg Score</div>
                            </div>
                            <div className="col-4">
                              <div className="fw-bold">
                                {cls.stats.totalLearners || 0}
                              </div>
                              <div className="text-muted small">Learners</div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="d-grid gap-2">
                        <Button
                          as={Link}
                          to={`/teacher/classes/${cls.class_id}`}
                          variant="outline-primary"
                        >
                          <i className="bi bi-eye me-2"></i>
                          View Class Details
                        </Button>
                        <Button
                          as={Link}
                          to={`/teacher/assessments?class=${cls.class_id}`}
                          variant="outline-success"
                        >
                          <i className="bi bi-clipboard me-2"></i>
                          Manage Assessments
                        </Button>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </Card.Body>
      </Card>

      {/* Class Details Section */}
      {filteredClasses.length > 0 && (
        <Card className="border-0 shadow-sm">
          <Card.Body>
            <h5 className="mb-3">Recent Class Activity</h5>
            <div className="table-responsive">
              <Table hover>
                <thead>
                  <tr>
                    <th>Class</th>
                    <th>Recent Assessment</th>
                    <th>Avg Score</th>
                    <th>Due Assignments</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClasses.slice(0, 3).map((cls) => (
                    <tr key={cls.class_id}>
                      <td>
                        <strong>{cls.class_name}</strong>
                        <div className="text-muted small">
                          Grade {cls.grade_level}
                        </div>
                      </td>
                      <td>
                        {cls.stats?.recentAssessments?.[0]?.assessment_name ||
                          "No assessments"}
                        <div className="text-muted small">
                          {cls.stats?.recentAssessments?.[0]?.scheduled_date ||
                            ""}
                        </div>
                      </td>
                      <td>
                        <Badge
                          bg={
                            cls.stats?.averageScore > 70 ? "success" : "warning"
                          }
                        >
                          {cls.stats?.averageScore || 0}%
                        </Badge>
                      </td>
                      <td>
                        <Badge bg="danger">3</Badge>
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
      )}
    </div>
  );
};

export default TeacherClasses;
