import { documentService } from '../../services/DocumentService';
import { projectAuthorizationService } from '../../services/ProjectAuthorizationService';

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
    const access = await projectAuthorizationService.can(projectId, userId, 'READ');
    if (!access) return null;

    return documentService.getWorkspaceDocuments(access.workspaceId, {
      projectId,
      ...options,
    });
  }
}

export const projectDocumentService = new ProjectDocumentService();
