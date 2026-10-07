import { Request, Response } from 'express';
import { z } from 'zod';
import { organizationService, OrganizationServiceError } from '../services/OrganizationService';

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

function serviceError(res: Response, error: unknown, fallback: string) {
  if (error instanceof OrganizationServiceError) {
    return res.status(error.status).json({ success: false, error: { code: error.code, message: error.message } });
  }
  console.error('[OrganizationController]', error);
  return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: fallback } });
}

class OrganizationController {
  async create(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    const validation = createOrganizationSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid organization data', details: validation.error.errors } });
    try {
      const organization = await organizationService.createForUser(userId, validation.data);
      return res.status(201).json({ success: true, data: { organization } });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error?.message ?? 'Failed to create organization' } });
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
      return res.json({ success: true, data: { organization } });
    } catch (error) {
      if (error instanceof OrganizationServiceError) return serviceError(res, error, 'Failed to update organization');
      const forbidden = error instanceof Error && error.message === 'Organization admin access required';
      return res.status(forbidden ? 403 : 500).json({ success: false, error: { code: forbidden ? 'FORBIDDEN' : 'INTERNAL_ERROR', message: forbidden ? 'Organization admin access required' : 'Failed to update organization' } });
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
      await organizationService.inviteMember(req.params.id, userId, validation.data);
      return res.status(201).json({ success: true, data: { message: 'Invitation sent' } });
    } catch (error) {
      return serviceError(res, error, 'Failed to invite organization member');
    }
  }

  async revokeInvitation(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    try {
      await organizationService.revokeInvitation(req.params.id, req.params.invitationId, userId);
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
      const organizationId = await organizationService.acceptInvitation(req.params.token, userId);
      return res.json({ success: true, data: { message: 'Invitation accepted', organizationId } });
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
      return res.status(204).send();
    } catch (error) {
      return serviceError(res, error, 'Failed to transfer organization ownership');
    }
  }
}

export const organizationController = new OrganizationController();
