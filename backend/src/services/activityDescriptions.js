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

  ['POST', '/api/school-admin/teachers', 'Added a teacher'],
  ['POST', '/api/school-admin/learners', 'Added a learner'],
  ['POST', '/api/school-admin/classes', 'Created a class'],
  ['POST', `/api/school-admin/classes/${ID}/assign-teacher`, 'Assigned a teacher to a class'],
  ['POST', `/api/school-admin/classes/${ID}/assign-learner`, 'Placed a learner in a class'],
  ['POST', `/api/school-admin/academic-years/${ID}/archive`, 'Archived an academic year'],

  ['POST', '/api/teacher/assessments', 'Created an assessment'],
  ['POST', `/api/teacher/assessments/${ID}/bulk-grade`, 'Recorded marks'],
  ['POST', '/api/teacher/worksheets/generate', 'Generated a worksheet'],
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
