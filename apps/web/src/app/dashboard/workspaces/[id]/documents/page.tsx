// apps/web/src/app/dashboard/workspaces/[id]/documents/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDocumentStore } from '@/stores/documentStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import {
  FileText,
  Plus,
  Search,
  Clock,
  User,
  ArrowLeft,
  FileEdit,
  File,
  MessageSquare,
  ClipboardList,
  Settings,
  RotateCcw,
  BookOpen,
  Code,
  Building2,
  FlaskConical,
  Palette,
  Megaphone,
  FolderOpen,
  type LucideIcon,
} from 'lucide-react';
import type { Document } from '@aether/types';
import { useT } from '@/lib/i18n';
import { formatShort } from '@/lib/utils/date';
import { useAuthStore } from '@/stores/authStore';
import { apiService } from '@/services/apiService';

// Helper para obtener el icono de Lucide por nombre
const getIconByName = (iconName: string) => {
  const icons: Record<string, LucideIcon> = {
    File,
    MessageSquare,
    ClipboardList,
    Settings,
    RotateCcw,
    BookOpen,
  };
  return icons[iconName] || File;
};

export default function DocumentsPage() {
  const t = useT();
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;

  const { documents, fetchDocuments, createDocument } = useDocumentStore();
  const [isLoading, setIsLoading] = useState(true);
  const { currentWorkspace } = useWorkspaceStore();
  const { user } = useAuthStore();
  const userRole = currentWorkspace?.userRole;

  const [templates, setTemplates] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('blank');
  const [selectedProjectType, setSelectedProjectType] = useState('software');
  const [newDocTitle, setNewDocTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Tipos de proyecto disponibles
  const PROJECT_TYPES: Array<{ id: string; name: string; icon: LucideIcon; description: string }> =
    [
      {
        id: 'software',
        name: 'Software Development',
        icon: Code,
        description: 'Tech stack, architecture, APIs',
      },
      {
        id: 'construction',
        name: 'Construction',
        icon: Building2,
        description: 'Site plans, materials, contractors',
      },
      {
        id: 'research',
        name: 'Research',
        icon: FlaskConical,
        description: 'Methodology, hypothesis, data analysis',
      },
      {
        id: 'design',
        name: 'Design',
        icon: Palette,
        description: 'Creative projects and design work',
      },
      {
        id: 'marketing',
        name: 'Marketing',
        icon: Megaphone,
        description: 'Marketing campaigns and strategies',
      },
      {
        id: 'general',
        name: 'General Project',
        icon: FolderOpen,
        description: 'Generic project documentation',
      },
    ];

  const canCreateDocument = userRole === 'OWNER' || userRole === 'ADMIN' || userRole === 'MEMBER';

  // Cargar templates disponibles
  useEffect(() => {
    const loadTemplates = async () => {
      const fallbackTemplates = [
        {
          id: 'blank',
          name: t.documents_template_blank || 'Blank Document',
          iconName: 'File',
          description: 'Start with an empty document',
        },
        {
          id: 'meeting-notes',
          name: t.documents_template_meeting || 'Meeting Notes',
          iconName: 'MessageSquare',
          description: 'Structured meeting notes',
        },
        {
          id: 'project-brief',
          name: t.documents_template_project || 'Project Brief',
          iconName: 'ClipboardList',
          description: 'Project overview',
        },
        {
          id: 'technical-spec',
          name: t.documents_template_technical || 'Technical Spec',
          iconName: 'Settings',
          description: 'Technical documentation',
        },
        {
          id: 'retrospective',
          name: t.documents_template_retrospective || 'Retrospective',
          iconName: 'RotateCcw',
          description: 'Sprint retrospective',
        },
        {
          id: 'project-documentation',
          name: 'Complete Project Documentation',
          iconName: 'BookOpen',
          description: 'Comprehensive project documentation with adaptive sections',
        },
      ];

      try {
        const response = await apiService.get<{ templates: any[] }>(
          '/api/documents/templates',
          true
        );

        if (response.success && (response.data?.templates?.length ?? 0) > 0) {
          const mappedTemplates = (response.data!.templates ?? []).map((t: any) => ({
            ...t,
            iconName: t.icon,
          }));
          setTemplates([
            fallbackTemplates[0], // Blank siempre primero
            ...mappedTemplates,
          ]);
        } else {
          setTemplates(fallbackTemplates);
        }
      } catch {
        setTemplates(fallbackTemplates);
      }
    };
    loadTemplates();
  }, [t]);

  useEffect(() => {
    if (workspaceId) {
      setIsLoading(true);
      fetchDocuments(workspaceId).finally(() => setIsLoading(false));
    }
  }, [workspaceId, fetchDocuments]);

  // Refrescar documentos cuando la página se hace visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && workspaceId) {
        fetchDocuments(workspaceId).catch(() => {});
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
      const documentData: any = {
        title: newDocTitle.trim(),
        templateId: selectedTemplate !== 'blank' ? selectedTemplate : undefined,
      };

      // Si es la plantilla de documentación completa, incluir el tipo de proyecto
      if (selectedTemplate === 'project-documentation') {
        documentData.metadata = {
          projectType: selectedProjectType,
        };
      }

      const doc = await createDocument(workspaceId, documentData);

      setShowCreateModal(false);
      setNewDocTitle('');
      setSelectedTemplate('blank');
      setSelectedProjectType('software'); // Reset to default
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
        <div className="px-3 py-3 md:px-6 md:py-4">
          <div className="flex items-center justify-between gap-2 md:gap-4">
            <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1">
              <button
                onClick={handleBack}
                className="flex items-center gap-1.5 px-2 py-1.5 md:px-3 text-sm text-text-muted hover:text-text-primary hover:bg-surface border border-transparent hover:border-border transition-all flex-shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">{t.btn_back}</span>
              </button>

              <div className="hidden sm:block w-px h-6 bg-border flex-shrink-0" />

              <div className="flex items-center gap-2 md:gap-3 min-w-0">
                <div className="hidden sm:flex p-2 bg-accent/10 border border-accent/30 flex-shrink-0">
                  <FileText className="w-4 h-4 md:w-5 md:h-5 text-accent" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-base md:text-xl font-medium text-text-primary truncate">
                    {t.documents_section_title}
                  </h1>
                  <p className="text-xs md:text-sm text-text-secondary truncate hidden sm:block">
                    {currentWorkspace?.name || 'Workspace'}
                  </p>
                </div>
              </div>
            </div>

            {canCreateDocument && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 bg-accent text-white hover:bg-accent/80 transition-colors flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">{t.documents_btn_new}</span>
              </button>
            )}
          </div>

          <div className="mt-3 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder={t.documents_search_placeholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent text-sm"
            />
          </div>
        </div>
      </header>

      <main className="p-3 md:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-text-secondary">{t.documents_loading}</p>
            </div>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 bg-surface border border-border mb-4">
              <FileText className="w-12 h-12 text-text-muted" />
            </div>
            <h3 className="text-lg font-medium text-text-primary mb-2">
              {searchQuery ? t.documents_no_results_title : t.documents_empty_ws_title}
            </h3>
            <p className="text-text-secondary mb-6">
              {searchQuery ? t.documents_no_results_desc : t.documents_empty_ws_desc}
            </p>
            {canCreateDocument && !searchQuery && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-accent text-white hover:bg-accent/80 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>{t.documents_btn_create}</span>
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
                userTimezone={user?.timezone}
                userLanguage={user?.language as 'es' | 'en'}
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-card border border-border max-w-4xl w-full p-6 my-8">
              <h2 className="text-2xl font-semibold mb-2">{t.documents_modal_title}</h2>
              <p className="text-sm text-text-secondary mb-6">
                Choose a template to get started quickly, or start with a blank document
              </p>

              <div className="mb-6">
                <label className="block text-sm text-text-secondary mb-2">
                  {t.documents_modal_label_title}
                </label>
                <input
                  type="text"
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                  placeholder={t.documents_modal_placeholder_title}
                  className="w-full px-4 py-2 bg-surface border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                  autoFocus
                  disabled={isCreating}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateDocument()}
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm text-text-secondary mb-3">
                  {t.documents_modal_label_template}
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-2">
                  {templates.map((template: any) => {
                    const TemplateIcon = template.iconName
                      ? getIconByName(template.iconName)
                      : template.icon
                        ? null
                        : File; // Fallback para templates del backend con emojis

                    return (
                      <button
                        key={template.id}
                        onClick={() => setSelectedTemplate(template.id)}
                        disabled={isCreating}
                        className={`p-4 border text-left transition-all group ${
                          selectedTemplate === template.id
                            ? 'border-accent bg-accent/10 ring-2 ring-accent/20'
                            : 'border-border bg-surface hover:border-accent/50 hover:bg-accent/5'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0">
                            {TemplateIcon ? (
                              <TemplateIcon className="w-6 h-6 text-accent" />
                            ) : (
                              <span className="text-2xl">{template.icon}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-text-primary mb-1 group-hover:text-accent transition-colors">
                              {template.name}
                            </div>
                            {template.description && (
                              <div className="text-xs text-text-secondary line-clamp-2">
                                {template.description}
                              </div>
                            )}
                            {template.category && (
                              <div className="text-xs text-text-muted mt-1">
                                {template.category}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selector de tipo de proyecto - solo visible para Complete Project Documentation */}
              {selectedTemplate === 'project-documentation' && (
                <div className="mb-6 p-4 bg-accent/5 border border-accent/20 rounded">
                  <label className="block text-sm font-medium text-text-primary mb-3">
                    Project Type
                    <span className="text-xs text-text-secondary ml-2 font-normal">
                      Select the type of project to customize the documentation sections
                    </span>
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {PROJECT_TYPES.map((type) => {
                      const IconComponent = type.icon;
                      return (
                        <button
                          key={type.id}
                          onClick={() => setSelectedProjectType(type.id)}
                          disabled={isCreating}
                          className={`p-3 border text-left transition-all ${
                            selectedProjectType === type.id
                              ? 'border-accent bg-accent text-white'
                              : 'border-border bg-surface hover:border-accent/50'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <IconComponent className="w-4 h-4" />
                            <span className="text-xs font-medium">{type.name}</span>
                          </div>
                          <div className="text-xs opacity-80 line-clamp-1">{type.description}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  disabled={isCreating}
                  className="flex-1 px-4 py-2 border border-border bg-surface text-text-primary hover:bg-card transition-colors disabled:opacity-50"
                >
                  {t.documents_btn_cancel}
                </button>
                <button
                  onClick={handleCreateDocument}
                  disabled={!newDocTitle.trim() || isCreating}
                  className="flex-1 px-4 py-2 bg-accent text-white hover:bg-accent/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isCreating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{t.documents_btn_creating}</span>
                    </>
                  ) : (
                    <>
                      <FileEdit className="w-4 h-4" />
                      <span>{t.documents_btn_create_confirm}</span>
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

function DocumentCard({
  document,
  onClick,
  userTimezone,
  userLanguage,
}: {
  document: Document;
  onClick: () => void;
  userTimezone?: string;
  userLanguage?: 'es' | 'en';
}) {
  const t = useT();

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
          <span>
            {t.documents_updated(
              formatShort(new Date(document.updatedAt), userTimezone, userLanguage)
            )}
          </span>
        </div>
      </div>
    </button>
  );
}
