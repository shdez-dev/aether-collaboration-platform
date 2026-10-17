'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowRight, ArrowUpRight, BellRing, Building2, CalendarClock, CheckCheck,
  ClipboardCheck, FolderKanban, PanelsTopLeft, RefreshCw, Users,
} from 'lucide-react';
import type { Notification } from '@aether/types';
import { useNotificationStore } from '@/stores/notificationStore';
import styles from './NotificationsUnreadWidget.module.css';

const ACTION_TYPES = new Set<Notification['type']>([
  'BOARD_INVITE',
  'WORKSPACE_INVITE',
  'TEAM_INVITE',
  'PROJECT_INVITE',
  'ORGANIZATION_INVITE',
  'CALENDAR_EVENT_INVITE',
]);

const ACTION_ACCENT = '#d29a62';

function actionFor(notification: Notification) {
  switch (notification.type) {
    case 'TEAM_INVITE': return { label: 'Equipo', icon: Users, title: notification.data?.teamName || 'Invitación a un equipo' };
    case 'WORKSPACE_INVITE': return { label: 'Espacio', icon: Building2, title: notification.data?.workspaceName || 'Invitación a un espacio' };
    case 'ORGANIZATION_INVITE': return { label: 'Organización', icon: Building2, title: notification.data?.organizationName || 'Invitación a una organización' };
    case 'CALENDAR_EVENT_INVITE': return { label: 'Evento', icon: CalendarClock, title: notification.data?.eventTitle || 'Invitación a un evento' };
    case 'PROJECT_INVITE': return { label: 'Proyecto', icon: FolderKanban, title: notification.data?.projectName || 'Invitación a un proyecto' };
    case 'BOARD_INVITE': return { label: 'Tablero', icon: PanelsTopLeft, title: notification.data?.boardName || 'Invitación a un tablero' };
    default: return { label: 'Pendiente', icon: BellRing, title: notification.title || 'Acción pendiente' };
  }
}

function actionHref(notification: Notification) {
  const data = notification.data ?? {};
  if (notification.type === 'ORGANIZATION_INVITE' && data.invitationId) {
    return `/organization-invitation?invitationId=${encodeURIComponent(data.invitationId)}`;
  }
  if (notification.type === 'CALENDAR_EVENT_INVITE') {
    const at = data.eventStartTime ? `&at=${encodeURIComponent(data.eventStartTime)}` : '';
    return `/dashboard/calendar?view=agenda${at}`;
  }
  if (notification.type === 'PROJECT_INVITE' && data.projectId) return `/dashboard/projects/${data.projectId}`;
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

export function NotificationsActionsWidget() {
  const notifications = useNotificationStore((state) => state.notifications);
  const loading = useNotificationStore((state) => state.isLoading);
  const fetchNotifications = useNotificationStore((state) => state.fetchNotifications);
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const pending = useMemo(() => notifications
    .filter((item) => ACTION_TYPES.has(item.type) && !item.archivedAt && !item.resolvedAt)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()), [notifications]);
  const visible = pending.slice(0, 3);

  const openAction = (notification: Notification) => {
    if (notification.type === 'CALENDAR_EVENT_INVITE') {
      window.dispatchEvent(new CustomEvent('aether:calendar-invite', { detail: notification.data?.eventStartTime ?? '' }));
    }
    void markAsRead(notification.id);
  };

  return <section className={styles.widget} aria-label="Acciones pendientes" aria-busy={loading} style={{ '--notification-accent': ACTION_ACCENT } as React.CSSProperties}>
    <div className={styles.content}>
      <div className={styles.sectionLabel}>
        <strong>Acciones pendientes</strong>
        <span className={styles.sectionCount} aria-label={`${pending.length} acciones pendientes`}>{loading && notifications.length === 0 ? '…' : pending.length}</span>
      </div>
      {loading && pending.length === 0 ? <div className={styles.loadingList} role="status" aria-label="Cargando acciones pendientes">
        {[0, 1].map((item) => <div className={styles.skeletonRow} key={item}><i /><span><b /><small /></span></div>)}
      </div> : visible.length > 0 ? <div className={styles.notificationList}>
        {visible.map((notification, index) => {
          const action = actionFor(notification);
          const Icon = action.icon;
          const actor = notification.data?.inviterName || notification.data?.invitedByName || notification.data?.senderName;
          const detail = actor ? `Te invitó ${actor}` : notification.message?.trim() || 'Revisa esta invitación';
          return <Link key={notification.id} href={actionHref(notification)} className={styles.notificationCard} style={{ '--notification-color': ACTION_ACCENT, '--notification-index': index } as React.CSSProperties} onClick={() => openAction(notification)}>
            <span className={styles.notificationIcon}><Icon size={14} strokeWidth={1.9} /></span>
            <span className={styles.notificationCopy}>
              <strong>{action.title}</strong>
              <small>{detail}</small>
              <span className={styles.notificationMeta}>{action.label}<em>{relativeTime(notification.createdAt)}</em></span>
            </span>
            <ArrowRight className={styles.rowArrow} size={14} aria-hidden="true" />
          </Link>;
        })}
        <div className={styles.widgetFooter}>
          {pending.length > visible.length && <Link href="/dashboard/notifications" className={styles.moreLink}>Ver todas <ArrowUpRight size={12} /></Link>}
          <Link href="/dashboard/notifications" className={styles.markAll}><span>Ver bandeja</span><ArrowRight size={13} /></Link>
        </div>
      </div> : <div className={styles.emptyState}>
        {loading ? <><span className={styles.emptyIcon}><RefreshCw size={15} /></span><span><strong>No se pudieron cargar</strong><small>Actualiza para volver a intentarlo.</small></span><button type="button" onClick={() => void fetchNotifications()} disabled={loading} aria-label="Actualizar acciones pendientes" title="Actualizar acciones pendientes"><RefreshCw size={13} /></button></>
          : <><span className={styles.emptyIcon}><CheckCheck size={16} /></span><span><strong>Todo resuelto</strong><small>No tienes invitaciones pendientes.</small></span></>}
      </div>}
    </div>
  </section>;
}

export function NotificationsActionsCatalogPreview() {
  return <div className={styles.catalogPreview} aria-hidden="true" style={{ '--notification-accent': ACTION_ACCENT } as React.CSSProperties}>
    <span className={styles.previewHeader}><i><ClipboardCheck size={10} /></i><b /><small>2 PENDIENTES</small></span>
    <span className={styles.previewRow}><i className={styles.previewAction}><Users size={9} /></i><b /><em /></span>
    <span className={styles.previewRow}><i className={styles.previewAction}><CalendarClock size={9} /></i><b /><em /></span>
  </div>;
}
