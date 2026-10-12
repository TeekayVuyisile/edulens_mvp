/** Placeholder rows while a table loads, so the layout doesn't jump. */
const TableSkeleton = ({ rows = 5, columns = 4 }) => (
  <tbody aria-hidden="true">
    {Array.from({ length: rows }, (_, r) => (
      <tr key={r}>
        {Array.from({ length: columns }, (_, c) => (
          <td key={c}>
            <span className="el-skeleton" style={{ width: c === 0 ? '70%' : '50%' }} />
          </td>
        ))}
      </tr>
    ))}
  </tbody>
);

export default TableSkeleton;
