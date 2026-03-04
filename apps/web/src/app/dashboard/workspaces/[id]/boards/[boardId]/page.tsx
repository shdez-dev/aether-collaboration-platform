// apps/web/src/app/dashboard/workspaces/[id]/boards/[boardId]/page.tsx
'use client';

import { useEffect, useState, useMemo, lazy, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useBoardStore } from '@/stores/boardStore';
import { useCardStore } from '@/stores/cardStore';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { useRealtimeBoard } from '@/hooks/useRealTimeBoard';
import { useRealtimeToast } from '@/hooks/useRealtimeToast';
import BoardList from '@/components/BoardList';
import BoardFilters, {
  BoardFilterState,
  EMPTY_FILTERS,
  hasActiveFilters,
} from '@/components/BoardFilters';
import type { List, Card, User, Label } from '@aether/types';
import AddListButton from '@/components/AddListButton';
import { CardDetailModal } from '@/components/CardDetailModal';
import { ActiveUsers } from '@/components/realtime/ActiveUsers';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToWindowEdges } from '@dnd-kit/modifiers';
import {
  ArrowLeft,
  LayoutGrid,
  FileText,
  Users,
  GitBranch,
  Table2,
  CalendarDays,
  GanttChart,
  Kanban,
} from 'lucide-react';
import { useT } from '@/lib/i18n';
import type { BoardView } from '@aether/types';
import { BoardTableView } from '@/components/BoardTableView';
import { BoardCalendarView } from '@/components/BoardCalendarView';

// Dynamic import para BoardTimelineView para evitar problemas con dependencias de Node.js
const BoardTimelineView = dynamic(
  () => import('@/components/BoardTimelineView').then((mod) => mod.BoardTimelineView),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-text-secondary">Loading Timeline View...</p>
        </div>
      </div>
    ),
  }
);

export default function BoardPage() {
  const t = useT();
  const params = useParams();
  const router = useRouter();

  const workspaceId = params.id as string;
  const boardId = params.boardId as string;

  // Obtener rol del usuario
  const { currentWorkspace, fetchWorkspaceById } = useWorkspaceStore();
  const userRole = currentWorkspace?.userRole;

  // ✅ PERMISOS ACTUALIZADOS:
  // OWNER y ADMIN: pueden crear/editar/eliminar listas y archivar board
  const canEditBoard = userRole === 'ADMIN' || userRole === 'OWNER';

  // OWNER, ADMIN y MEMBER: pueden mover cards (drag & drop)
  const canMoveCards = userRole === 'OWNER' || userRole === 'ADMIN' || userRole === 'MEMBER';

  // Realtime
  const {
    board: currentBoard,
    lists,
    isLoading,
    isConnected,
    activeUsers,
  } = useRealtimeBoard(boardId, {
    onConnect: () => {},
    onDisconnect: () => {},
  });

  const toast = useRealtimeToast();

  // Stores
  const { reorderList } = useBoardStore();
  const { cards, setCards, moveCard, setCurrentWorkspaceId, clearAllCards } = useCardStore();
  const { accessToken } = useAuthStore();
  const { preferences, loadPreferences, updatePreferences } = usePreferencesStore();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'list' | 'card' | null>(null);
  const [filters, setFilters] = useState<BoardFilterState>(EMPTY_FILTERS);
  const [currentView, setCurrentView] = useState<BoardView>('kanban');
  const [viewInitialized, setViewInitialized] = useState(false);

  // Función para cambiar la vista y guardarla en preferencias
  const handleViewChange = async (view: BoardView) => {
    setCurrentView(view);

    // Guardar la nueva vista como preferencia predeterminada
    try {
      await updatePreferences({ defaultBoardView: view });
    } catch (error) {
      // Error saving preference
    }
  };

  // ── Derivar members y labels únicos de todas las cards ────────────────────
  const allCards = useMemo(() => Object.values(cards).flat() as Card[], [cards]);

  const boardMembers = useMemo((): User[] => {
    const seen = new Set<string>();
    const result: User[] = [];
    for (const card of allCards) {
      for (const m of card.members ?? []) {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          result.push(m);
        }
      }
    }
    return result;
  }, [allCards]);

  const boardLabels = useMemo((): Label[] => {
    const seen = new Set<string>();
    const result: Label[] = [];
    for (const card of allCards) {
      for (const l of card.labels ?? []) {
        if (!seen.has(l.id)) {
          seen.add(l.id);
          result.push(l);
        }
      }
    }
    return result;
  }, [allCards]);

  // ── Función de filtrado ───────────────────────────────────────────────────
  const applyFilters = useMemo(() => {
    if (!hasActiveFilters(filters)) return null;

    return (listCards: Card[]): Card[] => {
      return listCards.filter((card) => {
        // Búsqueda de texto
        if (filters.search.trim()) {
          const q = filters.search.toLowerCase();
          const matchTitle = card.title.toLowerCase().includes(q);
          const matchDesc = card.description?.toLowerCase().includes(q) ?? false;
          if (!matchTitle && !matchDesc) return false;
        }

        // Prioridad
        if (filters.priorities.length > 0) {
          if (!card.priority || !filters.priorities.includes(card.priority as any)) return false;
        }

        // Miembros asignados
        if (filters.memberIds.length > 0) {
          const cardMemberIds = (card.members ?? []).map((m) => m.id);
          if (!filters.memberIds.some((id) => cardMemberIds.includes(id))) return false;
        }

        // Labels
        if (filters.labelIds.length > 0) {
          const cardLabelIds = (card.labels ?? []).map((l) => l.id);
          if (!filters.labelIds.some((id) => cardLabelIds.includes(id))) return false;
        }

        // Fecha
        if (filters.dates.length > 0) {
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const weekEnd = new Date(today);
          weekEnd.setDate(today.getDate() + 7);

          const dueDate = card.dueDate ? new Date(card.dueDate) : null;

          const matchesDate = filters.dates.some((d) => {
            if (d === 'no_date') return !dueDate;
            if (!dueDate) return false;
            const due = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
            if (d === 'overdue') return !card.completed && due < today;
            if (d === 'due_today') return due.getTime() === today.getTime();
            if (d === 'due_week') return due >= today && due <= weekEnd;
            return false;
          });
          if (!matchesDate) return false;
        }

        return true;
      });
    };
  }, [filters]);

  // ── Cards filtradas por lista (null = sin filtro activo) ──────────────────
  const filteredCardsByList = useMemo((): Record<string, Card[]> | null => {
    if (!applyFilters) return null;
    const result: Record<string, Card[]> = {};
    for (const [listId, listCards] of Object.entries(cards)) {
      result[listId] = applyFilters(listCards as Card[]);
    }
    return result;
  }, [applyFilters, cards]);

  // Totales para el contador del filtro
  const totalCards = useMemo(
    () => Object.values(cards).reduce((sum, lc) => sum + lc.length, 0),
    [cards]
  );
  const filteredTotal = useMemo(
    () =>
      filteredCardsByList
        ? Object.values(filteredCardsByList).reduce((sum, lc) => sum + lc.length, 0)
        : totalCards,
    [filteredCardsByList, totalCards]
  );

  // Mobile-optimized drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 15, // Increased from 8px for better touch accuracy
        delay: 150, // Add delay to distinguish between scroll and drag on mobile
        tolerance: 5, // Allow small movements without canceling
      },
    })
  );

  // Cargar preferencias del usuario al montar el componente
  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  // Aplicar defaultBoardView de las preferencias al inicializar
  useEffect(() => {
    if (preferences && !viewInitialized) {
      setCurrentView(preferences.defaultBoardView);
      setViewInitialized(true);
    }
  }, [preferences, viewInitialized]);

  useEffect(() => {
    if (!workspaceId) return;
    clearAllCards();
    setCurrentWorkspaceId(workspaceId);
    // Si el workspace no está cargado o no coincide con el actual,
    // lo cargamos para asegurar que userRole esté disponible
    if (!currentWorkspace || currentWorkspace.id !== workspaceId) {
      fetchWorkspaceById(workspaceId);
    }
  }, [workspaceId, setCurrentWorkspaceId, clearAllCards, fetchWorkspaceById, currentWorkspace?.id]);

  useEffect(() => {
    if (lists.length === 0 || !accessToken) return;

    const loadCards = async () => {
      const cardPromises = lists.map(async (list) => {
        try {
          const cardsRes = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/lists/${list.id}/cards`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );

          if (cardsRes.ok) {
            const { data: cardsData } = await cardsRes.json();
            return { listId: list.id, cards: cardsData.cards || [] };
          }
          return { listId: list.id, cards: [] };
        } catch (error) {
          return { listId: list.id, cards: [] };
        }
      });

      const cardsResults = await Promise.all(cardPromises);
      cardsResults.forEach(({ listId, cards }: { listId: string; cards: any[] }) => {
        setCards(listId, cards);
      });
    };

    loadCards();
  }, [lists, accessToken, setCards]);

  const handleBack = () => {
    router.push(`/dashboard/workspaces/${workspaceId}`);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const activeData = active.data.current;

    // Verificar permisos según el tipo
    if (activeData?.type === 'list' && !canEditBoard) {
      return;
    }

    if (activeData?.type === 'card' && !canMoveCards) {
      return;
    }

    setActiveId(active.id as string);
    setActiveType(activeData?.type);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveId(null);
    setActiveType(null);

    if (!over) {
      return;
    }

    const activeData = active.data.current;
    const overData = over.data.current;

    // ==================== CASO 1: REORDENAR LISTAS ====================
    if (activeData?.type === 'list' && overData?.type === 'list') {
      if (!canEditBoard) {
        toast.error(t.board_toast_no_permission_lists);
        return;
      }

      const activeId = active.id as string;
      const overId = over.id as string;

      if (activeId !== overId) {
        const sortedLists = [...lists].sort((a: List, b: List) => a.position - b.position);
        const oldIndex = sortedLists.findIndex((list: List) => list.id === activeId);
        const newIndex = sortedLists.findIndex((list: List) => list.id === overId);

        if (oldIndex === -1 || newIndex === -1) return;

        let newPosition: number;

        if (newIndex === 0) {
          newPosition = sortedLists[0].position - 1;
        } else if (newIndex === sortedLists.length - 1) {
          newPosition = sortedLists[sortedLists.length - 1].position + 1;
        } else if (newIndex > oldIndex) {
          newPosition = (sortedLists[newIndex].position + sortedLists[newIndex + 1].position) / 2;
        } else {
          newPosition = (sortedLists[newIndex - 1].position + sortedLists[newIndex].position) / 2;
        }

        try {
          await reorderList(activeId, newPosition);
          toast.success(t.board_toast_list_reordered);
        } catch (error) {
          toast.error(t.board_toast_list_reorder_error);
        }
      }
    }

    // ==================== CASO 2: MOVER CARDS ====================
    else if (activeData?.type === 'card') {
      if (!canMoveCards) {
        toast.error(t.board_toast_no_permission_cards);
        return;
      }

      const cardId = active.id as string;
      const activeCard = activeData.card;
      const fromListId = activeCard.listId;

      // Verificar si la card está bloqueada por dependencias pendientes
      const blockedByPendingCount = activeCard.blockedByPendingCount ?? 0;
      const isBlocked = blockedByPendingCount > 0 && !activeCard.completed;

      if (isBlocked) {
        toast.error(
          `No se puede mover esta tarjeta porque está bloqueada por ${blockedByPendingCount} dependencia${blockedByPendingCount !== 1 ? 's' : ''} pendiente${blockedByPendingCount !== 1 ? 's' : ''}. Completa las dependencias primero.`
        );
        return;
      }

      let toListId = fromListId;
      let targetPosition = 0;

      // Determinar lista destino y posición
      if (overData?.type === 'list') {
        // Se soltó sobre un área de lista (posiblemente vacía)
        toListId = overData.listId;
        const toListCards = cards[toListId] || [];
        targetPosition = toListCards.length; // Al final de la lista
      } else if (overData?.type === 'card') {
        // Se soltó sobre otra card
        const overCard = overData.card;
        toListId = overCard.listId;

        const overListCards = cards[toListId] || [];
        const overIndex = overListCards.findIndex((c) => c.id === over.id);
        targetPosition = overIndex >= 0 ? overIndex : 0;
      }

      // Verificar si realmente cambió algo
      const fromListCards = cards[fromListId] || [];
      const currentIndex = fromListCards.findIndex((c) => c.id === cardId);

      if (fromListId === toListId && currentIndex === targetPosition) {
        return;
      }

      // ✅ PASO 1: OPTIMISTIC UPDATE (actualizar UI inmediatamente)
      moveCard(cardId, fromListId, toListId, targetPosition);

      try {
        // ✅ PASO 2: PERSISTIR EN BASE DE DATOS
        // ⚠️ IMPORTANTE: Usar endpoint correcto /api/cards/:id/move
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/cards/${cardId}/move`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              toListId,
              position: targetPosition + 1, // Backend usa posiciones 1-indexed
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Error al mover card');
        }

        const { data } = await response.json();

        toast.moved('Tarjeta', activeCard.title);
      } catch (error: any) {
        // ✅ PASO 3: ROLLBACK si falla
        moveCard(cardId, toListId, fromListId, currentIndex);

        toast.error(t.board_toast_card_move_error(error.message));
      }
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setActiveType(null);
  };

  const activeList =
    activeId && activeType === 'list' ? lists.find((list: List) => list.id === activeId) : null;

  const activeCard =
    activeId && activeType === 'card'
      ? Object.values(cards)
          .flat()
          .find((card) => card.id === activeId)
      : null;

  if (isLoading || !currentBoard) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-text-secondary">{t.board_loading}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card flex-shrink-0">
        {/* Top Row - Navigation & Title */}
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <button
                onClick={handleBack}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-muted hover:text-text-primary hover:bg-surface border border-transparent hover:border-border transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{t.btn_back}</span>
              </button>

              <div className="w-px h-6 bg-border" />

              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-medium text-text-primary truncate mb-1">
                  {currentBoard.name}
                </h1>
                {currentBoard.description && (
                  <p className="text-sm text-text-secondary truncate">{currentBoard.description}</p>
                )}
              </div>
            </div>

            {/* Botón mapa de dependencias */}
            <button
              onClick={() =>
                router.push(`/dashboard/workspaces/${workspaceId}/boards/${boardId}/dependencies`)
              }
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-muted hover:text-text-primary hover:bg-surface border border-transparent hover:border-border transition-all flex-shrink-0"
              title="Ver mapa de dependencias"
            >
              <GitBranch className="w-4 h-4" />
              <span className="hidden sm:inline">Dependencias</span>
            </button>
          </div>
        </div>

        {/* Middle Row - Stats & Users */}
        <div className="px-6 py-3 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-6">
            {/* Lists Count */}
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-accent/10 border border-accent/30">
                <LayoutGrid className="w-4 h-4 text-accent" />
              </div>
              <div>
                <p className="text-xs text-text-muted">{t.board_stat_lists}</p>
                <p className="text-sm font-medium text-text-primary">{lists.length}</p>
              </div>
            </div>

            {/* Cards Count */}
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-success/10 border border-success/30">
                <FileText className="w-4 h-4 text-success" />
              </div>
              <div>
                <p className="text-xs text-text-muted">{t.board_stat_cards}</p>
                <p className="text-sm font-medium text-text-primary">
                  {filteredCardsByList ? (
                    <>
                      <span className="text-accent">{filteredTotal}</span>
                      <span className="text-text-muted text-xs"> / {totalCards}</span>
                    </>
                  ) : (
                    totalCards
                  )}
                </p>
              </div>
            </div>

            {/* Active Users */}
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-warning/10 border border-warning/30">
                <Users className="w-4 h-4 text-warning" />
              </div>
              <div className="flex items-center gap-2">
                <div>
                  <p className="text-xs text-text-muted">{t.board_stat_active}</p>
                  <p className="text-sm font-medium text-text-primary">{activeUsers.length}</p>
                </div>
                <ActiveUsers users={activeUsers} maxVisible={5} showCount={false} size="sm" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="flex items-center border border-border bg-surface">
              {(
                [
                  { view: 'kanban', icon: Kanban, label: t.view_kanban },
                  { view: 'table', icon: Table2, label: t.view_table },
                  { view: 'calendar', icon: CalendarDays, label: t.view_calendar },
                  { view: 'timeline', icon: GanttChart, label: t.view_timeline },
                ] as const
              ).map(({ view, icon: Icon, label }) => (
                <button
                  key={view}
                  onClick={() => handleViewChange(view)}
                  title={label}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono transition-colors ${
                    currentView === view
                      ? 'bg-accent text-white'
                      : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Row - Filters */}
        <div className="px-6 py-3">
          <BoardFilters
            filters={filters}
            onChange={setFilters}
            members={boardMembers}
            labels={boardLabels}
            totalCards={totalCards}
            filteredCards={filteredTotal}
          />
        </div>
      </header>

      {/* Board Content */}
      {currentView === 'table' ? (
        <div className="flex-1 overflow-auto">
          <BoardTableView
            lists={lists}
            filteredCards={filteredCardsByList}
            onCardClick={(card) => useCardStore.getState().setSelectedCard(card)}
          />
        </div>
      ) : currentView === 'calendar' ? (
        <div className="flex-1 overflow-auto">
          <BoardCalendarView
            lists={lists}
            filteredCards={filteredCardsByList}
            onCardClick={(card) => useCardStore.getState().setSelectedCard(card)}
          />
        </div>
      ) : currentView === 'timeline' ? (
        <div className="flex-1 overflow-auto">
          <BoardTimelineView
            boardId={boardId}
            lists={lists}
            filteredCards={filteredCardsByList}
            onCardClick={(card) => useCardStore.getState().setSelectedCard(card)}
          />
        </div>
      ) : (
        /* Kanban (default) */
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="h-full p-6">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
              modifiers={[restrictToWindowEdges]}
            >
              <div className="flex gap-6 min-w-min h-full">
                <SortableContext
                  items={lists.map((list: List) => list.id)}
                  strategy={horizontalListSortingStrategy}
                >
                  {lists
                    .sort((a: List, b: List) => a.position - b.position)
                    .map((list: List) => (
                      <BoardList
                        key={list.id}
                        list={list}
                        filteredCards={
                          filteredCardsByList ? (filteredCardsByList[list.id] ?? []) : undefined
                        }
                      />
                    ))}
                </SortableContext>

                {/* Add List Button - Solo OWNER y ADMIN */}
                {canEditBoard && <AddListButton boardId={boardId} />}
              </div>

              <DragOverlay>
                {activeList ? (
                  <div className="w-80 opacity-60 rotate-2">
                    <div className="bg-card border border-border p-4">
                      <div className="text-center text-text-primary">
                        {t.board_drag_moving_list(activeList.name)}
                      </div>
                    </div>
                  </div>
                ) : activeCard ? (
                  <div className="w-80 opacity-80 rotate-3">
                    <div className="bg-card border-2 border-accent p-3 shadow-xl">
                      <div className="text-sm text-text-primary">{activeCard.title}</div>
                      <div className="text-xs text-text-muted mt-1">{t.board_drag_moving_card}</div>
                    </div>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        </div>
      )}

      <CardDetailModal />
    </div>
  );
}
