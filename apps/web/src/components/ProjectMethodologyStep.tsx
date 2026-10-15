'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Plus, Search, UsersRound } from 'lucide-react';
import { ProjectOptionSelect } from './ProjectOptionSelect';
import styles from './ProjectMethodologyStep.module.css';

export type ProjectParticipant = { id: string; name: string; email: string; role?: string };
export type ProjectTeamOption = { id: string; name: string; color?: string | null; members: ProjectParticipant[] };

export function ProjectMethodologyStep({
  methodology, onMethodologyChange, teams, members, teamIds, onTeamIdsChange,
  memberIds, onMemberIdsChange, productOwnerId, onProductOwnerChange,
  scrumMasterId, onScrumMasterChange, currentUserId, canCreateTeam,
  currentUser,
  supportsMethodology, supportsTeams, supportsMembers,
  createTeamHref, onLeaveForTeams, loading, loadError,
  onRetry,
}: {
  methodology: 'FLEXIBLE' | 'SCRUM';
  onMethodologyChange: (value: 'FLEXIBLE' | 'SCRUM') => void;
  teams: ProjectTeamOption[];
  members: ProjectParticipant[];
  teamIds: string[];
  onTeamIdsChange: (value: string[]) => void;
  memberIds: string[];
  onMemberIdsChange: (value: string[]) => void;
  productOwnerId: string;
  onProductOwnerChange: (value: string) => void;
  scrumMasterId: string;
  onScrumMasterChange: (value: string) => void;
  currentUserId: string;
  currentUser?: ProjectParticipant | null;
  canCreateTeam: boolean;
  supportsMethodology: boolean;
  supportsTeams: boolean;
  supportsMembers: boolean;
  createTeamHref: string;
  onLeaveForTeams: () => void;
  loading: boolean;
  loadError: string;
  onRetry: () => void;
}) {
  const [search, setSearch] = useState('');
  const participantIds = useMemo(() => new Set([
    currentUserId,
    ...memberIds,
    ...teams.filter((team) => teamIds.includes(team.id)).flatMap((team) => team.members.map((person) => person.id)),
  ]), [currentUserId, memberIds, teams, teamIds]);
  const participants = useMemo(() => {
    const peopleById = new Map<string, ProjectParticipant>();
    if (currentUser?.id === currentUserId && currentUserId) peopleById.set(currentUserId, currentUser);
    for (const person of members) {
      if (participantIds.has(person.id)) peopleById.set(person.id, person);
    }
    for (const team of teams) {
      if (!teamIds.includes(team.id)) continue;
      for (const person of team.members) {
        if (participantIds.has(person.id)) peopleById.set(person.id, person);
      }
    }
    return [...peopleById.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [currentUser, currentUserId, members, participantIds, teamIds, teams]);
  const developers = participants.filter((person) => person.id !== productOwnerId && person.id !== scrumMasterId);
  const filteredMembers = members.filter((person) => person.id !== currentUserId
    && `${person.name} ${person.email}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));

  return <div className={styles.root}>
    {supportsMethodology ? <div className={styles.methodology}>
      <label htmlFor="project-methodology">Enfoque del proyecto</label>
      <div className={styles.methodologySelect}><ProjectOptionSelect
        id="project-methodology" label="Enfoque del proyecto" value={methodology}
        onChange={(value) => onMethodologyChange(value as 'FLEXIBLE' | 'SCRUM')}
        menuZIndex={110} options={[{ value: 'FLEXIBLE', label: 'Flexible' }, { value: 'SCRUM', label: 'Scrum' }]}
      /></div>
      {methodology === 'SCRUM' ? <div className={styles.roleGuide} aria-label="Roles de Scrum">
        <p>Scrum organiza a quienes participan mediante estas responsabilidades:</p>
        <dl>
          <div><dt>Product Owner</dt><dd>Prioriza el Product Backlog, define el Product Goal y valida el valor entregado.</dd></div>
          <div><dt>Scrum Master</dt><dd>Facilita el proceso, ayuda a resolver impedimentos y acompaña las ceremonias.</dd></div>
          <div><dt>Developers</dt><dd>Construyen los incrementos, se autoorganizan y cuidan la calidad del trabajo.</dd></div>
        </dl>
      </div> : <p className={styles.methodDescription}>El equipo decide cómo organizarse. No se asignan roles metodológicos predefinidos.</p>}
    </div> : <p className={styles.methodDescription}>Este proyecto será personal y solo tú tendrás acceso.</p>}

    {loading ? <p className={styles.state}>Cargando equipos y personas del espacio…</p> : loadError ? <div className={styles.error} role="alert">{loadError} <button type="button" onClick={onRetry}>Volver a cargar</button></div> : <>
      {supportsTeams && <section className={styles.section} aria-labelledby="project-teams-title">
        <div className={styles.sectionHeader}>
          <div><h4 id="project-teams-title">Equipos disponibles</h4><p>Sus integrantes participarán en el proyecto.</p></div>
          {canCreateTeam && <Link href={createTeamHref} className={styles.textButton} onClick={onLeaveForTeams}><Plus size={14} /> Crear equipo</Link>}
        </div>
        {teams.length ? <div className={styles.teamList}>{teams.map((team) => <label key={team.id} className={`${styles.teamRow} ${teamIds.includes(team.id) ? styles.teamSelected : ''}`}>
          <input type="checkbox" checked={teamIds.includes(team.id)} onChange={(event) => onTeamIdsChange(event.target.checked ? [...teamIds, team.id] : teamIds.filter((id) => id !== team.id))} />
          <span className={styles.teamIcon} style={{ color: team.color ?? '#A885DD' }}><UsersRound size={17} /></span>
          <span className={styles.teamText}><strong>{team.name}</strong><small>{team.members.length} {team.members.length === 1 ? 'integrante' : 'integrantes'}</small></span>
          <span className={styles.checkbox}>{teamIds.includes(team.id) && <Check size={12} />}</span>
        </label>)}</div> : <p className={styles.empty}>Todavía no hay equipos disponibles en este espacio. {canCreateTeam ? 'Usa «Crear equipo» para configurarlo en Equipos.' : 'Un administrador puede crear uno; también puedes incluir personas individualmente.'}</p>}
        {teams.length > 0 && <p className={styles.note}>Para sumar personas a un equipo, abre su ficha en <Link href="/dashboard/teams" onClick={onLeaveForTeams}>Equipos</Link>. Las invitaciones se reflejan cuando sean aceptadas.</p>}
      </section>}

      {supportsMembers && <section className={styles.section} aria-labelledby="project-people-title">
        <div className={styles.sectionHeader}><div><h4 id="project-people-title">Personas individuales</h4><p>Personas del espacio que todavía no pertenecen a un equipo.</p></div></div>
        <label className={styles.search}><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre o correo" aria-label="Buscar personas del espacio" /></label>
        <div className={styles.memberList}>{filteredMembers.length ? filteredMembers.map((person) => <label key={person.id} className={styles.memberRow}>
          <input type="checkbox" checked={memberIds.includes(person.id)} onChange={(event) => onMemberIdsChange(event.target.checked ? [...memberIds, person.id] : memberIds.filter((id) => id !== person.id))} />
          <span><strong>{person.name}</strong><small>{person.email}</small></span>
          <span className={styles.checkbox}>{memberIds.includes(person.id) && <Check size={12} />}</span>
        </label>) : <p className={styles.empty}>{search ? 'No hay coincidencias.' : 'Todas las personas del espacio ya pertenecen a un equipo.'}</p>}</div>
      </section>}

      {supportsMethodology && methodology === 'SCRUM' && <section className={`${styles.section} ${styles.scrumSection}`} aria-labelledby="scrum-roles-title">
        <div className={styles.sectionHeader}><div><h4 id="scrum-roles-title">Responsabilidades de Scrum</h4><p>Elige dos personas distintas entre quienes participan. Tú también estás incluido.</p></div></div>
        <div className={styles.roles}>
          <div className={styles.roleSelect}><label htmlFor="project-product-owner"><strong>Product Owner</strong></label><ProjectOptionSelect id="project-product-owner" label="Product Owner" value={productOwnerId} onChange={onProductOwnerChange} menuZIndex={110} options={[{ value: '', label: 'Seleccionar persona' }, ...participants.map((person) => ({ value: person.id, label: person.name }))]} /></div>
          <div className={styles.roleSelect}><label htmlFor="project-scrum-master"><strong>Scrum Master</strong></label><ProjectOptionSelect id="project-scrum-master" label="Scrum Master" value={scrumMasterId} onChange={onScrumMasterChange} menuZIndex={110} options={[{ value: '', label: 'Seleccionar persona' }, ...participants.map((person) => ({ value: person.id, label: person.name }))]} /></div>
        </div>
        {productOwnerId && productOwnerId === scrumMasterId && <p className={styles.error} role="alert">Product Owner y Scrum Master deben ser personas distintas.</p>}
        {participants.length < 3 && <p className={styles.error}>Incluye al menos tres personas para asignar también a Developers.</p>}
        <div className={styles.developers}><strong>Developers — {developers.length}</strong><p>El resto del equipo construye los incrementos y cuida la calidad del trabajo.</p><span>{developers.length ? developers.map((person) => person.name).join(', ') : 'Se asignarán automáticamente al añadir más participantes.'}</span></div>
        <p className={styles.note}>Estas responsabilidades organizan este proyecto. Los permisos de acceso siguen siendo los del espacio y sus equipos.</p>
      </section>}
    </>}
  </div>;
}
