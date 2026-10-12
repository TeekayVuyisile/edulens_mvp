import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/useAuth';

/**
 * Renders the nested routes (or `children`) only for a signed-in user, and,
 * when `allowedRoles` is given, only for those roles.
 */
const ProtectedRoute = ({ allowedRoles, children }) => {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children ?? <Outlet />;
};

/**
 * Sign-in pages. Once a user is signed in they continue to the page they were
 * originally sent away from (see ProtectedRoute), or their dashboard.
 */
export const PublicOnlyRoute = () => {
  const { user } = useAuth();
  const location = useLocation();

  if (user) {
    const from = location.state?.from;
    const to = from ? `${from.pathname}${from.search ?? ''}` : '/dashboard';
    return <Navigate to={to} replace />;
  }
  return <Outlet />;
};

export default ProtectedRoute;
