'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowRight, ArrowUpRight, AtSign, BellDot, CalendarClock, CheckCheck, ClipboardCheck,
  FileText, MessageCircle, RefreshCw, UserRound, Users,
} from 'lucide-react';
import type { Notification } from '@aether/types';
import { useNotificationStore } from '@/stores/notificationStore';
import styles from './NotificationsUnreadWidget.module.css';

type Tone = { color: string; label: string; icon: typeof BellDot };

function toneFor(notification: Notification): Tone {
  const type = notification.type;
  if (type.includes('MENTION')) return { color: '#9675cc', label: 'Mención', icon: AtSign };
  if (type.includes('COMMENT') || type === 'DOCUMENT_SHARED') return { color: '#9675cc', label: type === 'DOCUMENT_SHARED' ? 'Documento' : 'Comentario', icon: type === 'DOCUMENT_SHARED' ? FileText : MessageCircle };
  if (type.includes('INVITE') || type === 'CALENDAR_EVENT_INVITE' || type.includes('MEMBER')) return { color: '#cf747d', label: 'Invitación', icon: type === 'CALENDAR_EVENT_INVITE' ? CalendarClock : Users };
  if (type.includes('DUE') || type.includes('OVERDUE') || type.includes('MILESTONE')) return { color: '#d29a62', label: 'Fecha', icon: CalendarClock };
  if (type.includes('ASSIGNED')) return { color: '#4d9a84', label: 'Asignación', icon: UserRound };
  return { color: '#6987b8', label: 'Actividad', icon: BellDot };
}

function titleFor(notification: Notification) {
  const data = notification.data ?? {};
  const target = data.cardTitle || data.documentTitle || data.documentName || data.eventTitle || data.projectName || data.workspaceName || data.teamName;
  if (target) return String(target);
  return notification.title?.trim() || 'Nueva actividad';
}

function detailFor(notification: Notification) {
  const data = notification.data ?? {};
  const actor = data.creatorName || data.actorName || data.assignerName || data.senderName || data.inviterName || data.authorName;
  const message = notification.message?.trim();
  if (actor && message && !message.toLocaleLowerCase('es').startsWith(String(actor).toLocaleLowerCase('es'))) return `${actor} · ${message}`;
  return message || String(actor || 'Tienes una notificación nueva');
}

function notificationHref(notification: Notification) {
  const data = notification.data ?? {};
  if (notification.type === 'ORGANIZATION_INVITE' && data.invitationId) return `/organization-invitation?invitationId=${encodeURIComponent(data.invitationId)}`;
  if (notification.type === 'CALENDAR_EVENT_INVITE') {
    const at = data.eventStartTime ? `&at=${encodeURIComponent(data.eventStartTime)}` : '';
    return `/dashboard/calendar?view=agenda${at}`;
  }
  if ((notification.type === 'DOCUMENT_MENTION' || notification.type === 'DOCUMENT_COMMENT' || notification.type === 'DOCUMENT_SHARED') && data.documentId) {
    return `/dashboard/documents/${data.documentId}`;
  }
  if (data.boardId && data.cardId) return `/dashboard/boards/${data.boardId}?cardId=${encodeURIComponent(data.cardId)}`;
  if (data.projectId && ['PROJECT_INVITE', 'MILESTONE_COMPLETED', 'MILESTONE_MISSED', 'PROJECT_STATUS_CHANGED'].includes(notification.type)) {
    return `/dashboard/projects/${data.projectId}`;
  }
  return '/dashboard/notifications';
}

function relativeTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  const formatter = new Intl.RelativeTimeFormat('es-CL', { numeric: 'auto' });
  if (minutes < 60) return formatter.format(-minutes, 'minute');
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return formatter.format(-hours, 'hour');
  const days = Math.floor(hours / 24);
  if (days < 7) return formatter.format(-days, 'day');
  return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

export function NotificationsUnreadWidget() {
  const notifications = useNotificationStore((state) => state.notifications);
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const loading = useNotificationStore((state) => state.isLoading);
  const fetchNotifications = useNotificationStore((state) => state.fetchNotifications);
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);
  const unread = useMemo(() => notifications.filter((item) => !item.read && !item.archivedAt && !item.resolvedAt)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()), [notifications]);
  const visible = unread.slice(0, 3);
  const totalUnread = Math.max(unreadCount, unread.length);

  const openNotification = (notification: Notification) => {
    if (notification.type === 'CALENDAR_EVENT_INVITE') {
      window.dispatchEvent(new CustomEvent('aether:calendar-invite', { detail: notification.data?.eventStartTime ?? '' }));
    }
    void markAsRead(notification.id);
  };

  return <section className={styles.widget} aria-label="Avisos sin leer" aria-busy={loading}>
    <div className={styles.content}>
      <div className={styles.sectionLabel}>
        <strong>Avisos sin leer</strong>
        <span className={styles.sectionCount} aria-label={`${totalUnread} sin leer`}>{loading && notifications.length === 0 ? '…' : totalUnread}</span>
      </div>
      {loading && notifications.length === 0 ? <div className={styles.loadingList} role="status" aria-label="Cargando avisos sin leer">
        {[0, 1].map((item) => <div className={styles.skeletonRow} key={item}><i /><span><b /><small /></span></div>)}
      </div> : visible.length > 0 ? <div className={styles.notificationList}>
        {visible.map((notification, index) => {
          const tone = toneFor(notification);
          const Icon = tone.icon;
          return <Link key={notification.id} href={notificationHref(notification)} className={styles.notificationCard} style={{ '--notification-color': tone.color, '--notification-index': index } as React.CSSProperties} onClick={() => openNotification(notification)}>
            <span className={styles.notificationIcon}><Icon size={14} strokeWidth={1.9} /></span>
            <span className={styles.notificationCopy}>
              <strong>{titleFor(notification)}</strong>
              <small>{detailFor(notification)}</small>
              <span className={styles.notificationMeta}>{tone.label}<em>{relativeTime(notification.createdAt)}</em></span>
            </span>
            <ArrowRight className={styles.rowArrow} size={14} aria-hidden="true" />
          </Link>;
        })}
        <div className={styles.widgetFooter}>
          {unread.length > visible.length && <Link href="/dashboard/notifications" className={styles.moreLink}>Ver todos <ArrowUpRight size={12} /></Link>}
          <button type="button" className={styles.markAll} onClick={() => void markAllAsRead()} disabled={loading} aria-label="Marcar todos los avisos como leídos" title="Marcar todos como leídos"><CheckCheck size={13} /><span>Marcar leídos</span></button>
        </div>
      </div> : unread.length === 0 ? <div className={styles.emptyState}>
        {totalUnread > 0
          ? <><span className={styles.emptyIcon}><RefreshCw size={15} /></span><span><strong>No se pudieron cargar</strong><small>Actualiza para volver a intentarlo.</small></span><button type="button" onClick={() => void fetchNotifications()} disabled={loading} aria-label="Actualizar avisos" title="Actualizar avisos"><RefreshCw size={13} /></button></>
          : <><span className={styles.emptyIcon}><ClipboardCheck size={16} /></span><span><strong>Estás al día</strong><small>No tienes avisos pendientes.</small></span></>}
      </div> : null}
    </div>
  </section>;
}

export function NotificationsUnreadCatalogPreview() {
  return <div className={styles.catalogPreview} aria-hidden="true">
    <span className={styles.previewHeader}><i><BellDot size={10} /></i><b /><small>3 NUEVOS</small></span>
    <span className={styles.previewRow}><i className={styles.previewMention}><AtSign size={9} /></i><b /><em /></span>
    <span className={styles.previewRow}><i className={styles.previewWork}><UserRound size={9} /></i><b /><em /></span>
    <span className={styles.previewRow}><i className={styles.previewInvite}><Users size={9} /></i><b /><em /></span>
  </div>;
}
