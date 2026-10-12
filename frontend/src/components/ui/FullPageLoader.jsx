import BrandMark from './BrandMark';

const FullPageLoader = ({ label = 'Loading…' }) => (
  <div className="el-fullpage-loader" role="status" aria-live="polite">
    <BrandMark size={44} />
    <div className="spinner-border spinner-border-sm text-primary" aria-hidden="true" />
    <span className="text-body-secondary small">{label}</span>
  </div>
);

export default FullPageLoader;
