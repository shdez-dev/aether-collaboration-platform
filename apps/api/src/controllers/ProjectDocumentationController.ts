import type { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../lib/db';
import { OrganizationStorageLimitError, organizationStorageService } from '../services/OrganizationStorageService';

const categorySchema = z.enum(['GENERAL', 'DIRECTION', 'REQUIREMENTS', 'ARCHITECTURE', 'VERIFICATION', 'DELIVERY', 'OPERATIONS', 'METRICS']);
const targetTypeSchema = z.enum(['PROJECT', 'OBJECTIVE', 'DELIVERABLE', 'REQUIREMENT', 'OUTCOME', 'DECISION']);
const evidenceInput = z.object({
  documentId: z.string().uuid(),
  targetType: targetTypeSchema,
  targetId: z.string().uuid().nullable().optional(),
  claim: z.string().trim().min(1).max(1000),
  excerpt: z.string().trim().max(2000).nullable().optional(),
}).refine((value) => ['PROJECT', 'OBJECTIVE'].includes(value.targetType) ? !value.targetId : Boolean(value.targetId), {
  path: ['targetId'],
  message: 'Selecciona el elemento respaldado.',
});

const targetTable: Record<'DELIVERABLE' | 'REQUIREMENT' | 'OUTCOME' | 'DECISION', string> = {
  DELIVERABLE: 'project_deliverables',
  REQUIREMENT: 'project_requirements',
  OUTCOME: 'project_outcomes',
  DECISION: 'project_decisions',
};

const evidenceSelect = `SELECT e.id, e.project_id, e.document_id, e.document_version_id,
  e.document_title, e.document_updated_at, e.snapshot_text, e.target_type, e.target_id,
  e.claim, e.excerpt, e.status, e.created_by, e.created_at,
  e.verified_by, e.verified_at, d.updated_at AS current_document_updated_at
  FROM project_evidence_links e
  LEFT JOIN documents d ON d.id = e.document_id AND d.project_id = e.project_id`;

function formatEvidence(row: any) {
  return {
    id: row.id,
    projectId: row.project_id,
    documentId: row.document_id,
    documentVersionId: row.document_version_id,
    documentTitle: row.document_title,
    snapshotText: row.snapshot_text,
    documentUpdatedAt: row.document_updated_at,
    currentDocumentUpdatedAt: row.current_document_updated_at,
    targetType: row.target_type,
    targetId: row.target_id,
    claim: row.claim,
    excerpt: row.excerpt,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    verifiedBy: row.verified_by,
    verifiedAt: row.verified_at,
  };
}

export class ProjectDocumentationController {
  async list(req: Request, res: Response) {
    try {
      const [profiles, evidence] = await Promise.all([
        pool.query('SELECT document_id, category FROM project_document_profiles WHERE project_id = $1', [req.params.id]),
        pool.query(evidenceSelect + ' WHERE e.project_id = $1 ORDER BY e.created_at DESC', [req.params.id]),
      ]);
      return res.json({ success: true, data: {
        profiles: profiles.rows.map((row) => ({ documentId: row.document_id, category: row.category })),
        evidenceLinks: evidence.rows.map(formatEvidence),
      } });
    } catch (error) {
      console.error('[ProjectDocumentationController.list]', error);
      return res.status(500).json({ success: false, error: { message: 'No se pudo cargar la documentación del proyecto.' } });
    }
  }

  async classify(req: Request, res: Response) {
    const parsed = z.object({ category: categorySchema }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: { message: 'Selecciona una categoría válida.' } });
    try {
      const result = await pool.query(
        `INSERT INTO project_document_profiles (document_id, project_id, category, updated_by)
         SELECT d.id, d.project_id, $3, $4 FROM documents d WHERE d.id = $2 AND d.project_id = $1
         ON CONFLICT (document_id) DO UPDATE SET category = EXCLUDED.category,
           updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP
         RETURNING document_id, category`,
        [req.params.id, req.params.documentId, parsed.data.category, req.user!.id],
      );
      if (!result.rowCount) return res.status(404).json({ success: false, error: { message: 'Documento no encontrado en este proyecto.' } });
      return res.json({ success: true, data: { documentId: result.rows[0].document_id, category: result.rows[0].category } });
    } catch (error) {
      console.error('[ProjectDocumentationController.classify]', error);
      return res.status(500).json({ success: false, error: { message: 'No se pudo clasificar el documento.' } });
    }
  }

  async createEvidence(req: Request, res: Response) {
    const parsed = evidenceInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: { message: 'Revisa el documento, el elemento y lo que demuestra.', details: parsed.error.errors } });
    const { documentId, targetType, targetId, claim, excerpt } = parsed.data;
    const client = await pool.connect();
    let transactionOpen = false;
    try {
      await client.query('BEGIN');
      transactionOpen = true;
      const project = await client.query('SELECT advanced_traceability FROM projects WHERE id = $1', [req.params.id]);
      if (!project.rows[0]?.advanced_traceability) {
        await client.query('ROLLBACK'); transactionOpen = false;
        return res.status(409).json({ success: false, error: { message: 'Activa la trazabilidad avanzada para vincular documentos como evidencia.' } });
      }
      const ownedDocument = await client.query('SELECT id FROM documents WHERE id = $1 AND project_id = $2', [documentId, req.params.id]);
      if (!ownedDocument.rowCount) {
        await client.query('ROLLBACK'); transactionOpen = false;
        return res.status(404).json({ success: false, error: { message: 'El documento no pertenece a este proyecto.' } });
      }
      const organizationId = await organizationStorageService.lockForDocument(client, documentId);
      const storageBefore = await organizationStorageService.getUsage(organizationId, (sql, params) => client.query(sql, params));
      const document = await client.query(
        'SELECT id, title, content, updated_at, yjs_state FROM documents WHERE id = $1 AND project_id = $2 FOR SHARE',
        [documentId, req.params.id],
      );
      if (!document.rowCount) {
        await client.query('ROLLBACK'); transactionOpen = false;
        return res.status(404).json({ success: false, error: { message: 'El documento no pertenece a este proyecto.' } });
      }
      if (!document.rows[0].yjs_state) {
        await client.query('ROLLBACK'); transactionOpen = false;
        return res.status(409).json({ success: false, error: { message: 'Guarda el documento antes de usarlo como evidencia.' } });
      }
      if (targetType === 'OBJECTIVE') {
        const target = await client.query('SELECT id FROM project_objectives WHERE project_id = $1 AND is_current = TRUE', [req.params.id]);
        if (!target.rowCount) {
          await client.query('ROLLBACK'); transactionOpen = false;
          return res.status(400).json({ success: false, error: { message: 'El proyecto aún no tiene un objetivo definido.' } });
        }
      } else if (targetType !== 'PROJECT') {
        const table = targetTable[targetType];
        const target = await client.query(`SELECT id FROM ${table} WHERE project_id = $1 AND id = $2`, [req.params.id, targetId]);
        if (!target.rowCount) {
          await client.query('ROLLBACK'); transactionOpen = false;
          return res.status(400).json({ success: false, error: { message: 'El elemento seleccionado ya no está disponible en este proyecto.' } });
        }
      }
      const version = await client.query(
        `INSERT INTO document_versions (document_id, yjs_state, metadata, created_by)
         VALUES ($1, $2, $3::jsonb, $4) RETURNING id`,
        [documentId, document.rows[0].yjs_state, JSON.stringify({ description: 'Versión usada como evidencia' }), req.user!.id],
      );
      const created = await client.query(
        `INSERT INTO project_evidence_links (project_id, document_id, document_version_id,
           document_title, document_updated_at, snapshot_text, target_type, target_id, claim, excerpt, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
        [req.params.id, documentId, version.rows[0].id, document.rows[0].title, document.rows[0].updated_at,
          document.rows[0].content ?? '', targetType, targetId ?? null, claim, excerpt ?? null, req.user!.id],
      );
      await organizationStorageService.assertWithinLimit(organizationId, client, storageBefore.usedBytes);
      const result = await client.query(evidenceSelect + ' WHERE e.id = $1', [created.rows[0].id]);
      await client.query('COMMIT'); transactionOpen = false;
      return res.status(201).json({ success: true, data: { evidenceLink: formatEvidence(result.rows[0]) } });
    } catch (error) {
      if (transactionOpen) await client.query('ROLLBACK').catch(() => undefined);
      console.error('[ProjectDocumentationController.createEvidence]', error);
      if (error instanceof OrganizationStorageLimitError) return res.status(409).json({ success: false, error: { message: error.message } });
      return res.status(500).json({ success: false, error: { message: 'No se pudo vincular el documento como evidencia.' } });
    } finally { client.release(); }
  }

  async setEvidenceStatus(req: Request, res: Response) {
    const parsed = z.object({ status: z.enum(['PENDING', 'VERIFIED']) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: { message: 'Estado de revisión no válido.' } });
    try {
      const result = await pool.query(
        `UPDATE project_evidence_links SET status = $3,
         verified_by = CASE WHEN $3 = 'VERIFIED' THEN $4::uuid ELSE NULL END,
         verified_at = CASE WHEN $3 = 'VERIFIED' THEN CURRENT_TIMESTAMP ELSE NULL END
         WHERE id = $2 AND project_id = $1 RETURNING id`,
        [req.params.id, req.params.evidenceId, parsed.data.status, req.user!.id],
      );
      if (!result.rowCount) return res.status(404).json({ success: false, error: { message: 'Evidencia no encontrada.' } });
      const evidence = await pool.query(evidenceSelect + ' WHERE e.id = $1', [result.rows[0].id]);
      return res.json({ success: true, data: { evidenceLink: formatEvidence(evidence.rows[0]) } });
    } catch (error) {
      console.error('[ProjectDocumentationController.setEvidenceStatus]', error);
      return res.status(500).json({ success: false, error: { message: 'No se pudo actualizar la revisión.' } });
    }
  }

  async removeEvidence(req: Request, res: Response) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        'DELETE FROM project_evidence_links WHERE id = $2 AND project_id = $1 RETURNING id, document_version_id',
        [req.params.id, req.params.evidenceId],
      );
      if (!result.rowCount) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: { message: 'Evidencia no encontrada.' } });
      }
      if (result.rows[0].document_version_id) {
        await client.query(
          `DELETE FROM document_versions WHERE id = $1 AND metadata->>'description' = 'Versión usada como evidencia'`,
          [result.rows[0].document_version_id],
        );
      }
      await client.query('COMMIT');
      return res.json({ success: true, data: { removed: true } });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      console.error('[ProjectDocumentationController.removeEvidence]', error);
      return res.status(500).json({ success: false, error: { message: 'No se pudo quitar el vínculo de evidencia.' } });
    } finally { client.release(); }
  }
}

export const projectDocumentationController = new ProjectDocumentationController();
