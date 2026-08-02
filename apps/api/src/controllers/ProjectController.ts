// apps/api/src/controllers/ProjectController.ts

import { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../lib/db';
import { eventStore } from '../services/EventStoreService';
import { activityLogService } from '../services/ActivityLogService';
import { notificationService } from '../services/NotificationService';

// ── Schemas ───────────────────────────────────────────────────────────────────

const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  icon: z.string().max(100).optional(),
  color: z.string().max(50).optional(),
  status: z.enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED']).optional(),
  maturityStage: z.enum(['IDEA', 'DRAFT', 'FORMALIZED', 'PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED']).optional(),
  problemStatement: z.string().max(4000).optional(),
  nextStep: z.string().max(1000).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  boardIds: z.array(z.string().uuid()).optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional().nullable(),
  icon: z.string().max(100).optional().nullable(),
  color: z.string().max(50).optional().nullable(),
  status: z.enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED']).optional(),
  maturityStage: z.enum(['IDEA', 'DRAFT', 'FORMALIZED', 'PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED']).optional(),
  problemStatement: z.string().max(4000).optional().nullable(),
  nextStep: z.string().max(1000).optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

const addBoardSchema = z.object({
  boardId: z.string().uuid(),
});

const createMilestoneSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  date: z.string(),
  color: z.string().max(50).optional(),
});

const updateMilestoneSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional().nullable(),
  date: z.string().optional(),
  status: z.enum(['PENDING', 'REACHED', 'MISSED']).optional(),
  color: z.string().max(50).optional().nullable(),
});

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtProject(row: any) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    color: row.color,
    status: row.status,
    maturityStage: row.maturity_stage ?? 'IDEA',
    problemStatement: row.problem_statement,
    nextStep: row.next_step,
    startDate: row.start_date ? new Date(row.start_date).toISOString() : null,
    endDate: row.end_date ? new Date(row.end_date).toISOString() : null,
    formalizedAt: row.formalized_at ? new Date(row.formalized_at).toISOString() : null,
    appliedStandardId: row.applied_standard_id,
    appliedStandardVersion: row.applied_standard_version,
    standardAppliedAt: row.standard_applied_at ? new Date(row.standard_applied_at).toISOString() : null,
    ownerId: row.owner_id,
    ownerName: row.owner_name ?? null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function fmtMilestone(row: any) {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    description: row.description,
    date: new Date(row.date).toISOString(),
    status: row.status,
    color: row.color,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function fmtBoard(row: any) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    description: row.description,
    color: row.color,
    position: row.position,
    archived: row.archived,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

// ── Stats ─────────────────────────────────────────────────────────────────────

async function computeStats(projectId: string) {
  const now = new Date();

  const documentCountResult = await pool.query(
    `SELECT COUNT(*) AS total FROM documents WHERE project_id = $1`,
    [projectId]
  );
  const totalDocuments = parseInt(documentCountResult.rows[0]?.total ?? '0', 10);

  // Boards asignados al proyecto
  const boardsResult = await pool.query(
    `SELECT b.id FROM boards b
     JOIN project_boards pb ON pb.board_id = b.id
     WHERE pb.project_id = $1 AND b.archived = false`,
    [projectId]
  );
  const boardIds: string[] = boardsResult.rows.map((r: any) => r.id);

  if (boardIds.length === 0) {
    return { totalBoards: 0, totalCards: 0, completedCards: 0, overdueCards: 0, totalDocuments, progressPercent: 0, healthScore: 100, bottleneckBoardId: null, bottleneckBoardName: null };
  }

  const ph = boardIds.map((_, i) => `$${i + 1}`).join(', ');

  const cardStats = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE TRUE)                                       AS total,
       COUNT(*) FILTER (WHERE c.completed = true)                         AS completed,
       COUNT(*) FILTER (WHERE c.completed = false AND c.due_date < $${boardIds.length + 1}) AS overdue
     FROM cards c
     JOIN lists l ON l.id = c.list_id
     WHERE l.board_id IN (${ph})`,
    [...boardIds, now]
  );
  const cs = cardStats.rows[0];
  const totalCards     = parseInt(cs.total, 10);
  const completedCards = parseInt(cs.completed, 10);
  const overdueCards   = parseInt(cs.overdue, 10);

  // Milestones
  const msResult = await pool.query(`SELECT status FROM project_milestones WHERE project_id = $1`, [projectId]);
  const totalMilestones  = msResult.rows.length;
  const missedMilestones = msResult.rows.filter((m: any) => m.status === 'MISSED').length;

  // Board bloqueante
  let bottleneckBoardId: string | null = null;
  let bottleneckBoardName: string | null = null;

  if (boardIds.length > 1) {
    const btResult = await pool.query(
      `SELECT l.board_id,
              COUNT(*) FILTER (WHERE c.completed = false AND c.due_date < $${boardIds.length + 1}) AS overdue,
              COUNT(*) FILTER (WHERE c.completed = false) AS active
       FROM cards c
       JOIN lists l ON l.id = c.list_id
       WHERE l.board_id IN (${ph})
       GROUP BY l.board_id`,
      [...boardIds, now]
    );
    let maxRatio = 0.2;
    for (const row of btResult.rows) {
      const active = parseInt(row.active, 10);
      const overdue = parseInt(row.overdue, 10);
      const ratio = active > 0 ? overdue / active : 0;
      if (ratio > maxRatio) {
        maxRatio = ratio;
        bottleneckBoardId = row.board_id;
      }
    }
    if (bottleneckBoardId) {
      const nameResult = await pool.query(`SELECT name FROM boards WHERE id = $1`, [bottleneckBoardId]);
      bottleneckBoardName = nameResult.rows[0]?.name ?? null;
    }
  }

  const progressPercent = totalCards > 0 ? Math.round((completedCards / totalCards) * 100) : 0;
  let healthScore = 100;
  if (totalCards > 0) healthScore -= Math.round((overdueCards / totalCards) * 50);
  if (totalMilestones > 0) healthScore -= Math.round((missedMilestones / totalMilestones) * 50);
  // Only drop to "critical" (<40) if there are BOTH overdue cards AND missed milestones
  if (missedMilestones === 0) healthScore = Math.max(healthScore, 40);
  healthScore = Math.max(0, healthScore);

  return { totalBoards: boardIds.length, totalCards, completedCards, overdueCards, totalDocuments, progressPercent, healthScore, bottleneckBoardId, bottleneckBoardName };
}

// ── Relations loader ──────────────────────────────────────────────────────────

async function loadRelations(projectId: string) {
  const [boardsResult, msResult] = await Promise.all([
    pool.query(
      `SELECT b.* FROM boards b
       JOIN project_boards pb ON pb.board_id = b.id
       WHERE pb.project_id = $1
       ORDER BY pb.added_at ASC`,
      [projectId]
    ),
    pool.query(`SELECT * FROM project_milestones WHERE project_id = $1 ORDER BY date ASC`, [projectId]),
  ]);
  return {
    boards: boardsResult.rows.map(fmtBoard),
    milestones: msResult.rows.map(fmtMilestone),
  };
}

type ChecklistItem = {
  key: 'owner' | 'problem' | 'team' | 'board' | 'milestone' | 'document' | 'nextStep';
  label: string;
  done: boolean;
};

type ProjectStandardDefinition = {
  requiredProjectFields: Array<'description' | 'problemStatement' | 'nextStep' | 'startDate' | 'endDate'>;
  requiredChecklist: Array<'owner' | 'problem' | 'team' | 'board' | 'milestone' | 'document' | 'nextStep'>;
  minimumMaturityForPlanning: 'IDEA' | 'DRAFT' | 'FORMALIZED' | 'PLANNED';
  intakeStages: Array<'IDEA' | 'DRAFT'>;
  targetLabels: {
    intake: string;
    formalized: string;
    execution: string;
  };
};

type WorkspaceProjectStandardSnapshot = {
  id: string | null;
  version: number;
  definition: ProjectStandardDefinition;
};

function getDefaultWorkspaceProjectStandardDefinition(): ProjectStandardDefinition {
  return {
    requiredProjectFields: ['problemStatement', 'nextStep'],
    requiredChecklist: ['owner', 'problem', 'team', 'board', 'milestone', 'document', 'nextStep'],
    minimumMaturityForPlanning: 'FORMALIZED',
    intakeStages: ['IDEA', 'DRAFT'],
    targetLabels: {
      intake: 'Intake',
      formalized: 'Formalizado',
      execution: 'Operacion',
    },
  };
}

async function getWorkspaceProjectStandard(workspaceId: string): Promise<WorkspaceProjectStandardSnapshot> {
  const result = await pool.query(
    `SELECT id, version, definition_json
     FROM workspace_project_standards
     WHERE workspace_id = $1 AND is_active = true
     ORDER BY version DESC, updated_at DESC
     LIMIT 1`,
    [workspaceId]
  );

  if (!result.rows.length?.valueOf()) {
    return {
      id: null,
      version: 1,
      definition: getDefaultWorkspaceProjectStandardDefinition(),
    };
  }

  return {
    id: result.rows[0].id,
    version: result.rows[0].version ?? 1,
    definition: {
      ...getDefaultWorkspaceProjectStandardDefinition(),
      ...(result.rows[0].definition_json ?? {}),
    },
  };
}

async function getProjectStructureState(projectId: string, relations?: { boards: any[]; milestones: any[] }) {
  const rel = relations ?? await loadRelations(projectId);
  const countsResult = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM project_members WHERE project_id = $1) AS direct_members,
       (SELECT COUNT(*)::int FROM project_teams WHERE project_id = $1)   AS teams,
       (SELECT COUNT(*)::int FROM documents WHERE project_id = $1)       AS documents`,
    [projectId]
  );
  const counts = countsResult.rows[0] ?? { direct_members: 0, teams: 0 };
  const teamCount = Number(counts.direct_members ?? 0) + Number(counts.teams ?? 0);

  return {
    rel,
    teamCount,
    documentCount: Number(counts.documents ?? 0),
  };
}

const checklistLabels: Record<ChecklistItem['key'], string> = {
  document: 'Documento base o evidencia',
  owner: 'Responsable definido',
  problem: 'Problema u oportunidad',
  team: 'Equipo o miembros asignados',
  board: 'Tablero de ejecución',
  milestone: 'Hito próximo declarado',
  nextStep: 'Siguiente paso explícito',
};

const coverageFieldLabels: Record<ProjectStandardDefinition['requiredProjectFields'][number], string> = {
  description: 'Descripción general',
  problemStatement: 'Problema u oportunidad',
  nextStep: 'Siguiente paso',
  startDate: 'Fecha de inicio',
  endDate: 'Fecha de cierre',
};

async function computeFormalization(
  projectRow: any,
  relations?: { boards: any[]; milestones: any[] },
  standard?: ProjectStandardDefinition,
) {
  const activeStandard = standard ?? (await getWorkspaceProjectStandard(projectRow.workspace_id)).definition;
  const { rel, teamCount, documentCount } = await getProjectStructureState(projectRow.id, relations);
  const hasTeam = teamCount > 0;

  const checklist: ChecklistItem[] = activeStandard.requiredChecklist.map((key) => ({
    key,
    label: checklistLabels[key],
    done:
      key === 'owner' ? Boolean(projectRow.owner_id) :
      key === 'problem' ? Boolean(projectRow.problem_statement?.trim()) :
      key === 'team' ? hasTeam :
      key === 'board' ? rel.boards.length > 0 :
      key === 'milestone' ? rel.milestones.length > 0 :
      key === 'document' ? documentCount > 0 :
      Boolean(projectRow.next_step?.trim()),
  }));

  const completed = checklist.filter((item) => item.done).length;
  const required = checklist.length;
  const completionPercent = required > 0 ? Math.round((completed / required) * 100) : 100;
  const readyToFormalize = checklist.every((item) => item.done);

  return {
    checklist,
    completed,
    required,
    completionPercent,
    readyToFormalize,
    isFormalized: Boolean(projectRow.formalized_at) || readyToFormalize,
  };
}

async function computeCoverage(
  projectRow: any,
  relations?: { boards: any[]; milestones: any[] },
  standard?: ProjectStandardDefinition,
) {
  const activeStandard = standard ?? (await getWorkspaceProjectStandard(projectRow.workspace_id)).definition;
  const { rel, teamCount, documentCount } = await getProjectStructureState(projectRow.id, relations);

  const requiredFieldEntries = activeStandard.requiredProjectFields.map((key) => ({
    key,
    label: coverageFieldLabels[key],
    state:
      key === 'description' ? (projectRow.description?.trim() ? 'APPLIES_FILLED' : 'APPLIES_EMPTY') :
      key === 'problemStatement' ? (projectRow.problem_statement?.trim() ? 'APPLIES_FILLED' : 'APPLIES_EMPTY') :
      key === 'nextStep' ? (projectRow.next_step?.trim() ? 'APPLIES_FILLED' : 'APPLIES_EMPTY') :
      key === 'startDate' ? (projectRow.start_date ? 'APPLIES_FILLED' : 'APPLIES_EMPTY') :
      (projectRow.end_date ? 'APPLIES_FILLED' : 'APPLIES_EMPTY'),
  }));

  const structuralFieldEntries = activeStandard.requiredChecklist
    .filter((key) => !['problem', 'nextStep'].includes(key))
    .map((key) => ({
      key,
      label: checklistLabels[key],
      state:
        key === 'owner' ? (projectRow.owner_id ? 'APPLIES_FILLED' : 'APPLIES_EMPTY') :
        key === 'team' ? (teamCount > 0 ? 'APPLIES_FILLED' : 'APPLIES_EMPTY') :
        key === 'board' ? (rel.boards.length > 0 ? 'APPLIES_FILLED' : 'APPLIES_EMPTY') :
        key === 'milestone' ? (rel.milestones.length > 0 ? 'APPLIES_FILLED' : 'APPLIES_EMPTY') :
        key === 'document' ? (documentCount > 0 ? 'APPLIES_FILLED' : 'APPLIES_EMPTY') :
        'APPLIES_EMPTY',
    }));

  const fields = [...requiredFieldEntries, ...structuralFieldEntries];

  const filled = fields.filter((field) => field.state === 'APPLIES_FILLED').length;

  return {
    fields,
    filled,
    total: fields.length,
    coveragePercent: fields.length > 0 ? Math.round((filled / fields.length) * 100) : 100,
  };
}

async function hydrateProject(projectRow: any, relations?: { boards: any[]; milestones: any[] }) {
  const rel = relations ?? await loadRelations(projectRow.id);
  const standard = await getWorkspaceProjectStandard(projectRow.workspace_id);
  const [formalization, coverage] = await Promise.all([
    computeFormalization(projectRow, rel, standard.definition),
    computeCoverage(projectRow, rel, standard.definition),
  ]);

  return {
    ...fmtProject(projectRow),
    ...rel,
    formalization,
    coverage,
  };
}

/** Devuelve todos los user_ids únicos del proyecto (dueño + miembros directos + miembros de equipos) */
async function getProjectMemberIds(projectId: string, excludeUserId?: string): Promise<string[]> {
  const result = await pool.query(
    `SELECT DISTINCT u_id FROM (
       SELECT owner_id   AS u_id FROM projects       WHERE id = $1
       UNION
       SELECT user_id    AS u_id FROM project_members WHERE project_id = $1
       UNION
       SELECT tm.user_id AS u_id FROM team_members tm
         JOIN project_teams pt ON pt.team_id = tm.team_id WHERE pt.project_id = $1
     ) sub
     WHERE u_id != $2`,
    [projectId, excludeUserId ?? '00000000-0000-0000-0000-000000000000']
  );
  return result.rows.map((r: any) => r.u_id as string);
}

// ── Controller ────────────────────────────────────────────────────────────────

class ProjectController {
  /** GET /api/workspaces/:wsId/projects */
  async listByWorkspace(req: Request, res: Response) {
    try {
      const { wsId } = req.params;
      const result = await pool.query(
        `SELECT p.*,
          MAX(owner.name) AS owner_name,
          COALESCE(
            ROUND(100.0 * SUM(CASE WHEN c.completed THEN 1 ELSE 0 END)
                  / NULLIF(COUNT(c.id), 0))
          , 0)::int AS progress_percent,
          COALESCE(
            array_agg(
              DISTINCT jsonb_build_object('id', b.id, 'name', b.name, 'color', b.color)
            ) FILTER (WHERE b.id IS NOT NULL),
            ARRAY[]::jsonb[]
          ) AS boards
         FROM projects p
         LEFT JOIN users owner ON owner.id = p.owner_id
         LEFT JOIN project_boards pb ON pb.project_id = p.id
         LEFT JOIN boards b ON b.id = pb.board_id AND b.archived = false
         LEFT JOIN lists l ON l.board_id = b.id
         LEFT JOIN cards c ON c.list_id = l.id
         WHERE p.workspace_id = $1 AND p.status != 'ARCHIVED'
         GROUP BY p.id
         ORDER BY p.updated_at DESC`,
        [wsId]
      );
      const projects = await Promise.all(result.rows.map(async (row) => {
        const relations = {
          boards: row.boards ?? [],
          milestones: await pool.query(`SELECT * FROM project_milestones WHERE project_id = $1 ORDER BY date ASC`, [row.id])
            .then((ms) => ms.rows.map(fmtMilestone)),
        };

        return {
          ...(await hydrateProject(row, relations)),
          progressPercent: row.progress_percent ?? 0,
          boards: row.boards ?? [],
        };
      }));
      res.json({ success: true, data: { projects } });
    } catch (error) {
      console.error('[ProjectController.listByWorkspace]', error);
      res.status(500).json({ success: false, error: { message: 'Error al obtener proyectos' } });
    }
  }

  /** GET /api/projects — todos los proyectos del usuario (cross-workspace, para sidebar) */
  async list(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const result = await pool.query(
        `SELECT DISTINCT p.*
         FROM projects p
         JOIN workspace_members wm ON wm.workspace_id = p.workspace_id AND wm.user_id = $1
         WHERE p.status IN ('PLANNING', 'ACTIVE', 'ON_HOLD')
         ORDER BY p.updated_at DESC`,
        [userId]
      );
      const projects = result.rows.map(fmtProject);
      res.json({ success: true, data: { projects } });
    } catch (error) {
      console.error('[ProjectController.list]', error);
      res.status(500).json({ success: false, error: { message: 'Error al obtener proyectos' } });
    }
  }

  /** POST /api/workspaces/:wsId/projects */
  async create(req: Request, res: Response) {
    try {
      const { wsId } = req.params;
      const userId = (req as any).user.id;
      const body = createProjectSchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ success: false, error: { message: 'Datos inválidos', details: body.error.flatten() } });
      }
      const { boardIds = [], ...data } = body.data;
      const workspaceStandard = await getWorkspaceProjectStandard(wsId);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query(
          `INSERT INTO projects (
             id, workspace_id, name, description, icon, color, status, maturity_stage,
             problem_statement, next_step, start_date, end_date, owner_id,
             applied_standard_id, applied_standard_version, standard_applied_at, updated_at
           )
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           RETURNING *`,
          [wsId, data.name, data.description ?? null, data.icon ?? null, data.color ?? null,
           data.status ?? 'PLANNING', data.maturityStage ?? 'IDEA', data.problemStatement ?? null,
           data.nextStep ?? null, data.startDate ?? null, data.endDate ?? null, userId,
           workspaceStandard.id, workspaceStandard.version]
        );
        const project = result.rows[0];
        for (const bId of boardIds) {
          await client.query(
            `INSERT INTO project_boards (id, project_id, board_id) VALUES (gen_random_uuid(), $1, $2) ON CONFLICT DO NOTHING`,
            [project.id, bId]
          );
        }
        await client.query('COMMIT');
        const relations = await loadRelations(project.id);
        try {
          const actorInfo = await pool.query('SELECT name FROM users WHERE id = $1', [userId]);
          const actorName = actorInfo.rows[0]?.name ?? '';
          await eventStore.emit({
            type: 'project.created',
            actor: { id: userId, name: actorName },
            subject: { type: 'project', id: project.id, name: project.name },
            context: { workspaceId: wsId },
          } as any);
        } catch {}
        res.status(201).json({ success: true, data: { project: await hydrateProject(project, relations) } });
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('[ProjectController.create]', error);
      res.status(500).json({ success: false, error: { message: 'Error al crear proyecto' } });
    }
  }

  /** GET /api/projects/:id */
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await pool.query(`SELECT * FROM projects WHERE id = $1`, [id]);
      if (!result.rows.length) return res.status(404).json({ success: false, error: { message: 'Proyecto no encontrado' } });
      const relations = await loadRelations(id);
      res.json({ success: true, data: { project: await hydrateProject(result.rows[0], relations) } });
    } catch (error) {
      console.error('[ProjectController.getById]', error);
      res.status(500).json({ success: false, error: { message: 'Error al obtener proyecto' } });
    }
  }

  /** PUT /api/projects/:id */
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const body = updateProjectSchema.safeParse(req.body);
      if (!body.success) return res.status(400).json({ success: false, error: { message: 'Datos inválidos' } });
      const data = body.data;
      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;
      if (data.name        !== undefined) { fields.push(`name = $${idx++}`);        values.push(data.name); }
      if (data.description !== undefined) { fields.push(`description = $${idx++}`); values.push(data.description); }
      if (data.icon        !== undefined) { fields.push(`icon = $${idx++}`);        values.push(data.icon); }
      if (data.color       !== undefined) { fields.push(`color = $${idx++}`);       values.push(data.color); }
      if (data.status      !== undefined) { fields.push(`status = $${idx++}`);      values.push(data.status); }
      if (data.maturityStage !== undefined) { fields.push(`maturity_stage = $${idx++}`); values.push(data.maturityStage); }
      if (data.problemStatement !== undefined) { fields.push(`problem_statement = $${idx++}`); values.push(data.problemStatement); }
      if (data.nextStep !== undefined) { fields.push(`next_step = $${idx++}`); values.push(data.nextStep); }
      if (data.startDate   !== undefined) { fields.push(`start_date = $${idx++}`);  values.push(data.startDate); }
      if (data.endDate     !== undefined) { fields.push(`end_date = $${idx++}`);    values.push(data.endDate); }
      if (!fields.length) return res.status(400).json({ success: false, error: { message: 'Sin campos' } });
      // Get old project for event metadata
      const oldProject = await pool.query(`SELECT name, status, workspace_id FROM projects WHERE id = $1`, [id]);
      const currentProjectResult = await pool.query(`SELECT * FROM projects WHERE id = $1`, [id]);
      if (!currentProjectResult.rows.length) return res.status(404).json({ success: false, error: { message: 'Proyecto no encontrado' } });
      const currentProject = currentProjectResult.rows[0];
      const mergedProject = {
        ...currentProject,
        name: data.name !== undefined ? data.name : currentProject.name,
        description: data.description !== undefined ? data.description : currentProject.description,
        icon: data.icon !== undefined ? data.icon : currentProject.icon,
        color: data.color !== undefined ? data.color : currentProject.color,
        status: data.status !== undefined ? data.status : currentProject.status,
        maturity_stage: data.maturityStage !== undefined ? data.maturityStage : currentProject.maturity_stage,
        problem_statement: data.problemStatement !== undefined ? data.problemStatement : currentProject.problem_statement,
        next_step: data.nextStep !== undefined ? data.nextStep : currentProject.next_step,
        start_date: data.startDate !== undefined ? data.startDate : currentProject.start_date,
        end_date: data.endDate !== undefined ? data.endDate : currentProject.end_date,
      };
      const predictedRelations = await loadRelations(id);
      const standard = await getWorkspaceProjectStandard(currentProject.workspace_id);
      const predictedFormalization = await computeFormalization(mergedProject, predictedRelations, standard.definition);
      if (predictedFormalization.readyToFormalize && !currentProject.formalized_at) {
        fields.push(`formalized_at = COALESCE(formalized_at, CURRENT_TIMESTAMP)`);
      }
      fields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);
      const result = await pool.query(`UPDATE projects SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
      if (!result.rows.length) return res.status(404).json({ success: false, error: { message: 'Proyecto no encontrado' } });
      const relations = await loadRelations(id);
      try {
        const updated = result.rows[0];
        const wsId = updated.workspace_id;
        const oldStatus = oldProject.rows[0]?.status;
        const actorId = (req as any).user?.id as string;
        const actorInfo = await pool.query('SELECT name FROM users WHERE id = $1', [actorId]);
        const actorName = actorInfo.rows[0]?.name ?? '';
        const statusChanged = oldStatus && data.status && oldStatus !== data.status;
        if (statusChanged) {
          await eventStore.emit({
            type: 'project.status.changed',
            actor: { id: actorId, name: actorName },
            subject: { type: 'project', id, name: updated.name },
            context: { workspaceId: wsId },
            payload: { name: updated.name, projectName: updated.name, oldStatus, newStatus: data.status },
            delta: { before: { status: oldStatus }, after: { status: data.status } },
          } as any);
          // Notify project members about status change (skip PLANNING/ACTIVE — low signal)
          if (data.status === 'ON_HOLD' || data.status === 'COMPLETED' || data.status === 'ARCHIVED') {
            const memberIds = await getProjectMemberIds(id, actorId);
            await Promise.all(memberIds.map((uid) =>
              notificationService.createProjectStatusChangedNotification({
                targetUserId: uid,
                actorId,
                actorName,
                projectId: id,
                projectName: updated.name,
                oldStatus,
                newStatus: data.status!,
                workspaceId: wsId,
              }).catch(() => {})
            ));
          }
        } else {
          await eventStore.emit({
            type: 'project.updated',
            actor: { id: actorId, name: actorName },
            subject: { type: 'project', id, name: updated.name },
            context: { workspaceId: wsId },
            payload: { name: updated.name, projectName: updated.name },
          } as any);
        }
      } catch {}
      res.json({ success: true, data: { project: await hydrateProject(result.rows[0], relations) } });
    } catch (error) {
      console.error('[ProjectController.update]', error);
      res.status(500).json({ success: false, error: { message: 'Error al actualizar' } });
    }
  }

  /** POST /api/projects/:id/adopt-current-standard */
  async adoptCurrentStandard(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const currentProjectResult = await pool.query(`SELECT * FROM projects WHERE id = $1`, [id]);
      if (!currentProjectResult.rows.length) {
        return res.status(404).json({ success: false, error: { message: 'Proyecto no encontrado' } });
      }

      const currentProject = currentProjectResult.rows[0];
      const workspaceStandard = await getWorkspaceProjectStandard(currentProject.workspace_id);

      const result = await pool.query(
        `UPDATE projects
         SET applied_standard_id = $1,
             applied_standard_version = $2,
             standard_applied_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING *`,
        [workspaceStandard.id, workspaceStandard.version, id]
      );

      const relations = await loadRelations(id);
      return res.json({ success: true, data: { project: await hydrateProject(result.rows[0], relations) } });
    } catch (error) {
      console.error('[ProjectController.adoptCurrentStandard]', error);
      return res.status(500).json({ success: false, error: { message: 'Error al adoptar estándar actual' } });
    }
  }

  /** DELETE /api/projects/:id */
  async delete(req: Request, res: Response) {
    try {
      // Get project info before deleting
      const projectInfo = await pool.query(`SELECT name, workspace_id FROM projects WHERE id = $1`, [req.params.id]);
      const projectName = projectInfo.rows[0]?.name;
      const wsId = projectInfo.rows[0]?.workspace_id;
      await pool.query(`DELETE FROM projects WHERE id = $1`, [req.params.id]);
      try {
        if (wsId) {
          const actorId = (req as any).user?.id as string;
          const actorInfo = await pool.query('SELECT name FROM users WHERE id = $1', [actorId]);
          const actorName = actorInfo.rows[0]?.name ?? '';
          await eventStore.emit({
            type: 'project.deleted',
            actor: { id: actorId, name: actorName },
            subject: { type: 'project', id: req.params.id, name: projectName ?? '' },
            context: { workspaceId: wsId },
          } as any);
        }
      } catch {}
      res.json({ success: true, data: null });
    } catch (error) {
      console.error('[ProjectController.delete]', error);
      res.status(500).json({ success: false, error: { message: 'Error al eliminar' } });
    }
  }

  /** GET /api/projects/:id/stats */
  async getStats(req: Request, res: Response) {
    try {
      const stats = await computeStats(req.params.id);
      res.json({ success: true, data: { stats } });
    } catch (error) {
      console.error('[ProjectController.getStats]', error);
      res.status(500).json({ success: false, error: { message: 'Error al calcular stats' } });
    }
  }

  /** POST /api/projects/:id/boards */
  async addBoard(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const body = addBoardSchema.safeParse(req.body);
      if (!body.success) return res.status(400).json({ success: false, error: { message: 'boardId inválido' } });
      const boardResult = await pool.query(
        `SELECT b.*
         FROM boards b
         JOIN projects p ON p.id = $1 AND p.workspace_id = b.workspace_id
         WHERE b.id = $2`,
        [id, body.data.boardId]
      );
      if (boardResult.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'Board no encontrado en el espacio de trabajo del proyecto' } });
      }
      await pool.query(
        `INSERT INTO project_boards (id, project_id, board_id) VALUES (gen_random_uuid(), $1, $2) ON CONFLICT DO NOTHING`,
        [id, body.data.boardId]
      );
      // Get project info for event
      const projectInfo = await pool.query(`SELECT name, workspace_id FROM projects WHERE id = $1`, [id]);
      const projectName = projectInfo.rows[0]?.name;
      const wsId = projectInfo.rows[0]?.workspace_id;
      const boardName = boardResult.rows[0]?.name ?? '';
      try {
        const actorId = (req as any).user?.id as string;
        const actorInfo = await pool.query('SELECT name FROM users WHERE id = $1', [actorId]);
        const actorName = actorInfo.rows[0]?.name ?? '';
        await eventStore.emit({
          type: 'project.board.linked',
          actor: { id: actorId, name: actorName },
          subject: { type: 'project', id, name: projectName ?? '' },
          context: { workspaceId: wsId, boardId: body.data.boardId },
          payload: { projectId: id, projectName, boardId: body.data.boardId, boardName },
        } as any);
      } catch {}
      res.status(201).json({ success: true, data: { board: boardResult.rows[0] ? fmtBoard(boardResult.rows[0]) : null } });
    } catch (error) {
      console.error('[ProjectController.addBoard]', error);
      res.status(500).json({ success: false, error: { message: 'Error al añadir board' } });
    }
  }

  /** DELETE /api/projects/:id/boards/:boardId */
  async removeBoard(req: Request, res: Response) {
    try {
      // Get project info for event
      const projectInfo = await pool.query(`SELECT name, workspace_id FROM projects WHERE id = $1`, [req.params.id]);
      const projectName = projectInfo.rows[0]?.name;
      const wsId = projectInfo.rows[0]?.workspace_id;
      const boardInfo = await pool.query(`SELECT name FROM boards WHERE id = $1`, [req.params.boardId]);
      const boardName = boardInfo.rows[0]?.name ?? '';
      await pool.query(`DELETE FROM project_boards WHERE project_id = $1 AND board_id = $2`, [req.params.id, req.params.boardId]);
      try {
        if (wsId) {
          const actorId = (req as any).user?.id as string;
          const actorInfo = await pool.query('SELECT name FROM users WHERE id = $1', [actorId]);
          const actorName = actorInfo.rows[0]?.name ?? '';
          await eventStore.emit({
            type: 'project.board.unlinked',
            actor: { id: actorId, name: actorName },
            subject: { type: 'project', id: req.params.id, name: projectName ?? '' },
            context: { workspaceId: wsId, boardId: req.params.boardId },
            payload: { projectId: req.params.id, projectName, boardId: req.params.boardId, boardName },
          } as any);
        }
      } catch {}
      res.json({ success: true, data: null });
    } catch (error) {
      console.error('[ProjectController.removeBoard]', error);
      res.status(500).json({ success: false, error: { message: 'Error al quitar board' } });
    }
  }

  /** POST /api/projects/:id/milestones */
  async createMilestone(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const body = createMilestoneSchema.safeParse(req.body);
      if (!body.success) return res.status(400).json({ success: false, error: { message: 'Datos inválidos' } });
      const result = await pool.query(
        `INSERT INTO project_milestones (id, project_id, name, description, date, color, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, CURRENT_TIMESTAMP) RETURNING *`,
        [id, body.data.name, body.data.description ?? null, body.data.date, body.data.color ?? null]
      );
      // Get project info for event
      const projectInfo = await pool.query(`SELECT name, workspace_id FROM projects WHERE id = $1`, [id]);
      const wsId = projectInfo.rows[0]?.workspace_id;
      try {
        const actorId = (req as any).user?.id as string;
        const actorInfo = await pool.query('SELECT name FROM users WHERE id = $1', [actorId]);
        const actorName = actorInfo.rows[0]?.name ?? '';
        await eventStore.emit({
          type: 'project.milestone.created',
          actor: { id: actorId, name: actorName },
          subject: { type: 'milestone', id: result.rows[0].id, name: body.data.name },
          context: { workspaceId: wsId },
          payload: { projectId: id, milestoneDate: body.data.date },
        } as any);
      } catch {}
      res.status(201).json({ success: true, data: { milestone: fmtMilestone(result.rows[0]) } });
    } catch (error) {
      console.error('[ProjectController.createMilestone]', error);
      res.status(500).json({ success: false, error: { message: 'Error al crear milestone' } });
    }
  }

  /** PUT /api/projects/:id/milestones/:milestoneId */
  async updateMilestone(req: Request, res: Response) {
    try {
      const { milestoneId } = req.params;
      const body = updateMilestoneSchema.safeParse(req.body);
      if (!body.success) return res.status(400).json({ success: false, error: { message: 'Datos inválidos' } });
      const data = body.data;
      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;
      if (data.name        !== undefined) { fields.push(`name = $${idx++}`);        values.push(data.name); }
      if (data.description !== undefined) { fields.push(`description = $${idx++}`); values.push(data.description); }
      if (data.date        !== undefined) { fields.push(`date = $${idx++}`);        values.push(data.date); }
      if (data.status      !== undefined) { fields.push(`status = $${idx++}`);      values.push(data.status); }
      if (data.color       !== undefined) { fields.push(`color = $${idx++}`);       values.push(data.color); }
      if (!fields.length) return res.status(400).json({ success: false, error: { message: 'Sin campos' } });
      fields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(milestoneId);
      const result = await pool.query(`UPDATE project_milestones SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
      if (!result.rows.length) return res.status(404).json({ success: false, error: { message: 'Milestone no encontrado' } });
      // Get project info for milestone event
      const msInfo = await pool.query(`SELECT pm.project_id, p.name AS project_name, p.workspace_id FROM project_milestones pm JOIN projects p ON p.id = pm.project_id WHERE pm.id = $1`, [milestoneId]);
      const wsId = msInfo.rows[0]?.workspace_id;
      try {
        const actorId   = (req as any).user?.id as string;
        const actorInfo = await pool.query('SELECT name FROM users WHERE id = $1', [actorId]);
        const actorName = actorInfo.rows[0]?.name ?? '';
        const msProjId  = msInfo.rows[0]?.project_id;
        const msProjName = msInfo.rows[0]?.project_name ?? '';
        const msName     = result.rows[0]?.name ?? '';

        if (data.status === 'REACHED' && msInfo.rows[0]) {
          await eventStore.emit({
            type: 'project.milestone.completed',
            actor: { id: actorId, name: actorName },
            subject: { type: 'milestone', id: milestoneId, name: msName },
            context: { workspaceId: wsId },
            payload: { projectId: msProjId, projectName: msProjName },
          } as any);
          const memberIds = await getProjectMemberIds(msProjId, actorId);
          await Promise.all(memberIds.map((uid) =>
            notificationService.createMilestoneCompletedNotification({
              targetUserId: uid, actorId, actorName,
              projectId: msProjId, projectName: msProjName,
              milestoneId, milestoneName: msName,
              milestoneDate: result.rows[0]?.date ?? '',
              workspaceId: wsId,
            }).catch(() => {})
          ));
        } else if (data.status === 'MISSED' && msInfo.rows[0]) {
          await eventStore.emit({
            type: 'project.milestone.missed',
            actor: { id: actorId, name: actorName },
            subject: { type: 'milestone', id: milestoneId, name: msName },
            context: { workspaceId: wsId },
            payload: { projectId: msProjId, projectName: msProjName },
          } as any);
          const memberIds = await getProjectMemberIds(msProjId, actorId);
          await Promise.all(memberIds.map((uid) =>
            notificationService.createMilestoneMissedNotification({
              targetUserId: uid, actorId, actorName,
              projectId: msProjId, projectName: msProjName,
              milestoneId, milestoneName: msName,
              milestoneDate: result.rows[0]?.date ?? '',
              workspaceId: wsId,
            }).catch(() => {})
          ));
        } else if (!data.status && msInfo.rows[0]) {
          await eventStore.emit({
            type: 'project.milestone.updated',
            actor: { id: actorId, name: actorName },
            subject: { type: 'milestone', id: milestoneId, name: msName },
            context: { workspaceId: wsId },
            payload: { projectId: msProjId, projectName: msProjName },
          } as any);
        }
      } catch {}
      res.json({ success: true, data: { milestone: fmtMilestone(result.rows[0]) } });
    } catch (error) {
      console.error('[ProjectController.updateMilestone]', error);
      res.status(500).json({ success: false, error: { message: 'Error al actualizar milestone' } });
    }
  }

  /** DELETE /api/projects/:id/milestones/:milestoneId */
  async deleteMilestone(req: Request, res: Response) {
    try {
      const { milestoneId } = req.params;
      const msInfo = await pool.query(
        `SELECT pm.name, pm.project_id, p.name AS project_name, p.workspace_id
         FROM project_milestones pm JOIN projects p ON p.id = pm.project_id
         WHERE pm.id = $1`, [milestoneId]
      );
      await pool.query(`DELETE FROM project_milestones WHERE id = $1`, [milestoneId]);
      try {
        if (msInfo.rows[0]) {
          const actorId   = (req as any).user?.id as string;
          const actorInfo = await pool.query('SELECT name FROM users WHERE id = $1', [actorId]);
          await eventStore.emit({
            type: 'project.milestone.deleted',
            actor: { id: actorId, name: actorInfo.rows[0]?.name ?? '' },
            subject: { type: 'milestone', id: milestoneId, name: msInfo.rows[0].name },
            context: { workspaceId: msInfo.rows[0].workspace_id },
            payload: { projectId: msInfo.rows[0].project_id, projectName: msInfo.rows[0].project_name },
          } as any);
        }
      } catch {}
      res.json({ success: true, data: null });
    } catch (error) {
      console.error('[ProjectController.deleteMilestone]', error);
      res.status(500).json({ success: false, error: { message: 'Error al eliminar milestone' } });
    }
  }

  // ── Teams ─────────────────────────────────────────────────────────────────

  /** GET /api/projects/:id/teams */
  async getTeams(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await pool.query(
        `SELECT t.id, t.name, t.color, t.icon, t.description,
                pt.assigned_at,
                COUNT(tm.id)::int AS member_count,
                u.name AS lead_name, u.avatar AS lead_avatar
         FROM project_teams pt
         JOIN teams t ON t.id = pt.team_id
         LEFT JOIN team_members tm ON tm.team_id = t.id
         LEFT JOIN users u ON u.id = t.lead_id
         WHERE pt.project_id = $1
         GROUP BY t.id, t.name, t.color, t.icon, t.description, pt.assigned_at, u.name, u.avatar
         ORDER BY pt.assigned_at ASC`,
        [id]
      );
      const teams = result.rows.map((r) => ({
        id:          r.id,
        name:        r.name,
        color:       r.color,
        icon:        r.icon,
        description: r.description,
        assignedAt:  new Date(r.assigned_at).toISOString(),
        memberCount: r.member_count,
        leadName:    r.lead_name ?? null,
        leadAvatar:  r.lead_avatar ?? null,
      }));
      res.json({ success: true, data: { teams } });
    } catch (error) {
      console.error('[ProjectController.getTeams]', error);
      res.status(500).json({ success: false, error: { message: 'Error al obtener equipos del proyecto' } });
    }
  }

  /** GET /api/projects/:id/timeline-cards */
  async getTimelineCards(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      const access = await pool.query(
        `SELECT p.id FROM projects p
         JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
         WHERE p.id = $1 AND wm.user_id = $2`,
        [id, userId]
      );
      if (!access.rows.length) return res.status(404).json({ success: false });

      const result = await pool.query(
        `SELECT c.id, c.title, c.due_date, c.start_date, c.priority, c.completed,
                c.buffer_days, b.id AS board_id, b.name AS board_name, l.name AS list_name
         FROM cards c
         JOIN lists l ON l.id = c.list_id
         JOIN boards b ON b.id = l.board_id
         JOIN project_boards pb ON pb.board_id = b.id
         WHERE pb.project_id = $1
           AND (c.due_date IS NOT NULL OR c.start_date IS NOT NULL)
         ORDER BY c.due_date ASC NULLS LAST, b.position ASC`,
        [id]
      );

      const cards = result.rows.map((r: any) => ({
        id:         r.id,
        title:      r.title,
        dueDate:    r.due_date   ? new Date(r.due_date).toISOString()   : null,
        startDate:  r.start_date ? new Date(r.start_date).toISOString() : null,
        priority:   r.priority,
        completed:  r.completed,
        bufferDays: r.buffer_days ?? null,
        boardId:    r.board_id,
        boardName:  r.board_name,
        listName:   r.list_name,
      }));

      return res.json({ success: true, data: { cards } });
    } catch (error) {
      console.error('[ProjectController.getTimelineCards]', error);
      return res.status(500).json({ success: false });
    }
  }

  /** POST /api/projects/:id/teams  body: { teamId } */
  async assignTeam(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;
      const { teamId } = req.body;
      if (!teamId) return res.status(400).json({ success: false, error: { message: 'teamId requerido' } });

      const teamExists = await pool.query(
        `SELECT 1 FROM teams t
         JOIN projects p ON p.id = $1 AND p.workspace_id = t.workspace_id
         WHERE t.id = $2`,
        [id, teamId]
      );
      if (!teamExists.rowCount) {
        return res.status(404).json({ success: false, error: { message: 'Equipo no encontrado en el espacio de trabajo del proyecto' } });
      }

      await pool.query(
        `INSERT INTO project_teams (project_id, team_id, assigned_by)
         VALUES ($1, $2, $3)
         ON CONFLICT (project_id, team_id) DO NOTHING`,
        [id, teamId, userId]
      );

      // Grant workspace access to all current team members
      await pool.query(
        `INSERT INTO workspace_members (workspace_id, user_id, role)
         SELECT p.workspace_id, tm.user_id, 'MEMBER'
         FROM projects p
         JOIN team_members tm ON tm.team_id = $2
         WHERE p.id = $1
         ON CONFLICT (workspace_id, user_id) DO NOTHING`,
        [id, teamId]
      );

      try {
        const info = await pool.query(
          `SELECT p.name AS project_name, p.workspace_id, t.name AS team_name
           FROM projects p, teams t WHERE p.id = $1 AND t.id = $2`, [id, teamId]
        );
        const actorInfo = await pool.query('SELECT name FROM users WHERE id = $1', [userId]);
        if (info.rows[0]) {
          await eventStore.emit({
            type: 'project.team.assigned',
            actor: { id: userId, name: actorInfo.rows[0]?.name ?? '' },
            subject: { type: 'project', id, name: info.rows[0].project_name },
            context: { workspaceId: info.rows[0].workspace_id },
            payload: { projectId: id, projectName: info.rows[0].project_name, teamId, teamName: info.rows[0].team_name },
          } as any);
        }
      } catch {}
      res.status(201).json({ success: true, data: null });
    } catch (error) {
      console.error('[ProjectController.assignTeam]', error);
      res.status(500).json({ success: false, error: { message: 'Error al asignar equipo' } });
    }
  }

  /** DELETE /api/projects/:id/teams/:teamId */
  async removeTeam(req: Request, res: Response) {
    try {
      const { id, teamId } = req.params;
      const info = await pool.query(
        `SELECT p.name AS project_name, p.workspace_id, t.name AS team_name
         FROM projects p, teams t WHERE p.id = $1 AND t.id = $2`, [id, teamId]
      );
      await pool.query(
        `DELETE FROM project_teams WHERE project_id = $1 AND team_id = $2`,
        [id, teamId]
      );
      try {
        const actorId   = (req as any).user?.id as string;
        const actorInfo = await pool.query('SELECT name FROM users WHERE id = $1', [actorId]);
        if (info.rows[0]) {
          await eventStore.emit({
            type: 'project.team.removed',
            actor: { id: actorId, name: actorInfo.rows[0]?.name ?? '' },
            subject: { type: 'project', id, name: info.rows[0].project_name },
            context: { workspaceId: info.rows[0].workspace_id },
            payload: { projectId: id, projectName: info.rows[0].project_name, teamId, teamName: info.rows[0].team_name },
          } as any);
        }
      } catch {}
      res.json({ success: true, data: null });
    } catch (error) {
      console.error('[ProjectController.removeTeam]', error);
      res.status(500).json({ success: false, error: { message: 'Error al quitar equipo' } });
    }
  }

  // ── Direct members ───────────────────────────────────────────────────────────

  /** GET /api/projects/:id/members */
  async getDirectMembers(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await pool.query(
        `SELECT u.id, u.name, u.email, u.avatar, pm.role, pm.added_at
         FROM project_members pm
         JOIN users u ON u.id = pm.user_id
         WHERE pm.project_id = $1
         ORDER BY pm.added_at ASC`,
        [id]
      );
      res.json({
        success: true,
        data: {
          members: result.rows.map((r) => ({
            id:       r.id,
            name:     r.name,
            email:    r.email,
            avatar:   r.avatar ?? null,
            role:     r.role,
            addedAt:  new Date(r.added_at).toISOString(),
          })),
        },
      });
    } catch (error) {
      console.error('[ProjectController.getDirectMembers]', error);
      res.status(500).json({ success: false, error: { message: 'Error al obtener miembros del proyecto' } });
    }
  }

  /** POST /api/projects/:id/members  body: { userId, role? } */
  async addDirectMember(req: Request, res: Response) {
    try {
      const actorId = req.user?.id;
      const { id }  = req.params;
      const { userId, role = 'MEMBER' } = req.body;
      if (!userId) return res.status(400).json({ success: false, error: { message: 'userId requerido' } });

      // Fetch workspace for auto-linking
      const projRow = await pool.query(`SELECT workspace_id FROM projects WHERE id = $1`, [id]);
      if (!projRow.rows.length) return res.status(404).json({ success: false, error: { message: 'Proyecto no encontrado' } });
      const workspaceId = projRow.rows[0].workspace_id;

      // Auto-add user to workspace if not already a member
      await pool.query(
        `INSERT INTO workspace_members (workspace_id, user_id, role)
         VALUES ($1, $2, 'MEMBER')
         ON CONFLICT (workspace_id, user_id) DO NOTHING`,
        [workspaceId, userId]
      );

      // Add (or update role) in project_members
      await pool.query(
        `INSERT INTO project_members (project_id, user_id, role, added_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
        [id, userId, role, actorId]
      );

      const userRow = await pool.query(
        `SELECT id, name, email, avatar FROM users WHERE id = $1`,
        [userId]
      );
      if (!userRow.rows.length) return res.status(404).json({ success: false, error: { message: 'Usuario no encontrado' } });

      const u = userRow.rows[0];
      try {
        const projInfo  = await pool.query(`SELECT name FROM projects WHERE id = $1`, [id]);
        const actorInfo = await pool.query('SELECT name FROM users WHERE id = $1', [actorId]);
        const projName  = projInfo.rows[0]?.name ?? '';
        const actorName = actorInfo.rows[0]?.name ?? '';
        await eventStore.emit({
          type: 'project.member.added',
          actor: { id: actorId, name: actorName },
          subject: { type: 'project', id, name: projName },
          context: { workspaceId },
          payload: { projectId: id, projectName: projName, memberName: u.name, memberEmail: u.email },
        } as any);
        // Notificar al usuario añadido
        notificationService.createProjectInviteNotification({
          invitedUserId: userId,
          addedById: actorId!,
          addedByName: actorName,
          projectId: id,
          projectName: projName,
          workspaceId,
        }).catch(() => {});
      } catch {}
      res.status(201).json({
        success: true,
        data: {
          member: { id: u.id, name: u.name, email: u.email, avatar: u.avatar ?? null, role, addedAt: new Date().toISOString() },
        },
      });
    } catch (error) {
      console.error('[ProjectController.addDirectMember]', error);
      res.status(500).json({ success: false, error: { message: 'Error al agregar miembro al proyecto' } });
    }
  }

  /** PATCH /api/projects/:id/members/:userId  body: { role } */
  async updateDirectMemberRole(req: Request, res: Response) {
    try {
      const { id, userId } = req.params;
      const { role } = req.body;
      if (!role || !['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'].includes(role)) {
        return res.status(400).json({ success: false, error: { message: 'Rol inválido' } });
      }
      const result = await pool.query(
        `UPDATE project_members SET role = $1 WHERE project_id = $2 AND user_id = $3 RETURNING *`,
        [role, id, userId]
      );
      if (!result.rows.length) {
        return res.status(404).json({ success: false, error: { message: 'Miembro no encontrado' } });
      }
      res.json({ success: true, data: { role } });
    } catch (error) {
      console.error('[ProjectController.updateDirectMemberRole]', error);
      res.status(500).json({ success: false, error: { message: 'Error al actualizar rol' } });
    }
  }

  /** DELETE /api/projects/:id/members/:userId */
  async removeDirectMember(req: Request, res: Response) {
    try {
      const { id, userId } = req.params;
      const info = await pool.query(
        `SELECT u.name AS member_name, p.name AS project_name, p.workspace_id
         FROM users u, projects p WHERE u.id = $1 AND p.id = $2`, [userId, id]
      );
      await pool.query(`DELETE FROM project_members WHERE project_id = $1 AND user_id = $2`, [id, userId]);
      try {
        const actorId   = (req as any).user?.id as string;
        const actorInfo = await pool.query('SELECT name FROM users WHERE id = $1', [actorId]);
        if (info.rows[0]) {
          await eventStore.emit({
            type: 'project.member.removed',
            actor: { id: actorId, name: actorInfo.rows[0]?.name ?? '' },
            subject: { type: 'project', id, name: info.rows[0].project_name },
            context: { workspaceId: info.rows[0].workspace_id },
            payload: { projectId: id, projectName: info.rows[0].project_name, memberName: info.rows[0].member_name },
          } as any);
        }
      } catch {}
      res.json({ success: true, data: null });
    } catch (error) {
      console.error('[ProjectController.removeDirectMember]', error);
      res.status(500).json({ success: false, error: { message: 'Error al quitar miembro del proyecto' } });
    }
  }

  /** GET /api/projects/:id/activity */
  async getActivity(req: Request, res: Response) {
    try {
      const { id }   = req.params;
      const limit    = parseInt(req.query.limit  as string ?? '50');
      const offset   = parseInt(req.query.offset as string ?? '0');
      const result   = await activityLogService.getProjectActivity(id, { limit, offset });
      res.json({
        success: true,
        data: {
          events: result.entries,
          pagination: { total: result.total, limit, offset, hasMore: result.hasMore },
        },
      });
    } catch (error) {
      console.error('[ProjectController.getActivity]', error);
      res.status(500).json({ success: false, error: { message: 'Error al obtener actividad' } });
    }
  }
}

export const projectController = new ProjectController();
