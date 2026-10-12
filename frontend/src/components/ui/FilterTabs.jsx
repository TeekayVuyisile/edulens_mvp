import { useId } from 'react';
import { motion } from 'framer-motion';

/**
 * Segmented filter with optional counts. The selected pill slides between
 * options (shared layout animation).
 *
 * options: [{ value, label, count? }]
 */
const FilterTabs = ({ options, value, onChange, label = 'Filter' }) => {
  const layoutId = useId();

  return (
    <div className="el-filter-tabs" role="tablist" aria-label={label}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            className={`el-filter-tabs__tab ${selected ? 'is-selected' : ''}`}
            onClick={() => onChange(option.value)}
          >
            {selected && (
              <motion.span
                layoutId={layoutId}
                className="el-filter-tabs__pill"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
            <span className="el-filter-tabs__label">{option.label}</span>
            {option.count !== undefined && (
              <span className="el-filter-tabs__count tabular-nums">{option.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default FilterTabs;
