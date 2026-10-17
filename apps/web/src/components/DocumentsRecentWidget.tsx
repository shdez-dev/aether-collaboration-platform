'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowDownAZ, ArrowDownWideNarrow, ArrowRight, ArrowUpRight, FileClock, FileText, FolderKanban, RefreshCw } from 'lucide-react';
import type { Document } from '@aether/types';
import { apiService } from '@/services/apiService';
import { socketService } from '@/services/socketService';
import type { SidebarProject } from '@/stores/activeWorkspaceStore';
import styles from './DocumentsRecentWidget.module.css';

type RecentDocument = Document;
type DocumentScope = 'all' | 'workspace' | 'project';
type SortOrder = 'recent' | 'title';
type Snapshot = { workspaceId: string | null; documents: RecentDocument[]; loading: boolean; error: string | null };

const DOC_ACCENT = '#6987b8';

function plainText(content: string | null | undefined) {
  return (content ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

function relativeDate(value: string, now: number) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Fecha desconocida';
  const minutes = Math.max(0, Math.floor((now - date.getTime()) / 60_000));
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Ayer';
  if (days < 7) return `Hace ${days} días`;
  return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

function DocumentSkeleton() {
  return <div className={styles.skeletonList} role="status" aria-label="Cargando documentos recientes">
    {[0, 1, 2].map((item) => <div className={styles.skeletonCard} key={item}><i /><span><b /><small /><em /></span></div>)}
  </div>;
}

export function DocumentsRecentWidget({ workspaceId, projects }: { workspaceId: string | null; projects: SidebarProject[] }) {
  const [snapshot, setSnapshot] = useState<Snapshot>({ workspaceId: null, documents: [], loading: true, error: null });
  const [scope, setScope] = useState<DocumentScope>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('recent');
  const [refreshKey, setRefreshKey] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const projectNames = useMemo(() => new Map(projects.map((project) => [project.id, project.name])), [projects]);
  const isLoading = snapshot.workspaceId !== workspaceId || snapshot.loading;
  const error = snapshot.workspaceId === workspaceId ? snapshot.error : null;
  const retry = useCallback(() => setRefreshKey((value) => value + 1), []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    if (!workspaceId) {
      setSnapshot({ workspaceId: null, documents: [], loading: false, error: null });
      return () => { active = false; };
    }
    setSnapshot((current) => ({ workspaceId, documents: current.workspaceId === workspaceId ? current.documents : [], loading: true, error: null }));
    void apiService.get<{ documents: RecentDocument[]; total?: number }>(`/api/workspaces/${workspaceId}/documents?sortBy=updatedAt&sortOrder=desc&limit=100&offset=0`, true)
      .then((response) => {
        if (!active) return;
        if (!response.success || !response.data) throw new Error(response.error?.message ?? 'No se pudieron cargar los documentos.');
        setSnapshot({ workspaceId, documents: response.data.documents ?? [], loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (active) setSnapshot((current) => ({ ...current, loading: false, error: error instanceof Error ? error.message : 'No se pudieron cargar los documentos.' }));
      });
    return () => { active = false; };
  }, [workspaceId, refreshKey]);

  useEffect(() => {
    if (!workspaceId) return;
    const owner = 'dashboard-documents-recent';
    const invalidate = (update: { workspaceId?: string; resource?: string }) => {
      if (update?.workspaceId === workspaceId && (update.resource === 'documents' || update.resource === 'all')) retry();
    };
    socketService.joinWorkspace(workspaceId, owner);
    socketService.on('workspace:invalidate', invalidate);
    return () => {
      socketService.off('workspace:invalidate', invalidate);
      socketService.leaveWorkspace(workspaceId, owner);
    };
  }, [workspaceId, retry]);

  const scopedDocuments = snapshot.workspaceId === workspaceId ? snapshot.documents : [];
  const documents = useMemo(() => [...scopedDocuments].sort((left, right) => sortOrder === 'title'
    ? left.title.localeCompare(right.title, 'es')
    : new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()), [scopedDocuments, sortOrder]);
  const filtered = useMemo(() => documents.filter((document) => scope === 'all' || (scope === 'project' ? Boolean(document.projectId) : !document.projectId)), [documents, scope]);
  const counts = useMemo(() => ({
    all: documents.length,
    workspace: documents.filter((document) => !document.projectId).length,
    project: documents.filter((document) => Boolean(document.projectId)).length,
  }), [documents]);
  const visible = filtered.slice(0, 4);

  return <section className={styles.widget} aria-label="Documentos recientes" aria-busy={isLoading}>
    <header className={styles.header}>
      <div className={styles.heading}>
        <div className={styles.headingCopy}>
          <div className={styles.titleLine}><h3>Documentos recientes</h3><span className={styles.count}>{isLoading && documents.length === 0 ? '…' : filtered.length}</span></div>
        </div>
      </div>
      <Link href="/dashboard/documents" className={styles.openLibrary}>Biblioteca <ArrowUpRight size={14} /></Link>
    </header>

    <div className={styles.tools}>
      <div className={styles.scopes} role="group" aria-label="Filtrar documentos">
        {([
          ['all', 'Todo'], ['workspace', 'Espacio'], ['project', 'Proyectos'],
        ] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={scope === key} onClick={() => setScope(key)}>
          {label}<small>{counts[key]}</small>
        </button>)}
      </div>
      <button className={styles.sortButton} type="button" onClick={() => setSortOrder((current) => current === 'recent' ? 'title' : 'recent')} aria-label={sortOrder === 'recent' ? 'Ordenar alfabéticamente' : 'Ordenar por actualización reciente'} title={sortOrder === 'recent' ? 'Orden: más recientes' : 'Orden: A–Z'}>
        {sortOrder === 'recent' ? <ArrowDownWideNarrow size={13} /> : <ArrowDownAZ size={13} />}<span>{sortOrder === 'recent' ? 'Recientes' : 'A–Z'}</span>
      </button>
    </div>

    {error && <div className={styles.error} role="alert"><span>{error}</span><button type="button" onClick={retry}><RefreshCw size={12} /> Reintentar</button></div>}

    <div className={styles.content}>
      {!workspaceId && !isLoading ? <div className={styles.noWorkspace}><FolderKanban size={14} />Selecciona un espacio para ver sus documentos.</div> : isLoading && documents.length === 0 ? <DocumentSkeleton /> : visible.length > 0 ? <div className={styles.documentList}>
        {visible.map((document, index) => {
          const isProject = Boolean(document.projectId);
          const snippet = plainText(document.description) || plainText(document.content) || 'Un lienzo en blanco, listo para tus ideas.';
          const projectName = document.projectId ? projectNames.get(document.projectId) : null;
          const accent = isProject ? '#9675cc' : DOC_ACCENT;
          return <Link key={document.id} className={`${styles.documentCard} ${sortOrder === 'recent' && index === 0 ? styles.mostRecent : ''}`} href={`/dashboard/documents/${document.id}`} style={{ '--document-accent': accent } as CSSProperties} aria-label={`Abrir ${document.title || 'Documento sin título'}, actualizado ${relativeDate(document.updatedAt, now)}`}>
            <span className={styles.documentIcon}>{isProject ? <FolderKanban size={16} strokeWidth={1.8} /> : <FileText size={16} strokeWidth={1.8} />}</span>
            <span className={styles.documentCopy}>
              <strong>{document.title?.trim() || 'Documento sin título'}</strong>
              <small>{snippet}</small>
              <span className={styles.documentMeta}><i />{isProject ? projectName || 'Documento de proyecto' : 'Documento del espacio'}<em>{relativeDate(document.updatedAt, now)}</em></span>
            </span>
            <ArrowRight className={styles.cardArrow} size={15} aria-hidden="true" />
          </Link>;
        })}
        {filtered.length > 4 && <Link className={styles.moreLink} href="/dashboard/documents">Ver {filtered.length - 4} documentos más <ArrowRight size={12} /></Link>}
      </div> : !error ? <div className={styles.emptyState}>
        <span className={styles.emptyIcon}><FileClock size={19} /></span>
        <span><strong>{documents.length ? 'No hay resultados en este filtro' : 'Tu biblioteca empieza aquí'}</strong><small>{documents.length ? 'Cambia el filtro para explorar los demás documentos.' : 'Tus notas y documentos recientes aparecerán en este espacio.'}</small></span>
        {documents.length ? <button type="button" onClick={() => setScope('all')} aria-label="Mostrar todos los documentos"><RefreshCw size={14} /></button> : <Link href="/dashboard/documents" aria-label="Abrir biblioteca de documentos"><ArrowUpRight size={15} /></Link>}
      </div> : null}
    </div>

    <footer className={styles.footer}>
      <span><i />{counts.workspace} del espacio <b>·</b> {counts.project} de proyectos</span>
      <Link href="/dashboard/documents">Abrir biblioteca <ArrowRight size={12} /></Link>
    </footer>
  </section>;
}
