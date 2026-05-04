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
  accentColor?: string;
}

const C = {
  bg2:     '#0f1217',
  surface: '#14171c',
  hover:   '#1c2128',
  border:  '#1f2329',
  text:    '#e6e8eb',
  text2:   '#a1a7b0',
  text3:   '#6b7280',
  text4:   '#4b5260',
  accent:  '#3b82f6',
};

export function ActivityTimeline({
  events,
  onLoadMore,
  hasMore = false,
  isLoading = false,
  isLoadingMore = false,
  accentColor = '#3b82f6',
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
            <div
              className="animate-pulse"
              style={{ height: '24px', width: '128px', background: C.surface, borderRadius: '6px' }}
            />
            <div className="space-y-2">
              {[1, 2].map((j) => (
                <div
                  key={j}
                  className="animate-pulse"
                  style={{ height: '96px', background: C.surface, borderRadius: '6px' }}
                />
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
      <div
        className="flex flex-col items-center justify-center py-16 text-center"
        style={{ padding: '64px 48px' }}
      >
        <div
          className="flex items-center justify-center mb-4"
          style={{
            width: '64px',
            height: '64px',
            background: C.surface,
            borderRadius: '16px',
          }}
        >
          <svg
            style={{ width: '28px', height: '28px', color: C.text4 }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
        </div>
        <h3 style={{ fontSize: '16px', fontWeight: 600, color: C.text2, marginBottom: '8px' }}>
          {t.activity_timeline_no_activity_title}
        </h3>
        <p style={{ fontSize: '13px', color: C.text4, maxWidth: '320px' }}>
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
              <div style={{ flex: 1, height: '1px', background: C.border }} />
              <h2
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: C.text2,
                  padding: '4px 14px',
                  background: C.hover,
                  border: `1px solid ${C.border}`,
                  borderRadius: '6px',
                }}
              >
                {group.label}
              </h2>
              <div style={{ flex: 1, height: '1px', background: C.border }} />
            </div>
          ) : (
            <div className="space-y-3 mb-6">
              {/* Date label row */}
              <div className="flex items-center gap-3">
                <div style={{ flex: 1, height: '1px', background: C.border }} />
                <span
                  style={{
                    background: C.hover,
                    color: C.text3,
                    borderRadius: '4px',
                    fontSize: '11px',
                    padding: '2px 8px',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {group.label}
                </span>
                <span
                  style={{
                    color: C.text4,
                    fontSize: '11px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t.activity_timeline_events(group.events.length)}
                </span>
                <div style={{ flex: 1, height: '1px', background: C.border }} />
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
            <div className="flex items-center gap-2">
              <Loader2
                style={{ width: '14px', height: '14px', color: accentColor }}
                className="animate-spin"
              />
              <span style={{ fontSize: '12px', color: C.text3 }}>
                {t.activity_timeline_loading_more}
              </span>
            </div>
          )}
        </div>
      )}

      {/* End of Timeline */}
      {!hasMore && events.length > 0 && (
        <div className="flex justify-center py-4">
          <p style={{ fontSize: '11px', color: C.text4 }}>
            {t.activity_timeline_end}
          </p>
        </div>
      )}
    </div>
  );
}
