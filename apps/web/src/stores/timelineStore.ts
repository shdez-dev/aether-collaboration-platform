// apps/web/src/stores/timelineStore.ts
// Lightweight signal store — any component can call invalidate() to tell the
// timeline to silently re-fetch its sprints/dependencies without a full reload.
import { create } from 'zustand';

interface TimelineState {
  version: number;
  invalidate: () => void;
}

export const useTimelineStore = create<TimelineState>((set) => ({
  version: 0,
  invalidate: () => set((s) => ({ version: s.version + 1 })),
}));
