'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CalendarDays, CheckCircle2, ChevronRight, CircleDashed, ClipboardList, Search, Target } from 'lucide-react';
import { useProjectStore, type Project, type ProjectMaturityStage, type ProjectWorkflowStage } from '@/stores/projectStore';
import { useBoardStore } from '@/stores/boardStore';
import { useTeamStore } from '@/stores/teamStore';
import { useActiveWorkspaceStore } from '@/stores/activeWorkspaceStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import CreateProjectModal from '@/components/CreateProjectModal';
import { WorkspaceIcon } from '@/components/WorkspaceIcon';
import { apiService } from '@/services/apiService';
import { C } from '@/lib/colors';
import entrance from '../pageEntrance.module.css';

const SORA = "'Sora', system-ui, sans-serif";
const MANROPE = "'Manrope', system-ui, sans-serif";

const KPI_GRID = 'repeat(auto-fit, minmax(170px, 1fr))';
const SUMMARY_GRID = 'repeat(auto-fit, minmax(300px, 1fr))';
const COMPACT_GRID = 'repeat(auto-fit, minmax(210px, 1fr))';
const PIPELINE_GRID = 'repeat(auto-fit, minmax(260px, 1fr))';

const PIPELINE: { key: ProjectMaturityStage; label: string; tone: string; soft: string; border: string; hint: string }[] = [
  { key: 'IDEA', label: 'Idea', tone: '#8D84B0', soft: 'rgba(123,143,168,0.12)', border: 'rgba(123,143,168,0.26)', hint: 'Intenciones iniciales que aún no amarran compromiso.' },
  { key: 'DRAFT', label: 'Borrador', tone: '#AA895E', soft: 'rgba(196,168,110,0.12)', border: 'rgba(196,168,110,0.26)', hint: 'Ya existe una propuesta, pero todavía le falta estructura.' },
  { key: 'FORMALIZED', label: 'Formalizado', tone: '#548B73', soft: 'rgba(118,168,120,0.12)', border: 'rgba(118,168,120,0.26)', hint: 'El proyecto ya declaró responsable, problema y siguiente paso.' },
  { key: 'PLANNED', label: 'Planificado', tone: '#8076A7', soft: 'rgba(75,96,127,0.14)', border: 'rgba(75,96,127,0.26)', hint: 'Tiene estructura suficiente para coordinar ejecución.' },
  { key: 'ACTIVE', label: 'En ejecución', tone: '#9271BD', soft: 'rgba(116,82,166,0.12)', border: 'rgba(116,82,166,0.26)', hint: 'Trabajo corriendo con tableros, hitos y seguimiento.' },
  { key: 'ON_HOLD', label: 'En pausa', tone: '#A97556', soft: 'rgba(219,138,102,0.12)', border: 'rgba(219,138,102,0.26)', hint: 'Iniciativas detenidas que requieren destrabe o redefinición.' },
  { key: 'COMPLETED', label: 'Completado', tone: '#548B73', soft: 'rgba(118,168,120,0.12)', border: 'rgba(118,168,120,0.26)', hint: 'Trabajo cerrado y entregado.' },
];

const OPERATING_PIPELINE: { key: string; label: string; tone: string; soft: string; border: string; hint: string; stages: ProjectWorkflowStage[] }[] = [
  { key: 'diagnosis', label: 'Diagnóstico', tone: '#8D84B0', soft: 'rgba(123,143,168,0.12)', border: 'rgba(123,143,168,0.26)', hint: 'Aclarar problema, beneficiarios y contexto.', stages: ['DIAGNOSIS'] },
  { key: 'validation', label: 'Validación', tone: '#AA895E', soft: 'rgba(196,168,110,0.12)', border: 'rgba(196,168,110,0.26)', hint: 'Comprobar viabilidad, valor e interés.', stages: ['VALIDATION'] },
  { key: 'preparation', label: 'Preparación', tone: '#8076A7', soft: 'rgba(75,96,127,0.14)', border: 'rgba(75,96,127,0.26)', hint: 'Ordenar equipo, plan e hitos antes de ejecutar.', stages: ['PREPARATION'] },
  { key: 'execution', label: 'Ejecución', tone: '#9271BD', soft: 'rgba(116,82,166,0.12)', border: 'rgba(116,82,166,0.26)', hint: 'Trabajo activo que necesita seguimiento y desbloqueos.', stages: ['EXECUTION'] },
  { key: 'closure', label: 'Cierre', tone: '#548B73', soft: 'rgba(118,168,120,0.12)', border: 'rgba(118,168,120,0.26)', hint: 'Entregas terminadas y aprendizaje registrado.', stages: ['CLOSURE'] },
];

function getMaturityMeta(stage: ProjectMaturityStage) {
  return PIPELINE.find((item) => item.key === stage) ?? PIPELINE[0];
}

function getCoverageTone(coverage = 0) {
  if (coverage >= 80) return '#548B73';
  if (coverage >= 50) return '#AA895E';
  return '#A97556';
}

function hasChecklistGap(project: Project, key: 'team' | 'board' | 'milestone') {
  return project.formalization?.checklist.find((item) => item.key === key)?.done === false;
}

function getNextMilestone(project: Project) {
  const milestones = (project.milestones ?? [])
    .filter((milestone) => milestone.status === 'PENDING')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const milestone = milestones[0];

  if (milestone) {
    const isOverdue = new Date(milestone.date).getTime() < Date.now();
    return {
      label: milestone.name,
      date: new Date(milestone.date),
      tone: isOverdue ? '#A97556' : 'var(--c-text2)',
      hint: isOverdue ? 'Vencido' : 'Próximo hito',
    };
  }

  if (project.endDate) {
    const isOverdue = new Date(project.endDate).getTime() < Date.now();
    return {
      label: 'Fecha de cierre',
      date: new Date(project.endDate),
      tone: isOverdue ? '#A97556' : 'var(--c-text2)',
      hint: isOverdue ? 'Vencida' : 'Fecha objetivo',
    };
  }

  return { label: 'Sin hito definido', date: null, tone: '#A97556', hint: 'Requiere atención' };
}

function getPortfolioHealth(project: Project) {
  if (project.status === 'ON_HOLD' || project.maturityStage === 'ON_HOLD') {
    return { label: 'En pausa', tone: '#A97556', soft: 'rgba(219,138,102,0.12)' };
  }
  if (hasChecklistGap(project, 'team')) {
    return { label: 'Bloqueado', tone: '#A97556', soft: 'rgba(219,138,102,0.12)' };
  }
  if (hasChecklistGap(project, 'board') || hasChecklistGap(project, 'milestone')) {
    return { label: 'En riesgo', tone: '#AA895E', soft: 'rgba(196,168,110,0.12)' };
  }
  if (isActiveProject(project)) {
    return { label: 'En marcha', tone: '#9271BD', soft: 'rgba(116,82,166,0.12)' };
  }
  return { label: 'En seguimiento', tone: '#548B73', soft: 'rgba(118,168,120,0.12)' };
}

function formatPortfolioDate(date: Date | null) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short' }).format(date);
}

function getProjectPortfolioReason(project: Project) {
  const missingChecklist = project.formalization?.checklist.filter((item) => !item.done) ?? [];
  const missingCoverage = project.coverage?.fields.filter((field) => field.state === 'APPLIES_EMPTY') ?? [];

  if (missingChecklist.some((item) => item.key === 'team')) {
    return 'Sigue sin equipo base asignado.';
  }
  if (missingChecklist.some((item) => item.key === 'board')) {
    return 'Todavia no tiene tablero de ejecucion.';
  }
  if (missingChecklist.some((item) => item.key === 'milestone')) {
    return 'Falta declarar el primer hito visible.';
  }
  if (missingCoverage.length > 0) {
    return `Aun falta ${missingCoverage[0].label.toLowerCase()}.`;
  }
  return 'Tiene base suficiente para avanzar.';
}

type FocusMode =
  | 'all'
  | 'mentor-needed'
  | 'ready'
  | 'no-team'
  | 'no-board'
  | 'no-milestone'
  | 'low-coverage';

type ProjectListFilter = 'all' | 'active' | 'paused' | 'completed';

type ViewMode = 'portfolio' | 'pipeline' | 'intake';
type WorkspaceExperience = 'personal' | 'team' | 'institutional' | 'marketing' | 'construction';

const EXPERIENCE_META: Record<WorkspaceExperience, { title: string; description: string; method: string; accent: string }> = {
  institutional: {
    title: 'Pipeline de proyectos',
    description: 'Coordina proyectos en ejecución, detecta bloqueos y mantiene visibles los próximos hitos.',
    method: 'Portfolio formalizado',
    accent: '#7452A6',
  },
  personal: {
    title: 'Foco personal',
    description: 'Ordena tus proyectos por siguiente acción, decisiones pendientes y cierre real.',
    method: 'GTD ligero',
    accent: '#8D84B0',
  },
  team: {
    title: 'Flujo de equipo',
    description: 'Convierte ideas en trabajo coordinado con backlog, preparación, ejecución y cierre.',
    method: 'Kanban operativo',
    accent: '#548B73',
  },
  marketing: {
    title: 'Producción marketing',
    description: 'Gestiona briefs, aprobaciones, producción y revisión sin saturar al equipo creativo.',
    method: 'Campaña por etapas',
    accent: '#AA895E',
  },
  construction: {
    title: 'Ruta operativa',
    description: 'Prioriza planificación, equipos, hitos y ejecución con una lectura de ruta crítica.',
    method: 'Ruta crítica',
    accent: '#8D84B0',
  },
};

function inferWorkspaceExperience(standardName?: string | null): WorkspaceExperience {
  const name = (standardName ?? '').toLowerCase();
  if (name.includes('personal')) return 'personal';
  if (name.includes('marketing')) return 'marketing';
  if (name.includes('construction') || name.includes('critical path')) return 'construction';
  if (name.includes('team')) return 'team';
  return 'institutional';
}

function isDoneProject(project: Project) {
  return project.maturityStage === 'COMPLETED' || project.status === 'COMPLETED';
}

function isActiveProject(project: Project) {
  return project.maturityStage === 'ACTIVE' || project.status === 'ACTIVE';
}

function getMethodologyColumns(experience: WorkspaceExperience, projects: Project[]) {
  if (experience === 'personal') {
    return [
      {
        key: 'today',
        label: 'Acción siguiente',
        hint: 'Proyectos ya decididos con una próxima acción visible.',
        tone: '#8D84B0',
        projects: projects.filter((project) =>
          !isDoneProject(project)
          && Boolean(project.nextStep?.trim())
          && project.maturityStage !== 'IDEA'
          && project.maturityStage !== 'DRAFT'
        ),
      },
      {
        key: 'clarify',
        label: 'A clarificar',
        hint: 'Ideas o borradores que aún necesitan decidirse.',
        tone: '#AA895E',
        projects: projects.filter((project) => project.maturityStage === 'IDEA' || project.maturityStage === 'DRAFT'),
      },
      {
        key: 'active',
        label: 'En marcha',
        hint: 'Trabajo decidido que todavía necesita una próxima acción.',
        tone: '#9271BD',
        projects: projects.filter((project) =>
          !isDoneProject(project)
          && !project.nextStep?.trim()
          && (project.maturityStage === 'FORMALIZED' || project.maturityStage === 'PLANNED' || isActiveProject(project))
        ),
      },
      {
        key: 'done',
        label: 'Cerrado',
        hint: 'Proyectos completados o archivados.',
        tone: '#548B73',
        projects: projects.filter((project) => isDoneProject(project) || project.maturityStage === 'ARCHIVED'),
      },
    ];
  }

  if (experience === 'marketing') {
    return [
      { key: 'brief', label: 'Brief', hint: 'Ideas que necesitan objetivo, audiencia o pieza.', tone: '#8D84B0', projects: projects.filter((project) => project.maturityStage === 'IDEA' || project.maturityStage === 'DRAFT') },
      { key: 'approved', label: 'Aprobado', hint: 'Campañas listas para ordenar producción.', tone: '#AA895E', projects: projects.filter((project) => !isActiveProject(project) && (project.maturityStage === 'FORMALIZED' || project.maturityStage === 'PLANNED')) },
      { key: 'production', label: 'Producción', hint: 'Trabajo creativo o de publicación en curso.', tone: '#9271BD', projects: projects.filter((project) => isActiveProject(project)) },
      { key: 'review', label: 'Medición', hint: 'Entregas cerradas, pausadas o listas para lectura.', tone: '#548B73', projects: projects.filter((project) => project.maturityStage === 'COMPLETED' || project.maturityStage === 'ON_HOLD' || project.status === 'COMPLETED') },
    ];
  }

  if (experience === 'construction') {
    return [
      { key: 'prework', label: 'Anteproyecto', hint: 'Alcance inicial antes de comprometer obra.', tone: '#8D84B0', projects: projects.filter((project) => project.maturityStage === 'IDEA' || project.maturityStage === 'DRAFT' || project.maturityStage === 'FORMALIZED') },
      { key: 'planning', label: 'Planificación', hint: 'Fechas, equipo, tablero e hitos antes de ejecutar.', tone: '#AA895E', projects: projects.filter((project) => !isActiveProject(project) && project.maturityStage === 'PLANNED') },
      { key: 'site', label: 'Ejecución', hint: 'Trabajo activo que requiere seguimiento de compromisos.', tone: '#9271BD', projects: projects.filter((project) => isActiveProject(project)) },
      { key: 'risk', label: 'Riesgo / cierre', hint: 'Pausas, bloqueos y cierres de entrega.', tone: '#A97556', projects: projects.filter((project) => project.maturityStage === 'ON_HOLD' || isDoneProject(project)) },
    ];
  }

  return [
    { key: 'backlog', label: 'Backlog', hint: 'Ideas y solicitudes todavía sin preparación suficiente.', tone: '#8D84B0', projects: projects.filter((project) => project.maturityStage === 'IDEA' || project.maturityStage === 'DRAFT') },
    { key: 'ready', label: 'Listo para coordinar', hint: 'Trabajo definido para entrar al tablero del equipo.', tone: '#548B73', projects: projects.filter((project) => !isActiveProject(project) && (project.maturityStage === 'FORMALIZED' || project.maturityStage === 'PLANNED')) },
    { key: 'doing', label: 'En curso', hint: 'Proyectos activos que requieren sincronización.', tone: '#9271BD', projects: projects.filter((project) => isActiveProject(project)) },
    { key: 'closed', label: 'Cierre', hint: 'Completados, pausados o fuera del flujo activo.', tone: '#AA895E', projects: projects.filter((project) => project.maturityStage === 'ON_HOLD' || isDoneProject(project) || project.maturityStage === 'ARCHIVED') },
  ];
}

function ProjectCard({ project, onClick, onAdvance }: { project: Project; onClick: () => void; onAdvance?: () => void }) {
  const maturity = getMaturityMeta(project.maturityStage ?? 'IDEA');
  const health = getPortfolioHealth(project);
  const milestone = getNextMilestone(project);
  const responsibleName = project.triageOwnerName ?? project.ownerName;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onClick(); }}
      style={{
        width: '100%',
        borderRadius: '10px',
        border: `1px solid ${maturity.border}`,
        background: 'rgba(97,71,130,0.02)',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '9px',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'transform 0.14s, border-color 0.14s, background 0.14s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.background = 'rgba(97,71,130,0.035)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.background = 'rgba(97,71,130,0.02)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <div style={{
          width: '34px', height: '34px', borderRadius: '9px', flexShrink: 0,
          background: project.color ? `${project.color}1E` : maturity.soft,
          border: `1px solid ${project.color ? `${project.color}44` : maturity.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <WorkspaceIcon icon={project.icon} size={16} color={project.color ?? maturity.tone} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: SORA, fontSize: '13.5px', fontWeight: 600, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {project.name}
          </div>
          <div style={{ marginTop: '3px', fontSize: '11px', color: responsibleName ? 'var(--c-text3)' : '#A97556', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {responsibleName ? `Responsable: ${responsibleName}` : 'Sin responsable visible'}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '10.5px', fontWeight: 700, color: maturity.tone, background: maturity.soft, border: `1px solid ${maturity.border}`, borderRadius: '999px', padding: '4px 8px' }}>
          {maturity.label}
        </span>
        <span style={{ fontSize: '10.5px', fontWeight: 700, color: health.tone, background: health.soft, borderRadius: '999px', padding: '4px 8px' }}>
          {health.label}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: milestone.tone, fontSize: '11px', minWidth: 0 }}>
        <CalendarDays style={{ width: '13px', height: '13px', flexShrink: 0 }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{milestone.label}</span>
        {milestone.date && <span style={{ color: 'var(--c-text3)', flexShrink: 0 }}>{formatPortfolioDate(milestone.date)}</span>}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', color: 'var(--c-text3)', fontSize: '11px', lineHeight: 1.4 }}>
        <ChevronRight style={{ width: '12px', height: '12px', marginTop: '1px', flexShrink: 0 }} />
        <span>{getProjectPortfolioReason(project)}</span>
      </div>
      {onAdvance && (
        <button onClick={(event) => { event.stopPropagation(); onAdvance(); }} style={{ width: '100%', height: '28px', borderRadius: '7px', border: '1px solid rgba(97,71,130,0.09)', background: 'rgba(97,71,130,0.04)', color: 'var(--c-text2)', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}>
          Avanzar etapa
        </button>
      )}
    </div>
  );
}

function PortfolioList({
  projects,
  hasProjects,
  onProjectClick,
  onCreateProject,
}: {
  projects: Project[];
  hasProjects: boolean;
  onProjectClick: (project: Project) => void;
  onCreateProject: () => void;
}) {
  if (projects.length === 0) {
    return (
      <div style={{ display: 'grid', justifyItems: 'center', gap: '12px', borderRadius: '16px', border: '1px dashed rgba(97,71,130,0.14)', padding: '52px 24px', textAlign: 'center', background: 'rgba(97,71,130,0.018)' }}>
        <span style={{ width: '48px', height: '48px', display: 'grid', placeItems: 'center', borderRadius: '14px', color: '#9271BD', background: 'rgba(116,82,166,0.12)', border: '1px solid rgba(116,82,166,0.22)' }}>
          <ClipboardList size={22} aria-hidden="true" />
        </span>
        <div>
          <h3 style={{ margin: 0, color: 'var(--c-text)', fontFamily: SORA, fontSize: '16px', fontWeight: 700 }}>
            {hasProjects ? 'No encontramos proyectos' : 'Tu próximo proyecto empieza aquí'}
          </h3>
          <p style={{ margin: '6px 0 0', color: 'var(--c-text3)', fontSize: '12.5px', lineHeight: 1.55 }}>
            {hasProjects
              ? 'Prueba con otro filtro o búsqueda.'
              : 'Reúne una idea, un objetivo y sus próximos pasos en un mismo lugar.'}
          </p>
        </div>
        {!hasProjects && (
          <button
            type="button"
            onClick={onCreateProject}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '4px', padding: '10px 14px', border: 0, borderRadius: '9px', background: '#7452A6', color: '#FFFFFF', fontFamily: SORA, fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
          >
            <CircleDashed size={15} aria-hidden="true" />
            Crear primer proyecto
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 310px), 1fr))', gap: '14px' }}>
      {projects.map((project) => {
        const maturity = getMaturityMeta(project.maturityStage ?? 'IDEA');
        const health = getPortfolioHealth(project);
        const milestone = getNextMilestone(project);
        const summary = project.problemStatement?.trim() || project.description?.trim();
        const needsAttention = ['Bloqueado', 'En pausa', 'En riesgo'].includes(health.label);

        return (
          <button
            key={project.id}
            type="button"
            onClick={() => onProjectClick(project)}
            onMouseEnter={(event) => {
              event.currentTarget.style.borderColor = 'rgba(116,82,166,0.42)';
              event.currentTarget.style.background = 'rgba(97,71,130,0.045)';
              event.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.borderColor = 'rgba(97,71,130,0.09)';
              event.currentTarget.style.background = 'rgba(97,71,130,0.025)';
              event.currentTarget.style.transform = 'translateY(0)';
            }}
            style={{ display: 'flex', minHeight: '154px', flexDirection: 'column', alignItems: 'stretch', gap: '11px', padding: '16px', border: '1px solid rgba(97,71,130,0.09)', borderRadius: '14px', background: 'rgba(97,71,130,0.025)', color: 'inherit', textAlign: 'left', cursor: 'pointer', transition: 'transform 180ms ease, border-color 180ms ease, background 180ms ease' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h3 style={{ display: '-webkit-box', margin: 0, overflow: 'hidden', color: 'var(--c-text)', fontFamily: SORA, fontSize: '15px', fontWeight: 700, lineHeight: 1.4, WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}>
                  {project.name}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginTop: '8px', flexWrap: 'wrap' }}>
                  <span style={{ borderRadius: '999px', padding: '3px 8px', color: maturity.tone, background: maturity.soft, fontSize: '10px', fontWeight: 700 }}>
                    {maturity.label}
                  </span>
                  {needsAttention && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: health.tone, fontSize: '10.5px', fontWeight: 700 }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: health.tone }} aria-hidden="true" />
                      {health.label}
                    </span>
                  )}
                </div>
              </div>
              <span style={{ width: '32px', height: '32px', display: 'grid', flexShrink: 0, placeItems: 'center', borderRadius: '9px', color: project.color ?? maturity.tone, background: project.color ? `${project.color}14` : maturity.soft }} aria-hidden="true">
                <WorkspaceIcon icon={project.icon} size={16} color={project.color ?? maturity.tone} />
              </span>
            </div>

            {summary ? (
              <p style={{ display: '-webkit-box', margin: 0, overflow: 'hidden', color: 'var(--c-text2)', fontSize: '12px', lineHeight: 1.5, WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}>
                {summary}
              </p>
            ) : null}

            {(project.nextStep?.trim() || milestone.date) ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginTop: 'auto', paddingTop: '9px', borderTop: '1px solid rgba(97,71,130,0.07)' }}>
                {project.nextStep?.trim() ? (
                  <span style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: '6px', color: 'var(--c-text2)', fontSize: '11px', lineHeight: 1.4 }}>
                    <ChevronRight size={13} style={{ flexShrink: 0, color: '#9271BD' }} aria-hidden="true" />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.nextStep}</span>
                  </span>
                ) : <span />}
                {milestone.date ? (
                  <span style={{ display: 'inline-flex', flexShrink: 0, alignItems: 'center', gap: '5px', color: milestone.tone, fontSize: '10.5px' }}>
                    <CalendarDays size={12} aria-hidden="true" />
                    {formatPortfolioDate(milestone.date)}
                  </span>
                ) : null}
              </div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function MethodologyColumn({
  column,
  onProjectClick,
}: {
  column: ReturnType<typeof getMethodologyColumns>[number];
  onProjectClick: (project: Project) => void;
}) {
  return (
    <section style={{ minWidth: 0 }}>
      <div style={{ marginBottom: '10px', padding: '12px 12px 10px', borderRadius: '10px', border: `1px solid ${column.tone}42`, background: `${column.tone}16` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ fontFamily: SORA, fontSize: '13px', fontWeight: 700, color: column.tone }}>{column.label}</div>
          <div style={{ minWidth: '24px', height: '24px', borderRadius: '999px', background: 'rgba(0,0,0,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--c-text)' }}>
            {column.projects.length}
          </div>
        </div>
        <p style={{ margin: '6px 0 0', fontSize: '11.5px', lineHeight: 1.45, color: 'var(--c-text2)' }}>{column.hint}</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {column.projects.length === 0 ? (
          <div style={{ borderRadius: '10px', border: '1px dashed rgba(97,71,130,0.12)', padding: '18px 14px', color: 'var(--c-text4)', fontSize: '12px', textAlign: 'center', background: 'rgba(97,71,130,0.015)' }}>
            Sin proyectos en esta etapa
          </div>
        ) : (
          column.projects.map((project) => (
            <ProjectCard key={project.id} project={project} onClick={() => onProjectClick(project)} />
          ))
        )}
      </div>
    </section>
  );
}

export default function ProjectsPage() {
  const router = useRouter();
  const { fetchProjectsByWorkspace, updateProject, transitionWorkflow, createMilestone } = useProjectStore();
  const { createBoard } = useBoardStore();
  const { teams, fetchTeams } = useTeamStore();
  const { activeWorkspaceId } = useActiveWorkspaceStore();
  const { workspaces, fetchWorkspaces, currentProjectStandard, projectStandardHistory, fetchProjectStandard, fetchProjectStandardHistory } = useWorkspaceStore();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [projectListFilter, setProjectListFilter] = useState<ProjectListFilter>('all');
  const [showOnlyNeedsFormalization, setShowOnlyNeedsFormalization] = useState(false);
  const [focusMode, setFocusMode] = useState<FocusMode>('all');
  const [viewMode] = useState<ViewMode>('portfolio');
  const [showCreate, setShowCreate] = useState(false);
  const [busyActionByProject, setBusyActionByProject] = useState<Record<string, string | null>>({});
  const [teamPickerProjectId, setTeamPickerProjectId] = useState<string | null>(null);
  const [selectedTeamByProject, setSelectedTeamByProject] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!workspaces.length) fetchWorkspaces();
  }, [workspaces.length, fetchWorkspaces]);

  useEffect(() => {
    if (activeWorkspaceId) fetchTeams(activeWorkspaceId);
  }, [activeWorkspaceId, fetchTeams]);

  useEffect(() => {
    if (activeWorkspaceId) fetchProjectStandard(activeWorkspaceId);
  }, [activeWorkspaceId, fetchProjectStandard]);

  useEffect(() => {
    if (activeWorkspaceId) fetchProjectStandardHistory(activeWorkspaceId);
  }, [activeWorkspaceId, fetchProjectStandardHistory]);

  useEffect(() => {
    if (!activeWorkspaceId) {
      setProjects([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchProjectsByWorkspace(activeWorkspaceId)
      .then((items) => setProjects(items))
      .finally(() => setLoading(false));
  }, [activeWorkspaceId, fetchProjectsByWorkspace]);

  const workspace = workspaces.find((item) => item.id === activeWorkspaceId);
  // El modo es el contrato de contexto; el estándar solo conserva sub-plantillas
  // (por ejemplo marketing/construcción) dentro de un workspace TEAM.
  const workspaceExperience = workspace?.mode === 'PERSONAL'
    ? 'personal'
    : workspace?.mode === 'INSTITUTIONAL'
      ? 'institutional'
      : inferWorkspaceExperience(currentProjectStandard?.name);
  const experienceMeta = EXPERIENCE_META[workspaceExperience];
  const isInstitutionalExperience = workspaceExperience === 'institutional';

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    return projects.filter((project) => {
      if (projectListFilter === 'active' && !isActiveProject(project)) return false;
      if (projectListFilter === 'paused' && project.status !== 'ON_HOLD' && project.maturityStage !== 'ON_HOLD') return false;
      if (projectListFilter === 'completed' && !isDoneProject(project)) return false;
      if (showOnlyNeedsFormalization && project.formalization?.readyToFormalize) return false;
      if (focusMode === 'mentor-needed') {
        const needsMentor = (project.maturityStage === 'IDEA' || project.maturityStage === 'DRAFT')
          || !project.formalization?.readyToFormalize
          || (project.coverage?.coveragePercent ?? 0) < 50;
        if (!needsMentor) return false;
      }
      if (focusMode === 'ready' && !project.formalization?.readyToFormalize) return false;
      if (focusMode === 'no-team' && !hasChecklistGap(project, 'team')) return false;
      if (focusMode === 'no-board' && !hasChecklistGap(project, 'board')) return false;
      if (focusMode === 'no-milestone' && !hasChecklistGap(project, 'milestone')) return false;
      if (focusMode === 'low-coverage' && (project.coverage?.coveragePercent ?? 0) >= 50) return false;
      if (!query) return true;
      return [
        project.name,
        project.description,
        project.problemStatement,
        project.nextStep,
      ].some((value) => value?.toLowerCase().includes(query));
    });
  }, [projects, search, projectListFilter, showOnlyNeedsFormalization, focusMode]);

  const operatingPipeline = useMemo(() => {
    const grouped = new Map<string, Project[]>();
    for (const stage of OPERATING_PIPELINE) grouped.set(stage.key, []);
    for (const project of filteredProjects) {
      const lane = OPERATING_PIPELINE.find((stage) => stage.stages.includes(project.workflowStage ?? 'INTAKE'));
      if (lane) grouped.get(lane.key)!.push(project);
    }
    return OPERATING_PIPELINE.map((stage) => ({ ...stage, projects: grouped.get(stage.key) ?? [] }));
  }, [filteredProjects]);

  const pausedProjects = useMemo(
    () => filteredProjects.filter((project) => project.workflowStage === 'PAUSED'),
    [filteredProjects]
  );

  const intakeProjects = useMemo(
    () => filteredProjects
      .filter((project) => project.workflowStage === 'INTAKE')
      .sort((a, b) => {
        const aCoverage = a.coverage?.coveragePercent ?? 0;
        const bCoverage = b.coverage?.coveragePercent ?? 0;
        if (aCoverage !== bCoverage) return aCoverage - bCoverage;
        return (a.formalization?.completed ?? 0) - (b.formalization?.completed ?? 0);
      }),
    [filteredProjects]
  );

  const metrics = useMemo(() => {
    const total = projects.length;
    const ready = projects.filter((project) => project.formalization?.readyToFormalize).length;
    const blocked = projects.filter((project) => (project.coverage?.coveragePercent ?? 0) < 50).length;
    const withoutTeam = projects.filter((project) => hasChecklistGap(project, 'team')).length;
    const withoutBoard = projects.filter((project) => hasChecklistGap(project, 'board')).length;
    const withoutMilestone = projects.filter((project) => hasChecklistGap(project, 'milestone')).length;
    const mentorNeeded = projects.filter((project) =>
      project.maturityStage === 'IDEA'
      || project.maturityStage === 'DRAFT'
      || !project.formalization?.readyToFormalize
      || (project.coverage?.coveragePercent ?? 0) < 50
    ).length;
    const averageCoverage = total > 0
      ? Math.round(projects.reduce((sum, project) => sum + (project.coverage?.coveragePercent ?? 0), 0) / total)
      : 0;
    return { total, ready, blocked, averageCoverage, withoutTeam, withoutBoard, withoutMilestone, mentorNeeded };
  }, [projects]);

  const portfolioMetrics = useMemo(() => {
    const active = projects.filter((project) => isActiveProject(project)).length;
    const blocked = projects.filter((project) => getPortfolioHealth(project).label === 'Bloqueado' || getPortfolioHealth(project).label === 'En pausa').length;
    const atRisk = projects.filter((project) => getPortfolioHealth(project).label === 'En riesgo').length;
    const upcomingOrOverdue = projects.filter((project) => {
      const milestone = getNextMilestone(project);
      if (!milestone.date) return false;
      const days = (milestone.date.getTime() - Date.now()) / 86_400_000;
      return days <= 7;
    }).length;
    return { active, blocked, atRisk, upcomingOrOverdue };
  }, [projects]);

  const portfolioProjects = useMemo(() => {
    const priority: Record<string, number> = { Bloqueado: 0, 'En pausa': 1, 'En riesgo': 2, 'En marcha': 3, 'En seguimiento': 4 };
    return [...filteredProjects].sort((a, b) => {
      const healthDifference = priority[getPortfolioHealth(a).label] - priority[getPortfolioHealth(b).label];
      if (healthDifference !== 0) return healthDifference;
      const aDate = getNextMilestone(a).date?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bDate = getNextMilestone(b).date?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aDate - bDate;
    });
  }, [filteredProjects]);

  const portfolioAttention = useMemo(
    () => portfolioProjects.filter((project) => ['Bloqueado', 'En pausa', 'En riesgo'].includes(getPortfolioHealth(project).label)).slice(0, 3),
    [portfolioProjects]
  );

  const reporting = useMemo(() => {
    const stageRows = PIPELINE.map((stage) => {
      const items = projects.filter((project) => (project.maturityStage ?? 'IDEA') === stage.key);
      const count = items.length;
      const avgCoverage = count > 0
        ? Math.round(items.reduce((sum, project) => sum + (project.coverage?.coveragePercent ?? 0), 0) / count)
        : 0;
      const readyCount = items.filter((project) => project.formalization?.readyToFormalize).length;
      const lowCoverageCount = items.filter((project) => (project.coverage?.coveragePercent ?? 0) < 50).length;
      return {
        ...stage,
        count,
        avgCoverage,
        readyCount,
        lowCoverageCount,
      };
    });

    const alerts = [
      {
        key: 'problem',
        label: 'Sin problema claro',
        count: projects.filter((project) => !project.problemStatement?.trim()).length,
        tone: '#A97556',
      },
      {
        key: 'team',
        label: 'Sin equipo base',
        count: projects.filter((project) => hasChecklistGap(project, 'team')).length,
        tone: '#AA895E',
      },
      {
        key: 'board',
        label: 'Sin tablero',
        count: projects.filter((project) => hasChecklistGap(project, 'board')).length,
        tone: '#8D84B0',
      },
      {
        key: 'milestone',
        label: 'Sin hito inicial',
        count: projects.filter((project) => hasChecklistGap(project, 'milestone')).length,
        tone: '#9271BD',
      },
    ].sort((a, b) => b.count - a.count);

    return { stageRows, alerts };
  }, [projects]);

  const spotlight = useMemo(() => {
    const mentorNeeded = projects
      .filter((project) =>
        project.maturityStage === 'IDEA'
        || project.maturityStage === 'DRAFT'
        || !project.formalization?.readyToFormalize
        || (project.coverage?.coveragePercent ?? 0) < 50
      )
      .sort((a, b) => (a.coverage?.coveragePercent ?? 0) - (b.coverage?.coveragePercent ?? 0))
      .slice(0, 4);

    const ready = projects
      .filter((project) => project.formalization?.readyToFormalize)
      .sort((a, b) => (b.coverage?.coveragePercent ?? 0) - (a.coverage?.coveragePercent ?? 0))
      .slice(0, 4);

    return { mentorNeeded, ready };
  }, [projects]);

  const portfolioQueues = useMemo(() => {
    const readyToday = projects
      .filter((project) => project.formalization?.readyToFormalize)
      .sort((a, b) => (b.coverage?.coveragePercent ?? 0) - (a.coverage?.coveragePercent ?? 0))
      .slice(0, 5);

    const blockedByTeam = projects
      .filter((project) => hasChecklistGap(project, 'team'))
      .sort((a, b) => (a.coverage?.coveragePercent ?? 0) - (b.coverage?.coveragePercent ?? 0))
      .slice(0, 5);

    const misleadingCoverage = projects
      .filter((project) => (project.coverage?.coveragePercent ?? 0) >= 60 && !project.formalization?.readyToFormalize)
      .sort((a, b) => (b.coverage?.coveragePercent ?? 0) - (a.coverage?.coveragePercent ?? 0))
      .slice(0, 5);

    return { readyToday, blockedByTeam, misleadingCoverage };
  }, [projects]);

  const standardTransition = useMemo(() => {
    if (!currentProjectStandard) return null;

    const previousVersion = projectStandardHistory.find((item) => item.version < currentProjectStandard.version) ?? null;
    const legacyProjects = projects.filter((project) => (project.appliedStandardVersion ?? 1) < currentProjectStandard.version).length;

    return {
      current: currentProjectStandard,
      previous: previousVersion,
      legacyProjects,
    };
  }, [currentProjectStandard, projectStandardHistory, projects]);

  const versionReporting = useMemo(() => {
    const grouped = new Map<number, Project[]>();

    for (const project of projects) {
      const version = project.appliedStandardVersion ?? 1;
      if (!grouped.has(version)) grouped.set(version, []);
      grouped.get(version)!.push(project);
    }

    return Array.from(grouped.entries())
      .map(([version, items]) => {
        const count = items.length;
        const avgCoverage = count > 0
          ? Math.round(items.reduce((sum, project) => sum + (project.coverage?.coveragePercent ?? 0), 0) / count)
          : 0;
        const readyCount = items.filter((project) => project.formalization?.readyToFormalize).length;
        const mentorNeededCount = items.filter((project) =>
          project.maturityStage === 'IDEA'
          || project.maturityStage === 'DRAFT'
          || !project.formalization?.readyToFormalize
          || (project.coverage?.coveragePercent ?? 0) < 50
        ).length;
        const teamGapCount = items.filter((project) => hasChecklistGap(project, 'team')).length;

        return {
          version,
          count,
          avgCoverage,
          readyCount,
          mentorNeededCount,
          teamGapCount,
          adoptionRate: count > 0 ? Math.round((readyCount / count) * 100) : 0,
        };
      })
      .sort((a, b) => b.version - a.version);
  }, [projects]);

  const intakeMetrics = useMemo(() => {
    const withReview = intakeProjects.filter((project) => Boolean(project.nextReviewAt)).length;
    const ready = intakeProjects.filter((project) => Boolean(project.problemStatement?.trim()) && Boolean(project.nextStep?.trim())).length;
    const missingProblem = intakeProjects.filter((project) => !project.problemStatement?.trim()).length;
    return { total: intakeProjects.length, withReview, ready, missingProblem };
  }, [intakeProjects]);

  const methodologyColumns = useMemo(
    () => getMethodologyColumns(workspaceExperience, filteredProjects),
    [workspaceExperience, filteredProjects]
  );

  const adaptiveMetrics = useMemo(() => {
    const withNextStep = projects.filter((project) => Boolean(project.nextStep?.trim())).length;
    const active = projects.filter((project) => isActiveProject(project)).length;
    const completed = projects.filter((project) => isDoneProject(project)).length;
    const missingDates = projects.filter((project) => !project.startDate || !project.endDate).length;
    const missingProblem = projects.filter((project) => !project.problemStatement?.trim()).length;

    if (workspaceExperience === 'personal') {
      return [
        { label: 'Proyectos', value: metrics.total, tone: 'var(--c-text)', icon: ClipboardList },
        { label: 'Con siguiente acción', value: withNextStep, tone: '#8D84B0', icon: ChevronRight },
        { label: 'En marcha', value: active, tone: '#9271BD', icon: Target },
        { label: 'Cerrados', value: completed, tone: '#548B73', icon: CheckCircle2 },
      ];
    }

    if (workspaceExperience === 'marketing') {
      return [
        { label: 'Campañas', value: metrics.total, tone: 'var(--c-text)', icon: ClipboardList },
        { label: 'Briefs abiertos', value: intakeMetrics.total, tone: '#8D84B0', icon: CircleDashed },
        { label: 'En producción', value: active, tone: '#9271BD', icon: Target },
        { label: 'Sin fechas', value: missingDates, tone: '#AA895E', icon: AlertCircle },
      ];
    }

    if (workspaceExperience === 'construction') {
      return [
        { label: 'Obras / frentes', value: metrics.total, tone: 'var(--c-text)', icon: ClipboardList },
        { label: 'Planificados', value: projects.filter((project) => project.maturityStage === 'PLANNED').length, tone: '#AA895E', icon: Target },
        { label: 'En ejecución', value: active, tone: '#9271BD', icon: CheckCircle2 },
        { label: 'Sin hito', value: metrics.withoutMilestone, tone: '#A97556', icon: AlertCircle },
      ];
    }

    return [
      { label: 'Proyectos', value: metrics.total, tone: 'var(--c-text)', icon: ClipboardList },
      { label: 'Listos para coordinar', value: metrics.ready, tone: '#548B73', icon: CheckCircle2 },
      { label: 'Sin tablero', value: metrics.withoutBoard, tone: '#AA895E', icon: Target },
      { label: 'Sin problema claro', value: missingProblem, tone: '#A97556', icon: AlertCircle },
    ];
  }, [intakeMetrics.total, metrics, projects, workspaceExperience]);

  const methodGuidance = useMemo(() => {
    if (workspaceExperience === 'personal') {
      return [
        'Captura ideas sin sobredocumentarlas, pero exige una siguiente acción para que no queden flotando.',
        'Usa En marcha solo cuando el proyecto tenga una decisión tomada y trabajo real activo.',
        'Cierra o archiva lo que ya no tenga energía; la vista debe ayudarte a elegir, no a acumular.',
      ];
    }
    if (workspaceExperience === 'marketing') {
      return [
        'Cada brief debería declarar objetivo, pieza o campaña y fecha tentativa antes de producción.',
        'Aprobado significa que ya se puede coordinar recursos, no que la pieza esté terminada.',
        'La medición queda al final del flujo para separar entrega de aprendizaje.',
      ];
    }
    if (workspaceExperience === 'construction') {
      return [
        'No empujes ejecución sin fechas, equipo base y primer hito visible.',
        'Planificación concentra dependencias; ejecución concentra seguimiento y desbloqueos.',
        'Riesgo / cierre debe mostrar pausas, bloqueos y entregas que requieren decisión.',
      ];
    }
    return [
      'Backlog recibe solicitudes e ideas sin obligarlas todavía a ejecución.',
      'Listo para coordinar exige problema, tablero o siguiente paso suficiente para el equipo.',
      'En curso debe mantenerse corto para facilitar seguimiento semanal.',
    ];
  }, [workspaceExperience]);

  function handleProjectCreated(project: Project) {
    setProjects((prev) => [project, ...prev]);
    setShowCreate(false);
    router.push(`/dashboard/projects/${project.id}`);
  }

  async function refreshProjects() {
    if (!activeWorkspaceId) return;
    const items = await fetchProjectsByWorkspace(activeWorkspaceId);
    setProjects(items);
  }

  async function runProjectAction(projectId: string, action: string, work: () => Promise<void>) {
    setBusyActionByProject((prev) => ({ ...prev, [projectId]: action }));
    try {
      await work();
      await refreshProjects();
    } finally {
      setBusyActionByProject((prev) => ({ ...prev, [projectId]: null }));
    }
  }

  async function handleStartDiagnosis(project: Project) {
    await runProjectAction(project.id, 'diagnosis', async () => {
      const nextReview = new Date();
      nextReview.setDate(nextReview.getDate() + 7);
      await transitionWorkflow(project.id, {
        workflowStage: 'DIAGNOSIS',
        decision: 'ACCEPTED',
        nextReviewAt: nextReview.toISOString(),
      });
    });
  }

  async function handlePauseInitiative(project: Project) {
    await runProjectAction(project.id, 'pause', async () => {
      await transitionWorkflow(project.id, {
        workflowStage: 'PAUSED',
        decision: 'PAUSED',
        reason: 'Pendiente de una próxima revisión institucional.',
      });
    });
  }

  async function handleAdvanceWorkflow(project: Project) {
    const nextStage: Partial<Record<ProjectWorkflowStage, ProjectWorkflowStage>> = {
      DIAGNOSIS: 'VALIDATION',
      VALIDATION: 'PREPARATION',
      PREPARATION: 'EXECUTION',
      EXECUTION: 'CLOSURE',
    };
    const workflowStage = nextStage[project.workflowStage];
    if (!workflowStage) return;

    await runProjectAction(project.id, 'advance', async () => {
      const nextReview = new Date();
      nextReview.setDate(nextReview.getDate() + (workflowStage === 'CLOSURE' ? 0 : 14));
      await transitionWorkflow(project.id, {
        workflowStage,
        decision: workflowStage === 'CLOSURE' ? 'COMPLETED' : undefined,
        nextReviewAt: workflowStage === 'CLOSURE' ? null : nextReview.toISOString(),
      });
    });
  }

  async function handleFormalize(project: Project) {
    await runProjectAction(project.id, 'formalize', async () => {
      await updateProject(project.id, {
        maturityStage: 'FORMALIZED',
      });
    });
  }

  async function handlePlanify(project: Project) {
    await runProjectAction(project.id, 'planify', async () => {
      await updateProject(project.id, {
        maturityStage: 'PLANNED',
        status: project.status === 'ACTIVE' ? 'ACTIVE' : 'PLANNING',
      });
    });
  }

  async function handleCreateBaseBoard(project: Project) {
    await runProjectAction(project.id, 'board', async () => {
      await createBoard(project.workspaceId, {
        name: `${project.name} Board`,
        description: project.problemStatement?.trim() || project.description?.trim() || 'Execution board',
        projectId: project.id,
      });
      if (!project.nextStep?.trim()) {
        await updateProject(project.id, { nextStep: 'Ordenar primeras tareas en el tablero base' });
      }
    });
  }

  async function handleCreateInitialMilestone(project: Project) {
    await runProjectAction(project.id, 'milestone', async () => {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      await createMilestone(project.id, {
        name: 'Primer hito',
        description: project.nextStep?.trim() || 'Primer compromiso visible del proyecto',
        date: nextWeek.toISOString(),
        color: project.color ?? '#7452A6',
      });
      if (!project.nextStep?.trim()) {
        await updateProject(project.id, { nextStep: 'Validar y completar el primer hito del proyecto' });
      }
    });
  }

  async function handleAssignBaseTeam(project: Project) {
    const teamId = selectedTeamByProject[project.id];
    if (!teamId) return;
    if (teams.find((team) => team.id === teamId)?.workspaceId !== project.workspaceId) return;

    await runProjectAction(project.id, 'team', async () => {
      await apiService.post(`/api/projects/${project.id}/teams`, { teamId }, true);
      setTeamPickerProjectId(null);
    });
  }

  return (
    <div className={entrance.page} style={{ minHeight: '100%', background: C.bg, fontFamily: MANROPE }}>
      <div style={{ maxWidth: '1360px', margin: '0 auto', padding: '28px clamp(18px,3vw,36px) 48px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '18px', flexWrap: 'wrap', marginBottom: '22px' }}>
          <div>
            <h1 style={{ margin: 0, fontFamily: SORA, fontSize: '28px', fontWeight: 700, color: 'var(--c-text)', letterSpacing: '-0.04em' }}>
              {workspaceExperience === 'personal' ? 'Mis proyectos' : 'Proyectos del espacio'}
            </h1>
            <p style={{ margin: '7px 0 0', fontSize: '13px', color: 'var(--c-text3)', maxWidth: '760px', lineHeight: 1.55 }}>
              {workspaceExperience === 'personal'
                ? 'Tus ideas, objetivos y próximos pasos, organizados en un solo lugar.'
                : 'Consulta los proyectos creados en este espacio y continúa donde los dejaste.'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {isInstitutionalExperience && (
              <button
                type="button"
                onClick={() => router.push('/dashboard/initiatives')}
                style={{
                  height: '32px', padding: '0 12px', borderRadius: '8px',
                  border: '1px solid rgba(97,71,130,0.10)', background: 'rgba(97,71,130,0.03)',
                  display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--c-text2)', cursor: 'pointer',
                  fontSize: '12px', fontWeight: 700, fontFamily: SORA,
                }}
              >
                <CircleDashed style={{ width: '13px', height: '13px' }} />
                Iniciativas
              </button>
            )}

            <button
              onClick={() => setShowCreate(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '10px 16px', borderRadius: '8px', border: 'none',
                background: '#7452A6', color: '#FFFFFF', cursor: 'pointer',
                fontFamily: SORA, fontSize: '13px', fontWeight: 700,
              }}
            >
              <CircleDashed style={{ width: '14px', height: '14px' }} />
              Nuevo proyecto
            </button>
          </div>
        </div>

        {isInstitutionalExperience && viewMode === 'pipeline' && (
          <details style={{ marginBottom: '18px', borderRadius: '10px', border: '1px solid rgba(97,71,130,0.08)', background: 'rgba(97,71,130,0.02)', padding: '0 16px' }}>
            <summary style={{ cursor: 'pointer', padding: '12px 0', color: 'var(--c-text3)', fontFamily: SORA, fontSize: '12px', fontWeight: 700 }}>Reglas del estándar</summary>
            <div style={{ display: 'grid', gridTemplateColumns: SUMMARY_GRID, gap: '16px', padding: '0 0 16px', alignItems: 'start' }}>
            <div style={{ borderRadius: '10px', border: '1px solid rgba(97,71,130,0.08)', background: 'rgba(97,71,130,0.02)', padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontFamily: SORA, fontSize: '14px', fontWeight: 700, color: 'var(--c-text)' }}>
                    {currentProjectStandard ? `Marco operativo: ${currentProjectStandard.name}` : 'Marco operativo del workspace'}
                  </div>
                  <div style={{ marginTop: '5px', fontSize: '12.5px', color: 'var(--c-text3)', lineHeight: 1.5, maxWidth: '780px' }}>
                    {currentProjectStandard
                      ? `La cartera hoy corre con v${currentProjectStandard.version}. Este estándar define desde qué madurez se planifica, qué campos deben existir y qué checks vuelven formalizable a un proyecto.`
                      : 'Todavía no hay un estándar cargado para este workspace.'}
                  </div>
                </div>

                {currentProjectStandard && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#C7D7EC', background: 'rgba(97,71,130,0.06)', border: '1px solid rgba(97,71,130,0.08)', borderRadius: '999px', padding: '5px 9px' }}>
                      v{currentProjectStandard.version}
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#AA895E', background: 'rgba(196,168,110,0.12)', border: '1px solid rgba(196,168,110,0.22)', borderRadius: '999px', padding: '5px 9px' }}>
                      Intake: {currentProjectStandard.definition.intakeStages.join(' / ')}
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#548B73', background: 'rgba(118,168,120,0.12)', border: '1px solid rgba(118,168,120,0.22)', borderRadius: '999px', padding: '5px 9px' }}>
                      {currentProjectStandard.definition.requiredChecklist.length} checks
                    </span>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: COMPACT_GRID, gap: '10px', marginTop: '16px' }}>
                {[
                  { label: 'Cohorte activa', value: `v${currentProjectStandard?.version ?? 1}`, hint: `${projects.filter((project) => (project.appliedStandardVersion ?? 1) === (currentProjectStandard?.version ?? 1)).length} proyecto(s)`, tone: '#C7D7EC' },
                  { label: 'Cohorte previa', value: standardTransition?.previous ? `v${standardTransition.previous.version}` : 'Sin previa', hint: `${standardTransition?.legacyProjects ?? 0} proyecto(s) heredados`, tone: '#AA895E' },
                  { label: 'Mínimo para planificar', value: currentProjectStandard ? getMaturityMeta(currentProjectStandard.definition.minimumMaturityForPlanning).label : 'Base', hint: 'Punto de corte institucional', tone: '#548B73' },
                ].map((item) => (
                  <div key={item.label} style={{ borderRadius: '9px', border: '1px solid rgba(97,71,130,0.06)', background: 'rgba(97,71,130,0.025)', padding: '12px 12px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--c-text4)', textTransform: 'uppercase' }}>{item.label}</div>
                    <div style={{ marginTop: '7px', fontFamily: SORA, fontSize: '20px', fontWeight: 700, color: item.tone }}>{item.value}</div>
                    <div style={{ marginTop: '5px', fontSize: '11px', color: 'var(--c-text3)' }}>{item.hint}</div>
                  </div>
                ))}
              </div>

              {currentProjectStandard && (
                <div style={{ display: 'grid', gridTemplateColumns: COMPACT_GRID, gap: '14px', marginTop: '16px' }}>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--c-text4)', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Campos requeridos
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {currentProjectStandard.definition.requiredProjectFields.map((field) => (
                        <span key={field} style={{ fontSize: '11px', color: 'var(--c-text2)', background: 'rgba(97,71,130,0.04)', border: '1px solid rgba(97,71,130,0.08)', borderRadius: '999px', padding: '5px 8px' }}>
                          {field}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--c-text4)', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Estructura obligatoria
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {currentProjectStandard.definition.requiredChecklist.map((item) => (
                        <span key={item} style={{ fontSize: '11px', color: 'var(--c-text2)', background: 'rgba(97,71,130,0.04)', border: '1px solid rgba(97,71,130,0.08)', borderRadius: '999px', padding: '5px 8px' }}>
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ borderRadius: '10px', border: '1px solid rgba(97,71,130,0.08)', background: 'rgba(97,71,130,0.02)', padding: '16px' }}>
                <div style={{ fontFamily: SORA, fontSize: '13px', fontWeight: 700, color: 'var(--c-text)' }}>Atención operativa</div>
                <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--c-text3)', lineHeight: 1.45 }}>
                  Una lectura corta de qué conviene mover antes de entrar al detalle del pipeline.
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                  {[
                    { title: 'Listos para formalizar', tone: '#548B73', items: portfolioQueues.readyToday },
                    { title: 'Trabados por equipo', tone: '#AA895E', items: portfolioQueues.blockedByTeam },
                    { title: 'Cobertura engañosa', tone: '#8D84B0', items: portfolioQueues.misleadingCoverage },
                  ].map((section) => (
                    <div key={section.title} style={{ borderRadius: '9px', border: '1px solid rgba(97,71,130,0.06)', background: 'rgba(97,71,130,0.02)', padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: section.tone, fontFamily: SORA }}>{section.title}</span>
                        <span style={{ fontSize: '11px', color: 'var(--c-text3)' }}>{section.items.length}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginTop: '9px' }}>
                        {section.items.length === 0 ? (
                          <div style={{ fontSize: '11.5px', color: 'var(--c-text4)' }}>Sin proyectos visibles.</div>
                        ) : section.items.slice(0, 3).map((project) => (
                          <button
                            key={project.id}
                            onClick={() => router.push(`/dashboard/projects/${project.id}`)}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', border: 'none', background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer' }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</div>
                              <div style={{ marginTop: '3px', fontSize: '11px', color: 'var(--c-text3)' }}>{getProjectPortfolioReason(project)}</div>
                            </div>
                            <span style={{ fontFamily: SORA, fontSize: '14px', fontWeight: 700, color: getCoverageTone(project.coverage?.coveragePercent ?? 0), flexShrink: 0 }}>
                              {project.coverage?.coveragePercent ?? 0}%
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ borderRadius: '10px', border: '1px solid rgba(97,71,130,0.08)', background: 'rgba(97,71,130,0.02)', padding: '16px' }}>
                <div style={{ fontFamily: SORA, fontSize: '13px', fontWeight: 700, color: 'var(--c-text)' }}>Lectura rápida</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', marginTop: '14px' }}>
                  {[
                    { label: 'Proyectos que aún no tienen equipo base', value: metrics.withoutTeam, tone: '#A97556' },
                    { label: 'Proyectos sin tablero de ejecución', value: metrics.withoutBoard, tone: '#AA895E' },
                    { label: 'Proyectos sin próximo hito declarado', value: metrics.withoutMilestone, tone: '#8D84B0' },
                  ].map((item) => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--c-text2)', lineHeight: 1.45 }}>{item.label}</span>
                      <span style={{ fontFamily: SORA, fontSize: '16px', fontWeight: 700, color: item.tone, flexShrink: 0 }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            </div>
          </details>
        )}

        {!isInstitutionalExperience && viewMode === 'pipeline' && (
          <div style={{ display: 'grid', gridTemplateColumns: SUMMARY_GRID, gap: '16px', marginBottom: '18px', alignItems: 'start' }}>
            <div style={{ borderRadius: '10px', border: `1px solid ${experienceMeta.accent}33`, background: 'rgba(97,71,130,0.02)', padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontFamily: SORA, fontSize: '14px', fontWeight: 700, color: 'var(--c-text)' }}>{experienceMeta.method}</div>
                  <div style={{ marginTop: '5px', fontSize: '12.5px', color: 'var(--c-text3)', lineHeight: 1.5, maxWidth: '760px' }}>
                    {currentProjectStandard
                      ? `${currentProjectStandard.name} v${currentProjectStandard.version} adapta la gestión a este tipo de workspace.`
                      : 'Este workspace usa una vista adaptada a su forma natural de trabajo.'}
                  </div>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: experienceMeta.accent, background: `${experienceMeta.accent}14`, border: `1px solid ${experienceMeta.accent}44`, borderRadius: '999px', padding: '5px 9px' }}>
                  {methodologyColumns.length} etapas
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: COMPACT_GRID, gap: '10px', marginTop: '16px' }}>
                {methodologyColumns.map((column) => (
                  <div key={column.key} style={{ borderRadius: '9px', border: '1px solid rgba(97,71,130,0.06)', background: 'rgba(97,71,130,0.025)', padding: '12px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--c-text4)', textTransform: 'uppercase' }}>{column.label}</div>
                    <div style={{ marginTop: '7px', fontFamily: SORA, fontSize: '20px', fontWeight: 700, color: column.tone }}>{column.projects.length}</div>
                    <div style={{ marginTop: '5px', fontSize: '11px', color: 'var(--c-text3)' }}>{column.hint}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ borderRadius: '10px', border: '1px solid rgba(97,71,130,0.08)', background: 'rgba(97,71,130,0.02)', padding: '16px' }}>
              <div style={{ fontFamily: SORA, fontSize: '13px', fontWeight: 700, color: 'var(--c-text)' }}>Cómo usar esta vista</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                {methodGuidance.map((text) => (
                  <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: 'var(--c-text2)', fontSize: '12.5px', lineHeight: 1.55 }}>
                    <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: `${experienceMeta.accent}18`, color: experienceMeta.accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', flexShrink: 0 }}>•</span>
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {viewMode === 'intake' && (
          <div style={{ display: 'grid', gridTemplateColumns: SUMMARY_GRID, gap: '16px', marginBottom: '18px' }}>
            <div style={{ borderRadius: '10px', border: '1px solid rgba(97,71,130,0.08)', background: 'rgba(97,71,130,0.02)', padding: '14px 16px' }}>
              <div style={{ fontFamily: SORA, fontSize: '13px', fontWeight: 700, color: 'var(--c-text)' }}>Criterio de admisión</div>
              <p style={{ margin: '6px 0 12px', fontSize: '12px', color: 'var(--c-text3)', lineHeight: 1.55 }}>
                Esta bandeja deja ver qué iniciativas todavía están en intención, cuáles ya son un borrador útil y cuáles están listas para empujarse a formalización.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: COMPACT_GRID, gap: '10px' }}>
                {[
                  { label: 'Problema claro', value: intakeMetrics.total - intakeMetrics.missingProblem, tone: '#548B73' },
                  { label: 'Listos para formalizar', value: intakeMetrics.ready, tone: '#AA895E' },
                  { label: 'Aún verdes', value: Math.max(intakeMetrics.total - intakeMetrics.ready, 0), tone: '#A97556' },
                ].map((item) => (
                  <div key={item.label} style={{ borderRadius: '8px', background: 'rgba(97,71,130,0.03)', padding: '10px 12px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--c-text4)', textTransform: 'uppercase' }}>{item.label}</div>
                    <div style={{ marginTop: '7px', fontFamily: SORA, fontSize: '22px', fontWeight: 700, color: item.tone }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ borderRadius: '10px', border: '1px solid rgba(97,71,130,0.08)', background: 'rgba(97,71,130,0.02)', padding: '14px 16px' }}>
              <div style={{ fontFamily: SORA, fontSize: '13px', fontWeight: 700, color: 'var(--c-text)' }}>Siguiente movimiento</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <span style={{ fontSize: '12.5px', color: 'var(--c-text2)' }}>Ideas que requieren clarificar problema</span>
                  <span style={{ fontFamily: SORA, fontSize: '18px', fontWeight: 700, color: '#A97556' }}>{intakeMetrics.missingProblem}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <span style={{ fontSize: '12.5px', color: 'var(--c-text2)' }}>Iniciativas sin próxima revisión</span>
                  <span style={{ fontFamily: SORA, fontSize: '18px', fontWeight: 700, color: '#AA895E' }}>{intakeMetrics.total - intakeMetrics.withReview}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <span style={{ fontSize: '12.5px', color: 'var(--c-text2)' }}>Proyectos listos para pasar de intake</span>
                  <span style={{ fontFamily: SORA, fontSize: '18px', fontWeight: 700, color: '#548B73' }}>{intakeMetrics.ready}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', margin: '4px 0 24px' }}>
          <label style={{ position: 'relative', minWidth: '240px', flex: '1 1 340px' }}>
            <Search size={15} aria-hidden="true" style={{ color: 'var(--c-text3)', position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar tus proyectos"
              aria-label="Buscar tus proyectos"
              style={{ width: '100%', height: '42px', padding: '0 14px 0 38px', borderRadius: '10px', border: '1px solid rgba(97,71,130,0.09)', background: 'rgba(97,71,130,0.035)', color: 'var(--c-text)', outline: 'none', fontSize: '12.5px' }}
            />
          </label>

          <div role="group" aria-label="Filtrar proyectos por estado" style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap', padding: '4px', border: '1px solid rgba(97,71,130,0.07)', borderRadius: '11px', background: 'rgba(97,71,130,0.025)' }}>
            {[
              { key: 'all' as const, label: 'Todos', count: projects.length },
              { key: 'active' as const, label: 'En marcha', count: projects.filter(isActiveProject).length },
              { key: 'paused' as const, label: 'En pausa', count: projects.filter((project) => project.status === 'ON_HOLD' || project.maturityStage === 'ON_HOLD').length },
              { key: 'completed' as const, label: 'Cerrados', count: projects.filter(isDoneProject).length },
            ].map((filter) => {
              const active = projectListFilter === filter.key;
              return (
                <button
                  key={filter.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setProjectListFilter(filter.key)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', minHeight: '32px', padding: '0 10px', border: '1px solid transparent', borderRadius: '8px', background: active ? 'rgba(116,82,166,0.14)' : 'transparent', color: active ? 'var(--c-accent-text)' : 'var(--c-text2)', fontSize: '11px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  {filter.label}
                  <span style={{ color: active ? 'var(--c-accent-text)' : 'var(--c-text3)', fontSize: '10px' }}>{filter.count}</span>
                </button>
              );
            })}
          </div>
        </div>


        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', border: '2px solid rgba(97,71,130,0.1)', borderTopColor: 'var(--c-accent-text)', animation: 'spin 0.7s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : viewMode === 'portfolio' ? (
          <>
            <section aria-labelledby="project-list-title">
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                <div>
                  <h2 id="project-list-title" style={{ margin: 0, color: 'var(--c-text)', fontFamily: SORA, fontSize: '17px', fontWeight: 700 }}>Tus proyectos</h2>
                  <p style={{ margin: '5px 0 0', color: 'var(--c-text3)', fontSize: '12px' }}>Abre un proyecto para continuar trabajando en él.</p>
                </div>
                <span style={{ color: 'var(--c-text3)', fontSize: '11.5px', fontWeight: 600 }}>{filteredProjects.length} de {projects.length}</span>
              </div>
              <PortfolioList
                projects={portfolioProjects}
                hasProjects={projects.length > 0}
                onProjectClick={(project) => router.push(`/dashboard/projects/${project.id}`)}
                onCreateProject={() => setShowCreate(true)}
              />
            </section>
          </>
        // La bandeja institucional vive en /dashboard/initiatives. Este bloque
        // sólo se conserva temporalmente para datos históricos que pudieran
        // abrirse de forma explícita; la navegación normal de proyectos nunca
        // entra en intake ni ejecuta decisiones de triage.
        ) : false ? (viewMode === 'pipeline' ? (
          <>
            {pausedProjects.length > 0 && (
              <section style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap', marginBottom: '14px', padding: '11px 14px', borderRadius: '10px', border: '1px solid rgba(219,138,102,0.28)', background: 'rgba(219,138,102,0.08)' }}>
                <div>
                  <div style={{ color: '#A97556', fontFamily: SORA, fontSize: '12px', fontWeight: 700 }}>{pausedProjects.length} proyecto(s) en pausa</div>
                  <div style={{ marginTop: '3px', color: 'var(--c-text2)', fontSize: '11.5px' }}>No forman parte del flujo activo y requieren una decisión para continuar, cerrar o replanificar.</div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                  {pausedProjects.slice(0, 3).map((project) => (
                    <button key={project.id} onClick={() => router.push(`/dashboard/projects/${project.id}`)} style={{ border: '1px solid rgba(219,138,102,0.3)', borderRadius: '999px', padding: '5px 9px', background: 'rgba(97,71,130,0.04)', color: 'var(--c-text)', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}>{project.name}</button>
                  ))}
                </div>
              </section>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: PIPELINE_GRID, gap: '14px', alignItems: 'start' }}>
              {operatingPipeline.map((stage) => (
                <section key={stage.key} style={{ minWidth: 0 }}>
                  <div style={{ marginBottom: '10px', padding: '12px 12px 10px', borderRadius: '10px', border: `1px solid ${stage.border}`, background: stage.soft }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                      <div style={{ fontFamily: SORA, fontSize: '13px', fontWeight: 700, color: stage.tone }}>{stage.label}</div>
                      <div style={{ minWidth: '24px', height: '24px', borderRadius: '999px', background: 'rgba(0,0,0,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--c-text)' }}>
                        {stage.projects.length}
                      </div>
                    </div>
                    <p style={{ margin: '6px 0 0', fontSize: '11.5px', lineHeight: 1.45, color: 'var(--c-text2)' }}>{stage.hint}</p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {stage.projects.length === 0 ? (
                      <div style={{ borderRadius: '10px', border: '1px dashed rgba(97,71,130,0.12)', padding: '18px 14px', color: 'var(--c-text4)', fontSize: '12px', textAlign: 'center', background: 'rgba(97,71,130,0.015)' }}>
                        Sin proyectos en esta etapa
                      </div>
                    ) : (
                      stage.projects.map((project) => (
                        <ProjectCard
                          key={project.id}
                          project={project}
                          onClick={() => router.push(`/dashboard/projects/${project.id}`)}
                          onAdvance={stage.key === 'closure' ? undefined : () => handleAdvanceWorkflow(project)}
                        />
                      ))
                    )}
                  </div>
                </section>
              ))}
            </div>

            <details style={{ marginTop: '18px', borderRadius: '10px', border: '1px solid rgba(97,71,130,0.08)', background: 'rgba(97,71,130,0.02)', padding: '0 16px' }}>
              <summary style={{ cursor: 'pointer', padding: '14px 0', fontFamily: SORA, fontSize: '13px', fontWeight: 700, color: 'var(--c-text)' }}>
                Lectura analítica del estándar
              </summary>

              <div style={{ display: 'grid', gridTemplateColumns: SUMMARY_GRID, gap: '16px', padding: '0 0 16px' }}>
                <div style={{ borderRadius: '9px', border: '1px solid rgba(97,71,130,0.06)', background: 'rgba(97,71,130,0.02)', padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontFamily: SORA, fontSize: '13px', fontWeight: 700, color: 'var(--c-text)' }}>Cohortes por versión</div>
                      <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--c-text3)', lineHeight: 1.45 }}>
                        Compara proyectos según la versión aplicada.
                      </div>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--c-text2)' }}>{versionReporting.length} cohortes</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {versionReporting.map((row) => {
                      const isCurrent = currentProjectStandard?.version === row.version;
                      return (
                        <div key={row.version} style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto', gap: '10px', alignItems: 'center', borderRadius: '8px', border: `1px solid ${isCurrent ? 'rgba(118,168,120,0.22)' : 'rgba(97,71,130,0.06)'}`, background: isCurrent ? 'rgba(118,168,120,0.06)' : 'rgba(97,71,130,0.02)', padding: '10px 12px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: isCurrent ? '#548B73' : 'var(--c-text)', fontFamily: SORA }}>v{row.version}</div>
                          <div style={{ fontSize: '11.5px', color: 'var(--c-text3)' }}>{row.count} proyecto(s) - {row.readyCount} listos</div>
                          <div style={{ fontFamily: SORA, fontSize: '15px', fontWeight: 700, color: getCoverageTone(row.avgCoverage) }}>{row.avgCoverage}%</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: COMPACT_GRID, gap: '16px' }}>
                  <div style={{ borderRadius: '9px', border: '1px solid rgba(97,71,130,0.06)', background: 'rgba(97,71,130,0.02)', padding: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '12px' }}>
                      <div>
                        <div style={{ fontFamily: SORA, fontSize: '13px', fontWeight: 700, color: 'var(--c-text)' }}>Embudo</div>
                        <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--c-text3)' }}>Distribución actual.</div>
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--c-text2)' }}>{metrics.total} total</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {reporting.stageRows.map((row) => {
                        const width = metrics.total > 0 ? Math.max((row.count / metrics.total) * 100, row.count > 0 ? 12 : 0) : 0;
                        return (
                          <div key={row.key} style={{ display: 'grid', gridTemplateColumns: '82px minmax(0, 1fr) 42px', gap: '8px', alignItems: 'center' }}>
                            <div style={{ minWidth: 0, fontSize: '11px', fontWeight: 700, color: row.tone, fontFamily: SORA }}>{row.label}</div>
                            <div style={{ height: '9px', borderRadius: '999px', background: 'rgba(97,71,130,0.06)', overflow: 'hidden' }}>
                              <div style={{ width: `${width}%`, height: '100%', borderRadius: '999px', background: row.tone, transition: 'width 0.25s ease' }} />
                            </div>
                            <div style={{ textAlign: 'right', fontSize: '10.5px', color: 'var(--c-text2)' }}>{row.count}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ borderRadius: '9px', border: '1px solid rgba(97,71,130,0.06)', background: 'rgba(97,71,130,0.02)', padding: '14px' }}>
                    <div style={{ fontFamily: SORA, fontSize: '13px', fontWeight: 700, color: 'var(--c-text)' }}>Brechas estructurales</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', marginTop: '12px' }}>
                      {reporting.alerts.map((alert) => (
                        <div key={alert.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '8px 0', borderBottom: '1px solid rgba(97,71,130,0.05)' }}>
                          <span style={{ fontSize: '12px', color: 'var(--c-text2)' }}>{alert.label}</span>
                          <span style={{ fontFamily: SORA, fontSize: '16px', fontWeight: 700, color: alert.tone }}>{alert.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </details>
          </>
        ) : intakeProjects.length === 0 ? (
          <div style={{ borderRadius: '12px', border: '1px dashed rgba(97,71,130,0.12)', padding: '40px 24px', textAlign: 'center', color: 'var(--c-text4)', background: 'rgba(97,71,130,0.015)' }}>
            No hay proyectos en intake con el filtro actual.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: SUMMARY_GRID, gap: '16px', alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {intakeProjects.map((project) => (
                <div key={project.id} style={{ borderRadius: '10px', border: '1px solid rgba(97,71,130,0.08)', background: 'rgba(97,71,130,0.02)', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <button onClick={() => router.push(`/dashboard/projects/${project.id}`)} style={{ padding: 0, border: 'none', background: 'transparent', color: 'var(--c-text)', cursor: 'pointer', fontFamily: SORA, fontSize: '14px', fontWeight: 700 }}>
                          {project.name}
                        </button>
                        <span style={{ fontSize: '10.5px', fontWeight: 700, color: getMaturityMeta(project.maturityStage ?? 'IDEA').tone, background: getMaturityMeta(project.maturityStage ?? 'IDEA').soft, border: `1px solid ${getMaturityMeta(project.maturityStage ?? 'IDEA').border}`, borderRadius: '999px', padding: '4px 8px' }}>
                          {getMaturityMeta(project.maturityStage ?? 'IDEA').label}
                        </span>
                      </div>
                      <p style={{ margin: '8px 0 0', fontSize: '12.5px', color: 'var(--c-text2)', lineHeight: 1.55 }}>
                        {project.problemStatement?.trim() || project.description?.trim() || 'Todavía no declara bien el problema u oportunidad.'}
                      </p>
                    </div>
                    <span style={{ fontFamily: SORA, fontSize: '18px', fontWeight: 700, color: getCoverageTone(project.coverage?.coveragePercent ?? 0), flexShrink: 0 }}>
                      {project.coverage?.coveragePercent ?? 0}%
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: COMPACT_GRID, gap: '8px', marginTop: '12px' }}>
                    {(project.formalization?.checklist ?? []).map((item) => (
                      <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '7px', borderRadius: '8px', padding: '8px 9px', background: item.done ? 'rgba(118,168,120,0.08)' : 'rgba(97,71,130,0.03)', border: '1px solid rgba(97,71,130,0.05)' }}>
                        <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: item.done ? 'rgba(118,168,120,0.18)' : 'rgba(219,138,102,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {item.done ? <CheckCircle2 style={{ width: '10px', height: '10px', color: '#548B73' }} /> : <AlertCircle style={{ width: '10px', height: '10px', color: '#A97556' }} />}
                        </span>
                        <span style={{ fontSize: '11px', color: item.done ? 'var(--c-text2)' : 'var(--c-text3)' }}>{item.label}</span>
                      </div>
                    )).slice(0, 6)}
                  </div>

                  {project.nextStep && (
                    <div style={{ marginTop: '12px', display: 'flex', alignItems: 'flex-start', gap: '7px', color: 'var(--c-text2)', fontSize: '12px', lineHeight: 1.45 }}>
                      <ChevronRight style={{ width: '13px', height: '13px', color: 'var(--c-text3)', marginTop: '2px', flexShrink: 0 }} />
                      <span>{project.nextStep}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '14px' }}>
                    <button
                      onClick={() => handleStartDiagnosis(project)}
                      disabled={busyActionByProject[project.id] !== null}
                      style={{
                        height: '31px', padding: '0 12px', borderRadius: '8px', border: 'none',
                        background: busyActionByProject[project.id] === null ? 'rgba(118,168,120,0.16)' : 'rgba(97,71,130,0.05)',
                        color: busyActionByProject[project.id] === null ? '#548B73' : 'var(--c-text4)',
                        cursor: busyActionByProject[project.id] === null ? 'pointer' : 'not-allowed', fontSize: '12px', fontWeight: 700,
                      }}
                    >
                      {busyActionByProject[project.id] === 'diagnosis' ? 'Moviendo…' : 'Iniciar diagnóstico'}
                    </button>
                    <button
                      onClick={() => handlePauseInitiative(project)}
                      disabled={busyActionByProject[project.id] !== null}
                      style={{
                        height: '31px', padding: '0 12px', borderRadius: '8px', border: '1px solid rgba(219,138,102,0.25)',
                        background: 'rgba(219,138,102,0.08)', color: busyActionByProject[project.id] === null ? '#A97556' : 'var(--c-text4)',
                        cursor: busyActionByProject[project.id] === null ? 'pointer' : 'not-allowed', fontSize: '12px', fontWeight: 700,
                      }}
                    >
                      {busyActionByProject[project.id] === 'pause' ? 'Pausando…' : 'Pausar'}
                    </button>
                    <button
                      onClick={() => handleFormalize(project)}
                      disabled={busyActionByProject[project.id] !== null || !project.formalization?.readyToFormalize}
                      style={{
                        height: '31px', padding: '0 12px', borderRadius: '8px', border: 'none',
                        background: project.formalization?.readyToFormalize && busyActionByProject[project.id] === null ? 'rgba(118,168,120,0.16)' : 'rgba(97,71,130,0.05)',
                        color: project.formalization?.readyToFormalize && busyActionByProject[project.id] === null ? '#548B73' : 'var(--c-text4)',
                        cursor: project.formalization?.readyToFormalize && busyActionByProject[project.id] === null ? 'pointer' : 'not-allowed',
                        fontSize: '12px', fontWeight: 700,
                      }}
                    >
                      {busyActionByProject[project.id] === 'formalize' ? 'Formalizando…' : 'Marcar formalizado'}
                    </button>

                    <button
                      onClick={() => handlePlanify(project)}
                      disabled={busyActionByProject[project.id] !== null || !project.formalization?.readyToFormalize}
                      style={{
                        height: '31px', padding: '0 12px', borderRadius: '8px', border: 'none',
                        background: project.formalization?.readyToFormalize && busyActionByProject[project.id] === null ? 'rgba(75,96,127,0.18)' : 'rgba(97,71,130,0.05)',
                        color: project.formalization?.readyToFormalize && busyActionByProject[project.id] === null ? '#8D84B0' : 'var(--c-text4)',
                        cursor: project.formalization?.readyToFormalize && busyActionByProject[project.id] === null ? 'pointer' : 'not-allowed',
                        fontSize: '12px', fontWeight: 700,
                      }}
                    >
                      {busyActionByProject[project.id] === 'planify' ? 'Moviendo…' : 'Mover a planificado'}
                    </button>

                    <button
                      onClick={() => handleCreateBaseBoard(project)}
                      disabled={busyActionByProject[project.id] !== null || !hasChecklistGap(project, 'board')}
                      style={{
                        height: '31px', padding: '0 12px', borderRadius: '8px',
                        border: '1px solid rgba(97,71,130,0.08)',
                        background: busyActionByProject[project.id] === null && hasChecklistGap(project, 'board') ? 'rgba(116,82,166,0.1)' : 'rgba(97,71,130,0.03)',
                        color: busyActionByProject[project.id] === null && hasChecklistGap(project, 'board') ? '#9271BD' : 'var(--c-text4)',
                        cursor: busyActionByProject[project.id] === null && hasChecklistGap(project, 'board') ? 'pointer' : 'not-allowed',
                        fontSize: '12px', fontWeight: 700,
                      }}
                    >
                      {busyActionByProject[project.id] === 'board' ? 'Creando tablero…' : 'Crear tablero base'}
                    </button>

                    <button
                      onClick={() => handleCreateInitialMilestone(project)}
                      disabled={busyActionByProject[project.id] !== null || !hasChecklistGap(project, 'milestone')}
                      style={{
                        height: '31px', padding: '0 12px', borderRadius: '8px',
                        border: '1px solid rgba(97,71,130,0.08)',
                        background: busyActionByProject[project.id] === null && hasChecklistGap(project, 'milestone') ? 'rgba(123,143,168,0.12)' : 'rgba(97,71,130,0.03)',
                        color: busyActionByProject[project.id] === null && hasChecklistGap(project, 'milestone') ? '#8D84B0' : 'var(--c-text4)',
                        cursor: busyActionByProject[project.id] === null && hasChecklistGap(project, 'milestone') ? 'pointer' : 'not-allowed',
                        fontSize: '12px', fontWeight: 700,
                      }}
                    >
                      {busyActionByProject[project.id] === 'milestone' ? 'Creando hito…' : 'Crear hito inicial'}
                    </button>

                    <button
                      onClick={() => {
                        setTeamPickerProjectId((current) => current === project.id ? null : project.id);
                        const projectTeams = teams.filter((team) => team.workspaceId === project.workspaceId);
                        if (!selectedTeamByProject[project.id] && projectTeams[0]?.id) {
                          setSelectedTeamByProject((prev) => ({ ...prev, [project.id]: projectTeams[0].id }));
                        }
                      }}
                      disabled={busyActionByProject[project.id] !== null || !hasChecklistGap(project, 'team') || !teams.some((team) => team.workspaceId === project.workspaceId)}
                      style={{
                        height: '31px', padding: '0 12px', borderRadius: '8px',
                        border: '1px solid rgba(97,71,130,0.08)',
                        background: busyActionByProject[project.id] === null && hasChecklistGap(project, 'team') && teams.length > 0 ? 'rgba(196,168,110,0.12)' : 'rgba(97,71,130,0.03)',
                        color: busyActionByProject[project.id] === null && hasChecklistGap(project, 'team') && teams.length > 0 ? '#AA895E' : 'var(--c-text4)',
                        cursor: busyActionByProject[project.id] === null && hasChecklistGap(project, 'team') && teams.length > 0 ? 'pointer' : 'not-allowed',
                        fontSize: '12px', fontWeight: 700,
                      }}
                    >
                      {busyActionByProject[project.id] === 'team' ? 'Asignando…' : teams.length === 0 ? 'Sin equipos disponibles' : 'Asignar equipo base'}
                    </button>
                  </div>

                  {teamPickerProjectId === project.id && teams.some((team) => team.workspaceId === project.workspaceId) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '10px', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(97,71,130,0.07)', background: 'rgba(97,71,130,0.03)' }}>
                      <select
                        value={selectedTeamByProject[project.id] ?? ''}
                        onChange={(e) => setSelectedTeamByProject((prev) => ({ ...prev, [project.id]: e.target.value }))}
                        style={{
                          minWidth: '180px', height: '32px', padding: '0 10px', borderRadius: '7px',
                          border: '1px solid rgba(97,71,130,0.08)', background: 'var(--c-bg2)', color: 'var(--c-text)',
                          outline: 'none', fontSize: '12px',
                        }}
                      >
                        {teams.filter((team) => team.workspaceId === project.workspaceId).map((team) => (
                          <option key={team.id} value={team.id}>{team.name}</option>
                        ))}
                      </select>

                      <button
                        onClick={() => handleAssignBaseTeam(project)}
                        disabled={!selectedTeamByProject[project.id] || busyActionByProject[project.id] !== null}
                        style={{
                          height: '32px', padding: '0 12px', borderRadius: '7px', border: 'none',
                          background: selectedTeamByProject[project.id] && busyActionByProject[project.id] === null ? '#AA895E' : 'rgba(97,71,130,0.05)',
                          color: selectedTeamByProject[project.id] && busyActionByProject[project.id] === null ? '#FFFFFF' : 'var(--c-text4)',
                          cursor: selectedTeamByProject[project.id] && busyActionByProject[project.id] === null ? 'pointer' : 'not-allowed',
                          fontSize: '12px', fontWeight: 700,
                        }}
                      >
                        Confirmar equipo
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ borderRadius: '10px', border: '1px solid rgba(97,71,130,0.08)', background: 'rgba(97,71,130,0.02)', padding: '14px 16px' }}>
              <div style={{ fontFamily: SORA, fontSize: '13px', fontWeight: 700, color: 'var(--c-text)' }}>Qué mirar primero</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                {[
                  '¿El problema está descrito con suficiente claridad para que otro lo entienda?',
                  '¿Ya existe responsable, equipo base o al menos siguiente paso verificable?',
                  '¿Tiene un tablero y un hito que permitan pasar de conversación a coordinación?',
                  'Si ya cumple el mínimo, conviene moverlo a formalizado o planificado.',
                ].map((text) => (
                  <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: 'var(--c-text2)', fontSize: '12.5px', lineHeight: 1.55 }}>
                    <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'rgba(97,71,130,0.06)', color: 'var(--c-text3)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', flexShrink: 0 }}>•</span>
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )) : (
          <div style={{ display: 'grid', gridTemplateColumns: PIPELINE_GRID, gap: '14px', alignItems: 'start' }}>
            {methodologyColumns.map((column) => (
              <MethodologyColumn
                key={column.key}
                column={column}
                onProjectClick={(project) => router.push(`/dashboard/projects/${project.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateProjectModal
          onClose={() => setShowCreate(false)}
          onCreated={handleProjectCreated}
          defaultWorkspaceId={activeWorkspaceId ?? undefined}
        />
      )}
    </div>
  );
}
