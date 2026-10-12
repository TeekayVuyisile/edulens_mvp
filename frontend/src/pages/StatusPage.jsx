import { Link } from 'react-router-dom';
import { LuCompass, LuShieldAlert } from 'react-icons/lu';
import BrandMark from '../components/ui/BrandMark';

const StatusMessage = ({ icon: Icon, code, title, children, action }) => (
  <div className="el-status">
    <span className="el-status__icon">
      <Icon size={28} aria-hidden="true" />
    </span>
    <p className="el-status__code">{code}</p>
    <h1 className="el-status__title">{title}</h1>
    <p className="el-status__body">{children}</p>
    {action}
  </div>
);

/** Shown inside the app shell when a signed-in user opens a page their role can't use. */
export const Unauthorized = () => (
  <StatusMessage
    icon={LuShieldAlert}
    code="403"
    title="You don’t have access to this page"
    action={
      <Link to="/dashboard" className="btn btn-primary">
        Go to your dashboard
      </Link>
    }
  >
    This area belongs to a different role. If you think you should have access, ask your school administrator.
  </StatusMessage>
);

/** Full-page 404 for unknown URLs. */
export const NotFound = () => (
  <div className="el-status-page">
    <Link to="/" className="mb-5">
      <BrandMark size={36} withWordmark />
    </Link>
    <StatusMessage
      icon={LuCompass}
      code="404"
      title="We couldn’t find that page"
      action={
        <Link to="/" className="btn btn-primary">
          Back to Edulens
        </Link>
      }
    >
      The link may be out of date, or the page may have moved.
    </StatusMessage>
  </div>
);
