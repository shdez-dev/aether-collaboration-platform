import type { Document } from '@aether/types';
import { apiService } from '@/services/apiService';

/** Project-scoped document queries. Workspace documents remain a separate concern. */
export async function getProjectDocuments(projectId: string): Promise<Document[]> {
  const response = await apiService.get<{ documents: Document[] }>(
    `/api/projects/${projectId}/documents`,
    true
  );
  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Error al cargar documentos del proyecto');
  }
  return response.data.documents ?? [];
}
