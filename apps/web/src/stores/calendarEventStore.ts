// apps/web/src/stores/calendarEventStore.ts

import { create } from 'zustand';
import { apiService } from '@/services/apiService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CalendarAttendee {
  id:     string;
  name:   string;
  avatar: string | null;
}

export interface CalendarEvent {
  id:          string;
  title:       string;
  description: string | null;
  startTime:   string;
  endTime:     string;
  allDay:      boolean;
  color:       string;
  type:        'personal' | 'workspace' | 'team';
  workspaceId: string | null;
  teamId:      string | null;
  createdBy:   string;
  createdAt:   string;
  updatedAt:   string;
  attendees:   CalendarAttendee[];
}

export interface CreateEventInput {
  title:        string;
  description?: string;
  startTime:    string;
  endTime:      string;
  allDay?:      boolean;
  color?:       string;
  type:         'personal' | 'workspace' | 'team';
  workspaceId?: string;
  teamId?:      string;
}

export interface UpdateEventInput {
  title?:       string;
  description?: string | null;
  startTime?:   string;
  endTime?:     string;
  allDay?:      boolean;
  color?:       string;
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface CalendarEventState {
  events:  CalendarEvent[];
  loading: boolean;
  error:   string | null;

  fetchEvents:  (from?: string, to?: string) => Promise<void>;
  createEvent:  (input: CreateEventInput) => Promise<CalendarEvent | null>;
  updateEvent:  (id: string, input: UpdateEventInput) => Promise<CalendarEvent | null>;
  deleteEvent:  (id: string) => Promise<boolean>;
}

export const useCalendarEventStore = create<CalendarEventState>((set, get) => ({
  events:  [],
  loading: false,
  error:   null,

  fetchEvents: async (from, to) => {
    set({ loading: true, error: null });
    try {
      let endpoint = '/api/events/me';
      const params: string[] = [];
      if (from) params.push(`from=${encodeURIComponent(from)}`);
      if (to)   params.push(`to=${encodeURIComponent(to)}`);
      if (params.length) endpoint += `?${params.join('&')}`;

      const res = await apiService.get<{ events: CalendarEvent[] }>(endpoint, true);
      if (res.success && res.data) {
        set({ events: res.data.events, loading: false });
      } else {
        set({ loading: false, error: res.error?.message ?? 'Error al cargar eventos' });
      }
    } catch (e: any) {
      set({ loading: false, error: e.message });
    }
  },

  createEvent: async (input) => {
    try {
      const res = await apiService.post<{ event: CalendarEvent }>('/api/events', input, true);
      if (res.success && res.data) {
        set(state => ({ events: [...state.events, res.data!.event] }));
        return res.data.event;
      }
      return null;
    } catch {
      return null;
    }
  },

  updateEvent: async (id, input) => {
    try {
      const res = await apiService.patch<{ event: CalendarEvent }>(`/api/events/${id}`, input, true);
      if (res.success && res.data) {
        const updated = res.data.event;
        set(state => ({
          events: state.events.map(e => e.id === id ? updated : e),
        }));
        return updated;
      }
      return null;
    } catch {
      return null;
    }
  },

  deleteEvent: async (id) => {
    try {
      const res = await apiService.delete(`/api/events/${id}`, true);
      if (res.success) {
        set(state => ({ events: state.events.filter(e => e.id !== id) }));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },
}));
