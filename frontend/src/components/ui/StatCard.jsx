/**
 * A single headline number. tone picks the icon colour:
 * 'primary' | 'success' | 'warning' | 'neutral'.
 */
const StatCard = ({ label, value, icon: Icon, tone = 'primary', hint, loading = false }) => (
  <div className="el-stat">
    <div className="el-stat__text">
      <span className="el-stat__label">{label}</span>
      {loading ? (
        <span className="el-skeleton el-skeleton--number" aria-hidden="true" />
      ) : (
        <span className="el-stat__value tabular-nums">{value ?? '—'}</span>
      )}
      {hint && <span className="el-stat__hint">{hint}</span>}
    </div>
    {Icon && (
      <span className={`el-stat__icon el-tone--${tone}`} aria-hidden="true">
        <Icon size={20} />
      </span>
    )}
  </div>
);

export default StatCard;
