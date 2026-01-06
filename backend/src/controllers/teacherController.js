import ClassModel from '../models/Class.js';
import Assessment from '../models/Assessment.js';
import Worksheet from '../models/Worksheet.js';
import pool from '../config/database.js';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import xlsx from 'xlsx';

// @desc    Get teacher dashboard
// @route   GET /api/teacher/dashboard
// @access  Private (Teacher)
export const getDashboard = async (req, res) => {
  try {
    const teacherId = req.user.userId;

    // Get teacher's classes
    const classes = await ClassModel.getByTeacher(teacherId, new Date().getFullYear());

    // Get recent assessments
    const recentAssessments = await Assessment.getByTeacher(teacherId, {
      limit: 5,
      page: 1
    });

    // Get statistics for each class
    const classStats = await Promise.all(
      classes.map(async (classItem) => {
        const stats = await ClassModel.getStatistics(classItem.class_id);
        return {
          ...classItem,
          stats
        };
      })
    );

    res.status(200).json({
      status: 'success',
      data: {
        classes: classStats,
        recentAssessments: recentAssessments.assessments,
        totalClasses: classes.length
      }
    });
  } catch (error) {
    console.error('Get teacher dashboard error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get dashboard data'
    });
  }
};

// @desc    Get class details
// @route   GET /api/teacher/classes/:classId
// @access  Private (Teacher)
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

    // Verify teacher has access to this class
    const teacherClasses = await ClassModel.getByTeacher(req.user.userId);
    const hasAccess = teacherClasses.some(c => c.class_id === classId);
    
    if (!hasAccess) {
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

// @desc    Get learners in a class
// @route   GET /api/teacher/classes/:classId/learners
// @access  Private (Teacher)
export const getClassLearners = async (req, res) => {
  try {
    const { classId } = req.params;
    const teacherId = req.user.userId;

    // Verify teacher has access to this class
    const teacherClasses = await ClassModel.getByTeacher(teacherId);
    const hasAccess = teacherClasses.some(c => c.class_id === classId);
    
    if (!hasAccess) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to access this class'
      });
    }

    // Get learners with their grades and performance
    const query = `
      SELECT 
        l.learner_id,
        l.user_id,
        u.first_name,
        u.last_name,
        u.email,
        u.profile_image_url,
        l.date_of_birth,
        l.gender,
        l.academic_status,
        l.enrollment_date,
        l.guardian_name,
        l.guardian_email,
        l.guardian_phone,
        l.has_special_needs,
        l.special_needs_notes,
        (
          SELECT COUNT(*)
          FROM grades g
          JOIN assessments a ON g.assessment_id = a.assessment_id
          WHERE g.learner_id = l.learner_id 
            AND g.is_graded = true
            AND a.class_id = $1
        ) as assessments_taken,
        (
          SELECT ROUND(AVG(g.percentage), 2)
          FROM grades g
          JOIN assessments a ON g.assessment_id = a.assessment_id
          WHERE g.learner_id = l.learner_id 
            AND g.is_graded = true
            AND a.class_id = $1
        ) as average_score
      FROM learners l
      JOIN users u ON l.user_id = u.user_id
      WHERE l.current_class_id = $1
        AND l.academic_status = 'active'
      ORDER BY u.last_name, u.first_name
    `;

    const result = await pool.query(query, [classId]);

    res.status(200).json({
      status: 'success',
      data: {
        learners: result.rows
      }
    });
  } catch (error) {
    console.error('Get class learners error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get class learners'
    });
  }
};

// @desc    Get class assessments with grades
// @route   GET /api/teacher/classes/:classId/assessments
// @access  Private (Teacher)
export const getClassAssessments = async (req, res) => {
  try {
    const { classId } = req.params;
    const { term_number, subject_id, assessment_type } = req.query;

    // Verify teacher has access to this class
    const teacherClasses = await ClassModel.getByTeacher(req.user.userId);
    const hasAccess = teacherClasses.some(c => c.class_id === classId);
    
    if (!hasAccess) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to access this class'
      });
    }

    const filters = {};
    if (term_number) filters.term_number = term_number;
    if (subject_id) filters.subject_id = subject_id;
    if (assessment_type) filters.assessment_type = assessment_type;

    const assessments = await Assessment.getByClass(classId, filters);

    // Get grades for each assessment
    const assessmentsWithGrades = await Promise.all(
      assessments.map(async (assessment) => {
        const gradesQuery = `
          SELECT 
            g.learner_id,
            g.marks_obtained,
            g.percentage,
            g.grade_letter,
            g.is_graded,
            g.teacher_feedback,
            u.first_name,
            u.last_name
          FROM grades g
          JOIN learners l ON g.learner_id = l.learner_id
          JOIN users u ON l.user_id = u.user_id
          WHERE g.assessment_id = $1
          ORDER BY u.last_name, u.first_name
        `;

        const gradesResult = await pool.query(gradesQuery, [assessment.assessment_id]);

        return {
          ...assessment,
          grades: gradesResult.rows
        };
      })
    );

    res.status(200).json({
      status: 'success',
      data: { assessments: assessmentsWithGrades }
    });
  } catch (error) {
    console.error('Get class assessments error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get assessments'
    });
  }
};

// @desc    Get class statistics
// @route   GET /api/teacher/classes/:classId/statistics
// @access  Private (Teacher)
export const getClassStatistics = async (req, res) => {
  try {
    const { classId } = req.params;
    const teacherId = req.user.userId;

    // Verify teacher has access to this class
    const teacherClasses = await ClassModel.getByTeacher(teacherId);
    const hasAccess = teacherClasses.some(c => c.class_id === classId);
    
    if (!hasAccess) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to access this class'
      });
    }

    // Get comprehensive statistics
    const statsQuery = `
      WITH class_learners AS (
        SELECT learner_id FROM learners WHERE current_class_id = $1 AND academic_status = 'active'
      ),
      assessment_stats AS (
        SELECT 
          a.assessment_id,
          a.assessment_name,
          a.subject_id,
          s.subject_name,
          a.term_number,
          COUNT(g.grade_id) as graded_count,
          ROUND(AVG(g.percentage)::numeric, 2) as average_percentage,
          ROUND(MIN(g.percentage)::numeric, 2) as min_percentage,
          ROUND(MAX(g.percentage)::numeric, 2) as max_percentage
        FROM assessments a
        LEFT JOIN subjects s ON a.subject_id = s.subject_id
        LEFT JOIN grades g ON a.assessment_id = g.assessment_id AND g.is_graded = true
        WHERE a.class_id = $1
        GROUP BY a.assessment_id, a.assessment_name, a.subject_id, s.subject_name, a.term_number
        ORDER BY a.scheduled_date DESC
      ),
      learner_performance AS (
        SELECT 
          l.learner_id,
          u.first_name,
          u.last_name,
          COUNT(g.grade_id) as total_assessments,
          ROUND(AVG(g.percentage)::numeric, 2) as average_score
        FROM learners l
        JOIN users u ON l.user_id = u.user_id
        LEFT JOIN grades g ON l.learner_id = g.learner_id AND g.is_graded = true
        LEFT JOIN assessments a ON g.assessment_id = a.assessment_id AND a.class_id = $1
        WHERE l.current_class_id = $1
        GROUP BY l.learner_id, u.first_name, u.last_name
      ),
      subject_performance AS (
        SELECT 
          s.subject_name,
          COUNT(DISTINCT a.assessment_id) as total_assessments,
          ROUND(AVG(g.percentage)::numeric, 2) as average_score
        FROM assessments a
        JOIN subjects s ON a.subject_id = s.subject_id
        LEFT JOIN grades g ON a.assessment_id = g.assessment_id AND g.is_graded = true
        WHERE a.class_id = $1
        GROUP BY s.subject_name
      ),
      term_performance AS (
        SELECT 
          a.term_number,
          COUNT(DISTINCT a.assessment_id) as total_assessments,
          ROUND(AVG(g.percentage)::numeric, 2) as average_score
        FROM assessments a
        LEFT JOIN grades g ON a.assessment_id = g.assessment_id AND g.is_graded = true
        WHERE a.class_id = $1
        GROUP BY a.term_number
      )
      SELECT 
        (SELECT COUNT(*) FROM class_learners) as total_learners,
        (SELECT COUNT(*) FROM assessments WHERE class_id = $1) as total_assessments,
        (SELECT json_agg(row_to_json(assessment_stats)) FROM assessment_stats) as assessment_stats,
        (SELECT json_agg(row_to_json(learner_performance)) FROM learner_performance) as learner_performance,
        (SELECT json_agg(row_to_json(subject_performance)) FROM subject_performance) as subject_performance,
        (SELECT json_agg(row_to_json(term_performance)) FROM term_performance) as term_performance
    `;

    const statsResult = await pool.query(statsQuery, [classId]);

    // Calculate performance distribution
    const distributionQuery = `
      SELECT 
        COUNT(CASE WHEN avg_score >= 80 THEN 1 END) as excellent,
        COUNT(CASE WHEN avg_score >= 60 AND avg_score < 80 THEN 1 END) as good,
        COUNT(CASE WHEN avg_score >= 40 AND avg_score < 60 THEN 1 END) as average,
        COUNT(CASE WHEN avg_score < 40 THEN 1 END) as needs_improvement
      FROM (
        SELECT 
          l.learner_id,
          COALESCE(AVG(g.percentage), 0) as avg_score
        FROM learners l
        LEFT JOIN grades g ON l.learner_id = g.learner_id AND g.is_graded = true
        LEFT JOIN assessments a ON g.assessment_id = a.assessment_id AND a.class_id = $1
        WHERE l.current_class_id = $1
        GROUP BY l.learner_id
      ) as scores
    `;

    const distributionResult = await pool.query(distributionQuery, [classId]);

    res.status(200).json({
      status: 'success',
      data: {
        statistics: statsResult.rows[0],
        performance_distribution: distributionResult.rows[0]
      }
    });
  } catch (error) {
    console.error('Get class statistics error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get class statistics'
    });
  }
};

// @desc    Bulk add learners to teacher's class
// @route   POST /api/teacher/classes/:classId/learners/bulk
// @access  Private (Teacher)
export const bulkAddLearners = async (req, res) => {
  try {
    const { classId } = req.params;
    const { learners } = req.body;
    const teacherId = req.user.userId;
    const schoolId = req.user.schoolId;

    // Verify teacher has access to this class
    const teacherClasses = await ClassModel.getByTeacher(teacherId);
    const hasAccess = teacherClasses.some(c => c.class_id === classId);
    
    if (!hasAccess) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to add learners to this class'
      });
    }

    // Get class details to check capacity
    const classQuery = `
      SELECT 
        c.*,
        COUNT(l.learner_id) as current_enrollment
      FROM classes c
      LEFT JOIN learners l ON c.class_id = l.current_class_id AND l.academic_status = 'active'
      WHERE c.class_id = $1
      GROUP BY c.class_id
    `;
    
    const classResult = await pool.query(classQuery, [classId]);
    if (classResult.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Class not found'
      });
    }

    const classData = classResult.rows[0];
    const availableSlots = (classData.max_capacity || 30) - classData.current_enrollment;

    if (learners.length > availableSlots) {
      return res.status(400).json({
        status: 'error',
        message: `Class only has ${availableSlots} available slots. You tried to add ${learners.length} learners.`
      });
    }

    const results = {
      summary: {
        total: learners.length,
        success: 0,
        failed: 0,
        errors: []
      }
    };

    const createdLearners = [];
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      for (const [index, learnerData] of learners.entries()) {
        try {
          // Validate required fields
          if (!learnerData.first_name || !learnerData.last_name) {
            throw new Error('First name and last name are required');
          }

          if (!learnerData.date_of_birth) {
            throw new Error('Date of birth is required');
          }

          // Validate age
          const dob = new Date(learnerData.date_of_birth);
          const today = new Date();
          let age = today.getFullYear() - dob.getFullYear();
          const monthDiff = today.getMonth() - dob.getMonth();
          
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
            age--;
          }
          
          if (age < 4 || age > 10) {
            throw new Error(`Learner must be between 4 and 10 years old (Age: ${age})`);
          }

          // Create a simple username for internal use (no email needed)
          const username = `${learnerData.first_name.toLowerCase()}.${learnerData.last_name.toLowerCase()}.${Date.now().toString().slice(-6)}`;
          
          // Create user account with minimal information
          const userQuery = `
            INSERT INTO users (
              email, password_hash, first_name, last_name, 
              role, school_id, is_active
            )
            VALUES ($1, $2, $3, $4, 'learner', $5, true)
            RETURNING user_id
          `;

          // Generate a simple placeholder email (won't be used for login in MVP)
          const placeholderEmail = `${username}@${schoolId.substring(0, 8)}.edu`;
          const tempPassword = 'learner123'; // Simple default password

          // Hash password
          const bcrypt = await import('bcryptjs');
          const salt = await bcrypt.genSalt(10);
          const passwordHash = await bcrypt.hash(tempPassword, salt);

          const userResult = await client.query(userQuery, [
            placeholderEmail,
            passwordHash,
            learnerData.first_name,
            learnerData.last_name,
            schoolId
          ]);

          // Create learner profile with all fields
          const learnerQuery = `
            INSERT INTO learners (
              user_id, school_id, current_class_id,
              date_of_birth, gender, guardian_name,
              guardian_email, guardian_phone,
              has_special_needs, special_needs_notes,
              medical_notes, enrollment_date
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_DATE)
            RETURNING learner_id
          `;

          const learnerResult = await client.query(learnerQuery, [
            userResult.rows[0].user_id,
            schoolId,
            classId,
            learnerData.date_of_birth,
            learnerData.gender || null,
            learnerData.guardian_name || null,
            learnerData.guardian_email || null,
            learnerData.guardian_phone || null,
            learnerData.has_special_needs || false,
            learnerData.special_needs_notes || null,
            learnerData.medical_notes || null
          ]);

          createdLearners.push({
            learner_id: learnerResult.rows[0].learner_id,
            name: `${learnerData.first_name} ${learnerData.last_name}`,
            date_of_birth: learnerData.date_of_birth,
            gender: learnerData.gender || 'Not specified'
          });

          results.summary.success++;

        } catch (error) {
          results.summary.failed++;
          results.summary.errors.push({
            row: index + 1,
            name: `${learnerData.first_name || ''} ${learnerData.last_name || ''}`.trim() || 'Unknown',
            error: error.message
          });
        }
      }

      await client.query('COMMIT');

      // Log activity
      await pool.query(
        `INSERT INTO activity_logs 
         (user_id, school_id, action_type, action_details)
         VALUES ($1, $2, $3, $4)`,
        [
          teacherId,
          schoolId,
          'LEARNERS_BULK_ADDED',
          JSON.stringify({
            class_id: classId,
            class_name: classData.class_name,
            total_added: results.summary.success,
            total_failed: results.summary.failed,
            added_by: req.user.email
          })
        ]
      );

      res.status(201).json({
        status: 'success',
        message: `${results.summary.success} learners added successfully${results.summary.failed > 0 ? `, ${results.summary.failed} failed` : ''}`,
        data: {
          summary: results.summary,
          created_learners: createdLearners,
          class_capacity: {
            before: classData.current_enrollment,
            after: classData.current_enrollment + results.summary.success,
            max: classData.max_capacity || 30,
            available_slots: availableSlots - results.summary.success
          }
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Bulk add learners error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to add learners',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Bulk import learners via file upload
// @route   POST /api/teacher/learners/bulk-import
// @access  Private (Teacher)
export const bulkImportLearners = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'No file uploaded'
      });
    }

    const { class_id } = req.body;
    const teacherId = req.user.userId;
    const schoolId = req.user.schoolId;

    if (!class_id) {
      return res.status(400).json({
        status: 'error',
        message: 'Class ID is required'
      });
    }

    // Verify teacher has access to this class
    const teacherClasses = await ClassModel.getByTeacher(teacherId);
    const hasAccess = teacherClasses.some(c => c.class_id === class_id);
    
    if (!hasAccess) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to add learners to this class'
      });
    }

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
        message: 'Unsupported file format. Use CSV or Excel.'
      });
    }

    // Clean up file
    fs.unlinkSync(filePath);

    // Get class capacity
    const classQuery = `
      SELECT 
        c.*,
        COUNT(l.learner_id) as current_enrollment
      FROM classes c
      LEFT JOIN learners l ON c.class_id = l.current_class_id AND l.academic_status = 'active'
      WHERE c.class_id = $1
      GROUP BY c.class_id
    `;
    
    const classResult = await pool.query(classQuery, [class_id]);
    if (classResult.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Class not found'
      });
    }

    const classData = classResult.rows[0];
    const availableSlots = (classData.max_capacity || 30) - classData.current_enrollment;

    if (learners.length > availableSlots) {
      return res.status(400).json({
        status: 'error',
        message: `Class only has ${availableSlots} available slots. File contains ${learners.length} learners.`
      });
    }

    // Process learners using the same logic as manual bulk add
    const results = await bulkImportLearnersProcess(learners, class_id, schoolId, teacherId, classData);

    res.status(200).json({
      status: 'success',
      message: `Import completed: ${results.summary.success} successful, ${results.summary.failed} failed`,
      data: results
    });

  } catch (error) {
    console.error('Bulk import learners error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to import learners',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Helper function to process bulk import learners
async function bulkImportLearnersProcess(learners, classId, schoolId, teacherId, classData) {
  const results = {
    summary: {
      total: learners.length,
      success: 0,
      failed: 0,
      errors: []
    },
    created_learners: []
  };

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const [index, learnerData] of learners.entries()) {
      try {
        // Map different column names
        const mappedData = {
          first_name: learnerData.first_name || learnerData['First Name'] || '',
          last_name: learnerData.last_name || learnerData['Last Name'] || '',
          date_of_birth: learnerData.date_of_birth || learnerData['Date of Birth'] || learnerData.DOB || '',
          gender: learnerData.gender || learnerData.Gender || '',
          guardian_name: learnerData.guardian_name || learnerData['Guardian Name'] || '',
          guardian_email: learnerData.guardian_email || learnerData['Guardian Email'] || '',
          guardian_phone: learnerData.guardian_phone || learnerData['Guardian Phone'] || learnerData.Phone || '',
          has_special_needs: learnerData.has_special_needs === 'true' || 
                            learnerData['Has Special Needs'] === 'true' || 
                            learnerData.has_special_needs === true || 
                            false,
          special_needs_notes: learnerData.special_needs_notes || learnerData['Special Needs Notes'] || '',
          medical_notes: learnerData.medical_notes || learnerData['Medical Notes'] || ''
        };

        // Validate required fields
        if (!mappedData.first_name || !mappedData.last_name) {
          throw new Error('First name and last name are required');
        }

        if (!mappedData.date_of_birth) {
          throw new Error('Date of birth is required');
        }

        // Validate age
        const dob = new Date(mappedData.date_of_birth);
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const monthDiff = today.getMonth() - dob.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
          age--;
        }
        
        if (age < 4 || age > 10) {
          throw new Error(`Learner must be between 4 and 10 years old (Age: ${age})`);
        }

        // Create a simple username for internal use
        const username = `${mappedData.first_name.toLowerCase()}.${mappedData.last_name.toLowerCase()}.${Date.now().toString().slice(-6)}`;
        
        // Create user account with placeholder email
        const userQuery = `
          INSERT INTO users (
            email, password_hash, first_name, last_name, 
            role, school_id, is_active
          )
          VALUES ($1, $2, $3, $4, 'learner', $5, true)
          RETURNING user_id
        `;

        const placeholderEmail = `${username}@${schoolId.substring(0, 8)}.edu`;
        const tempPassword = 'learner123';

        const bcrypt = await import('bcryptjs');
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(tempPassword, salt);

        const userResult = await client.query(userQuery, [
          placeholderEmail,
          passwordHash,
          mappedData.first_name,
          mappedData.last_name,
          schoolId
        ]);

        // Create learner profile with all fields
        const learnerQuery = `
          INSERT INTO learners (
            user_id, school_id, current_class_id,
            date_of_birth, gender, guardian_name,
            guardian_email, guardian_phone,
            has_special_needs, special_needs_notes,
            medical_notes, enrollment_date
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_DATE)
          RETURNING learner_id
        `;

        const learnerResult = await client.query(learnerQuery, [
          userResult.rows[0].user_id,
          schoolId,
          classId,
          mappedData.date_of_birth,
          mappedData.gender || null,
          mappedData.guardian_name || null,
          mappedData.guardian_email || null,
          mappedData.guardian_phone || null,
          mappedData.has_special_needs,
          mappedData.special_needs_notes || null,
          mappedData.medical_notes || null
        ]);

        results.created_learners.push({
          learner_id: learnerResult.rows[0].learner_id,
          name: `${mappedData.first_name} ${mappedData.last_name}`,
          date_of_birth: mappedData.date_of_birth,
          gender: mappedData.gender || 'Not specified'
        });

        results.summary.success++;

      } catch (error) {
        results.summary.failed++;
        results.summary.errors.push({
          row: index + 1,
          name: `${learnerData.first_name || ''} ${learnerData.last_name || ''}`.trim() || 'Unknown',
          error: error.message
        });
      }
    }

    await client.query('COMMIT');

    // Log import activity
    await pool.query(
      `INSERT INTO bulk_import_logs 
       (school_id, imported_by, import_type, file_name, total_records, 
        successful_records, failed_records, import_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed')`,
      [
        schoolId,
        teacherId,
        'learners',
        `teacher_import_${Date.now()}`,
        results.summary.total,
        results.summary.success,
        results.summary.failed
      ]
    );

    return results;

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// @desc    Create assessment
// @route   POST /api/teacher/assessments
// @access  Private (Teacher)
export const createAssessment = async (req, res) => {
  try {
    const teacherId = req.user.userId;
    
    const assessmentData = {
      ...req.body,
      teacher_id: teacherId
    };

    // Verify teacher has access to the class
    const teacherClasses = await ClassModel.getByTeacher(teacherId);
    const hasAccess = teacherClasses.some(c => c.class_id === assessmentData.class_id);
    
    if (!hasAccess) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to create assessments for this class'
      });
    }

    const assessment = await Assessment.create(assessmentData);

    res.status(201).json({
      status: 'success',
      message: 'Assessment created successfully',
      data: { assessment }
    });
  } catch (error) {
    console.error('Create assessment error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create assessment'
    });
  }
};

// @desc    Get assessment gradebook
// @route   GET /api/teacher/assessments/:assessmentId/gradebook
// @access  Private (Teacher)
export const getAssessmentGradebook = async (req, res) => {
  try {
    const { assessmentId } = req.params;

    const gradebook = await Assessment.getGradebook(assessmentId);
    const assessment = await Assessment.getById(assessmentId);

    res.status(200).json({
      status: 'success',
      data: {
        assessment,
        gradebook
      }
    });
  } catch (error) {
    console.error('Get assessment gradebook error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get gradebook'
    });
  }
};

// @desc    Bulk grade assessment
// @route   POST /api/teacher/assessments/:assessmentId/bulk-grade
// @access  Private (Teacher)
export const bulkGradeAssessment = async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const { grades } = req.body;

    if (!grades || !Array.isArray(grades)) {
      return res.status(400).json({
        status: 'error',
        message: 'Grades array is required'
      });
    }

    const result = await Assessment.bulkGrade(assessmentId, grades, req.user.userId);

    res.status(200).json({
      status: 'success',
      message: 'Grades submitted successfully',
      data: { grades: result }
    });
  } catch (error) {
    console.error('Bulk grade assessment error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to submit grades'
    });
  }
};

// @desc    Generate worksheet
// @route   POST /api/teacher/worksheets/generate
// @access  Private (Teacher)
export const generateWorksheet = async (req, res) => {
  try {
    const worksheetData = {
      ...req.body,
      teacher_id: req.user.userId,
      school_id: req.user.schoolId
    };

    const worksheet = new Worksheet();
    const result = await worksheet.generate(worksheetData);

    res.status(200).json({
      status: 'success',
      message: 'Worksheet generated successfully',
      data: result
    });
  } catch (error) {
    console.error('Generate worksheet error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate worksheet',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Save worksheet to library
// @route   POST /api/teacher/worksheets/save
// @access  Private (Teacher)
export const saveWorksheet = async (req, res) => {
  try {
    const worksheetData = {
      ...req.body,
      teacher_id: req.user.userId,
      school_id: req.user.schoolId
    };

    const worksheet = await Worksheet.saveToLibrary(worksheetData);

    res.status(201).json({
      status: 'success',
      message: 'Worksheet saved to library',
      data: { worksheet }
    });
  } catch (error) {
    console.error('Save worksheet error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to save worksheet'
    });
  }
};

// @desc    Get worksheet history
// @route   GET /api/teacher/worksheets/history
// @access  Private (Teacher)
export const getWorksheetHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, subject_id } = req.query;

    const filters = {
      page: parseInt(page),
      limit: parseInt(limit)
    };
    
    if (status) filters.status = status;
    if (subject_id) filters.subject_id = subject_id;

    const history = await Worksheet.getHistory(req.user.userId, filters);

    res.status(200).json({
      status: 'success',
      data: history
    });
  } catch (error) {
    console.error('Get worksheet history error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get worksheet history'
    });
  }
};

// @desc    Get learner profile
// @route   GET /api/teacher/learners/:learnerId
// @access  Private (Teacher)
export const getLearnerProfile = async (req, res) => {
  try {
    const { learnerId } = req.params;
    
    // Get learner details
    const learnerQuery = `
      SELECT 
        l.*,
        u.first_name,
        u.last_name,
        u.email,
        c.class_name,
        c.grade_level,
        json_build_object(
          'guardian_name', l.guardian_name,
          'guardian_email', l.guardian_email,
          'guardian_phone', l.guardian_phone
        ) as guardian_info
      FROM learners l
      JOIN users u ON l.user_id = u.user_id
      LEFT JOIN classes c ON l.current_class_id = c.class_id
      WHERE l.learner_id = $1
    `;

    // Get learner performance
    const performanceQuery = `
      SELECT 
        a.assessment_name,
        a.assessment_type,
        a.subject_id,
        sub.subject_name,
        a.topic_id,
        t.topic_name,
        a.term_number,
        g.marks_obtained,
        g.percentage,
        g.grade_letter,
        g.teacher_feedback,
        g.graded_at
      FROM grades g
      JOIN assessments a ON g.assessment_id = a.assessment_id
      LEFT JOIN subjects sub ON a.subject_id = sub.subject_id
      LEFT JOIN topics t ON a.topic_id = t.topic_id
      WHERE g.learner_id = $1
      ORDER BY a.scheduled_date DESC
    `;

    // Get learner statistics
    const statsQuery = `
      SELECT 
        COUNT(DISTINCT a.subject_id) as subjects_taken,
        COUNT(*) as total_assessments,
        ROUND(AVG(g.percentage), 2) as average_score,
        MIN(g.percentage) as lowest_score,
        MAX(g.percentage) as highest_score
      FROM grades g
      JOIN assessments a ON g.assessment_id = a.assessment_id
      WHERE g.learner_id = $1 AND g.is_graded = true
    `;

    const [learnerResult, performanceResult, statsResult] = await Promise.all([
      pool.query(learnerQuery, [learnerId]),
      pool.query(performanceQuery, [learnerId]),
      pool.query(statsQuery, [learnerId])
    ]);

    if (learnerResult.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Learner not found'
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        learner: learnerResult.rows[0],
        performance: performanceResult.rows,
        statistics: statsResult.rows[0]
      }
    });
  } catch (error) {
    console.error('Get learner profile error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get learner profile'
    });
  }
};