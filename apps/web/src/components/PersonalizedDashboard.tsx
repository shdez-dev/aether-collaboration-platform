'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import type { Notification } from '@aether/types';
import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter, pointerWithin, useDraggable, useDroppable,
  useSensor, useSensors, type CollisionDetection, type DragEndEvent, type DragMoveEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'framer-motion';
import {
  Activity, ArrowRight, Bell, BellDot, Building2, CalendarCheck2, CalendarClock, CalendarDays, CalendarRange, Check, CheckCircle2, ChevronDown, CircleAlert, ClipboardCheck, Clock3, ContactRound, FileClock, FileText, History, MailPlus, PanelsTopLeft,
  Flag, FolderKanban, GripVertical, LayoutDashboard, ListTodo, LockKeyhole, MessageCircle, Plus, Search, Share2, Sparkles,
  MessagesSquare, UnlockKeyhole, UserRoundCheck, Users, UsersRound, X,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useActiveWorkspaceStore } from '@/stores/activeWorkspaceStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { apiService } from '@/services/apiService';
import { socketService } from '@/services/socketService';
import { groupMyDayCards, type MyDayCard, type MyDayGroups } from '@/lib/myDay';
import CalendarDashboardWidget from '@/components/CalendarDashboardWidget';
import { UpcomingEventsWidget } from '@/components/UpcomingEventsWidget';
import { WeekAgendaWidget } from '@/components/WeekAgendaWidget';
import { DocumentsRecentWidget } from '@/components/DocumentsRecentWidget';
import { DocumentsSharedCatalogPreview, DocumentsSharedWidget } from '@/components/DocumentsSharedWidget';
import { NotificationsUnreadCatalogPreview, NotificationsUnreadWidget } from '@/components/NotificationsUnreadWidget';
import { NotificationsActionsCatalogPreview, NotificationsActionsWidget } from '@/components/NotificationsActionsWidget';
import { ContactsOnlineCatalogPreview, ContactsOnlineWidget, RecentConversationsCatalogPreview, RecentConversationsWidget, useContactWidgetData } from '@/components/ContactsDashboardWidgets';
import { MyOpenCardsWidget } from '@/components/MyOpenCardsWidget';
import { BlockedCardsWidget } from '@/components/BlockedCardsWidget';
import { UnassignedCardsWidget } from '@/components/UnassignedCardsWidget';
import { CurrentSprintWidget } from '@/components/CurrentSprintWidget';
import { SprintProgressWidget } from '@/components/SprintProgressWidget';
import { TeamMembersWidget } from '@/components/TeamMembersWidget';
import { TeamActivityWidget } from '@/components/TeamActivityWidget';
import { OrganizationWorkspacesWidget } from '@/components/OrganizationWorkspacesWidget';
import { OrganizationInvitationsWidget } from '@/components/OrganizationInvitationsWidget';
import { OrganizationMembersWidget } from '@/components/OrganizationMembersWidget';
import { OrganizationOverviewWidget } from '@/components/OrganizationOverviewWidget';
import { OrganizationProjectStatusWidget } from '@/components/OrganizationProjectStatusWidget';
import { DashboardBoardControls, type DashboardContext } from '@/components/DashboardBoardControls';
import type { Workspace } from '@/stores/workspaceStore';
import { ProjectPortfolioPreview } from '@/components/ProjectPortfolioWidget';
import { ContextProjectsWidget } from '@/components/ContextProjectsWidget';
import {
  ProjectActivityWidget, ProjectMembersWidget, ProjectMilestonesWidget, ProjectTasksWidget,
  ProjectFeatureIcon, ProjectWidgetCatalogPreview, useProjectDashboardData, type ProjectWidgetKind,
} from '@/components/ProjectDashboardWidgets';
import type { SidebarProject } from '@/stores/activeWorkspaceStore';
import styles from './PersonalizedDashboard.module.css';

type CatalogCategoryId = 'general' | 'my-day' | 'projects' | 'boards' | 'calendar' | 'documents' | 'notifications' | 'contacts' | 'teams';
type WidgetKind =
  | 'quick-links'
  | 'today-priorities' | 'today-due' | 'today-overdue' | 'today-followups'
  | 'project-active' | 'project-tasks' | 'project-milestones' | 'project-activity' | 'project-members'
  | 'board-my-cards' | 'board-blocked' | 'board-unassigned' | 'scrum-current' | 'scrum-progress'
  | 'calendar-upcoming' | 'calendar-week'
  | 'calendar-planner'
  | 'documents-recent' | 'documents-shared'
  | 'notifications-unread' | 'notifications-actions'
  | 'contacts-online' | 'contacts-recent'
  | 'team-members' | 'team-activity' | 'organization-workspaces' | 'organization-invitations'
  | 'organization-members' | 'organization-overview' | 'organization-project-status';
type DashboardWidget = { id: string; kind: WidgetKind; column: number; row: number; width: number; height: number; config?: Record<string, unknown> };
type DashboardBoard = { id: string; name: string; context: DashboardContext; widgets: DashboardWidget[]; locked: boolean };
type ContextProject = SidebarProject & { workspaceName?: string; organizationName?: string; description?: string | null; productGoal?: string | null; methodology?: string };
type GridDropTarget = { id: string; column: number; row: number; span: number; height: number; clamped?: boolean };
type WidgetDragSession = {
  id: string;
  startTarget: GridDropTarget;
  acceptedTarget: GridDropTarget;
  lastRequested: GridDropTarget | null;
  blocked: boolean;
};
type ResizeDirection = 'n' | 'e' | 's' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
const RESIZE_HANDLES: { direction: ResizeDirection; edge: string }[] = [
  { direction: 'n', edge: 'borde superior' },
  { direction: 'e', edge: 'borde derecho' },
  { direction: 's', edge: 'borde inferior' },
  { direction: 'w', edge: 'borde izquierdo' },
  { direction: 'ne', edge: 'esquina superior derecha' },
  { direction: 'nw', edge: 'esquina superior izquierda' },
  { direction: 'se', edge: 'esquina inferior derecha' },
  { direction: 'sw', edge: 'esquina inferior izquierda' },
];
type ResizeSession = {
  id: string;
  direction: ResizeDirection;
  pointerId: number;
  captureTarget: HTMLElement;
  startX: number;
  startY: number;
  originalWidgets: DashboardWidget[];
  lastValidWidgets: DashboardWidget[];
  valid: boolean;
};
type WidgetSettle = { id: string; x: number; y: number; phase: 'prepare' | 'animate' };
type SavedLayout = { locked?: boolean; widgets?: DashboardWidget[] };
type CatalogItem = { kind: WidgetKind; category: CatalogCategoryId; title: string; description: string; href?: string; context?: string };

const DESKTOP_COLUMNS = 24;
const ROW_HEIGHT = 40;
const GRID_CELL_TARGET = 34;
const WIDGET_SLOT_INSET = 10;
const WIDGET_DRAG_SCALE = 0.97;
const DEFAULT_WIDGET_SIZE = { width: 8, height: 3 };
const WIDGET_SIZES: Partial<Record<WidgetKind, { width: number; height: number }>> = {
  'quick-links': { width: 5, height: 3 },
  'today-priorities': { width: 5.5, height: 4.25 },
  'today-due': { width: 5.5, height: 4.25 },
  'today-overdue': { width: 5.5, height: 4.25 },
  'today-followups': { width: 5.5, height: 4.25 },
  'board-my-cards': { width: 10, height: 6 },
  'board-blocked': { width: 9, height: 5 },
  'board-unassigned': { width: 9, height: 5 },
  'project-tasks': { width: 8, height: 4 },
  'project-milestones': { width: 8, height: 4 },
  'project-activity': { width: 8, height: 4 },
  'project-members': { width: 8, height: 4 },
  'calendar-planner': { width: 15, height: 15 },
  'calendar-upcoming': { width: 10, height: 5 },
  'calendar-week': { width: 12, height: 7 },
  'documents-recent': { width: 10, height: 6 },
  'documents-shared': { width: 10, height: 6 },
  'contacts-online': { width: 8, height: 4 },
  'contacts-recent': { width: 10, height: 5 },
  'team-members': { width: 8, height: 5 },
  'team-activity': { width: 8, height: 5 },
  'organization-workspaces': { width: 8, height: 5 },
  'organization-invitations': { width: 8, height: 6 },
  'organization-members': { width: 10, height: 7 },
  'organization-overview': { width: 16, height: 4 },
  'organization-project-status': { width: 15, height: 6 },
  'notifications-unread': { width: 8, height: 6 },
  'notifications-actions': { width: 8, height: 6 },
  'project-active': { width: 12, height: 5 },
  'scrum-current': { width: 12, height: 6 },
  'scrum-progress': { width: 12, height: 7 },
};

function widgetSizeFor(kind: WidgetKind) { return WIDGET_SIZES[kind] ?? DEFAULT_WIDGET_SIZE; }
function widgetSizeLimitsFor(kind: WidgetKind) {
  if (kind === 'calendar-planner') return { minWidth: 11, minHeight: 8, maxWidth: 24, maxHeight: 16 };
  if (kind === 'calendar-upcoming') return { minWidth: 6, minHeight: 4, maxWidth: 18, maxHeight: 8 };
  if (kind === 'calendar-week') return { minWidth: 8, minHeight: 7, maxWidth: 20, maxHeight: 10 };
  if (kind === 'documents-recent') return { minWidth: 6, minHeight: 5, maxWidth: 18, maxHeight: 9 };
  if (kind === 'documents-shared') return { minWidth: 6, minHeight: 5, maxWidth: 18, maxHeight: 9 };
  if (kind === 'contacts-online') return { minWidth: 5, minHeight: 3, maxWidth: 16, maxHeight: 8 };
  if (kind === 'contacts-recent') return { minWidth: 5, minHeight: 4, maxWidth: 18, maxHeight: 8 };
  if (kind === 'team-members') return { minWidth: 6, minHeight: 5, maxWidth: 16, maxHeight: 8 };
  if (kind === 'team-activity') return { minWidth: 6, minHeight: 5, maxWidth: 16, maxHeight: 8 };
  if (kind === 'organization-workspaces') return { minWidth: 6, minHeight: 5, maxWidth: 16, maxHeight: 8 };
  if (kind === 'organization-invitations') return { minWidth: 6, minHeight: 5, maxWidth: 16, maxHeight: 8 };
  if (kind === 'organization-members') return { minWidth: 6, minHeight: 5, maxWidth: 16, maxHeight: 9 };
  if (kind === 'organization-overview') return { minWidth: 12, minHeight: 3, maxWidth: 24, maxHeight: 6 };
  if (kind === 'organization-project-status') return { minWidth: 8, minHeight: 4, maxWidth: 24, maxHeight: 7 };
  if (kind === 'notifications-unread' || kind === 'notifications-actions') return { minWidth: 5, minHeight: 4, maxWidth: 8, maxHeight: 6 };
  if (kind === 'project-active') return { minWidth: 6, minHeight: 3, maxWidth: 24, maxHeight: 10 };
  if (kind === 'quick-links') return { minWidth: 4, minHeight: 2, maxWidth: 12, maxHeight: 5 };
  if (kind === 'board-my-cards') return { minWidth: 6, minHeight: 4, maxWidth: 18, maxHeight: 9 };
  if (kind === 'board-blocked' || kind === 'board-unassigned') return { minWidth: 6, minHeight: 4, maxWidth: 16, maxHeight: 8 };
  if (kind === 'scrum-current') return { minWidth: 8, minHeight: 4, maxWidth: 20, maxHeight: 9 };
  if (kind === 'scrum-progress') return { minWidth: 8, minHeight: 5, maxWidth: 20, maxHeight: 9 };
  if (isProjectInsightKind(kind)) return { minWidth: 6, minHeight: 3, maxWidth: 16, maxHeight: 8 };
  if (isMyDayKind(kind)) return { minWidth: 4, minHeight: 3, maxWidth: 12, maxHeight: 8 };
  return { minWidth: 4, minHeight: 2, maxWidth: 18, maxHeight: 8 };
}
function boundedWidgetSize(kind: WidgetKind, width: number, height: number) {
  const limits = widgetSizeLimitsFor(kind);
  return {
    width: Math.min(limits.maxWidth, Math.max(limits.minWidth, width)),
    height: Math.min(limits.maxHeight, Math.max(limits.minHeight, height)),
  };
}
function isMyDayKind(kind: WidgetKind) { return kind.startsWith('today-'); }
type BoardWidgetKind = Extract<WidgetKind, 'board-my-cards' | 'board-blocked' | 'board-unassigned' | 'scrum-current' | 'scrum-progress'>;
function isBoardWidgetKind(kind: WidgetKind): kind is BoardWidgetKind {
  return kind === 'board-my-cards' || kind === 'board-blocked' || kind === 'board-unassigned'
    || kind === 'scrum-current' || kind === 'scrum-progress';
}
function isProjectInsightKind(kind: WidgetKind) {
  return kind === 'project-tasks' || kind === 'project-milestones' || kind === 'project-activity' || kind === 'project-members';
}

type GridMetrics = { columns: number; cellColumns: number; gridRows: number; cellWidth: number; cellSize: number };
type GridRect = { id?: string; column: number; row: number; span: number; height: number };

function widgetGridRect(widget: DashboardWidget, grid: GridMetrics): GridRect {
  const span = Math.max(1, Math.round((Math.min(grid.columns, widget.width) / grid.columns) * grid.cellColumns));
  const height = Math.max(1, Math.ceil((widget.height * ROW_HEIGHT) / grid.cellSize - 0.001));
  const column = Math.min(grid.cellColumns - span + 1, Math.max(1, Math.round(((widget.column - 1) / grid.columns) * grid.cellColumns) + 1));
  const row = Math.max(1, Math.round(((widget.row - 1) * ROW_HEIGHT) / grid.cellSize) + 1);
  return { id: widget.id, column, row, span, height };
}

function rectanglesOverlap(left: GridRect, right: GridRect) {
  return left.column < right.column + right.span && left.column + left.span > right.column
    && left.row < right.row + right.height && left.row + left.height > right.row;
}

function fitsGrid(rect: GridRect, grid: GridMetrics) {
  if (rect.column < 1 || rect.row < 1 || rect.column + rect.span - 1 > grid.cellColumns || rect.row + rect.height - 1 > grid.gridRows) return false;
  return true;
}

function findFreeRect(span: number, height: number, occupied: GridRect[], grid: GridMetrics, near?: GridRect): GridRect | null {
  let best: GridRect | null = null;
  let bestScore = Infinity;
  for (let row = 1; row <= grid.gridRows - height + 1; row++) {
    for (let column = 1; column <= grid.cellColumns - span + 1; column++) {
      const candidate = { column, row, span, height };
      if (!fitsGrid(candidate, grid) || occupied.some((item) => rectanglesOverlap(candidate, item))) continue;
      if (!near) return candidate;
      const score = Math.abs(column - near.column) + Math.abs(row - near.row);
      if (score < bestScore) { best = candidate; bestScore = score; }
    }
  }
  return best;
}

function logicalPosition(rect: GridRect, grid: GridMetrics) {
  return { column: 1 + ((rect.column - 1) * grid.columns) / grid.cellColumns, row: 1 + ((rect.row - 1) * grid.cellSize) / ROW_HEIGHT };
}

function resolveDropLayout(widgets: DashboardWidget[], target: GridDropTarget & { size?: { width: number; height: number } }, grid: GridMetrics): DashboardWidget[] | null {
  const targetRect = { id: target.id, column: target.column, row: target.row, span: target.span, height: target.height };
  if (!fitsGrid(targetRect, grid)) return null;
  const occupied: GridRect[] = [targetRect];
  const displaced: { widget: DashboardWidget; rect: GridRect }[] = [];
  for (const widget of widgets) {
    if (widget.id === target.id) continue;
    const rect = widgetGridRect(widget, grid);
    if (fitsGrid(rect, grid) && !occupied.some((item) => rectanglesOverlap(item, rect))) occupied.push(rect);
    else displaced.push({ widget, rect });
  }
  const newPositions = new Map<string, GridRect>();
  for (const { widget, rect } of displaced.sort((left, right) => right.rect.span * right.rect.height - left.rect.span * left.rect.height)) {
    const free = findFreeRect(rect.span, rect.height, occupied, grid, rect);
    if (!free) return null;
    occupied.push({ ...free, id: widget.id });
    newPositions.set(widget.id, free);
  }
  return widgets.map((widget) => {
    const rect = widget.id === target.id ? targetRect : newPositions.get(widget.id);
    return rect ? { ...widget, ...logicalPosition(rect, grid), ...(widget.id === target.id && target.size ? target.size : {}) } : widget;
  });
}

function resizeWidgetLayout(widgets: DashboardWidget[], id: string, direction: ResizeDirection, deltaX: number, deltaY: number, grid: GridMetrics): DashboardWidget[] | null {
  const widget = widgets.find((item) => item.id === id);
  if (!widget || !grid.cellWidth || !grid.cellSize) return null;
  const rect = widgetGridRect(widget, grid);
  const limits = widgetSizeLimitsFor(widget.kind);
  const horizontalDelta = Math.round(deltaX / grid.cellWidth);
  const verticalDelta = Math.round(deltaY / grid.cellSize);
  const growsEast = direction.includes('e');
  const growsWest = direction.includes('w');
  const growsSouth = direction.includes('s');
  const growsNorth = direction.includes('n');
  let span = rect.span;
  let height = rect.height;

  if (growsEast || growsWest) {
    const step = grid.columns / grid.cellColumns;
    const minSpan = Math.max(1, Math.ceil(limits.minWidth / step - 0.001));
    const availableSpan = growsEast ? grid.cellColumns - rect.column + 1 : rect.column + rect.span - 1;
    const maxSpan = Math.min(availableSpan, Math.floor(limits.maxWidth / step + 0.001));
    if (maxSpan < minSpan) return null;
    const change = growsEast ? horizontalDelta : -horizontalDelta;
    span = Math.min(maxSpan, Math.max(minSpan, rect.span + change));
  }

  if (growsSouth || growsNorth) {
    const minHeight = Math.max(1, Math.ceil((limits.minHeight * ROW_HEIGHT) / grid.cellSize - 0.001));
    const availableHeight = growsSouth ? grid.gridRows - rect.row + 1 : rect.row + rect.height - 1;
    const maxHeight = Math.min(availableHeight, Math.floor((limits.maxHeight * ROW_HEIGHT) / grid.cellSize + 0.001));
    if (maxHeight < minHeight) return null;
    const change = growsSouth ? verticalDelta : -verticalDelta;
    height = Math.min(maxHeight, Math.max(minHeight, rect.height + change));
  }

  const column = growsWest ? rect.column + rect.span - span : rect.column;
  const row = growsNorth ? rect.row + rect.height - height : rect.row;
  const size = {
    width: growsEast || growsWest ? span * grid.columns / grid.cellColumns : widget.width,
    height: growsNorth || growsSouth ? height * grid.cellSize / ROW_HEIGHT : widget.height,
  };
  return resolveDropLayout(widgets, { id, column, row, span, height, size }, grid);
}

function widgetLayoutsEqual(left: DashboardWidget[], right: DashboardWidget[], ignoreId?: string) {
  return left.length === right.length && left.every((widget, index) => {
    const other = right[index];
    if (widget.id === ignoreId) return other?.id === widget.id;
    return widget.id === other.id && widget.column === other.column && widget.row === other.row
      && widget.width === other.width && widget.height === other.height;
  });
}

const CATEGORIES: { id: CatalogCategoryId; title: string; description: string }[] = [
  { id: 'general', title: 'General', description: 'Acciones disponibles desde cualquier lugar.' },
  { id: 'my-day', title: 'Mi día', description: 'Lo que necesita tu atención hoy.' },
  { id: 'projects', title: 'Proyectos', description: 'Seguimiento y actividad de tus proyectos.' },
  { id: 'boards', title: 'Tableros y Scrum', description: 'Tarjetas, bloqueos y sprints.' },
  { id: 'calendar', title: 'Calendario', description: 'Eventos próximos y agenda.' },
  { id: 'documents', title: 'Documentos', description: 'Accesos rápidos a tus documentos.' },
  { id: 'notifications', title: 'Notificaciones', description: 'Avisos y acciones pendientes.' },
  { id: 'contacts', title: 'Contactos', description: 'Personas y conversaciones.' },
  { id: 'teams', title: 'Equipo y organización', description: 'Personas, equipos y espacios.' },
];

const CATALOG: CatalogItem[] = [
  { kind: 'quick-links', category: 'general', title: 'Accesos rápidos', description: 'Enlaces directos a las áreas que más utilizas.' },
  { kind: 'today-priorities', category: 'my-day', title: 'Prioridades de hoy', description: 'Ten a mano lo más importante de tu jornada.', context: 'Personal' },
  { kind: 'today-due', category: 'my-day', title: 'Tareas que vencen hoy', description: 'Consulta lo que necesita quedar listo durante el día.', context: 'Personal' },
  { kind: 'today-overdue', category: 'my-day', title: 'Pendientes vencidos', description: 'Vuelve rápidamente a las tareas que quedaron atrás.', context: 'Personal' },
  { kind: 'today-followups', category: 'my-day', title: 'Seguimientos abiertos', description: 'Menciones que esperan tu respuesta.', context: 'Personal' },
  { kind: 'project-active', category: 'projects', title: 'Proyectos', description: 'Ten a la vista las iniciativas del contexto y retoma cualquiera desde el dashboard.', href: '/dashboard/projects', context: 'Según el contexto' },
  { kind: 'project-tasks', category: 'projects', title: 'Mis tareas en proyectos', description: 'Accede a las tareas que tienes asignadas en tus proyectos.', href: '/dashboard/projects', context: 'Por responsable' },
  { kind: 'project-milestones', category: 'projects', title: 'Hitos próximos', description: 'Consulta fechas importantes y entregas cercanas.', href: '/dashboard/projects', context: 'Fechas' },
  { kind: 'project-activity', category: 'projects', title: 'Actividad de proyectos', description: 'Revisa los cambios recientes en tus iniciativas.', href: '/dashboard/projects', context: 'Actualizaciones' },
  { kind: 'project-members', category: 'projects', title: 'Personas de mis proyectos', description: 'Encuentra rápidamente quién participa en cada proyecto.', href: '/dashboard/projects', context: 'Colaboración' },
  { kind: 'board-my-cards', category: 'boards', title: 'Mis tarjetas abiertas', description: 'Retoma tus tarjetas pendientes y ten a la vista vencimientos y bloqueos.', href: '/dashboard/projects', context: 'Flexible y Scrum' },
  { kind: 'board-blocked', category: 'boards', title: 'Tarjetas bloqueadas', description: 'Identifica trabajo detenido que requiere atención.', href: '/dashboard/projects', context: 'Flexible y Scrum' },
  { kind: 'board-unassigned', category: 'boards', title: 'Tarjetas sin responsable', description: 'Localiza trabajo del tablero que aún necesita dueño.', href: '/dashboard/projects', context: 'Flexible y Scrum' },
  { kind: 'scrum-current', category: 'boards', title: 'Sprint actual', description: 'Consulta el objetivo y el trabajo del sprint activo.', href: '/dashboard/projects', context: 'Solo Scrum' },
  { kind: 'scrum-progress', category: 'boards', title: 'Progreso del sprint', description: 'Sigue el avance de las tareas comprometidas.', href: '/dashboard/projects', context: 'Solo Scrum' },
  { kind: 'calendar-planner', category: 'calendar', title: 'Calendario interactivo', description: 'Cambia entre día, semana y mes; consulta y crea eventos desde tu espacio.', context: 'Día · Semana · Mes' },
  { kind: 'calendar-upcoming', category: 'calendar', title: 'Próximos eventos', description: 'Consulta tus siguientes compromisos y entra directamente al día en tu calendario.', href: '/dashboard/calendar', context: '30 días' },
  { kind: 'calendar-week', category: 'calendar', title: 'Agenda de la semana', description: 'Explora tus días, filtra calendarios y entra a cada plan desde una vista semanal.', href: '/dashboard/calendar', context: '7 días · personalizable' },
  { kind: 'documents-recent', category: 'documents', title: 'Documentos recientes', description: 'Retoma el trabajo desde tus últimos documentos y filtra por espacio o proyecto.', href: '/dashboard/documents', context: 'Actualizados recientemente' },
  { kind: 'documents-shared', category: 'documents', title: 'Compartidos conmigo', description: 'Abre documentos que otras personas compartieron contigo.', href: '/dashboard/documents', context: 'Colaboración' },
  { kind: 'notifications-unread', category: 'notifications', title: 'Avisos sin leer', description: 'Revisa las notificaciones nuevas de AETHER.', href: '/dashboard/notifications', context: 'Sin leer' },
  { kind: 'notifications-actions', category: 'notifications', title: 'Acciones pendientes', description: 'Encuentra invitaciones y avisos que esperan una respuesta.', href: '/dashboard/notifications', context: 'Requieren atención' },
  { kind: 'contacts-online', category: 'contacts', title: 'Contactos en línea', description: 'Ve quién está disponible para conversar.', href: '/dashboard/contacts', context: 'Disponibilidad' },
  { kind: 'contacts-recent', category: 'contacts', title: 'Conversaciones recientes', description: 'Retoma tus conversaciones más recientes.', href: '/dashboard/contacts', context: 'Mensajes' },
  { kind: 'team-members', category: 'teams', title: 'Miembros del equipo', description: 'Ten presentes a las personas con las que trabajas.', href: '/dashboard/teams', context: 'Equipo' },
  { kind: 'team-activity', category: 'teams', title: 'Actividad del equipo', description: 'Sigue los cambios recientes de tus equipos.', href: '/dashboard/teams', context: 'Actualizaciones' },
  { kind: 'organization-workspaces', category: 'teams', title: 'Espacios de trabajo', description: 'Accede a los espacios de tu organización.', href: '/dashboard/organization', context: 'Organización' },
  { kind: 'organization-invitations', category: 'teams', title: 'Invitaciones pendientes', description: 'Revisa quién está por unirse a tu organización.', href: '/dashboard/organizations', context: 'Organización' },
  { kind: 'organization-members', category: 'teams', title: 'Personas de la organización', description: 'Consulta quiénes tienen acceso y abre un chat con tus integrantes.', href: '/dashboard/organizations', context: 'Organización' },
  { kind: 'organization-overview', category: 'teams', title: 'Panorama de la organización', description: 'Consulta de un vistazo proyectos visibles, espacios e integrantes.', href: '/dashboard/organizations', context: 'Organización' },
  { kind: 'organization-project-status', category: 'teams', title: 'Estado de los proyectos', description: 'Compara cuántos proyectos están en curso, preparación, pausa o completados.', href: '/dashboard/organizations', context: 'Organización' },
];

const LEGACY_KIND_MAP: Record<string, WidgetKind> = {
  'my-day': 'today-priorities',
  shortcuts: 'quick-links',
  projects: 'project-active',
  calendar: 'calendar-upcoming',
  documents: 'documents-recent',
  notifications: 'notifications-unread',
};

function layoutKey(userId: string) { return `aether:dashboard-layout:v2:${userId}`; }

function isWidgetKind(value: unknown): value is WidgetKind {
  return typeof value === 'string' && CATALOG.some((item) => item.kind === value);
}

function readLayout(value: string | null): SavedLayout | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as { locked?: boolean; widgets?: unknown[] };
    if (!Array.isArray(parsed.widgets)) return null;
    const widgets = parsed.widgets.flatMap((entry): DashboardWidget[] => {
      if (!entry || typeof entry !== 'object') return [];
      const widget = entry as Record<string, unknown>;
      const previousKind = typeof widget.kind === 'string' ? widget.kind : '';
      const kind = isWidgetKind(previousKind) ? previousKind : LEGACY_KIND_MAP[previousKind];
      if (!kind || typeof widget.id !== 'string'
        || !Number.isFinite(widget.column) || !Number.isFinite(widget.row)
        || !Number.isFinite(widget.width) || !Number.isFinite(widget.height)) return [];
      return [{
        id: widget.id,
        kind,
        column: Math.min(DESKTOP_COLUMNS, Math.max(1, widget.column as number)),
        row: Math.max(1, widget.row as number),
        ...boundedWidgetSize(kind, widget.width as number, widget.height as number),
        ...(widget.config && typeof widget.config === 'object' && !Array.isArray(widget.config)
          ? { config: widget.config as Record<string, unknown> } : {}),
      }];
    });
    return { locked: parsed.locked !== false, widgets };
  } catch { return null; }
}

function normalizeBoard(value: DashboardBoard): DashboardBoard {
  const layout = readLayout(JSON.stringify({ widgets: value.widgets, locked: value.locked }));
  const widgets = layout?.widgets ?? [];
  const previousThreeWidgetOrganizationBoard = value.context.type === 'ORGANIZATION' && value.locked === false && widgets.length === 3
    && widgets.some((widget) => widget.kind === 'project-active' && widget.column === 1 && widget.row === 1 && widget.width === 24 && widget.height === 8)
    && widgets.some((widget) => widget.kind === 'organization-workspaces' && widget.column === 1 && widget.row === 10 && widget.width === 15 && widget.height === 7)
    && widgets.some((widget) => widget.kind === 'organization-invitations' && widget.column === 17 && widget.row === 10 && widget.width === 8 && widget.height === 7);
  const previousFiveWidgetOrganizationBoard = value.context.type === 'ORGANIZATION' && value.locked === false && widgets.length === 5
    && widgets.some((widget) => widget.kind === 'organization-overview' && widget.column === 1 && widget.row === 1 && widget.width === 24 && widget.height === 4)
    && widgets.some((widget) => widget.kind === 'project-active' && widget.column === 1 && widget.row === 6 && widget.width === 12 && widget.height === 8)
    && widgets.some((widget) => widget.kind === 'organization-workspaces' && widget.column === 13 && widget.row === 6 && widget.width === 12 && widget.height === 8)
    && widgets.some((widget) => widget.kind === 'organization-members' && widget.column === 1 && widget.row === 15 && widget.width === 12 && widget.height === 8)
    && widgets.some((widget) => widget.kind === 'organization-invitations' && widget.column === 13 && widget.row === 15 && widget.width === 12 && widget.height === 8);
  return {
    ...value,
    widgets: previousThreeWidgetOrganizationBoard || previousFiveWidgetOrganizationBoard ? starterWidgets(value.context) : widgets,
    locked: value.locked,
  };
}

function starterWidgets(context: DashboardContext): DashboardWidget[] {
  if (context.type === 'ORGANIZATION') return [
    { id: 'organization-overview-' + crypto.randomUUID(), kind: 'organization-overview', column: 1, row: 1, width: 24, height: 4 },
    { id: 'project-active-' + crypto.randomUUID(), kind: 'project-active', column: 1, row: 6, width: 15, height: 9 },
    { id: 'organization-project-status-' + crypto.randomUUID(), kind: 'organization-project-status', column: 1, row: 16, width: 15, height: 6 },
    { id: 'organization-workspaces-' + crypto.randomUUID(), kind: 'organization-workspaces', column: 16, row: 6, width: 9, height: 5 },
    { id: 'organization-members-' + crypto.randomUUID(), kind: 'organization-members', column: 16, row: 12, width: 9, height: 5 },
    { id: 'organization-invitations-' + crypto.randomUUID(), kind: 'organization-invitations', column: 16, row: 18, width: 9, height: 5 },
  ];
  const first: DashboardWidget = { id: `project-active-${crypto.randomUUID()}`, kind: 'project-active', column: 1, row: 1, width: 12, height: 5 };
  const companion: Partial<Record<DashboardContext['type'], WidgetKind>> = {
    PERSONAL: 'today-priorities', WORKSPACE: 'documents-recent',
  };
  const secondKind = companion[context.type];
  if (!secondKind) return [first];
  return [first, { id: `${secondKind}-${crypto.randomUUID()}`, kind: secondKind, column: 14, row: 1, ...widgetSizeFor(secondKind) }];
}

function catalogItemFor(kind: WidgetKind) { return CATALOG.find((item) => item.kind === kind); }
function titleFor(kind: WidgetKind) { return catalogItemFor(kind)?.title ?? 'Widget'; }

function categoryIcon(category: CatalogCategoryId, size: number) {
  const props = { size, strokeWidth: 1.8 };
  switch (category) {
    case 'general': return <LayoutDashboard {...props} />;
    case 'my-day': return <Sparkles {...props} />;
    case 'projects': return <FolderKanban {...props} />;
    case 'boards': return <Activity {...props} />;
    case 'calendar': return <CalendarDays {...props} />;
    case 'documents': return <FileText {...props} />;
    case 'notifications': return <Bell {...props} />;
    case 'contacts': return <Users {...props} />;
    case 'teams': return <UsersRound {...props} />;
  }
}

function catalogCategoryTitle(category: CatalogCategoryId) {
  return CATEGORIES.find((item) => item.id === category)?.title ?? 'General';
}

function iconFor(kind: WidgetKind, size: number) {
  const iconProps = { size, strokeWidth: 1.8 };
  if (kind === 'team-members') return <UserRoundCheck {...iconProps} />;
  if (kind === 'team-activity') return <History {...iconProps} />;
  if (kind === 'organization-workspaces') return <PanelsTopLeft {...iconProps} />;
  if (kind === 'organization-invitations') return <MailPlus {...iconProps} />;
  if (kind === 'organization-members') return <UserRoundCheck {...iconProps} />;
  if (kind === 'organization-overview') return <Building2 {...iconProps} />;
  if (kind === 'organization-project-status') return <Activity {...iconProps} />;
  if (kind.startsWith('organization-')) return <Building2 size={size} strokeWidth={1.8} />;
  if (kind.startsWith('project-')) return <ProjectFeatureIcon kind={kind as ProjectWidgetKind} size={size} />;
  switch (kind) {
    case 'calendar-planner': return <CalendarRange {...iconProps} />;
    case 'calendar-upcoming': return <CalendarClock {...iconProps} />;
    case 'calendar-week': return <CalendarCheck2 {...iconProps} />;
    case 'documents-recent': return <FileClock {...iconProps} />;
    case 'documents-shared': return <Share2 {...iconProps} />;
    case 'notifications-unread': return <BellDot {...iconProps} />;
    case 'notifications-actions': return <ClipboardCheck {...iconProps} />;
    case 'contacts-online': return <ContactRound {...iconProps} />;
    case 'contacts-recent': return <MessagesSquare {...iconProps} />;
    case 'board-my-cards': return <ListTodo {...iconProps} />;
    case 'board-blocked': return <CircleAlert {...iconProps} />;
    case 'board-unassigned': return <Users {...iconProps} />;
    case 'scrum-current': return <Clock3 {...iconProps} />;
    case 'scrum-progress': return <CheckCircle2 {...iconProps} />;
  }
  const item = catalogItemFor(kind);
  return item ? categoryIcon(item.category, size) : <LayoutDashboard size={size} strokeWidth={1.8} />;
}

function BoardWidgetCatalogPreview({ kind }: { kind: BoardWidgetKind }) {
  if (kind === 'board-my-cards') return <div className={styles.boardWidgetPreview} data-kind={kind} aria-hidden="true">
    <span className={styles.boardQueuePreviewTop}><i>{iconFor(kind, 10)}</i><b /><em /><small><i /><i /><i /></small></span>
    <span className={styles.boardPreviewRow}><i><Flag size={10} /></i><b /><em /></span>
    <span className={styles.boardPreviewRow}><i><CalendarDays size={10} /></i><b /><em /></span>
  </div>;
  if (kind === 'board-blocked') return <div className={styles.boardWidgetPreview} data-kind={kind} aria-hidden="true">
    <span className={styles.boardBlockedPreviewHead}><i>{iconFor(kind, 12)}</i><b /><em /></span>
    <span className={styles.boardBlockedPreviewFlow}><i /><i /><i /><b>{iconFor(kind, 9)}</b></span>
    <span className={styles.boardBlockedPreviewCard}><i /><b /><em /></span>
  </div>;
  if (kind === 'board-unassigned') return <div className={styles.boardWidgetPreview} data-kind={kind} aria-hidden="true">
    <span className={styles.boardUnassignedPreviewHead}><i>{iconFor(kind, 12)}</i><b /><em /></span>
    <span className={styles.boardUnassignedSeats}><i /><i /><i /><b /></span>
    <span className={styles.boardUnassignedPreviewCard}><i /><b /><em /></span>
  </div>;
  if (kind === 'scrum-current') return <div className={styles.boardWidgetPreview} data-kind={kind} aria-hidden="true">
    <span className={styles.boardPreviewSprint}><i>{iconFor(kind, 12)}</i><b /><em /></span>
    <span className={styles.boardPreviewTimeline}><i /><i /><i /><i /></span>
  </div>;
  if (kind === 'scrum-progress') return <div className={styles.boardWidgetPreview} data-kind={kind} aria-hidden="true">
    <span className={styles.boardProgressDelivery}><i>{iconFor(kind, 10)}</i><b /><em /></span>
    <span className={styles.boardProgressTrack}><i /></span>
    <span className={styles.boardProgressLanes}><i /><i /><i /><i /></span>
  </div>;
  return <div className={styles.boardWidgetPreview} data-kind={kind} aria-hidden="true">
    <span className={styles.boardPreviewProgressHead}><i>{iconFor(kind, 13)}</i><b /><em /></span>
    <span className={styles.boardPreviewProgress}><i /><i /><i /><i /><i /><i /><i /></span>
    <span className={styles.boardPreviewProgressNote}><b /><em /></span>
  </div>;
}

function UpcomingEventsCatalogPreview() {
  return <div className={styles.upcomingCatalogPreview} aria-hidden="true">
    <span className={styles.upcomingPreviewHead}><i>{iconFor('calendar-upcoming', 10)}</i><b /><small>30 DÍAS</small></span>
    <span className={styles.upcomingPreviewRow}><time><small>HOY</small><b>15</b></time><span><b /><em /></span><ArrowRight size={9} /></span>
    <span className={styles.upcomingPreviewRow}><time><small>VIE</small><b>16</b></time><span><b /><em /></span><ArrowRight size={9} /></span>
    <span className={styles.upcomingPreviewRow}><time><small>SÁB</small><b>17</b></time><span><b /><em /></span><ArrowRight size={9} /></span>
  </div>;
}

function WeekAgendaCatalogPreview() {
  return <div className={styles.weekAgendaCatalogPreview} aria-hidden="true">
    <span className={styles.weekPreviewTop}><i>{iconFor('calendar-week', 10)}</i><b /><small>SEMANA</small></span>
    <span className={styles.weekPreviewDays}><i><small>LUN</small><b>12</b></i><i><small>MAR</small><b>13</b></i><i className={styles.weekPreviewToday}><small>MIÉ</small><b>14</b></i><i><small>JUE</small><b>15</b></i><i><small>VIE</small><b>16</b></i><i><small>SÁB</small><b>17</b></i><i><small>DOM</small><b>18</b></i></span>
    <span className={styles.weekPreviewEvent}><i /><b /><em /></span>
    <span className={styles.weekPreviewEvent}><i /><b /><em /></span>
  </div>;
}

function DocumentsRecentCatalogPreview() {
  return <div className={styles.documentsRecentCatalogPreview} aria-hidden="true">
    <span className={styles.documentsPreviewHead}><i>{iconFor('documents-recent', 10)}</i><b /><small>RECIENTES</small></span>
    <span className={styles.documentsPreviewRow}><i><FileText size={9} /></i><b /><em /></span>
    <span className={styles.documentsPreviewRow}><i><FolderKanban size={9} /></i><b /><em /></span>
    <span className={styles.documentsPreviewRow}><i><FileText size={9} /></i><b /><em /></span>
  </div>;
}

function TeamMembersCatalogPreview() {
  return <div className={styles.teamMembersCatalogPreview} aria-hidden="true">
    <span className={styles.teamMembersPreviewTeam}><i>AE</i><b /><small>4</small></span>
    <span className={styles.teamMembersPreviewRow}><i>AL</i><b /><em /></span>
    <span className={styles.teamMembersPreviewRow}><i>MR</i><b /><em /></span>
    <span className={styles.teamMembersPreviewRow}><i>JV</i><b /><em /></span>
  </div>;
}

function TeamActivityCatalogPreview() {
  return <div className={styles.teamActivityCatalogPreview} aria-hidden="true">
    <span className={styles.teamActivityPreviewTeam}><i>{iconFor('team-activity', 9)}</i><b /><small /></span>
    <span className={styles.teamActivityPreviewRow}><i /><b /><em /></span>
    <span className={styles.teamActivityPreviewRow}><i /><b /><em /></span>
    <span className={styles.teamActivityPreviewRow}><i /><b /><em /></span>
  </div>;
}

function OrganizationWorkspacesCatalogPreview() {
  return <div className={styles.organizationWorkspacesCatalogPreview} aria-hidden="true">
    <span className={styles.organizationWorkspacePreviewHead}><i><PanelsTopLeft size={10} /></i><b /><small>4</small></span>
    <span className={styles.organizationWorkspacePreviewRow}><i /><b /><em /></span>
    <span className={styles.organizationWorkspacePreviewRow}><i /><b /><em /></span>
    <span className={styles.organizationWorkspacePreviewRow}><i /><b /><em /></span>
  </div>;
}

function OrganizationInvitationsCatalogPreview() {
  return <div className={styles.organizationInvitationsCatalogPreview} aria-hidden="true">
    <span className={styles.organizationInvitationsPreviewHead}><b /><small>3 activas</small></span>
    <span className={styles.organizationInvitationsPreviewRow}><i /><b /><em /></span>
    <span className={styles.organizationInvitationsPreviewRow}><i /><b /><em /></span>
    <span className={styles.organizationInvitationsPreviewRow}><i /><b /><em /></span>
  </div>;
}

function OrganizationOverviewCatalogPreview() {
  return <div className={styles.organizationOverviewCatalogPreview} aria-hidden="true">
    <span><i>{iconFor('organization-overview', 10)}</i><b /><small /></span>
    <span><i /><b /><small /></span><span><i /><b /><small /></span><span><i /><b /><small /></span>
  </div>;
}

function OrganizationMembersCatalogPreview() {
  return <div className={styles.organizationMembersCatalogPreview} aria-hidden="true">
    <span><i>AL</i><b /><small /></span><span><i>MR</i><b /><small /></span><span><i>JV</i><b /><small /></span>
  </div>;
}

const dashboardCollision: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  return pointerCollisions.length > 0 ? pointerCollisions : closestCenter(args);
};

export default function PersonalizedDashboard({ projects = [], organization = null, organizations = [], workspaces = [], onSelectWorkspace, onCreateWorkspace }: {
  projects?: SidebarProject[];
  organization?: { id: string; name: string; type: string; role?: string; workspaceCount?: number; memberCount?: number } | null;
  organizations?: { id: string; name: string; type: string; role?: string; workspaceCount?: number; memberCount?: number }[];
  workspaces?: Workspace[];
  onSelectWorkspace?: (workspaceId: string) => void;
  onCreateWorkspace?: (organizationId: string) => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const user = useAuthStore((state) => state.user);
  const activeWorkspaceId = useActiveWorkspaceStore((state) => state.activeWorkspaceId);
  const notifications = useNotificationStore((state) => state.notifications);
  const fetchNotifications = useNotificationStore((state) => state.fetchNotifications);
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [enteringWidgetId, setEnteringWidgetId] = useState<string | null>(null);
  const [boards, setBoards] = useState<DashboardBoard[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [boardsLoading, setBoardsLoading] = useState(true);
  const [boardsReloadKey, setBoardsReloadKey] = useState(0);
  const [boardBusy, setBoardBusy] = useState(false);
  const [boardError, setBoardError] = useState('');
  const savedLayoutsRef = useRef<Record<string, string>>({});
  const saveQueueRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const [scopedProjects, setScopedProjects] = useState<ContextProject[]>([]);
  const [scopedProjectsLoading, setScopedProjectsLoading] = useState(false);
  const [scopedProjectsError, setScopedProjectsError] = useState(false);
  const [scopedProjectsScope, setScopedProjectsScope] = useState('');
  const [scopedProjectsRefresh, setScopedProjectsRefresh] = useState(0);
  const activeBoard = boards.find((board) => board.id === activeBoardId) ?? null;
  const boardContext = activeBoard?.context ?? { type: 'PERSONAL' as const, id: null };
  const boardScopeKey = `${boardContext.type}:${boardContext.id ?? ''}`;
  const boardWorkspaceId = boardContext.type === 'WORKSPACE' ? boardContext.id : activeWorkspaceId;
  const boardOrganization = boardContext.type === 'ORGANIZATION'
    ? organizations.find((item) => item.id === boardContext.id) ?? null
    : organization;
  const widgetProjects = boardContext.type === 'WORKSPACE' ? scopedProjects : projects;
  const fixedWidgets = useMemo(() => widgets.map((widget) => ({
    ...widget,
    ...boundedWidgetSize(widget.kind, widget.width, widget.height),
  })), [widgets]);
  const needsScopedProjects = fixedWidgets.some((widget) => widget.kind === 'project-active' || widget.kind === 'organization-overview' || widget.kind === 'organization-project-status');
  const [resizePreviewWidgets, setResizePreviewWidgets] = useState<DashboardWidget[] | null>(null);
  const [resizeState, setResizeState] = useState<{ id: string; invalid: boolean } | null>(null);
  const resizeSessionRef = useRef<ResizeSession | null>(null);
  const [dragBlocked, setDragBlocked] = useState(false);
  const widgetDragSessionRef = useRef<WidgetDragSession | null>(null);
  const dragMoveFrameRef = useRef<number | null>(null);
  const pendingDragMoveRef = useRef<{ active: DragStartEvent['active']; delta: { x: number; y: number } } | null>(null);
  const widgetSettleFramesRef = useRef<number[]>([]);
  const widgetSettleTimerRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (dragMoveFrameRef.current !== null) window.cancelAnimationFrame(dragMoveFrameRef.current);
    widgetSettleFramesRef.current.forEach((frame) => window.cancelAnimationFrame(frame));
    if (widgetSettleTimerRef.current !== null) window.clearTimeout(widgetSettleTimerRef.current);
  }, []);
  const displayWidgets = resizePreviewWidgets ?? fixedWidgets;
  const needsMyDayCards = fixedWidgets.some((widget) => (isMyDayKind(widget.kind) && widget.kind !== 'today-followups') || widget.kind === 'board-my-cards' || widget.kind === 'board-blocked');
  const needsFollowups = fixedWidgets.some((widget) => widget.kind === 'today-followups');
  const needsUnreadNotifications = fixedWidgets.some((widget) => widget.kind === 'notifications-unread');
  const needsPendingActions = fixedWidgets.some((widget) => widget.kind === 'notifications-actions');
  const needsOnlineContacts = fixedWidgets.some((widget) => widget.kind === 'contacts-online');
  const needsRecentConversations = fixedWidgets.some((widget) => widget.kind === 'contacts-recent');
  const contactWidgetData = useContactWidgetData(needsOnlineContacts && !!user?.id, needsRecentConversations && !!user?.id);
  const needsProjectTasks = fixedWidgets.some((widget) => widget.kind === 'project-tasks');
  const needsProjectMilestones = fixedWidgets.some((widget) => widget.kind === 'project-milestones');
  const needsProjectActivity = fixedWidgets.some((widget) => widget.kind === 'project-activity');
  const needsProjectMembers = fixedWidgets.some((widget) => widget.kind === 'project-members');
  const projectWidgetData = useProjectDashboardData({
    workspaceId: activeWorkspaceId,
    projects,
    needsTasks: needsProjectTasks,
    needsMilestones: needsProjectMilestones,
    needsActivity: needsProjectActivity,
    needsPeople: needsProjectMembers,
  });
  const [myDayCards, setMyDayCards] = useState<MyDayCard[]>([]);
  const [myDayLoading, setMyDayLoading] = useState(true);
  const [myDayError, setMyDayError] = useState(false);
  const [myDayReloadKey, setMyDayReloadKey] = useState(0);
  const [myDayDate, setMyDayDate] = useState(() => new Date());
  const myDayGroups = useMemo(() => groupMyDayCards(myDayCards, myDayDate), [myDayCards, myDayDate]);
  const followups = useMemo(() => notifications.filter((item) => !item.read && (item.type === 'COMMENT_MENTION' || item.type === 'DOCUMENT_MENTION')), [notifications]);
  const [locked, setLocked] = useState(false);
  const [readyForUser, setReadyForUser] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sidebarControlsHost, setSidebarControlsHost] = useState<HTMLElement | null>(null);
  const [activeCategory, setActiveCategory] = useState<CatalogCategoryId | 'all'>('all');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedKind, setSelectedKind] = useState<WidgetKind>('today-priorities');
  const [placementError, setPlacementError] = useState('');
  const [canvasMessage, setCanvasMessage] = useState('');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [widgetSettle, setWidgetSettle] = useState<WidgetSettle | null>(null);
  const [dropTarget, setDropTarget] = useState<GridDropTarget | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ column: number; row: number; fast: boolean } | null>(null);
  const hoverPointerRef = useRef<{ x: number; y: number; time: number; column: number; row: number } | null>(null);
  const [columns, setColumns] = useState(DESKTOP_COLUMNS);
  const [gridRows, setGridRows] = useState(20);
  const [cellColumns, setCellColumns] = useState(48);
  const [cellSize, setCellSize] = useState(GRID_CELL_TARGET);
  const [cellWidth, setCellWidth] = useState(GRID_CELL_TARGET);
  const [gridMeasured, setGridMeasured] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const { node: gridRef, setNodeRef: setGridDropRef } = useDroppable({ id: 'dashboard-grid', disabled: locked || columns !== DESKTOP_COLUMNS });

  useEffect(() => { setSidebarControlsHost(document.getElementById('aether-dashboard-controls')); }, []);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const userId = user.id;
    let legacy: SavedLayout | null = null;
    try { legacy = readLayout(window.localStorage.getItem(layoutKey(userId))); } catch { /* Start with a blank board. */ }
    setBoardsLoading(true);
    setBoardError('');
    void (async () => {
      try {
        const response = await apiService.get<{ dashboards: DashboardBoard[] }>('/api/users/me/dashboards', true);
        if (!response.success || !response.data) throw new Error(response.error?.message ?? 'No se pudieron cargar los tableros.');
        if (cancelled) return;
        let loaded = response.data.dashboards.map(normalizeBoard);
        if (loaded.length === 0) {
          const created = await apiService.post<{ dashboard: DashboardBoard }>('/api/users/me/dashboards', {
            name: 'Personal', context: { type: 'PERSONAL', id: null },
            widgets: legacy?.widgets ?? [], locked: legacy?.locked ?? false,
          }, true);
          if (!created.success || !created.data) throw new Error(created.error?.message ?? 'No se pudo crear tu tablero personal.');
          loaded = [normalizeBoard(created.data.dashboard)];
        }
        if (cancelled) return;
        savedLayoutsRef.current = Object.fromEntries(loaded.map((board) => [board.id, JSON.stringify({ widgets: board.widgets, locked: board.locked })]));
        const urlId = new URLSearchParams(window.location.search).get('board');
        let storedId: string | null = null;
        try { storedId = window.localStorage.getItem(`aether:active-dashboard:${userId}`); } catch { /* Use first board. */ }
        const chosen = loaded.find((board) => board.id === urlId)
          ?? loaded.find((board) => board.id === storedId) ?? loaded[0];
        setBoards(loaded);
        setActiveBoardId(chosen.id);
        setWidgets(chosen.widgets);
        setLocked(chosen.locked);
        setReadyForUser(userId);
        try { window.localStorage.setItem(`aether:active-dashboard:${userId}`, chosen.id); } catch { /* Keep the selected board in memory. */ }
        const selectedUrl = new URL(window.location.href);
        selectedUrl.searchParams.set('board', chosen.id);
        window.history.replaceState(window.history.state, '', selectedUrl);
      } catch (cause) {
        if (cancelled) return;
        setWidgets(legacy?.widgets ?? []);
        setLocked(legacy?.locked ?? false);
        setReadyForUser(userId);
        setBoardError(cause instanceof Error ? cause.message : 'No se pudieron cargar los tableros.');
      } finally {
        if (!cancelled) setBoardsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, boardsReloadKey]);

  function saveBoardSnapshot(boardId: string, nextWidgets: DashboardWidget[], nextLocked: boolean) {
    const signature = JSON.stringify({ widgets: nextWidgets, locked: nextLocked });
    const send = async () => {
      if (savedLayoutsRef.current[boardId] === signature) return true;
      const response = await apiService.patch<{ dashboard: DashboardBoard }>(`/api/users/me/dashboards/${boardId}`, { widgets: nextWidgets, locked: nextLocked }, true);
      if (!response.success) {
        setBoardError(response.error?.message ?? 'No se pudo guardar el tablero.');
        return false;
      }
      savedLayoutsRef.current[boardId] = signature;
      setBoards((current) => current.map((board) => board.id === boardId ? { ...board, widgets: nextWidgets, locked: nextLocked } : board));
      setBoardError('');
      return true;
    };
    const queued = saveQueueRef.current.then(send, send);
    saveQueueRef.current = queued;
    return queued;
  }

  useEffect(() => {
    if (!user?.id || readyForUser !== user.id || !activeBoardId) return;
    void saveBoardSnapshot(activeBoardId, fixedWidgets, locked);
  // Changes are committed at the end of a drag, resize, add, remove or lock action.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBoardId, fixedWidgets, locked, readyForUser, user?.id]);

  useEffect(() => {
    if (!activeBoardId || !needsScopedProjects) return;
    let cancelled = false;
    setScopedProjectsLoading(true);
    setScopedProjects([]);
    setScopedProjectsError(false);
    const query = new URLSearchParams({ type: boardContext.type });
    if (boardContext.id) query.set('id', boardContext.id);
    void apiService.get<{ projects: ContextProject[] }>(`/api/users/me/dashboards/projects?${query}`, true)
      .then((response) => {
        if (cancelled) return;
        if (!response.success || !response.data) throw new Error(response.error?.message ?? 'No se pudieron cargar los proyectos.');
        setScopedProjects(response.data.projects ?? []);
        setScopedProjectsScope(`${boardContext.type}:${boardContext.id ?? ''}`);
      })
      .catch(() => { if (!cancelled) { setScopedProjects([]); setScopedProjectsScope(`${boardContext.type}:${boardContext.id ?? ''}`); setScopedProjectsError(true); } })
      .finally(() => { if (!cancelled) setScopedProjectsLoading(false); });
    return () => { cancelled = true; };
  }, [activeBoardId, boardContext.type, boardContext.id, needsScopedProjects, scopedProjectsRefresh]);

  useEffect(() => {
    function finishResize(event: PointerEvent, commit: boolean) {
      const session = resizeSessionRef.current;
      if (!session || event.pointerId !== session.pointerId) return;
      resizeSessionRef.current = null;
      setResizePreviewWidgets(null);
      setResizeState(null);
      const changed = !widgetLayoutsEqual(session.originalWidgets, session.lastValidWidgets);
      if (commit && changed) setWidgets(session.lastValidWidgets);
      if (commit && !session.valid) setCanvasMessage('No hay espacio para ajustar el widget sin sacar otros del tablero.');
    }

    function handlePointerMove(event: PointerEvent) {
      const session = resizeSessionRef.current;
      if (!session || event.pointerId !== session.pointerId) return;
      event.preventDefault();
      const nextLayout = resizeWidgetLayout(
        session.originalWidgets,
        session.id,
        session.direction,
        event.clientX - session.startX,
        event.clientY - session.startY,
        { columns, cellColumns, gridRows, cellWidth, cellSize },
      );
      if (!nextLayout) {
        session.valid = false;
        setResizeState({ id: session.id, invalid: true });
        return;
      }
      session.lastValidWidgets = nextLayout;
      session.valid = true;
      setResizePreviewWidgets(nextLayout);
      setResizeState({ id: session.id, invalid: false });
    }

    function handlePointerUp(event: PointerEvent) { finishResize(event, true); }
    function handlePointerCancel(event: PointerEvent) { finishResize(event, false); }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || !resizeSessionRef.current) return;
      const session = resizeSessionRef.current;
      resizeSessionRef.current = null;
      setResizePreviewWidgets(null);
      setResizeState(null);
      try { if (session.captureTarget.hasPointerCapture(session.pointerId)) session.captureTarget.releasePointerCapture(session.pointerId); } catch { /* The pointer may already have been released. */ }
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [cellColumns, cellSize, cellWidth, columns, gridRows]);

  useEffect(() => {
    if (!canvasMessage) return;
    const timer = window.setTimeout(() => setCanvasMessage(''), 3500);
    return () => window.clearTimeout(timer);
  }, [canvasMessage]);

  useEffect(() => {
    if (!user?.id || !needsMyDayCards) {
      setMyDayLoading(false);
      return;
    }
    setMyDayLoading(true);
    setMyDayError(false);
    let active = true;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const loadCards = async () => {
      try {
        const response = await apiService.get<{ pending: MyDayCard[]; overdue: MyDayCard[] }>('/api/users/me/cards', true);
        if (!active) return;
        if (!response.success || !response.data) { setMyDayError(true); return; }
        const unique = new Map<string, MyDayCard>();
        for (const card of [...(response.data.pending ?? []), ...(response.data.overdue ?? [])]) unique.set(card.id, card);
        setMyDayCards([...unique.values()]);
        setMyDayDate(new Date());
        setMyDayError(false);
      } catch { if (active) setMyDayError(true); }
      finally { if (active) setMyDayLoading(false); }
    };
    const refresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => void loadCards(), 120);
    };
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh(); };
    const onWorkspaceInvalidate = (event: Event) => {
      if (['boards', 'all'].includes((event as CustomEvent<{ resource?: string }>).detail?.resource ?? '')) refresh();
    };
    const onBoardEvent = (event: { type?: string }) => { if (event.type?.startsWith('card.')) refresh(); };
    void loadCards();
    window.addEventListener('focus', refresh);
    window.addEventListener('aether:realtime:workspace-invalidate', onWorkspaceInvalidate);
    document.addEventListener('visibilitychange', onVisibility);
    socketService.on('event', onBoardEvent);
    return () => {
      active = false;
      if (refreshTimer) clearTimeout(refreshTimer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('aether:realtime:workspace-invalidate', onWorkspaceInvalidate);
      document.removeEventListener('visibilitychange', onVisibility);
      socketService.off('event', onBoardEvent);
    };
  }, [needsMyDayCards, myDayReloadKey, user?.id]);

  useEffect(() => { if (user?.id && (needsFollowups || needsUnreadNotifications || needsPendingActions)) void fetchNotifications(); }, [fetchNotifications, needsFollowups, needsUnreadNotifications, needsPendingActions, user?.id]);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const updateGrid = () => {
      const { width, height } = grid.getBoundingClientRect();
      if (!width || !height) return;

      const nextColumns = window.innerWidth < 600 ? 4 : window.innerWidth < 980 ? 12 : DESKTOP_COLUMNS;
      const nextCellColumns = Math.max(1, Math.floor(width / GRID_CELL_TARGET));
      const nextRows = Math.max(1, Math.floor(height / GRID_CELL_TARGET));
      const nextCellSize = height / nextRows;
      const nextCellWidth = width / nextCellColumns;

      setColumns(nextColumns);
      setCellColumns(nextCellColumns);
      setGridRows(nextRows);
      setCellSize(nextCellSize);
      setCellWidth(nextCellWidth);
      setGridMeasured(true);
    };

    updateGrid();
    const observer = new ResizeObserver(updateGrid);
    observer.observe(grid);
    window.addEventListener('resize', updateGrid);
    return () => { window.removeEventListener('resize', updateGrid); observer.disconnect(); };
  }, [gridRef]);

  useEffect(() => {
    if (!gridMeasured || !user?.id || readyForUser !== user.id || columns !== DESKTOP_COLUMNS || fixedWidgets.length < 2) return;
    const grid = { columns, cellColumns, gridRows, cellWidth, cellSize };
    const rects = fixedWidgets.map((widget) => widgetGridRect(widget, grid));
    const needsRepair = rects.some((rect, index) => !fitsGrid(rect, grid) || rects.slice(0, index).some((other) => rectanglesOverlap(rect, other)));
    if (!needsRepair) return;
    const anchor = fixedWidgets.find((widget) => widget.kind === 'calendar-planner' && fitsGrid(widgetGridRect(widget, grid), grid))
      ?? fixedWidgets.find((widget) => fitsGrid(widgetGridRect(widget, grid), grid));
    if (!anchor) return;
    const anchorRect = widgetGridRect(anchor, grid);
    const repaired = resolveDropLayout(fixedWidgets, { id: anchor.id, column: anchorRect.column, row: anchorRect.row, span: anchorRect.span, height: anchorRect.height }, grid);
    if (repaired) setWidgets(repaired);
    else setCanvasMessage('Algunos widgets se superponen. Libera espacio para poder reorganizarlos.');
  }, [cellColumns, cellSize, cellWidth, columns, fixedWidgets, gridMeasured, gridRows, readyForUser, user?.id]);

  const presentKinds = useMemo(() => new Set(widgets.map((widget) => widget.kind)), [widgets]);
  const visibleCatalog = useMemo(() => {
    const query = catalogSearch.trim().toLocaleLowerCase();
    return CATALOG.filter((item) => {
      const category = CATEGORIES.find((entry) => entry.id === item.category)?.title ?? '';
      const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
      const matchesQuery = !query || `${item.title} ${item.description} ${item.context ?? ''} ${category}`.toLocaleLowerCase().includes(query);
      return (query ? true : matchesCategory) && matchesQuery;
    });
  }, [activeCategory, catalogSearch]);
  const selectedItem = visibleCatalog.find((item) => item.kind === selectedKind) ?? visibleCatalog[0];
  const activeCategoryInfo = CATEGORIES.find((category) => category.id === activeCategory);

  function rememberBoard(id: string) {
    if (!user?.id) return;
    try { window.localStorage.setItem(`aether:active-dashboard:${user.id}`, id); } catch { /* URL still retains the selection. */ }
    const url = new URL(window.location.href);
    url.searchParams.set('board', id);
    window.history.replaceState(window.history.state, '', url);
  }

  async function selectBoard(id: string) {
    const next = boards.find((board) => board.id === id);
    if (!next) return false;
    if (next.id === activeBoardId) return true;
    if (activeBoardId && !await saveBoardSnapshot(activeBoardId, fixedWidgets, locked)) return false;
    setActiveBoardId(next.id);
    setWidgets(next.widgets);
    setLocked(next.locked);
    setPickerOpen(false);
    setActiveCategory('all');
    setCatalogSearch('');
    setScopedProjects([]);
    setCanvasMessage('');
    rememberBoard(next.id);
    return true;
  }

  async function createBoard(name: string, context: DashboardContext) {
    if (boardBusy) return false;
    setBoardBusy(true);
    setBoardError('');
    try {
      if (activeBoardId && !await saveBoardSnapshot(activeBoardId, fixedWidgets, locked)) return false;
      const initialWidgets = starterWidgets(context);
      const response = await apiService.post<{ dashboard: DashboardBoard }>('/api/users/me/dashboards', {
        name, context, widgets: initialWidgets, locked: false,
      }, true);
      if (!response.success || !response.data) throw new Error(response.error?.message ?? 'No se pudo crear el tablero.');
      const created = normalizeBoard(response.data.dashboard);
      savedLayoutsRef.current[created.id] = JSON.stringify({ widgets: created.widgets, locked: created.locked });
      setBoards((current) => [...current, created]);
      setActiveBoardId(created.id);
      setWidgets(created.widgets);
      setLocked(created.locked);
      setPickerOpen(false);
      setActiveCategory('all');
      setCatalogSearch('');
      setScopedProjects([]);
      rememberBoard(created.id);
      return true;
    } catch (cause) {
      setBoardError(cause instanceof Error ? cause.message : 'No se pudo crear el tablero.');
      return false;
    } finally { setBoardBusy(false); }
  }

  async function renameBoard(id: string, name: string) {
    setBoardBusy(true);
    setBoardError('');
    try {
      const response = await apiService.patch<{ dashboard: DashboardBoard }>(`/api/users/me/dashboards/${id}`, { name }, true);
      if (!response.success) throw new Error(response.error?.message ?? 'No se pudo cambiar el nombre.');
      setBoards((current) => current.map((board) => board.id === id ? { ...board, name } : board));
      return true;
    } catch (cause) {
      setBoardError(cause instanceof Error ? cause.message : 'No se pudo cambiar el nombre.');
      return false;
    } finally { setBoardBusy(false); }
  }

  async function deleteBoard(id: string) {
    if (boards.length < 2) return false;
    setBoardBusy(true);
    setBoardError('');
    try {
      await saveQueueRef.current;
      const response = await apiService.delete(`/api/users/me/dashboards/${id}`, true);
      if (!response.success) throw new Error(response.error?.message ?? 'No se pudo eliminar el tablero.');
      delete savedLayoutsRef.current[id];
      const remaining = boards.filter((board) => board.id !== id);
      setBoards(remaining);
      if (id === activeBoardId) {
        setActiveBoardId(remaining[0].id);
        setWidgets(remaining[0].widgets);
        setLocked(remaining[0].locked);
        setScopedProjects([]);
        rememberBoard(remaining[0].id);
      }
      setBoardError('');
      return true;
    } catch (cause) {
      setBoardError(cause instanceof Error ? cause.message : 'No se pudo eliminar el tablero.');
      return false;
    } finally { setBoardBusy(false); }
  }

  function retryBoardError() {
    if (activeBoardId) void saveBoardSnapshot(activeBoardId, fixedWidgets, locked);
    else setBoardsReloadKey((value) => value + 1);
  }

  function selectCategory(category: CatalogCategoryId | 'all') {
    setActiveCategory(category);
    setCatalogSearch('');
    setPlacementError('');
    const firstItem = CATALOG.find((item) => category === 'all' || item.category === category);
    if (firstItem) setSelectedKind(firstItem.kind);
  }

  function addWidget(kind: WidgetKind) {
    const grid = { columns, cellColumns, gridRows, cellWidth, cellSize };
    const size = widgetSizeFor(kind);
    const span = Math.max(1, Math.round((Math.min(columns, size.width) / columns) * cellColumns));
    const height = Math.max(1, Math.ceil((size.height * ROW_HEIGHT) / cellSize - 0.001));
    const occupied = fixedWidgets.map((widget) => widgetGridRect(widget, grid));
    const position = findFreeRect(span, height, occupied, grid);
    if (!position) {
      setPlacementError('No hay espacio libre suficiente. Mueve otros widgets y vuelve a intentarlo.');
      setCanvasMessage('No hay espacio libre suficiente para añadir este widget.');
      return;
    }
    const widget = { id: `${kind}-${Date.now()}`, kind, ...logicalPosition(position, grid), ...size };
    setEnteringWidgetId(widget.id);
    setWidgets((current) => [...current, widget]);
    setPickerOpen(false);
    setPlacementError('');
  }

  function startWidgetResize(id: string, direction: ResizeDirection, event: ReactPointerEvent<HTMLButtonElement>) {
    if (locked || columns !== DESKTOP_COLUMNS || resizeSessionRef.current) return;
    const widget = fixedWidgets.find((item) => item.id === id);
    if (!widget) return;
    event.preventDefault();
    event.stopPropagation();
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Window pointer listeners remain available. */ }
    resizeSessionRef.current = {
      id,
      direction,
      pointerId: event.pointerId,
      captureTarget: event.currentTarget,
      startX: event.clientX,
      startY: event.clientY,
      originalWidgets: fixedWidgets,
      lastValidWidgets: fixedWidgets,
      valid: true,
    };
    setResizePreviewWidgets(fixedWidgets);
    setResizeState({ id, invalid: false });
    setCanvasMessage('');
  }

  function handleResizeKey(id: string, direction: ResizeDirection, event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Escape') {
      event.currentTarget.blur();
      return;
    }
    const canResizeHorizontally = direction.includes('e') || direction.includes('w');
    const canResizeVertically = direction.includes('n') || direction.includes('s');
    const horizontalStep = event.key === 'ArrowRight' ? cellWidth : event.key === 'ArrowLeft' ? -cellWidth : 0;
    const verticalStep = event.key === 'ArrowDown' ? cellSize : event.key === 'ArrowUp' ? -cellSize : 0;
    if ((!canResizeHorizontally || !horizontalStep) && (!canResizeVertically || !verticalStep)) return;
    event.preventDefault();
    event.stopPropagation();
    const nextWidgets = resizeWidgetLayout(fixedWidgets, id, direction, horizontalStep, verticalStep, { columns, cellColumns, gridRows, cellWidth, cellSize });
    if (nextWidgets) {
      setWidgets(nextWidgets);
      setCanvasMessage('');
    } else setCanvasMessage('No hay espacio para ajustar el widget sin sacar otros del tablero.');
  }

  function removeWidget(id: string) { setWidgets((current) => current.filter((widget) => widget.id !== id)); }

  function calculateDropTarget(active: DragStartEvent['active'], delta: { x: number; y: number }): GridDropTarget | null {
    const widget = fixedWidgets.find((item) => item.id === String(active.id));
    if (!widget || locked || columns !== DESKTOP_COLUMNS || !cellWidth || !cellSize) return null;

    // Derive the starting cell from the saved widget layout. Dnd Kit can report
    // a missing initial DOM rect during activation; requiring it here silently
    // disables both the drop frame and live collision preview while the card
    // itself still follows the pointer.
    const grid = { columns, cellColumns, gridRows, cellWidth, cellSize };
    const start = widgetGridRect(widget, grid);
    const maxColumn = cellColumns - start.span + 1;
    const maxRow = gridRows - start.height + 1;
    if (maxColumn < 1 || maxRow < 1) return null;

    const requestedColumn = start.column + Math.round(delta.x / cellWidth);
    const requestedRow = start.row + Math.round(delta.y / cellSize);
    const column = Math.min(maxColumn, Math.max(1, requestedColumn));
    const row = Math.min(maxRow, Math.max(1, requestedRow));
    return {
      id: String(active.id), column, row, span: start.span, height: start.height,
      clamped: requestedColumn !== column || requestedRow !== row,
    };
  }

  function updateDropTarget(active: DragStartEvent['active'], delta: { x: number; y: number }) {
    const session = widgetDragSessionRef.current;
    const requested = calculateDropTarget(active, delta);
    if (!session || session.id !== String(active.id) || !requested) return;

    const previousRequest = session.lastRequested;
    if (previousRequest && previousRequest.column === requested.column && previousRequest.row === requested.row
      && previousRequest.span === requested.span && previousRequest.height === requested.height
      && previousRequest.clamped === requested.clamped) return;
    session.lastRequested = requested;

    const grid = { columns, cellColumns, gridRows, cellWidth, cellSize };
    const targetRect: GridRect = {
      id: requested.id,
      column: requested.column,
      row: requested.row,
      span: requested.span,
      height: requested.height,
    };
    const overlapsWidget = fixedWidgets.some((widget) => widget.id !== session.id
      && rectanglesOverlap(targetRect, widgetGridRect(widget, grid)));
    const blocked = requested.clamped === true || overlapsWidget;

    session.acceptedTarget = requested;
    session.blocked = blocked;

    setDropTarget((current) => current?.id === requested.id
      && current?.column === requested.column && current?.row === requested.row
      && current?.clamped === requested.clamped
      ? current : requested);
    setDragBlocked(blocked);
  }

  function handleGridPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (locked || draggingId || resizeSessionRef.current || columns !== DESKTOP_COLUMNS || event.pointerType === 'touch') {
      hoverPointerRef.current = null;
      setHoveredCell(null);
      return;
    }
    if (event.target instanceof Element && event.target.closest(`.${styles.widgetSlot}`)) {
      hoverPointerRef.current = null;
      setHoveredCell(null);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height || !cellColumns || !gridRows) return;
    const column = Math.floor(((event.clientX - rect.left) / rect.width) * cellColumns) + 1;
    const row = Math.floor(((event.clientY - rect.top) / rect.height) * gridRows) + 1;
    if (column < 1 || column > cellColumns || row < 1 || row > gridRows) {
      hoverPointerRef.current = null;
      setHoveredCell(null);
      return;
    }
    const previous = hoverPointerRef.current;
    const elapsed = previous ? Math.max(1, event.timeStamp - previous.time) : 16;
    const distance = previous ? Math.hypot(event.clientX - previous.x, event.clientY - previous.y) : 0;
    const crossedCells = previous && (Math.abs(column - previous.column) > 1 || Math.abs(row - previous.row) > 1);
    const fast = Boolean(previous && (crossedCells || distance / elapsed >= 1.2));
    hoverPointerRef.current = { x: event.clientX, y: event.clientY, time: event.timeStamp, column, row };
    setHoveredCell((current) => current?.column === column && current?.row === row
      ? current : { column, row, fast });
  }

  function handleDragStart(event: DragStartEvent) {
    if (dragMoveFrameRef.current !== null) window.cancelAnimationFrame(dragMoveFrameRef.current);
    dragMoveFrameRef.current = null;
    pendingDragMoveRef.current = null;
    widgetSettleFramesRef.current.forEach((frame) => window.cancelAnimationFrame(frame));
    widgetSettleFramesRef.current = [];
    if (widgetSettleTimerRef.current !== null) window.clearTimeout(widgetSettleTimerRef.current);
    widgetSettleTimerRef.current = null;
    hoverPointerRef.current = null;
    setHoveredCell(null);
    setWidgetSettle(null);
    setDraggingId(String(event.active.id));
    const startTarget = calculateDropTarget(event.active, { x: 0, y: 0 });
    widgetDragSessionRef.current = startTarget ? {
      id: String(event.active.id),
      startTarget,
      acceptedTarget: startTarget,
      lastRequested: null,
      blocked: false,
    } : null;
    setDragBlocked(false);
    updateDropTarget(event.active, { x: 0, y: 0 });
  }

  function handleDragMove(event: DragMoveEvent) {
    pendingDragMoveRef.current = { active: event.active, delta: event.delta };
    if (dragMoveFrameRef.current !== null) return;
    dragMoveFrameRef.current = window.requestAnimationFrame(() => {
      dragMoveFrameRef.current = null;
      const pendingMove = pendingDragMoveRef.current;
      pendingDragMoveRef.current = null;
      if (pendingMove) updateDropTarget(pendingMove.active, pendingMove.delta);
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    if (dragMoveFrameRef.current !== null) window.cancelAnimationFrame(dragMoveFrameRef.current);
    dragMoveFrameRef.current = null;
    pendingDragMoveRef.current = null;
    widgetSettleFramesRef.current.forEach((frame) => window.cancelAnimationFrame(frame));
    widgetSettleFramesRef.current = [];
    if (widgetSettleTimerRef.current !== null) window.clearTimeout(widgetSettleTimerRef.current);
    widgetSettleTimerRef.current = null;
    updateDropTarget(event.active, event.delta);
    const activeId = String(event.active.id);
    const session = widgetDragSessionRef.current;
    const activeSession = session?.id === activeId ? session : null;
    const target = activeSession
      ? activeSession.blocked ? activeSession.startTarget : activeSession.acceptedTarget
      : null;
    const nextWidgets = target && activeSession && !activeSession.blocked
      ? fixedWidgets.map((widget) => widget.id === activeId
        ? { ...widget, ...logicalPosition(target, { columns, cellColumns, gridRows, cellWidth, cellSize }) }
        : widget)
      : null;
    if (target) {
      const grid = gridRef.current;
      const initialRect = event.active.rect.current.initial;
      const finalDelta = event.delta;
      if (grid && initialRect && !prefersReducedMotion) {
        const rect = grid.getBoundingClientRect();
        const cellWidth = rect.width / cellColumns;
        const cellHeight = rect.height / gridRows;
        const targetLeft = rect.left + (target.column - 1) * cellWidth + WIDGET_SLOT_INSET;
        const targetTop = rect.top + (target.row - 1) * cellHeight + WIDGET_SLOT_INSET;
        const scaleOffsetX = (initialRect.width * (1 - WIDGET_DRAG_SCALE)) / 2;
        const scaleOffsetY = (initialRect.height * (1 - WIDGET_DRAG_SCALE)) / 2;
        const settleX = initialRect.left + finalDelta.x + scaleOffsetX - targetLeft;
        const settleY = initialRect.top + finalDelta.y + scaleOffsetY - targetTop;

        if (Math.abs(settleX) > 0.5 || Math.abs(settleY) > 0.5) {
          setWidgetSettle({ id: activeId, x: settleX, y: settleY, phase: 'prepare' });
          const firstFrame = window.requestAnimationFrame(() => {
            const secondFrame = window.requestAnimationFrame(() => {
              widgetSettleFramesRef.current = [];
              setWidgetSettle((current) => current?.id === activeId ? { ...current, phase: 'animate' } : current);
              widgetSettleTimerRef.current = window.setTimeout(() => {
                widgetSettleTimerRef.current = null;
                setWidgetSettle((current) => current?.id === activeId ? null : current);
              }, 240);
            });
            widgetSettleFramesRef.current = [secondFrame];
          });
          widgetSettleFramesRef.current = [firstFrame];
        } else {
          setWidgetSettle(null);
        }
      }
      if (nextWidgets) setWidgets(nextWidgets);
      setCanvasMessage('');
    } else if (activeSession) {
      setWidgetSettle(null);
    }
    widgetDragSessionRef.current = null;
    setDragBlocked(false);
    setDraggingId(null);
    setDropTarget(null);
  }

  function handleDragCancel() {
    if (dragMoveFrameRef.current !== null) window.cancelAnimationFrame(dragMoveFrameRef.current);
    dragMoveFrameRef.current = null;
    pendingDragMoveRef.current = null;
    widgetSettleFramesRef.current.forEach((frame) => window.cancelAnimationFrame(frame));
    widgetSettleFramesRef.current = [];
    if (widgetSettleTimerRef.current !== null) window.clearTimeout(widgetSettleTimerRef.current);
    widgetSettleTimerRef.current = null;
    widgetDragSessionRef.current = null;
    setDragBlocked(false);
    setDraggingId(null);
    setWidgetSettle(null);
    setDropTarget(null);
  }

  const gridClass = `${styles.grid} ${locked ? styles.locked : styles.editable} ${draggingId ? styles.dragActive : ''} ${dragBlocked ? styles.dragBlocked : ''} ${resizeState ? styles.gridResizing : ''}`;
  const highlight = !draggingId && hoveredCell ? { ...hoveredCell, span: 1, height: 1 } : null;
  const highlightStyle = highlight ? {
    left: 0,
    top: 0,
    width: `${cellWidth}px`,
    height: `${cellSize}px`,
    transform: `translate3d(${(highlight.column - 1) * cellWidth}px, ${(highlight.row - 1) * cellSize}px, 0) scale(.9)`,
  } as React.CSSProperties : undefined;
  const dropPreviewStyle = dropTarget ? {
    left: 0,
    top: 0,
    width: `${(dropTarget.span / cellColumns) * 100}%`,
    height: `${(dropTarget.height / gridRows) * 100}%`,
    transform: `translate3d(${(dropTarget.column - 1) * cellWidth}px, ${(dropTarget.row - 1) * cellSize}px, 0)`,
  } as React.CSSProperties : undefined;

  return (
    <DndContext sensors={sensors} collisionDetection={dashboardCollision} onDragStart={handleDragStart} onDragMove={handleDragMove} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
    <main className={styles.page}>
      {sidebarControlsHost && createPortal(<div className={styles.sidebarControls}>
        <DashboardBoardControls
          boards={boards} activeId={activeBoardId} organizations={organizations} workspaces={workspaces}
          activeOrganizationId={organization?.id ?? null} activeWorkspaceId={activeWorkspaceId}
          loading={boardsLoading} busy={boardBusy} error={boardError} onRetry={retryBoardError}
          onSelect={selectBoard} onCreate={createBoard} onRename={renameBoard} onDelete={deleteBoard}
        />
        <div className={styles.sidebarTools} aria-label="Controles de la cuadrícula">
        <button type="button" className={styles.toolButton} onClick={() => setPickerOpen((open) => !open)} disabled={locked || boardsLoading || !activeBoardId} aria-label="Añadir widget" aria-expanded={pickerOpen} title="Añadir widget">
          <Plus size={19} strokeWidth={1.9} />
        </button>
        <button type="button" className={`${styles.toolButton} ${locked ? styles.toolActive : ''}`} onClick={() => { setLocked((value) => !value); setPickerOpen(false); }} disabled={boardsLoading || !activeBoardId} aria-label={locked ? 'Desbloquear cuadrícula' : 'Bloquear cuadrícula'} aria-pressed={locked} title={locked ? 'Desbloquear cuadrícula' : 'Bloquear cuadrícula'}>
          {locked ? <LockKeyhole size={18} strokeWidth={1.8} /> : <UnlockKeyhole size={18} strokeWidth={1.8} />}
        </button>
        </div>
      </div>, sidebarControlsHost)}

      {canvasMessage && <div className={styles.canvasNotice} role="status">{canvasMessage}</div>}

      {pickerOpen && !locked && <section className={styles.picker} aria-label="Catálogo de funciones">
        <div className={styles.catalogHeader}>
          <div className={styles.pickerHeading}><strong>Añadir al tablero</strong><span>Elige una función para este contexto.</span></div>
          <button type="button" className={styles.iconButton} onClick={() => setPickerOpen(false)} aria-label="Cerrar catálogo"><X size={17} /></button>
        </div>
        <label className={styles.catalogSearch}>
          <Search size={16} aria-hidden="true" />
          <input value={catalogSearch} onChange={(event) => setCatalogSearch(event.target.value)} placeholder="Buscar funciones o secciones" aria-label="Buscar funciones o secciones" />
          {catalogSearch && <button type="button" onClick={() => setCatalogSearch('')} aria-label="Limpiar búsqueda"><X size={14} /></button>}
        </label>
        <div className={styles.catalogLayout}>
          <nav className={styles.categoryNav} aria-label="Categorías del catálogo">
            <button type="button" className={`${styles.categoryButton} ${activeCategory === 'all' ? styles.categoryActive : ''}`} onClick={() => selectCategory('all')}>
              <LayoutDashboard size={16} /><span>Todo el catálogo</span><small>{CATALOG.length}</small>
            </button>
            {CATEGORIES.filter((category) => CATALOG.some((item) => item.category === category.id)).map((category) => {
              const count = CATALOG.filter((item) => item.category === category.id).length;
              return <button key={category.id} type="button" className={`${styles.categoryButton} ${activeCategory === category.id ? styles.categoryActive : ''}`} onClick={() => selectCategory(category.id)} aria-pressed={activeCategory === category.id}>
                {categoryIcon(category.id, 16)}<span>{category.title}</span><small>{count}</small>
              </button>;
            })}
          </nav>

          <section className={styles.catalogResults} aria-live="polite">
            <div className={styles.resultsHeading}>
              <strong>{catalogSearch.trim() ? 'Resultados' : activeCategoryInfo?.title ?? 'Todas las funciones'}</strong>
              <span>{visibleCatalog.length} {visibleCatalog.length === 1 ? 'función' : 'funciones'}</span>
            </div>
            {visibleCatalog.length > 0 ? <div className={styles.featureList}>
              {visibleCatalog.map((item) => {
                const isAdded = presentKinds.has(item.kind);
                const isSelected = selectedItem?.kind === item.kind;
                return <div key={item.kind} className={styles.featureRow}>
                  <button type="button" className={`${styles.featureOption} ${isSelected ? styles.featureSelected : ''} ${isMyDayKind(item.kind) ? styles.dayFeatureOption : ''}`} data-kind={item.kind} onClick={() => { setSelectedKind(item.kind); setPlacementError(''); }} aria-pressed={isSelected}>
                    {isMyDayKind(item.kind) ? <span className={styles.dayCatalogMark} aria-hidden="true">{item.kind === 'today-priorities' ? '01' : item.kind === 'today-due' ? <CalendarDays size={17} /> : item.kind === 'today-overdue' ? <Clock3 size={17} /> : <MessageCircle size={17} />}</span> : <span className={styles.catalogIcon}>{iconFor(item.kind, 17)}</span>}
                    <span className={styles.featureCopy}><strong>{item.title}</strong><small>{item.description}</small>{!isMyDayKind(item.kind) && <em>{catalogCategoryTitle(item.category)}{item.context ? ` · ${item.context}` : ''}</em>}</span>
                    <ArrowRight className={styles.featureArrow} size={15} />
                  </button>
                  <button type="button" className={styles.featureAddSmall} disabled={isAdded} onClick={() => addWidget(item.kind)} aria-label={isAdded ? `${item.title} ya está en tu espacio` : `Añadir ${item.title}`} title={isAdded ? 'Ya está añadido' : 'Añadir función'}>
                    {isAdded ? <Check size={15} /> : <Plus size={15} />}
                  </button>
                </div>;
              })}
            </div> : <div className={styles.catalogEmpty}><Search size={18} /><strong>No encontramos esa función</strong><span>Prueba con otro nombre o sección.</span></div>}
          </section>

          {selectedItem && <aside className={`${styles.featureDetail} ${isMyDayKind(selectedItem.kind) ? styles.dayFeatureDetail : ''}`} data-kind={selectedItem.kind} aria-label={`Vista previa de ${selectedItem.title}`}>
            <span className={styles.detailEyebrow}>{catalogCategoryTitle(selectedItem.category)}{selectedItem.context ? ` · ${selectedItem.context}` : ''}</span>
            {!isMyDayKind(selectedItem.kind) && <span className={styles.detailIcon}>{iconFor(selectedItem.kind, 21)}</span>}
            <h3>{selectedItem.title}</h3>
            <p>{selectedItem.description}</p>
            <div className={styles.detailPreview}>
              <span>Así aparecerá</span>
              {selectedItem.kind === 'quick-links' ? <div className={styles.linksPreview}>
                <span><FolderKanban size={13} /><b>Proyectos</b></span>
                <span><CalendarDays size={11} /><b>Calendario</b></span>
                <span><FileText size={11} /><b>Documentos</b></span>
            </div> : selectedItem.kind === 'calendar-planner' ? <div className={styles.calendarPreview} aria-hidden="true"><span><i /><i /><i /><i /><i /><i /><i /></span><b><i /><i /><i /></b><b><i /><i /></b><b><i /><i /><i /></b></div> : selectedItem.kind === 'calendar-upcoming' ? <UpcomingEventsCatalogPreview /> : selectedItem.kind === 'calendar-week' ? <WeekAgendaCatalogPreview /> : selectedItem.kind === 'documents-recent' ? <DocumentsRecentCatalogPreview /> : selectedItem.kind === 'documents-shared' ? <DocumentsSharedCatalogPreview /> : selectedItem.kind === 'notifications-unread' ? <NotificationsUnreadCatalogPreview /> : selectedItem.kind === 'notifications-actions' ? <NotificationsActionsCatalogPreview /> : selectedItem.kind === 'contacts-online' ? <ContactsOnlineCatalogPreview /> : selectedItem.kind === 'contacts-recent' ? <RecentConversationsCatalogPreview /> : selectedItem.kind === 'team-members' ? <TeamMembersCatalogPreview /> : selectedItem.kind === 'team-activity' ? <TeamActivityCatalogPreview /> : selectedItem.kind === 'organization-workspaces' ? <OrganizationWorkspacesCatalogPreview /> : selectedItem.kind === 'organization-invitations' ? <OrganizationInvitationsCatalogPreview /> : selectedItem.kind === 'organization-members' ? <OrganizationMembersCatalogPreview /> : selectedItem.kind === 'organization-overview' ? <OrganizationOverviewCatalogPreview /> : selectedItem.kind === 'project-active' ? <ProjectPortfolioPreview projects={scopedProjectsScope === boardScopeKey ? scopedProjects : projects} /> : isProjectInsightKind(selectedItem.kind) ? <ProjectWidgetCatalogPreview kind={selectedItem.kind} /> : isMyDayKind(selectedItem.kind) ? <MyDayCatalogPreview kind={selectedItem.kind} /> : isBoardWidgetKind(selectedItem.kind) ? <BoardWidgetCatalogPreview kind={selectedItem.kind} /> : <><div><i>{iconFor(selectedItem.kind, 14)}</i><strong>{selectedItem.title}</strong></div>
                <small>{selectedItem.href ? `Acceso directo a ${catalogCategoryTitle(selectedItem.category)}` : 'Acción disponible desde cualquier sección'}</small></>}
            </div>
            <button type="button" className={styles.addFeatureButton} disabled={presentKinds.has(selectedItem.kind)} onClick={() => addWidget(selectedItem.kind)}>
              {presentKinds.has(selectedItem.kind) ? <><Check size={16} /> Ya está en tu espacio</> : <><Plus size={16} /> Añadir función</>}
            </button>
            {placementError && <small className={styles.placementError} role="alert">{placementError}</small>}
            <small className={styles.detailHint}>En el tablero podrás moverlo y ajustar su tamaño desde los bordes.</small>
          </aside>}
        </div>
      </section>}

      <div className={styles.canvasFrame}>
        <div ref={setGridDropRef} className={gridClass} data-columns={columns} onPointerMove={handleGridPointerMove} onPointerLeave={() => { hoverPointerRef.current = null; setHoveredCell(null); }} style={{ '--grid-columns': cellColumns, '--grid-rows': gridRows, '--grid-cell-size': `${cellSize}px`, '--grid-cell-width': `${cellWidth}px` } as React.CSSProperties}>
          <div className={styles.cellLayer} aria-hidden="true">
            {highlight && <span className={`${styles.gridCellHighlight} ${styles.gridCellHover} ${hoveredCell?.fast ? styles.gridCellHoverFast : ''}`} style={highlightStyle} />}
          </div>
          {draggingId && dropTarget && <span className={`${styles.gridDropTarget} ${dragBlocked ? styles.gridDropTargetInvalid : ''}`} style={dropPreviewStyle} aria-hidden="true" />}
          <AnimatePresence initial={false}>
            {!boardsLoading && activeBoardId && displayWidgets.length === 0 && <motion.div
              key="empty-board"
              className={styles.boardEmpty}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: prefersReducedMotion ? .08 : .18, ease: [0.16, 1, 0.3, 1] }}
            >
              <LayoutDashboard size={23} aria-hidden="true" />
              <strong>Un tablero a tu medida</strong>
              <span>Añade las funciones que quieres ver en este contexto.</span>
              <button type="button" onClick={() => setPickerOpen(true)} disabled={locked}><Plus size={15} /> Añadir primer widget</button>
            </motion.div>}
          </AnimatePresence>
          <AnimatePresence initial={false}>
          {(() => {
            let stackedRow = 1;
            return displayWidgets.map((widget) => {
            const positionWidget = draggingId === widget.id ? fixedWidgets.find((item) => item.id === widget.id) ?? widget : widget;
            const row = columns < DESKTOP_COLUMNS ? stackedRow : positionWidget.row;
            if (columns < DESKTOP_COLUMNS) stackedRow += positionWidget.height;
            const span = Math.max(1, Math.round((Math.min(columns, positionWidget.width) / columns) * cellColumns));
            const column = Math.min(cellColumns - span + 1, Math.max(1, Math.round(((positionWidget.column - 1) / columns) * cellColumns) + 1));
            const gridRow = Math.max(1, Math.round(((row - 1) * ROW_HEIGHT) / cellSize) + 1);
            const requestedHeight = Math.max(1, Math.ceil((positionWidget.height * ROW_HEIGHT) / cellSize - 0.001));
            const gridHeight = widget.kind === 'calendar-planner' && columns < DESKTOP_COLUMNS
              ? Math.min(requestedHeight, gridRows)
              : requestedHeight;
            const style = {
              gridColumn: `${column} / span ${span}`,
              gridRow: `${gridRow} / span ${gridHeight}`,
            } as React.CSSProperties;
            return <DashboardWidgetCard key={widget.id} id={widget.id} kind={widget.kind} title={titleFor(widget.kind)} style={style} disabled={locked || columns < DESKTOP_COLUMNS} dragging={draggingId === widget.id} dragActive={Boolean(draggingId)} resizing={resizeState?.id === widget.id} resizeInvalid={resizeState?.id === widget.id && resizeState.invalid} settle={widgetSettle?.id === widget.id ? widgetSettle : null} prefersReducedMotion={Boolean(prefersReducedMotion)} animateOnAdd={enteringWidgetId === widget.id} onEntryAnimationComplete={() => setEnteringWidgetId((current) => current === widget.id ? null : current)} onResizeStart={(direction, event) => startWidgetResize(widget.id, direction, event)} onResizeKey={(direction, event) => handleResizeKey(widget.id, direction, event)} onRemove={() => removeWidget(widget.id)}>
              {renderWidget(widget.kind, {
                projects: widgetProjects, projectWidgetData, contactWidgetData,
                context: boardContext, scopedProjects: scopedProjectsScope === boardScopeKey ? scopedProjects : [],
                scopedProjectsLoading: scopedProjectsLoading || scopedProjectsScope !== boardScopeKey, scopedProjectsError,
                onRetryScopedProjects: () => setScopedProjectsRefresh((value) => value + 1),
                workspaceId: boardWorkspaceId, myDayGroups, myDayCards, myDayLoading, myDayError,
                onRetryMyDayCards: () => setMyDayReloadKey((key) => key + 1), followups,
                organization: boardOrganization, onSelectWorkspace, onCreateWorkspace,
              })}
            </DashboardWidgetCard>;
            });
          })()}
          </AnimatePresence>
        </div>
      </div>
    </main>
    </DndContext>
  );
}

function DashboardWidgetCard({ id, kind, title, style, disabled, dragging, dragActive, resizing, resizeInvalid, settle, prefersReducedMotion, animateOnAdd, onEntryAnimationComplete, onResizeStart, onResizeKey, onRemove, children }: {
  id: string;
  kind: WidgetKind;
  title: string;
  style: React.CSSProperties;
  disabled: boolean;
  dragging: boolean;
  dragActive: boolean;
  resizing: boolean;
  resizeInvalid: boolean;
  settle: WidgetSettle | null;
  prefersReducedMotion: boolean;
  animateOnAdd: boolean;
  onEntryAnimationComplete: () => void;
  onResizeStart: (direction: ResizeDirection, event: ReactPointerEvent<HTMLButtonElement>) => void;
  onResizeKey: (direction: ResizeDirection, event: ReactKeyboardEvent<HTMLButtonElement>) => void;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  const isPresent = useIsPresent();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform } = useDraggable({ id, disabled });
  const cardTranslation = transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined;
  const cardTransform = dragging ? cardTranslation ?? 'translate3d(0, 0, 0)' : cardTranslation;
  const cardScale = dragging && !prefersReducedMotion ? WIDGET_DRAG_SCALE : settle?.phase === 'prepare' && !prefersReducedMotion ? WIDGET_DRAG_SCALE : undefined;
  const settleTransform = settle?.phase === 'prepare'
    ? `translate3d(${settle.x}px, ${settle.y}px, 0)`
    : settle?.phase === 'animate' && !prefersReducedMotion ? 'translate3d(0, 0, 0)' : undefined;
  const settleClass = settle?.phase === 'prepare' ? styles.widgetSettlePrepare : settle?.phase === 'animate' ? styles.widgetSettling : '';
  const isGeneralWidget = kind === 'quick-links';
  const isCustomWidget = isGeneralWidget || isMyDayKind(kind) || kind === 'calendar-planner' || kind === 'calendar-upcoming' || kind === 'calendar-week' || kind === 'documents-recent' || kind === 'documents-shared' || kind === 'notifications-unread' || kind === 'notifications-actions' || kind === 'contacts-online' || kind === 'contacts-recent' || kind === 'team-members' || kind === 'team-activity' || kind === 'organization-workspaces' || kind === 'organization-invitations' || kind === 'organization-members' || kind === 'organization-overview' || kind === 'organization-project-status' || kind === 'project-active' || kind === 'scrum-current' || kind === 'scrum-progress' || isProjectInsightKind(kind);

  return <motion.div
    layout={prefersReducedMotion || dragging || Boolean(settle) ? false : 'position'}
    initial={animateOnAdd ? prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: .965, y: 8 } : false}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: .975, y: -4 }}
    transition={{
      opacity: { duration: prefersReducedMotion ? .08 : .17, ease: 'easeOut' },
      scale: { duration: prefersReducedMotion ? .08 : .24, ease: [0.16, 1, 0.3, 1] },
      y: { duration: prefersReducedMotion ? .08 : .24, ease: [0.16, 1, 0.3, 1] },
      layout: dragActive ? { type: 'spring', stiffness: 760, damping: 52, mass: 0.55 } : { duration: 0.16, ease: [0.16, 1, 0.3, 1] },
    }}
    aria-hidden={!isPresent}
    className={`${styles.widgetSlot} ${dragging ? styles.widgetSlotDragging : ''} ${resizing ? styles.widgetSlotResizing : ''}`}
    style={{ ...style, pointerEvents: isPresent ? undefined : 'none', transformOrigin: isPresent ? 'center center' : 'top right' }}
    onAnimationComplete={() => { if (animateOnAdd) onEntryAnimationComplete(); }}
  >
    <article ref={setNodeRef} data-kind={kind} data-resize-invalid={resizeInvalid || undefined} className={`${styles.widget} ${kind === 'quick-links' ? styles.widgetQuickLinks : ''} ${isMyDayKind(kind) ? styles.widgetMyDay : ''} ${kind === 'calendar-planner' ? styles.widgetCalendar : ''} ${kind === 'calendar-upcoming' ? styles.widgetUpcoming : ''} ${kind === 'calendar-week' ? styles.widgetWeekAgenda : ''} ${kind === 'documents-recent' ? styles.widgetDocuments : ''} ${kind === 'documents-shared' ? styles.widgetDocumentsShared : ''} ${kind === 'notifications-unread' ? styles.widgetNotificationsUnread : ''} ${kind === 'project-active' ? styles.widgetProject : ''} ${disabled ? styles.widgetReadOnly : ''} ${dragging ? styles.dragging : ''} ${resizing ? styles.resizing : ''} ${settleClass}`} style={{ transform: dragging ? cardTransform : settleTransform, scale: cardScale }} aria-label={isCustomWidget ? title : undefined}>
      {isCustomWidget ? <>
        <div className={`${styles.widgetBody} ${kind === 'quick-links' ? styles.quickLinksBody : kind === 'calendar-planner' ? styles.calendarWidgetBody : kind === 'calendar-upcoming' ? styles.upcomingEventsBody : kind === 'calendar-week' ? styles.weekAgendaBody : kind === 'documents-recent' ? styles.documentsWidgetBody : kind === 'documents-shared' ? styles.documentsSharedWidgetBody : kind === 'notifications-unread' ? styles.notificationsUnreadWidgetBody : kind === 'contacts-online' || kind === 'contacts-recent' ? styles.contactsWidgetBody : kind === 'team-members' ? styles.teamMembersBody : kind === 'team-activity' ? styles.teamActivityBody : kind === 'organization-workspaces' ? styles.organizationWorkspacesBody : kind === 'organization-invitations' ? styles.organizationInvitationsBody : kind === 'project-active' ? styles.projectWidgetBody : kind === 'scrum-current' ? styles.scrumCurrentWidgetBody : kind === 'scrum-progress' ? styles.scrumProgressWidgetBody : styles.myDayBody}`}>{children}</div>
      </> : <>
        <div className={`${styles.widgetHeader} ${!disabled ? styles.widgetHeaderWithActions : ''}`}>
          <h2>{title}</h2>
        </div>
        <div className={`${styles.widgetBody} ${kind === 'board-my-cards' ? styles.openCardsWidgetBody : ''} ${kind === 'board-blocked' ? styles.blockedCardsWidgetBody : ''} ${kind === 'board-unassigned' ? styles.unassignedCardsWidgetBody : ''}`}>{children}</div>
      </>}
    </article>
    {!disabled && <div className={[styles.widgetActions, styles.widgetControlPill, settleClass].filter(Boolean).join(' ')} style={{ transform: dragging ? cardTransform : settleTransform }}>
      <button ref={setActivatorNodeRef} type="button" className={styles.widgetActionButton} {...attributes} {...listeners} aria-label={`Mover widget ${title}`} title="Arrastra para mover"><GripVertical size={15} /></button>
      <button type="button" className={styles.widgetActionButton} onClick={onRemove} aria-label={`Quitar ${title}`} title="Quitar widget"><X size={15} /></button>
    </div>}
    {!disabled && <div className={styles.resizeHandles} aria-label={`Controles de tamaño de ${title}`}>
      {RESIZE_HANDLES.map(({ direction, edge }) => <button key={direction} type="button" data-direction={direction} className={styles.resizeHandle} aria-label={`Cambiar tamaño de ${title}, ${edge}`} title="Arrastra para ajustar · usa las flechas del teclado para afinar" onPointerDown={(event) => onResizeStart(direction, event)} onKeyDown={(event) => onResizeKey(direction, event)} />)}
    </div>}
  </motion.div>;
}

function renderWidget(kind: WidgetKind, { projects, projectWidgetData, contactWidgetData, context, scopedProjects, scopedProjectsLoading, scopedProjectsError, onRetryScopedProjects, workspaceId, myDayGroups, myDayCards, myDayLoading, myDayError, onRetryMyDayCards, followups, organization, onSelectWorkspace, onCreateWorkspace }: {
  projects: SidebarProject[];
  projectWidgetData: ReturnType<typeof useProjectDashboardData>;
  contactWidgetData: ReturnType<typeof useContactWidgetData>;
  context: DashboardContext;
  scopedProjects: ContextProject[];
  scopedProjectsLoading: boolean;
  scopedProjectsError: boolean;
  onRetryScopedProjects: () => void;
  workspaceId: string | null;
  myDayGroups: MyDayGroups;
  myDayCards: MyDayCard[];
  myDayLoading: boolean;
  myDayError: boolean;
  onRetryMyDayCards: () => void;
  followups: Notification[];
  organization: { id: string; name: string; type: string; role?: string; workspaceCount?: number; memberCount?: number } | null;
  onSelectWorkspace?: (workspaceId: string) => void;
  onCreateWorkspace?: (organizationId: string) => void;
}) {
  switch (kind) {
    case 'quick-links':
      return <nav className={styles.shortcutDeck} aria-label="Accesos del dashboard">
        <Link className={styles.shortcutRoute} href="/dashboard/projects">
          <span className={styles.shortcutIcon}><FolderKanban size={14} aria-hidden="true" /></span>
          <span className={styles.shortcutCopy}><span className={styles.shortcutName}>Proyectos</span><span className={styles.shortcutHint}>Iniciativas</span></span>
          <ArrowRight className={styles.shortcutArrow} size={13} aria-hidden="true" />
        </Link>
        <Link className={styles.shortcutRoute} href="/dashboard/calendar">
          <span className={styles.shortcutIcon}><CalendarDays size={14} aria-hidden="true" /></span>
          <span className={styles.shortcutCopy}><span className={styles.shortcutName}>Calendario</span><span className={styles.shortcutHint}>Agenda</span></span>
          <ArrowRight className={styles.shortcutArrow} size={13} aria-hidden="true" />
        </Link>
        <Link className={styles.shortcutRoute} href="/dashboard/documents">
          <span className={styles.shortcutIcon}><FileText size={14} aria-hidden="true" /></span>
          <span className={styles.shortcutCopy}><span className={styles.shortcutName}>Documentos</span><span className={styles.shortcutHint}>Archivos</span></span>
          <ArrowRight className={styles.shortcutArrow} size={13} aria-hidden="true" />
        </Link>
      </nav>;
    case 'calendar-planner':
      return <CalendarDashboardWidget />;
    case 'calendar-upcoming':
      return <UpcomingEventsWidget />;
    case 'calendar-week':
      return <WeekAgendaWidget />;
    case 'documents-recent':
      return <DocumentsRecentWidget workspaceId={workspaceId} projects={projects} />;
    case 'documents-shared':
      return <DocumentsSharedWidget workspaceId={workspaceId} projects={projects} />;
    case 'today-priorities':
    case 'today-due':
    case 'today-overdue':
    case 'today-followups':
      return <MyDayWidget kind={kind} groups={myDayGroups} loading={myDayLoading} error={myDayError} followups={followups} />;
    case 'board-my-cards':
      return <MyOpenCardsWidget cards={myDayCards} loading={myDayLoading} error={myDayError} onRetry={onRetryMyDayCards} />;
    case 'board-blocked':
      return <BlockedCardsWidget cards={myDayCards} loading={myDayLoading} error={myDayError} onRetry={onRetryMyDayCards} />;
    case 'board-unassigned':
      return <UnassignedCardsWidget workspaceId={workspaceId} />;
    case 'scrum-current':
      return <CurrentSprintWidget workspaceId={workspaceId} />;
    case 'scrum-progress':
      return <SprintProgressWidget workspaceId={workspaceId} />;
    case 'project-active':
      return <ContextProjectsWidget context={context} projects={scopedProjects} loading={scopedProjectsLoading} error={scopedProjectsError} onRetry={onRetryScopedProjects} />;
    case 'project-tasks':
      return <ProjectTasksWidget data={projectWidgetData.tasks} onRetry={projectWidgetData.retry} />;
    case 'project-milestones':
      return <ProjectMilestonesWidget data={projectWidgetData.milestones} onRetry={projectWidgetData.retry} />;
    case 'project-activity':
      return <ProjectActivityWidget data={projectWidgetData.activity} onRetry={projectWidgetData.retry} />;
    case 'project-members':
      return <ProjectMembersWidget data={projectWidgetData.people} onRetry={projectWidgetData.retry} />;
    case 'notifications-unread':
      return <NotificationsUnreadWidget />;
    case 'notifications-actions':
      return <NotificationsActionsWidget />;
    case 'contacts-online':
      return <ContactsOnlineWidget data={contactWidgetData} />;
    case 'contacts-recent':
      return <RecentConversationsWidget data={contactWidgetData} />;
    case 'team-members':
      return <TeamMembersWidget workspaceId={workspaceId} />;
    case 'team-activity':
      return <TeamActivityWidget workspaceId={workspaceId} />;
    case 'organization-workspaces':
      return <OrganizationWorkspacesWidget organization={organization} onSelectWorkspace={onSelectWorkspace} onCreateWorkspace={onCreateWorkspace} />;
    case 'organization-invitations':
      return <OrganizationInvitationsWidget organization={organization} />;
    case 'organization-members':
      return <OrganizationMembersWidget organization={organization} />;
    case 'organization-overview':
      return <OrganizationOverviewWidget organization={organization} projects={scopedProjects} loading={scopedProjectsLoading} error={scopedProjectsError} onRetry={onRetryScopedProjects} />;
    case 'organization-project-status':
      return <OrganizationProjectStatusWidget projects={scopedProjects} loading={scopedProjectsLoading} error={scopedProjectsError} onRetry={onRetryScopedProjects} />;
    default: {
      const item = catalogItemFor(kind);
      return <><p>{item?.description ?? 'Abre esta función para continuar.'}</p>{item?.href && <Link className={styles.textLink} href={item.href}>Abrir {catalogCategoryTitle(item.category)} <ArrowRight size={14} aria-hidden="true" /></Link>}</>;
    }
  }
}

function cardHref(card: MyDayCard) {
  return `/dashboard/boards/${card.boardId}?cardId=${encodeURIComponent(card.id)}`;
}

function followupHref(notification: Notification) {
  if (notification.type === 'DOCUMENT_MENTION' && notification.data?.documentId) return `/dashboard/documents/${notification.data.documentId}`;
  if (notification.data?.boardId && notification.data?.cardId) return `/dashboard/boards/${notification.data.boardId}?cardId=${encodeURIComponent(notification.data.cardId)}`;
  return '/dashboard/notifications';
}

function MyDayWidget({ kind, groups, loading, error, followups }: {
  kind: 'today-priorities' | 'today-due' | 'today-overdue' | 'today-followups';
  groups: MyDayGroups;
  loading: boolean;
  error: boolean;
  followups: Notification[];
}) {
  const date = new Date();
  const priorities = [...groups.overdue, ...groups.today, ...groups.unscheduled].sort((left, right) =>
    ({ HIGH: 0, MEDIUM: 1, LOW: 2 })[left.priority ?? 'LOW'] - ({ HIGH: 0, MEDIUM: 1, LOW: 2 })[right.priority ?? 'LOW']);
  const status = loading ? 'Buscando tus tareas…' : error ? 'No se pudieron cargar tus tareas.' : '';

  if (kind === 'today-priorities') return <section className={styles.dayPriorities} aria-label="Prioridades de hoy">
    <div className={styles.dayPriorityIndex}><span>HOY</span><b>{String(priorities.length).padStart(2, '0')}</b><i /></div>
    <div className={styles.dayPriorityContent}>
      <span className={styles.dayTinyLabel}>EN FOCO</span>
      {status ? <p className={styles.dayEmpty}>{status}</p> : priorities.length ? <>
        <Link href={cardHref(priorities[0])} className={styles.dayPriorityLead}><span>{priorities[0].title}</span><ArrowRight size={15} /></Link>
        <span className={styles.dayPriorityMeta}>{priorities[0].boardName}{priorities[0].dueDate ? ` · ${groups.overdue.some((card) => card.id === priorities[0].id) ? 'Vencida' : 'Hoy'}` : ''}</span>
        <div className={styles.dayPriorityMore}>{priorities.slice(1, 3).map((card) => <Link key={card.id} href={cardHref(card)}><i /><span>{card.title}</span></Link>)}</div>
      </> : <p className={styles.dayEmpty}>Todo despejado por ahora.</p>}
    </div>
  </section>;

  if (kind === 'today-due') return <section className={styles.dayDue} aria-label="Tareas que vencen hoy">
    <div className={styles.dayDateRail}><span>{date.toLocaleDateString('es', { weekday: 'short' }).replace('.', '').toUpperCase()}</span><strong>{date.getDate()}</strong><span>{date.toLocaleDateString('es', { month: 'short' }).replace('.', '').toUpperCase()}</span></div>
    <div className={styles.dayDueContent}><span className={styles.dayTinyLabel}>VENCEN HOY <b>{groups.today.length}</b></span>
      {status ? <p className={styles.dayEmpty}>{status}</p> : groups.today.length ? <div className={styles.dayDueList}>{groups.today.slice(0, 3).map((card) => <Link key={card.id} href={cardHref(card)}><i /><span>{card.title}<small>{card.boardName}</small></span></Link>)}</div> : <p className={styles.dayEmpty}>Sin entregas para hoy.</p>}
    </div>
  </section>;

  if (kind === 'today-overdue') return <section className={styles.dayOverdue} aria-label="Pendientes vencidos">
    <div className={styles.dayOverdueTop}><span>Pendientes vencidos</span><strong>{groups.overdue.length}</strong></div>
    {status ? <p className={styles.dayEmpty}>{status}</p> : groups.overdue.length ? <div className={styles.dayOverdueList}>{groups.overdue.slice(0, 2).map((card) => <Link key={card.id} href={cardHref(card)}><span>{card.title}</span><ArrowRight size={13} /></Link>)}</div> : <p className={styles.dayEmpty}>Nada pendiente fuera de plazo.</p>}
  </section>;

  return <section className={styles.dayFollowups} aria-label="Seguimientos abiertos">
    <div className={styles.dayFollowupTop}><span>Menciones pendientes</span><strong>{followups.length}</strong></div>
    {followups.length ? <div className={styles.dayFollowupList}>{followups.slice(0, 2).map((notification) => <Link key={notification.id} href={followupHref(notification)}><i /><span><b>{notification.title}</b><small>{notification.message}</small></span></Link>)}</div> : <p className={styles.dayEmpty}>Estás al día con tus menciones.</p>}
  </section>;
}

function MyDayCatalogPreview({ kind }: { kind: WidgetKind }) {
  return <div className={styles.dayPreview} data-kind={kind} aria-hidden="true">
    {kind === 'today-priorities' ? <><strong>01</strong><span><i /><i /><i /></span></>
      : kind === 'today-due' ? <><CalendarDays size={16} /><span><i /><i /><i /></span></>
      : kind === 'today-overdue' ? <><Clock3 size={16} /><span><i /><i /></span></>
      : <><MessageCircle size={16} /><span><i /><i /></span></>}
  </div>;
}
