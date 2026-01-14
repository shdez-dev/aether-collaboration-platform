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

  // ✅ OBTENER ROL DEL USUARIO EN EL WORKSPACE
  const { currentWorkspace } = useWorkspaceStore();
  const userRole = currentWorkspace?.userRole;

  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(list.name);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Estado para añadir card
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [cardTitle, setCardTitle] = useState('');
  const [isCreatingCard, setIsCreatingCard] = useState(false);

  // ✅ PERMISOS: Determinar qué puede hacer el usuario
  const canEdit = userRole === 'ADMIN' || userRole === 'OWNER';
  const canView = userRole === 'MEMBER' || userRole === 'VIEWER';

  // Configurar sortable para la lista (SOLO si puede editar)
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
    disabled: !canEdit, // ✅ Deshabilitar drag si no puede editar
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Configurar droppable para el área de cards
  const { setNodeRef: setDroppableNodeRef, isOver } = useDroppable({
    id: `list-droppable-${list.id}`,
    data: {
      type: 'list',
      listId: list.id,
    },
    disabled: !canEdit, // ✅ Deshabilitar drop si no puede editar
  });

  // Guardar cambios del nombre
  const handleSave = async () => {
    if (!canEdit) return; // ✅ Prevenir edición

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
    if (!canEdit) return; // ✅ Prevenir eliminación

    const listCards = cards[list.id] || [];
    if (listCards.length > 0) {
      alert('Cannot delete list with cards. Please move or delete cards first.');
      return;
    }
    await deleteList(list.id);
  };

  // Crear card
  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canEdit) return; // ✅ Prevenir creación

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
        throw new Error(errorData.error?.message || 'Failed to create card');
      }

      const { data } = await response.json();
      addCard(list.id, data.card);
      setSelectedCard(data.card);

      // Reset
      setCardTitle('');
      setIsAddingCard(false);
    } catch (error: any) {
      console.error('Error creating card:', error);
      alert(`Failed to create card: ${error.message}`);
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
        <div className={`card-terminal h-full flex flex-col ${isOver ? 'ring-2 ring-accent' : ''}`}>
          {/* Header */}
          <div
            className={`flex items-center justify-between mb-4 pb-3 border-b border-border ${
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

            {/* Menu - SOLO PARA ADMIN/OWNER */}
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
                    ✎ Edit Name
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDeleteConfirm(true);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-surface transition-colors text-error"
                  >
                    ✕ Delete
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Cards Area - DROPPABLE */}
          <div ref={setDroppableNodeRef} className="flex-1 overflow-y-auto min-h-[100px]">
            <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {listCards.length > 0 ? (
                  listCards.map((card) => <Card key={card.id} card={card} />)
                ) : (
                  <div className="text-center text-text-muted text-sm py-8">
                    {isOver ? 'Drop card here' : 'No cards yet'}
                  </div>
                )}
              </div>
            </SortableContext>
          </div>

          {/* Add Card Section - SOLO PARA ADMIN/OWNER */}
          {canEdit && (
            <>
              {isAddingCard ? (
                <form onSubmit={handleCreateCard} className="mt-3 space-y-2">
                  <textarea
                    value={cardTitle}
                    onChange={(e) => setCardTitle(e.target.value)}
                    placeholder="Enter card title..."
                    autoFocus
                    rows={3}
                    disabled={isCreatingCard}
                    className="input-terminal w-full text-sm resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={!cardTitle.trim() || isCreatingCard}
                      className="btn-primary flex-1 py-2 text-sm"
                    >
                      {isCreatingCard ? 'Adding...' : 'Add Card'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelAddCard}
                      disabled={isCreatingCard}
                      className="btn-secondary py-2 px-4 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setIsAddingCard(true)}
                  className="w-full mt-3 py-2 text-text-muted hover:text-text-primary text-sm transition-colors border border-dashed border-border hover:border-accent rounded-terminal"
                >
                  + Add Card
                </button>
              )}
            </>
          )}

          {/* Card Count */}
          <div className="mt-3 pt-3 border-t border-border text-text-muted text-xs font-mono">
            {listCards.length} {listCards.length === 1 ? 'card' : 'cards'}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal - SOLO SI PUEDE EDITAR */}
      {showDeleteConfirm && canEdit && (
        <>
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 animate-fade-in"
            onClick={() => setShowDeleteConfirm(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="card-terminal max-w-md pointer-events-auto animate-scale-in">
              <h3 className="text-xl mb-2">Delete List?</h3>
              <p className="text-text-secondary mb-2">
                Are you sure you want to delete <strong>{list.name}</strong>?
              </p>
              {listCards.length > 0 ? (
                <p className="text-error text-sm mb-6">
                  ⚠ This list has {listCards.length} {listCards.length === 1 ? 'card' : 'cards'}.
                  Please move or delete them first.
                </p>
              ) : (
                <p className="text-text-muted text-sm mb-6">This action cannot be undone.</p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={listCards.length > 0}
                  className="btn-primary bg-error hover:bg-error/80 flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
