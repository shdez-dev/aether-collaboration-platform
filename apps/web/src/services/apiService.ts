// apps/web/src/services/apiService.ts

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    avatar?: string;
  };
}

// Variable para controlar si ya se está renovando el token
let isRefreshing = false;
// Cola de peticiones que esperan a que se renueve el token
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: any) => void;
}> = [];

// Procesa la cola de peticiones pendientes
const processQueue = (error: any = null, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });

  failedQueue = [];
};

/**
 * Intenta renovar el access token usando el refresh token
 */
async function refreshAccessToken(refreshToken: string): Promise<RefreshResponse | null> {
  try {
    const response = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    const data: ApiResponse<RefreshResponse> = await response.json();

    if (!response.ok || !data.success || !data.data) {
      return null;
    }

    return data.data;
  } catch (error) {
    console.error('[API] Error refreshing token:', error);
    return null;
  }
}

/**
 * Servicio de API con manejo automático de refresh de tokens
 */
export const apiService = {
  /**
   * Realiza una petición HTTP con manejo automático de tokens expirados
   */
  async request<T>(
    endpoint: string,
    options: RequestInit = {},
    useAuth: boolean = false
  ): Promise<ApiResponse<T>> {
    // Obtener tokens desde el store (lo hacemos dinámicamente para evitar problemas de hidratación)
    const getAuthStore = () => {
      if (typeof window === 'undefined') return null;
      const stored = localStorage.getItem('aether-auth-storage');
      if (!stored) return null;
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    };

    const authData = getAuthStore();
    const accessToken = authData?.state?.accessToken;

    // Agregar headers de autenticación si es necesario
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (useAuth && accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
      });

      // Si el token expiró (401) y tenemos refresh token, intentar renovarlo
      if (response.status === 401 && useAuth && authData?.state?.refreshToken) {
        // Si ya se está renovando, esperar a que termine
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          }).then(() => {
            // Reintentar la petición original con el nuevo token
            return this.request<T>(endpoint, options, useAuth);
          });
        }

        isRefreshing = true;

        try {
          const refreshData = await refreshAccessToken(authData.state.refreshToken);

          if (!refreshData) {
            // Refresh token inválido, limpiar autenticación
            processQueue(new Error('Session expired'), null);
            isRefreshing = false;

            // Limpiar localStorage y redirigir a login
            if (typeof window !== 'undefined') {
              localStorage.removeItem('aether-auth-storage');
              window.location.href = '/login';
            }

            return {
              success: false,
              error: {
                code: 'SESSION_EXPIRED',
                message: 'Tu sesión ha expirado. Por favor inicia sesión nuevamente.',
              },
            };
          }

          // Actualizar tokens en localStorage
          const updatedAuth = {
            state: {
              ...authData.state,
              accessToken: refreshData.accessToken,
              refreshToken: refreshData.refreshToken,
              user: refreshData.user,
            },
            version: authData.version || 0,
          };

          if (typeof window !== 'undefined') {
            localStorage.setItem('aether-auth-storage', JSON.stringify(updatedAuth));
          }

          // Actualizar también el store de Zustand en memoria para evitar tokens stale
          try {
            const { useAuthStore } = await import('../stores/authStore');
            useAuthStore.setState({
              accessToken: refreshData.accessToken,
              refreshToken: refreshData.refreshToken,
              user: refreshData.user as any,
            });
          } catch {
            // Si falla la importación dinámica, al menos localStorage está actualizado
          }

          // Notificar a las peticiones en cola que ya pueden continuar
          processQueue(null, refreshData.accessToken);
          isRefreshing = false;

          // Reintentar la petición original con el nuevo token
          return this.request<T>(endpoint, options, useAuth);
        } catch (error) {
          processQueue(error, null);
          isRefreshing = false;
          throw error;
        }
      }

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
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Error de conexión. Verifica que el servidor esté corriendo.',
        },
      };
    }
  },

  /**
   * Petición GET
   */
  async get<T>(endpoint: string, useAuth: boolean = false): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' }, useAuth);
  },

  /**
   * Petición POST
   */
  async post<T>(endpoint: string, body: any, useAuth: boolean = false): Promise<ApiResponse<T>> {
    return this.request<T>(
      endpoint,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
      useAuth
    );
  },

  /**
   * Petición PUT
   */
  async put<T>(endpoint: string, body: any, useAuth: boolean = false): Promise<ApiResponse<T>> {
    return this.request<T>(
      endpoint,
      {
        method: 'PUT',
        body: JSON.stringify(body),
      },
      useAuth
    );
  },

  /**
   * Petición DELETE
   */
  async delete<T>(endpoint: string, useAuth: boolean = false): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' }, useAuth);
  },

  /**
   * Petición PATCH
   */
  async patch<T>(endpoint: string, body: any, useAuth: boolean = false): Promise<ApiResponse<T>> {
    return this.request<T>(
      endpoint,
      {
        method: 'PATCH',
        body: JSON.stringify(body),
      },
      useAuth
    );
  },
};
