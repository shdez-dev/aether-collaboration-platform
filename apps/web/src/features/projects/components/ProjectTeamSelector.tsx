'use client';

import { useState } from 'react';
import { Check, Plus, Users, X } from 'lucide-react';
import type { ProjectTeam } from '@/features/projects/api';
import { C } from '@/lib/colors';
import { useT } from '@/lib/i18n';
import styles from './ProjectTeamSelector.module.css';

type Props = {
  assigned: ProjectTeam[];
  allTeams: ProjectTeam[];
  onAssign: (teamId: string) => Promise<void>;
  onRemove: (teamId: string) => Promise<void>;
};

export function ProjectTeamSelector({ assigned, allTeams, onAssign, onRemove }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const assignedIds = new Set(assigned.map((team) => team.id));
  const available = allTeams.filter((team) => !assignedIds.has(team.id));

  async function assign(teamId: string) {
    setLoading(teamId);
    try { await onAssign(teamId); } finally { setLoading(null); setOpen(false); }
  }

  async function remove(teamId: string) {
    setLoading(teamId);
    try { await onRemove(teamId); } finally { setLoading(null); }
  }

  return (
    <div className={styles.root}>
      {assigned.length > 0 && <div className={styles.assignedTeams}>
        {assigned.map((team) => (
          <div key={team.id} className={styles.assignedTeam} style={{ background: `${team.color ?? C.accent}15`, borderColor: `${team.color ?? C.accent}40`, color: team.color ?? C.accent }}>
            <span className={styles.assignedTeamDot} style={{ background: team.color ?? C.accent }} />
            <span className={styles.assignedTeamName}>{team.name}</span>
            {team.memberCount > 0 && <span className={styles.assignedTeamCount}>{team.memberCount}m</span>}
            <button type="button" onClick={() => remove(team.id)} disabled={loading === team.id} aria-label={`Quitar ${team.name}`} className={styles.removeAssignedTeam}>
              <X size={12} />
            </button>
          </div>
        ))}
      </div>}

      <div className={styles.selector}>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className={styles.trigger}
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <Plus size={14} aria-hidden="true" />
          {assigned.length === 0 ? t.projects_teams_assign : t.projects_teams_add}
        </button>

        {open && <>
          <button type="button" tabIndex={-1} aria-hidden="true" className={styles.backdrop} onClick={() => setOpen(false)} />
          <div className={styles.popover} role="dialog" aria-label="Equipos del espacio">
            <div className={styles.popoverHeader}>
              <span className={styles.popoverTitle}>Equipos del espacio</span>
              {available.length > 0 && <span className={styles.availableCount}>{available.length}</span>}
            </div>
            {available.length === 0 ? (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}><Users size={17} aria-hidden="true" /></span>
                <strong>{allTeams.length === 0 ? t.projects_teams_no_teams : t.projects_teams_all_assigned}</strong>
                <span>{allTeams.length === 0 ? 'Crea un equipo para compartir el acceso en conjunto.' : 'Ya asignaste todos los equipos disponibles.'}</span>
              </div>
            ) : available.map((team) => (
              <button type="button" key={team.id} onClick={() => assign(team.id)} disabled={loading === team.id} className={styles.teamOption}>
                <span className={styles.teamIcon} style={{ background: team.color ?? C.accent }}>
                  {team.name.trim()[0]?.toUpperCase()}
                </span>
                <span className={styles.teamOptionCopy}>
                  <span className={styles.teamOptionName}>{team.name}</span>
                  <span className={styles.teamOptionMembers}>{t.teams_members_count(team.memberCount)}</span>
                </span>
                {loading === team.id ? <span className={styles.spinner} aria-label="Asignando" /> : <Check size={14} className={styles.optionCheck} aria-hidden="true" />}
              </button>
            ))}
          </div>
        </>}
      </div>
    </div>
  );
}
