'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useProjectStore, type Project } from '@/stores/projectStore';
import CreateWorkspaceModal from '@/components/CreateWorkspaceModal';
import CreateProjectModal from '@/components/CreateProjectModal';
import { WorkspaceIcon } from '@/components/WorkspaceIcon';
import { Plus, Search, Archive, ArchiveRestore, ChevronDown, Mail } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { C } from '@/lib/colors';

// ── Color tokens ──────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  '#3b82f6','#10b981','#f59e0b','#a855f7','#ec4899',
  '#06b6d4','#fb923c','#84cc16','#14b8a6','#f43f5e',
];

const GRADIENT_PAIR: Record<string, string> = {
  '#3b82f6': '#a855f7', // azul      → morado
  '#10b981': '#06b6d4', // verde     → cyan
  '#f59e0b': '#f97316', // ámbar     → naranja
  '#a855f7': '#ec4899', // morado    → rosa
  '#ec4899': '#a855f7', // rosa      → morado
  '#06b6d4': '#3b82f6', // cyan      → azul
  '#fb923c': '#f59e0b', // naranja   → ámbar
  '#84cc16': '#10b981', // lima      → verde
  '#14b8a6': '#06b6d4', // teal      → cyan
  '#f43f5e': '#fb923c', // rojo-rosa → naranja
  '#f97316': '#ef4444', // naranja   → rojo
  '#ef4444': '#f97316', // rojo      → naranja
  '#6b7280': '#06b6d4', // gris      → cyan
};

function gradientFor(color: string): string {
  const key = color.toLowerCase();
  const right = GRADIENT_PAIR[key] ?? '#06b6d4'; // fallback: cyan, neutro con casi todo
  return `linear-gradient(to right, ${color}, ${right})`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(date: string, t: Record<string, any>): string {
  const diff  = Date.now() - new Date(date).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return t.activity_time_just_now;
  if (mins < 60)  return t.activity_time_minutes(mins);
  if (hours < 24) return t.activity_time_hours(hours);
  if (days === 1) return t.activity_time_days(1);
  if (days < 7)   return t.activity_time_days(days);
  return t.activity_time_days(Math.floor(days / 7) * 7);
}

function getRoleBadge(role: string | undefined, t: { role_owner: string; role_admin: string; role_member: string }) {
  if (role === 'OWNER') return { label: t.role_owner.toUpperCase(), bg: 'rgba(161,167,176,0.12)', color: '#a1a7b0', border: 'rgba(161,167,176,0.28)' };
  if (role === 'ADMIN') return { label: t.role_admin.toUpperCase(), bg: 'rgba(16,185,129,0.15)', color: '#10b981', border: 'rgba(16,185,129,0.35)' };
  return { label: t.role_member.toUpperCase(), bg: 'rgba(99,102,241,0.12)', color: '#a5b4fc', border: 'rgba(99,102,241,0.3)' };
}

function getStatusColor(status: string) {
  switch (status) {
    case 'ACTIVE':    return '#10b981';
    case 'PLANNING':  return '#a5b4fc';
    case 'ON_HOLD':   return '#f59e0b';
    case 'COMPLETED': return '#3b82f6';
    default:          return C.text4;
  }
}

// ── Member avatars ────────────────────────────────────────────────────────────

function MemberAvatars({ count, colorIndex }: { count: number; colorIndex: number }) {
  const shown = Math.min(count, 3);
  const extra = count - shown;
  return (
    <div className="flex items-center">
      {Array.from({ length: shown }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-center text-[9px] font-bold text-white rounded-full flex-shrink-0"
          style={{
            width: '18px', height: '18px',
            background: AVATAR_COLORS[(colorIndex + i) % AVATAR_COLORS.length],
            border: `1.5px solid ${C.bg2}`,
            marginLeft: i > 0 ? '-5px' : '0',
            zIndex: shown - i,
          }}
        >
          {String.fromCharCode(65 + ((colorIndex + i) * 3) % 26)}
        </div>
      ))}
      {extra > 0 && (
        <div
          className="flex items-center justify-center text-[8px] font-semibold rounded-full flex-shrink-0"
          style={{ width: '18px', height: '18px', background: C.hover, color: C.text3, border: `1.5px solid ${C.bg2}`, marginLeft: '-5px' }}
        >
          +{extra}
        </div>
      )}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ label, count, icon }: { label: string; count: number; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      {icon}
      <span className="text-[14px] font-semibold" style={{ color: C.text }}>{label}</span>
      <span
        className="text-[11px] font-medium px-[7px] py-[1px] rounded-full"
        style={{ background: C.hover, color: C.text3, border: `1px solid ${C.border2}` }}
      >
        {count}
      </span>
      <div className="flex-1 h-px" style={{ background: C.border }} />
    </div>
  );
}

// ── Projects list inside card ─────────────────────────────────────────────────

function WorkspaceProjects({
  workspaceId,
  onAddProject,
}: {
  workspaceId: string;
  onAddProject: () => void;
}) {
  const { fetchProjectsByWorkspace } = useProjectStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading]   = useState(true);
  const t = useT();

  useEffect(() => {
    fetchProjectsByWorkspace(workspaceId)
      .then((p) => setProjects(p ?? []))
      .finally(() => setLoading(false));
  }, [workspaceId, fetchProjectsByWorkspace]);

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 py-2" style={{ color: C.text4 }}>
        <svg className="animate-spin w-3 h-3" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" />
        </svg>
        <span className="text-[11px]">{t.ws_page_loading_projects}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {projects.length === 0 ? (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAddProject(); }}
          className="flex items-center gap-1.5 text-[11.5px] transition-colors"
          style={{ color: C.text4 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = C.accent)}
          onMouseLeave={(e) => (e.currentTarget.style.color = C.text4)}
        >
          <Plus className="w-3 h-3" />
          {t.ws_page_no_projects_create}
        </button>
      ) : (
        <>
          {projects.map((proj) => {
            const pct = proj.progressPercent ?? 0;
            const dotColor = getStatusColor(proj.status);
            return (
              <div key={proj.id} className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between">
                  <Link
                    href={`/dashboard/projects/${proj.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-[11.5px] truncate flex-1 transition-colors"
                    style={{ color: C.text2 }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = C.text)}
                    onMouseLeave={(e) => (e.currentTarget.style.color = C.text2)}
                  >
                    <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 flex-shrink-0" style={{ background: dotColor, verticalAlign: 'middle' }} />
                    {proj.name}
                  </Link>
                  <span className="text-[10.5px] ml-2 flex-shrink-0" style={{ color: C.text4 }}>{pct}%</span>
                </div>
                <div className="rounded-full overflow-hidden" style={{ height: '3px', background: C.hover }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: pct === 100 ? C.green : C.accent }}
                  />
                </div>
              </div>
            );
          })}
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAddProject(); }}
            className="flex items-center gap-1 text-[11px] mt-0.5 transition-colors w-fit"
            style={{ color: C.text4 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = C.accent)}
            onMouseLeave={(e) => (e.currentTarget.style.color = C.text4)}
          >
            <Plus className="w-2.5 h-2.5" /> {t.ws_page_add_project}
          </button>
        </>
      )}
    </div>
  );
}

// ── Workspace card ────────────────────────────────────────────────────────────

function WorkspaceCard({
  workspace,
  isFavorite,
  onToggleFavorite,
  colorIndex,
  onAddProject,
}: {
  workspace: any;
  isFavorite: boolean;
  onToggleFavorite: (e: React.MouseEvent, id: string) => void;
  colorIndex: number;
  onAddProject: (wsId: string) => void;
}) {
  const t = useT();
  const [hovered, setHovered] = useState(false);
  const role  = getRoleBadge(workspace.userRole, t);
  const color = workspace.color || AVATAR_COLORS[colorIndex % AVATAR_COLORS.length];
  const initial = (workspace.name || '?')[0].toUpperCase();

  return (
    <div
      className="flex flex-col rounded-[10px] overflow-hidden transition-all"
      style={{
        background: hovered ? '#171b21' : C.surface,
        border: `1px solid ${hovered ? C.border2 : C.border}`,
        boxShadow: hovered ? '0 4px 20px rgba(0,0,0,0.25)' : 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ── Color stripe ── */}
      <div style={{ height: '3px', background: gradientFor(color), borderRadius: '10px 10px 0 0' }} />

      {/* ── Top: identity ── */}
      <Link href={`/dashboard/workspaces/${workspace.id}`} style={{ display: 'block' }}>
        <div style={{ padding: '14px 16px 12px' }}>
          <div className="flex items-start gap-3">
            {/* Avatar de letra */}
            <div
              className="flex items-center justify-center rounded-[10px] text-[18px] font-bold text-white flex-shrink-0"
              style={{ width: '44px', height: '44px', background: color }}
            >
              {initial}
            </div>

            <div className="flex flex-col min-w-0 flex-1 pt-[1px]">
              <div className="flex items-center gap-2 justify-between">
                <p className="text-[13.5px] font-semibold truncate" style={{ color: C.text }}>
                  {workspace.name}
                </p>
                {/* Star */}
                <button
                  onClick={(e) => onToggleFavorite(e, workspace.id)}
                  className="flex-shrink-0 flex items-center justify-center rounded-[4px] transition-colors"
                  style={{
                    width: '20px', height: '20px',
                    background: isFavorite ? `${C.amber}22` : 'transparent',
                    color: isFavorite ? C.amber : C.text4,
                    opacity: isFavorite || hovered ? 1 : 0,
                  }}
                >
                  <svg viewBox="0 0 16 16" width="11" height="11" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
                    <path d="M8 1l1.8 3.6L14 5.6l-3 2.9.7 4.1L8 10.5 4.3 12.6l.7-4.1-3-2.9 4.2-.6L8 1z" />
                  </svg>
                </button>
              </div>

              <p
                className="text-[11.5px] mt-0.5"
                style={{
                  color: C.text4,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical' as any,
                  overflow: 'hidden',
                  lineHeight: 1.45,
                }}
              >
                {workspace.description || t.ws_page_no_description}
              </p>
            </div>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-2.5 mt-3">
            <span
              className="text-[9.5px] font-semibold px-[6px] py-[2px] rounded-[3px]"
              style={{ background: role.bg, color: role.color, border: `1px solid ${role.border}` }}
            >
              {role.label}
            </span>
            <MemberAvatars count={workspace.memberCount ?? 0} colorIndex={colorIndex} />
            <span className="text-[11px]" style={{ color: C.text4 }}>
              {workspace.boardCount ?? 0} boards
            </span>
            <span className="ml-auto text-[10.5px]" style={{ color: C.text4 }}>
              {timeAgo(workspace.updatedAt, t)}
            </span>
          </div>
        </div>
      </Link>

      {/* ── Separator ── */}
      <div style={{ height: '1px', background: C.border, margin: '0 16px' }} />

      {/* ── Projects ── */}
      <div style={{ padding: '10px 16px 14px' }}>
        <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: C.text4 }}>
          {t.ws_page_section_projects}
        </p>
        <WorkspaceProjects
          workspaceId={workspace.id}
          onAddProject={() => onAddProject(workspace.id)}
        />
      </div>
    </div>
  );
}

// ── Card: crear nueva workspace ───────────────────────────────────────────────

function CreateWorkspaceCard({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const t = useT();
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex flex-col items-center justify-center rounded-[10px] transition-all w-full"
      style={{
        minHeight: '160px',
        border: `1.5px dashed ${hovered ? C.accent : C.border2}`,
        background: hovered ? `${C.accent}08` : 'transparent',
        color: hovered ? C.accent : C.text4,
      }}
    >
      <div
        className="flex items-center justify-center rounded-full mb-2"
        style={{ width: '32px', height: '32px', background: hovered ? `${C.accent}20` : C.hover }}
      >
        <Plus className="w-4 h-4" />
      </div>
      <span className="text-[12.5px] font-medium">{t.ws_page_create_new}</span>
    </button>
  );
}

// ── Archived card ─────────────────────────────────────────────────────────────

function ArchivedCard({ workspace, onRestore, colorIndex }: { workspace: any; onRestore: (id: string) => void; colorIndex: number }) {
  const t = useT();
  const color   = workspace.color || AVATAR_COLORS[colorIndex % AVATAR_COLORS.length];
  const initial = (workspace.name || '?')[0].toUpperCase();
  const role    = getRoleBadge(workspace.userRole, t);

  return (
    <div
      className="flex items-center gap-3 rounded-[8px]"
      style={{ padding: '12px 14px', background: C.surface, border: `1px solid ${C.border}`, opacity: 0.7 }}
    >
      <div
        className="flex items-center justify-center rounded-[8px] text-[16px] font-bold text-white flex-shrink-0 grayscale"
        style={{ width: '38px', height: '38px', background: color }}
      >
        {initial}
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <p className="text-[13px] font-semibold truncate" style={{ color: C.text2 }}>{workspace.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[9.5px] font-semibold px-[5px] py-[1px] rounded-[3px]" style={{ background: role.bg, color: role.color, border: `1px solid ${role.border}` }}>
            {role.label}
          </span>
          <span className="text-[10.5px]" style={{ color: C.text4 }}>{workspace.boardCount ?? 0} boards</span>
        </div>
      </div>
      <button
        onClick={() => onRestore(workspace.id)}
        className="flex items-center gap-1.5 text-[11.5px] font-medium rounded-[5px] flex-shrink-0 transition-colors"
        style={{ padding: '4px 10px', background: C.hover, border: `1px solid ${C.border2}`, color: C.text2 }}
        onMouseEnter={(e) => { (e.currentTarget.style.borderColor = C.accent); (e.currentTarget.style.color = C.text); }}
        onMouseLeave={(e) => { (e.currentTarget.style.borderColor = C.border2); (e.currentTarget.style.color = C.text2); }}
      >
        <ArchiveRestore className="w-3 h-3" /> {t.ws_page_restore}
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WorkspacesPage() {
  const { workspaces, isLoading, fetchWorkspaces, restoreWorkspace, pendingInvitations, loadPendingInvitations, acceptWorkspaceInvitation, rejectWorkspaceInvitation } = useWorkspaceStore();
  const router = useRouter();
  const t = useT();

  const [isCreateWsOpen,    setIsCreateWsOpen]    = useState(false);
  const [addProjectWsId,    setAddProjectWsId]    = useState<string | null>(null);
  const [searchQuery,       setSearchQuery]        = useState('');
  const [favorites,         setFavorites]          = useState<Set<string>>(new Set());
  const [showArchived,      setShowArchived]        = useState(false);
  const [invActionLoading,  setInvActionLoading]   = useState<string | null>(null);

  useEffect(() => {
    fetchWorkspaces(true);
    loadPendingInvitations();
    const saved = localStorage.getItem('aether-favorite-workspaces');
    if (saved) setFavorites(new Set(JSON.parse(saved)));
  }, [fetchWorkspaces, loadPendingInvitations]);

  async function handleAcceptInvitation(id: string) {
    setInvActionLoading(id);
    try {
      await acceptWorkspaceInvitation(id);
      await fetchWorkspaces(true);
    } catch (err: any) {
      alert(err.message || 'Error al aceptar invitación');
    } finally {
      setInvActionLoading(null);
    }
  }

  async function handleRejectInvitation(id: string) {
    setInvActionLoading(id);
    try {
      await rejectWorkspaceInvitation(id);
    } catch (err: any) {
      alert(err.message || 'Error al rechazar invitación');
    } finally {
      setInvActionLoading(null);
    }
  }

  const toggleFavorite = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setFavorites((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem('aether-favorite-workspaces', JSON.stringify([...next]));
      return next;
    });
  }, []);

  const active   = workspaces.filter((w) => !w.archived);
  const archived = workspaces.filter((w) => w.archived);

  const filtered = searchQuery
    ? active.filter((w) =>
        w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : active;

  const favWs    = filtered.filter((w) => favorites.has(w.id));
  const myWs     = filtered.filter((w) => w.userRole === 'OWNER' && !favorites.has(w.id));
  const memberWs = filtered.filter((w) => w.userRole !== 'OWNER' && !favorites.has(w.id));

  const cardProps = (ws: any, i: number) => ({
    workspace: ws,
    isFavorite: favorites.has(ws.id),
    onToggleFavorite: toggleFavorite,
    colorIndex: i,
    onAddProject: (wsId: string) => setAddProjectWsId(wsId),
  });

  return (
    <div style={{ padding: 'clamp(20px,4vw,40px) clamp(16px,4vw,40px) 56px', width: '100%', boxSizing: 'border-box' }}>

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[24px] font-bold mb-1" style={{ color: C.text }}>{t.ws_page_title}</h1>
          <p className="text-[13.5px]" style={{ color: C.text3 }}>
            {t.ws_page_subtitle}
          </p>
        </div>
        <button
          onClick={() => setIsCreateWsOpen(true)}
          className="flex items-center gap-2 rounded-[6px] text-[13px] font-medium transition-colors"
          style={{ padding: '8px 14px', background: C.accent, color: '#fff', marginTop: '2px' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#2563eb')}
          onMouseLeave={(e) => (e.currentTarget.style.background = C.accent)}
        >
          <Plus className="w-4 h-4" /> {t.ws_page_create_btn}
        </button>
      </div>

      {/* ── Search ── */}
      <div className="relative mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: C.text4 }} />
        <input
          type="text"
          placeholder={t.ws_page_search_placeholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full text-[13px] rounded-[6px] outline-none"
          style={{ padding: '8px 12px 8px 32px', background: C.surface, border: `1px solid ${C.border}`, color: C.text }}
          onFocus={(e) => (e.currentTarget.style.borderColor = C.accent)}
          onBlur={(e) => (e.currentTarget.style.borderColor = C.border)}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px]" style={{ color: C.text3 }}>✕</button>
        )}
      </div>

      {/* ── Loading ── */}
      {isLoading && workspaces.length === 0 && (
        <div className="flex items-center justify-center py-24">
          <svg className="animate-spin w-6 h-6" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke={C.accent} strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" />
          </svg>
        </div>
      )}

      {/* ── Empty total ── */}
      {!isLoading && workspaces.length === 0 && (
        <div
          className="flex flex-col items-center justify-center py-24 rounded-[10px] text-center"
          style={{ border: `1.5px dashed ${C.border2}` }}
        >
          <div className="flex items-center justify-center rounded-[10px] mb-4" style={{ width: '52px', height: '52px', background: `${C.accent}18`, border: `1px solid ${C.accent}33` }}>
            <Plus className="w-6 h-6" style={{ color: C.accent }} />
          </div>
          <p className="text-[15px] font-semibold mb-1" style={{ color: C.text }}>{t.ws_page_empty_title}</p>
          <p className="text-[13px] mb-5" style={{ color: C.text3 }}>{t.ws_page_empty_subtitle}</p>
          <button
            onClick={() => setIsCreateWsOpen(true)}
            className="flex items-center gap-2 rounded-[6px] text-[13px] font-medium"
            style={{ padding: '7px 14px', background: C.accent, color: '#fff' }}
          >
            <Plus className="w-4 h-4" /> {t.ws_page_create_btn}
          </button>
        </div>
      )}

      {/* ── Sin resultados ── */}
      {!isLoading && workspaces.length > 0 && searchQuery && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search className="w-8 h-8 mb-3" style={{ color: C.text4 }} />
          <p className="text-[14px] font-medium" style={{ color: C.text2 }}>{t.ws_page_no_results(searchQuery)}</p>
        </div>
      )}

      {/* ── Favoritos ── */}
      {favWs.length > 0 && (
        <div className="mb-8">
          <SectionHeader
            label={t.ws_page_favorites}
            count={favWs.length}
            icon={
              <svg viewBox="0 0 16 16" width="15" height="15" fill={C.amber} style={{ flexShrink: 0 }}>
                <path d="M8 1l1.8 3.6L14 5.6l-3 2.9.7 4.1L8 10.5 4.3 12.6l.7-4.1-3-2.9 4.2-.6L8 1z" />
              </svg>
            }
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
            {favWs.map((ws, i) => <WorkspaceCard key={ws.id} {...cardProps(ws, i)} />)}
          </div>
        </div>
      )}

      {/* ── Mis workspaces ── */}
      {(myWs.length > 0 || !searchQuery) && (
        <div className="mb-8">
          <SectionHeader label={t.ws_page_mine} count={myWs.length} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
            {myWs.map((ws, i) => <WorkspaceCard key={ws.id} {...cardProps(ws, i)} />)}
            {!searchQuery && (
              <CreateWorkspaceCard onClick={() => setIsCreateWsOpen(true)} />
            )}
          </div>
        </div>
      )}

      {/* ── Soy miembro ── */}
      {memberWs.length > 0 && (
        <div className="mb-8">
          <SectionHeader
            label={t.ws_page_member_of}
            count={memberWs.length}
            icon={
              <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke={C.green} strokeWidth="1.5" style={{ flexShrink: 0 }}>
                <circle cx="6" cy="5" r="2.5" /><path d="M1 13c0-2.5 2-4 5-4s5 1.5 5 4" />
                <circle cx="11.5" cy="5" r="2" /><path d="M13 13c0-1.5-1-2.5-2.5-3" />
              </svg>
            }
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
            {memberWs.map((ws, i) => <WorkspaceCard key={ws.id} {...cardProps(ws, i)} />)}
          </div>
        </div>
      )}

      {/* ── Invitaciones pendientes ── */}
      {!searchQuery && (
        <div className="mb-8">
          <SectionHeader
            label={t.ws_page_invitations}
            count={pendingInvitations.length}
            icon={<Mail className="w-[15px] h-[15px]" style={{ color: C.accent, flexShrink: 0 }} />}
          />
          {pendingInvitations.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center rounded-[8px] py-8 text-center"
              style={{ border: `1px dashed ${C.border2}` }}
            >
              <Mail className="w-6 h-6 mb-2" style={{ color: C.text4 }} />
              <p className="text-[13px] font-medium mb-0.5" style={{ color: C.text3 }}>{t.ws_page_no_invitations}</p>
              <p className="text-[11.5px]" style={{ color: C.text4 }}>{t.ws_page_no_invitations_hint}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {pendingInvitations.map((inv) => {
                const wsColor = inv.workspace.color || '#3b82f6';
                const initial = inv.workspace.name?.trim()?.[0]?.toUpperCase() ?? '?';
                const isActing = invActionLoading === inv.id;
                return (
                  <div
                    key={inv.id}
                    className="flex items-center gap-3 rounded-[8px] px-4 py-3"
                    style={{ background: C.bg2, border: `1px solid ${C.border}` }}
                  >
                    {/* Workspace icon */}
                    <div
                      className="flex items-center justify-center text-[14px] font-bold text-white rounded-[7px] flex-shrink-0"
                      style={{ width: '36px', height: '36px', background: wsColor }}
                    >
                      {initial}
                    </div>

                    {/* Info */}
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-[13px] font-semibold truncate" style={{ color: C.text }}>
                        {inv.workspace.name}
                      </span>
                      <span className="text-[11.5px]" style={{ color: C.text3 }}>
                        {t.ws_invitation_from(inv.inviterName, inv.role.toLowerCase())}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleAcceptInvitation(inv.id)}
                        disabled={isActing}
                        className="text-[12px] font-medium rounded-[6px] transition-colors"
                        style={{
                          padding: '5px 12px', height: '30px',
                          background: isActing ? C.border2 : C.accent,
                          color: isActing ? C.text4 : '#fff',
                          cursor: isActing ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {isActing ? '...' : t.ws_invitation_accept}
                      </button>
                      <button
                        onClick={() => handleRejectInvitation(inv.id)}
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
          )}
        </div>
      )}

      {/* ── Archivadas ── */}
      {archived.length > 0 && !searchQuery && (
        <div className="mb-8">
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="flex items-center gap-2.5 mb-4 w-full group"
          >
            <Archive className="w-[15px] h-[15px] flex-shrink-0" style={{ color: C.text4 }} />
            <span className="text-[14px] font-semibold" style={{ color: C.text }}>{t.ws_page_archived}</span>
            <span className="text-[11px] font-medium px-[7px] py-[1px] rounded-full" style={{ background: C.hover, color: C.text3, border: `1px solid ${C.border2}` }}>
              {archived.length}
            </span>
            <div className="flex-1 h-px" style={{ background: C.border }} />
            <ChevronDown
              className="w-3.5 h-3.5 flex-shrink-0 transition-transform"
              style={{ color: C.text4, transform: showArchived ? 'rotate(180deg)' : 'none' }}
            />
          </button>

          {showArchived && (
            <div className="flex flex-col gap-2">
              {archived.map((ws, i) => (
                <ArchivedCard key={ws.id} workspace={ws} onRestore={restoreWorkspace} colorIndex={i} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Modals ── */}
      <CreateWorkspaceModal isOpen={isCreateWsOpen} onClose={() => setIsCreateWsOpen(false)} />

      {addProjectWsId && (
        <CreateProjectModal
          defaultWorkspaceId={addProjectWsId}
          onClose={() => setAddProjectWsId(null)}
          onCreated={(project) => {
            setAddProjectWsId(null);
            router.push(`/dashboard/projects/${project.id}`);
          }}
        />
      )}
    </div>
  );
}
