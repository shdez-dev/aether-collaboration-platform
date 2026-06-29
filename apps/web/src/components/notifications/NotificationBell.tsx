'use client';

import { useRef, useEffect, useState } from 'react';
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
  const buttonRef    = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ bottom: number; left: number } | null>(null);

  // Close on outside click — must also ignore clicks inside the fixed dropdown
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        containerRef.current?.contains(target) ||
        target.closest('[data-notif-dropdown]')
      ) return;
      closeDropdown();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, closeDropdown]);

  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      // Open upward; anchor left edge to button left (dropdown is 360px wide)
      setPos({
        bottom: window.innerHeight - rect.top + 8,
        left:   Math.min(rect.left, window.innerWidth - 368),
      });
    }
    toggleDropdown();
  };

  return (
    <>
      <div ref={containerRef} style={{ position: 'relative' }}>
        <button
          ref={buttonRef}
          onClick={handleToggle}
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
      </div>

      {/* Fixed dropdown — escapes sidebar overflow clipping */}
      {isOpen && pos && (
        <div
          data-notif-dropdown="true"
          style={{
            position: 'fixed',
            bottom: `${pos.bottom}px`,
            left:   `${pos.left}px`,
            zIndex: 9000,
          }}
        >
          <NotificationList onClose={closeDropdown} />
        </div>
      )}
    </>
  );
}
