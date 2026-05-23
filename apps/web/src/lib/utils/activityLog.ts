import type { EventType } from '@aether/types';
import {
  FileText,
  Layout,
  List,
  SquareKanban,
  MessageSquare,
  Users,
  Archive,
  ArchiveRestore,
  Edit3,
  Calendar,
  AlertCircle,
  Tag,
  UserPlus,
  UserMinus,
  Trash2,
  Plus,
  ArrowRight,
  CheckCircle,
  Circle,
  type LucideIcon,
} from 'lucide-react';

export interface ActivityLogEntry {
  id: string;
  eventType: EventType;
  payload: any;
  delta?: any;
  userId: string;
  userName: string;
  userAvatar?: string;
  timestamp: number;
  createdAt: string;
  targetName?: string;
  targetType?: string;
  targetId?: string;
  workspaceId?: string;
  workspaceName?: string;
  boardId?: string;
  boardName?: string;
}

/**
 * Get human-readable description for an event using the i18n translations object.
 */
export function getEventDescription(event: ActivityLogEntry, t: Record<string, any>): string {
  const { eventType, payload, targetName } = event;

  // Nombres resueltos por tipo de entidad — cada evento sabe dónde está su nombre
  const wsName   = payload?.workspaceName || payload?.name || targetName || '';
  const brdName  = payload?.boardName || payload?.boardTitle || payload?.name || targetName || '';
  const listName = payload?.listName || payload?.name || targetName || '';
  const cardName = payload?.cardTitle || payload?.title || payload?.name || targetName || '';
  const docName  = payload?.title || payload?.name || targetName || '';
  const projName = payload?.name || payload?.projectName || targetName || '';

  switch (eventType) {
    // Workspace
    case 'workspace.created':
      return t.dashboard_activity_workspace_created(wsName);
    case 'workspace.updated':
      return t.dashboard_activity_workspace_updated(wsName);
    case 'workspace.deleted':
      return t.dashboard_activity_workspace_deleted(wsName);
    case 'workspace.member.invited':
      return t.dashboard_activity_workspace_member_invited(payload?.inviteeName || '');
    case 'workspace.member.joined':
      return t.dashboard_activity_workspace_member_joined;
    case 'workspace.member.removed':
      return t.dashboard_activity_workspace_member_removed(payload?.memberName || '');
    case 'workspace.member.role-changed':
      return t.dashboard_activity_workspace_member_role_changed(payload?.memberName || '');

    // Board
    case 'board.created':
      return t.dashboard_activity_board_created(brdName);
    case 'board.updated':
      return t.dashboard_activity_board_updated(brdName);
    case 'board.deleted':
      return t.dashboard_activity_board_deleted(brdName);
    case 'board.archived':
      return t.dashboard_activity_board_archived(brdName);
    case 'board.restored':
      return t.dashboard_activity_board_unarchived(brdName);

    // List
    case 'list.created': {
      const proj = payload?.projectName;
      const base = t.dashboard_activity_list_created(listName);
      const board = event.boardName || payload?.boardName || '';
      const parts = [board, proj].filter(Boolean).join(' · proyecto ');
      return parts ? `${base} en ${parts}` : base;
    }
    case 'list.updated':
      return t.dashboard_activity_list_updated(listName);
    case 'list.deleted':
      return t.dashboard_activity_list_deleted(listName);
    case 'list.order-changed':
      return t.dashboard_activity_list_reordered;
    case 'list.archived':
      return t.dashboard_activity_list_archived(listName);

    // Card
    case 'card.created':
      return t.dashboard_activity_card_created(cardName);
    case 'card.updated':
      return t.dashboard_activity_card_updated(cardName);
    case 'card.deleted':
      return t.dashboard_activity_card_deleted(cardName);
    case 'card.moved':
      return t.dashboard_activity_card_moved(cardName, payload?.toListName || payload?.newListName || '');
    case 'card.status-changed': {
      const completed = payload?.completed ?? (event as any).delta?.after?.completed;
      return completed
        ? t.dashboard_activity_card_completed(cardName)
        : t.dashboard_activity_card_uncompleted(cardName);
    }
    case 'card.due-date.set':
      return t.dashboard_activity_card_due_changed(cardName);
    case 'card.due-date.removed':
      return t.dashboard_activity_card_due_removed(cardName);
    case 'card.priority.changed':
      return t.dashboard_activity_card_priority_changed(cardName);
    case 'card.member.assigned':
      return t.dashboard_activity_card_member_assigned(
        payload?.assignedUserName || payload?.memberName || '',
        cardName
      );
    case 'card.member.removed':
      return t.dashboard_activity_card_member_unassigned(
        payload?.unassignedUserName || payload?.memberName || '',
        cardName
      );
    case 'card.label.added':
      return t.dashboard_activity_card_label_added(payload?.labelName || '', cardName);
    case 'card.label.removed':
      return t.dashboard_activity_card_label_removed(payload?.labelName || '', cardName);
    case 'card.archived':
      return t.dashboard_activity_card_archived(cardName);
    case 'card.restored':
      return t.dashboard_activity_card_unarchived(cardName);

    // Comment
    case 'comment.created':
      return t.dashboard_activity_comment_added(payload?.cardTitle || targetName || '');
    case 'comment.updated':
      return t.dashboard_activity_comment_updated(payload?.cardTitle || targetName || '');
    case 'comment.deleted':
      return t.dashboard_activity_comment_deleted(payload?.cardTitle || targetName || '');
    case 'comment.mention-added':
      return t.dashboard_activity_comment_mentioned;

    // Document
    case 'document.created':
      return t.dashboard_activity_document_created(docName);
    case 'document.updated':
      return t.dashboard_activity_document_updated(docName);
    case 'document.deleted':
      return t.dashboard_activity_document_deleted(docName);
    case 'document.version.saved':
      return t.dashboard_activity_document_version(docName);
    case 'document.version.restored':
      return t.dashboard_activity_document_version_restored(docName);
    case 'document.exported':
      return t.dashboard_activity_document_exported(docName);
    case 'document.comment.added':
      return t.dashboard_activity_document_comment_added(payload?.documentTitle || targetName || '');
    case 'document.comment.resolved':
      return t.dashboard_activity_document_comment_updated(payload?.documentTitle || targetName || '');

    // Project
    case 'project.created':
      return t.dashboard_activity_project_created(projName);
    case 'project.updated':
      return t.dashboard_activity_project_updated(projName);
    case 'project.status.changed': {
      const statusLabel: Record<string, string> = {
        PLANNING: 'Planificación', ACTIVE: 'Activo', ON_HOLD: 'En pausa',
        COMPLETED: 'Completado', CANCELLED: 'Cancelado',
      };
      const oldS = statusLabel[payload?.oldStatus] || payload?.oldStatus || '';
      const newS = statusLabel[payload?.newStatus] || payload?.newStatus || '';
      return t.dashboard_activity_project_status_changed(projName, oldS, newS);
    }
    case 'project.deleted':
      return t.dashboard_activity_project_deleted(projName);
    case 'project.board.linked':
      return t.dashboard_activity_project_board_assigned(
        payload?.boardName || '',
        payload?.projectName || projName
      );
    case 'project.board.unlinked':
      return t.dashboard_activity_project_board_removed(
        payload?.boardName || '',
        payload?.projectName || projName
      );
    case 'project.milestone.created':
      return t.dashboard_activity_project_milestone_created(
        payload?.milestoneName || '',
        payload?.projectName || projName
      );
    case 'project.milestone.completed':
      return t.dashboard_activity_project_milestone_completed(
        payload?.milestoneName || '',
        payload?.projectName || projName
      );

    // Team
    case 'team.created':
      return t.dashboard_activity_team_created(payload?.name || '');
    case 'team.updated':
      return t.dashboard_activity_team_updated(payload?.name || '');
    case 'team.deleted':
      return t.dashboard_activity_team_deleted(payload?.name || '');
    case 'team.member.added':
      return t.dashboard_activity_team_member_added(
        payload?.memberName || '',
        payload?.teamName || ''
      );
    case 'team.member.removed':
      return t.dashboard_activity_team_member_removed(
        payload?.memberName || '',
        payload?.teamName || ''
      );
    case 'team.member.role-changed':
      return t.dashboard_activity_team_member_role_changed(
        payload?.memberName || '',
        payload?.teamName || '',
        payload?.newRole || ''
      );

    default:
      return t.dashboard_activity_unknown;
  }
}

/**
 * Get icon for event type
 */
export function getEventIcon(eventType: EventType): LucideIcon {
  if (eventType.startsWith('board.')) {
    if (eventType.includes('archived')) return Archive;
    if (eventType.includes('restored')) return ArchiveRestore;
    return Layout;
  }

  if (eventType.startsWith('list.')) {
    if (eventType.includes('archived')) return Archive;
    return List;
  }

  if (eventType.startsWith('card.')) {
    if (eventType.includes('moved')) return ArrowRight;
    if (eventType.includes('status-changed')) return CheckCircle;
    if (eventType.includes('deleted')) return Trash2;
    if (eventType.includes('created')) return Plus;
    if (eventType.includes('archived')) return Archive;
    if (eventType.includes('restored')) return ArchiveRestore;
    if (eventType.includes('due-date')) return Calendar;
    if (eventType.includes('priority')) return AlertCircle;
    if (eventType.includes('label')) return Tag;
    if (eventType.includes('member')) return eventType.includes('assigned') ? UserPlus : UserMinus;
    return SquareKanban;
  }

  if (eventType.includes('comment')) return MessageSquare;

  if (eventType.startsWith('document.')) {
    if (eventType.includes('deleted')) return Trash2;
    return FileText;
  }

  if (eventType.startsWith('workspace.')) {
    if (eventType.includes('member')) return Users;
    return Layout;
  }

  if (eventType.startsWith('project.')) {
    if (eventType.includes('deleted')) return Trash2;
    if (eventType.includes('milestone')) return CheckCircle;
    if (eventType.includes('board')) return Layout;
    if (eventType.includes('status')) return AlertCircle;
    return FileText;
  }

  if (eventType.startsWith('team.')) {
    if (eventType.includes('deleted')) return Trash2;
    if (eventType.includes('member')) return eventType.includes('added') ? UserPlus : UserMinus;
    return Users;
  }

  return FileText;
}

/**
 * Get color for event type (for UI styling)
 */
export function getEventColor(eventType: EventType): string {
  if (eventType.includes('created')) return 'text-green-600 dark:text-green-400';
  if (eventType.includes('deleted')) return 'text-red-600 dark:text-red-400';
  if (eventType.includes('archived')) return 'text-orange-600 dark:text-orange-400';
  if (eventType.includes('completed')) return 'text-blue-600 dark:text-blue-400';
  if (eventType.includes('moved')) return 'text-purple-600 dark:text-purple-400';
  if (eventType.includes('updated') || eventType.includes('changed'))
    return 'text-yellow-600 dark:text-yellow-400';

  return 'text-gray-600 dark:text-gray-400';
}

/**
 * Group events by date with month separators.
 * Requires translations object `t` for localized labels.
 */
export function groupEventsByDate(
  events: ActivityLogEntry[],
  t: Record<string, any>
): Array<{ date: string; label: string; events: ActivityLogEntry[]; isMonthHeader?: boolean }> {
  const groups = new Map<string, ActivityLogEntry[]>();

  const toLocalDateKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  events.forEach((event) => {
    const date = new Date(event.createdAt);
    const dateKey = toLocalDateKey(date);
    if (!groups.has(dateKey)) groups.set(dateKey, []);
    groups.get(dateKey)!.push(event);
  });

  const locale: string = t.locale || 'es-ES';
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const todayKey = toLocalDateKey(today);
  const yesterdayKey = toLocalDateKey(yesterday);

  const result: Array<{
    date: string;
    label: string;
    events: ActivityLogEntry[];
    isMonthHeader?: boolean;
  }> = [];
  let lastMonth = '';

  Array.from(groups.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .forEach(([dateKey, dateEvents]) => {
      const [y, m, d] = dateKey.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (monthKey !== lastMonth) {
        const monthLabel = date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
        result.push({
          date: monthKey,
          label: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
          events: [],
          isMonthHeader: true,
        });
        lastMonth = monthKey;
      }

      let label: string;
      if (dateKey === todayKey) {
        label = t.activity_today;
      } else if (dateKey === yesterdayKey) {
        label = t.activity_time_yesterday;
      } else {
        label = date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric' });
        label = label.charAt(0).toUpperCase() + label.slice(1);
      }

      result.push({ date: dateKey, label, events: dateEvents });
    });

  return result;
}

/**
 * Format relative time using i18n translations.
 */
export function formatRelativeTime(date: Date | string, t: Record<string, any>): string {
  const now = new Date();
  const eventDate = typeof date === 'string' ? new Date(date) : date;
  const diffMs = now.getTime() - eventDate.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return t.activity_time_just_now;
  if (diffMin < 60) return t.activity_time_minutes(diffMin);
  if (diffHour < 24) return t.activity_time_hours(diffHour);
  if (diffDay < 7) return t.activity_time_days(diffDay);

  const locale: string = t.locale || 'es-ES';
  return eventDate.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: eventDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Get event categories for filters
 */
export const EVENT_CATEGORIES = {
  workspace: {
    label: 'Workspace',
    events: [
      'workspace.created',
      'workspace.updated',
      'workspace.deleted',
      'workspace.member.invited',
      'workspace.member.joined',
      'workspace.member.removed',
      'workspace.member.role-changed',
    ],
  },
  board: {
    label: 'Boards',
    events: [
      'board.created',
      'board.updated',
      'board.deleted',
      'board.archived',
      'board.restored',
    ],
  },
  card: {
    label: 'Cards',
    events: [
      'card.created',
      'card.updated',
      'card.deleted',
      'card.moved',
      'card.status-changed',
      'card.due-date.set',
      'card.due-date.removed',
      'card.priority.changed',
      'card.member.assigned',
      'card.member.removed',
      'card.label.added',
      'card.label.removed',
      'card.archived',
      'card.restored',
    ],
  },
  document: {
    label: 'Documents',
    events: [
      'document.created',
      'document.updated',
      'document.deleted',
      'document.version.saved',
      'document.version.restored',
      'document.exported',
    ],
  },
  comment: {
    label: 'Comments',
    events: ['comment.created', 'comment.updated', 'comment.deleted', 'comment.mention-added'],
  },
};
