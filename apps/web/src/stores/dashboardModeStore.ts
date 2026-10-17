import { create } from 'zustand';

export type DashboardMode = 'normal' | 'personalized';

interface DashboardModeState {
  mode: DashboardMode;
  userId: string | null;
  loadForUser: (userId: string) => void;
  setMode: (userId: string, mode: DashboardMode) => void;
}

function storageKey(userId: string) {
  return `aether:dashboard-mode:${userId}`;
}

export const useDashboardModeStore = create<DashboardModeState>((set) => ({
  mode: 'normal',
  userId: null,
  loadForUser: (userId) => {
    if (useDashboardModeStore.getState().userId === userId) return;
    let mode: DashboardMode = 'normal';
    try {
      mode = window.localStorage.getItem(storageKey(userId)) === 'personalized' ? 'personalized' : 'normal';
    } catch { /* Keep the default for browsers with unavailable storage. */ }
    set({ userId, mode });
  },
  setMode: (userId, mode) => {
    try { window.localStorage.setItem(storageKey(userId), mode); } catch { /* Keep the selection for this session. */ }
    set({ userId, mode });
  },
}));
