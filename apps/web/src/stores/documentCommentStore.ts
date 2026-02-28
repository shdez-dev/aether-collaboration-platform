// apps/web/src/stores/documentCommentStore.ts

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  documentCommentService,
  type DocumentCommentData,
  type DocumentCommentPosition,
} from '@/services/documentCommentService';

export type { DocumentCommentData } from '@/services/documentCommentService';
import { useAuthStore } from './authStore';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DocumentCommentState {
  /** Top-level comments (with nested replies) keyed by documentId */
  commentsByDocument: Record<string, DocumentCommentData[]>;
  loading: Record<string, boolean>;
  errors: Record<string, string | null>;

  /** ID of the comment thread currently active/focused in the sidebar */
  activeCommentId: string | null;

  /** Whether the comment sidebar is visible */
  sidebarOpen: boolean;

  /** Pending new comment: set when user makes a text selection */
  pendingSelection: { from: number; to: number } | null;
}

interface DocumentCommentActions {
  // Fetch
  fetchComments: (documentId: string) => Promise<void>;

  // CRUD
  addComment: (
    documentId: string,
    content: string,
    position: DocumentCommentPosition,
    parentId?: string | null
  ) => Promise<DocumentCommentData | null>;
  editComment: (commentId: string, content: string) => Promise<void>;
  removeComment: (commentId: string, documentId: string) => Promise<void>;
  resolveComment: (commentId: string, resolved: boolean) => Promise<void>;

  // Realtime ingest (called from socket events)
  ingestAdded: (documentId: string, comment: DocumentCommentData) => void;
  ingestUpdated: (documentId: string, comment: DocumentCommentData) => void;
  ingestDeleted: (documentId: string, commentId: string) => void;
  ingestResolved: (documentId: string, comment: DocumentCommentData) => void;

  // UI
  setActiveComment: (commentId: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  setPendingSelection: (sel: { from: number; to: number } | null) => void;
  clearDocument: (documentId: string) => void;
}

// ── Initial state ─────────────────────────────────────────────────────────────

const initialState: DocumentCommentState = {
  commentsByDocument: {},
  loading: {},
  errors: {},
  activeCommentId: null,
  sidebarOpen: false,
  pendingSelection: null,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Replace or add a root comment (or update a reply inside it) */
function upsertComment(
  list: DocumentCommentData[],
  updated: DocumentCommentData
): DocumentCommentData[] {
  // If it's a reply, recurse into the parent
  if (updated.parentId) {
    return list.map((c) => {
      if (c.id === updated.parentId) {
        const replies = c.replies ?? [];
        const idx = replies.findIndex((r: DocumentCommentData) => r.id === updated.id);
        return {
          ...c,
          replies:
            idx >= 0
              ? [...replies.slice(0, idx), updated, ...replies.slice(idx + 1)]
              : [...replies, updated],
        };
      }
      return c;
    });
  }

  // Root comment
  const idx = list.findIndex((c) => c.id === updated.id);
  if (idx >= 0) {
    return [...list.slice(0, idx), updated, ...list.slice(idx + 1)];
  }
  return [...list, updated];
}

/** Remove a comment by id (from roots or nested replies) */
function removeFromList(list: DocumentCommentData[], id: string): DocumentCommentData[] {
  return list
    .filter((c) => c.id !== id)
    .map((c) => ({
      ...c,
      replies: c.replies ? removeFromList(c.replies, id) : [],
    }));
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useDocumentCommentStore = create<DocumentCommentState & DocumentCommentActions>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // ── Fetch ──────────────────────────────────────────────────────────────
      fetchComments: async (documentId) => {
        set((s) => ({
          loading: { ...s.loading, [documentId]: true },
          errors: { ...s.errors, [documentId]: null },
        }));
        try {
          const comments = await documentCommentService.list(documentId);
          set((s) => ({
            commentsByDocument: { ...s.commentsByDocument, [documentId]: comments },
            loading: { ...s.loading, [documentId]: false },
          }));
        } catch (err: any) {
          set((s) => ({
            loading: { ...s.loading, [documentId]: false },
            errors: { ...s.errors, [documentId]: err.message },
          }));
        }
      },

      // ── Add comment ────────────────────────────────────────────────────────
      addComment: async (documentId, content, position, parentId) => {
        const user = useAuthStore.getState().user;
        if (!user) return null;

        // Optimistic
        const optimistic: DocumentCommentData = {
          id: `temp-${Date.now()}`,
          documentId,
          content,
          position,
          resolved: false,
          createdBy: user.id,
          parentId: parentId ?? null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar ?? null },
          replies: [],
        };

        set((s) => ({
          commentsByDocument: {
            ...s.commentsByDocument,
            [documentId]: upsertComment(s.commentsByDocument[documentId] ?? [], optimistic),
          },
        }));

        try {
          const created = await documentCommentService.create(documentId, {
            content,
            position,
            parentId: parentId ?? null,
          });
          // Replace optimistic with real
          set((s) => ({
            commentsByDocument: {
              ...s.commentsByDocument,
              [documentId]: upsertComment(
                removeFromList(s.commentsByDocument[documentId] ?? [], optimistic.id),
                { ...created, replies: created.replies ?? [] }
              ),
            },
          }));
          return created;
        } catch (err: any) {
          // Rollback
          set((s) => ({
            commentsByDocument: {
              ...s.commentsByDocument,
              [documentId]: removeFromList(s.commentsByDocument[documentId] ?? [], optimistic.id),
            },
          }));
          return null;
        }
      },

      // ── Edit comment ───────────────────────────────────────────────────────
      editComment: async (commentId, content) => {
        try {
          const updated = await documentCommentService.update(commentId, content);
          const documentId = updated.documentId;
          set((s) => ({
            commentsByDocument: {
              ...s.commentsByDocument,
              [documentId]: upsertComment(s.commentsByDocument[documentId] ?? [], updated),
            },
          }));
        } catch {
          // silently fail — user will see no change
        }
      },

      // ── Remove comment ─────────────────────────────────────────────────────
      removeComment: async (commentId, documentId) => {
        // Optimistic remove
        set((s) => ({
          commentsByDocument: {
            ...s.commentsByDocument,
            [documentId]: removeFromList(s.commentsByDocument[documentId] ?? [], commentId),
          },
        }));
        try {
          await documentCommentService.delete(commentId);
        } catch {
          // Re-fetch to restore state
          await get().fetchComments(documentId);
        }
      },

      // ── Resolve comment ────────────────────────────────────────────────────
      resolveComment: async (commentId, resolved) => {
        try {
          const updated = await documentCommentService.setResolved(commentId, resolved);
          const documentId = updated.documentId;
          set((s) => ({
            commentsByDocument: {
              ...s.commentsByDocument,
              [documentId]: upsertComment(s.commentsByDocument[documentId] ?? [], updated),
            },
          }));
        } catch {
          // silently fail
        }
      },

      // ── Realtime ingest ────────────────────────────────────────────────────
      ingestAdded: (documentId, comment) => {
        set((s) => ({
          commentsByDocument: {
            ...s.commentsByDocument,
            [documentId]: upsertComment(s.commentsByDocument[documentId] ?? [], {
              ...comment,
              replies: comment.replies ?? [],
            }),
          },
        }));
      },

      ingestUpdated: (documentId, comment) => {
        set((s) => ({
          commentsByDocument: {
            ...s.commentsByDocument,
            [documentId]: upsertComment(s.commentsByDocument[documentId] ?? [], comment),
          },
        }));
      },

      ingestDeleted: (documentId, commentId) => {
        set((s) => ({
          commentsByDocument: {
            ...s.commentsByDocument,
            [documentId]: removeFromList(s.commentsByDocument[documentId] ?? [], commentId),
          },
        }));
      },

      ingestResolved: (documentId, comment) => {
        set((s) => ({
          commentsByDocument: {
            ...s.commentsByDocument,
            [documentId]: upsertComment(s.commentsByDocument[documentId] ?? [], comment),
          },
        }));
      },

      // ── UI ─────────────────────────────────────────────────────────────────
      setActiveComment: (commentId) => set({ activeCommentId: commentId }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setPendingSelection: (sel) => set({ pendingSelection: sel }),

      clearDocument: (documentId) => {
        set((s) => {
          const c = { ...s.commentsByDocument };
          const l = { ...s.loading };
          const e = { ...s.errors };
          delete c[documentId];
          delete l[documentId];
          delete e[documentId];
          return { commentsByDocument: c, loading: l, errors: e };
        });
      },
    }),
    { name: 'DocumentCommentStore' }
  )
);

// ── Selectors ─────────────────────────────────────────────────────────────────

export const selectDocumentComments =
  (documentId: string) => (s: DocumentCommentState & DocumentCommentActions) =>
    s.commentsByDocument[documentId] ?? [];

export const selectActiveCommentId = (s: DocumentCommentState & DocumentCommentActions) =>
  s.activeCommentId;

export const selectSidebarOpen = (s: DocumentCommentState & DocumentCommentActions) =>
  s.sidebarOpen;

export const selectPendingSelection = (s: DocumentCommentState & DocumentCommentActions) =>
  s.pendingSelection;
