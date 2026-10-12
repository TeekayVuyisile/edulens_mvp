import { beforeEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { resetDb } from '../helpers/db.js';
import {
  assignTeacher,
  authHeader,
  createAssessment,
  createClass,
  createGrade,
  createLearner,
  createUser,
} from '../helpers/factories.js';

let admin;
let headers;

beforeEach(async () => {
  await resetDb();
  admin = await createUser({ role: 'school_admin' });
  headers = authHeader(admin);
});

describe('school dashboard', () => {
  it('summarises the school and lists what needs attention', async () => {
    const teacher = await createUser({ role: 'teacher', school_id: admin.school_id, first_name: 'Pending' });
    const staffed = await createClass({ school_id: admin.school_id, class_name: 'Grade 1A', grade_level: '1' });
    await createClass({ school_id: admin.school_id, class_name: 'Grade RA', grade_level: 'R', max_capacity: 1 });
    await assignTeacher(teacher, staffed);
    await createLearner({ klass: staffed });
    await createLearner({ school_id: admin.school_id }); // unplaced
    await createLearner(); // another school

    const res = await request(app).get('/api/school-admin/dashboard').set(headers);

    expect(res.status).toBe(200);
    const { summary, learnersByGrade, attention, classes } = res.body.data;
    expect(summary).toMatchObject({ teachers: 1, pending_teachers: 1, learners: 2, unplaced_learners: 1, classes: 2 });
    expect(learnersByGrade).toEqual([{ grade: '1', learners: 1 }]);
    expect(classes.map((c) => c.class_name)).toEqual(['Grade RA', 'Grade 1A']);
    expect(attention.classesWithoutTeacher.map((c) => c.class_name)).toEqual(['Grade RA']);
    expect(attention.pendingTeachers.map((t) => t.first_name)).toEqual(['Pending']);
    expect(attention.unplacedLearners).toBe(1);
  });
});

describe('performance report', () => {
  it('summarises marks by class, subject and CAPS level, and flags learners who need support', async () => {
    const teacher = await createUser({ role: 'teacher', school_id: admin.school_id });
    const klass = await createClass({ school_id: admin.school_id, class_name: 'Grade 3A', grade_level: '3' });
    await assignTeacher(teacher, klass);
    const strong = await createLearner({ klass, first_name: 'Strong' });
    const struggling = await createLearner({ klass, first_name: 'Struggling' });
    const assessment = await createAssessment({ teacher, klass, term_number: '2' });
    await createGrade({ assessment, learner: strong, teacher, percentage: 85 });
    await createGrade({ assessment, learner: struggling, teacher, percentage: 35 });

    const res = await request(app).get('/api/school-admin/reports/performance').set(headers);
    const otherTerm = await request(app).get('/api/school-admin/reports/performance?term=1').set(headers);

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.summary).toMatchObject({ marks: 2, learners_assessed: 2, assessments: 1, average: 60 });
    expect(data.levels).toEqual([
      { level: 7, marks: 1 },
      { level: 2, marks: 1 },
    ]);
    expect(data.classes[0]).toMatchObject({ class_name: 'Grade 3A', average: 60, marks_below_50: 1 });
    expect(data.needsSupport.map((l) => l.first_name)).toEqual(['Struggling']);
    expect(otherTerm.body.data.summary.marks).toBe(0);
  });
});
