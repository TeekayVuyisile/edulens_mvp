/**
 * Builds the SET clause of an UPDATE from `data`, keeping only keys listed in
 * `allowedColumns`. Column names come from the allow-list, never from user
 * input, so request bodies can't inject SQL or write protected columns
 * (role, school_id, password_hash, ...).
 *
 * @param {object} data            usually req.body
 * @param {string[]} allowedColumns columns this update may touch
 * @param {number} [firstParam=1]   index of the first $n placeholder
 * @returns {{ setClause: string, values: unknown[], nextParam: number }}
 *          setClause is '' when nothing updatable was supplied
 */
export const buildUpdateSet = (data, allowedColumns, firstParam = 1) => {
  const entries = Object.entries(data ?? {}).filter(
    ([column, value]) => allowedColumns.includes(column) && value !== undefined
  );

  return {
    setClause: entries.map(([column], i) => `${column} = $${firstParam + i}`).join(', '),
    values: entries.map(([, value]) => value),
    nextParam: firstParam + entries.length,
  };
};
