// apps/web/src/stores/__tests__/authStore.test.ts

import { act, renderHook, waitFor } from '@testing-library/react';
import { useAuthStore } from '../authStore';
import { apiService } from '@/services/apiService';
import { socketService } from '@/services/socketService';

// Mock dependencies
jest.mock('@/services/apiService');
jest.mock('@/services/socketService');

describe('AuthStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      pendingEmailVerification: null,
      emailNotVerified: null,
    });
    // resetAllMocks limpia también los valores encolados con mockResolvedValueOnce
    jest.resetAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useAuthStore());

      expect(result.current.user).toBeNull();
      expect(result.current.accessToken).toBeNull();
      expect(result.current.refreshToken).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('Register', () => {
    it('should register user and set pendingEmailVerification', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date().toISOString(),
      };

      (apiService.post as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: { user: mockUser },
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.register('Test User', 'test@example.com', 'password123');
      });

      await waitFor(() => {
        // Después del registro el usuario debe verificar su email, no se autentica aún
        expect(result.current.isAuthenticated).toBe(false);
        expect(result.current.pendingEmailVerification).toBe('test@example.com');
        expect(result.current.isLoading).toBe(false);
      });

      // No se conecta el socket hasta que el usuario verifique y haga login
      expect(socketService.connect).not.toHaveBeenCalled();
    });

    it('should handle registration error', async () => {
      (apiService.post as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: { message: 'Email already exists' },
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.register('Test User', 'test@example.com', 'password123');
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Email already exists');
        expect(result.current.isAuthenticated).toBe(false);
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should handle unexpected errors during registration', async () => {
      (apiService.post as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.register('Test User', 'test@example.com', 'password123');
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Network error');
        expect(result.current.isAuthenticated).toBe(false);
      });
    });
  });

  describe('Login', () => {
    it('should login successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date().toISOString(),
      };

      const mockTokens = {
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
      };

      (apiService.post as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: {
          user: mockUser,
          ...mockTokens,
        },
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.user).toEqual(mockUser);
        expect(result.current.accessToken).toBe(mockTokens.accessToken);
        expect(result.current.refreshToken).toBe(mockTokens.refreshToken);
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBeNull();
      });

      expect(socketService.connect).toHaveBeenCalledWith(mockTokens.accessToken);
    });

    it('should handle login error', async () => {
      (apiService.post as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: { message: 'Invalid credentials' },
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.login('test@example.com', 'wrongpassword');
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Invalid credentials');
        expect(result.current.isAuthenticated).toBe(false);
        expect(result.current.isLoading).toBe(false);
      });

      expect(socketService.connect).not.toHaveBeenCalled();
    });

    it('should set loading state during login', async () => {
      (apiService.post as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  success: true,
                  data: {
                    user: {
                      id: '1',
                      email: 'test@test.com',
                      name: 'Test',
                      createdAt: new Date().toISOString(),
                    },
                    accessToken: 'token',
                    refreshToken: 'refresh',
                  },
                }),
              100
            )
          )
      );

      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.login('test@example.com', 'password123');
      });

      // Should be loading immediately
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('Logout', () => {
    it('should logout successfully', async () => {
      // First login
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date().toISOString(),
      };

      (apiService.post as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: {
          user: mockUser,
          accessToken: 'access_token',
          refreshToken: 'refresh_token',
        },
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      // Mock logout API call
      (apiService.post as jest.Mock).mockResolvedValueOnce({
        success: true,
      });

      // Now logout
      await act(async () => {
        await result.current.logout();
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false);
        expect(result.current.user).toBeNull();
        expect(result.current.accessToken).toBeNull();
        expect(result.current.refreshToken).toBeNull();
      });

      expect(socketService.disconnect).toHaveBeenCalled();
    });

    it('should clear state even if logout API fails', async () => {
      // Setup authenticated state
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setAuth(
          {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            createdAt: new Date().toISOString(),
          },
          {
            accessToken: 'token',
            refreshToken: 'refresh',
          }
        );
      });

      // Mock logout API failure
      (apiService.post as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await act(async () => {
        await result.current.logout();
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false);
        expect(result.current.user).toBeNull();
      });
    });
  });

  describe('Get Current User', () => {
    it('should fetch current user successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        bio: 'Test bio',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Setup authenticated state first
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setAuth(
          {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            createdAt: new Date().toISOString(),
          },
          {
            accessToken: 'token',
            refreshToken: 'refresh',
          }
        );
      });

      (apiService.get as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: { user: mockUser },
      });

      await act(async () => {
        await result.current.getCurrentUser();
      });

      await waitFor(() => {
        expect(result.current.user?.bio).toBe('Test bio');
      });
    });

    it('should clear auth when fetching current user fails', async () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setAuth(
          {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            createdAt: new Date().toISOString(),
          },
          {
            accessToken: 'token',
            refreshToken: 'refresh',
          }
        );
      });

      (apiService.get as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: { message: 'Unauthorized' },
      });

      await act(async () => {
        await result.current.getCurrentUser();
      });

      await waitFor(
        () => {
          // When getCurrentUser fails, it clears auth instead of setting error
          expect(result.current.isAuthenticated).toBe(false);
          expect(result.current.user).toBeNull();
        },
        { timeout: 2000 }
      );
    });
  });

  describe('Update Profile', () => {
    it('should update user profile successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        bio: 'Updated bio',
        position: 'Developer',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setAuth(
          {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            createdAt: new Date().toISOString(),
          },
          {
            accessToken: 'token',
            refreshToken: 'refresh',
          }
        );
      });

      (apiService.put as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: { user: mockUser },
      });

      await act(async () => {
        await result.current.updateProfile({
          bio: 'Updated bio',
          position: 'Developer',
        });
      });

      await waitFor(() => {
        expect(result.current.user?.bio).toBe('Updated bio');
        expect(result.current.user?.position).toBe('Developer');
      });
    });
  });

  describe('Clear Error', () => {
    it('should clear error state', () => {
      const { result } = renderHook(() => useAuthStore());

      // Manually set an error
      act(() => {
        useAuthStore.setState({ error: 'Some error' });
      });

      expect(result.current.error).toBe('Some error');

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('Hydration', () => {
    it('should set hydrated flag', () => {
      const { result } = renderHook(() => useAuthStore());

      // El flag puede estar ya en true si el store se hidrato desde persist
      const initialHydrated = result.current.isHydrated;

      act(() => {
        result.current.setHydrated(true);
      });

      expect(result.current.isHydrated).toBe(true);

      // Test que se puede cambiar a false también
      act(() => {
        result.current.setHydrated(false);
      });

      expect(result.current.isHydrated).toBe(false);
    });
  });
});
