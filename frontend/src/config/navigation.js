import {
  LuBookOpen,
  LuBuilding2,
  LuChartColumn,
  LuClipboardList,
  LuFileText,
  LuLayoutDashboard,
  LuSchool,
  LuUsers,
  LuUserRoundCog,
} from 'react-icons/lu';

export const ROLE_LABELS = {
  super_admin: 'Super Admin',
  school_admin: 'School Admin',
  teacher: 'Teacher',
};

/**
 * Sidebar sections per role. Each item: { to, label, icon, end? }.
 * `end` makes the link active only on an exact path match.
 */
export const NAVIGATION = {
  super_admin: [
    { heading: 'Overview', items: [{ to: '/dashboard', label: 'Dashboard', icon: LuLayoutDashboard }] },
    {
      heading: 'Platform',
      items: [
        { to: '/super-admin/schools', label: 'Schools', icon: LuBuilding2 },
        { to: '/super-admin/curricula', label: 'Curricula', icon: LuBookOpen },
        { to: '/super-admin/users', label: 'Users', icon: LuUserRoundCog },
      ],
    },
  ],
  school_admin: [
    { heading: 'Overview', items: [{ to: '/dashboard', label: 'Dashboard', icon: LuLayoutDashboard }] },
    {
      heading: 'School',
      items: [
        { to: '/school-admin/classes', label: 'Classes', icon: LuSchool },
        { to: '/school-admin/teachers', label: 'Teachers', icon: LuUserRoundCog },
        { to: '/school-admin/learners', label: 'Learners', icon: LuUsers },
        { to: '/school-admin/reports', label: 'Reports', icon: LuChartColumn },
      ],
    },
  ],
  teacher: [
    { heading: 'Overview', items: [{ to: '/dashboard', label: 'Dashboard', icon: LuLayoutDashboard }] },
    {
      heading: 'Teaching',
      items: [
        { to: '/teacher/classes', label: 'My classes', icon: LuSchool },
        { to: '/teacher/assessments', label: 'Assessments', icon: LuClipboardList },
        { to: '/teacher/worksheets', label: 'Worksheets', icon: LuFileText },
      ],
    },
  ],
};

export const navigationFor = (role) => NAVIGATION[role] ?? [];
