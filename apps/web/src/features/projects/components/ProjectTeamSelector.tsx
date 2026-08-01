'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { ProjectTeam } from '@/features/projects/api';
import { C } from '@/lib/colors';
import { useT } from '@/lib/i18n';

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
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      {assigned.map((team) => (
        <div key={team.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px 4px 8px', borderRadius: '6px', fontSize: '12.5px', background: `${team.color ?? C.accent}15`, border: `1px solid ${team.color ?? C.accent}40`, color: team.color ?? C.accent }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: team.color ?? C.accent, flexShrink: 0 }} />
          <span style={{ fontWeight: 600 }}>{team.name}</span>
          {team.memberCount > 0 && <span style={{ fontSize: '11px', opacity: 0.65 }}>{team.memberCount}m</span>}
          <button type="button" onClick={() => remove(team.id)} disabled={loading === team.id} aria-label={`Quitar ${team.name}`}
            style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: '1px', color: 'inherit', opacity: 0.6, marginLeft: '2px' }}>
            <X size={10} />
          </button>
        </div>
      ))}

      <div style={{ position: 'relative' }}>
        <button type="button" onClick={() => setOpen((value) => !value)}
          style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 12px', borderRadius: '6px', fontSize: '12.5px', fontWeight: 500, background: C.surface, border: `1px solid ${C.border2}`, color: C.text2, cursor: 'pointer' }}>
          <Plus size={11} />
          {assigned.length === 0 ? t.projects_teams_assign : t.projects_teams_add}
        </button>

        {open && <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 50, background: C.surface, border: `1px solid ${C.border2}`, borderRadius: '8px', minWidth: '220px', maxHeight: '240px', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.45)' }}>
            {available.length === 0 ? (
              <div style={{ padding: '14px 16px', fontSize: '12.5px', color: C.text4 }}>{allTeams.length === 0 ? t.projects_teams_no_teams : t.projects_teams_all_assigned}</div>
            ) : available.map((team) => (
              <button type="button" key={team.id} onClick={() => assign(team.id)} disabled={loading === team.id}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', color: C.text2, fontSize: '13px', textAlign: 'left' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: team.color ?? C.accent, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 500 }}>{team.name}</span>
                  {team.memberCount > 0 && <span style={{ display: 'block', fontSize: '11px', color: C.text4 }}>{t.teams_members_count(team.memberCount)}</span>}
                </span>
                {loading === team.id && <svg className="animate-spin" viewBox="0 0 16 16" fill="none" width="12" height="12"><circle cx="8" cy="8" r="6" stroke={C.accent} strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" /></svg>}
              </button>
            ))}
          </div>
        </>}
      </div>
    </div>
  );
}
