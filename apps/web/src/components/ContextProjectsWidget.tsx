'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, FolderKanban, RotateCw } from 'lucide-react';
import type { DashboardContext } from './DashboardBoardControls';
import styles from './ContextProjectsWidget.module.css';

export type ContextProject = {
  id: string;
  name: string;
  status: string;
  color?: string | null;
  workspaceId: string;
  workspaceName?: string;
  organizationName?: string;
  description?: string | null;
  productGoal?: string | null;
  methodology?: string;
};

const STATUS: Record<string, string> = {
  ACTIVE: 'En curso', PLANNING: 'En preparación', ON_HOLD: 'En pausa', COMPLETED: 'Completado', ARCHIVED: 'Archivado',
};

export function ContextProjectsWidget({ context, projects, loading, error, onRetry }: {
  context: DashboardContext;
  projects: ContextProject[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  const [filter, setFilter] = useState<'all' | 'active'>('all');
  const visible = useMemo(() => filter === 'active' ? projects.filter((item) => item.status === 'ACTIVE') : projects, [filter, projects]);
  const groups = useMemo(() => {
    if (context.type === 'WORKSPACE' || context.type === 'PROJECT') return [{ id: 'workspace', name: '', projects: visible }];
    const map = new Map<string, { id: string; name: string; projects: ContextProject[] }>();
    for (const project of visible) {
      const key = project.workspaceId;
      if (!map.has(key)) map.set(key, {
        id: key,
        name: context.type === 'PERSONAL' && project.organizationName
          ? `${project.organizationName} · ${project.workspaceName ?? 'Espacio'}`
          : project.workspaceName ?? 'Espacio',
        projects: [],
      });
      map.get(key)!.projects.push(project);
    }
    return [...map.values()];
  }, [context.type, visible]);

  if (context.type === 'PROJECT') {
    const project = projects[0];
    return <div className={styles.root}>
      <div className={styles.header}><strong>Proyecto</strong><button type="button" className={styles.iconButton} onClick={onRetry} aria-label="Actualizar proyecto"><RotateCw size={14} /></button></div>
      {loading ? <p className={styles.message} role="status">Cargando proyecto…</p>
        : error ? <div className={styles.message} role="alert">No pudimos cargar este proyecto. <button type="button" onClick={onRetry}>Reintentar</button></div>
          : !project ? <p className={styles.message}>Este proyecto ya no está disponible.</p>
            : <><div className={styles.projectFocus}>
              <span className={styles.projectMark} style={{ '--project-color': project.color || 'var(--c-accent)' } as React.CSSProperties}><FolderKanban size={20} /></span>
              <div><h3>{project.name}</h3><span>{STATUS[project.status] ?? 'Proyecto'}{project.methodology === 'SCRUM' ? ' · Scrum' : ''}</span></div>
            </div>
              {(project.productGoal || project.description) && <p className={styles.goal}>{project.productGoal || project.description}</p>}
              <nav className={styles.projectNav} aria-label={`Abrir secciones de ${project.name}`}>
                {[
                  ['Resumen', 'overview'], ['Tableros', 'boards'], ['Tareas', 'backlog'],
                  ['Documentos', 'docs'], ['Actividad', 'activity'],
                ].map(([label, tab]) => <Link key={tab} href={`/dashboard/projects/${project.id}?tab=${tab}`}>{label}<ArrowRight size={12} /></Link>)}
              </nav>
            </>}
    </div>;
  }

  return <div className={styles.root}>
    <div className={styles.header}><strong>Proyectos <span>{projects.length}</span></strong><div><button type="button" className={filter === 'all' ? styles.filterActive : ''} onClick={() => setFilter('all')} aria-pressed={filter === 'all'}>Todos</button><button type="button" className={filter === 'active' ? styles.filterActive : ''} onClick={() => setFilter('active')} aria-pressed={filter === 'active'}>En curso</button><button type="button" className={styles.iconButton} onClick={onRetry} aria-label="Actualizar proyectos"><RotateCw size={14} /></button></div></div>
    {loading ? <p className={styles.message} role="status">Cargando proyectos…</p>
      : error ? <div className={styles.message} role="alert">No pudimos cargar los proyectos. <button type="button" onClick={onRetry}>Reintentar</button></div>
        : projects.length === 0 ? <div className={styles.empty}><FolderKanban size={20} /><strong>Aún no hay proyectos en este contexto</strong><span>Cuando se cree uno, aparecerá aquí.</span></div>
          : visible.length === 0 ? <div className={styles.empty}><strong>No hay proyectos en curso</strong><button type="button" onClick={() => setFilter('all')}>Ver todos</button></div>
            : <div className={styles.list}>{groups.map((group) => <div className={styles.group} key={group.id}>
              {group.name && <span className={styles.groupName}>{group.name}</span>}
              <div className={context.type === 'ORGANIZATION' ? styles.projectCards : undefined}>{group.projects.map((project) => <Link className={styles.projectRow} href={`/dashboard/projects/${project.id}`} key={project.id}>
                <i style={{ background: project.color || 'var(--c-accent)' }} /><span><strong>{project.name}</strong><small>{STATUS[project.status] ?? 'Proyecto'}</small></span><ArrowRight size={14} aria-hidden="true" />
              </Link>)}</div>
            </div>)}</div>}
  </div>;
}
