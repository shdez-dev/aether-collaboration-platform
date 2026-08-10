import { Request, Response } from 'express';
import { z } from 'zod';
import { organizationService } from '../services/OrganizationService';

const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: z.enum(['PERSONAL', 'COMPANY', 'INSTITUTION', 'NETWORK_OPERATOR']).optional(),
  billingEmail: z.string().email().nullable().optional(),
});

const createOrganizationSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['COMPANY', 'INSTITUTION', 'NETWORK_OPERATOR']),
  billingEmail: z.string().email().nullable().optional(),
});

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
    } catch (error: any) {
      const forbidden = error?.message === 'Organization admin access required';
      return res.status(forbidden ? 403 : 500).json({ success: false, error: { code: forbidden ? 'FORBIDDEN' : 'INTERNAL_ERROR', message: error?.message ?? 'Failed to update organization' } });
    }
  }
}

export const organizationController = new OrganizationController();
