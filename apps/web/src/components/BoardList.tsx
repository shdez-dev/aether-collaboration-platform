// apps/web/src/components/BoardList.tsx
'use client';

import { useState } from 'react';
import { useBoardStore } from '@/stores/boardStore';
import { useCardStore } from '@/stores/cardStore';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Card } from './Card';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

interface List {
  id: string;
  boardId: string;
  name: string;
  position: number;
  createdAt: string;
  updatedAt: string;
  cardCount?: number;
  cards?: any[];
}

interface BoardListProps {
  list: List;
}

export default function BoardList({ list }: BoardListProps) {
  const { updateList, deleteList } = useBoardStore();
  const { cards, addCard } = useCardStore();
  const setSelectedCard = useCardStore((state) => state.setSelectedCard);
  const { accessToken } = useAuthStore();

  // Obtener rol del usuario
  const { currentWorkspace } = useWorkspaceStore();
  const userRole = currentWorkspace?.userRole;

  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(list.name);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Estado para añadir card
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [cardTitle, setCardTitle] = useState('');
  const [isCreatingCard, setIsCreatingCard] = useState(false);

  // Permisos: OWNER y ADMIN pueden editar/crear/eliminar
  const canEdit = userRole === 'ADMIN' || userRole === 'OWNER';

  // OWNER, ADMIN y MEMBER pueden arrastrar (solo VIEWER no puede)
  const canDrag = userRole === 'OWNER' || userRole === 'ADMIN' || userRole === 'MEMBER';

  // Configurar sortable para la lista - Solo OWNER y ADMIN pueden mover listas
  const {
    attributes,
    listeners,
    setNodeRef: setSortableNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: list.id,
    data: {
      type: 'list',
      list,
    },
    disabled: !canEdit,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Configurar droppable para el área de cards - OWNER, ADMIN y MEMBER pueden soltar
  const { setNodeRef: setDroppableNodeRef, isOver } = useDroppable({
    id: `list-droppable-${list.id}`,
    data: {
      type: 'list',
      listId: list.id,
    },
    disabled: !canDrag,
  });

  // Guardar cambios del nombre
  const handleSave = async () => {
    if (!canEdit) return;

    if (editedName.trim() === list.name) {
      setIsEditing(false);
      return;
    }

    if (!editedName.trim()) {
      setEditedName(list.name);
      setIsEditing(false);
      return;
    }

    await updateList(list.id, editedName.trim());
    setIsEditing(false);
  };

  // Cancelar edición
  const handleCancel = () => {
    setEditedName(list.name);
    setIsEditing(false);
  };

  // Eliminar lista
  const handleDelete = async () => {
    if (!canEdit) return;

    const listCards = cards[list.id] || [];
    if (listCards.length > 0) {
      alert(
        'No se puede eliminar una lista con tarjetas. Por favor, mueve o elimina las tarjetas primero.'
      );
      return;
    }
    await deleteList(list.id);
  };

  // Crear card
  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canEdit) return;

    if (!cardTitle.trim()) return;

    setIsCreatingCard(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/lists/${list.id}/cards`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ title: cardTitle.trim() }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Error al crear la tarjeta');
      }

      const { data } = await response.json();
      addCard(list.id, data.card);
      setSelectedCard(data.card);

      // Reset
      setCardTitle('');
      setIsAddingCard(false);
    } catch (error: any) {
      console.error('Error al crear tarjeta:', error);
      alert(`Error al crear la tarjeta: ${error.message}`);
    } finally {
      setIsCreatingCard(false);
    }
  };

  const handleCancelAddCard = () => {
    setCardTitle('');
    setIsAddingCard(false);
  };

  const listCards = cards[list.id] || [];
  const cardIds = listCards.map((card) => card.id);

  return (
    <>
      <div ref={setSortableNodeRef} style={style} className="w-80 flex-shrink-0">
        <div
          className={`bg-card border border-border rounded-terminal p-6 shadow-terminal hover:shadow-terminal-hover hover:border-border-light flex flex-col ${isOver ? 'ring-2 ring-accent' : ''}`}
        >
          {/* Header */}
          <div
            className={`flex items-center justify-between mb-4 pb-3 border-b border-border flex-shrink-0 ${
              canEdit ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
            }`}
            {...(canEdit ? attributes : {})}
            {...(canEdit ? listeners : {})}
          >
            {isEditing && canEdit ? (
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onBlur={handleSave}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') handleCancel();
                }}
                className="input-terminal flex-1 mr-2 text-base"
                autoFocus
                maxLength={255}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <h3
                className={`font-normal flex-1 ${
                  canEdit ? 'cursor-pointer hover:text-accent transition-colors' : ''
                }`}
                onClick={(e) => {
                  if (canEdit) {
                    e.stopPropagation();
                    setIsEditing(true);
                  }
                }}
              >
                {list.name}
              </h3>
            )}

            {/* Menu - Solo OWNER y ADMIN */}
            {canEdit && (
              <div className="relative group">
                <button
                  className="text-text-muted hover:text-text-primary transition-colors px-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  ⋮
                </button>

                {/* Dropdown */}
                <div className="absolute right-0 top-full mt-1 w-40 card-terminal opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditing(true);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-surface transition-colors"
                  >
                    ✎ Editar Nombre
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDeleteConfirm(true);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-surface transition-colors text-error"
                  >
                    ✕ Eliminar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Cards Area - Droppable con Scrollbar Personalizada */}
          <div
            ref={setDroppableNodeRef}
            className="overflow-y-auto overflow-x-hidden min-h-[150px] max-h-[500px] cards-scrollbar pr-2"
          >
            <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {listCards.length > 0 ? (
                  listCards.map((card) => <Card key={card.id} card={card} />)
                ) : (
                  <div className="text-center text-text-muted text-sm py-8">
                    {isOver ? 'Suelta la tarjeta aquí' : 'Sin tarjetas aún'}
                  </div>
                )}
              </div>
            </SortableContext>
          </div>

          {/* Add Card Section - Solo OWNER y ADMIN */}
          {canEdit && (
            <div className="flex-shrink-0">
              {isAddingCard ? (
                <form onSubmit={handleCreateCard} className="mt-3 space-y-2">
                  <textarea
                    value={cardTitle}
                    onChange={(e) => setCardTitle(e.target.value)}
                    placeholder="Ingresa el título de la tarjeta..."
                    autoFocus
                    rows={3}
                    disabled={isCreatingCard}
                    className="input-terminal w-full text-sm resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={!cardTitle.trim() || isCreatingCard}
                      className="btn-primary flex-1 py-1.5 text-xs"
                    >
                      {isCreatingCard ? 'Agregando...' : 'Agregar'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelAddCard}
                      disabled={isCreatingCard}
                      className="btn-secondary py-1.5 px-3 text-xs"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setIsAddingCard(true)}
                  className="w-full mt-3 py-2 text-text-muted hover:text-text-primary text-sm transition-colors border border-dashed border-border hover:border-accent rounded-terminal"
                >
                  + Agregar Tarjeta
                </button>
              )}
            </div>
          )}

          {/* Card Count */}
          <div className="mt-3 pt-3 border-t border-border text-text-muted text-xs font-mono flex-shrink-0">
            {listCards.length} {listCards.length === 1 ? 'tarjeta' : 'tarjetas'}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && canEdit && (
        <>
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 animate-fade-in"
            onClick={() => setShowDeleteConfirm(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="card-terminal max-w-md pointer-events-auto animate-scale-in">
              <h3 className="text-xl mb-2">¿Eliminar Lista?</h3>
              <p className="text-text-secondary mb-2">
                ¿Estás seguro de que deseas eliminar <strong>{list.name}</strong>?
              </p>
              {listCards.length > 0 ? (
                <p className="text-error text-sm mb-6">
                  ⚠ Esta lista tiene {listCards.length}{' '}
                  {listCards.length === 1 ? 'tarjeta' : 'tarjetas'}. Por favor, muévelas o
                  elimínalas primero.
                </p>
              ) : (
                <p className="text-text-muted text-sm mb-6">Esta acción no se puede deshacer.</p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={listCards.length > 0}
                  className="btn-primary bg-error hover:bg-error/80 flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
