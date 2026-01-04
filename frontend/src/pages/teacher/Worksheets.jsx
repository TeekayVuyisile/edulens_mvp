import React, { useState } from 'react';
import { Card, Button, Form, Row, Col, Tab, Nav, Badge, Modal, InputGroup } from 'react-bootstrap';
import { toast } from 'react-hot-toast';

const Worksheets = () => {
  const [activeTab, setActiveTab] = useState('generate');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [worksheetData, setWorksheetData] = useState({
    subject: '',
    curriculum: '',
    topic: '',
    grade_level: '1',
    difficulty: 'medium',
    number_of_questions: 10,
    worksheet_type: 'practice',
  });

  const savedWorksheets = [
    { id: 1, title: 'Math Addition Practice', subject: 'Mathematics', grade: 'Grade 1', date: '2024-01-15', downloads: 24 },
    { id: 2, title: 'Phonics Worksheet', subject: 'English', grade: 'Grade R', date: '2024-01-10', downloads: 18 },
    { id: 3, title: 'Life Skills - Hygiene', subject: 'Life Skills', grade: 'Grade 2', date: '2024-01-05', downloads: 32 },
  ];

  const worksheetHistory = [
    { id: 1, title: 'Math Subtraction', status: 'completed', date: '2024-01-16' },
    { id: 2, title: 'Vocabulary Builder', status: 'failed', date: '2024-01-14' },
    { id: 3, title: 'Science Basics', status: 'completed', date: '2024-01-12' },
  ];

  const handleGenerate = async (e) => {
    e.preventDefault();
    setGenerating(true);
    
    // Simulate API call
    setTimeout(() => {
      setGenerating(false);
      setShowGenerateModal(false);
      toast.success('Worksheet generated successfully!');
      setActiveTab('saved');
    }, 2000);
  };

  const handleDownload = (worksheetId) => {
    toast.success('Worksheet downloaded');
    // Implement download logic
  };

  return (
    <div>
      <div className="mb-4">
        <h1 className="h3 mb-2">Worksheets</h1>
        <p className="text-muted">Generate and manage practice worksheets for your learners</p>
      </div>

      <Tab.Container activeKey={activeTab} onSelect={setActiveTab}>
        <Card className="border-0 shadow-sm">
          <Card.Header className="bg-white border-0">
            <Nav variant="tabs" className="border-bottom-0">
              <Nav.Item>
                <Nav.Link eventKey="generate">
                  <i className="bi bi-magic me-2"></i>
                  Generate New
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="saved">
                  <i className="bi bi-folder me-2"></i>
                  Saved Worksheets
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="history">
                  <i className="bi bi-clock-history me-2"></i>
                  Generation History
                </Nav.Link>
              </Nav.Item>
            </Nav>
          </Card.Header>

          <Card.Body className="p-4">
            <Tab.Content>
              <Tab.Pane eventKey="generate">
                <Row className="g-4">
                  <Col lg={8}>
                    <Card className="border h-100">
                      <Card.Body className="p-4">
                        <div className="text-center py-5">
                          <i className="bi bi-file-earmark-text display-1 text-muted mb-3"></i>
                          <h4>Generate Custom Worksheets</h4>
                          <p className="text-muted mb-4">
                            Create personalized worksheets using AI for your specific needs
                          </p>
                          <Button 
                            variant="primary" 
                            size="lg"
                            onClick={() => setShowGenerateModal(true)}
                          >
                            <i className="bi bi-magic me-2"></i>
                            Generate New Worksheet
                          </Button>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                  
                  <Col lg={4}>
                    <Card className="border h-100">
                      <Card.Body>
                        <h5 className="mb-3">Quick Tips</h5>
                        <ul className="list-unstyled">
                          <li className="mb-3">
                            <i className="bi bi-lightbulb text-warning me-2"></i>
                            <strong>Be specific</strong> with learning objectives
                          </li>
                          <li className="mb-3">
                            <i className="bi bi-lightbulb text-warning me-2"></i>
                            <strong>Select appropriate</strong> difficulty level
                          </li>
                          <li className="mb-3">
                            <i className="bi bi-lightbulb text-warning me-2"></i>
                            <strong>Include examples</strong> for complex topics
                          </li>
                          <li>
                            <i className="bi bi-lightbulb text-warning me-2"></i>
                            <strong>Save successful</strong> worksheets for reuse
                          </li>
                        </ul>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              </Tab.Pane>

              <Tab.Pane eventKey="saved">
                <div className="table-responsive">
                  <table className="table table-hover">
                    <thead>
                      <tr>
                        <th>Worksheet Title</th>
                        <th>Subject</th>
                        <th>Grade</th>
                        <th>Last Modified</th>
                        <th>Downloads</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {savedWorksheets.map((worksheet) => (
                        <tr key={worksheet.id}>
                          <td>
                            <div className="d-flex align-items-center">
                              <i className="bi bi-file-earmark-text-fill text-primary me-3 fs-4"></i>
                              <div>
                                <strong>{worksheet.title}</strong>
                                <div className="text-muted small">CAPS Curriculum</div>
                              </div>
                            </div>
                          </td>
                          <td>{worksheet.subject}</td>
                          <td>
                            <Badge bg="info">{worksheet.grade}</Badge>
                          </td>
                          <td>{worksheet.date}</td>
                          <td>{worksheet.downloads}</td>
                          <td>
                            <div className="d-flex gap-2">
                              <Button 
                                size="sm" 
                                variant="outline-primary"
                                onClick={() => handleDownload(worksheet.id)}
                              >
                                <i className="bi bi-download"></i>
                              </Button>
                              <Button size="sm" variant="outline-success">
                                <i className="bi bi-share"></i>
                              </Button>
                              <Button size="sm" variant="outline-danger">
                                <i className="bi bi-trash"></i>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Tab.Pane>

              <Tab.Pane eventKey="history">
                <div className="table-responsive">
                  <table className="table table-hover">
                    <thead>
                      <tr>
                        <th>Worksheet</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {worksheetHistory.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <div className="d-flex align-items-center">
                              <i className={`bi bi-file-earmark-text me-3 fs-4 ${
                                item.status === 'completed' ? 'text-success' : 'text-danger'
                              }`}></i>
                              <div>
                                <strong>{item.title}</strong>
                                <div className="text-muted small">Grade 1 • Mathematics</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <Badge bg={item.status === 'completed' ? 'success' : 'danger'}>
                              {item.status === 'completed' ? 'Success' : 'Failed'}
                            </Badge>
                          </td>
                          <td>{item.date}</td>
                          <td>
                            {item.status === 'completed' ? (
                              <Button size="sm" variant="outline-primary">
                                View Details
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline-warning">
                                Retry
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Tab.Pane>
            </Tab.Content>
          </Card.Body>
        </Card>
      </Tab.Container>

      {/* Generate Worksheet Modal */}
      <Modal show={showGenerateModal} onHide={() => setShowGenerateModal(false)} size="lg">
        <Form onSubmit={handleGenerate}>
          <Modal.Header closeButton>
            <Modal.Title>Generate Worksheet</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Row className="g-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Curriculum</Form.Label>
                  <Form.Select
                    value={worksheetData.curriculum}
                    onChange={(e) => setWorksheetData({...worksheetData, curriculum: e.target.value})}
                    required
                  >
                    <option value="">Select curriculum</option>
                    <option value="CAPS">CAPS</option>
                    <option value="Cambridge">Cambridge</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Subject</Form.Label>
                  <Form.Select
                    value={worksheetData.subject}
                    onChange={(e) => setWorksheetData({...worksheetData, subject: e.target.value})}
                    required
                  >
                    <option value="">Select subject</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="English">English</option>
                    <option value="Life Skills">Life Skills</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Topic</Form.Label>
                  <Form.Select
                    value={worksheetData.topic}
                    onChange={(e) => setWorksheetData({...worksheetData, topic: e.target.value})}
                    required
                  >
                    <option value="">Select topic</option>
                    <option value="Addition">Addition</option>
                    <option value="Subtraction">Subtraction</option>
                    <option value="Phonics">Phonics</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Grade Level</Form.Label>
                  <Form.Select
                    value={worksheetData.grade_level}
                    onChange={(e) => setWorksheetData({...worksheetData, grade_level: e.target.value})}
                    required
                  >
                    <option value="R">Grade R</option>
                    <option value="1">Grade 1</option>
                    <option value="2">Grade 2</option>
                    <option value="3">Grade 3</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Difficulty Level</Form.Label>
                  <Form.Select
                    value={worksheetData.difficulty}
                    onChange={(e) => setWorksheetData({...worksheetData, difficulty: e.target.value})}
                    required
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                    <option value="mixed">Mixed</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Number of Questions</Form.Label>
                  <Form.Control
                    type="number"
                    min="1"
                    max="50"
                    value={worksheetData.number_of_questions}
                    onChange={(e) => setWorksheetData({...worksheetData, number_of_questions: e.target.value})}
                    required
                  />
                </Form.Group>
              </Col>
              
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Worksheet Type</Form.Label>
                  <Form.Select
                    value={worksheetData.worksheet_type}
                    onChange={(e) => setWorksheetData({...worksheetData, worksheet_type: e.target.value})}
                  >
                    <option value="practice">Practice Worksheet</option>
                    <option value="test">Test</option>
                    <option value="homework">Homework</option>
                    <option value="revision">Revision</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              
              <Col md={12}>
                <Form.Group>
                  <Form.Label>Specific Instructions (Optional)</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    placeholder="E.g., Include word problems, focus on multiplication tables 1-5, add colorful illustrations..."
                  />
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowGenerateModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={generating}>
              {generating ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                  Generating...
                </>
              ) : (
                'Generate Worksheet'
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default Worksheets;