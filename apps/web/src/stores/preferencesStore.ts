// apps/web/src/stores/preferencesStore.ts

import { create } from 'zustand';
import { apiService } from '@/services/apiService';

// ==================== TYPES ====================

interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  emailNotifications: boolean;
  pushNotifications: boolean;
  inAppNotifications: boolean;
  notificationFrequency: 'realtime' | 'daily' | 'weekly';
  compactMode: boolean;
  showArchived: boolean;
  defaultBoardView: 'kanban' | 'list' | 'calendar';
}

interface PreferencesState {
  // Estado
  preferences: UserPreferences | null;
  isLoading: boolean;
  error: string | null;

  // Acciones
  loadPreferences: () => Promise<void>;
  updatePreferences: (prefs: Partial<UserPreferences>) => Promise<void>;
  clearError: () => void;
}

// ==================== STORE ====================

export const usePreferencesStore = create<PreferencesState>()((set, get) => ({
  // Estado inicial
  preferences: null,
  isLoading: false,
  error: null,

  // ==================== LOAD PREFERENCES ====================
  loadPreferences: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await apiService.get<{ preferences: UserPreferences }>(
        '/api/users/me/preferences',
        true
      );

      if (!response.success || !response.data) {
        set({
          isLoading: false,
          error: response.error?.message || 'Error al cargar preferencias',
        });
        return;
      }

      set({
        preferences: response.data.preferences,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: 'Error inesperado al cargar preferencias',
      });
    }
  },

  // ==================== UPDATE PREFERENCES ====================
  updatePreferences: async (prefs: Partial<UserPreferences>) => {
    set({ isLoading: true, error: null });

    try {
      const response = await apiService.put<{ preferences: UserPreferences }>(
        '/api/users/me/preferences',
        prefs,
        true
      );

      if (!response.success || !response.data) {
        set({
          isLoading: false,
          error: response.error?.message || 'Error al actualizar preferencias',
        });
        return;
      }

      set({
        preferences: response.data.preferences,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: 'Error inesperado al actualizar preferencias',
      });
    }
  },

  // ==================== CLEAR ERROR ====================
  clearError: () => {
    set({ error: null });
  },
}));

// ==================== HOOKS AUXILIARES ====================

export const usePreferences = () => usePreferencesStore((state) => state.preferences);
