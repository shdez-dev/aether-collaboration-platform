'use client';

import Link from 'next/link';
import { Activity, ArrowUpRight, FolderKanban, PanelsTopLeft, RefreshCw, UsersRound } from 'lucide-react';
import type { ContextProject } from './ContextProjectsWidget';
import styles from './OrganizationOverviewWidget.module.css';

type OrganizationSummary = {
  id: string;
  name: string;
  workspaceCount?: number;
  memberCount?: number;
};

export function OrganizationOverviewWidget({ organization, projects, loading, error, onRetry }: {
  organization?: OrganizationSummary | null;
  projects: ContextProject[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  const unavailable = loading && projects.length === 0;
  const projectCount = error ? '—' : unavailable ? '…' : projects.length.toLocaleString('es-CL');
  const activeCount = error ? '—' : unavailable ? '…' : projects.filter((project) => project.status === 'ACTIVE').length.toLocaleString('es-CL');
  const organizationHref = organization
    ? `/dashboard/organizations?organizationId=${encodeURIComponent(organization.id)}`
    : '/dashboard/organizations';

  return <section className={styles.root} aria-label="Panorama de la organización" aria-busy={unavailable}>
    <header className={styles.header}>
      <div>
        <span className={styles.eyebrow}>PANORAMA</span>
        <h2>{organization?.name ?? 'Organización'}</h2>
      </div>
      <div className={styles.actions}>
        {error && <button type="button" onClick={onRetry} className={styles.retry} aria-label="Reintentar proyectos"><RefreshCw size={13} />Reintentar</button>}
        <Link href={organizationHref} className={styles.openLink}>Ver organización <ArrowUpRight size={13} aria-hidden="true" /></Link>
      </div>
    </header>
    <div className={styles.metrics}>
      <div className={styles.metric}>
        <span className={styles.metricIcon} data-tone="projects"><FolderKanban size={15} aria-hidden="true" /></span>
        <span><small>Proyectos visibles</small><strong>{projectCount}</strong></span>
      </div>
      <div className={styles.metric}>
        <span className={styles.metricIcon} data-tone="active"><Activity size={15} aria-hidden="true" /></span>
        <span><small>En curso</small><strong>{activeCount}</strong></span>
      </div>
      <div className={styles.metric}>
        <span className={styles.metricIcon} data-tone="spaces"><PanelsTopLeft size={15} aria-hidden="true" /></span>
        <span><small>Espacios</small><strong>{organization?.workspaceCount?.toLocaleString('es-CL') ?? '—'}</strong></span>
      </div>
      <div className={styles.metric}>
        <span className={styles.metricIcon} data-tone="people"><UsersRound size={15} aria-hidden="true" /></span>
        <span><small>Integrantes</small><strong>{organization?.memberCount?.toLocaleString('es-CL') ?? '—'}</strong></span>
      </div>
    </div>
  </section>;
}
