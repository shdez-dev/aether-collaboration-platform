'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDownAZ, ArrowUpRight, Check, Clock3, Layers3, Plus, RefreshCw, UsersRound } from 'lucide-react';
import { WorkspaceIcon } from '@/components/WorkspaceIcon';
import { useActiveWorkspaceStore } from '@/stores/activeWorkspaceStore';
import { useWorkspaceStore, type Workspace, type WorkspaceMode } from '@/stores/workspaceStore';
import styles from './OrganizationWorkspacesWidget.module.css';

type OrganizationSummary = {
  id: string;
  name: string;
  type: string;
  role?: string;
  workspaceCount?: number;
};

type WorkspaceFilter = 'ALL' | WorkspaceMode;
type SortMode = 'recent' | 'name';

const FILTERS: { id: WorkspaceFilter; label: string }[] = [
  { id: 'ALL', label: 'Todos' },
  { id: 'TEAM', label: 'Equipo' },
  { id: 'PERSONAL', label: 'Personal' },
  { id: 'INSTITUTIONAL', label: 'Institucional' },
];

function modeLabel(mode: WorkspaceMode) {
  if (mode === 'PERSONAL') return 'Personal';
  if (mode === 'INSTITUTIONAL') return 'Institucional';
  return 'Equipo';
}

function formatCount(value: number) {
  return value.toLocaleString('es-CL');
}

export function OrganizationWorkspacesWidget({
  organization,
  onSelectWorkspace,
  onCreateWorkspace,
}: {
  organization?: OrganizationSummary | null;
  onSelectWorkspace?: (workspaceId: string) => void;
  onCreateWorkspace?: (organizationId: string) => void;
}) {
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const isLoading = useWorkspaceStore((state) => state.isLoading);
  const error = useWorkspaceStore((state) => state.error);
  const fetchWorkspaces = useWorkspaceStore((state) => state.fetchWorkspaces);
  const activeWorkspaceId = useActiveWorkspaceStore((state) => state.activeWorkspaceId);
  const [filter, setFilter] = useState<WorkspaceFilter>('ALL');
  const [sortMode, setSortMode] = useState<SortMode>('recent');

  const organizationWorkspaces = useMemo(() => workspaces
    .filter((workspace) => workspace.organizationId === organization?.id && !workspace.archived)
    .sort((left, right) => {
      if (sortMode === 'name') return left.name.localeCompare(right.name, 'es', { sensitivity: 'base' });
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    }), [organization?.id, sortMode, workspaces]);

  const counts = useMemo(() => FILTERS.reduce<Record<WorkspaceFilter, number>>((result, item) => {
    result[item.id] = item.id === 'ALL'
      ? organizationWorkspaces.length
      : organizationWorkspaces.filter((workspace) => workspace.mode === item.id).length;
    return result;
  }, { ALL: 0, TEAM: 0, PERSONAL: 0, INSTITUTIONAL: 0 }), [organizationWorkspaces]);

  const availableFilters = FILTERS.filter((item) => item.id === 'ALL' || counts[item.id] > 0);
  const filteredWorkspaces = organizationWorkspaces.filter((workspace) => filter === 'ALL' || workspace.mode === filter);
  const canCreateWorkspace = Boolean(organization && onCreateWorkspace && ['OWNER', 'ADMIN'].includes(organization.role ?? ''));

  useEffect(() => { setFilter('ALL'); }, [organization?.id]);

  const organizationHref = organization
    ? `/dashboard/organizations?organizationId=${encodeURIComponent(organization.id)}`
    : '/dashboard/organizations';

  function createWorkspace() {
    if (organization && canCreateWorkspace) onCreateWorkspace?.(organization.id);
  }

  return <section className={styles.widget} aria-label="Espacios de trabajo" aria-busy={isLoading}>
    <header className={styles.header}>
      <div className={styles.titleLine}>
        <span className={styles.workspaceCount}>{formatCount(organizationWorkspaces.length)} {organizationWorkspaces.length === 1 ? 'espacio' : 'espacios'}</span>
      </div>
      <div className={styles.headerActions}>
        <Link className={styles.viewLink} href={organizationHref} title="Abrir organización">Organización <ArrowUpRight size={12} aria-hidden="true" /></Link>
        <button className={styles.refreshButton} type="button" onClick={() => void fetchWorkspaces()} disabled={isLoading} aria-label="Actualizar espacios" title="Actualizar">
          <RefreshCw size={13} aria-hidden="true" />
        </button>
      </div>
    </header>

    {organization && organizationWorkspaces.length > 0 && <div className={styles.toolbar}>
      <div className={styles.filters} role="group" aria-label="Filtrar por tipo de espacio">
        {availableFilters.map((item) => <button
          key={item.id}
          className={styles.filterButton}
          type="button"
          aria-pressed={filter === item.id}
          onClick={() => setFilter(item.id)}
        >
          {item.label}<span>{formatCount(counts[item.id])}</span>
        </button>)}
      </div>
      <button className={styles.sortButton} type="button" onClick={() => setSortMode((value) => value === 'recent' ? 'name' : 'recent')} aria-label={`Ordenar espacios por ${sortMode === 'recent' ? 'nombre' : 'actividad reciente'}`} title={`Ordenar por ${sortMode === 'recent' ? 'nombre' : 'actividad reciente'}`}>
        {sortMode === 'recent' ? <Clock3 size={12} aria-hidden="true" /> : <ArrowDownAZ size={13} aria-hidden="true" />}
        <span>{sortMode === 'recent' ? 'Recientes' : 'A–Z'}</span>
      </button>
    </div>}

    {isLoading && organizationWorkspaces.length === 0 ? <div className={styles.skeletonList} role="status" aria-label="Cargando espacios de trabajo">
      <span /><span /><span />
    </div> : error && organizationWorkspaces.length === 0 ? <div className={styles.stateMessage} role="alert">
      <span className={styles.stateMark}><RefreshCw size={15} aria-hidden="true" /></span>
      <span className={styles.stateCopy}><strong>No se pudieron cargar los espacios</strong><small>Comprueba la conexión e inténtalo otra vez.</small></span>
      <button className={styles.stateRetry} type="button" onClick={() => void fetchWorkspaces()} aria-label="Reintentar carga de espacios"><RefreshCw size={13} aria-hidden="true" /></button>
    </div> : !organization ? <div className={styles.stateMessage}>
      <span className={styles.stateMark}><Layers3 size={16} aria-hidden="true" /></span>
      <span className={styles.stateCopy}><strong>Elige una organización</strong><small>Los espacios disponibles aparecerán aquí.</small></span>
      <Link className={styles.stateLink} href={organizationHref} aria-label="Ver organizaciones"><ArrowUpRight size={14} aria-hidden="true" /></Link>
    </div> : organizationWorkspaces.length === 0 ? <div className={styles.emptyState}>
      <div className={styles.emptyMark} aria-hidden="true"><Layers3 size={18} /><i /><b /></div>
      <div className={styles.emptyCopy}>
        <strong>{(organization.workspaceCount ?? 0) > 0 ? 'No tienes acceso a sus espacios' : 'Aún no hay espacios'}</strong>
        <p>{(organization.workspaceCount ?? 0) > 0 ? 'Pide acceso para ver los espacios de esta organización.' : `${organization.name} puede organizar su trabajo en espacios separados.`}</p>
        {canCreateWorkspace ? <button className={styles.emptyAction} type="button" onClick={createWorkspace}><Plus size={13} aria-hidden="true" />Crear un espacio</button> : <Link className={styles.emptyAction} href={organizationHref}>Ver organización <ArrowUpRight size={12} aria-hidden="true" /></Link>}
      </div>
    </div> : filteredWorkspaces.length === 0 ? <div className={styles.filteredEmpty}>
      <span>No hay espacios de tipo {modeLabel(filter as WorkspaceMode).toLocaleLowerCase('es')}.</span>
      <button type="button" onClick={() => setFilter('ALL')}>Mostrar todos</button>
    </div> : <div className={styles.workspaceList} aria-label={`Espacios de ${organization.name}`}>
      {filteredWorkspaces.map((workspace) => {
        const active = workspace.id === activeWorkspaceId;
        return <button
          key={workspace.id}
          className={styles.workspaceRow}
          type="button"
          style={{ '--space-tone': workspace.color || '#8967b6' } as React.CSSProperties}
          onClick={() => onSelectWorkspace?.(workspace.id)}
          disabled={!onSelectWorkspace}
          aria-current={active ? 'page' : undefined}
          aria-label={`${workspace.name}, espacio ${modeLabel(workspace.mode)}${active ? ', actual' : ', cambiar a este espacio'}`}
          title={active ? `${workspace.name} · Espacio actual` : `Cambiar a ${workspace.name}`}
        >
          <span className={styles.workspaceIcon} aria-hidden="true"><WorkspaceIcon icon={workspace.icon} size={16} strokeWidth={1.8} /></span>
          <span className={styles.workspaceCopy}>
            <strong>{workspace.name}</strong>
            <span className={styles.workspaceMeta}>
              <span className={styles.modeLabel} data-mode={workspace.mode}>{modeLabel(workspace.mode)}</span>
              {workspace.memberCount !== undefined && <span className={styles.metaItem} title={`${formatCount(workspace.memberCount)} personas`}><UsersRound size={10} aria-hidden="true" />{formatCount(workspace.memberCount)}</span>}
              {workspace.boardCount !== undefined && <span className={styles.metaItem} title={`${formatCount(workspace.boardCount)} tableros`}><Layers3 size={10} aria-hidden="true" />{formatCount(workspace.boardCount)}</span>}
            </span>
          </span>
          {active ? <span className={styles.currentMark}><Check size={12} aria-hidden="true" /><span>Actual</span></span> : <ArrowUpRight className={styles.rowArrow} size={14} aria-hidden="true" />}
        </button>;
      })}
    </div>}

    {organization && organizationWorkspaces.length > 0 && <footer className={styles.footer}>
      <span>{filteredWorkspaces.length === organizationWorkspaces.length ? `En ${organization.name}` : `${formatCount(filteredWorkspaces.length)} de ${formatCount(organizationWorkspaces.length)} espacios`}</span>
      {canCreateWorkspace && <button className={styles.createAction} type="button" onClick={createWorkspace}><Plus size={13} aria-hidden="true" />Nuevo espacio</button>}
    </footer>}
  </section>;
}
