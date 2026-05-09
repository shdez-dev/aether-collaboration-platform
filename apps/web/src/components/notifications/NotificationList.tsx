'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { NotificationItem } from './NotificationItem';
import { useNotifications } from '@/hooks/useNotifications';
import { useT } from '@/lib/i18n';
import { C } from '@/lib/colors';

interface NotificationListProps {
  onClose?: () => void;
}

export function NotificationList({ onClose }: NotificationListProps) {
  const t = useT();
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    hasUnread,
    isLoading,
    loadNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  useEffect(() => {
    if (notifications.length === 0 && !isLoading) {
      loadNotifications();
    }
  }, []);

  return (
    <div style={{
      width: '360px',
      background: C.bg2,
      border: `1px solid ${C.border}`,
      borderRadius: '8px',
      boxShadow: '0 8px 32px -8px rgba(0,0,0,0.5)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px',
        borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>
            {t.notifications_title}
          </span>
          {hasUnread && (
            <span style={{
              fontSize: '10px', fontWeight: 700,
              padding: '1px 6px', borderRadius: '10px',
              background: C.accent, color: 'white',
              lineHeight: '16px',
            }}>
              {unreadCount}
            </span>
          )}
        </div>
        {hasUnread && (
          <button
            onClick={markAllAsRead}
            style={{
              fontSize: '11.5px', color: C.text3,
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '3px 6px', borderRadius: '4px',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = C.hover; e.currentTarget.style.color = C.text; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = C.text3; }}
          >
            {t.notifications_btn_mark_all}
          </button>
        )}
      </div>

      {/* Body */}
      <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
        {isLoading ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '120px', color: C.text4, fontSize: '13px',
          }}>
            {t.notifications_loading}
          </div>
        ) : notifications.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '36px 20px', gap: '10px',
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"
              width="32" height="32" style={{ color: C.text4 }}>
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
            </svg>
            <span style={{ fontSize: '12.5px', color: C.text3 }}>{t.notifications_empty_title}</span>
            <span style={{ fontSize: '11.5px', color: C.text4 }}>{t.notifications_empty_desc}</span>
          </div>
        ) : (
          <div>
            {notifications.map((n, i) => (
              <NotificationItem
                key={n.id}
                notification={n}
                onMarkAsRead={markAsRead}
                onDelete={deleteNotification}
                onClose={onClose}
                hasBorder={i < notifications.length - 1}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: '6px' }}>
          <button
            onClick={() => { onClose?.(); router.push('/dashboard/notifications'); }}
            style={{
              width: '100%', padding: '7px', borderRadius: '5px',
              fontSize: '12px', color: C.text3, background: 'none',
              border: 'none', cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = C.hover; e.currentTarget.style.color = C.text; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = C.text3; }}
          >
            {t.notifications_btn_view_all}
          </button>
        </div>
      )}
    </div>
  );
}
