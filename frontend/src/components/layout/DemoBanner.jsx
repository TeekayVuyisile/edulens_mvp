import { useNavigate } from 'react-router-dom';
import { LuFlaskConical } from 'react-icons/lu';
import { useAuth } from '../../contexts/useAuth';
import { ROLE_LABELS } from '../../config/navigation';

/** Tells visitors they're in the shared demo, and lets them try another role. */
const DemoBanner = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user?.is_demo) return null;

  const switchRole = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="el-demo-banner" role="status">
      <LuFlaskConical className="el-demo-banner__icon" aria-hidden="true" />
      <p className="el-demo-banner__text">
        <strong>Demo account.</strong> You’re exploring as {user.first_name} {user.last_name} (
        {(ROLE_LABELS[user.role] ?? user.role).toLowerCase()}). Other visitors share this demo school.
      </p>
      <button type="button" className="el-demo-banner__action" onClick={switchRole}>
        Try another role
      </button>
    </div>
  );
};

export default DemoBanner;
