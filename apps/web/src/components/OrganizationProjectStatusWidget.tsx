'use client';

import { Activity, Archive, CheckCircle2, CirclePause, Clock3, RefreshCw } from 'lucide-react';
import type { ContextProject } from './ContextProjectsWidget';
import styles from './OrganizationProjectStatusWidget.module.css';

const STATUS_GROUPS = [
  { id: 'ACTIVE', label: 'En curso', icon: Activity, tone: 'active' },
  { id: 'PLANNING', label: 'En preparación', icon: Clock3, tone: 'planning' },
  { id: 'ON_HOLD', label: 'En pausa', icon: CirclePause, tone: 'paused' },
  { id: 'COMPLETED', label: 'Completados', icon: CheckCircle2, tone: 'complete' },
  { id: 'ARCHIVED', label: 'Archivados', icon: Archive, tone: 'archived' },
] as const;

export function OrganizationProjectStatusWidget({ projects, loading, error, onRetry }: {
  projects: ContextProject[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  const total = projects.length;

  return <section className={styles.root} aria-label="Estado de los proyectos" aria-busy={loading}>
    <header className={styles.header}>
      <div><span className={styles.icon}><Activity size={14} aria-hidden="true" /></span><div><h2>Estado de los proyectos</h2><p>Distribución de la cartera</p></div></div>
      <span className={styles.total}>{error ? '—' : loading && total === 0 ? '…' : `${total} ${total === 1 ? 'proyecto' : 'proyectos'}`}</span>
    </header>

    {error ? <div className={styles.state} role="alert"><span>No se pudo cargar el estado.</span><button type="button" onClick={onRetry} aria-label="Reintentar carga de proyectos"><RefreshCw size={13} />Reintentar</button></div>
      : loading && total === 0 ? <div className={styles.skeleton} role="status" aria-label="Cargando estado de proyectos">{STATUS_GROUPS.slice(0, 4).map((status) => <span key={status.id} />)}</div>
        : total === 0 ? <p className={styles.empty}>El estado aparecerá aquí cuando haya proyectos en la organización.</p>
          : <div className={styles.grid}>
            {STATUS_GROUPS.map(({ id, label, icon: Icon, tone }) => {
              const count = projects.filter((project) => project.status === id).length;
              const share = total ? (count / total) * 100 : 0;
              return <div className={styles.status} data-tone={tone} key={id}>
                <div className={styles.statusTop}><span><Icon size={13} aria-hidden="true" />{label}</span><strong>{count}</strong></div>
                <div className={styles.track} role="img" aria-label={`${label}: ${count} de ${total} proyectos`}><i style={{ width: `${share}%` }} /></div>
                <small>{Math.round(share)}% de la cartera</small>
              </div>;
            })}
          </div>}
  </section>;
}
