import type { Workspace } from '@/stores/workspaceStore';

export function canManageOrganizationRole(role?: string | null): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

/**
 * Planning and team tooling belongs to an organization context. A PERSONAL
 * organization is the user's Free workspace, where these controls are hidden.
 * If older workspace payloads omit the organization summary, retain the legacy
 * mode as a fallback so TEAM and INSTITUTIONAL workspaces keep working.
 */
export function supportsOrganizationProjectPlanning(
  workspace: Pick<Workspace, 'mode' | 'organization'> | null | undefined,
): boolean {
  if (!workspace) return false;
  const organizationType = workspace.organization?.type;
  if (organizationType) return ['COMPANY', 'INSTITUTION', 'NETWORK_OPERATOR'].includes(organizationType);
  return workspace.mode !== 'PERSONAL';
}

export function supportsOrganizationTeams(
  workspace: Pick<Workspace, 'mode' | 'organization'> | null | undefined,
): boolean {
  return supportsOrganizationProjectPlanning(workspace);
}
