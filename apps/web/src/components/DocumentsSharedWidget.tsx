'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowDownAZ, ArrowDownWideNarrow, ArrowRight, ArrowUpRight, FileText, FolderKanban, RefreshCw, Share2, UserRound } from 'lucide-react';
import type { Document } from '@aether/types';
import { apiService } from '@/services/apiService';
import { socketService } from '@/services/socketService';
import { useAuthStore } from '@/stores/authStore';
import type { SidebarProject } from '@/stores/activeWorkspaceStore';
import styles from './DocumentsSharedWidget.module.css';

type SharedDocument = Document & { creator?: { id?: string; name?: string; avatar?: string | null } };
type DocumentScope = 'all' | 'workspace' | 'project';
type SortOrder = 'recent' | 'title';
type Snapshot = { workspaceId: string | null; documents: SharedDocument[]; loading: boolean; error: string | null };

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

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase('es-CL') || '?';
}

function SharedSkeleton() {
  return <div className={styles.skeletonList} role="status" aria-label="Cargando documentos compartidos">
    {[0, 1, 2].map((item) => <div className={styles.skeletonCard} key={item}><i /><span><b /><small /><em /></span></div>)}
  </div>;
}

export function DocumentsSharedWidget({ workspaceId, projects }: { workspaceId: string | null; projects: SidebarProject[] }) {
  const userId = useAuthStore((state) => state.user?.id);
  const [snapshot, setSnapshot] = useState<Snapshot>({ workspaceId: null, documents: [], loading: true, error: null });
  const [scope, setScope] = useState<DocumentScope>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('recent');
  const [person, setPerson] = useState('all');
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
    void apiService.get<{ documents: SharedDocument[]; total?: number }>(`/api/workspaces/${workspaceId}/documents?sortBy=updatedAt&sortOrder=desc&limit=100&offset=0`, true)
      .then((response) => {
        if (!active) return;
        if (!response.success || !response.data) throw new Error(response.error?.message ?? 'No se pudieron cargar los documentos compartidos.');
        setSnapshot({ workspaceId, documents: response.data.documents ?? [], loading: false, error: null });
      })
      .catch((cause: unknown) => {
        if (active) setSnapshot((current) => ({ ...current, loading: false, error: cause instanceof Error ? cause.message : 'No se pudieron cargar los documentos compartidos.' }));
      });
    return () => { active = false; };
  }, [workspaceId, refreshKey]);

  useEffect(() => {
    if (!workspaceId) return;
    const owner = 'dashboard-documents-shared';
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

  const sharedDocuments = useMemo(() => (snapshot.workspaceId === workspaceId ? snapshot.documents : [])
    .filter((document) => Boolean(userId) && document.createdBy !== userId), [snapshot.documents, snapshot.workspaceId, userId, workspaceId]);
  const people = useMemo(() => {
    const unique = new Map<string, { id: string; name: string }>();
    sharedDocuments.forEach((document) => {
      const id = document.creator?.id || document.createdBy;
      unique.set(id, { id, name: document.creator?.name?.trim() || 'Alguien del espacio' });
    });
    return [...unique.values()].sort((left, right) => left.name.localeCompare(right.name, 'es'));
  }, [sharedDocuments]);
  const activePerson = people.some((item) => item.id === person) ? person : 'all';
  const sortedDocuments = useMemo(() => [...sharedDocuments].sort((left, right) => sortOrder === 'title'
    ? left.title.localeCompare(right.title, 'es')
    : new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()), [sharedDocuments, sortOrder]);
  const scopedDocuments = useMemo(() => sortedDocuments.filter((document) => {
    const matchesScope = scope === 'all' || (scope === 'project' ? Boolean(document.projectId) : !document.projectId);
    const matchesPerson = activePerson === 'all' || (document.creator?.id || document.createdBy) === activePerson;
    return matchesScope && matchesPerson;
  }), [activePerson, scope, sortedDocuments]);
  const counts = useMemo(() => ({
    all: sharedDocuments.length,
    workspace: sharedDocuments.filter((document) => !document.projectId).length,
    project: sharedDocuments.filter((document) => Boolean(document.projectId)).length,
  }), [sharedDocuments]);
  const visible = scopedDocuments.slice(0, 4);

  return <section className={styles.widget} aria-label="Documentos compartidos conmigo" aria-busy={isLoading}>
    <header className={styles.header}>
      <div className={styles.heading}>
        <strong className={styles.headingLabel}>Documentos compartidos</strong>
      </div>
    </header>

    <div className={styles.tools}>
      <div className={styles.scopes} role="group" aria-label="Filtrar documentos compartidos">
        {([
          ['all', 'Todo'], ['workspace', 'Espacio'], ['project', 'Proyectos'],
        ] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={scope === key} onClick={() => setScope(key)}>
          {label}<small>{counts[key]}</small>
        </button>)}
      </div>
      <div className={styles.personalTools}>
        {people.length > 1 && <label className={styles.personFilter}>
          <UserRound size={12} aria-hidden="true" />
          <span className={styles.visuallyHidden}>Filtrar por persona</span>
          <select value={activePerson} onChange={(event) => setPerson(event.target.value)} aria-label="Filtrar por persona">
            <option value="all">Todas las personas</option>
            {people.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>}
        <button className={styles.sortButton} type="button" onClick={() => setSortOrder((current) => current === 'recent' ? 'title' : 'recent')} aria-label={sortOrder === 'recent' ? 'Ordenar alfabéticamente' : 'Ordenar por actualización reciente'} title={sortOrder === 'recent' ? 'Orden: más recientes' : 'Orden: A–Z'}>
          {sortOrder === 'recent' ? <ArrowDownWideNarrow size={13} /> : <ArrowDownAZ size={13} />}<span>{sortOrder === 'recent' ? 'Recientes' : 'A–Z'}</span>
        </button>
      </div>
    </div>

    {error && <div className={styles.error} role="alert"><span>{error}</span><button type="button" onClick={retry}><RefreshCw size={12} /> Reintentar</button></div>}

    <div className={styles.content}>
      {!workspaceId && !isLoading ? <div className={styles.noWorkspace}><FolderKanban size={14} />Selecciona un espacio para ver los documentos compartidos contigo.</div> : isLoading && sharedDocuments.length === 0 ? <SharedSkeleton /> : visible.length > 0 ? <div className={styles.documentList}>
        {visible.map((document, index) => {
          const isProject = Boolean(document.projectId);
          const creatorName = document.creator?.name?.trim() || 'Alguien del espacio';
          const projectName = document.projectId ? projectNames.get(document.projectId) : null;
          return <Link key={document.id} className={`${styles.documentCard} ${sortOrder === 'recent' && index === 0 ? styles.mostRecent : ''}`} href={`/dashboard/documents/${document.id}`} style={{ '--document-accent': '#9675cc' } as CSSProperties} aria-label={`Abrir ${document.title || 'Documento sin título'}, compartido por ${creatorName}`}>
            <span className={styles.ownerAvatar} aria-hidden="true">
              {document.creator?.avatar ? <img src={document.creator.avatar} alt="" /> : initials(creatorName)}
            </span>
            <span className={styles.documentCopy}>
              <strong>{document.title?.trim() || 'Documento sin título'}</strong>
              <small><span>De {creatorName}</span><i>·</i><span>{isProject ? projectName || 'Documento de proyecto' : 'Documento del espacio'}</span></small>
              <span className={styles.documentMeta}><i />Actualizado<em>{relativeDate(document.updatedAt, now)}</em></span>
            </span>
            <span className={styles.documentKind}>{isProject ? <FolderKanban size={13} /> : <FileText size={13} />}</span>
            <ArrowRight className={styles.cardArrow} size={15} aria-hidden="true" />
          </Link>;
        })}
        {scopedDocuments.length > 4 && <Link className={styles.moreLink} href="/dashboard/documents">Ver {scopedDocuments.length - 4} documentos más <ArrowRight size={12} /></Link>}
      </div> : !error ? <div className={styles.emptyState}>
        <span className={styles.emptyIcon}><Share2 size={19} /></span>
        <span><strong>{sharedDocuments.length ? 'No hay resultados en esta vista' : 'Tu bandeja compartida está tranquila'}</strong><small>{sharedDocuments.length ? 'Prueba con otra ubicación o persona para encontrar un documento.' : 'Cuando alguien comparta un documento contigo, aparecerá aquí.'}</small></span>
        {sharedDocuments.length ? <button type="button" onClick={() => { setScope('all'); setPerson('all'); }} aria-label="Mostrar todos los documentos compartidos"><RefreshCw size={14} /></button> : <Link href="/dashboard/documents" aria-label="Abrir documentos"><ArrowUpRight size={15} /></Link>}
      </div> : null}
    </div>

  </section>;
}

export function DocumentsSharedCatalogPreview() {
  return <div className={styles.catalogPreview} aria-hidden="true">
    <span className={styles.previewHead}><i><Share2 size={11} /></i><b /><small>CONTIGO</small></span>
    <span className={styles.previewRow}><i>AM</i><b /><em /></span>
    <span className={styles.previewRow}><i>JL</i><b /><em /></span>
    <span className={styles.previewRow}><i>CR</i><b /><em /></span>
  </div>;
}
