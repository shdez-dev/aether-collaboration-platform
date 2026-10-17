'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import {
  ArrowDownWideNarrow,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  CirclePlus,
  FolderKanban,
  LayoutGrid,
  List,
  RotateCw,
  Sparkles,
} from 'lucide-react';
import type { SidebarProject } from '@/stores/activeWorkspaceStore';
import styles from './ProjectPortfolioWidget.module.css';

type ProjectStatusFilter = 'all' | 'active' | 'planning' | 'paused';
type ProjectView = 'cards' | 'list';
type EmptyStep = 'goal' | 'team' | 'milestones';

const STATUS_DETAILS: Record<string, { label: string; priority: number }> = {
  ACTIVE: { label: 'En curso', priority: 0 },
  PLANNING: { label: 'Preparación', priority: 1 },
  ON_HOLD: { label: 'En pausa', priority: 2 },
  COMPLETED: { label: 'Completado', priority: 3 },
  ARCHIVED: { label: 'Archivado', priority: 4 },
};

const EMPTY_STEPS: { id: EmptyStep; number: string; label: string; helper: string }[] = [
  { id: 'goal', number: '01', label: 'Define el objetivo', helper: 'Una dirección clara' },
  { id: 'team', number: '02', label: 'Reúne al equipo', helper: 'Invita a colaborar' },
  { id: 'milestones', number: '03', label: 'Marca los hitos', helper: 'Pequeños pasos, gran avance' },
];

function statusDetails(status: string) {
  return STATUS_DETAILS[status] ?? { label: 'Sin estado', priority: 5 };
}

function projectStatus(project: SidebarProject) {
  return statusDetails(project.status);
}

function projectColor(project: SidebarProject) {
  return project.color || 'var(--c-accent)';
}

export default function ProjectPortfolioWidget({
  projects,
  loading,
  error,
  onRetry,
}: {
  projects: SidebarProject[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  const [filter, setFilter] = useState<ProjectStatusFilter>('all');
  const [view, setView] = useState<ProjectView>('cards');
  const [alphabetical, setAlphabetical] = useState(false);
  const [emptyStep, setEmptyStep] = useState<EmptyStep>('goal');

  const counts = useMemo(() => ({
    all: projects.length,
    active: projects.filter((project) => project.status === 'ACTIVE').length,
    planning: projects.filter((project) => project.status === 'PLANNING').length,
    paused: projects.filter((project) => project.status === 'ON_HOLD').length,
  }), [projects]);

  const visibleProjects = useMemo(() => [...projects]
    .filter((project) => {
      if (filter === 'active') return project.status === 'ACTIVE';
      if (filter === 'planning') return project.status === 'PLANNING';
      if (filter === 'paused') return project.status === 'ON_HOLD';
      return true;
    })
    .sort((left, right) => alphabetical
      ? left.name.localeCompare(right.name, 'es')
      : projectStatus(left).priority - projectStatus(right).priority || left.name.localeCompare(right.name, 'es')),
  [alphabetical, filter, projects]);
  const shownProjects = visibleProjects.slice(0, 4);
  const activeStep = EMPTY_STEPS.find((step) => step.id === emptyStep) ?? EMPTY_STEPS[0];

  const filters: { id: ProjectStatusFilter; label: string }[] = [
    { id: 'all', label: 'Todos' },
    { id: 'active', label: 'En curso' },
    { id: 'planning', label: 'Preparación' },
    { id: 'paused', label: 'En pausa' },
  ];

  return <section className={styles.portfolio} aria-label="Resumen de proyectos">
    <div className={styles.toolbar}>
      <div className={styles.filterBar} role="group" aria-label="Filtrar proyectos">
        {filters.map((item) => <button key={item.id} type="button" className={filter === item.id ? styles.filterActive : ''} onClick={() => setFilter(item.id)} aria-pressed={filter === item.id}>
          {item.label}<span>{counts[item.id]}</span>
        </button>)}
      </div>
      <label className={styles.compactFilter}>
        <select value={filter} onChange={(event) => setFilter(event.target.value as ProjectStatusFilter)} aria-label="Filtrar proyectos">
          {filters.map((item) => <option key={item.id} value={item.id}>{item.label} · {counts[item.id]}</option>)}
        </select>
        <ChevronDown size={13} aria-hidden="true" />
      </label>
      <div className={styles.viewTools}>
        <Link className={styles.openPortfolio} href="/dashboard/projects" aria-label="Abrir todos los proyectos">
          <span>Ver cartera</span><ArrowRight size={14} aria-hidden="true" />
        </Link>
        <span className={styles.toolDivider} aria-hidden="true" />
        <button type="button" className={`${styles.toolButton} ${alphabetical ? styles.toolSelected : ''}`} onClick={() => setAlphabetical((value) => !value)} aria-label={alphabetical ? 'Orden alfabético: activado' : 'Orden inteligente por etapa'} title={alphabetical ? 'Orden alfabético' : 'Orden inteligente por etapa'} aria-pressed={alphabetical}>
          <ArrowDownWideNarrow size={14} aria-hidden="true" /><span>{alphabetical ? 'A–Z' : 'Por etapa'}</span>
        </button>
        <span className={styles.toolDivider} aria-hidden="true" />
        <div className={styles.viewToggle} role="group" aria-label="Diseño de proyectos">
          <button type="button" className={view === 'cards' ? styles.viewActive : ''} onClick={() => setView('cards')} aria-label="Vista de tarjetas" aria-pressed={view === 'cards'} title="Tarjetas"><LayoutGrid size={14} aria-hidden="true" /></button>
          <button type="button" className={view === 'list' ? styles.viewActive : ''} onClick={() => setView('list')} aria-label="Vista de lista" aria-pressed={view === 'list'} title="Lista"><List size={14} aria-hidden="true" /></button>
        </div>
      </div>
    </div>

    <div className={styles.projectList} aria-live="polite" aria-busy={loading}>
      {loading ? <div className={styles.loadingList} aria-label="Cargando proyectos">
        {[0, 1, 2].map((item) => <div className={styles.loadingRow} key={item}><i /><span /><b /></div>)}
      </div> : error ? <div className={styles.errorState} role="status">
        <div><strong>La cartera no se pudo actualizar</strong><span>Comprueba la conexión e inténtalo otra vez.</span></div>
        <button type="button" onClick={onRetry}><RotateCw size={14} aria-hidden="true" /> Reintentar</button>
      </div> : projects.length === 0 ? <div className={styles.emptyPortfolio}>
        <section className={styles.emptyWelcome} aria-labelledby="project-empty-title">
          <div className={styles.emptyGlow} aria-hidden="true" />
          <div className={styles.emptyWelcomeTop}>
            <span className={styles.emptyEyebrow}><Sparkles size={13} aria-hidden="true" /> UN ESPACIO PARA CONSTRUIR</span>
            <div className={styles.projectBlueprint} aria-hidden="true"><i /><i /><FolderKanban size={22} strokeWidth={1.5} /></div>
          </div>
          <div className={styles.emptyWelcomeCopy}>
            <span className={styles.emptyOverline}>TU SIGUIENTE GRAN IDEA</span>
            <h4 id="project-empty-title">Todo empieza con un buen espacio.</h4>
            <p>Reúne objetivos, equipo y entregas. Después, dale forma a tu manera mientras el proyecto avanza.</p>
          </div>
          <div className={styles.emptyWelcomeBottom}>
            <Link className={styles.createProject} href="/dashboard/projects"><CirclePlus size={15} aria-hidden="true" /> Crear proyecto <ArrowRight size={13} aria-hidden="true" /></Link>
            <span className={styles.customizeHint}><i aria-hidden="true" /> Listo para personalizar</span>
          </div>
        </section>

        <section className={styles.projectJourney} aria-label="Explora cómo organizar un proyecto">
          <div className={styles.journeyHeading}><div><span>DE LA IDEA AL AVANCE</span><small>Un proyecto, a tu ritmo</small></div><span className={styles.journeyCount} style={{ '--step-progress': `${(Number(activeStep.number) / 3) * 100}%` } as CSSProperties}><b>{activeStep.number}</b><i />03</span></div>
          <div className={styles.journeyContent}>
            <div className={styles.journeySteps} role="group" aria-label="Pasos de un proyecto">
              {EMPTY_STEPS.map((step) => {
                return <button key={step.id} type="button" className={`${styles.journeyStep} ${emptyStep === step.id ? styles.journeyStepActive : ''}`} aria-pressed={emptyStep === step.id} onClick={() => setEmptyStep(step.id)}>
                  <span className={styles.stepNumber}>{emptyStep === step.id ? <Check size={12} aria-hidden="true" /> : step.number}</span>
                  <span className={styles.stepCopy}><strong>{step.label}</strong><small>{step.helper}</small></span>
                  <ChevronRight size={14} className={styles.stepArrow} aria-hidden="true" />
                </button>;
              })}
            </div>
          </div>
          <div className={styles.journeyFooter}><span>Tu cartera empieza aquí</span><span className={styles.journeyProgress} aria-hidden="true"><i style={{ width: `${(Number(activeStep.number) / 3) * 100}%` }} /></span></div>
        </section>
      </div> : visibleProjects.length === 0 ? <div className={styles.filterEmpty}>
        <span className={styles.filterEmptyIcon}><FolderKanban size={18} aria-hidden="true" /></span>
        <div><strong>No hay proyectos en {filters.find((item) => item.id === filter)?.label.toLowerCase()}.</strong><span>Prueba otra etapa para ver más iniciativas.</span></div>
        <button type="button" onClick={() => setFilter('all')}>Ver todos</button>
      </div> : <nav className={`${styles.projectItems} ${view === 'cards' ? styles.projectCards : styles.projectRows}`} aria-label="Proyectos del espacio">
        {shownProjects.map((project) => {
          const status = projectStatus(project);
          return <Link className={styles.projectItem} href={`/dashboard/projects/${project.id}`} key={project.id} title={`Abrir ${project.name}`} style={{ '--project-color': projectColor(project) } as CSSProperties}>
            <span className={styles.projectMark} aria-hidden="true"><FolderKanban size={15} strokeWidth={1.8} /></span>
            <span className={styles.projectInfo}><strong className={styles.projectName}>{project.name}</strong><span className={styles.projectMeta}>Espacio actual · Proyecto</span></span>
            <span className={styles.projectStatus} data-status={project.status}><i aria-hidden="true" />{status.label}</span>
            <ChevronRight size={15} className={styles.rowArrow} aria-hidden="true" />
          </Link>;
        })}
      </nav>}
    </div>

    {!loading && !error && visibleProjects.length > shownProjects.length && <Link className={styles.moreProjects} href="/dashboard/projects">
      Ver cartera completa <span>{visibleProjects.length}</span><ArrowRight size={13} aria-hidden="true" />
    </Link>}
  </section>;
}

export function ProjectPortfolioPreview({ projects }: { projects: SidebarProject[] }) {
  const previewProjects = [...projects]
    .sort((left, right) => projectStatus(left).priority - projectStatus(right).priority || left.name.localeCompare(right.name, 'es'))
    .slice(0, 2);

  return <div className={styles.catalogPreview} aria-hidden="true">
    <div className={styles.previewHeading}><div><i><FolderKanban size={13} strokeWidth={1.8} /></i><strong>Proyectos</strong></div><span>{projects.length} total</span></div>
    {previewProjects.length ? <div className={styles.previewRows}>{previewProjects.map((project) => <div className={styles.previewRow} key={project.id}>
      <i style={{ '--project-color': projectColor(project) } as CSSProperties} />
      <span>{project.name}</span>
      <small>{projectStatus(project).label}</small>
    </div>)}</div> : <div className={styles.previewEmpty}><Sparkles size={13} aria-hidden="true" /><span>Objetivos, equipo y avances<br />en un solo lugar.</span></div>}
    <div className={styles.previewFooter}>Abrir cartera <ArrowRight size={11} /></div>
  </div>;
}
