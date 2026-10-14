import { apiService } from '@/services/apiService';
import { useDocumentStore } from './documentStore';

jest.mock('@/services/apiService', () => ({ apiService: { get: jest.fn() } }));
jest.mock('@/services/socketService', () => ({ socketService: { leaveDocument: jest.fn() } }));
jest.mock('@/features/projects/documents/api', () => ({ getProjectDocuments: jest.fn() }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('document loading recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useDocumentStore.getState().reset();
  });

  afterEach(() => jest.useRealTimers());

  it('retries a transient connection error and loads the document', async () => {
    const document = { id: 'document-1', workspaceId: 'workspace-1' };
    (apiService.get as jest.Mock)
      .mockResolvedValueOnce({ success: false, error: { code: 'NETWORK_ERROR', message: 'Network error' } })
      .mockResolvedValueOnce({ success: true, data: { document } });

    await useDocumentStore.getState().fetchDocumentById(document.id);

    expect(apiService.get).toHaveBeenCalledTimes(2);
    expect(apiService.get).toHaveBeenLastCalledWith(
      '/api/documents/document-1',
      true,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(useDocumentStore.getState().currentDocument).toEqual(document);
    expect(useDocumentStore.getState().isLoading).toBe(false);
    expect(useDocumentStore.getState().error).toBeNull();
  });

  it('times out a stalled request, retries once, then leaves loading with a retryable error', async () => {
    jest.useFakeTimers();
    (apiService.get as jest.Mock).mockImplementation((_url: string, _auth: boolean, options: { signal: AbortSignal }) =>
      new Promise((resolve) => {
        options.signal.addEventListener('abort', () => resolve({
          success: false,
          error: { code: 'REQUEST_TIMEOUT', message: 'Timed out' },
        }), { once: true });
      })
    );

    const loading = useDocumentStore.getState().fetchDocumentById('document-1');
    await jest.advanceTimersByTimeAsync(20_000);
    await jest.advanceTimersByTimeAsync(600);
    await jest.advanceTimersByTimeAsync(20_000);
    await loading;

    expect(apiService.get).toHaveBeenCalledTimes(2);
    expect(useDocumentStore.getState().isLoading).toBe(false);
    expect(useDocumentStore.getState().error).toContain('tardó demasiado');
  });

  it('ignores an older document response after a newer document was requested', async () => {
    const stale = deferred<any>();
    (apiService.get as jest.Mock)
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValueOnce({ success: true, data: { document: { id: 'document-new', workspaceId: 'workspace-1' } } });

    const oldLoad = useDocumentStore.getState().fetchDocumentById('document-old');
    await useDocumentStore.getState().fetchDocumentById('document-new');
    stale.resolve({ success: true, data: { document: { id: 'document-old', workspaceId: 'workspace-1' } } });
    await oldLoad;

    expect(useDocumentStore.getState().currentDocument?.id).toBe('document-new');
  });
});
