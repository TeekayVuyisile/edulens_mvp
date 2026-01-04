import User from '../models/User.js';
import ClassModel from '../models/Class.js';
import School from '../models/School.js';
import { parse } from 'csv-parse/sync';
import fs from 'fs';
import xlsx from 'xlsx';

// @desc    Get school admin dashboard
// @route   GET /api/school-admin/dashboard
// @access  Private (School Admin)
export const getDashboard = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;

    // Get school statistics
    const statistics = await School.getStatistics(schoolId);

    // Get recent activity
    const pool = await import('../config/database.js').then(mod => mod.default);
    const activityQuery = `
      SELECT al.action_type, u.first_name, u.last_name, al.created_at
      FROM activity_logs al
      JOIN users u ON al.user_id = u.user_id
      WHERE al.school_id = $1
      ORDER BY al.created_at DESC
      LIMIT 10
    `;

    const activityResult = await pool.query(activityQuery, [schoolId]);

    // Get recent classes
    const classes = await ClassModel.getBySchool(schoolId, new Date().getFullYear());

    res.status(200).json({
      status: 'success',
      data: {
        statistics,
        recentActivity: activityResult.rows,
        recentClasses: classes.slice(0, 5)
      }
    });
  } catch (error) {
    console.error('Get school admin dashboard error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get dashboard data'
    });
  }
};

// @desc    Create teacher
// @route   POST /api/school-admin/teachers
// @access  Private (School Admin)
export const createTeacher = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    
    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';

    const teacherData = {
      ...req.body,
      role: 'teacher',
      school_id: schoolId,
      password: tempPassword
    };

    const teacher = await User.create(teacherData);

    // Send welcome email with temporary password
    const emailService = await import('../services/emailService.js').then(mod => mod.default);
    await emailService.sendWelcomeEmail(
      teacher.email,
      teacher.first_name,
      'teacher',
      tempPassword
    );

    res.status(201).json({
      status: 'success',
      message: 'Teacher created successfully',
      data: {
        teacher: {
          id: teacher.user_id,
          email: teacher.email,
          first_name: teacher.first_name,
          last_name: teacher.last_name,
          phone: teacher.phone
        },
        temporary_password: tempPassword
      }
    });
  } catch (error) {
    console.error('Create teacher error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create teacher'
    });
  }
};

// @desc    Bulk import teachers
// @route   POST /api/school-admin/teachers/bulk-import
// @access  Private (School Admin)
export const bulkImportTeachers = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'No file uploaded'
      });
    }

    const schoolId = req.user.schoolId;
    const filePath = req.file.path;
    let teachers = [];

    // Read file based on extension
    if (req.file.originalname.endsWith('.csv')) {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      teachers = parse(fileContent, {
        columns: true,
        skip_empty_lines: true
      });
    } else if (req.file.originalname.endsWith('.xlsx') || req.file.originalname.endsWith('.xls')) {
      const workbook = xlsx.readFile(filePath);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      teachers = xlsx.utils.sheet_to_json(worksheet);
    } else {
      fs.unlinkSync(filePath); // Clean up file
      return res.status(400).json({
        status: 'error',
        message: 'Unsupported file format. Use CSV or Excel.'
      });
    }

    // Process teachers
    const results = {
      total: teachers.length,
      success: 0,
      failed: 0,
      errors: []
    };

    const createdTeachers = [];

    for (const [index, teacherData] of teachers.entries()) {
      try {
        // Validate required fields
        if (!teacherData.email || !teacherData.first_name || !teacherData.last_name) {
          throw new Error('Missing required fields: email, first_name, last_name');
        }

        // Generate temporary password
        const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';

        const teacher = await User.create({
          email: teacherData.email,
          password: tempPassword,
          first_name: teacherData.first_name,
          last_name: teacherData.last_name,
          role: 'teacher',
          school_id: schoolId,
          phone: teacherData.phone || null
        });

        // Send welcome email
        const emailService = await import('../services/emailService.js').then(mod => mod.default);
        await emailService.sendWelcomeEmail(
          teacher.email,
          teacher.first_name,
          'teacher',
          tempPassword
        );

        createdTeachers.push({
          email: teacher.email,
          temporary_password: tempPassword
        });

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          row: index + 1,
          email: teacherData.email,
          error: error.message
        });
      }
    }

    // Clean up file
    fs.unlinkSync(filePath);

    // Log import
    const pool = await import('../config/database.js').then(mod => mod.default);
    await pool.query(
      `INSERT INTO bulk_import_logs 
       (school_id, imported_by, import_type, file_name, total_records, 
        successful_records, failed_records, import_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed')`,
      [
        schoolId,
        req.user.userId,
        'teachers',
        req.file.originalname,
        results.total,
        results.success,
        results.failed
      ]
    );

    res.status(200).json({
      status: 'success',
      message: `Import completed: ${results.success} successful, ${results.failed} failed`,
      data: {
        summary: results,
        created_teachers: createdTeachers
      }
    });

  } catch (error) {
    console.error('Bulk import teachers error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to import teachers'
    });
  }
};

// @desc    Get teachers
// @route   GET /api/school-admin/teachers
// @access  Private (School Admin)
export const getTeachers = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const { page = 1, limit = 20, search } = req.query;

    const filters = {};
    if (search) filters.search = search;

    const result = await User.getBySchoolAndRole(
      schoolId,
      'teacher',
      parseInt(page),
      parseInt(limit)
    );

    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    console.error('Get teachers error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get teachers'
    });
  }
};

// @desc    Create learner
// @route   POST /api/school-admin/learners
// @access  Private (School Admin)
export const createLearner = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    
    // Validate required fields
    const { first_name, last_name, date_of_birth } = req.body;
    
    if (!first_name || !last_name || !date_of_birth) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: first_name, last_name, date_of_birth'
      });
    }

    // Validate date of birth
    const dob = new Date(date_of_birth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    
    // Adjust age if birthday hasn't occurred this year
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    
    // Validate age range (4-10 years for Grade R-3)
    if (age < 4 || age > 10) {
      return res.status(400).json({
        status: 'error',
        message: 'Learner must be between 4 and 10 years old for Grade R-3 system'
      });
    }

    // Create a unique email for the learner
    const uniqueId = Date.now().toString().slice(-6);
    const username = `learner.${uniqueId}@${schoolId.substring(0, 8)}.edu`;
    const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';

    // First create user account for learner
    const userData = {
      email: username,
      password: tempPassword,
      first_name: req.body.first_name,
      last_name: req.body.last_name,
      role: 'learner',
      school_id: schoolId
    };

    const user = await User.create(userData);

    // Then create learner profile
    const pool = await import('../config/database.js').then(mod => mod.default);
    
    const learnerQuery = `
      INSERT INTO learners (
        user_id, school_id, current_class_id, date_of_birth,
        gender, guardian_name, guardian_email, guardian_phone,
        has_special_needs, special_needs_notes, medical_notes,
        enrollment_date
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_DATE)
      RETURNING *
    `;

    const learnerResult = await pool.query(learnerQuery, [
      user.user_id,
      schoolId,
      req.body.current_class_id || null, // Handle null class assignment
      req.body.date_of_birth,
      req.body.gender || null,
      req.body.guardian_name || null,
      req.body.guardian_email || null,
      req.body.guardian_phone || null,
      req.body.has_special_needs || false,
      req.body.special_needs_notes || null,
      req.body.medical_notes || null
    ]);

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs 
       (user_id, school_id, action_type, action_details)
       VALUES ($1, $2, $3, $4)`,
      [
        req.user.userId,
        schoolId,
        'LEARNER_CREATED',
        JSON.stringify({
          learner_id: learnerResult.rows[0].learner_id,
          learner_name: `${first_name} ${last_name}`,
          created_by: req.user.email
        })
      ]
    );

    res.status(201).json({
      status: 'success',
      message: 'Learner created successfully',
      data: {
        learner: learnerResult.rows[0],
        login_credentials: {
          username: user.email,
          temporary_password: tempPassword
        }
      }
    });
  } catch (error) {
    console.error('Create learner error:', error);
    
    // Handle unique constraint violations
    if (error.code === '23505') {
      return res.status(400).json({
        status: 'error',
        message: 'A learner with similar information already exists'
      });
    }

    res.status(500).json({
      status: 'error',
      message: 'Failed to create learner',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Bulk import learners
// @route   POST /api/school-admin/learners/bulk-import
// @access  Private (School Admin)
export const bulkImportLearners = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'No file uploaded'
      });
    }

    const schoolId = req.user.schoolId;
    const filePath = req.file.path;
    let learners = [];

    // Read file based on extension
    if (req.file.originalname.endsWith('.csv')) {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      learners = parse(fileContent, {
        columns: true,
        skip_empty_lines: true
      });
    } else if (req.file.originalname.endsWith('.xlsx') || req.file.originalname.endsWith('.xls')) {
      const workbook = xlsx.readFile(filePath);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      learners = xlsx.utils.sheet_to_json(worksheet);
    } else {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        status: 'error',
        message: 'Unsupported file format'
      });
    }

    const results = {
      total: learners.length,
      success: 0,
      failed: 0,
      errors: []
    };

    const createdLearners = [];
    const pool = await import('../config/database.js').then(mod => mod.default);

    for (const [index, learnerData] of learners.entries()) {
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');

        // Validate required fields
        if (!learnerData.first_name || !learnerData.last_name || !learnerData.date_of_birth) {
          throw new Error('Missing required fields: first_name, last_name, date_of_birth');
        }

        // Create user account
        const username = `learner.${Date.now().toString().slice(-6)}${index}@student.edu`;
        const tempPassword = 'changeme123';

        const userQuery = `
          INSERT INTO users (
            email, password_hash, first_name, last_name, 
            role, school_id, is_active
          )
          VALUES ($1, $2, $3, $4, $5, $6, true)
          RETURNING user_id
        `;

        // Hash password
        const bcrypt = await import('bcryptjs');
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(tempPassword, salt);

        const userResult = await client.query(userQuery, [
          username,
          passwordHash,
          learnerData.first_name,
          learnerData.last_name,
          'learner',
          schoolId
        ]);

        // Create learner profile
        const learnerQuery = `
          INSERT INTO learners (
            user_id, school_id, current_class_id, date_of_birth,
            gender, guardian_name, guardian_email, guardian_phone,
            enrollment_date
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_DATE)
          RETURNING learner_id
        `;

        const learnerResult = await client.query(learnerQuery, [
          userResult.rows[0].user_id,
          schoolId,
          learnerData.current_class_id,
          learnerData.date_of_birth,
          learnerData.gender,
          learnerData.guardian_name,
          learnerData.guardian_email,
          learnerData.guardian_phone
        ]);

        await client.query('COMMIT');

        createdLearners.push({
          learner_id: learnerResult.rows[0].learner_id,
          username,
          temporary_password: tempPassword
        });

        results.success++;

      } catch (error) {
        await client.query('ROLLBACK');
        results.failed++;
        results.errors.push({
          row: index + 1,
          name: `${learnerData.first_name} ${learnerData.last_name}`,
          error: error.message
        });
      } finally {
        client.release();
      }
    }

    // Clean up file
    fs.unlinkSync(filePath);

    // Log import
    await pool.query(
      `INSERT INTO bulk_import_logs 
       (school_id, imported_by, import_type, file_name, total_records, 
        successful_records, failed_records, import_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed')`,
      [
        schoolId,
        req.user.userId,
        'learners',
        req.file.originalname,
        results.total,
        results.success,
        results.failed
      ]
    );

    res.status(200).json({
      status: 'success',
      message: `Import completed: ${results.success} successful, ${results.failed} failed`,
      data: {
        summary: results,
        created_learners: createdLearners
      }
    });

  } catch (error) {
    console.error('Bulk import learners error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to import learners'
    });
  }
};

// @desc    Get learners
// @route   GET /api/school-admin/learners
// @access  Private (School Admin)
export const getLearners = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const { page = 1, limit = 20, class_id, status = 'active', search } = req.query;

    const conditions = ['l.school_id = $1'];
    const values = [schoolId];
    let paramCount = 2;

    if (class_id) {
      conditions.push(`l.current_class_id = $${paramCount}`);
      values.push(class_id);
      paramCount++;
    }

    // Handle status parameter - make sure it's a valid academic_status
    if (status && status !== 'all') {
      conditions.push(`l.academic_status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }

    if (search) {
      conditions.push(`(
        u.first_name ILIKE $${paramCount} OR 
        u.last_name ILIKE $${paramCount} OR 
        u.email ILIKE $${paramCount} OR
        l.guardian_name ILIKE $${paramCount} OR
        l.guardian_email ILIKE $${paramCount} OR
        l.guardian_phone ILIKE $${paramCount}
      )`);
      values.push(`%${search}%`);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        l.*,
        u.first_name,
        u.last_name,
        u.email,
        u.is_active as user_active,
        c.class_name,
        c.grade_level
      FROM learners l
      JOIN users u ON l.user_id = u.user_id
      LEFT JOIN classes c ON l.current_class_id = c.class_id
      ${whereClause}
      ORDER BY u.last_name, u.first_name
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    const countQuery = `
      SELECT COUNT(*) 
      FROM learners l
      JOIN users u ON l.user_id = u.user_id
      ${whereClause}
    `;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const pool = await import('../config/database.js').then(mod => mod.default);

    const [learnersResult, countResult] = await Promise.all([
      pool.query(query, [...values, parseInt(limit), offset]),
      pool.query(countQuery, values)
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        learners: learnersResult.rows,
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get learners error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get learners'
    });
  }
};

// @desc    Create class - FIXED VERSION
// @route   POST /api/school-admin/classes
// @access  Private (School Admin)
export const createClass = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    
    const classData = {
      ...req.body,
      school_id: schoolId,
      primary_teacher_id: req.body.primary_teacher_id || null // Make it nullable
    };

    const newClass = await ClassModel.create(classData);

    // If primary teacher is specified, create assignment
    if (req.body.primary_teacher_id) {
      const pool = await import('../config/database.js').then(mod => mod.default);
      
      await pool.query(
        `INSERT INTO class_teacher_assignments 
         (class_id, teacher_id, is_primary, assigned_by)
         VALUES ($1, $2, true, $3)`,
        [newClass.class_id, req.body.primary_teacher_id, req.user.userId]
      );
    }

    res.status(201).json({
      status: 'success',
      message: 'Class created successfully',
      data: { class: newClass }
    });
  } catch (error) {
    console.error('Create class error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create class',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get classes with teacher information
// @route   GET /api/school-admin/classes
// @access  Private (School Admin)
export const getClasses = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const { academic_year } = req.query;

    const pool = await import('../config/database.js').then(mod => mod.default);
    
    const query = `
      SELECT 
        c.*,
        u.first_name as primary_teacher_first_name,
        u.last_name as primary_teacher_last_name,
        u.email as primary_teacher_email,
        CONCAT(u.first_name, ' ', u.last_name) as primary_teacher_name,
        COUNT(DISTINCT l.learner_id) as learner_count,
        COALESCE(AVG(g.percentage), 0) as average_score,
        COUNT(DISTINCT a.assessment_id) as assessments_count
      FROM classes c
      LEFT JOIN users u ON c.primary_teacher_id = u.user_id
      LEFT JOIN learners l ON c.class_id = l.current_class_id AND l.academic_status = 'active'
      LEFT JOIN assessments a ON c.class_id = a.class_id
      LEFT JOIN grades g ON a.assessment_id = g.assessment_id
      WHERE c.school_id = $1 
        AND c.academic_year = $2
      GROUP BY c.class_id, u.user_id, u.first_name, u.last_name, u.email
      ORDER BY c.grade_level, c.class_name
    `;

    const result = await pool.query(query, [
      schoolId, 
      academic_year || new Date().getFullYear()
    ]);

    res.status(200).json({
      status: 'success',
      data: { classes: result.rows }
    });
  } catch (error) {
    console.error('Get classes error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get classes'
    });
  }
};

// @desc    Get class details
// @route   GET /api/school-admin/classes/:classId
// @access  Private (School Admin)
export const getClassDetails = async (req, res) => {
  try {
    const { classId } = req.params;

    const classDetails = await ClassModel.getById(classId);
    
    if (!classDetails) {
      return res.status(404).json({
        status: 'error',
        message: 'Class not found'
      });
    }

    // Verify school admin has access to this class
    if (classDetails.school_id !== req.user.schoolId) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to access this class'
      });
    }

    res.status(200).json({
      status: 'success',
      data: { class: classDetails }
    });
  } catch (error) {
    console.error('Get class details error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get class details'
    });
  }
};

// @desc    Update class
// @route   PUT /api/school-admin/classes/:classId
// @access  Private (School Admin)
export const updateClass = async (req, res) => {
  try {
    const { classId } = req.params;

    // First verify the class belongs to the admin's school
    const classDetails = await ClassModel.getById(classId);
    if (!classDetails || classDetails.school_id !== req.user.schoolId) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to update this class'
      });
    }

    const updatedClass = await ClassModel.update(classId, req.body);

    res.status(200).json({
      status: 'success',
      message: 'Class updated successfully',
      data: { class: updatedClass }
    });
  } catch (error) {
    console.error('Update class error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update class'
    });
  }
};

// @desc    Update learner progress (promote/repeat)
// @route   POST /api/school-admin/learners/:learnerId/progress
// @access  Private (School Admin)
export const updateLearnerProgress = async (req, res) => {
  try {
    const { learnerId } = req.params;
    const { action, next_class_id } = req.body;

    const pool = await import('../config/database.js').then(mod => mod.default);

    // Get current learner details
    const learnerQuery = `
      SELECT l.*, c.class_name, c.grade_level
      FROM learners l
      LEFT JOIN classes c ON l.current_class_id = c.class_id
      WHERE l.learner_id = $1
    `;

    const learnerResult = await pool.query(learnerQuery, [learnerId]);
    
    if (learnerResult.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Learner not found'
      });
    }

    const learner = learnerResult.rows[0];

    if (action === 'promote') {
      if (!next_class_id) {
        return res.status(400).json({
          status: 'error',
          message: 'next_class_id is required for promotion'
        });
      }

      // Archive current class history
      await pool.query(
        `INSERT INTO learner_class_history 
         (learner_id, class_id, academic_year, status, completed_date)
         VALUES ($1, $2, EXTRACT(YEAR FROM CURRENT_DATE), 'graduated', CURRENT_DATE)`,
        [learnerId, learner.current_class_id]
      );

      // Update learner to new class
      await pool.query(
        `UPDATE learners 
         SET current_class_id = $1, updated_at = CURRENT_TIMESTAMP
         WHERE learner_id = $2`,
        [next_class_id, learnerId]
      );

      res.status(200).json({
        status: 'success',
        message: `Learner promoted to next class`,
        data: {
          previous_class: learner.class_name,
          previous_grade: learner.grade_level
        }
      });

    } else if (action === 'repeat') {
      // Archive current class history as repeated
      await pool.query(
        `INSERT INTO learner_class_history 
         (learner_id, class_id, academic_year, status, completed_date, notes)
         VALUES ($1, $2, EXTRACT(YEAR FROM CURRENT_DATE), 'repeated', CURRENT_DATE, 'Repeated grade')`,
        [learnerId, learner.current_class_id]
      );

      // Learner stays in same class (will be updated by admin)
      res.status(200).json({
        status: 'success',
        message: 'Learner marked to repeat current grade',
        data: {
          class: learner.class_name,
          grade: learner.grade_level
        }
      });
    }

  } catch (error) {
    console.error('Update learner progress error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update learner progress'
    });
  }
};

// @desc    Get performance reports
// @route   GET /api/school-admin/reports/performance
// @access  Private (School Admin)
export const getPerformanceReports = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const { grade_level, term_number, academic_year } = req.query;

    const pool = await import('../config/database.js').then(mod => mod.default);

    // Get class performance
    const classPerformanceQuery = `
      SELECT 
        c.class_id,
        c.class_name,
        c.grade_level,
        COUNT(DISTINCT l.learner_id) as total_learners,
        COUNT(DISTINCT a.assessment_id) as total_assessments,
        ROUND(AVG(g.percentage), 2) as average_score,
        COUNT(CASE WHEN g.percentage >= 75 THEN 1 END) as distinction_count,
        COUNT(CASE WHEN g.percentage >= 50 AND g.percentage < 75 THEN 1 END) as pass_count,
        COUNT(CASE WHEN g.percentage < 50 THEN 1 END) as fail_count
      FROM classes c
      LEFT JOIN learners l ON c.class_id = l.current_class_id 
        AND l.academic_status = 'active'
      LEFT JOIN assessments a ON c.class_id = a.class_id
      LEFT JOIN grades g ON a.assessment_id = g.assessment_id
      WHERE c.school_id = $1 
        AND c.is_active = true
        AND c.academic_year = $2
        ${grade_level ? 'AND c.grade_level = $3' : ''}
        ${term_number ? 'AND a.term_number = $4' : ''}
      GROUP BY c.class_id, c.class_name, c.grade_level
      ORDER BY c.grade_level, c.class_name
    `;

    const params = [schoolId, academic_year || new Date().getFullYear()];
    if (grade_level) params.push(grade_level);
    if (term_number) params.push(term_number);

    const classPerformanceResult = await pool.query(classPerformanceQuery, params);

    // Get subject performance
    const subjectPerformanceQuery = `
      SELECT 
        s.subject_name,
        c.grade_level,
        COUNT(DISTINCT a.assessment_id) as total_assessments,
        ROUND(AVG(g.percentage), 2) as average_score,
        COUNT(DISTINCT g.learner_id) as learners_assessed
      FROM assessments a
      JOIN classes c ON a.class_id = c.class_id
      JOIN subjects s ON a.subject_id = s.subject_id
      LEFT JOIN grades g ON a.assessment_id = g.assessment_id
      WHERE c.school_id = $1 
        AND c.academic_year = $2
        ${grade_level ? 'AND c.grade_level = $3' : ''}
        ${term_number ? 'AND a.term_number = $4' : ''}
      GROUP BY s.subject_name, c.grade_level
      ORDER BY s.subject_name, c.grade_level
    `;

    const subjectPerformanceResult = await pool.query(subjectPerformanceQuery, params);

    res.status(200).json({
      status: 'success',
      data: {
        class_performance: classPerformanceResult.rows,
        subject_performance: subjectPerformanceResult.rows
      }
    });
  } catch (error) {
    console.error('Get performance reports error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get performance reports'
    });
  }
};

// @desc    Get worksheet reports
// @route   GET /api/school-admin/reports/worksheets
// @access  Private (School Admin)
export const getWorksheetReports = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;

    const pool = await import('../config/database.js').then(mod => mod.default);

    const query = `
      SELECT 
        wr.*,
        u.first_name as teacher_first_name,
        u.last_name as teacher_last_name,
        c.curriculum_name,
        s.subject_name,
        t.topic_name
      FROM worksheet_requests wr
      JOIN users u ON wr.teacher_id = u.user_id
      LEFT JOIN curricula c ON wr.curriculum_id = c.curriculum_id
      LEFT JOIN subjects s ON wr.subject_id = s.subject_id
      LEFT JOIN topics t ON wr.topic_id = t.topic_id
      WHERE wr.school_id = $1
      ORDER BY wr.created_at DESC
      LIMIT 50
    `;

    const result = await pool.query(query, [schoolId]);

    // Get summary statistics
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_worksheets,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        COUNT(DISTINCT teacher_id) as teachers_active,
        MIN(created_at) as first_generated,
        MAX(created_at) as last_generated
      FROM worksheet_requests
      WHERE school_id = $1
    `;

    const summaryResult = await pool.query(summaryQuery, [schoolId]);

    res.status(200).json({
      status: 'success',
      data: {
        worksheets: result.rows,
        summary: summaryResult.rows[0]
      }
    });
  } catch (error) {
    console.error('Get worksheet reports error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get worksheet reports'
    });
  }
};
// @desc    Get teachers for school
// @route   GET /api/school-admin/teachers/list
// @access  Private (School Admin)
export const getTeachersList = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    
    const pool = await import('../config/database.js').then(mod => mod.default);
    
    const query = `
      SELECT 
        u.user_id,
        u.first_name || ' ' || u.last_name as full_name,
        u.email,
        COUNT(DISTINCT cta.class_id) as assigned_classes_count
      FROM users u
      LEFT JOIN class_teacher_assignments cta ON u.user_id = cta.teacher_id
      WHERE u.school_id = $1 
        AND u.role = 'teacher' 
        AND u.is_active = true
      GROUP BY u.user_id, u.first_name, u.last_name, u.email
      ORDER BY u.first_name, u.last_name
    `;

    const result = await pool.query(query, [schoolId]);

    res.status(200).json({
      status: 'success',
      data: { teachers: result.rows }
    });
  } catch (error) {
    console.error('Get teachers list error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get teachers list'
    });
  }
};

// @desc    Archive academic year
// @route   POST /api/school-admin/academic-years/:year/archive
// @access  Private (School Admin)
export const archiveAcademicYear = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const { year } = req.params;

    const pool = await import('../config/database.js').then(mod => mod.default);

    // Start transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Archive all classes for this year
      await client.query(
        `UPDATE classes 
         SET is_active = false, updated_at = CURRENT_TIMESTAMP
         WHERE school_id = $1 AND academic_year = $2 AND is_active = true`,
        [schoolId, parseInt(year)]
      );

      // Archive learners who have completed Grade 3
      await client.query(
        `UPDATE learners l
         SET academic_status = 'graduated', updated_at = CURRENT_TIMESTAMP
         FROM classes c
         WHERE l.current_class_id = c.class_id 
           AND c.school_id = $1 
           AND c.academic_year = $2 
           AND c.grade_level = '3'
           AND l.academic_status = 'active'`,
        [schoolId, parseInt(year)]
      );

      // Record the archiving activity
      await client.query(
        `INSERT INTO activity_logs 
         (user_id, school_id, action_type, action_details)
         VALUES ($1, $2, $3, $4)`,
        [
          req.user.userId,
          schoolId,
          'ACADEMIC_YEAR_ARCHIVED',
          JSON.stringify({
            academic_year: year,
            archived_by: req.user.email,
            timestamp: new Date().toISOString()
          })
        ]
      );

      await client.query('COMMIT');

      res.status(200).json({
        status: 'success',
        message: `Academic year ${year} archived successfully. All Grade 3 learners have been graduated.`
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Archive academic year error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to archive academic year'
    });
  }
};

// @desc    Get academic years for school
// @route   GET /api/school-admin/academic-years
// @access  Private (School Admin)
export const getAcademicYears = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    
    const pool = await import('../config/database.js').then(mod => mod.default);
    
    const query = `
      SELECT DISTINCT academic_year
      FROM classes
      WHERE school_id = $1
      ORDER BY academic_year DESC
    `;

    const result = await pool.query(query, [schoolId]);

    res.status(200).json({
      status: 'success',
      data: { academic_years: result.rows.map(row => row.academic_year) }
    });
  } catch (error) {
    console.error('Get academic years error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get academic years'
    });
  }
};

// @desc    Get class performance analytics - FIXED VERSION
// @route   GET /api/school-admin/classes/:classId/analytics
// @access  Private (School Admin)
export const getClassAnalytics = async (req, res) => {
  try {
    const { classId } = req.params;
    const schoolId = req.user.schoolId;

    const pool = await import('../config/database.js').then(mod => mod.default);

    // Verify class belongs to school
    const classCheck = await pool.query(
      'SELECT class_id FROM classes WHERE class_id = $1 AND school_id = $2',
      [classId, schoolId]
    );

    if (classCheck.rows.length === 0) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to access this class'
      });
    }

    // Get class basic info with COALESCE to handle null teacher
    const classInfoQuery = `
      SELECT 
        c.*,
        COALESCE(u.first_name, 'No') as teacher_first_name,
        COALESCE(u.last_name, 'Teacher') as teacher_last_name,
        COALESCE(u.email, 'Not assigned') as teacher_email
      FROM classes c
      LEFT JOIN users u ON c.primary_teacher_id = u.user_id
      WHERE c.class_id = $1
    `;

    // Get learner performance summary
    const performanceQuery = `
      SELECT 
        lp.learner_id,
        u.first_name,
        u.last_name,
        ROUND(AVG(lp.overall_percentage), 2) as average_percentage,
        COUNT(DISTINCT lp.topic_id) as topics_covered,
        COUNT(DISTINCT lp.subject_id) as subjects_covered
      FROM learner_progress lp
      JOIN learners l ON lp.learner_id = l.learner_id
      JOIN users u ON l.user_id = u.user_id
      WHERE lp.class_id = $1
      GROUP BY lp.learner_id, u.first_name, u.last_name
      ORDER BY average_percentage DESC
    `;

    // Get term-wise performance
    const termPerformanceQuery = `
      SELECT 
        a.term_number,
        COUNT(DISTINCT a.assessment_id) as total_assessments,
        ROUND(AVG(g.percentage), 2) as class_average,
        COUNT(DISTINCT g.learner_id) as learners_assessed
      FROM assessments a
      LEFT JOIN grades g ON a.assessment_id = g.assessment_id
      WHERE a.class_id = $1
      GROUP BY a.term_number
      ORDER BY a.term_number
    `;

    // Get subject-wise performance
    const subjectPerformanceQuery = `
      SELECT 
        s.subject_name,
        COUNT(DISTINCT a.assessment_id) as total_assessments,
        ROUND(AVG(g.percentage), 2) as average_score,
        COUNT(DISTINCT g.learner_id) as learners_assessed
      FROM assessments a
      JOIN subjects s ON a.subject_id = s.subject_id
      LEFT JOIN grades g ON a.assessment_id = g.assessment_id
      WHERE a.class_id = $1
      GROUP BY s.subject_name
      ORDER BY s.subject_name
    `;

    const [
      classInfoResult,
      performanceResult,
      termPerformanceResult,
      subjectPerformanceResult
    ] = await Promise.all([
      pool.query(classInfoQuery, [classId]),
      pool.query(performanceQuery, [classId]),
      pool.query(termPerformanceQuery, [classId]),
      pool.query(subjectPerformanceQuery, [classId])
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        class_info: classInfoResult.rows[0],
        learner_performance: performanceResult.rows || [],
        term_performance: termPerformanceResult.rows || [],
        subject_performance: subjectPerformanceResult.rows || []
      }
    });
  } catch (error) {
    console.error('Get class analytics error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get class analytics'
    });
  }
};
// @desc    Assign teacher to class
// @route   POST /api/school-admin/classes/:classId/assign-teacher
// @access  Private (School Admin)
export const assignTeacherToClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const { teacher_id, is_primary = false } = req.body;
    const schoolId = req.user.schoolId;

    const pool = await import('../config/database.js').then(mod => mod.default);

    // Verify class belongs to school
    const classCheck = await pool.query(
      'SELECT class_id FROM classes WHERE class_id = $1 AND school_id = $2',
      [classId, schoolId]
    );

    if (classCheck.rows.length === 0) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to access this class'
      });
    }

    // Verify teacher belongs to school
    const teacherCheck = await pool.query(
      'SELECT user_id FROM users WHERE user_id = $1 AND school_id = $2 AND role = $3',
      [teacher_id, schoolId, 'teacher']
    );

    if (teacherCheck.rows.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Teacher not found or not authorized'
      });
    }

    // Remove existing primary teacher assignment if setting new primary
    if (is_primary) {
      await pool.query(
        `UPDATE class_teacher_assignments 
         SET is_primary = false 
         WHERE class_id = $1`,
        [classId]
      );

      // Update primary teacher in classes table
      await pool.query(
        `UPDATE classes 
         SET primary_teacher_id = $1, updated_at = CURRENT_TIMESTAMP
         WHERE class_id = $2`,
        [teacher_id, classId]
      );
    }

    // Insert or update teacher assignment
    const query = `
      INSERT INTO class_teacher_assignments (class_id, teacher_id, is_primary, assigned_by)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (class_id, teacher_id) 
      DO UPDATE SET is_primary = $3, updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const result = await pool.query(query, [
      classId,
      teacher_id,
      is_primary,
      req.user.userId
    ]);

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs 
       (user_id, school_id, action_type, action_details)
       VALUES ($1, $2, $3, $4)`,
      [
        req.user.userId,
        schoolId,
        'TEACHER_ASSIGNED_TO_CLASS',
        JSON.stringify({
          class_id: classId,
          teacher_id: teacher_id,
          is_primary: is_primary,
          assigned_by: req.user.email
        })
      ]
    );

    res.status(200).json({
      status: 'success',
      message: `Teacher ${is_primary ? 'assigned as primary' : 'assigned'} to class successfully`,
      data: { assignment: result.rows[0] }
    });
  } catch (error) {
    console.error('Assign teacher to class error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to assign teacher to class'
    });
  }
};

// @desc    Remove teacher from class
// @route   DELETE /api/school-admin/classes/:classId/teachers/:teacherId
// @access  Private (School Admin)
export const removeTeacherFromClass = async (req, res) => {
  try {
    const { classId, teacherId } = req.params;
    const schoolId = req.user.schoolId;

    const pool = await import('../config/database.js').then(mod => mod.default);

    // Verify class belongs to school
    const classCheck = await pool.query(
      'SELECT class_id, primary_teacher_id FROM classes WHERE class_id = $1 AND school_id = $2',
      [classId, schoolId]
    );

    if (classCheck.rows.length === 0) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to access this class'
      });
    }

    // If removing primary teacher, update classes table
    const classData = classCheck.rows[0];
    if (classData.primary_teacher_id === teacherId) {
      await pool.query(
        `UPDATE classes 
         SET primary_teacher_id = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE class_id = $1`,
        [classId]
      );
    }

    // Remove assignment
    await pool.query(
      'DELETE FROM class_teacher_assignments WHERE class_id = $1 AND teacher_id = $2',
      [classId, teacherId]
    );

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs 
       (user_id, school_id, action_type, action_details)
       VALUES ($1, $2, $3, $4)`,
      [
        req.user.userId,
        schoolId,
        'TEACHER_REMOVED_FROM_CLASS',
        JSON.stringify({
          class_id: classId,
          teacher_id: teacherId,
          removed_by: req.user.email
        })
      ]
    );

    res.status(200).json({
      status: 'success',
      message: 'Teacher removed from class successfully'
    });
  } catch (error) {
    console.error('Remove teacher from class error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to remove teacher from class'
    });
  }
};

// @desc    Get class teachers
// @route   GET /api/school-admin/classes/:classId/teachers
// @access  Private (School Admin)
export const getClassTeachers = async (req, res) => {
  try {
    const { classId } = req.params;
    const schoolId = req.user.schoolId;

    const pool = await import('../config/database.js').then(mod => mod.default);

    // Verify class belongs to school
    const classCheck = await pool.query(
      'SELECT class_id FROM classes WHERE class_id = $1 AND school_id = $2',
      [classId, schoolId]
    );

    if (classCheck.rows.length === 0) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to access this class'
      });
    }

    const query = `
      SELECT 
        cta.*,
        u.first_name,
        u.last_name,
        u.email,
        u.phone
      FROM class_teacher_assignments cta
      JOIN users u ON cta.teacher_id = u.user_id
      WHERE cta.class_id = $1
      ORDER BY cta.is_primary DESC, u.first_name, u.last_name
    `;

    const result = await pool.query(query, [classId]);

    res.status(200).json({
      status: 'success',
      data: { teachers: result.rows }
    });
  } catch (error) {
    console.error('Get class teachers error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get class teachers'
    });
  }
};

// @desc    Get class learners
// @route   GET /api/school-admin/classes/:classId/learners
// @access  Private (School Admin)
export const getClassLearners = async (req, res) => {
  try {
    const { classId } = req.params;
    const schoolId = req.user.schoolId;

    const pool = await import('../config/database.js').then(mod => mod.default);

    // Verify class belongs to school
    const classCheck = await pool.query(
      'SELECT class_id FROM classes WHERE class_id = $1 AND school_id = $2',
      [classId, schoolId]
    );

    if (classCheck.rows.length === 0) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to access this class'
      });
    }

    const query = `
      SELECT 
        l.*,
        u.first_name,
        u.last_name,
        u.email,
        lp.overall_percentage,
        lp.topic_mastery_percentage,
        lp.assessments_completed,
        lp.assessments_total
      FROM learners l
      JOIN users u ON l.user_id = u.user_id
      LEFT JOIN learner_progress lp ON l.learner_id = lp.learner_id AND lp.class_id = $1
      WHERE l.current_class_id = $1 AND l.academic_status = 'active'
      ORDER BY u.last_name, u.first_name
    `;

    const result = await pool.query(query, [classId]);

    res.status(200).json({
      status: 'success',
      data: { learners: result.rows }
    });
  } catch (error) {
    console.error('Get class learners error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get class learners'
    });
  }
};

// @desc    Get class curriculum
// @route   GET /api/school-admin/classes/:classId/curriculum
// @access  Private (School Admin)
export const getClassCurriculum = async (req, res) => {
  try {
    const { classId } = req.params;
    const schoolId = req.user.schoolId;

    const pool = await import('../config/database.js').then(mod => mod.default);

    // Verify class belongs to school
    const classCheck = await pool.query(
      'SELECT grade_level, academic_year FROM classes WHERE class_id = $1 AND school_id = $2',
      [classId, schoolId]
    );

    if (classCheck.rows.length === 0) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to access this class'
      });
    }

    const classData = classCheck.rows[0];

    const query = `
      SELECT 
        c.curriculum_name,
        s.subject_name,
        s.subject_code,
        s.grade_level,
        json_agg(
          json_build_object(
            'topic_id', t.topic_id,
            'topic_name', t.topic_name,
            'topic_code', t.topic_code,
            'description', t.description,
            'learning_objectives', t.learning_objectives
          ) ORDER BY t.topic_name
        ) as topics
      FROM school_curriculum_assignments sca
      JOIN curricula c ON sca.curriculum_id = c.curriculum_id
      JOIN subjects s ON c.curriculum_id = s.curriculum_id
      LEFT JOIN topics t ON s.subject_id = t.subject_id AND t.is_active = true
      WHERE sca.school_id = $1 
        AND sca.grade_level IN ($2, 'R-3')
        AND sca.academic_year = $3
        AND sca.is_active = true
        AND s.is_active = true
      GROUP BY c.curriculum_name, s.subject_name, s.subject_code, s.grade_level
      ORDER BY c.curriculum_name, s.subject_name
    `;

    const result = await pool.query(query, [
      schoolId,
      classData.grade_level,
      classData.academic_year
    ]);

    res.status(200).json({
      status: 'success',
      data: { curriculum: result.rows }
    });
  } catch (error) {
    console.error('Get class curriculum error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get class curriculum'
    });
  }
};
// @desc    Toggle class activation status
// @route   PATCH /api/school-admin/classes/:classId/toggle-status
// @access  Private (School Admin)
export const toggleClassStatus = async (req, res) => {
  try {
    const { classId } = req.params;
    const { is_active } = req.body;
    const schoolId = req.user.schoolId;

    const pool = await import('../config/database.js').then(mod => mod.default);

    // Verify class belongs to school
    const classCheck = await pool.query(
      'SELECT class_id FROM classes WHERE class_id = $1 AND school_id = $2',
      [classId, schoolId]
    );

    if (classCheck.rows.length === 0) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to update this class'
      });
    }

    // Update class status
    await pool.query(
      'UPDATE classes SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE class_id = $2',
      [is_active, classId]
    );

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs 
       (user_id, school_id, action_type, action_details)
       VALUES ($1, $2, $3, $4)`,
      [
        req.user.userId,
        schoolId,
        is_active ? 'CLASS_ACTIVATED' : 'CLASS_DEACTIVATED',
        JSON.stringify({
          class_id: classId,
          status: is_active ? 'active' : 'inactive',
          changed_by: req.user.email
        })
      ]
    );

    res.status(200).json({
      status: 'success',
      message: `Class ${is_active ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('Toggle class status error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update class status'
    });
  }
};
// @desc    Assign learner to class
// @route   POST /api/school-admin/classes/:classId/assign-learner
// @access  Private (School Admin)
export const assignLearnerToClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const { learner_id } = req.body;
    const schoolId = req.user.schoolId;

    const pool = await import('../config/database.js').then(mod => mod.default);

    // Verify class belongs to school
    const classCheck = await pool.query(
      `SELECT c.*, COUNT(l.learner_id) as current_enrollment 
       FROM classes c
       LEFT JOIN learners l ON c.class_id = l.current_class_id AND l.academic_status = 'active'
       WHERE c.class_id = $1 AND c.school_id = $2
       GROUP BY c.class_id`,
      [classId, schoolId]
    );

    if (classCheck.rows.length === 0) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to access this class'
      });
    }

    const classData = classCheck.rows[0];

    // Check if class is at capacity
    if (classData.current_enrollment >= classData.max_capacity) {
      return res.status(400).json({
        status: 'error',
        message: `Class is at maximum capacity (${classData.max_capacity})`
      });
    }

    // Verify learner belongs to school and is active
    const learnerCheck = await pool.query(
      `SELECT l.*, u.first_name, u.last_name 
       FROM learners l
       JOIN users u ON l.user_id = u.user_id
       WHERE l.learner_id = $1 AND l.school_id = $2 AND l.academic_status = 'active'`,
      [learner_id, schoolId]
    );

    if (learnerCheck.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Learner not found or not active'
      });
    }

    const learner = learnerCheck.rows[0];

    // Check if learner is already assigned to a class in the same academic year
    if (learner.current_class_id) {
      const currentClassCheck = await pool.query(
        'SELECT academic_year FROM classes WHERE class_id = $1',
        [learner.current_class_id]
      );

      if (currentClassCheck.rows.length > 0 && 
          currentClassCheck.rows[0].academic_year === classData.academic_year) {
        return res.status(400).json({
          status: 'error',
          message: 'Learner is already assigned to a class for this academic year'
        });
      }

      // Archive previous class assignment
      await pool.query(
        `INSERT INTO learner_class_history 
         (learner_id, class_id, academic_year, status, completed_date, notes)
         VALUES ($1, $2, $3, 'transferred', CURRENT_DATE, 'Transferred to new class')`,
        [
          learner_id,
          learner.current_class_id,
          classData.academic_year
        ]
      );
    }

    // Update learner's current class
    await pool.query(
      `UPDATE learners 
       SET current_class_id = $1, updated_at = CURRENT_TIMESTAMP
       WHERE learner_id = $2`,
      [classId, learner_id]
    );

    // Record new enrollment in history
    await pool.query(
      `INSERT INTO learner_class_history 
       (learner_id, class_id, academic_year, status, enrolled_date)
       VALUES ($1, $2, $3, 'active', CURRENT_DATE)`,
      [learner_id, classId, classData.academic_year]
    );

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs 
       (user_id, school_id, action_type, action_details)
       VALUES ($1, $2, $3, $4)`,
      [
        req.user.userId,
        schoolId,
        'LEARNER_ASSIGNED_TO_CLASS',
        JSON.stringify({
          class_id: classId,
          learner_id: learner_id,
          learner_name: `${learner.first_name} ${learner.last_name}`,
          assigned_by: req.user.email
        })
      ]
    );

    res.status(200).json({
      status: 'success',
      message: 'Learner assigned to class successfully',
      data: {
        learner: {
          id: learner_id,
          name: `${learner.first_name} ${learner.last_name}`
        },
        class: {
          id: classId,
          name: classData.class_name,
          grade_level: classData.grade_level
        }
      }
    });
  } catch (error) {
    console.error('Assign learner to class error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to assign learner to class'
    });
  }
};
// @desc    Remove learner from class
// @route   DELETE /api/school-admin/classes/:classId/learners/:learnerId
// @access  Private (School Admin)
export const removeLearnerFromClass = async (req, res) => {
  try {
    const { classId, learnerId } = req.params;
    const schoolId = req.user.schoolId;

    const pool = await import('../config/database.js').then(mod => mod.default);

    // Verify class belongs to school
    const classCheck = await pool.query(
      'SELECT class_id FROM classes WHERE class_id = $1 AND school_id = $2',
      [classId, schoolId]
    );

    if (classCheck.rows.length === 0) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to access this class'
      });
    }

    // Get learner details
    const learnerCheck = await pool.query(
      `SELECT l.*, u.first_name, u.last_name 
       FROM learners l
       JOIN users u ON l.user_id = u.user_id
       WHERE l.learner_id = $1 AND l.school_id = $2`,
      [learnerId, schoolId]
    );

    if (learnerCheck.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Learner not found'
      });
    }

    const learner = learnerCheck.rows[0];

    // Verify learner is in this class
    if (learner.current_class_id !== classId) {
      return res.status(400).json({
        status: 'error',
        message: 'Learner is not assigned to this class'
      });
    }

    // Update learner to remove class assignment
    await pool.query(
      `UPDATE learners 
       SET current_class_id = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE learner_id = $1`,
      [learnerId]
    );

    // Update learner class history
    await pool.query(
      `UPDATE learner_class_history 
       SET status = 'removed', completed_date = CURRENT_DATE,
           notes = 'Removed from class by admin'
       WHERE learner_id = $1 AND class_id = $2 AND completed_date IS NULL`,
      [learnerId, classId]
    );

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs 
       (user_id, school_id, action_type, action_details)
       VALUES ($1, $2, $3, $4)`,
      [
        req.user.userId,
        schoolId,
        'LEARNER_REMOVED_FROM_CLASS',
        JSON.stringify({
          class_id: classId,
          learner_id: learnerId,
          learner_name: `${learner.first_name} ${learner.last_name}`,
          removed_by: req.user.email
        })
      ]
    );

    res.status(200).json({
      status: 'success',
      message: 'Learner removed from class successfully'
    });
  } catch (error) {
    console.error('Remove learner from class error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to remove learner from class'
    });
  }
};

// @desc    Get available learners for class assignment
// @route   GET /api/school-admin/classes/:classId/available-learners
// @access  Private (School Admin)
export const getAvailableLearners = async (req, res) => {
  try {
    const { classId } = req.params;
    const schoolId = req.user.schoolId;

    const pool = await import('../config/database.js').then(mod => mod.default);

    // Get class academic year
    const classCheck = await pool.query(
      'SELECT academic_year, grade_level FROM classes WHERE class_id = $1 AND school_id = $2',
      [classId, schoolId]
    );

    if (classCheck.rows.length === 0) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to access this class'
      });
    }

    const classData = classCheck.rows[0];

    // Get learners who are not assigned to any class for this academic year
    // OR are in a different grade level
    const query = `
      SELECT 
        l.learner_id,
        u.first_name,
        u.last_name,
        u.email,
        l.date_of_birth,
        l.gender,
        l.guardian_name,
        l.guardian_email,
        c2.class_name as current_class,
        c2.grade_level as current_grade,
        c2.academic_year as current_year
      FROM learners l
      JOIN users u ON l.user_id = u.user_id
      LEFT JOIN classes c2 ON l.current_class_id = c2.class_id
      WHERE l.school_id = $1 
        AND l.academic_status = 'active'
        AND (
          -- Not assigned to any class
          l.current_class_id IS NULL 
          OR 
          -- Assigned to different academic year
          c2.academic_year != $2
          OR
          -- Assigned to different grade (for promotion/repetition)
          (c2.grade_level != $3 AND c2.academic_year = $2)
        )
      ORDER BY u.last_name, u.first_name
    `;

    const result = await pool.query(query, [
      schoolId, 
      classData.academic_year,
      classData.grade_level
    ]);

    res.status(200).json({
      status: 'success',
      data: { learners: result.rows }
    });
  } catch (error) {
    console.error('Get available learners error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get available learners'
    });
  }
};
// @desc    Get teacher details with assigned classes
// @route   GET /api/school-admin/teachers/:teacherId/classes
// @access  Private (School Admin)
export const getTeacherClasses = async (req, res) => {
  try {
    const { teacherId } = req.params;
    const schoolId = req.user.schoolId;

    const pool = await import('../config/database.js').then(mod => mod.default);
    
    // Verify teacher belongs to school
    const teacherCheck = await pool.query(
      'SELECT user_id FROM users WHERE user_id = $1 AND school_id = $2 AND role = $3',
      [teacherId, schoolId, 'teacher']
    );

    if (teacherCheck.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Teacher not found'
      });
    }

    // Get assigned classes
    const query = `
      SELECT 
        c.class_id,
        c.class_name,
        c.grade_level,
        c.academic_year,
        c.is_active,
        cta.is_primary,
        cta.assigned_at
      FROM class_teacher_assignments cta
      JOIN classes c ON cta.class_id = c.class_id
      WHERE cta.teacher_id = $1
      ORDER BY c.academic_year DESC, c.grade_level, c.class_name
    `;

    const result = await pool.query(query, [teacherId]);

    res.status(200).json({
      status: 'success',
      data: { classes: result.rows }
    });
  } catch (error) {
    console.error('Get teacher classes error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get teacher classes'
    });
  }
};

// @desc    Update teacher details
// @route   PUT /api/school-admin/teachers/:teacherId
// @access  Private (School Admin)
export const updateTeacher = async (req, res) => {
  try {
    const { teacherId } = req.params;
    const schoolId = req.user.schoolId;
    const { first_name, last_name, email, phone, is_active } = req.body;

    const pool = await import('../config/database.js').then(mod => mod.default);

    // Verify teacher belongs to school
    const teacherCheck = await pool.query(
      'SELECT user_id FROM users WHERE user_id = $1 AND school_id = $2 AND role = $3',
      [teacherId, schoolId, 'teacher']
    );

    if (teacherCheck.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Teacher not found'
      });
    }

    // Check if email is already taken by another user in the same school
    if (email) {
      const emailCheck = await pool.query(
        'SELECT user_id FROM users WHERE email = $1 AND school_id = $2 AND user_id != $3',
        [email, schoolId, teacherId]
      );

      if (emailCheck.rows.length > 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Email already exists in this school'
        });
      }
    }

    // Update teacher
    const query = `
      UPDATE users 
      SET 
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        email = COALESCE($3, email),
        phone = COALESCE($4, phone),
        is_active = COALESCE($5, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $6
      RETURNING user_id, first_name, last_name, email, phone, is_active, last_login, created_at
    `;

    const result = await pool.query(query, [
      first_name,
      last_name,
      email,
      phone,
      is_active,
      teacherId
    ]);

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs 
       (user_id, school_id, action_type, action_details)
       VALUES ($1, $2, $3, $4)`,
      [
        req.user.userId,
        schoolId,
        'TEACHER_UPDATED',
        JSON.stringify({
          teacher_id: teacherId,
          updated_fields: Object.keys(req.body),
          updated_by: req.user.email
        })
      ]
    );

    res.status(200).json({
      status: 'success',
      message: 'Teacher updated successfully',
      data: { teacher: result.rows[0] }
    });
  } catch (error) {
    console.error('Update teacher error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update teacher'
    });
  }
};

// @desc    Change teacher password
// @route   PATCH /api/school-admin/teachers/:teacherId/password
// @access  Private (School Admin)
export const changeTeacherPassword = async (req, res) => {
  try {
    const { teacherId } = req.params;
    const schoolId = req.user.schoolId;
    const { new_password } = req.body;

    const pool = await import('../config/database.js').then(mod => mod.default);

    // Verify teacher belongs to school
    const teacherCheck = await pool.query(
      'SELECT user_id, email, first_name, last_name FROM users WHERE user_id = $1 AND school_id = $2 AND role = $3',
      [teacherId, schoolId, 'teacher']
    );

    if (teacherCheck.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Teacher not found'
      });
    }

    // Hash new password
    const bcrypt = await import('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(new_password, salt);

    // Update password
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
      [passwordHash, teacherId]
    );

    // Get super admin contact for notification
    const superAdminQuery = `
      SELECT email, phone FROM users 
      WHERE role = 'super_admin' 
      ORDER BY created_at ASC 
      LIMIT 1
    `;
    const superAdminResult = await pool.query(superAdminQuery);
    const superAdminContact = superAdminResult.rows[0] || { email: 'admin@edulens.com', phone: 'N/A' };

    // Send password change notification
    const emailService = await import('../services/emailService.js').then(mod => mod.default);
    const teacher = teacherCheck.rows[0];
    
    try {
      await emailService.sendPasswordChangedNotification(
        teacher.email,
        teacher.first_name,
        teacher.last_name,
        superAdminContact
      );
    } catch (emailError) {
      console.error('Failed to send password change notification:', emailError);
      // Continue even if email fails
    }

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs 
       (user_id, school_id, action_type, action_details)
       VALUES ($1, $2, $3, $4)`,
      [
        req.user.userId,
        schoolId,
        'TEACHER_PASSWORD_CHANGED',
        JSON.stringify({
          teacher_id: teacherId,
          teacher_email: teacher.email,
          changed_by: req.user.email
        })
      ]
    );

    res.status(200).json({
      status: 'success',
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change teacher password error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to change password'
    });
  }
};

// @desc    Toggle teacher active status
// @route   PATCH /api/school-admin/teachers/:teacherId/toggle-active
// @access  Private (School Admin)
export const toggleTeacherActiveStatus = async (req, res) => {
  try {
    const { teacherId } = req.params;
    const schoolId = req.user.schoolId;
    const { is_active } = req.body;

    const pool = await import('../config/database.js').then(mod => mod.default);

    // Verify teacher belongs to school
    const teacherCheck = await pool.query(
      'SELECT user_id, email, first_name, last_name FROM users WHERE user_id = $1 AND school_id = $2 AND role = $3',
      [teacherId, schoolId, 'teacher']
    );

    if (teacherCheck.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Teacher not found'
      });
    }

    // Update status
    await pool.query(
      'UPDATE users SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
      [is_active, teacherId]
    );

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs 
       (user_id, school_id, action_type, action_details)
       VALUES ($1, $2, $3, $4)`,
      [
        req.user.userId,
        schoolId,
        is_active ? 'TEACHER_ACTIVATED' : 'TEACHER_DEACTIVATED',
        JSON.stringify({
          teacher_id: teacherId,
          teacher_email: teacherCheck.rows[0].email,
          status: is_active ? 'active' : 'inactive',
          changed_by: req.user.email
        })
      ]
    );

    res.status(200).json({
      status: 'success',
      message: `Teacher ${is_active ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('Toggle teacher status error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update teacher status'
    });
  }
};

// @desc    Get single teacher
// @route   GET /api/school-admin/teachers/:teacherId
// @access  Private (School Admin)
export const getTeacherById = async (req, res) => {
  try {
    const { teacherId } = req.params;
    const schoolId = req.user.schoolId;

    const pool = await import('../config/database.js').then(mod => mod.default);
    
    const query = `
      SELECT 
        u.*,
        COUNT(DISTINCT cta.class_id) as assigned_classes_count,
        json_agg(
          DISTINCT jsonb_build_object(
            'class_id', c.class_id,
            'class_name', c.class_name,
            'grade_level', c.grade_level
          )
        ) as assigned_classes
      FROM users u
      LEFT JOIN class_teacher_assignments cta ON u.user_id = cta.teacher_id
      LEFT JOIN classes c ON cta.class_id = c.class_id
      WHERE u.user_id = $1 
        AND u.school_id = $2 
        AND u.role = 'teacher'
      GROUP BY u.user_id
    `;

    const result = await pool.query(query, [teacherId, schoolId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Teacher not found'
      });
    }

    res.status(200).json({
      status: 'success',
      data: { teacher: result.rows[0] }
    });
  } catch (error) {
    console.error('Get teacher by ID error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get teacher details'
    });
  }
};
// @desc    Get learner performance data
// @route   GET /api/school-admin/learners/:learnerId/performance
// @access  Private (School Admin)
export const getLearnerPerformance = async (req, res) => {
  try {
    const { learnerId } = req.params;
    const schoolId = req.user.schoolId;

    const pool = await import('../config/database.js').then(mod => mod.default);

    // Verify learner belongs to school
    const learnerCheck = await pool.query(
      `SELECT l.*, u.first_name, u.last_name 
       FROM learners l
       JOIN users u ON l.user_id = u.user_id
       WHERE l.learner_id = $1 AND l.school_id = $2`,
      [learnerId, schoolId]
    );

    if (learnerCheck.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Learner not found'
      });
    }

    // Get academic performance
    const performanceQuery = `
      SELECT 
        lp.overall_percentage as average_percentage,
        lp.assessments_completed,
        lp.assessments_total,
        lp.topic_mastery_percentage,
        lp.topics_covered,
        lp.calculated_at
      FROM learner_progress lp
      WHERE lp.learner_id = $1
      ORDER BY lp.calculated_at DESC
      LIMIT 1
    `;

    // Get recent assessments
    const assessmentsQuery = `
      SELECT 
        a.assessment_name,
        s.subject_name,
        g.percentage,
        g.grade_letter,
        a.scheduled_date,
        a.term_number
      FROM grades g
      JOIN assessments a ON g.assessment_id = a.assessment_id
      LEFT JOIN subjects s ON a.subject_id = s.subject_id
      WHERE g.learner_id = $1
      ORDER BY a.scheduled_date DESC
      LIMIT 10
    `;

    // Get class history
    const historyQuery = `
      SELECT 
        lch.*,
        c.class_name,
        c.grade_level
      FROM learner_class_history lch
      LEFT JOIN classes c ON lch.class_id = c.class_id
      WHERE lch.learner_id = $1
      ORDER BY lch.academic_year DESC, lch.enrolled_date DESC
    `;

    const [performanceResult, assessmentsResult, historyResult] = await Promise.all([
      pool.query(performanceQuery, [learnerId]),
      pool.query(assessmentsQuery, [learnerId]),
      pool.query(historyQuery, [learnerId])
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        learner: learnerCheck.rows[0],
        average_percentage: performanceResult.rows[0]?.average_percentage || 0,
        completed_assessments: performanceResult.rows[0]?.assessments_completed || 0,
        total_assessments: performanceResult.rows[0]?.assessments_total || 0,
        topics_covered: performanceResult.rows[0]?.topics_covered || 0,
        recent_assessments: assessmentsResult.rows,
        class_history: historyResult.rows
      }
    });
  } catch (error) {
    console.error('Get learner performance error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get learner performance'
    });
  }
};

// @desc    Update learner details
// @route   PUT /api/school-admin/learners/:learnerId
// @access  Private (School Admin)
export const updateLearner = async (req, res) => {
  try {
    const { learnerId } = req.params;
    const schoolId = req.user.schoolId;
    const {
      first_name,
      last_name,
      date_of_birth,
      gender,
      guardian_name,
      guardian_email,
      guardian_phone,
      has_special_needs,
      special_needs_notes,
      medical_notes,
      academic_status
    } = req.body;

    const pool = await import('../config/database.js').then(mod => mod.default);

    // Verify learner belongs to school
    const learnerCheck = await pool.query(
      `SELECT l.*, u.user_id 
       FROM learners l
       JOIN users u ON l.user_id = u.user_id
       WHERE l.learner_id = $1 AND l.school_id = $2`,
      [learnerId, schoolId]
    );

    if (learnerCheck.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Learner not found'
      });
    }

    // Update user table (first_name, last_name)
    await pool.query(
      `UPDATE users 
       SET first_name = $1, last_name = $2, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $3`,
      [first_name, last_name, learnerCheck.rows[0].user_id]
    );

    // Update learner table
    const query = `
      UPDATE learners 
      SET 
        date_of_birth = $1,
        gender = $2,
        guardian_name = $3,
        guardian_email = $4,
        guardian_phone = $5,
        has_special_needs = $6,
        special_needs_notes = $7,
        medical_notes = $8,
        academic_status = $9,
        updated_at = CURRENT_TIMESTAMP
      WHERE learner_id = $10
      RETURNING *
    `;

    const result = await pool.query(query, [
      date_of_birth,
      gender,
      guardian_name,
      guardian_email,
      guardian_phone,
      has_special_needs || false,
      special_needs_notes,
      medical_notes,
      academic_status,
      learnerId
    ]);

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs 
       (user_id, school_id, action_type, action_details)
       VALUES ($1, $2, $3, $4)`,
      [
        req.user.userId,
        schoolId,
        'LEARNER_UPDATED',
        JSON.stringify({
          learner_id: learnerId,
          updated_fields: Object.keys(req.body),
          updated_by: req.user.email
        })
      ]
    );

    res.status(200).json({
      status: 'success',
      message: 'Learner updated successfully',
      data: { learner: result.rows[0] }
    });
  } catch (error) {
    console.error('Update learner error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update learner'
    });
  }
};

// @desc    Update learner status
// @route   PATCH /api/school-admin/learners/:learnerId/status
// @access  Private (School Admin)
export const updateLearnerStatus = async (req, res) => {
  try {
    const { learnerId } = req.params;
    const schoolId = req.user.schoolId;
    const { academic_status } = req.body;

    const pool = await import('../config/database.js').then(mod => mod.default);

    // Verify learner belongs to school
    const learnerCheck = await pool.query(
      `SELECT l.*, u.first_name, u.last_name 
       FROM learners l
       JOIN users u ON l.user_id = u.user_id
       WHERE l.learner_id = $1 AND l.school_id = $2`,
      [learnerId, schoolId]
    );

    if (learnerCheck.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Learner not found'
      });
    }

    // Update learner status
    await pool.query(
      `UPDATE learners 
       SET academic_status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE learner_id = $2`,
      [academic_status, learnerId]
    );

    // Update user status if archived
    if (academic_status === 'archived' || academic_status === 'inactive') {
      await pool.query(
        `UPDATE users 
         SET is_active = false, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1`,
        [learnerCheck.rows[0].user_id]
      );
    } else if (academic_status === 'active') {
      await pool.query(
        `UPDATE users 
         SET is_active = true, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1`,
        [learnerCheck.rows[0].user_id]
      );
    }

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs 
       (user_id, school_id, action_type, action_details)
       VALUES ($1, $2, $3, $4)`,
      [
        req.user.userId,
        schoolId,
        'LEARNER_STATUS_UPDATED',
        JSON.stringify({
          learner_id: learnerId,
          learner_name: `${learnerCheck.rows[0].first_name} ${learnerCheck.rows[0].last_name}`,
          new_status: academic_status,
          changed_by: req.user.email
        })
      ]
    );

    res.status(200).json({
      status: 'success',
      message: `Learner status updated to ${academic_status}`
    });
  } catch (error) {
    console.error('Update learner status error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update learner status'
    });
  }
};
// @desc    Get learner by ID
// @route   GET /api/school-admin/learners/:learnerId
// @access  Private (School Admin)
export const getLearnerById = async (req, res) => {
  try {
    const { learnerId } = req.params;
    const schoolId = req.user.schoolId;

    const pool = await import('../config/database.js').then(mod => mod.default);
    
    const query = `
      SELECT 
        l.*,
        u.first_name,
        u.last_name,
        u.email,
        u.is_active as user_active,
        c.class_name,
        c.grade_level
      FROM learners l
      JOIN users u ON l.user_id = u.user_id
      LEFT JOIN classes c ON l.current_class_id = c.class_id
      WHERE l.learner_id = $1 AND l.school_id = $2
    `;

    const result = await pool.query(query, [learnerId, schoolId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Learner not found'
      });
    }

    res.status(200).json({
      status: 'success',
      data: { learner: result.rows[0] }
    });
  } catch (error) {
    console.error('Get learner by ID error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get learner details'
    });
  }
};