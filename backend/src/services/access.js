import pool from '../config/database.js';

// Authorization checks shared by controllers. Each returns a boolean; the
// caller decides on the response (usually 404 so IDs from other schools
// are indistinguishable from IDs that don't exist).

const exists = async (sql, params) => (await pool.query(`SELECT EXISTS (${sql}) AS ok`, params)).rows[0].ok;

export const classInSchool = (classId, schoolId) =>
  exists('SELECT 1 FROM classes WHERE class_id = $1 AND school_id = $2', [classId, schoolId]);

export const learnerInSchool = (learnerId, schoolId) =>
  exists('SELECT 1 FROM learners WHERE learner_id = $1 AND school_id = $2', [learnerId, schoolId]);

export const teacherTeachesClass = (teacherId, classId) =>
  exists('SELECT 1 FROM class_teacher_assignments WHERE teacher_id = $1 AND class_id = $2', [
    teacherId,
    classId,
  ]);

/** True when the learner is currently in a class the teacher is assigned to. */
export const teacherTeachesLearner = (teacherId, learnerId) =>
  exists(
    `SELECT 1
     FROM learners l
     JOIN class_teacher_assignments cta ON cta.class_id = l.current_class_id
     WHERE l.learner_id = $1 AND cta.teacher_id = $2`,
    [learnerId, teacherId]
  );

/** Returns the ids from `learnerIds` that are NOT currently enrolled in `classId`. */
export const learnersOutsideClass = async (learnerIds, classId) => {
  const { rows } = await pool.query(
    'SELECT learner_id FROM learners WHERE learner_id = ANY($1::uuid[]) AND current_class_id = $2',
    [learnerIds, classId]
  );
  const enrolled = new Set(rows.map((r) => r.learner_id));
  return learnerIds.filter((id) => !enrolled.has(id));
};
