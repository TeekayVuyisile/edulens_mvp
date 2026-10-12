import Assessment from '../../models/Assessment.js';
import ClassModel from '../../models/Class.js';
import Learner from '../../models/Learner.js';
import { teacherTeachesLearner } from '../../services/access.js';
import { badRequest, notFound } from '../../utils/httpError.js';

// A teacher reaches classes, learners and assessments only through the classes
// they are assigned to. Anything else is "not found", so ids reveal nothing.

export const findClassForTeacher = async (classId, teacherId) => {
  const klass = await ClassModel.findForTeacher(classId, teacherId);
  if (!klass) throw notFound('Class not found');
  return klass;
};

/** Past (inactive) classes stay readable but can't be changed. Accepts a class or an assessment. */
export const requireActiveClass = (record) => {
  if (!(record.class_is_active ?? record.is_active)) {
    throw badRequest(`${record.class_name} is no longer active, so it can’t be changed`);
  }
  return record;
};

export const findAssessmentForTeacher = async (assessmentId, teacherId) => {
  const assessment = await Assessment.findForTeacher(assessmentId, teacherId);
  if (!assessment) throw notFound('Assessment not found');
  return assessment;
};

/** A learner currently in one of the teacher's classes. */
export const findLearnerForTeacher = async (learnerId, user) => {
  if (!(await teacherTeachesLearner(user.userId, learnerId))) throw notFound('Learner not found');
  return Learner.findInSchool(learnerId, user.schoolId);
};
