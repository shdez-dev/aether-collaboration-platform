import { apiService } from '@/services/apiService';
import { useDocumentStore } from './documentStore';

jest.mock('@/services/apiService', () => ({
  apiService: { put: jest.fn(), get: jest.fn() },
}));
jest.mock('@/services/socketService', () => ({
  socketService: { joinDocument: jest.fn(), leaveDocument: jest.fn() },
}));
jest.mock('@/features/projects/documents/api', () => ({ getProjectDocuments: jest.fn() }));

describe('documentStore permissions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reports API permission errors instead of treating them as successful updates', async () => {
    (apiService.put as jest.Mock).mockResolvedValueOnce({
      success: false,
      error: { message: 'La persona no tiene acceso a este proyecto.' },
    });

    await expect(useDocumentStore.getState().updatePermission('document-1', 'user-1', 'COMMENT'))
      .rejects.toThrow('La persona no tiene acceso a este proyecto.');
  });

  it('reports errors when the people and permissions list fails to load', async () => {
    (apiService.get as jest.Mock).mockResolvedValueOnce({
      success: false,
      error: { message: 'Sin acceso al documento.' },
    });

    await expect(useDocumentStore.getState().getDocumentMembers('document-1'))
      .rejects.toThrow('Sin acceso al documento.');
  });
});
