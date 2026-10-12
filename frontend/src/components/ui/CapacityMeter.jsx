/**
 * "24 / 30" with a thin bar. Fullness is also stated in words for screen
 * readers, so it never relies on the bar's colour.
 */
const CapacityMeter = ({ count, capacity, compact = false }) => {
  const ratio = capacity > 0 ? Math.min(1, count / capacity) : 0;
  const tone = count >= capacity ? 'full' : ratio >= 0.9 ? 'nearly' : 'ok';
  const free = Math.max(0, capacity - count);

  return (
    <div className={`el-meter el-meter--${tone} ${compact ? 'el-meter--compact' : ''}`}>
      <div className="el-meter__label">
        <span className="tabular-nums">
          <strong>{count}</strong> / {capacity}
        </span>
        {!compact && (
          <span className="el-meter__note">{tone === 'full' ? 'Full' : `${free} place${free === 1 ? '' : 's'} left`}</span>
        )}
      </div>
      <div
        className="el-meter__track"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={capacity}
        aria-valuenow={count}
        aria-label={`${count} of ${capacity} places taken`}
      >
        <span className="el-meter__fill" style={{ transform: `scaleX(${ratio})` }} />
      </div>
    </div>
  );
};

export default CapacityMeter;
