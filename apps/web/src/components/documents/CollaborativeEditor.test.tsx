import { act, render, screen, waitFor } from '@testing-library/react';
import * as Y from 'yjs';
import CollaborativeEditor from './CollaborativeEditor';
import { socketService } from '@/services/socketService';

jest.mock('lowlight', () => ({
  common: {},
  createLowlight: () => ({
    register: jest.fn(),
    listLanguages: () => [],
    highlight: () => ({ children: [] }),
    highlightAuto: () => ({ children: [] }),
  }),
}));

jest.mock('@/services/socketService', () => {
  const syncHandlers = new Set<
    (data: { documentId: string; update: number[]; restoreGeneration: number }) => void
  >();
  return {
    socketService: {
      onYjsSync: (handler: (data: { documentId: string; update: number[]; restoreGeneration: number }) => void) => syncHandlers.add(handler),
      onYjsUpdate: jest.fn(),
      onForceReload: jest.fn(),
      isConnected: jest.fn(() => true),
      onConnect: jest.fn(),
      offConnect: jest.fn(),
      on: jest.fn(),
      off: (event: string, handler: (data: { documentId: string; update: number[]; restoreGeneration: number }) => void) => {
        if (event === 'document:sync') syncHandlers.delete(handler);
      },
      joinDocument: jest.fn(),
      leaveDocument: jest.fn(),
      sendYjsUpdate: jest.fn(),
      emit: jest.fn(),
      emitSync: (data: { documentId: string; update: number[]; restoreGeneration: number }) => syncHandlers.forEach((handler) => handler(data)),
    },
  };
});

jest.mock('@/stores/documentStore', () => ({
  useDocumentStore: () => ({ saveYjsState: jest.fn().mockResolvedValue(undefined) }),
}));

const mockMembers: never[] = [];
jest.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: (selector: (state: { currentMembers: never[] }) => unknown) => selector({ currentMembers: mockMembers }),
}));

jest.mock('@/stores/documentCommentStore', () => {
  const emptyComments: never[] = [];
  type CommentState = {
    commentsByDocument: Record<string, never[]>;
    sidebarOpen: boolean;
    activeCommentId: string | null;
  };
  const state = {
    commentsByDocument: {}, sidebarOpen: false, activeCommentId: null,
    setSidebarOpen: jest.fn(), setPendingSelection: jest.fn(),
    ingestAdded: jest.fn(), ingestUpdated: jest.fn(), ingestDeleted: jest.fn(), ingestResolved: jest.fn(),
    clearDocument: jest.fn(),
  };
  return {
    useDocumentCommentStore: (selector?: (current: CommentState) => unknown) => selector ? selector(state) : state,
    selectSidebarOpen: (current: CommentState) => current.sidebarOpen,
    selectActiveCommentId: (current: CommentState) => current.activeCommentId,
    selectDocumentComments: () => () => emptyComments,
  };
});

jest.mock('@/components/documents/DocumentCommentsSidebar', () => ({
  DocumentCommentsSidebar: () => null,
  CommentGutterIndicators: () => null,
}));
jest.mock('@/hooks/useDocumentAutoSave', () => ({
  useDocumentAutoSave: () => ({ saveNow: jest.fn(), isSaving: false, lastSavedAt: null }),
}));
jest.mock('@/lib/i18n', () => ({ useT: () => ({}) }));

describe('CollaborativeEditor', () => {
  beforeAll(() => {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    global.ResizeObserver = ResizeObserverMock;
    window.requestAnimationFrame = (callback) => window.setTimeout(callback, 0);
    window.cancelAnimationFrame = (id) => window.clearTimeout(id);
  });

  it('remains mounted after sync and editor transactions with the selection menu enabled', async () => {
    const props = {
      documentId: 'document-1', workspaceId: 'workspace-1',
      currentUser: { id: 'user-1', name: 'Ana', color: '#7452a6' },
      canEdit: true, canComment: true,
    };
    const view = render(<CollaborativeEditor {...props} />);
    const source = new Y.Doc();

    await act(async () => {
      (socketService as typeof socketService & {
        emitSync: (data: { documentId: string; update: number[]; restoreGeneration: number }) => void;
      }).emitSync({
        documentId: props.documentId,
        update: Array.from(Y.encodeStateAsUpdate(source)),
        restoreGeneration: 0,
      });
    });

    await waitFor(() => expect(document.querySelector('.ProseMirror')).toBeTruthy());
    view.rerender(<CollaborativeEditor {...props} currentUser={{ ...props.currentUser }} />);
    await waitFor(() => expect(screen.getByLabelText('0 de 100.000 caracteres')).toBeTruthy());
    expect(document.querySelector('.ProseMirror')).toBeTruthy();
    source.destroy();
  });
});
