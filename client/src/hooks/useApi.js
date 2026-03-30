import { useState, useEffect, useCallback } from 'react';

export function useApi(apiFn, deps = [], immediate = true) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error,   setError]   = useState(null);

  const fetch = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFn(...args);
      setData(res.data.data ?? res.data);
      return res.data.data ?? res.data;
    } catch (e) {
      const msg = e.response?.data?.error?.message || e.message || 'Error desconocido';
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, deps); // eslint-disable-line

  useEffect(() => {
    if (immediate) fetch();
  }, [immediate]); // eslint-disable-line

  return { data, loading, error, refetch: fetch };
}
