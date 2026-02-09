// apps/web/src/app/dashboard/workspaces/[id]/documents/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDocumentStore } from '@/stores/documentStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { FileText, Plus, Search, Clock, User, ArrowLeft, FileEdit } from 'lucide-react';
import type { Document } from '@aether/types';

const DOCUMENT_TEMPLATES = [
  { id: 'blank', name: 'Documento en Blanco', icon: '📄' },
  { id: 'meeting-notes', name: 'Notas de Reunión', icon: '📝' },
  { id: 'project-brief', name: 'Brief de Proyecto', icon: '📋' },
  { id: 'technical-spec', name: 'Especificación Técnica', icon: '⚙️' },
  { id: 'retrospective', name: 'Retrospectiva', icon: '🔄' },
];

export default function DocumentsPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;

  const { documents, isLoading, fetchDocuments, createDocument } = useDocumentStore();
  const { currentWorkspace } = useWorkspaceStore();
  const userRole = currentWorkspace?.userRole;

  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('blank');
  const [newDocTitle, setNewDocTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const canCreateDocument = userRole === 'OWNER' || userRole === 'ADMIN' || userRole === 'MEMBER';

  useEffect(() => {
    if (workspaceId) {
      fetchDocuments(workspaceId);
    }
  }, [workspaceId, fetchDocuments]);

  // Refrescar documentos cuando la página se hace visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && workspaceId) {
        fetchDocuments(workspaceId);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [workspaceId, fetchDocuments]);

  const filteredDocuments = documents.filter((doc) =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateDocument = async () => {
    if (!newDocTitle.trim() || !canCreateDocument) return;

    setIsCreating(true);
    try {
      const doc = await createDocument(workspaceId, {
        title: newDocTitle.trim(),
        templateId: selectedTemplate !== 'blank' ? selectedTemplate : undefined,
      });

      setShowCreateModal(false);
      setNewDocTitle('');
      setSelectedTemplate('blank');
      router.push(`/dashboard/workspaces/${workspaceId}/documents/${doc.id}`);
    } catch (error) {
    } finally {
      setIsCreating(false);
    }
  };

  const handleDocumentClick = (documentId: string) => {
    router.push(`/dashboard/workspaces/${workspaceId}/documents/${documentId}`);
  };

  const handleBack = () => {
    router.push(`/dashboard/workspaces/${workspaceId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBack}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-muted hover:text-text-primary hover:bg-surface border border-transparent hover:border-border transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver</span>
              </button>

              <div className="w-px h-6 bg-border" />

              <div className="flex items-center gap-3">
                <div className="p-2 bg-accent/10 border border-accent/30">
                  <FileText className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h1 className="text-xl font-medium text-text-primary">Documentos</h1>
                  <p className="text-sm text-text-secondary">
                    {currentWorkspace?.name || 'Workspace'}
                  </p>
                </div>
              </div>
            </div>

            {canCreateDocument && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-accent text-white hover:bg-accent/80 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Nuevo Documento</span>
              </button>
            )}
          </div>

          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder="Buscar documentos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
          </div>
        </div>
      </header>

      <main className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-text-secondary">Cargando documentos...</p>
            </div>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 bg-surface border border-border mb-4">
              <FileText className="w-12 h-12 text-text-muted" />
            </div>
            <h3 className="text-lg font-medium text-text-primary mb-2">
              {searchQuery ? 'No se encontraron documentos' : 'No hay documentos aún'}
            </h3>
            <p className="text-text-secondary mb-6">
              {searchQuery
                ? 'Intenta con otros términos de búsqueda'
                : 'Crea tu primer documento para comenzar'}
            </p>
            {canCreateDocument && !searchQuery && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-accent text-white hover:bg-accent/80 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Crear Documento</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredDocuments.map((doc) => (
              <DocumentCard
                key={doc.id}
                document={doc}
                onClick={() => handleDocumentClick(doc.id)}
              />
            ))}
          </div>
        )}
      </main>

      {showCreateModal && canCreateDocument && (
        <>
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
            onClick={() => !isCreating && setShowCreateModal(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border max-w-2xl w-full p-6">
              <h2 className="text-xl font-medium mb-6">Crear Nuevo Documento</h2>

              <div className="mb-6">
                <label className="block text-sm text-text-secondary mb-2">Título</label>
                <input
                  type="text"
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                  placeholder="Escribe un título..."
                  className="w-full px-4 py-2 bg-surface border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                  autoFocus
                  disabled={isCreating}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateDocument()}
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm text-text-secondary mb-3">
                  Seleccionar Plantilla
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {DOCUMENT_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => setSelectedTemplate(template.id)}
                      disabled={isCreating}
                      className={`p-4 border text-left transition-all ${
                        selectedTemplate === template.id
                          ? 'border-accent bg-accent/10'
                          : 'border-border bg-surface hover:border-border-hover'
                      }`}
                    >
                      <div className="text-2xl mb-2">{template.icon}</div>
                      <div className="text-sm font-medium text-text-primary">{template.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  disabled={isCreating}
                  className="flex-1 px-4 py-2 border border-border bg-surface text-text-primary hover:bg-card transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateDocument}
                  disabled={!newDocTitle.trim() || isCreating}
                  className="flex-1 px-4 py-2 bg-accent text-white hover:bg-accent/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isCreating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Creando...</span>
                    </>
                  ) : (
                    <>
                      <FileEdit className="w-4 h-4" />
                      <span>Crear Documento</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function DocumentCard({ document, onClick }: { document: Document; onClick: () => void }) {
  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <button
      onClick={onClick}
      className="group bg-card border border-border hover:border-accent hover:shadow-lg transition-all text-left p-4"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 bg-accent/10 border border-accent/30 group-hover:bg-accent/20 transition-colors">
          <FileText className="w-5 h-5 text-accent" />
        </div>
      </div>

      <h3 className="text-base font-medium text-text-primary mb-2 line-clamp-2 group-hover:text-accent transition-colors">
        {document.title}
      </h3>

      <div className="space-y-1.5 text-xs text-text-muted">
        <div className="flex items-center gap-2">
          <Clock className="w-3 h-3" />
          <span>Actualizado {formatDate(document.updatedAt)}</span>
        </div>
      </div>
    </button>
  );
}
