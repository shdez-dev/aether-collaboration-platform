// apps/web/src/components/BoardList.tsx
'use client';

import { useState } from 'react';
import { useBoardStore } from '@/stores/boardStore';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(list.name);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Configurar sortable
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: list.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Guardar cambios del nombre
  const handleSave = async () => {
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
    if (list.cardCount && list.cardCount > 0) {
      alert('Cannot delete list with cards. Please move or delete cards first.');
      return;
    }
    await deleteList(list.id);
  };

  return (
    <>
      <div ref={setNodeRef} style={style} className="w-80 flex-shrink-0">
        <div className="card-terminal h-full flex flex-col">
          {/* Header */}
          <div
            className="flex items-center justify-between mb-4 pb-3 border-b border-border cursor-grab active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            {isEditing ? (
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
                onClick={(e) => e.stopPropagation()} // Evitar que active el drag
              />
            ) : (
              <h3
                className="font-normal flex-1 cursor-pointer hover:text-primary transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
              >
                {list.name}
              </h3>
            )}

            {/* Menu */}
            <div className="relative group">
              <button
                className="text-text-muted hover:text-text-primary transition-colors px-2"
                onClick={(e) => e.stopPropagation()} // Evitar que active el drag
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
                  className="w-full text-left px-3 py-2 text-sm hover:bg-border transition-colors"
                >
                  ✎ Edit Name
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteConfirm(true);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-border transition-colors text-error"
                >
                  ✕ Delete
                </button>
              </div>
            </div>
          </div>

          {/* Cards Area */}
          <div className="flex-1 overflow-y-auto space-y-2 min-h-[100px]">
            {list.cards && list.cards.length > 0 ? (
              list.cards.map((card) => (
                <div
                  key={card.id}
                  className="p-3 bg-background border border-border rounded hover:border-primary/50 transition-colors cursor-pointer"
                >
                  <p className="text-sm">{card.title}</p>
                </div>
              ))
            ) : (
              <div className="text-center text-text-muted text-sm py-8">No cards yet</div>
            )}
          </div>

          {/* Add Card Button - Placeholder */}
          <button className="w-full mt-3 py-2 text-text-muted hover:text-text-primary text-sm transition-colors border border-dashed border-border hover:border-primary rounded">
            + Add Card
          </button>

          {/* Card Count */}
          <div className="mt-3 pt-3 border-t border-border text-text-muted text-xs">
            {list.cardCount || 0} {list.cardCount === 1 ? 'card' : 'cards'}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
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
              {list.cardCount && list.cardCount > 0 ? (
                <p className="text-error text-sm mb-6">
                  ⚠ This list has {list.cardCount} {list.cardCount === 1 ? 'card' : 'cards'}. Please
                  move or delete them first.
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
                  disabled={Boolean(list.cardCount && list.cardCount > 0)}
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
