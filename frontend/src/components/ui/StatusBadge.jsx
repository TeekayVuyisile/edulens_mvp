// Status is always shown as a word plus a coloured dot, never colour alone.
const STATUSES = {
  active: { label: 'Active', tone: 'success' },
  inactive: { label: 'Inactive', tone: 'neutral' },
  pending: { label: 'Invite pending', tone: 'warning' },
  archived: { label: 'Archived', tone: 'neutral' },
  attention: { label: 'Needs attention', tone: 'warning' },
};

const StatusBadge = ({ status, label }) => {
  const config = STATUSES[status] ?? { label: status, tone: 'neutral' };
  return (
    <span className={`el-status-badge el-tone--${config.tone}`}>
      <span className="el-status-badge__dot" aria-hidden="true" />
      {label ?? config.label}
    </span>
  );
};

export default StatusBadge;
