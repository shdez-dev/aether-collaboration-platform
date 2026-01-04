// apps/web/src/components/ConfirmRemoveMemberModal.tsx
'use client';

import { useEffect } from 'react';

interface ConfirmRemoveMemberModalProps {
  isOpen: boolean;
  memberName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isRemoving?: boolean;
}

export default function ConfirmRemoveMemberModal({
  isOpen,
  memberName,
  onConfirm,
  onCancel,
  isRemoving = false,
}: ConfirmRemoveMemberModalProps) {
  // Cerrar con ESC
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isRemoving) {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isRemoving, onCancel]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 animate-fade-in"
        onClick={!isRemoving ? onCancel : undefined}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="card-terminal max-w-md w-full pointer-events-auto animate-scale-in border-error/50 bg-error/5"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-terminal bg-error/20 flex items-center justify-center flex-shrink-0 border border-error/50">
              <span className="text-error text-2xl">⚠</span>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-normal text-error mb-2">Remove Member</h2>
              <p className="text-text-secondary text-sm">This action cannot be undone</p>
            </div>
          </div>

          {/* Content */}
          <div className="mb-6 p-4 bg-background rounded-terminal border border-border">
            <p className="text-text-primary mb-3">
              Are you sure you want to remove{' '}
              <span className="text-accent font-medium">{memberName}</span> from this workspace?
            </p>
            <div className="space-y-2 text-sm text-text-secondary">
              <p className="flex items-start gap-2">
                <span className="text-error mt-0.5">•</span>
                They will immediately lose access to all boards and content
              </p>
              <p className="flex items-start gap-2">
                <span className="text-error mt-0.5">•</span>
                All their pending tasks and assignments will remain
              </p>
              <p className="flex items-start gap-2">
                <span className="text-error mt-0.5">•</span>
                You can invite them back later if needed
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={isRemoving}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isRemoving}
              className="btn-primary flex-1 bg-error hover:bg-error/80 border-error disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRemoving ? (
                <>
                  <span className="inline-block animate-spin mr-2">◌</span>
                  Removing...
                </>
              ) : (
                'Yes, Remove Member'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
