'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTeamStore, type Team, type TeamMember, type TeamActivity, type TeamInvitation } from '@/stores/teamStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useAuthStore } from '@/stores/authStore';
import { useT } from '@/lib/i18n';
import { apiService } from '@/services/apiService';
import {
  ArrowLeft, Users, MoreHorizontal, Plus, Trash2, Crown,
  AlertTriangle, CheckCircle2, Clock, ExternalLink, FolderKanban, Check,
} from 'lucide-react';
import { C } from '@/lib/colors';

// ── Color tokens ──────────────────────────────────────────────────────────────

// ── Helpers ───────────────────────────────────────────────────────────────────

function getActivityAction(eventType: string | undefined, fallback: string, t: ReturnType<typeof import('@/lib/i18n').useT>): string {
  switch (eventType) {
    case 'card.created':             return t.team_activity_card_created;
    case 'card.updated':             return t.team_activity_card_updated;
    case 'card.moved':               return t.team_activity_card_moved;
    case 'card.deleted':             return t.team_activity_card_deleted;
    case 'card.archived':            return t.team_activity_card_archived;
    case 'card.status-changed':
      // El backend ya resuelve "completó" vs "cambió estado" en el campo action/fallback
      return fallback.includes('complet')
        ? t.team_activity_card_completed
        : t.team_activity_card_status_changed;
    case 'list.created':             return t.team_activity_list_created;
    case 'board.created':            return t.team_activity_board_created;
    case 'team.member.added':        return t.team_activity_member_added;
    case 'team.member.removed':      return t.team_activity_member_removed;
    case 'team.member.role-changed': return t.team_activity_member_role_changed;
    default:                         return fallback;
  }
}

function timeAgo(date: string | null | undefined, t: ReturnType<typeof import('@/lib/i18n').useT>): string {
  if (!date) return '—';
  const diff = Date.now() - new Date(date).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return t.projects_time_ago_now;
  if (mins < 60)  return t.projects_time_ago_min(mins);
  if (hours < 24) return t.projects_time_ago_h(hours);
  return t.projects_time_ago_d(days);
}

function getInitial(name: string | null | undefined) {
  return name?.trim()?.[0]?.toUpperCase() ?? '?';
}

const AVATAR_PALETTE = ['#3b82f6','#10b981','#f59e0b','#a855f7','#ec4899','#06b6d4','#fb923c','#84cc16'];

function hashColor(str: string | null | undefined): string {
  const s = str ?? '?';
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function Avatar({ name, size = 32, color }: { name: string | null | undefined; size?: number; color?: string }) {
  const bg = color ?? hashColor(name ?? '?');
  return (
    <div
      className="flex-shrink-0 flex items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: size, height: size, background: bg,
        fontSize: size < 28 ? '10px' : size < 36 ? '12px' : '14px',
      }}
    >
      {getInitial(name)}
    </div>
  );
}

// ── Workspace active type ─────────────────────────────────────────────────────

interface ActiveWorkspace {
  id: string;
  name: string;
  color?: string | null;
  projectCount: number;
  activeCards: number;
}

// ── Add Member Modal ──────────────────────────────────────────────────────────

function AddMemberModal({ teamId, onClose, onAdded }: {
  teamId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const t = useT();
  const { addMember } = useTeamStore();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await addMember(teamId, email.trim());
      onAdded();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al añadir miembro');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="rounded-[10px]"
        style={{ background: C.surface, border: `1px solid ${C.border2}`, width: '400px', maxWidth: '90vw' }}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
          <span className="text-[14px] font-semibold" style={{ color: C.text }}>{t.teams_add_member_title}</span>
          <button onClick={onClose} style={{ color: C.text3, fontSize: '18px' }}>×</button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium" style={{ color: C.text2 }}>Email del usuario</label>
            <input
              autoFocus
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.teams_add_member_placeholder}
              className="rounded-[6px] px-3 text-[13px] outline-none"
              style={{ background: C.bg, border: `1px solid ${C.border2}`, color: C.text, height: '36px' }}
              onFocus={(e) => (e.currentTarget.style.borderColor = C.accent)}
              onBlur={(e) => (e.currentTarget.style.borderColor = C.border2)}
            />
          </div>
          {error && (
            <div className="text-[12px] px-3 py-2 rounded-[6px]" style={{ background: 'rgba(239,68,68,0.1)', color: C.red }}>
              {error}
            </div>
          )}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button" onClick={onClose}
              className="px-3 rounded-[6px] text-[13px]"
              style={{ height: '34px', color: C.text2, border: `1px solid ${C.border2}` }}
            >
              {t.teams_create_btn_cancel}
            </button>
            <button
              type="submit"
              disabled={!email.trim() || loading}
              className="px-4 rounded-[6px] text-[13px] font-medium"
              style={{
                height: '34px',
                background: !email.trim() || loading ? C.border2 : C.accent,
                color: !email.trim() || loading ? C.text4 : '#fff',
                cursor: !email.trim() || loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? t.teams_add_member_adding : t.teams_add_member_btn}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Settings Modal ────────────────────────────────────────────────────────────

const COLOR_OPTIONS = ['#3b82f6','#10b981','#f59e0b','#a855f7','#ec4899','#06b6d4','#fb923c','#84cc16','#ef4444','#8b5cf6'];

function SettingsModal({ team, onClose, onUpdated, onDeleted }: {
  team: Team;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
}) {
  const t = useT();
  const { updateTeam, deleteTeam } = useTeamStore();
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description ?? '');
  const [color, setColor] = useState(team.color ?? COLOR_OPTIONS[0]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await updateTeam(team.id, { name: name.trim(), description: description.trim() || null, color });
      onUpdated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al actualizar');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteTeam(team.id);
      onDeleted();
    } catch (err: any) {
      setError(err.message || 'Error al eliminar');
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="rounded-[10px] flex flex-col"
        style={{ background: C.surface, border: `1px solid ${C.border2}`, width: '460px', maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto' }}
      >
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: `1px solid ${C.border}` }}>
          <span className="text-[14px] font-semibold" style={{ color: C.text }}>{t.teams_settings_title}</span>
          <button onClick={onClose} style={{ color: C.text3, fontSize: '18px' }}>×</button>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium" style={{ color: C.text2 }}>{t.teams_settings_name}</label>
            <input
              value={name} onChange={(e) => setName(e.target.value)}
              className="rounded-[6px] px-3 text-[13px] outline-none"
              style={{ background: C.bg, border: `1px solid ${C.border2}`, color: C.text, height: '36px' }}
              onFocus={(e) => (e.currentTarget.style.borderColor = C.accent)}
              onBlur={(e) => (e.currentTarget.style.borderColor = C.border2)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium" style={{ color: C.text2 }}>{t.teams_settings_desc}</label>
            <textarea
              value={description} onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="rounded-[6px] px-3 py-2 text-[13px] outline-none resize-none"
              style={{ background: C.bg, border: `1px solid ${C.border2}`, color: C.text }}
              onFocus={(e) => (e.currentTarget.style.borderColor = C.accent)}
              onBlur={(e) => (e.currentTarget.style.borderColor = C.border2)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium" style={{ color: C.text2 }}>{t.teams_settings_color}</label>
            <div className="flex items-center gap-2 flex-wrap">
              {COLOR_OPTIONS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className="rounded-full transition-all"
                  style={{ width: '22px', height: '22px', background: c, outline: color === c ? `2px solid ${c}` : 'none', outlineOffset: '2px' }}
                />
              ))}
            </div>
          </div>

          {error && (
            <div className="text-[12px] px-3 py-2 rounded-[6px]" style={{ background: 'rgba(239,68,68,0.1)', color: C.red }}>
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-3 rounded-[6px] text-[13px]"
              style={{ height: '34px', color: C.text2, border: `1px solid ${C.border2}` }}>
              {t.teams_create_btn_cancel}
            </button>
            <button type="submit" disabled={!name.trim() || loading}
              className="px-4 rounded-[6px] text-[13px] font-medium"
              style={{ height: '34px', background: !name.trim() || loading ? C.border2 : C.accent, color: !name.trim() || loading ? C.text4 : '#fff' }}>
              {loading ? t.teams_settings_saving : t.teams_settings_save}
            </button>
          </div>
        </form>

        {/* Danger zone */}
        <div className="px-5 pb-5 flex flex-col gap-3">
          <div className="h-px" style={{ background: C.border }} />
          <div className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: C.red }}>Zona de peligro</div>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-2 px-3 rounded-[6px] text-[13px] transition-colors"
              style={{ height: '34px', color: C.red, border: `1px solid rgba(239,68,68,0.3)`, background: 'transparent' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <Trash2 size={13} />
              {t.teams_settings_delete_title}
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="text-[12px]" style={{ color: C.text2 }}>{t.teams_settings_delete_confirm}</div>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(false)} className="px-3 rounded-[6px] text-[12px]"
                  style={{ height: '30px', color: C.text2, border: `1px solid ${C.border2}` }}>
                  {t.teams_create_btn_cancel}
                </button>
                <button onClick={handleDelete} disabled={deleting} className="px-3 rounded-[6px] text-[12px] font-medium"
                  style={{ height: '30px', background: C.red, color: '#fff' }}>
                  {deleting ? t.teams_settings_deleting : t.teams_settings_delete_btn}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Member Card ───────────────────────────────────────────────────────────────

const TEAM_ROLES: Array<'ADMIN' | 'MEMBER' | 'VIEWER'> = ['ADMIN', 'MEMBER', 'VIEWER'];

function roleLabel(role: string, t: ReturnType<typeof import('@/lib/i18n').useT>): string {
  if (role === 'ADMIN')  return t.teams_role_admin;
  if (role === 'VIEWER') return t.teams_role_viewer;
  return t.teams_role_member;
}

function MemberCard({
  member,
  teamColor,
  canManage,
  creatorId,
  onRemove,
  onChangeRole,
}: {
  member: TeamMember;
  teamColor: string;
  canManage: boolean;
  creatorId: string;
  onRemove: (userId: string) => void;
  onChangeRole: (userId: string, newRole: 'ADMIN' | 'MEMBER' | 'VIEWER') => void;
}) {
  const t = useT();
  const [hov, setHov] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const isAdmin = member.role === 'ADMIN';
  const isCreator = member.id === creatorId;
  const hasOverdue = member.workload.overdueCards > 0;

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setRoleOpen(false); }}
      className="rounded-[8px] flex flex-col gap-3 p-4 relative transition-all"
      style={{
        background: hov ? C.hover : C.surface,
        border: `1px solid ${hov ? C.border2 : C.border}`,
      }}
    >
      {/* Remove button (hover) — el creador no puede ser eliminado */}
      {canManage && hov && !isCreator && (
        <button
          onClick={() => onRemove(member.id)}
          className="absolute top-3 right-3 flex items-center justify-center rounded-[4px] transition-colors"
          style={{ width: '22px', height: '22px', color: C.text3 }}
          onMouseEnter={(e) => { (e.currentTarget.style.background = 'rgba(239,68,68,0.12)'); (e.currentTarget.style.color = C.red); }}
          onMouseLeave={(e) => { (e.currentTarget.style.background = 'transparent'); (e.currentTarget.style.color = C.text3); }}
          title={t.teams_remove_from_team}
        >
          <Trash2 size={12} />
        </button>
      )}

      {/* Avatar + name */}
      <div className="flex items-center gap-3">
        <Avatar name={member.name} size={36} color={hashColor(member.id)} />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium truncate" style={{ color: C.text }}>{member.name}</div>
          <div className="text-[11px] truncate" style={{ color: C.text3 }}>{member.email}</div>
        </div>
      </div>

      {/* Role badge / selector */}
      <div className="flex items-center gap-2" style={{ position: 'relative' }}>
        <div
          className="flex items-center gap-1 px-2 py-[2px] rounded-full text-[11px] font-medium"
          style={isAdmin
            ? { background: `${teamColor}22`, color: teamColor, border: `1px solid ${teamColor}44` }
            : member.role === 'VIEWER'
              ? { background: C.bg, color: C.text4, border: `1px solid ${C.border}` }
              : { background: C.bg, color: C.text3, border: `1px solid ${C.border}` }
          }
        >
          {isAdmin && <Crown size={10} />}
          {roleLabel(member.role, t)}
          {isCreator && <span style={{ fontSize: '10px', opacity: 0.7, marginLeft: '2px' }}>·</span>}
        </div>

        {/* Dropdown para cambiar rol — solo si canManage y no es el creador */}
        {canManage && !isCreator && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setRoleOpen((v) => !v)}
              className="text-[11px] transition-colors"
              style={{ color: C.text4 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = C.text2)}
              onMouseLeave={(e) => (e.currentTarget.style.color = C.text4)}
            >
              ▾
            </button>
            {roleOpen && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, zIndex: 20, marginTop: '4px',
                background: C.surface, border: `1px solid ${C.border2}`, borderRadius: '8px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.4)', minWidth: '110px', overflow: 'hidden',
              }}>
                {TEAM_ROLES.filter((r) => r !== member.role).map((r) => (
                  <button
                    key={r}
                    onClick={() => { onChangeRole(member.id, r); setRoleOpen(false); }}
                    style={{
                      width: '100%', textAlign: 'left', padding: '8px 12px',
                      fontSize: '12px', color: C.text2, background: 'none', border: 'none',
                      cursor: 'pointer', display: 'block',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = C.hover)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                  >
                    {roleLabel(r, t)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Workload */}
      <div className="flex flex-col gap-1 text-[12px]" style={{ color: C.text3 }}>
        <div className="flex items-center justify-between">
          <span>{t.teams_cards_active(member.workload.totalCards)}</span>
          {hasOverdue && (
            <div className="flex items-center gap-1" style={{ color: C.red }}>
              <AlertTriangle size={11} />
              <span>{t.teams_cards_overdue(member.workload.overdueCards)}</span>
            </div>
          )}
        </div>
        {member.workload.completedThisWeek > 0 && (
          <div className="flex items-center gap-1" style={{ color: C.green }}>
            <CheckCircle2 size={11} />
            <span>{t.teams_cards_completed_week(member.workload.completedThisWeek)}</span>
          </div>
        )}
        <div className="flex items-center gap-1" style={{ color: C.text4 }}>
          <Clock size={11} />
          <span>{timeAgo(member.workload.lastActivity, t)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Assign Project Modal ──────────────────────────────────────────────────────

interface ProjectOption {
  id: string;
  name: string;
  color: string | null;
  description: string | null;
  workspaceName: string;
}

function AssignProjectModal({ teamId, teamColor, onClose, onAssigned }: {
  teamId: string;
  teamColor: string;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const t = useT();
  const { workspaces } = useWorkspaceStore();
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const results: ProjectOption[] = [];
        await Promise.all(
          workspaces.map(async (ws) => {
            const res = await apiService.get<{ projects: any[] }>(`/api/workspaces/${ws.id}/projects`, true);
            if (res.success && res.data) {
              res.data.projects.forEach((p) => {
                results.push({ id: p.id, name: p.name, color: p.color ?? null, description: p.description ?? null, workspaceName: ws.name });
              });
            }
          })
        );
        setProjects(results);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [workspaces]);

  async function handleAssign(projectId: string) {
    setAssigning(projectId);
    try {
      await apiService.post(`/api/projects/${projectId}/teams`, { teamId }, true);
      setDone((prev) => new Set([...prev, projectId]));
      onAssigned();
    } catch {
      /* silencioso */
    } finally {
      setAssigning(null);
    }
  }

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.workspaceName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        style={{ width: '440px', maxHeight: '520px', background: C.surface, border: `1px solid ${C.border2}`, borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderKanban size={15} style={{ color: teamColor }} />
            <span style={{ fontSize: '13.5px', fontWeight: 600, color: C.text }}>{t.teams_assign_project_title}</span>
          </div>
          <button
            onClick={onClose}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '6px', background: 'none', border: 'none', cursor: 'pointer', color: C.text3 }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = C.hover; (e.currentTarget as HTMLElement).style.color = C.text; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = C.text3; }}
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}` }}>
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.teams_assign_project_search}
            style={{ width: '100%', padding: '7px 10px', borderRadius: '7px', fontSize: '12.5px', background: C.bg2, border: `1px solid ${C.border2}`, color: C.text, outline: 'none', boxSizing: 'border-box' as const }}
          />
        </div>

        {/* List */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px 0' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${C.border2}`, borderTopColor: teamColor, animation: 'spin 0.7s linear infinite' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '36px 0' }}>
              <FolderKanban size={22} style={{ color: C.text4 }} />
              <span style={{ fontSize: '12.5px', color: C.text4 }}>
                {projects.length === 0 ? t.teams_assign_project_empty : t.teams_assign_project_no_results}
              </span>
            </div>
          ) : (
            filtered.map((p) => {
              const pColor = p.color ?? teamColor;
              const isAssigned = done.has(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => !isAssigned && handleAssign(p.id)}
                  disabled={assigning === p.id || isAssigned}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', background: 'none', border: 'none', borderTop: `1px solid ${C.border}`, cursor: isAssigned ? 'default' : 'pointer', textAlign: 'left', transition: 'background 0.1s' }}
                  onMouseEnter={(e) => { if (!isAssigned) (e.currentTarget as HTMLElement).style.background = C.hover; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                >
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: `${pColor}20`, border: `1px solid ${pColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FolderKanban size={15} style={{ color: pColor }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    <div style={{ fontSize: '11.5px', color: C.text4 }}>{p.workspaceName}</div>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    {isAssigned ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: C.green, fontWeight: 500 }}>
                        <Check size={13} /> {t.teams_assign_project_assigned}
                      </div>
                    ) : assigning === p.id ? (
                      <svg className="animate-spin" viewBox="0 0 16 16" fill="none" width="14" height="14"><circle cx="8" cy="8" r="6" stroke={teamColor} strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" /></svg>
                    ) : (
                      <span style={{ fontSize: '12px', color: C.text4 }}>{t.teams_assign_project_btn}</span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TeamDetailPage() {
  const t = useT();
  const params = useParams();
  const router = useRouter();
  const teamId = params.id as string;

  const { currentTeam, isLoading, error, fetchTeamById, removeMember, changeMemberRole, pendingTeamInvitations, loadPendingTeamInvitations, acceptTeamInvitation, rejectTeamInvitation } = useTeamStore();
  const { workspaces, fetchWorkspaces } = useWorkspaceStore();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const [activity, setActivity] = useState<TeamActivity[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityUser, setActivityUser] = useState<string>('');
  const [activityDate, setActivityDate] = useState<'today' | '7d' | '30d' | 'all'>('all');

  const [activeWorkspaces, setActiveWorkspaces] = useState<ActiveWorkspace[]>([]);

  const [showAddMember, setShowAddMember] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAssignProject, setShowAssignProject] = useState(false);
  const [invActionLoading, setInvActionLoading] = useState<string | null>(null);

  // Load team
  useEffect(() => {
    if (teamId) fetchTeamById(teamId);
  }, [teamId, fetchTeamById]);

  // Ensure workspaces are loaded (needed for AssignProjectModal)
  useEffect(() => {
    if (workspaces.length === 0) fetchWorkspaces();
  }, [fetchWorkspaces]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load members
  const loadMembers = useCallback(async () => {
    if (!teamId) return;
    setMembersLoading(true);
    try {
      const res = await apiService.get<{ members: TeamMember[] }>(`/api/teams/${teamId}/members`, true);
      if (res.success && res.data) setMembers(res.data.members);
    } finally {
      setMembersLoading(false);
    }
  }, [teamId]);

  // Load activity
  const loadActivity = useCallback(async () => {
    if (!teamId) return;
    setActivityLoading(true);
    try {
      const res = await apiService.get<{ events: TeamActivity[] }>(`/api/teams/${teamId}/activity`, true);
      if (res.success && res.data) setActivity(res.data.events);
    } finally {
      setActivityLoading(false);
    }
  }, [teamId]);

  // Load workspaces
  const loadWorkspaces = useCallback(async () => {
    if (!teamId) return;
    try {
      const res = await apiService.get<{ workspaces: ActiveWorkspace[] }>(`/api/teams/${teamId}/workspaces`, true);
      if (res.success && res.data) setActiveWorkspaces(res.data.workspaces);
    } catch { /* silencioso */ }
  }, [teamId]);

  useEffect(() => {
    loadMembers();
    loadActivity();
    loadWorkspaces();
    loadPendingTeamInvitations();
  }, [loadMembers, loadActivity, loadWorkspaces, loadPendingTeamInvitations]);

  async function handleAcceptTeamInvitation(id: string) {
    setInvActionLoading(id);
    try {
      await acceptTeamInvitation(id);
      await loadMembers();
    } catch (err: any) {
      alert(err.message || 'Error al aceptar invitación');
    } finally {
      setInvActionLoading(null);
    }
  }

  async function handleRejectTeamInvitation(id: string) {
    setInvActionLoading(id);
    try {
      await rejectTeamInvitation(id);
    } catch (err: any) {
      alert(err.message || 'Error al rechazar invitación');
    } finally {
      setInvActionLoading(null);
    }
  }

  async function handleRemoveMember(userId: string) {
    try {
      await removeMember(teamId, userId);
      setMembers((prev) => prev.filter((m) => m.id !== userId));
    } catch (err: any) {
      alert(err.message || 'Error al remover miembro');
    }
  }

  async function handleChangeRole(userId: string, newRole: 'ADMIN' | 'MEMBER' | 'VIEWER') {
    try {
      await changeMemberRole(teamId, userId, newRole);
      setMembers((prev) => prev.map((m) => m.id === userId ? { ...m, role: newRole } : m));
    } catch (err: any) {
      alert(err.message || 'Error al cambiar rol');
    }
  }

  const currentUser = useAuthStore((s) => s.user);
  const teamColor = currentTeam?.color || '#3b82f6';
  const leadMember = members.find((m) => m.role === 'ADMIN');
  const isOwnerOrAdmin =
    currentUser != null &&
    (currentTeam?.createdBy === currentUser.id ||
      members.find((m) => m.id === currentUser.id)?.role === 'ADMIN');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ background: C.bg }}>
        <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: C.border2, borderTopColor: C.accent }} />
      </div>
    );
  }

  if (error || !currentTeam) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4" style={{ background: C.bg }}>
        <div className="text-[14px]" style={{ color: C.text3 }}>{error || t.teams_not_found}</div>
        <button
          onClick={() => router.push('/dashboard/teams')}
          className="flex items-center gap-2 text-[13px]"
          style={{ color: C.accent }}
        >
          <ArrowLeft size={14} /> {t.btn_back}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: C.bg }}>
      {/* ── HEADER (sticky) ── */}
      <div className="flex-shrink-0" style={{ background: C.bg2, borderBottom: `1px solid ${C.border}` }}>
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 px-7 pt-4 pb-1 text-[12px]" style={{ color: C.text3 }}>
          <button
            onClick={() => router.push('/dashboard/teams')}
            className="flex items-center gap-1.5 transition-colors"
            style={{ color: C.text3 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = C.text2)}
            onMouseLeave={(e) => (e.currentTarget.style.color = C.text3)}
          >
            <ArrowLeft size={12} /> {t.teams_title}
          </button>
          <span style={{ color: C.text4 }}>/</span>
          <span style={{ color: C.text2 }}>{currentTeam.name}</span>
        </div>

        {/* Title row */}
        <div className="flex items-start justify-between px-7 pt-2 pb-3 gap-4">
          <div className="flex items-start gap-4 min-w-0">
            {/* Team avatar */}
            <div
              className="flex-shrink-0 flex items-center justify-center rounded-[10px] text-[22px] font-bold text-white"
              style={{ width: '44px', height: '44px', background: teamColor }}
            >
              {getInitial(currentTeam.name)}
            </div>

            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-[18px] font-semibold" style={{ color: C.text }}>{currentTeam.name}</h1>
                <div
                  className="flex items-center gap-1.5 px-2 py-[2px] rounded-full text-[11px]"
                  style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text3 }}
                >
                  <Users size={11} />
                  {t.teams_members_count(members.length)}
                </div>
              </div>

              {currentTeam.description && (
                <div className="text-[13px]" style={{ color: C.text3 }}>{currentTeam.description}</div>
              )}

              {leadMember && (
                <div className="flex items-center gap-1.5 text-[12px]" style={{ color: C.text3 }}>
                  <span style={{ color: C.text4 }}>Lead:</span>
                  <Avatar name={leadMember.name} size={18} color={teamColor} />
                  <span>{leadMember.name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowAssignProject(true)}
              className="flex items-center gap-1.5 rounded-[6px] text-[12.5px] font-medium transition-all"
              style={{ height: '32px', padding: '0 12px', color: C.text2, border: `1px solid ${C.border2}`, background: C.surface }}
              onMouseEnter={(e) => { (e.currentTarget.style.borderColor = teamColor); (e.currentTarget.style.color = teamColor); (e.currentTarget.style.background = `${teamColor}10`); }}
              onMouseLeave={(e) => { (e.currentTarget.style.borderColor = C.border2); (e.currentTarget.style.color = C.text2); (e.currentTarget.style.background = C.surface); }}
            >
              <FolderKanban size={13} /> {t.teams_assign_project}
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="flex-shrink-0 flex items-center justify-center rounded-[6px] transition-colors"
              style={{ width: '32px', height: '32px', color: C.text3, border: `1px solid ${C.border}` }}
              onMouseEnter={(e) => { (e.currentTarget.style.background = C.hover); (e.currentTarget.style.color = C.text); }}
              onMouseLeave={(e) => { (e.currentTarget.style.background = 'transparent'); (e.currentTarget.style.color = C.text3); }}
            >
              <MoreHorizontal size={15} />
            </button>
          </div>
        </div>

        {/* Accent line */}
        <div style={{ height: '2px', background: `linear-gradient(90deg, ${teamColor}, transparent)` }} />
      </div>

      {/* ── BODY (scrollable) ── */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-[1100px] mx-auto px-7 py-8 flex flex-col gap-10">

          {/* ── INVITACIONES PENDIENTES (propias de este equipo) ── */}
          {pendingTeamInvitations.filter((inv) => inv.team.id === teamId).length > 0 && (
            <section>
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em] mb-4" style={{ color: C.text4 }}>
                {t.team_pending_invitations_section}
              </div>
              <div className="flex flex-col gap-2">
                {pendingTeamInvitations.filter((inv) => inv.team.id === teamId).map((inv) => {
                  const isActing = invActionLoading === inv.id;
                  return (
                    <div
                      key={inv.id}
                      className="flex items-center gap-3 rounded-[8px] px-4 py-3"
                      style={{ background: C.bg2, border: `1px solid ${C.border}` }}
                    >
                      <div
                        className="flex items-center justify-center rounded-full flex-shrink-0 font-semibold text-white text-[12px]"
                        style={{ width: '34px', height: '34px', background: teamColor }}
                      >
                        {getInitial(inv.inviterName)}
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-[13px] font-medium" style={{ color: C.text }}>
                          {t.team_invitation_from(inv.inviterName)}
                        </span>
                        <span className="text-[11.5px]" style={{ color: C.text3 }}>
                          {t.team_invitation_role(inv.role.toLowerCase())}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleAcceptTeamInvitation(inv.id)}
                          disabled={isActing}
                          className="text-[12px] font-medium rounded-[6px] transition-colors"
                          style={{
                            padding: '5px 12px', height: '30px',
                            background: isActing ? C.border2 : teamColor,
                            color: isActing ? C.text4 : '#fff',
                            cursor: isActing ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {isActing ? '...' : t.ws_invitation_accept}
                        </button>
                        <button
                          onClick={() => handleRejectTeamInvitation(inv.id)}
                          disabled={isActing}
                          className="text-[12px] rounded-[6px] transition-colors"
                          style={{
                            padding: '5px 12px', height: '30px',
                            background: C.hover, border: `1px solid ${C.border2}`,
                            color: isActing ? C.text4 : C.text2,
                            cursor: isActing ? 'not-allowed' : 'pointer',
                          }}
                          onMouseEnter={(e) => { if (!isActing) { e.currentTarget.style.borderColor = C.red; e.currentTarget.style.color = C.red; } }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border2; e.currentTarget.style.color = C.text2; }}
                        >
                          {t.ws_invitation_reject}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── MIEMBROS ── */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: C.text4 }}>
                {t.teams_section_members}
              </div>
              <button
                onClick={() => setShowAddMember(true)}
                className="flex items-center gap-1.5 rounded-[6px] text-[12px] transition-colors"
                style={{ height: '28px', padding: '0 10px', color: C.text2, border: `1px solid ${C.border}` }}
                onMouseEnter={(e) => { (e.currentTarget.style.background = C.hover); (e.currentTarget.style.color = C.text); }}
                onMouseLeave={(e) => { (e.currentTarget.style.background = 'transparent'); (e.currentTarget.style.color = C.text2); }}
              >
                <Plus size={12} /> {t.teams_add_member}
              </button>
            </div>

            {membersLoading ? (
              <div className="py-8 flex justify-center">
                <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: C.border2, borderTopColor: C.accent }} />
              </div>
            ) : members.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-10 rounded-[8px] gap-3 cursor-pointer transition-colors"
                style={{ border: `1px dashed ${C.border2}`, color: C.text4 }}
                onClick={() => setShowAddMember(true)}
              >
                <Users size={24} />
                <div className="text-[13px]">{t.teams_no_members}</div>
              </div>
            ) : (
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                {members.map((m) => (
                  <MemberCard
                    key={m.id}
                    member={m}
                    teamColor={teamColor}
                    canManage={isOwnerOrAdmin}
                    creatorId={currentTeam?.createdBy ?? ''}
                    onRemove={handleRemoveMember}
                    onChangeRole={handleChangeRole}
                  />
                ))}
                {/* Add button as last card */}
                <div
                  onClick={() => setShowAddMember(true)}
                  className="rounded-[8px] flex items-center justify-center gap-2 cursor-pointer transition-colors text-[13px]"
                  style={{ border: `1px dashed ${C.border2}`, color: C.text4, minHeight: '120px' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = C.accent; (e.currentTarget as HTMLElement).style.color = C.accent; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = C.border2; (e.currentTarget as HTMLElement).style.color = C.text4; }}
                >
                  <Plus size={14} /> {t.teams_add_member}
                </div>
              </div>
            )}
          </section>

          {/* ── WORKSPACES ACTIVOS ── */}
          {activeWorkspaces.length > 0 && (
            <section>
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em] mb-4" style={{ color: C.text4 }}>
                {t.teams_section_workspaces}
              </div>
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                {activeWorkspaces.map((ws) => (
                  <a
                    key={ws.id}
                    href={`/dashboard/workspaces/${ws.id}`}
                    className="rounded-[8px] flex items-center gap-3 p-3 transition-all no-underline"
                    style={{ background: C.surface, border: `1px solid ${C.border}`, textDecoration: 'none' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = C.hover; (e.currentTarget as HTMLElement).style.borderColor = C.border2; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = C.surface; (e.currentTarget as HTMLElement).style.borderColor = C.border; }}
                  >
                    <div
                      className="flex-shrink-0 rounded-[6px]"
                      style={{ width: '32px', height: '32px', background: ws.color ?? teamColor, opacity: 0.85 }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium truncate" style={{ color: C.text }}>{ws.name}</div>
                      <div className="text-[11px]" style={{ color: C.text4 }}>
                        {t.teams_ws_projects(ws.projectCount)} · {t.teams_ws_cards(ws.activeCards)}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* ── ACTIVIDAD RECIENTE — solo visible para el creador y admins ── */}
          {isOwnerOrAdmin && <section>
            {/* Header + filtros */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.text4 }}>
                {t.teams_section_activity}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                {/* Filtro por persona */}
                <select
                  value={activityUser}
                  onChange={(e) => setActivityUser(e.target.value)}
                  style={{
                    background: C.surface, border: `1px solid ${activityUser ? C.accent : C.border2}`, borderRadius: '6px',
                    color: activityUser ? C.text : C.text3,
                    fontSize: '12px', padding: '4px 8px', cursor: 'pointer', outline: 'none',
                  }}
                >
                  <option value="">{t.teams_activity_select_member}</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>

                {/* Filtro por fecha */}
                {(['all', 'today', '7d', '30d'] as const).map((range) => {
                  const labels = { all: t.teams_activity_filter_always, today: t.teams_activity_filter_today, '7d': t.teams_activity_filter_7d, '30d': t.teams_activity_filter_30d };
                  const isActive = activityDate === range;
                  return (
                    <button
                      key={range}
                      onClick={() => setActivityDate(range)}
                      style={{
                        padding: '4px 10px', borderRadius: '6px', fontSize: '12px', border: 'none', cursor: 'pointer',
                        background: isActive ? C.accent : C.surface,
                        color: isActive ? '#fff' : C.text3,
                        fontWeight: isActive ? 600 : 400,
                        transition: 'background 0.1s, color 0.1s',
                      }}
                      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = C.hover; }}
                      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = C.surface; }}
                    >
                      {labels[range]}
                    </button>
                  );
                })}

                {/* Reset filtros */}
                {(activityUser !== '' || activityDate !== 'all') && (
                  <button
                    onClick={() => { setActivityUser(''); setActivityDate('all'); }}
                    style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '11px', background: 'none', border: `1px solid ${C.border}`, color: C.text4, cursor: 'pointer' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = C.text3; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = C.text4; }}
                  >
                    {t.teams_activity_clear}
                  </button>
                )}
              </div>
            </div>

            {(() => {
              // Sin miembro seleccionado — mostrar prompt
              if (!activityUser) return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '40px 0', borderRadius: '8px', border: `1px dashed ${C.border2}` }}>
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" width="24" height="24" style={{ color: C.text4 }}>
                    <circle cx="8" cy="6" r="3" /><path d="M2 16c0-3.3 2.7-6 6-6" />
                    <circle cx="14" cy="12" r="4" /><path d="M14 10v2h2" />
                  </svg>
                  <span style={{ fontSize: '12px', color: C.text4 }}>{t.teams_activity_prompt}</span>
                </div>
              );

              // Aplicar filtros
              const now = Date.now();
              const cutoff = activityDate === 'today' ? now - 86400000
                : activityDate === '7d'   ? now - 7  * 86400000
                : activityDate === '30d'  ? now - 30 * 86400000
                : 0;

              const filtered = activity.filter((ev) => {
                if (ev.userId !== activityUser) return false;
                if (cutoff && new Date(ev.createdAt).getTime() < cutoff) return false;
                return true;
              });

              if (activityLoading) return (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${C.border2}`, borderTopColor: C.accent, animation: 'spin 0.7s linear infinite' }} />
                </div>
              );

              if (filtered.length === 0) return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '36px 0', borderRadius: '8px', border: `1px dashed ${C.border2}` }}>
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" width="22" height="22" style={{ color: C.text4 }}>
                    <circle cx="10" cy="10" r="8" /><path d="M10 6v4l3 3" />
                  </svg>
                  <span style={{ fontSize: '12px', color: C.text4 }}>
                    {activity.length === 0 ? t.teams_activity_empty : t.teams_activity_no_results}
                  </span>
                </div>
              );

              return (
                <div style={{ borderRadius: '8px', border: `1px solid ${C.border}`, background: C.surface, overflow: 'hidden' }}>
                  {/* Contador */}
                  <div style={{ padding: '7px 14px', borderBottom: `1px solid ${C.border}`, background: C.bg2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', color: C.text4 }}>
                      {t.teams_activity_count(filtered.length, members.find(m => m.id === activityUser)?.name ?? '')}
                    </span>
                  </div>

                  {filtered.slice(0, 30).map((ev, idx) => (
                    <div
                      key={ev.id}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: '10px',
                        padding: '10px 14px',
                        borderTop: idx > 0 ? `1px solid ${C.border}` : 'none',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = C.hover; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      {/* Avatar */}
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                        background: hashColor(ev.userId),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px', fontWeight: 700, color: '#fff',
                      }}>
                        {getInitial(ev.userName)}
                      </div>

                      {/* Contenido */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12.5px', lineHeight: 1.4 }}>
                          <span style={{ fontWeight: 600, color: C.text }}>{ev.userName}</span>
                          <span style={{ color: C.text3 }}> {getActivityAction(ev.eventType, ev.action, t)}</span>
                          {ev.entityName && (
                            <span style={{ fontWeight: 500, color: C.text2 }}> "{ev.entityName}"</span>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: C.text4, marginTop: '2px' }}>
                          {new Date(ev.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>

                      {/* Tiempo relativo */}
                      <span style={{ fontSize: '11px', color: C.text4, flexShrink: 0, paddingTop: '2px' }}>
                        {timeAgo(ev.createdAt, t)}
                      </span>
                    </div>
                  ))}

                  {filtered.length > 30 && (
                    <div style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}`, textAlign: 'center', fontSize: '12px', color: C.text4 }}>
                      {t.team_activity_more_events(filtered.length - 30)}
                    </div>
                  )}
                </div>
              );
            })()}
          </section>}

          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>

      {/* ── MODALS ── */}
      {showAddMember && (
        <AddMemberModal
          teamId={teamId}
          onClose={() => setShowAddMember(false)}
          onAdded={loadMembers}
        />
      )}

      {showSettings && (
        <SettingsModal
          team={currentTeam}
          onClose={() => setShowSettings(false)}
          onUpdated={() => fetchTeamById(teamId)}
          onDeleted={() => router.push('/dashboard/teams')}
        />
      )}

      {showAssignProject && (
        <AssignProjectModal
          teamId={teamId}
          teamColor={teamColor}
          onClose={() => setShowAssignProject(false)}
          onAssigned={loadWorkspaces}
        />
      )}
    </div>
  );
}
