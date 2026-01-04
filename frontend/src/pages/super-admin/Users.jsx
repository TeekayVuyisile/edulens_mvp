import React, { useState, useEffect } from 'react';
import { 
  Table, Button, Card, Form, InputGroup, Modal, 
  Row, Col, Badge, Dropdown, Alert, Spinner, Tabs, Tab
} from 'react-bootstrap';
import { toast } from 'react-hot-toast';
import axios from 'axios';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [userDetails, setUserDetails] = useState(null);
  
  // Form states
  const [createFormData, setCreateFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    role: 'teacher',
    phone: '',
    school_id: '',
    password: '',
    confirm_password: '',
    generate_password: true
  });

  const [editFormData, setEditFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    school_id: ''
  });

  const [passwordFormData, setPasswordFormData] = useState({
    new_password: '',
    confirm_new_password: ''
  });

  useEffect(() => {
    fetchUsers();
    fetchSchools();
  }, []);

  const [schools, setSchools] = useState([]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/api/super-admin/users');
      setUsers(response.data.data.users || []);
    } catch (error) {
      console.error('Fetch users error:', error);
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const fetchSchools = async () => {
    try {
      const response = await axios.get('/api/super-admin/schools');
      setSchools(response.data.data.schools || []);
    } catch (error) {
      console.error('Fetch schools error:', error);
      toast.error('Failed to fetch schools');
    }
  };

  const fetchUserDetails = async (userId) => {
    setViewLoading(true);
    try {
      const response = await axios.get(`/api/super-admin/users/${userId}`);
      setUserDetails(response.data.data.user);
      setSelectedUser(userId);
      setShowViewModal(true);
    } catch (error) {
      console.error('Fetch user details error:', error);
      toast.error('Failed to fetch user details');
    } finally {
      setViewLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    
    // Validate passwords if not generating
    if (!createFormData.generate_password) {
      if (createFormData.password !== createFormData.confirm_password) {
        toast.error('Passwords do not match');
        return;
      }
      
      if (createFormData.password.length < 6) {
        toast.error('Password must be at least 6 characters long');
        return;
      }
    }

    const userData = {
      email: createFormData.email,
      first_name: createFormData.first_name,
      last_name: createFormData.last_name,
      role: createFormData.role,
      phone: createFormData.phone || '',
      school_id: createFormData.school_id || null
    };

    // Only include password if not generating
    if (!createFormData.generate_password) {
      userData.password = createFormData.password;
    }

    try {
      const response = await axios.post('/api/super-admin/users', userData);
      
      if (createFormData.generate_password && response.data.data.generated_password) {
        toast.success(
          <div>
            <p>User created successfully!</p>
            <p><strong>Temporary password:</strong> {response.data.data.generated_password}</p>
            <p>This password has been sent to the user's email.</p>
          </div>,
          { duration: 10000 }
        );
      } else {
        toast.success('User created successfully!');
      }
      
      setShowCreateModal(false);
      resetCreateForm();
      fetchUsers();
    } catch (error) {
      console.error('Create user error:', error.response?.data || error);
      toast.error(error.response?.data?.message || 'Failed to create user');
    }
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    
    try {
      await axios.put(`/api/super-admin/users/${selectedUser}`, editFormData);
      toast.success('User updated successfully');
      setShowEditModal(false);
      resetEditForm();
      fetchUsers();
      // Refresh user details if viewing
      if (showViewModal) {
        fetchUserDetails(selectedUser);
      }
    } catch (error) {
      console.error('Update user error:', error);
      toast.error(error.response?.data?.message || 'Failed to update user');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    
    if (passwordFormData.new_password !== passwordFormData.confirm_new_password) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (passwordFormData.new_password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    try {
      await axios.patch(`/api/super-admin/users/${selectedUser}/change-password`, {
        new_password: passwordFormData.new_password
      });
      
      toast.success('Password changed successfully. User has been notified via email.');
      setShowChangePasswordModal(false);
      resetPasswordForm();
    } catch (error) {
      console.error('Change password error:', error);
      toast.error(error.response?.data?.message || 'Failed to change password');
    }
  };

  const toggleUserStatus = async (userId, currentStatus) => {
    try {
      await axios.patch(`/api/super-admin/users/${userId}/toggle-active`, {
        action: currentStatus ? 'deactivate' : 'activate'
      });
      
      toast.success(`User ${currentStatus ? 'deactivated' : 'activated'} successfully`);
      fetchUsers();
      // Refresh user details if viewing
      if (showViewModal && selectedUser === userId) {
        fetchUserDetails(userId);
      }
    } catch (error) {
      console.error('Toggle user status error:', error);
      toast.error(error.response?.data?.message || 'Failed to update user status');
    }
  };

  const resetCreateForm = () => {
    setCreateFormData({
      email: '',
      first_name: '',
      last_name: '',
      role: 'teacher',
      phone: '',
      school_id: '',
      password: '',
      confirm_password: '',
      generate_password: true
    });
  };

  const resetEditForm = () => {
    setEditFormData({
      first_name: '',
      last_name: '',
      phone: '',
      school_id: ''
    });
    setSelectedUser(null);
  };

  const resetPasswordForm = () => {
    setPasswordFormData({
      new_password: '',
      confirm_new_password: ''
    });
    setSelectedUser(null);
  };

  const openEditModal = (user) => {
    setSelectedUser(user.user_id);
    setEditFormData({
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone || '',
      school_id: user.school_id || ''
    });
    setShowEditModal(true);
  };

  const openChangePasswordModal = (user) => {
    setSelectedUser(user.user_id);
    setShowChangePasswordModal(true);
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.school_name && user.school_name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && user.is_active) ||
      (statusFilter === 'inactive' && !user.is_active);
    
    const matchesTab = 
      activeTab === 'all' ||
      (activeTab === 'active' && user.is_active) ||
      (activeTab === 'inactive' && !user.is_active);
    
    return matchesSearch && matchesRole && matchesStatus && matchesTab;
  });

  const getRoleBadge = (role) => {
    const roles = {
      'super_admin': 'danger',
      'school_admin': 'primary',
      'teacher': 'success',
      'learner': 'info'
    };
    return roles[role] || 'secondary';
  };

  const formatRoleName = (role) => {
    return role.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const activeUsers = users.filter(u => u.is_active);
  const inactiveUsers = users.filter(u => !u.is_active);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 mb-2">Users Management</h1>
          <p className="text-muted">Manage all users across the platform</p>
        </div>
        <Button variant="primary" onClick={() => setShowCreateModal(true)}>
          <i className="bi bi-plus-circle me-2"></i>
          Add User
        </Button>
      </div>

      {/* Statistics */}
      <Row className="g-3 mb-4">
        <Col xs={12} md={6} lg={3}>
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="text-muted mb-2">Total Users</h6>
                  <h2 className="fw-bold mb-0">{users.length}</h2>
                </div>
                <div className="bg-primary-subtle p-3 rounded">
                  <i className="bi bi-people fs-4 text-primary"></i>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={12} md={6} lg={3}>
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="text-muted mb-2">School Admins</h6>
                  <h2 className="fw-bold mb-0">
                    {users.filter(u => u.role === 'school_admin').length}
                  </h2>
                </div>
                <div className="bg-info-subtle p-3 rounded">
                  <i className="bi bi-person-badge fs-4 text-info"></i>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={12} md={6} lg={3}>
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="text-muted mb-2">Teachers</h6>
                  <h2 className="fw-bold mb-0">
                    {users.filter(u => u.role === 'teacher').length}
                  </h2>
                </div>
                <div className="bg-success-subtle p-3 rounded">
                  <i className="bi bi-person-check fs-4 text-success"></i>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={12} md={6} lg={3}>
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="text-muted mb-2">Active Users</h6>
                  <h2 className="fw-bold mb-0">{activeUsers.length}</h2>
                </div>
                <div className="bg-warning-subtle p-3 rounded">
                  <i className="bi bi-check-circle fs-4 text-warning"></i>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="border-0 shadow-sm mb-4">
        <Card.Body>
          <Tabs
            activeKey={activeTab}
            onSelect={(k) => setActiveTab(k)}
            className="mb-3"
          >
            <Tab eventKey="all" title="All Users">
              <Badge bg="secondary" className="ms-2">{users.length}</Badge>
            </Tab>
            <Tab eventKey="active" title="Active">
              <Badge bg="success" className="ms-2">{activeUsers.length}</Badge>
            </Tab>
            <Tab eventKey="inactive" title="Inactive">
              <Badge bg="secondary" className="ms-2">{inactiveUsers.length}</Badge>
            </Tab>
          </Tabs>

          <Row className="g-3 mb-4">
            <Col md={6}>
              <InputGroup>
                <InputGroup.Text>
                  <i className="bi bi-search"></i>
                </InputGroup.Text>
                <Form.Control
                  placeholder="Search users by name, email, or school..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <Button 
                    variant="outline-secondary" 
                    onClick={() => setSearchTerm('')}
                  >
                    <i className="bi bi-x"></i>
                  </Button>
                )}
              </InputGroup>
            </Col>
            <Col md={3}>
              <Form.Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                <option value="all">All Roles</option>
                <option value="school_admin">School Admins</option>
                <option value="teacher">Teachers</option>
                <option value="learner">Learners</option>
              </Form.Select>
            </Col>
            <Col md={3}>
              <Form.Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All Status</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </Form.Select>
            </Col>
          </Row>

          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" role="status" className="text-primary">
                <span className="visually-hidden">Loading...</span>
              </Spinner>
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover className="mb-0">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>School</th>
                    <th>Status</th>
                    <th>Last Login</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-4">
                        <div className="text-muted">
                          <i className="bi bi-person-x fs-1 mb-3 d-block"></i>
                          No users found
                          {searchTerm && ` matching "${searchTerm}"`}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user.user_id}>
                        <td>
                          <div className="d-flex align-items-center">
                            <div className={`p-2 rounded me-3 ${
                              user.role === 'school_admin' ? 'bg-primary-subtle' :
                              user.role === 'teacher' ? 'bg-success-subtle' :
                              'bg-info-subtle'
                            }`}>
                              <i className={`bi ${
                                user.role === 'school_admin' ? 'bi-person-badge text-primary' :
                                user.role === 'teacher' ? 'bi-person-check text-success' :
                                'bi-person text-info'
                              }`}></i>
                            </div>
                            <div>
                              <strong>{user.first_name} {user.last_name}</strong>
                              <div className="text-muted small">{user.email}</div>
                              <div className="text-muted small">{user.phone || 'No phone'}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <Badge bg={getRoleBadge(user.role)}>
                            {formatRoleName(user.role)}
                          </Badge>
                        </td>
                        <td>
                          {user.school_name ? (
                            <div>
                              <div>{user.school_name}</div>
                              <div className="text-muted small">Code: {user.school_code}</div>
                            </div>
                          ) : (
                            <span className="text-muted">No school</span>
                          )}
                        </td>
                        <td>
                          <Badge bg={user.is_active ? 'success' : 'secondary'}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                          <div className="text-muted small mt-1">
                            Created: {new Date(user.created_at).toLocaleDateString()}
                          </div>
                        </td>
                        <td>
                          {user.last_login 
                            ? new Date(user.last_login).toLocaleString()
                            : 'Never'}
                        </td>
                        <td>
                          <div className="d-flex flex-wrap gap-2 justify-content-center">
                            <Button 
                              size="sm" 
                              variant="outline-primary" 
                              title="View"
                              onClick={() => fetchUserDetails(user.user_id)}
                              disabled={viewLoading && selectedUser === user.user_id}
                            >
                              {viewLoading && selectedUser === user.user_id ? (
                                <Spinner size="sm" />
                              ) : (
                                <i className="bi bi-eye"></i>
                              )}
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline-warning"
                              title="Edit"
                              onClick={() => openEditModal(user)}
                            >
                              <i className="bi bi-pencil"></i>
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline-info"
                              title="Change Password"
                              onClick={() => openChangePasswordModal(user)}
                            >
                              <i className="bi bi-key"></i>
                            </Button>
                            <Button 
                              size="sm" 
                              variant={user.is_active ? 'outline-warning' : 'outline-success'}
                              title={user.is_active ? 'Deactivate' : 'Activate'}
                              onClick={() => toggleUserStatus(user.user_id, user.is_active)}
                            >
                              <i className={`bi bi-power ${user.is_active ? '' : 'text-success'}`}></i>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Create User Modal */}
      <Modal show={showCreateModal} onHide={() => { setShowCreateModal(false); resetCreateForm(); }} size="lg">
        <Form onSubmit={handleCreateUser}>
          <Modal.Header closeButton>
            <Modal.Title>Add New User</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Row className="g-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>First Name *</Form.Label>
                  <Form.Control
                    type="text"
                    value={createFormData.first_name}
                    onChange={(e) => setCreateFormData({...createFormData, first_name: e.target.value})}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Last Name *</Form.Label>
                  <Form.Control
                    type="text"
                    value={createFormData.last_name}
                    onChange={(e) => setCreateFormData({...createFormData, last_name: e.target.value})}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group>
                  <Form.Label>Email Address *</Form.Label>
                  <Form.Control
                    type="email"
                    value={createFormData.email}
                    onChange={(e) => setCreateFormData({...createFormData, email: e.target.value})}
                    required
                    placeholder="user@school.edu"
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Role *</Form.Label>
                  <Form.Select
                    value={createFormData.role}
                    onChange={(e) => setCreateFormData({...createFormData, role: e.target.value})}
                    required
                  >
                    <option value="teacher">Teacher</option>
                    <option value="school_admin">School Admin</option>
                    <option value="learner">Learner</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Phone Number</Form.Label>
                  <Form.Control
                    type="tel"
                    value={createFormData.phone}
                    onChange={(e) => setCreateFormData({...createFormData, phone: e.target.value})}
                  />
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group>
                  <Form.Label>School</Form.Label>
                  <Form.Select
                    value={createFormData.school_id}
                    onChange={(e) => setCreateFormData({...createFormData, school_id: e.target.value})}
                    required={['school_admin', 'teacher'].includes(createFormData.role)}
                  >
                    <option value="">Select School</option>
                    {schools.filter(s => s.is_active).map((school) => (
                      <option key={school.school_id} value={school.school_id}>
                        {school.school_name} ({school.school_code})
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Text className="text-muted">
                    {createFormData.role === 'learner' 
                      ? 'Optional for learners' 
                      : 'Required for school admins and teachers'}
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>

            <hr className="my-4" />
            
            <Form.Group className="mb-3">
              <Form.Check
                type="switch"
                id="generate-password"
                label="Generate temporary password"
                checked={createFormData.generate_password}
                onChange={(e) => setCreateFormData({...createFormData, generate_password: e.target.checked})}
              />
              <Form.Text className="text-muted">
                If checked, a temporary password will be generated and sent to the user's email.
              </Form.Text>
            </Form.Group>

            {!createFormData.generate_password && (
              <>
                <Alert variant="warning" className="mb-3">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  <strong>Warning:</strong> You are setting a custom password. The user will receive this password via email.
                </Alert>
                <Row className="g-3">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Password *</Form.Label>
                      <Form.Control
                        type="password"
                        value={createFormData.password}
                        onChange={(e) => setCreateFormData({...createFormData, password: e.target.value})}
                        required={!createFormData.generate_password}
                        minLength={6}
                      />
                      <Form.Text className="text-muted">
                        Minimum 6 characters
                      </Form.Text>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Confirm Password *</Form.Label>
                      <Form.Control
                        type="password"
                        value={createFormData.confirm_password}
                        onChange={(e) => setCreateFormData({...createFormData, confirm_password: e.target.value})}
                        required={!createFormData.generate_password}
                      />
                    </Form.Group>
                  </Col>
                </Row>
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => { setShowCreateModal(false); resetCreateForm(); }}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Create User
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* View User Details Modal */}
      <Modal show={showViewModal} onHide={() => setShowViewModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>User Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {viewLoading ? (
            <div className="text-center py-4">
              <Spinner animation="border" role="status">
                <span className="visually-hidden">Loading...</span>
              </Spinner>
            </div>
          ) : userDetails ? (
            <div>
              <Row className="mb-4">
                <Col md={8}>
                  <div className="d-flex align-items-center">
                    <div className={`p-3 rounded me-3 ${
                      userDetails.role === 'school_admin' ? 'bg-primary-subtle' :
                      userDetails.role === 'teacher' ? 'bg-success-subtle' :
                      'bg-info-subtle'
                    }`}>
                      <i className={`bi ${
                        userDetails.role === 'school_admin' ? 'bi-person-badge fs-2 text-primary' :
                        userDetails.role === 'teacher' ? 'bi-person-check fs-2 text-success' :
                        'bi-person fs-2 text-info'
                      }`}></i>
                    </div>
                    <div>
                      <h4 className="mb-1">{userDetails.first_name} {userDetails.last_name}</h4>
                      <p className="text-muted mb-2">{userDetails.email}</p>
                      <div className="d-flex gap-2">
                        <Badge bg={getRoleBadge(userDetails.role)}>
                          {formatRoleName(userDetails.role)}
                        </Badge>
                        <Badge bg={userDetails.is_active ? 'success' : 'secondary'}>
                          {userDetails.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </Col>
                <Col md={4} className="text-end">
                  <div className="d-flex gap-2 justify-content-end">
                    <Button 
                      size="sm" 
                      variant="outline-warning"
                      onClick={() => {
                        setShowViewModal(false);
                        openEditModal(userDetails);
                      }}
                    >
                      <i className="bi bi-pencil me-1"></i>
                      Edit
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline-info"
                      onClick={() => {
                        setShowViewModal(false);
                        openChangePasswordModal(userDetails);
                      }}
                    >
                      <i className="bi bi-key me-1"></i>
                      Change Password
                    </Button>
                  </div>
                </Col>
              </Row>
              
              <Row>
                <Col md={6}>
                  <Card className="mb-3">
                    <Card.Body>
                      <h6 className="text-muted mb-3">Personal Information</h6>
                      <p className="mb-2">
                        <strong>Email:</strong> {userDetails.email}
                      </p>
                      <p className="mb-2">
                        <strong>Phone:</strong> {userDetails.phone || 'Not provided'}
                      </p>
                      <p className="mb-2">
                        <strong>Last Login:</strong> {userDetails.last_login 
                          ? new Date(userDetails.last_login).toLocaleString()
                          : 'Never'}
                      </p>
                      {userDetails.date_of_birth && (
                        <p className="mb-2">
                          <strong>Date of Birth:</strong> {new Date(userDetails.date_of_birth).toLocaleDateString()}
                        </p>
                      )}
                    </Card.Body>
                  </Card>
                </Col>
                
                <Col md={6}>
                  <Card className="mb-3">
                    <Card.Body>
                      <h6 className="text-muted mb-3">School Information</h6>
                      {userDetails.school_name ? (
                        <>
                          <p className="mb-2">
                            <strong>School:</strong> {userDetails.school_name}
                          </p>
                          <p className="mb-2">
                            <strong>School Code:</strong> {userDetails.school_code}
                          </p>
                          <p className="mb-2">
                            <strong>School Email:</strong> {userDetails.school_email}
                          </p>
                          <p className="mb-0">
                            <strong>School Phone:</strong> {userDetails.school_phone || 'Not provided'}
                          </p>
                        </>
                      ) : (
                        <p className="text-muted mb-0">No school assigned</p>
                      )}
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              {userDetails.role === 'learner' && userDetails.guardian_name && (
                <Card className="mb-3">
                  <Card.Body>
                    <h6 className="text-muted mb-3">Guardian Information</h6>
                    <p className="mb-2">
                      <strong>Guardian Name:</strong> {userDetails.guardian_name}
                    </p>
                    {userDetails.guardian_email && (
                      <p className="mb-2">
                        <strong>Guardian Email:</strong> {userDetails.guardian_email}
                      </p>
                    )}
                  </Card.Body>
                </Card>
              )}

              <div className="text-muted small">
                <p className="mb-1">
                  <strong>Account Created:</strong> {new Date(userDetails.created_at).toLocaleString()}
                </p>
                <p className="mb-0">
                  <strong>Last Updated:</strong> {new Date(userDetails.updated_at).toLocaleString()}
                </p>
              </div>
            </div>
          ) : (
            <Alert variant="danger">Failed to load user details</Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowViewModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Edit User Modal */}
      <Modal show={showEditModal} onHide={() => { setShowEditModal(false); resetEditForm(); }}>
        <Form onSubmit={handleEditUser}>
          <Modal.Header closeButton>
            <Modal.Title>Edit User</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Row className="g-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>First Name *</Form.Label>
                  <Form.Control
                    type="text"
                    value={editFormData.first_name}
                    onChange={(e) => setEditFormData({...editFormData, first_name: e.target.value})}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Last Name *</Form.Label>
                  <Form.Control
                    type="text"
                    value={editFormData.last_name}
                    onChange={(e) => setEditFormData({...editFormData, last_name: e.target.value})}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group>
                  <Form.Label>Phone Number</Form.Label>
                  <Form.Control
                    type="tel"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({...editFormData, phone: e.target.value})}
                  />
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group>
                  <Form.Label>School</Form.Label>
                  <Form.Select
                    value={editFormData.school_id}
                    onChange={(e) => setEditFormData({...editFormData, school_id: e.target.value})}
                  >
                    <option value="">Select School</option>
                    {schools.filter(s => s.is_active).map((school) => (
                      <option key={school.school_id} value={school.school_id}>
                        {school.school_name} ({school.school_code})
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => { setShowEditModal(false); resetEditForm(); }}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save Changes
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Change Password Modal */}
      <Modal show={showChangePasswordModal} onHide={() => { setShowChangePasswordModal(false); resetPasswordForm(); }}>
        <Form onSubmit={handleChangePassword}>
          <Modal.Header closeButton>
            <Modal.Title>Change User Password</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Alert variant="warning" className="mb-4">
              <i className="bi bi-exclamation-triangle me-2"></i>
              <strong>Important:</strong> Changing a user's password will:
              <ul className="mb-0 mt-2">
                <li>Immediately update their login credentials</li>
                <li>Send an email notification to the user</li>
                <li>Include super admin contact details for inquiries</li>
              </ul>
            </Alert>
            
            <Row className="g-3">
              <Col md={12}>
                <Form.Group>
                  <Form.Label>New Password *</Form.Label>
                  <Form.Control
                    type="password"
                    value={passwordFormData.new_password}
                    onChange={(e) => setPasswordFormData({...passwordFormData, new_password: e.target.value})}
                    required
                    minLength={6}
                  />
                  <Form.Text className="text-muted">
                    Minimum 6 characters. Choose a strong password.
                  </Form.Text>
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group>
                  <Form.Label>Confirm New Password *</Form.Label>
                  <Form.Control
                    type="password"
                    value={passwordFormData.confirm_new_password}
                    onChange={(e) => setPasswordFormData({...passwordFormData, confirm_new_password: e.target.value})}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => { setShowChangePasswordModal(false); resetPasswordForm(); }}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Change Password
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default Users;