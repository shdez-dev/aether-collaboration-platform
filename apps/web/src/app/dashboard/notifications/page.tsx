'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Notification } from '@aether/types';
import { Archive, ArrowUpRight, AtSign, Bell, BellRing, CalendarClock, Check, CheckCheck, ListChecks, MessageCircle, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNotifications } from '@/hooks/useNotifications';
import { apiService } from '@/services/apiService';
import { useActiveWorkspaceStore } from '@/stores/activeWorkspaceStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import styles from './page.module.css';

type Filter = 'todo' | 'sin-leer' | 'menciones' | 'asignaciones';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'todo', label: 'Todas' },
  { key: 'sin-leer', label: 'Sin leer' },
  { key: 'menciones', label: 'Menciones' },
  { key: 'asignaciones', label: 'Asignaciones' },
];

const AVATAR_PALETTE = ['#8076A7', '#548B73', '#A97556', '#8262B2', '#7452A6', '#7D91B1', '#A87876'];

function hashColor(value: string): string {
  let hash = 0;
  for (const letter of value) hash = (hash * 31 + letter.charCodeAt(0)) | 0;
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function relativeTime(value: string): string {
  try { return formatDistanceToNow(new Date(value), { addSuffix: true, locale: es }); }
  catch { return ''; }
}

function isToday(value: string): boolean {
  const date = new Date(value);
  const today = new Date();
  return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
}

function extractActor(message: string): string {
  return message.match(/^([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)/)?.[1] ?? '';
}

function notificationContent(notification: Notification) {
  const data = (notification.data ?? {}) as Record<string, unknown>;
  const stringValue = (...keys: string[]) => keys.map(key => data[key]).find(value => typeof value === 'string') as string | undefined;
  const actor = stringValue('actorName', 'senderName', 'actor') || extractActor(notification.message ?? '') || 'Aether';
  const board = stringValue('boardName', 'board') || '';
  const card = stringValue('cardTitle', 'card') || '';
  const workspace = stringValue('workspaceName', 'workspace') || '';
  const team = stringValue('teamName') || '';
  const document = stringValue('documentTitle', 'documentName') || '';

  const actions: Record<string, [string, string]> = {
    COMMENT_MENTION: ['te mencionó en', card || board],
    DOCUMENT_MENTION: ['te mencionó en', document],
    COMMENT_ADDED: ['comentó en', card || board],
    DOCUMENT_COMMENT: ['comentó en', document],
    DOCUMENT_SHARED: ['compartió', document],
    CARD_ASSIGNED: ['te asignó a', card],
    CARD_UNASSIGNED: ['te desasignó de', card],
    CARD_DUE_SOON: ['vence pronto:', card],
    CARD_OVERDUE: ['está vencida:', card],
    BOARD_INVITE: ['te invitó al tablero', board],
    WORKSPACE_INVITE: ['te invitó al espacio', workspace || board],
    TEAM_INVITE: ['te invitó al equipo', team],
    PROJECT_INVITE: ['te invitó al proyecto', stringValue('projectName') || ''],
    WORKSPACE_REMOVED: ['te retiró de', workspace || board],
    MILESTONE_COMPLETED: ['completó un hito en', stringValue('projectName') || ''],
    MILESTONE_MISSED: ['tiene un hito vencido en', stringValue('projectName') || ''],
  };
  const [action, target] = actions[notification.type] ?? [notification.title || 'tienes una nueva actividad', ''];
  return { actor, action, target, context: board || workspace || team || '' };
}

function category(notification: Notification) {
  if (notification.type.includes('MENTION')) return { label: 'Mención', icon: AtSign };
  if (notification.type.includes('COMMENT')) return { label: 'Comentario', icon: MessageCircle };
  if (notification.type.includes('ASSIGNED')) return { label: 'Asignación', icon: ListChecks };
  if (notification.type.includes('DUE') || notification.type.includes('OVERDUE') || notification.type.includes('MILESTONE')) return { label: 'Fecha', icon: CalendarClock };
  if (notification.type.includes('INVITE') || notification.type.includes('MEMBER')) return { label: 'Invitación', icon: Users };
  return { label: 'Actividad', icon: Bell };
}

function matchesFilter(notification: Notification, filter: Filter): boolean {
  if (filter === 'sin-leer') return !notification.read;
  if (filter === 'menciones') return notification.type === 'COMMENT_MENTION' || notification.type === 'DOCUMENT_MENTION';
  if (filter === 'asignaciones') return notification.type === 'CARD_ASSIGNED';
  return true;
}

function NotificationRow({ notification, onOpen, onRead, onResolve, onArchive }: {
  notification: Notification;
  onOpen: () => void;
  onRead: () => void;
  onResolve: () => void;
  onArchive: () => void;
}) {
  const { actor, action, target, context } = notificationContent(notification);
  const { label, icon: CategoryIcon } = category(notification);
  const initials = actor.split(' ').map(part => part[0]).join('').toUpperCase().slice(0, 2) || '?';

  return (
    <article className={`${styles.notification} ${!notification.read ? styles.unread : ''}`}>
      <button className={styles.notificationMain} type="button" onClick={onOpen} aria-label={`Abrir: ${actor} ${action} ${target}`}>
        <span className={styles.avatar} style={{ backgroundColor: hashColor(actor) }}>{initials}</span>
        <span className={styles.notificationBody}>
          <span className={styles.notificationTitle}>
            <strong>{actor}</strong> {action}{target && <> <strong className={styles.target}>{target}</strong></>}
          </span>
          {notification.message && <span className={styles.message}>{notification.message}</span>}
          <span className={styles.meta}>
            <span className={styles.category}><CategoryIcon size={12} aria-hidden="true" />{label}</span>
            {context && <span className={styles.context}>{context}</span>}
            <time dateTime={notification.createdAt}>{relativeTime(notification.createdAt)}</time>
          </span>
        </span>
        <ArrowUpRight className={styles.openIcon} size={17} aria-hidden="true" />
      </button>
      <div className={styles.actions}>
        {!notification.read && (
          <button type="button" className={styles.actionButton} onClick={onRead} title="Marcar como leída" aria-label="Marcar como leída"><Check size={16} /></button>
        )}
        <button type="button" className={styles.actionButton} onClick={onResolve} title="Resolver" aria-label="Resolver"><CheckCheck size={16} /></button>
        <button type="button" className={styles.actionButton} onClick={onArchive} title="Archivar" aria-label="Archivar"><Archive size={16} /></button>
      </div>
    </article>
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const { notifications, isLoading, loadNotifications, markAsRead, markAllAsRead, archiveNotification, resolveNotification } = useNotifications();
  const setActiveWorkspaceId = useActiveWorkspaceStore(state => state.setActiveWorkspaceId);
  const fetchWorkspaces = useWorkspaceStore(state => state.fetchWorkspaces);
  const [filter, setFilter] = useState<Filter>('todo');

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  const filtered = notifications.filter(notification => matchesFilter(notification, filter));
  const today = filtered.filter(notification => isToday(notification.createdAt));
  const earlier = filtered.filter(notification => !isToday(notification.createdAt));
  const unreadCount = notifications.filter(notification => !notification.read).length;
  const emptyTitle: Record<Filter, string> = {
    todo: 'Todo al día',
    'sin-leer': 'No hay notificaciones sin leer',
    menciones: 'No hay menciones',
    asignaciones: 'No hay asignaciones',
  };

  async function handleOpen(notification: Notification) {
    if (!notification.read) markAsRead(notification.id);
    const data = (notification.data ?? {}) as Record<string, unknown>;
    const workspaceId = typeof data.workspaceId === 'string' ? data.workspaceId : null;
    const projectId = typeof data.projectId === 'string' ? data.projectId : null;
    const boardId = typeof data.boardId === 'string' ? data.boardId : null;

    if (workspaceId) {
      setActiveWorkspaceId(workspaceId);
      fetchWorkspaces().catch(() => {});
    }

    if (['PROJECT_INVITE', 'MILESTONE_COMPLETED', 'MILESTONE_MISSED', 'PROJECT_STATUS_CHANGED'].includes(notification.type) && projectId) {
      router.push(`/dashboard/projects/${projectId}`);
    } else if (notification.type === 'WORKSPACE_INVITE' || notification.type === 'WORKSPACE_REMOVED') {
      router.push('/dashboard');
    } else if (boardId) {
      try {
        const response = await apiService.get<{ project: { projectId: string } | null }>(`/api/boards/${boardId}/project`, true);
        const boardProjectId = response?.data?.project?.projectId;
        router.push(boardProjectId ? `/dashboard/projects/${boardProjectId}` : '/dashboard');
      } catch {
        router.push('/dashboard');
      }
    } else {
      router.push('/dashboard');
    }
  }

  function renderSection(title: string, items: Notification[]) {
    if (items.length === 0) return null;
    return (
      <section className={styles.group} aria-label={title}>
        <div className={styles.groupHeading}><h2>{title}</h2><span>{items.length}</span></div>
        <div className={styles.groupList}>
          {items.map(notification => (
            <NotificationRow
              key={notification.id}
              notification={notification}
              onOpen={() => handleOpen(notification)}
              onRead={() => markAsRead(notification.id)}
              onResolve={() => resolveNotification(notification.id)}
              onArchive={() => archiveNotification(notification.id)}
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerIcon}><BellRing size={24} strokeWidth={1.8} aria-hidden="true" /></div>
        <div className={styles.headerText}>
          <span className={styles.eyebrow}>Avisos y novedades</span>
          <h1>Notificaciones</h1>
          <p>Revisa menciones, asignaciones y otros avisos que requieren tu atención.</p>
        </div>
        <div className={styles.unreadSummary} aria-label={`${unreadCount} ${unreadCount === 1 ? 'notificación' : 'notificaciones'} sin leer`}>
          <strong>{unreadCount}</strong><span>sin leer</span>
        </div>
      </header>

      <section className={styles.panel} aria-label="Notificaciones">
        <div className={styles.toolbar}>
          <div className={styles.filters} aria-label="Filtrar notificaciones">
            {FILTERS.map(({ key, label }) => (
              <button key={key} type="button" className={`${styles.filter} ${filter === key ? styles.filterActive : ''}`} aria-pressed={filter === key} onClick={() => setFilter(key)}>
                {label}{key === 'sin-leer' && unreadCount > 0 && <span className={styles.filterCount}>{unreadCount}</span>}
              </button>
            ))}
          </div>
          {unreadCount > 0 && (
            <button type="button" className={styles.markAll} onClick={() => markAllAsRead()}><CheckCheck size={16} aria-hidden="true" />Marcar todas como leídas</button>
          )}
        </div>

        {isLoading ? (
          <div className={styles.state} role="status"><span className={styles.spinner} />Cargando notificaciones…</div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}><BellRing size={27} strokeWidth={1.6} aria-hidden="true" /></div>
            <h2>{emptyTitle[filter]}</h2>
            <p>{filter === 'todo' ? 'Cuando tengas novedades, aparecerán aquí.' : 'Prueba otro filtro para ver el resto de tu actividad.'}</p>
            {filter !== 'todo' && <button type="button" onClick={() => setFilter('todo')}>Ver todas las notificaciones</button>}
          </div>
        ) : (
          <div className={styles.list}>
            {renderSection('Hoy', today)}
            {renderSection('Anteriores', earlier)}
          </div>
        )}
      </section>
    </main>
  );
}
