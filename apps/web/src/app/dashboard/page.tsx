// apps/web/src/app/dashboard/page.tsx
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { socketService } from '@/services/socketService';
import { Loader2, Calendar, CheckCircle2 } from 'lucide-react';
import CreateWorkspaceModal from '@/components/CreateWorkspaceModal';
import { useT } from '@/lib/i18n';

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

export default function DashboardPage() {
  const t = useT();
  const router = useRouter();
  const { user, accessToken } = useAuthStore();

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

  const [isLoading, setIsLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'overdue' | 'completed'>('pending');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // ✅ Ref para evitar múltiples refreshes simultáneos
  const isRefreshingRef = useRef(false);

  const fetchDashboardStats = useCallback(async () => {
    if (!accessToken) return;

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/me/stats`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const { data } = await response.json();
        setStats(data);
      }
    } catch (error) {}
  }, [accessToken]);

  const fetchUserCards = useCallback(async () => {
    if (!accessToken || isRefreshingRef.current) return;

    try {
      isRefreshingRef.current = true;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/me/cards`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const { data } = await response.json();

        setUserCards({
          pending: data.pending || [],
          overdue: data.overdue || [],
          completed: data.completed || [],
        });
      } else {
      }
    } catch (error) {
    } finally {
      isRefreshingRef.current = false;
    }
  }, [accessToken]);

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
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        text: t.dashboard_due_overdue(Math.abs(diffDays)),
        color: 'text-error',
      };
    } else if (diffDays === 0) {
      return {
        text: t.dashboard_due_today,
        color: 'text-warning',
      };
    } else if (diffDays === 1) {
      return {
        text: t.dashboard_due_tomorrow,
        color: 'text-warning',
      };
    } else if (diffDays <= 7) {
      return {
        text: t.dashboard_due_in_days(diffDays),
        color: 'text-text-secondary',
      };
    } else {
      return {
        text: date.toLocaleDateString(undefined, {
          day: 'numeric',
          month: 'short',
        }),
        color: 'text-text-muted',
      };
    }
  };

  const formatCompletedDate = (completedAt: string | null) => {
    if (!completedAt) return t.dashboard_completed_fallback;

    const date = new Date(completedAt);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return t.dashboard_completed_today;
    } else if (diffDays === 1) {
      return t.dashboard_completed_yesterday;
    } else if (diffDays < 7) {
      return t.dashboard_completed_n_days_ago(diffDays);
    } else {
      return t.dashboard_completed_on_date(
        date.toLocaleDateString(undefined, {
          day: 'numeric',
          month: 'short',
        })
      );
    }
  };

  const handleCardClick = (card: UserCard) => {
    router.push(`/dashboard/workspaces/${card.workspaceId}/boards/${card.boardId}`);
  };

  // Effect 1: Configurar fecha
  useEffect(() => {
    const days = t.days_long as readonly string[];
    const months = t.months_long as readonly string[];
    const now = new Date();
    setCurrentDate(`${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`);
  }, [t]);

  // Effect 2: Cargar datos iniciales
  useEffect(() => {
    const loadDashboard = async () => {
      setIsLoading(true);
      await Promise.all([fetchDashboardStats(), fetchUserCards()]);
      setIsLoading(false);
    };

    loadDashboard();
  }, [fetchDashboardStats, fetchUserCards]);

  // Effect 3: Listeners de tiempo real
  useEffect(() => {
    // El socket se conecta automáticamente en SocketProvider
    if (!socketService.isConnected()) {
      return;
    }

    const handleRealtimeEvent = (event: any) => {
      // ✅ Helper: Extraer userId de diferentes estructuras de payload
      const extractUserId = (payload: any): string | null => {
        // Intenta diferentes caminos donde puede estar el userId
        return (
          payload?.member?.userId ||
          payload?.member?.id ||
          payload?.memberId ||
          payload?.userId ||
          payload?.user?.id ||
          null
        );
      };

      // ✅ Helper: Verificar si el evento es relevante
      const isRelevantForCurrentUser = (): boolean => {
        const eventType = event.type;

        // CASO 1: Asignación de miembro
        if (eventType === 'card.member.assigned') {
          const assignedUserId = extractUserId(event.payload);
          const isForMe = assignedUserId === user?.id;

          return isForMe;
        }

        // CASO 2: Desasignación de miembro
        if (eventType === 'card.member.unassigned') {
          const unassignedUserId = extractUserId(event.payload);
          const isForMe = unassignedUserId === user?.id;

          return isForMe;
        }

        // CASO 3: Cambios en cards que ya tengo
        const cardId = event.payload?.cardId || event.payload?.card?.id;
        if (cardId) {
          const allMyCards = [...userCards.pending, ...userCards.overdue, ...userCards.completed];
          const hasThisCard = allMyCards.some((card) => card.id === cardId);

          return hasThisCard;
        }

        return false;
      };

      // Lista de eventos relevantes
      const relevantEvents = [
        'card.member.assigned',
        'card.member.unassigned',
        'card.updated',
        'card.deleted',
        'card.completed',
        'card.uncompleted',
      ];

      // Solo procesar si es relevante
      if (relevantEvents.includes(event.type)) {
        const isRelevant = isRelevantForCurrentUser();

        if (isRelevant) {
          // Pequeño delay para asegurar que el backend actualizó
          setTimeout(() => {
            fetchDashboardStats();
            fetchUserCards();
          }, 100);
        } else {
        }
      }
    };

    socketService.onEvent(handleRealtimeEvent);

    return () => {
      socketService.off('event', handleRealtimeEvent);
    };
  }, [user?.id, userCards, fetchDashboardStats, fetchUserCards]);

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

  const renderCardList = (cards: UserCard[], type: 'pending' | 'overdue' | 'completed') => {
    if (cards.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center mb-4">
            {type === 'pending' && <CheckCircle2 className="h-8 w-8 text-success" />}
            {type === 'overdue' && <CheckCircle2 className="h-8 w-8 text-success" />}
            {type === 'completed' && <Calendar className="h-8 w-8 text-text-muted" />}
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
      <>
        {cards.map((card) => {
          const dueInfo = formatDueDate(card.dueDate);
          const isOverdue = type === 'overdue';
          const isCompleted = type === 'completed';
          const completedInfo = isCompleted ? formatCompletedDate(card.completedAt) : null;

          return (
            <div
              key={card.id}
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
            </div>
          );
        })}
      </>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1400px] mx-auto px-8 py-8">
        <div className="mb-8">
          <p className="text-xs text-text-muted mb-1">{currentDate}</p>
          <h1 className="text-3xl font-normal mb-2">
            {t.dashboard_greeting_morning}, <span className="text-accent">{user?.name}</span>
          </h1>
          <p className="text-text-secondary">{t.dashboard_greeting_subtitle}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-6">
            <div className="card-terminal">
              <h2 className="text-base font-medium text-text-primary mb-2">
                {t.dashboard_section_workspaces}
              </h2>
              <p className="text-xs text-text-muted mb-4 uppercase tracking-wide">
                {t.dashboard_quick_access}
              </p>

              <button
                className="w-full h-28 border-2 border-dashed border-border rounded-terminal hover:border-accent/50 hover:bg-card/50 transition-all flex flex-col items-center justify-center gap-2 text-text-muted hover:text-accent"
                onClick={() => setIsCreateModalOpen(true)}
              >
                <span className="text-2xl">+</span>
                <span className="text-xs">{t.dashboard_btn_create_workspace}</span>
              </button>

              <div className="mt-4">
                <button
                  onClick={() => router.push('/dashboard/workspaces')}
                  className="w-full py-2 text-xs text-text-secondary hover:text-accent transition-colors"
                >
                  {t.dashboard_btn_view_all_workspaces}
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="card-terminal h-[500px] flex flex-col">
              <div className="flex items-center gap-2 mb-6 flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                  <span className="text-lg">▤</span>
                </div>
                <div>
                  <h2 className="text-lg font-medium text-text-primary">
                    {t.dashboard_section_my_cards}
                  </h2>
                  <p className="text-xs text-text-muted">
                    {t.dashboard_cards_total(
                      userCards.pending.length +
                        userCards.overdue.length +
                        userCards.completed.length
                    )}
                  </p>
                </div>
              </div>

              <div className="flex gap-1 mb-6 border-b border-border flex-shrink-0">
                <button
                  onClick={() => setActiveTab('pending')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'pending'
                      ? 'text-text-primary border-accent'
                      : 'text-text-muted border-transparent hover:text-text-primary hover:border-border'
                  }`}
                >
                  {t.dashboard_tab_pending}
                  {userCards.pending.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 text-xs bg-accent/10 text-accent rounded-full">
                      {userCards.pending.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('overdue')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'overdue'
                      ? 'text-text-primary border-error'
                      : 'text-text-muted border-transparent hover:text-text-primary hover:border-border'
                  }`}
                >
                  {t.dashboard_tab_overdue}
                  {userCards.overdue.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 text-xs bg-error/10 text-error rounded-full">
                      {userCards.overdue.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('completed')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'completed'
                      ? 'text-text-primary border-success'
                      : 'text-text-muted border-transparent hover:text-text-primary hover:border-border'
                  }`}
                >
                  {t.dashboard_tab_completed}
                  {userCards.completed.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 text-xs bg-success/10 text-success rounded-full">
                      {userCards.completed.length}
                    </span>
                  )}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto activity-scroll pr-2">
                <div className="space-y-3">
                  {activeTab === 'pending' && renderCardList(userCards.pending, 'pending')}
                  {activeTab === 'overdue' && renderCardList(userCards.overdue, 'overdue')}
                  {activeTab === 'completed' && renderCardList(userCards.completed, 'completed')}
                </div>
              </div>
            </div>
          </div>
        </div>

        <CreateWorkspaceModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
        />
      </div>
    </div>
  );
}
