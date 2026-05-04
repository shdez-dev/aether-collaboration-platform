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

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg:      '#0b0d10',
  bg2:     '#0f1117',
  surface: '#14171c',
  hover:   '#1c2128',
  border:  '#1f2329',
  border2: '#2a2f36',
  text:    '#e6e8eb',
  text2:   '#a1a7b0',
  text3:   '#6b7280',
  text4:   '#4b5260',
  accent:  '#3b82f6',
  green:   '#10b981',
  red:     '#ef4444',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getIconByName = (iconName: string): LucideIcon => {
  const icons: Record<string, LucideIcon> = {
    File, MessageSquare, ClipboardList, Settings, RotateCcw, BookOpen,
  };
  return icons[iconName] || File;
};

const PROJECT_TYPES: Array<{ id: string; name: string; icon: LucideIcon; description: string }> = [
  { id: 'software',     name: 'Software Development', icon: Code,        description: 'Tech stack, architecture, APIs' },
  { id: 'construction', name: 'Construction',          icon: Building2,   description: 'Site plans, materials, contractors' },
  { id: 'research',     name: 'Research',              icon: FlaskConical,description: 'Methodology, hypothesis, data analysis' },
  { id: 'design',       name: 'Design',                icon: Palette,     description: 'Creative projects and design work' },
  { id: 'marketing',    name: 'Marketing',             icon: Megaphone,   description: 'Marketing campaigns and strategies' },
  { id: 'general',      name: 'General Project',       icon: FolderOpen,  description: 'Generic project documentation' },
];

// ─── Página ───────────────────────────────────────────────────────────────────

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

  const [templates, setTemplates]                   = useState<any[]>([]);
  const [searchQuery, setSearchQuery]               = useState('');
  const [showCreateModal, setShowCreateModal]       = useState(false);
  const [selectedTemplate, setSelectedTemplate]     = useState('blank');
  const [selectedProjectType, setSelectedProjectType] = useState('software');
  const [newDocTitle, setNewDocTitle]               = useState('');
  const [isCreating, setIsCreating]                 = useState(false);
  const [searchFocused, setSearchFocused]           = useState(false);

  const canCreateDocument = userRole === 'OWNER' || userRole === 'ADMIN' || userRole === 'MEMBER';

  // Cargar templates
  useEffect(() => {
    const loadTemplates = async () => {
      const fallback = [
        { id: 'blank',                 name: t.documents_template_blank        || 'Blank Document',                iconName: 'File',         description: 'Start with an empty document' },
        { id: 'meeting-notes',         name: t.documents_template_meeting      || 'Meeting Notes',                 iconName: 'MessageSquare',description: 'Structured meeting notes' },
        { id: 'project-brief',         name: t.documents_template_project      || 'Project Brief',                 iconName: 'ClipboardList',description: 'Project overview' },
        { id: 'technical-spec',        name: t.documents_template_technical    || 'Technical Spec',                iconName: 'Settings',     description: 'Technical documentation' },
        { id: 'retrospective',         name: t.documents_template_retrospective|| 'Retrospective',                 iconName: 'RotateCcw',    description: 'Sprint retrospective' },
        { id: 'project-documentation', name: 'Complete Project Documentation',                                     iconName: 'BookOpen',     description: 'Comprehensive project documentation with adaptive sections' },
      ];
      try {
        const response = await apiService.get<{ templates: any[] }>('/api/documents/templates', true);
        if (response.success && (response.data?.templates?.length ?? 0) > 0) {
          setTemplates([fallback[0], ...(response.data!.templates ?? []).map((t: any) => ({ ...t, iconName: t.icon }))]);
        } else {
          setTemplates(fallback);
        }
      } catch {
        setTemplates(fallback);
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

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && workspaceId) fetchDocuments(workspaceId).catch(() => {});
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
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
      if (selectedTemplate === 'project-documentation') {
        documentData.metadata = { projectType: selectedProjectType };
      }
      await createDocument(workspaceId, documentData);
      setShowCreateModal(false);
      setNewDocTitle('');
      setSelectedTemplate('blank');
      setSelectedProjectType('software');
    } catch {
    } finally {
      setIsCreating(false);
    }
  };

  const closeModal = () => {
    if (isCreating) return;
    setShowCreateModal(false);
    setNewDocTitle('');
    setSelectedTemplate('blank');
    setSelectedProjectType('software');
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: C.surface, borderBottom: `1px solid ${C.border}`,
        padding: '0 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '52px' }}>
          {/* Left */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
            <BackBtn onClick={() => router.push(`/dashboard/workspaces/${workspaceId}`)} label={t.btn_back} />
            <div style={{ width: '1px', height: '18px', background: C.border2, flexShrink: 0 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '7px', flexShrink: 0,
                background: `${C.accent}18`, border: `1px solid ${C.accent}33`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <FileText style={{ width: '14px', height: '14px', color: C.accent }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.documents_section_title}
                </div>
                <div style={{ fontSize: '11px', color: C.text4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentWorkspace?.name || 'Workspace'}
                </div>
              </div>
            </div>
          </div>

          {/* Right */}
          {canCreateDocument && (
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 14px', borderRadius: '7px', fontSize: '13px', fontWeight: 500,
                background: C.accent, color: '#fff', border: 'none', cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <Plus style={{ width: '14px', height: '14px' }} />
              {t.documents_btn_new}
            </button>
          )}
        </div>

        {/* Search */}
        <div style={{ paddingBottom: '12px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '0 10px',
            background: C.bg2,
            border: `1px solid ${searchFocused ? C.accent : C.border}`,
            borderRadius: '7px',
            transition: 'border-color 0.15s',
          }}>
            <Search style={{ width: '13px', height: '13px', color: C.text4, flexShrink: 0 }} />
            <input
              type="text"
              placeholder={t.documents_search_placeholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                fontSize: '13px', color: C.text, padding: '8px 0',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text4, padding: '0 2px', lineHeight: 1 }}
              >
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" width="11" height="11">
                  <path d="M1 1l10 10M11 1L1 11" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, padding: '20px' }}>
        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                border: `2px solid ${C.accent}`, borderTopColor: 'transparent',
                margin: '0 auto 14px', animation: 'spin 0.7s linear infinite',
              }} />
              <p style={{ fontSize: '13px', color: C.text3 }}>{t.documents_loading}</p>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', textAlign: 'center' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '12px',
              background: `${C.accent}12`, border: `1px solid ${C.accent}25`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '16px',
            }}>
              <FileText style={{ width: '22px', height: '22px', color: C.text4 }} />
            </div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: C.text, marginBottom: '8px' }}>
              {searchQuery ? t.documents_no_results_title : t.documents_empty_ws_title}
            </h3>
            <p style={{ fontSize: '13px', color: C.text3, marginBottom: '24px', maxWidth: '320px', lineHeight: 1.6 }}>
              {searchQuery ? t.documents_no_results_desc : t.documents_empty_ws_desc}
            </p>
            {canCreateDocument && !searchQuery && (
              <button
                onClick={() => setShowCreateModal(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 18px', borderRadius: '7px', fontSize: '13px', fontWeight: 500,
                  background: C.accent, color: '#fff', border: 'none', cursor: 'pointer',
                }}
              >
                <Plus style={{ width: '14px', height: '14px' }} />
                {t.documents_btn_create}
              </button>
            )}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '12px',
          }}>
            {filteredDocuments.map((doc) => (
              <DocumentCard
                key={doc.id}
                document={doc}
                onClick={() => router.push(`/dashboard/workspaces/${workspaceId}/documents/${doc.id}`)}
                userTimezone={user?.timezone}
                userLanguage={user?.language as 'es' | 'en'}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── Modal crear documento ────────────────────────────────────────────── */}
      {showCreateModal && canCreateDocument && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px', overflowY: 'auto',
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div
            style={{
              width: '100%', maxWidth: '680px',
              background: '#13161b', border: `1px solid ${C.border}`,
              borderRadius: '12px', overflow: 'hidden',
              boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
              margin: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '18px 20px 16px', borderBottom: `1px solid ${C.border}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '7px',
                  background: `${C.accent}18`, border: `1px solid ${C.accent}33`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <FileEdit style={{ width: '13px', height: '13px', color: C.accent }} />
                </div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: C.text }}>{t.documents_modal_title}</div>
                  <div style={{ fontSize: '11.5px', color: C.text4 }}>Elige una plantilla o empieza desde cero</div>
                </div>
              </div>
              <CloseBtn onClick={closeModal} disabled={isCreating} />
            </div>

            {/* Modal body */}
            <div style={{ padding: '20px', maxHeight: '70vh', overflowY: 'auto' }}>

              {/* Título */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: C.text2, marginBottom: '6px' }}>
                  {t.documents_modal_label_title} <span style={{ color: C.red }}>*</span>
                </label>
                <TitleInput
                  value={newDocTitle}
                  onChange={(v) => setNewDocTitle(v)}
                  placeholder={t.documents_modal_placeholder_title}
                  disabled={isCreating}
                  onEnter={handleCreateDocument}
                />
              </div>

              {/* Plantillas */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: C.text2, marginBottom: '10px' }}>
                  {t.documents_modal_label_template}
                </label>
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px',
                  maxHeight: '300px', overflowY: 'auto', paddingRight: '2px',
                }}>
                  {templates.map((template: any) => {
                    const TemplateIcon = template.iconName ? getIconByName(template.iconName) : null;
                    const isSelected = selectedTemplate === template.id;
                    return (
                      <TemplateCard
                        key={template.id}
                        icon={TemplateIcon ? <TemplateIcon style={{ width: '16px', height: '16px', color: C.accent }} /> : <span style={{ fontSize: '18px' }}>{template.icon}</span>}
                        name={template.name}
                        description={template.description}
                        category={template.category}
                        selected={isSelected}
                        disabled={isCreating}
                        onClick={() => setSelectedTemplate(template.id)}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Tipo de proyecto */}
              {selectedTemplate === 'project-documentation' && (
                <div style={{
                  marginBottom: '18px', padding: '14px',
                  background: `${C.accent}0a`, border: `1px solid ${C.accent}22`,
                  borderRadius: '8px',
                }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: C.text2, marginBottom: '10px' }}>
                    Tipo de proyecto
                    <span style={{ fontSize: '11px', color: C.text4, fontWeight: 400, marginLeft: '8px' }}>
                      Personaliza las secciones según el tipo
                    </span>
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                    {PROJECT_TYPES.map((type) => {
                      const IconComponent = type.icon;
                      const isSel = selectedProjectType === type.id;
                      return (
                        <button
                          key={type.id}
                          onClick={() => setSelectedProjectType(type.id)}
                          disabled={isCreating}
                          style={{
                            padding: '10px', borderRadius: '7px', textAlign: 'left',
                            background: isSel ? `${C.accent}20` : C.surface,
                            border: `1px solid ${isSel ? C.accent : C.border}`,
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                            <IconComponent style={{ width: '13px', height: '13px', color: isSel ? C.accent : C.text3 }} />
                            <span style={{ fontSize: '11.5px', fontWeight: 500, color: isSel ? C.accent : C.text2 }}>{type.name}</span>
                          </div>
                          <div style={{ fontSize: '10.5px', color: C.text4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {type.description}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div style={{
              display: 'flex', gap: '8px', padding: '12px 20px 16px',
              borderTop: `1px solid ${C.border}`, background: '#111418',
            }}>
              <CancelBtn onClick={closeModal} disabled={isCreating} label={t.documents_btn_cancel} />
              <CreateBtn
                onClick={handleCreateDocument}
                disabled={!newDocTitle.trim() || isCreating}
                isCreating={isCreating}
                label={t.documents_btn_create_confirm}
                loadingLabel={t.documents_btn_creating}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DocumentCard ─────────────────────────────────────────────────────────────

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function contentPreview(text: string, maxChars = 120): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  return clean.length > maxChars ? clean.slice(0, maxChars).trimEnd() + '…' : clean;
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
  const [hovered, setHovered] = useState(false);

  const preview = contentPreview(document.content || '');
  const words   = wordCount(document.content || '');
  const updatedDate = formatShort(new Date(document.updatedAt), userTimezone, userLanguage);
  const createdDate = formatShort(new Date(document.createdAt), userTimezone, userLanguage);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', flexDirection: 'column', textAlign: 'left',
        padding: '0', borderRadius: '10px', cursor: 'pointer',
        background: hovered ? C.hover : C.surface,
        border: `1px solid ${hovered ? C.border2 : C.border}`,
        transition: 'background 0.12s, border-color 0.12s',
        boxShadow: hovered ? '0 4px 20px rgba(0,0,0,0.3)' : 'none',
        overflow: 'hidden',
      }}
    >
      {/* Preview area */}
      <div style={{
        height: '80px', width: '100%', overflow: 'hidden',
        background: C.bg2,
        borderBottom: `1px solid ${C.border}`,
        padding: '12px 14px',
        position: 'relative',
      }}>
        {preview ? (
          <p style={{
            fontSize: '11px', lineHeight: 1.6, color: C.text3,
            margin: 0, overflow: 'hidden',
            display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical',
          }}>
            {preview}
          </p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <FileText style={{ width: '22px', height: '22px', color: C.text4, opacity: 0.4 }} />
          </div>
        )}
        {/* Fade at bottom */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '28px',
          background: `linear-gradient(transparent, ${C.bg2})`,
          pointerEvents: 'none',
        }} />
      </div>

      {/* Card body */}
      <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>

        {/* Title */}
        <h3 style={{
          fontSize: '13px', fontWeight: 600, color: C.text,
          margin: 0, lineHeight: 1.4,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {document.title}
        </h3>

        {/* Metadata pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {words > 0 && (
            <span style={{
              fontSize: '10.5px', color: C.text4,
              background: C.bg2, border: `1px solid ${C.border}`,
              borderRadius: '4px', padding: '1px 6px',
            }}>
              {words.toLocaleString()} {userLanguage === 'es' ? 'palabras' : 'words'}
            </span>
          )}
        </div>

        {/* Footer timestamps */}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Clock style={{ width: '10px', height: '10px', color: C.text4, flexShrink: 0 }} />
            <span style={{ fontSize: '10.5px', color: C.text4 }}>
              {t.documents_updated(updatedDate)}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <FileText style={{ width: '10px', height: '10px', color: C.text4, flexShrink: 0 }} />
            <span style={{ fontSize: '10.5px', color: C.text4 }}>
              {userLanguage === 'es' ? 'Creado' : 'Created'} {createdDate}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function BackBtn({ onClick, label }: { onClick: () => void; label: string }) {
  const [h, setH] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '5px 10px', borderRadius: '7px', fontSize: '12.5px', fontWeight: 500,
        background: h ? C.hover : 'transparent', border: `1px solid ${h ? C.border2 : 'transparent'}`,
        color: h ? C.text : C.text3, cursor: 'pointer', transition: 'all 0.12s', flexShrink: 0,
      }}
    >
      <ArrowLeft style={{ width: '13px', height: '13px' }} />
      {label}
    </button>
  );
}

function CloseBtn({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  const [h, setH] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        width: '26px', height: '26px', borderRadius: '6px',
        background: h ? C.hover : 'transparent', border: 'none',
        color: h ? C.text2 : C.text4, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" width="11" height="11">
        <path d="M1 1l10 10M11 1L1 11" />
      </svg>
    </button>
  );
}

function TitleInput({ value, onChange, placeholder, disabled, onEnter }: {
  value: string; onChange: (v: string) => void; placeholder: string;
  disabled?: boolean; onEnter: () => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onKeyDown={(e) => e.key === 'Enter' && onEnter()}
      style={{
        width: '100%', padding: '9px 12px', borderRadius: '7px',
        background: C.surface, border: `1px solid ${focused ? C.accent : C.border}`,
        color: C.text, fontSize: '13px', outline: 'none',
        transition: 'border-color 0.15s', boxSizing: 'border-box',
      }}
    />
  );
}

function TemplateCard({ icon, name, description, category, selected, disabled, onClick }: {
  icon: React.ReactNode; name: string; description?: string; category?: string;
  selected: boolean; disabled?: boolean; onClick: () => void;
}) {
  const [h, setH] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        padding: '12px', borderRadius: '8px', textAlign: 'left', cursor: 'pointer',
        background: selected ? `${C.accent}18` : h ? C.hover : C.surface,
        border: `1px solid ${selected ? C.accent : h ? C.border2 : C.border}`,
        transition: 'all 0.12s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <div style={{ flexShrink: 0, marginTop: '1px' }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '12.5px', fontWeight: 500, color: selected ? C.accent : C.text, marginBottom: '3px' }}>
            {name}
          </div>
          {description && (
            <div style={{ fontSize: '11px', color: C.text4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {description}
            </div>
          )}
          {category && (
            <div style={{ fontSize: '10.5px', color: C.text4, marginTop: '2px' }}>{category}</div>
          )}
        </div>
      </div>
    </button>
  );
}

function CancelBtn({ onClick, disabled, label }: { onClick: () => void; disabled?: boolean; label: string }) {
  const [h, setH] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        flex: 1, padding: '8px 0', borderRadius: '7px', fontSize: '13px', fontWeight: 500,
        background: h ? C.border : C.hover, border: `1px solid ${C.border2}`,
        color: h ? C.text : C.text2, cursor: 'pointer', transition: 'all 0.12s',
      }}
    >
      {label}
    </button>
  );
}

function CreateBtn({ onClick, disabled, isCreating, label, loadingLabel }: {
  onClick: () => void; disabled?: boolean; isCreating: boolean; label: string; loadingLabel: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
        padding: '8px 0', borderRadius: '7px', fontSize: '13px', fontWeight: 500,
        background: C.accent, color: '#fff', border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        transition: 'opacity 0.12s',
      }}
    >
      {isCreating ? (
        <>
          <svg className="animate-spin" viewBox="0 0 16 16" fill="none" width="13" height="13">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" />
          </svg>
          {loadingLabel}
        </>
      ) : (
        <>
          <FileEdit style={{ width: '13px', height: '13px' }} />
          {label}
        </>
      )}
    </button>
  );
}
