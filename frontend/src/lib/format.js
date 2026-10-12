const LOCALE = 'en-ZA';

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A Date for an API value. 'YYYY-MM-DD' (a birthday) is read as that local day, not UTC midnight. */
export const toDate = (value) => {
  const match = typeof value === 'string' && value.match(DATE_ONLY);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(value);
};

/** 12 Oct 2026 */
export const formatDate = (value) =>
  value ? toDate(value).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

/** Whole years old today for a 'YYYY-MM-DD' birthday. */
export const ageFrom = (dateOfBirth, today = new Date()) => {
  if (!dateOfBirth) return null;
  const born = toDate(dateOfBirth);
  let age = today.getFullYear() - born.getFullYear();
  if (today.getMonth() < born.getMonth() || (today.getMonth() === born.getMonth() && today.getDate() < born.getDate())) {
    age -= 1;
  }
  return age;
};

/** "Good morning" / "Good afternoon" / "Good evening" for the local time. */
export const greeting = (date = new Date()) => {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

export const fullName = (person) => (person ? `${person.first_name} ${person.last_name}` : '');

/** "just now", "5 minutes ago", "3 days ago", or a date for older values (lower-case, to sit mid-sentence). */
export const timeAgo = (value, now = Date.now()) => {
  if (!value) return 'Never';
  const seconds = Math.round((now - new Date(value).getTime()) / 1000);
  if (seconds < 45) return 'just now';
  const units = [
    ['minute', 60],
    ['hour', 3600],
    ['day', 86400],
    ['week', 604800],
  ];
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });
  for (let i = units.length - 1; i >= 0; i -= 1) {
    const [unit, size] = units[i];
    if (seconds >= size) {
      if (unit === 'week' && seconds >= size * 5) return formatDate(value);
      return rtf.format(-Math.floor(seconds / size), unit);
    }
  }
  return rtf.format(-Math.max(1, Math.floor(seconds / 60)), 'minute');
};

/** plural(3, 'school') → "3 schools" */
export const plural = (count, singular, pluralForm = `${singular}s`) =>
  `${count.toLocaleString(LOCALE)} ${count === 1 ? singular : pluralForm}`;

/** "Grade R", "Grade 1", "All grades (R–3)" */
export const gradeLabel = (grade) => (grade === 'R-3' ? 'All grades (R–3)' : `Grade ${grade}`);

export const GRADE_OPTIONS = ['R', '1', '2', '3', 'R-3'];

/** Grades a class can be in (Foundation Phase). */
export const CLASS_GRADES = ['R', '1', '2', '3'];

export const GENDERS = ['Female', 'Male', 'Other'];

/** Learners still at the school ('repeated' learners are too). */
export const isCurrentLearner = (learner) => ['active', 'repeated'].includes(learner.academic_status);

/** StatusBadge status for a learner: 'unplaced' | 'active' | 'left'. */
export const learnerStatus = (learner) => {
  if (!isCurrentLearner(learner)) return 'left';
  return learner.current_class_id ? 'active' : 'unplaced';
};

/** CAPS achievement level (1–7) for a percentage, as on South African report cards. */
export const capsLevel = (percentage) => {
  const bands = [80, 70, 60, 50, 40, 30];
  const index = bands.findIndex((min) => percentage >= min);
  return index === -1 ? 1 : 7 - index;
};

export const CAPS_LEVELS = {
  7: 'Outstanding (80–100%)',
  6: 'Meritorious (70–79%)',
  5: 'Substantial (60–69%)',
  4: 'Adequate (50–59%)',
  3: 'Moderate (40–49%)',
  2: 'Elementary (30–39%)',
  1: 'Not achieved (0–29%)',
};

export const PROVINCES = [
  'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo',
  'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape',
];

export const initials = (first = '', last = '') => `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();

/** 'active' | 'pending' (never signed in) | 'inactive' for a staff account. */
export const accountStatus = (user) => {
  if (!user.is_active) return 'inactive';
  return user.last_login ? 'active' : 'pending';
};

export const capitalize = (text = '') => text.charAt(0).toUpperCase() + text.slice(1);

/** wa.me link for a phone number; SA numbers written 082… become 2782…. Null if it isn't a number. */
export const whatsappLink = (phone) => {
  let digits = String(phone ?? '').replace(/\D/g, '');
  if (/^0\d{9}$/.test(digits)) digits = `27${digits.slice(1)}`;
  return digits.length >= 10 ? `https://wa.me/${digits}` : null;
};
