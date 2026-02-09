// apps/web/src/components/workspace/DocumentsSection.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDocumentStore } from '@/stores/documentStore';
import { FileText, Plus, Clock, ChevronRight } from 'lucide-react';
import type { Document } from '@aether/types';

interface DocumentsSectionProps {
  workspaceId: string;
  isOwnerOrAdmin: boolean;
}

export default function DocumentsSection({ workspaceId, isOwnerOrAdmin }: DocumentsSectionProps) {
  const router = useRouter();
  const { documents, isLoading, fetchDocuments } = useDocumentStore();

  useEffect(() => {
    if (workspaceId) {
      fetchDocuments(workspaceId);
    }
  }, [workspaceId, fetchDocuments]);

  const handleViewAll = () => {
    router.push(`/dashboard/workspaces/${workspaceId}/documents`);
  };

  const handleCreateDocument = () => {
    router.push(`/dashboard/workspaces/${workspaceId}/documents?create=true`);
  };

  const handleDocumentClick = (documentId: string) => {
    router.push(`/dashboard/workspaces/${workspaceId}/documents/${documentId}`);
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  // Mostrar solo los 3 documentos más recientes
  const recentDocuments = documents
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 3);

  return (
    <div className="bg-card border border-border">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-accent/10 border border-accent/30">
            <FileText className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-text-primary">Documentos</h3>
            <p className="text-xs text-text-muted">{documents.length} total</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isOwnerOrAdmin && (
            <button
              onClick={handleCreateDocument}
              className="p-1.5 border border-border hover:border-accent hover:bg-accent/10 transition-all"
              title="Crear documento"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
          {documents.length > 0 && (
            <button onClick={handleViewAll} className="text-xs text-accent hover:underline">
              Ver todos
            </button>
          )}
        </div>
      </div>

      <div className="p-3">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="inline-block w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mb-2"></div>
            <p className="text-xs text-text-secondary">Cargando documentos...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto mb-3 bg-accent/10 border border-accent flex items-center justify-center">
              <FileText className="w-6 h-6 text-accent" />
            </div>
            <p className="text-xs font-medium mb-1">No hay documentos</p>
            <p className="text-xs text-text-muted mb-4">
              {isOwnerOrAdmin ? 'Crea tu primer documento' : 'No hay documentos creados'}
            </p>
            {isOwnerOrAdmin && (
              <button
                onClick={handleCreateDocument}
                className="px-3 py-1.5 bg-accent text-white text-xs hover:bg-accent/90 inline-flex items-center gap-1.5"
              >
                <Plus className="w-3 h-3" />
                <span>Crear Documento</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {recentDocuments.map((doc) => (
              <button
                key={doc.id}
                onClick={() => handleDocumentClick(doc.id)}
                className="group w-full text-left p-3 border border-border bg-surface hover:bg-card hover:border-accent transition-all flex items-center gap-3"
              >
                <div className="p-2 bg-accent/10 border border-accent/30 flex-shrink-0">
                  <FileText className="w-4 h-4 text-accent" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors truncate">
                    {doc.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
                    <Clock className="w-3 h-3" />
                    <span>{formatDate(doc.updatedAt)}</span>
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-accent group-hover:translate-x-1 transition-all flex-shrink-0" />
              </button>
            ))}

            {documents.length > 3 && (
              <button
                onClick={handleViewAll}
                className="w-full p-2 text-xs text-accent hover:bg-accent/10 border border-transparent hover:border-accent/30 transition-all"
              >
                Ver {documents.length - 3} más →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
