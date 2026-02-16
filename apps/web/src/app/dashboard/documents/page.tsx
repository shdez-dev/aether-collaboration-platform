'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useAuthStore } from '@/stores/authStore';
import { apiService } from '@/services/apiService';
import { FileText, Search, Clock, Folder, ArrowRight, LayoutGrid, List } from 'lucide-react';
import type { Document } from '@aether/types';
import { useT } from '@/lib/i18n';
import { formatShort } from '@/lib/utils/date';

type DocumentWithWorkspace = Document & {
  workspaceId: string;
  workspaceName: string;
  workspaceColor: string;
  workspaceIcon: string;
};

type ViewMode = 'grid' | 'list';

export default function AllDocumentsPage() {
  const t = useT();
  const router = useRouter();
  const { workspaces, fetchWorkspaces } = useWorkspaceStore();
  const { user } = useAuthStore();
  const [documents, setDocuments] = useState<DocumentWithWorkspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [workspacesFetched, setWorkspacesFetched] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('all');

  useEffect(() => {
    fetchWorkspaces().finally(() => setWorkspacesFetched(true));
  }, [fetchWorkspaces]);

  useEffect(() => {
    if (!workspacesFetched) return;

    // Si no hay workspaces, no hay documentos que cargar
    if (workspaces.length === 0) {
      setDocuments([]);
      setIsLoading(false);
      return;
    }

    const fetchAllDocuments = async () => {
      setIsLoading(true);
      try {
        const allDocs: DocumentWithWorkspace[] = [];

        await Promise.all(
          workspaces.map(async (workspace) => {
            const response = await apiService.get<{ documents: Document[] }>(
              `/api/workspaces/${workspace.id}/documents`,
              true
            );
            if (response.success && response.data?.documents) {
              const docsWithWorkspace = response.data.documents.map((doc) => ({
                ...doc,
                workspaceId: workspace.id,
                workspaceName: workspace.name,
                workspaceColor: workspace.color || '#3B82F6',
                workspaceIcon: workspace.icon || '▣',
              }));
              allDocs.push(...docsWithWorkspace);
            }
          })
        );

        allDocs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        setDocuments(allDocs);
      } catch (error) {
        console.error('[AllDocuments] Error fetching documents:', error);
        setDocuments([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllDocuments();
  }, [workspaces, workspacesFetched]);

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.workspaceName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesWorkspace = selectedWorkspace === 'all' || doc.workspaceId === selectedWorkspace;

    return matchesSearch && matchesWorkspace;
  });

  const groupedByWorkspace = filteredDocuments.reduce(
    (acc, doc) => {
      if (!acc[doc.workspaceId]) {
        acc[doc.workspaceId] = {
          workspace: {
            id: doc.workspaceId,
            name: doc.workspaceName,
            color: doc.workspaceColor,
            icon: doc.workspaceIcon,
          },
          documents: [],
        };
      }
      acc[doc.workspaceId].documents.push(doc);
      return acc;
    },
    {} as Record<string, { workspace: any; documents: DocumentWithWorkspace[] }>
  );

  const handleDocumentClick = (doc: DocumentWithWorkspace) => {
    router.push(`/dashboard/workspaces/${doc.workspaceId}/documents/${doc.id}`);
  };

  const DocumentCard = ({ doc }: { doc: DocumentWithWorkspace }) => {
    if (viewMode === 'list') {
      return (
        <button
          onClick={() => handleDocumentClick(doc)}
          className="group w-full flex items-center gap-4 p-4 border border-border bg-card hover:border-accent hover:bg-surface transition-all text-left"
        >
          <div className="p-2 bg-accent/10 border border-accent/30 group-hover:bg-accent/20 transition-colors">
            <FileText className="w-5 h-5 text-accent" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-base font-medium text-text-primary mb-1 truncate group-hover:text-accent transition-colors">
              {doc.title}
            </h3>
            <div className="flex items-center gap-3 text-xs text-text-muted">
              <div className="flex items-center gap-1.5">
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: doc.workspaceColor }}
                />
                <span>{doc.workspaceName}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                <span>
                  {t.documents_updated(
                    formatShort(
                      new Date(doc.updatedAt),
                      user?.timezone,
                      user?.language as 'es' | 'en'
                    )
                  )}
                </span>
              </div>
            </div>
          </div>

          <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-accent transition-colors opacity-0 group-hover:opacity-100" />
        </button>
      );
    }

    return (
      <button
        onClick={() => handleDocumentClick(doc)}
        className="group bg-card border border-border hover:border-accent hover:shadow-lg transition-all text-left p-4 w-full"
      >
        <div className="flex items-start justify-between mb-3">
          <div className="p-2 bg-accent/10 border border-accent/30 group-hover:bg-accent/20 transition-colors">
            <FileText className="w-5 h-5 text-accent" />
          </div>
        </div>

        <h3 className="text-base font-medium text-text-primary mb-2 line-clamp-2 group-hover:text-accent transition-colors">
          {doc.title}
        </h3>

        <div className="space-y-1.5 text-xs text-text-muted">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: doc.workspaceColor }}
            />
            <span className="truncate">{doc.workspaceName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3 flex-shrink-0" />
            <span>
              {t.documents_updated(
                formatShort(new Date(doc.updatedAt), user?.timezone, user?.language as 'es' | 'en')
              )}
            </span>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-medium mb-2">{t.documents_title}</h1>
          <p className="text-text-secondary text-sm">{t.documents_subtitle}</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-surface border border-border">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 transition-colors ${
                viewMode === 'grid'
                  ? 'bg-accent text-white'
                  : 'text-text-muted hover:text-text-primary'
              }`}
              title="Vista en cuadrícula"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 transition-colors ${
                viewMode === 'list'
                  ? 'bg-accent text-white'
                  : 'text-text-muted hover:text-text-primary'
              }`}
              title="Vista en lista"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder={t.documents_search_placeholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        <select
          value={selectedWorkspace}
          onChange={(e) => setSelectedWorkspace(e.target.value)}
          className="px-4 py-2.5 bg-surface border border-border text-sm text-text-primary focus:outline-none focus:border-accent transition-colors min-w-[200px]"
        >
          <option value="all">{t.documents_filter_all_workspaces}</option>
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.icon} {workspace.name}
            </option>
          ))}
        </select>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="bg-card border border-border p-12">
          <div className="flex flex-col items-center justify-center">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-text-secondary text-sm">{t.documents_loading}</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && documents.length === 0 && (
        <div className="bg-card border border-border p-16 text-center">
          <div className="w-20 h-20 mx-auto mb-6 bg-accent/10 border border-accent flex items-center justify-center">
            <FileText className="w-10 h-10 text-accent" />
          </div>
          <h3 className="text-xl font-medium mb-2">{t.documents_empty_title}</h3>
          <p className="text-text-secondary text-sm mb-6">{t.documents_empty_desc}</p>
        </div>
      )}

      {/* No Results */}
      {!isLoading && documents.length > 0 && filteredDocuments.length === 0 && (
        <div className="bg-card border border-border p-16 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-text-muted/10 border border-text-muted/30 flex items-center justify-center">
            <Search className="w-8 h-8 text-text-muted" />
          </div>
          <h3 className="text-lg font-medium mb-2">{t.documents_no_results_title}</h3>
          <p className="text-text-secondary text-sm">{t.documents_no_results_desc}</p>
        </div>
      )}

      {/* Documents Grouped by Workspace */}
      {!isLoading && filteredDocuments.length > 0 && (
        <div className="space-y-8">
          {Object.values(groupedByWorkspace).map(({ workspace, documents: workspaceDocs }) => (
            <div key={workspace.id}>
              {/* Workspace Header */}
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 flex items-center justify-center text-lg border"
                  style={{
                    backgroundColor: `${workspace.color}15`,
                    color: workspace.color,
                    borderColor: `${workspace.color}40`,
                  }}
                >
                  {workspace.icon}
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-medium text-text-primary">{workspace.name}</h2>
                  <p className="text-sm text-text-muted">
                    {t.documents_showing(workspaceDocs.length, workspaceDocs.length)}
                  </p>
                </div>
                <button
                  onClick={() => router.push(`/dashboard/workspaces/${workspace.id}/documents`)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-muted hover:text-accent hover:bg-surface border border-transparent hover:border-border transition-all"
                >
                  <span>{t.btn_back}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Documents Grid/List */}
              <div
                className={
                  viewMode === 'grid'
                    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
                    : 'space-y-2'
                }
              >
                {workspaceDocs.map((doc) => (
                  <DocumentCard key={doc.id} doc={doc} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats Footer */}
      {!isLoading && filteredDocuments.length > 0 && (
        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between text-sm text-text-muted">
            <span>{t.documents_showing(filteredDocuments.length, documents.length)}</span>
            <span>
              {Object.keys(groupedByWorkspace).length} workspace
              {Object.keys(groupedByWorkspace).length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
