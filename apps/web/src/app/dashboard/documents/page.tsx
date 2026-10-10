'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, FileText, FolderKanban, LayoutGrid, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import type { Document } from '@aether/types';
import { apiService } from '@/services/apiService';
import { useDocumentStore } from '@/stores/documentStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useActiveWorkspaceStore } from '@/stores/activeWorkspaceStore';
import { ProjectOptionSelect } from '@/components/ProjectOptionSelect';
import styles from './documents.module.css';

type LibraryDocument = Document & { workspaceName: string };
type Scope = 'all' | 'workspace' | 'project';
type SortOrder = 'recent' | 'oldest' | 'title';

function plainText(content: string) {
  return (content || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function relativeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days < 1) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days < 7) return `Hace ${days} días`;
  return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
}

function CreateDocumentDialog({ workspaceId, workspaceName, onClose, onCreated }: {
  workspaceId: string; workspaceName: string; onClose: () => void; onCreated: (document: Document) => void;
}) {
  const createDocument = useDocumentStore(state => state.createDocument);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, saving]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    setError('');
    try {
      onCreated(await createDocument(workspaceId, { title: title.trim(), description: description.trim() }));
    } catch {
      setError('No se pudo crear el documento. Inténtalo de nuevo.');
      setSaving(false);
    }
  }

  return <div className={styles.backdrop} onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <form className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="new-document-title" onSubmit={submit}>
      <button className={styles.closeButton} type="button" aria-label="Cerrar" onClick={onClose} disabled={saving}><X size={18} /></button>
      <span className={styles.dialogIcon}><FileText size={20} /></span>
      <h2 id="new-document-title">Nuevo documento</h2>
      <p>Comienza en blanco y dale forma con tu equipo. Se guardará en <strong>{workspaceName}</strong>.</p>
      <label htmlFor="document-title">Título del documento</label>
      <input id="document-title" ref={input} value={title} onChange={event => setTitle(event.target.value)} placeholder="Por ejemplo, notas de la reunión" maxLength={180} required />
      <small className={styles.fieldCount}>{title.length}/180</small>
      <label htmlFor="document-description">Descripción (opcional)</label>
      <textarea id="document-description" value={description} onChange={event => setDescription(event.target.value)} placeholder="¿De qué trata este documento?" maxLength={300} rows={2} />
      <small className={styles.fieldCount}>{description.length}/300</small>
      {error && <p className={styles.formError} role="alert">{error}</p>}
      <div className={styles.dialogActions}>
        <button type="button" className={styles.secondaryButton} onClick={onClose} disabled={saving}>Cancelar</button>
        <button type="submit" className={styles.primaryButton} disabled={!title.trim() || saving}>{saving ? 'Creando…' : 'Crear documento'} <ArrowRight size={15} /></button>
      </div>
    </form>
  </div>;
}

function DocumentCard({ document, projectName, onOpen, index }: {
  document: LibraryDocument; projectName?: string; onOpen: () => void; index: number;
}) {
  const content = plainText(document.content);
  const words = content ? content.split(/\s+/).length : 0;
  const isProject = Boolean(document.projectId);
  return <button type="button" className={styles.documentCard} style={{ animationDelay: `${Math.min(index, 9) * 35}ms` }} onClick={onOpen} aria-label={`Abrir documento ${document.title || 'Sin título'}`}>
    <span className={`${styles.documentIcon} ${isProject ? styles.projectIcon : ''}`} aria-hidden="true">{isProject ? <FolderKanban size={21} /> : <FileText size={21} />}</span>
    <span className={styles.documentBody}>
      <strong className={styles.documentTitle}>{document.title || 'Sin título'}</strong>
      <span className={styles.documentSnippet}>{document.description || content || 'Un lienzo en blanco listo para tus ideas.'}</span>
      <span className={styles.documentMeta}>
        <span className={styles.contextPill}>{isProject ? (projectName || 'Proyecto') : document.workspaceName}</span>
        {isProject && <span>{document.workspaceName}</span>}
        <span>{words ? `${words} palabras` : 'Sin contenido'}</span>
        <span className={styles.metaDot} aria-hidden="true" />
        <span>{relativeDate(document.updatedAt)}</span>
      </span>
    </span>
    <ArrowRight className={styles.cardArrow} size={18} aria-hidden="true" />
  </button>;
}

export default function DocumentsPage() {
  const router = useRouter();
  const workspaces = useWorkspaceStore(state => state.workspaces);
  const activeWorkspaceId = useActiveWorkspaceStore(state => state.activeWorkspaceId);
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [projectNames, setProjectNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [scope, setScope] = useState<Scope>('all');
  const [workspaceFilter, setWorkspaceFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('recent');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setLoadError('');
      try {
      const results = await Promise.all(workspaces.map(async workspace => {
        const docs: LibraryDocument[] = [];
        let offset = 0;
        let failed = false;
        do {
          const response = await apiService.get<{ documents: Document[]; total: number }>(`/api/workspaces/${workspace.id}/documents?limit=100&offset=${offset}`, true);
          if (!response.success || !response.data) { failed = true; break; }
          docs.push(...response.data.documents.map(document => ({ ...document, workspaceName: workspace.name })));
          offset += response.data.documents.length;
          if (!response.data.documents.length || offset >= response.data.total) break;
        } while (true);
        const projectResponse = docs.some(document => document.projectId)
          ? await apiService.get<{ projects: { id: string; name: string }[] }>(`/api/workspaces/${workspace.id}/projects`, true)
          : null;
        return { docs, failed, projects: projectResponse?.success ? (projectResponse.data?.projects ?? []) : [] };
      }));
      if (!alive) return;
      setDocuments(Array.from(new Map(results.flatMap(result => result.docs).map(document => [document.id, document])).values()));
      setProjectNames(Object.fromEntries(results.flatMap(result => result.projects).map(project => [project.id, project.name])));
      if (results.some(result => result.failed)) setLoadError('Algunos documentos no se pudieron cargar. Puedes reintentar.');
      setLoading(false);
      } catch {
        if (alive) { setLoadError('No se pudo cargar la biblioteca. Puedes reintentar.'); setLoading(false); }
      }
    }
    void load();
    return () => { alive = false; };
  }, [workspaces, reloadKey]);

  const workspaceDocs = useMemo(() => documents.filter(document => !document.projectId), [documents]);
  const projectDocs = useMemo(() => documents.filter(document => Boolean(document.projectId)), [documents]);
  const activeWorkspace = workspaces.find(workspace => workspace.id === activeWorkspaceId) ?? workspaces[0];
  const createWorkspace = workspaces.find(workspace => workspace.id === workspaceFilter) ?? activeWorkspace;
  const projectOptions = useMemo(() => Array.from(new Set(projectDocs.filter(document => workspaceFilter === 'all' || document.workspaceId === workspaceFilter).map(document => document.projectId as string))).map(id => ({ value: id, label: projectNames[id] || 'Proyecto' })).sort((a, b) => a.label.localeCompare(b.label, 'es')), [projectDocs, workspaceFilter, projectNames]);
  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es');
    return documents.filter(document =>
      (workspaceFilter === 'all' || document.workspaceId === workspaceFilter) &&
      (projectFilter === 'all' || document.projectId === projectFilter) &&
      (!term || `${document.title} ${document.description ?? ''} ${plainText(document.content)} ${document.workspaceName} ${projectNames[document.projectId || ''] || ''}`.toLocaleLowerCase('es').includes(term))
    ).sort((a, b) => sortOrder === 'title'
      ? a.title.localeCompare(b.title, 'es')
      : sortOrder === 'oldest' ? new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
        : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [documents, workspaceFilter, projectFilter, search, sortOrder, projectNames]);
  const visibleWorkspace = visible.filter(document => !document.projectId);
  const visibleProject = visible.filter(document => Boolean(document.projectId));
  const hasFilters = Boolean(search || workspaceFilter !== 'all' || projectFilter !== 'all');

  return <main className={styles.page}>
    <div className={styles.content}>
      <header className={styles.header}>
        <div><span className={styles.eyebrow}>TU BIBLIOTECA</span><h1>Documentos</h1><p>Ideas, acuerdos y recursos de tus espacios y proyectos, en un solo lugar.</p></div>
        <button type="button" className={styles.primaryButton} onClick={() => setShowCreate(true)} disabled={!createWorkspace}><Plus size={17} /> Nuevo documento</button>
      </header>

      <div className={styles.scopeCards} role="group" aria-label="Tipo de documento">
        <button type="button" className={`${styles.scopeCard} ${scope === 'all' ? styles.scopeActive : ''}`} aria-pressed={scope === 'all'} onClick={() => setScope('all')}><span className={styles.scopeIcon}><LayoutGrid size={20} /></span><span><strong>Todos</strong><small>La biblioteca completa</small></span><b>{loading ? '…' : documents.length}</b></button>
        <button type="button" className={`${styles.scopeCard} ${scope === 'workspace' ? styles.scopeActive : ''}`} aria-pressed={scope === 'workspace'} onClick={() => { setScope('workspace'); setProjectFilter('all'); }}><span className={styles.scopeIcon}><FileText size={20} /></span><span><strong>Del espacio</strong><small>Notas y recursos compartidos</small></span><b>{loading ? '…' : workspaceDocs.length}</b></button>
        <button type="button" className={`${styles.scopeCard} ${scope === 'project' ? styles.scopeActive : ''}`} aria-pressed={scope === 'project'} onClick={() => setScope('project')}><span className={styles.scopeIcon}><FolderKanban size={20} /></span><span><strong>De proyectos</strong><small>Documentación vinculada</small></span><b>{loading ? '…' : projectDocs.length}</b></button>
      </div>

      <div className={styles.toolbar}>
        <label className={styles.search}><Search size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por título, descripción o contenido…" aria-label="Buscar documentos" />{search && <button type="button" aria-label="Limpiar búsqueda" onClick={() => setSearch('')}><X size={15} /></button>}</label>
        <span className={styles.filterLabel}><SlidersHorizontal size={15} /> Filtros</span>
        <div className={styles.select}><ProjectOptionSelect label="Filtrar por espacio" value={workspaceFilter} onChange={value => { setWorkspaceFilter(value); setProjectFilter('all'); }} options={[{ value: 'all', label: 'Todos los espacios' }, ...workspaces.map(workspace => ({ value: workspace.id, label: workspace.name }))]} /></div>
        {(scope !== 'workspace' && projectOptions.length > 1) && <div className={styles.select}><ProjectOptionSelect label="Filtrar por proyecto" value={projectFilter} onChange={setProjectFilter} options={[{ value: 'all', label: 'Todos los proyectos' }, ...projectOptions]} /></div>}
        <div className={`${styles.select} ${styles.sortSelect}`}><ProjectOptionSelect label="Ordenar documentos" value={sortOrder} onChange={value => setSortOrder(value as SortOrder)} options={[{ value: 'recent', label: 'Más recientes' }, { value: 'oldest', label: 'Más antiguos' }, { value: 'title', label: 'Por título' }]} /></div>
      </div>

      {loadError && <div className={styles.loadError} role="alert">{loadError} <button type="button" onClick={() => setReloadKey(key => key + 1)}>Reintentar</button></div>}
      {loading ? <div className={styles.loading} role="status"><span className={styles.spinner} />Cargando tu biblioteca…</div> : loadError && !documents.length ? null : <>
        {!visible.length && hasFilters && <div className={styles.noResults}><Search size={25} /><strong>Sin resultados para estos filtros</strong><p>Prueba otra búsqueda o explora todos los espacios.</p><button type="button" onClick={() => { setSearch(''); setWorkspaceFilter('all'); setProjectFilter('all'); setScope('all'); }}>Limpiar filtros</button></div>}
        {(scope === 'all' || scope === 'workspace') && (!hasFilters || visibleWorkspace.length > 0) && <section className={styles.section} aria-labelledby="workspace-documents-title">
          <div className={styles.sectionHeading}><span className={styles.sectionSymbol}><FileText size={18} /></span><div><h2 id="workspace-documents-title">Documentos del espacio <span>{visibleWorkspace.length}</span></h2><p>Notas, guías y material compartido que no pertenecen a un proyecto.</p></div></div>
          {visibleWorkspace.length ? <div className={styles.grid}>{visibleWorkspace.map((document, index) => <DocumentCard key={document.id} document={document} index={index} onOpen={() => router.push(`/dashboard/documents/${document.id}`)} />)}</div> : <div className={styles.emptySection}><FileText size={23} /><strong>Aún no hay documentos del espacio</strong><p>Crea uno para compartir ideas y recursos con tu equipo.</p><button type="button" onClick={() => setShowCreate(true)}>Crear documento <ArrowRight size={14} /></button></div>}
        </section>}
        {(scope === 'all' || scope === 'project') && (!hasFilters || visibleProject.length > 0) && <section className={styles.section} aria-labelledby="project-documents-title">
          <div className={styles.sectionHeading}><span className={`${styles.sectionSymbol} ${styles.projectSymbol}`}><FolderKanban size={18} /></span><div><h2 id="project-documents-title">Documentos de proyectos <span>{visibleProject.length}</span></h2><p>Contenido ligado a un proyecto, con su contexto siempre a la vista.</p></div></div>
          {visibleProject.length ? <div className={styles.grid}>{visibleProject.map((document, index) => <DocumentCard key={document.id} document={document} projectName={projectNames[document.projectId || '']} index={index} onOpen={() => router.push(`/dashboard/documents/${document.id}`)} />)}</div> : <div className={styles.emptySection}><FolderKanban size={23} /><strong>Sin documentos de proyectos todavía</strong><p>Los documentos vinculados desde un proyecto aparecerán aquí.</p></div>}
        </section>}
      </>}
    </div>
    {showCreate && createWorkspace && <CreateDocumentDialog workspaceId={createWorkspace.id} workspaceName={createWorkspace.name} onClose={() => setShowCreate(false)} onCreated={document => { setShowCreate(false); router.push(`/dashboard/documents/${document.id}`); }} />}
  </main>;
}
