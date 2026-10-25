// The demo school's accounts, shared by the demo seed and one-click demo sign-in.
//
// One-click sign-in (POST /api/auth/demo-login) skips the password, so it is off
// unless DEMO_LOGIN=true and only ever signs in to these fixed accounts.

export const DEMO_SCHOOL_CODE = 'DEMO01';

export const DEMO_ACCOUNTS = [
  {
    key: 'school_admin',
    email: 'demo.admin@example.com',
    first_name: 'Lindiwe',
    last_name: 'Mokoena',
    role: 'school_admin',
    description: 'Classes, learners, reports and year end',
  },
  {
    key: 'teacher',
    email: 'demo.teacher@example.com',
    first_name: 'Thandi',
    last_name: 'Nkosi',
    role: 'teacher',
    description: 'Marks entry, marksheets and AI worksheets',
  },
  {
    key: 'teacher2',
    email: 'demo.teacher2@example.com',
    first_name: 'Sipho',
    last_name: 'Ndlovu',
    role: 'teacher',
    description: 'Grade 2A and 3A',
    hidden: true,
  },
  {
    key: 'parent',
    email: 'demo.parent@example.com',
    first_name: 'Zanele',
    last_name: 'Dlamini',
    role: 'parent',
    description: 'Two children’s marks and teacher comments',
  },
];

export const demoLoginEnabled = () => process.env.DEMO_LOGIN === 'true';

const DEMO_EMAILS = new Set(DEMO_ACCOUNTS.map((a) => a.email));

export const isDemoEmail = (email) => DEMO_EMAILS.has(String(email ?? '').toLowerCase());

export const findDemoAccount = (key) => DEMO_ACCOUNTS.find((a) => a.key === key && !a.hidden);

/** What the sign-in page needs: which accounts to offer, without emails. */
export const publicDemoAccounts = () =>
  DEMO_ACCOUNTS.filter((a) => !a.hidden).map(({ key, role, first_name, last_name, description }) => ({
    key,
    role,
    name: `${first_name} ${last_name}`,
    description,
  }));
