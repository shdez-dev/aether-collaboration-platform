'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiService } from '@/services/apiService';
import { socketService } from '@/services/socketService';
import { useAuthStore } from '@/stores/authStore';
import type { CalendarEvent } from '@/stores/calendarEventStore';

export function useCalendarRangeEvents(from: string, to: string) {
  const userId = useAuthStore((state) => state.user?.id);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);

  useEffect(() => {
    if (!userId) {
      setEvents([]);
      setError(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    void apiService.get<{ events: CalendarEvent[] }>(`/api/events/me?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, true)
      .then((response) => {
        if (!active) return;
        if (response.success && response.data) {
          setEvents(response.data.events ?? []);
          setError(null);
        } else {
          setError(response.error?.message ?? 'No se pudieron cargar los eventos.');
        }
      })
      .catch(() => { if (active) setError('No se pudieron cargar los eventos.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [from, to, refreshKey, userId]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const invalidate = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(refresh, 140);
    };
    const onVisibility = () => { if (document.visibilityState === 'visible') invalidate(); };
    socketService.on('calendar:invalidate', invalidate);
    window.addEventListener('focus', invalidate);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      if (timer) clearTimeout(timer);
      socketService.off('calendar:invalidate', invalidate);
      window.removeEventListener('focus', invalidate);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh]);

  return { events, loading, error, refresh };
}
