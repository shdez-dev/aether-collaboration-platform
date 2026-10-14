import { apiService } from './apiService';

jest.mock('./socketService', () => ({ socketService: { getSocketId: jest.fn() } }));

describe('apiService request cancellation', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    localStorage.setItem('aether-auth-storage', JSON.stringify({
      state: { accessToken: 'access-token', refreshToken: 'refresh-token' },
      version: 0,
    }));
  });

  afterEach(() => {
    global.fetch = originalFetch;
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('reports an aborted document request as a timeout without clearing the session', async () => {
    const controller = new AbortController();
    controller.abort();
    global.fetch = jest.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')) as jest.Mock;

    const response = await apiService.get('/api/documents/document-1', true, { signal: controller.signal });

    expect(response.success).toBe(false);
    expect(response.error?.code).toBe('REQUEST_TIMEOUT');
    expect(localStorage.getItem('aether-auth-storage')).not.toBeNull();
  });
});
