import School from '../models/School.js';
import Curriculum from '../models/Curriculum.js';
import User from '../models/User.js';

// @desc    Create a new school
// @route   POST /api/super-admin/schools
// @access  Private (Super Admin)
export const createSchool = async (req, res) => {
  try {
    const schoolData = req.body;
    
    // Create school
    const school = await School.create(schoolData);

    res.status(201).json({
      status: 'success',
      message: 'School created successfully',
      data: { school }
    });
  } catch (error) {
    console.error('Create school error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create school',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Create school admin account
// @route   POST /api/super-admin/schools/:schoolId/admin
// @access  Private (Super Admin)
export const createSchoolAdmin = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { email, password, first_name, last_name, phone } = req.body;

    // Check if school exists
    const school = await School.getById(schoolId);
    if (!school) {
      return res.status(404).json({
        status: 'error',
        message: 'School not found'
      });
    }

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'User with this email already exists'
      });
    }

    // Create admin user
    const adminUser = await User.create({
      email,
      password,
      first_name,
      last_name,
      role: 'school_admin',
      school_id: schoolId,
      phone,
      is_active: true
    });

    res.status(201).json({
      status: 'success',
      message: 'School admin account created successfully',
      data: {
        admin: {
          id: adminUser.user_id,
          email: adminUser.email,
          first_name: adminUser.first_name,
          last_name: adminUser.last_name,
          phone: adminUser.phone
        }
      }
    });
  } catch (error) {
    console.error('Create school admin error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create school admin',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get all schools
// @route   GET /api/super-admin/schools
// @access  Private (Super Admin)
export const getSchools = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, city } = req.query;
    
    const filters = {};
    if (search) filters.search = search;
    if (city) filters.city = city;

    const result = await School.getAll(parseInt(page), parseInt(limit), filters);

    // Check if schools have admin accounts
    const schoolsWithAdmin = await Promise.all(
      result.schools.map(async (school) => {
        const pool = await import('../config/database.js').then(mod => mod.default);
        const adminCheck = await pool.query(
          'SELECT COUNT(*) FROM users WHERE school_id = $1 AND role = $2 AND is_active = true',
          [school.school_id, 'school_admin']
        );
        return {
          ...school,
          has_admin: parseInt(adminCheck.rows[0].count) > 0
        };
      })
    );

    res.status(200).json({
      status: 'success',
      data: {
        ...result,
        schools: schoolsWithAdmin
      }
    });
  } catch (error) {
    console.error('Get schools error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get schools'
    });
  }
};

// @desc    Get school by ID
// @route   GET /api/super-admin/schools/:schoolId
// @access  Private (Super Admin)
export const getSchoolById = async (req, res) => {
  try {
    const { schoolId } = req.params;
    
    const school = await School.getById(schoolId);
    
    if (!school) {
      return res.status(404).json({
        status: 'error',
        message: 'School not found'
      });
    }

    // Get school admin if exists
    const pool = await import('../config/database.js').then(mod => mod.default);
    const adminResult = await pool.query(
      'SELECT user_id, email, first_name, last_name, phone FROM users WHERE school_id = $1 AND role = $2 AND is_active = true',
      [schoolId, 'school_admin']
    );

    res.status(200).json({
      status: 'success',
      data: {
        school,
        admin: adminResult.rows[0] || null
      }
    });
  } catch (error) {
    console.error('Get school by ID error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get school'
    });
  }
};

// @desc    Update school
// @route   PUT /api/super-admin/schools/:schoolId
// @access  Private (Super Admin)
export const updateSchool = async (req, res) => {
  try {
    const { schoolId } = req.params;
    
    const school = await School.update(schoolId, req.body);

    res.status(200).json({
      status: 'success',
      message: 'School updated successfully',
      data: { school }
    });
  } catch (error) {
    console.error('Update school error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update school'
    });
  }
};

// @desc    Delete school
// @route   DELETE /api/super-admin/schools/:schoolId
// @access  Private (Super Admin)
export const deleteSchool = async (req, res) => {
  try {
    const { schoolId } = req.params;

    // First check if school has any active users
    const pool = await import('../config/database.js').then(mod => mod.default);
    const activeUsers = await pool.query(
      'SELECT COUNT(*) FROM users WHERE school_id = $1 AND is_active = true',
      [schoolId]
    );

    if (parseInt(activeUsers.rows[0].count) > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot delete school with active users. Please deactivate users first.'
      });
    }

    // Delete school (cascade will handle related records)
    await pool.query('DELETE FROM schools WHERE school_id = $1', [schoolId]);

    res.status(200).json({
      status: 'success',
      message: 'School deleted successfully'
    });
  } catch (error) {
    console.error('Delete school error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete school'
    });
  }
};

// @desc    Get platform statistics
// @route   GET /api/super-admin/statistics
// @access  Private (Super Admin)
export const getPlatformStatistics = async (req, res) => {
  try {
    const pool = await import('../config/database.js').then(mod => mod.default);
    
    const queries = {
      totalSchools: `SELECT COUNT(*) FROM schools WHERE is_active = true`,
      totalAdmins: `SELECT COUNT(*) FROM users WHERE role = 'school_admin' AND is_active = true`,
      totalTeachers: `SELECT COUNT(*) FROM users WHERE role = 'teacher' AND is_active = true`,
      totalLearners: `SELECT COUNT(*) FROM learners WHERE academic_status = 'active'`,
      activeSessions: `SELECT COUNT(DISTINCT user_id) FROM activity_logs WHERE created_at > NOW() - INTERVAL '1 hour'`,
      recentActivity: `
        SELECT al.action_type, u.email, al.created_at
        FROM activity_logs al
        JOIN users u ON al.user_id = u.user_id
        ORDER BY al.created_at DESC
        LIMIT 10
      `
    };

    const results = await Promise.all(
      Object.values(queries).map(query => pool.query(query))
    );

    res.status(200).json({
      status: 'success',
      data: {
        totalSchools: parseInt(results[0].rows[0].count),
        totalAdmins: parseInt(results[1].rows[0].count),
        totalTeachers: parseInt(results[2].rows[0].count),
        totalLearners: parseInt(results[3].rows[0].count),
        activeSessions: parseInt(results[4].rows[0].count),
        recentActivity: results[5].rows
      }
    });
  } catch (error) {
    console.error('Get platform statistics error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get platform statistics'
    });
  }
};

// @desc    Create curriculum
// @route   POST /api/super-admin/curricula
// @access  Private (Super Admin)
export const createCurriculum = async (req, res) => {
  try {
    const curriculum = await Curriculum.create(req.body);

    res.status(201).json({
      status: 'success',
      message: 'Curriculum created successfully',
      data: { curriculum }
    });
  } catch (error) {
    console.error('Create curriculum error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create curriculum'
    });
  }
};

// @desc    Get all curricula
// @route   GET /api/super-admin/curricula
// @access  Private (Super Admin)
export const getCurricula = async (req, res) => {
  try {
    const { search } = req.query;
    const filters = search ? { search } : {};

    const curricula = await Curriculum.getAll(filters);

    // Get subjects for each curriculum
    const curriculaWithSubjects = await Promise.all(
      curricula.map(async (curriculum) => {
        const pool = await import('../config/database.js').then(mod => mod.default);
        const subjectsResult = await pool.query(
          `SELECT s.*, 
            json_agg(
              json_build_object(
                'topic_id', t.topic_id,
                'topic_name', t.topic_name,
                'topic_code', t.topic_code,
                'description', t.description,
                'learning_objectives', t.learning_objectives
              ) ORDER BY t.topic_name
            ) as topics
          FROM subjects s
          LEFT JOIN topics t ON s.subject_id = t.subject_id AND t.is_active = true
          WHERE s.curriculum_id = $1 AND s.is_active = true
          GROUP BY s.subject_id
          ORDER BY s.subject_name`,
          [curriculum.curriculum_id]
        );

        return {
          ...curriculum,
          subjects: subjectsResult.rows
        };
      })
    );

    res.status(200).json({
      status: 'success',
      data: { curricula: curriculaWithSubjects }
    });
  } catch (error) {
    console.error('Get curricula error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get curricula'
    });
  }
};

// @desc    Get curriculum by ID
// @route   GET /api/super-admin/curricula/:curriculumId
// @access  Private (Super Admin)
export const getCurriculumById = async (req, res) => {
  try {
    const { curriculumId } = req.params;

    const curriculum = await Curriculum.getById(curriculumId);
    
    if (!curriculum) {
      return res.status(404).json({
        status: 'error',
        message: 'Curriculum not found'
      });
    }

    res.status(200).json({
      status: 'success',
      data: { curriculum }
    });
  } catch (error) {
    console.error('Get curriculum by ID error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get curriculum'
    });
  }
};

// @desc    Update curriculum
// @route   PUT /api/super-admin/curricula/:curriculumId
// @access  Private (Super Admin)
export const updateCurriculum = async (req, res) => {
  try {
    const { curriculumId } = req.params;

    const curriculum = await Curriculum.update(curriculumId, req.body);

    res.status(200).json({
      status: 'success',
      message: 'Curriculum updated successfully',
      data: { curriculum }
    });
  } catch (error) {
    console.error('Update curriculum error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update curriculum'
    });
  }
};

// @desc    Delete curriculum
// @route   DELETE /api/super-admin/curricula/:curriculumId
// @access  Private (Super Admin)
export const deleteCurriculum = async (req, res) => {
  try {
    const { curriculumId } = req.params;

    const pool = await import('../config/database.js').then(mod => mod.default);
    
    // Check if curriculum is assigned to any schools
    const assignments = await pool.query(
      'SELECT COUNT(*) FROM school_curriculum_assignments WHERE curriculum_id = $1',
      [curriculumId]
    );

    if (parseInt(assignments.rows[0].count) > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot delete curriculum that is assigned to schools. Remove assignments first.'
      });
    }

    // Soft delete by setting is_active to false
    await pool.query(
      'UPDATE curricula SET is_active = false WHERE curriculum_id = $1',
      [curriculumId]
    );

    res.status(200).json({
      status: 'success',
      message: 'Curriculum deleted successfully'
    });
  } catch (error) {
    console.error('Delete curriculum error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete curriculum'
    });
  }
};

// @desc    Add subject to curriculum
// @route   POST /api/super-admin/curricula/:curriculumId/subjects
// @access  Private (Super Admin)
export const addSubject = async (req, res) => {
  try {
    const { curriculumId } = req.params;
    
    const subjectData = {
      ...req.body,
      curriculum_id: curriculumId
    };

    const subject = await Curriculum.createSubject(subjectData);

    res.status(201).json({
      status: 'success',
      message: 'Subject added successfully',
      data: { subject }
    });
  } catch (error) {
    console.error('Add subject error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to add subject'
    });
  }
};

// @desc    Update subject
// @route   PUT /api/super-admin/subjects/:subjectId
// @access  Private (Super Admin)
export const updateSubject = async (req, res) => {
  try {
    const { subjectId } = req.params;

    const pool = await import('../config/database.js').then(mod => mod.default);
    
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(req.body[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No fields to update'
      });
    }

    values.push(subjectId);
    
    const query = `
      UPDATE subjects 
      SET ${fields.join(', ')}
      WHERE subject_id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Subject not found'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Subject updated successfully',
      data: { subject: result.rows[0] }
    });
  } catch (error) {
    console.error('Update subject error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update subject'
    });
  }
};

// @desc    Delete subject
// @route   DELETE /api/super-admin/subjects/:subjectId
// @access  Private (Super Admin)
export const deleteSubject = async (req, res) => {
  try {
    const { subjectId } = req.params;

    const pool = await import('../config/database.js').then(mod => mod.default);
    
    // Check if subject has topics
    const topics = await pool.query(
      'SELECT COUNT(*) FROM topics WHERE subject_id = $1',
      [subjectId]
    );

    if (parseInt(topics.rows[0].count) > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot delete subject that has topics. Delete topics first.'
      });
    }

    // Soft delete
    await pool.query(
      'UPDATE subjects SET is_active = false WHERE subject_id = $1',
      [subjectId]
    );

    res.status(200).json({
      status: 'success',
      message: 'Subject deleted successfully'
    });
  } catch (error) {
    console.error('Delete subject error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete subject'
    });
  }
};

// @desc    Add topic to subject
// @route   POST /api/super-admin/subjects/:subjectId/topics
// @access  Private (Super Admin)
export const addTopic = async (req, res) => {
  try {
    const { subjectId } = req.params;
    
    const topicData = {
      ...req.body,
      subject_id: subjectId
    };

    const topic = await Curriculum.createTopic(topicData);

    res.status(201).json({
      status: 'success',
      message: 'Topic added successfully',
      data: { topic }
    });
  } catch (error) {
    console.error('Add topic error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to add topic'
    });
  }
};

// @desc    Update topic
// @route   PUT /api/super-admin/topics/:topicId
// @access  Private (Super Admin)
export const updateTopic = async (req, res) => {
  try {
    const { topicId } = req.params;

    const pool = await import('../config/database.js').then(mod => mod.default);
    
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(req.body[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No fields to update'
      });
    }

    values.push(topicId);
    
    const query = `
      UPDATE topics 
      SET ${fields.join(', ')}
      WHERE topic_id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Topic not found'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Topic updated successfully',
      data: { topic: result.rows[0] }
    });
  } catch (error) {
    console.error('Update topic error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update topic'
    });
  }
};

// @desc    Delete topic
// @route   DELETE /api/super-admin/topics/:topicId
// @access  Private (Super Admin)
export const deleteTopic = async (req, res) => {
  try {
    const { topicId } = req.params;

    const pool = await import('../config/database.js').then(mod => mod.default);
    
    // Check if topic is used in assessments
    const assessments = await pool.query(
      'SELECT COUNT(*) FROM assessments WHERE topic_id = $1',
      [topicId]
    );

    if (parseInt(assessments.rows[0].count) > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot delete topic that is used in assessments. Update assessments first.'
      });
    }

    // Soft delete
    await pool.query(
      'UPDATE topics SET is_active = false WHERE topic_id = $1',
      [topicId]
    );

    res.status(200).json({
      status: 'success',
      message: 'Topic deleted successfully'
    });
  } catch (error) {
    console.error('Delete topic error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete topic'
    });
  }
};

// @desc    Assign curriculum to school
// @route   POST /api/super-admin/schools/:schoolId/curricula
// @access  Private (Super Admin)
export const assignCurriculumToSchool = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { curriculum_id, grade_level, academic_year } = req.body;

    const assignment = await Curriculum.assignToSchool({
      school_id: schoolId,
      curriculum_id,
      grade_level,
      academic_year,
      assigned_by: req.user.userId
    });

    res.status(201).json({
      status: 'success',
      message: 'Curriculum assigned to school successfully',
      data: { assignment }
    });
  } catch (error) {
    console.error('Assign curriculum error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to assign curriculum'
    });
  }
};

// @desc    Get school curriculum assignments
// @route   GET /api/super-admin/schools/:schoolId/curricula
// @access  Private (Super Admin)
export const getSchoolCurricula = async (req, res) => {
  try {
    const { schoolId } = req.params;

    const pool = await import('../config/database.js').then(mod => mod.default);
    
    const query = `
      SELECT sca.*, c.curriculum_name, c.description
      FROM school_curriculum_assignments sca
      JOIN curricula c ON sca.curriculum_id = c.curriculum_id
      WHERE sca.school_id = $1 AND sca.is_active = true
      ORDER BY sca.grade_level, sca.academic_year DESC
    `;

    const result = await pool.query(query, [schoolId]);

    res.status(200).json({
      status: 'success',
      data: { assignments: result.rows }
    });
  } catch (error) {
    console.error('Get school curricula error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get school curricula'
    });
  }
};

// @desc    Remove curriculum assignment from school
// @route   DELETE /api/super-admin/schools/:schoolId/curricula/:assignmentId
// @access  Private (Super Admin)
export const removeCurriculumFromSchool = async (req, res) => {
  try {
    const { assignmentId } = req.params;

    const pool = await import('../config/database.js').then(mod => mod.default);
    
    await pool.query(
      'UPDATE school_curriculum_assignments SET is_active = false WHERE assignment_id = $1',
      [assignmentId]
    );

    res.status(200).json({
      status: 'success',
      message: 'Curriculum assignment removed successfully'
    });
  } catch (error) {
    console.error('Remove curriculum error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to remove curriculum assignment'
    });
  }
};

// @desc    Toggle school activation
// @route   PATCH /api/super-admin/schools/:schoolId/toggle-active
// @access  Private (Super Admin)
export const toggleSchoolActivation = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { action } = req.body; // 'activate' or 'deactivate'

    let school;
    if (action === 'deactivate') {
      school = await School.deactivate(schoolId);
    } else if (action === 'activate') {
      school = await School.activate(schoolId);
    } else {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid action. Use "activate" or "deactivate"'
      });
    }

    res.status(200).json({
      status: 'success',
      message: `School ${action}d successfully`,
      data: { school }
    });
  } catch (error) {
    console.error('Toggle school activation error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update school status'
    });
  }
};
// @desc    Get all users
// @route   GET /api/super-admin/users
// @access  Private (Super Admin)
export const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;
    const offset = (page - 1) * limit;
    
    const pool = await import('../config/database.js').then(mod => mod.default);

    let conditions = ['u.role != $1'];
    const values = ['super_admin'];
    let paramCount = 2;

    if (role) {
      conditions.push(`u.role = $${paramCount}`);
      values.push(role);
      paramCount++;
    }

    if (search) {
      conditions.push(`(u.first_name ILIKE $${paramCount} OR u.last_name ILIKE $${paramCount} OR u.email ILIKE $${paramCount})`);
      values.push(`%${search}%`);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        u.user_id, u.email, u.first_name, u.last_name, u.role,
        u.phone, u.is_active, u.last_login, u.created_at,
        s.school_name, s.school_code
      FROM users u
      LEFT JOIN schools s ON u.school_id = s.school_id
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    const countQuery = `
      SELECT COUNT(*) 
      FROM users u
      ${whereClause}
    `;

    values.push(limit, offset);

    const [usersResult, countResult] = await Promise.all([
      pool.query(query, values),
      pool.query(countQuery, values.slice(0, -2))
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        users: usersResult.rows,
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(countResult.rows[0].count / limit)
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get users'
    });
  }
};
// @desc    Create a new user
// @route   POST /api/super-admin/users
// @access  Private (Super Admin)
export const createUser = async (req, res) => {
  try {
    const { email, password, first_name, last_name, role, phone, school_id } = req.body;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'User with this email already exists'
      });
    }

    // Validate school_id for roles that require it
    if (['school_admin', 'teacher'].includes(role) && !school_id) {
      return res.status(400).json({
        status: 'error',
        message: `School ID is required for ${role} role`
      });
    }

    // Check if school exists
    if (school_id) {
      const pool = await import('../config/database.js').then(mod => mod.default);
      const schoolCheck = await pool.query(
        'SELECT school_id FROM schools WHERE school_id = $1 AND is_active = true',
        [school_id]
      );
      
      if (schoolCheck.rows.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'School not found or inactive'
        });
      }
    }

    // Generate password if not provided
    const userPassword = password || Math.random().toString(36).slice(-10);

    const userData = {
      email,
      password: userPassword,
      first_name,
      last_name,
      role,
      phone: phone || '',
      school_id: school_id || null,
      is_active: true
    };

    // Create user
    const newUser = await User.create(userData);

    // Send welcome email with password
    const emailService = await import('../services/emailService.js').then(mod => mod.default);
    try {
      await emailService.sendWelcomeEmail(
        email,
        first_name,
        role,
        password ? 'Your password has been set by the administrator' : `Your temporary password is: ${userPassword}`
      );
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Continue even if email fails
    }

    res.status(201).json({
      status: 'success',
      message: 'User created successfully',
      data: {
        user: {
          user_id: newUser.user_id,
          email: newUser.email,
          first_name: newUser.first_name,
          last_name: newUser.last_name,
          role: newUser.role,
          phone: newUser.phone,
          school_id: newUser.school_id,
          is_active: newUser.is_active
        },
        generated_password: password ? undefined : userPassword
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get user by ID
// @route   GET /api/super-admin/users/:userId
// @access  Private (Super Admin)
export const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const pool = await import('../config/database.js').then(mod => mod.default);
    
    const query = `
      SELECT 
        u.*,
        s.school_name,
        s.school_code,
        s.contact_email as school_email,
        s.contact_phone as school_phone,
        CASE 
          WHEN u.role = 'learner' THEN l.date_of_birth
          ELSE NULL 
        END as date_of_birth,
        CASE 
          WHEN u.role = 'learner' THEN l.guardian_name
          ELSE NULL 
        END as guardian_name,
        CASE 
          WHEN u.role = 'learner' THEN l.guardian_email
          ELSE NULL 
        END as guardian_email
      FROM users u
      LEFT JOIN schools s ON u.school_id = s.school_id
      LEFT JOIN learners l ON u.user_id = l.user_id
      WHERE u.user_id = $1
    `;

    const result = await pool.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    const user = result.rows[0];
    
    // Remove password hash from response
    delete user.password_hash;

    res.status(200).json({
      status: 'success',
      data: { user }
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get user'
    });
  }
};

// @desc    Update user
// @route   PUT /api/super-admin/users/:userId
// @access  Private (Super Admin)
export const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const updateData = req.body;

    // Check if user exists
    const pool = await import('../config/database.js').then(mod => mod.default);
    const userCheck = await pool.query(
      'SELECT * FROM users WHERE user_id = $1',
      [userId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    const currentUser = userCheck.rows[0];

    // Validate school_id if provided
    if (updateData.school_id) {
      const schoolCheck = await pool.query(
        'SELECT school_id FROM schools WHERE school_id = $1 AND is_active = true',
        [updateData.school_id]
      );
      
      if (schoolCheck.rows.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'School not found or inactive'
        });
      }
    }

    // Build update query
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(updateData[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No fields to update'
      });
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);

    const query = `
      UPDATE users 
      SET ${fields.join(', ')}
      WHERE user_id = $${paramCount}
      RETURNING user_id, email, first_name, last_name, role, phone, school_id, is_active, last_login, created_at, updated_at
    `;

    const result = await pool.query(query, values);
    
    // Log the activity
    await pool.query(
      'INSERT INTO activity_logs (user_id, action_type, action_details) VALUES ($1, $2, $3)',
      [
        req.user.userId,
        'USER_UPDATED',
        JSON.stringify({
          updated_user_id: userId,
          changes: updateData,
          updated_by: req.user.email
        })
      ]
    );

    res.status(200).json({
      status: 'success',
      message: 'User updated successfully',
      data: { user: result.rows[0] }
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update user'
    });
  }
};

// @desc    Toggle user activation
// @route   PATCH /api/super-admin/users/:userId/toggle-active
// @access  Private (Super Admin)
export const toggleUserActivation = async (req, res) => {
  try {
    const { userId } = req.params;
    const { action } = req.body; // 'activate' or 'deactivate'

    const pool = await import('../config/database.js').then(mod => mod.default);

    // Check if user exists
    const userCheck = await pool.query(
      'SELECT * FROM users WHERE user_id = $1',
      [userId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    const user = userCheck.rows[0];
    
    // Prevent deactivating super admins
    if (user.role === 'super_admin') {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot deactivate super admin accounts'
      });
    }

    let query;
    if (action === 'deactivate') {
      query = 'UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 RETURNING *';
    } else if (action === 'activate') {
      query = 'UPDATE users SET is_active = true, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 RETURNING *';
    } else {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid action. Use "activate" or "deactivate"'
      });
    }

    const result = await pool.query(query, [userId]);

    // Log the activity
    await pool.query(
      'INSERT INTO activity_logs (user_id, action_type, action_details) VALUES ($1, $2, $3)',
      [
        req.user.userId,
        action === 'activate' ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
        JSON.stringify({
          user_id: userId,
          user_email: user.email,
          action: action,
          performed_by: req.user.email
        })
      ]
    );

    res.status(200).json({
      status: 'success',
      message: `User ${action}d successfully`,
      data: { user: result.rows[0] }
    });
  } catch (error) {
    console.error('Toggle user activation error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update user status'
    });
  }
};

// @desc    Change user password
// @route   PATCH /api/super-admin/users/:userId/change-password
// @access  Private (Super Admin)
export const changeUserPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { new_password } = req.body;

    const pool = await import('../config/database.js').then(mod => mod.default);

    // Check if user exists
    const userCheck = await pool.query(
      'SELECT * FROM users WHERE user_id = $1',
      [userId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    const user = userCheck.rows[0];

    // Hash the new password
    const bcrypt = await import('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(new_password, salt);

    // Update password
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
      [hashedPassword, userId]
    );

    // Send email notification
    try {
      const emailService = await import('../services/emailService.js').then(mod => mod.default);
      
      // Get super admin contact info (you might want to store this in environment variables)
      const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'support@edulens.com';
      const superAdminPhone = process.env.SUPER_ADMIN_PHONE || '+27 123 456 789';
      
      await emailService.transporter.sendMail({
        from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
        to: user.email,
        subject: 'Your Password Has Been Changed - Edulens LMS',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4F46E5;">Password Changed Notification</h2>
            <p>Dear ${user.first_name} ${user.last_name},</p>
            <p>Your Edulens LMS account password has been changed by the system administrator.</p>
            <p>If you did not request this change or have any concerns, please contact us immediately.</p>
            
            <div style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #4F46E5; margin: 20px 0;">
              <h4 style="color: #4F46E5; margin-top: 0;">Contact Information:</h4>
              <p><strong>Super Admin Email:</strong> ${superAdminEmail}</p>
              <p><strong>Super Admin Phone:</strong> ${superAdminPhone}</p>
              <p><strong>Contact Hours:</strong> Monday - Friday, 8:00 AM - 5:00 PM</p>
            </div>
            
            <p style="color: #666; font-size: 14px;">
              For security reasons, please ensure you:
            </p>
            <ul style="color: #666; font-size: 14px;">
              <li>Keep your password confidential</li>
              <li>Use a strong, unique password</li>
              <li>Log out after each session</li>
              <li>Report any suspicious activity immediately</li>
            </ul>
            
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">
              Edulens LMS - Empowering Teachers, Inspiring Learners
            </p>
          </div>
        `
      });
    } catch (emailError) {
      console.error('Failed to send password change notification:', emailError);
      // Continue even if email fails
    }

    // Log the activity
    await pool.query(
      'INSERT INTO activity_logs (user_id, action_type, action_details) VALUES ($1, $2, $3)',
      [
        req.user.userId,
        'USER_PASSWORD_CHANGED',
        JSON.stringify({
          user_id: userId,
          user_email: user.email,
          changed_by: req.user.email
        })
      ]
    );

    res.status(200).json({
      status: 'success',
      message: 'Password changed successfully. User has been notified via email.'
    });
  } catch (error) {
    console.error('Change user password error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to change password'
    });
  }
};