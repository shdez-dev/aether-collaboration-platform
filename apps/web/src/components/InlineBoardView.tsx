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
            { view: 'table'    as const, label: 'Tabla',
              icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2.5" stroke="currentColor" strokeWidth="1.8"/><path d="M3 9h18M9 9v12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg> },
          { view: 'timeline' as const, label: 'Gantt',
              icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 7h8M3 12h14M3 17h5"/></svg> },
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
      ) : currentView === 'timeline' ? (
        <BoardGantt boardId={boardId} lists={lists} cards={cards} />
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

// ── Board Gantt ───────────────────────────────────────────────────────────────
function BoardGantt({ boardId, lists, cards }: {
  boardId: string;
  lists: List[];
  cards: Record<string, Card[]>;
}) {
  const [depEdges,  setDepEdges]  = useState<{ blockingCardId: string; blockedCardId: string }[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [tooltip,   setTooltip]   = useState<{
    x: number; y: number; title: string; subtitle: string; color: string; date?: string; range?: string;
  } | null>(null);
  const setSelectedCard = useCardStore((s) => s.setSelectedCard);

  useEffect(() => {
    setLoading(true);
    apiService.get<{ graph: { edges: { blockingCardId: string; blockedCardId: string }[] } }>(
      `/api/boards/${boardId}/dependency-graph`, true
    ).then((r) => {
      if (r.success && r.data) setDepEdges(r.data.graph.edges ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [boardId]);

  const allCards    = useMemo(() => Object.values(cards).flat() as Card[], [cards]);
  const sortedLists = useMemo(() => [...lists].sort((a, b) => a.position - b.position), [lists]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0' }}>
        <style>{`@keyframes bg-spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.08)', borderTopColor: C.accent, borderRadius: '50%', animation: 'bg-spin 0.7s linear infinite' }} />
      </div>
    );
  }

  const allDates: number[] = allCards.flatMap((c) =>
    [c.dueDate, c.startDate].filter(Boolean).map((d) => new Date(d!).getTime())
  );

  if (allDates.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '40px 0', borderRadius: '10px', border: `1px dashed ${C.border2}` }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.text4} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
        </svg>
        <p style={{ margin: 0, fontSize: '12.5px', color: C.text3 }}>Sin fechas asignadas</p>
        <p style={{ margin: 0, fontSize: '11.5px', color: C.text4, textAlign: 'center', maxWidth: '260px' }}>
          Asigna fechas de inicio y fin a las tarjetas para ver el Gantt
        </p>
      </div>
    );
  }

  // ── Layout ───────────────────────────────────────────────────────────────
  const MS_PER_DAY = 86400000;
  const rawMin     = new Date(Math.min(...allDates));
  const rawMax     = new Date(Math.max(...allDates));
  const rangeStart = new Date(rawMin.getFullYear(), rawMin.getMonth(), 1);
  const rangeEnd   = new Date(rawMax.getFullYear(), rawMax.getMonth() + 1, 0);
  const baseDays   = Math.max(1, Math.round((rangeEnd.getTime() - rangeStart.getTime()) / MS_PER_DAY) + 1);

  const maxBufDays = allCards.reduce((max, c) => {
    if (!c.startDate || !c.dueDate) return max;
    const dur = Math.max(1, Math.round((new Date(c.dueDate).getTime() - new Date(c.startDate).getTime()) / MS_PER_DAY));
    const buf = c.bufferDays != null ? c.bufferDays : Math.max(1, Math.round(dur * (c.priority === 'HIGH' ? 0.5 : c.priority === 'MEDIUM' ? 0.3 : 0.15)));
    return Math.max(max, buf);
  }, 0);

  const totalDays = baseDays + maxBufDays + 3;
  const DAY_W     = baseDays <= 60 ? 32 : baseDays <= 120 ? 22 : baseDays <= 240 ? 16 : 12;
  const TRACK_W   = totalDays * DAY_W;

  function dayX(d: Date) {
    return Math.round((d.getTime() - rangeStart.getTime()) / MS_PER_DAY * DAY_W);
  }

  const _now   = new Date();
  const todayX = dayX(new Date(_now.getFullYear(), _now.getMonth(), _now.getDate()));

  const monthCols: { label: string; x: number; width: number }[] = [];
  {
    const mc = new Date(rangeStart);
    while (mc <= rangeEnd) {
      const x    = dayX(mc);
      const next = new Date(mc); next.setMonth(next.getMonth() + 1, 1);
      monthCols.push({ label: mc.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase(), x, width: Math.min(dayX(next), TRACK_W) - x });
      mc.setMonth(mc.getMonth() + 1, 1);
    }
  }

  const showDow   = DAY_W >= 20;
  const DAY_HDR_H = showDow ? 34 : 26;
  const dayStep   = DAY_W >= 28 ? 1 : DAY_W >= 18 ? 3 : DAY_W >= 12 ? 7 : 14;
  const DOW_ES    = ['D','L','M','X','J','V','S'];

  const SECTION_H = 26;
  const ROW_H     = 34;
  const SIDEBAR_W = 200;
  const HEADER_H  = 28 + DAY_HDR_H;

  const PCOLOR: Record<string, string> = { HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#10b981' };

  type GRow = { kind: 'section'; name: string; listId: string } | { kind: 'card'; card: Card };

  const rows: GRow[] = [];
  const cardGeom = new Map<string, { x: number; y: number; w: number; dueOnly: boolean }>();
  {
    let y = HEADER_H;
    for (const list of sortedLists) {
      const listCards = (cards[list.id] ?? []).filter((c) => c.startDate || c.dueDate);
      if (listCards.length === 0) continue;
      rows.push({ kind: 'section', name: list.name, listId: list.id });
      y += SECTION_H;
      for (const card of listCards) {
        const sX = card.startDate ? dayX(new Date(card.startDate)) : null;
        const eX = card.dueDate   ? dayX(new Date(card.dueDate))   : null;
        const mX = eX ?? sX;
        if (mX !== null) {
          const hasRange = sX !== null && eX !== null;
          cardGeom.set(card.id, { x: hasRange ? sX! : mX, y, w: hasRange ? Math.max(DAY_W, eX! - sX!) : 0, dueOnly: !hasRange });
        }
        rows.push({ kind: 'card', card });
        y += ROW_H;
      }
    }
  }

  const cardIdSet     = new Set(allCards.map((c) => c.id));
  const filteredEdges = depEdges.filter((e) => cardIdSet.has(e.blockingCardId) && cardIdSet.has(e.blockedCardId));
  const cardById      = new Map(allCards.map((c) => [c.id, c]));

  function fmtS(d: string) {
    return new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  }

  return (
    <div style={{ position: 'relative' }} onMouseLeave={() => setTooltip(null)}>
      <style>{`
        .bg-gantt { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.18) transparent; }
        .bg-gantt::-webkit-scrollbar { height: 10px; }
        .bg-gantt::-webkit-scrollbar-track { background: transparent; margin: 0 8px; }
        .bg-gantt::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.14); border-radius: 999px; border: 2px solid transparent; background-clip: padding-box; }
        .bg-gantt::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.28); border-radius: 999px; border: 2px solid transparent; background-clip: padding-box; }
      `}</style>

      {/* Tooltip */}
      {tooltip && (
        <div style={{ position: 'fixed', zIndex: 9999, left: tooltip.x + 14, top: tooltip.y - 10, background: '#13161b', border: `1px solid ${C.border2}`, borderRadius: '8px', padding: '10px 13px', boxShadow: '0 8px 28px rgba(0,0,0,0.55)', pointerEvents: 'none', maxWidth: '260px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: (tooltip.date || tooltip.range) ? '6px' : 0 }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: tooltip.color, flexShrink: 0 }} />
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: C.text, lineHeight: 1.3 }}>{tooltip.title}</span>
          </div>
          {tooltip.subtitle && <p style={{ margin: '0 0 4px', fontSize: '11px', color: C.text3 }}>{tooltip.subtitle}</p>}
          {tooltip.range    && <p style={{ margin: 0, fontSize: '11px', color: C.text2 }}>{tooltip.range}</p>}
          {tooltip.date     && <p style={{ margin: 0, fontSize: '11px', color: C.text2 }}>{tooltip.date}</p>}
        </div>
      )}

      <div className="bg-gantt" style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', background: 'rgba(255,255,255,0.015)' }}>
        <div style={{ width: `${SIDEBAR_W + TRACK_W}px`, minWidth: '100%', position: 'relative' }}>

          {/* Month row */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.018)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ flex: 'none', width: `${SIDEBAR_W}px`, position: 'sticky', left: 0, zIndex: 11, background: '#13172A', borderRight: '1px solid rgba(255,255,255,0.08)', height: '28px', display: 'flex', alignItems: 'center', padding: '0 14px' }}>
              <span style={{ fontFamily: "'Sora', system-ui", fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#615846' }}>Tarea</span>
            </div>
            <div style={{ position: 'relative', flex: 'none', width: `${TRACK_W}px`, height: '28px' }}>
              {monthCols.map((col, i) => (
                <div key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: col.x, width: col.width, borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none', display: 'flex', alignItems: 'center', paddingLeft: '10px', overflow: 'hidden' }}>
                  <span style={{ fontFamily: "'Sora', system-ui", fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.04em', color: '#A8A09A', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{col.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Day row */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.10)', background: '#13172A' }}>
            <div style={{ flex: 'none', width: `${SIDEBAR_W}px`, position: 'sticky', left: 0, zIndex: 11, background: '#13172A', borderRight: '1px solid rgba(255,255,255,0.08)', height: `${DAY_HDR_H}px` }} />
            <div style={{ position: 'relative', flex: 'none', width: `${TRACK_W}px`, height: `${DAY_HDR_H}px` }}>
              {Array.from({ length: totalDays }).map((_, di) => {
                const d          = new Date(rangeStart.getTime() + di * MS_PER_DAY);
                const dow        = d.getDay();
                const isWeekend  = dow === 0 || dow === 6;
                const isToday    = di * DAY_W === todayX;
                const showLabel  = di % dayStep === 0;
                const isMonStart = d.getDate() === 1;
                return (
                  <div key={di} style={{ position: 'absolute', top: 0, bottom: 0, left: di * DAY_W, width: DAY_W, borderLeft: isMonStart ? '1px solid rgba(255,255,255,0.12)' : isWeekend ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(255,255,255,0.03)', background: isToday ? 'rgba(226,160,126,0.13)' : isWeekend ? 'rgba(255,255,255,0.02)' : 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1px' }}>
                    {showLabel && showDow && <span style={{ fontSize: '7.5px', fontWeight: 500, color: isToday ? '#E2A07E99' : isWeekend ? '#615846' : '#3E3830', lineHeight: 1, userSelect: 'none' as const }}>{DOW_ES[dow]}</span>}
                    {showLabel && (isToday ? (
                      <span style={{ width: DAY_W - 6, height: DAY_W - 6, maxWidth: '16px', maxHeight: '16px', minWidth: '11px', minHeight: '11px', borderRadius: '50%', background: '#E2A07E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: DAY_W < 14 ? '7px' : '8px', fontWeight: 700, color: '#1A1208', lineHeight: 1, userSelect: 'none' as const }}>{d.getDate()}</span>
                      </span>
                    ) : (
                      <span style={{ fontSize: DAY_W < 14 ? '8px' : '9.5px', fontWeight: isWeekend ? 500 : 400, color: isWeekend ? '#615846' : '#4A4540', lineHeight: 1, userSelect: 'none' as const }}>{d.getDate()}</span>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Body */}
          <div style={{ position: 'relative' }}>
            {/* Weekend + today column shading */}
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: SIDEBAR_W, width: TRACK_W, pointerEvents: 'none', zIndex: 0 }}>
              {Array.from({ length: totalDays }).map((_, di) => {
                const d         = new Date(rangeStart.getTime() + di * MS_PER_DAY);
                const dow       = d.getDay();
                const isWeekend = dow === 0 || dow === 6;
                const isToday   = di * DAY_W === todayX;
                if (!isWeekend && !isToday) return null;
                return <div key={di} style={{ position: 'absolute', top: 0, bottom: 0, left: di * DAY_W, width: DAY_W, background: isToday ? 'rgba(226,160,126,0.07)' : 'rgba(255,255,255,0.018)' }} />;
              })}
            </div>

            {rows.map((row, rIdx) => {
              if (row.kind === 'section') {
                return (
                  <div key={'s-' + row.listId} style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ flex: 'none', width: `${SIDEBAR_W}px`, position: 'sticky', left: 0, zIndex: 10, background: '#161B2E', borderRight: '1px solid rgba(255,255,255,0.07)', height: `${SECTION_H}px`, display: 'flex', alignItems: 'center', gap: '7px', padding: '0 12px' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                        <rect x="3" y="4" width="5" height="16" rx="1" stroke="#827A6D" strokeWidth="1.8"/>
                        <rect x="10" y="4" width="5" height="11" rx="1" stroke="#827A6D" strokeWidth="1.8"/>
                        <rect x="17" y="4" width="5" height="13" rx="1" stroke="#827A6D" strokeWidth="1.8"/>
                      </svg>
                      <span style={{ fontFamily: "'Sora', system-ui", fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.06em', color: '#827A6D', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</span>
                    </div>
                    <div style={{ flex: 'none', width: `${TRACK_W}px`, height: `${SECTION_H}px`, background: 'rgba(255,255,255,0.012)' }} />
                  </div>
                );
              }

              const { card }  = row;
              const hasRange  = !!(card.startDate && card.dueDate);
              const barColor  = card.completed ? '#76A878' : (PCOLOR[card.priority ?? ''] ?? C.accent);
              const isOverdue = !card.completed && card.dueDate && new Date(card.dueDate) < new Date();
              const startX    = card.startDate ? dayX(new Date(card.startDate)) : null;
              const endX2     = card.dueDate   ? dayX(new Date(card.dueDate))   : null;
              const markerX   = endX2 ?? startX;
              const barPx     = hasRange && startX !== null && endX2 !== null ? Math.max(DAY_W, endX2 - startX) : 0;
              const durDays   = hasRange ? Math.max(1, Math.round((new Date(card.dueDate!).getTime() - new Date(card.startDate!).getTime()) / MS_PER_DAY)) : 0;
              const autoBuf   = durDays > 0 ? Math.max(1, Math.round(durDays * (card.priority === 'HIGH' ? 0.5 : card.priority === 'MEDIUM' ? 0.3 : 0.15))) : 0;
              const bufDays   = card.bufferDays != null ? card.bufferDays : autoBuf;
              const bufPx     = hasRange && endX2 !== null ? bufDays * DAY_W : 0;
              const who       = (card.title.trim()[0] ?? '?').toUpperCase();

              return (
                <div key={card.id} style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  {/* Sidebar — opens card detail */}
                  <button
                    onClick={() => setSelectedCard(card as any)}
                    style={{ flex: 'none', width: `${SIDEBAR_W}px`, position: 'sticky', left: 0, zIndex: 10, background: '#161B2E', borderRight: '1px solid rgba(255,255,255,0.07)', height: `${ROW_H}px`, display: 'flex', alignItems: 'center', gap: '7px', padding: '0 10px', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = '#161B2E')}
                  >
                    <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: barColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 700, color: '#24180A', flexShrink: 0 }}>{who}</span>
                    <span style={{ fontSize: '11px', color: card.completed ? '#615846' : '#C8BFAE', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: card.completed ? 'line-through' : 'none' }}>{card.title}</span>
                  </button>

                  {/* Track */}
                  <div style={{ position: 'relative', flex: 'none', width: `${TRACK_W}px`, height: `${ROW_H}px` }}>
                    {hasRange && startX !== null ? (
                      <>
                        {/* Main bar */}
                        <div
                          style={{ position: 'absolute', left: startX, top: '50%', transform: 'translateY(-50%)', width: barPx, height: '8px', borderRadius: bufPx > 0 ? '4px 0 0 4px' : '4px', background: card.completed ? `${barColor}55` : `${barColor}d9`, cursor: 'pointer', boxShadow: isOverdue ? `0 0 0 1.5px #ef444488` : 'none', zIndex: 1, transition: 'filter 0.12s' }}
                          onClick={() => setSelectedCard(card as any)}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1.18)'; setTooltip({ title: card.title, subtitle: `${fmtS(card.startDate!)} → ${fmtS(card.dueDate!)}`, color: barColor, range: `${fmtS(card.startDate!)} → ${fmtS(card.dueDate!)}`, x: e.clientX, y: e.clientY }); }}
                          onMouseMove={(e) => setTooltip((tt) => tt ? { ...tt, x: e.clientX, y: e.clientY } : null)}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.filter = ''; setTooltip(null); }}
                        />
                        {/* Buffer zone */}
                        {bufPx > 0 && (
                          <div
                            style={{ position: 'absolute', left: startX + barPx, top: '50%', transform: 'translateY(-50%)', width: bufPx, height: '8px', borderRadius: '0 4px 4px 0', background: `${barColor}35`, borderRight: `2px solid ${barColor}88`, cursor: 'pointer' }}
                            onClick={() => setSelectedCard(card as any)}
                            onMouseEnter={(e) => setTooltip({ title: card.title, subtitle: `Colchón: ${bufDays}d`, color: barColor, range: `${fmtS(card.startDate!)} → ${fmtS(card.dueDate!)}`, x: e.clientX, y: e.clientY })}
                            onMouseMove={(e) => setTooltip((tt) => tt ? { ...tt, x: e.clientX, y: e.clientY } : null)}
                            onMouseLeave={() => setTooltip(null)}
                          />
                        )}
                      </>
                    ) : markerX !== null && (
                      /* Point marker — only one date */
                      <div
                        style={{ position: 'absolute', left: markerX, top: '50%', transform: 'translate(-50%, -50%)', cursor: 'pointer' }}
                        onClick={() => setSelectedCard(card as any)}
                        onMouseEnter={(e) => setTooltip({ title: card.title, subtitle: '', color: barColor, date: `📅 ${fmtS(card.dueDate ?? card.startDate!)}`, x: e.clientX, y: e.clientY })}
                        onMouseMove={(e) => setTooltip((tt) => tt ? { ...tt, x: e.clientX, y: e.clientY } : null)}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        <div
                          style={{ width: '11px', height: '11px', borderRadius: '50%', background: card.completed ? 'transparent' : barColor, border: `2px solid ${barColor}`, transition: 'transform 0.12s' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.3)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = ''; }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Dependency staircase arrows */}
            {filteredEdges.length > 0 && (() => {
              const svgH = rows.reduce((h, r) => h + (r.kind === 'section' ? SECTION_H : ROW_H), 0);
              return (
                <svg style={{ position: 'absolute', inset: 0, width: SIDEBAR_W + TRACK_W, height: svgH, pointerEvents: 'none', overflow: 'visible', zIndex: 4 }}>
                  {filteredEdges.map((edge) => {
                    const from     = cardGeom.get(edge.blockingCardId);
                    const to       = cardGeom.get(edge.blockedCardId);
                    if (!from || !to) return null;
                    const blocking = cardById.get(edge.blockingCardId);
                    const stroke   = !blocking?.completed ? '#ef4444' : '#22c55e';
                    const isDashed = !blocking?.completed;
                    const x1       = SIDEBAR_W + (from.dueOnly ? from.x + 5.5 : from.x + from.w);
                    const y1       = from.y + ROW_H / 2;
                    const x2       = SIDEBAR_W + (to.dueOnly ? to.x - 5.5 : to.x);
                    const y2       = to.y + ROW_H / 2;
                    const stub     = Math.max(8, (x2 - x1) * 0.2);
                    const midX     = x1 + stub;
                    const path     = y1 === y2 ? `M ${x1} ${y1} H ${x2}` : `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`;
                    const tip      = x2 >= midX ? 1 : -1;
                    return (
                      <g key={`${edge.blockingCardId}-${edge.blockedCardId}`} opacity={0.7}>
                        <path d={path} fill="none" stroke={stroke} strokeWidth={1.5} strokeDasharray={isDashed ? '5 3' : undefined} />
                        <polygon points={`${x2 + tip * 5},${y2} ${x2},${y2 - 3.5} ${x2},${y2 + 3.5}`} fill={stroke} />
                      </g>
                    );
                  })}
                </svg>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
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
