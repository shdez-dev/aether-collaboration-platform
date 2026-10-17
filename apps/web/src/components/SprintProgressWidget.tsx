'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Circle, RotateCw, Target, TrendingDown, TrendingUp } from 'lucide-react';
import { apiService } from '@/services/apiService';
import { socketService } from '@/services/socketService';
import styles from './SprintProgressWidget.module.css';

type ProgressCard = {
  id: string;
  title: string;
  completed: boolean;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  boardId?: string | null;
  boardName?: string | null;
  listName?: string | null;
};
type ProgressSprint = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  cards?: ProgressCard[];
};
type ScrumProject = { id: string; name: string; methodology: string };
type ActiveSprint = ProgressSprint & { projectId: string; projectName: string };
type DataSnapshot = { sprints: ActiveSprint[]; status: 'loading' | 'ready' | 'error'; scrumProjects: number };
type Lane = { name: string; names?: string[]; cards: ProgressCard[]; done: number; pending: number; share: number };

const initialSnapshot: DataSnapshot = { sprints: [], status: 'loading', scrumProjects: 0 };
const DAY_MS = 86_400_000;

function localDate(value?: string | null) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const parsed = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function midnight(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function dateLabel(value: string) {
  return localDate(value)?.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }).replace('.', '') ?? '—';
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

function cardHref(card: ProgressCard) {
  return `/dashboard/boards/${encodeURIComponent(card.boardId ?? '')}?cardId=${encodeURIComponent(card.id)}`;
}

export function SprintProgressWidget({ workspaceId }: { workspaceId: string | null }) {
  const [snapshot, setSnapshot] = useState<DataSnapshot>(initialSnapshot);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedSprintId, setSelectedSprintId] = useState('');
  const [selectedLane, setSelectedLane] = useState('');

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
          const response = await apiService.get<{ sprints: ProgressSprint[] }>(`/api/projects/${project.id}/sprints`, true);
          if (!response.success || !response.data) return [] as ActiveSprint[];
          successful += 1;
          return (response.data.sprints ?? [])
            .filter((sprint) => sprint.status === 'ACTIVE')
            .map((sprint) => ({ ...sprint, projectId: project.id, projectName: project.name }));
        });
        if (!active) return;
        if (successful === 0) throw new Error('No se pudieron consultar los sprints.');
        const sprints = results.flat().sort((left, right) => {
          const leftEnd = localDate(left.endDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
          const rightEnd = localDate(right.endDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
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
  useEffect(() => { setSelectedLane(''); }, [selectedSprintId]);
  const cards = selected?.cards ?? [];
  const done = cards.filter((card) => card.completed).length;
  const pendingCards = cards.length - done;
  const completion = cards.length ? Math.round(done / cards.length * 100) : 0;
  const [today, setToday] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });
  useEffect(() => {
    const refreshToday = () => {
      const now = new Date();
      setToday(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
    };
    window.addEventListener('focus', refreshToday);
    return () => window.removeEventListener('focus', refreshToday);
  }, []);
  const start = selected ? localDate(selected.startDate) : null;
  const end = selected ? localDate(selected.endDate) : null;
  const duration = start && end ? Math.max(1, Math.round((midnight(end) - midnight(start)) / DAY_MS) + 1) : 1;
  const elapsed = start ? clamp(Math.floor((midnight(today) - midnight(start)) / DAY_MS) + 1, 0, duration) : 0;
  const timePercent = Math.round(elapsed / duration * 100);
  const paceDelta = completion - timePercent;
  const pace = cards.length === 0 ? 'Sin alcance' : paceDelta > 10 ? 'Por delante' : paceDelta < -10 ? 'Bajo el ritmo' : 'En ritmo';
  const highPriority = cards.filter((card) => !card.completed && card.priority === 'HIGH').length;
  const mediumPriority = cards.filter((card) => !card.completed && card.priority === 'MEDIUM').length;
  const lowPriority = cards.filter((card) => !card.completed && (card.priority === 'LOW' || !card.priority)).length;

  const lanes = useMemo<Lane[]>(() => {
    const grouped = new Map<string, { name: string; cards: ProgressCard[]; done: number }>();
    for (const card of cards) {
      const name = card.listName?.trim() || 'Sin lista';
      const lane = grouped.get(name) ?? { name, cards: [], done: 0 };
      lane.cards.push(card);
      if (card.completed) lane.done += 1;
      grouped.set(name, lane);
    }
    const all = [...grouped.values()].map((lane) => ({ ...lane, pending: lane.cards.length - lane.done, share: cards.length ? lane.cards.length / cards.length : 0 }))
      .sort((left, right) => right.pending - left.pending || right.cards.length - left.cards.length || left.name.localeCompare(right.name, 'es'));
    if (all.length <= 4) return all;
    const leading = all.slice(0, 3);
    const rest = all.slice(3);
    return [...leading, {
      name: 'Otras listas', names: rest.map((lane) => lane.name), cards: rest.flatMap((lane) => lane.cards),
      done: rest.reduce((total, lane) => total + lane.done, 0), pending: rest.reduce((total, lane) => total + lane.pending, 0),
      share: rest.reduce((total, lane) => total + lane.share, 0),
    }];
  }, [cards]);
  const filteredCards = useMemo(() => {
    if (selectedLane) return cards.filter((card) => selectedLane === '__other__'
      ? !lanes.slice(0, 3).some((lane) => lane.name === (card.listName?.trim() || 'Sin lista'))
      : (card.listName?.trim() || 'Sin lista') === selectedLane);
    return cards.filter((card) => !card.completed);
  }, [cards, lanes, selectedLane]);
  const visibleCards = filteredCards.slice(0, 2);
  const selectedLaneLabel = selectedLane === '__other__' ? 'Otras listas' : selectedLane;

  return <section className={styles.progressWidget} aria-label="Progreso del sprint" aria-busy={snapshot.status === 'loading'}>
    {snapshot.status === 'loading' ? <div className={styles.loading} role="status" aria-label="Cargando progreso del sprint">
      <div className={styles.loadingHeading}><i /><span /></div><div className={styles.loadingMeter}><b /><i /></div><div className={styles.loadingLanes}><i /><i /><i /><i /></div>
    </div> : snapshot.status === 'error' ? <div className={styles.stateCard} role="alert">
      <span className={styles.stateGlyph}><RotateCw size={17} /></span><strong>No pudimos cargar el progreso</strong><small>Reintenta para revisar las tarjetas comprometidas.</small>
      <button type="button" onClick={() => setRefreshKey((value) => value + 1)}><RotateCw size={13} /> Reintentar</button>
    </div> : !workspaceId ? <div className={styles.stateCard} role="status">
      <span className={styles.stateGlyph}><Target size={18} /></span><strong>Elige un espacio de trabajo</strong><small>Este widget usa los sprints de proyectos Scrum del espacio.</small>
    </div> : !selected ? <div className={styles.emptyState}>
      <span className={styles.emptyGlyph}><Target size={20} /></span>
      <div><strong>{snapshot.scrumProjects ? 'No hay un sprint activo que medir' : 'Todavía no hay proyectos Scrum'}</strong><small>{snapshot.scrumProjects ? 'Al iniciar un sprint, aparecerán aquí sus entregas y flujo por lista.' : 'Abre proyectos para crear o consultar un equipo Scrum.'}</small></div>
      <Link href="/dashboard/projects">Ver proyectos <ArrowRight size={13} /></Link>
    </div> : <>
      <header className={styles.progressHeader}>
        <div className={styles.progressTitle}><span className={styles.eyebrow}><i /> PULSO DE ENTREGA</span><h3 title={selected.name}>{selected.name}</h3><small title={selected.projectName}>{selected.projectName}</small></div>
        <div className={styles.progressTools}>
          {snapshot.sprints.length > 1 && <label className={styles.sprintPicker}>
            <span className={styles.visuallyHidden}>Elegir sprint para ver su progreso</span>
            <select value={selected.id} onChange={(event) => { setSelectedSprintId(event.target.value); setSelectedLane(''); }}>
              {snapshot.sprints.map((sprint) => <option value={sprint.id} key={sprint.id}>{sprint.projectName} · {sprint.name}</option>)}
            </select>
          </label>}
          <Link href={sprintHref(selected.projectId)} aria-label={`Abrir proyecto ${selected.projectName}`}>Plan <ArrowRight size={13} /></Link>
        </div>
      </header>

      <section className={styles.deliveryPanel} aria-label={`${done} de ${cards.length} tarjetas completadas`}>
        <div className={styles.deliveryHeadline}><div><span>TRABAJO ENTREGADO</span><strong>{done}<small> / {cards.length}</small></strong></div><b>{completion}%</b></div>
        <div className={styles.deliveryTrack} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completion} aria-label="Tarjetas completadas"><i style={{ width: `${completion}%` }} /></div>
        <div className={styles.deliveryMeta}>
          <span><i data-kind="work" />{done} completadas</span>
          <span><i data-kind="time" />{timePercent}% del tiempo</span>
          <span className={styles.pace} data-pace={pace === 'Bajo el ritmo' ? 'slow' : pace === 'Por delante' ? 'ahead' : pace === 'Sin alcance' ? 'none' : 'steady'}>{pace === 'Sin alcance' ? <Target size={11} /> : pace === 'Bajo el ritmo' ? <TrendingDown size={11} /> : <TrendingUp size={11} />}{pace}</span>
        </div>
      </section>

      <div className={styles.flowHeading}><span>FLUJO POR LISTA</span><small>{pendingCards} pendientes · {done} hechas</small></div>
      {lanes.length ? <div className={styles.laneGrid} role="group" aria-label="Filtrar por lista del tablero">
        {lanes.map((lane) => {
          const selectionKey = lane.names ? '__other__' : lane.name;
          return <button type="button" className={styles.lane} key={selectionKey} data-selected={selectedLane === selectionKey || undefined} aria-pressed={selectedLane === selectionKey} onClick={() => setSelectedLane((current) => current === selectionKey ? '' : selectionKey)} title={`${lane.name}: ${lane.done} completadas y ${lane.pending} pendientes`}>
            <span className={styles.laneTop}><strong>{lane.name}</strong><small>{lane.cards.length}</small></span>
            <span className={styles.laneMeter}><i style={{ width: `${Math.max(lane.share * 100, lane.cards.length ? 4 : 0)}%` }} /></span>
            <span className={styles.laneFoot}><i />{lane.done} hechas <b>·</b> {lane.pending} pendientes</span>
          </button>;
        })}
      </div> : <div className={styles.noWork}><span><Target size={15} /></span><strong>Este sprint no tiene tarjetas comprometidas</strong><small>Agrega trabajo al sprint para seguir su flujo.</small></div>}

      <div className={styles.taskHeading}><span>{selectedLane ? `LISTA · ${selectedLaneLabel}` : 'SIGUIENTES TARJETAS'}</span>{selectedLane && <button type="button" onClick={() => setSelectedLane('')}>Ver pendientes</button>}</div>
      {visibleCards.length ? <ul className={styles.taskList}>
        {visibleCards.map((card) => <li key={card.id} data-completed={card.completed || undefined}>
          {card.boardId ? <Link href={cardHref(card)} title={card.title}>
            <span className={styles.taskState}>{card.completed ? <Check size={11} /> : <Circle size={9} />}</span>
            <span className={styles.taskCopy}><strong>{card.title}</strong><small>{card.boardName || selected.projectName} · {card.listName || 'Sin lista'}</small></span>
            {card.priority === 'HIGH' && !card.completed && <i className={styles.highPriority}>Alta</i>}
            <ArrowRight size={12} />
          </Link> : <span className={styles.taskNoLink}><span className={styles.taskState}>{card.completed ? <Check size={11} /> : <Circle size={9} />}</span><span className={styles.taskCopy}><strong>{card.title}</strong><small>{card.listName || 'Sin lista'}</small></span></span>}
        </li>)}
      </ul> : <div className={styles.taskEmpty}>{selectedLane ? 'No hay tarjetas en esta lista.' : cards.length ? 'Todo el trabajo comprometido ya está completo.' : 'Cuando el sprint tenga tarjetas, verás aquí las próximas.'}</div>}

      <footer className={styles.progressFooter}>
        <div className={styles.priorityMix} aria-label={`${highPriority} de prioridad alta, ${mediumPriority} media y ${lowPriority} baja o sin prioridad`}>
          <span data-level="high"><i />{highPriority} alta</span><span data-level="medium"><i />{mediumPriority} media</span><span data-level="low"><i />{lowPriority} baja/—</span>
        </div>
        <span className={styles.footerCount}>{filteredCards.length > visibleCards.length ? `${visibleCards.length} de ${filteredCards.length}` : selectedLane ? `${filteredCards.length} en lista` : `${pendingCards} pendientes`}</span>
      </footer>
    </>}
  </section>;
}
