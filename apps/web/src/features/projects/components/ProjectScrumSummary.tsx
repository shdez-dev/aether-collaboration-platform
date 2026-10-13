'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Flag,
  LoaderCircle,
  Pencil,
  Save,
  Target,
  UsersRound,
  X,
} from 'lucide-react';
import type { Project, ProjectMilestone, ProjectStats } from '@/stores/projectStore';
import { useProjectStore } from '@/stores/projectStore';
import { apiService } from '@/services/apiService';
import type { ProjectSprint } from '@/components/ProjectSprintPlanner';
import styles from './ProjectScrumSummary.module.css';

const dateAtNoon = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00`);
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short' }).format(dateAtNoon(value));

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function getSprintTiming(sprint: ProjectSprint) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = dateAtNoon(sprint.endDate);
  end.setHours(0, 0, 0, 0);
  const remaining = Math.ceil((end.getTime() - today.getTime()) / 86_400_000);

  if (remaining < 0) return `Terminó hace ${Math.abs(remaining)} ${Math.abs(remaining) === 1 ? 'día' : 'días'}`;
  if (remaining === 0) return 'Termina hoy';
  return `Quedan ${remaining} ${remaining === 1 ? 'día' : 'días'}`;
}

function Avatar({ name }: { name: string }) {
  return <span className={styles.avatar} aria-hidden="true">{initials(name)}</span>;
}

export function ProjectScrumSummary({
  project,
  stats,
  canEdit,
  onOpenBacklog,
  onOpenMembers,
  onOpenSchedule,
}: {
  project: Project;
  stats: ProjectStats | null;
  canEdit: boolean;
  onOpenBacklog: () => void;
  onOpenMembers: () => void;
  onOpenSchedule: () => void;
}) {
  const updateProject = useProjectStore((state) => state.updateProject);
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [sprints, setSprints] = useState<ProjectSprint[]>([]);
  const [sprintsLoading, setSprintsLoading] = useState(true);
  const [sprintsError, setSprintsError] = useState('');
  const [sprintRefresh, setSprintRefresh] = useState(0);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState(project.productGoal ?? '');
  const [savingGoal, setSavingGoal] = useState(false);
  const [goalError, setGoalError] = useState('');

  useEffect(() => {
    setGoalDraft(project.productGoal ?? '');
  }, [project.id, project.productGoal]);

  useEffect(() => {
    let mounted = true;
    setSprintsLoading(true);
    setSprintsError('');
    apiService
      .get<{ sprints: ProjectSprint[] }>(`/api/projects/${project.id}/sprints`, true)
      .then((response) => {
        if (!mounted) return;
        if (!response.success || !response.data) {
          setSprintsError(response.error?.message || 'No se pudieron cargar los sprints.');
          return;
        }
        setSprints(response.data.sprints ?? []);
      })
      .catch(() => {
        if (mounted) setSprintsError('No se pudieron cargar los sprints.');
      })
      .finally(() => {
        if (mounted) setSprintsLoading(false);
      });

    return () => { mounted = false; };
  }, [project.id, sprintRefresh]);

  const focusSprint = useMemo(() => {
    const active = sprints.find((sprint) => sprint.status === 'ACTIVE');
    if (active) return active;
    return sprints
      .filter((sprint) => sprint.status === 'PLANNED')
      .sort((a, b) => dateAtNoon(a.startDate).getTime() - dateAtNoon(b.startDate).getTime())[0] ?? null;
  }, [sprints]);

  const completedCards = stats?.completedCards ?? project.stats?.completedCards ?? 0;
  const totalCards = stats?.totalCards ?? project.stats?.totalCards ?? 0;
  const projectProgress = Math.min(100, Math.max(0, Math.round(
    stats?.progressPercent ?? project.stats?.progressPercent ?? project.progressPercent ?? 0,
  )));
  const sprintCards = focusSprint?.cards ?? [];
  const sprintCompleted = sprintCards.filter((card) => card.completed).length;
  const sprintProgress = sprintCards.length ? Math.round((sprintCompleted / sprintCards.length) * 100) : 0;
  const sprintIsActive = focusSprint?.status === 'ACTIVE';

  const assignments = project.methodologyAssignments ?? [];
  const productOwner = assignments.find((person) => person.role === 'PRODUCT_OWNER');
  const scrumMaster = assignments.find((person) => person.role === 'SCRUM_MASTER');
  const developers = assignments.filter((person) => person.role === 'DEVELOPER');
  const milestone = useMemo(() => {
    const pending = (project.milestones ?? []).filter((item) => item.status === 'PENDING');
    return pending.sort((a, b) => dateAtNoon(a.date).getTime() - dateAtNoon(b.date).getTime())[0] ?? null;
  }, [project.milestones]);

  async function saveGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingGoal) return;
    setSavingGoal(true);
    setGoalError('');
    try {
      await updateProject(project.id, { productGoal: goalDraft.trim() || null });
      setEditingGoal(false);
    } catch (error) {
      setGoalError(error instanceof Error ? error.message : 'No se pudo guardar el objetivo.');
    } finally {
      setSavingGoal(false);
    }
  }

  return (
    <section className={styles.root} aria-label="Resumen Scrum del proyecto">
      <div className={styles.intro}>
        <div>
          <h2>Resumen Scrum</h2>
          <p>Objetivo, sprint y equipo en un mismo lugar.</p>
        </div>
        <span className={styles.methodTag}><span /> Scrum</span>
      </div>

      <section className={styles.goalPanel} aria-labelledby="product-goal-title">
        <div className={styles.goalMain}>
          <div className={styles.sectionTitle}>
            <span className={styles.goalIcon}><Target size={17} strokeWidth={1.8} /></span>
            <h3 id="product-goal-title">Objetivo del producto</h3>
          </div>

          {editingGoal ? (
            <form className={styles.goalForm} onSubmit={saveGoal}>
              <label className={styles.srOnly} htmlFor="project-product-goal">Objetivo del producto</label>
              <textarea
                id="project-product-goal"
                autoFocus
                maxLength={8000}
                value={goalDraft}
                onChange={(event) => setGoalDraft(event.target.value)}
                placeholder="Describe el cambio que el producto busca lograr."
                rows={3}
                disabled={savingGoal}
              />
              {goalError && <p className={styles.errorText} role="alert">{goalError}</p>}
              <div className={styles.goalFormFooter}>
                <span>{goalDraft.length.toLocaleString('es-CL')} caracteres</span>
                <div>
                  <button type="button" className={styles.quietButton} onClick={() => { setEditingGoal(false); setGoalDraft(project.productGoal ?? ''); setGoalError(''); }} disabled={savingGoal}>
                    <X size={14} /> Cancelar
                  </button>
                  <button type="submit" className={styles.primaryButton} disabled={savingGoal}>
                    {savingGoal ? <LoaderCircle className={styles.spin} size={14} /> : <Save size={14} />}
                    {savingGoal ? 'Guardando' : 'Guardar objetivo'}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <>
              <p className={project.productGoal?.trim() ? styles.goalText : styles.goalEmpty}>
                {project.productGoal?.trim() || 'Define el cambio que este proyecto quiere lograr para sus usuarios.'}
              </p>
              <div className={styles.goalActions}>
                {canEdit && (
                  <button type="button" className={styles.quietButton} onClick={() => { setGoalDraft(project.productGoal ?? ''); setEditingGoal(true); }}>
                    <Pencil size={14} /> {project.productGoal?.trim() ? 'Editar objetivo' : 'Definir objetivo'}
                  </button>
                )}
                <button type="button" className={styles.textButton} onClick={onOpenBacklog}>
                  Ir al backlog <ArrowRight size={14} />
                </button>
              </div>
            </>
          )}
        </div>

        <div className={styles.projectProgress}>
          <div className={styles.progressHeading}>
            <div>
              <span>Avance del proyecto</span>
              <strong>{projectProgress}%</strong>
            </div>
            <span className={styles.progressIcon}><CheckCircle2 size={17} /></span>
          </div>
          <div className={styles.progressTrack} role="progressbar" aria-label="Avance del proyecto" aria-valuemin={0} aria-valuemax={100} aria-valuenow={projectProgress}>
            <motion.span
              className={styles.progressFill}
              initial={false}
              animate={{ width: `${projectProgress}%` }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <p>{completedCards} de {totalCards} {totalCards === 1 ? 'tarea completada' : 'tareas completadas'}</p>
        </div>
      </section>

      <div className={styles.mainGrid}>
        <section className={styles.sprintPanel} aria-labelledby="sprint-panel-title">
          <header className={styles.panelHeader}>
            <div className={styles.panelHeading}>
              <span className={`${styles.statusDot} ${sprintIsActive ? styles.activeDot : ''}`} />
              <h3 id="sprint-panel-title">{sprintIsActive ? 'Sprint en curso' : 'Siguiente sprint'}</h3>
            </div>
            {!sprintsLoading && focusSprint && (
              <span className={`${styles.sprintStatus} ${sprintIsActive ? styles.sprintStatusActive : ''}`}>
                {sprintIsActive ? 'En curso' : 'Planificado'}
              </span>
            )}
          </header>

          {sprintsLoading ? (
            <div className={styles.sprintSkeleton} aria-label="Cargando sprint">
              <span /><span /><span />
            </div>
          ) : sprintsError ? (
            <div className={styles.emptySprint}>
              <p>{sprintsError}</p>
              <button type="button" className={styles.textButton} onClick={() => { setSprintsLoading(true); setSprintsError(''); setSprintRefresh((value) => value + 1); }}>
                Reintentar <ArrowRight size={14} />
              </button>
            </div>
          ) : focusSprint ? (
            <>
              <div className={styles.sprintSummary}>
                <div>
                  <h4>{focusSprint.name}</h4>
                  <p className={styles.sprintDates}><CalendarDays size={14} /> {dateLabel(focusSprint.startDate)} – {dateLabel(focusSprint.endDate)}</p>
                </div>
                <span className={styles.sprintTiming}><Clock3 size={13} /> {sprintIsActive ? getSprintTiming(focusSprint) : 'Próximo en planificación'}</span>
              </div>

              <div className={styles.sprintGoal}>
                <span className={styles.goalRail} />
                <div>
                  <span className={styles.sprintGoalLabel}><Flag size={13} /> Objetivo del sprint</span>
                  <p>{focusSprint.goal?.trim() || 'Este sprint todavía no tiene un objetivo definido.'}</p>
                </div>
              </div>

              <div className={styles.sprintProgressBlock}>
                <div className={styles.sprintProgressLabel}>
                  <span>{sprintCompleted} de {sprintCards.length} cards completadas</span>
                  <strong>{sprintProgress}%</strong>
                </div>
                <div className={styles.sprintTrack} role="progressbar" aria-label="Avance del sprint" aria-valuemin={0} aria-valuemax={100} aria-valuenow={sprintProgress}>
                  <motion.span
                    className={styles.sprintFill}
                    initial={false}
                    animate={{ width: `${sprintProgress}%` }}
                    transition={{ duration: prefersReducedMotion ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              </div>

              <button type="button" className={styles.sprintLink} onClick={onOpenBacklog}>
                Ver planificación <ArrowRight size={15} />
              </button>
            </>
          ) : (
            <div className={styles.emptySprint}>
              <span className={styles.emptyIcon}><CalendarDays size={17} /></span>
              <div>
                <strong>No hay sprints planificados</strong>
                <p>Planifica el próximo ciclo y define su objetivo para dar foco al equipo.</p>
              </div>
              <button type="button" className={styles.textButton} onClick={onOpenBacklog}>
                Planificar sprint <ArrowRight size={14} />
              </button>
            </div>
          )}
        </section>

        <div className={styles.sideColumn}>
          <section className={styles.teamPanel} aria-labelledby="team-panel-title">
            <header className={styles.panelHeader}>
              <div className={styles.panelHeading}>
                <UsersRound size={16} className={styles.panelIcon} />
                <h3 id="team-panel-title">Responsabilidades Scrum</h3>
              </div>
              <button type="button" className={styles.iconButton} onClick={onOpenMembers} aria-label="Ver miembros del proyecto" title="Ver miembros">
                <ArrowRight size={15} />
              </button>
            </header>
            <div className={styles.roleRows}>
              <RoleRow label="Product Owner" person={productOwner} emptyLabel="Sin asignar" />
              <RoleRow label="Scrum Master" person={scrumMaster} emptyLabel="Sin asignar" />
              <div className={styles.developerRow}>
                <span className={styles.roleLabel}>Developers</span>
                <div className={styles.developerPeople}>
                  {developers.length ? (
                    <>
                      <div className={styles.avatarStack}>
                        {developers.slice(0, 4).map((developer) => <Avatar key={developer.userId} name={developer.name} />)}
                      </div>
                      <span>{developers.length} {developers.length === 1 ? 'persona' : 'personas'}</span>
                    </>
                  ) : <span className={styles.roleEmpty}>Sin asignar</span>}
                </div>
              </div>
            </div>
            <button type="button" className={styles.teamLink} onClick={onOpenMembers}>Ver equipo del proyecto <ArrowRight size={14} /></button>
          </section>

          <section className={styles.milestonePanel} aria-labelledby="milestone-panel-title">
            <header className={styles.panelHeader}>
              <div className={styles.panelHeading}>
                <Flag size={16} className={styles.panelIcon} />
                <h3 id="milestone-panel-title">Próximo hito</h3>
              </div>
              <button type="button" className={styles.iconButton} onClick={onOpenSchedule} aria-label="Ver cronograma" title="Ver cronograma">
                <ArrowRight size={15} />
              </button>
            </header>
            {milestone ? (
              <MilestoneSummary milestone={milestone} />
            ) : (
              <div className={styles.noMilestone}>
                <span>Sin hitos próximos</span>
                <button type="button" className={styles.textButton} onClick={onOpenSchedule}>Abrir cronograma <ArrowRight size={14} /></button>
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}

function RoleRow({ label, person, emptyLabel }: {
  label: string;
  person?: { userId: string; name: string };
  emptyLabel: string;
}) {
  return (
    <div className={styles.roleRow}>
      <span className={styles.roleLabel}>{label}</span>
      {person ? (
        <span className={styles.rolePerson}><Avatar name={person.name} /> <span>{person.name}</span></span>
      ) : <span className={styles.roleEmpty}>{emptyLabel}</span>}
    </div>
  );
}

function MilestoneSummary({ milestone }: { milestone: ProjectMilestone }) {
  return (
    <div className={styles.milestoneSummary}>
      <span className={styles.milestoneDate}>{dateLabel(milestone.date)}</span>
      <div>
        <strong>{milestone.name}</strong>
        {milestone.description && <p>{milestone.description}</p>}
      </div>
    </div>
  );
}
