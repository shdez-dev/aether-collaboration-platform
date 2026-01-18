// apps/web/src/components/comments/CommentList.tsx

'use client';

import { useEffect, useRef } from 'react';
import { CommentItem } from './CommentItem';
import { CommentForm } from './CommentForm';
import { useComments } from '@/hooks/useComment';
import { Loader2, MessageSquare } from 'lucide-react';

interface CommentListProps {
  cardId: string;
  maxHeight?: string;
  minHeight?: string;
  showForm?: boolean;
  showCount?: boolean;
  onCountChange?: (count: number) => void;
  workspaceId?: string;
}

export function CommentList({
  cardId,
  maxHeight = '400px',
  minHeight,
  showForm = true,
  showCount = true,
  onCountChange,
  workspaceId,
}: CommentListProps) {
  const {
    comments,
    count,
    isLoading,
    isCreating,
    createComment,
    updateComment,
    deleteComment,
    refreshComments,
  } = useComments(cardId);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (onCountChange) {
      onCountChange(count);
    }
  }, [count, onCountChange]);

  // NO auto-scroll cuando hay nuevos comentarios
  // El usuario mantiene control del scroll

  if (isLoading) {
    return (
      <div className="flex h-[200px] items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm font-mono">Cargando comentarios...</p>
        </div>
      </div>
    );
  }

  if (!isLoading && comments.length === 0) {
    return (
      <div className="space-y-4">
        {showCount && (
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold font-mono tracking-tight">COMENTARIOS</h3>
              <span className="text-xs text-muted-foreground font-mono">({count})</span>
            </div>
          </div>
        )}

        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/50 p-8 text-center bg-surface/30">
          <MessageSquare className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground font-mono">No hay comentarios aún</p>
          <p className="text-xs text-muted-foreground/70 font-mono mt-1">
            Sé el primero en comentar
          </p>
        </div>

        {showForm && (
          <div className="pt-3 border-t border-border/50">
            <CommentForm
              onSubmit={async (content, mentions) => {
                await createComment(content, mentions);
              }}
              isLoading={isCreating}
              placeholder="Escribe el primer comentario..."
              workspaceId={workspaceId}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showCount && (
        <div className="flex items-center justify-between border-b border-border pb-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold font-mono tracking-tight">COMENTARIOS</h3>
            <span className="text-xs text-muted-foreground font-mono">({count})</span>
          </div>

          <button
            onClick={refreshComments}
            className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-surface/50"
            title="Refrescar comentarios"
          >
            ⟳ Actualizar
          </button>
        </div>
      )}

      {/* SCROLL INDEPENDIENTE - Solo en la lista de comentarios */}
      <div
        ref={scrollContainerRef}
        style={{
          height: minHeight || 'auto', // Altura fija, no crece
          maxHeight,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
        className="space-y-3 pr-2 custom-scrollbar"
      >
        {comments.map((comment, index) => (
          <div key={comment.id}>
            <div className="bg-surface/50 rounded-lg border border-border/50 p-3 hover:border-border transition-colors">
              <CommentItem
                comment={comment}
                onUpdate={updateComment}
                onDelete={deleteComment}
                showActions={true}
              />
            </div>
            {index < comments.length - 1 && <div className="h-px bg-border/30 my-3" />}
          </div>
        ))}
      </div>

      {/* Formulario de nuevo comentario - ESTÁTICO debajo del scroll */}
      {showForm && (
        <div className="pt-3 border-t border-border/50">
          <CommentForm
            onSubmit={async (content, mentions) => {
              await createComment(content, mentions);
            }}
            isLoading={isCreating}
            placeholder="Agregar un comentario..."
            workspaceId={workspaceId}
          />
        </div>
      )}
    </div>
  );
}
