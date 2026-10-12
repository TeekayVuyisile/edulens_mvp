import { forwardRef } from 'react';
import { Dropdown } from 'react-bootstrap';
import { LuEllipsisVertical } from 'react-icons/lu';

const Toggle = forwardRef(({ onClick, label }, ref) => (
  <button
    ref={ref}
    type="button"
    className="el-icon-btn el-icon-btn--sm"
    onClick={(e) => {
      e.stopPropagation();
      onClick(e);
    }}
    aria-label={label}
  >
    <LuEllipsisVertical aria-hidden="true" />
  </button>
));
Toggle.displayName = 'RowActionsToggle';

/**
 * Overflow menu for a table row.
 * items: [{ label, icon, onClick, danger?, hidden? }] (null entries become dividers)
 */
const RowActions = ({ label, items }) => (
  <Dropdown align="end" onClick={(e) => e.stopPropagation()}>
    <Dropdown.Toggle as={Toggle} label={label} />
    <Dropdown.Menu className="el-dropdown">
      {items
        .filter((item) => item === null || !item.hidden)
        .map((item, index) =>
          item === null ? (
            <Dropdown.Divider key={`divider-${index}`} />
          ) : (
            <Dropdown.Item
              key={item.label}
              as="button"
              onClick={item.onClick}
              className={`d-flex align-items-center gap-2 ${item.danger ? 'text-danger' : ''}`}
            >
              {item.icon && <item.icon aria-hidden="true" />}
              {item.label}
            </Dropdown.Item>
          )
        )}
    </Dropdown.Menu>
  </Dropdown>
);

export default RowActions;
