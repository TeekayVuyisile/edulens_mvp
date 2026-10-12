import { Dropdown } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { LuChevronDown, LuLogOut, LuMenu, LuUser } from 'react-icons/lu';
import { useAuth } from '../../contexts/useAuth';
import { ROLE_LABELS } from '../../config/navigation';
import BrandMark from '../ui/BrandMark';

const initials = (user) => `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase();

const Topbar = ({ onOpenMenu }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="el-topbar">
      <button
        type="button"
        className="el-icon-btn d-lg-none"
        onClick={onOpenMenu}
        aria-label="Open navigation menu"
      >
        <LuMenu size={22} aria-hidden="true" />
      </button>
      <Link to="/dashboard" className="d-lg-none">
        <BrandMark size={30} withWordmark />
      </Link>

      <div className="ms-auto d-flex align-items-center gap-2">
        <Dropdown align="end">
          <Dropdown.Toggle as="button" type="button" className="el-user-menu" aria-label="Account menu">
            <span className="el-avatar" aria-hidden="true">
              {initials(user)}
            </span>
            <span className="d-none d-sm-flex flex-column align-items-start lh-sm">
              <span className="fw-semibold text-body">
                {user.first_name} {user.last_name}
              </span>
              <span className="small text-body-secondary">{ROLE_LABELS[user.role] ?? user.role}</span>
            </span>
            <LuChevronDown className="text-body-secondary d-none d-sm-block" aria-hidden="true" />
          </Dropdown.Toggle>

          <Dropdown.Menu className="el-dropdown">
            <div className="px-3 py-2 d-sm-none border-bottom mb-1">
              <div className="fw-semibold">
                {user.first_name} {user.last_name}
              </div>
              <div className="small text-body-secondary">{ROLE_LABELS[user.role] ?? user.role}</div>
            </div>
            <Dropdown.Item as={Link} to="/profile" className="d-flex align-items-center gap-2">
              <LuUser aria-hidden="true" /> My profile
            </Dropdown.Item>
            <Dropdown.Divider />
            <Dropdown.Item
              as="button"
              onClick={handleSignOut}
              className="d-flex align-items-center gap-2 text-danger"
            >
              <LuLogOut aria-hidden="true" /> Sign out
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </div>
    </header>
  );
};

export default Topbar;
