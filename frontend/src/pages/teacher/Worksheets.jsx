import React, { useState, useEffect } from 'react';
import {
  Card, Button, Nav, Tab, Row, Col, Badge, Modal, Form, Spinner, Alert, Table
} from 'react-bootstrap';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import Layout from '../../components/common/Layout';

const Worksheets = () => {
  const [activeTab, setActiveTab] = useState('generate');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [savedLoading, setSavedLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  // Data for form
  const [curricula, setCurricula] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [allTopics, setAllTopics] = useState({});

  // Lists
  const [savedWorksheets, setSavedWorksheets] = useState([]);
  const [worksheetHistory, setWorksheetHistory] = useState([]);
  const [selectedWorksheet, setSelectedWorksheet] = useState(null);

  const [worksheetData, setWorksheetData] = useState({
    curriculum_id: '',
    subject_id: '',
    topic_id: '',
    grade_level: '',
    difficulty: 'medium',
    number_of_questions: 10,
    worksheet_type: 'practice worksheet',
    learning_objectives: '',
    specific_instructions: ''
  });

  useEffect(() => {
    fetchInitialData();
    fetchHistory();
    fetchSaved();
  }, []);

  const fetchInitialData = async () => {
    try {
      setDataLoading(true);
      const response = await axios.get('/api/teacher/assessment-data');
      if (response.data.status === 'success') {
        setCurricula(response.data.data.curricula || []);
        setAllTopics(response.data.data.topics_by_subject || {});
      }
    } catch (error) {
      console.error('Error fetching initial data:', error);
      toast.error('Failed to load curriculum data');
    } finally {
      setDataLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);
      const response = await axios.get('/api/teacher/worksheets/history');
      if (response.data.status === 'success') {
        setWorksheetHistory(response.data.data.worksheets || []);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchSaved = async () => {
    try {
      setSavedLoading(true);
      const response = await axios.get('/api/teacher/worksheets/saved');
      if (response.data.status === 'success') {
        setSavedWorksheets(response.data.data.worksheets || []);
      }
    } catch (error) {
      console.error('Error fetching saved worksheets:', error);
    } finally {
      setSavedLoading(false);
    }
  };

  const handleCurriculumChange = (curriculumId) => {
    const selectedCurriculum = curricula.find(c => c.curriculum_id === curriculumId);
    setSubjects(selectedCurriculum ? selectedCurriculum.subjects : []);
    setWorksheetData({
      ...worksheetData,
      curriculum_id: curriculumId,
      subject_id: '',
      topic_id: ''
    });
    setTopics([]);
  };

  const handleSubjectChange = (subjectId) => {
    setTopics(allTopics[subjectId] || []);
    setWorksheetData({
      ...worksheetData,
      subject_id: subjectId,
      topic_id: ''
    });
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post('/api/teacher/worksheets/generate', worksheetData);
      if (response.data.status === 'success') {
        toast.success('Worksheet generation started!');
        setShowGenerateModal(false);
        setActiveTab('history');
        fetchHistory();
      }
    } catch (error) {
      console.error('Error generating worksheet:', error);
      toast.error(error.response?.data?.message || 'Failed to generate worksheet');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (requestId) => {
    try {
      setPreviewLoading(true);
      setSelectedWorksheet(null);
      setShowPreviewModal(true);
      const response = await axios.get(`/api/teacher/worksheets/history/${requestId}`);
      if (response.data.status === 'success') {
        const worksheet = response.data.data.worksheet;
        // Parse generated content if it's a string
        if (typeof worksheet.generated_content === 'string') {
          worksheet.parsed_content = JSON.parse(worksheet.generated_content);
        } else {
          worksheet.parsed_content = worksheet.generated_content;
        }
        setSelectedWorksheet(worksheet);
      }
    } catch (error) {
      console.error('Error fetching worksheet details:', error);
      toast.error('Failed to load worksheet details');
      setShowPreviewModal(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSaveToLibrary = async () => {
    if (!selectedWorksheet) return;
    
    try {
      setSaveLoading(true);
      const saveData = {
        request_id: selectedWorksheet.request_id,
        worksheet_title: selectedWorksheet.parsed_content?.title || `${selectedWorksheet.topic_name} Worksheet`,
        curriculum_name: selectedWorksheet.curriculum_name,
        subject_name: selectedWorksheet.subject_name,
        topic_name: selectedWorksheet.topic_name,
        grade_level: selectedWorksheet.grade_level,
        difficulty: selectedWorksheet.difficulty,
        content_html: selectedWorksheet.parsed_content?.html_content || selectedWorksheet.generated_content
      };

      const response = await axios.post('/api/teacher/worksheets/save', saveData);
      if (response.data.status === 'success') {
        toast.success('Worksheet saved to library!');
        fetchSaved();
        setShowPreviewModal(false);
      }
    } catch (error) {
      console.error('Error saving worksheet:', error);
      toast.error(error.response?.data?.message || 'Failed to save worksheet');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDownload = () => {
    toast.success('Download starting...');
    // In a real app, this would trigger a PDF generation/download
  };

  return (
    <Layout>
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
                            disabled={dataLoading}
                          >
                            {dataLoading ? (
                              <Spinner size="sm" animation="border" className="me-2" />
                            ) : (
                              <i className="bi bi-magic me-2"></i>
                            )}
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
                {savedLoading ? (
                  <div className="text-center py-5">
                    <Spinner animation="border" variant="primary" />
                  </div>
                ) : savedWorksheets.length === 0 ? (
                  <Alert variant="info" className="text-center py-5">
                    <i className="bi bi-info-circle display-4 mb-3"></i>
                    <p>No saved worksheets found. Generate one to get started!</p>
                  </Alert>
                ) : (
                  <div className="table-responsive">
                    <Table hover>
                      <thead>
                        <tr>
                          <th>Worksheet Title</th>
                          <th>Subject</th>
                          <th>Grade</th>
                          <th>Date Saved</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {savedWorksheets.map((worksheet) => (
                          <tr key={worksheet.worksheet_id}>
                            <td>
                              <div className="d-flex align-items-center">
                                <i className="bi bi-file-earmark-text-fill text-primary me-3 fs-4"></i>
                                <div>
                                  <strong>{worksheet.worksheet_title}</strong>
                                  <div className="text-muted small">{worksheet.curriculum_name}</div>
                                </div>
                              </div>
                            </td>
                            <td>{worksheet.subject_name}</td>
                            <td>
                              <Badge bg="info">{worksheet.grade_level}</Badge>
                            </td>
                            <td>{new Date(worksheet.created_at).toLocaleDateString()}</td>
                            <td>
                              <div className="d-flex gap-2">
                                <Button 
                                  size="sm" 
                                  variant="outline-primary"
                                  onClick={() => handleDownload(worksheet.worksheet_id)}
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
                    </Table>
                  </div>
                )}
              </Tab.Pane>

              <Tab.Pane eventKey="history">
                {historyLoading ? (
                  <div className="text-center py-5">
                    <Spinner animation="border" variant="primary" />
                  </div>
                ) : worksheetHistory.length === 0 ? (
                  <Alert variant="info" className="text-center py-5">
                    <i className="bi bi-clock-history display-4 mb-3"></i>
                    <p>No generation history found.</p>
                  </Alert>
                ) : (
                  <div className="table-responsive">
                    <Table hover>
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
                          <tr key={item.request_id}>
                            <td>
                              <div className="d-flex align-items-center">
                                <i className={`bi bi-file-earmark-text me-3 fs-4 ${
                                  item.status === 'completed' ? 'text-success' : 
                                  item.status === 'failed' ? 'text-danger' : 'text-warning'
                                }`}></i>
                                <div>
                                  <strong>{item.topic_name || 'Generating...'}</strong>
                                  <div className="text-muted small">Grade {item.grade_level} • {item.subject_name}</div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <Badge bg={
                                item.status === 'completed' ? 'success' : 
                                item.status === 'failed' ? 'danger' : 'warning'
                              }>
                                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                              </Badge>
                            </td>
                            <td>{new Date(item.created_at).toLocaleString()}</td>
                            <td>
                              {item.status === 'completed' ? (
                                <Button size="sm" variant="outline-primary" onClick={() => handleViewDetails(item.request_id)}>
                                  View Details
                                </Button>
                              ) : item.status === 'failed' ? (
                                <Button size="sm" variant="outline-warning" onClick={() => setShowGenerateModal(true)}>
                                  Retry
                                </Button>
                              ) : (
                                <Spinner size="sm" animation="border" />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                )}
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
                    value={worksheetData.curriculum_id}
                    onChange={(e) => handleCurriculumChange(e.target.value)}
                    required
                  >
                    <option value="">Select curriculum</option>
                    {curricula.map(c => (
                      <option key={c.curriculum_id} value={c.curriculum_id}>{c.curriculum_name}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Subject</Form.Label>
                  <Form.Select
                    value={worksheetData.subject_id}
                    onChange={(e) => handleSubjectChange(e.target.value)}
                    required
                    disabled={!worksheetData.curriculum_id}
                  >
                    <option value="">Select subject</option>
                    {subjects.map(s => (
                      <option key={s.subject_id} value={s.subject_id}>{s.subject_name} (Grade {s.subject_grade_level})</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Topic</Form.Label>
                  <Form.Select
                    value={worksheetData.topic_id}
                    onChange={(e) => setWorksheetData({...worksheetData, topic_id: e.target.value})}
                    required
                    disabled={!worksheetData.subject_id}
                  >
                    <option value="">Select topic</option>
                    {topics.map(t => (
                      <option key={t.topic_id} value={t.topic_id}>{t.topic_name}</option>
                    ))}
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
                    <option value="">Select grade</option>
                    <option value="R">Grade R</option>
                    <option value="1">Grade 1</option>
                    <option value="2">Grade 2</option>
                    <option value="3">Grade 3</option>
                  </Form.Select>
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group>
                  <Form.Label>Difficulty</Form.Label>
                  <Form.Select
                    value={worksheetData.difficulty}
                    onChange={(e) => setWorksheetData({...worksheetData, difficulty: e.target.value})}
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
                    onChange={(e) => setWorksheetData({...worksheetData, number_of_questions: parseInt(e.target.value)})}
                  />
                </Form.Group>
              </Col>

              <Col md={12}>
                <Form.Group>
                  <Form.Label>Specific Instructions (Optional)</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    placeholder="e.g. Focus on addition up to 20, include word problems..."
                    value={worksheetData.specific_instructions}
                    onChange={(e) => setWorksheetData({...worksheetData, specific_instructions: e.target.value})}
                  />
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowGenerateModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Spinner size="sm" animation="border" className="me-2" />
                  Generating...
                </>
              ) : (
                'Generate Worksheet'
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Worksheet Preview Modal */}
      <Modal show={showPreviewModal} onHide={() => setShowPreviewModal(false)} size="xl">
        <Modal.Header closeButton>
          <Modal.Title>
            {previewLoading ? 'Loading Worksheet...' : selectedWorksheet?.parsed_content?.title || 'Worksheet Preview'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="bg-light">
          {previewLoading ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="primary" />
              <p className="mt-2">Fetching worksheet content...</p>
            </div>
          ) : selectedWorksheet ? (
            <div className="worksheet-preview p-4 bg-white shadow-sm mx-auto" style={{ maxWidth: '800px', minHeight: '600px' }}>
              <div dangerouslySetInnerHTML={{ __html: selectedWorksheet.parsed_content?.html_content || selectedWorksheet.generated_content }} />
            </div>
          ) : (
            <Alert variant="danger">Failed to load worksheet content.</Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowPreviewModal(false)}>
            Close
          </Button>
          <Button variant="outline-primary" onClick={() => window.print()}>
            <i className="bi bi-printer me-2"></i>
            Print
          </Button>
          <Button 
            variant="success" 
            onClick={handleSaveToLibrary}
            disabled={saveLoading || !selectedWorksheet}
          >
            {saveLoading ? (
              <Spinner size="sm" animation="border" className="me-2" />
            ) : (
              <i className="bi bi-save me-2"></i>
            )}
            Save to Library
          </Button>
        </Modal.Footer>
      </Modal>
    </Layout>
  );
};

export default Worksheets;