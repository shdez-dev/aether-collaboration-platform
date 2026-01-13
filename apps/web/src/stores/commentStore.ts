// apps/web/src/stores/commentStore.ts

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { CommentWithUser } from '@aether/types';
import { commentService } from '@/services/commentService';
import { useAuthStore } from './authStore';

/**
 * Estado del store de comentarios
 */
interface CommentState {
  // Comentarios por cardId
  commentsByCard: Record<string, CommentWithUser[]>;

  // Contadores por cardId
  countsByCard: Record<string, number>;

  // Estados de carga
  loading: Record<string, boolean>;

  // Errores
  errors: Record<string, string | null>;

  // Comentario en edición
  editingCommentId: string | null;
}

/**
 * Acciones del store
 */
interface CommentActions {
  // CRUD operations
  fetchCommentsByCard: (cardId: string) => Promise<void>;
  createComment: (
    cardId: string,
    content: string,
    mentions?: string[]
  ) => Promise<CommentWithUser | null>;
  updateComment: (commentId: string, content: string, mentions?: string[]) => Promise<void>;
  deleteComment: (commentId: string, cardId: string) => Promise<void>;
  fetchCommentCount: (cardId: string) => Promise<void>;

  // Local state management
  addCommentOptimistic: (cardId: string, comment: CommentWithUser) => void;
  updateCommentOptimistic: (commentId: string, updates: Partial<CommentWithUser>) => void;
  removeCommentOptimistic: (commentId: string, cardId: string) => void;

  // UI state
  setEditingComment: (commentId: string | null) => void;
  clearCardComments: (cardId: string) => void;
  clearError: (cardId: string) => void;
  resetStore: () => void;
}

/**
 * Estado inicial
 */
const initialState: CommentState = {
  commentsByCard: {},
  countsByCard: {},
  loading: {},
  errors: {},
  editingCommentId: null,
};

/**
 * CommentStore
 * Maneja el estado global de comentarios usando Zustand
 */
export const useCommentStore = create<CommentState & CommentActions>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // ========================================================================
      // FETCH COMMENTS BY CARD
      // ========================================================================
      fetchCommentsByCard: async (cardId: string) => {
        // Obtener token del authStore
        const accessToken = useAuthStore.getState().accessToken;

        if (!accessToken) {
          console.error('[CommentStore] No access token available');
          set((state) => ({
            errors: { ...state.errors, [cardId]: 'No estás autenticado' },
          }));
          return;
        }

        try {
          set((state) => ({
            loading: { ...state.loading, [cardId]: true },
            errors: { ...state.errors, [cardId]: null },
          }));

          console.log(`[CommentStore] Fetching comments for card: ${cardId}`);

          // commentService.getCommentsByCard retorna CommentWithUser[]
          const comments = await commentService.getCommentsByCard(cardId);

          console.log(`[CommentStore] Loaded ${comments.length} comments`);

          set((state) => ({
            commentsByCard: { ...state.commentsByCard, [cardId]: comments },
            countsByCard: { ...state.countsByCard, [cardId]: comments.length },
            loading: { ...state.loading, [cardId]: false },
          }));
        } catch (error: any) {
          console.error('[CommentStore] Error fetching comments:', error);
          set((state) => ({
            loading: { ...state.loading, [cardId]: false },
            errors: { ...state.errors, [cardId]: error.message },
          }));
        }
      },

      // ========================================================================
      // CREATE COMMENT
      // ========================================================================
      createComment: async (cardId: string, content: string, mentions?: string[]) => {
        // Obtener token y usuario del authStore
        const accessToken = useAuthStore.getState().accessToken;
        const currentUser = useAuthStore.getState().user;

        if (!accessToken || !currentUser) {
          console.error('[CommentStore] No access token or user available');
          set((state) => ({
            errors: { ...state.errors, [`create-${cardId}`]: 'No estás autenticado' },
          }));
          return null;
        }

        try {
          set((state) => ({
            loading: { ...state.loading, [`create-${cardId}`]: true },
            errors: { ...state.errors, [`create-${cardId}`]: null },
          }));

          console.log(`[CommentStore] Creating comment on card: ${cardId}`);

          // Crear comentario optimista
          const optimisticComment: CommentWithUser = {
            id: `temp-${Date.now()}`,
            cardId,
            userId: currentUser.id,
            content,
            mentions: mentions || [],
            edited: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            user: {
              id: currentUser.id,
              email: currentUser.email,
              name: currentUser.name,
              avatar: currentUser.avatar,
              createdAt: currentUser.createdAt,
              updatedAt: currentUser.createdAt, // Usar el mismo timestamp
            },
          };

          // Agregar optimísticamente
          get().addCommentOptimistic(cardId, optimisticComment);

          // commentService.createComment retorna CommentWithUser
          const newComment = await commentService.createComment(cardId, {
            content,
            mentions,
          });

          console.log('[CommentStore] Comment created:', newComment.id);

          // Reemplazar comentario optimista con el real
          set((state) => {
            const existingComments = state.commentsByCard[cardId] || [];
            const filteredComments = existingComments.filter((c) => c.id !== optimisticComment.id);

            return {
              commentsByCard: {
                ...state.commentsByCard,
                [cardId]: [...filteredComments, newComment],
              },
              countsByCard: {
                ...state.countsByCard,
                [cardId]: filteredComments.length + 1,
              },
              loading: { ...state.loading, [`create-${cardId}`]: false },
            };
          });

          return newComment;
        } catch (error: any) {
          console.error('[CommentStore] Error creating comment:', error);

          // Remover comentario optimista en caso de error
          set((state) => {
            const existingComments = state.commentsByCard[cardId] || [];
            const filteredComments = existingComments.filter((c) => !c.id.startsWith('temp-'));

            return {
              commentsByCard: {
                ...state.commentsByCard,
                [cardId]: filteredComments,
              },
              countsByCard: {
                ...state.countsByCard,
                [cardId]: filteredComments.length,
              },
              loading: { ...state.loading, [`create-${cardId}`]: false },
              errors: { ...state.errors, [`create-${cardId}`]: error.message },
            };
          });

          return null;
        }
      },

      // ========================================================================
      // UPDATE COMMENT
      // ========================================================================
      updateComment: async (commentId: string, content: string, mentions?: string[]) => {
        const accessToken = useAuthStore.getState().accessToken;

        if (!accessToken) {
          console.error('[CommentStore] No access token available');
          set((state) => ({
            errors: { ...state.errors, [`update-${commentId}`]: 'No estás autenticado' },
          }));
          return;
        }

        try {
          set((state) => ({
            loading: { ...state.loading, [`update-${commentId}`]: true },
            errors: { ...state.errors, [`update-${commentId}`]: null },
          }));

          console.log(`[CommentStore] Updating comment: ${commentId}`);

          // Update optimista
          get().updateCommentOptimistic(commentId, {
            content,
            mentions: mentions || [],
            edited: true,
          });

          // commentService.updateComment retorna CommentWithUser
          const updatedComment = await commentService.updateComment(commentId, {
            content,
            mentions,
          });

          console.log('[CommentStore] Comment updated');

          // Actualizar con datos reales del servidor
          set((state) => {
            const newCommentsByCard = { ...state.commentsByCard };

            Object.keys(newCommentsByCard).forEach((cardId) => {
              const comments = newCommentsByCard[cardId];
              const index = comments.findIndex((c) => c.id === commentId);
              if (index !== -1) {
                newCommentsByCard[cardId] = [
                  ...comments.slice(0, index),
                  updatedComment,
                  ...comments.slice(index + 1),
                ];
              }
            });

            return {
              commentsByCard: newCommentsByCard,
              loading: { ...state.loading, [`update-${commentId}`]: false },
              editingCommentId: null,
            };
          });
        } catch (error: any) {
          console.error('[CommentStore] Error updating comment:', error);
          set((state) => ({
            loading: { ...state.loading, [`update-${commentId}`]: false },
            errors: { ...state.errors, [`update-${commentId}`]: error.message },
          }));
        }
      },

      // ========================================================================
      // DELETE COMMENT
      // ========================================================================
      deleteComment: async (commentId: string, cardId: string) => {
        const accessToken = useAuthStore.getState().accessToken;

        if (!accessToken) {
          console.error('[CommentStore] No access token available');
          set((state) => ({
            errors: { ...state.errors, [`delete-${commentId}`]: 'No estás autenticado' },
          }));
          return;
        }

        try {
          set((state) => ({
            loading: { ...state.loading, [`delete-${commentId}`]: true },
            errors: { ...state.errors, [`delete-${commentId}`]: null },
          }));

          console.log(`[CommentStore] Deleting comment: ${commentId}`);

          // Backup para posible rollback
          const backup = get().commentsByCard[cardId];

          // Remover optimísticamente
          get().removeCommentOptimistic(commentId, cardId);

          // commentService.deleteComment retorna void
          await commentService.deleteComment(commentId);

          console.log('[CommentStore] Comment deleted');

          set((state) => ({
            loading: { ...state.loading, [`delete-${commentId}`]: false },
          }));
        } catch (error: any) {
          console.error('[CommentStore] Error deleting comment:', error);

          // Rollback en caso de error
          set((state) => ({
            commentsByCard: {
              ...state.commentsByCard,
              [cardId]: state.commentsByCard[cardId] || [],
            },
            loading: { ...state.loading, [`delete-${commentId}`]: false },
            errors: { ...state.errors, [`delete-${commentId}`]: error.message },
          }));
        }
      },

      // ========================================================================
      // FETCH COMMENT COUNT
      // ========================================================================
      fetchCommentCount: async (cardId: string) => {
        const accessToken = useAuthStore.getState().accessToken;

        if (!accessToken) {
          console.error('[CommentStore] No access token available for count');
          return;
        }

        try {
          console.log(`[CommentStore] Fetching comment count for card: ${cardId}`);

          // commentService.getCommentsByCard retorna CommentWithUser[]
          const comments = await commentService.getCommentsByCard(cardId);

          set((state) => ({
            countsByCard: { ...state.countsByCard, [cardId]: comments.length },
          }));
        } catch (error: any) {
          console.error('[CommentStore] Error fetching comment count:', error);
        }
      },

      // ========================================================================
      // OPTIMISTIC UPDATES
      // ========================================================================
      addCommentOptimistic: (cardId: string, comment: CommentWithUser) => {
        set((state) => {
          const existingComments = state.commentsByCard[cardId] || [];
          return {
            commentsByCard: {
              ...state.commentsByCard,
              [cardId]: [...existingComments, comment],
            },
            countsByCard: {
              ...state.countsByCard,
              [cardId]: existingComments.length + 1,
            },
          };
        });
      },

      updateCommentOptimistic: (commentId: string, updates: Partial<CommentWithUser>) => {
        set((state) => {
          const newCommentsByCard = { ...state.commentsByCard };

          Object.keys(newCommentsByCard).forEach((cardId) => {
            const comments = newCommentsByCard[cardId];
            const index = comments.findIndex((c) => c.id === commentId);
            if (index !== -1) {
              newCommentsByCard[cardId] = [
                ...comments.slice(0, index),
                { ...comments[index], ...updates },
                ...comments.slice(index + 1),
              ];
            }
          });

          return { commentsByCard: newCommentsByCard };
        });
      },

      removeCommentOptimistic: (commentId: string, cardId: string) => {
        set((state) => {
          const existingComments = state.commentsByCard[cardId] || [];
          const filteredComments = existingComments.filter((c) => c.id !== commentId);

          return {
            commentsByCard: {
              ...state.commentsByCard,
              [cardId]: filteredComments,
            },
            countsByCard: {
              ...state.countsByCard,
              [cardId]: filteredComments.length,
            },
          };
        });
      },

      // ========================================================================
      // UI STATE MANAGEMENT
      // ========================================================================
      setEditingComment: (commentId: string | null) => {
        set({ editingCommentId: commentId });
      },

      clearCardComments: (cardId: string) => {
        set((state) => {
          const newCommentsByCard = { ...state.commentsByCard };
          const newCountsByCard = { ...state.countsByCard };
          const newLoading = { ...state.loading };
          const newErrors = { ...state.errors };

          delete newCommentsByCard[cardId];
          delete newCountsByCard[cardId];
          delete newLoading[cardId];
          delete newErrors[cardId];

          return {
            commentsByCard: newCommentsByCard,
            countsByCard: newCountsByCard,
            loading: newLoading,
            errors: newErrors,
          };
        });
      },

      clearError: (cardId: string) => {
        set((state) => ({
          errors: { ...state.errors, [cardId]: null },
        }));
      },

      resetStore: () => {
        set(initialState);
      },
    }),
    { name: 'CommentStore' }
  )
);

// ========================================================================
// SELECTORES
// ========================================================================

export const selectCommentsByCard = (cardId: string) => (state: CommentState & CommentActions) =>
  state.commentsByCard[cardId] || [];

export const selectCommentCount = (cardId: string) => (state: CommentState & CommentActions) =>
  state.countsByCard[cardId] || 0;

export const selectIsLoading = (key: string) => (state: CommentState & CommentActions) =>
  state.loading[key] || false;

export const selectError = (key: string) => (state: CommentState & CommentActions) =>
  state.errors[key] || null;

export const selectIsEditing = (commentId: string) => (state: CommentState & CommentActions) =>
  state.editingCommentId === commentId;
