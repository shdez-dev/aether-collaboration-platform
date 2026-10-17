'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, ChevronDown, MessageCircle, RefreshCw, UserRound, UserRoundPlus, UsersRound } from 'lucide-react';
import { apiService } from '@/services/apiService';
import { socketService } from '@/services/socketService';
import { getAvatarUrl } from '@/lib/utils/avatar';
import type { Team, TeamMember } from '@/stores/teamStore';
import styles from './TeamMembersWidget.module.css';

type LoadState = 'loading' | 'ready' | 'error';
type TeamSummary = Pick<Team, 'id' | 'name' | 'color' | 'memberCount' | 'workspaceId'>;

function roleName(role: TeamMember['role']) {
  if (role === 'ADMIN') return 'Admin';
  if (role === 'VIEWER') return 'Solo lectura';
  return 'Miembro';
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toLocaleUpperCase('es');
}

function colorFor(id: string) {
  const colors = ['#7655aa', '#4d9a84', '#6987b8', '#b77b64', '#9273a8'];
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  return colors[hash % colors.length];
}

function RosterEmptyState({ title, detail, href, action }: { title: string; detail: string; href: string; action: string }) {
  return <div className={styles.emptyState}>
    <div className={styles.memberSketch} aria-hidden="true">
      <span className={styles.sketchOrbit} />
      <span className={`${styles.sketchPerson} ${styles.sketchLead}`}><UsersRound size={18} /></span>
      <span className={`${styles.sketchPerson} ${styles.sketchSecond}`}><UserRound size={13} /></span>
      <span className={styles.sketchAdd}><UserRoundPlus size={14} /></span>
    </div>
    <div className={styles.emptyCopy}>
      <strong>{title}</strong>
      <p>{detail}</p>
      <Link className={styles.emptyAction} href={href}>{action}<ArrowUpRight size={13} /></Link>
    </div>
  </div>;
}

export function TeamMembersWidget({ workspaceId }: { workspaceId: string | null }) {
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [teamsState, setTeamsState] = useState<LoadState>('loading');
  const [teamsWorkspaceId, setTeamsWorkspaceId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [membersState, setMembersState] = useState<LoadState>('ready');
  const [membersKey, setMembersKey] = useState('');
  const [reloadTeams, setReloadTeams] = useState(0);
  const [reloadMembers, setReloadMembers] = useState(0);
  const priorWorkspaceId = useRef<string | null>(null);
  const teamRequest = useRef(0);
  const memberRequest = useRef(0);

  const scopedTeams = teamsWorkspaceId === workspaceId ? teams : [];
  const selectedTeam = scopedTeams.find((team) => team.id === selectedTeamId);
  const currentMembersKey = selectedTeam ? `${workspaceId}:${selectedTeam.id}` : '';
  const visibleMembers = membersKey === currentMembersKey ? members : [];
  const retry = useCallback(() => {
    setReloadTeams((value) => value + 1);
    setReloadMembers((value) => value + 1);
  }, []);
  const retryMembers = useCallback(() => setReloadMembers((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    const workspaceChanged = priorWorkspaceId.current !== workspaceId;
    priorWorkspaceId.current = workspaceId;
    const requestId = ++teamRequest.current;
    if (workspaceChanged) {
      setTeams([]);
      setTeamsWorkspaceId(workspaceId);
      setSelectedTeamId('');
      setMembers([]);
      setMembersKey('');
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
    const requestId = ++memberRequest.current;
    if (!workspaceId || !selectedTeam || selectedTeam.workspaceId !== workspaceId) {
      setMembers([]);
      setMembersKey('');
      setMembersState('ready');
      return () => { active = false; };
    }

    const key = `${workspaceId}:${selectedTeam.id}`;
    setMembersState('loading');
    setMembersKey('');
    void apiService.get<{ members: TeamMember[] }>(`/api/teams/${encodeURIComponent(selectedTeam.id)}/members`, true)
      .then((response) => {
        if (!active || requestId !== memberRequest.current) return;
        if (!response.success || !response.data) throw new Error(response.error?.message ?? 'No se pudieron cargar los miembros.');
        setMembers(response.data.members ?? []);
        setMembersKey(key);
        setMembersState('ready');
      })
      .catch(() => { if (active && requestId === memberRequest.current) setMembersState('error'); });

    return () => { active = false; };
  }, [workspaceId, selectedTeam, reloadMembers]);

  useEffect(() => {
    if (!workspaceId) return;
    const roomOwner = `team-members-widget:${workspaceId}`;
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

  const shownMembers = visibleMembers.slice(0, 3);
  const teamCount = selectedTeam?.memberCount ?? visibleMembers.length;
  const isBusy = teamsState === 'loading' || membersState === 'loading';

  function openChat(member: TeamMember) {
    window.dispatchEvent(new CustomEvent('aether:open-chat', {
      detail: { id: member.id, userId: member.id, name: member.name, avatar: member.avatar ?? null, position: roleName(member.role) },
    }));
  }

  return <section className={styles.widget} style={{ '--team-tone': selectedTeam?.color || '#7655aa' } as React.CSSProperties} aria-label="Miembros del equipo" aria-busy={isBusy}>
    <header className={styles.header}>
      <div className={styles.titleLine}>
        <strong>Miembros del equipo</strong>
        {selectedTeam && <span className={styles.memberCount}>{teamCount}</span>}
      </div>
      <div className={styles.headerActions}>
        {selectedTeam && <Link className={styles.viewLink} href={`/dashboard/teams/${encodeURIComponent(selectedTeam.id)}`} title={`Abrir ${selectedTeam.name}`}>
          <span>Ver equipo</span><ArrowUpRight size={13} />
        </Link>}
        {selectedTeam && <button className={styles.refreshButton} type="button" onClick={retry} disabled={isBusy} aria-label="Actualizar miembros" title="Actualizar">
          <RefreshCw size={13} />
        </button>}
      </div>
    </header>

    {teamsState === 'loading' && scopedTeams.length === 0 ? <div className={styles.loadingState} role="status" aria-label="Cargando equipos">
      <span /><span /><span />
    </div> : teamsState === 'error' && scopedTeams.length === 0 ? <div className={styles.emptyState}>
      <span className={styles.emptyMark}><RefreshCw size={15} /></span>
      <span className={styles.emptyCopy}><strong>No se pudieron cargar los equipos</strong><p>Comprueba la conexión e inténtalo otra vez.</p></span>
      <button type="button" onClick={retry} aria-label="Reintentar carga de equipos"><RefreshCw size={13} /></button>
    </div> : !workspaceId ? <RosterEmptyState
      title="Elige un espacio de trabajo"
      detail="Al seleccionar un espacio, aquí verás sus equipos y las personas que los forman."
      href="/dashboard/teams"
      action="Ver equipos"
    /> : scopedTeams.length === 0 ? <RosterEmptyState
      title="Tu equipo aparecerá aquí"
      detail="Entra o crea un equipo para tener a sus integrantes y sus chats a mano."
      href="/dashboard/teams"
      action="Ver equipos"
    /> : <>
      <div className={styles.teamControl}>
        <span className={styles.teamStamp} style={{ background: `color-mix(in srgb, ${selectedTeam?.color || '#7655aa'} 18%, var(--c-bg2))` }}>{initials(selectedTeam?.name ?? '')}</span>
        <select aria-label="Equipo visible" value={selectedTeamId} onChange={(event) => setSelectedTeamId(event.target.value)}>
          {scopedTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
        </select>
        <ChevronDown size={13} aria-hidden="true" />
      </div>
      <div className={styles.roster}>
        {membersState === 'loading' ? <div className={styles.loadingState} role="status" aria-label="Cargando miembros"><span /><span /><span /></div>
          : membersState === 'error' ? <div className={styles.emptyState}>
            <span className={styles.emptyCopy}><strong>No se pudieron cargar los miembros</strong><p>El equipo sigue disponible; prueba de nuevo.</p></span>
            <button type="button" onClick={retryMembers} aria-label="Reintentar miembros"><RefreshCw size={13} /></button>
          </div>
          : shownMembers.length ? shownMembers.map((member, index) => {
            const avatarUrl = getAvatarUrl(member.avatar);
            return <button key={member.id} className={styles.memberRow} type="button" onClick={() => openChat(member)} title={`Abrir chat con ${member.name}`} style={{ '--member-color': colorFor(member.id), '--row-index': index } as React.CSSProperties}>
              <span className={styles.avatar}>
                {avatarUrl ? <Image src={avatarUrl} alt="" width={30} height={30} unoptimized /> : initials(member.name)}
              </span>
              <span className={styles.memberCopy}><strong>{member.name}</strong><small>{roleName(member.role)}</small></span>
              <span className={styles.chatAction} aria-hidden="true"><MessageCircle size={14} /></span>
            </button>;
          }) : <RosterEmptyState
            title="Invita a las personas del equipo"
            detail="Sus perfiles y accesos al chat aparecerán en esta lista."
            href={selectedTeam ? `/dashboard/teams/${encodeURIComponent(selectedTeam.id)}` : '/dashboard/teams'}
            action="Abrir equipo"
          />}
        {membersState === 'ready' && visibleMembers.length > shownMembers.length && selectedTeam && <Link className={styles.moreLink} href={`/dashboard/teams/${encodeURIComponent(selectedTeam.id)}`}>
          Ver todas las personas <ArrowUpRight size={12} />
        </Link>}
      </div>
    </>}
  </section>;
}
