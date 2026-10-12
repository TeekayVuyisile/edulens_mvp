const LOCALE = 'en-ZA';

/** 12 Oct 2026 */
export const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

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
