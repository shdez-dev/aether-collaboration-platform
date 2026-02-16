// apps/web/src/components/comments/CommentItem.tsx

'use client';

import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Edit2, Trash2, MoreVertical, Check } from 'lucide-react';
import { getAvatarUrl } from '@/lib/utils/avatar';
import { CommentForm } from './CommentForm';
import { useCommentEdit } from '@/hooks/useComment';
import { useAuthStore } from '@/stores/authStore';
import type { CommentWithUser } from '@aether/types';
import { useT } from '@/lib/i18n';
import { formatRelative } from '@/lib/utils/date';

interface CommentItemProps {
  comment: CommentWithUser;
  onUpdate?: (commentId: string, content: string, mentions?: string[]) => Promise<void>;
  onDelete?: (commentId: string) => Promise<void>;
  showActions?: boolean;
}

export function CommentItem({ comment, onUpdate, onDelete, showActions = true }: CommentItemProps) {
  const t = useT();
  const { user: currentUser } = useAuthStore();
  const { isEditing, isUpdating, startEdit, cancelEdit } = useCommentEdit(comment.id);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAuthor = currentUser?.id === comment.userId;

  const handleUpdate = async (content: string, mentions?: string[]) => {
    if (!onUpdate) return;

    await onUpdate(comment.id, content, mentions);
    cancelEdit();
  };

  /**
   * ELIMINACIÓN DIRECTA SIN CONFIRMACIÓN
   */
  const handleDelete = async () => {
    if (!onDelete) return;

    setIsDeleting(true);
    try {
      await onDelete(comment.id);
    } catch (error) {
      console.error('[CommentItem] Error deleting:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const getRelativeTime = (date: string) => {
    return formatRelative(date, currentUser?.language as 'es' | 'en') || date;
  };

  const renderContent = (content: string) => {
    const parts = content.split(/(@[a-zA-Z0-9_-]+)/g);

    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        return (
          <span key={index} className="font-medium text-primary">
            {part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  if (isEditing) {
    return (
      <div className="rounded-lg border bg-muted/50 p-3">
        <CommentForm
          onSubmit={handleUpdate}
          initialValue={comment.content}
          isEditing={true}
          onCancel={cancelEdit}
          isLoading={isUpdating}
          autoFocus={true}
          submitText={t.btn_save}
        />
      </div>
    );
  }

  return (
    <div className="group relative flex gap-3 rounded-lg p-2 transition-colors hover:bg-muted/50">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarImage
          src={getAvatarUrl(comment.user.avatar) || undefined}
          alt={comment.user.name}
          crossOrigin="anonymous"
        />
        <AvatarFallback className="text-xs">
          {comment.user.name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{comment.user.name}</span>
          <span className="text-xs text-muted-foreground">
            {getRelativeTime(comment.createdAt)}
          </span>
          {comment.edited && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Check className="h-3 w-3" />
              {t.comments_edited_badge}
            </span>
          )}
        </div>

        <div className="text-sm text-foreground/90 whitespace-pre-wrap break-words">
          {renderContent(comment.content)}
        </div>
      </div>

      {showActions && isAuthor && !isDeleting && (
        <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={startEdit} disabled={isUpdating}>
                <Edit2 className="mr-2 h-4 w-4" />
                {t.comments_dropdown_edit}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t.comments_dropdown_delete}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {isDeleting && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/80">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}
    </div>
  );
}
