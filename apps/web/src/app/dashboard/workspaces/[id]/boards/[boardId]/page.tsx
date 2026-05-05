// apps/web/src/app/dashboard/workspaces/[id]/boards/[boardId]/page.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useBoardStore } from '@/stores/boardStore';
import { useCardStore } from '@/stores/cardStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useProjectStore } from '@/stores/projectStore';
import { apiService } from '@/services/apiService';
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
import { getAvatarUrl } from '@/lib/utils/avatar';
import {
  ActivityLogEntry,
  getEventDescription,
  formatRelativeTime,
} from '@/lib/utils/activityLog';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { restrictToWindowEdges } from '@dnd-kit/modifiers';
import {
  ArrowLeft,
  LayoutGrid,
  FileText,
  Users,
  GitBranch,
  Table2,
  Kanban,
  FolderOpen,
} from 'lucide-react';
import { useT } from '@/lib/i18n';
import type { BoardView } from '@aether/types';
import { BoardTableView } from '@/components/BoardTableView';
import { C } from '@/lib/colors';

// ── Helpers ────────────────────────────────────────────────────────────────────
function getRoleMeta(role: string, t: { role_owner: string; role_admin: string; role_member: string; role_viewer: string }) {
  if (role === 'OWNER')  return { label: t.role_owner,  color: '#f59e0b' };
  if (role === 'ADMIN')  return { label: t.role_admin,  color: '#10b981' };
  if (role === 'VIEWER') return { label: t.role_viewer, color: '#6b7280' };
  return                        { label: t.role_member, color: '#a5b4fc' };
}

export default function BoardPage() {
  const t = useT();
  const params = useParams();
  const router = useRouter();

  const workspaceId = params.id as string;
  const boardId = params.boardId as string;

  const { currentWorkspace, fetchWorkspaceById, fetchMembers, currentMembers } = useWorkspaceStore();
  const userRole = currentWorkspace?.userRole;

  const canEditBoard  = userRole === 'ADMIN' || userRole === 'OWNER';
  const canMoveCards  = userRole === 'OWNER' || userRole === 'ADMIN' || userRole === 'MEMBER';

  const {
    board: currentBoard,
    lists,
    isLoading,
    error: boardError,
    isConnected,
    activeUsers,
    refresh,
  } = useRealtimeBoard(boardId, {
    onConnect: () => {},
    onDisconnect: () => {},
  });

  const toast = useRealtimeToast();

  const { reorderList } = useBoardStore();
  const { cards, setCards, moveCard, setCurrentWorkspaceId, clearAllCards } = useCardStore();
  const { preferences, loadPreferences, updatePreferences } = usePreferencesStore();

  const { fetchProjectsByWorkspace } = useProjectStore();
  const [parentProject, setParentProject] = useState<{ id: string; name: string; color?: string | null } | null>(null);

  const [activeId,    setActiveId]    = useState<string | null>(null);
  const [activeType,  setActiveType]  = useState<'list' | 'card' | null>(null);
  const [filters,     setFilters]     = useState<BoardFilterState>(EMPTY_FILTERS);
  const [currentView, setCurrentView] = useState<BoardView>('kanban');
  const [viewInitialized, setViewInitialized] = useState(false);
  const [recentActivity, setRecentActivity] = useState<ActivityLogEntry[]>([]);

  const handleViewChange = async (view: BoardView) => {
    setCurrentView(view);
    try { await updatePreferences({ defaultBoardView: view }); } catch {}
  };

  // ── Derived members + labels ──────────────────────────────────────────────
  const allCards = useMemo(() => Object.values(cards).flat() as Card[], [cards]);

  const boardMembers = useMemo((): User[] => {
    const seen = new Set<string>();
    const result: User[] = [];
    for (const card of allCards) {
      for (const m of card.members ?? []) {
        if (!seen.has(m.id)) { seen.add(m.id); result.push(m); }
      }
    }
    return result;
  }, [allCards]);

  const boardLabels = useMemo((): Label[] => {
    const seen = new Set<string>();
    const result: Label[] = [];
    for (const card of allCards) {
      for (const l of card.labels ?? []) {
        if (!seen.has(l.id)) { seen.add(l.id); result.push(l); }
      }
    }
    return result;
  }, [allCards]);

  // ── Filter logic ──────────────────────────────────────────────────────────
  const applyFilters = useMemo(() => {
    if (!hasActiveFilters(filters)) return null;
    return (listCards: Card[]): Card[] =>
      listCards.filter((card) => {
        if (filters.search.trim()) {
          const q = filters.search.toLowerCase();
          if (!card.title.toLowerCase().includes(q) && !(card.description?.toLowerCase().includes(q) ?? false)) return false;
        }
        if (filters.priorities.length > 0 && (!card.priority || !filters.priorities.includes(card.priority as any))) return false;
        if (filters.memberIds.length > 0) {
          const ids = (card.members ?? []).map((m) => m.id);
          if (!filters.memberIds.some((id) => ids.includes(id))) return false;
        }
        if (filters.labelIds.length > 0) {
          const ids = (card.labels ?? []).map((l) => l.id);
          if (!filters.labelIds.some((id) => ids.includes(id))) return false;
        }
        if (filters.dates.length > 0) {
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 7);
          const dueDate = card.dueDate ? new Date(card.dueDate) : null;
          const matches = filters.dates.some((d) => {
            if (d === 'no_date') return !dueDate;
            if (!dueDate) return false;
            const due = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
            if (d === 'overdue')   return !card.completed && due < today;
            if (d === 'due_today') return due.getTime() === today.getTime();
            if (d === 'due_week')  return due >= today && due <= weekEnd;
            return false;
          });
          if (!matches) return false;
        }
        return true;
      });
  }, [filters]);

  const filteredCardsByList = useMemo((): Record<string, Card[]> | null => {
    if (!applyFilters) return null;
    const result: Record<string, Card[]> = {};
    for (const [listId, listCards] of Object.entries(cards)) {
      result[listId] = applyFilters(listCards as Card[]);
    }
    return result;
  }, [applyFilters, cards]);

  const totalCards = useMemo(
    () => Object.values(cards).reduce((sum, lc) => sum + lc.length, 0),
    [cards]
  );
  const filteredTotal = useMemo(
    () => filteredCardsByList
      ? Object.values(filteredCardsByList).reduce((sum, lc) => sum + lc.length, 0)
      : totalCards,
    [filteredCardsByList, totalCards]
  );

  const sensors = useSensors(
    useSensor(MouseSensor,    { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,    { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => { loadPreferences(); }, [loadPreferences]);

  useEffect(() => {
    if (preferences && !viewInitialized) {
      const v = preferences.defaultBoardView;
      setCurrentView(v === 'table' ? 'table' : 'kanban');
      setViewInitialized(true);
    }
  }, [preferences, viewInitialized]);

  useEffect(() => {
    if (!workspaceId) return;
    clearAllCards();
    setCurrentWorkspaceId(workspaceId);
    if (!currentWorkspace || currentWorkspace.id !== workspaceId) {
      fetchWorkspaceById(workspaceId);
    }
    fetchMembers(workspaceId);
  }, [workspaceId, setCurrentWorkspaceId, clearAllCards, fetchWorkspaceById, fetchMembers, currentWorkspace?.id]);

  // Buscar proyecto padre de esta board
  useEffect(() => {
    if (!workspaceId || !boardId) return;
    fetchProjectsByWorkspace(workspaceId).then((projects) => {
      const found = projects.find((p) => p.boards?.some((b) => b.id === boardId));
      setParentProject(found ? { id: found.id, name: found.name, color: found.color } : null);
    });
  }, [workspaceId, boardId, fetchProjectsByWorkspace]);

  useEffect(() => {
    if (!workspaceId) return;
    apiService
      .get<{ events: ActivityLogEntry[] }>(`/api/workspaces/${workspaceId}/activity?limit=30`, true)
      .then((r) => { if (r.success && r.data) setRecentActivity(r.data.events); });
  }, [workspaceId]);

  useEffect(() => {
    if (lists.length === 0) return;
    const loadCards = async () => {
      const results = await Promise.all(
        lists.map(async (list) => {
          try {
            const res = await apiService.get<{ cards: any[] }>(`/api/lists/${list.id}/cards`, true);
            return { listId: list.id, cards: res.success ? (res.data?.cards || []) : [] };
          } catch {
            return { listId: list.id, cards: [] };
          }
        })
      );
      results.forEach(({ listId, cards: c }) => setCards(listId, c));
    };
    loadCards();
  }, [lists, setCards]);

  // ── DnD ──────────────────────────────────────────────────────────────────
  const handleBack = () => router.push(`/dashboard/workspaces/${workspaceId}`);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const d = active.data.current;
    if (d?.type === 'list' && !canEditBoard) return;
    if (d?.type === 'card' && !canMoveCards) return;
    setActiveId(active.id as string);
    setActiveType(d?.type);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null); setActiveType(null);
    if (!over) return;

    const activeData = active.data.current;
    const overData   = over.data.current;

    if (activeData?.type === 'list' && overData?.type === 'list') {
      if (!canEditBoard) { toast.error(t.board_toast_no_permission_lists); return; }
      const aid = active.id as string, oid = over.id as string;
      if (aid === oid) return;
      const sorted = [...lists].sort((a: List, b: List) => a.position - b.position);
      const oldIdx = sorted.findIndex((l: List) => l.id === aid);
      const newIdx = sorted.findIndex((l: List) => l.id === oid);
      if (oldIdx === -1 || newIdx === -1) return;
      let newPos: number;
      if (newIdx === 0) newPos = sorted[0].position - 1;
      else if (newIdx === sorted.length - 1) newPos = sorted[sorted.length - 1].position + 1;
      else if (newIdx > oldIdx) newPos = (sorted[newIdx].position + sorted[newIdx + 1].position) / 2;
      else newPos = (sorted[newIdx - 1].position + sorted[newIdx].position) / 2;
      try { await reorderList(aid, newPos); toast.success(t.board_toast_list_reordered); }
      catch { toast.error(t.board_toast_list_reorder_error); }

    } else if (activeData?.type === 'card') {
      if (!canMoveCards) { toast.error(t.board_toast_no_permission_cards); return; }
      const cardId = active.id as string;
      const activeCard = activeData.card;
      const fromListId = activeCard.listId;
      const blocked = (activeCard.blockedByPendingCount ?? 0) > 0 && !activeCard.completed;
      if (blocked) {
        toast.error(`No se puede mover esta tarjeta: está bloqueada por ${activeCard.blockedByPendingCount} dependencia${activeCard.blockedByPendingCount !== 1 ? 's' : ''} pendiente${activeCard.blockedByPendingCount !== 1 ? 's' : ''}.`);
        return;
      }
      let toListId = fromListId, targetPosition = 0;
      if (overData?.type === 'list') {
        toListId = overData.listId;
        targetPosition = (cards[toListId] || []).length;
      } else if (overData?.type === 'card') {
        const overCard = overData.card;
        toListId = overCard.listId;
        const overListCards = cards[toListId] || [];
        const overIndex = overListCards.findIndex((c) => c.id === over.id);
        targetPosition = overIndex >= 0 ? overIndex : 0;
      }
      const fromListCards = cards[fromListId] || [];
      const currentIndex = fromListCards.findIndex((c) => c.id === cardId);
      if (fromListId === toListId && currentIndex === targetPosition) return;

      moveCard(cardId, fromListId, toListId, targetPosition);
      try {
        const response = await apiService.put(`/api/cards/${cardId}/move`, { toListId, position: targetPosition + 1 }, true);
        if (!response.success) throw new Error(response.error?.message || t.ws_board_error_delete);
        toast.moved(t.board_stat_cards, activeCard.title);
      } catch (error: any) {
        moveCard(cardId, toListId, fromListId, currentIndex);
        toast.error(t.board_toast_card_move_error(error.message));
      }
    }
  };

  const handleDragCancel = () => { setActiveId(null); setActiveType(null); };

  const activeList = activeId && activeType === 'list' ? lists.find((l: List) => l.id === activeId) : null;
  const activeCard = activeId && activeType === 'card'
    ? Object.values(cards).flat().find((c) => c.id === activeId)
    : null;

  if (!isLoading && !currentBoard) {
    return (
      <div className="flex items-center justify-center h-[60vh]" style={{ color: C.text3 }}>
        <div className="flex flex-col items-center gap-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="28" height="28" style={{ color: C.text4 }}>
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" />
          </svg>
          <span style={{ fontSize: '13px', color: C.text3 }}>{boardError || t.board_error_load}</span>
          <button
            onClick={() => refresh()}
            style={{ marginTop: '4px', fontSize: '12px', color: C.accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            {t.board_btn_retry}
          </button>
          <button
            onClick={() => router.push(`/dashboard/workspaces/${workspaceId}`)}
            style={{ fontSize: '12px', color: C.text4, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            ← Volver
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || !currentBoard) {
    return (
      <div className="flex items-center justify-center h-[60vh]" style={{ color: C.text3 }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 rounded-full border-2 animate-spin"
            style={{ borderColor: `${C.accent} transparent transparent transparent` }} />
          <span style={{ fontSize: '12px', fontFamily: 'monospace' }}>{t.board_loading}</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header style={{ borderBottom: `1px solid ${C.border}`, background: C.bg2, flexShrink: 0 }}>

        {/* Row 1: breadcrumb + title + actions */}
        <div style={{
          padding: '10px 20px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
            {/* Botón volver */}
            <button
              onClick={() => parentProject
                ? router.push(`/dashboard/projects/${parentProject.id}`)
                : handleBack()
              }
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 8px', borderRadius: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: C.text3, fontSize: '12.5px', flexShrink: 0, transition: 'background 0.1s, color 0.1s' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = C.hover; e.currentTarget.style.color = C.text2; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.text3; }}
            >
              <ArrowLeft style={{ width: '13px', height: '13px' }} />
              Volver
            </button>

            <span style={{ color: C.border2, flexShrink: 0 }}>·</span>

            {/* Board name */}
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: '15px', fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                {currentBoard.name}
              </h1>
              {currentBoard.description && (
                <p style={{ fontSize: '11.5px', color: C.text4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                  {currentBoard.description}
                </p>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {/* Indicador realtime */}
            <div
              title={isConnected ? t.board_realtime_connected : t.board_realtime_disconnected}
              style={{
                width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
                background: isConnected ? C.green : C.text4,
                boxShadow: isConnected ? `0 0 6px ${C.green}88` : 'none',
              }}
            />
            {activeUsers.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <ActiveUsers users={activeUsers} maxVisible={4} showCount={false} size="sm" />
                <span style={{ fontSize: '11px', color: C.text4 }}>{t.board_active_users(activeUsers.length)}</span>
              </div>
            )}
            <button
              onClick={() => router.push(`/dashboard/workspaces/${workspaceId}/boards/${boardId}/dependencies`)}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: C.text3, padding: '4px 9px', borderRadius: '6px', background: C.surface, border: `1px solid ${C.border}`, cursor: 'pointer', transition: 'border-color 0.1s, color 0.1s' }}
              title="Mapa de dependencias"
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.border2; e.currentTarget.style.color = C.text2; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.text3; }}
            >
              <GitBranch style={{ width: '13px', height: '13px' }} />
              <span className="hidden sm:inline">Dependencias</span>
            </button>
          </div>
        </div>

        {/* Row 2: stats + view toggle */}
        <div style={{
          padding: '8px 20px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px',
        }}>
          <div className="flex items-center gap-5 flex-wrap">
            {[
              { icon: <LayoutGrid className="w-3 h-3" />, value: lists.length,                                                          label: 'listas',   color: C.accent },
              { icon: <FileText   className="w-3 h-3" />, value: filteredCardsByList ? filteredTotal : totalCards,                       label: filteredCardsByList ? `/ ${totalCards} tarjetas` : 'tarjetas', color: C.green },
              { icon: <Users      className="w-3 h-3" />, value: currentMembers.length || activeUsers.length,                           label: 'miembros', color: C.amber  },
            ].map(({ icon, value, label, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span style={{ color }}>{icon}</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>{value}</span>
                <span style={{ fontSize: '11.5px', color: C.text4 }}>{label}</span>
              </div>
            ))}
          </div>

          <div
            className="flex items-center flex-shrink-0 rounded-[6px] p-[2px]"
            style={{ background: C.surface, border: `1px solid ${C.border}` }}
          >
            {([
              { view: 'kanban', Icon: Kanban, label: t.view_kanban },
              { view: 'table',  Icon: Table2, label: t.view_table  },
            ] as const).map(({ view, Icon, label }) => (
              <button
                key={view}
                onClick={() => handleViewChange(view)}
                title={label}
                className="flex items-center gap-1 transition-colors rounded-[4px]"
                style={{
                  padding: '4px 9px', fontSize: '12px',
                  color: currentView === view ? '#fff' : C.text3,
                  background: currentView === view ? C.accent : 'transparent',
                }}
                onMouseEnter={(e) => { if (currentView !== view) e.currentTarget.style.background = C.hover; }}
                onMouseLeave={(e) => { if (currentView !== view) e.currentTarget.style.background = 'transparent'; }}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Row 3: filters */}
        <div style={{ padding: '6px 20px' }}>
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

      {/* ── Main area: board + sidebar ──────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Board content ─────────────────────────────────────────── */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {currentView === 'table' ? (
            <div style={{ flex: 1, overflow: 'auto' }}>
              <BoardTableView
                lists={lists}
                filteredCards={filteredCardsByList}
                onCardClick={(card) => useCardStore.getState().setSelectedCard(card)}
              />
            </div>
          ) : (
            /* ── Kanban ──────────────────────────────────────────────── */
            <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden' }}>
              <div style={{ height: '100%', padding: '16px 20px' }}>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCorners}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragCancel={handleDragCancel}
                  modifiers={[restrictToWindowEdges]}
                >
                  <div style={{ display: 'flex', gap: '12px', minWidth: 'min-content', height: '100%', alignItems: 'flex-start' }}>
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
                            filteredCards={filteredCardsByList ? (filteredCardsByList[list.id] ?? []) : undefined}
                          />
                        ))}
                    </SortableContext>
                    {canEditBoard && <AddListButton boardId={boardId} />}
                  </div>

                  <DragOverlay>
                    {activeList ? (
                      <div style={{ width: '272px', opacity: 0.85, transform: 'rotate(2deg)' }}>
                        <div style={{
                          background: '#12151b', border: `1px solid ${C.accent}`,
                          borderRadius: '10px', padding: '12px 14px',
                          fontSize: '13px', fontWeight: 600, color: C.text,
                          boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
                        }}>
                          {t.board_drag_moving_list(activeList.name)}
                        </div>
                      </div>
                    ) : activeCard ? (
                      <div style={{ width: '272px', opacity: 0.9, transform: 'rotate(2deg)' }}>
                        <div style={{
                          background: C.surface, border: `1px solid ${C.accent}`,
                          borderRadius: '8px', padding: '10px 11px',
                          boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
                        }}>
                          <div style={{ fontSize: '12.5px', fontWeight: 500, color: C.text }}>{activeCard.title}</div>
                          <div style={{ fontSize: '11px', color: C.text4, marginTop: '4px' }}>{t.board_drag_moving_card}</div>
                        </div>
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>
              </div>
            </div>
          )}
        </div>

      </div>

      <CardDetailModal />
    </div>
  );
}
