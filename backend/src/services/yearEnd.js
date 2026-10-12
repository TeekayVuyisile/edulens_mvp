import pool from '../config/database.js';
import { withTransaction } from '../db/transaction.js';
import ClassModel from '../models/Class.js';
import Learner from '../models/Learner.js';
import { badRequest, conflict } from '../utils/httpError.js';

// Closing an academic year: every learner in the year's classes is promoted to
// the next grade, kept back to repeat, finishes Foundation Phase (Grade 3) or
// has left; next year's classes are filled; this year's classes close.

export const OUTCOMES = ['promote', 'repeat', 'graduate', 'leave'];

const NEXT_GRADE = { R: '1', 1: '2', 2: '3', 3: null };

/** Below this overall average a learner is flagged "consider repeating" (CAPS level 2 and under). A hint only. */
export const REVIEW_THRESHOLD = 40;

// How each outcome is written to the closed history row and to the learner.
const HISTORY_STATUS = { promote: 'promoted', repeat: 'repeated', graduate: 'graduated', leave: 'inactive' };
const LEARNER_STATUS = { promote: 'active', repeat: 'repeated', graduate: 'graduated', leave: 'inactive' };

/**
 * The class a learner from `klass` should go to for `outcome` next year:
 * "Grade 1A" → "Grade 2A" when that exists, otherwise the first class of the right grade.
 */
export const suggestTarget = (klass, outcome, nextClasses) => {
  const grade = outcome === 'repeat' ? klass.grade_level : NEXT_GRADE[klass.grade_level];
  if (!grade || !['promote', 'repeat'].includes(outcome)) return null;
  const candidates = nextClasses.filter((c) => c.grade_level === grade);
  const sameName = outcome === 'repeat' ? klass.class_name : klass.class_name.replace(klass.grade_level, grade);
  return (
    candidates.find((c) => c.class_name.toLowerCase() === sameName.toLowerCase()) ??
    candidates[0] ??
    null
  );
};

const rolloverFor = async (schoolId, fromYear) => {
  const { rows } = await pool.query(
    `SELECT r.*, u.first_name AS completed_by_first_name, u.last_name AS completed_by_last_name
     FROM academic_year_rollovers r
     LEFT JOIN users u ON u.user_id = r.completed_by
     WHERE r.school_id = $1 AND r.from_year = $2`,
    [schoolId, fromYear]
  );
  return rows[0] ?? null;
};

/** Active classes of `year` with their current learners (and each learner's average in that class). */
const classesWithLearners = async (schoolId, year) => {
  const classes = await ClassModel.listForSchool(schoolId, { year, status: 'active' });
  return Promise.all(classes.map(async (klass) => ({ ...klass, learners: await ClassModel.learners(klass.class_id) })));
};

/**
 * Everything the year-end screen needs: this year's classes and learners with
 * a suggested outcome each, next year's classes, and whether the year is already closed.
 */
export const overview = async (schoolId, fromYear) => {
  const toYear = fromYear + 1;
  const [rollover, classes, nextClasses] = await Promise.all([
    rolloverFor(schoolId, fromYear),
    classesWithLearners(schoolId, fromYear),
    ClassModel.listForSchool(schoolId, { year: toYear, status: 'active' }),
  ]);

  return {
    fromYear,
    toYear,
    rollover,
    nextClasses,
    classes: classes.map((klass) => {
      const outcome = NEXT_GRADE[klass.grade_level] ? 'promote' : 'graduate';
      return {
        ...klass,
        suggestion: { outcome, class_id: suggestTarget(klass, outcome, nextClasses)?.class_id ?? null },
        learners: klass.learners.map((l) => ({ ...l, needs_review: l.average !== null && l.average < REVIEW_THRESHOLD })),
      };
    }),
  };
};

/**
 * Creates next year's classes by copying this year's names, grades and sizes
 * (classes that already exist are left alone), optionally with the same teachers.
 */
export const createNextClasses = async (schoolId, fromYear, { copyTeachers = false, userId } = {}) => {
  const toYear = fromYear + 1;
  const current = await ClassModel.listForSchool(schoolId, { year: fromYear, status: 'active' });
  if (current.length === 0) throw badRequest(`There are no active classes in ${fromYear} to copy`);

  return withTransaction(async (client) => {
    let created = 0;
    for (const klass of current) {
      const { rows } = await client.query(
        `INSERT INTO classes (school_id, class_name, grade_level, academic_year, max_capacity)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (school_id, class_name, academic_year) DO NOTHING
         RETURNING class_id`,
        [schoolId, klass.class_name, klass.grade_level, toYear, klass.max_capacity]
      );
      if (!rows[0]) continue;
      created += 1;
      if (copyTeachers) {
        for (const teacher of klass.teachers.filter((t) => t.is_active)) {
          await ClassModel.setTeacher(rows[0].class_id, teacher.user_id, { isPrimary: teacher.is_primary, assignedBy: userId }, client);
        }
      }
    }
    return { created, skipped: current.length - created, toYear };
  });
};

/**
 * Applies the year-end decisions in one transaction.
 * decisions: [{ learner_id, outcome: 'promote'|'repeat'|'graduate'|'leave', class_id?: uuid|null }]
 */
export const complete = async (schoolId, fromYear, decisions, userId) => {
  const toYear = fromYear + 1;
  if (await rolloverFor(schoolId, fromYear)) throw conflict(`${fromYear} has already been closed`);

  const [classes, nextClasses] = await Promise.all([
    classesWithLearners(schoolId, fromYear),
    ClassModel.listForSchool(schoolId, { year: toYear, status: 'active' }),
  ]);
  if (classes.length === 0) throw badRequest(`There are no active classes in ${fromYear}`);

  // Every learner in the year's classes needs exactly one decision.
  const learnerClass = new Map(classes.flatMap((klass) => klass.learners.map((l) => [l.learner_id, klass])));
  const byLearner = new Map(decisions.map((d) => [d.learner_id, d]));
  const missing = [...learnerClass.keys()].filter((id) => !byLearner.has(id));
  const unknown = decisions.filter((d) => !learnerClass.has(d.learner_id)).map((d) => d.learner_id);
  if (missing.length || unknown.length || byLearner.size !== decisions.length) {
    throw badRequest('Choose an outcome for every learner in this year’s classes (and only them)', {
      data: { missing, unknown },
    });
  }

  // Targets must be next year's classes of the right grade, with room.
  const nextById = new Map(nextClasses.map((c) => [c.class_id, { ...c, adding: 0 }]));
  const problems = [];
  for (const decision of decisions) {
    const from = learnerClass.get(decision.learner_id);
    const learner = from.learners.find((l) => l.learner_id === decision.learner_id);
    const name = `${learner.first_name} ${learner.last_name}`;
    if (decision.outcome === 'promote' && !NEXT_GRADE[from.grade_level]) {
      problems.push(`${name} is in Grade 3: they finish Foundation Phase or repeat`);
    }
    if (decision.outcome === 'graduate' && from.grade_level !== '3') {
      problems.push(`Only Grade 3 learners finish Foundation Phase (${name})`);
    }
    if (!decision.class_id) continue;
    if (!['promote', 'repeat'].includes(decision.outcome)) {
      problems.push(`${name} won’t be in a class next year, so don’t choose one`);
      continue;
    }
    const target = nextById.get(decision.class_id);
    const expected = decision.outcome === 'repeat' ? from.grade_level : NEXT_GRADE[from.grade_level];
    if (!target) problems.push(`Choose one of the ${toYear} classes for ${name}`);
    else if (target.grade_level !== expected) problems.push(`${name} needs a Grade ${expected} class, not ${target.class_name}`);
    else target.adding += 1;
  }
  for (const target of nextById.values()) {
    if (target.learner_count + target.adding > target.max_capacity) {
      problems.push(`${target.class_name} would have ${target.learner_count + target.adding} learners but has ${target.max_capacity} places`);
    }
  }
  if (problems.length > 0) throw badRequest(problems[0], { data: { problems } });

  return withTransaction(async (client) => {
    const summary = { promote: 0, repeat: 0, graduate: 0, leave: 0, unplaced: 0 };
    for (const decision of decisions) {
      const from = learnerClass.get(decision.learner_id);
      const status = HISTORY_STATUS[decision.outcome];

      const closed = await client.query(
        `UPDATE learner_class_history SET completed_date = CURRENT_DATE, status = $3
         WHERE learner_id = $1 AND class_id = $2 AND completed_date IS NULL`,
        [decision.learner_id, from.class_id, status]
      );
      if (closed.rowCount === 0) {
        await client.query(
          `INSERT INTO learner_class_history (learner_id, class_id, academic_year, status, completed_date)
           VALUES ($1, $2, $3, $4, CURRENT_DATE)`,
          [decision.learner_id, from.class_id, fromYear, status]
        );
      }

      const target = ['promote', 'repeat'].includes(decision.outcome) ? decision.class_id ?? null : null;
      await client.query(
        `UPDATE learners SET academic_status = $2, current_class_id = $3, previous_class_id = $4,
                updated_at = CURRENT_TIMESTAMP
         WHERE learner_id = $1`,
        [decision.learner_id, LEARNER_STATUS[decision.outcome], target, from.class_id]
      );
      if (target) await Learner.openPlacement(decision.learner_id, target, client);
      else if (['promote', 'repeat'].includes(decision.outcome)) summary.unplaced += 1;
      summary[decision.outcome] += 1;
    }

    // This year's classes close; their marks stay readable.
    await client.query(
      'UPDATE classes SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE school_id = $1 AND academic_year = $2',
      [schoolId, fromYear]
    );
    await client.query(
      `INSERT INTO academic_year_rollovers (school_id, from_year, to_year, completed_by, summary)
       VALUES ($1, $2, $3, $4, $5)`,
      [schoolId, fromYear, toYear, userId, JSON.stringify(summary)]
    );
    return { fromYear, toYear, summary };
  });
};
