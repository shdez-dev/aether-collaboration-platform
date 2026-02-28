'use client';

import React, { useRef, useEffect } from 'react';
import { ActivityEventCard } from './ActivityEventCard';
import { groupEventsByDate, type ActivityLogEntry } from '@/lib/utils/activityLog';
import { Loader2 } from 'lucide-react';

interface ActivityTimelineProps {
  events: ActivityLogEntry[];
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
  isLoadingMore?: boolean;
}

export function ActivityTimeline({
  events,
  onLoadMore,
  hasMore = false,
  isLoading = false,
  isLoadingMore = false,
}: ActivityTimelineProps) {
  const observerTarget = useRef<HTMLDivElement>(null);

  // Infinite scroll observer
  useEffect(() => {
    if (!onLoadMore || !hasMore || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [onLoadMore, hasMore, isLoadingMore]);

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-3">
            <div className="h-6 w-32 bg-surface border border-border animate-pulse" />
            <div className="space-y-2">
              {[1, 2].map((j) => (
                <div key={j} className="h-24 bg-card border border-border animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center bg-card border border-border p-12">
        <div className="w-16 h-16 bg-surface border border-border flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-2">No hay actividad</h3>
        <p className="text-sm text-text-secondary max-w-sm">
          No se encontraron eventos con los filtros seleccionados. Intenta ajustar los filtros o
          verifica más tarde.
        </p>
      </div>
    );
  }

  // Group events by date
  const groupedEvents = groupEventsByDate(events);

  return (
    <div className="space-y-6">
      {groupedEvents.map((group) => (
        <div key={group.date}>
          {group.isMonthHeader ? (
            /* Month Header */
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-border" />
              <h2 className="text-lg font-bold text-text-primary px-4 py-2 bg-accent/10 border border-accent/30">
                {group.label}
              </h2>
              <div className="flex-1 h-px bg-border" />
            </div>
          ) : (
            <div className="space-y-3 mb-6">
              {/* Date Header */}
              <div className="flex items-center gap-3 px-3 py-2 bg-surface border-b border-border">
                <h3 className="text-sm font-semibold text-text-primary">{group.label}</h3>
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-text-muted font-medium">
                  {group.events.length} {group.events.length === 1 ? 'evento' : 'eventos'}
                </span>
              </div>

              {/* Events List */}
              <div className="space-y-2">
                {group.events.map((event) => (
                  <ActivityEventCard key={event.id} event={event} />
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Load More Trigger */}
      {hasMore && (
        <div ref={observerTarget} className="flex justify-center py-4">
          {isLoadingMore && (
            <div className="flex items-center gap-2 text-sm text-text-muted px-4 py-2 bg-surface border border-border">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Cargando más eventos...</span>
            </div>
          )}
        </div>
      )}

      {/* End of Timeline */}
      {!hasMore && events.length > 0 && (
        <div className="flex justify-center py-4">
          <p className="text-sm text-text-muted px-4 py-2 bg-surface border border-border">
            Has llegado al final del historial
          </p>
        </div>
      )}
    </div>
  );
}
