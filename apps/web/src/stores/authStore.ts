// apps/web/src/stores/authStore.ts

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StateCreator } from 'zustand';
import { socketService } from '@/services/socketService';

// ==================== TYPES ====================

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt: string;
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
  clearError: () => void;
  setHydrated: (hydrated: boolean) => void; // Nueva acción

  // Helpers internos
  setAuth: (user: User, tokens: AuthTokens) => void;
  clearAuth: () => void;
}

// ==================== API CONFIG ====================

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ==================== API HELPERS ====================

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || {
          code: 'UNKNOWN_ERROR',
          message: 'Ocurrió un error desconocido',
        },
      };
    }

    return data;
  } catch (error) {
    console.error('API Request Error:', error);
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Error de conexión. Verifica que el servidor esté corriendo.',
      },
    };
  }
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
          const response = await apiRequest<{ user: User }>('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password }),
          });

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
          const response = await apiRequest<{
            user: User;
            accessToken: string;
            refreshToken: string;
          }>('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
          });

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

          console.log('✓ Login exitoso:', user.email);

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

        console.log('[AuthStore] Cerrando sesión...');

        // 1. DESCONECTAR SOCKET PRIMERO
        if (socketService) {
          console.log('[AuthStore] Desconectando socket...');
          socketService.disconnect();
        }

        // 2. Notificar al servidor (opcional, no bloqueante)
        if (accessToken) {
          try {
            await apiRequest('/api/auth/logout', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            });
          } catch (error) {
            console.warn('[AuthStore] Error al notificar logout al servidor:', error);
          }
        }

        // 3. Limpiar estado local
        get().clearAuth();

        console.log('✓ Sesión cerrada exitosamente');
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
          const response = await apiRequest<{ user: User }>('/api/auth/me', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });

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
