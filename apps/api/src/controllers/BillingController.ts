import { Request, Response } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { capabilityService, PLAN_CATALOG } from '../services/CapabilityService';
import { organizationStorageService } from '../services/OrganizationStorageService';
import { pool } from '../lib/db';
const fail=(res:Response,s:number,c:string,m:string)=>res.status(s).json({success:false,error:{code:c,message:m}});
async function admin(orgId:string,userId:string){const r=await pool.query(`SELECT 1 FROM organization_members WHERE organization_id=$1 AND user_id=$2 AND role IN ('OWNER','BILLING_ADMIN','ADMIN')`,[orgId,userId]);return !!r.rows[0];}
export class BillingController {
  async catalog(_req:Request,res:Response){return res.json({success:true,data:{plans:Object.entries(PLAN_CATALOG).map(([code,plan])=>({code,...plan}))}})}
  async overview(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) return fail(res, 401, 'UNAUTHORIZED', 'Authentication required');
    const organizationId = req.params.organizationId;
    if (!(await admin(organizationId, userId))) return fail(res, 403, 'FORBIDDEN', 'Billing administration is required');

    const [billing, counts, storage] = await Promise.all([
      capabilityService.getOrganizationCapabilities(organizationId),
      pool.query(
        `SELECT
           (SELECT COUNT(*)::int FROM workspaces WHERE organization_id = $1) AS workspaces,
           (SELECT COUNT(*)::int FROM organization_members WHERE organization_id = $1) AS members`,
        [organizationId],
      ),
      organizationStorageService.getUsage(organizationId),
    ]);
    const usedBytes = Number(storage.usedBytes);
    const limitBytes = storage.limitBytes === null ? null : Number(storage.limitBytes);
    const storagePercent = limitBytes ? Math.min(100, Math.round((usedBytes / limitBytes) * 100)) : null;

    return res.json({
      success: true,
      data: {
        ...billing,
        usage: {
          ...counts.rows[0],
          storageUsedBytes: usedBytes,
          storageLimitBytes: limitBytes,
          storagePercent,
        },
        portalUrl: process.env.BILLING_PORTAL_URL ?? null,
      },
    });
  }
  async checkout(req:Request,res:Response){const userId=req.user?.id;const p=z.object({planCode:z.enum(['TEAMS','PORTFOLIO','INSTITUTIONAL','NETWORK'])}).safeParse(req.body);if(!userId)return fail(res,401,'UNAUTHORIZED','Authentication required');if(!p.success)return fail(res,400,'VALIDATION_ERROR','Invalid plan');if(!(await admin(req.params.organizationId,userId)))return fail(res,403,'FORBIDDEN','Billing administration is required');const base=process.env.BILLING_CHECKOUT_URL;if(!base)return fail(res,503,'BILLING_UNAVAILABLE','No payment provider is configured');return res.json({success:true,data:{checkoutUrl:`${base}?organization=${encodeURIComponent(req.params.organizationId)}&plan=${p.data.planCode}`}})}
  async webhook(req: Request, res: Response) {
    const secret = process.env.BILLING_WEBHOOK_SECRET;
    if (!secret) return fail(res, 503, 'BILLING_UNAVAILABLE', 'Billing webhook is not configured');
    if (!Buffer.isBuffer(req.body)) return fail(res, 400, 'VALIDATION_ERROR', 'Raw webhook body required');
    const signature = String(req.headers['x-billing-signature'] ?? '');
    const expected = createHmac('sha256', secret).update(req.body).digest('hex');
    if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return fail(res, 401, 'INVALID_SIGNATURE', 'Invalid webhook signature');
    }
    let payload: unknown;
    try {
      payload = JSON.parse(req.body.toString('utf8'));
    } catch {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid webhook JSON');
    }
    const event = z.object({
      id: z.string().min(1),
      organizationId: z.string().uuid(),
      planCode: z.enum(['FREE', 'TEAMS', 'PORTFOLIO', 'INSTITUTIONAL', 'NETWORK']),
      status: z.enum(['TRIALING', 'ACTIVE', 'PAST_DUE', 'PAUSED', 'CANCELED', 'EXPIRED']),
      providerCustomerId: z.string().optional(),
      providerSubscriptionId: z.string().optional(),
      periodEnd: z.string().datetime().optional().nullable(),
    }).safeParse(payload);
    if (!event.success) return fail(res, 400, 'VALIDATION_ERROR', 'Invalid billing event');
    const value = event.data;
    await pool.query(
      `INSERT INTO subscriptions(id,organization_id,plan_code,status,provider,provider_customer_id,provider_subscription_id,current_period_end,updated_at)
       VALUES(gen_random_uuid(),$1,$2,$3::"SubscriptionStatus",'configured-provider',$4,$5,$6,CURRENT_TIMESTAMP)
       ON CONFLICT(provider_subscription_id) DO UPDATE SET plan_code=EXCLUDED.plan_code,status=EXCLUDED.status,
         current_period_end=EXCLUDED.current_period_end,updated_at=CURRENT_TIMESTAMP`,
      [value.organizationId, value.planCode, value.status, value.providerCustomerId ?? null,
        value.providerSubscriptionId ?? `event:${value.id}`, value.periodEnd ?? null]
    );
    return res.json({ success: true });
  }
}
export const billingController=new BillingController();
