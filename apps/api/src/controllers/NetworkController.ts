import { Request, Response } from 'express';
import { z } from 'zod';
import { getClient, pool } from '../lib/db';
import { revalidateUserSocketRooms } from '../websocket/RealtimeGateway';

const roles = ['MENTOR', 'EVALUATOR', 'SPONSOR', 'PARTNER', 'REQUESTER'] as const;
const resources = ['INITIATIVE', 'DOCUMENT', 'PROJECT'] as const;
const programTypes = ['CALL', 'INCUBATOR', 'CHALLENGE', 'FUND', 'MENTORSHIP'] as const;
const statuses = ['DRAFT', 'OPEN', 'REVIEWING', 'CLOSED', 'ARCHIVED'] as const;
const createNetwork = z.object({ organizationId: z.string().uuid(), name: z.string().trim().min(2).max(255), description: z.string().max(4000).optional() });
const programInput = z.object({ hostWorkspaceId: z.string().uuid(), name: z.string().trim().min(2).max(255), description: z.string().max(4000).optional(), type: z.enum(programTypes), status: z.enum(statuses).optional(), startsAt: z.string().datetime().optional().nullable(), endsAt: z.string().datetime().optional().nullable() });
const accessInput = z.object({ programId: z.string().uuid(), userId: z.string().uuid(), role: z.enum(roles), resourceType: z.enum(resources), resourceId: z.string().uuid(), permission: z.enum(['VIEW', 'COMMENT']).default('VIEW'), expiresAt: z.string().datetime().optional().nullable() });
const inviteInput = accessInput.omit({ userId: true }).extend({ email: z.string().email() });
const evaluationInput = z.object({ recommendation: z.enum(['RECOMMEND', 'CONDITIONAL', 'DO_NOT_RECOMMEND']).optional(), comments: z.string().max(5000).optional(), conflictDeclared: z.boolean(), conflictDetails: z.string().max(2000).optional().nullable(), scores: z.array(z.object({ criterionId: z.string().uuid(), score: z.number().int().min(0).max(100), comment: z.string().max(2000).optional() })).max(30) });
const criterionInput = z.object({ name: z.string().min(2).max(255), description: z.string().max(2000).optional(), maxScore: z.number().int().min(1).max(100).default(5), required: z.boolean().optional() });
const fail = (res: Response, status: number, code: string, message: string) => res.status(status).json({ success: false, error: { code, message } });
const actor = (req: Request) => req.user?.id;

async function networkRole(networkId: string, userId: string) {
  const { rows } = await pool.query(
    `SELECT nm.role, n.owner_organization_id,
      EXISTS(SELECT 1 FROM organization_members om WHERE om.organization_id = n.owner_organization_id AND om.user_id = $2 AND om.role IN ('OWNER', 'ADMIN')) AS organization_admin
     FROM networks n
     LEFT JOIN network_members nm ON nm.network_id = n.id AND nm.user_id = $2
     WHERE n.id = $1
       AND (nm.user_id IS NOT NULL OR EXISTS(
         SELECT 1 FROM organization_members om
         WHERE om.organization_id = n.owner_organization_id AND om.user_id = $2 AND om.role IN ('OWNER', 'ADMIN')
       ))`,
    [networkId, userId]
  );
  if (!rows[0]) return null; return { ...rows[0], isAdmin: rows[0].role === 'ADMIN' || rows[0].organization_admin };
}
async function record(networkId: string, userId: string, resourceType: string, resourceId: string, action: string, metadata: object = {}) {
  await pool.query(`INSERT INTO network_access_audits (id, network_id, user_id, resource_type, resource_id, action, metadata) VALUES (gen_random_uuid(), $1, $2, $3::"NetworkResourceType", $4, $5, $6::jsonb)`, [networkId, userId, resourceType, resourceId, action, JSON.stringify(metadata)]);
}
async function validateProgramResource(networkId: string, programId: string, resourceType: string, resourceId: string) {
  const program = await pool.query(`SELECT host_workspace_id FROM network_programs WHERE id = $1 AND network_id = $2`, [programId, networkId]);
  if (!program.rows[0]) return false; const workspaceId = program.rows[0].host_workspace_id;
  const table = resourceType === 'INITIATIVE' ? 'initiatives' : resourceType === 'DOCUMENT' ? 'documents' : 'projects';
  const resource = await pool.query(`SELECT 1 FROM ${table} WHERE id = $1 AND workspace_id = $2`, [resourceId, workspaceId]);
  return Boolean(resource.rows[0]);
}

export class NetworkController {
  async list(req: Request, res: Response) {
    const userId = actor(req); if (!userId) return fail(res, 401, 'UNAUTHORIZED', 'Authentication required');
    const result = await pool.query(`SELECT n.*, nm.role, o.name AS owner_organization_name, COUNT(DISTINCT np.id)::int AS program_count FROM networks n LEFT JOIN network_members nm ON nm.network_id = n.id AND nm.user_id = $1 JOIN organizations o ON o.id = n.owner_organization_id LEFT JOIN network_programs np ON np.network_id = n.id WHERE nm.user_id IS NOT NULL OR EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = n.owner_organization_id AND om.user_id = $1 AND om.role IN ('OWNER', 'ADMIN')) GROUP BY n.id, nm.role, o.name ORDER BY n.updated_at DESC`, [userId]);
    return res.json({ success: true, data: { networks: result.rows } });
  }
  async create(req: Request, res: Response) {
    const userId = actor(req); const parsed = createNetwork.safeParse(req.body); if (!userId) return fail(res, 401, 'UNAUTHORIZED', 'Authentication required'); if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Invalid network data'); const d = parsed.data;
    const allowed = await pool.query(`SELECT 1 FROM organization_members WHERE organization_id = $1 AND user_id = $2 AND role IN ('OWNER', 'ADMIN')`, [d.organizationId, userId]); if (!allowed.rows[0]) return fail(res, 403, 'FORBIDDEN', 'Organization administration is required');
    const client = await getClient(); try { await client.query('BEGIN'); const network = await client.query(`INSERT INTO networks (id, owner_organization_id, name, description) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING *`, [d.organizationId, d.name, d.description ?? null]); await client.query(`INSERT INTO network_organizations (network_id, organization_id, role) VALUES ($1, $2, 'HOST')`, [network.rows[0].id, d.organizationId]); await client.query(`INSERT INTO network_members (network_id, user_id, role) VALUES ($1, $2, 'ADMIN') ON CONFLICT DO UPDATE SET role = 'ADMIN'`, [network.rows[0].id, userId]); await client.query('COMMIT'); return res.status(201).json({ success: true, data: { network: network.rows[0] } }); } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  }
  async get(req: Request, res: Response) {
    const userId = actor(req); if (!userId) return fail(res, 401, 'UNAUTHORIZED', 'Authentication required'); const gate = await networkRole(req.params.id, userId); if (!gate) return fail(res, 404, 'NOT_FOUND', 'Network not found');
    const [network, organizations, members, programs] = await Promise.all([pool.query(`SELECT n.*, o.name AS owner_organization_name FROM networks n JOIN organizations o ON o.id=n.owner_organization_id WHERE n.id=$1`, [req.params.id]), pool.query(`SELECT no.role, o.id, o.name, o.type FROM network_organizations no JOIN organizations o ON o.id=no.organization_id WHERE no.network_id=$1`, [req.params.id]), pool.query(`SELECT nm.role, u.id, u.name, u.email, u.avatar FROM network_members nm JOIN users u ON u.id=nm.user_id WHERE nm.network_id=$1`, [req.params.id]), pool.query(`SELECT * FROM network_programs WHERE network_id=$1 ORDER BY created_at DESC`, [req.params.id])]);
    return res.json({ success: true, data: { network: network.rows[0], programs: programs.rows, ...(gate.isAdmin ? { organizations: organizations.rows, members: members.rows } : {}), permissions: { isAdmin: gate.isAdmin } } });
  }
  async addOrganization(req: Request, res: Response) {
    const userId = actor(req); const organizationId = req.body.organizationId; const role = req.body.role ?? 'PARTNER'; if (!userId) return fail(res, 401, 'UNAUTHORIZED', 'Authentication required'); const gate = await networkRole(req.params.id, userId); if (!gate?.isAdmin) return fail(res, 403, 'FORBIDDEN', 'Network administration is required'); if (!z.string().uuid().safeParse(organizationId).success || !['HOST', 'PARTNER', 'SPONSOR'].includes(role)) return fail(res, 400, 'VALIDATION_ERROR', 'Invalid organization'); await pool.query(`INSERT INTO network_organizations (network_id, organization_id, role) VALUES ($1, $2, $3::"NetworkOrganizationRole") ON CONFLICT (network_id, organization_id) DO UPDATE SET role=EXCLUDED.role`, [req.params.id, organizationId, role]); return res.status(201).json({ success: true });
  }
  async addMember(req: Request, res: Response) {
    const userId = actor(req); const target = req.body.userId; const role = req.body.role ?? 'MEMBER'; if (!userId) return fail(res, 401, 'UNAUTHORIZED', 'Authentication required'); const gate = await networkRole(req.params.id, userId); if (!gate?.isAdmin) return fail(res, 403, 'FORBIDDEN', 'Network administration is required'); if (!z.string().uuid().safeParse(target).success || !['ADMIN', 'MEMBER', 'MENTOR', 'EVALUATOR'].includes(role)) return fail(res, 400, 'VALIDATION_ERROR', 'Invalid member'); await pool.query(`INSERT INTO network_members (network_id, user_id, role) VALUES ($1, $2, $3::"NetworkMemberRole") ON CONFLICT (network_id, user_id) DO UPDATE SET role=EXCLUDED.role`, [req.params.id, target, role]); return res.status(201).json({ success: true });
  }
  async createProgram(req: Request, res: Response) {
    const userId = actor(req); const parsed = programInput.safeParse(req.body); if (!userId) return fail(res, 401, 'UNAUTHORIZED', 'Authentication required'); if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Invalid program'); const gate = await networkRole(req.params.id, userId); if (!gate?.isAdmin) return fail(res, 403, 'FORBIDDEN', 'Network administration is required'); const d=parsed.data;
    const host = await pool.query(`SELECT 1 FROM workspaces w JOIN network_organizations no ON no.organization_id=w.organization_id WHERE w.id=$1 AND no.network_id=$2`, [d.hostWorkspaceId, req.params.id]); if (!host.rows[0]) return fail(res, 400, 'VALIDATION_ERROR', 'The host workspace organization must participate in the network'); const result = await pool.query(`INSERT INTO network_programs (id, network_id, host_workspace_id, name, description, type, status, starts_at, ends_at) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::"NetworkProgramType", $6::"NetworkProgramStatus", $7, $8) RETURNING *`, [req.params.id,d.hostWorkspaceId,d.name,d.description??null,d.type,d.status??'DRAFT',d.startsAt??null,d.endsAt??null]); return res.status(201).json({ success:true,data:{program:result.rows[0]} });
  }
  async attachInitiative(req: Request, res: Response) { const userId=actor(req); if(!userId)return fail(res,401,'UNAUTHORIZED','Authentication required'); const gate=await networkRole(req.params.networkId,userId); if(!gate?.isAdmin)return fail(res,403,'FORBIDDEN','Network administration is required'); const valid=await validateProgramResource(req.params.networkId,req.params.programId,'INITIATIVE',req.body.initiativeId); if(!valid)return fail(res,400,'VALIDATION_ERROR','Initiative must belong to the program host workspace'); await pool.query(`UPDATE initiatives SET network_program_id=$2, updated_at=CURRENT_TIMESTAMP WHERE id=$1`,[req.body.initiativeId,req.params.programId]); return res.json({success:true}); }
  async createInvitation(req: Request,res: Response) { const userId=actor(req);const parsed=inviteInput.safeParse(req.body);if(!userId)return fail(res,401,'UNAUTHORIZED','Authentication required');if(!parsed.success)return fail(res,400,'VALIDATION_ERROR','Invalid invitation');const gate=await networkRole(req.params.id,userId);if(!gate?.isAdmin)return fail(res,403,'FORBIDDEN','Network administration is required');const d=parsed.data;if(!(await validateProgramResource(req.params.id,d.programId,d.resourceType,d.resourceId)))return fail(res,400,'VALIDATION_ERROR','Resource must belong to the program host workspace');const r=await pool.query(`INSERT INTO network_external_invitations (id,network_id,program_id,email,role,resource_type,resource_id,permission,token,invited_by,expires_at) VALUES (gen_random_uuid(),$1,$2,$3,$4::"NetworkExternalRole",$5::"NetworkResourceType",$6,$7,gen_random_uuid()::text,$8,$9) RETURNING id,token,expires_at`,[req.params.id,d.programId,d.email.toLowerCase(),d.role,d.resourceType,d.resourceId,d.permission,userId,d.expiresAt??null]);await record(req.params.id,userId,d.resourceType,d.resourceId,'INVITED',{email:d.email,role:d.role});return res.status(201).json({success:true,data:{invitation:r.rows[0]}}); }
  async acceptInvitation(req: Request, res: Response) {
    const userId = actor(req);
    if (!userId) return fail(res, 401, 'UNAUTHORIZED', 'Authentication required');
    const user = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
    const client = await getClient();
    let invitation: any;
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `SELECT * FROM network_external_invitations
         WHERE token = $1 AND status = 'PENDING' AND revoked_at IS NULL
           AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
         FOR UPDATE`,
        [req.params.token],
      );
      invitation = result.rows[0];
      if (!invitation || invitation.email.toLowerCase() !== user.rows[0]?.email?.toLowerCase()) {
        await client.query('ROLLBACK');
        return fail(res, 404, 'NOT_FOUND', 'Invitation not available');
      }

      const networkRole = invitation.role === 'MENTOR'
        ? 'MENTOR'
        : invitation.role === 'EVALUATOR'
          ? 'EVALUATOR'
          : 'MEMBER';
      await client.query(
        `INSERT INTO network_members (network_id, user_id, role)
         VALUES ($1, $2, $3::"NetworkMemberRole") ON CONFLICT DO NOTHING`,
        [invitation.network_id, userId, networkRole],
      );
      await client.query(
        `INSERT INTO network_access_grants
         (id, network_id, program_id, user_id, role, resource_type, resource_id, permission, granted_by, expires_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4::"NetworkExternalRole", $5::"NetworkResourceType", $6, $7, $8, $9)
         ON CONFLICT (network_id, user_id, resource_type, resource_id)
         DO UPDATE SET revoked_at = NULL, permission = EXCLUDED.permission, expires_at = EXCLUDED.expires_at`,
        [invitation.network_id, invitation.program_id, userId, invitation.role,
          invitation.resource_type, invitation.resource_id, invitation.permission,
          invitation.invited_by, invitation.expires_at],
      );
      await client.query(
        `UPDATE network_external_invitations SET status = 'ACCEPTED', accepted_by = $2 WHERE id = $1`,
        [invitation.id, userId],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    if (invitation.resource_type === 'DOCUMENT') await revalidateUserSocketRooms(userId);
    await record(
      invitation.network_id,
      userId,
      invitation.resource_type,
      invitation.resource_id,
      'INVITATION_ACCEPTED',
    );
    return res.json({ success: true, data: { networkId: invitation.network_id } });
  }
  async grant(req: Request,res: Response) {
    const userId = actor(req);
    const parsed = accessInput.safeParse(req.body);
    if (!userId) return fail(res, 401, 'UNAUTHORIZED', 'Authentication required');
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Invalid access grant');
    const gate = await networkRole(req.params.id, userId);
    if (!gate?.isAdmin) return fail(res, 403, 'FORBIDDEN', 'Network administration is required');
    const grant = parsed.data;
    if (!(await validateProgramResource(req.params.id, grant.programId, grant.resourceType, grant.resourceId))) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Resource must belong to the program host workspace');
    }
    await pool.query(
      `INSERT INTO network_access_grants
       (id, network_id, program_id, user_id, role, resource_type, resource_id, permission, granted_by, expires_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4::"NetworkExternalRole", $5::"NetworkResourceType", $6, $7, $8, $9)
       ON CONFLICT (network_id, user_id, resource_type, resource_id)
       DO UPDATE SET revoked_at = NULL, permission = EXCLUDED.permission,
         role = EXCLUDED.role, expires_at = EXCLUDED.expires_at`,
      [req.params.id, grant.programId, grant.userId, grant.role, grant.resourceType,
        grant.resourceId, grant.permission, userId, grant.expiresAt ?? null],
    );
    await record(req.params.id, grant.userId, grant.resourceType, grant.resourceId, 'GRANTED', { by: userId });
    if (grant.resourceType === 'DOCUMENT') await revalidateUserSocketRooms(grant.userId);
    return res.status(201).json({ success: true });
  }
  async revoke(req: Request,res: Response) {
    const userId = actor(req);
    if (!userId) return fail(res, 401, 'UNAUTHORIZED', 'Authentication required');
    const gate = await networkRole(req.params.id, userId);
    if (!gate?.isAdmin) return fail(res, 403, 'FORBIDDEN', 'Network administration is required');
    const result = await pool.query(
      `UPDATE network_access_grants
       SET revoked_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND network_id = $2 AND revoked_at IS NULL
       RETURNING user_id, resource_type, resource_id`,
      [req.params.grantId, req.params.id],
    );
    const grant = result.rows[0];
    if (!grant) return fail(res, 404, 'NOT_FOUND', 'Active grant not found');
    if (grant.resource_type === 'DOCUMENT') {
      await revalidateUserSocketRooms(grant.user_id);
    }
    await record(req.params.id, grant.user_id, grant.resource_type, grant.resource_id, 'REVOKED', { by: userId });
    return res.json({ success: true });
  }
  async assignments(req: Request,res: Response) { const userId=actor(req);if(!userId)return fail(res,401,'UNAUTHORIZED','Authentication required');const r=await pool.query(`SELECT g.*,n.name AS network_name,np.name AS program_name,i.title AS initiative_title,i.stage AS initiative_stage,i.next_review_at FROM network_access_grants g JOIN networks n ON n.id=g.network_id LEFT JOIN network_programs np ON np.id=g.program_id LEFT JOIN initiatives i ON g.resource_type='INITIATIVE' AND i.id=g.resource_id WHERE g.user_id=$1 AND g.revoked_at IS NULL AND (g.expires_at IS NULL OR g.expires_at>CURRENT_TIMESTAMP) ORDER BY g.created_at DESC`,[userId]);for(const grant of r.rows)await record(grant.network_id,userId,grant.resource_type,grant.resource_id,'VIEWED_ASSIGNMENT');return res.json({success:true,data:{assignments:r.rows}}); }
  async createCriterion(req: Request,res: Response) { const userId=actor(req);const parsed=criterionInput.safeParse(req.body);if(!userId)return fail(res,401,'UNAUTHORIZED','Authentication required');if(!parsed.success)return fail(res,400,'VALIDATION_ERROR','Invalid criterion');const gate=await networkRole(req.params.networkId,userId);if(!gate?.isAdmin)return fail(res,403,'FORBIDDEN','Network administration is required');const p=await pool.query(`SELECT 1 FROM network_programs WHERE id=$1 AND network_id=$2`,[req.params.programId,req.params.networkId]);if(!p.rows[0])return fail(res,404,'NOT_FOUND','Program not found');const d=parsed.data;const r=await pool.query(`INSERT INTO network_evaluation_criteria(id,program_id,name,description,max_score,position,required) VALUES(gen_random_uuid(),$1,$2,$3,$4,(SELECT COALESCE(MAX(position)+1,0) FROM network_evaluation_criteria WHERE program_id=$1),$5) RETURNING *`,[req.params.programId,d.name,d.description??null,d.maxScore,d.required??true]);return res.status(201).json({success:true,data:{criterion:r.rows[0]}}); }
  async evaluate(req: Request,res: Response) { const userId=actor(req);const parsed=evaluationInput.safeParse(req.body);if(!userId)return fail(res,401,'UNAUTHORIZED','Authentication required');if(!parsed.success)return fail(res,400,'VALIDATION_ERROR','Invalid evaluation');const grant=await pool.query(`SELECT g.network_id,g.program_id FROM network_access_grants g WHERE g.user_id=$1 AND g.resource_type='INITIATIVE' AND g.resource_id=$2 AND g.revoked_at IS NULL AND (g.expires_at IS NULL OR g.expires_at>CURRENT_TIMESTAMP) AND g.role='EVALUATOR'`,[userId,req.params.initiativeId]);if(!grant.rows[0])return fail(res,403,'FORBIDDEN','An active evaluator assignment is required');const d=parsed.data;const client=await getClient();try{await client.query('BEGIN');const e=await client.query(`INSERT INTO initiative_evaluations(id,initiative_id,program_id,evaluator_id,recommendation,comments,conflict_declared,conflict_details,submitted_at) VALUES(gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,CURRENT_TIMESTAMP) ON CONFLICT(initiative_id,evaluator_id) DO UPDATE SET recommendation=EXCLUDED.recommendation,comments=EXCLUDED.comments,conflict_declared=EXCLUDED.conflict_declared,conflict_details=EXCLUDED.conflict_details,submitted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP RETURNING id`,[req.params.initiativeId,grant.rows[0].program_id,userId,d.recommendation??null,d.comments??null,d.conflictDeclared,d.conflictDetails??null]);for(const score of d.scores)await client.query(`INSERT INTO initiative_evaluation_scores(evaluation_id,criterion_id,score,comment) VALUES($1,$2,$3,$4) ON CONFLICT(evaluation_id,criterion_id) DO UPDATE SET score=EXCLUDED.score,comment=EXCLUDED.comment`,[e.rows[0].id,score.criterionId,score.score,score.comment??null]);await client.query('COMMIT');await record(grant.rows[0].network_id,userId,'INITIATIVE',req.params.initiativeId,'EVALUATED',{conflictDeclared:d.conflictDeclared});return res.json({success:true,data:{evaluationId:e.rows[0].id}});}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();} }
  async reports(req: Request,res: Response) { const userId=actor(req);if(!userId)return fail(res,401,'UNAUTHORIZED','Authentication required');const gate=await networkRole(req.params.id,userId);if(!gate)return fail(res,404,'NOT_FOUND','Network not found');if(!gate.isAdmin)return fail(res,403,'FORBIDDEN','Network administration is required');const [programs,roles,impact]=await Promise.all([pool.query(`SELECT np.id,np.name,np.type,np.status,COUNT(i.id)::int AS initiatives,COUNT(p.id)::int AS converted_projects FROM network_programs np LEFT JOIN initiatives i ON i.network_program_id=np.id LEFT JOIN projects p ON p.source_initiative_id=i.id WHERE np.network_id=$1 GROUP BY np.id`,[req.params.id]),pool.query(`SELECT role,COUNT(DISTINCT user_id)::int AS people FROM network_access_grants WHERE network_id=$1 AND revoked_at IS NULL GROUP BY role`,[req.params.id]),pool.query(`SELECT COUNT(*) FILTER(WHERE action='EVALUATED')::int AS evaluations,COUNT(*) FILTER(WHERE action='REVOKED')::int AS revocations,COUNT(*) FILTER(WHERE action='GRANTED')::int AS grants FROM network_access_audits WHERE network_id=$1`,[req.params.id])]);return res.json({success:true,data:{programs:programs.rows,participation:roles.rows,impact:impact.rows[0]}}); }
}
export const networkController = new NetworkController();
