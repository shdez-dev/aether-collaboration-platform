'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTeamStore, type Team } from '@/stores/teamStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useActiveWorkspaceStore } from '@/stores/activeWorkspaceStore';
import { useAuthStore } from '@/stores/authStore';
import { apiService } from '@/services/apiService';
import { C } from '@/lib/colors';

const SORA   = "'Sora', system-ui, sans-serif";
const MANROPE = "'Manrope', system-ui, sans-serif";

// Deterministic color from string
const MEMBER_COLORS = ['#F2571E','#76A878','#4B607F','#DB8A66','#8C7C9E','#C4A86E','#7B8FA8','#B85C5C'];
function memberColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return MEMBER_COLORS[h % MEMBER_COLORS.length];
}
function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
}
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000), h = Math.floor(diff / 3600000), d = Math.floor(diff / 86400000);
  if (m < 1) return 'ahora'; if (m < 60) return `hace ${m}m`;
  if (h < 24) return `hace ${h}h`; if (d < 30) return `hace ${d}d`;
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

// ── Team card ─────────────────────────────────────────────────────────────────
function TeamCard({ team, onClick }: { team: Team; onClick: () => void }) {
  const color = team.color || '#F2571E';
  const tint  = `${color}22`;
  const sample = team.sampleMembers ?? [];
  const shown  = sample.slice(0, 3);
  const extra  = (team.memberCount ?? sample.length) - shown.length;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{ minWidth: 0, width: '100%', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', background: 'rgba(255,255,255,0.025)', padding: '16px', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s, background 0.15s, transform 0.15s', fontFamily: MANROPE }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = `${color}88`; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.025)'; (e.currentTarget as HTMLElement).style.transform = 'none'; }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <span style={{ width: '40px', height: '40px', borderRadius: '50%', background: tint, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
            <circle cx="9" cy="8" r="3" stroke={color} strokeWidth="1.8"/>
            <path d="M3.5 19a5.5 5.5 0 0 1 11 0" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M16 6a3 3 0 0 1 0 6M18.5 19a5.5 5.5 0 0 0-3-4.9" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: SORA, fontSize: '15px', fontWeight: 600, color: '#E8E1D2' }}>{team.name}</div>
          <div style={{ fontSize: '12px', color: '#827A6D', marginTop: '2px' }}>
            {team.memberCount ?? 0} {(team.memberCount ?? 0) === 1 ? 'miembro' : 'miembros'}
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: '#827A6D', marginTop: '2px', flexShrink: 0 }}><path d="m9 18 6-6-6-6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </div>

      {team.description && <p style={{ margin: '12px 0 14px', color: '#9C9486', fontSize: '12.5px', lineHeight: 1.45, minHeight: '36px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{team.description}</p>}
      {!team.description && <div style={{ height: '14px' }} />}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
        {shown.map((m, i) => {
          const c = memberColor(m.id);
          return (
            <span key={m.id} style={{ width: '30px', height: '30px', borderRadius: '50%', background: c, border: '2px solid #191F33', marginLeft: i === 0 ? 0 : '-6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#24180A', zIndex: shown.length - i }}>
              {initials(m.name)}
            </span>
          );
        })}
        {extra > 0 && (
          <span style={{ width: '30px', height: '30px', borderRadius: '50%', border: '1.5px dashed rgba(255,255,255,0.2)', marginLeft: '-6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#827A6D', fontSize: '11px' }}>
            +{extra}
          </span>
        )}
        {shown.length === 0 && (
          <span style={{ fontSize: '12px', color: '#615846' }}>Sin miembros</span>
        )}
        </div>
        <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', color, background: tint, borderRadius: '999px', padding: '4px 8px' }}>Equipo</span>
      </div>
    </button>
  );
}

// ── Create Team Modal ─────────────────────────────────────────────────────────
const COLOR_OPTIONS = ['#F2571E','#76A878','#4B607F','#DB8A66','#8C7C9E','#C4A86E','#7B8FA8','#B85C5C'];

function CreateTeamModal({ workspaceId, workspaces, onWorkspaceChange, onClose, onCreate }: {
  workspaceId: string;
  workspaces: Array<{ id: string; name: string; archived?: boolean }>;
  onWorkspaceChange: (workspaceId: string) => void;
  onClose: () => void;
  onCreate: (data: { workspaceId: string; name: string; description?: string; color: string }) => Promise<void>;
}) {
  const [name, setName]     = useState('');
  const [desc, setDesc]     = useState('');
  const [color, setColor]   = useState(COLOR_OPTIONS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const availableWorkspaces = workspaces.filter((workspace) => !workspace.archived);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !workspaceId) return;
    setLoading(true); setError(null);
    try { await onCreate({ workspaceId, name: name.trim(), description: desc.trim() || undefined, color }); onClose(); }
    catch (err: any) { setError(err.message || 'Error al crear equipo'); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#1A2035', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', width: '440px', maxWidth: '92vw' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <span style={{ fontFamily: SORA, fontSize: '14.5px', fontWeight: 600, color: '#E8E1D2' }}>Nuevo equipo</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#827A6D', cursor: 'pointer', display: 'flex', padding: '2px' }} onMouseEnter={(e) => (e.currentTarget.style.color = '#E8E1D2')} onMouseLeave={(e) => (e.currentTarget.style.color = '#827A6D')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor="team-workspace" style={{ fontSize: '11.5px', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#827A6D', fontFamily: MANROPE }}>Espacio de trabajo</label>
            <select
              id="team-workspace"
              value={workspaceId}
              onChange={(e) => onWorkspaceChange(e.target.value)}
              disabled={availableWorkspaces.length === 0}
              style={{ padding: '9px 12px', borderRadius: '7px', background: '#242B43', border: '1px solid rgba(255,255,255,0.1)', color: workspaceId ? '#E8E1D2' : '#827A6D', fontSize: '13.5px', outline: 'none', fontFamily: MANROPE, cursor: availableWorkspaces.length ? 'pointer' : 'not-allowed' }}
            >
              <option value="">{availableWorkspaces.length ? 'Selecciona un espacio de trabajo' : 'No tienes espacios de trabajo disponibles'}</option>
              {availableWorkspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
              ))}
            </select>
            <span style={{ fontSize: '12px', color: '#827A6D', fontFamily: MANROPE }}>El equipo y sus miembros quedarán organizados dentro de este espacio.</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11.5px', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#827A6D', fontFamily: MANROPE }}>Nombre</label>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Diseño, Desarrollo…"
              style={{ padding: '8px 12px', borderRadius: '7px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#E8E1D2', fontSize: '13.5px', outline: 'none', fontFamily: MANROPE, transition: 'border-color 0.12s' }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.28)')} onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11.5px', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#827A6D', fontFamily: MANROPE }}>Descripción <span style={{ opacity: 0.5 }}>(opcional)</span></label>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="¿En qué se enfoca este equipo?" rows={2}
              style={{ padding: '8px 12px', borderRadius: '7px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#E8E1D2', fontSize: '13.5px', outline: 'none', fontFamily: MANROPE, resize: 'none', transition: 'border-color 0.12s' }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.28)')} onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '11.5px', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#827A6D', fontFamily: MANROPE }}>Color</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {COLOR_OPTIONS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  style={{ width: '24px', height: '24px', borderRadius: '50%', background: c, border: 'none', cursor: 'pointer', outline: color === c ? `2px solid ${c}` : 'none', outlineOffset: '2px', transition: 'transform 0.12s', transform: color === c ? 'scale(1.15)' : 'scale(1)' }} />
              ))}
            </div>
          </div>
          {error && <div style={{ padding: '9px 12px', borderRadius: '7px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', fontSize: '12.5px', color: '#ef4444' }}>{error}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '4px' }}>
            <button type="button" onClick={onClose} style={{ padding: '9px 16px', borderRadius: '8px', fontSize: '13px', background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#D8D0C1', cursor: 'pointer', fontFamily: SORA }} onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}>Cancelar</button>
            <button type="submit" disabled={!name.trim() || !workspaceId || loading}
              style={{ padding: '9px 20px', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, background: !name.trim() || !workspaceId || loading ? 'rgba(255,255,255,0.07)' : '#F2571E', color: !name.trim() || !workspaceId || loading ? '#615846' : '#24180A', border: 'none', cursor: !name.trim() || !workspaceId || loading ? 'not-allowed' : 'pointer', fontFamily: SORA, transition: 'filter 0.12s' }}
              onMouseEnter={(e) => { if (name.trim() && workspaceId && !loading) (e.currentTarget as HTMLElement).style.filter = 'brightness(1.08)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.filter = ''; }}
            >{loading ? 'Creando…' : 'Crear equipo'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Invite Member Modal ───────────────────────────────────────────────────────
function InviteMemberModal({ workspaceId, onClose, onInvited }: { workspaceId: string; onClose: () => void; onInvited: () => void }) {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true); setError(null);
    try {
      const r = await apiService.post(`/api/workspaces/${workspaceId}/invite`, { email: email.trim(), role: 'MEMBER' }, true);
      if ((r as any).success) { setSuccess(true); onInvited(); setTimeout(onClose, 1200); }
      else setError((r as any).error?.message || 'No se pudo enviar la invitación');
    } catch (err: any) { setError(err.message || 'Error al invitar'); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#1A2035', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', width: '420px', maxWidth: '92vw' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <span style={{ fontFamily: SORA, fontSize: '14.5px', fontWeight: 600, color: '#E8E1D2' }}>Invitar a alguien</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#827A6D', cursor: 'pointer' }} onMouseEnter={(e) => (e.currentTarget.style.color = '#E8E1D2')} onMouseLeave={(e) => (e.currentTarget.style.color = '#827A6D')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>
        <form onSubmit={submit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {success ? (
            <div style={{ textAlign: 'center', padding: '16px 0', color: '#76A878', fontFamily: MANROPE, fontSize: '14px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ display: 'block', margin: '0 auto 10px' }}><path d="M5 13l4 4L19 7" stroke="#76A878" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Invitación enviada
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#827A6D', fontFamily: MANROPE }}>Correo electrónico</label>
                <input autoFocus type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@empresa.com"
                  style={{ padding: '9px 12px', borderRadius: '7px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#E8E1D2', fontSize: '13.5px', outline: 'none', fontFamily: MANROPE, transition: 'border-color 0.12s' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.28)')} onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')} />
              </div>
              {error && <div style={{ padding: '8px 12px', borderRadius: '7px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', fontSize: '12.5px', color: '#ef4444' }}>{error}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={onClose} style={{ padding: '9px 16px', borderRadius: '8px', fontSize: '13px', background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#D8D0C1', cursor: 'pointer', fontFamily: SORA }} onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}>Cancelar</button>
                <button type="submit" disabled={!email.trim() || loading}
                  style={{ padding: '9px 20px', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, background: !email.trim() || loading ? 'rgba(255,255,255,0.07)' : '#F2571E', color: !email.trim() || loading ? '#615846' : '#24180A', border: 'none', cursor: !email.trim() || loading ? 'not-allowed' : 'pointer', fontFamily: SORA }}
                >{loading ? 'Enviando…' : 'Enviar invitación'}</button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TeamsPage() {
  const router = useRouter();
  const { teams, isLoading, fetchTeams, createTeam } = useTeamStore();
  const { currentWorkspace, currentMembers, fetchMembers, workspaces, fetchWorkspaces } = useWorkspaceStore();
  const { activeWorkspaceId, setActiveWorkspaceId } = useActiveWorkspaceStore();
  const currentUser = useAuthStore((s) => s.user);

  const [showCreate, setShowCreate]   = useState(false);
  const [showInvite, setShowInvite]   = useState(false);
  const [workspaceFilter, setWorkspaceFilter] = useState<string>('ALL');
  const [pendingInvites, setPendingInvites] = useState<{ id: string; email: string; sentAt: string }[]>([]);

  const workspaceId = activeWorkspaceId ?? currentWorkspace?.id ?? '';

  useEffect(() => {
    if (workspaces.length === 0) fetchWorkspaces();
  }, [workspaces.length, fetchWorkspaces]);

  const loadData = useCallback(async () => {
    if (!workspaceId) {
      setPendingInvites([]);
      return;
    }
    fetchTeams();
    fetchMembers(workspaceId);
    const r = await apiService.get<{ invitations: { id: string; email: string; sentAt: string }[] }>(
      `/api/workspaces/${workspaceId}/pending-invitations`, true
    );
    setPendingInvites(r.success && r.data ? r.data.invitations : []);
  }, [workspaceId, fetchTeams, fetchMembers]);

  useEffect(() => { loadData(); }, [loadData]);

  const onlineMembers = currentMembers.filter((m) => (m as any).online);
  const totalMembers  = currentMembers.length;
  const visibleWorkspaces = workspaces
    .filter((workspace) => !workspace.archived)
    .filter((workspace) => workspaceFilter === 'ALL' || workspace.id === workspaceFilter);
  const knownWorkspaceIds = new Set(workspaces.map((workspace) => workspace.id));
  const unassignedTeams = teams.filter((team) => !team.workspaceId || !knownWorkspaceIds.has(team.workspaceId));
  const totalTeamMembers = teams.reduce((total, team) => total + (team.memberCount ?? 0), 0);

  function selectWorkspaceFilter(id: string) {
    setWorkspaceFilter(id);
    if (id !== 'ALL') setActiveWorkspaceId(id);
  }

  async function handleCreate(data: { workspaceId: string; name: string; description?: string; color: string }) {
    if (!data.workspaceId) throw new Error('Selecciona un espacio de trabajo antes de crear un equipo');
    setActiveWorkspaceId(data.workspaceId);
    const team = await createTeam(data);
    router.push(`/dashboard/teams/${team.id}`);
  }

  return (
    <div style={{ minHeight: '100%', background: C.bg, padding: '0 clamp(20px,4vw,48px)', paddingBottom: '48px' }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}`}</style>
      <div style={{ maxWidth: '900px', margin: '0 auto', animation: 'fadeUp .4s ease both' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', padding: '36px 0 0' }}>
          <div>
            <h1 style={{ fontFamily: SORA, fontWeight: 700, fontSize: 'clamp(1.7rem,3vw,2.2rem)', letterSpacing: '-0.02em', color: '#F4EEE2', margin: 0 }}>Equipo</h1>
            <p style={{ margin: '7px 0 0', fontSize: '1.02rem', color: '#9C9486', fontFamily: MANROPE }}>Equipos organizados por cada espacio de trabajo.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => setShowCreate(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.14)', background: 'transparent', color: '#D8D0C1', fontFamily: SORA, fontWeight: 600, fontSize: '14px', cursor: 'pointer', transition: 'background 0.12s' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
              Nuevo equipo
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: '10px', marginTop: '26px' }}>
          {[
            { label: 'Espacios activos', value: visibleWorkspaces.length },
            { label: 'Equipos', value: teams.length },
            { label: 'Personas en equipos', value: totalTeamMembers },
          ].map((metric) => (
            <div key={metric.label} style={{ padding: '13px 14px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9px', background: 'rgba(255,255,255,0.025)' }}>
              <div style={{ fontFamily: SORA, color: '#E8E1D2', fontWeight: 650, fontSize: '20px' }}>{metric.value}</div>
              <div style={{ marginTop: '3px', color: '#827A6D', fontSize: '11.5px', fontFamily: MANROPE }}>{metric.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '20px 0 3px' }}>
          <button type="button" onClick={() => selectWorkspaceFilter('ALL')} style={{ flexShrink: 0, padding: '7px 11px', borderRadius: '999px', border: `1px solid ${workspaceFilter === 'ALL' ? 'rgba(242,87,30,0.7)' : 'rgba(255,255,255,0.1)'}`, background: workspaceFilter === 'ALL' ? 'rgba(242,87,30,0.12)' : 'transparent', color: workspaceFilter === 'ALL' ? '#F57A4A' : '#9C9486', cursor: 'pointer', fontFamily: MANROPE, fontSize: '12.5px', fontWeight: 600 }}>Todos</button>
          {workspaces.filter((workspace) => !workspace.archived).map((workspace) => (
            <button key={workspace.id} type="button" onClick={() => selectWorkspaceFilter(workspace.id)} style={{ flexShrink: 0, padding: '7px 11px', borderRadius: '999px', border: `1px solid ${workspaceFilter === workspace.id ? `${workspace.color ?? '#F2571E'}99` : 'rgba(255,255,255,0.1)'}`, background: workspaceFilter === workspace.id ? `${workspace.color ?? '#F2571E'}1e` : 'transparent', color: workspaceFilter === workspace.id ? '#E8E1D2' : '#9C9486', cursor: 'pointer', fontFamily: MANROPE, fontSize: '12.5px', fontWeight: 600 }}>{workspace.name}</button>
          ))}
        </div>

        {/* Online count */}
        {totalMembers > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#76A878', flexShrink: 0 }} />
            <span style={{ fontSize: '13.5px', color: '#9FC59A', fontFamily: MANROPE }}>
              {onlineMembers.length > 0 ? `${onlineMembers.length} en línea` : 'Nadie en línea'}
            </span>
            <span style={{ fontSize: '13.5px', color: '#615846', marginLeft: '6px', fontFamily: MANROPE }}>
              {totalMembers} {totalMembers === 1 ? 'miembro' : 'miembros'}
            </span>
          </div>
        )}

        {/* ── Teams section ── */}
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: `2px solid rgba(255,255,255,0.1)`, borderTopColor: '#F2571E', animation: 'spin .6s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginTop: '20px' }}>
            {visibleWorkspaces.map((workspace) => {
              const workspaceTeams = teams.filter((team) => team.workspaceId === workspace.id);
              const isActive = workspace.id === workspaceId;
              return (
                <section key={workspace.id} style={{ border: `1px solid ${isActive ? `${workspace.color ?? '#F2571E'}55` : 'rgba(255,255,255,0.08)'}`, borderRadius: '11px', background: 'rgba(255,255,255,0.018)', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: workspace.color ?? '#F2571E', boxShadow: `0 0 0 4px ${workspace.color ?? '#F2571E'}22`, flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: '#E8E1D2', fontFamily: SORA, fontWeight: 600, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{workspace.name}</div>
                        <div style={{ color: '#827A6D', fontSize: '12px', fontFamily: MANROPE, marginTop: '2px' }}>{workspaceTeams.length} {workspaceTeams.length === 1 ? 'equipo' : 'equipos'}</div>
                      </div>
                    </div>
                    <button type="button" onClick={() => { setActiveWorkspaceId(workspace.id); setShowCreate(true); }} style={{ flexShrink: 0, padding: '6px 9px', borderRadius: '7px', background: 'transparent', border: '1px solid rgba(255,255,255,0.11)', color: '#D8D0C1', fontSize: '12px', fontFamily: MANROPE, fontWeight: 600, cursor: 'pointer' }}>+ Equipo</button>
                  </div>
                  {workspaceTeams.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', padding: '12px' }}>
                      {workspaceTeams.map((team) => <TeamCard key={team.id} team={team} onClick={() => router.push(`/dashboard/teams/${team.id}`)} />)}
                    </div>
                  ) : (
                    <div style={{ padding: '22px 16px', color: '#827A6D', fontFamily: MANROPE, fontSize: '13px' }}>Aún no hay equipos en este espacio.</div>
                  )}
                </section>
              );
            })}
            {unassignedTeams.length > 0 && workspaceFilter === 'ALL' && (
              <section style={{ border: '1px dashed rgba(255,255,255,0.13)', borderRadius: '11px', padding: '14px' }}>
                <div style={{ color: '#9C9486', fontFamily: SORA, fontSize: '13px', marginBottom: '10px' }}>Equipos sin espacio asignado</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                  {unassignedTeams.map((team) => <TeamCard key={team.id} team={team} onClick={() => router.push(`/dashboard/teams/${team.id}`)} />)}
                </div>
              </section>
            )}
            {visibleWorkspaces.length === 0 && <div style={{ padding: '34px 0', textAlign: 'center', color: '#827A6D', fontFamily: MANROPE }}>No hay espacios de trabajo para mostrar.</div>}
          </div>
        )}

        {/* ── Members section ── */}
        {currentMembers.length > 0 && (
          <>
            <div style={{ fontFamily: SORA, fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#615846', margin: '34px 0 8px' }}>Miembros del espacio activo</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {currentMembers.map((member) => {
                const u      = member.user;
                const name   = u?.name ?? 'Usuario';
                const email  = u?.email ?? '';
                const color  = memberColor(member.userId);
                const inits  = initials(name);
                const isOnline = (member as any).online ?? false;
                const roleLabel = member.role === 'OWNER' ? 'Propietario' : member.role === 'ADMIN' ? 'Admin' : member.role === 'VIEWER' ? 'Visor' : 'Miembro';
                const isMe = member.userId === currentUser?.id;

                return (
                  <div
                    key={member.id}
                    style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '13px 14px', borderRadius: '8px', cursor: 'pointer', transition: 'background 0.12s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Avatar */}
                    <span style={{ position: 'relative', flexShrink: 0 }}>
                      <span style={{ width: '38px', height: '38px', borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: '#24180A' }}>{inits}</span>
                      {isOnline && <span style={{ position: 'absolute', right: '-1px', bottom: '-1px', width: '11px', height: '11px', borderRadius: '50%', background: '#76A878', border: '2px solid #161B2E' }} />}
                    </span>

                    {/* Name + role + email */}
                    <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '14.5px', fontWeight: 600, color: '#E8E1D2', fontFamily: SORA }}>{name}{isMe ? ' (tú)' : ''}</span>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#9C9486', background: 'rgba(255,255,255,0.06)', padding: '2px 9px', borderRadius: '8px', fontFamily: MANROPE }}>{roleLabel}</span>
                      </div>
                      <div style={{ fontSize: '12.5px', color: '#827A6D', marginTop: '3px', fontFamily: MANROPE }}>{email}</div>
                    </div>

                    {/* Status */}
                    <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', color: '#8B8275', flexShrink: 0, fontFamily: MANROPE }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: isOnline ? '#76A878' : '#615846' }} />
                      {isOnline ? 'en línea' : `desde ${timeAgo(member.joinedAt)}`}
                    </span>

                    {/* Kebab */}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, cursor: 'pointer', opacity: 0.6 }} onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')} onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}>
                      <circle cx="5" cy="12" r="1.6" fill="#827A6D"/><circle cx="12" cy="12" r="1.6" fill="#827A6D"/><circle cx="19" cy="12" r="1.6" fill="#827A6D"/>
                    </svg>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── Pending invitations ── */}
        {pendingInvites.length > 0 && (
          <>
            <div style={{ fontFamily: SORA, fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#615846', margin: '32px 0 8px' }}>Invitaciones del espacio activo</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {pendingInvites.map((inv) => (
                <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '13px 14px', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                  <span style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2.5" stroke="#827A6D" strokeWidth="1.7"/><path d="m4 7 8 6 8-6" stroke="#827A6D" strokeWidth="1.7" strokeLinejoin="round"/></svg>
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', color: '#D8D0C1', fontFamily: MANROPE }}>{inv.email}</div>
                    <div style={{ fontSize: '12px', color: '#827A6D', marginTop: '2px', fontFamily: MANROPE }}>Invitación enviada {timeAgo(inv.sentAt)}</div>
                  </div>
                  <span
                    style={{ fontSize: '13px', color: '#F2571E', fontWeight: 600, cursor: 'pointer', flexShrink: 0, fontFamily: MANROPE }}
                    onClick={() => setShowInvite(true)}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.75')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                  >Reenviar</span>
                </div>
              ))}
            </div>
          </>
        )}

      </div>

      {showCreate && (
        <CreateTeamModal
          workspaceId={workspaceId}
          workspaces={workspaces}
          onWorkspaceChange={setActiveWorkspaceId}
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}
      {showInvite && workspaceId && (
        <InviteMemberModal
          workspaceId={workspaceId}
          onClose={() => setShowInvite(false)}
          onInvited={loadData}
        />
      )}
    </div>
  );
}
