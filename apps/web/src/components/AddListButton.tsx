// apps/web/src/components/AddListButton.tsx
'use client';

import { useState } from 'react';
import { useBoardStore } from '@/stores/boardStore';

interface AddListButtonProps {
  boardId: string;
}

export default function AddListButton({ boardId }: AddListButtonProps) {
  const { createList, isLoading } = useBoardStore();

  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setIsCreating(false);
      setName('');
      return;
    }

    await createList(boardId, name.trim());
    setName('');
    setIsCreating(false);
  };

  const handleCancel = () => {
    setName('');
    setIsCreating(false);
  };

  if (!isCreating) {
    return (
      <div className="w-80 flex-shrink-0">
        <button
          onClick={() => setIsCreating(true)}
          className="w-full card-terminal hover:border-primary/50 transition-all text-left flex items-center gap-2 text-text-muted hover:text-text-primary"
        >
          <span className="text-xl">+</span>
          <span>Add List</span>
        </button>
      </div>
    );
  }

  return (
    <div className="w-80 flex-shrink-0">
      <div className="card-terminal">
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={(e) => {
              // Solo cancelar si el click no fue en el botón de guardar
              if (
                e.relatedTarget &&
                (e.relatedTarget as HTMLElement).getAttribute('data-action') === 'save'
              ) {
                return;
              }
              handleCancel();
            }}
            className="input-terminal text-base"
            placeholder="Enter list name..."
            maxLength={255}
            disabled={isLoading}
            autoFocus
          />

          <div className="flex gap-2">
            <button
              type="submit"
              data-action="save"
              disabled={isLoading || !name.trim()}
              className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating...' : 'Add List'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isLoading}
              className="btn-secondary"
            >
              ✕
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
