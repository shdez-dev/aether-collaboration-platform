'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, ChevronRight, CircleDashed, ClipboardList, Search, Target } from 'lucide-react';
import { useProjectStore, type Project, type ProjectMaturityStage } from '@/stores/projectStore';
import { useBoardStore } from '@/stores/boardStore';
import { useTeamStore } from '@/stores/teamStore';
import { useActiveWorkspaceStore } from '@/stores/activeWorkspaceStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import CreateProjectModal from '@/components/CreateProjectModal';
import { WorkspaceIcon } from '@/components/WorkspaceIcon';
import { apiService } from '@/services/apiService';
import { C } from '@/lib/colors';

const SORA = "'Sora', system-ui, sans-serif";
const MANROPE = "'Manrope', system-ui, sans-serif";

const PIPELINE: { key: ProjectMaturityStage; label: string; tone: string; soft: string; border: string; hint: string }[] = [
  { key: 'IDEA', label: 'Idea', tone: '#7B8FA8', soft: 'rgba(123,143,168,0.12)', border: 'rgba(123,143,168,0.26)', hint: 'Intenciones iniciales que aún no amarran compromiso.' },
  { key: 'DRAFT', label: 'Borrador', tone: '#C4A86E', soft: 'rgba(196,168,110,0.12)', border: 'rgba(196,168,110,0.26)', hint: 'Ya existe una propuesta, pero todavía le falta estructura.' },
  { key: 'FORMALIZED', label: 'Formalizado', tone: '#76A878', soft: 'rgba(118,168,120,0.12)', border: 'rgba(118,168,120,0.26)', hint: 'El proyecto ya declaró responsable, problema y siguiente paso.' },
  { key: 'PLANNED', label: 'Planificado', tone: '#4B607F', soft: 'rgba(75,96,127,0.14)', border: 'rgba(75,96,127,0.26)', hint: 'Tiene estructura suficiente para coordinar ejecución.' },
  { key: 'ACTIVE', label: 'En ejecución', tone: '#F4905A', soft: 'rgba(242,87,30,0.12)', border: 'rgba(242,87,30,0.26)', hint: 'Trabajo corriendo con tableros, hitos y seguimiento.' },
  { key: 'ON_HOLD', label: 'En pausa', tone: '#DB8A66', soft: 'rgba(219,138,102,0.12)', border: 'rgba(219,138,102,0.26)', hint: 'Iniciativas detenidas que requieren destrabe o redefinición.' },
  { key: 'COMPLETED', label: 'Completado', tone: '#76A878', soft: 'rgba(118,168,120,0.12)', border: 'rgba(118,168,120,0.26)', hint: 'Trabajo cerrado y entregado.' },
];

function getMaturityMeta(stage: ProjectMaturityStage) {
  return PIPELINE.find((item) => item.key === stage) ?? PIPELINE[0];
}

function getCoverageTone(coverage = 0) {
  if (coverage >= 80) return '#76A878';
  if (coverage >= 50) return '#C4A86E';
  return '#DB8A66';
}

function getFormalizationIcon(project: Project) {
  const ready = project.formalization?.readyToFormalize;
  const completed = project.formalization?.completed ?? 0;
  const required = project.formalization?.required ?? 0;

  if (ready) return { icon: CheckCircle2, color: '#76A878', label: 'Formalizable' };
  if (completed > 0 && completed < required) return { icon: Target, color: '#C4A86E', label: 'En formalización' };
  return { icon: AlertCircle, color: '#DB8A66', label: 'Necesita base' };
}

function hasChecklistGap(project: Project, key: 'team' | 'board' | 'milestone') {
  return project.formalization?.checklist.find((item) => item.key === key)?.done === false;
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

type ViewMode = 'pipeline' | 'intake';

function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const maturity = getMaturityMeta(project.maturityStage ?? 'IDEA');
  const coveragePercent = project.coverage?.coveragePercent ?? 0;
  const coverageTone = getCoverageTone(coveragePercent);
  const formalization = getFormalizationIcon(project);
  const Icon = formalization.icon;

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        borderRadius: '10px',
        border: `1px solid ${maturity.border}`,
        background: 'rgba(255,255,255,0.02)',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'transform 0.14s, border-color 0.14s, background 0.14s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.background = 'rgba(255,255,255,0.035)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
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
          <div style={{ fontFamily: SORA, fontSize: '13.5px', fontWeight: 600, color: '#E8E1D2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {project.name}
          </div>
          <div style={{ marginTop: '3px', fontSize: '12px', color: '#827A6D', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {project.problemStatement?.trim() || project.description?.trim() || 'Aún no declara con claridad el problema u oportunidad.'}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '10.5px', fontWeight: 700, color: maturity.tone, background: maturity.soft, border: `1px solid ${maturity.border}`, borderRadius: '999px', padding: '4px 8px' }}>
          {maturity.label}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', fontWeight: 700, color: formalization.color }}>
          <Icon style={{ width: '12px', height: '12px' }} />
          {formalization.label}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div style={{ borderRadius: '8px', background: 'rgba(255,255,255,0.03)', padding: '9px 10px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', color: '#615846', textTransform: 'uppercase' }}>Formalización</div>
          <div style={{ marginTop: '5px', fontFamily: SORA, fontSize: '18px', fontWeight: 700, color: '#E8E1D2' }}>
            {project.formalization?.completed ?? 0}
            <span style={{ fontSize: '12px', color: '#827A6D' }}>/{project.formalization?.required ?? 0}</span>
          </div>
        </div>
        <div style={{ borderRadius: '8px', background: 'rgba(255,255,255,0.03)', padding: '9px 10px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', color: '#615846', textTransform: 'uppercase' }}>Cobertura</div>
          <div style={{ marginTop: '5px', fontFamily: SORA, fontSize: '18px', fontWeight: 700, color: coverageTone }}>
            {coveragePercent}%
          </div>
        </div>
      </div>

      {project.nextStep && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', color: '#C8BFAE', fontSize: '12px', lineHeight: 1.45 }}>
          <ChevronRight style={{ width: '13px', height: '13px', color: '#827A6D', marginTop: '2px', flexShrink: 0 }} />
          <span>{project.nextStep}</span>
        </div>
      )}
    </button>
  );
}

export default function ProjectsPage() {
  const router = useRouter();
  const { fetchProjectsByWorkspace, updateProject, addBoard, createMilestone } = useProjectStore();
  const { createBoard } = useBoardStore();
  const { teams, fetchTeams } = useTeamStore();
  const { activeWorkspaceId } = useActiveWorkspaceStore();
  const { workspaces, fetchWorkspaces, currentProjectStandard, projectStandardHistory, fetchProjectStandard, fetchProjectStandardHistory } = useWorkspaceStore();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showOnlyNeedsFormalization, setShowOnlyNeedsFormalization] = useState(false);
  const [focusMode, setFocusMode] = useState<FocusMode>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('pipeline');
  const [showCreate, setShowCreate] = useState(false);
  const [busyActionByProject, setBusyActionByProject] = useState<Record<string, string | null>>({});
  const [teamPickerProjectId, setTeamPickerProjectId] = useState<string | null>(null);
  const [selectedTeamByProject, setSelectedTeamByProject] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!workspaces.length) fetchWorkspaces();
  }, [workspaces.length, fetchWorkspaces]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

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

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    return projects.filter((project) => {
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
  }, [projects, search, showOnlyNeedsFormalization, focusMode]);

  const pipeline = useMemo(() => {
    const grouped = new Map<ProjectMaturityStage, Project[]>();
    for (const stage of PIPELINE) grouped.set(stage.key, []);
    for (const project of filteredProjects) {
      const stage = project.maturityStage ?? 'IDEA';
      if (!grouped.has(stage)) grouped.set(stage, []);
      grouped.get(stage)!.push(project);
    }
    return PIPELINE.map((stage) => ({ ...stage, projects: grouped.get(stage.key) ?? [] }));
  }, [filteredProjects]);

  const intakeProjects = useMemo(
    () => filteredProjects
      .filter((project) => project.maturityStage === 'IDEA' || project.maturityStage === 'DRAFT')
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
        tone: '#DB8A66',
      },
      {
        key: 'team',
        label: 'Sin equipo base',
        count: projects.filter((project) => hasChecklistGap(project, 'team')).length,
        tone: '#C4A86E',
      },
      {
        key: 'board',
        label: 'Sin tablero',
        count: projects.filter((project) => hasChecklistGap(project, 'board')).length,
        tone: '#7B8FA8',
      },
      {
        key: 'milestone',
        label: 'Sin hito inicial',
        count: projects.filter((project) => hasChecklistGap(project, 'milestone')).length,
        tone: '#F4905A',
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
    const draft = intakeProjects.filter((project) => project.maturityStage === 'DRAFT').length;
    const idea = intakeProjects.filter((project) => project.maturityStage === 'IDEA').length;
    const ready = intakeProjects.filter((project) => project.formalization?.readyToFormalize).length;
    const missingProblem = intakeProjects.filter((project) => !project.problemStatement?.trim()).length;
    return { total: intakeProjects.length, draft, idea, ready, missingProblem };
  }, [intakeProjects]);

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
      const board = await createBoard(project.workspaceId, {
        name: `${project.name} Board`,
        description: project.problemStatement?.trim() || project.description?.trim() || 'Execution board',
      });
      await addBoard(project.id, board.id);
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
        color: project.color ?? '#F2571E',
      });
      if (!project.nextStep?.trim()) {
        await updateProject(project.id, { nextStep: 'Validar y completar el primer hito del proyecto' });
      }
    });
  }

  async function handleAssignBaseTeam(project: Project) {
    const teamId = selectedTeamByProject[project.id];
    if (!teamId) return;

    await runProjectAction(project.id, 'team', async () => {
      await apiService.post(`/api/projects/${project.id}/teams`, { teamId }, true);
      setTeamPickerProjectId(null);
    });
  }

  return (
    <div style={{ minHeight: '100%', background: C.bg, fontFamily: MANROPE }}>
      <div style={{ maxWidth: '1360px', margin: '0 auto', padding: '28px clamp(18px,3vw,36px) 48px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '18px', flexWrap: 'wrap', marginBottom: '22px' }}>
          <div>
            <h1 style={{ margin: 0, fontFamily: SORA, fontSize: '26px', fontWeight: 700, color: '#E8E1D2' }}>
              {viewMode === 'pipeline' ? 'Pipeline de proyectos' : 'Bandeja de intake'}
            </h1>
            <p style={{ margin: '7px 0 0', fontSize: '13px', color: '#827A6D', maxWidth: '760px', lineHeight: 1.55 }}>
              {viewMode === 'pipeline'
                ? (workspace?.name ? `${workspace.name} puede usar este espacio para ver cómo cada iniciativa pasa de idea a operación.` : 'Sigue la madurez de cada iniciativa desde la idea hasta la ejecución.')
                : 'Separa las iniciativas que todavía están entrando para formalizarlas antes de empujarlas a planificación.'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'inline-flex', padding: '4px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {([
                { key: 'pipeline', label: 'Pipeline' },
                { key: 'intake', label: 'Intake' },
              ] as const).map((option) => {
                const active = viewMode === option.key;
                return (
                  <button
                    key={option.key}
                    onClick={() => setViewMode(option.key)}
                    style={{
                      height: '32px', padding: '0 12px', borderRadius: '8px', border: 'none',
                      background: active ? 'rgba(242,87,30,0.14)' : 'transparent',
                      color: active ? '#F4905A' : '#C8BFAE', cursor: 'pointer',
                      fontSize: '12px', fontWeight: 700, fontFamily: SORA,
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setShowCreate(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '10px 16px', borderRadius: '8px', border: 'none',
                background: '#F2571E', color: '#24180A', cursor: 'pointer',
                fontFamily: SORA, fontSize: '13px', fontWeight: 700,
              }}
            >
              <CircleDashed style={{ width: '14px', height: '14px' }} />
              Nuevo proyecto
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px', marginBottom: '18px' }}>
          {(viewMode === 'pipeline'
            ? [
                { label: 'Proyectos', value: metrics.total, tone: '#E8E1D2', icon: ClipboardList },
                { label: 'Listos para formalizar', value: metrics.ready, tone: '#76A878', icon: CheckCircle2 },
                { label: 'Cobertura media', value: `${metrics.averageCoverage}%`, tone: '#C4A86E', icon: Target },
                { label: 'Baja cobertura', value: metrics.blocked, tone: '#DB8A66', icon: AlertCircle },
              ]
            : [
                { label: 'En intake', value: intakeMetrics.total, tone: '#E8E1D2', icon: ClipboardList },
                { label: 'Ideas iniciales', value: intakeMetrics.idea, tone: '#7B8FA8', icon: CircleDashed },
                { label: 'Borradores', value: intakeMetrics.draft, tone: '#C4A86E', icon: Target },
                { label: 'Sin problema claro', value: intakeMetrics.missingProblem, tone: '#DB8A66', icon: AlertCircle },
              ]).map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} style={{ borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.08em', color: '#615846', textTransform: 'uppercase' }}>{item.label}</div>
                    <div style={{ marginTop: '8px', fontFamily: SORA, fontSize: '24px', fontWeight: 700, color: item.tone }}>{item.value}</div>
                  </div>
                  <Icon style={{ width: '17px', height: '17px', color: item.tone }} />
                </div>
              </div>
            );
          })}
        </div>

        {viewMode === 'pipeline' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(320px, 0.8fr)', gap: '16px', marginBottom: '18px', alignItems: 'start' }}>
            <div style={{ borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontFamily: SORA, fontSize: '14px', fontWeight: 700, color: '#E8E1D2' }}>
                    {currentProjectStandard ? `Marco operativo: ${currentProjectStandard.name}` : 'Marco operativo del workspace'}
                  </div>
                  <div style={{ marginTop: '5px', fontSize: '12.5px', color: '#827A6D', lineHeight: 1.5, maxWidth: '780px' }}>
                    {currentProjectStandard
                      ? `La cartera hoy corre con v${currentProjectStandard.version}. Este estándar define desde qué madurez se planifica, qué campos deben existir y qué checks vuelven formalizable a un proyecto.`
                      : 'Todavía no hay un estándar cargado para este workspace.'}
                  </div>
                </div>

                {currentProjectStandard && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#C7D7EC', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '999px', padding: '5px 9px' }}>
                      v{currentProjectStandard.version}
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#C4A86E', background: 'rgba(196,168,110,0.12)', border: '1px solid rgba(196,168,110,0.22)', borderRadius: '999px', padding: '5px 9px' }}>
                      Intake: {currentProjectStandard.definition.intakeStages.join(' / ')}
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#76A878', background: 'rgba(118,168,120,0.12)', border: '1px solid rgba(118,168,120,0.22)', borderRadius: '999px', padding: '5px 9px' }}>
                      {currentProjectStandard.definition.requiredChecklist.length} checks
                    </span>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px', marginTop: '16px' }}>
                {[
                  { label: 'Cohorte activa', value: `v${currentProjectStandard?.version ?? 1}`, hint: `${projects.filter((project) => (project.appliedStandardVersion ?? 1) === (currentProjectStandard?.version ?? 1)).length} proyecto(s)`, tone: '#C7D7EC' },
                  { label: 'Cohorte previa', value: standardTransition?.previous ? `v${standardTransition.previous.version}` : 'Sin previa', hint: `${standardTransition?.legacyProjects ?? 0} proyecto(s) heredados`, tone: '#C4A86E' },
                  { label: 'Mínimo para planificar', value: currentProjectStandard ? getMaturityMeta(currentProjectStandard.definition.minimumMaturityForPlanning).label : 'Base', hint: 'Punto de corte institucional', tone: '#76A878' },
                ].map((item) => (
                  <div key={item.label} style={{ borderRadius: '9px', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.025)', padding: '12px 12px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', color: '#615846', textTransform: 'uppercase' }}>{item.label}</div>
                    <div style={{ marginTop: '7px', fontFamily: SORA, fontSize: '20px', fontWeight: 700, color: item.tone }}>{item.value}</div>
                    <div style={{ marginTop: '5px', fontSize: '11px', color: '#827A6D' }}>{item.hint}</div>
                  </div>
                ))}
              </div>

              {currentProjectStandard && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '16px' }}>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', color: '#615846', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Campos requeridos
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {currentProjectStandard.definition.requiredProjectFields.map((field) => (
                        <span key={field} style={{ fontSize: '11px', color: '#C8BFAE', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '999px', padding: '5px 8px' }}>
                          {field}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', color: '#615846', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Estructura obligatoria
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {currentProjectStandard.definition.requiredChecklist.map((item) => (
                        <span key={item} style={{ fontSize: '11px', color: '#C8BFAE', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '999px', padding: '5px 8px' }}>
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', padding: '16px' }}>
                <div style={{ fontFamily: SORA, fontSize: '13px', fontWeight: 700, color: '#E8E1D2' }}>Decisiones de hoy</div>
                <div style={{ marginTop: '4px', fontSize: '12px', color: '#827A6D', lineHeight: 1.45 }}>
                  Tres colas cortas para acompañamiento, empuje y revisión de coherencia.
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                  {[
                    { title: 'Listos para formalizar', tone: '#76A878', items: portfolioQueues.readyToday },
                    { title: 'Trabados por equipo', tone: '#C4A86E', items: portfolioQueues.blockedByTeam },
                    { title: 'Cobertura engañosa', tone: '#7B8FA8', items: portfolioQueues.misleadingCoverage },
                  ].map((section) => (
                    <div key={section.title} style={{ borderRadius: '9px', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: section.tone, fontFamily: SORA }}>{section.title}</span>
                        <span style={{ fontSize: '11px', color: '#827A6D' }}>{section.items.length}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginTop: '9px' }}>
                        {section.items.length === 0 ? (
                          <div style={{ fontSize: '11.5px', color: '#615846' }}>Sin proyectos visibles.</div>
                        ) : section.items.slice(0, 3).map((project) => (
                          <button
                            key={project.id}
                            onClick={() => router.push(`/dashboard/projects/${project.id}`)}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', border: 'none', background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer' }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '12px', fontWeight: 600, color: '#E8E1D2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</div>
                              <div style={{ marginTop: '3px', fontSize: '11px', color: '#827A6D' }}>{getProjectPortfolioReason(project)}</div>
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

              <div style={{ borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', padding: '16px' }}>
                <div style={{ fontFamily: SORA, fontSize: '13px', fontWeight: 700, color: '#E8E1D2' }}>Foco operativo</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                  {[
                    { key: 'all', label: 'Todos', count: metrics.total },
                    { key: 'mentor-needed', label: 'Necesitan mentor', count: metrics.mentorNeeded },
                    { key: 'ready', label: 'Listos', count: metrics.ready },
                    { key: 'no-team', label: 'Sin equipo', count: metrics.withoutTeam },
                    { key: 'no-board', label: 'Sin tablero', count: metrics.withoutBoard },
                    { key: 'no-milestone', label: 'Sin hito', count: metrics.withoutMilestone },
                    { key: 'low-coverage', label: 'Baja cobertura', count: metrics.blocked },
                  ].map((option) => {
                    const active = focusMode === option.key;
                    return (
                      <button
                        key={option.key}
                        onClick={() => setFocusMode(option.key as FocusMode)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '7px',
                          height: '32px', padding: '0 12px', borderRadius: '999px',
                          border: `1px solid ${active ? 'rgba(242,87,30,0.32)' : 'rgba(255,255,255,0.08)'}`,
                          background: active ? 'rgba(242,87,30,0.12)' : 'rgba(255,255,255,0.03)',
                          color: active ? '#F4905A' : '#C8BFAE', cursor: 'pointer',
                          fontSize: '12px', fontWeight: 600,
                        }}
                      >
                        <span>{option.label}</span>
                        <span style={{ minWidth: '18px', height: '18px', borderRadius: '999px', background: active ? 'rgba(242,87,30,0.22)' : 'rgba(255,255,255,0.07)', color: active ? '#F4905A' : '#827A6D', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, padding: '0 5px' }}>
                          {option.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', marginTop: '14px' }}>
                  {[
                    { label: 'Proyectos que aún no tienen equipo base', value: metrics.withoutTeam, tone: '#DB8A66' },
                    { label: 'Proyectos sin tablero de ejecución', value: metrics.withoutBoard, tone: '#C4A86E' },
                    { label: 'Proyectos sin próximo hito declarado', value: metrics.withoutMilestone, tone: '#7B8FA8' },
                  ].map((item) => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                      <span style={{ fontSize: '12px', color: '#C8BFAE', lineHeight: 1.45 }}>{item.label}</span>
                      <span style={{ fontFamily: SORA, fontSize: '16px', fontWeight: 700, color: item.tone, flexShrink: 0 }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'pipeline' && (
          <div style={{ display: 'grid', gridTemplateColumns: '0.95fr 1.05fr', gap: '16px', marginBottom: '18px' }}>
            <div style={{ borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontFamily: SORA, fontSize: '13px', fontWeight: 700, color: '#E8E1D2' }}>Cohortes por versión</div>
                  <div style={{ marginTop: '4px', fontSize: '12px', color: '#827A6D', lineHeight: 1.45 }}>
                    Cómo se comporta cada cohorte real según el estándar aplicado.
                  </div>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#C8BFAE' }}>{versionReporting.length} cohortes</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {versionReporting.map((row) => {
                  const isCurrent = currentProjectStandard?.version === row.version;
                  return (
                    <div key={row.version} style={{ borderRadius: '9px', border: `1px solid ${isCurrent ? 'rgba(118,168,120,0.22)' : 'rgba(255,255,255,0.06)'}`, background: isCurrent ? 'rgba(118,168,120,0.06)' : 'rgba(255,255,255,0.02)', padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: isCurrent ? '#76A878' : '#E8E1D2', fontFamily: SORA }}>v{row.version}</div>
                          <div style={{ marginTop: '3px', fontSize: '11px', color: '#827A6D' }}>{row.count} proyecto(s)</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontFamily: SORA, fontSize: '18px', fontWeight: 700, color: getCoverageTone(row.avgCoverage) }}>{row.avgCoverage}%</div>
                          <div style={{ marginTop: '3px', fontSize: '11px', color: '#C8BFAE' }}>{row.readyCount} listos</div>
                        </div>
                      </div>
                      <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ fontSize: '11px', color: row.mentorNeededCount > 0 ? '#DB8A66' : '#615846' }}>
                          {row.mentorNeededCount} requieren acompañamiento
                        </div>
                        <div style={{ fontSize: '11px', color: row.teamGapCount > 0 ? '#C4A86E' : '#615846' }}>
                          {row.teamGapCount} sin equipo base
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontFamily: SORA, fontSize: '13px', fontWeight: 700, color: '#E8E1D2' }}>Embudo del workspace</div>
                    <div style={{ marginTop: '4px', fontSize: '12px', color: '#827A6D' }}>Distribución actual entre intake, formalización y operación.</div>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#C8BFAE' }}>{metrics.total} total</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {reporting.stageRows.map((row) => {
                    const width = metrics.total > 0 ? Math.max((row.count / metrics.total) * 100, row.count > 0 ? 12 : 0) : 0;
                    return (
                      <div key={row.key} style={{ display: 'grid', gridTemplateColumns: '110px minmax(0, 1fr) 72px', gap: '10px', alignItems: 'center' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '11.5px', fontWeight: 700, color: row.tone, fontFamily: SORA }}>{row.label}</div>
                          <div style={{ marginTop: '2px', fontSize: '10.5px', color: '#615846' }}>{row.count}</div>
                        </div>
                        <div style={{ height: '10px', borderRadius: '999px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                          <div style={{ width: `${width}%`, height: '100%', borderRadius: '999px', background: row.tone, transition: 'width 0.25s ease' }} />
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '10.5px', color: '#C8BFAE' }}>
                          {metrics.total > 0 ? `${Math.round((row.count / metrics.total) * 100)}%` : '0%'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', padding: '14px 16px' }}>
                <div>
                  <div style={{ fontFamily: SORA, fontSize: '13px', fontWeight: 700, color: '#E8E1D2' }}>Brechas estructurales</div>
                  <div style={{ marginTop: '4px', fontSize: '12px', color: '#827A6D' }}>Fallas recurrentes que degradan la formalización del portfolio.</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', marginTop: '12px' }}>
                  {reporting.alerts.map((alert) => (
                    <div key={alert.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ fontSize: '12.5px', color: '#C8BFAE' }}>{alert.label}</span>
                      <span style={{ fontFamily: SORA, fontSize: '18px', fontWeight: 700, color: alert.tone }}>{alert.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'intake' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '16px', marginBottom: '18px' }}>
            <div style={{ borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', padding: '14px 16px' }}>
              <div style={{ fontFamily: SORA, fontSize: '13px', fontWeight: 700, color: '#E8E1D2' }}>Criterio de admisión</div>
              <p style={{ margin: '6px 0 12px', fontSize: '12px', color: '#827A6D', lineHeight: 1.55 }}>
                Esta bandeja deja ver qué iniciativas todavía están en intención, cuáles ya son un borrador útil y cuáles están listas para empujarse a formalización.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
                {[
                  { label: 'Problema claro', value: intakeMetrics.total - intakeMetrics.missingProblem, tone: '#76A878' },
                  { label: 'Listos para formalizar', value: intakeMetrics.ready, tone: '#C4A86E' },
                  { label: 'Aún verdes', value: Math.max(intakeMetrics.total - intakeMetrics.ready, 0), tone: '#DB8A66' },
                ].map((item) => (
                  <div key={item.label} style={{ borderRadius: '8px', background: 'rgba(255,255,255,0.03)', padding: '10px 12px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', color: '#615846', textTransform: 'uppercase' }}>{item.label}</div>
                    <div style={{ marginTop: '7px', fontFamily: SORA, fontSize: '22px', fontWeight: 700, color: item.tone }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', padding: '14px 16px' }}>
              <div style={{ fontFamily: SORA, fontSize: '13px', fontWeight: 700, color: '#E8E1D2' }}>Siguiente movimiento</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <span style={{ fontSize: '12.5px', color: '#C8BFAE' }}>Ideas que requieren clarificar problema</span>
                  <span style={{ fontFamily: SORA, fontSize: '18px', fontWeight: 700, color: '#DB8A66' }}>{intakeMetrics.missingProblem}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <span style={{ fontSize: '12.5px', color: '#C8BFAE' }}>Borradores que ya ameritan revisión</span>
                  <span style={{ fontFamily: SORA, fontSize: '18px', fontWeight: 700, color: '#C4A86E' }}>{intakeMetrics.draft}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <span style={{ fontSize: '12.5px', color: '#C8BFAE' }}>Proyectos listos para pasar de intake</span>
                  <span style={{ fontFamily: SORA, fontSize: '18px', fontWeight: 700, color: '#76A878' }}>{intakeMetrics.ready}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
          <label style={{ position: 'relative', minWidth: '260px', flex: '1 1 280px' }}>
            <Search style={{ width: '14px', height: '14px', color: '#615846', position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, problema o siguiente paso"
              style={{
                width: '100%', height: '38px', padding: '0 12px 0 35px',
                borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.03)', color: '#E8E1D2', outline: 'none',
              }}
            />
          </label>

          {viewMode === 'pipeline' && (
            <button
              onClick={() => setShowOnlyNeedsFormalization((prev) => !prev)}
              style={{
                height: '38px', padding: '0 14px', borderRadius: '8px',
                border: `1px solid ${showOnlyNeedsFormalization ? 'rgba(219,138,102,0.35)' : 'rgba(255,255,255,0.08)'}`,
                background: showOnlyNeedsFormalization ? 'rgba(219,138,102,0.1)' : 'rgba(255,255,255,0.03)',
                color: showOnlyNeedsFormalization ? '#DB8A66' : '#C8BFAE', cursor: 'pointer',
                fontSize: '12.5px', fontWeight: 600,
              }}
            >
              Solo con brechas de formalización
            </button>
          )}
        </div>


        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#F2571E', animation: 'spin 0.7s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : viewMode === 'pipeline' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '14px', alignItems: 'start' }}>
            {pipeline.map((stage) => (
              <section key={stage.key} style={{ minWidth: 0 }}>
                <div style={{ marginBottom: '10px', padding: '12px 12px 10px', borderRadius: '10px', border: `1px solid ${stage.border}`, background: stage.soft }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <div style={{ fontFamily: SORA, fontSize: '13px', fontWeight: 700, color: stage.tone }}>{stage.label}</div>
                    <div style={{ minWidth: '24px', height: '24px', borderRadius: '999px', background: 'rgba(0,0,0,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#E8E1D2' }}>
                      {stage.projects.length}
                    </div>
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: '11.5px', lineHeight: 1.45, color: '#C8BFAE' }}>{stage.hint}</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {stage.projects.length === 0 ? (
                    <div style={{ borderRadius: '10px', border: '1px dashed rgba(255,255,255,0.12)', padding: '18px 14px', color: '#615846', fontSize: '12px', textAlign: 'center', background: 'rgba(255,255,255,0.015)' }}>
                      Sin proyectos en esta etapa
                    </div>
                  ) : (
                    stage.projects.map((project) => (
                      <ProjectCard key={project.id} project={project} onClick={() => router.push(`/dashboard/projects/${project.id}`)} />
                    ))
                  )}
                </div>
              </section>
            ))}
          </div>
        ) : intakeProjects.length === 0 ? (
          <div style={{ borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.12)', padding: '40px 24px', textAlign: 'center', color: '#615846', background: 'rgba(255,255,255,0.015)' }}>
            No hay proyectos en intake con el filtro actual.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(320px, 0.75fr)', gap: '16px', alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {intakeProjects.map((project) => (
                <div key={project.id} style={{ borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <button onClick={() => router.push(`/dashboard/projects/${project.id}`)} style={{ padding: 0, border: 'none', background: 'transparent', color: '#E8E1D2', cursor: 'pointer', fontFamily: SORA, fontSize: '14px', fontWeight: 700 }}>
                          {project.name}
                        </button>
                        <span style={{ fontSize: '10.5px', fontWeight: 700, color: getMaturityMeta(project.maturityStage ?? 'IDEA').tone, background: getMaturityMeta(project.maturityStage ?? 'IDEA').soft, border: `1px solid ${getMaturityMeta(project.maturityStage ?? 'IDEA').border}`, borderRadius: '999px', padding: '4px 8px' }}>
                          {getMaturityMeta(project.maturityStage ?? 'IDEA').label}
                        </span>
                      </div>
                      <p style={{ margin: '8px 0 0', fontSize: '12.5px', color: '#C8BFAE', lineHeight: 1.55 }}>
                        {project.problemStatement?.trim() || project.description?.trim() || 'Todavía no declara bien el problema u oportunidad.'}
                      </p>
                    </div>
                    <span style={{ fontFamily: SORA, fontSize: '18px', fontWeight: 700, color: getCoverageTone(project.coverage?.coveragePercent ?? 0), flexShrink: 0 }}>
                      {project.coverage?.coveragePercent ?? 0}%
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px', marginTop: '12px' }}>
                    {(project.formalization?.checklist ?? []).map((item) => (
                      <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '7px', borderRadius: '8px', padding: '8px 9px', background: item.done ? 'rgba(118,168,120,0.08)' : 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: item.done ? 'rgba(118,168,120,0.18)' : 'rgba(219,138,102,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {item.done ? <CheckCircle2 style={{ width: '10px', height: '10px', color: '#76A878' }} /> : <AlertCircle style={{ width: '10px', height: '10px', color: '#DB8A66' }} />}
                        </span>
                        <span style={{ fontSize: '11px', color: item.done ? '#C8BFAE' : '#827A6D' }}>{item.label}</span>
                      </div>
                    )).slice(0, 6)}
                  </div>

                  {project.nextStep && (
                    <div style={{ marginTop: '12px', display: 'flex', alignItems: 'flex-start', gap: '7px', color: '#C8BFAE', fontSize: '12px', lineHeight: 1.45 }}>
                      <ChevronRight style={{ width: '13px', height: '13px', color: '#827A6D', marginTop: '2px', flexShrink: 0 }} />
                      <span>{project.nextStep}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '14px' }}>
                    <button
                      onClick={() => handleFormalize(project)}
                      disabled={busyActionByProject[project.id] !== null || !project.formalization?.readyToFormalize}
                      style={{
                        height: '31px', padding: '0 12px', borderRadius: '8px', border: 'none',
                        background: project.formalization?.readyToFormalize && busyActionByProject[project.id] === null ? 'rgba(118,168,120,0.16)' : 'rgba(255,255,255,0.05)',
                        color: project.formalization?.readyToFormalize && busyActionByProject[project.id] === null ? '#76A878' : '#615846',
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
                        background: project.formalization?.readyToFormalize && busyActionByProject[project.id] === null ? 'rgba(75,96,127,0.18)' : 'rgba(255,255,255,0.05)',
                        color: project.formalization?.readyToFormalize && busyActionByProject[project.id] === null ? '#7B8FA8' : '#615846',
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
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: busyActionByProject[project.id] === null && hasChecklistGap(project, 'board') ? 'rgba(242,87,30,0.1)' : 'rgba(255,255,255,0.03)',
                        color: busyActionByProject[project.id] === null && hasChecklistGap(project, 'board') ? '#F4905A' : '#615846',
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
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: busyActionByProject[project.id] === null && hasChecklistGap(project, 'milestone') ? 'rgba(123,143,168,0.12)' : 'rgba(255,255,255,0.03)',
                        color: busyActionByProject[project.id] === null && hasChecklistGap(project, 'milestone') ? '#7B8FA8' : '#615846',
                        cursor: busyActionByProject[project.id] === null && hasChecklistGap(project, 'milestone') ? 'pointer' : 'not-allowed',
                        fontSize: '12px', fontWeight: 700,
                      }}
                    >
                      {busyActionByProject[project.id] === 'milestone' ? 'Creando hito…' : 'Crear hito inicial'}
                    </button>

                    <button
                      onClick={() => {
                        setTeamPickerProjectId((current) => current === project.id ? null : project.id);
                        if (!selectedTeamByProject[project.id] && teams[0]?.id) {
                          setSelectedTeamByProject((prev) => ({ ...prev, [project.id]: teams[0].id }));
                        }
                      }}
                      disabled={busyActionByProject[project.id] !== null || !hasChecklistGap(project, 'team') || teams.length === 0}
                      style={{
                        height: '31px', padding: '0 12px', borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: busyActionByProject[project.id] === null && hasChecklistGap(project, 'team') && teams.length > 0 ? 'rgba(196,168,110,0.12)' : 'rgba(255,255,255,0.03)',
                        color: busyActionByProject[project.id] === null && hasChecklistGap(project, 'team') && teams.length > 0 ? '#C4A86E' : '#615846',
                        cursor: busyActionByProject[project.id] === null && hasChecklistGap(project, 'team') && teams.length > 0 ? 'pointer' : 'not-allowed',
                        fontSize: '12px', fontWeight: 700,
                      }}
                    >
                      {busyActionByProject[project.id] === 'team' ? 'Asignando…' : teams.length === 0 ? 'Sin equipos disponibles' : 'Asignar equipo base'}
                    </button>
                  </div>

                  {teamPickerProjectId === project.id && teams.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '10px', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }}>
                      <select
                        value={selectedTeamByProject[project.id] ?? ''}
                        onChange={(e) => setSelectedTeamByProject((prev) => ({ ...prev, [project.id]: e.target.value }))}
                        style={{
                          minWidth: '180px', height: '32px', padding: '0 10px', borderRadius: '7px',
                          border: '1px solid rgba(255,255,255,0.08)', background: '#1B2237', color: '#E8E1D2',
                          outline: 'none', fontSize: '12px',
                        }}
                      >
                        {teams.map((team) => (
                          <option key={team.id} value={team.id}>{team.name}</option>
                        ))}
                      </select>

                      <button
                        onClick={() => handleAssignBaseTeam(project)}
                        disabled={!selectedTeamByProject[project.id] || busyActionByProject[project.id] !== null}
                        style={{
                          height: '32px', padding: '0 12px', borderRadius: '7px', border: 'none',
                          background: selectedTeamByProject[project.id] && busyActionByProject[project.id] === null ? '#C4A86E' : 'rgba(255,255,255,0.05)',
                          color: selectedTeamByProject[project.id] && busyActionByProject[project.id] === null ? '#24180A' : '#615846',
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

            <div style={{ borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', padding: '14px 16px' }}>
              <div style={{ fontFamily: SORA, fontSize: '13px', fontWeight: 700, color: '#E8E1D2' }}>Qué mirar primero</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                {[
                  '¿El problema está descrito con suficiente claridad para que otro lo entienda?',
                  '¿Ya existe responsable, equipo base o al menos siguiente paso verificable?',
                  '¿Tiene un tablero y un hito que permitan pasar de conversación a coordinación?',
                  'Si ya cumple el mínimo, conviene moverlo a formalizado o planificado.',
                ].map((text) => (
                  <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: '#C8BFAE', fontSize: '12.5px', lineHeight: 1.55 }}>
                    <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', color: '#827A6D', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', flexShrink: 0 }}>•</span>
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </div>
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
