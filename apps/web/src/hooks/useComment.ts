// apps/web/src/hooks/useComments.ts

import { useEffect, useCallback, useRef } from 'react';
import {
  useCommentStore,
  selectCommentsByCard,
  selectCommentCount,
  selectIsLoading,
} from '@/stores/commentStore';
import { socketService } from '@/services/socketService';
import type {
  CommentWithUser,
  Event,
  CommentCreatedPayload,
  CommentUpdatedPayload,
  CommentDeletedPayload,
  CommentMentionedPayload,
} from '@aether/types';
import { toast } from 'sonner';

/**
 * Hook para manejar comentarios de una card
 * Integra Zustand store + WebSocket para tiempo real
 */
export function useComments(cardId: string) {
  const comments = useCommentStore(selectCommentsByCard(cardId));
  const count = useCommentStore(selectCommentCount(cardId));
  const isLoading = useCommentStore(selectIsLoading(cardId));
  const isCreating = useCommentStore(selectIsLoading(`create-${cardId}`));

  const fetchComments = useCommentStore((state) => state.fetchCommentsByCard);
  const createComment = useCommentStore((state) => state.createComment);
  const updateComment = useCommentStore((state) => state.updateComment);
  const deleteComment = useCommentStore((state) => state.deleteComment);
  const addCommentOptimistic = useCommentStore((state) => state.addCommentOptimistic);
  const updateCommentOptimistic = useCommentStore((state) => state.updateCommentOptimistic);
  const removeCommentOptimistic = useCommentStore((state) => state.removeCommentOptimistic);

  const hasLoadedRef = useRef(false);

  // ============================================================================
  // FETCH INITIAL COMMENTS
  // ============================================================================
  useEffect(() => {
    if (!hasLoadedRef.current && cardId) {
      fetchComments(cardId);
      hasLoadedRef.current = true;
    }
  }, [cardId, fetchComments]);

  // ============================================================================
  // REALTIME LISTENERS
  // ============================================================================
  useEffect(() => {
    if (!cardId) return;

    const handleRealtimeEvent = (event: Event) => {
      // Comment Created
      if (event.type === 'comment.created') {
        const payload = event.payload as CommentCreatedPayload;
        if (payload.cardId === cardId) {
          console.log('[useComments] Comment created event:', payload);

          // Si no es del usuario actual, refetch para obtener datos completos
          const socketId = socketService.getSocketId();
          if (event.meta.socketId !== socketId) {
            fetchComments(cardId);
          }
        }
      }

      // Comment Updated
      if (event.type === 'comment.updated') {
        const payload = event.payload as CommentUpdatedPayload;
        if (payload.cardId === cardId) {
          console.log('[useComments] Comment updated event:', payload);

          const socketId = socketService.getSocketId();
          if (event.meta.socketId !== socketId) {
            updateCommentOptimistic(payload.commentId, {
              content: payload.changes.content,
              mentions: payload.changes.mentions as string[],
              edited: true,
            } as Partial<CommentWithUser>);
          }
        }
      }

      // Comment Deleted
      if (event.type === 'comment.deleted') {
        const payload = event.payload as CommentDeletedPayload;
        if (payload.cardId === cardId) {
          console.log('[useComments] Comment deleted event:', payload);

          const socketId = socketService.getSocketId();
          if (event.meta.socketId !== socketId) {
            removeCommentOptimistic(payload.commentId, cardId);
          }
        }
      }

      // Comment Mentioned (notificación para el usuario mencionado)
      if (event.type === 'comment.mentioned') {
        const payload = event.payload as CommentMentionedPayload;
        if (payload.cardId === cardId) {
          console.log('[useComments] User mentioned event:', payload);
          // Esto se manejará en el provider de notificaciones
        }
      }
    };

    socketService.onEvent(handleRealtimeEvent);

    return () => {
      socketService.off('event', handleRealtimeEvent);
    };
  }, [cardId, fetchComments, updateCommentOptimistic, removeCommentOptimistic]);

  // ============================================================================
  // ACTIONS
  // ============================================================================

  /**
   * Crear un nuevo comentario
   */
  const handleCreateComment = useCallback(
    async (content: string, mentions?: string[]) => {
      if (!content.trim()) {
        toast.error('El comentario no puede estar vacío');
        return null;
      }

      try {
        const newComment = await createComment(cardId, content.trim(), mentions);

        if (newComment) {
          toast.success('Comentario agregado');
          return newComment;
        }

        return null;
      } catch (error: any) {
        toast.error(error.message || 'Error al crear comentario');
        return null;
      }
    },
    [cardId, createComment]
  );

  /**
   * Actualizar un comentario
   */
  const handleUpdateComment = useCallback(
    async (commentId: string, content: string, mentions?: string[]) => {
      if (!content.trim()) {
        toast.error('El comentario no puede estar vacío');
        return;
      }

      try {
        await updateComment(commentId, content.trim(), mentions);
        toast.success('Comentario actualizado');
      } catch (error: any) {
        toast.error(error.message || 'Error al actualizar comentario');
      }
    },
    [updateComment]
  );

  /**
   * Eliminar un comentario
   */
  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      try {
        await deleteComment(commentId, cardId);
        toast.success('Comentario eliminado');
      } catch (error: any) {
        toast.error(error.message || 'Error al eliminar comentario');
      }
    },
    [cardId, deleteComment]
  );

  /**
   * Refrescar comentarios manualmente
   */
  const refreshComments = useCallback(() => {
    fetchComments(cardId);
  }, [cardId, fetchComments]);

  return {
    // Data
    comments,
    count,

    // Loading states
    isLoading,
    isCreating,

    // Actions
    createComment: handleCreateComment,
    updateComment: handleUpdateComment,
    deleteComment: handleDeleteComment,
    refreshComments,
  };
}

/**
 * Hook para manejar el estado de edición de un comentario
 */
export function useCommentEdit(commentId: string) {
  const editingCommentId = useCommentStore((state) => state.editingCommentId);
  const setEditingComment = useCommentStore((state) => state.setEditingComment);
  const isUpdating = useCommentStore(selectIsLoading(`update-${commentId}`));

  const isEditing = editingCommentId === commentId;

  const startEdit = useCallback(() => {
    setEditingComment(commentId);
  }, [commentId, setEditingComment]);

  const cancelEdit = useCallback(() => {
    setEditingComment(null);
  }, [setEditingComment]);

  return {
    isEditing,
    isUpdating,
    startEdit,
    cancelEdit,
  };
}

/**
 * Hook para manejar el contador de comentarios de una card
 * Útil para mostrar badges sin cargar todos los comentarios
 */
export function useCommentCount(cardId: string) {
  const count = useCommentStore(selectCommentCount(cardId));
  const fetchCommentCount = useCommentStore((state) => state.fetchCommentCount);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!hasLoadedRef.current && cardId) {
      fetchCommentCount(cardId);
      hasLoadedRef.current = true;
    }
  }, [cardId, fetchCommentCount]);

  // Escuchar eventos de tiempo real para actualizar contador
  useEffect(() => {
    if (!cardId) return;

    const handleRealtimeEvent = (event: Event) => {
      if (event.type === 'comment.created') {
        const payload = event.payload as CommentCreatedPayload;
        if (payload.cardId === cardId) {
          fetchCommentCount(cardId);
        }
      }

      if (event.type === 'comment.deleted') {
        const payload = event.payload as CommentDeletedPayload;
        if (payload.cardId === cardId) {
          fetchCommentCount(cardId);
        }
      }
    };

    socketService.onEvent(handleRealtimeEvent);

    return () => {
      socketService.off('event', handleRealtimeEvent);
    };
  }, [cardId, fetchCommentCount]);

  return count;
}

/**
 * Hook para extraer y validar menciones de un texto
 */
export function useMentions() {
  const extractMentions = useCallback((content: string): string[] => {
    const mentionRegex = /@([a-zA-Z0-9_-]+)/g;
    const matches = content.matchAll(mentionRegex);
    const mentions = new Set<string>();

    for (const match of matches) {
      mentions.add(match[1]);
    }

    return Array.from(mentions);
  }, []);

  const hasMentions = useCallback((content: string): boolean => {
    return /@([a-zA-Z0-9_-]+)/.test(content);
  }, []);

  const formatMentions = useCallback((content: string): string => {
    return content.replace(/@([a-zA-Z0-9_-]+)/g, '<span class="mention">@$1</span>');
  }, []);

  return {
    extractMentions,
    hasMentions,
    formatMentions,
  };
}
