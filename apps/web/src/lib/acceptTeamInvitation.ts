import { useActiveWorkspaceStore } from '@/stores/activeWorkspaceStore';
import { useTeamStore } from '@/stores/teamStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { apiService } from '@/services/apiService';

/** Accept an invite and refresh the workspace-scoped navigation immediately. */
export async function acceptTeamInvitationAndSync(
  invitationId: string,
  context: { teamId?: string; workspaceId?: string | null } = {},
) {
  const teamStore = useTeamStore.getState();
  const pending = teamStore.pendingTeamInvitations.find((invitation) => invitation.id === invitationId);
  await teamStore.acceptTeamInvitation(invitationId);

  const teamId = context.teamId ?? pending?.team.id;
  if (!teamId) throw new Error('No pudimos identificar el equipo de esta invitación.');

  let workspaceId = context.workspaceId ?? undefined;
  if (!workspaceId) {
    try {
      const response = await apiService.get<{ team: { workspaceId: string } }>(`/api/teams/${teamId}`, true);
      workspaceId = response.data?.team.workspaceId;
    } catch { /* la aceptación ya se guardó; el acceso de equipo se puede refrescar al abrirlo */ }
  }

  const activeWorkspaceStore = useActiveWorkspaceStore.getState();
  if (workspaceId) activeWorkspaceStore.setActiveWorkspaceId(workspaceId);

  await Promise.all([
    useWorkspaceStore.getState().fetchWorkspaces(),
    ...(workspaceId ? [useTeamStore.getState().fetchTeams(workspaceId)] : []),
    ...(workspaceId ? [activeWorkspaceStore.fetchSidebarProjects(workspaceId)] : []),
  ]);

  return { teamId, workspaceId };
}
