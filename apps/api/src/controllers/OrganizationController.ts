import { Request, Response } from 'express';
import { z } from 'zod';
import { getRealtimeGateway } from '../websocket/RealtimeGateway';
import { organizationService } from '../services/OrganizationService';
import { OrganizationServiceError } from '../services/OrganizationServiceError';
import { organizationAccessRoleService } from '../services/OrganizationAccessRoleService';
import { getInstitutionalSettingsHistory, institutionalSettingsSchema, loadInstitutionalSettingsForMember, saveInstitutionalSettings } from '../services/InstitutionalSettingsService';
import { loadTeamOrganizationSettingsForMember, saveTeamOrganizationSettings, teamOrganizationSettingsSchema } from '../services/TeamOrganizationSettingsService';

const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  billingEmail: z.string().email().nullable().optional(),
});

const createOrganizationSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['COMPANY', 'INSTITUTION', 'NETWORK_OPERATOR']),
  billingEmail: z.string().email().nullable().optional(),
});

const organizationMemberRoleSchema = z.enum(['BILLING_ADMIN', 'ADMIN', 'MEMBER']);
const inviteOrganizationMemberSchema = z.object({
  email: z.string().email().max(255),
  role: organizationMemberRoleSchema.default('MEMBER'),
});
const updateOrganizationMemberSchema = z.object({ role: organizationMemberRoleSchema });
const transferOwnershipSchema = z.object({ userId: z.string().uuid() });
const deleteOrganizationSchema = z.object({ confirmationName: z.string().min(1).max(255) });

type OrganizationRealtimeResource = 'members' | 'invitations' | 'settings' | 'all';

async function publishOrganizationChange(
  organizationId: string,
  resource: OrganizationRealtimeResource,
  options: { refreshUserIds?: string[]; revokeUserId?: string; deleted?: boolean } = {},
) {
  try {
    const gateway = getRealtimeGateway();
    gateway.invalidateOrganization(organizationId, resource);
    options.refreshUserIds?.forEach((userId) => gateway.invalidateOrganizationUser(userId, organizationId));
    if (options.revokeUserId) {
      gateway.invalidateOrganizationUser(options.revokeUserId, organizationId);
      await gateway.revalidateUserRooms(options.revokeUserId);
    }
    if (options.deleted) await gateway.revalidateOrganizationRooms(organizationId);
  } catch {
    // Persisted organization changes must not fail because realtime is offline.
  }
}

function serviceError(res: Response, error: unknown, fallback: string) {
  if (error instanceof OrganizationServiceError) {
    return res.status(error.status).json({ success: false, error: { code: error.code, message: error.message } });
  }
  console.error('[OrganizationController]', error);
  return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: fallback } });
}

class OrganizationController {
  async getInstitutionalSettings(req: Request, res: Response) {
    const actorId = req.user?.id;
    if (!actorId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    try {
      const data = await loadInstitutionalSettingsForMember(req.params.id, actorId);
      return res.json({ success: true, data });
    } catch (error) { return serviceError(res, error, 'Failed to load institutional settings'); }
  }

  async updateInstitutionalSettings(req: Request, res: Response) {
    const actorId = req.user?.id;
    if (!actorId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    const parsed = institutionalSettingsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid institutional settings', details: parsed.error.flatten() } });
    try {
      const settings = await saveInstitutionalSettings(req.params.id, actorId, parsed.data);
      await publishOrganizationChange(req.params.id, 'settings');
      return res.json({ success: true, data: { settings } });
    } catch (error) { return serviceError(res, error, 'Failed to save institutional settings'); }
  }

  async getTeamSettings(req: Request, res: Response) {
    const actorId = req.user?.id;
    if (!actorId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    try {
      const data = await loadTeamOrganizationSettingsForMember(req.params.id, actorId);
      return res.json({ success: true, data });
    } catch (error) { return serviceError(res, error, 'Failed to load team settings'); }
  }

  async updateTeamSettings(req: Request, res: Response) {
    const actorId = req.user?.id;
    if (!actorId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    const parsed = teamOrganizationSettingsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid team settings', details: parsed.error.flatten() } });
    try {
      const settings = await saveTeamOrganizationSettings(req.params.id, actorId, parsed.data);
      await publishOrganizationChange(req.params.id, 'settings');
      return res.json({ success: true, data: { settings } });
    } catch (error) { return serviceError(res, error, 'Failed to save team settings'); }
  }

  async getAccessRoles(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    try {
      const roles = await organizationAccessRoleService.list(req.params.id, userId);
      return res.json({ success: true, data: { roles } });
    } catch (error) { return serviceError(res, error, 'Failed to load access roles'); }
  }

  async createAccessRole(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    try {
      const role = await organizationAccessRoleService.create(req.params.id, userId, req.body);
      await publishOrganizationChange(req.params.id, 'settings');
      return res.status(201).json({ success: true, data: { role } });
    } catch (error) { return serviceError(res, error, 'Failed to create access role'); }
  }

  async updateAccessRole(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    try {
      const role = await organizationAccessRoleService.update(req.params.id, userId, req.params.roleKey, req.body);
      await publishOrganizationChange(req.params.id, 'settings');
      return res.json({ success: true, data: { role } });
    } catch (error) { return serviceError(res, error, 'Failed to update access role'); }
  }

  async deleteAccessRole(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    try {
      await organizationAccessRoleService.remove(req.params.id, userId, req.params.roleKey);
      await publishOrganizationChange(req.params.id, 'settings');
      return res.status(204).send();
    } catch (error) { return serviceError(res, error, 'Failed to delete access role'); }
  }

  async getInstitutionalSettingsHistory(req: Request, res: Response) {
    const actorId = req.user?.id;
    if (!actorId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    try {
      const history = await getInstitutionalSettingsHistory(req.params.id, actorId);
      return res.json({ success: true, data: { history } });
    } catch (error) { return serviceError(res, error, 'Failed to load institutional settings history'); }
  }

  async create(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    const validation = createOrganizationSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid organization data', details: validation.error.errors } });
    try {
      const organization = await organizationService.createForUser(userId, validation.data);
      return res.status(201).json({ success: true, data: { organization } });
    } catch (error: any) {
      return serviceError(res, error, 'Failed to create organization');
    }
  }

  async getCreationPermissions(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    try {
      const types = await organizationService.getCreationPermissions(userId);
      return res.json({ success: true, data: { types } });
    } catch (error) {
      return serviceError(res, error, 'Failed to load organization creation permissions');
    }
  }

  async list(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    try {
      const organizations = await organizationService.listForUser(userId);
      return res.json({ success: true, data: { organizations } });
    } catch (error) {
      return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch organizations' } });
    }
  }

  async getById(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    try {
      const organization = await organizationService.getForUser(req.params.id, userId);
      if (!organization) return res.status(404).json({ success: false, error: { code: 'ORGANIZATION_NOT_FOUND', message: 'Organization not found or access denied' } });
      return res.json({ success: true, data: { organization } });
    } catch (error) {
      return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch organization' } });
    }
  }

  async update(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    const validation = updateOrganizationSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid organization data', details: validation.error.errors } });
    try {
      const organization = await organizationService.update(req.params.id, userId, validation.data);
      if (!organization) return res.status(404).json({ success: false, error: { code: 'ORGANIZATION_NOT_FOUND', message: 'Organization not found or access denied' } });
      await publishOrganizationChange(req.params.id, 'settings');
      return res.json({ success: true, data: { organization } });
    } catch (error) {
      if (error instanceof OrganizationServiceError) return serviceError(res, error, 'Failed to update organization');
      const forbidden = error instanceof Error && error.message === 'Organization admin access required';
      return res.status(forbidden ? 403 : 500).json({ success: false, error: { code: forbidden ? 'FORBIDDEN' : 'INTERNAL_ERROR', message: forbidden ? 'Organization admin access required' : 'Failed to update organization' } });
    }
  }

  async remove(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    const validation = deleteOrganizationSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Enter the organization name to confirm deletion', details: validation.error.errors } });
    try {
      await organizationService.deleteOrganization(req.params.id, userId, validation.data.confirmationName);
      await publishOrganizationChange(req.params.id, 'all', { refreshUserIds: [userId], deleted: true });
      return res.status(204).send();
    } catch (error) {
      return serviceError(res, error, 'Failed to delete organization');
    }
  }

  async getMembers(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    try {
      const members = await organizationService.getMembers(req.params.id, userId);
      return res.json({ success: true, data: { members } });
    } catch (error) {
      return serviceError(res, error, 'Failed to fetch organization members');
    }
  }

  async getInvitableContacts(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    try {
      const contacts = await organizationService.getInvitableContacts(req.params.id, userId);
      return res.json({ success: true, data: { contacts } });
    } catch (error) {
      return serviceError(res, error, 'Failed to fetch contacts');
    }
  }

  async getPendingInvitations(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    try {
      const invitations = await organizationService.getPendingInvitations(req.params.id, userId);
      return res.json({ success: true, data: { invitations } });
    } catch (error) {
      return serviceError(res, error, 'Failed to fetch organization invitations');
    }
  }

  async inviteMember(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    const validation = inviteOrganizationMemberSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid invitation data', details: validation.error.errors } });
    try {
      const invitation = await organizationService.inviteMember(req.params.id, userId, validation.data);
      await publishOrganizationChange(req.params.id, 'invitations');
      res.set('Cache-Control', 'no-store');
      return res.status(201).json({ success: true, data: { invitation } });
    } catch (error) {
      return serviceError(res, error, 'Failed to invite organization member');
    }
  }

  async regenerateInvitationCode(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    try {
      const invitation = await organizationService.regenerateInvitationCode(req.params.id, req.params.invitationId, userId);
      await publishOrganizationChange(req.params.id, 'invitations');
      res.set('Cache-Control', 'no-store');
      return res.json({ success: true, data: { invitation } });
    } catch (error) {
      return serviceError(res, error, 'Failed to regenerate invitation code');
    }
  }

  async revokeInvitation(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    try {
      await organizationService.revokeInvitation(req.params.id, req.params.invitationId, userId);
      await publishOrganizationChange(req.params.id, 'invitations');
      return res.status(204).send();
    } catch (error) {
      return serviceError(res, error, 'Failed to revoke organization invitation');
    }
  }

  async acceptInvitation(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    if (!/^[a-f0-9]{64}$/i.test(req.params.token)) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid invitation token' } });
    try {
      const { organizationId, workspaceId } = await organizationService.acceptInvitation(req.params.token, userId);
      await publishOrganizationChange(organizationId, 'all', { refreshUserIds: [userId] });
      return res.json({ success: true, data: { message: 'Invitation accepted', organizationId, workspaceId } });
    } catch (error) {
      return serviceError(res, error, 'Failed to accept organization invitation');
    }
  }

  async previewInvitation(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    const invitationId = typeof req.query.invitationId === 'string' ? req.query.invitationId : '';
    if (Boolean(token) === Boolean(invitationId)) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Provide one invitation reference' } });
    }
    if (token && !/^[a-f0-9]{64}$/i.test(token)) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid invitation token' } });
    }
    if (invitationId && !z.string().uuid().safeParse(invitationId).success) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid invitation id' } });
    }
    try {
      const invitation = await organizationService.getInvitationPreview(token || invitationId, userId, token ? 'token' : 'id');
      res.set('Cache-Control', 'no-store');
      return res.json({ success: true, data: { invitation } });
    } catch (error) {
      return serviceError(res, error, 'Failed to load organization invitation');
    }
  }

  async acceptInvitationById(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    if (!z.string().uuid().safeParse(req.params.invitationId).success) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid invitation id' } });
    }
    try {
      const { organizationId, workspaceId } = await organizationService.acceptInvitationById(req.params.invitationId, userId);
      await publishOrganizationChange(organizationId, 'all', { refreshUserIds: [userId] });
      return res.json({ success: true, data: { message: 'Invitation accepted', organizationId, workspaceId } });
    } catch (error) {
      return serviceError(res, error, 'Failed to accept organization invitation');
    }
  }

  async updateMember(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    const validation = updateOrganizationMemberSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid organization role', details: validation.error.errors } });
    try {
      await organizationService.changeMemberRole(req.params.id, userId, req.params.userId, validation.data.role);
      await publishOrganizationChange(req.params.id, 'members', { refreshUserIds: [req.params.userId] });
      return res.status(204).send();
    } catch (error) {
      return serviceError(res, error, 'Failed to update organization member');
    }
  }

  async removeMember(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    try {
      await organizationService.removeMember(req.params.id, userId, req.params.userId);
      await publishOrganizationChange(req.params.id, 'members', { revokeUserId: req.params.userId });
      return res.status(204).send();
    } catch (error) {
      return serviceError(res, error, 'Failed to remove organization member');
    }
  }

  async transferOwnership(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    const validation = transferOwnershipSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid ownership transfer data', details: validation.error.errors } });
    try {
      await organizationService.transferOwnership(req.params.id, userId, validation.data.userId);
      await publishOrganizationChange(req.params.id, 'members', { refreshUserIds: [userId, validation.data.userId] });
      return res.status(204).send();
    } catch (error) {
      return serviceError(res, error, 'Failed to transfer organization ownership');
    }
  }
}

export const organizationController = new OrganizationController();
