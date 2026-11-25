"use client";

import { useEffect, useState } from "react";
import { api, errorMessages, type Query } from "./api";

interface State<T> {
  key: string | null;
  version: number;
  data?: T;
  errors?: string[];
}

/**
 * Load data for a page (GET). Re-loads when the path or query changes, and on reload().
 *
 *   const { data, errors, loading, reload } = useApi<Page<Flight>>("/flights/search", { from, to, date, page });
 *   if (loading) return <LoadingState />;
 *   if (errors) return <FormErrors messages={errors} />;
 *   if (!data?.items.length) return <EmptyState title="No flights found" />;
 *
 * Pass null as the path to wait (for example until the user has filled the search form).
 */
export function useApi<T>(path: string | null, query?: Query) {
  const reqKey = path ? JSON.stringify([path, query ?? {}]) : null;
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<State<T>>({ key: null, version: 0 });

  useEffect(() => {
    if (!reqKey) return;
    const [p, q] = JSON.parse(reqKey) as [string, Query];
    let active = true;
    api.get<T>(p, q).then(
      (data) => active && setState({ key: reqKey, version, data }),
      (err) => active && setState({ key: reqKey, version, errors: errorMessages(err) }),
    );
    return () => {
      active = false;
    };
  }, [reqKey, version]);

  const current = reqKey !== null && state.key === reqKey && state.version === version;
  return {
    data: current ? state.data : undefined,
    errors: current ? state.errors : undefined,
    loading: reqKey !== null && !current,
    /** Load again, e.g. after a cancel or delete. */
    reload: () => setVersion((v) => v + 1),
  };
}
