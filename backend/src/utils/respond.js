/** Sends the standard success envelope: { status: 'success', message?, data? }. */
export const ok = (res, data, message, statusCode = 200) =>
  res.status(statusCode).json({
    status: 'success',
    ...(message && { message }),
    ...(data !== undefined && { data }),
  });

export const created = (res, data, message) => ok(res, data, message, 201);

/** Reads ?page=&limit= with sane bounds. */
export const pageParams = (query, { defaultLimit = 20, maxLimit = 100 } = {}) => ({
  page: Math.max(1, Number.parseInt(query.page, 10) || 1),
  limit: Math.min(maxLimit, Math.max(1, Number.parseInt(query.limit, 10) || defaultLimit)),
});
