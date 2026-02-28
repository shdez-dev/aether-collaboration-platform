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
 * Get human-readable description for an event
 */
export function getEventDescription(event: ActivityLogEntry): string {
  const { eventType, payload, targetName, userName } = event;

  switch (eventType) {
    // Workspace events
    case 'workspace.created':
      return `creó el workspace "${targetName || payload.name}"`;
    case 'workspace.updated':
      return `actualizó el workspace "${targetName || payload.name}"`;
    case 'workspace.deleted':
      return `eliminó el workspace "${targetName || payload.name}"`;
    case 'workspace.member.invited':
      return `invitó a ${payload.email} al workspace`;
    case 'workspace.member.joined':
      return `se unió al workspace`;
    case 'workspace.member.removed':
      return `fue removido del workspace`;
    case 'workspace.member.roleChanged':
      return `cambió el rol de ${payload.memberName || 'un miembro'} a ${payload.newRole}`;

    // Board events
    case 'board.created':
      return `creó el board "${targetName || payload.name}"`;
    case 'board.updated':
      return `actualizó el board "${targetName || payload.name}"`;
    case 'board.deleted':
      return `eliminó el board "${targetName || payload.name}"`;
    case 'board.archived':
      return `archivó el board "${targetName || payload.name}"`;
    case 'board.unarchived':
      return `restauró el board "${targetName || payload.name}"`;
    case 'board.renamed':
      return `renombró el board de "${payload.oldName}" a "${payload.newName}"`;
    case 'board.description.changed':
      return `cambió la descripción del board "${targetName || payload.boardName}"`;

    // List events
    case 'list.created':
      return `creó la lista "${targetName || payload.name}"`;
    case 'list.updated':
      return `actualizó la lista "${targetName || payload.name}"`;
    case 'list.deleted':
      return `eliminó la lista "${targetName || payload.name}"`;
    case 'list.renamed':
      return `renombró la lista de "${payload.oldName}" a "${payload.newName}"`;
    case 'list.reordered':
      return `reordenó las listas`;
    case 'list.archived':
      return `archivó la lista "${targetName || payload.name}"`;

    // Card events
    case 'card.created':
      return `creó la tarjeta "${targetName || payload.title}"`;
    case 'card.updated':
      return `actualizó la tarjeta "${targetName || payload.title}"`;
    case 'card.deleted':
      return `eliminó la tarjeta "${targetName || payload.title}"`;
    case 'card.moved':
      return `movió "${targetName || payload.title}" ${
        payload.oldListName && payload.newListName
          ? `de "${payload.oldListName}" a "${payload.newListName}"`
          : 'a otra lista'
      }`;
    case 'card.completed':
      return `completó la tarjeta "${targetName || payload.title}"`;
    case 'card.uncompleted':
      return `marcó "${targetName || payload.title}" como incompleta`;
    case 'card.renamed':
      return `renombró la tarjeta de "${payload.oldTitle}" a "${payload.newTitle}"`;
    case 'card.description.changed':
      return `cambió la descripción de "${targetName || payload.title}"`;
    case 'card.duedate.set':
      return `estableció fecha límite en "${targetName || payload.title}"`;
    case 'card.duedate.changed':
      return `cambió la fecha límite de "${targetName || payload.title}"`;
    case 'card.duedate.removed':
      return `eliminó la fecha límite de "${targetName || payload.title}"`;
    case 'card.priority.changed':
      return `cambió la prioridad de "${targetName || payload.title}" a ${payload.newPriority}`;
    case 'card.member.assigned':
      return `asignó a ${payload.assignedUserName || 'alguien'} a "${targetName || payload.title}"`;
    case 'card.member.unassigned':
      return `desasignó a ${payload.unassignedUserName || 'alguien'} de "${targetName || payload.title}"`;
    case 'card.label.added':
      return `agregó la etiqueta "${payload.labelName}" a "${targetName || payload.title}"`;
    case 'card.label.removed':
      return `eliminó la etiqueta "${payload.labelName}" de "${targetName || payload.title}"`;
    case 'card.archived':
      return `archivó la tarjeta "${targetName || payload.title}"`;
    case 'card.unarchived':
      return `restauró la tarjeta "${targetName || payload.title}"`;

    // Comment events
    case 'comment.created':
    case 'card.comment.added':
      return `comentó en "${targetName || payload.cardTitle}"`;
    case 'comment.updated':
    case 'card.comment.updated':
      return `editó un comentario en "${targetName || payload.cardTitle}"`;
    case 'comment.deleted':
    case 'card.comment.deleted':
      return `eliminó un comentario de "${targetName || payload.cardTitle}"`;
    case 'comment.mentioned':
      return `te mencionó en un comentario`;

    // Document events
    case 'document.created':
      return `creó el documento "${targetName || payload.title}"`;
    case 'document.updated':
      return `actualizó el documento "${targetName || payload.title}"`;
    case 'document.deleted':
      return `eliminó el documento "${targetName || payload.title}"`;
    case 'document.title.changed':
      return `renombró el documento de "${payload.oldTitle}" a "${payload.newTitle}"`;
    case 'document.version.created':
      return `creó una nueva versión del documento "${targetName || payload.title}"`;
    case 'document.version.restored':
      return `restauró una versión anterior de "${targetName || payload.title}"`;
    case 'document.exported':
      return `exportó el documento "${targetName || payload.title}" a ${payload.format}`;
    case 'document.comment.added':
      return `comentó en el documento "${targetName || payload.documentTitle}"`;
    case 'document.comment.updated':
      return `editó un comentario en "${targetName || payload.documentTitle}"`;
    case 'document.comment.deleted':
      return `eliminó un comentario de "${targetName || payload.documentTitle}"`;

    // Auth events
    case 'auth.user.registered':
      return `se registró en la plataforma`;
    case 'auth.user.loggedIn':
      return `inició sesión`;
    case 'auth.user.loggedOut':
      return `cerró sesión`;

    default:
      return eventType.replace(/\./g, ' ').replace(/_/g, ' ');
  }
}

/**
 * Get icon for event type
 */
export function getEventIcon(eventType: EventType): LucideIcon {
  // Board events
  if (eventType.startsWith('board.')) {
    if (eventType.includes('archived')) return Archive;
    if (eventType.includes('unarchived')) return ArchiveRestore;
    if (eventType.includes('renamed')) return Edit3;
    return Layout;
  }

  // List events
  if (eventType.startsWith('list.')) {
    if (eventType.includes('archived')) return Archive;
    return List;
  }

  // Card events
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

  // Comment events
  if (eventType.includes('comment')) {
    return MessageSquare;
  }

  // Document events
  if (eventType.startsWith('document.')) {
    if (eventType.includes('deleted')) return Trash2;
    return FileText;
  }

  // Workspace events
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
 * Group events by date with month separators
 */
export function groupEventsByDate(
  events: ActivityLogEntry[]
): Array<{ date: string; label: string; events: ActivityLogEntry[]; isMonthHeader?: boolean }> {
  const groups = new Map<string, ActivityLogEntry[]>();

  events.forEach((event) => {
    const date = new Date(event.createdAt);
    const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD

    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(event);
  });

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const result: Array<{
    date: string;
    label: string;
    events: ActivityLogEntry[];
    isMonthHeader?: boolean;
  }> = [];
  let lastMonth = '';

  Array.from(groups.entries())
    .sort(([a], [b]) => b.localeCompare(a)) // Sort by date desc
    .forEach(([dateKey, events]) => {
      const date = new Date(dateKey);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      // Add month header if it's a new month
      if (monthKey !== lastMonth) {
        const monthLabel = date.toLocaleDateString('es-ES', {
          month: 'long',
          year: 'numeric',
        });
        const formattedMonthLabel = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

        result.push({
          date: monthKey,
          label: formattedMonthLabel,
          events: [],
          isMonthHeader: true,
        });
        lastMonth = monthKey;
      }

      let label = '';

      if (dateKey === today.toISOString().split('T')[0]) {
        label = 'Hoy';
      } else if (dateKey === yesterday.toISOString().split('T')[0]) {
        label = 'Ayer';
      } else {
        // Format: "Lunes 24"
        label = date.toLocaleDateString('es-ES', {
          weekday: 'long',
          day: 'numeric',
        });
        label = label.charAt(0).toUpperCase() + label.slice(1);
      }

      result.push({ date: dateKey, label, events });
    });

  return result;
}

/**
 * Format relative time
 */
export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const eventDate = typeof date === 'string' ? new Date(date) : date;
  const diffMs = now.getTime() - eventDate.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'justo ahora';
  if (diffMin < 60) return `hace ${diffMin} minuto${diffMin !== 1 ? 's' : ''}`;
  if (diffHour < 24) return `hace ${diffHour} hora${diffHour !== 1 ? 's' : ''}`;
  if (diffDay < 7) return `hace ${diffDay} día${diffDay !== 1 ? 's' : ''}`;

  return eventDate.toLocaleDateString('es-ES', {
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
    label: 'Tarjetas',
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
    label: 'Documentos',
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
    label: 'Comentarios',
    events: ['comment.created', 'comment.updated', 'comment.deleted', 'comment.mentioned'],
  },
};
