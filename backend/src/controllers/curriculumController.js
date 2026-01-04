import Curriculum from '../models/Curriculum.js';

// @desc    Get all curricula
// @route   GET /api/curriculum
// @access  Private
export const getCurricula = async (req, res) => {
  try {
    const { search } = req.query;
    const filters = search ? { search } : {};

    const curricula = await Curriculum.getAll(filters);

    res.status(200).json({
      status: 'success',
      data: { curricula }
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
// @route   GET /api/curriculum/:curriculumId
// @access  Private
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

// @desc    Get subjects by curriculum
// @route   GET /api/curriculum/:curriculumId/subjects
// @access  Private
export const getSubjectsByCurriculum = async (req, res) => {
  try {
    const { curriculumId } = req.params;
    const { grade_level } = req.query;

    const pool = await import('../config/database.js').then(mod => mod.default);

    let query = `
      SELECT * FROM subjects 
      WHERE curriculum_id = $1 AND is_active = true
    `;
    
    const values = [curriculumId];
    
    if (grade_level) {
      query += ` AND grade_level = $2`;
      values.push(grade_level);
    }

    query += ` ORDER BY subject_name`;

    const result = await pool.query(query, values);

    res.status(200).json({
      status: 'success',
      data: { subjects: result.rows }
    });
  } catch (error) {
    console.error('Get subjects by curriculum error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get subjects'
    });
  }
};

// @desc    Get topics by subject
// @route   GET /api/curriculum/subjects/:subjectId/topics
// @access  Private
export const getTopicsBySubject = async (req, res) => {
  try {
    const { subjectId } = req.params;

    const pool = await import('../config/database.js').then(mod => mod.default);

    const query = `
      SELECT * FROM topics 
      WHERE subject_id = $1 AND is_active = true
      ORDER BY topic_name
    `;

    const result = await pool.query(query, [subjectId]);

    res.status(200).json({
      status: 'success',
      data: { topics: result.rows }
    });
  } catch (error) {
    console.error('Get topics by subject error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get topics'
    });
  }
};