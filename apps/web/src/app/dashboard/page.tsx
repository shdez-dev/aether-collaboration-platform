// apps/web/src/app/dashboard/page.tsx
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { socketService } from '@/services/socketService';
import {
  Loader2,
  Calendar,
  CheckCircle2,
  Layout,
  ArrowRight,
  Activity,
  ExternalLink,
} from 'lucide-react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import CreateWorkspaceModal from '@/components/CreateWorkspaceModal';
import { useT } from '@/lib/i18n';
import { getEventIcon } from '@/lib/utils/activityLog';

// Estructura real que devuelve GET /api/users/me/activity
interface RawActivityEvent {
  id: string;
  type: string;
  payload: Record<string, any>;
  timestamp: string;
  createdBy: string;
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface DashboardStats {
  workspaceCount: number;
  activeBoardCount: number;
  totalCardCount: number;
  totalMemberCount: number;
}

interface UserCard {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  position: number;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  listId: string;
  listName: string;
  boardId: string;
  boardName: string;
  workspaceId: string;
  workspaceName: string;
}

interface CardsResponse {
  pending: UserCard[];
  overdue: UserCard[];
  completed: UserCard[];
}

interface RecentBoard {
  boardId: string;
  boardName: string;
  workspaceId: string;
  workspaceName: string;
  cardCount: number;
  overdueCount: number;
  workspaceColor?: string;
}

// ─── Animación helpers ────────────────────────────────────────────────────────

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.35, ease: 'easeOut' },
  }),
};

const staggerList = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

const itemFade = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.25 } },
};

// ─── Componente principal ─────────────────────────────────────────────────────

export default function DashboardPage() {
  const t = useT();
  const router = useRouter();
  const { user, accessToken } = useAuthStore();
  const { workspaces, fetchWorkspaces } = useWorkspaceStore();

  const [stats, setStats] = useState<DashboardStats>({
    workspaceCount: 0,
    activeBoardCount: 0,
    totalCardCount: 0,
    totalMemberCount: 0,
  });

  const [userCards, setUserCards] = useState<CardsResponse>({
    pending: [],
    overdue: [],
    completed: [],
  });

  const [activityFeed, setActivityFeed] = useState<RawActivityEvent[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'overdue' | 'completed'>('pending');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const isRefreshingRef = useRef(false);

  // ─── Fetch helpers ───────────────────────────────────────────────────────

  const fetchDashboardStats = useCallback(async () => {
    if (!accessToken) return;
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/me/stats`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (response.ok) {
        const { data } = await response.json();
        setStats(data);
      }
    } catch {}
  }, [accessToken]);

  const fetchUserCards = useCallback(async () => {
    if (!accessToken || isRefreshingRef.current) return;
    try {
      isRefreshingRef.current = true;
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/me/cards`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (response.ok) {
        const { data } = await response.json();
        setUserCards({
          pending: data.pending || [],
          overdue: data.overdue || [],
          completed: data.completed || [],
        });
      }
    } catch {
    } finally {
      isRefreshingRef.current = false;
    }
  }, [accessToken]);

  const fetchActivityFeed = useCallback(async () => {
    if (!accessToken) return;
    setIsLoadingActivity(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/me/activity`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (response.ok) {
        const { data } = await response.json();
        // La API devuelve { events: [...] } con campos: id, type, payload, timestamp, createdBy
        const rawEvents: RawActivityEvent[] = Array.isArray(data) ? data : (data.events ?? []);
        setActivityFeed(rawEvents.slice(0, 12));
      }
    } catch {
    } finally {
      setIsLoadingActivity(false);
    }
  }, [accessToken]);

  // ─── Boards recientes (derivados de las cards del usuario) ───────────────

  const recentBoards = useCallback((): RecentBoard[] => {
    const boardMap = new Map<string, RecentBoard>();

    const allCards = [...userCards.pending, ...userCards.overdue, ...userCards.completed];
    allCards.forEach((card) => {
      if (!boardMap.has(card.boardId)) {
        // Intentar obtener el color del workspace desde el store
        const ws = workspaces.find((w) => w.id === card.workspaceId);
        boardMap.set(card.boardId, {
          boardId: card.boardId,
          boardName: card.boardName,
          workspaceId: card.workspaceId,
          workspaceName: card.workspaceName,
          cardCount: 0,
          overdueCount: 0,
          workspaceColor: ws?.color,
        });
      }
      const entry = boardMap.get(card.boardId)!;
      if (!card.completed) entry.cardCount++;
      if (userCards.overdue.some((c) => c.id === card.id)) entry.overdueCount++;
    });

    return Array.from(boardMap.values()).slice(0, 6);
  }, [userCards, workspaces]);

  // ─── Helpers de actividad ────────────────────────────────────────────────

  /** Tiempo relativo localizado usando las claves i18n del dashboard */
  const getRelativeTime = (timestamp: string): string => {
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return t.dashboard_activity_just_now;
    if (diffMin < 60) return t.dashboard_activity_minutes_ago(diffMin);
    if (diffHour < 24) return t.dashboard_activity_hours_ago(diffHour);
    return t.dashboard_activity_days_ago(diffDay);
  };

  /** Descripción legible del evento usando las claves i18n del dashboard */
  const getActivityText = (event: RawActivityEvent): string => {
    const p = event.payload ?? {};
    const name: string = p.title || p.name || p.boardName || p.cardTitle || p.documentTitle || '';
    const newName: string = p.newTitle || p.newName || '';
    const who: string =
      p.inviteeName || p.memberName || p.assignedUserName || p.unassignedUserName || '';
    const list: string = p.newListName || p.listName || '';
    const label: string = p.labelName || '';
    const card: string = p.cardTitle || p.title || '';

    switch (event.type) {
      // Workspace
      case 'workspace.created':
        return t.dashboard_activity_workspace_created(name);
      case 'workspace.updated':
        return t.dashboard_activity_workspace_updated(name);
      case 'workspace.deleted':
        return t.dashboard_activity_workspace_deleted(name);
      case 'workspace.member.invited':
        return t.dashboard_activity_workspace_member_invited(who || '—');
      case 'workspace.member.joined':
        return t.dashboard_activity_workspace_member_joined;
      case 'workspace.member.removed':
        return t.dashboard_activity_workspace_member_removed(who || '—');
      case 'workspace.member.roleChanged':
        return t.dashboard_activity_workspace_member_role_changed(who || '—');

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
        return t.dashboard_activity_board_renamed(name, newName || name);
      case 'board.description.changed':
        return t.dashboard_activity_board_updated(name);

      // List
      case 'list.created':
        return t.dashboard_activity_list_created(name);
      case 'list.deleted':
        return t.dashboard_activity_list_deleted(name);
      case 'list.renamed':
        return t.dashboard_activity_list_renamed(name, newName || name);
      case 'list.updated':
        return t.dashboard_activity_list_created(name);
      case 'list.archived':
        return t.dashboard_activity_list_archived(name);

      // Card
      case 'card.created':
        return t.dashboard_activity_card_created(name);
      case 'card.updated':
        return t.dashboard_activity_card_updated(name);
      case 'card.deleted':
        return t.dashboard_activity_card_deleted(name);
      case 'card.completed':
        return t.dashboard_activity_card_completed(name);
      case 'card.uncompleted':
        return t.dashboard_activity_card_uncompleted(name);
      case 'card.moved':
        return t.dashboard_activity_card_moved(name, list || '—');
      case 'card.renamed':
        return t.dashboard_activity_card_renamed(name, newName || name);
      case 'card.description.changed':
        return t.dashboard_activity_card_updated(name);
      case 'card.duedate.set':
        return t.dashboard_activity_card_due_set(name);
      case 'card.duedate.changed':
        return t.dashboard_activity_card_due_changed(name);
      case 'card.duedate.removed':
        return t.dashboard_activity_card_due_removed(name);
      case 'card.priority.changed':
        return t.dashboard_activity_card_priority_changed(name);
      case 'card.member.assigned':
        return t.dashboard_activity_card_member_assigned(who || '—', card);
      case 'card.member.unassigned':
        return t.dashboard_activity_card_member_unassigned(who || '—', card);
      case 'card.label.added':
        return t.dashboard_activity_card_label_added(label || '—', card);
      case 'card.label.removed':
        return t.dashboard_activity_card_label_removed(label || '—', card);
      case 'card.archived':
        return t.dashboard_activity_card_archived(name);
      case 'card.unarchived':
        return t.dashboard_activity_card_unarchived(name);

      // Comment
      case 'comment.created':
      case 'card.comment.added':
        return t.dashboard_activity_comment_added(card || name);
      case 'comment.updated':
      case 'card.comment.updated':
        return t.dashboard_activity_comment_updated(card || name);
      case 'comment.deleted':
      case 'card.comment.deleted':
        return t.dashboard_activity_comment_deleted(card || name);

      // Document
      case 'document.created':
        return t.dashboard_activity_document_created(name);
      case 'document.updated':
        return t.dashboard_activity_document_updated(name);
      case 'document.deleted':
        return t.dashboard_activity_document_deleted(name);
      case 'document.title.changed':
        return t.dashboard_activity_document_renamed(name, newName || name);
      case 'document.version.created':
        return t.dashboard_activity_document_version(name);
      case 'document.exported':
        return t.dashboard_activity_document_exported(name);

      default:
        return t.dashboard_activity_unknown;
    }
  };

  // ─── Formatters ──────────────────────────────────────────────────────────

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case 'HIGH':
        return 'text-error';
      case 'MEDIUM':
        return 'text-warning';
      case 'LOW':
        return 'text-success';
      default:
        return 'text-text-muted';
    }
  };

  const getPriorityBg = (priority: string | null) => {
    switch (priority) {
      case 'HIGH':
        return 'bg-error/10';
      case 'MEDIUM':
        return 'bg-warning/10';
      case 'LOW':
        return 'bg-success/10';
      default:
        return 'bg-surface';
    }
  };

  const formatDueDate = (dueDate: string | null) => {
    if (!dueDate) return null;
    const date = new Date(dueDate);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0)
      return { text: t.dashboard_due_overdue(Math.abs(diffDays)), color: 'text-error' };
    if (diffDays === 0) return { text: t.dashboard_due_today, color: 'text-warning' };
    if (diffDays === 1) return { text: t.dashboard_due_tomorrow, color: 'text-warning' };
    if (diffDays <= 7)
      return { text: t.dashboard_due_in_days(diffDays), color: 'text-text-secondary' };
    return {
      text: date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
      color: 'text-text-muted',
    };
  };

  const formatCompletedDate = (completedAt: string | null) => {
    if (!completedAt) return t.dashboard_completed_fallback;
    const date = new Date(completedAt);
    const diffDays = Math.floor((new Date().getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return t.dashboard_completed_today;
    if (diffDays === 1) return t.dashboard_completed_yesterday;
    if (diffDays < 7) return t.dashboard_completed_n_days_ago(diffDays);
    return t.dashboard_completed_on_date(
      date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    );
  };

  const handleCardClick = (card: UserCard) => {
    router.push(`/dashboard/workspaces/${card.workspaceId}/boards/${card.boardId}`);
  };

  // ─── Effects ─────────────────────────────────────────────────────────────

  // Configurar fecha
  useEffect(() => {
    const days = t.days_long as readonly string[];
    const months = t.months_long as readonly string[];
    const now = new Date();
    setCurrentDate(`${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`);
  }, [t]);

  // Cargar datos iniciales
  useEffect(() => {
    const loadDashboard = async () => {
      setIsLoading(true);
      await Promise.all([fetchDashboardStats(), fetchUserCards(), fetchActivityFeed()]);
      setIsLoading(false);
    };
    loadDashboard();
    // fetchWorkspaces se omite aquí intencionalmente: los datos persisten
    // en el store (localStorage) y se recargan en la página de workspaces.
    // Llamarlo aquí causaba un warning de setState-during-render.
  }, [fetchDashboardStats, fetchUserCards, fetchActivityFeed]);

  // Listeners de tiempo real
  useEffect(() => {
    if (!socketService.isConnected()) return;

    const handleRealtimeEvent = (event: any) => {
      const extractUserId = (payload: any): string | null =>
        payload?.member?.userId ||
        payload?.member?.id ||
        payload?.memberId ||
        payload?.userId ||
        payload?.user?.id ||
        null;

      const isRelevantForCurrentUser = (): boolean => {
        const { type, payload } = event;
        if (type === 'card.member.assigned' || type === 'card.member.unassigned') {
          return extractUserId(payload) === user?.id;
        }
        const cardId = payload?.cardId || payload?.card?.id;
        if (cardId) {
          const all = [...userCards.pending, ...userCards.overdue, ...userCards.completed];
          return all.some((c) => c.id === cardId);
        }
        return false;
      };

      const relevantEvents = [
        'card.member.assigned',
        'card.member.unassigned',
        'card.updated',
        'card.deleted',
        'card.completed',
        'card.uncompleted',
      ];

      if (relevantEvents.includes(event.type) && isRelevantForCurrentUser()) {
        setTimeout(() => {
          fetchDashboardStats();
          fetchUserCards();
          fetchActivityFeed();
        }, 100);
      }
    };

    socketService.onEvent(handleRealtimeEvent);
    return () => {
      socketService.off('event', handleRealtimeEvent);
    };
  }, [user?.id, userCards, fetchDashboardStats, fetchUserCards, fetchActivityFeed]);

  // ─── Loading state ────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-text-muted" />
          <p className="text-sm text-text-muted">{t.dashboard_loading}</p>
        </div>
      </div>
    );
  }

  // ─── Render helpers ───────────────────────────────────────────────────────

  const renderCardList = (cards: UserCard[], type: 'pending' | 'overdue' | 'completed') => {
    if (cards.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center mb-4">
            {type === 'completed' ? (
              <Calendar className="h-8 w-8 text-text-muted" />
            ) : (
              <CheckCircle2 className="h-8 w-8 text-success" />
            )}
          </div>
          <h3 className="text-base font-medium text-text-primary mb-1">
            {type === 'pending' && t.dashboard_empty_pending_title}
            {type === 'overdue' && t.dashboard_empty_overdue_title}
            {type === 'completed' && t.dashboard_empty_completed_title}
          </h3>
          <p className="text-sm text-text-secondary">
            {type === 'pending' && t.dashboard_empty_pending_desc}
            {type === 'overdue' && t.dashboard_empty_overdue_desc}
            {type === 'completed' && t.dashboard_empty_completed_desc}
          </p>
        </div>
      );
    }

    return (
      <motion.div variants={staggerList} initial="hidden" animate="visible" className="space-y-3">
        {cards.map((card) => {
          const dueInfo = formatDueDate(card.dueDate);
          const isOverdue = type === 'overdue';
          const isCompleted = type === 'completed';
          const completedInfo = isCompleted ? formatCompletedDate(card.completedAt) : null;

          return (
            <motion.div
              key={card.id}
              variants={itemFade}
              onClick={() => handleCardClick(card)}
              className={`group p-4 border rounded-lg transition-all cursor-pointer ${
                isCompleted
                  ? 'bg-success/5 border-success/30 hover:border-success/50 opacity-75'
                  : isOverdue
                    ? 'bg-error/5 border-error/30 hover:border-error/50'
                    : 'bg-surface border-border hover:border-accent/50 hover:shadow-md'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-5 h-5 mt-0.5 rounded border-2 flex-shrink-0 flex items-center justify-center ${
                    isCompleted
                      ? 'border-success bg-success'
                      : isOverdue
                        ? 'border-error/50'
                        : 'border-border'
                  }`}
                >
                  {isCompleted && (
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium mb-2 transition-colors ${
                      isCompleted
                        ? 'text-text-primary line-through'
                        : isOverdue
                          ? 'text-text-primary group-hover:text-error'
                          : 'text-text-primary group-hover:text-accent'
                    }`}
                  >
                    {card.title}
                  </p>

                  <div className="flex items-center gap-3 text-xs text-text-muted flex-wrap">
                    <span className="flex items-center gap-1">
                      <span>▣</span>
                      <span>{card.workspaceName}</span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <span>▦</span>
                      <span>{card.boardName}</span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <span>▨</span>
                      <span>{card.listName}</span>
                    </span>

                    {isCompleted && completedInfo && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-success">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>{completedInfo}</span>
                        </span>
                      </>
                    )}

                    {!isCompleted && dueInfo && (
                      <>
                        <span>•</span>
                        <span className={`flex items-center gap-1 ${dueInfo.color}`}>
                          <Calendar className="h-3 w-3" />
                          <span>{dueInfo.text}</span>
                        </span>
                      </>
                    )}

                    {card.priority && (
                      <>
                        <span>•</span>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(card.priority)} ${getPriorityBg(card.priority)}`}
                        >
                          {card.priority}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    );
  };

  const boards = recentBoards();

  // ─── Render principal ─────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1400px] mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6 sm:mb-8"
        >
          <p className="text-[10px] sm:text-xs text-text-muted mb-1">{currentDate}</p>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-normal mb-1 sm:mb-2">
            {t.dashboard_greeting_morning}, <span className="text-accent">{user?.name}</span>
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary">{t.dashboard_greeting_subtitle}</p>
        </motion.div>

        {/* Fila de stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          {[
            {
              label: t.dashboard_stat_workspaces,
              value: stats.workspaceCount,
              icon: '▣',
              gradient: 'from-accent/20 to-accent/5',
              border: 'border-accent/30',
              text: 'text-accent',
            },
            {
              label: t.dashboard_stat_active_boards,
              value: stats.activeBoardCount,
              icon: '▦',
              gradient: 'from-blue-500/20 to-blue-500/5',
              border: 'border-blue-500/30',
              text: 'text-blue-400',
            },
            {
              label: t.dashboard_stat_total_cards,
              value: stats.totalCardCount,
              icon: '▨',
              gradient: 'from-purple-500/20 to-purple-500/5',
              border: 'border-purple-500/30',
              text: 'text-purple-400',
            },
            {
              label: t.dashboard_stat_collaborators,
              value: stats.totalMemberCount,
              icon: '◉',
              gradient: 'from-emerald-500/20 to-emerald-500/5',
              border: 'border-emerald-500/30',
              text: 'text-emerald-400',
            },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className={`card-terminal border ${stat.border} bg-gradient-to-br ${stat.gradient} relative overflow-hidden`}
            >
              <div className="flex items-start justify-between mb-2 sm:mb-3">
                <span className={`text-xl sm:text-2xl ${stat.text}`}>{stat.icon}</span>
              </div>
              <p className={`text-2xl sm:text-3xl font-semibold ${stat.text} tabular-nums`}>
                {stat.value}
              </p>
              <p className="text-[10px] sm:text-xs text-text-muted mt-0.5 sm:mt-1">{stat.label}</p>
              {/* Decoración de fondo */}
              <span
                className={`absolute -right-2 sm:-right-3 -bottom-2 sm:-bottom-3 text-4xl sm:text-6xl opacity-5 ${stat.text} select-none pointer-events-none`}
              >
                {stat.icon}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Layout principal: 3 columnas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Columna izquierda: Workspaces + Boards recientes */}
          <div className="space-y-4 sm:space-y-6">
            {/* Quick access workspaces */}
            <motion.div
              custom={0}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="card-terminal"
            >
              <h2 className="text-sm sm:text-base font-medium text-text-primary mb-1 sm:mb-2">
                {t.dashboard_section_workspaces}
              </h2>
              <p className="text-[10px] sm:text-xs text-text-muted mb-3 sm:mb-4 uppercase tracking-wide">
                {t.dashboard_quick_access}
              </p>

              <button
                className="w-full h-20 sm:h-24 border-2 border-dashed border-border rounded-terminal hover:border-accent/50 hover:bg-card/50 transition-all flex flex-col items-center justify-center gap-1.5 sm:gap-2 text-text-muted hover:text-accent touch-target"
                onClick={() => setIsCreateModalOpen(true)}
              >
                <span className="text-xl sm:text-2xl">+</span>
                <span className="text-[10px] sm:text-xs">{t.dashboard_btn_create_workspace}</span>
              </button>

              <div className="mt-3 sm:mt-4">
                <button
                  onClick={() => router.push('/dashboard/workspaces')}
                  className="w-full py-2 text-[10px] sm:text-xs text-text-secondary hover:text-accent transition-colors touch-target"
                >
                  {t.dashboard_btn_view_all_workspaces}
                </button>
              </div>
            </motion.div>

            {/* Boards recientes */}
            {boards.length > 0 && (
              <motion.div
                custom={1}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                className="card-terminal"
              >
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-500/5 border border-purple-500/30 flex items-center justify-center">
                    <Layout className="h-4 w-4 text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-sm font-medium text-text-primary">
                      {t.dashboard_recent_boards_title}
                    </h2>
                    <p className="text-xs text-text-muted">{t.dashboard_recent_boards_subtitle}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {boards.map((board, i) => {
                    // Color del workspace o fallback
                    const accentColor = board.workspaceColor || '#6366f1';
                    return (
                      <motion.button
                        key={board.boardId}
                        custom={i}
                        variants={fadeUp}
                        initial="hidden"
                        animate="visible"
                        onClick={() =>
                          router.push(
                            `/dashboard/workspaces/${board.workspaceId}/boards/${board.boardId}`
                          )
                        }
                        className="w-full group flex items-center gap-3 p-3 rounded-lg border border-border hover:border-accent/40 hover:bg-surface/60 transition-all text-left"
                      >
                        {/* Indicador de color */}
                        <div
                          className="w-1.5 h-8 rounded-full flex-shrink-0 transition-all group-hover:h-10"
                          style={{ backgroundColor: accentColor }}
                        />

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors truncate">
                            {board.boardName}
                          </p>
                          <p className="text-xs text-text-muted truncate">{board.workspaceName}</p>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {board.overdueCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-error/10 text-error">
                              {board.overdueCount}
                            </span>
                          )}
                          {board.cardCount > 0 && (
                            <span className="text-xs text-text-muted">{board.cardCount}</span>
                          )}
                          <ExternalLink className="h-3 w-3 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </div>

          {/* Columna central: Mis cards */}
          <motion.div
            custom={2}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="lg:col-span-1"
          >
            <div className="card-terminal h-[500px] sm:h-[600px] flex flex-col">
              <div className="flex items-center gap-2 mb-4 sm:mb-6 flex-shrink-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/30 flex items-center justify-center">
                  <span className="text-base sm:text-lg text-accent">▤</span>
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-medium text-text-primary">
                    {t.dashboard_section_my_cards}
                  </h2>
                  <p className="text-[10px] sm:text-xs text-text-muted">
                    {t.dashboard_cards_total(
                      userCards.pending.length +
                        userCards.overdue.length +
                        userCards.completed.length
                    )}
                  </p>
                </div>
              </div>

              <div className="flex gap-0.5 sm:gap-1 mb-4 sm:mb-6 border-b border-border flex-shrink-0 overflow-x-auto">
                {(['pending', 'overdue', 'completed'] as const).map((tab) => {
                  const count = userCards[tab].length;
                  const isActive = activeTab === tab;
                  const borderColor =
                    tab === 'overdue'
                      ? 'border-error'
                      : tab === 'completed'
                        ? 'border-success'
                        : 'border-accent';
                  const badgeColor =
                    tab === 'overdue'
                      ? 'bg-error/10 text-error'
                      : tab === 'completed'
                        ? 'bg-success/10 text-success'
                        : 'bg-accent/10 text-accent';
                  const label =
                    tab === 'pending'
                      ? t.dashboard_tab_pending
                      : tab === 'overdue'
                        ? t.dashboard_tab_overdue
                        : t.dashboard_tab_completed;

                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                        isActive
                          ? `text-text-primary ${borderColor}`
                          : 'text-text-muted border-transparent hover:text-text-primary hover:border-border'
                      }`}
                    >
                      {label}
                      {count > 0 && (
                        <span
                          className={`ml-1 sm:ml-2 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs ${badgeColor} rounded-full`}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex-1 overflow-y-auto activity-scroll pr-2">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                  >
                    {activeTab === 'pending' && renderCardList(userCards.pending, 'pending')}
                    {activeTab === 'overdue' && renderCardList(userCards.overdue, 'overdue')}
                    {activeTab === 'completed' && renderCardList(userCards.completed, 'completed')}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>

          {/* Columna derecha: Feed de actividad */}
          <motion.div custom={3} variants={fadeUp} initial="hidden" animate="visible">
            <div className="card-terminal flex flex-col h-[500px] sm:h-[600px]">
              {/* Header fijo */}
              <div className="flex items-center justify-between mb-4 sm:mb-5 pb-3 sm:pb-4 border-b border-border/50 flex-shrink-0">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/30 flex items-center justify-center">
                    <Activity className="h-3.5 w-3.5 sm:h-4.5 sm:w-4.5 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-semibold text-text-primary font-mono tracking-tight">
                      {t.dashboard_activity_title}
                    </h2>
                    <p className="text-[10px] sm:text-xs text-text-muted font-mono">
                      {t.dashboard_activity_subtitle}
                    </p>
                  </div>
                </div>
                {activityFeed.length > 0 && (
                  <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-accent/10 text-accent text-[10px] sm:text-xs font-mono font-semibold">
                    {activityFeed.length}
                  </span>
                )}
              </div>

              {/* Contenido scrollable */}
              <div className="flex-1 overflow-hidden relative">
                <div className="absolute inset-0 overflow-y-auto activity-scroll pr-2">
                  {isLoadingActivity ? (
                    <div className="flex items-center justify-center py-20">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="h-6 w-6 animate-spin text-accent" />
                        <p className="text-xs text-text-muted font-mono">Cargando actividad...</p>
                      </div>
                    </div>
                  ) : activityFeed.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20">
                      <div className="w-16 h-16 rounded-full bg-surface border border-border flex items-center justify-center mb-4">
                        <Activity className="h-8 w-8 text-text-muted" />
                      </div>
                      <p className="text-sm text-text-secondary text-center font-mono">
                        {t.dashboard_activity_empty}
                      </p>
                      <p className="text-xs text-text-muted text-center mt-2 max-w-[220px]">
                        Tu actividad reciente aparecerá aquí
                      </p>
                    </div>
                  ) : (
                    <motion.div
                      variants={staggerList}
                      initial="hidden"
                      animate="visible"
                      className="space-y-0 pb-2"
                    >
                      {activityFeed.map((event, i) => {
                        const safeType = event.type || 'unknown';
                        const Icon = getEventIcon(safeType as any);
                        const relTime = getRelativeTime(event.timestamp);
                        const description = getActivityText(event);

                        // Color del icono según tipo de evento
                        const iconColor = safeType.includes('created')
                          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                          : safeType.includes('deleted')
                            ? 'text-error bg-error/10 border-error/30'
                            : safeType.includes('completed')
                              ? 'text-blue-400 bg-blue-500/10 border-blue-500/30'
                              : safeType.includes('archived')
                                ? 'text-orange-400 bg-orange-500/10 border-orange-500/30'
                                : safeType.includes('moved')
                                  ? 'text-purple-400 bg-purple-500/10 border-purple-500/30'
                                  : 'text-text-muted bg-surface/50 border-border';

                        // Etiquetas de contexto desde el payload
                        const p = event.payload ?? {};
                        const workspaceName: string | undefined = p.workspaceName;
                        const boardName: string | undefined = p.boardName;

                        const isLast = i === activityFeed.length - 1;

                        return (
                          <motion.div
                            key={event.id}
                            variants={itemFade}
                            className="flex gap-3 relative group"
                          >
                            {/* Línea vertical conectora */}
                            {!isLast && (
                              <div className="absolute left-[15px] top-9 bottom-0 w-px bg-gradient-to-b from-border via-border/50 to-transparent" />
                            )}

                            {/* Icono */}
                            <div
                              className={`w-[30px] h-[30px] mt-1.5 rounded-full border flex-shrink-0 flex items-center justify-center z-10 transition-all duration-200 ${iconColor} group-hover:scale-110`}
                            >
                              <Icon className="h-3.5 w-3.5" />
                            </div>

                            {/* Contenido */}
                            <div className="flex-1 pb-5 min-w-0">
                              {/* Descripción y tiempo */}
                              <div className="flex items-start justify-between gap-3 mb-1.5">
                                <p className="text-sm text-text-primary leading-snug font-mono">
                                  {description}
                                </p>
                                <span className="text-[11px] text-text-muted flex-shrink-0 mt-0.5 whitespace-nowrap font-mono bg-surface/50 px-1.5 py-0.5 rounded border border-border/50">
                                  {relTime}
                                </span>
                              </div>

                              {/* Etiquetas de contexto */}
                              {(workspaceName || boardName) && (
                                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                  {workspaceName && (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] bg-surface border border-border/60 text-text-muted font-mono">
                                      <span className="text-accent">▣</span>
                                      <span className="truncate max-w-[100px]">
                                        {workspaceName}
                                      </span>
                                    </span>
                                  )}
                                  {boardName && (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] bg-surface border border-border/60 text-text-muted font-mono">
                                      <ArrowRight className="h-2.5 w-2.5 text-accent/70" />
                                      <span className="truncate max-w-[100px]">{boardName}</span>
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  )}
                </div>

                {/* Fade overlay en el bottom para indicar más contenido */}
                {activityFeed.length > 5 && (
                  <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-card via-card/80 to-transparent pointer-events-none" />
                )}
              </div>
            </div>
          </motion.div>
        </div>

        <CreateWorkspaceModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
        />
      </div>
    </div>
  );
}
