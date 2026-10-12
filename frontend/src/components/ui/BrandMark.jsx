/** The Edulens mark (a lens over a spark of learning), plus optional wordmark. */
const BrandMark = ({ size = 32, withWordmark = false, inverted = false, className = '' }) => (
  <span className={`el-brand ${inverted ? 'el-brand--inverted' : ''} ${className}`}>
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" fill={inverted ? '#fff' : '#4F46E5'} />
      <circle cx="14" cy="14" r="7" stroke={inverted ? '#4F46E5' : '#fff'} strokeWidth="2.75" />
      <path d="M19.2 19.2 24 24" stroke={inverted ? '#4F46E5' : '#fff'} strokeWidth="2.75" strokeLinecap="round" />
      <circle cx="14" cy="14" r="2.5" fill="#FBBF24" />
    </svg>
    {withWordmark ? (
      <span className="el-brand__wordmark">
        Edulens<span className="el-brand__suffix">LMS</span>
      </span>
    ) : (
      <span className="visually-hidden">Edulens LMS</span>
    )}
  </span>
);

export default BrandMark;
