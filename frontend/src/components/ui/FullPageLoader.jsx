import BrandMark from './BrandMark';
import ServerNotice from './ServerNotice';

const FullPageLoader = ({ label = 'Loading…' }) => (
  <div className="el-fullpage-loader" role="status" aria-live="polite">
    <BrandMark size={44} />
    <div className="spinner-border spinner-border-sm text-primary" aria-hidden="true" />
    <span className="text-body-secondary small">{label}</span>
    <div className="w-100 px-3" style={{ maxWidth: 440 }}>
      <ServerNotice />
    </div>
  </div>
);

export default FullPageLoader;
