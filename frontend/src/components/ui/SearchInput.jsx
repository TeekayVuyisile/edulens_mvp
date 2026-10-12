import { LuSearch, LuX } from 'react-icons/lu';

/** Search box with an icon and a clear button. Debounce the value where it's used. */
const SearchInput = ({ value, onChange, placeholder = 'Search…', label = 'Search' }) => (
  <div className="el-search">
    <LuSearch className="el-search__icon" aria-hidden="true" />
    <input
      type="search"
      className="form-control"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={label}
    />
    {value && (
      <button type="button" className="el-search__clear" onClick={() => onChange('')} aria-label="Clear search">
        <LuX aria-hidden="true" />
      </button>
    )}
  </div>
);

export default SearchInput;
