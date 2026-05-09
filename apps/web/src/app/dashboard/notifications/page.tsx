'use client';

import { useEffect } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import { useT } from '@/lib/i18n';
import { C } from '@/lib/colors';

export default function NotificationsPage() {
  const t = useT();
  const {
    notifications,
    isLoading,
    loadNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  useEffect(() => {
    loadNotifications();
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div style={{ padding: '28px 32px', maxWidth: '720px' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', marginBottom: '28px',
      }}>
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            fontFamily: 'monospace', fontSize: '10.5px',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            color: C.accent, marginBottom: '10px',
          }}>
            <span style={{ width: '16px', height: '1px', background: C.accent, opacity: 0.6, display: 'inline-block' }} />
            {t.notifications_title}
          </div>
          <h1 style={{
            fontSize: '22px', fontWeight: 700, color: C.text,
            letterSpacing: '-0.02em', marginBottom: '5px', lineHeight: 1.1,
          }}>
            {t.notifications_title}
          </h1>
          <p style={{ fontSize: '13px', color: C.text3 }}>
            {unreadCount > 0
              ? t.notifications_unread_count(unreadCount)
              : t.notifications_no_unread}
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            style={{
              marginTop: '6px', padding: '6px 12px',
              borderRadius: '6px', fontSize: '12.5px',
              color: C.text2, background: C.bg2,
              border: `1px solid ${C.border2}`, cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = C.accent;
              e.currentTarget.style.color = C.accent;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = C.border2;
              e.currentTarget.style.color = C.text2;
            }}
          >
            {t.notifications_btn_mark_all_read}
          </button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '200px', color: C.text4, fontSize: '13px',
        }}>
          {t.notifications_loading}
        </div>
      ) : notifications.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '64px 20px', gap: '12px',
          border: `1px dashed ${C.border}`, borderRadius: '10px',
          background: `${C.bg2}80`,
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"
            width="40" height="40" style={{ color: C.text4 }}>
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
          </svg>
          <span style={{ fontSize: '14px', fontWeight: 500, color: C.text3 }}>
            {t.notifications_empty_title}
          </span>
          <span style={{ fontSize: '12.5px', color: C.text4 }}>
            {t.notifications_empty_desc}
          </span>
        </div>
      ) : (
        <div style={{
          border: `1px solid ${C.border}`, borderRadius: '10px',
          overflow: 'hidden', background: C.bg2,
        }}>
          {notifications.map((n, i) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onMarkAsRead={markAsRead}
              onDelete={deleteNotification}
              hasBorder={i < notifications.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
