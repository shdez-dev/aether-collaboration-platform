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
  uiLanguage: null | 'es' | 'en'; // Language preference — null means fallback to user.language
  /** Email del usuario cuyo registro quedó pendiente de verificación */
  pendingEmailVerification: string | null;
  /** Email del usuario que intentó login pero aún no verificó su correo */
  emailNotVerified: string | null;

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
  setUiLanguage: (lang: 'es' | 'en' | null) => void;
  clearPendingVerification: () => void;

  // Helpers internos
  setAuth: (user: User, tokens: AuthTokens) => void;
  clearAuth: () => void;
}

// ==================== HELPERS ====================

/** Decodifica el claim exp de un JWT sin verificar la firma */
function getTokenExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    return typeof decoded.exp === 'number' ? decoded.exp : null;
  } catch {
    return null;
  }
}

/** Timer de refresh proactivo (módulo-level para sobrevivir re-renders) */
let proactiveRefreshTimer: ReturnType<typeof setTimeout> | null = null;

function clearProactiveRefresh(): void {
  if (proactiveRefreshTimer !== null) {
    clearTimeout(proactiveRefreshTimer);
    proactiveRefreshTimer = null;
  }
}

function scheduleProactiveRefresh(accessToken: string, refreshToken: string): void {
  clearProactiveRefresh();
  const exp = getTokenExpiry(accessToken);
  if (!exp) return;

  // Refrescar 5 minutos antes de que expire
  const msUntilRefresh = exp * 1000 - Date.now() - 5 * 60 * 1000;
  if (msUntilRefresh <= 0) return; // ya expiró o está a punto de expirar

  proactiveRefreshTimer = setTimeout(async () => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        const { accessToken: newToken, refreshToken: newRefresh, user } = data.data;
        useAuthStore.setState({ accessToken: newToken, refreshToken: newRefresh, user });
        // Actualizar localStorage manualmente ya que Zustand persist lo hará,
        // pero también hay que actualizar el socket
        const { socketService } = await import('../services/socketService');
        socketService.updateToken(newToken);
        scheduleProactiveRefresh(newToken, newRefresh);
      }
    } catch {
      // Si falla el refresh proactivo, el reactivo (401) se encargará
    }
  }, msUntilRefresh);
}

function setSessionCookie(): void {
  if (typeof document !== 'undefined') {
    document.cookie = 'aether_session=1; path=/; SameSite=Lax';
  }
}

function clearSessionCookie(): void {
  if (typeof document !== 'undefined') {
    document.cookie = 'aether_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
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
      uiLanguage: null,
      pendingEmailVerification: null,
      emailNotVerified: null,

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

          // Registro exitoso — el usuario debe verificar su correo antes de poder entrar
          set({ isLoading: false, pendingEmailVerification: email });
        } catch (error: any) {
          set({
            isLoading: false,
            error: error?.message || 'Error inesperado al registrar. Verifica tu conexión.',
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
            if (response.error?.code === 'EMAIL_NOT_VERIFIED') {
              set({ isLoading: false, emailNotVerified: email, error: null });
            } else {
              set({ isLoading: false, error: response.error?.message || 'Error al iniciar sesión' });
            }
            return;
          }

          const { user, accessToken, refreshToken } = response.data;

          // Cookie ANTES del set para que el middleware la vea cuando router.push se ejecute
          setSessionCookie();

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

          // Programar refresh proactivo antes de que expire el token
          scheduleProactiveRefresh(accessToken, refreshToken);
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
            // Error al notificar logout - no crítico
          }
        }

        // 3. Limpiar TODOS los stores de localStorage
        localStorage.removeItem('aether-auth-storage');
        localStorage.removeItem('aether-workspace-storage');
        localStorage.removeItem('aether-board-storage');
        localStorage.removeItem('aether-card-storage');
        localStorage.removeItem('aether-document-storage');

        // 4. Resetear estado en memoria de todos los stores (evitar data leak entre usuarios)
        try {
          const [{ useWorkspaceStore }, { useBoardStore }, { useCardStore }, { useDocumentStore }, { useNotificationStore }] =
            await Promise.all([
              import('./workspaceStore'),
              import('./boardStore'),
              import('./cardStore'),
              import('./documentStore'),
              import('./notificationStore'),
            ]);
          useWorkspaceStore.getState().reset();
          useBoardStore.getState().reset();
          useCardStore.getState().reset();
          useDocumentStore.getState().reset();
          useNotificationStore.getState().reset();
        } catch {}

        // 5. Limpiar timer proactivo y cookie de sesión
        clearProactiveRefresh();
        clearSessionCookie();

        // 6. Limpiar estado local
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
        setSessionCookie();
        scheduleProactiveRefresh(tokens.accessToken, tokens.refreshToken);
      },

      clearAuth: () => {
        clearProactiveRefresh();
        clearSessionCookie();
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          error: null,
        });
      },

      clearError: () => {
        set({ error: null, emailNotVerified: null });
      },

      clearPendingVerification: () => {
        set({ pendingEmailVerification: null });
      },

      setHydrated: (hydrated: boolean) => {
        set({ isHydrated: hydrated });
      },

      setUiLanguage: (lang: 'es' | 'en' | null) => {
        set({ uiLanguage: lang });
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
          const response = await apiService.uploadForm<{ user: any; avatarUrl: string }>(
            '/api/users/me/avatar',
            formData,
            accessToken ?? undefined
          );

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
        uiLanguage: state.uiLanguage,
      }),
      onRehydrateStorage: () => (state) => {
        // Cuando termina de hidratar, marcar como hidratado
        state?.setHydrated(true);
        // Reanudar el refresh proactivo si había sesión activa
        if (state?.accessToken && state?.refreshToken) {
          setSessionCookie();
          scheduleProactiveRefresh(state.accessToken, state.refreshToken);
        }
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
