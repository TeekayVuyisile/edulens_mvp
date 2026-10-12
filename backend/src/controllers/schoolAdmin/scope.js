import pool from '../../config/database.js';
import ClassModel from '../../models/Class.js';
import Learner from '../../models/Learner.js';
import User from '../../models/User.js';
import { badRequest, conflict, notFound } from '../../utils/httpError.js';

// Lookups limited to the school admin's own school. Records from other
// schools are reported as not found, so their ids reveal nothing.

export const findLearnerOr404 = async (learnerId, schoolId) => {
  const learner = await Learner.findInSchool(learnerId, schoolId);
  if (!learner) throw notFound('Learner not found');
  return learner;
};

export const findClassOr404 = async (classId, schoolId) => {
  const klass = await ClassModel.findInSchool(classId, schoolId);
  if (!klass) throw notFound('Class not found');
  return klass;
};

export const findTeacherOr404 = async (teacherId, schoolId) => {
  const teacher = await User.findStaffById(teacherId);
  if (!teacher || teacher.role !== 'teacher' || teacher.school_id !== schoolId) throw notFound('Teacher not found');
  return teacher;
};

/** An active teacher at the school, or a 400 explaining why not. */
export const requireActiveTeacher = async (teacherId, schoolId) => {
  const { rows } = await pool.query(
    `SELECT user_id, first_name, last_name, is_active FROM users
     WHERE user_id = $1 AND school_id = $2 AND role = 'teacher'`,
    [teacherId, schoolId]
  );
  if (!rows[0]) throw badRequest('Choose a teacher from your school');
  if (!rows[0].is_active) throw badRequest(`${rows[0].first_name} is deactivated. Reactivate them first.`);
  return rows[0];
};

/**
 * Checks that `classId` is an active class at the school with room for
 * `adding` more learners. Call inside a transaction: it locks the class row
 * so two admins can't overfill a class at the same time.
 */
export const requireRoomInClass = async (classId, schoolId, adding, client) => {
  const klass = await findClassOr404(classId, schoolId);
  if (!klass.is_active) throw badRequest(`${klass.class_name} is no longer active`);
  const { free, capacity } = await ClassModel.room(classId, client);
  if (adding > free) {
    throw conflict(
      free === 0
        ? `${klass.class_name} is full (${capacity} learners). Increase its capacity or choose another class.`
        : `${klass.class_name} only has room for ${free} more learner${free === 1 ? '' : 's'}.`
    );
  }
  return klass;
};
