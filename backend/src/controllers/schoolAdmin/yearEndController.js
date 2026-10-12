import ClassModel from '../../models/Class.js';
import { complete, createNextClasses, overview } from '../../services/yearEnd.js';
import { created, ok } from '../../utils/respond.js';

const fromYearOf = async (req, value) => Number(value) || ClassModel.currentYear(req.user.schoolId);

// GET /api/school-admin/year-end?year= — the year to close (default: the current year)
export const getYearEnd = async (req, res) => {
  ok(res, await overview(req.user.schoolId, await fromYearOf(req, req.query.year)));
};

// POST /api/school-admin/year-end/next-classes  { from_year, copy_teachers }
export const createNextYearClasses = async (req, res) => {
  const result = await createNextClasses(req.user.schoolId, await fromYearOf(req, req.body.from_year), {
    copyTeachers: Boolean(req.body.copy_teachers),
    userId: req.user.userId,
  });
  created(
    res,
    result,
    result.created
      ? `${result.created} class${result.created === 1 ? '' : 'es'} created for ${result.toYear}`
      : `All the ${result.toYear} classes already exist`
  );
};

// POST /api/school-admin/year-end/complete  { from_year, decisions: [{ learner_id, outcome, class_id }] }
export const completeYear = async (req, res) => {
  const result = await complete(req.user.schoolId, Number(req.body.from_year), req.body.decisions, req.user.userId);
  ok(res, result, `${result.fromYear} is closed. Welcome to ${result.toYear}!`);
};
