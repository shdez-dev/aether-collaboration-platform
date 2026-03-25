'use client';

import React, { useRef, useEffect } from 'react';
import { ActivityEventCard } from './ActivityEventCard';
import { groupEventsByDate, type ActivityLogEntry } from '@/lib/utils/activityLog';
import { useT } from '@/lib/i18n';
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
  const t = useT();
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
    if (currentTarget) observer.observe(currentTarget);
    return () => { if (currentTarget) observer.unobserve(currentTarget); };
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
        <h3 className="text-lg font-semibold text-text-primary mb-2">
          {t.activity_timeline_no_activity_title}
        </h3>
        <p className="text-sm text-text-secondary max-w-sm">
          {t.activity_timeline_no_activity_desc}
        </p>
      </div>
    );
  }

  const groupedEvents = groupEventsByDate(events, t);

  return (
    <div className="space-y-6">
      {groupedEvents.map((group) => (
        <div key={group.date}>
          {group.isMonthHeader ? (
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-border" />
              <h2 className="text-lg font-bold text-text-primary px-4 py-2 bg-accent/10 border border-accent/30">
                {group.label}
              </h2>
              <div className="flex-1 h-px bg-border" />
            </div>
          ) : (
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3 px-3 py-2 bg-surface border-b border-border">
                <h3 className="text-sm font-semibold text-text-primary">{group.label}</h3>
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-text-muted font-medium">
                  {t.activity_timeline_events(group.events.length)}
                </span>
              </div>

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
              <span>{t.activity_timeline_loading_more}</span>
            </div>
          )}
        </div>
      )}

      {/* End of Timeline */}
      {!hasMore && events.length > 0 && (
        <div className="flex justify-center py-4">
          <p className="text-sm text-text-muted px-4 py-2 bg-surface border border-border">
            {t.activity_timeline_end}
          </p>
        </div>
      )}
    </div>
  );
}
