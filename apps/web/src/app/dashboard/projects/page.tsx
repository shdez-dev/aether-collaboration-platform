'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useProjectStore, type Project, type ProjectStatus } from '@/stores/projectStore';
import CreateProjectModal from '@/components/CreateProjectModal';
import { useT } from '@/lib/i18n';
import {
  Plus, Search, FolderOpen, TrendingUp, AlertTriangle,
  CheckCircle2, Clock, ChevronDown, LayoutGrid, FileStack,
} from 'lucide-react';

// ── Color tokens ──────────────────────────────────────────────────────────────
const C = {
  bg:      '#0b0d10',
  bg2:     '#0f1217',
  surface: '#14171c',
  hover:   '#1c2128',
  border:  '#1f2329',
  border2: '#2a2f36',
  text:    '#e6e8eb',
  text2:   '#a1a7b0',
  text3:   '#6b7280',
  text4:   '#4b5260',
  accent:  '#3b82f6',
  green:   '#10b981',
  amber:   '#f59e0b',
  red:     '#ef4444',
  purple:  '#a855f7',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'ahora';
  if (mins < 60)  return `hace ${mins}m`;
  if (hours < 24) return `hace ${hours}h`;
  if (days < 30)  return `hace ${days}d`;
  return `hace ${Math.floor(days / 30)}m`;
}

function daysLabel(endDate?: string | null): { label: string; color: string } | null {
  if (!endDate) return null;
  const d = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000);
  if (d < -60 || d > 90) return null;
  if (d < 0)  return { label: `${Math.abs(d)}d vencido`,   color: C.red };
  if (d === 0) return { label: 'vence hoy',                color: C.amber };
  if (d <= 7)  return { label: `${d}d restantes`,          color: C.amber };
  return              { label: `${d}d restantes`,          color: C.text4 };
}

function getStatusCfg(status: ProjectStatus, t: ReturnType<typeof useT>) {
  switch (status) {
    case 'ACTIVE':    return { label: t.projects_status_active,    color: '#10b981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.25)' };
    case 'PLANNING':  return { label: t.projects_status_planning,  color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.25)' };
    case 'ON_HOLD':   return { label: t.projects_status_on_hold,   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.25)' };
    case 'COMPLETED': return { label: t.projects_status_completed, color: '#a1a7b0', bg: 'rgba(161,167,176,0.1)',  border: 'rgba(161,167,176,0.2)' };
    case 'ARCHIVED':  return { label: t.projects_status_cancelled, color: '#6b7280', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.2)' };
    default:          return { label: status,                       color: '#6b7280', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.2)' };
  }
}

function isAtRisk(p: Project): boolean {
  const pct = p.progressPercent ?? p.stats?.progressPercent ?? 0;
  return pct < 50 && p.status !== 'COMPLETED' && p.status !== 'ARCHIVED';
}

// ── ProjectCard ───────────────────────────────────────────────────────────────

function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const t = useT();
  const [hov, setHov] = useState(false);
  const color   = project.color || C.accent;
  const pct     = project.progressPercent ?? project.stats?.progressPercent ?? 0;
  const st      = getStatusCfg(project.status, t);
  const dl      = daysLabel(project.endDate);
  const boards  = project.boards?.length ?? project.stats?.totalBoards ?? 0;
  const total   = project.stats?.totalCards ?? 0;
  const done    = project.stats?.completedCards ?? 0;
  const initial = (project.name.trim()[0] ?? '?').toUpperCase();
  const risk    = isAtRisk(project);

  return (
    <div
      onClick={onClick}
      style={{
        background: C.surface,
        borderRadius: '10px',
        border: `1px solid ${hov ? color + '44' : C.border}`,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color 0.15s, transform 0.15s, box-shadow 0.15s',
        transform: hov ? 'translateY(-1px)' : 'none',
        boxShadow: hov ? `0 6px 20px ${color}14` : 'none',
        display: 'flex',
        flexDirection: 'column',
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {/* Top stripe */}
      <div style={{ height: '4px', background: `linear-gradient(to right, ${color}, ${color}66)`, flexShrink: 0 }} />

      {/* Body */}
      <div style={{ padding: '13px 14px 14px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>

        {/* Row 1: Icon + name + status */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '8px', flexShrink: 0,
            background: color + '1a', border: `1.5px solid ${color}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '15px', fontWeight: 700, color,
          }}>
            {initial}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginBottom: '4px' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {project.name}
              </span>
              {risk && (
                <span style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.05em', padding: '1px 6px', borderRadius: '4px', background: 'rgba(245,158,11,0.14)', color: C.amber, border: 'rgba(245,158,11,0.3) 1px solid', flexShrink: 0 }}>
                  EN RIESGO
                </span>
              )}
            </div>
            <span style={{ fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.04em', padding: '1px 6px', borderRadius: '4px', background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
              {st.label}
            </span>
          </div>
        </div>

        {/* Description */}
        {project.description && (
          <p style={{
            margin: 0, fontSize: '11.5px', color: C.text3, lineHeight: 1.45,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {project.description}
          </p>
        )}

        {/* Progress */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <span style={{ fontSize: '11px', color: C.text4 }}>{t.ws_stats_completion_rate}</span>
            <span style={{ fontSize: '11px', fontWeight: 600, color: pct === 100 ? C.green : C.text3 }}>{pct}%</span>
          </div>
          <div style={{ height: '4px', borderRadius: '3px', background: C.border2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, borderRadius: '3px', background: pct === 100 ? C.green : `linear-gradient(to right, ${color}, ${color}99)`, transition: 'width 0.4s' }} />
          </div>
        </div>

        {/* Stats pills */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '5px' }}>
          <span style={{ fontSize: '10.5px', padding: '2px 7px', borderRadius: '4px', background: C.hover, color: C.text4, border: `1px solid ${C.border2}` }}>
            {boards} board{boards !== 1 ? 's' : ''}
          </span>
          {total > 0 && (
            <span style={{ fontSize: '10.5px', padding: '2px 7px', borderRadius: '4px', background: C.hover, color: C.text4, border: `1px solid ${C.border2}` }}>
              {done}/{total} tareas
            </span>
          )}
          {dl && (
            <span style={{ fontSize: '10.5px', padding: '2px 7px', borderRadius: '4px', background: 'transparent', color: dl.color, border: `1px solid ${dl.color}44` }}>
              {dl.label}
            </span>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: `1px solid ${C.border}`, marginTop: 'auto' }}>
          <span style={{ fontSize: '10.5px', color: C.text4 }}>
            {project.startDate
              ? new Date(project.startDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
              : 'Sin inicio'}
          </span>
          <span style={{ fontSize: '10.5px', color: C.text4 }}>{timeAgo(project.updatedAt)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

function Section({
  title, color, projects, onCardClick, defaultOpen = true,
}: {
  title: string; color: string; projects: Project[]; onCardClick: (id: string) => void; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (projects.length === 0) return null;
  return (
    <div>
      {/* Section header */}
      <button
        onClick={() => setOpen(!open)}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0 10px', width: '100%' }}
      >
        <ChevronDown style={{ width: '12px', height: '12px', color: C.text4, transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s', flexShrink: 0 }} />
        <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', color: C.text3, textTransform: 'uppercase' }}>{title}</span>
        <span style={{ fontSize: '11px', padding: '0 6px', borderRadius: '10px', background: color + '18', color, border: `1px solid ${color}33`, lineHeight: '18px' }}>
          {projects.length}
        </span>
      </button>

      {/* Grid */}
      {open && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '28px' }}>
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} onClick={() => onCardClick(p.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Stat chip ─────────────────────────────────────────────────────────────────

function StatChip({ value, label, color, icon: Icon }: { value: number; label: string; color: string; icon: React.ElementType }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px', minWidth: '110px' }}>
      <div style={{ width: '32px', height: '32px', borderRadius: '7px', background: color + '18', border: `1px solid ${color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon style={{ width: '14px', height: '14px', color }} />
      </div>
      <div>
        <p style={{ margin: 0, fontSize: '19px', fontWeight: 700, color, lineHeight: 1 }}>{value}</p>
        <p style={{ margin: 0, fontSize: '10.5px', color: C.text4, marginTop: '2px' }}>{label}</p>
      </div>
    </div>
  );
}

// ── Filter tabs ───────────────────────────────────────────────────────────────

type FilterKey = 'all' | 'risk' | 'active' | 'planning' | 'on_hold' | 'completed';

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const t = useT();
  const router = useRouter();
  const { projects, isLoading, fetchProjects } = useProjectStore();
  const [search,      setSearch]      = useState('');
  const [filter,      setFilter]      = useState<FilterKey>('all');
  const [showModal,   setShowModal]   = useState(false);

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: 'all',       label: t.projects_filter_all },
    { key: 'risk',      label: t.projects_health_at_risk },
    { key: 'active',    label: t.projects_filter_active },
    { key: 'planning',  label: t.projects_filter_planning },
    { key: 'on_hold',   label: t.projects_filter_on_hold },
    { key: 'completed', label: t.projects_filter_completed },
  ];

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:     projects.length,
    active:    projects.filter((p) => p.status === 'ACTIVE').length,
    risk:      projects.filter(isAtRisk).length,
    completed: projects.filter((p) => p.status === 'COMPLETED').length,
    planning:  projects.filter((p) => p.status === 'PLANNING').length,
    onHold:    projects.filter((p) => p.status === 'ON_HOLD').length,
  }), [projects]);

  // ── Filtered + grouped ────────────────────────────────────────────────────
  const visible = useMemo(() => {
    let list = projects;
    if (search) list = list.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
    if (filter === 'risk')      list = list.filter(isAtRisk);
    else if (filter === 'active')    list = list.filter((p) => p.status === 'ACTIVE');
    else if (filter === 'planning')  list = list.filter((p) => p.status === 'PLANNING');
    else if (filter === 'on_hold')   list = list.filter((p) => p.status === 'ON_HOLD');
    else if (filter === 'completed') list = list.filter((p) => p.status === 'COMPLETED');
    return list;
  }, [projects, search, filter]);

  const grouped = useMemo(() => {
    const active    = visible.filter((p) => p.status === 'ACTIVE');
    const planning  = visible.filter((p) => p.status === 'PLANNING');
    const on_hold   = visible.filter((p) => p.status === 'ON_HOLD');
    const completed = visible.filter((p) => p.status === 'COMPLETED');
    const archived  = visible.filter((p) => p.status === 'ARCHIVED');
    return { active, planning, on_hold, completed, archived };
  }, [visible]);

  const goTo = (id: string) => router.push(`/dashboard/projects/${id}`);

  return (
    <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div style={{ background: C.bg2, borderBottom: `1px solid ${C.border}`, padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: C.text, letterSpacing: '-0.01em' }}>{t.projects_title}</h1>
          <p style={{ margin: 0, fontSize: '12px', color: C.text4, marginTop: '2px' }}>
            {t.projects_count(projects.length)}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', borderRadius: '7px', fontSize: '12.5px', fontWeight: 600, background: C.accent, color: '#fff', border: 'none', cursor: 'pointer', transition: 'opacity 0.1s' }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          <Plus style={{ width: '13px', height: '13px' }} /> {t.projects_btn_create}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '22px 28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* ── Stats strip ──────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <StatChip value={stats.total}     label={t.projects_filter_all}       color={C.accent}  icon={FileStack} />
          <StatChip value={stats.active}    label={t.projects_filter_active}    color={C.green}   icon={TrendingUp} />
          <StatChip value={stats.risk}      label={t.projects_health_at_risk}   color={C.amber}   icon={AlertTriangle} />
          <StatChip value={stats.completed} label={t.projects_filter_completed} color={C.text3}   icon={CheckCircle2} />
          <StatChip value={stats.planning}  label={t.projects_filter_planning}  color={C.accent}  icon={Clock} />
          {stats.onHold > 0 && (
            <StatChip value={stats.onHold}  label={t.projects_filter_on_hold}   color={C.amber}   icon={Clock} />
          )}
        </div>

        {/* ── Filter + Search ───────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '3px', gap: '2px' }}>
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  style={{
                    padding: '5px 11px', borderRadius: '6px', fontSize: '12px', fontWeight: active ? 600 : 400,
                    background: active ? C.hover : 'transparent',
                    color: active ? C.text : C.text3,
                    border: active ? `1px solid ${C.border2}` : '1px solid transparent',
                    cursor: 'pointer', transition: 'all 0.1s', whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = C.text2; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = C.text3; }}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginLeft: 'auto' }}>
            <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '13px', height: '13px', color: C.text4 }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.projects_search_placeholder}
              style={{
                padding: '7px 12px 7px 30px', borderRadius: '7px', fontSize: '12.5px',
                background: C.surface, border: `1px solid ${C.border2}`, color: C.text,
                outline: 'none', width: '220px', transition: 'border-color 0.1s',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = C.accent + '66')}
              onBlur={(e) => (e.currentTarget.style.borderColor = C.border2)}
            />
          </div>
        </div>

        {/* ── Content ──────────────────────────────────────────────────── */}
        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
            <svg className="animate-spin" viewBox="0 0 16 16" fill="none" width="22" height="22">
              <circle cx="8" cy="8" r="6" stroke={C.accent} strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" />
            </svg>
          </div>
        ) : visible.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: '12px' }}>
            <FolderOpen style={{ width: '32px', height: '32px', color: C.text4 }} />
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: C.text2 }}>
              {projects.length === 0 ? t.projects_empty_title : t.projects_no_results}
            </p>
            <p style={{ margin: 0, fontSize: '12.5px', color: C.text4, textAlign: 'center', maxWidth: '340px' }}>
              {projects.length === 0 ? t.projects_empty_desc : ''}
            </p>
            {projects.length === 0 && (
              <button
                onClick={() => setShowModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', borderRadius: '7px', fontSize: '12.5px', fontWeight: 500, background: C.accent, color: '#fff', border: 'none', cursor: 'pointer', marginTop: '4px' }}
              >
                <Plus style={{ width: '13px', height: '13px' }} /> {t.projects_btn_create}
              </button>
            )}
          </div>
        ) : (
          <div>
            <Section title={t.projects_status_active}    color={C.green}  projects={grouped.active}    onCardClick={goTo} defaultOpen />
            <Section title={t.projects_status_planning} color={C.accent} projects={grouped.planning}  onCardClick={goTo} defaultOpen />
            <Section title={t.projects_status_on_hold}  color={C.amber}  projects={grouped.on_hold}   onCardClick={goTo} defaultOpen />
            <Section title={t.projects_status_completed}color={C.text3}  projects={grouped.completed} onCardClick={goTo} defaultOpen={false} />
            <Section title={t.projects_status_cancelled}color={C.text4}  projects={grouped.archived}  onCardClick={goTo} defaultOpen={false} />
          </div>
        )}
      </div>

      {showModal && (
        <CreateProjectModal
          onClose={() => setShowModal(false)}
          onCreated={(project) => {
            setShowModal(false);
            router.push(`/dashboard/projects/${project.id}`);
          }}
        />
      )}
    </div>
  );
}
