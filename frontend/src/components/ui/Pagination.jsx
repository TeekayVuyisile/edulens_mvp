import { LuChevronLeft, LuChevronRight } from 'react-icons/lu';

/** "Showing 21–40 of 57" with previous/next buttons. Hidden for a single page. */
const Pagination = ({ page, limit, total, onChange, noun = 'results' }) => {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  if (total <= limit) return null;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <nav className="el-pagination" aria-label="Pagination">
      <span className="text-body-secondary small tabular-nums">
        Showing {from}–{to} of {total} {noun}
      </span>
      <div className="d-flex gap-2">
        <button
          type="button"
          className="btn btn-light btn-sm"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <LuChevronLeft aria-hidden="true" />
        </button>
        <span className="small align-self-center tabular-nums" aria-current="page">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          className="btn btn-light btn-sm"
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <LuChevronRight aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
};

export default Pagination;
