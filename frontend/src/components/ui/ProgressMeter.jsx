/**
 * "12 of 30 marked" with a thin bar. The words carry the meaning; the bar is extra.
 * tone: 'primary' (default) or 'success' (done).
 */
const ProgressMeter = ({ value, max, label, compact = false }) => {
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  const done = max > 0 && value >= max;
  return (
    <div className={`el-meter ${done ? 'el-meter--done' : ''} ${compact ? 'el-meter--compact' : ''}`}>
      <div className="el-meter__label">
        <span className="tabular-nums">
          <strong>{value}</strong> of {max}
        </span>
        {label && <span className="el-meter__note">{label}</span>}
      </div>
      <div
        className="el-meter__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={`${value} of ${max} ${label ?? ''}`.trim()}
      >
        <span className="el-meter__fill" style={{ transform: `scaleX(${ratio})` }} />
      </div>
    </div>
  );
};

export default ProgressMeter;
