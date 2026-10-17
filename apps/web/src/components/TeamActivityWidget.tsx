'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { formatDistanceToNowStrict } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowUpRight, ChevronDown, History, MessageCircle, RefreshCw, ShieldCheck, UserMinus, UserPlus } from 'lucide-react';
import { apiService } from '@/services/apiService';
import { socketService } from '@/services/socketService';
import { getAvatarUrl } from '@/lib/utils/avatar';
import type { Team, TeamActivity } from '@/stores/teamStore';
import styles from './TeamActivityWidget.module.css';

type LoadState = 'loading' | 'ready' | 'error';
type ActivityRange = 'all' | '7d' | '30d';
type TeamSummary = Pick<Team, 'id' | 'name' | 'color' | 'workspaceId'>;

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toLocaleUpperCase('es');
}

function eventTone(eventType?: string) {
  if (eventType === 'team.member.added') return '#66b69c';
  if (eventType === 'team.member.removed') return '#c77d91';
  if (eventType === 'team.member.role-changed') return '#94aee0';
  return '#a789d4';
}

function eventIcon(eventType?: string) {
  if (eventType === 'team.member.added') return <UserPlus size={9} />;
  if (eventType === 'team.member.removed') return <UserMinus size={9} />;
  if (eventType === 'team.member.role-changed') return <ShieldCheck size={9} />;
  return <History size={9} />;
}

function relativeTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : formatDistanceToNowStrict(date, { addSuffix: true, locale: es });
}

export function TeamActivityWidget({ workspaceId }: { workspaceId: string | null }) {
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [teamsState, setTeamsState] = useState<LoadState>('loading');
  const [teamsWorkspaceId, setTeamsWorkspaceId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [events, setEvents] = useState<TeamActivity[]>([]);
  const [eventsState, setEventsState] = useState<LoadState>('ready');
  const [eventsKey, setEventsKey] = useState('');
  const [range, setRange] = useState<ActivityRange>('all');
  const [reloadTeams, setReloadTeams] = useState(0);
  const [reloadEvents, setReloadEvents] = useState(0);
  const priorWorkspaceId = useRef<string | null>(null);
  const teamRequest = useRef(0);
  const activityRequest = useRef(0);

  const scopedTeams = teamsWorkspaceId === workspaceId ? teams : [];
  const selectedTeam = scopedTeams.find((team) => team.id === selectedTeamId);
  const currentEventsKey = selectedTeam ? `${workspaceId}:${selectedTeam.id}` : '';
  const visibleEvents = eventsKey === currentEventsKey ? events : [];
  const retry = useCallback(() => {
    setReloadTeams((value) => value + 1);
    setReloadEvents((value) => value + 1);
  }, []);
  const retryEvents = useCallback(() => setReloadEvents((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    const workspaceChanged = priorWorkspaceId.current !== workspaceId;
    priorWorkspaceId.current = workspaceId;
    const requestId = ++teamRequest.current;
    if (workspaceChanged) {
      setTeams([]);
      setTeamsWorkspaceId(workspaceId);
      setSelectedTeamId('');
      setEvents([]);
      setEventsKey('');
    }
    if (!workspaceId) {
      setTeamsState('ready');
      return () => { active = false; };
    }

    setTeamsState('loading');
    void apiService.get<{ teams: TeamSummary[] }>(`/api/teams?workspaceId=${encodeURIComponent(workspaceId)}`, true)
      .then((response) => {
        if (!active || requestId !== teamRequest.current) return;
        if (!response.success || !response.data) throw new Error(response.error?.message ?? 'No se pudieron cargar los equipos.');
        const nextTeams = response.data.teams ?? [];
        setTeams(nextTeams);
        setTeamsWorkspaceId(workspaceId);
        setSelectedTeamId((current) => nextTeams.some((team) => team.id === current) ? current : nextTeams[0]?.id ?? '');
        setTeamsState('ready');
      })
      .catch(() => { if (active && requestId === teamRequest.current) setTeamsState('error'); });

    return () => { active = false; };
  }, [workspaceId, reloadTeams]);

  useEffect(() => {
    let active = true;
    const requestId = ++activityRequest.current;
    if (!workspaceId || !selectedTeam) {
      setEvents([]);
      setEventsKey('');
      setEventsState('ready');
      return () => { active = false; };
    }

    const key = `${workspaceId}:${selectedTeam.id}`;
    setEventsState('loading');
    setEventsKey('');
    void apiService.get<{ events: TeamActivity[] }>(`/api/teams/${encodeURIComponent(selectedTeam.id)}/activity?limit=30`, true)
      .then((response) => {
        if (!active || requestId !== activityRequest.current) return;
        if (!response.success || !response.data) throw new Error(response.error?.message ?? 'No se pudo cargar la actividad.');
        setEvents(response.data.events ?? []);
        setEventsKey(key);
        setEventsState('ready');
      })
      .catch(() => { if (active && requestId === activityRequest.current) setEventsState('error'); });

    return () => { active = false; };
  }, [workspaceId, selectedTeam, reloadEvents]);

  useEffect(() => {
    if (!workspaceId) return;
    const roomOwner = `team-activity-widget:${workspaceId}`;
    const joinWorkspace = () => socketService.joinWorkspace(workspaceId, roomOwner);
    const onTeamChange = (event: { type?: string; context?: { workspaceId?: string } }) => {
      if (!event.type?.startsWith('team.') || event.context?.workspaceId !== workspaceId) return;
      retry();
    };
    joinWorkspace();
    socketService.onConnect(joinWorkspace);
    socketService.on('event', onTeamChange);
    return () => {
      socketService.offConnect(joinWorkspace);
      socketService.off('event', onTeamChange);
      socketService.leaveWorkspace(workspaceId, roomOwner);
    };
  }, [workspaceId, retry]);

  const cutoff = range === '7d' ? Date.now() - 7 * 24 * 60 * 60 * 1000
    : range === '30d' ? Date.now() - 30 * 24 * 60 * 60 * 1000
      : 0;
  const filteredEvents = visibleEvents.filter((event) => {
    const timestamp = new Date(event.createdAt).getTime();
    return Number.isFinite(timestamp) && (!cutoff || timestamp >= cutoff);
  });
  const shownEvents = filteredEvents.slice(0, 3);
  const isBusy = teamsState === 'loading' || eventsState === 'loading';

  function openChat(event: TeamActivity) {
    window.dispatchEvent(new CustomEvent('aether:open-chat', {
      detail: { id: event.userId, userId: event.userId, name: event.userName, avatar: event.userAvatar ?? null, position: 'Actividad del equipo' },
    }));
  }

  return <section className={styles.widget} style={{ '--team-tone': selectedTeam?.color || '#7655aa' } as React.CSSProperties} aria-label="Actividad del equipo" aria-busy={isBusy}>
    <header className={styles.header}>
      <div className={styles.titleLine}>
        <strong>Actividad del equipo</strong>
        {selectedTeam && <span className={styles.eventCount}>{eventsState === 'ready' ? filteredEvents.length : '…'}</span>}
      </div>
      {selectedTeam && <div className={styles.headerActions}>
        <Link className={styles.viewLink} href={`/dashboard/teams/${encodeURIComponent(selectedTeam.id)}`} title={`Abrir ${selectedTeam.name}`}>
          <span>Ver equipo</span><ArrowUpRight size={13} />
        </Link>
        <button className={styles.refreshButton} type="button" onClick={retry} disabled={isBusy} aria-label="Actualizar actividad del equipo" title="Actualizar">
          <RefreshCw size={13} />
        </button>
      </div>}
    </header>

    {teamsState === 'loading' && scopedTeams.length === 0 ? <div className={styles.loadingState} role="status" aria-label="Cargando actividad">
      <span /><span /><span />
    </div> : teamsState === 'error' && scopedTeams.length === 0 ? <div className={styles.recoveryState}>
      <span className={styles.recoveryMark}><RefreshCw size={14} /></span>
      <span><strong>No se pudo cargar la actividad</strong><small>Comprueba la conexión e inténtalo otra vez.</small></span>
      <button type="button" onClick={retry} aria-label="Reintentar actividad"><RefreshCw size={13} /></button>
    </div> : !workspaceId ? <ActivityEmptyState
      title="Elige un espacio de trabajo"
      detail="Al activar un espacio, aquí se reunirán los cambios de sus equipos."
      href="/dashboard/teams"
      action="Ver equipos"
    /> : scopedTeams.length === 0 ? <ActivityEmptyState
      title="Los cambios del equipo aparecerán aquí"
      detail="Entra o crea un equipo para seguir sus incorporaciones y cambios de rol."
      href="/dashboard/teams"
      action="Ver equipos"
    /> : !selectedTeam ? <div className={styles.loadingState} role="status" aria-label="Preparando actividad"><span /><span /><span /></div> : <>
      <div className={styles.toolbar}>
        <label className={styles.teamControl}>
          <span className={styles.teamStamp} style={{ background: `color-mix(in srgb, ${selectedTeam.color || '#7655aa'} 18%, var(--c-bg2))` }}>{initials(selectedTeam.name)}</span>
          <select aria-label="Equipo de actividad" value={selectedTeamId} onChange={(event) => setSelectedTeamId(event.target.value)}>
            {scopedTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
          <ChevronDown size={12} aria-hidden="true" />
        </label>
        <label className={styles.rangeControl}>
          <select aria-label="Período de actividad" value={range} onChange={(event) => setRange(event.target.value as ActivityRange)}>
            <option value="all">Todo</option>
            <option value="7d">7 días</option>
            <option value="30d">30 días</option>
          </select>
          <ChevronDown size={11} aria-hidden="true" />
        </label>
      </div>

      <div className={styles.activityList}>
        {eventsState === 'loading' ? <div className={styles.loadingState} role="status" aria-label="Cargando cambios"><span /><span /><span /></div>
          : eventsState === 'error' ? <div className={styles.recoveryState}>
            <span className={styles.recoveryMark}><RefreshCw size={14} /></span>
            <span><strong>No se pudo cargar la actividad</strong><small>El equipo sigue disponible; prueba de nuevo.</small></span>
            <button type="button" onClick={retryEvents} aria-label="Reintentar actividad"><RefreshCw size={13} /></button>
          </div>
          : shownEvents.length > 0 ? shownEvents.map((event, index) => {
            const avatarUrl = getAvatarUrl(event.userAvatar);
            const entityName = event.entityName && event.entityName !== selectedTeam.name ? event.entityName : '';
            return <div key={event.id} className={styles.activityRow} style={{ '--event-tone': eventTone(event.eventType), '--row-index': index } as React.CSSProperties}>
              <span className={styles.activityAvatar}>
                {avatarUrl ? <Image src={avatarUrl} alt="" width={29} height={29} unoptimized /> : initials(event.userName)}
                <span className={styles.eventBadge} aria-hidden="true">{eventIcon(event.eventType)}</span>
              </span>
              <span className={styles.activityCopy}>
                <span className={styles.activitySummary}><strong>{event.userName}</strong> {event.action}{entityName && <> <em>{entityName}</em></>}</span>
                <small>{relativeTime(event.createdAt)}{event.projectName ? ` · ${event.projectName}` : ''}</small>
              </span>
              <button className={styles.chatAction} type="button" onClick={() => openChat(event)} aria-label={`Escribir a ${event.userName}`} title={`Escribir a ${event.userName}`}>
                <MessageCircle size={13} />
              </button>
            </div>;
          }) : filteredEvents.length === 0 && visibleEvents.length > 0 ? <div className={styles.filteredEmpty}>
            <span>No hay cambios en este período.</span>
            <button type="button" onClick={() => setRange('all')}>Ver todo</button>
          </div> : <ActivityEmptyState
            compact
            title="Todavía no hay movimientos"
            detail="Las incorporaciones y cambios de rol aparecerán aquí."
            href={`/dashboard/teams/${encodeURIComponent(selectedTeam.id)}`}
            action="Abrir equipo"
          />}
        {eventsState === 'ready' && filteredEvents.length > shownEvents.length && <Link className={styles.moreLink} href={`/dashboard/teams/${encodeURIComponent(selectedTeam.id)}?section=activity`}>
          Ver historial <ArrowUpRight size={12} />
        </Link>}
      </div>
    </>}
  </section>;
}

function ActivityEmptyState({ title, detail, href, action, compact = false }: { title: string; detail: string; href: string; action: string; compact?: boolean }) {
  return <div className={`${styles.emptyState} ${compact ? styles.compactEmpty : ''}`}>
    <div className={styles.activitySketch} aria-hidden="true">
      <span className={styles.timelineTrack} />
      <span className={`${styles.timelineNode} ${styles.timelineNodeFirst}`}><UserPlus size={13} /></span>
      <span className={`${styles.timelineNode} ${styles.timelineNodeSecond}`}><ShieldCheck size={12} /></span>
      <span className={styles.timelineNodeLast}><History size={12} /></span>
    </div>
    <div className={styles.emptyCopy}>
      <strong>{title}</strong>
      <p>{detail}</p>
      <Link className={styles.emptyAction} href={href}>{action}<ArrowUpRight size={13} /></Link>
    </div>
  </div>;
}
