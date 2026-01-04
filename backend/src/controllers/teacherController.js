import ClassModel from '../models/Class.js';
import Assessment from '../models/Assessment.js';
import Worksheet from '../models/Worksheet.js';
import User from '../models/User.js';

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

// @desc    Get assessments for a class
// @route   GET /api/teacher/classes/:classId/assessments
// @access  Private (Teacher)
export const getClassAssessments = async (req, res) => {
  try {
    const { classId } = req.params;
    const { term_number, subject_id, assessment_type } = req.query;

    const filters = {};
    if (term_number) filters.term_number = term_number;
    if (subject_id) filters.subject_id = subject_id;
    if (assessment_type) filters.assessment_type = assessment_type;

    const assessments = await Assessment.getByClass(classId, filters);

    res.status(200).json({
      status: 'success',
      data: { assessments }
    });
  } catch (error) {
    console.error('Get class assessments error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get assessments'
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
    
    const pool = await import('../config/database.js').then(mod => mod.default);

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