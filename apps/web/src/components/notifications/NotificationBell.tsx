'use client';

import { useRef, useEffect } from 'react';
import { useNotificationCount } from '@/hooks/useNotifications';
import { useNotificationStore } from '@/stores/notificationStore';
import { useT } from '@/lib/i18n';
import { C } from '@/lib/colors';
import { NotificationList } from './NotificationList';

export function NotificationBell() {
  const t = useT();
  const { unreadCount, hasUnread } = useNotificationCount();
  const { isOpen, toggleDropdown, closeDropdown } = useNotificationStore();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, closeDropdown]);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        onClick={toggleDropdown}
        aria-label={`${t.notifications_title}${hasUnread ? ` (${unreadCount})` : ''}`}
        style={{
          position: 'relative',
          width: '28px', height: '28px',
          borderRadius: '5px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: isOpen ? C.text : C.text3,
          background: isOpen ? C.hover : 'transparent',
          border: 'none', cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          if (!isOpen) {
            e.currentTarget.style.background = C.hover;
            e.currentTarget.style.color = C.text;
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = C.text3;
          }
        }}
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="15" height="15">
          <path d="M8 2a5 5 0 00-5 5v2l-1 2h12l-1-2V7a5 5 0 00-5-5zM6.5 13a1.5 1.5 0 003 0" />
        </svg>
        {hasUnread && (
          <span style={{
            position: 'absolute', top: '4px', right: '4px',
            width: '5px', height: '5px', borderRadius: '50%',
            background: C.accent, flexShrink: 0,
          }} />
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0,
          zIndex: 100,
        }}>
          <NotificationList onClose={closeDropdown} />
        </div>
      )}
    </div>
  );
}
