import pool from '../../config/database.js';
import Worksheet from '../../models/Worksheet.js';

// AI worksheet endpoints, moved here unchanged from the old teacher controller.
// Phase 6 rebuilds this area.

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

// @desc    Get worksheet details
// @route   GET /api/teacher/worksheets/history/:requestId
// @access  Private (Teacher)
export const getWorksheetDetails = async (req, res) => {
  try {
    const { requestId } = req.params;
    const teacherId = req.user.userId;

    const query = `
      SELECT 
        wr.*,
        c.curriculum_name,
        s.subject_name,
        t.topic_name
      FROM worksheet_requests wr
      LEFT JOIN curricula c ON wr.curriculum_id = c.curriculum_id
      LEFT JOIN subjects s ON wr.subject_id = s.subject_id
      LEFT JOIN topics t ON wr.topic_id = t.topic_id
      WHERE wr.request_id = $1 AND wr.teacher_id = $2
    `;

    const result = await pool.query(query, [requestId, teacherId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Worksheet not found'
      });
    }

    res.status(200).json({
      status: 'success',
      data: { worksheet: result.rows[0] }
    });
  } catch (error) {
    console.error('Get worksheet details error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get worksheet details'
    });
  }
};

// @desc    Get saved worksheets from library
// @route   GET /api/teacher/worksheets/saved
// @access  Private (Teacher)
export const getSavedWorksheets = async (req, res) => {
  try {
    const { page = 1, limit = 20, shared, search } = req.query;

    const filters = {
      page: parseInt(page),
      limit: parseInt(limit),
      shared: shared === 'true',
      search
    };

    const result = await Worksheet.getSavedWorksheets(req.user.userId, filters);

    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    console.error('Get saved worksheets error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get saved worksheets'
    });
  }
};

// GET /api/teacher/worksheets/options — the school's curricula, subjects and topics
// in the shape the current Worksheets page expects.
export const getWorksheetOptions = async (req, res) => {
  const { rows } = await pool.query(
    `SELECT DISTINCT cur.curriculum_id, cur.curriculum_name, s.subject_id, s.subject_name,
            s.grade_level AS subject_grade_level, t.topic_id, t.topic_name
     FROM school_curriculum_assignments sca
     JOIN curricula cur ON cur.curriculum_id = sca.curriculum_id AND cur.is_active
     JOIN subjects s ON s.curriculum_id = cur.curriculum_id AND s.is_active
     LEFT JOIN topics t ON t.subject_id = s.subject_id AND t.is_active
     WHERE sca.school_id = $1 AND sca.is_active
     ORDER BY cur.curriculum_name, s.subject_name, t.topic_name`,
    [req.user.schoolId]
  );

  const curricula = new Map();
  const topicsBySubject = {};
  for (const row of rows) {
    if (!curricula.has(row.curriculum_id)) {
      curricula.set(row.curriculum_id, { curriculum_id: row.curriculum_id, curriculum_name: row.curriculum_name, subjects: [] });
    }
    const curriculum = curricula.get(row.curriculum_id);
    if (!curriculum.subjects.some((s) => s.subject_id === row.subject_id)) {
      curriculum.subjects.push({
        subject_id: row.subject_id,
        subject_name: row.subject_name,
        subject_grade_level: row.subject_grade_level,
      });
    }
    topicsBySubject[row.subject_id] ??= [];
    if (row.topic_id) topicsBySubject[row.subject_id].push({ topic_id: row.topic_id, topic_name: row.topic_name });
  }

  res.status(200).json({ status: 'success', data: { curricula: [...curricula.values()], topics_by_subject: topicsBySubject } });
};
