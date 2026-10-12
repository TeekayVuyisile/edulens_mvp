import { useCallback, useEffect, useState } from 'react';
import http, { errorMessage } from '../lib/http';

/**
 * GETs `url` (with `params`) and keeps { data, error, loading } in sync.
 * Refetches when the URL or params change, ignores superseded responses, and
 * exposes reload() for after a mutation. Pass url = null to skip.
 *
 * data holds the response's `data` field (the API's { status, data } envelope).
 * While a new request is in flight the previous data stays visible, so lists
 * don't flash empty; `loading` says whether the data matches the current request.
 */
export const useApi = (url, params) => {
  const [version, setVersion] = useState(0);
  const paramsKey = JSON.stringify(params ?? {});
  const requestKey = url ? `${url}|${paramsKey}|${version}` : null;
  const [result, setResult] = useState({ key: null, data: null, error: null });

  useEffect(() => {
    if (!requestKey) return undefined;
    const controller = new AbortController();

    http
      .get(url, { params: JSON.parse(paramsKey), signal: controller.signal })
      .then((res) => setResult({ key: requestKey, data: res.data.data, error: null }))
      .catch((error) => {
        if (controller.signal.aborted) return;
        setResult((current) => ({ key: requestKey, data: current.data, error: errorMessage(error) }));
      });

    return () => controller.abort();
  }, [requestKey, url, paramsKey]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return {
    data: result.data,
    error: result.key === requestKey ? result.error : null,
    loading: Boolean(requestKey) && result.key !== requestKey,
    reload,
  };
};

/** `value`, but only after it has stopped changing for `delay` ms. */
export const useDebouncedValue = (value, delay = 300) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
};

/** Sets the browser tab title while a page is mounted. */
export const useDocumentTitle = (title) => {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} · Edulens LMS` : 'Edulens LMS';
    return () => {
      document.title = previous;
    };
  }, [title]);
};
