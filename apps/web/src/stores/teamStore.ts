// apps/web/src/stores/teamStore.ts

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiService } from '@/services/apiService';

// ==================== TYPES ====================

export interface TeamMemberWorkload {
  totalCards: number;
  overdueCards: number;
  completedThisWeek: number;
  lastActivity: string | null;
}

export interface TeamMember {
  id: string;        // user_id — usado en llamadas API de remove/role
  memberId: string;
  name: string;
  email: string;
  avatar?: string | null;
  role: 'LEAD' | 'MEMBER';
  joinedAt: string;
  workload: TeamMemberWorkload;
}

export interface Team {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  leadId?: string | null;
  leadName?: string | null;
  leadAvatar?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
  members?: TeamMember[];
}

export interface TeamActivity {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string | null;
  action: string;
  entityName?: string | null;
  createdAt: string;
}

export interface TeamInvitation {
  id: string;
  role: string;
  createdAt: string;
  team: {
    id: string;
    name: string;
    color?: string | null;
    icon?: string | null;
  };
  inviterName: string;
  inviterAvatar?: string | null;
}

interface CreateTeamData {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

interface UpdateTeamData {
  name?: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  leadId?: string | null;
}

interface TeamState {
  teams: Team[];
  currentTeam: Team | null;
  pendingTeamInvitations: TeamInvitation[];
  isLoading: boolean;
  error: string | null;

  fetchTeams: () => Promise<void>;
  fetchTeamById: (id: string) => Promise<void>;
  createTeam: (data: CreateTeamData) => Promise<Team>;
  updateTeam: (id: string, data: UpdateTeamData) => Promise<void>;
  deleteTeam: (id: string) => Promise<void>;

  addMember: (teamId: string, email: string) => Promise<void>;
  removeMember: (teamId: string, userId: string) => Promise<void>;
  changeMemberRole: (teamId: string, userId: string, role: 'LEAD' | 'MEMBER') => Promise<void>;

  loadPendingTeamInvitations: () => Promise<void>;
  acceptTeamInvitation: (invitationId: string) => Promise<void>;
  rejectTeamInvitation: (invitationId: string) => Promise<void>;

  clearError: () => void;
  reset: () => void;
}

// ==================== STORE ====================

export const useTeamStore = create<TeamState>()(
  persist(
    (set, get) => ({
      teams: [],
      pendingTeamInvitations: [],
      currentTeam: null,
      isLoading: false,
      error: null,

      // ── Fetch all ───────────────────────────────────────────────────────────

      fetchTeams: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiService.get<{ teams: Team[] }>('/api/teams', true);
          if (!response.success || !response.data) {
            set({ error: response.error?.message || 'Error al obtener equipos', isLoading: false });
            return;
          }
          set({ teams: response.data.teams, isLoading: false });
        } catch (error: any) {
          set({ error: error.message || 'Error desconocido', isLoading: false });
        }
      },

      // ── Fetch by id ─────────────────────────────────────────────────────────

      fetchTeamById: async (id: string) => {
        set({ isLoading: true, error: null, currentTeam: null });
        try {
          const response = await apiService.get<{ team: Team }>(`/api/teams/${id}`, true);
          if (!response.success || !response.data) {
            set({ error: response.error?.message || 'Equipo no encontrado', isLoading: false });
            return;
          }
          set({ currentTeam: response.data.team, isLoading: false });
        } catch (error: any) {
          set({ error: error.message || 'Error desconocido', isLoading: false });
        }
      },

      // ── Create ──────────────────────────────────────────────────────────────

      createTeam: async (data: CreateTeamData) => {
        const response = await apiService.post<{ team: Team }>('/api/teams', data, true);
        if (!response.success || !response.data) {
          throw new Error(response.error?.message || 'Error al crear equipo');
        }
        const team = response.data.team;
        set((state) => ({ teams: [team, ...state.teams] }));
        return team;
      },

      // ── Update ──────────────────────────────────────────────────────────────

      updateTeam: async (id: string, data: UpdateTeamData) => {
        const response = await apiService.put<{ team: Team }>(`/api/teams/${id}`, data, true);
        if (!response.success || !response.data) {
          throw new Error(response.error?.message || 'Error al actualizar equipo');
        }
        const updated = response.data.team;
        set((state) => ({
          teams: state.teams.map((t) => (t.id === id ? updated : t)),
          currentTeam: state.currentTeam?.id === id ? updated : state.currentTeam,
        }));
      },

      // ── Delete ──────────────────────────────────────────────────────────────

      deleteTeam: async (id: string) => {
        const response = await apiService.delete(`/api/teams/${id}`, true);
        if (!response.success) {
          throw new Error(response.error?.message || 'Error al eliminar equipo');
        }
        set((state) => ({
          teams: state.teams.filter((t) => t.id !== id),
          currentTeam: state.currentTeam?.id === id ? null : state.currentTeam,
        }));
      },

      // ── Members ─────────────────────────────────────────────────────────────

      addMember: async (teamId: string, email: string) => {
        const response = await apiService.post<{ member: TeamMember }>(
          `/api/teams/${teamId}/members`,
          { email },
          true
        );
        if (!response.success || !response.data) {
          throw new Error(response.error?.message || 'Error al añadir miembro');
        }
        // Refresh the current team if it matches
        const { currentTeam } = get();
        if (currentTeam?.id === teamId) {
          await get().fetchTeamById(teamId);
        }
      },

      removeMember: async (teamId: string, userId: string) => {
        const response = await apiService.delete(`/api/teams/${teamId}/members/${userId}`, true);
        if (!response.success) {
          throw new Error(response.error?.message || 'Error al remover miembro');
        }
        set((state) => ({
          currentTeam:
            state.currentTeam?.id === teamId
              ? {
                  ...state.currentTeam,
                  members: (state.currentTeam.members ?? []).filter((m) => m.id !== userId),
                  memberCount: (state.currentTeam.memberCount ?? 1) - 1,
                }
              : state.currentTeam,
        }));
      },

      changeMemberRole: async (teamId: string, userId: string, role: 'LEAD' | 'MEMBER') => {
        const response = await apiService.put<{ member: TeamMember }>(
          `/api/teams/${teamId}/members/${userId}`,
          { role },
          true
        );
        if (!response.success || !response.data) {
          throw new Error(response.error?.message || 'Error al cambiar rol');
        }
        set((state) => ({
          currentTeam:
            state.currentTeam?.id === teamId
              ? {
                  ...state.currentTeam,
                  members: (state.currentTeam.members ?? []).map((m) =>
                    m.id === userId ? { ...m, role } : m
                  ),
                }
              : state.currentTeam,
        }));
      },

      // ── Helpers ─────────────────────────────────────────────────────────────

      loadPendingTeamInvitations: async () => {
        const response = await apiService.get<{ invitations: TeamInvitation[] }>(
          '/api/teams/invitations',
          true
        );
        if (response.success && response.data) {
          set({ pendingTeamInvitations: response.data.invitations });
        }
      },

      acceptTeamInvitation: async (invitationId: string) => {
        const response = await apiService.post(
          `/api/teams/invitations/${invitationId}/accept`,
          {},
          true
        );
        if (!response.success) {
          throw new Error(response.error?.message || 'Error al aceptar invitación');
        }
        set((state) => ({
          pendingTeamInvitations: state.pendingTeamInvitations.filter((i) => i.id !== invitationId),
        }));
      },

      rejectTeamInvitation: async (invitationId: string) => {
        const response = await apiService.post(
          `/api/teams/invitations/${invitationId}/reject`,
          {},
          true
        );
        if (!response.success) {
          throw new Error(response.error?.message || 'Error al rechazar invitación');
        }
        set((state) => ({
          pendingTeamInvitations: state.pendingTeamInvitations.filter((i) => i.id !== invitationId),
        }));
      },

      clearError: () => set({ error: null }),

      reset: () => set({ teams: [], currentTeam: null, pendingTeamInvitations: [], isLoading: false, error: null }),
    }),
    {
      name: 'aether-team-store',
      storage: createJSONStorage(() => localStorage),
      partialize: () => ({}),
    }
  )
);
