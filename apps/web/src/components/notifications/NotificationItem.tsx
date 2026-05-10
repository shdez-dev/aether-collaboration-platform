'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Notification } from '@aether/types';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useT } from '@/lib/i18n';
import { C } from '@/lib/colors';

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead?: (id: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onClose?: () => void;
  hasBorder?: boolean;
}

const TYPE_META: Record<string, { color: string; icon: React.ReactNode }> = {
  COMMENT_MENTION: {
    color: '#3b82f6',
    icon: (
      <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12">
        <path d="M2 2h10v8H8l-3 2V10H2z" />
      </svg>
    ),
  },
  COMMENT_ADDED: {
    color: '#3b82f6',
    icon: (
      <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12">
        <path d="M2 2h10v8H8l-3 2V10H2z" />
      </svg>
    ),
  },
  CARD_ASSIGNED: {
    color: '#10b981',
    icon: (
      <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" width="12" height="12">
        <path d="M2 7l3 3 7-7" />
      </svg>
    ),
  },
  CARD_UNASSIGNED: {
    color: '#6b7280',
    icon: (
      <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12">
        <path d="M2 2l10 10M12 2L2 12" />
      </svg>
    ),
  },
  CARD_DUE_SOON: {
    color: '#f59e0b',
    icon: (
      <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12">
        <circle cx="7" cy="7" r="5" /><path d="M7 4v3l2 1.5" />
      </svg>
    ),
  },
  CARD_OVERDUE: {
    color: '#ef4444',
    icon: (
      <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12">
        <circle cx="7" cy="7" r="5" /><path d="M7 4v3l2 1.5" />
      </svg>
    ),
  },
  BOARD_INVITE: {
    color: '#a855f7',
    icon: (
      <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12">
        <rect x="1" y="3" width="12" height="9" rx="1" /><path d="M1 6h12M4 1v2M10 1v2" />
      </svg>
    ),
  },
  WORKSPACE_INVITE: {
    color: '#a855f7',
    icon: (
      <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12">
        <path d="M2 7h10M8 4l3 3-3 3" />
      </svg>
    ),
  },
  TEAM_INVITE: {
    color: '#06b6d4',
    icon: (
      <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12">
        <circle cx="5" cy="4" r="2" /><path d="M1 11c0-2 1.5-3 4-3s4 1 4 3" />
        <path d="M10 7l2 2-2 2" />
      </svg>
    ),
  },
  WORKSPACE_REMOVED: {
    color: '#ef4444',
    icon: (
      <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12">
        <path d="M2 7h10M6 4l-3 3 3 3" />
      </svg>
    ),
  },
};

const DEFAULT_META = {
  color: '#6b7280',
  icon: (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12">
      <circle cx="7" cy="7" r="5" />
    </svg>
  ),
};

export function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
  onClose,
  hasBorder = false,
}: NotificationItemProps) {
  const t = useT();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [hovered, setHovered] = useState(false);

  const meta = TYPE_META[notification.type] ?? DEFAULT_META;

  const getRelativeTime = () => {
    try {
      return formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: es });
    } catch {
      return notification.createdAt;
    }
  };

  const handleClick = async () => {
    if (!notification.read && onMarkAsRead) {
      setIsLoading(true);
      try { await onMarkAsRead(notification.id); } catch {} finally { setIsLoading(false); }
    }
    const { workspaceId, boardId } = (notification.data ?? {}) as any;
    if (notification.type === 'WORKSPACE_INVITE' || notification.type === 'WORKSPACE_REMOVED') {
      if (workspaceId) { router.push(`/dashboard/workspaces/${workspaceId}`); onClose?.(); }
    } else if (workspaceId && boardId) {
      router.push(`/dashboard/workspaces/${workspaceId}/boards/${boardId}`); onClose?.();
    } else if (workspaceId) {
      router.push(`/dashboard/workspaces/${workspaceId}`); onClose?.();
    }
  };

  const handleMarkAsRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onMarkAsRead || notification.read) return;
    setIsLoading(true);
    try { await onMarkAsRead(notification.id); } catch {} finally { setIsLoading(false); }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onDelete) return;
    setIsLoading(true);
    try { await onDelete(notification.id); } catch {} finally { setIsLoading(false); }
  };

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '10px',
        padding: '10px 14px',
        cursor: 'pointer', position: 'relative',
        background: hovered ? C.hover : (!notification.read ? `${C.accent}09` : 'transparent'),
        borderBottom: hasBorder ? `1px solid ${C.border}` : 'none',
        opacity: isLoading ? 0.5 : 1,
        transition: 'background 0.12s',
      }}
    >
      {/* Unread indicator */}
      {!notification.read && (
        <span style={{
          position: 'absolute', left: '5px', top: '50%', transform: 'translateY(-50%)',
          width: '4px', height: '4px', borderRadius: '50%',
          background: C.accent, flexShrink: 0,
        }} />
      )}

      {/* Icon */}
      <div style={{
        width: '28px', height: '28px', borderRadius: '6px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${meta.color}18`, color: meta.color,
        border: `1px solid ${meta.color}28`,
      }}>
        {meta.icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: '12.5px', fontWeight: notification.read ? 400 : 600,
          color: C.text, lineHeight: 1.4, marginBottom: '2px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {notification.title}
        </p>
        <p style={{
          fontSize: '11.5px', color: C.text3, lineHeight: 1.5,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden', marginBottom: '4px',
        }}>
          {notification.message}
        </p>
        <span style={{
          fontSize: '10.5px', color: C.text4,
          fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums',
        }}>
          {getRelativeTime()}
        </span>
      </div>

      {/* Actions */}
      {hovered && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
          {!notification.read && onMarkAsRead && (
            <button
              onClick={handleMarkAsRead}
              title={t.notifications_btn_mark_read}
              style={{
                width: '22px', height: '22px', borderRadius: '4px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'none', border: 'none', cursor: 'pointer', color: C.text3,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = `${C.green}20`; e.currentTarget.style.color = C.green; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = C.text3; }}
            >
              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" width="10" height="10">
                <path d="M2 6l2.5 2.5 5.5-5" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              onClick={handleDelete}
              title={t.notifications_btn_delete}
              style={{
                width: '22px', height: '22px', borderRadius: '4px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'none', border: 'none', cursor: 'pointer', color: C.text3,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = `${C.red}20`; e.currentTarget.style.color = C.red; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = C.text3; }}
            >
              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" width="10" height="10">
                <path d="M2 2l8 8M10 2l-8 8" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
