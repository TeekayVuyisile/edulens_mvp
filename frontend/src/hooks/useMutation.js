import { useCallback, useState } from 'react';
import http, { errorMessage } from '../lib/http';

/** Turns the API's validation errors array into { field: message }. */
export const fieldErrorsFrom = (error) =>
  Object.fromEntries((error?.response?.data?.errors ?? []).map((e) => [e.path, e.msg]));

/**
 * Wraps a write request with pending state and parsed errors.
 *
 *   const save = useMutation();
 *   const result = await save.run('post', '/api/x', body);
 *   if (result.ok) ... else save.error / save.fieldErrors
 */
export const useMutation = () => {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  // config: extra axios options, e.g. { timeout } for slow requests.
  const run = useCallback(async (method, url, body, config = {}) => {
    setPending(true);
    setError(null);
    setFieldErrors({});
    try {
      const res = await http.request({ ...config, method, url, data: body });
      return { ok: true, data: res.data.data, message: res.data.message };
    } catch (err) {
      const fields = fieldErrorsFrom(err);
      setFieldErrors(fields);
      // Field-level problems are shown next to the fields; keep the banner for the rest.
      const message = Object.keys(fields).length ? 'Please fix the highlighted fields.' : errorMessage(err);
      setError(message);
      return { ok: false, message, fieldErrors: fields, response: err.response?.data };
    } finally {
      setPending(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setFieldErrors({});
  }, []);

  return { run, pending, error, fieldErrors, reset };
};
