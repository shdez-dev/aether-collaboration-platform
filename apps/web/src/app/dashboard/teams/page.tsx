'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTeamStore, type Team } from '@/stores/teamStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
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
    <div
      onClick={onClick}
      style={{ flex: '0 0 244px', maxWidth: '100%', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', padding: '18px', cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.18)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
    >
      {/* Icon + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <span style={{ width: '40px', height: '40px', borderRadius: '50%', background: tint, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
            <circle cx="9" cy="8" r="3" stroke={color} strokeWidth="1.8"/>
            <path d="M3.5 19a5.5 5.5 0 0 1 11 0" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M16 6a3 3 0 0 1 0 6M18.5 19a5.5 5.5 0 0 0-3-4.9" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </span>
        <div>
          <div style={{ fontFamily: SORA, fontSize: '15px', fontWeight: 600, color: '#E8E1D2' }}>{team.name}</div>
          <div style={{ fontSize: '12px', color: '#827A6D', marginTop: '1px' }}>
            {team.memberCount ?? 0} {(team.memberCount ?? 0) === 1 ? 'miembro' : 'miembros'}
          </div>
        </div>
      </div>

      {/* Avatar stack */}
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
    </div>
  );
}

// ── Create Team Modal ─────────────────────────────────────────────────────────
const COLOR_OPTIONS = ['#F2571E','#76A878','#4B607F','#DB8A66','#8C7C9E','#C4A86E','#7B8FA8','#B85C5C'];

function CreateTeamModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (data: { name: string; description?: string; color: string }) => Promise<void>;
}) {
  const [name, setName]     = useState('');
  const [desc, setDesc]     = useState('');
  const [color, setColor]   = useState(COLOR_OPTIONS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true); setError(null);
    try { await onCreate({ name: name.trim(), description: desc.trim() || undefined, color }); onClose(); }
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
            <button type="submit" disabled={!name.trim() || loading}
              style={{ padding: '9px 20px', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, background: !name.trim() || loading ? 'rgba(255,255,255,0.07)' : '#F2571E', color: !name.trim() || loading ? '#615846' : '#24180A', border: 'none', cursor: !name.trim() || loading ? 'not-allowed' : 'pointer', fontFamily: SORA, transition: 'filter 0.12s' }}
              onMouseEnter={(e) => { if (name.trim() && !loading) (e.currentTarget as HTMLElement).style.filter = 'brightness(1.08)'; }}
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
  const { currentWorkspace, currentMembers, fetchMembers } = useWorkspaceStore();
  const currentUser = useAuthStore((s) => s.user);

  const [showCreate, setShowCreate]   = useState(false);
  const [showInvite, setShowInvite]   = useState(false);
  const [pendingInvites, setPendingInvites] = useState<{ id: string; email: string; sentAt: string }[]>([]);

  const workspaceId = currentWorkspace?.id ?? '';

  const loadData = useCallback(async () => {
    fetchTeams();
    if (workspaceId) {
      fetchMembers(workspaceId);
      const r = await apiService.get<{ invitations: { id: string; email: string; sentAt: string }[] }>(
        `/api/workspaces/${workspaceId}/pending-invitations`, true
      );
      if (r.success && r.data) setPendingInvites(r.data.invitations);
    }
  }, [workspaceId, fetchTeams, fetchMembers]);

  useEffect(() => { loadData(); }, [loadData]);

  const onlineMembers = currentMembers.filter((m) => (m as any).online);
  const totalMembers  = currentMembers.length;

  async function handleCreate(data: { name: string; description?: string; color: string }) {
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
            <p style={{ margin: '7px 0 0', fontSize: '1.02rem', color: '#9C9486', fontFamily: MANROPE }}>Las personas que hacen que las cosas pasen.</p>
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
          <>
            <div style={{ fontFamily: SORA, fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#615846', margin: '30px 0 14px' }}>Equipos</div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {teams.map((team) => (
                <TeamCard key={team.id} team={team} onClick={() => router.push(`/dashboard/teams/${team.id}`)} />
              ))}
              {/* Dashed "new team" card */}
              <div
                onClick={() => setShowCreate(true)}
                style={{ flex: '0 0 244px', maxWidth: '100%', minHeight: '138px', border: '1.5px dashed rgba(255,255,255,0.14)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px', color: '#8B8275', fontFamily: SORA, fontWeight: 600, fontSize: '14px', cursor: 'pointer', transition: 'border-color 0.15s, color 0.15s' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.28)'; (e.currentTarget as HTMLElement).style.color = '#D8D0C1'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.14)'; (e.currentTarget as HTMLElement).style.color = '#8B8275'; }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                Nuevo equipo
              </div>
            </div>
          </>
        )}

        {/* ── Members section ── */}
        {currentMembers.length > 0 && (
          <>
            <div style={{ fontFamily: SORA, fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#615846', margin: '34px 0 8px' }}>Miembros</div>
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
            <div style={{ fontFamily: SORA, fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#615846', margin: '32px 0 8px' }}>Invitaciones pendientes</div>
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

      {showCreate && <CreateTeamModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />}
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
