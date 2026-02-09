// apps/web/src/stores/documentStore.ts

import { create } from 'zustand';
import { socketService } from '@/services/socketService';
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

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: any }> {
  try {
    const authData = localStorage.getItem('aether-auth-storage');
    let token = null;

    if (authData) {
      try {
        const parsed = JSON.parse(authData);
        token = parsed.state?.accessToken || parsed.accessToken;
      } catch (e) {
      }
    }

    const socketId = socketService.getSocketId();

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(socketId && { 'x-socket-id': socketId }),
        ...options.headers,
      },
    });

    const data = await response.json();
    if (!response.ok) return { success: false, error: data.error };
    return data;
  } catch (error) {
    return { success: false, error: { code: 'NETWORK_ERROR', message: 'Error de conexión' } };
  }
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
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
    set({ isLoading: true, error: null });
    const response = await apiRequest<{ documents: Document[] }>(
      `/api/workspaces/${workspaceId}/documents`
    );
    if (response.success && response.data) {
      set({ documents: response.data.documents, isLoading: false });
    } else {
      set({ error: response.error?.message || 'Error', isLoading: false });
    }
  },

  fetchDocumentById: async (documentId: string) => {
    set({ isLoading: true, error: null });
    const response = await apiRequest<{ document: DocumentWithDetails }>(
      `/api/documents/${documentId}`
    );
    if (response.success && response.data) {
      set({ currentDocument: response.data.document, isLoading: false });
      get().initYjsDoc();
    } else {
      set({ error: response.error?.message || 'Error', isLoading: false });
    }
  },

  createDocument: async (workspaceId: string, data: CreateDocumentData) => {
    set({ isLoading: true });
    const response = await apiRequest<{ document: Document }>(
      `/api/workspaces/${workspaceId}/documents`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
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
  },

  updateDocument: async (documentId: string, data: UpdateDocumentData) => {
    const response = await apiRequest(`/api/documents/${documentId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
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
      const response = await apiRequest(`/api/documents/${documentId}/yjs-state`, {
        method: 'PUT',
        body: JSON.stringify({ yjsState: Array.from(yjsState) }),
      });

      if (!response.success) {
      }
    } catch (error) {
    }
  },

  deleteDocument: async (documentId: string) => {
    const response = await apiRequest(`/api/documents/${documentId}`, { method: 'DELETE' });

    if (response.success) {
      set((state) => {
        const newDocuments = state.documents.filter((d) => d.id !== documentId);

        return {
          documents: newDocuments,
          currentDocument: state.currentDocument?.id === documentId ? null : state.currentDocument,
        };
      });
    } else {
      throw new Error(response.error?.message || 'Failed to delete document');
    }
  },

  createVersion: async (documentId: string, description?: string) => {
    await apiRequest(`/api/documents/${documentId}/versions`, {
      method: 'POST',
      body: JSON.stringify({ description }),
    });
  },

  getVersions: async (documentId: string) => {
    const response = await apiRequest<{ versions: any[] }>(`/api/documents/${documentId}/versions`);
    return response.data?.versions || [];
  },

  restoreVersion: async (documentId: string, versionId: string) => {
    await apiRequest(`/api/documents/${documentId}/versions/${versionId}/restore`, {
      method: 'POST',
    });
    await get().fetchDocumentById(documentId);
  },

  updatePermission: async (documentId, userId, permission) => {
    await apiRequest(`/api/documents/${documentId}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ userId, permission }),
    });
    await get().fetchDocumentById(documentId);
  },

  getDocumentMembers: async (documentId: string) => {
    const response = await apiRequest<{ members: any[] }>(`/api/documents/${documentId}/members`);
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
}));
