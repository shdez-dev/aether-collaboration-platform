'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, CalendarDays, Check, CircleCheck, Clock3, RotateCw, Target, TrendingUp,
} from 'lucide-react';
import { apiService } from '@/services/apiService';
import { socketService } from '@/services/socketService';
import styles from './CurrentSprintWidget.module.css';

type SprintCard = {
  id: string;
  title: string;
  completed: boolean;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  boardId?: string | null;
  boardName?: string | null;
  listName?: string | null;
};
type Sprint = {
  id: string;
  name: string;
  goal?: string | null;
  startDate: string;
  endDate: string;
  status: string;
  cards?: SprintCard[];
};
type ScrumProject = { id: string; name: string; methodology: string; status: string };
type ActiveSprint = Sprint & { projectId: string; projectName: string };
type Snapshot = { sprints: ActiveSprint[]; status: 'loading' | 'ready' | 'error'; scrumProjects: number };

const emptySnapshot: Snapshot = { sprints: [], status: 'loading', scrumProjects: 0 };
const DAY_MS = 86_400_000;

function parseLocalDate(value?: string | null) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateStamp(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function shortDate(value: string) {
  const date = parseLocalDate(value);
  return date?.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }).replace('.', '') ?? '—';
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

async function mapConcurrent<T, R>(items: T[], limit: number, map: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await map(items[index]);
    }
  }));
  return results;
}

function sprintHref(projectId: string) {
  return `/dashboard/projects/${encodeURIComponent(projectId)}`;
}

export function CurrentSprintWidget({ workspaceId }: { workspaceId: string | null }) {
  const [snapshot, setSnapshot] = useState<Snapshot>(emptySnapshot);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedSprintId, setSelectedSprintId] = useState('');

  useEffect(() => {
    let active = true;
    setSnapshot((current) => ({ ...current, status: 'loading' }));
    if (!workspaceId) {
      setSnapshot({ sprints: [], status: 'ready', scrumProjects: 0 });
      return () => { active = false; };
    }

    const load = async () => {
      try {
        const projectsResponse = await apiService.get<{ projects: ScrumProject[] }>(`/api/workspaces/${workspaceId}/projects`, true);
        if (!projectsResponse.success || !projectsResponse.data) throw new Error('No se pudieron cargar los proyectos Scrum.');
        const projects = (projectsResponse.data.projects ?? []).filter((project) => project.methodology === 'SCRUM');
        if (!projects.length) {
          if (active) setSnapshot({ sprints: [], status: 'ready', scrumProjects: 0 });
          return;
        }

        let successful = 0;
        const results = await mapConcurrent(projects, 4, async (project) => {
          const response = await apiService.get<{ sprints: Sprint[] }>(`/api/projects/${project.id}/sprints`, true);
          if (!response.success || !response.data) return [] as ActiveSprint[];
          successful += 1;
          return (response.data.sprints ?? [])
            .filter((sprint) => sprint.status === 'ACTIVE')
            .map((sprint) => ({ ...sprint, projectId: project.id, projectName: project.name }));
        });
        if (!active) return;
        if (successful === 0) throw new Error('No se pudieron consultar los sprints.');
        const sprints = results.flat().sort((left, right) => {
          const leftEnd = parseLocalDate(left.endDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
          const rightEnd = parseLocalDate(right.endDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
          return leftEnd - rightEnd || left.projectName.localeCompare(right.projectName, 'es');
        });
        setSnapshot({ sprints, status: 'ready', scrumProjects: projects.length });
        setSelectedSprintId((current) => sprints.some((sprint) => sprint.id === current) ? current : sprints[0]?.id ?? '');
      } catch {
        if (active) setSnapshot((current) => ({ ...current, status: 'error' }));
      }
    };
    void load();
    return () => { active = false; };
  }, [workspaceId, refreshKey]);

  useEffect(() => {
    if (!workspaceId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setRefreshKey((value) => value + 1), 180);
    };
    const onWorkspaceInvalidate = (event: Event) => {
      const detail = (event as CustomEvent<{ workspaceId?: string; resource?: string }>).detail;
      if (detail?.workspaceId === workspaceId && ['boards', 'projects', 'all'].includes(detail.resource ?? '')) refresh();
    };
    const onSocketEvent = (event: { type?: string }) => {
      if (event.type?.startsWith('sprint.') || event.type?.startsWith('card.') || event.type?.startsWith('project.') || event.type?.startsWith('board.')) refresh();
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
  }, [workspaceId]);

  const selected = useMemo(() => snapshot.sprints.find((sprint) => sprint.id === selectedSprintId) ?? snapshot.sprints[0], [snapshot.sprints, selectedSprintId]);
  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, [refreshKey]);
  const cards = selected?.cards ?? [];
  const completed = cards.filter((card) => card.completed).length;
  const pending = cards.length - completed;
  const progress = cards.length ? Math.round((completed / cards.length) * 100) : 0;
  const start = selected ? parseLocalDate(selected.startDate) : null;
  const end = selected ? parseLocalDate(selected.endDate) : null;
  const duration = start && end ? Math.max(1, Math.round((dateStamp(end) - dateStamp(start)) / DAY_MS) + 1) : 1;
  const elapsed = start ? clamp(Math.floor((dateStamp(today) - dateStamp(start)) / DAY_MS) + 1, 0, duration) : 0;
  const timeProgress = Math.round((elapsed / duration) * 100);
  const remainingDays = end ? Math.ceil((dateStamp(end) - dateStamp(today)) / DAY_MS) : null;
  const paceDelta = progress - timeProgress;
  const pace = !cards.length ? 'Sin alcance' : paceDelta > 10 ? 'Por delante' : paceDelta < -10 ? 'Necesita impulso' : 'En ritmo';
  const focusedCards = useMemo(() => cards.filter((card) => !card.completed).sort((left, right) => {
    const priority = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return priority[left.priority ?? 'LOW'] - priority[right.priority ?? 'LOW'] || left.title.localeCompare(right.title, 'es');
  }).slice(0, 3), [cards]);

  return <section className={styles.sprintWidget} aria-label="Sprint actual" aria-busy={snapshot.status === 'loading'}>
    {snapshot.status === 'loading' ? <div className={styles.loading} role="status" aria-label="Cargando sprint actual">
      <div className={styles.loadingHeading}><i /><span /></div><div className={styles.loadingHero}><i /><span><b /><em /></span></div><div className={styles.loadingRows}><i /><i /><i /></div>
    </div> : snapshot.status === 'error' ? <div className={styles.stateCard} role="alert">
      <span className={styles.stateGlyph}><RotateCw size={17} /></span><strong>No pudimos leer el sprint</strong><small>Reintenta para actualizar el avance del equipo.</small>
      <button type="button" onClick={() => setRefreshKey((value) => value + 1)}><RotateCw size={13} /> Reintentar</button>
    </div> : !workspaceId ? <div className={styles.stateCard} role="status">
      <span className={styles.stateGlyph}><Target size={18} /></span><strong>Elige un espacio de trabajo</strong><small>El sprint se toma de los proyectos Scrum del espacio activo.</small>
    </div> : !selected ? <div className={styles.emptyState}>
      <div className={styles.emptyOrbit} aria-hidden="true"><span /><i /><b /></div>
      <div><strong>{snapshot.scrumProjects ? 'No hay un sprint en curso' : 'Todavía no hay proyectos Scrum'}</strong>
        <small>{snapshot.scrumProjects ? 'Cuando un equipo inicie su sprint, aquí verás su objetivo y ritmo.' : 'Crea o abre un proyecto Scrum para seguir su ciclo desde el tablero.'}</small></div>
      <Link href="/dashboard/projects">Ir a proyectos <ArrowRight size={13} /></Link>
    </div> : <>
      <header className={styles.sprintHeader}>
        <div className={styles.sprintTitle}>
          <span className={styles.eyebrow}><i /> SPRINT EN CURSO</span>
          <h3 title={selected.name}>{selected.name}</h3>
          <small title={selected.projectName}>{selected.projectName}</small>
        </div>
        <div className={styles.sprintTools}>
          {snapshot.sprints.length > 1 && <label className={styles.sprintPickerLabel}>
            <span className={styles.visuallyHidden}>Elegir sprint activo</span>
            <select value={selected.id} onChange={(event) => setSelectedSprintId(event.target.value)}>
              {snapshot.sprints.map((sprint) => <option value={sprint.id} key={sprint.id}>{sprint.projectName} · {sprint.name}</option>)}
            </select>
          </label>}
          <Link className={styles.openProject} href={sprintHref(selected.projectId)} aria-label={`Abrir proyecto ${selected.projectName}`}>Abrir <ArrowRight size={13} /></Link>
        </div>
      </header>

      <div className={styles.sprintOverview}>
        <div className={styles.progressDial} role="img" aria-label={`${progress}% de tarjetas completadas`} style={{ '--sprint-progress': `${progress}%` } as React.CSSProperties}>
          <span><strong>{progress}<small>%</small></strong><i>hecho</i></span>
        </div>
        <div className={styles.sprintIntent}>
          <span><Target size={13} /> OBJETIVO DEL CICLO</span>
          <p>{selected.goal?.trim() || 'El equipo aún no ha definido un objetivo para este sprint.'}</p>
          <div className={styles.sprintDates}>
            <time dateTime={selected.startDate}><CalendarDays size={12} />{shortDate(selected.startDate)}</time>
            <span className={styles.dateTrack} role="img" aria-label={`${timeProgress}% del tiempo transcurrido`}><i style={{ width: `${timeProgress}%` }} /></span>
            <time dateTime={selected.endDate}>{shortDate(selected.endDate)}</time>
          </div>
        </div>
        <div className={styles.timeSignal} data-late={remainingDays !== null && remainingDays < 0 || undefined}>
          <span className={styles.timeGlyph}><Clock3 size={15} /></span>
          <strong>{remainingDays === null ? '—' : remainingDays < 0 ? `${Math.abs(remainingDays)} d` : remainingDays === 0 ? 'Hoy' : `${remainingDays} d`}</strong>
          <small>{remainingDays === null ? 'sin fechas' : remainingDays < 0 ? 'fuera de fecha' : remainingDays === 0 ? 'cierra hoy' : 'para cerrar'}</small>
        </div>
      </div>

      <div className={styles.sprintSignals} aria-label={`${completed} completadas, ${pending} pendientes, ${cards.length} tarjetas comprometidas`}>
        <span><i data-signal="done"><Check size={10} /></i><strong>{completed}</strong><small>hechas</small></span>
        <span><i data-signal="pending"><CircleCheck size={10} /></i><strong>{pending}</strong><small>pendientes</small></span>
        <span><i data-signal="total"><Target size={10} /></i><strong>{cards.length}</strong><small>comprometidas</small></span>
        <span className={styles.paceBadge} data-pace={pace === 'Necesita impulso' ? 'slow' : pace === 'Por delante' ? 'ahead' : pace === 'Sin alcance' ? 'none' : 'steady'}>{cards.length ? <TrendingUp size={12} /> : <Target size={12} />}{pace}</span>
      </div>

      <div className={styles.focusHeader}><span>EN FOCO</span><small>{pending ? `${pending} por completar` : cards.length ? 'Ciclo completado' : 'Sin tarjetas comprometidas'}</small></div>
      {focusedCards.length ? <ul className={styles.focusList}>
        {focusedCards.map((card) => <li key={card.id}>
          {card.boardId ? <Link href={`/dashboard/boards/${encodeURIComponent(card.boardId)}?cardId=${encodeURIComponent(card.id)}`} title={card.title}>
            <span className={styles.focusMark} data-priority={card.priority?.toLowerCase() ?? 'none'}><i /></span>
            <span className={styles.focusCopy}><strong>{card.title}</strong><small>{card.boardName || selected.projectName}{card.listName ? ` · ${card.listName}` : ''}</small></span>
            <ArrowRight size={13} />
          </Link> : <span className={styles.focusNoBoard}><span className={styles.focusMark}><i /></span><span className={styles.focusCopy}><strong>{card.title}</strong><small>{selected.projectName}</small></span></span>}
        </li>)}
      </ul> : <div className={styles.focusEmpty}><CircleCheck size={15} /><span>{cards.length ? 'Todo el trabajo del sprint está terminado.' : 'Agrega tarjetas al sprint para ver el trabajo comprometido.'}</span></div>}
    </>}
  </section>;
}
