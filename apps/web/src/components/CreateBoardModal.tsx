// apps/web/src/components/CreateBoardModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { useBoardStore } from '@/stores/boardStore';
import { useT } from '@/lib/i18n';

interface CreateBoardModalProps {
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (boardId: string) => void;
}

export default function CreateBoardModal({
  workspaceId,
  isOpen,
  onClose,
  onSuccess,
}: CreateBoardModalProps) {
  const t = useT();
  const { createBoard, isLoading } = useBoardStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  // Reset form cuando se abre/cierra
  useEffect(() => {
    if (!isOpen) {
      setName('');
      setDescription('');
      setError('');
    }
  }, [isOpen]);

  // Cerrar con ESC
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError(t.create_board_validation_name);
      return;
    }

    try {
      const board = await createBoard(workspaceId, {
        name: name.trim(),
        description: description.trim() || undefined,
      });

      onClose();
      if (onSuccess) {
        onSuccess(board.id);
      }
    } catch (err: any) {
      setError(err.message || t.create_board_error);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Modal - Bottom sheet on mobile, centered on desktop */}
      <div className="fixed inset-0 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 z-50 flex items-end md:items-center justify-center p-0 md:p-4 pointer-events-none">
        <div
          className="card-terminal max-w-md w-full pointer-events-auto animate-slide-up md:animate-scale-in rounded-t-lg md:rounded-lg max-h-[90vh] md:max-h-[85vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header - Fixed on mobile */}
          <div className="sticky top-0 bg-card z-10 pb-4 md:pb-0 md:static border-b md:border-0 border-border px-4 md:px-6 pt-4 md:pt-6">
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg md:text-xl font-normal truncate">{t.create_board_title}</h2>
                <p className="text-text-secondary text-xs md:text-sm">{t.create_board_subtitle}</p>
              </div>
              <button
                onClick={onClose}
                className="text-text-muted hover:text-text-primary transition-colors text-2xl leading-none ml-3 flex-shrink-0"
              >
                ×
              </button>
            </div>
          </div>

          {/* Form - Scrollable */}
          <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6 px-4 md:px-6">
            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-xs md:text-sm text-text-secondary mb-2">
                {t.create_board_label_name}
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
                className={`input-terminal text-sm md:text-base ${error ? 'border-error' : ''}`}
                placeholder={t.create_board_placeholder_name}
                maxLength={255}
                disabled={isLoading}
                autoFocus
              />
              {error && (
                <p className="text-error text-xs mt-2 flex items-center gap-1">
                  <span>⚠</span> {error}
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="description"
                className="block text-xs md:text-sm text-text-secondary mb-2"
              >
                {t.create_board_label_description}
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input-terminal min-h-[80px] resize-none text-sm md:text-base"
                placeholder={t.create_board_placeholder_description}
                maxLength={1000}
                disabled={isLoading}
              />
              <p className="text-text-muted text-[10px] md:text-xs mt-1">
                {description.length} / 1000
              </p>
            </div>

            {/* Actions - Sticky on mobile */}
            <div className="sticky bottom-0 bg-card z-10 flex gap-2 md:gap-3 pt-4 pb-4 md:pb-6 border-t border-border -mx-4 md:-mx-6 px-4 md:px-6">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="btn-secondary flex-1 text-sm md:text-base py-2.5 md:py-2"
              >
                {t.btn_cancel}
              </button>
              <button
                type="submit"
                disabled={isLoading || !name.trim()}
                className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base py-2.5 md:py-2"
              >
                {isLoading ? t.btn_creating : t.create_board_title}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
