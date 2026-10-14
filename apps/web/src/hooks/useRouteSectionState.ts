'use client';

import { useCallback, useEffect, useState } from 'react';

/** Keeps a page's selected section in its URL so reloads and shared links restore it. */
export function useRouteSectionState<T extends string>(
  parameter: string,
  fallback: T,
  availableSections: readonly T[],
  scope = '',
): [T, (section: T) => void] {
  const [section, setSection] = useState<T>(fallback);
  const availableSectionsKey = availableSections.join('\u0000');

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get(parameter);
    const validSections = new Set(availableSectionsKey.split('\u0000'));
    setSection(requested && validSections.has(requested) ? requested as T : fallback);
  }, [availableSectionsKey, fallback, parameter, scope]);

  const selectSection = useCallback((next: T) => {
    setSection(next);
    const url = new URL(window.location.href);
    if (next === fallback) url.searchParams.delete(parameter);
    else url.searchParams.set(parameter, next);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }, [fallback, parameter]);

  return [section, selectSection];
}
