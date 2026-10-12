import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import FullPageLoader from '../components/ui/FullPageLoader';

// Each role's dashboard is its own chunk, so (for example) parents never
// download the admin charts.
const DASHBOARDS = {
  super_admin: lazy(() => import('./dashboards/SuperAdminDashboard')),
  school_admin: lazy(() => import('./dashboards/SchoolAdminDashboard')),
  teacher: lazy(() => import('./dashboards/TeacherDashboard')),
  parent: lazy(() => import('./dashboards/ParentDashboard')),
};

/** /dashboard shows the signed-in role's own dashboard. */
const Dashboard = () => {
  const { user } = useAuth();
  const RoleDashboard = DASHBOARDS[user?.role];
  if (!RoleDashboard) return <Navigate to="/unauthorized" replace />;
  return (
    <Suspense fallback={<FullPageLoader label="Loading your dashboard…" />}>
      <RoleDashboard />
    </Suspense>
  );
};

export default Dashboard;
