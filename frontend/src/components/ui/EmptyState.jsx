/** Explains an empty list and offers the next step. */
const EmptyState = ({ icon: Icon, title, children, action, compact = false }) => (
  <div className={`el-empty ${compact ? 'el-empty--compact' : ''}`}>
    {Icon && (
      <span className="el-empty__icon" aria-hidden="true">
        <Icon size={compact ? 20 : 24} />
      </span>
    )}
    <p className="el-empty__title">{title}</p>
    {children && <p className="el-empty__body">{children}</p>}
    {action}
  </div>
);

export default EmptyState;
