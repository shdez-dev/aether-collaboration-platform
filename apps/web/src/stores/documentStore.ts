// apps/web/src/stores/documentStore.ts

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { socketService } from '@/services/socketService';
import { apiService } from '@/services/apiService';
import type { Event, Document, DocumentWithDetails, DocumentPermission } from '@aether/types';
import * as Y from 'yjs';

interface ActiveDocumentUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  color: string;
  cursor?: number;
  selection?: { from: number; to: number };
}

interface DocumentState {
  documents: Document[];
  currentDocument: DocumentWithDetails | null;
  isLoading: boolean;
  error: string | null;
  yjsDoc: Y.Doc | null;
  activeUsers: ActiveDocumentUser[];

  saveYjsState: (documentId: string, yjsState: Uint8Array) => Promise<void>;
  fetchDocuments: (workspaceId: string) => Promise<void>;
  fetchDocumentById: (documentId: string) => Promise<void>;
  createDocument: (workspaceId: string, data: CreateDocumentData) => Promise<Document>;
  updateDocument: (documentId: string, data: UpdateDocumentData) => Promise<void>;
  deleteDocument: (documentId: string) => Promise<void>;
  createVersion: (documentId: string, description?: string) => Promise<void>;
  getVersions: (documentId: string) => Promise<any[]>;
  restoreVersion: (documentId: string, versionId: string) => Promise<void>;
  updatePermission: (
    documentId: string,
    userId: string,
    permission: DocumentPermission
  ) => Promise<void>;
  getDocumentMembers: (documentId: string) => Promise<any[]>;
  joinDocument: (documentId: string, workspaceId: string) => void;
  leaveDocument: (documentId: string) => void;
  handleEvent: (event: Event) => void;
  setActiveUsers: (users: ActiveDocumentUser[]) => void;
  initYjsDoc: () => void;
  destroyYjsDoc: () => void;
  clearError: () => void;
  selectDocument: (document: DocumentWithDetails | null) => void;
}

interface CreateDocumentData {
  title: string;
  templateId?: string;
}

interface UpdateDocumentData {
  title?: string;
  content?: string;
}

export const useDocumentStore = create<DocumentState>()(
  persist(
    (set, get) => ({
      documents: [],
      currentDocument: null,
      isLoading: false,
      error: null,
      yjsDoc: null,
      activeUsers: [],

      initYjsDoc: () => {
        const doc = new Y.Doc();
        set({ yjsDoc: doc });
      },

      destroyYjsDoc: () => {
        const { yjsDoc } = get();
        if (yjsDoc) {
          yjsDoc.destroy();
          set({ yjsDoc: null });
        }
      },

      joinDocument: (documentId: string, workspaceId: string) => {
        socketService.joinDocument(documentId, workspaceId);
      },

      leaveDocument: (documentId: string) => {
        socketService.leaveDocument(documentId);
        get().destroyYjsDoc();
        set({ activeUsers: [] });
      },

      handleEvent: (event: Event) => {
        switch (event.type) {
          case 'document.updated': {
            const { documentId, changes } = event.payload as any;
            const current = get().currentDocument;
            if (current && current.id === documentId) {
              set({ currentDocument: { ...current, ...changes } });
            }
            break;
          }
          case 'document.user.joined': {
            const { user } = event.payload as any;
            set((state) => ({ activeUsers: [...state.activeUsers, user] }));
            break;
          }
          case 'document.user.left': {
            const { userId } = event.payload as any;
            set((state) => ({ activeUsers: state.activeUsers.filter((u) => u.id !== userId) }));
            break;
          }
        }
      },

      setActiveUsers: (users: ActiveDocumentUser[]) => set({ activeUsers: users }),

      fetchDocuments: async (workspaceId: string) => {
        set({ isLoading: true, error: null, documents: [] });
        try {
          const response = await apiService.get<{ documents: Document[] }>(
            `/api/workspaces/${workspaceId}/documents`,
            true
          );
          if (response.success) {
            set({ documents: response.data?.documents ?? [], isLoading: false });
          } else {
            set({ error: response.error?.message || 'Error', isLoading: false });
          }
        } catch {
          set({ error: 'Error de conexión', isLoading: false });
        }
      },

      fetchDocumentById: async (documentId: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiService.get<{ document: DocumentWithDetails }>(
            `/api/documents/${documentId}`,
            true
          );
          if (response.success && response.data) {
            set({ currentDocument: response.data.document, isLoading: false });
            get().initYjsDoc();
          } else {
            set({
              error: response.error?.message || 'Error al cargar el documento',
              isLoading: false,
            });
          }
        } catch {
          set({ error: 'Error de conexión al cargar el documento', isLoading: false });
        }
      },

      createDocument: async (workspaceId: string, data: CreateDocumentData) => {
        set({ isLoading: true });
        try {
          const response = await apiService.post<{ document: Document }>(
            `/api/workspaces/${workspaceId}/documents`,
            data,
            true
          );
          if (response.success && response.data) {
            set((state) => ({
              documents: [...state.documents, response.data!.document],
              isLoading: false,
            }));
            return response.data.document;
          }
          set({ isLoading: false });
          throw new Error(response.error?.message);
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      updateDocument: async (documentId: string, data: UpdateDocumentData) => {
        const response = await apiService.put(`/api/documents/${documentId}`, data, true);
        if (response.success && response.data) {
          set((state) => ({
            documents: state.documents.map((d) =>
              d.id === documentId ? (response.data as any).document : d
            ),
            currentDocument:
              state.currentDocument?.id === documentId
                ? { ...state.currentDocument, ...(response.data as any).document }
                : state.currentDocument,
          }));
        }
      },

      saveYjsState: async (documentId: string, yjsState: Uint8Array) => {
        try {
          const response = await apiService.put(
            `/api/documents/${documentId}/yjs-state`,
            { yjsState: Array.from(yjsState) },
            true
          );

          if (!response.success) {
          }
        } catch (error) {}
      },

      deleteDocument: async (documentId: string) => {
        const response = await apiService.delete(`/api/documents/${documentId}`, true);

        if (response.success) {
          set((state) => {
            const newDocuments = state.documents.filter((d) => d.id !== documentId);

            return {
              documents: newDocuments,
              currentDocument:
                state.currentDocument?.id === documentId ? null : state.currentDocument,
            };
          });
        } else {
          throw new Error(response.error?.message || 'Failed to delete document');
        }
      },

      createVersion: async (documentId: string, description?: string) => {
        await apiService.post(`/api/documents/${documentId}/versions`, { description }, true);
      },

      getVersions: async (documentId: string) => {
        const response = await apiService.get<{ versions: any[] }>(
          `/api/documents/${documentId}/versions`,
          true
        );
        return response.data?.versions || [];
      },

      restoreVersion: async (documentId: string, versionId: string) => {
        await apiService.post(
          `/api/documents/${documentId}/versions/${versionId}/restore`,
          {},
          true
        );
        await get().fetchDocumentById(documentId);
      },

      updatePermission: async (documentId, userId, permission) => {
        await apiService.put(
          `/api/documents/${documentId}/permissions`,
          { userId, permission },
          true
        );
        await get().fetchDocumentById(documentId);
      },

      getDocumentMembers: async (documentId: string) => {
        const response = await apiService.get<{ members: any[] }>(
          `/api/documents/${documentId}/members`,
          true
        );
        return response.data?.members || [];
      },

      selectDocument: (document: DocumentWithDetails | null) => {
        const current = get().currentDocument;
        if (current && current.id !== document?.id) {
          get().leaveDocument(current.id);
        }
        set({ currentDocument: document });
        if (document) {
          get().joinDocument(document.id, document.workspaceId);
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'aether-document-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        documents: state.documents,
        currentDocument: state.currentDocument,
      }),
    }
  )
);
