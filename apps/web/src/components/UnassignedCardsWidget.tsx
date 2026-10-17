'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, CalendarClock, CircleCheck, Flag, RotateCw,
  UserRoundPlus, UsersRound,
} from 'lucide-react';
import { apiService } from '@/services/apiService';
import { socketService } from '@/services/socketService';
import styles from './UnassignedCardsWidget.module.css';

type UnassignedCard = {
  id: string;
  title: string;
  dueDate: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  createdAt: string;
  listName: string;
  boardId: string;
  boardName: string;
};
type UnassignedSnapshot = {
  cards: UnassignedCard[];
  totalCount: number;
  priorityCounts: { high: number; medium: number; low: number; unprioritized: number; overdue: number };
  status: 'loading' | 'ready' | 'error';
};
type CardFilter = 'all' | 'high' | 'overdue';

function localDate(value: string | null) {
  if (!value) return null;
  const part = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const date = part ? new Date(Number(part[1]), Number(part[2]) - 1, Number(part[3])) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function dateBadge(value: string | null, today: Date) {
  const due = localDate(value);
  if (!due) return { label: 'Sin fecha', overdue: false };
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return { label: days === -1 ? 'Venció ayer' : `Venció hace ${Math.abs(days)} d`, overdue: true };
  if (days === 0) return { label: 'Vence hoy', overdue: false };
  if (days === 1) return { label: 'Mañana', overdue: false };
  return { label: due.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }).replace('.', ''), overdue: false };
}

function cardHref(card: UnassignedCard) {
  return `/dashboard/boards/${card.boardId}?cardId=${encodeURIComponent(card.id)}`;
}

function LoadingTriage() {
  return <div className={styles.loading} role="status" aria-label="Buscando tarjetas sin responsable">
    <div className={styles.loadingSummary}><i /><span /><b /></div>
    <div className={styles.loadingFilters}><i /><i /><i /></div>
    {[0, 1, 2].map((item) => <div className={styles.loadingCard} key={item}><i /><span><b /><em /></span><small /></div>)}
  </div>;
}

export function UnassignedCardsWidget({ workspaceId }: { workspaceId: string | null }) {
  const [snapshot, setSnapshot] = useState<UnassignedSnapshot>({ cards: [], totalCount: 0, priorityCounts: { high: 0, medium: 0, low: 0, unprioritized: 0, overdue: 0 }, status: 'loading' });
  const [refreshKey, setRefreshKey] = useState(0);
  const [filter, setFilter] = useState<CardFilter>('all');

  useEffect(() => {
    let active = true;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    if (!workspaceId) {
      setSnapshot({ cards: [], totalCount: 0, priorityCounts: { high: 0, medium: 0, low: 0, unprioritized: 0, overdue: 0 }, status: 'ready' });
      return () => { active = false; };
    }

    setSnapshot((current) => ({ ...current, status: 'loading' }));
    const load = async () => {
      try {
        const response = await apiService.get<{ cards: UnassignedCard[]; totalCount: number; priorityCounts: UnassignedSnapshot['priorityCounts'] }>(`/api/workspaces/${workspaceId}/unassigned-cards`, true);
        if (!active) return;
        if (!response.success || !response.data) throw new Error(response.error?.message ?? 'No se pudieron cargar las tarjetas.');
        setSnapshot({ cards: response.data.cards ?? [], totalCount: response.data.totalCount ?? 0, priorityCounts: response.data.priorityCounts ?? { high: 0, medium: 0, low: 0, unprioritized: 0, overdue: 0 }, status: 'ready' });
      } catch {
        if (active) setSnapshot((current) => ({ ...current, status: 'error' }));
      }
    };
    const refresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => void load(), 140);
    };
    const onWorkspaceInvalidate = (event: Event) => {
      const update = (event as CustomEvent<{ workspaceId?: string; resource?: string }>).detail;
      if (update?.workspaceId === workspaceId && ['boards', 'projects', 'all'].includes(update.resource ?? '')) refresh();
    };
    const onBoardEvent = (event: { type?: string }) => {
      if (event.type?.startsWith('card.') || event.type?.startsWith('board.')) refresh();
    };
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh(); };
    void load();
    window.addEventListener('focus', refresh);
    window.addEventListener('aether:realtime:workspace-invalidate', onWorkspaceInvalidate);
    document.addEventListener('visibilitychange', onVisibility);
    socketService.on('event', onBoardEvent);
    return () => {
      active = false;
      if (refreshTimer) clearTimeout(refreshTimer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('aether:realtime:workspace-invalidate', onWorkspaceInvalidate);
      document.removeEventListener('visibilitychange', onVisibility);
      socketService.off('event', onBoardEvent);
    };
  }, [workspaceId, refreshKey]);

  const today = startOfToday();
  const { high: highCount, medium: mediumCount, low: lowCount, unprioritized: unprioritizedCount, overdue: overdueCount } = snapshot.priorityCounts;
  const lowAndUnsetCount = lowCount + unprioritizedCount;
  const filteredCards = useMemo(() => snapshot.cards.filter((card) => {
    if (filter === 'high') return card.priority === 'HIGH';
    if (filter === 'overdue') {
      const due = localDate(card.dueDate);
      return due !== null && due < today;
    }
    return true;
  }), [filter, snapshot.cards, today.getTime()]);

  const reassign = () => setRefreshKey((value) => value + 1);
  const filters: { id: CardFilter; label: string; count: number }[] = [
    { id: 'all', label: 'Todas', count: snapshot.totalCount },
    { id: 'high', label: 'Alta', count: highCount },
    { id: 'overdue', label: 'Vencidas', count: overdueCount },
  ];

  return <section className={styles.unassignedWidget} aria-label="Tarjetas sin responsable" aria-busy={snapshot.status === 'loading'}>
    {snapshot.status === 'loading' ? <LoadingTriage /> : snapshot.status === 'error' ? <div className={styles.statePanel} role="alert">
      <span className={styles.stateIcon}><UsersRound size={18} /></span>
      <span className={styles.stateCopy}><strong>No pudimos abrir la bandeja</strong><small>Reintenta para revisar el trabajo sin asignar.</small></span>
      <button type="button" onClick={reassign} aria-label="Reintentar carga de tarjetas sin responsable"><RotateCw size={14} /><span>Reintentar</span></button>
    </div> : !workspaceId ? <div className={styles.statePanel} role="status">
      <span className={styles.stateIcon}><UsersRound size={18} /></span>
      <span className={styles.stateCopy}><strong>Elige un espacio</strong><small>Selecciona un espacio de trabajo para revisar su bandeja.</small></span>
    </div> : snapshot.totalCount === 0 ? <div className={styles.clearState}>
      <span className={styles.clearGlyph}><CircleCheck size={20} /></span>
      <span className={styles.stateCopy}><strong>Todo el trabajo tiene responsable</strong><small>Las tarjetas activas sin asignación aparecerán aquí.</small></span>
      <Link href="/dashboard/projects">Explorar proyectos <ArrowRight size={13} /></Link>
    </div> : <>
      <div className={styles.triageOverview}>
        <div className={styles.ownerlessCount}><span className={styles.ownerlessGlyph}><UserRoundPlus size={16} /></span><strong>{snapshot.totalCount.toLocaleString('es-CL')}</strong><span><b>sin responsable</b><small>en este espacio</small></span></div>
        <div className={styles.priorityMix} aria-label={`${highCount} de prioridad alta, ${mediumCount} media, ${lowCount} baja y ${unprioritizedCount} sin prioridad`}>
          <span data-priority="high"><Flag size={11} /><b>{highCount}</b><small>alta</small></span>
          <span data-priority="medium"><i /><b>{mediumCount}</b><small>media</small></span>
          <span data-priority="low"><i /><b>{lowAndUnsetCount}</b><small>baja/—</small></span>
        </div>
        <div className={styles.priorityTrack} aria-hidden="true"><i style={{ width: `${snapshot.totalCount ? (highCount / snapshot.totalCount) * 100 : 0}%` }} /><i style={{ width: `${snapshot.totalCount ? (mediumCount / snapshot.totalCount) * 100 : 0}%` }} /><i style={{ width: `${snapshot.totalCount ? (lowCount / snapshot.totalCount) * 100 : 0}%` }} /><i style={{ width: `${snapshot.totalCount ? (unprioritizedCount / snapshot.totalCount) * 100 : 0}%` }} /></div>
      </div>

      <div className={styles.triageToolbar}>
        <span>ASIGNACIÓN PENDIENTE</span>
        <div className={styles.filterSet} role="group" aria-label="Filtrar tarjetas sin responsable">
          {filters.map((item) => <button key={item.id} type="button" data-selected={filter === item.id} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}<b>{item.count}</b></button>)}
        </div>
      </div>

      <div className={styles.unassignedList} aria-label={`${filteredCards.length} tarjetas mostradas`}>
        {filteredCards.length ? filteredCards.map((card, index) => {
          const due = dateBadge(card.dueDate, today);
          const priority = card.priority?.toLowerCase() ?? 'none';
          return <Link className={styles.unassignedCard} href={cardHref(card)} key={card.id} data-priority={priority} data-overdue={due.overdue || undefined} aria-label={`Abrir ${card.title} para asignar responsable, tablero ${card.boardName}, lista ${card.listName}, prioridad ${card.priority ?? 'sin prioridad'}, ${due.label}`}>
            <span className={styles.assignmentIndex}><i>{String(index + 1).padStart(2, '0')}</i><b /></span>
            <span className={styles.cardCopy}><strong>{card.title}</strong><small><span>{card.boardName}</span><i>·</i><span>{card.listName}</span></small></span>
            <span className={styles.cardActions}>
              <span className={styles.priorityBadge} data-priority={priority}>{card.priority === 'HIGH' ? <Flag size={10} /> : <i />}{card.priority === 'HIGH' ? 'Alta' : card.priority === 'MEDIUM' ? 'Media' : card.priority === 'LOW' ? 'Baja' : 'Sin prioridad'}</span>
              <span className={styles.dateBadge} data-overdue={due.overdue || undefined}><CalendarClock size={11} />{due.label}</span>
              <span className={styles.assignAction}>Asignar <ArrowRight size={12} /></span>
            </span>
          </Link>;
        }) : <div className={styles.filteredEmpty}>No hay tarjetas en este filtro. <button type="button" onClick={() => setFilter('all')}>Ver todas</button></div>}
      </div>
      <div className={styles.triageFooter}><span><i />{snapshot.totalCount > snapshot.cards.length ? `Mostrando ${snapshot.cards.length} de ${snapshot.totalCount}` : `${snapshot.totalCount} ${snapshot.totalCount === 1 ? 'tarjeta necesita' : 'tarjetas necesitan'} una asignación`}</span><span>Abre una tarjeta para elegir responsable</span></div>
    </>}
  </section>;
}
