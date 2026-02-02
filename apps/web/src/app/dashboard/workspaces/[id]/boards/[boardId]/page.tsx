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
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToWindowEdges } from '@dnd-kit/modifiers';
import { ArrowLeft, LayoutGrid, FileText, Users, Archive, AlertTriangle } from 'lucide-react';

export default function BoardPage() {
  const params = useParams();
  const router = useRouter();

  const workspaceId = params.id as string;
  const boardId = params.boardId as string;

  // Obtener rol del usuario
  const { currentWorkspace } = useWorkspaceStore();
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
    onConnect: () => console.log('[BoardPage] Conectado al tiempo real'),
    onDisconnect: () => console.log('[BoardPage] Desconectado del tiempo real'),
  });

  const toast = useRealtimeToast();

  // Stores
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
          console.error(`Error al cargar tarjetas para la lista ${list.id}:`, error);
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
    if (!currentBoard || !canEditBoard) return;

    try {
      await archiveBoard(currentBoard.id);
      toast.success('Board archivado exitosamente');
      router.push(`/dashboard/workspaces/${workspaceId}`);
    } catch (error) {
      toast.error('Error al archivar el board');
    }
  };

  const handleBack = () => {
    router.push(`/dashboard/workspaces/${workspaceId}`);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const activeData = active.data.current;

    // Verificar permisos según el tipo
    if (activeData?.type === 'list' && !canEditBoard) {
      console.log('⚠️ No tienes permisos para mover listas');
      return;
    }

    if (activeData?.type === 'card' && !canMoveCards) {
      console.log('⚠️ No tienes permisos para mover cards');
      return;
    }

    setActiveId(active.id as string);
    setActiveType(activeData?.type);

    console.log('🎯 Drag started:', activeData);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveId(null);
    setActiveType(null);

    if (!over) {
      console.log('⚠️ Elemento soltado fuera de área válida');
      return;
    }

    const activeData = active.data.current;
    const overData = over.data.current;

    // ==================== CASO 1: REORDENAR LISTAS ====================
    if (activeData?.type === 'list' && overData?.type === 'list') {
      if (!canEditBoard) {
        toast.error('No tienes permisos para reordenar listas');
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
          toast.success('Lista reordenada');
        } catch (error) {
          console.error('Error al reordenar lista:', error);
          toast.error('Error al reordenar lista');
        }
      }
    }

    // ==================== CASO 2: MOVER CARDS ====================
    else if (activeData?.type === 'card') {
      if (!canMoveCards) {
        toast.error('No tienes permisos para mover tarjetas');
        return;
      }

      const cardId = active.id as string;
      const activeCard = activeData.card;
      const fromListId = activeCard.listId;

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
        console.log('ℹ️ Card no cambió de posición');
        return;
      }

      console.log('🎯 Moviendo card:', {
        cardId,
        fromListId,
        toListId,
        currentPosition: currentIndex,
        targetPosition,
      });

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
        console.log('✅ Card movida exitosamente en la base de datos:', data.card);

        toast.moved('Tarjeta', activeCard.title);
      } catch (error: any) {
        console.error('❌ Error moviendo card:', error);

        // ✅ PASO 3: ROLLBACK si falla
        moveCard(cardId, toListId, fromListId, currentIndex);

        toast.error(`Error al mover la tarjeta: ${error.message}`);
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
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-text-secondary">Cargando board...</p>
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
                <span>Volver</span>
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

            {/* Archive Button - Solo OWNER y ADMIN */}
            {canEditBoard && (
              <button
                onClick={() => setShowArchiveConfirm(true)}
                className="px-4 py-2 border border-warning/30 bg-warning/10 text-warning hover:bg-warning hover:text-white transition-all text-sm font-medium flex items-center gap-2"
              >
                <Archive className="w-4 h-4" />
                <span>Archivar</span>
              </button>
            )}
          </div>
        </div>

        {/* Bottom Row - Stats & Users */}
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            {/* Lists Count */}
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-accent/10 border border-accent/30">
                <LayoutGrid className="w-4 h-4 text-accent" />
              </div>
              <div>
                <p className="text-xs text-text-muted">Listas</p>
                <p className="text-sm font-medium text-text-primary">{lists.length}</p>
              </div>
            </div>

            {/* Cards Count */}
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-success/10 border border-success/30">
                <FileText className="w-4 h-4 text-success" />
              </div>
              <div>
                <p className="text-xs text-text-muted">Tarjetas</p>
                <p className="text-sm font-medium text-text-primary">{totalCards}</p>
              </div>
            </div>

            {/* Active Users */}
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-warning/10 border border-warning/30">
                <Users className="w-4 h-4 text-warning" />
              </div>
              <div className="flex items-center gap-2">
                <div>
                  <p className="text-xs text-text-muted">Activos</p>
                  <p className="text-sm font-medium text-text-primary">{activeUsers.length}</p>
                </div>
                <ActiveUsers users={activeUsers} maxVisible={5} showCount={false} size="sm" />
              </div>
            </div>
          </div>

          {/* Connection Status */}
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-success' : 'bg-error'
              } animate-pulse`}
            />
            <span className="text-xs text-text-muted">
              {isConnected ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
        </div>
      </header>

      {/* Board Content */}
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
                    <BoardList key={list.id} list={list} />
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
                      Moviendo "{activeList.name}"...
                    </div>
                  </div>
                </div>
              ) : activeCard ? (
                <div className="w-80 opacity-80 rotate-3">
                  <div className="bg-card border-2 border-accent p-3 shadow-xl">
                    <div className="text-sm text-text-primary">{activeCard.title}</div>
                    <div className="text-xs text-text-muted mt-1">Moviendo tarjeta...</div>
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

      {/* Archive Confirmation Modal */}
      {showArchiveConfirm && canEditBoard && (
        <>
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 animate-fade-in"
            onClick={() => setShowArchiveConfirm(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-card border border-warning max-w-md w-full p-6 pointer-events-auto animate-scale-in">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-2 bg-warning/10 border border-warning/30">
                  <AlertTriangle className="w-6 h-6 text-warning" />
                </div>
                <div>
                  <h3 className="text-lg font-medium mb-1">¿Archivar Board?</h3>
                  <p className="text-sm text-text-secondary">
                    Este board será archivado y removido de la lista de boards activos. Puedes
                    restaurarlo más tarde desde la sección de boards archivados.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowArchiveConfirm(false)}
                  className="flex-1 px-4 py-2 border border-border bg-surface text-text-primary hover:bg-card transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleArchive}
                  className="flex-1 px-4 py-2 bg-warning text-white hover:bg-warning/80 transition-colors"
                >
                  Archivar
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
