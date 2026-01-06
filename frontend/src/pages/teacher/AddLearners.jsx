import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Card, Button, Form, Alert, Spinner, Table, 
  Tabs, Tab, Row, Col, Badge, Modal, Accordion
} from 'react-bootstrap';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import * as XLSX from 'xlsx';

const AddLearners = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [classDetails, setClassDetails] = useState(null);
  const [activeTab, setActiveTab] = useState('manual');
  const [learners, setLearners] = useState([]);
  const [importFile, setImportFile] = useState(null);
  const [numberOfLearners, setNumberOfLearners] = useState(1);
  const [showPreview, setShowPreview] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [showTemplate, setShowTemplate] = useState(false);
  const fileInputRef = useRef(null);

  // Single learner form for reference
  const [singleLearnerForm, setSingleLearnerForm] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    gender: '',
    guardian_name: '',
    guardian_email: '',
    guardian_phone: '',
    has_special_needs: false,
    special_needs_notes: '',
    medical_notes: ''
  });

  useEffect(() => {
    fetchClassDetails();
  }, [classId]);

  const fetchClassDetails = async () => {
    try {
      const response = await axios.get(`/api/teacher/classes/${classId}`);
      setClassDetails(response.data.data.class);
    } catch (error) {
      toast.error('Failed to fetch class details');
      navigate(`/teacher/classes/${classId}`);
    }
  };

  // Calculate min and max dates for date of birth
  const calculateMaxDate = () => {
    const today = new Date();
    const minDate = new Date();
    minDate.setFullYear(today.getFullYear() - 4); // Minimum 4 years old
    return minDate.toISOString().split('T')[0];
  };

  const calculateMinDate = () => {
    const today = new Date();
    const maxDate = new Date();
    maxDate.setFullYear(today.getFullYear() - 10); // Maximum 10 years old
    return maxDate.toISOString().split('T')[0];
  };

  const handleSingleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSingleLearnerForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Add single learner manually
  const addSingleLearner = () => {
    if (!singleLearnerForm.first_name || !singleLearnerForm.last_name || !singleLearnerForm.date_of_birth) {
      toast.error('Please fill in at least first name, last name, and date of birth');
      return;
    }

    const newLearner = {
      id: Date.now().toString(),
      ...singleLearnerForm
    };

    setLearners(prev => [...prev, newLearner]);
    
    // Reset form
    setSingleLearnerForm({
      first_name: '',
      last_name: '',
      date_of_birth: '',
      gender: '',
      guardian_name: '',
      guardian_email: '',
      guardian_phone: '',
      has_special_needs: false,
      special_needs_notes: '',
      medical_notes: ''
    });

    toast.success('Learner added to list');
  };

  // Generate multiple empty learner forms with all fields
  const generateMultipleForms = () => {
    if (numberOfLearners < 1 || numberOfLearners > 50) {
      toast.error('Please enter a number between 1 and 50');
      return;
    }

    const newLearners = Array.from({ length: numberOfLearners }, (_, i) => ({
      id: Date.now().toString() + i,
      first_name: '',
      last_name: '',
      date_of_birth: '',
      gender: '',
      guardian_name: '',
      guardian_email: '',
      guardian_phone: '',
      has_special_needs: false,
      special_needs_notes: '',
      medical_notes: '',
      isExpanded: false // For accordion
    }));

    setLearners(prev => [...prev, ...newLearners]);
    setNumberOfLearners(1);
    toast.success(`${newLearners.length} learner forms added`);
  };

  const handleLearnerChange = (index, field, value) => {
    const updatedLearners = [...learners];
    
    if (field === 'has_special_needs') {
      updatedLearners[index][field] = !updatedLearners[index][field];
    } else {
      updatedLearners[index][field] = value;
    }
    
    setLearners(updatedLearners);
  };

  const toggleLearnerAccordion = (index) => {
    const updatedLearners = [...learners];
    updatedLearners[index].isExpanded = !updatedLearners[index].isExpanded;
    setLearners(updatedLearners);
  };

  const removeLearner = (index) => {
    const updatedLearners = [...learners];
    updatedLearners.splice(index, 1);
    setLearners(updatedLearners);
    toast.success('Learner removed from list');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImportFile(file);

    // Parse CSV/Excel file
    const reader = new FileReader();
    reader.onload = (event) => {
      const data = event.target.result;
      const workbook = XLSX.read(data, { type: 'binary' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const parsedData = XLSX.utils.sheet_to_json(worksheet);

      // Map imported data to learner format
      const importedLearners = parsedData.map((row, index) => ({
        id: `import-${Date.now()}-${index}`,
        first_name: row.first_name || row['First Name'] || '',
        last_name: row.last_name || row['Last Name'] || '',
        date_of_birth: row.date_of_birth || row['Date of Birth'] || row['DOB'] || '',
        gender: row.gender || row['Gender'] || '',
        guardian_name: row.guardian_name || row['Guardian Name'] || '',
        guardian_email: row.guardian_email || row['Guardian Email'] || '',
        guardian_phone: row.guardian_phone || row['Guardian Phone'] || row['Phone'] || '',
        has_special_needs: row.has_special_needs || row['Has Special Needs'] === 'true' || false,
        special_needs_notes: row.special_needs_notes || row['Special Needs Notes'] || '',
        medical_notes: row.medical_notes || row['Medical Notes'] || '',
        isExpanded: false
      }));

      setLearners(prev => [...prev, ...importedLearners]);
      toast.success(`Imported ${importedLearners.length} learners from file`);
    };

    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    const template = [
      {
        'first_name': 'John',
        'last_name': 'Doe',
        'date_of_birth': '2018-05-15',
        'gender': 'Male',
        'guardian_name': 'Jane Doe',
        'guardian_email': 'jane.doe@email.com',
        'guardian_phone': '0123456789',
        'has_special_needs': 'false',
        'special_needs_notes': '',
        'medical_notes': ''
      },
      {
        'first_name': 'Sarah',
        'last_name': 'Smith',
        'date_of_birth': '2017-08-22',
        'gender': 'Female',
        'guardian_name': 'John Smith',
        'guardian_email': 'john.smith@email.com',
        'guardian_phone': '0987654321',
        'has_special_needs': 'true',
        'special_needs_notes': 'Needs extra time for reading',
        'medical_notes': 'Allergic to peanuts'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'learners_import_template.xlsx');
    
    toast.success('Template downloaded');
    setShowTemplate(false);
  };

  const validateLearners = () => {
    const errors = [];
    
    learners.forEach((learner, index) => {
      if (!learner.first_name || !learner.last_name) {
        errors.push(`Row ${index + 1}: First name and last name are required`);
      }
      
      if (!learner.date_of_birth) {
        errors.push(`Row ${index + 1}: Date of birth is required`);
      } else {
        const dob = new Date(learner.date_of_birth);
        const today = new Date();
        const age = today.getFullYear() - dob.getFullYear();
        const monthDiff = today.getMonth() - dob.getMonth();
        const adjustedAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate()) ? age - 1 : age;
        
        if (adjustedAge < 4 || adjustedAge > 10) {
          errors.push(`Row ${index + 1}: Learner must be between 4 and 10 years old (Age: ${adjustedAge})`);
        }
      }
    });

    return errors;
  };

  const submitLearners = async () => {
    if (learners.length === 0) {
      toast.error('Please add at least one learner');
      return;
    }

    const errors = validateLearners();
    if (errors.length > 0) {
      toast.error(`Please fix ${errors.length} error(s) before submitting`);
      console.log('Validation errors:', errors);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        learners: learners.map(learner => ({
          first_name: learner.first_name,
          last_name: learner.last_name,
          date_of_birth: learner.date_of_birth,
          gender: learner.gender,
          guardian_name: learner.guardian_name,
          guardian_email: learner.guardian_email,
          guardian_phone: learner.guardian_phone,
          has_special_needs: learner.has_special_needs,
          special_needs_notes: learner.special_needs_notes,
          medical_notes: learner.medical_notes,
          current_class_id: classId
        }))
      };

      const response = await axios.post(`/api/teacher/classes/${classId}/learners/bulk`, payload);
      
      setImportResults(response.data.data);
      setShowPreview(true);
      
      toast.success(`Successfully added ${learners.length} learners to ${classDetails?.class_name}`);
    } catch (error) {
      console.error('Error adding learners:', error);
      toast.error(error.response?.data?.message || 'Failed to add learners');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkImport = async () => {
    if (!importFile) {
      toast.error('Please select a file to import');
      return;
    }

    setImporting(true);
    const formData = new FormData();
    formData.append('file', importFile);
    formData.append('class_id', classId);

    try {
      const response = await axios.post('/api/teacher/learners/bulk-import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setImportResults(response.data.data);
      setShowPreview(true);
      toast.success(`Import completed: ${response.data.data.summary.success} successful`);
    } catch (error) {
      console.error('Import error:', error);
      toast.error(error.response?.data?.message || 'Failed to import learners');
    } finally {
      setImporting(false);
    }
  };

  if (!classDetails) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" />
        <p className="mt-3">Loading class details...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 mb-1">Add Learners to {classDetails.class_name}</h1>
          <p className="text-muted mb-0">
            Grade {classDetails.grade_level} • Academic Year {classDetails.academic_year}
          </p>
          <Badge bg="info" className="mt-2">
            Current Capacity: {classDetails.learner_count || 0}/{classDetails.max_capacity || 30}
          </Badge>
        </div>
        <div className="d-flex gap-2">
          <Button 
            variant="outline-secondary" 
            onClick={() => navigate(`/teacher/classes/${classId}`)}
          >
            <i className="bi bi-arrow-left me-2"></i>
            Back to Class
          </Button>
        </div>
      </div>

      {/* Tabs for different methods */}
      <Card className="border-0 shadow-sm mb-4">
        <Card.Body>
          <Tabs
            activeKey={activeTab}
            onSelect={(k) => setActiveTab(k)}
            className="mb-4"
          >
            <Tab eventKey="manual" title="Manual Entry">
              <div className="mb-4">
                <h5>Add Single Learner</h5>
                <Row className="g-3">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>First Name *</Form.Label>
                      <Form.Control
                        type="text"
                        name="first_name"
                        value={singleLearnerForm.first_name}
                        onChange={handleSingleFormChange}
                        placeholder="Enter first name"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Last Name *</Form.Label>
                      <Form.Control
                        type="text"
                        name="last_name"
                        value={singleLearnerForm.last_name}
                        onChange={handleSingleFormChange}
                        placeholder="Enter last name"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Date of Birth *</Form.Label>
                      <Form.Control
                        type="date"
                        name="date_of_birth"
                        value={singleLearnerForm.date_of_birth}
                        onChange={handleSingleFormChange}
                        max={calculateMaxDate()}
                        min={calculateMinDate()}
                      />
                      <Form.Text className="text-muted">
                        Must be between 4 and 10 years old
                      </Form.Text>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Gender</Form.Label>
                      <Form.Select
                        name="gender"
                        value={singleLearnerForm.gender}
                        onChange={handleSingleFormChange}
                      >
                        <option value="">Select gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                        <option value="Prefer not to say">Prefer not to say</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  
                  <Col md={12}>
                    <hr />
                    <h6 className="mb-3">Guardian Information</h6>
                  </Col>
                  
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Guardian Name</Form.Label>
                      <Form.Control
                        type="text"
                        name="guardian_name"
                        value={singleLearnerForm.guardian_name}
                        onChange={handleSingleFormChange}
                        placeholder="Guardian's full name"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Guardian Email</Form.Label>
                      <Form.Control
                        type="email"
                        name="guardian_email"
                        value={singleLearnerForm.guardian_email}
                        onChange={handleSingleFormChange}
                        placeholder="email@example.com"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Guardian Phone</Form.Label>
                      <Form.Control
                        type="tel"
                        name="guardian_phone"
                        value={singleLearnerForm.guardian_phone}
                        onChange={handleSingleFormChange}
                        placeholder="0123456789"
                      />
                    </Form.Group>
                  </Col>

                  <Col md={12}>
                    <hr />
                    <h6 className="mb-3">Additional Information</h6>
                  </Col>

                  <Col md={12}>
                    <Form.Check
                      type="switch"
                      id="has_special_needs"
                      name="has_special_needs"
                      label="Has Special Educational Needs"
                      checked={singleLearnerForm.has_special_needs}
                      onChange={handleSingleFormChange}
                      className="mb-3"
                    />
                  </Col>

                  {singleLearnerForm.has_special_needs && (
                    <Col md={12}>
                      <Form.Group>
                        <Form.Label>Special Needs Notes</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={3}
                          name="special_needs_notes"
                          value={singleLearnerForm.special_needs_notes}
                          onChange={handleSingleFormChange}
                          placeholder="Describe any special educational needs, accommodations, or support required..."
                        />
                      </Form.Group>
                    </Col>
                  )}

                  <Col md={12}>
                    <Form.Group>
                      <Form.Label>Medical Notes</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={3}
                        name="medical_notes"
                        value={singleLearnerForm.medical_notes}
                        onChange={handleSingleFormChange}
                        placeholder="Any medical conditions, allergies, or health concerns..."
                      />
                    </Form.Group>
                  </Col>
                  
                  <Col md={12}>
                    <Button 
                      variant="primary" 
                      onClick={addSingleLearner}
                      className="mt-2"
                    >
                      <i className="bi bi-plus-circle me-2"></i>
                      Add to List
                    </Button>
                  </Col>
                </Row>
              </div>

              <hr />

              <div className="mb-4">
                <h5>Add Multiple Learners</h5>
                <Row className="g-3 align-items-end">
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label>Number of Learners</Form.Label>
                      <Form.Control
                        type="number"
                        min="1"
                        max="50"
                        value={numberOfLearners}
                        onChange={(e) => setNumberOfLearners(parseInt(e.target.value) || 1)}
                        placeholder="Enter number"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={8}>
                    <Button 
                      variant="outline-primary" 
                      onClick={generateMultipleForms}
                      className="mb-2"
                    >
                      <i className="bi bi-plus-square me-2"></i>
                      Generate {numberOfLearners} Empty Forms
                    </Button>
                    <Form.Text className="d-block">
                      This will create {numberOfLearners} empty forms with all required fields
                    </Form.Text>
                  </Col>
                </Row>
              </div>
            </Tab>

            <Tab eventKey="import" title="Import File">
              <Alert variant="info" className="mb-4">
                <i className="bi bi-info-circle me-2"></i>
                <strong>File Format:</strong> Excel (.xlsx, .xls) or CSV file with columns:
                first_name, last_name, date_of_birth (YYYY-MM-DD), gender, 
                guardian_name, guardian_email, guardian_phone, has_special_needs (true/false),
                special_needs_notes, medical_notes
              </Alert>

              <div className="mb-4">
                <Form.Group>
                  <Form.Label>Select File</Form.Label>
                  <Form.Control
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileUpload}
                    ref={fileInputRef}
                  />
                  <Form.Text className="text-muted">
                    Max file size: 10MB. All learners will be added to this class automatically.
                  </Form.Text>
                </Form.Group>

                {importFile && (
                  <Alert variant="success" className="mt-3">
                    <i className="bi bi-check-circle me-2"></i>
                    File selected: <strong>{importFile.name}</strong>
                    <Button 
                      variant="link" 
                      size="sm" 
                      onClick={() => {
                        setImportFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="ms-2"
                    >
                      Remove
                    </Button>
                  </Alert>
                )}
              </div>

              <div className="d-flex gap-2">
                <Button 
                  variant="primary" 
                  onClick={handleBulkImport}
                  disabled={!importFile || importing}
                >
                  {importing ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-upload me-2"></i>
                      Import File
                    </>
                  )}
                </Button>
                
                <Button 
                  variant="outline-secondary" 
                  onClick={() => setShowTemplate(true)}
                >
                  <i className="bi bi-eye me-2"></i>
                  View Template Format
                </Button>
              </div>
            </Tab>
          </Tabs>
        </Card.Body>
      </Card>

      {/* Learner List Preview */}
      {learners.length > 0 && (
        <Card className="border-0 shadow-sm mb-4">
          <Card.Body>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="mb-0">
                Learners to Add ({learners.length})
                <Badge bg={learners.length <= (classDetails.max_capacity || 30) - (classDetails.learner_count || 0) ? 'success' : 'danger'} className="ms-2">
                  Capacity: {classDetails.learner_count || 0} + {learners.length} / {classDetails.max_capacity || 30}
                </Badge>
              </h5>
              <div className="d-flex gap-2">
                <Button 
                  variant="outline-danger" 
                  size="sm"
                  onClick={() => {
                    if (window.confirm('Are you sure you want to clear all learners?')) {
                      setLearners([]);
                      toast.success('All learners cleared');
                    }
                  }}
                >
                  <i className="bi bi-trash me-2"></i>
                  Clear All
                </Button>
                <Button 
                  variant="primary"
                  onClick={submitLearners}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Adding Learners...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-save me-2"></i>
                      Submit All Learners ({learners.length})
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="table-responsive">
              <Table hover size="sm" className="mb-0">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Basic Information</th>
                    <th>Guardian Information</th>
                    <th>Additional Info</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {learners.map((learner, index) => (
                    <React.Fragment key={learner.id}>
                      <tr>
                        <td>{index + 1}</td>
                        <td>
                          <div className="d-flex flex-column">
                            <div className="mb-1">
                              <Form.Control
                                type="text"
                                value={learner.first_name}
                                onChange={(e) => handleLearnerChange(index, 'first_name', e.target.value)}
                                placeholder="First name"
                                size="sm"
                                className="mb-1"
                              />
                              <Form.Control
                                type="text"
                                value={learner.last_name}
                                onChange={(e) => handleLearnerChange(index, 'last_name', e.target.value)}
                                placeholder="Last name"
                                size="sm"
                                className="mb-1"
                              />
                            </div>
                            <div className="d-flex gap-2">
                              <Form.Control
                                type="date"
                                value={learner.date_of_birth}
                                onChange={(e) => handleLearnerChange(index, 'date_of_birth', e.target.value)}
                                max={calculateMaxDate()}
                                min={calculateMinDate()}
                                size="sm"
                                className="w-50"
                              />
                              <Form.Select
                                value={learner.gender}
                                onChange={(e) => handleLearnerChange(index, 'gender', e.target.value)}
                                size="sm"
                                className="w-50"
                              >
                                <option value="">Gender</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                              </Form.Select>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="small">
                            <Form.Control
                              type="text"
                              value={learner.guardian_name}
                              onChange={(e) => handleLearnerChange(index, 'guardian_name', e.target.value)}
                              placeholder="Guardian name"
                              size="sm"
                              className="mb-1"
                            />
                            <Form.Control
                              type="email"
                              value={learner.guardian_email}
                              onChange={(e) => handleLearnerChange(index, 'guardian_email', e.target.value)}
                              placeholder="Guardian email"
                              size="sm"
                              className="mb-1"
                            />
                            <Form.Control
                              type="tel"
                              value={learner.guardian_phone}
                              onChange={(e) => handleLearnerChange(index, 'guardian_phone', e.target.value)}
                              placeholder="Guardian phone"
                              size="sm"
                            />
                          </div>
                        </td>
                        <td>
                          <div className="text-center">
                            {learner.has_special_needs && (
                              <Badge bg="warning" text="dark" className="me-1">
                                Special Needs
                              </Badge>
                            )}
                            {learner.medical_notes && (
                              <Badge bg="info" className="me-1">
                                Medical Notes
                              </Badge>
                            )}
                            <Button
                              variant="link"
                              size="sm"
                              onClick={() => toggleLearnerAccordion(index)}
                              className="p-0"
                            >
                              <i className={`bi bi-chevron-${learner.isExpanded ? 'up' : 'down'}`}></i>
                            </Button>
                          </div>
                        </td>
                        <td>
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => removeLearner(index)}
                          >
                            <i className="bi bi-trash"></i>
                          </Button>
                        </td>
                      </tr>
                      {learner.isExpanded && (
                        <tr>
                          <td colSpan="5" className="bg-light">
                            <Accordion defaultActiveKey="0" className="mb-3">
                              <Accordion.Item eventKey="0">
                                <Accordion.Header>Additional Information</Accordion.Header>
                                <Accordion.Body>
                                  <Row className="g-3">
                                    <Col md={12}>
                                      <Form.Check
                                        type="switch"
                                        id={`has_special_needs_${index}`}
                                        label="Has Special Educational Needs"
                                        checked={learner.has_special_needs}
                                        onChange={() => handleLearnerChange(index, 'has_special_needs', !learner.has_special_needs)}
                                      />
                                    </Col>
                                    {learner.has_special_needs && (
                                      <Col md={12}>
                                        <Form.Group>
                                          <Form.Label>Special Needs Notes</Form.Label>
                                          <Form.Control
                                            as="textarea"
                                            rows={2}
                                            value={learner.special_needs_notes}
                                            onChange={(e) => handleLearnerChange(index, 'special_needs_notes', e.target.value)}
                                            placeholder="Describe special educational needs..."
                                          />
                                        </Form.Group>
                                      </Col>
                                    )}
                                    <Col md={12}>
                                      <Form.Group>
                                        <Form.Label>Medical Notes</Form.Label>
                                        <Form.Control
                                          as="textarea"
                                          rows={2}
                                          value={learner.medical_notes}
                                          onChange={(e) => handleLearnerChange(index, 'medical_notes', e.target.value)}
                                          placeholder="Any medical conditions, allergies, or health concerns..."
                                        />
                                      </Form.Group>
                                    </Col>
                                  </Row>
                                </Accordion.Body>
                              </Accordion.Item>
                            </Accordion>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </Table>
            </div>

            <div className="mt-3">
              <Alert variant="info" className="mb-0">
                <i className="bi bi-info-circle me-2"></i>
                <strong>Note:</strong> All fields marked with * are required. Click the arrow icon next to each learner to expand and fill additional information.
              </Alert>
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Import Results Modal */}
      <Modal show={showPreview} onHide={() => setShowPreview(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Import Results</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {importResults && (
            <>
              <Alert variant="success">
                <h5 className="alert-heading">
                  <i className="bi bi-check-circle me-2"></i>
                  Operation Completed
                </h5>
                <p>
                  Successfully added {importResults.summary?.success || learners.length} learners to {classDetails.class_name}
                </p>
              </Alert>

              <div className="mb-4">
                <h6>Summary</h6>
                <Row>
                  <Col md={4}>
                    <Card className="text-center border-success">
                      <Card.Body>
                        <h2 className="text-success">{importResults.summary?.success || learners.length}</h2>
                        <Card.Text>Successfully Added</Card.Text>
                      </Card.Body>
                    </Card>
                  </Col>
                  {importResults.summary?.failed > 0 && (
                    <Col md={4}>
                      <Card className="text-center border-danger">
                        <Card.Body>
                          <h2 className="text-danger">{importResults.summary.failed}</h2>
                          <Card.Text>Failed</Card.Text>
                        </Card.Body>
                      </Card>
                    </Col>
                  )}
                  <Col md={4}>
                    <Card className="text-center border-info">
                      <Card.Body>
                        <h2>{classDetails.learner_count + (importResults.summary?.success || learners.length)}</h2>
                        <Card.Text>Total in Class Now</Card.Text>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              </div>

              {importResults.summary?.errors && importResults.summary.errors.length > 0 && (
                <div className="mb-3">
                  <h6>Errors</h6>
                  <div className="table-responsive">
                    <Table size="sm" bordered>
                      <thead>
                        <tr>
                          <th>Row</th>
                          <th>Name</th>
                          <th>Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importResults.summary.errors.map((error, index) => (
                          <tr key={index}>
                            <td>{error.row}</td>
                            <td>{error.name || 'Unknown'}</td>
                            <td className="text-danger">{error.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </div>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button 
            variant="secondary" 
            onClick={() => setShowPreview(false)}
          >
            Close
          </Button>
          <Button 
            variant="primary" 
            onClick={() => {
              setShowPreview(false);
              navigate(`/teacher/classes/${classId}`);
            }}
          >
            View Class
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Template Preview Modal */}
      <Modal show={showTemplate} onHide={() => setShowTemplate(false)} size="xl">
        <Modal.Header closeButton>
          <Modal.Title>Import Template Format</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="info">
            <i className="bi bi-info-circle me-2"></i>
            <strong>Instructions:</strong> Download this template, fill in your learner data, then upload the file.
          </Alert>
          
          <div className="table-responsive">
            <Table bordered size="sm">
              <thead>
                <tr>
                  <th>Column Name</th>
                  <th>Description</th>
                  <th>Required</th>
                  <th>Example</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>first_name</code></td>
                  <td>Learner's first name</td>
                  <td><Badge bg="danger">Required</Badge></td>
                  <td>John</td>
                </tr>
                <tr>
                  <td><code>last_name</code></td>
                  <td>Learner's last name</td>
                  <td><Badge bg="danger">Required</Badge></td>
                  <td>Doe</td>
                </tr>
                <tr>
                  <td><code>date_of_birth</code></td>
                  <td>Date of birth (YYYY-MM-DD)</td>
                  <td><Badge bg="danger">Required</Badge></td>
                  <td>2018-05-15</td>
                </tr>
                <tr>
                  <td><code>gender</code></td>
                  <td>Gender (Male/Female/Other)</td>
                  <td><Badge bg="warning">Optional</Badge></td>
                  <td>Male</td>
                </tr>
                <tr>
                  <td><code>guardian_name</code></td>
                  <td>Guardian's full name</td>
                  <td><Badge bg="warning">Optional</Badge></td>
                  <td>Jane Doe</td>
                </tr>
                <tr>
                  <td><code>guardian_email</code></td>
                  <td>Guardian's email address</td>
                  <td><Badge bg="warning">Optional</Badge></td>
                  <td>jane.doe@email.com</td>
                </tr>
                <tr>
                  <td><code>guardian_phone</code></td>
                  <td>Guardian's phone number</td>
                  <td><Badge bg="warning">Optional</Badge></td>
                  <td>0123456789</td>
                </tr>
                <tr>
                  <td><code>has_special_needs</code></td>
                  <td>Special needs flag (true/false)</td>
                  <td><Badge bg="warning">Optional</Badge></td>
                  <td>false</td>
                </tr>
                <tr>
                  <td><code>special_needs_notes</code></td>
                  <td>Notes about special needs</td>
                  <td><Badge bg="warning">Optional</Badge></td>
                  <td>Needs extra time for reading</td>
                </tr>
                <tr>
                  <td><code>medical_notes</code></td>
                  <td>Medical conditions or allergies</td>
                  <td><Badge bg="warning">Optional</Badge></td>
                  <td>Allergic to peanuts</td>
                </tr>
              </tbody>
            </Table>
          </div>

          <h6 className="mt-4">Sample Data:</h6>
          <div className="table-responsive">
            <Table bordered hover size="sm">
              <thead>
                <tr>
                  <th>first_name</th>
                  <th>last_name</th>
                  <th>date_of_birth</th>
                  <th>gender</th>
                  <th>guardian_name</th>
                  <th>guardian_email</th>
                  <th>guardian_phone</th>
                  <th>has_special_needs</th>
                  <th>special_needs_notes</th>
                  <th>medical_notes</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>John</td>
                  <td>Doe</td>
                  <td>2018-05-15</td>
                  <td>Male</td>
                  <td>Jane Doe</td>
                  <td>jane.doe@email.com</td>
                  <td>0123456789</td>
                  <td>false</td>
                  <td></td>
                  <td></td>
                </tr>
                <tr>
                  <td>Sarah</td>
                  <td>Smith</td>
                  <td>2017-08-22</td>
                  <td>Female</td>
                  <td>John Smith</td>
                  <td>john.smith@email.com</td>
                  <td>0987654321</td>
                  <td>true</td>
                  <td>Needs extra time for reading</td>
                  <td>Allergic to peanuts</td>
                </tr>
              </tbody>
            </Table>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button 
            variant="secondary" 
            onClick={() => setShowTemplate(false)}
          >
            Close
          </Button>
          <Button 
            variant="primary" 
            onClick={downloadTemplate}
          >
            <i className="bi bi-download me-2"></i>
            Download Template
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AddLearners;