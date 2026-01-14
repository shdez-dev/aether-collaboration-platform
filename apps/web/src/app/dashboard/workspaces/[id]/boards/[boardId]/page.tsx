// apps/web/src/app/dashboard/workspaces/[id]/boards/[boardId]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useBoardStore } from '@/stores/boardStore';
import { useCardStore } from '@/stores/cardStore';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useRealtimeBoard } from '@/hooks/useRealTimeBoard';
import { useRealtimeToast } from '@/hooks/useRealtimeToast';
import BoardList from '@/components/BoardList';
import type { List } from '@aether/types';
import AddListButton from '@/components/AddListButton';
import { CardDetailModal } from '@/components/CardDetailModal';
import { ActiveUsers } from '@/components/realtime/ActiveUsers';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToWindowEdges } from '@dnd-kit/modifiers';

export default function BoardPage() {
  const params = useParams();
  const router = useRouter();

  const workspaceId = params.id as string;
  const boardId = params.boardId as string;

  // ✅ OBTENER ROL DEL USUARIO
  const { currentWorkspace } = useWorkspaceStore();
  const userRole = currentWorkspace?.userRole;
  const canEdit = userRole === 'ADMIN' || userRole === 'OWNER';

  // REALTIME
  const {
    board: currentBoard,
    lists,
    isLoading,
    isConnected,
    activeUsers,
  } = useRealtimeBoard(boardId, {
    onConnect: () => console.log('[BoardPage] Connected to realtime'),
    onDisconnect: () => console.log('[BoardPage] Disconnected from realtime'),
  });

  const toast = useRealtimeToast();

  // STORES
  const { archiveBoard, reorderList } = useBoardStore();
  const { cards, setCards, moveCard, setCurrentWorkspaceId, clearAllCards } = useCardStore();
  const { accessToken } = useAuthStore();

  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'list' | 'card' | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    if (!workspaceId) return;
    clearAllCards();
    setCurrentWorkspaceId(workspaceId);
  }, [workspaceId, setCurrentWorkspaceId, clearAllCards]);

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
          console.error(`Error loading cards for list ${list.id}:`, error);
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

  const handleArchive = async () => {
    if (!currentBoard || !canEdit) return;

    try {
      await archiveBoard(currentBoard.id);
      toast.success('Board archived successfully');
      router.push(`/dashboard/workspaces/${workspaceId}`);
    } catch (error) {
      toast.error('Failed to archive board');
    }
  };

  const handleBack = () => {
    router.push(`/dashboard/workspaces/${workspaceId}`);
  };

  const handleDragStart = (event: DragStartEvent) => {
    if (!canEdit) return;

    const { active } = event;
    setActiveId(active.id as string);
    setActiveType(active.data.current?.type);
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (!canEdit) return;

    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (active.data.current?.type === 'card') {
      const activeCard = active.data.current?.card;
      const activeListId = activeCard?.listId;

      let overListId = over.data.current?.listId;

      if (overId.startsWith('list-droppable-')) {
        overListId = overId.replace('list-droppable-', '');
      }

      if (over.data.current?.type === 'card') {
        overListId = over.data.current?.card?.listId;
      }

      if (activeListId && overListId && activeListId !== overListId) {
        const targetList = cards[overListId] || [];
        const newPosition =
          targetList.length > 0 ? targetList[targetList.length - 1].position + 1 : 1;

        moveCard(activeId, activeListId, overListId, newPosition);
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    if (!canEdit) return;

    const { active, over } = event;

    setActiveId(null);
    setActiveType(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Reordenar listas
    if (active.data.current?.type === 'list' && over.data.current?.type === 'list') {
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
          toast.success('List reordered');
        } catch (error) {
          console.error('Failed to reorder list:', error);
          toast.error('Failed to reorder list');
        }
      }
    }

    // Mover cards
    if (active.data.current?.type === 'card') {
      const card = active.data.current.card;
      const fromListId = card.listId;

      let toListId = over.data.current?.listId;

      if (overId.startsWith('list-droppable-')) {
        toListId = overId.replace('list-droppable-', '');
      }

      if (over.data.current?.type === 'card') {
        toListId = over.data.current?.card?.listId;
      }

      if (!toListId || fromListId === toListId) return;

      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cards/${card.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ listId: toListId }),
        });

        if (!response.ok) {
          throw new Error('Failed to move card');
        }

        toast.moved('Card', card.title);
      } catch (error) {
        console.error('Failed to sync card move:', error);

        const targetList = cards[fromListId] || [];
        const revertPosition =
          targetList.length > 0 ? targetList[targetList.length - 1].position + 1 : 1;
        moveCard(card.id, toListId, fromListId, revertPosition);

        toast.error('Failed to move card');
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

  const totalCards = Object.values(cards).reduce((total, listCards) => total + listCards.length, 0);

  if (isLoading || !currentBoard) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-text-secondary">Loading board...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            ← Back
          </button>
          <div>
            <h1 className="text-2xl font-normal">{currentBoard.name}</h1>
            {currentBoard.description && (
              <p className="text-text-secondary text-sm">{currentBoard.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 text-text-muted text-sm">
            <div className="flex items-center gap-1">
              <span className="text-accent">█</span>
              <span>{lists.length} lists</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-success">▣</span>
              <span>{totalCards} cards</span>
            </div>
          </div>

          <ActiveUsers users={activeUsers} maxVisible={5} showCount={true} size="md" />

          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-success animate-pulse' : 'bg-error'
              }`}
            />
            <span className="text-xs text-text-muted">
              {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
            </span>
          </div>

          {/* Archive Button - SOLO ADMIN/OWNER */}
          {canEdit && (
            <button
              onClick={() => setShowArchiveConfirm(true)}
              className="btn-secondary text-warning hover:border-warning"
            >
              Archive Board
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="h-full p-6">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
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
                    <BoardList key={list.id} list={list} />
                  ))}
              </SortableContext>

              {/* Add List Button - SOLO ADMIN/OWNER */}
              {canEdit && <AddListButton boardId={boardId} />}
            </div>

            <DragOverlay>
              {activeList ? (
                <div className="w-80 opacity-60 rotate-2">
                  <div className="card-terminal p-4">
                    <div className="text-center text-text-primary font-mono">
                      Moving "{activeList.name}"...
                    </div>
                  </div>
                </div>
              ) : activeCard ? (
                <div className="w-80 opacity-80 rotate-3">
                  <div className="bg-card border-2 border-accent rounded-terminal p-3 shadow-xl">
                    <div className="text-sm text-text-primary font-mono">{activeCard.title}</div>
                    <div className="text-xs text-text-muted mt-1">Moving card...</div>
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

      {/* Archive Confirmation - SOLO SI PUEDE EDITAR */}
      {showArchiveConfirm && canEdit && (
        <>
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 animate-fade-in"
            onClick={() => setShowArchiveConfirm(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="card-terminal max-w-md pointer-events-auto animate-scale-in">
              <h3 className="text-xl mb-2">Archive Board?</h3>
              <p className="text-text-secondary mb-6">
                This board will be archived and removed from the active boards list. You can restore
                it later from the archived boards section.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowArchiveConfirm(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleArchive}
                  className="btn-primary bg-warning hover:bg-warning/80 flex-1"
                >
                  Archive
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <CardDetailModal />
    </div>
  );
}
