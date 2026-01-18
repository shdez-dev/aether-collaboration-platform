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
              <h2 className="text-xl font-normal text-error mb-2">Remover Miembro</h2>
              <p className="text-text-secondary text-sm">Esta acción no se puede deshacer</p>
            </div>
          </div>

          {/* Content */}
          <div className="mb-6 p-4 bg-background rounded-terminal border border-border">
            <p className="text-text-primary mb-3">
              ¿Estás seguro de que deseas remover a{' '}
              <span className="text-accent font-medium">{memberName}</span> de este workspace?
            </p>
            <div className="space-y-2 text-sm text-text-secondary">
              <p className="flex items-start gap-2">
                <span className="text-error mt-0.5">•</span>
                Perderá inmediatamente el acceso a todos los boards y contenido
              </p>
              <p className="flex items-start gap-2">
                <span className="text-error mt-0.5">•</span>
                Todas sus tareas pendientes y asignaciones permanecerán
              </p>
              <p className="flex items-start gap-2">
                <span className="text-error mt-0.5">•</span>
                Puedes invitarlo de nuevo más tarde si es necesario
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
              Cancelar
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
                  Removiendo...
                </>
              ) : (
                'Sí, Remover Miembro'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
