import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import SuperAdminDashboard from './dashboards/SuperAdminDashboard';
import SchoolAdminDashboard from './dashboards/SchoolAdminDashboard';
import TeacherDashboard from './dashboards/TeacherDashboard';

const DASHBOARDS = {
  super_admin: SuperAdminDashboard,
  school_admin: SchoolAdminDashboard,
  teacher: TeacherDashboard,
};

/** /dashboard shows the signed-in role's own dashboard. */
const Dashboard = () => {
  const { user } = useAuth();
  const RoleDashboard = DASHBOARDS[user?.role];
  return RoleDashboard ? <RoleDashboard /> : <Navigate to="/unauthorized" replace />;
};

export default Dashboard;
