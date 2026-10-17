'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import {
  Activity, ArrowRight, CalendarDays, Check, CircleAlert, Flag, FolderKanban, ListTodo,
  RotateCw, UsersRound,
} from 'lucide-react';
import { apiService } from '@/services/apiService';
import { projectApi, type ProjectDirectMember, type ProjectTeamMember } from '@/features/projects/api';
import type { SidebarProject } from '@/stores/activeWorkspaceStore';
import type { MyDayCard } from '@/lib/myDay';
import { socketService } from '@/services/socketService';
import styles from './ProjectDashboardWidgets.module.css';

type DashboardProject = {
  id: string;
  workspaceId: string;
  name: string;
  color?: string | null;
  status: string;
  ownerId?: string | null;
  ownerName?: string | null;
  boards?: { id: string; name: string; color?: string | null }[];
  milestones?: { id: string; name: string; date: string; status: 'PENDING' | 'REACHED' | 'MISSED'; color?: string | null }[];
};

type ProjectMilestoneItem = NonNullable<DashboardProject['milestones']>[number] & {
  projectId: string;
  projectName: string;
  projectColor?: string | null;
};
type Snapshot<T> = { items: T[]; status: 'idle' | 'loading' | 'ready' | 'error' };
type ProjectTask = MyDayCard & { projectId: string; projectName: string; projectColor?: string | null };
type WorkspaceActivity = {
  id: string;
  eventType?: string;
  type?: string;
  payload?: Record<string, unknown> | null;
  userId?: string | null;
  userName?: string | null;
  timestamp?: number | string | null;
  createdAt?: string | Date | null;
  targetType?: string | null;
  targetId?: string | null;
  targetName?: string | null;
  boardId?: string | null;
  cardId?: string | null;
};
type ProjectActivityItem = WorkspaceActivity & { eventType: string; projectId: string; projectName: string; projectColor?: string | null };
type ProjectPerson = {
  id: string;
  name: string;
  email?: string;
  role: string;
  projectIds: string[];
  projectNames: string[];
};
type ProjectPeopleGroup = { id: string; name: string; color?: string | null; people: ProjectPerson[] };
export type ProjectWidgetKind = 'project-active' | 'project-tasks' | 'project-milestones' | 'project-activity' | 'project-members';

export function ProjectFeatureIcon({ kind, size = 16 }: { kind: ProjectWidgetKind; size?: number }) {
  const props = { size, strokeWidth: 1.8 };
  switch (kind) {
    case 'project-active': return <FolderKanban {...props} />;
    case 'project-tasks': return <ListTodo {...props} />;
    case 'project-milestones': return <Flag {...props} />;
    case 'project-activity': return <Activity {...props} />;
    case 'project-members': return <UsersRound {...props} />;
  }
}

const idle = <T,>(): Snapshot<T> => ({ items: [], status: 'idle' });

export function useProjectDashboardData({
  workspaceId,
  projects,
  needsTasks,
  needsMilestones,
  needsActivity,
  needsPeople,
}: {
  workspaceId: string | null;
  projects: SidebarProject[];
  needsTasks: boolean;
  needsMilestones: boolean;
  needsActivity: boolean;
  needsPeople: boolean;
}) {
  const [projectSnapshot, setProjectSnapshot] = useState<Snapshot<DashboardProject>>(idle);
  const [taskSnapshot, setTaskSnapshot] = useState<Snapshot<ProjectTask>>(idle);
  const [activitySnapshot, setActivitySnapshot] = useState<Snapshot<ProjectActivityItem>>(idle);
  const [peopleSnapshot, setPeopleSnapshot] = useState<Snapshot<ProjectPeopleGroup>>(idle);
  const [refreshKey, setRefreshKey] = useState(0);
  const needsAny = needsTasks || needsMilestones || needsActivity || needsPeople;
  const projectScope = projects.filter((project) => project.workspaceId === workspaceId).map((project) => project.id).sort().join('|');
  const retry = () => setRefreshKey((value) => value + 1);

  useEffect(() => {
    let active = true;
    if (!needsAny) {
      setProjectSnapshot(idle());
      return () => { active = false; };
    }
    if (!workspaceId) {
      setProjectSnapshot({ items: [], status: 'ready' });
      return () => { active = false; };
    }

    setProjectSnapshot((current) => ({ ...current, status: 'loading' }));
    void apiService.get<{ projects: DashboardProject[] }>('/api/workspaces/' + workspaceId + '/projects', true)
      .then((response) => {
        if (!active) return;
        if (!response.success || !response.data) throw new Error(response.error?.message ?? 'No se pudieron cargar los proyectos.');
        setProjectSnapshot({ items: response.data.projects ?? [], status: 'ready' });
      })
      .catch(() => { if (active) setProjectSnapshot({ items: [], status: 'error' }); });
    return () => { active = false; };
  }, [needsAny, workspaceId, projectScope, refreshKey]);

  useEffect(() => {
    let active = true;
    if (!needsTasks) { setTaskSnapshot(idle()); return () => { active = false; }; }
    if (projectSnapshot.status === 'idle' || projectSnapshot.status === 'loading') {
      setTaskSnapshot({ items: [], status: 'loading' });
      return () => { active = false; };
    }
    if (projectSnapshot.status === 'error') {
      setTaskSnapshot({ items: [], status: 'error' });
      return () => { active = false; };
    }
    if (!workspaceId || projectSnapshot.items.length === 0) {
      setTaskSnapshot({ items: [], status: 'ready' });
      return () => { active = false; };
    }

    setTaskSnapshot((current) => ({ ...current, status: 'loading' }));
    void apiService.get<{ pending: MyDayCard[]; overdue: MyDayCard[] }>('/api/users/me/cards', true)
      .then((response) => {
        if (!active) return;
        if (!response.success || !response.data) throw new Error(response.error?.message ?? 'No se pudieron cargar las tareas.');
        const boardProjects = new Map<string, DashboardProject>();
        for (const project of projectSnapshot.items) for (const board of project.boards ?? []) boardProjects.set(board.id, project);
        const unique = new Map<string, ProjectTask>();
        for (const card of [...(response.data.overdue ?? []), ...(response.data.pending ?? [])]) {
          const project = boardProjects.get(card.boardId);
          if (!project || card.workspaceId !== workspaceId || card.completed) continue;
          unique.set(card.id, { ...card, projectId: project.id, projectName: project.name, projectColor: project.color });
        }
        const priority = { HIGH: 0, MEDIUM: 1, LOW: 2 };
        const tasks = [...unique.values()].sort((left, right) => {
          const leftDue = left.dueDate ? new Date(left.dueDate).getTime() : Number.POSITIVE_INFINITY;
          const rightDue = right.dueDate ? new Date(right.dueDate).getTime() : Number.POSITIVE_INFINITY;
          return leftDue - rightDue
            || priority[left.priority ?? 'LOW'] - priority[right.priority ?? 'LOW']
            || left.title.localeCompare(right.title, 'es');
        });
        setTaskSnapshot({ items: tasks, status: 'ready' });
      })
      .catch(() => { if (active) setTaskSnapshot({ items: [], status: 'error' }); });
    return () => { active = false; };
  }, [needsTasks, projectSnapshot, workspaceId, refreshKey]);

  useEffect(() => {
    let active = true;
    if (!needsActivity) { setActivitySnapshot(idle()); return () => { active = false; }; }
    if (projectSnapshot.status === 'idle' || projectSnapshot.status === 'loading') {
      setActivitySnapshot({ items: [], status: 'loading' });
      return () => { active = false; };
    }
    if (projectSnapshot.status === 'error') {
      setActivitySnapshot({ items: [], status: 'error' });
      return () => { active = false; };
    }
    if (!workspaceId || projectSnapshot.items.length === 0) {
      setActivitySnapshot({ items: [], status: 'ready' });
      return () => { active = false; };
    }

    setActivitySnapshot((current) => ({ ...current, status: 'loading' }));
    void apiService.get<{ events: WorkspaceActivity[] }>('/api/workspaces/' + workspaceId + '/activity?limit=100', true)
      .then((response) => {
        if (!active) return;
        if (!response.success || !response.data) throw new Error(response.error?.message ?? 'No se pudo cargar la actividad.');
        const projectsById = new Map(projectSnapshot.items.map((project) => [project.id, project]));
        const projectsByBoard = new Map<string, DashboardProject>();
        for (const project of projectSnapshot.items) for (const board of project.boards ?? []) projectsByBoard.set(board.id, project);
        const items = (response.data.events ?? []).flatMap((event): ProjectActivityItem[] => {
          const payloadProjectId = typeof event.payload?.projectId === 'string' ? event.payload.projectId : undefined;
          const projectId = event.targetType === 'project' && event.targetId
            ? event.targetId
            : payloadProjectId ?? (event.boardId ? projectsByBoard.get(event.boardId)?.id : undefined);
          const project = projectId ? projectsById.get(projectId) : undefined;
          const eventType = event.eventType ?? event.type;
          return project && eventType ? [{ ...event, eventType, projectId: project.id, projectName: project.name, projectColor: project.color }] : [];
        }).sort((left, right) => eventTime(right) - eventTime(left)).slice(0, 8);
        setActivitySnapshot({ items, status: 'ready' });
      })
      .catch(() => { if (active) setActivitySnapshot({ items: [], status: 'error' }); });
    return () => { active = false; };
  }, [needsActivity, projectSnapshot, workspaceId, refreshKey]);

  useEffect(() => {
    let active = true;
    if (!needsPeople) { setPeopleSnapshot(idle()); return () => { active = false; }; }
    if (projectSnapshot.status === 'idle' || projectSnapshot.status === 'loading') {
      setPeopleSnapshot({ items: [], status: 'loading' });
      return () => { active = false; };
    }
    if (projectSnapshot.status === 'error') {
      setPeopleSnapshot({ items: [], status: 'error' });
      return () => { active = false; };
    }
    if (projectSnapshot.items.length === 0) {
      setPeopleSnapshot({ items: [], status: 'ready' });
      return () => { active = false; };
    }

    setPeopleSnapshot((current) => ({ ...current, status: 'loading' }));
    const loadGroup = async (project: DashboardProject): Promise<{ group: ProjectPeopleGroup; succeeded: boolean }> => {
      const [directResult, teamResult] = await Promise.allSettled([
        projectApi.getDirectMembers(project.id),
        projectApi.getTeamMembers(project.id),
      ]);
      const localPeople = new Map<string, ProjectPerson>();
      if (directResult.status === 'fulfilled') for (const member of directResult.value) addMember(localPeople, member, project);
      if (teamResult.status === 'fulfilled') for (const member of teamResult.value) addMember(localPeople, member, project);
      if (project.ownerId && project.ownerName && !localPeople.has(project.ownerId)) {
        localPeople.set(project.ownerId, {
          id: project.ownerId, name: project.ownerName, role: 'Responsable',
          projectIds: [project.id], projectNames: [project.name],
        });
      }
      return {
        group: { id: project.id, name: project.name, color: project.color, people: [...localPeople.values()] },
        succeeded: directResult.status === 'fulfilled' || teamResult.status === 'fulfilled' || localPeople.size > 0,
      };
    };

    void mapConcurrent(projectSnapshot.items, 5, loadGroup).then((results) => {
      if (!active) return;
      const successful = results.filter((result) => result.succeeded).length;
      if (successful === 0 && results.length > 0) { setPeopleSnapshot({ items: [], status: 'error' }); return; }
      setPeopleSnapshot({ items: results.map((result) => result.group), status: 'ready' });
    }).catch(() => { if (active) setPeopleSnapshot({ items: [], status: 'error' }); });
    return () => { active = false; };
  }, [needsPeople, projectSnapshot, refreshKey]);

  useEffect(() => {
    if (!needsAny || !workspaceId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setRefreshKey((value) => value + 1), 160);
    };
    const onWorkspaceInvalidate = (event: Event) => {
      const update = (event as CustomEvent<{ workspaceId?: string; resource?: string }>).detail;
      if (update?.workspaceId === workspaceId && ['boards', 'projects', 'all'].includes(update.resource ?? '')) refresh();
    };
    const onSocketEvent = (event: { type?: string }) => {
      if (event.type?.startsWith('card.') || event.type?.startsWith('project.') || event.type?.startsWith('board.')) refresh();
    };
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', refresh);
    window.addEventListener('aether:realtime:workspace-invalidate', onWorkspaceInvalidate);
    document.addEventListener('visibilitychange', onVisibility);
    socketService.on('event', onSocketEvent);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('aether:realtime:workspace-invalidate', onWorkspaceInvalidate);
      document.removeEventListener('visibilitychange', onVisibility);
      socketService.off('event', onSocketEvent);
    };
  }, [needsAny, workspaceId]);

  const milestones = useMemo(() => projectSnapshot.items.flatMap((project) => (project.milestones ?? [])
    .filter((milestone) => milestone.status === 'PENDING' && milestone.date && Number.isFinite(milestoneDay(milestone.date)))
    .map((milestone) => ({ ...milestone, projectId: project.id, projectName: project.name, projectColor: milestone.color || project.color })))
    .sort((left, right) => milestoneDay(left.date) - milestoneDay(right.date)), [projectSnapshot.items]);

  return {
    tasks: taskSnapshot,
    milestones: { items: milestones, status: needsMilestones ? projectSnapshot.status : 'idle' as const },
    activity: activitySnapshot,
    people: peopleSnapshot,
    retry,
  };
}

function addMember(collection: Map<string, ProjectPerson>, member: ProjectDirectMember | ProjectTeamMember, project: DashboardProject) {
  if (collection.has(member.id)) return;
  collection.set(member.id, {
    id: member.id,
    name: member.name,
    email: member.email,
    role: member.role === 'MEMBER' ? 'Colaborador' : member.role,
    projectIds: [project.id],
    projectNames: [project.name],
  });
}

async function mapConcurrent<T, R>(items: T[], limit: number, map: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await map(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

function eventTime(event: WorkspaceActivity) {
  const value = event.createdAt ?? event.timestamp ?? 0;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function milestoneDay(value: string) {
  return new Date(value.slice(0, 10) + 'T00:00:00').getTime();
}

function relativeDate(value: string | Date | number | null | undefined) {
  if (value == null) return 'Ahora';
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (!Number.isFinite(time)) return 'Reciente';
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60_000));
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return 'Hace ' + minutes + ' min';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return 'Hace ' + hours + ' h';
  const days = Math.floor(hours / 24);
  if (days < 7) return 'Hace ' + days + ' d';
  return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' }).format(time);
}

function dayLabel(dateValue: string) {
  const target = new Date(dateValue.slice(0, 10) + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const delta = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (delta < 0) return 'Hace ' + Math.abs(delta) + ' d';
  if (delta === 0) return 'Hoy';
  if (delta === 1) return 'Mañana';
  return 'En ' + delta + ' d';
}

function shortDate(dateValue: string) {
  const date = new Date(dateValue.slice(0, 10) + 'T00:00:00');
  return {
    day: new Intl.DateTimeFormat('es', { day: '2-digit' }).format(date),
    month: new Intl.DateTimeFormat('es', { month: 'short' }).format(date).replace('.', '').toUpperCase(),
  };
}

function taskDeadline(task: ProjectTask) {
  if (!task.dueDate) return 'Sin fecha';
  return dayLabel(task.dueDate);
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || '?';
}

function toneFor(value: string) {
  const tones = ['#8060aa', '#4a9a87', '#6a86b5', '#c27880', '#a27858'];
  const hash = [...value].reduce((total, character) => total + character.charCodeAt(0), 0);
  return tones[hash % tones.length];
}

function activityCopy(event: ProjectActivityItem) {
  const actions: Record<string, string> = {
    'card.created': 'añadió una tarea',
    'card.moved': 'movió una tarea',
    'card.status-changed': 'cambió el estado de',
    'card.updated': 'actualizó',
    'card.due-date.set': 'programó la entrega de',
    'card.member.assigned': 'asignó a alguien en',
    'project.created': 'inició el proyecto',
    'project.updated': 'actualizó el proyecto',
    'project.status.changed': 'cambió el estado del proyecto',
    'project.milestone.created': 'añadió un hito',
    'project.milestone.completed': 'completó un hito',
    'project.board.linked': 'sumó un tablero',
  };
  const subject = event.targetName && event.targetType !== 'project'
    ? event.targetName
    : stringValue(event.payload?.cardTitle) ?? stringValue(event.payload?.milestoneName) ?? stringValue(event.payload?.name) ?? event.projectName;
  return { action: actions[event.eventType] ?? 'actualizó el proyecto', subject };
}

function stringValue(value: unknown) { return typeof value === 'string' && value.trim() ? value : undefined; }

function RetryState({ text, onRetry }: { text: string; onRetry: () => void }) {
  return <div className={styles.widgetState} role="status"><CircleAlert size={16} /><span>{text}</span><button type="button" onClick={onRetry} aria-label="Reintentar carga"><RotateCw size={13} /></button></div>;
}

function LoadingRows({ count = 3 }: { count?: number }) {
  return <div className={styles.loadingRows} role="status" aria-label="Cargando datos">{Array.from({ length: count }, (_, index) => <i key={index} aria-hidden="true" />)}</div>;
}

export function ProjectTasksWidget({ data, onRetry }: { data: Snapshot<ProjectTask>; onRetry: () => void }) {
  const tasks = data.items;
  const today = tasks.filter((task) => task.dueDate && dayLabel(task.dueDate) === 'Hoy').length;
  const blocked = tasks.filter((task) => task.blockedByPendingCount > 0).length;
  const highPriority = tasks.filter((task) => task.priority === 'HIGH').length;

  return <section className={styles.taskWidget} aria-label="Mis tareas en proyectos" aria-busy={data.status === 'loading'}>
    <header className={styles.taskHeading}>
      <div className={styles.taskTitleLine}><strong className={styles.taskTitle}>Mis tareas en proyectos</strong><span className={styles.taskCount}>{tasks.length.toString().padStart(2, '0')}</span></div>
      <Link href="/dashboard/projects" aria-label="Abrir mis tareas en proyectos">Ver tareas <ArrowRight size={13} /></Link>
    </header>
    <div className={styles.taskSignals} aria-label={highPriority + ' de prioridad alta, ' + today + ' para hoy, ' + blocked + ' bloqueadas'}>
      <span><i data-tone="urgent" />{highPriority} <small>prioridad</small></span>
      <span><i data-tone="today" />{today} <small>hoy</small></span>
      <span><i data-tone="blocked" />{blocked} <small>bloqueadas</small></span>
    </div>
    {data.status === 'loading' ? <LoadingRows /> : data.status === 'error' ? <RetryState text="No pudimos cargar tu cola de tareas." onRetry={onRetry} /> : tasks.length ? <nav className={styles.taskQueue} aria-label="Tareas asignadas">
      {tasks.slice(0, 3).map((task, index) => <Link className={styles.taskItem} href={'/dashboard/boards/' + task.boardId + '?cardId=' + encodeURIComponent(task.id)} key={task.id} title={task.title}>
        <span className={styles.taskOrdinal}>{String(index + 1).padStart(2, '0')}</span>
        <span className={styles.taskCopy}><strong>{task.title}</strong><small>{task.projectName} · {task.listName}</small></span>
        <span className={styles.taskDue} data-overdue={task.dueDate ? dayLabel(task.dueDate).startsWith('Hace') : undefined} data-due={task.dueDate && dayLabel(task.dueDate) === 'Hoy' ? 'today' : undefined}>{taskDeadline(task)}</span>
        <ArrowRight size={13} className={styles.taskArrow} />
      </Link>)}
    </nav> : <div className={styles.taskEmpty}><Check size={15} /><span>Tu cola está despejada.<small>Las tareas que te asignen aparecerán aquí.</small></span></div>}
  </section>;
}

export function ProjectMilestonesWidget({ data, onRetry }: { data: Snapshot<ProjectMilestoneItem>; onRetry: () => void }) {
  return <section className={styles.milestoneWidget} aria-label="Hitos próximos" aria-busy={data.status === 'loading'}>
    <header className={styles.milestoneHeading}>
      <div><strong className={styles.milestoneTitle}>Próximos hitos</strong></div>
      <span className={styles.milestoneCount}>{data.items.length.toString().padStart(2, '0')} <small>pendientes</small></span>
    </header>
    {data.status === 'loading' ? <LoadingRows count={3} /> : data.status === 'error' ? <RetryState text="No pudimos cargar los hitos." onRetry={onRetry} /> : data.items.length ? <div className={styles.milestoneTimeline}>
      <div className={styles.timelineTrack} aria-hidden="true"><i /><i /><i /></div>
      <div className={styles.milestoneCards}>
        {data.items.slice(0, 3).map((milestone) => {
          const date = shortDate(milestone.date);
          return <Link className={styles.milestoneCard} href={'/dashboard/projects/' + milestone.projectId} key={milestone.id} title={milestone.name + ' · ' + milestone.projectName}>
            <time className={styles.milestoneDate} dateTime={milestone.date}><small>{date.month}</small><strong>{date.day}</strong><span>{dayLabel(milestone.date)}</span></time>
            <span className={styles.milestoneCopy}><strong>{milestone.name}</strong><small><i style={{ backgroundColor: milestone.projectColor || 'var(--c-accent)' }} />{milestone.projectName}</small></span>
          </Link>;
        })}
      </div>
    </div> : <div className={styles.milestoneEmpty}><CalendarDays size={17} /><span>Sin hitos próximos<small>Los hitos pendientes aparecerán en esta línea de tiempo.</small></span></div>}
    <Link className={styles.milestoneFooter} href="/dashboard/projects">Ver planificación <ArrowRight size={12} /></Link>
  </section>;
}

export function ProjectActivityWidget({ data, onRetry }: { data: Snapshot<ProjectActivityItem>; onRetry: () => void }) {
  return <section className={styles.activityWidget} aria-label="Actividad de proyectos" aria-busy={data.status === 'loading'}>
    <header className={styles.activityHeading}><div><strong className={styles.activityTitle}>Actividad de proyectos</strong></div><Link href="/dashboard/projects">Ver todo <ArrowRight size={12} /></Link></header>
    {data.status === 'loading' ? <LoadingRows count={3} /> : data.status === 'error' ? <RetryState text="No pudimos cargar la actividad." onRetry={onRetry} /> : data.items.length ? <ol className={styles.activityTrail}>
      {data.items.slice(0, 4).map((event) => {
        const { action, subject } = activityCopy(event);
        const href = event.boardId && event.cardId
          ? '/dashboard/boards/' + event.boardId + '?cardId=' + encodeURIComponent(event.cardId)
          : '/dashboard/projects/' + event.projectId;
        return <li key={event.id}>
          <span className={styles.activityAvatar} style={{ '--person-tone': toneFor(event.userName ?? '') } as CSSProperties}>{initials(event.userName ?? 'Equipo')}</span>
          <span className={styles.activityLine} aria-hidden="true" />
          <Link href={href} className={styles.activityCopy} title={(event.userName ?? 'Alguien') + ' ' + action + ' ' + subject}>
            <span><strong>{event.userName ?? 'Alguien'}</strong> {action} <b>{subject}</b></span>
            <small><i style={{ backgroundColor: event.projectColor || 'var(--c-accent)' }} />{event.projectName}<time>{relativeDate(event.createdAt ?? event.timestamp)}</time></small>
          </Link>
        </li>;
      })}
    </ol> : <div className={styles.activityEmpty}><span className={styles.activityEmptyDot} /><span>El próximo movimiento aparecerá aquí.<small>La actividad reciente se agrupa entre tus proyectos.</small></span></div>}
  </section>;
}

export function ProjectMembersWidget({ data, onRetry }: { data: Snapshot<ProjectPeopleGroup>; onRetry: () => void }) {
  const [selectedProject, setSelectedProject] = useState('all');
  const people = useMemo(() => {
    const grouped = new Map<string, ProjectPerson>();
    const source = selectedProject === 'all' ? data.items : data.items.filter((project) => project.id === selectedProject);
    for (const project of source) for (const person of project.people) {
      const existing = grouped.get(person.id);
      if (existing) {
        for (const id of person.projectIds) if (!existing.projectIds.includes(id)) existing.projectIds.push(id);
        for (const name of person.projectNames) if (!existing.projectNames.includes(name)) existing.projectNames.push(name);
      } else grouped.set(person.id, { ...person, projectIds: [...person.projectIds], projectNames: [...person.projectNames] });
    }
    return [...grouped.values()].sort((left, right) => left.name.localeCompare(right.name, 'es'));
  }, [data.items, selectedProject]);
  const selectedLabel = selectedProject === 'all' ? 'Todos los proyectos' : data.items.find((project) => project.id === selectedProject)?.name ?? 'Proyecto';

  useEffect(() => {
    if (selectedProject !== 'all' && !data.items.some((project) => project.id === selectedProject)) setSelectedProject('all');
  }, [data.items, selectedProject]);

  return <section className={styles.peopleWidget} aria-label="Personas de mis proyectos" aria-busy={data.status === 'loading'}>
    <header className={styles.peopleHeading}>
      <div className={styles.peopleMetric}><strong>{people.length.toString().padStart(2, '0')}</strong><span>personas en proyectos</span></div>
      <div className={styles.peopleOrbit} aria-hidden="true">{people.slice(0, 5).map((person, index) => <i key={person.id} style={{ '--person-tone': toneFor(person.name), '--person-index': index } as CSSProperties}>{initials(person.name)}</i>)}</div>
    </header>
    <div className={styles.peopleFilters} role="group" aria-label="Filtrar personas por proyecto">
      <button type="button" className={selectedProject === 'all' ? styles.peopleFilterActive : ''} onClick={() => setSelectedProject('all')} aria-pressed={selectedProject === 'all'}>Todos</button>
      {data.items.slice(0, 3).map((project) => <button key={project.id} type="button" className={selectedProject === project.id ? styles.peopleFilterActive : ''} onClick={() => setSelectedProject(project.id)} aria-pressed={selectedProject === project.id} title={project.name}>{project.name}</button>)}
    </div>
    {data.status === 'loading' ? <LoadingRows count={2} /> : data.status === 'error' ? <RetryState text="No pudimos cargar a las personas." onRetry={onRetry} /> : people.length ? <div className={styles.peopleRoster} aria-label={selectedLabel}>
      {people.slice(0, 3).map((person) => {
        const targetProjectId = selectedProject !== 'all' ? selectedProject : person.projectIds[0];
        return <Link href={targetProjectId ? '/dashboard/projects/' + targetProjectId : '/dashboard/projects'} className={styles.personRow} key={person.id} title={'Ver participación de ' + person.name}>
          <i className={styles.personAvatar} style={{ '--person-tone': toneFor(person.name) } as CSSProperties}>{initials(person.name)}</i>
          <span><strong>{person.name}</strong><small>{person.role === 'ADMIN' ? 'Administrador' : person.role === 'VIEWER' ? 'Observador' : person.role}</small></span>
          <em>{person.projectIds.length > 1 ? person.projectIds.length + ' proyectos' : person.projectNames[0] ?? ''}</em>
        </Link>;
      })}
    </div> : <div className={styles.peopleEmpty}><UsersRound size={16} /><span>Aún no hay participantes<small>La cartera mostrará aquí a cada responsable y colaborador.</small></span></div>}
    <Link className={styles.peopleFooter} href="/dashboard/projects">Explorar equipos <ArrowRight size={12} /></Link>
  </section>;
}

export function ProjectWidgetCatalogPreview({ kind }: { kind: 'project-tasks' | 'project-milestones' | 'project-activity' | 'project-members' }) {
  if (kind === 'project-tasks') return <div className={styles.catalogTaskPreview}><span className={styles.catalogTaskHeading}><ProjectFeatureIcon kind={kind} size={13} />COLA DE TRABAJO</span><i /><i /><i /></div>;
  if (kind === 'project-milestones') return <div className={styles.catalogMilestonePreview}><span><ProjectFeatureIcon kind={kind} size={11} /></span><i /><span /><i /><span /></div>;
  if (kind === 'project-activity') return <div className={styles.catalogActivityPreview}><i className={styles.catalogActivityGlyph}><ProjectFeatureIcon kind={kind} size={12} /></i><span /><i /><span /><i /><span /></div>;
  return <div className={styles.catalogPeoplePreview}><span className={styles.catalogPeopleGlyph}><ProjectFeatureIcon kind={kind} size={13} /></span><i /><i /><span /><span /><span /></div>;
}
