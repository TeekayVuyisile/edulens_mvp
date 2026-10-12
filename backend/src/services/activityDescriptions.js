// Turns activity_logs.action_type ("METHOD /path") into a sentence for feeds.
// IDs in paths are matched by [^/]+ so the patterns stay readable.

const ID = '[^/]+';

const PATTERNS = [
  ['POST', '/api/auth/login', 'Signed in'],
  ['POST', '/api/auth/reset-password', 'Reset their password'],
  ['PUT', '/api/auth/profile', 'Updated their profile'],

  ['POST', '/api/super-admin/schools', 'Added a school'],
  ['PUT', `/api/super-admin/schools/${ID}`, 'Updated school details'],
  ['PATCH', `/api/super-admin/schools/${ID}/status`, 'Changed a school’s status'],
  ['DELETE', `/api/super-admin/schools/${ID}`, 'Deleted a school'],
  ['POST', `/api/super-admin/schools/${ID}/admins`, 'Invited a school admin'],
  ['POST', `/api/super-admin/schools/${ID}/curricula`, 'Assigned a curriculum to a school'],
  ['DELETE', `/api/super-admin/schools/${ID}/curricula/${ID}`, 'Removed a curriculum from a school'],
  ['POST', '/api/super-admin/curricula', 'Added a curriculum'],
  ['POST', `/api/super-admin/curricula/${ID}/subjects`, 'Added a subject'],
  ['POST', `/api/super-admin/subjects/${ID}/topics`, 'Added a topic'],
  ['POST', '/api/super-admin/users', 'Invited a user'],
  ['PATCH', `/api/super-admin/users/${ID}/status`, 'Changed a user’s status'],
  ['POST', `/api/super-admin/users/${ID}/account-link`, 'Sent an account link'],

  ['POST', '/api/school-admin/teachers', 'Invited a teacher'],
  ['PUT', `/api/school-admin/teachers/${ID}`, 'Updated a teacher'],
  ['PATCH', `/api/school-admin/teachers/${ID}/status`, 'Changed a teacher’s status'],
  ['POST', `/api/school-admin/teachers/${ID}/account-link`, 'Sent a teacher an account link'],
  ['POST', '/api/school-admin/learners', 'Added a learner'],
  ['POST', '/api/school-admin/learners/import', 'Imported learners'],
  ['PUT', `/api/school-admin/learners/${ID}`, 'Updated a learner'],
  ['PATCH', `/api/school-admin/learners/${ID}/status`, 'Changed a learner’s status'],
  ['PATCH', `/api/school-admin/learners/${ID}/class`, 'Moved a learner to another class'],
  ['DELETE', `/api/school-admin/learners/${ID}`, 'Deleted a learner'],
  ['POST', '/api/school-admin/classes', 'Created a class'],
  ['PUT', `/api/school-admin/classes/${ID}`, 'Updated a class'],
  ['PATCH', `/api/school-admin/classes/${ID}/status`, 'Changed a class’s status'],
  ['DELETE', `/api/school-admin/classes/${ID}`, 'Deleted a class'],
  ['POST', `/api/school-admin/classes/${ID}/teachers`, 'Assigned a teacher to a class'],
  ['DELETE', `/api/school-admin/classes/${ID}/teachers/${ID}`, 'Removed a teacher from a class'],
  ['POST', `/api/school-admin/classes/${ID}/learners`, 'Placed learners in a class'],
  ['DELETE', `/api/school-admin/classes/${ID}/learners/${ID}`, 'Took a learner out of a class'],

  ['POST', '/api/school-admin/year-end/next-classes', 'Set up next year’s classes'],
  ['POST', '/api/school-admin/year-end/complete', 'Closed the academic year'],

  ['POST', '/api/teacher/assessments', 'Created an assessment'],
  ['PUT', `/api/teacher/assessments/${ID}`, 'Updated an assessment'],
  ['DELETE', `/api/teacher/assessments/${ID}`, 'Deleted an assessment'],
  ['PUT', `/api/teacher/assessments/${ID}/marks`, 'Recorded marks'],
  ['POST', `/api/teacher/assessments/${ID}/resources`, 'Added a resource to an assessment'],
  ['DELETE', `/api/teacher/assessments/${ID}/resources/${ID}`, 'Removed an assessment resource'],
  ['POST', `/api/teacher/classes/${ID}/learners`, 'Added a learner to their class'],
  ['POST', `/api/teacher/classes/${ID}/learners/import`, 'Imported learners into their class'],
  ['PUT', `/api/teacher/learners/${ID}`, 'Updated a learner'],
  ['POST', '/api/teacher/worksheets/generate', 'Generated a worksheet'],
  ['POST', '/api/teacher/worksheets/library', 'Saved a worksheet to the library'],
  ['PUT', `/api/teacher/worksheets/library/${ID}`, 'Edited a worksheet'],
  ['DELETE', `/api/teacher/worksheets/library/${ID}`, 'Deleted a worksheet'],
].map(([method, path, label]) => ({ method, regex: new RegExp(`^${path}$`), label }));

const VERBS = { POST: 'Created', PUT: 'Updated', PATCH: 'Updated', DELETE: 'Deleted' };

/** "PATCH /api/super-admin/schools/abc/status" → "Changed a school’s status". */
export const describeActivity = (actionType = '') => {
  const [method, rawPath = ''] = actionType.split(' ');
  const path = rawPath.split('?')[0];
  const match = PATTERNS.find((p) => p.method === method && p.regex.test(path));
  if (match) return match.label;

  // Fallback: "Updated classes" from the last non-id segment.
  const resource = path
    .split('/')
    .filter((part) => part && part !== 'api' && !/^[0-9a-f-]{36}$/i.test(part))
    .pop();
  return `${VERBS[method] ?? method} ${resource?.replace(/-/g, ' ') ?? 'record'}`;
};
