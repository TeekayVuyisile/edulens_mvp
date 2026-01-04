import Learner from '../models/Learner.js';

// @desc    Get learner profile (for teachers/admins)
// @route   GET /api/learner/:learnerId
// @access  Private (Teacher, School Admin)
export const getLearnerProfile = async (req, res) => {
  try {
    const { learnerId } = req.params;

    const learner = await Learner.getById(learnerId);
    
    if (!learner) {
      return res.status(404).json({
        status: 'error',
        message: 'Learner not found'
      });
    }

    // Get performance data
    const performanceSummary = await Learner.getPerformanceSummary(learnerId);
    const recentAssessments = await Learner.getRecentAssessments(learnerId, 10);

    res.status(200).json({
      status: 'success',
      data: {
        learner,
        performance_summary: performanceSummary,
        recent_assessments: recentAssessments
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

// @desc    Update learner information
// @route   PUT /api/learner/:learnerId
// @access  Private (School Admin)
export const updateLearner = async (req, res) => {
  try {
    const { learnerId } = req.params;

    const updatedLearner = await Learner.update(learnerId, req.body);

    res.status(200).json({
      status: 'success',
      message: 'Learner updated successfully',
      data: { learner: updatedLearner }
    });
  } catch (error) {
    console.error('Update learner error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update learner'
    });
  }
};

// @desc    Get learner's own profile (for learner role)
// @route   GET /api/learner/me/profile
// @access  Private (Learner)
export const getMyProfile = async (req, res) => {
  try {
    const learnerId = req.user.learnerId || req.user.userId;

    const learner = await Learner.getById(learnerId);
    
    if (!learner) {
      return res.status(404).json({
        status: 'error',
        message: 'Learner profile not found'
      });
    }

    // Get learner's own performance (limited info)
    const recentAssessments = await Learner.getRecentAssessments(learnerId, 5);

    res.status(200).json({
      status: 'success',
      data: {
        learner,
        recent_assessments: recentAssessments
      }
    });
  } catch (error) {
    console.error('Get my profile error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get profile'
    });
  }
};