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
  const name = targetName || payload?.name || payload?.title || '';
  const newName = payload?.newName || payload?.newTitle || '';
  const oldName = payload?.oldName || payload?.oldTitle || name;

  switch (eventType) {
    // Workspace
    case 'workspace.created':
      return t.dashboard_activity_workspace_created(name);
    case 'workspace.updated':
      return t.dashboard_activity_workspace_updated(name);
    case 'workspace.deleted':
      return t.dashboard_activity_workspace_deleted(name);
    case 'workspace.member.invited':
      return t.dashboard_activity_workspace_member_invited(payload?.inviteeName || '');
    case 'workspace.member.joined':
      return t.dashboard_activity_workspace_member_joined;
    case 'workspace.member.removed':
      return t.dashboard_activity_workspace_member_removed(payload?.memberName || '');
    case 'workspace.member.roleChanged':
      return t.dashboard_activity_workspace_member_role_changed(payload?.memberName || '');

    // Board
    case 'board.created':
      return t.dashboard_activity_board_created(name);
    case 'board.updated':
      return t.dashboard_activity_board_updated(name);
    case 'board.deleted':
      return t.dashboard_activity_board_deleted(name);
    case 'board.archived':
      return t.dashboard_activity_board_archived(name);
    case 'board.unarchived':
      return t.dashboard_activity_board_unarchived(name);
    case 'board.renamed':
      return t.dashboard_activity_board_renamed(oldName, newName);
    case 'board.description.changed':
      return t.dashboard_activity_board_description_changed(name);

    // List
    case 'list.created':
      return t.dashboard_activity_list_created(name);
    case 'list.updated':
      return t.dashboard_activity_list_updated(name);
    case 'list.deleted':
      return t.dashboard_activity_list_deleted(name);
    case 'list.renamed':
      return t.dashboard_activity_list_renamed(oldName, newName);
    case 'list.reordered':
      return t.dashboard_activity_list_reordered;
    case 'list.archived':
      return t.dashboard_activity_list_archived(name);

    // Card
    case 'card.created':
      return t.dashboard_activity_card_created(name);
    case 'card.updated':
      return t.dashboard_activity_card_updated(name);
    case 'card.deleted':
      return t.dashboard_activity_card_deleted(name);
    case 'card.moved':
      return t.dashboard_activity_card_moved(name, payload?.newListName || '');
    case 'card.completed':
      return t.dashboard_activity_card_completed(name);
    case 'card.uncompleted':
      return t.dashboard_activity_card_uncompleted(name);
    case 'card.renamed':
      return t.dashboard_activity_card_renamed(oldName, newName);
    case 'card.description.changed':
      return t.dashboard_activity_card_description_changed(name);
    case 'card.duedate.set':
      return t.dashboard_activity_card_due_set(name);
    case 'card.duedate.changed':
      return t.dashboard_activity_card_due_changed(name);
    case 'card.duedate.removed':
      return t.dashboard_activity_card_due_removed(name);
    case 'card.priority.changed':
      return t.dashboard_activity_card_priority_changed(name);
    case 'card.member.assigned':
      return t.dashboard_activity_card_member_assigned(
        payload?.assignedUserName || '',
        name
      );
    case 'card.member.unassigned':
      return t.dashboard_activity_card_member_unassigned(
        payload?.unassignedUserName || '',
        name
      );
    case 'card.label.added':
      return t.dashboard_activity_card_label_added(payload?.labelName || '', name);
    case 'card.label.removed':
      return t.dashboard_activity_card_label_removed(payload?.labelName || '', name);
    case 'card.archived':
      return t.dashboard_activity_card_archived(name);
    case 'card.unarchived':
      return t.dashboard_activity_card_unarchived(name);

    // Comment
    case 'comment.created':
    case 'card.comment.added':
      return t.dashboard_activity_comment_added(targetName || payload?.cardTitle || '');
    case 'comment.updated':
    case 'card.comment.updated':
      return t.dashboard_activity_comment_updated(targetName || payload?.cardTitle || '');
    case 'comment.deleted':
    case 'card.comment.deleted':
      return t.dashboard_activity_comment_deleted(targetName || payload?.cardTitle || '');
    case 'comment.mentioned':
      return t.dashboard_activity_comment_mentioned;

    // Document
    case 'document.created':
      return t.dashboard_activity_document_created(name);
    case 'document.updated':
      return t.dashboard_activity_document_updated(name);
    case 'document.deleted':
      return t.dashboard_activity_document_deleted(name);
    case 'document.title.changed':
      return t.dashboard_activity_document_renamed(oldName, newName);
    case 'document.version.created':
      return t.dashboard_activity_document_version(name);
    case 'document.version.restored':
      return t.dashboard_activity_document_version_restored(name);
    case 'document.exported':
      return t.dashboard_activity_document_exported(name);
    case 'document.comment.added':
      return t.dashboard_activity_document_comment_added(
        targetName || payload?.documentTitle || ''
      );
    case 'document.comment.updated':
      return t.dashboard_activity_document_comment_updated(
        targetName || payload?.documentTitle || ''
      );
    case 'document.comment.deleted':
      return t.dashboard_activity_document_comment_deleted(
        targetName || payload?.documentTitle || ''
      );

    // Auth
    case 'auth.user.registered':
      return t.dashboard_activity_auth_registered;
    case 'auth.user.loggedIn':
      return t.dashboard_activity_auth_logged_in;
    case 'auth.user.loggedOut':
      return t.dashboard_activity_auth_logged_out;

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
    if (eventType.includes('unarchived')) return ArchiveRestore;
    if (eventType.includes('renamed')) return Edit3;
    return Layout;
  }

  if (eventType.startsWith('list.')) {
    if (eventType.includes('archived')) return Archive;
    return List;
  }

  if (eventType.startsWith('card.')) {
    if (eventType.includes('moved')) return ArrowRight;
    if (eventType.includes('completed')) return CheckCircle;
    if (eventType.includes('uncompleted')) return Circle;
    if (eventType.includes('deleted')) return Trash2;
    if (eventType.includes('created')) return Plus;
    if (eventType.includes('archived')) return Archive;
    if (eventType.includes('unarchived')) return ArchiveRestore;
    if (eventType.includes('duedate')) return Calendar;
    if (eventType.includes('priority')) return AlertCircle;
    if (eventType.includes('label')) return Tag;
    if (eventType.includes('member')) return eventType.includes('assigned') ? UserPlus : UserMinus;
    if (eventType.includes('renamed')) return Edit3;
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
  if (
    eventType.includes('updated') ||
    eventType.includes('changed') ||
    eventType.includes('renamed')
  )
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
      'workspace.member.roleChanged',
    ],
  },
  board: {
    label: 'Boards',
    events: [
      'board.created',
      'board.updated',
      'board.deleted',
      'board.archived',
      'board.unarchived',
      'board.renamed',
      'board.description.changed',
    ],
  },
  card: {
    label: 'Cards',
    events: [
      'card.created',
      'card.updated',
      'card.deleted',
      'card.moved',
      'card.completed',
      'card.uncompleted',
      'card.renamed',
      'card.description.changed',
      'card.duedate.set',
      'card.duedate.changed',
      'card.duedate.removed',
      'card.priority.changed',
      'card.member.assigned',
      'card.member.unassigned',
      'card.label.added',
      'card.label.removed',
      'card.archived',
      'card.unarchived',
    ],
  },
  document: {
    label: 'Documents',
    events: [
      'document.created',
      'document.updated',
      'document.deleted',
      'document.title.changed',
      'document.version.created',
      'document.version.restored',
      'document.exported',
    ],
  },
  comment: {
    label: 'Comments',
    events: ['comment.created', 'comment.updated', 'comment.deleted', 'comment.mentioned'],
  },
};
