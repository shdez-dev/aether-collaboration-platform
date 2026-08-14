import { create } from 'zustand';
import { apiService } from '@/services/apiService';

export type PortfolioRole = 'ADMIN' | 'MANAGER' | 'VIEWER';
export type PortfolioRisk = 'LOW' | 'MEDIUM' | 'HIGH';

export interface PortfolioOrganization {
  id: string;
  name: string;
  type: string;
  role: 'OWNER' | 'ADMIN' | 'BILLING_ADMIN' | 'MEMBER';
}

export interface Portfolio {
  id: string;
  organizationId: string;
  name: string;
  description?: string | null;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  projectCount?: number;
  memberCount?: number;
  role?: PortfolioRole;
}

export interface PortfolioProject {
  projectId: string;
  canOpenProject: boolean;
  name: string;
  workspace: { id: string; name: string };
  status?: string | null;
  maturity?: string | null;
  health: 'HEALTHY' | 'ATTENTION' | 'AT_RISK';
  risk: PortfolioRisk;
  progress: { totalCards: number; completedCards: number; percent: number | null };
  nextStep?: string | null;
  nextReviewAt?: string | null;
  nextMilestoneAt?: string | null;
  owner?: { id: string; name: string; email?: string | null } | null;
  teams?: Array<{ id: string; name: string }>;
  topPriority?: string | null;
  indicators?: { overdueCards: number; blockedCards: number; lastActivityAt?: string | null };
}

export interface PortfolioAlert {
  id: string;
  projectId: string;
  canOpenProject: boolean;
  type: string;
  severity: 'WARNING' | 'CRITICAL';
  status: string;
  title: string;
  detail: string;
  updatedAt: string;
}

export interface PortfolioOrganizationMember {
  userId: string;
  name: string;
  email: string;
  avatar?: string | null;
  role: 'OWNER' | 'ADMIN' | 'BILLING_ADMIN' | 'MEMBER';
}

export interface PortfolioCapacity {
  people: Array<{ userId: string; name: string; email?: string; portfolioAllocatedMinutes: number; allocatedMinutes: number; availableMinutes: number; loadPercent: number | null; overallocated: boolean }>;
  teams: Array<{ teamId: string; name: string; memberCount: number; projectCount: number; allocatedMinutes: number; availableMinutes: number; loadPercent: number | null; overallocated: boolean }>;
  // The read model deliberately omits raw allocation records. Capacity edits
  // are made through scoped commands, never by trusting a client-side id.
  allocations: Array<{ projectId: string; projectName: string; canOpenProject: boolean; userId: string; userName: string; weeklyMinutes: number }>;
}

export interface PortfolioDetail {
  portfolio: Portfolio;
  members: Array<{ userId: string; role: PortfolioRole; user?: { name: string; email: string; avatar?: string | null } }>;
  projectLinks: Array<{ projectId: string; addedAt: string }>;
  permissions: {
    level: 'VIEW' | 'MANAGE' | 'ADMIN';
    canManage: boolean;
    canAdminister: boolean;
    canManageOrganizationCapacity: boolean;
  };
}

export interface PortfolioProjectCandidate {
  id: string;
  name: string;
  status?: string | null;
  maturity?: string | null;
  workspace: { id: string; name: string };
  ownerId?: string | null;
}

export interface PortfolioFilters {
  workspaceId?: string;
  teamId?: string;
  status?: string;
  maturity?: string;
  priority?: string;
  risk?: PortfolioRisk;
  ownerId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

type PortfolioState = {
  organizations: PortfolioOrganization[];
  portfolios: Portfolio[];
  detail: PortfolioDetail | null;
  projects: PortfolioProject[];
  alerts: PortfolioAlert[];
  capacity: PortfolioCapacity | null;
  candidates: PortfolioProjectCandidate[];
  candidatesLoading: boolean;
  loading: boolean;
  detailLoading: boolean;
  error: string | null;
  actionError: string | null;
  fetchOrganizations: () => Promise<PortfolioOrganization[]>;
  fetchPortfolios: (organizationId: string) => Promise<void>;
  createPortfolio: (input: { organizationId: string; name: string; description?: string }) => Promise<Portfolio | null>;
  fetchDetail: (portfolioId: string) => Promise<PortfolioDetail | null>;
  fetchOverview: (portfolioId: string, filters?: PortfolioFilters) => Promise<void>;
  fetchAlerts: (portfolioId: string) => Promise<void>;
  fetchCapacity: (portfolioId: string) => Promise<void>;
  fetchCandidates: (portfolioId: string, input?: { query?: string; workspaceId?: string }) => Promise<void>;
  addProject: (portfolioId: string, projectId: string) => Promise<boolean>;
  removeProject: (portfolioId: string, projectId: string) => Promise<boolean>;
  fetchOrganizationMembers: (organizationId: string) => Promise<PortfolioOrganizationMember[]>;
  saveMember: (portfolioId: string, input: { userId: string; role: PortfolioRole }) => Promise<boolean>;
  removeMember: (portfolioId: string, userId: string) => Promise<boolean>;
  updateAlert: (portfolioId: string, alertId: string, status: 'ACKNOWLEDGED' | 'RESOLVED') => Promise<boolean>;
  addAvailability: (portfolioId: string, input: { userId: string; weeklyAvailableMinutes: number; effectiveFrom: string; effectiveUntil?: string | null }) => Promise<boolean>;
  addAllocation: (portfolioId: string, input: { projectId: string; userId: string; weeklyMinutes: number; effectiveFrom: string; effectiveUntil?: string | null }) => Promise<boolean>;
  exportCsv: (portfolioId: string, filters?: PortfolioFilters) => Promise<boolean>;
  clearActionError: () => void;
  clear: () => void;
};

function queryString(filters: PortfolioFilters = {}) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== '') query.set(key, String(value)); });
  const value = query.toString();
  return value ? `?${value}` : '';
}

export const usePortfolioStore = create<PortfolioState>((set) => ({
  organizations: [], portfolios: [], detail: null, projects: [], alerts: [], capacity: null, candidates: [], candidatesLoading: false,
  loading: false, detailLoading: false, error: null, actionError: null,
  fetchOrganizations: async () => {
    const response = await apiService.get<{ organizations: PortfolioOrganization[] }>('/api/organizations', true);
    const organizations = response.success && response.data ? response.data.organizations : [];
    set({ organizations, error: response.success ? null : (response.error?.message ?? 'No se pudieron cargar las organizaciones') });
    return organizations;
  },
  fetchPortfolios: async (organizationId) => {
    set({ loading: true, error: null, portfolios: [] });
    const response = await apiService.get<{ portfolios: Portfolio[] }>(`/api/portfolios?organizationId=${encodeURIComponent(organizationId)}`, true);
    set(response.success && response.data
      ? { portfolios: response.data.portfolios, loading: false }
      : { loading: false, error: response.error?.message ?? 'No se pudieron cargar las carteras' });
  },
  createPortfolio: async (input) => {
    const response = await apiService.post<{ portfolio: Portfolio }>('/api/portfolios', input, true);
    if (!response.success || !response.data) { set({ error: response.error?.message ?? 'No se pudo crear la cartera' }); return null; }
    set((state) => ({ portfolios: [response.data!.portfolio, ...state.portfolios] }));
    return response.data.portfolio;
  },
  fetchDetail: async (portfolioId) => {
    set({ detailLoading: true, error: null, detail: null });
    const response = await apiService.get<PortfolioDetail>(`/api/portfolios/${portfolioId}`, true);
    if (!response.success || !response.data) { set({ detailLoading: false, error: response.error?.message ?? 'No se pudo cargar la cartera' }); return null; }
    set({ detail: response.data, detailLoading: false });
    return response.data;
  },
  fetchOverview: async (portfolioId, filters) => {
    set({ loading: true, error: null, projects: [] });
    const response = await apiService.get<{ projects: PortfolioProject[] }>(`/api/portfolios/${portfolioId}/overview${queryString(filters)}`, true);
    set(response.success && response.data
      ? { projects: response.data.projects ?? [], loading: false }
      : { loading: false, error: response.error?.message ?? 'No se pudo cargar el resumen de proyectos' });
  },
  fetchAlerts: async (portfolioId) => {
    const response = await apiService.get<{ alerts: PortfolioAlert[] }>(`/api/portfolios/${portfolioId}/alerts`, true);
    set(response.success && response.data
      ? { alerts: response.data.alerts ?? [] }
      : { error: response.error?.message ?? 'No se pudieron cargar las alertas' });
  },
  fetchCapacity: async (portfolioId) => {
    const response = await apiService.get<PortfolioCapacity>(`/api/portfolios/${portfolioId}/capacity`, true);
    set(response.success && response.data
      ? { capacity: response.data }
      : { error: response.error?.message ?? 'No se pudo cargar la capacidad' });
  },
  fetchCandidates: async (portfolioId, input = {}) => {
    set({ candidatesLoading: true, actionError: null });
    const query = new URLSearchParams();
    if (input.query) query.set('query', input.query);
    if (input.workspaceId) query.set('workspaceId', input.workspaceId);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    const response = await apiService.get<{ projects: PortfolioProjectCandidate[] }>(`/api/portfolios/${portfolioId}/projects/candidates${suffix}`, true);
    set(response.success && response.data
      ? { candidates: response.data.projects ?? [], candidatesLoading: false }
      : { candidates: [], candidatesLoading: false, actionError: response.error?.message ?? 'No se pudieron cargar proyectos candidatos' });
  },
  addProject: async (portfolioId, projectId) => {
    set({ actionError: null });
    const response = await apiService.post(`/api/portfolios/${portfolioId}/projects`, { projectId }, true);
    if (!response.success) { set({ actionError: response.error?.message ?? 'No se pudo asociar el proyecto' }); return false; }
    return true;
  },
  removeProject: async (portfolioId, projectId) => {
    set({ actionError: null });
    const response = await apiService.delete(`/api/portfolios/${portfolioId}/projects/${projectId}`, true);
    if (!response.success) { set({ actionError: response.error?.message ?? 'No se pudo remover el proyecto' }); return false; }
    return true;
  },
  fetchOrganizationMembers: async (organizationId) => {
    const response = await apiService.get<{ members: PortfolioOrganizationMember[] }>(`/api/organizations/${organizationId}/members`, true);
    if (!response.success || !response.data) {
      set({ actionError: response.error?.message ?? 'No se pudieron cargar los miembros de la organización' });
      return [];
    }
    return response.data.members ?? [];
  },
  saveMember: async (portfolioId, input) => {
    set({ actionError: null });
    const response = await apiService.post(`/api/portfolios/${portfolioId}/members`, input, true);
    if (!response.success) { set({ actionError: response.error?.message ?? 'No se pudo guardar el rol de cartera' }); return false; }
    return true;
  },
  removeMember: async (portfolioId, userId) => {
    set({ actionError: null });
    const response = await apiService.delete(`/api/portfolios/${portfolioId}/members/${userId}`, true);
    if (!response.success) { set({ actionError: response.error?.message ?? 'No se pudo quitar el miembro de la cartera' }); return false; }
    return true;
  },
  updateAlert: async (portfolioId, alertId, status) => {
    set({ actionError: null });
    const response = await apiService.patch(`/api/portfolios/${portfolioId}/alerts/${alertId}`, { status }, true);
    if (!response.success) { set({ actionError: response.error?.message ?? 'No se pudo actualizar la alerta' }); return false; }
    return true;
  },
  addAvailability: async (portfolioId, input) => {
    set({ actionError: null });
    const response = await apiService.post(`/api/portfolios/${portfolioId}/capacity/availability`, input, true);
    if (!response.success) { set({ actionError: response.error?.message ?? 'No se pudo registrar la disponibilidad' }); return false; }
    return true;
  },
  addAllocation: async (portfolioId, input) => {
    set({ actionError: null });
    const response = await apiService.post(`/api/portfolios/${portfolioId}/capacity/allocations`, input, true);
    if (!response.success) { set({ actionError: response.error?.message ?? 'No se pudo registrar la asignación' }); return false; }
    return true;
  },
  exportCsv: async (portfolioId, filters = {}) => {
    set({ actionError: null });
    const stored = typeof window === 'undefined' ? null : window.localStorage.getItem('aether-auth-storage');
    let token: string | undefined;
    try { token = stored ? JSON.parse(stored)?.state?.accessToken : undefined; } catch { token = undefined; }
    if (!token) { set({ actionError: 'Tu sesión no permite exportar esta cartera.' }); return false; }
    const suffix = queryString(filters);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    try {
      const response = await fetch(`${apiUrl}/api/portfolios/${portfolioId}/export.csv${suffix}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        set({ actionError: body?.error?.message ?? 'No se pudo exportar la cartera' });
        return false;
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cartera-${portfolioId}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      return true;
    } catch {
      set({ actionError: 'No se pudo exportar la cartera. Revisa tu conexión.' });
      return false;
    }
  },
  clearActionError: () => set({ actionError: null }),
  clear: () => set({ detail: null, projects: [], alerts: [], capacity: null, candidates: [], error: null, actionError: null }),
}));
