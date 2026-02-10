// apps/web/src/stores/authStore.ts

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StateCreator } from 'zustand';
import { socketService } from '@/services/socketService';
import { apiService } from '@/services/apiService';

// ==================== TYPES ====================

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  bio?: string;
  position?: string;
  timezone?: string;
  language?: string;
  phone?: string;
  location?: string;
  createdAt: string;
  updatedAt?: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthState {
  // Estado
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isHydrated: boolean; // Nuevo flag para saber si ya se hidrató desde localStorage

  // Acciones
  register: (name: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  getCurrentUser: () => Promise<void>;
  updateProfile: (
    data: Partial<Omit<User, 'id' | 'email' | 'createdAt' | 'updatedAt'>>
  ) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  clearError: () => void;
  setHydrated: (hydrated: boolean) => void;

  // Helpers internos
  setAuth: (user: User, tokens: AuthTokens) => void;
  clearAuth: () => void;
}

// ==================== STORE ====================

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Estado inicial
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      isHydrated: false,

      // ==================== REGISTER ====================
      register: async (name: string, email: string, password: string) => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiService.post<{ user: User }>(
            '/api/auth/register',
            { name, email, password },
            false
          );

          if (!response.success || !response.data) {
            set({
              isLoading: false,
              error: response.error?.message || 'Error al registrar usuario',
            });
            return;
          }

          // Auto-login después de registro exitoso
          await get().login(email, password);
        } catch (error) {
          set({
            isLoading: false,
            error: 'Error inesperado al registrar',
          });
        }
      },

      // ==================== LOGIN ====================
      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiService.post<{
            user: User;
            accessToken: string;
            refreshToken: string;
          }>('/api/auth/login', { email, password }, false);

          if (!response.success || !response.data) {
            set({
              isLoading: false,
              error: response.error?.message || 'Error al iniciar sesión',
            });
            return;
          }

          const { user, accessToken, refreshToken } = response.data;

          set({
            user,
            accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          // Inicializar socket después de login exitoso
          if (socketService && accessToken) {
            socketService.connect(accessToken);
          }
        } catch (error) {
          set({
            isLoading: false,
            error: 'Error inesperado al iniciar sesión',
          });
        }
      },

      // ==================== LOGOUT ====================
      logout: async () => {
        const { accessToken } = get();

        // 1. DESCONECTAR SOCKET PRIMERO
        if (socketService) {
          socketService.disconnect();
        }

        // 2. Notificar al servidor (opcional, no bloqueante)
        if (accessToken) {
          try {
            await apiService.post('/api/auth/logout', {}, true);
          } catch (error) {
            console.warn('[AuthStore] Error al notificar logout al servidor:', error);
          }
        }

        // 3. Limpiar TODOS los stores de localStorage
        localStorage.removeItem('aether-auth-storage');
        localStorage.removeItem('aether-workspace-storage');
        localStorage.removeItem('aether-board-storage');
        localStorage.removeItem('aether-card-storage');
        localStorage.removeItem('aether-document-storage');

        // 4. Limpiar estado local
        get().clearAuth();
      },

      // ==================== GET CURRENT USER ====================
      getCurrentUser: async () => {
        const { accessToken } = get();

        if (!accessToken) {
          get().clearAuth();
          return;
        }

        set({ isLoading: true });

        try {
          const response = await apiService.get<{ user: User }>('/api/auth/me', true);

          if (!response.success || !response.data) {
            // Token inválido o expirado
            get().clearAuth();

            // Desconectar socket si el token es inválido
            if (socketService) {
              socketService.disconnect();
            }
            return;
          }

          set({
            user: response.data.user,
            isAuthenticated: true,
            isLoading: false,
          });

          // Reconectar socket si es necesario
          if (socketService && accessToken && !socketService.isConnected()) {
            socketService.connect(accessToken);
          }
        } catch (error) {
          get().clearAuth();

          // Desconectar socket en caso de error
          if (socketService) {
            socketService.disconnect();
          }
        }
      },

      // ==================== HELPERS ====================
      setAuth: (user: User, tokens: AuthTokens) => {
        set({
          user,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          isAuthenticated: true,
          error: null,
        });
      },

      clearAuth: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          error: null,
        });
      },

      clearError: () => {
        set({ error: null });
      },

      setHydrated: (hydrated: boolean) => {
        set({ isHydrated: hydrated });
      },

      // ==================== UPDATE PROFILE ====================
      updateProfile: async (
        data: Partial<Omit<User, 'id' | 'email' | 'createdAt' | 'updatedAt'>>
      ) => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiService.put<{ user: User }>('/api/users/me', data, true);

          if (!response.success || !response.data) {
            set({
              isLoading: false,
              error: response.error?.message || 'Error al actualizar perfil',
            });
            return;
          }

          set({
            user: response.data.user,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          set({
            isLoading: false,
            error: 'Error inesperado al actualizar perfil',
          });
        }
      },

      // ==================== UPLOAD AVATAR ====================
      uploadAvatar: async (file: File) => {
        set({ isLoading: true, error: null });

        try {
          const formData = new FormData();
          formData.append('avatar', file);

          const { accessToken } = get();
          if (!accessToken) {
            set({
              isLoading: false,
              error: 'No estás autenticado',
            });
            return;
          }

          const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000';
          const res = await fetch(`${API_URL}/api/users/me/avatar`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            body: formData,
          });

          const response = await res.json();

          if (!response.success || !response.data) {
            set({
              isLoading: false,
              error: response.error?.message || 'Error al subir avatar',
            });
            return;
          }

          set({
            user: response.data.user,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          set({
            isLoading: false,
            error: 'Error inesperado al subir avatar',
          });
        }
      },

      // ==================== CHANGE PASSWORD ====================
      changePassword: async (currentPassword: string, newPassword: string) => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiService.put<{ message: string }>(
            '/api/users/me/password',
            { currentPassword, newPassword },
            true
          );

          if (!response.success) {
            set({
              isLoading: false,
              error: response.error?.message || 'Error al cambiar contraseña',
            });
            return;
          }

          set({
            isLoading: false,
            error: null,
          });
        } catch (error) {
          set({
            isLoading: false,
            error: 'Error inesperado al cambiar contraseña',
          });
        }
      },
    }),
    {
      name: 'aether-auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        // Cuando termina de hidratar, marcar como hidratado
        state?.setHydrated(true);
      },
    }
  )
);

// ==================== HOOKS AUXILIARES ====================

// Hook para obtener solo el usuario
export const useUser = () => useAuthStore((state) => state.user);

// Hook para obtener estado de autenticación
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);

// Hook para obtener acciones de auth
export const useAuthActions = () =>
  useAuthStore((state) => ({
    login: state.login,
    logout: state.logout,
    register: state.register,
    getCurrentUser: state.getCurrentUser,
  }));
