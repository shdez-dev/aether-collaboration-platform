// apps/web/src/components/comments/CommentList.tsx

'use client';

import { useEffect } from 'react';
import { CommentItem } from './CommentItem';
import { CommentForm } from './CommentForm';
import { useComments } from '@/hooks/useComment';
import { Loader2, MessageSquare } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface CommentListProps {
  cardId: string;
  maxHeight?: string;
  showForm?: boolean;
  showCount?: boolean;
  onCountChange?: (count: number) => void;
  workspaceId?: string; // ← NUEVA PROP
}

export function CommentList({
  cardId,
  maxHeight = '400px',
  showForm = true,
  showCount = true,
  onCountChange,
  workspaceId, // ← NUEVA PROP
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

  useEffect(() => {
    if (onCountChange) {
      onCountChange(count);
    }
  }, [count, onCountChange]);

  if (isLoading) {
    return (
      <div className="flex h-[200px] items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm">Cargando comentarios...</p>
        </div>
      </div>
    );
  }

  if (!isLoading && comments.length === 0) {
    return (
      <div className="space-y-4">
        {showCount && (
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Comentarios</h3>
            <span className="text-xs text-muted-foreground">({count})</span>
          </div>
        )}

        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <MessageSquare className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No hay comentarios aún</p>
          <p className="text-xs text-muted-foreground">Sé el primero en comentar</p>
        </div>

        {showForm && (
          <>
            <Separator />
            <CommentForm
              onSubmit={async (content, mentions) => {
                await createComment(content, mentions);
              }}
              isLoading={isCreating}
              placeholder="Escribe el primer comentario..."
              workspaceId={workspaceId} // ← PASAR workspaceId
            />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showCount && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Comentarios</h3>
            <span className="text-xs text-muted-foreground">({count})</span>
          </div>

          <button
            onClick={refreshComments}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            title="Refrescar comentarios"
          >
            Actualizar
          </button>
        </div>
      )}

      <ScrollArea style={{ maxHeight }} className="pr-4">
        <div className="space-y-3">
          {comments.map((comment, index) => (
            <div key={comment.id}>
              <CommentItem
                comment={comment}
                onUpdate={updateComment}
                onDelete={deleteComment}
                showActions={true}
              />
              {index < comments.length - 1 && <Separator className="my-3" />}
            </div>
          ))}
        </div>
      </ScrollArea>

      {showForm && (
        <>
          <Separator />
          <CommentForm
            onSubmit={async (content, mentions) => {
              await createComment(content, mentions);
            }}
            isLoading={isCreating}
            placeholder="Agregar un comentario..."
            workspaceId={workspaceId} // ← PASAR workspaceId
          />
        </>
      )}
    </div>
  );
}
