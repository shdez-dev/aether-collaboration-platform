import { apiService } from '@/services/apiService';

export type ProjectTeam = {
  id: string;
  name: string;
  color: string | null;
  memberCount: number;
  leadName: string | null;
};

export type ProjectDirectMember = {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  role: string;
  addedAt: string;
};

export type ProjectTeamMember = {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
  teamId: string;
  teamName: string;
  teamColor: string | null;
};

export type ProjectActivityEntry = {
  id: string;
  eventType: string;
  payload: any;
  delta?: any;
  userId: string;
  userName: string;
  userAvatar?: string;
  timestamp: number;
  createdAt: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  cardId?: string;
};

export type ProjectBacklogCard = {
  id: string;
  title: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  completed: boolean;
  dueDate: string | null;
  boardId: string;
  boardName: string;
  listId: string;
  listName: string;
};

async function requireData<T>(request: Promise<{ success: boolean; data?: T; error?: { message?: string } }>): Promise<T> {
  const response = await request;
  if (!response.success || !response.data) throw new Error(response.error?.message || 'No se pudo cargar el proyecto');
  return response.data;
}

export const projectApi = {
  async getTeams(projectId: string): Promise<ProjectTeam[]> {
    return (await requireData(apiService.get<{ teams: ProjectTeam[] }>(`/api/projects/${projectId}/teams`, true))).teams;
  },
  async getDirectMembers(projectId: string): Promise<ProjectDirectMember[]> {
    return (await requireData(apiService.get<{ members: ProjectDirectMember[] }>(`/api/projects/${projectId}/members`, true))).members;
  },
  async getActivity(projectId: string, limit = 100): Promise<ProjectActivityEntry[]> {
    return (await requireData(apiService.get<{ events: ProjectActivityEntry[] }>(`/api/projects/${projectId}/activity?limit=${limit}`, true))).events;
  },
  async getBacklog(projectId: string): Promise<ProjectBacklogCard[]> {
    return (await requireData(apiService.get<{ cards: ProjectBacklogCard[] }>(`/api/projects/${projectId}/backlog`, true))).cards;
  },
  async getTeamMembers(projectId: string): Promise<ProjectTeamMember[]> {
    return (await requireData(apiService.get<{ members: ProjectTeamMember[] }>(`/api/projects/${projectId}/team-members`, true))).members;
  },
  async assignTeam(projectId: string, teamId: string): Promise<void> {
    await requireData(apiService.post(`/api/projects/${projectId}/teams`, { teamId }, true));
  },
  async removeTeam(projectId: string, teamId: string): Promise<void> {
    await requireData(apiService.delete(`/api/projects/${projectId}/teams/${teamId}`, true));
  },
  async addDirectMember(projectId: string, userId: string): Promise<ProjectDirectMember> {
    return (await requireData(apiService.post<{ member: ProjectDirectMember }>(`/api/projects/${projectId}/members`, { userId }, true))).member;
  },
  async removeDirectMember(projectId: string, userId: string): Promise<void> {
    await requireData(apiService.delete(`/api/projects/${projectId}/members/${userId}`, true));
  },
  async updateDirectMemberRole(projectId: string, userId: string, role: string): Promise<void> {
    await requireData(apiService.patch(`/api/projects/${projectId}/members/${userId}`, { role }, true));
  },
};
