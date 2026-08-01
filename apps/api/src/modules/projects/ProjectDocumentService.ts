import { pool } from '../../lib/db';
import { documentService } from '../../services/DocumentService';

export type ProjectDocumentListOptions = {
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'title';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
};

/** Keeps project access rules outside the generic document service. */
export class ProjectDocumentService {
  async listForMember(projectId: string, userId: string, options: ProjectDocumentListOptions = {}) {
    const access = await pool.query(
      `SELECT p.workspace_id
       FROM projects p
       JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
       WHERE p.id = $1 AND wm.user_id = $2`,
      [projectId, userId]
    );
    if (access.rowCount === 0) return null;

    return documentService.getWorkspaceDocuments(access.rows[0].workspace_id, {
      projectId,
      ...options,
    });
  }
}

export const projectDocumentService = new ProjectDocumentService();
