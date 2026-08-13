'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTeamStore, type Team } from '@/stores/teamStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useActiveWorkspaceStore } from '@/stores/activeWorkspaceStore';
import { markStepDone } from '@/lib/utils/onboardingGuide';
import { C } from '@/lib/colors';

const SORA = "'Sora', system-ui, sans-serif";
const MANROPE = "'Manrope', system-ui, sans-serif";
const COLOR_OPTIONS = ['#F2571E', '#76A878', '#4B607F', '#DB8A66', '#8C7C9E', '#C4A86E', '#7B8FA8', '#B85C5C'];

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function memberColor(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  return COLOR_OPTIONS[hash % COLOR_OPTIONS.length];
}

function TeamCard({ team, onOpen }: { team: Team; onOpen: () => void }) {
  const color = team.color || '#F2571E';
  const tint = `${color}22`;
  const members = (team.sampleMembers ?? []).slice(0, 3);
  const extraMembers = (team.memberCount ?? members.length) - members.length;

  return (
    <button
      type="button"
      onClick={onOpen}
      style={{ width: '100%', minWidth: 0, padding: '16px', textAlign: 'left', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', background: 'rgba(255,255,255,0.025)', color: 'inherit', fontFamily: MANROPE, transition: 'border-color .15s, background .15s, transform .15s' }}
      onMouseEnter={(event) => { event.currentTarget.style.borderColor = `${color}88`; event.currentTarget.style.background = 'rgba(255,255,255,0.05)'; event.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={(event) => { event.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; event.currentTarget.style.background = 'rgba(255,255,255,0.025)'; event.currentTarget.style.transform = 'none'; }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <span style={{ width: '40px', height: '40px', borderRadius: '50%', background: tint, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
            <circle cx="9" cy="8" r="3" stroke={color} strokeWidth="1.8" />
            <path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 6a3 3 0 0 1 0 6M18.5 19a5.5 5.5 0 0 0-3-4.9" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ color: '#E8E1D2', fontFamily: SORA, fontSize: '15px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team.name}</div>
          <div style={{ marginTop: '2px', color: '#827A6D', fontSize: '12px' }}>{team.memberCount ?? 0} {(team.memberCount ?? 0) === 1 ? 'miembro' : 'miembros'} · {team.projectCount ?? 0} proyectos</div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: '#827A6D', marginTop: '2px', flexShrink: 0 }}><path d="m9 18 6-6-6-6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>

      <p style={{ minHeight: '36px', margin: '12px 0 14px', color: '#9C9486', fontSize: '12.5px', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{team.description || 'Sin descripción'}</p>

      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', color: '#9C9486', fontSize: '11.5px', marginBottom: '12px' }}>
        <span><strong style={{ color: '#E8E1D2' }}>Líder:</strong> {team.leadName || 'Sin asignar'}</span>
        <span><strong style={{ color: '#E8E1D2' }}>Carga:</strong> {team.activeCards ?? 0} tarjetas activas</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {members.map((member, index) => (
            <span key={member.id} style={{ width: '29px', height: '29px', borderRadius: '50%', background: memberColor(member.id), border: '2px solid #191F33', marginLeft: index === 0 ? 0 : '-6px', display: 'grid', placeItems: 'center', color: '#24180A', fontSize: '10px', fontWeight: 700, zIndex: members.length - index }}>{initials(member.name)}</span>
          ))}
          {extraMembers > 0 && <span style={{ width: '29px', height: '29px', borderRadius: '50%', border: '1.5px dashed rgba(255,255,255,0.2)', marginLeft: '-6px', display: 'grid', placeItems: 'center', color: '#827A6D', fontSize: '10px' }}>+{extraMembers}</span>}
          {members.length === 0 && <span style={{ color: '#615846', fontSize: '12px' }}>Sin miembros</span>}
        </div>
        <span style={{ padding: '4px 8px', borderRadius: '999px', background: tint, color, fontSize: '11px', fontWeight: 700, letterSpacing: '.04em' }}>Equipo</span>
      </div>
    </button>
  );
}

function CreateTeamModal({ workspaceId, workspaces, onWorkspaceChange, onClose, onCreate }: {
  workspaceId: string;
  workspaces: Array<{ id: string; name: string; archived?: boolean }>;
  onWorkspaceChange: (workspaceId: string) => void;
  onClose: () => void;
  onCreate: (data: { workspaceId: string; name: string; description?: string; color: string }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COLOR_OPTIONS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const availableWorkspaces = workspaces.filter((workspace) => !workspace.archived);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      await onCreate({ workspaceId, name: name.trim(), description: description.trim() || undefined, color });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al crear equipo');
    } finally {
      setLoading(false);
    }
  }

  const fieldStyle = { padding: '9px 12px', borderRadius: '7px', background: '#242B43', border: '1px solid rgba(255,255,255,0.1)', color: '#E8E1D2', fontSize: '13.5px', outline: 'none', fontFamily: MANROPE };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,.65)' }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div style={{ width: '440px', maxWidth: '92vw', borderRadius: '12px', background: '#1A2035', border: '1px solid rgba(255,255,255,.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
          <span style={{ color: '#E8E1D2', fontFamily: SORA, fontSize: '14.5px', fontWeight: 600 }}>Nuevo equipo</span>
          <button type="button" onClick={onClose} style={{ padding: '2px', border: 0, background: 'none', color: '#827A6D', cursor: 'pointer' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg></button>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ color: '#827A6D', fontFamily: MANROPE, fontSize: '11.5px', fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase' }}>Espacio de trabajo</span>
            <select value={workspaceId} onChange={(event) => onWorkspaceChange(event.target.value)} disabled={!availableWorkspaces.length} style={{ ...fieldStyle, cursor: availableWorkspaces.length ? 'pointer' : 'not-allowed' }}>
              <option value="">{availableWorkspaces.length ? 'Selecciona un espacio de trabajo' : 'No tienes espacios de trabajo disponibles'}</option>
              {availableWorkspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ color: '#827A6D', fontFamily: MANROPE, fontSize: '11.5px', fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase' }}>Nombre</span>
            <input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Diseño, Desarrollo" style={fieldStyle} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ color: '#827A6D', fontFamily: MANROPE, fontSize: '11.5px', fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase' }}>Descripción <span style={{ opacity: .5 }}>(opcional)</span></span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="¿En qué se enfoca este equipo?" rows={2} style={{ ...fieldStyle, resize: 'none' }} />
          </label>
          <div>
            <div style={{ marginBottom: '8px', color: '#827A6D', fontFamily: MANROPE, fontSize: '11.5px', fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase' }}>Color</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>{COLOR_OPTIONS.map((option) => <button key={option} type="button" onClick={() => setColor(option)} style={{ width: '24px', height: '24px', borderRadius: '50%', border: 0, outline: color === option ? `2px solid ${option}` : 'none', outlineOffset: '2px', background: option, cursor: 'pointer', transform: color === option ? 'scale(1.15)' : 'none' }} />)}</div>
          </div>
          {error && <div style={{ padding: '9px 12px', borderRadius: '7px', color: '#ef4444', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', fontSize: '12.5px' }}>{error}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '4px' }}>
            <button type="button" onClick={onClose} style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: '#D8D0C1', cursor: 'pointer', fontFamily: SORA, fontSize: '13px' }}>Cancelar</button>
            <button type="submit" disabled={!name.trim() || !workspaceId || loading} style={{ padding: '9px 20px', borderRadius: '8px', border: 0, background: !name.trim() || !workspaceId || loading ? 'rgba(255,255,255,.07)' : '#F2571E', color: !name.trim() || !workspaceId || loading ? '#615846' : '#24180A', cursor: !name.trim() || !workspaceId || loading ? 'not-allowed' : 'pointer', fontFamily: SORA, fontSize: '13.5px', fontWeight: 600 }}>{loading ? 'Creando...' : 'Crear equipo'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TeamsPage() {
  const router = useRouter();
  const { teams, isLoading, fetchTeams, createTeam } = useTeamStore();
  const { currentWorkspace, workspaces, fetchWorkspaces } = useWorkspaceStore();
  const { activeWorkspaceId, setActiveWorkspaceId } = useActiveWorkspaceStore();
  const [showCreate, setShowCreate] = useState(false);
  const [workspaceFilter, setWorkspaceFilter] = useState('ALL');
  const workspaceId = activeWorkspaceId ?? currentWorkspace?.id ?? '';
  const activeWorkspaces = workspaces.filter((workspace) => !workspace.archived);
  const knownWorkspaceIds = new Set(workspaces.map((workspace) => workspace.id));
  const filteredWorkspaces = activeWorkspaces.filter((workspace) => workspaceFilter === 'ALL' || workspace.id === workspaceFilter);
  const visibleWorkspaces = filteredWorkspaces.filter((workspace) => workspaceFilter !== 'ALL' || teams.some((team) => team.workspaceId === workspace.id));
  const legacyTeams = teams.filter((team) => !team.workspaceId || !knownWorkspaceIds.has(team.workspaceId));

  useEffect(() => {
    if (!workspaces.length) fetchWorkspaces();
  }, [workspaces.length, fetchWorkspaces]);

  const loadTeams = useCallback(() => fetchTeams(), [fetchTeams]);
  useEffect(() => { loadTeams(); }, [loadTeams]);

  useEffect(() => {
    if (workspaceId && teams.some((team) => team.workspaceId === workspaceId)) {
      markStepDone('team');
    }
  }, [teams, workspaceId]);

  function selectFilter(id: string) {
    setWorkspaceFilter(id);
    if (id !== 'ALL') setActiveWorkspaceId(id);
  }

  async function handleCreate(data: { workspaceId: string; name: string; description?: string; color: string }) {
    setActiveWorkspaceId(data.workspaceId);
    const team = await createTeam(data);
    markStepDone('team');
    router.push(`/dashboard/teams/${team.id}`);
  }

  return (
    <div style={{ minHeight: '100%', padding: '0 clamp(20px, 4vw, 48px) 48px', background: C.bg }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', animation: 'fadeUp .4s ease both' }}>
        <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}`}</style>
        <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', paddingTop: '36px' }}>
          <div>
            <h1 style={{ margin: 0, color: '#F4EEE2', fontFamily: SORA, fontSize: 'clamp(1.7rem, 3vw, 2.2rem)', fontWeight: 700, letterSpacing: '-.02em' }}>Equipos</h1>
            <p style={{ margin: '7px 0 0', color: '#9C9486', fontFamily: MANROPE, fontSize: '1.02rem' }}>Encuentra y gestiona los equipos de tus espacios de trabajo.</p>
          </div>
          <button type="button" onClick={() => setShowCreate(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 16px', borderRadius: '8px', border: 0, background: '#F2571E', color: '#24180A', cursor: 'pointer', fontFamily: SORA, fontSize: '14px', fontWeight: 650 }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>Nuevo equipo</button>
        </header>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', margin: '28px 0 18px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '9px', color: '#9C9486', fontFamily: MANROPE, fontSize: '13px' }}>
            <span>Mostrar</span>
            <select value={workspaceFilter} onChange={(event) => selectFilter(event.target.value)} style={{ minWidth: '240px', padding: '9px 34px 9px 11px', borderRadius: '8px', border: '1px solid rgba(255,255,255,.13)', background: '#202740', color: '#E8E1D2', fontFamily: MANROPE, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              <option value="ALL">Todos los espacios ({teams.length} equipos)</option>
              {activeWorkspaces.map((workspace) => {
                const count = teams.filter((team) => team.workspaceId === workspace.id).length;
                return <option key={workspace.id} value={workspace.id}>{workspace.name} ({count} {count === 1 ? 'equipo' : 'equipos'})</option>;
              })}
            </select>
          </label>
          {workspaceFilter !== 'ALL' && <button type="button" onClick={() => selectFilter('ALL')} style={{ padding: '7px 0', border: 0, background: 'transparent', color: '#F57A4A', cursor: 'pointer', fontFamily: MANROPE, fontSize: '12.5px', fontWeight: 600 }}>Ver todos</button>}
        </div>

        {isLoading ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: '70px 0' }}><div style={{ width: '24px', height: '24px', borderRadius: '50%', border: '2px solid rgba(255,255,255,.1)', borderTopColor: '#F2571E', animation: 'spin .6s linear infinite' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {visibleWorkspaces.map((workspace) => {
              const workspaceTeams = teams.filter((team) => team.workspaceId === workspace.id);
              return (
                <section key={workspace.id} style={{ overflow: 'hidden', border: '1px solid rgba(255,255,255,.08)', borderRadius: '11px', background: 'rgba(255,255,255,.018)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <span style={{ width: '10px', height: '10px', flexShrink: 0, borderRadius: '50%', background: workspace.color ?? '#F2571E', boxShadow: `0 0 0 4px ${workspace.color ?? '#F2571E'}22` }} />
                      <div style={{ minWidth: 0 }}><div style={{ overflow: 'hidden', color: '#E8E1D2', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: SORA, fontSize: '14px', fontWeight: 600 }}>{workspace.name}</div><div style={{ marginTop: '2px', color: '#827A6D', fontFamily: MANROPE, fontSize: '12px' }}>{workspaceTeams.length} {workspaceTeams.length === 1 ? 'equipo' : 'equipos'}</div></div>
                    </div>
                    <button type="button" onClick={() => { setActiveWorkspaceId(workspace.id); setShowCreate(true); }} style={{ flexShrink: 0, padding: '6px 9px', borderRadius: '7px', border: '1px solid rgba(255,255,255,.11)', background: 'transparent', color: '#D8D0C1', cursor: 'pointer', fontFamily: MANROPE, fontSize: '12px', fontWeight: 600 }}>+ Equipo</button>
                  </div>
                  {workspaceTeams.length ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', padding: '12px' }}>{workspaceTeams.map((team) => <TeamCard key={team.id} team={team} onOpen={() => router.push(`/dashboard/teams/${team.id}`)} />)}</div> : <div style={{ padding: '22px 16px', color: '#827A6D', fontFamily: MANROPE, fontSize: '13px' }}>Aún no hay equipos en este espacio.</div>}
                </section>
              );
            })}
            {workspaceFilter === 'ALL' && legacyTeams.length > 0 && <section style={{ padding: '14px', border: '1px dashed rgba(255,255,255,.13)', borderRadius: '11px' }}><div style={{ marginBottom: '10px', color: '#9C9486', fontFamily: SORA, fontSize: '13px' }}>Equipos sin espacio asignado</div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>{legacyTeams.map((team) => <TeamCard key={team.id} team={team} onOpen={() => router.push(`/dashboard/teams/${team.id}`)} />)}</div></section>}
            {visibleWorkspaces.length === 0 && legacyTeams.length === 0 && <div style={{ padding: '50px 0', textAlign: 'center', color: '#827A6D', fontFamily: MANROPE }}>No hay equipos para mostrar.</div>}
          </div>
        )}
      </div>

      {showCreate && <CreateTeamModal workspaceId={workspaceId} workspaces={workspaces} onWorkspaceChange={setActiveWorkspaceId} onClose={() => setShowCreate(false)} onCreate={handleCreate} />}
    </div>
  );
}
