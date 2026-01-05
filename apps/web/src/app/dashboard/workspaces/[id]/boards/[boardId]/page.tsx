// apps/web/src/app/dashboard/workspaces/[id]/boards/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useBoardStore } from '@/stores/boardStore';
import BoardList from '@/components/BoardList';
import AddListButton from '@/components/AddListButton';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';

export default function BoardPage() {
  const params = useParams();
  const router = useRouter();

  // Extraer correctamente los parámetros
  const workspaceId = params.id as string; // [id] del workspace
  const boardId = params.boardId as string; // [boardId] del board

  const { currentBoard, lists, fetchBoardById, archiveBoard, reorderList, isLoading } =
    useBoardStore();

  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [activeListId, setActiveListId] = useState<string | null>(null);

  // Configurar sensores para drag & drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px de movimiento antes de activar drag
      },
    })
  );

  // Cargar board al montar
  useEffect(() => {
    if (boardId) {
      fetchBoardById(boardId);
    }
  }, [boardId, fetchBoardById]);

  const handleArchive = async () => {
    if (!currentBoard) return;
    await archiveBoard(currentBoard.id);
    router.push(`/dashboard/workspaces/${workspaceId}/boards`);
  };

  const handleBack = () => {
    router.push(`/dashboard/workspaces/${workspaceId}`);
  };

  // Handler para cuando empieza el drag
  const handleDragStart = (event: DragStartEvent) => {
    setActiveListId(event.active.id as string);
  };

  // Handler para cuando termina el drag
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      setActiveListId(null);
      return;
    }

    // Encontrar las posiciones de las listas
    const sortedLists = [...lists].sort((a, b) => a.position - b.position);
    const oldIndex = sortedLists.findIndex((list) => list.id === active.id);
    const newIndex = sortedLists.findIndex((list) => list.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      setActiveListId(null);
      return;
    }

    // Calcular nueva posición
    let newPosition: number;

    if (newIndex === 0) {
      // Mover al inicio
      newPosition = sortedLists[0].position - 1;
    } else if (newIndex === sortedLists.length - 1) {
      // Mover al final
      newPosition = sortedLists[sortedLists.length - 1].position + 1;
    } else if (newIndex > oldIndex) {
      // Mover hacia la derecha
      newPosition = (sortedLists[newIndex].position + sortedLists[newIndex + 1].position) / 2;
    } else {
      // Mover hacia la izquierda
      newPosition = (sortedLists[newIndex - 1].position + sortedLists[newIndex].position) / 2;
    }

    // Actualizar posición en el backend
    await reorderList(active.id as string, newPosition);
    setActiveListId(null);
  };

  // Handler para cancelar drag
  const handleDragCancel = () => {
    setActiveListId(null);
  };

  // Obtener la lista activa para el DragOverlay
  const activeList = activeListId ? lists.find((list) => list.id === activeListId) : null;

  if (isLoading || !currentBoard) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-text-secondary">Loading board...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
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

        <div className="flex items-center gap-3">
          {/* Stats */}
          <div className="flex items-center gap-4 text-text-muted text-sm mr-4">
            <div className="flex items-center gap-1">
              <span className="text-primary">█</span>
              <span>{lists.length} lists</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-success">▣</span>
              <span>{currentBoard.cardCount || 0} cards</span>
            </div>
          </div>

          {/* Archive Button */}
          <button
            onClick={() => setShowArchiveConfirm(true)}
            className="btn-secondary text-warning hover:border-warning"
          >
            Archive Board
          </button>
        </div>
      </header>

      {/* Board Content - Horizontal Scroll con Drag & Drop */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="h-full p-6">
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <div className="flex gap-6 min-w-min h-full">
              <SortableContext
                items={lists.map((list) => list.id)}
                strategy={horizontalListSortingStrategy}
              >
                {/* Lists */}
                {lists
                  .sort((a, b) => a.position - b.position)
                  .map((list) => (
                    <BoardList key={list.id} list={list} />
                  ))}
              </SortableContext>

              {/* Add List Button */}
              <AddListButton boardId={boardId} />
            </div>

            {/* Drag Overlay - Muestra una copia semi-transparente mientras arrastras */}
            <DragOverlay>
              {activeList ? (
                <div className="w-80 opacity-50">
                  <BoardList list={activeList} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

      {/* Archive Confirmation Modal */}
      {showArchiveConfirm && (
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
    </div>
  );
}
