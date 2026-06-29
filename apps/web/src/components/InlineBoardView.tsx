'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useBoardStore } from '@/stores/boardStore';
import { useCardStore } from '@/stores/cardStore';
import { useProjectStore } from '@/stores/projectStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { useRealtimeBoard } from '@/hooks/useRealTimeBoard';
import { useRealtimeToast } from '@/hooks/useRealtimeToast';
import BoardList from '@/components/BoardList';
import BoardFilters, { BoardFilterState, EMPTY_FILTERS, hasActiveFilters } from '@/components/BoardFilters';
import type { List, Card, User, Label } from '@aether/types';
import AddListButton from '@/components/AddListButton';
import { apiService } from '@/services/apiService';
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  MouseSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, closestCorners,
} from '@dnd-kit/core';
import {
  SortableContext, horizontalListSortingStrategy, sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { restrictToWindowEdges } from '@dnd-kit/modifiers';
import { useT } from '@/lib/i18n';
import type { BoardView } from '@aether/types';
import { BoardTableView } from '@/components/BoardTableView';
import { C } from '@/lib/colors';
import { useBoardCursors } from '@/hooks/useBoardCursors';
import { RemoteCursors } from '@/components/realtime/RemoteCursors';
import { SprintBanner } from '@/components/SprintBanner';

const SORA  = "'Sora', system-ui, sans-serif";
const MANROPE = "'Manrope', system-ui, sans-serif";

interface InlineBoardViewProps {
  boardId: string;
  onBack: () => void;
}

export function InlineBoardView({ boardId, onBack }: InlineBoardViewProps) {
  const t = useT();

  const {
    board: currentBoard, lists, isLoading,
    isConnected, activeUsers,
  } = useRealtimeBoard(boardId, { onConnect: () => {}, onDisconnect: () => {} });

  const workspaceId = currentBoard?.workspaceId ?? '';
  const toast = useRealtimeToast();

  const { reorderList, updateBoard }                             = useBoardStore();
  const { patchBoard }                                           = useProjectStore();
  const { cards, setCards, moveCard, setCurrentWorkspaceId, clearAllCards } = useCardStore();
  const { preferences, loadPreferences, updatePreferences }     = usePreferencesStore();
  const { currentWorkspace, fetchWorkspaceById, fetchMembers }  = useWorkspaceStore();

  const userRole    = currentWorkspace?.userRole;
  const canEditBoard = userRole === 'ADMIN' || userRole === 'OWNER';
  const canMoveCards = userRole === 'OWNER' || userRole === 'ADMIN' || userRole === 'MEMBER';

  const [activeId,         setActiveId]         = useState<string | null>(null);
  const [activeType,       setActiveType]       = useState<'list' | 'card' | null>(null);
  const [filters,          setFilters]          = useState<BoardFilterState>(EMPTY_FILTERS);
  const [currentView,      setCurrentView]      = useState<BoardView>('kanban');
  const [viewInitialized,  setViewInitialized]  = useState(false);
  const [search,           setSearch]           = useState('');
  const [showFilters,      setShowFilters]      = useState(false);
  const [showEditBoard,    setShowEditBoard]    = useState(false);

  const [kanbanEl, setKanbanEl] = useState<HTMLDivElement | null>(null);
  const kanbanCallbackRef       = useCallback((el: HTMLDivElement | null) => setKanbanEl(el), []);
  const { cursors: remoteCursors } = useBoardCursors(boardId, kanbanEl);

  const handleViewChange = async (view: BoardView) => {
    setCurrentView(view);
    try { await updatePreferences({ defaultBoardView: view }); } catch {}
  };

  // ── Derived ──────────────────────────────────────────────────────────────────
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

  // ── Filters ───────────────────────────────────────────────────────────────────
  const applyFilters = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!hasActiveFilters(filters) && !q) return null;
    return (listCards: Card[]): Card[] =>
      listCards.filter((card) => {
        if (q && !card.title.toLowerCase().includes(q) && !(card.description?.toLowerCase().includes(q) ?? false)) return false;
        if (filters.search.trim()) {
          const fs = filters.search.toLowerCase();
          if (!card.title.toLowerCase().includes(fs) && !(card.description?.toLowerCase().includes(fs) ?? false)) return false;
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
          const today = new Date(); today.setHours(0, 0, 0, 0);
          const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 7);
          const dueDate = card.dueDate ? new Date(card.dueDate) : null;
          const matches = filters.dates.some((d) => {
            if (d === 'no_date') return !dueDate;
            if (!dueDate) return false;
            const due = new Date(dueDate); due.setHours(0, 0, 0, 0);
            if (d === 'overdue')   return !card.completed && due < today;
            if (d === 'due_today') return due.getTime() === today.getTime();
            if (d === 'due_week')  return due >= today && due <= weekEnd;
            return false;
          });
          if (!matches) return false;
        }
        return true;
      });
  }, [filters, search]);

  const filteredCardsByList = useMemo((): Record<string, Card[]> | null => {
    if (!applyFilters) return null;
    const result: Record<string, Card[]> = {};
    for (const [listId, listCards] of Object.entries(cards)) {
      result[listId] = applyFilters(listCards as Card[]);
    }
    return result;
  }, [applyFilters, cards]);

  const totalCards    = useMemo(() => Object.values(cards).reduce((s, lc) => s + lc.length, 0), [cards]);
  const filteredTotal = useMemo(() => filteredCardsByList
    ? Object.values(filteredCardsByList).reduce((s, lc) => s + lc.length, 0)
    : totalCards,
  [filteredCardsByList, totalCards]);

  // ── DnD ──────────────────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(MouseSensor,    { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,    { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const d = event.active.data.current;
    if (d?.type === 'list' && !canEditBoard) return;
    if (d?.type === 'card' && !canMoveCards) return;
    setActiveId(event.active.id as string);
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
      const cardId    = active.id as string;
      const activeCard = activeData.card;
      const fromListId = activeCard.listId;
      if ((activeCard.blockedByPendingCount ?? 0) > 0 && !activeCard.completed) {
        toast.error(`Bloqueada por ${activeCard.blockedByPendingCount} dependencia(s) pendiente(s).`);
        return;
      }
      let toListId = fromListId, targetPosition = 0;
      if (overData?.type === 'list') {
        toListId = overData.listId;
        targetPosition = (cards[toListId] || []).length;
      } else if (overData?.type === 'card') {
        toListId = overData.card.listId;
        const overListCards = cards[toListId] || [];
        const overIndex = overListCards.findIndex((c) => c.id === over.id);
        targetPosition = overIndex >= 0 ? overIndex : 0;
      }
      const fromListCards = cards[fromListId] || [];
      const currentIndex = fromListCards.findIndex((c) => c.id === cardId);
      if (fromListId === toListId && currentIndex === targetPosition) return;
      moveCard(cardId, fromListId, toListId, targetPosition);
      try {
        const res = await apiService.put(`/api/cards/${cardId}/move`, { toListId, position: targetPosition + 1 }, true);
        if (!res.success) throw new Error(res.error?.message || t.ws_board_error_delete);
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
    ? (Object.values(cards).flat() as Card[]).find((c) => c.id === activeId)
    : null;

  // ── Effects ───────────────────────────────────────────────────────────────────
  useEffect(() => { loadPreferences(); }, [loadPreferences]);

  useEffect(() => {
    if (preferences && !viewInitialized) {
      setCurrentView(preferences.defaultBoardView === 'table' ? 'table' : 'kanban');
      setViewInitialized(true);
    }
  }, [preferences, viewInitialized]);

  useEffect(() => {
    if (!workspaceId) return;
    clearAllCards();
    setCurrentWorkspaceId(workspaceId);
    if (!currentWorkspace || currentWorkspace.id !== workspaceId) fetchWorkspaceById(workspaceId);
    fetchMembers(workspaceId);
  }, [workspaceId, setCurrentWorkspaceId, clearAllCards, fetchWorkspaceById, fetchMembers, currentWorkspace?.id]);

  useEffect(() => {
    if (!lists.length) return;
    const load = async () => {
      const results = await Promise.all(
        lists.map(async (list) => {
          try {
            const res = await apiService.get<{ cards: any[] }>(`/api/lists/${list.id}/cards`, true);
            return { listId: list.id, cards: res.success ? (res.data?.cards ?? []) : [] };
          } catch { return { listId: list.id, cards: [] }; }
        })
      );
      results.forEach(({ listId, cards: c }) => setCards(listId, c));
    };
    load();
  }, [lists, setCards]);

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (isLoading || !currentBoard) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '280px' }}>
        <style>{`@keyframes ibv-spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '26px', height: '26px', borderRadius: '50%', margin: '0 auto 12px',
            border: `2px solid ${C.accent}`, borderTopColor: 'transparent',
            animation: 'ibv-spin 0.7s linear infinite',
          }} />
          <p style={{ fontSize: '12.5px', color: C.text4 }}>Cargando tablero…</p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
    <div style={{ animation: 'boardRise .45s cubic-bezier(.4,0,.2,1) backwards' }}>
      <style>{`
        @keyframes boardRise { 0% { opacity:0; transform:translateY(14px); } 100% { opacity:1; transform:translateY(0); } }
        .ibv-scroll { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.15) transparent; }
        .ibv-scroll::-webkit-scrollbar { height: 8px; }
        .ibv-scroll::-webkit-scrollbar-track { background: transparent; margin: 0 6px; }
        .ibv-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.14); border-radius: 999px; border: 2px solid transparent; background-clip: padding-box; }
        .ibv-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.28); border: 2px solid transparent; background-clip: padding-box; }
        .ibv-search::placeholder { color: #827A6D; }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap',
        marginBottom: '20px', paddingBottom: '16px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>

        {/* Back breadcrumb */}
        <button
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: '13.5px', color: '#9C9486', cursor: 'pointer',
            background: 'none', border: 'none', padding: 0,
            transition: 'color 0.12s', fontFamily: MANROPE, flexShrink: 0,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#E8E1D2')}
          onMouseLeave={e => (e.currentTarget.style.color = '#9C9486')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Tableros
        </button>

        <span style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />

        {/* Board name + edit */}
        <span style={{ fontFamily: SORA, fontSize: '1.05rem', fontWeight: 600, color: '#F4EEE2', flexShrink: 0 }}>
          {currentBoard.name}
        </span>

        {canEditBoard && (
          <button
            onClick={() => setShowEditBoard(true)}
            title="Editar tablero"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '26px', height: '26px', borderRadius: '7px',
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#615846', flexShrink: 0,
              transition: 'color 0.12s, background 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#E8E1D2'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#615846'; e.currentTarget.style.background = 'none'; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        )}

        {/* Connected users + online indicator */}
        {isConnected && activeUsers.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            {/* Overlapping avatar circles for each online user */}
            <div style={{ display: 'flex' }}>
              {activeUsers.slice(0, 5).map((u, i) => (
                <span
                  key={u.id}
                  title={u.name}
                  style={{
                    width: '26px', height: '26px', borderRadius: '50%',
                    border: '2px solid #161B2E',
                    marginLeft: i === 0 ? 0 : '-6px',
                    position: 'relative', zIndex: 10 - i,
                    flexShrink: 0, overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: u.avatar ? 'transparent' : `hsl(${(u.id.charCodeAt(0) * 37) % 360},48%,42%)`,
                    fontSize: '9px', fontWeight: 700, color: '#fff',
                  }}
                >
                  {u.avatar
                    ? <img src={u.avatar} alt={u.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                    : u.name.charAt(0).toUpperCase()
                  }
                  {/* Green online dot */}
                  <span style={{
                    position: 'absolute', right: '-1px', bottom: '-1px',
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: '#76A878', border: '1.5px solid #161B2E',
                  }} />
                </span>
              ))}
            </div>
            {/* Count label */}
            <span style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              fontSize: '12px', color: '#9FC59A',
              background: 'rgba(118,168,120,0.1)', padding: '3px 9px', borderRadius: '7px',
            }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#76A878', flexShrink: 0 }} />
              {activeUsers.length === 1 ? 'En línea' : `${activeUsers.length} en línea`}
            </span>
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '9px',
          padding: '8px 14px', borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.09)',
          background: 'rgba(255,255,255,0.03)',
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="#827A6D" strokeWidth="1.8"/>
            <path d="m20 20-3-3" stroke="#827A6D" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <input
            className="ibv-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar tarjetas"
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              fontSize: '13px', color: '#E8E1D2', minWidth: '120px',
              fontFamily: MANROPE,
            }}
          />
        </div>

        {/* Filters toggle */}
        <button
          onClick={() => setShowFilters(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '7px 12px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.09)',
            background: showFilters || hasActiveFilters(filters) ? 'rgba(242,87,30,0.1)' : 'rgba(255,255,255,0.03)',
            color: showFilters || hasActiveFilters(filters) ? '#F2571E' : '#9C9486',
            fontSize: '12.5px', fontFamily: MANROPE, cursor: 'pointer',
            transition: 'all 0.12s',
          }}
          onMouseEnter={e => { if (!showFilters && !hasActiveFilters(filters)) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#C8BFAE'; } }}
          onMouseLeave={e => { if (!showFilters && !hasActiveFilters(filters)) { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = '#9C9486'; } }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M4 6h16M7 12h10M10 18h4"/>
          </svg>
          Filtros
          {hasActiveFilters(filters) && (
            <span style={{
              width: '16px', height: '16px', borderRadius: '50%', background: '#F2571E',
              color: '#fff', fontSize: '10px', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>!</span>
          )}
        </button>

        {/* View toggle */}
        <div style={{
          display: 'flex', gap: '2px', padding: '3px',
          borderRadius: '8px', background: 'rgba(255,255,255,0.05)',
        }}>
          {([
            { view: 'kanban' as const, label: 'Kanban',
              icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="5" height="16" rx="1.4" stroke="currentColor" strokeWidth="1.8"/><rect x="10" y="4" width="5" height="11" rx="1.4" stroke="currentColor" strokeWidth="1.8"/><rect x="17" y="4" width="5" height="13" rx="1.4" stroke="currentColor" strokeWidth="1.8"/></svg> },
            { view: 'table'  as const, label: 'Tabla',
              icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2.5" stroke="currentColor" strokeWidth="1.8"/><path d="M3 9h18M9 9v12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg> },
          ]).map(({ view, label, icon }) => (
            <button
              key={view}
              onClick={() => handleViewChange(view)}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '5px 11px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                background: currentView === view ? 'rgba(255,255,255,0.12)' : 'transparent',
                color: currentView === view ? '#E8E1D2' : '#827A6D',
                fontSize: '12.5px', fontFamily: MANROPE,
                fontWeight: currentView === view ? 600 : 400,
                transition: 'all 0.12s',
              }}
              onMouseEnter={e => { if (currentView !== view) (e.currentTarget.style.color = '#C8BFAE'); }}
              onMouseLeave={e => { if (currentView !== view) (e.currentTarget.style.color = '#827A6D'); }}
            >
              {icon} {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Advanced filters panel ──────────────────────────────────────── */}
      {showFilters && (
        <div style={{ marginBottom: '14px' }}>
          <BoardFilters
            filters={filters}
            onChange={setFilters}
            members={boardMembers}
            labels={boardLabels}
            totalCards={totalCards}
            filteredCards={filteredTotal}
          />
        </div>
      )}

      {/* ── Sprint banner ────────────────────────────────────────────────── */}
      <div style={{ margin: '0 -20px 16px', overflow: 'hidden' }}>
        <SprintBanner boardId={boardId} canEdit={canEditBoard} />
      </div>

      {/* ── Board content ───────────────────────────────────────────────── */}
      {currentView === 'table' ? (
        <div style={{
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '8px', overflow: 'hidden',
        }}>
          <BoardTableView
            lists={lists}
            filteredCards={filteredCardsByList}
            onCardClick={(card) => useCardStore.getState().setSelectedCard(card)}
          />
        </div>
      ) : (
        /* ── Kanban ──────────────────────────────────────────────────────── */
        <div ref={kanbanCallbackRef} className="ibv-scroll" style={{ overflowX: 'auto', overflowY: 'visible', position: 'relative', paddingBottom: '16px' }}>
          <RemoteCursors cursors={remoteCursors} />
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
            modifiers={[restrictToWindowEdges]}
          >
            <div style={{ display: 'flex', gap: '16px', minWidth: 'min-content', alignItems: 'flex-start' }}>
              <SortableContext
                items={lists.map((l: List) => l.id)}
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
                  <div style={{ background: C.bg2, border: `1px solid ${C.accent}`, borderRadius: '10px', padding: '12px 14px', fontSize: '13px', fontWeight: 600, color: C.text, boxShadow: '0 16px 40px rgba(0,0,0,0.5)' }}>
                    {t.board_drag_moving_list(activeList.name)}
                  </div>
                </div>
              ) : activeCard ? (
                <div style={{ width: '272px', opacity: 0.9, transform: 'rotate(2deg)' }}>
                  <div style={{ background: C.surface, border: `1px solid ${C.accent}`, borderRadius: '8px', padding: '10px 11px', boxShadow: '0 16px 40px rgba(0,0,0,0.5)' }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 500, color: C.text }}>{activeCard.title}</div>
                    <div style={{ fontSize: '11px', color: C.text4, marginTop: '4px' }}>{t.board_drag_moving_card}</div>
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      )}

    </div>

    {showEditBoard && (
      <EditBoardModal
        name={currentBoard.name}
        description={currentBoard.description ?? ''}
        onSave={async (name, desc) => {
          await updateBoard(boardId, { name, description: desc || undefined });
          patchBoard(boardId, { name: name.trim(), description: desc.trim() || undefined });
          setShowEditBoard(false);
        }}
        onClose={() => setShowEditBoard(false)}
      />
    )}
    </>
  );
}

// ── Edit Board Modal ───────────────────────────────────────────────────────────
function EditBoardModal({ name: initialName, description: initialDesc, onSave, onClose }: {
  name: string;
  description: string;
  onSave: (name: string, desc: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name,    setName]    = useState(initialName);
  const [desc,    setDesc]    = useState(initialDesc);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [closing, setClosing] = useState(false);

  const handleClose = () => {
    if (saving) return;
    setClosing(true);
    setTimeout(onClose, 150);
  };

  const submit = async () => {
    if (!name.trim()) { setError('El nombre del tablero es obligatorio'); return; }
    setSaving(true);
    try {
      await onSave(name.trim(), desc.trim());
    } catch (e: any) {
      setError(e?.message || 'No se pudo guardar');
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        animation: `${closing ? 'ebOvOut' : 'ebOvIn'} 0.2s ease forwards`,
      }}
      onClick={handleClose}
    >
      <style>{`
        @keyframes ebOvIn   { from { opacity:0 } to { opacity:1 } }
        @keyframes ebOvOut  { from { opacity:1 } to { opacity:0 } }
        @keyframes ebPnIn   { from { opacity:0; transform:translateY(14px) scale(0.96) } to { opacity:1; transform:translateY(0) scale(1) } }
        @keyframes ebPnOut  { from { opacity:1; transform:translateY(0) scale(1) } to { opacity:0; transform:translateY(8px) scale(0.98) } }
        .eb-input:focus { border-color: #9C9486 !important; }
      `}</style>

      <div
        style={{
          width: '420px', maxWidth: 'calc(100vw - 32px)',
          background: C.surface, border: `1px solid ${C.border2}`,
          borderRadius: '12px', overflow: 'hidden',
          boxShadow: '0 32px 80px rgba(0,0,0,0.65)',
          animation: closing ? 'ebPnOut 0.15s ease forwards' : 'ebPnIn 0.3s cubic-bezier(0.16,1,0.3,1) both',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', fontWeight: 600, color: C.text, fontFamily: SORA }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.text3} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Editar tablero
          </span>
          <button
            onClick={handleClose}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: '7px', background: 'none', border: 'none', cursor: 'pointer', color: C.text3, transition: 'background 0.12s, color 0.12s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = C.text; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = C.text3; }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Fields */}
        <div style={{ padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {[
            { label: 'Nombre *',    value: name, onChange: setName,
              node: <input autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submit(); }} className="eb-input"
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', fontSize: '13px', background: C.bg2, border: `1px solid ${C.border2}`, color: C.text, outline: 'none', boxSizing: 'border-box' as const, fontFamily: MANROPE, transition: 'border-color 0.15s' }} />
            },
            { label: 'Descripción', value: desc, onChange: setDesc,
              node: <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} placeholder="Opcional" className="eb-input"
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', fontSize: '13px', background: C.bg2, border: `1px solid ${C.border2}`, color: C.text, outline: 'none', resize: 'none', boxSizing: 'border-box' as const, fontFamily: MANROPE, transition: 'border-color 0.15s' }} />
            },
          ].map(({ label, node }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.07em', color: C.text4, textTransform: 'uppercase', fontFamily: SORA }}>{label}</label>
              {node}
            </div>
          ))}
          {error && <p style={{ margin: 0, fontSize: '11.5px', color: '#E05252' }}>{error}</p>}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 18px', borderTop: `1px solid ${C.border}` }}>
          <button
            onClick={handleClose}
            style={{ padding: '9px 16px', borderRadius: '8px', fontSize: '13px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#D8D0C1', cursor: 'pointer' }}
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving}
            style={{ padding: '9px 18px', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, background: '#F2571E', color: '#24180A', border: 'none', cursor: 'pointer', fontFamily: SORA, opacity: saving ? 0.75 : 1 }}
          >
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}
